import { Router } from "express";
import { logger } from "../lib/logger";

const router = Router();
const DB_URL = "https://shiken-d8789-default-rtdb.firebaseio.com";

function safeId(uid: string): string {
  return uid.replace(/[.#$/[\]]/g, "_");
}

/**
 * POST /api/referral/apply
 * Body: { uid: string, referralCode: string }
 * Finds the referrer by referralCode and marks the new user as referred.
 * NOTE: No wallet credit happens here — reward is only given when the referred
 *       user actually buys a qualifying plan (₹199 or ₹399) via verify-payment.
 */
router.post("/referral/apply", async (req, res) => {
  try {
    const { uid, referralCode } = req.body;
    if (!uid || !referralCode || typeof uid !== "string" || typeof referralCode !== "string") {
      return res.status(400).json({ ok: false, error: "uid and referralCode are required" });
    }

    const userSafe = safeId(uid);
    const code     = referralCode.trim().toUpperCase();

    // Check if user already has a referrer
    const userRes  = await fetch(`${DB_URL}/users/${userSafe}.json`);
    const userData = userRes.ok ? (await userRes.json() as Record<string, unknown> | null) : null;
    if (userData?.referredBy) {
      return res.status(400).json({ ok: false, error: "You have already applied a referral code." });
    }

    // Prevent self-referral — check if the code belongs to this user
    const myCode = `SKN${uid.slice(0, 6).toUpperCase()}`;
    if (myCode === code) {
      return res.status(400).json({ ok: false, error: "You cannot use your own referral code." });
    }

    // Find referrer by referralCode (scan all users)
    const allUsersRes = await fetch(`${DB_URL}/users.json?shallow=true`);
    if (!allUsersRes.ok) {
      return res.status(502).json({ ok: false, error: "Could not lookup users." });
    }
    const allKeys = await allUsersRes.json() as Record<string, boolean> | null;
    if (!allKeys) {
      return res.status(404).json({ ok: false, error: "Referral code not found." });
    }

    let referrerUid: string | null = null;
    for (const key of Object.keys(allKeys)) {
      const refRes  = await fetch(`${DB_URL}/users/${key}/referralCode.json`);
      if (!refRes.ok) continue;
      const refCode = await refRes.json() as string | null;
      if (refCode && refCode.toUpperCase() === code) {
        referrerUid = key;
        break;
      }
    }

    if (!referrerUid || referrerUid === userSafe) {
      return res.status(404).json({ ok: false, error: "Referral code not found or invalid." });
    }

    // Mark user as referred — NO wallet credit yet (credited on qualifying plan purchase)
    await fetch(`${DB_URL}/users/${userSafe}.json`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ referredBy: code }),
    });

    logger.info({ referrer: referrerUid, newUser: userSafe }, "Referral code applied — reward pending on plan purchase");
    return res.json({
      ok: true,
      message: "Referral code applied! Your referrer will earn a reward when you buy a ₹199 or ₹399 plan.",
    });
  } catch (err: unknown) {
    logger.error({ err }, "referral/apply failed");
    return res.status(500).json({ ok: false, error: "Internal error" });
  }
});

export default router;
