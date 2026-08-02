import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";

const RANK_MEDALS = ["🥇", "🥈", "🥉"];
const GRADE_COLOR = (p: number) =>
  p >= 80 ? "#10b981" : p >= 60 ? "#f59e0b" : p >= 40 ? "#fb923c" : "#ef4444";

const SUBJECT_ICONS: Record<string, string> = {
  maths: "📐", english: "📖", hindi: "🔤",
  science: "🔬", social: "🌍", sanskrit: "📜",
  physics: "⚡", chemistry: "🧪", biology: "🌿",
  "class12/physics": "⚡", "class12/chemistry": "🧪", "class12/biology": "🌿",
  "class12/maths": "📐", "class12/social": "🌍", "class12/hindi": "🔤", "class12/english": "📖",
  "entrance_exams/jee/physics": "⚡", "entrance_exams/jee/chemistry": "🧪", "entrance_exams/jee/maths": "📐",
  "entrance_exams/neet/physics": "⚡", "entrance_exams/neet/chemistry": "🧪", "entrance_exams/neet/biology": "🌿",
};

const SUBJECT_LABELS: Record<string, string> = {
  maths: "Maths", english: "English", hindi: "Hindi",
  science: "Science", social: "Social Science", sanskrit: "Sanskrit",
  physics: "Physics", chemistry: "Chemistry", biology: "Biology",
  "class12/physics": "Physics", "class12/chemistry": "Chemistry", "class12/biology": "Biology",
  "class12/maths": "Maths", "class12/social": "Social", "class12/hindi": "Hindi", "class12/english": "English",
  "entrance_exams/jee/physics": "JEE Physics", "entrance_exams/jee/chemistry": "JEE Chemistry", "entrance_exams/jee/maths": "JEE Maths",
  "entrance_exams/neet/physics": "NEET Physics", "entrance_exams/neet/chemistry": "NEET Chemistry", "entrance_exams/neet/biology": "NEET Biology",
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
  category: "c10" | "c12" | "jee" | "neet";
}

// Server-side leaderboard API — no client auth token needed
// Dev proxy: /api/leaderboard -> localhost:3000/api/leaderboard
// Production: /api/leaderboard -> Firebase Functions
async function fetchLeaderboardByCategory(category: "c10" | "c12" | "jee" | "neet"): Promise<LeaderEntry[]> {
  try {
    const res = await fetch(`
https://api-jjfwuxybja-uc.a.run.app/api/leaderboard?category=${encodeURIComponent(category)}`);
    if (!res.ok) {
      console.error("[Leaderboard] server fetch failed:", res.status, res.statusText);
      return [];
    }
    const data = await res.json();
    if (!data.ok || !Array.isArray(data.entries)) {
      console.warn("[Leaderboard] invalid server response:", data);
      return [];
    }
    return data.entries as LeaderEntry[];
  } catch (err) {
    console.error("[Leaderboard] fetchLeaderboardByCategory error:", err);
    return [];
  }
}

type Category = "c10" | "c12" | "jee" | "neet";
type Filter = "all" | "premium";

const CATEGORY_META: Record<Category, {
  label: string;
  emoji: string;
  accent: string;
  surface: string;
  border: string;
}> = {
  c10: { label: "Class 10", emoji: "📚", accent: "#7c3aed", surface: "#ede9fe", border: "#c4b5fd" },
  c12: { label: "Class 12", emoji: "🎓", accent: "#0891b2", surface: "#cffafe", border: "#67e8f9" },
  jee: { label: "JEE", emoji: "⚡", accent: "#2563eb", surface: "#dbeafe", border: "#93c5fd" },
  neet: { label: "NEET", emoji: "🌿", accent: "#059669", surface: "#d1fae5", border: "#6ee7b7" },
};

const FILTER_META: Record<Filter, {
  label: string;
  emoji: string;
  accent: string;
  surface: string;
  border: string;
}> = {
  all: { label: "All Students", emoji: "🌟", accent: "#7c3aed", surface: "#ede9fe", border: "#c4b5fd" },
  premium: { label: "Premium Only", emoji: "👑", accent: "#b45309", surface: "#fef3c7", border: "#fcd34d" },
};

