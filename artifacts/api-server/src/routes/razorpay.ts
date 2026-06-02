// @ts-nocheck
import { Router } from "express";
import crypto from "crypto";
import Razorpay from "razorpay";
import { logger } from "../lib/logger";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";

function initFirebaseAdmin() {
  if (getApps().length) return getDatabase();
  const svcJson = process.env["FIREBASE_SERVICE_ACCOUNT"];
  if (svcJson) {
    try {
      const credential = cert(JSON.parse(svcJson));
      initializeApp({ credential, databaseURL: "https://shiken-d8789-default-rtdb.firebaseio.com" });
      return getDatabase();
    } catch (e) {
      logger.error({ err: e }, "Failed to parse FIREBASE_SERVICE_ACCOUNT");
    }
  }
  // Fallback: try applicationDefault (works in Cloud Functions / GCP)
  try {
    const { applicationDefault } = require("firebase-admin/app");
    initializeApp({
      credential: applicationDefault(),
      databaseURL: "https://shiken-d8789-default-rtdb.firebaseio.com",
    });
  } catch {
    initializeApp({ databaseURL: "https://shiken-d8789-default-rtdb.firebaseio.com" });
  }
  return getDatabase();
}
const adminDb = initFirebaseAdmin();

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

/** Map planId to days, strictly separated category, and base amount */
function planMeta(planId: string): { days: number; category: "jee" | "neet" | "class10" | "class12" | "other"; amount: number } {
  switch (planId) {
    // ─── JEE PLANS ───────────────────────────────────────
    case "jee_7d":        return { days: 7,   category: "jee",     amount: 51  };
    case "jee_1m":        return { days: 30,  category: "jee",     amount: 75  };
    case "jee_6m":        return { days: 180, category: "jee",     amount: 399 };

    // ─── NEET PLANS ──────────────────────────────────────
    case "neet_7d":       return { days: 7,   category: "neet",    amount: 51  };
    case "neet_1m":       return { days: 30,  category: "neet",    amount: 75  };
    case "neet_6m":       return { days: 180, category: "neet",    amount: 399 };

    // ─── CLASS 10TH PLANS ────────────────────────────────
    case "c10_1m":        return { days: 30,  category: "class10", amount: 49  };
    case "c10_6m_single": return { days: 180, category: "class10", amount: 99  };
    case "c10_6m_full":   return { days: 180, category: "class10", amount: 199 };

    // ─── CLASS 12TH PLANS ────────────────────────────────
    case "c12_1m":        return { days: 30,  category: "class12", amount: 49  };
    case "c12_6m_single": return { days: 180, category: "class12", amount: 99  };
    case "c12_6m_full":   return { days: 180, category: "class12", amount: 199 };

    // ─── DEFAULT ─────────────────────────────────────────
    default:              return { days: 30,  category: "other",   amount: 0   };
  }
}

const QUALIFYING_PLAN_AMOUNTS = new Set([199, 399]);

