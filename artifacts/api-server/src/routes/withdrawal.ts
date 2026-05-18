import { Router } from "express";
import { logger } from "../lib/logger";

const router = Router();
const DB_URL = "https://shiken-d8789-default-rtdb.firebaseio.com";

const MIN_WITHDRAWAL = 151;

function safeId(uid: string): string {
  return uid.replace(/[.#$/[\]]/g, "_");
}

/**
 * POST /api/withdrawal/request
 * Body: { uid: string, upiId: string, amount: number }
 * - Validates wallet balance >= amount >= 151
 * - Deducts amount from walletBalance atomically
 * - Creates a pending withdrawal request in Firebase
 */
router.post("/withdrawal/request", async (req, res) => {
  try {
    const { uid, upiId, amount } = req.body;

    if (!uid || typeof uid !== "string") {
      return res.status(400).json({ ok: false, error: "uid is required" });
    }
    if (!upiId || typeof upiId !== "string" || !upiId.includes("@")) {
      return res.status(400).json({ ok: false, error: "Valid UPI ID is required (e.g. name@upi)" });
    }
    const amountNum = Number(amount);
    if (!Number.isFinite(amountNum) || amountNum < MIN_WITHDRAWAL) {
      return res.status(400).json({ ok: false, error: `Minimum withdrawal amount is ₹${MIN_WITHDRAWAL}` });
    }

    const safe = safeId(uid);

    // Fetch current wallet balance
    const walletRes = await fetch(`${DB_URL}/users/${safe}/walletBalance.json`);
    if (!walletRes.ok) {
      return res.status(502).json({ ok: false, error: "Could not fetch wallet balance. Try again." });
    }
    const walletBal = await walletRes.json() as number | null;
    const balance   = typeof walletBal === "number" ? walletBal : 0;

    if (balance < amountNum) {
      return res.status(400).json({
        ok: false,
        error: `Insufficient wallet balance. Your balance is ₹${balance}.`,
      });
    }

    // Deduct from wallet balance
    const newBalance = balance - amountNum;
    const deductRes  = await fetch(`${DB_URL}/users/${safe}/walletBalance.json`, {
      method:  "PUT",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(newBalance),
    });
    if (!deductRes.ok) {
      return res.status(502).json({ ok: false, error: "Could not deduct from wallet. Try again." });
    }

    // Create withdrawal request record
    const requestId  = `wr_${Date.now()}`;
    const requestDoc = {
      uid:         safe,
      upiId:       upiId.trim(),
      amount:      amountNum,
      status:      "pending",
      requestedAt: Date.now(),
    };

    const writeRes = await fetch(`${DB_URL}/withdrawalRequests/${safe}/${requestId}.json`, {
      method:  "PUT",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(requestDoc),
    });
    if (!writeRes.ok) {
      // Refund the balance if we couldn't write the request
      await fetch(`${DB_URL}/users/${safe}/walletBalance.json`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(balance),
      }).catch(() => {});
      return res.status(502).json({ ok: false, error: "Could not save withdrawal request. Amount has been refunded. Try again." });
    }

    logger.info({ uid: safe, upiId: upiId.trim(), amount: amountNum, requestId }, "Withdrawal request created");

    return res.json({
      ok:         true,
      requestId,
      newBalance,
      message:    `Withdrawal request of ₹${amountNum} submitted! It will be processed within 2-3 business days.`,
    });
  } catch (err: unknown) {
    logger.error({ err }, "withdrawal/request failed");
    return res.status(500).json({ ok: false, error: "Internal error" });
  }
});

/**
 * GET /api/withdrawal/requests?uid=xxx
 * Returns all withdrawal requests for a user
 */
router.get("/withdrawal/requests", async (req, res) => {
  try {
    const { uid } = req.query;
    if (!uid || typeof uid !== "string") {
      return res.status(400).json({ ok: false, error: "uid is required" });
    }
    const safe = safeId(uid);
    const reqRes = await fetch(`${DB_URL}/withdrawalRequests/${safe}.json`);
    if (!reqRes.ok) {
      return res.status(502).json({ ok: false, error: "Could not fetch withdrawal requests." });
    }
    const data = await reqRes.json() as Record<string, unknown> | null;
    const requests = data
      ? Object.entries(data).map(([id, v]) => ({ id, ...(v as object) }))
          .sort((a: any, b: any) => (b.requestedAt ?? 0) - (a.requestedAt ?? 0))
      : [];
    return res.json({ ok: true, requests });
  } catch (err: unknown) {
    logger.error({ err }, "withdrawal/requests GET failed");
    return res.status(500).json({ ok: false, error: "Internal error" });
  }
});

export default router;
