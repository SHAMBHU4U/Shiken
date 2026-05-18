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

/** Map planId to days, category, and base amount */
function planMeta(planId: string): { days: number; category: "jee_neet" | "class10_12" | "other"; amount: number } {
  switch (planId) {
    case "jee_neet_weekly":        return { days: 7,   category: "jee_neet",   amount: 29  };
    case "jee_neet_monthly":       return { days: 30,  category: "jee_neet",   amount: 69  };
    case "jee_neet_yearly":        return { days: 365, category: "jee_neet",   amount: 399 };
    case "c10_monthly":            return { days: 30,  category: "class10_12", amount: 49  };
    case "c12_monthly":            return { days: 30,  category: "class10_12", amount: 49  };
    case "c10_6month":             return { days: 180, category: "class10_12", amount: 99  };
    case "c12_6month":             return { days: 180, category: "class10_12", amount: 99  };
    case "monthly_one":            return { days: 30,  category: "other",      amount: 99  };
    case "biannual_one":           return { days: 180, category: "other",      amount: 199 };
    case "biannual_all":           return { days: 180, category: "other",      amount: 399 };
    case "board_premium_6month":   return { days: 180, category: "class10_12", amount: 199 };
    default:                       return { days: 30,  category: "other",      amount: 0   };
  }
}

/** Plans that qualify for referral rewards (₹199 and ₹399 only) */
const QUALIFYING_PLAN_AMOUNTS = new Set([199, 399]);

/** Credit referrer ONLY when referred user buys a qualifying plan (₹199 or ₹399) */
async function creditReferrer(
  referredBy: string,
  planId: string,
  category: "jee_neet" | "class10_12" | "other",
): Promise<void> {
  if (!referredBy) return;

  const { amount: planAmount } = planMeta(planId);
  if (!QUALIFYING_PLAN_AMOUNTS.has(planAmount)) {
    logger.info({ referrer: referredBy, planId, planAmount }, "Referral reward skipped — plan not qualifying (not ₹199/₹399)");
    return;
  }

  const reward = category === "jee_neet" ? 5 : 10;
  const safeRef = String(referredBy).replace(/[#.$\/[\]]/g, "_");
  try {
    const refRes = await fetch(`${DB_URL}/users/${safeRef}.json`);
    const refData = refRes.ok ? (await refRes.json() as Record<string, unknown> | null) : null;
    const currentWallet = typeof refData?.walletBalance === "number" ? refData.walletBalance : 0;
    const currentCount  = typeof refData?.referralCount  === "number" ? refData.referralCount  : 0;
    await fetch(`${DB_URL}/users/${safeRef}.json`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        walletBalance: currentWallet + reward,
        referralCount: currentCount + 1,
      }),
    });
    logger.info({ referrer: safeRef, reward, category, planId }, "Referral reward credited (qualifying plan)");
  } catch (err) {
    logger.error({ err, referrer: safeRef }, "Failed to credit referrer");
  }
}

