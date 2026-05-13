// @ts-nocheck
import { Router } from "express";
import crypto from "crypto";
import Razorpay from "razorpay";
import { logger } from "../lib/logger";

const router = Router();

const DB_URL = "https://shiken-d8789-default-rtdb.firebaseio.com";

function errorText(err: unknown): string {
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message || "Unknown error";
  if (err && typeof err === "object") {
    const maybe = (err as { error?: unknown; message?: unknown }).error ?? (err as { message?: unknown }).message;
    if (typeof maybe === "string" && maybe.trim()) return maybe;
    try { return JSON.stringify(err); } catch { return "Unknown error"; }
  }
  return "Unknown error";
}

function jsonError(res: any, status: number, err: unknown, fallback: string) {
  const msg = errorText(err) || fallback;
  return res.status(status).json({ ok: false, error: msg });
}

function getRazorpayClient(): Razorpay {
  const keyId     = process.env["RAZORPAY_KEY_ID"];
  const keySecret = process.env["RAZORPAY_KEY_SECRET"];
  if (!keyId || !keySecret) {
    throw new Error("RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set");
  }
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

// ─── POST /api/razorpay/create-order ─────────────────────────────────────────
router.post("/razorpay/create-order", async (req, res) => {
  try {
    const { amount, planId, uid, couponCode } = req.body;

    if (!amount || !planId || !uid) {
      return res.status(400).json({ ok: false, error: "amount, planId, and uid are required" });
    }

    let finalAmount = Number(amount);
    let discount    = 0;
    let couponApplied = false;

    if (couponCode && typeof couponCode === "string" && couponCode.trim()) {
      const code = couponCode.trim().toUpperCase();
      try {
        const couponRes = await fetch(`${DB_URL}/coupons/${code}.json`);
        if (couponRes.ok) {
          const coupon = await couponRes.json() as {
            type: "flat" | "percent"; value: number; active: boolean;
            expiresAt: number | null; usageLimit: number | null; usageCount: number;
          } | null;
          const now = Date.now();
          const validCoupon = coupon
            && coupon.active
            && (!coupon.expiresAt || coupon.expiresAt > now)
            && (coupon.usageLimit === null || coupon.usageCount < coupon.usageLimit);
          if (validCoupon) {
            discount = coupon.type === "percent"
              ? Math.round((finalAmount * coupon.value) / 100)
              : coupon.value;
            finalAmount = Math.max(1, finalAmount - discount);
            couponApplied = true;
            // Increment usage count (fire-and-forget, best effort)
            fetch(`${DB_URL}/coupons/${code}/usageCount.json`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify((coupon.usageCount ?? 0) + 1),
            }).catch(() => {});
          }
        }
      } catch { /* ignore coupon errors — don't block payment */ }
    }

    const razorpay = getRazorpayClient();

    const order = await razorpay.orders.create({
      amount:   finalAmount * 100,
      currency: "INR",
      receipt:  `shiken_${planId}_${Date.now()}`,
      notes: {
        uid,
        planId,
        couponCode:    couponCode ?? "",
        discount:      String(discount),
        couponApplied: String(couponApplied),
      },
    });

    logger.info({ orderId: order.id, uid, planId, finalAmount, discount }, "Razorpay order created");

    return res.json({
      ok:           true,
      orderId:      order.id,
      amount:       finalAmount,
      discount,
      couponApplied,
    });
  } catch (err: unknown) {
    const msg = errorText(err);
    logger.error({ err: msg }, "create-order failed");
    return jsonError(res, 500, msg, "create-order failed");
  }
});