async function creditReferrer(
  referredBy: string,
  planId: string,
  category: "jee" | "neet" | "class10" | "class12" | "other",
): Promise<void> {
  if (!referredBy) return;

  const { amount: planAmount } = planMeta(planId);
  if (!QUALIFYING_PLAN_AMOUNTS.has(planAmount)) {
    logger.info({ referrer: referredBy, planId, planAmount }, "Referral reward skipped — plan not qualifying (not ₹199/₹399)");
    return;
  }

  // JEE/NEET ke liye ₹5 aur Boards ke liye ₹10 ka reward
  const reward = (category === "jee" || category === "neet") ? 5 : 10;
  const safeRef = String(referredBy).replace(/[#.$\/[\]]/g, "_");
  try {
    const snap = await adminDb.ref(`users/${safeRef}`).get();
    const refData = snap.val() as Record<string, unknown> | null;
    const currentWallet = typeof refData?.walletBalance === "number" ? refData.walletBalance : 0;
    const currentCount  = typeof refData?.referralCount  === "number" ? refData.referralCount  : 0;
    await adminDb.ref(`users/${safeRef}`).update({
      walletBalance: currentWallet + reward,
      referralCount: currentCount + 1,
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

    // ── 1. Apply coupon logic (Bina count badhaye, sirf price minus karega) ──────
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
            // ⚠️ YAHAN SE FETCH PUT KO HATADIA HAI TAQI FALTU ME COUNT NA BADHE ⚠️
          }
        }
      } catch { /* ignore coupon errors */ }
    }

    // ── 2. Apply wallet balance as discount ───────────────────────────────────
    if (useWallet && uid) {
      const safeUid = String(uid).replace(/[.#$/[\]]/g, "_");
      try {
        const userRes  = await fetch(`${DB_URL}/users/${safeUid}/walletBalance.json`);
        const walletBal = userRes.ok ? (await userRes.json() as number | null) : null;
        const balance   = typeof walletBal === "number" && walletBal > 0 ? walletBal : 0;
        if (balance > 0) {
          walletDiscount = Math.min(balance, finalAmount - 1);
          if (walletDiscount > 0) {
            finalAmount = finalAmount - walletDiscount;
          }
        }
      } catch {
        logger.warn({ uid }, "Could not fetch wallet balance for order");
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

    if (walletDiscount > 0) {
      const safeUid = String(uid).replace(/[.#$/[\]]/g, "_");
      fetch(`${DB_URL}/pendingOrderWallet/${order.id}.json`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: safeUid, walletDiscount, createdAt: Date.now() }),
      }).catch(() => {});
    }

    logger.info({ orderId: order.id, uid, planId, finalAmount, discount, walletDiscount }, "Razorpay order created");

    const keyId = process.env["RAZORPAY_KEY_ID"];

    return res.json({
      ok:            true,
      orderId:       order.id,
      amount:        finalAmount,
      discount,
      couponApplied,
      walletDiscount,
      key:           keyId,
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
      return res.json({ ok: true, valid: false, couponApplied: false, discount: 0, finalAmount: baseAmount });
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
      return res.json({ ok: true, valid: false, couponApplied: false, discount: 0, finalAmount: baseAmount });
    }

    const discount    = coupon.type === "percent"
      ? Math.round((baseAmount * coupon.value) / 100)
      : coupon.value;
    const finalAmount = Math.max(1, baseAmount - discount);

    // ⚡ Dono 'valid' aur 'couponApplied' bhej rahe hain taqi frontend khush rahe ⚡
    return res.json({ 
      ok: true, 
      valid: true, 
      couponApplied: true, 
      discount, 
      finalAmount, 
      type: coupon.type, 
      value: coupon.value 
    });
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

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !uid || !planId) {
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

    // 🌟 SUCCESS DETECTED: Ab yahan coupon ka usageCount badhayenge safe tareeqe se 🌟
    try {
      const razorpay = getRazorpayClient();
      const orderDetails = await razorpay.orders.fetch(razorpay_order_id);
      if (orderDetails?.notes?.couponApplied === "true") {
        const appliedCode = String(orderDetails.notes.couponCode).trim().toUpperCase();
        if (appliedCode) {
          const couponFetch = await fetch(`${DB_URL}/coupons/${appliedCode}.json`);
          if (couponFetch.ok) {
            const currentCoupon = await couponFetch.json();
            if (currentCoupon) {
              const currentCount = typeof currentCoupon.usageCount === "number" ? currentCoupon.usageCount : 0;
              await adminDb.ref(`coupons/${appliedCode}/usageCount`).set(currentCount + 1);
              logger.info({ couponCode: appliedCode, newCount: currentCount + 1 }, "Coupon usage count successfully incremented");
            }
          }
        }
      }
    } catch (couponErr) {
      logger.error({ couponErr }, "Failed to increment coupon count during verification");
    }

    let existingSubjects: string[] = [];
    if (planSubject) {
      try {
        const existing = await fetch(`${DB_URL}/users/${safeId}/premiumSubjects.json`);
        const data = await existing.json();
        if (Array.isArray(data)) existingSubjects = data;
        else if (data && typeof data === "object") existingSubjects = Object.values(data);
      } catch { /* ignore */ }
    }

    const { days: planDays, category } = planMeta(planId);
    const effectiveDays = Number(days) || planDays;
    const now = Date.now();
    const newExpiry = now + effectiveDays * 86_400_000;

    // ── Fetch existing user data so we can merge purchased_tests ──
    let existingPurchases: Record<string, unknown> = {};
    let existingExpiry = 0;
    let existingSubType: string | null = null;
    try {
      const userSnap = await adminDb.ref(`users/${safeId}`).get();
      const val = userSnap.val() as Record<string, unknown> | null;
      if (val) {
        existingPurchases = val.purchased_tests && typeof val.purchased_tests === "object"
          ? (val.purchased_tests as Record<string, unknown>)
          : {};
        existingExpiry = typeof val.premiumUntil === "number" ? val.premiumUntil : 0;
        existingSubType = typeof val.subscriptionType === "string" ? val.subscriptionType : null;
      }
    } catch {
      logger.warn({ uid: safeId }, "Could not fetch existing user data for merge");
    }

    // Extend expiry if already premium and current expiry is in the future
    const premiumUntil = (existingSubType === "premium" && existingExpiry > now)
      ? Math.max(newExpiry, existingExpiry)
      : newExpiry;

    const mergedPurchases = {
      ...existingPurchases,
      [planId]: {
        active:      true,
        activatedAt: now,
        expiresAt:   premiumUntil,
        paymentId:   razorpay_payment_id,
      },
    };

    const firebasePayload: Record<string, unknown> = {
      subscriptionType:  "premium",
      premiumUntil:      premiumUntil,
      plan:              planId,
      activatedAt:       now,
      paymentVerified:   true,
      razorpayPaymentId: razorpay_payment_id,
      razorpayOrderId:   razorpay_order_id,
      purchased_tests:   mergedPurchases,
    };

    try {
      const pendingRes = await fetch(`${DB_URL}/pendingOrderWallet/${razorpay_order_id}.json`);
      if (pendingRes.ok) {
        const pendingData = await pendingRes.json() as { uid: string; walletDiscount: number } | null;
        if (pendingData && typeof pendingData.walletDiscount === "number" && pendingData.walletDiscount > 0) {
          if (pendingData.uid === safeId) {
            const walSnap = await adminDb.ref(`users/${safeId}/walletBalance`).get();
            const currentBal = typeof walSnap.val() === "number" ? walSnap.val() : 0;
            const newBal = Math.max(0, currentBal - pendingData.walletDiscount);
            await adminDb.ref(`users/${safeId}/walletBalance`).set(newBal);
            logger.info({ uid: safeId, walletDiscount: pendingData.walletDiscount, newBal }, "Wallet balance deducted after payment");
          }
          adminDb.ref(`pendingOrderWallet/${razorpay_order_id}`).remove().catch(() => {});
        }
      }
    } catch (walletErr) {
      logger.error({ walletErr, uid: safeId }, "Wallet deduction failed after payment");
    }

    const userRes  = await fetch(`${DB_URL}/users/${safeId}.json`);
    const userData = userRes.ok ? (await userRes.json() as Record<string, unknown> | null) : null;
    const referredBy = typeof userData?.referredBy === "string" ? userData.referredBy : null;
    if (referredBy) {
      await creditReferrer(referredBy, planId, category);
    }

    if (planSubject && typeof planSubject === "string") {
      const merged = Array.from(new Set([...existingSubjects, planSubject]));
      firebasePayload.premiumSubjects = merged;
    } else {
      firebasePayload.premiumSubjects = [];
    }

    logger.info({ uid: safeId, payloadKeys: Object.keys(firebasePayload) }, "Writing premium payload to Firebase...");

    try {
      await adminDb.ref(`users/${safeId}`).update(firebasePayload);
      logger.info({ uid, planId, planSubject, razorpay_payment_id }, "✅ Payment verified and Firebase updated successfully");
    } catch (dbErr: unknown) {
      const dbMsg = errorText(dbErr);
      logger.error({ dbErr: dbMsg, uid: safeId, path: `users/${safeId}` }, "❌ Firebase Admin DB write failed — check service account permissions");
      return res.status(500).json({ ok: false, error: `Firebase update failed: ${dbMsg}` });
    }

    return res.json({ ok: true, paymentId: razorpay_payment_id });
  } catch (err: unknown) {
    const msg = errorText(err);
    logger.error({ err: msg }, "verify-payment failed");
    return jsonError(res, 500, msg, "verify-payment failed");
  }
});

export default router;