// ─── POST /api/razorpay/create-order ─────────────────────────────────────────
router.post("/razorpay/create-order", async (req, res) => {
  try {
    const { amount, planId, uid, couponCode, useWallet } = req.body;

    if (!amount || !planId || !uid) {
      return res.status(400).json({ ok: false, error: "amount, planId, and uid are required" });
    }

    let finalAmount    = Number(amount);
    let discount       = 0;
    let couponApplied  = false;
    let walletDiscount = 0;

    // ── 1. Apply coupon first ─────────────────────────────────────────────────
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
            finalAmount   = Math.max(1, finalAmount - discount);
            couponApplied = true;
            fetch(`${DB_URL}/coupons/${code}/usageCount.json`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify((coupon.usageCount ?? 0) + 1),
            }).catch(() => {});
          }
        }
      } catch { /* ignore coupon errors — don't block payment */ }
    }

    // ── 2. Apply wallet balance as discount ───────────────────────────────────
    if (useWallet && uid) {
      const safeUid = String(uid).replace(/[.#$/[\]]/g, "_");
      try {
        const userRes  = await fetch(`${DB_URL}/users/${safeUid}/walletBalance.json`);
        const walletBal = userRes.ok ? (await userRes.json() as number | null) : null;
        const balance   = typeof walletBal === "number" && walletBal > 0 ? walletBal : 0;
        if (balance > 0) {
          // Deduct up to the current finalAmount − 1 (minimum ₹1 must go via Razorpay)
          walletDiscount = Math.min(balance, finalAmount - 1);
          if (walletDiscount > 0) {
            finalAmount = finalAmount - walletDiscount;
          }
        }
      } catch {
        logger.warn({ uid }, "Could not fetch wallet balance for order — skipping wallet discount");
      }
    }

    const razorpay = getRazorpayClient();

    const order = await razorpay.orders.create({
      amount:   Math.round(finalAmount * 100), // paise
      currency: "INR",
      receipt:  `shiken_${planId}_${Date.now()}`,
      notes: {
        uid,
        planId,
        couponCode:    couponCode ?? "",
        discount:      String(discount),
        couponApplied: String(couponApplied),
        walletDiscount: String(walletDiscount),
      },
    });

    // ── 3. Persist walletDiscount against orderId for secure server-side deduction ─
    if (walletDiscount > 0) {
      const safeUid = String(uid).replace(/[.#$/[\]]/g, "_");
      fetch(`${DB_URL}/pendingOrderWallet/${order.id}.json`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: safeUid, walletDiscount, createdAt: Date.now() }),
      }).catch(() => {});
    }

    logger.info({ orderId: order.id, uid, planId, finalAmount, discount, walletDiscount }, "Razorpay order created");

    return res.json({
      ok:            true,
      orderId:       order.id,
      amount:        finalAmount,
      discount,
      couponApplied,
      walletDiscount,
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
    const code       = String(couponCode).trim().toUpperCase();
    const baseAmount = Number(amount);

    const couponRes = await fetch(`${DB_URL}/coupons/${code}.json`);
    if (!couponRes.ok) {
      return res.json({ ok: true, couponApplied: false, discount: 0, finalAmount: baseAmount });
    }
    const coupon = await couponRes.json() as {
      type: "flat" | "percent"; value: number; active: boolean;
      expiresAt: number | null; usageLimit: number | null; usageCount: number;
    } | null;

    const now   = Date.now();
    const valid = coupon
      && coupon.active
      && (!coupon.expiresAt || coupon.expiresAt > now)
      && (coupon.usageLimit === null || coupon.usageCount < coupon.usageLimit);

    if (!valid) {
      return res.json({ ok: true, couponApplied: false, discount: 0, finalAmount: baseAmount });
    }

    const discount    = coupon.type === "percent"
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
router.post("/razorpay/verify-payment", async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      uid,
      planId,
      days,
      planSubject,
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
    const { days: planDays, category } = planMeta(planId);
    const effectiveDays = Number(days) || planDays;
    const premiumUntil  = Date.now() + effectiveDays * 86_400_000;

    const firebasePayload: Record<string, unknown> = {
      subscriptionType:  "premium",
      premiumUntil:      premiumUntil,
      plan:              planId,
      activatedAt:       Date.now(),
      paymentVerified:   true,
      razorpayPaymentId: razorpay_payment_id,
      razorpayOrderId:   razorpay_order_id,
      purchased_tests: {
        [planId]: {
          active:      true,
          activatedAt: Date.now(),
          expiresAt:   premiumUntil,
          paymentId:   razorpay_payment_id,
        },
      },
    };

    // ── Deduct wallet balance securely using server-side record ───────────────
    try {
      const pendingRes = await fetch(`${DB_URL}/pendingOrderWallet/${razorpay_order_id}.json`);
      if (pendingRes.ok) {
        const pendingData = await pendingRes.json() as { uid: string; walletDiscount: number } | null;
        if (pendingData && typeof pendingData.walletDiscount === "number" && pendingData.walletDiscount > 0) {
          // Verify the uid matches
          if (pendingData.uid === safeId) {
            const walletRes = await fetch(`${DB_URL}/users/${safeId}/walletBalance.json`);
            const currentBal = walletRes.ok ? (await walletRes.json() as number | null) : null;
            const newBal = Math.max(0, (typeof currentBal === "number" ? currentBal : 0) - pendingData.walletDiscount);
            await fetch(`${DB_URL}/users/${safeId}/walletBalance.json`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(newBal),
            });
            logger.info({ uid: safeId, walletDiscount: pendingData.walletDiscount, newBal }, "Wallet balance deducted after payment");
          }
          // Clean up the pending record (fire-and-forget)
          fetch(`${DB_URL}/pendingOrderWallet/${razorpay_order_id}.json`, { method: "DELETE" }).catch(() => {});
        }
      }
    } catch (walletErr) {
      logger.error({ walletErr, uid: safeId }, "Wallet deduction failed after payment — non-fatal");
    }

    // ── Credit referrer only for qualifying plans (₹199 or ₹399) ─────────────
    const userRes  = await fetch(`${DB_URL}/users/${safeId}.json`);
    const userData = userRes.ok ? (await userRes.json() as Record<string, unknown> | null) : null;
    const referredBy = typeof userData?.referredBy === "string" ? userData.referredBy : null;
    if (referredBy) {
      await creditReferrer(referredBy, planId, category);
    }

    // For single-subject plans: accumulate premiumSubjects array
    // For all-subjects plans: clear premiumSubjects so isSubjectPremium returns true for all
    if (planSubject && typeof planSubject === "string") {
      const merged = Array.from(new Set([...existingSubjects, planSubject]));
      firebasePayload.premiumSubjects = merged;
    } else {
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