// ─── POST /api/razorpay/validate-coupon ──────────────────────────────────────
router.post("/razorpay/validate-coupon", async (req, res) => {
  try {
    const { couponCode, amount } = req.body;
    if (!couponCode || !amount) {
      return res.status(400).json({ ok: false, error: "couponCode and amount are required" });
    }
    const code = String(couponCode).trim().toUpperCase();
    const baseAmount = Number(amount);

    const couponRes = await fetch(`${DB_URL}/coupons/${code}.json`);
    if (!couponRes.ok) {
      return res.json({ ok: true, couponApplied: false, discount: 0, finalAmount: baseAmount });
    }
    const coupon = await couponRes.json() as {
      type: "flat" | "percent"; value: number; active: boolean;
      expiresAt: number | null; usageLimit: number | null; usageCount: number;
    } | null;

    const now = Date.now();
    const valid = coupon
      && coupon.active
      && (!coupon.expiresAt || coupon.expiresAt > now)
      && (coupon.usageLimit === null || coupon.usageCount < coupon.usageLimit);

    if (!valid) {
      return res.json({ ok: true, couponApplied: false, discount: 0, finalAmount: baseAmount });
    }

    const discount = coupon.type === "percent"
      ? Math.round((baseAmount * coupon.value) / 100)
      : coupon.value;
    const finalAmount = Math.max(1, baseAmount - discount);

    return res.json({ ok: true, couponApplied: true, discount, finalAmount, type: coupon.type, value: coupon.value });
  } catch (err: unknown) {
    const msg = errorText(err);
    return jsonError(res, 500, msg, "coupon validation failed");
  }
});

// ─── POST /api/razorpay/verify-payment ────────────────────────────────────────
// planSubject: if present, sets per-subject premium instead of all-subjects
router.post("/razorpay/verify-payment", async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      uid,
      planId,
      days,
      planSubject,  // optional — set for single-subject plans
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !uid || !planId || !days) {
      return res.status(400).json({ ok: false, error: "Missing required fields" });
    }

    const secret = process.env["RAZORPAY_KEY_SECRET"];
    if (!secret) {
      return res.status(500).json({ ok: false, error: "Server misconfigured: missing key secret" });
    }

    const body              = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(body)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      logger.warn({ uid, razorpay_payment_id }, "Razorpay signature mismatch — possible fraud attempt");
      return res.status(400).json({ ok: false, error: "Payment verification failed: invalid signature" });
    }

    const safeId = String(uid).replace(/[.#$/[\]]/g, "_");

    // ── Fetch existing premiumSubjects so we can append ───────────────────────
    let existingSubjects: string[] = [];
    if (planSubject) {
      try {
        const existing = await fetch(`${DB_URL}/users/${safeId}/premiumSubjects.json`);
        const data = await existing.json();
        if (Array.isArray(data)) existingSubjects = data;
        else if (data && typeof data === "object") existingSubjects = Object.values(data);
      } catch { /* ignore — just use empty */ }
    }

    // Build the Firebase update payload
    const firebasePayload: Record<string, unknown> = {
      subscriptionType:  "premium",
      premiumUntil:      Date.now() + Number(days) * 86_400_000,
      plan:              planId,
      activatedAt:       Date.now(),
      paymentVerified:   true,
      razorpayPaymentId: razorpay_payment_id,
      razorpayOrderId:   razorpay_order_id,
      purchased_tests: {
        [planId]: {
          active:      true,
          activatedAt: Date.now(),
          expiresAt:   Date.now() + Number(days) * 86_400_000,
          paymentId:   razorpay_payment_id,
        },
      },
    };

    // For single-subject plans: accumulate premiumSubjects array
    // For all-subjects plans: clear premiumSubjects so isSubjectPremium returns true for all
    if (planSubject && typeof planSubject === "string") {
      const merged = Array.from(new Set([...existingSubjects, planSubject]));
      firebasePayload.premiumSubjects = merged;
    } else {
      // all-subjects plan — clear any subject restrictions
      firebasePayload.premiumSubjects = [];
    }

    const firebaseRes = await fetch(`${DB_URL}/users/${safeId}.json`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(firebasePayload),
    });

    if (!firebaseRes.ok) {
      logger.error({ uid, status: firebaseRes.status }, "Firebase update failed after verified payment");
      return res.status(502).json({ ok: false, error: "Payment verified but Firebase update failed — contact support" });
    }

    logger.info({ uid, planId, planSubject, razorpay_payment_id }, "Payment verified and Firebase updated");

    return res.json({ ok: true, paymentId: razorpay_payment_id });
  } catch (err: unknown) {
    const msg = errorText(err);
    logger.error({ err: msg }, "verify-payment failed");
    return jsonError(res, 500, msg, "verify-payment failed");
  }
});

export default router;
