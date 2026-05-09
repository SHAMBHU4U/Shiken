import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";

const DB_URL = "https://shiken-d8789-default-rtdb.firebaseio.com";
const RANK_MEDALS = ["🥇", "🥈", "🥉"];
const GRADE_COLOR = (p: number) =>
  p >= 80 ? "#10b981" : p >= 60 ? "#f59e0b" : p >= 40 ? "#fb923c" : "#ef4444";

const SUBJECT_ICONS: Record<string, string> = {
  maths: "📐", english: "📖", hindi: "🔤",
  science: "🔬", social: "🌍", sanskrit: "📜",
};

const SUBJECT_LABELS: Record<string, string> = {
  maths: "Maths", english: "English", hindi: "Hindi",
  science: "Science", social: "Social Science", sanskrit: "Sanskrit",
};

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

async function fetchFullLeaderboard(): Promise<LeaderEntry[]> {
  try {
    const [actRes, usersRes] = await Promise.all([
      fetch(`${DB_URL}/userActivity.json`),
      fetch(`${DB_URL}/users.json`),
    ]);
    const actData = actRes.ok ? await actRes.json() : null;
    const usersData = usersRes.ok ? await usersRes.json() : null;
    if (!actData) return [];

    return (Object.entries(actData as Record<string, {
      meta?: { deviceId?: string; username?: string; lastActive?: number };
      sessions?: Record<string, { pct: number; subject: string }>;
    }>)
      .map(([uid, u]) => {
        const sessions = u.sessions ? Object.values(u.sessions) : [];
        if (sessions.length < 1) return null;
        const avgPct = Math.round(sessions.reduce((s, r) => s + r.pct, 0) / sessions.length);
        const subjectCount = new Set(sessions.map((s) => s.subject)).size;

        const subjectScores: Record<string, number[]> = {};
        sessions.forEach((s) => {
          if (!subjectScores[s.subject]) subjectScores[s.subject] = [];
          subjectScores[s.subject].push(s.pct);
        });
        const bestSubject = Object.entries(subjectScores)
          .map(([sub, scores]) => ({ sub, avg: scores.reduce((a, b) => a + b, 0) / scores.length }))
          .sort((a, b) => b.avg - a.avg)[0]?.sub ?? "";

        const isPremium = usersData?.[uid]?.subscriptionType === "premium";

        return {
          uid,
          username: u.meta?.username?.trim() || "Anonymous",
          avgPct,
          totalSessions: sessions.length,
          subjectCount,
          bestSubject,
          isPremium,
          lastActive: u.meta?.lastActive ?? 0,
        } as LeaderEntry;
      })
      .filter(Boolean) as LeaderEntry[])
      .sort((a, b) => b.avgPct - a.avgPct || b.totalSessions - a.totalSessions);
  } catch {
    return [];
  }
}

type Filter = "all" | "premium";

