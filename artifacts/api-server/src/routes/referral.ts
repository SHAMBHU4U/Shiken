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
 * Finds the referrer by referralCode, credits them, and marks the new user as referred.
 */
router.post("/referral/apply", async (req, res) => {
  try {
    const { uid, referralCode } = req.body;
    if (!uid || !referralCode || typeof uid !== "string" || typeof referralCode !== "string") {
      return res.status(400).json({ ok: false, error: "uid and referralCode are required" });
    }

    const userSafe = safeId(uid);
    const code = referralCode.trim().toUpperCase();

    // Check if user already has a referrer
    const userRes = await fetch(`${DB_URL}/users/${userSafe}.json`);
    const userData = userRes.ok ? (await userRes.json() as Record<string, unknown> | null) : null;
    if (userData?.referredBy) {
      return res.status(400).json({ ok: false, error: "You have already applied a referral code." });
    }

    // Find referrer by referralCode (scan all users — Firebase RTDB doesn't support queries well)
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
      const refRes = await fetch(`${DB_URL}/users/${key}/referralCode.json`);
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

    // Get user goal/category to determine reward
    const goalRes = await fetch(`${DB_URL}/users/${userSafe}/goal.json`);
    const goal = goalRes.ok ? (await goalRes.json() as string | null) : null;
    const category: "jee_neet" | "class10_12" = (goal === "jee" || goal === "neet") ? "jee_neet" : "class10_12";
    const reward = category === "jee_neet" ? 5 : 10;

    // Credit referrer wallet
    const refDataRes = await fetch(`${DB_URL}/users/${referrerUid}.json`);
    const refData = refDataRes.ok ? (await refDataRes.json() as Record<string, unknown> | null) : null;
    const currentWallet = typeof refData?.walletBalance === "number" ? refData.walletBalance : 0;
    const currentCount = typeof refData?.referralCount === "number" ? refData.referralCount : 0;

    await fetch(`${DB_URL}/users/${referrerUid}.json`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        walletBalance: currentWallet + reward,
        referralCount: currentCount + 1,
      }),
    });

    // Mark user as referred
    await fetch(`${DB_URL}/users/${userSafe}.json`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ referredBy: code }),
    });

    logger.info({ referrer: referrerUid, newUser: userSafe, reward, category }, "Referral applied");
    return res.json({ ok: true, message: `Referral applied! Your referrer earned \u20b9${reward}.` });
  } catch (err: unknown) {
    logger.error({ err }, "referral/apply failed");
    return res.status(500).json({ ok: false, error: "Internal error" });
  }
});

export default router;
