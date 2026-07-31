// @ts-nocheck
import { Router, type IRouter } from "express";
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

const router: IRouter = Router();

const DB_URL = "https://shiken-d8789-default-rtdb.firebaseio.com";

function inferCategory(subject: string): "c10" | "c12" | "jee" | "neet" {
  const s = (subject || "").toLowerCase();
  if (s.includes("jee")) return "jee";
  if (s.includes("neet")) return "neet";
  if (s.startsWith("class12/") || s.includes("class12")) return "c12";
  return "c10";
}

interface LeaderEntry {
  uid: string;
  username: string;
  avgPct: number;
  totalSessions: number;
  subjectCount: number;
  bestSubject: string;
  isPremium: boolean;
  lastActive: number;
}

// GET /api/leaderboard?category=c10|c12|jee|neet
router.get("/leaderboard", async (req, res) => {
  try {
    const category = (req.query.category as string)?.toLowerCase() || "c10";
    if (!["c10", "c12", "jee", "neet"].includes(category)) {
      return res.status(400).json({ ok: false, error: "Invalid category" });
    }

    const [actSnap, usersSnap] = await Promise.all([
      adminDb.ref("userActivity").get(),
      adminDb.ref("users").get(),
    ]);

    const actData = actSnap.exists() ? actSnap.val() : null;
    const usersData = usersSnap.exists() ? usersSnap.val() : null;

    if (!actData || typeof actData !== "object") {
      return res.json({ ok: true, entries: [] });
    }

    const entries: LeaderEntry[] = [];

    for (const [safeId, u] of Object.entries(actData)) {
      const meta = (u as any)?.meta || {};
      const sessions = (u as any)?.sessions ? Object.values((u as any).sessions) : [];
      const mockScores = (u as any)?.mockScores ? Object.values((u as any).mockScores) : [];

      const targetCatLower = category;

      const mockForCat = (mockScores as any[]).filter(
        (m) => (m.examType || "").toLowerCase() === targetCatLower
      );

      const catSessions = (sessions as any[]).filter((s) => {
        const inferred = s.category || inferCategory(s.subject || "");
        return inferred.toLowerCase() === targetCatLower;
      });

      const allEntries = [
        ...mockForCat.map((m) => ({
          pct: Number(m.pct) || 0,
          subject: m.subject || "General",
        })),
        ...catSessions.map((s) => ({
          pct: Number(s.pct) || 0,
          subject: s.subject || "General",
        })),
      ];

      if (allEntries.length < 1) continue;

      const avgPct = Math.round(
        allEntries.reduce((sum, item) => sum + item.pct, 0) / allEntries.length
      );

      const subjectSet = new Set(allEntries.map((e) => e.subject).filter(Boolean));
      const subjectCount = subjectSet.size;

      const subjectScores: Record<string, number[]> = {};
      for (const e of allEntries) {
        if (!e.subject) continue;
        if (!subjectScores[e.subject]) subjectScores[e.subject] = [];
        subjectScores[e.subject].push(e.pct);
      }

      let bestSubject = "";
      let bestAvg = -1;
      for (const [sub, scores] of Object.entries(subjectScores)) {
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
        if (avg > bestAvg) {
          bestAvg = avg;
          bestSubject = sub;
        }
      }

      const originalUid = meta.deviceId || safeId;
       const premiumUser = usersData?.[originalUid];
       const expiry = typeof premiumUser?.expiresAt === "number"
         ? premiumUser.expiresAt
         : (typeof premiumUser?.premiumUntil === "number" ? premiumUser.premiumUntil : 0);
       const isPremium = (premiumUser?.isPremium === true || premiumUser?.subscriptionType === "premium")
         && expiry > Date.now();

      entries.push({
        uid: originalUid,
        username: (meta.username || "").trim() || "Anonymous",
        avgPct,
        totalSessions: allEntries.length,
        subjectCount,
        bestSubject,
        isPremium,
        lastActive: meta.lastActive || 0,
      });
    }

    entries.sort((a, b) => b.avgPct - a.avgPct || b.totalSessions - a.totalSessions);

    return res.json({ ok: true, entries, count: entries.length });
  } catch (err) {
    logger.error({ err }, "Leaderboard fetch failed");
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

export default router;