export default function LeaderboardPage() {
  const { user } = useAuth();
  const { isPremium } = useSubscription();
  const [entries, setEntries] = useState<LeaderEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [category, setCategory] = useState<Category>("jee");
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      if (cancelled) return;
      const data = await fetchLeaderboardByCategory(category);
      if (!cancelled) { setEntries(data); setLoading(false); setLastRefresh(new Date()); }
    }
    load();
    const t = setInterval(async () => {
      if (!cancelled) {
        const data = await fetchLeaderboardByCategory(category);
        if (!cancelled) { setEntries(data); setLastRefresh(new Date()); }
      }
    }, 60_000);
    return () => { cancelled = true; clearInterval(t); };
  }, [category, user]);

  const myUid = user?.uid ?? "";
  const filtered = filter === "premium" ? entries.filter((e) => e.isPremium) : entries;

  const myRank = entries.findIndex((e) => e.uid === myUid);
  const myEntry = entries.find((e) => e.uid === myUid);

  return (
    <div className="min-h-screen w-full pb-28 bg-slate-100">

      <div className="relative z-10 max-w-lg mx-auto px-4 pt-10">
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
          <h1 className="text-slate-950 font-black text-2xl tracking-tight mb-1">Leaderboard</h1>
          <p className="text-slate-600 text-xs font-medium">
            {CATEGORY_META[category].label} rankings by average score · updates every minute
          </p>
        </motion.div>

        {myEntry && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1, duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
            className="mb-4 rounded-2xl p-4 flex items-center gap-3 shadow-sm"
            style={{
              background: isPremium ? "#fef3c7" : "#ede9fe",
              border: `1px solid ${isPremium ? "#fcd34d" : "#c4b5fd"}`,
            }}
          >
            <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-sm font-black"
              style={{
                background: isPremium
                  ? "#fbbf24"
                  : "#ddd6fe",
                color: isPremium ? "#78350f" : "#6d28d9",
              }}>
              {myRank < 3 ? RANK_MEDALS[myRank] : `#${myRank + 1}`}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-slate-950 font-bold text-sm truncate">{myEntry.username}</p>
                {isPremium && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full font-bold shrink-0"
                    style={{ background: "#fbbf24", color: "#78350f" }}>
                    👑
                  </span>
                )}
                <span className="text-xs text-violet-700 font-semibold shrink-0">(you)</span>
              </div>
              <p className="text-slate-600 text-xs font-medium">{myEntry.totalSessions} tests · {myEntry.subjectCount} subjects</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="font-black text-base" style={{ color: GRADE_COLOR(myEntry.avgPct) }}>{myEntry.avgPct}%</p>
              <p className="text-slate-500 text-xs font-medium">avg</p>
            </div>
          </motion.div>
        )}

        {/* Category Tabs */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-4 gap-2 mb-3"
        >
          {(["c10", "c12", "jee", "neet"] as Category[]).map((c) => {
            const meta = CATEGORY_META[c];
            const isActive = category === c;
            return (
              <button key={c} onClick={() => setCategory(c)}
                className="py-2.5 rounded-xl text-xs font-bold transition-all border"
                style={{
                  background: isActive ? meta.surface : "#e2e8f0",
                  borderColor: isActive ? meta.border : "#cbd5e1",
                  color: isActive ? meta.accent : "#475569",
                }}>
                {meta.emoji} {meta.label}
              </button>
            );
          })}
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
            className="grid grid-cols-2 gap-2 mb-5"
        >
          {(["all", "premium"] as Filter[]).map((f) => (
            <motion.button
              key={f}
              onClick={() => setFilter(f)}
              whileTap={{ scale: 0.96 }}
              className="py-2.5 rounded-xl text-xs font-bold transition-all border"
              style={{
                background: filter === f ? FILTER_META[f].surface : "#e2e8f0",
                borderColor: filter === f ? FILTER_META[f].border : "#cbd5e1",
                color: filter === f ? FILTER_META[f].accent : "#475569",
              }}
            >
              {FILTER_META[f].emoji} {FILTER_META[f].label}
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
              className="flex flex-col items-center gap-3 py-16 text-slate-500"
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
              <p className="text-slate-700 text-sm font-semibold">No scores yet</p>
              <p className="text-slate-500 text-xs mt-1">Complete a test to appear here!</p>
            </motion.div>
          ) : (
            <motion.div
              key={`list-${category}-${filter}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
              className="rounded-2xl overflow-hidden bg-white shadow-sm border border-slate-200"
            >
              <div className="flex items-center justify-between px-4 pt-3.5 pb-2.5"
                style={{ borderBottom: "1px solid #e2e8f0" }}>
                <span className="text-slate-600 text-xs font-bold uppercase tracking-widest">
                  {filtered.length} students ranked
                </span>
                <span className="text-slate-500 text-xs font-medium">
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
                        ? "#f5f3ff"
                        : i % 2 === 0 ? "#ffffff" : "#f8fafc",
                      borderLeft: isMe ? "3px solid #7c3aed" : "3px solid transparent",
                    }}
                  >
                    <div className="w-7 text-center shrink-0">
                      {rank < 3 ? (
                        <span className="text-base">{RANK_MEDALS[rank]}</span>
                      ) : (
                        <span className="text-slate-500 font-black text-xs tabular-nums">{rank + 1}</span>
                      )}
                    </div>

                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm font-black"
                      style={
                        e.isPremium
                          ? { background: "#fbbf24", color: "#78350f", boxShadow: "0 2px 8px rgba(180,83,9,0.18)" }
                          : { background: "#e2e8f0", color: "#334155" }
                      }
                    >
                      {e.isPremium ? "👑" : e.username.charAt(0).toUpperCase()}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <p className="text-sm font-bold text-slate-950 truncate leading-none">
                          {e.username}
                        </p>
                        {isMe && <span className="text-violet-700 text-xs font-semibold shrink-0">(you)</span>}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-600 text-xs font-medium">{e.totalSessions} test{e.totalSessions !== 1 ? "s" : ""}</span>
                        <span className="text-slate-400 text-xs">·</span>
                        <span className="text-slate-600 text-xs font-medium">{e.subjectCount} subj</span>
                        {e.bestSubject && (
                          <>
                            <span className="text-slate-400 text-xs">·</span>
                            <span className="text-xs">{SUBJECT_ICONS[e.bestSubject.toLowerCase()] ?? SUBJECT_ICONS[e.bestSubject] ?? "📚"}</span>
                            <span className="text-slate-500 text-xs font-medium truncate">{SUBJECT_LABELS[e.bestSubject.toLowerCase()] ?? SUBJECT_LABELS[e.bestSubject] ?? e.bestSubject}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="font-black text-sm tabular-nums" style={{ color: GRADE_COLOR(e.avgPct) }}>
                        {e.avgPct}%
                      </p>
                      <p className="text-slate-500 text-xs font-medium">avg</p>
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
            className="text-center text-slate-500 text-xs font-medium mt-4"
          >
            Complete more tests to climb the rankings!
          </motion.p>
        )}
      </div>
    </div>
  );
}