export default function LeaderboardPage() {
  const { user } = useAuth();
  const { isPremium } = useSubscription();
  const [entries, setEntries] = useState<LeaderEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  useEffect(() => {
    fetchFullLeaderboard().then((data) => {
      setEntries(data);
      setLoading(false);
      setLastRefresh(new Date());
    });
    const t = setInterval(() => {
      fetchFullLeaderboard().then((data) => {
        setEntries(data);
        setLastRefresh(new Date());
      });
    }, 60_000);
    return () => clearInterval(t);
  }, []);

  const myUid = user?.uid ?? "";
  const filtered = filter === "premium" ? entries.filter((e) => e.isPremium) : entries;

  const myRank = entries.findIndex((e) => e.uid === myUid);
  const myEntry = entries.find((e) => e.uid === myUid);

  return (
    <div className="min-h-screen w-full pb-28" style={{ background: "#07080f" }}>
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full blur-3xl opacity-10"
          style={{ background: "radial-gradient(circle, #f59e0b, transparent)" }} />
        <div className="absolute -bottom-24 -right-24 w-72 h-72 rounded-full blur-3xl opacity-8"
          style={{ background: "radial-gradient(circle, #8b5cf6, transparent)" }} />
      </div>

      <div className="relative z-10 max-w-lg mx-auto px-4 pt-14">
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
          className="text-center mb-6"
        >
          <motion.div
            animate={{ rotate: [0, -8, 8, -4, 4, 0] }}
            transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
            className="text-5xl mb-2"
          >
            🏆
          </motion.div>
          <h1 className="text-white font-black text-2xl tracking-tight mb-1">Leaderboard</h1>
          <p className="text-white/30 text-xs">
            Top students ranked by average score · updates every minute
          </p>
        </motion.div>

        {myEntry && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1, duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
            className="mb-4 rounded-2xl p-3.5 flex items-center gap-3"
            style={{
              background: isPremium
                ? "linear-gradient(135deg, rgba(245,158,11,0.12), rgba(217,119,6,0.08))"
                : "rgba(139,92,246,0.1)",
              border: isPremium ? "1px solid rgba(245,158,11,0.3)" : "1px solid rgba(139,92,246,0.25)",
            }}
          >
            <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-sm font-black"
              style={{
                background: isPremium
                  ? "linear-gradient(135deg, #f59e0b, #d97706)"
                  : "rgba(139,92,246,0.25)",
                color: isPremium ? "#000" : "#c4b5fd",
              }}>
              {myRank < 3 ? RANK_MEDALS[myRank] : `#${myRank + 1}`}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-white font-bold text-sm truncate">{myEntry.username}</p>
                {isPremium && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full font-bold shrink-0"
                    style={{ background: "linear-gradient(135deg,#f59e0b,#d97706)", color: "#000" }}>
                    👑
                  </span>
                )}
                <span className="text-xs text-purple-400 font-medium shrink-0">(you)</span>
              </div>
              <p className="text-white/30 text-xs">{myEntry.totalSessions} tests · {myEntry.subjectCount} subjects</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="font-black text-base" style={{ color: GRADE_COLOR(myEntry.avgPct) }}>{myEntry.avgPct}%</p>
              <p className="text-white/20 text-xs">avg</p>
            </div>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="flex gap-2 mb-4"
        >
          {(["all", "premium"] as Filter[]).map((f) => (
            <motion.button
              key={f}
              onClick={() => setFilter(f)}
              whileTap={{ scale: 0.96 }}
              className="flex-1 py-2 rounded-xl text-xs font-bold transition-all"
              style={{
                background: filter === f
                  ? f === "premium"
                    ? "linear-gradient(135deg, rgba(245,158,11,0.25), rgba(217,119,6,0.15))"
                    : "rgba(139,92,246,0.2)"
                  : "rgba(255,255,255,0.05)",
                border: filter === f
                  ? f === "premium" ? "1px solid rgba(245,158,11,0.4)" : "1px solid rgba(139,92,246,0.35)"
                  : "1px solid rgba(255,255,255,0.06)",
                color: filter === f
                  ? f === "premium" ? "#fbbf24" : "#a78bfa"
                  : "rgba(255,255,255,0.22)",
              }}
            >
              {f === "all" ? "🌟 All Students" : "👑 Premium Only"}
            </motion.button>
          ))}
        </motion.div>

        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-3 py-16 text-white/20"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="w-8 h-8 rounded-full"
                style={{ border: "2px solid rgba(0,0,0,0.08)", borderTopColor: "#f59e0b" }}
              />
              <p className="text-xs">Loading rankings…</p>
            </motion.div>
          ) : filtered.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-center py-16"
            >
              <p className="text-3xl mb-3">🏅</p>
              <p className="text-white/30 text-sm">No scores yet</p>
              <p className="text-white/15 text-xs mt-1">Complete a test to appear here!</p>
            </motion.div>
          ) : (
            <motion.div
              key={`list-${filter}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
              className="rounded-2xl overflow-hidden"
              style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <div className="flex items-center justify-between px-4 pt-3.5 pb-2.5"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <span className="text-white/40 text-xs font-semibold uppercase tracking-widest">
                  {filtered.length} students ranked
                </span>
                <span className="text-white/20 text-xs">
                  {lastRefresh.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>

              {filtered.map((e, i) => {
                const isMe = e.uid === myUid;
                const rank = filter === "premium"
                  ? entries.filter((x) => x.isPremium).indexOf(e)
                  : entries.indexOf(e);

                return (
                  <motion.div
                    key={e.uid}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.05 + i * 0.03, duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
                    className="flex items-center gap-3 px-4 py-3 transition-colors"
                    style={{
                      background: isMe
                        ? "rgba(139,92,246,0.1)"
                        : i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.03)",
                      borderLeft: isMe ? "2px solid #8b5cf6" : "2px solid transparent",
                    }}
                  >
                    <div className="w-7 text-center shrink-0">
                      {rank < 3 ? (
                        <span className="text-base">{RANK_MEDALS[rank]}</span>
                      ) : (
                        <span className="text-white/25 font-black text-xs tabular-nums">{rank + 1}</span>
                      )}
                    </div>

                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm font-black"
                      style={
                        e.isPremium
                          ? { background: "linear-gradient(135deg, #f59e0b, #d97706)", color: "#000", boxShadow: "0 2px 10px rgba(245,158,11,0.35)" }
                          : { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.32)" }
                      }
                    >
                      {e.isPremium ? "👑" : e.username.charAt(0).toUpperCase()}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <p className="text-sm font-bold text-white truncate leading-none">
                          {e.username}
                        </p>
                        {isMe && <span className="text-purple-400 text-xs font-medium shrink-0">(you)</span>}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-white/25 text-xs">{e.totalSessions} test{e.totalSessions !== 1 ? "s" : ""}</span>
                        <span className="text-white/15 text-xs">·</span>
                        <span className="text-white/25 text-xs">{e.subjectCount} subj</span>
                        {e.bestSubject && (
                          <>
                            <span className="text-white/15 text-xs">·</span>
                            <span className="text-xs">{SUBJECT_ICONS[e.bestSubject] ?? "📚"}</span>
                            <span className="text-white/20 text-xs truncate">{SUBJECT_LABELS[e.bestSubject] ?? e.bestSubject}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="font-black text-sm tabular-nums" style={{ color: GRADE_COLOR(e.avgPct) }}>
                        {e.avgPct}%
                      </p>
                      <p className="text-white/20 text-xs">avg</p>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>

        {!loading && filtered.length > 0 && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-center text-white/15 text-xs mt-4"
          >
            Complete more tests to climb the rankings!
          </motion.p>
        )}
      </div>
    </div>
  );
}
