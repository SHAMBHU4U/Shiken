// @ts-nocheck
import { Router } from "express";
import crypto from "crypto";
import Razorpay from "razorpay";
import { logger } from "../lib/logger";

const router = Router();

const DB_URL = "https://shiken-d8789-default-rtdb.firebaseio.com";

function getRazorpayClient(): Razorpay {
  const keyId     = process.env["RAZORPAY_KEY_ID"];
  const keySecret = process.env["RAZORPAY_KEY_SECRET"];
  if (!keyId || !keySecret) {
    throw new Error("RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set");
  }
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

// ─── POST /api/razorpay/create-order ─────────────────────────────────────────
// Creates a Razorpay order. Coupon discount logic is plugged in here.
router.post("/razorpay/create-order", async (req, res) => {
  try {
    const { amount, planId, uid, couponCode } = req.body;

    if (!amount || !planId || !uid) {
      return res.status(400).json({ ok: false, error: "amount, planId, and uid are required" });
    }

    // ── Coupon discount logic (extend this block later) ───────────────────────
    let finalAmount = Number(amount);
    let discount    = 0;
    let couponApplied = false;

    if (couponCode && typeof couponCode === "string" && couponCode.trim()) {
      const code = couponCode.trim().toUpperCase();

      // Example coupons — replace or extend with DB lookup as needed
      const COUPONS: Record<string, { type: "flat" | "percent"; value: number }> = {
        // "SHIKEN10": { type: "percent", value: 10 },
        // "FLAT20":   { type: "flat",    value: 20  },
      };

      const coupon = COUPONS[code];
      if (coupon) {
        discount = coupon.type === "percent"
          ? Math.round((finalAmount * coupon.value) / 100)
          : coupon.value;
        finalAmount = Math.max(1, finalAmount - discount); // minimum ₹1
        couponApplied = true;
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    const razorpay = getRazorpayClient();

    const order = await razorpay.orders.create({
      amount:   finalAmount * 100,   // Razorpay expects paise
      currency: "INR",
      receipt:  `shiken_${planId}_${Date.now()}`,
      notes: {
        uid,
        planId,
        couponCode:   couponCode ?? "",
        discount:     String(discount),
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
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err: msg }, "create-order failed");
    return res.status(500).json({ ok: false, error: msg });
  }
});

// ─── POST /api/razorpay/verify-payment ────────────────────────────────────────
// Verifies the Razorpay signature, then updates Firebase on success.
router.post("/razorpay/verify-payment", async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      uid,
      planId,
      days,
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !uid || !planId || !days) {
      return res.status(400).json({ ok: false, error: "Missing required fields" });
    }

    // ── Signature verification ────────────────────────────────────────────────
    const secret = process.env["RAZORPAY_KEY_SECRET"];
    if (!secret) {
      return res.status(500).json({ ok: false, error: "Server misconfigured: missing key secret" });
    }

    const body             = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(body)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      logger.warn({ uid, razorpay_payment_id }, "Razorpay signature mismatch — possible fraud attempt");
      return res.status(400).json({ ok: false, error: "Payment verification failed: invalid signature" });
    }
    // ─────────────────────────────────────────────────────────────────────────

    // ── Firebase update ───────────────────────────────────────────────────────
    const safeId = String(uid).replace(/[.#$/[\]]/g, "_");

    const firebaseRes = await fetch(`${DB_URL}/users/${safeId}.json`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subscriptionType:   "premium",
        premiumUntil:       Date.now() + Number(days) * 86_400_000,
        plan:               planId,
        activatedAt:        Date.now(),
        paymentVerified:    true,
        razorpayPaymentId:  razorpay_payment_id,
        razorpayOrderId:    razorpay_order_id,
        // purchased_tests field — access gate for test content
        purchased_tests: {
          [planId]: {
            active:     true,
            activatedAt: Date.now(),
            expiresAt:  Date.now() + Number(days) * 86_400_000,
            paymentId:  razorpay_payment_id,
          },
        },
      }),
    });

    if (!firebaseRes.ok) {
      logger.error({ uid, status: firebaseRes.status }, "Firebase update failed after verified payment");
      return res.status(502).json({ ok: false, error: "Payment verified but Firebase update failed — contact support" });
    }
    // ─────────────────────────────────────────────────────────────────────────

    logger.info({ uid, planId, razorpay_payment_id }, "Payment verified and Firebase updated");

    return res.json({ ok: true, paymentId: razorpay_payment_id });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err: msg }, "verify-payment failed");
    return res.status(500).json({ ok: false, error: msg });
  }
});

export default router;
