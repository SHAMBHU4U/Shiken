import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { ref, get, set, remove, update, push } from "firebase/database";
import { parsePDFQuestions } from "@/lib/gemini";
import type { GeneratedQuestion } from "@/lib/gemini";
import { db } from "@/firebase";

const APP_URL = import.meta.env.VITE_APP_URL ?? window.location.origin;

// ─── User Activity types ───────────────────────────────────────────────────────

interface UserSession {
  subject: string;
  score: number;
  total: number;
  pct: number;
  mode: string;
  chapter: string;
  timestamp: number;
}

interface UserRecord {
  uid: string;
  deviceId: string;
  lastActive: number;
  sessions: UserSession[];
  totalSessions: number;
  avgPct: number;
  subjectSet: string[];
}

const SUBJECT_ICONS: Record<string, string> = {
  maths: "📐", english: "📖", hindi: "",
  science: "🔬", social: "🌍", sanskrit: "📜",
};
const SUBJECT_COLORS: Record<string, string> = {
  maths: "#06b6d4", english: "#8b5cf6", hindi: "#f97316",
  science: "#10b981", social: "#f59e0b", sanskrit: "#ec4899",
};

async function fetchUsers(): Promise<UserRecord[]> {
  const snap = await get(ref(db, "userActivity"));
  const data = snap.exists() ? snap.val() as Record<string, { meta?: { deviceId: string; lastActive: number }; sessions?: Record<string, UserSession> }> : null;
  if (!data) return [];
  return Object.entries(data).map(([uid, u]) => {
    const sessions = u.sessions ? Object.values(u.sessions) : [];
    const avgPct = sessions.length ? Math.round(sessions.reduce((s, r) => s + r.pct, 0) / sessions.length) : 0;
    const subjectSet = [...new Set(sessions.map((s) => s.subject))];
    return {
      uid,
      deviceId: u.meta?.deviceId ?? "unknown",
      lastActive: u.meta?.lastActive ?? 0,
      sessions: sessions.sort((a, b) => b.timestamp - a.timestamp),
      totalSessions: sessions.length,
      avgPct,
      subjectSet,
    };
  }).sort((a, b) => b.lastActive - a.lastActive);
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function gradeColor(pct: number) {
  if (pct >= 80) return "#10b981";
  if (pct >= 60) return "#f59e0b";
  return "#ef4444";
}

async function setUserSubscription(uid: string, type: "free" | "premium") {
  await set(ref(db, `users/${uid}/subscriptionType`), type);
}

function UserCard({ user, index }: { user: UserRecord; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const [subscription, setSubscription] = useState<"free" | "premium" | "loading">("loading");
  const [toggling, setToggling] = useState(false);
  const [phone, setPhone] = useState<string | null>(null);
  const shortId = user.deviceId.length > 18 ? user.deviceId.slice(0, 18) + "…" : user.deviceId;
  const isRealUid = user.uid && !user.uid.startsWith("u_") && user.uid !== "unknown";
  const noActivityToday = user.lastActive > 0 && (Date.now() - user.lastActive) > 18 * 60 * 60 * 1000;
  const WA_NUMBER = "918340472013";

  useEffect(() => {
    if (!isRealUid) { setSubscription("free"); return; }
    get(ref(db, `users/${user.uid}/subscriptionType`))
      .then((s) => setSubscription(s.val() === "premium" ? "premium" : "free"))
      .catch(() => setSubscription("free"));
    get(ref(db, `users/${user.uid}/phone`))
      .then((s) => { const v = s.val(); if (typeof v === "string" && v.length >= 10) setPhone(v); })
      .catch(() => {});
  }, [user.uid, isRealUid]);

  async function handleToggle(e: React.MouseEvent) {
    e.stopPropagation();
    if (toggling || subscription === "loading") return;
    const next = subscription === "premium" ? "free" : "premium";
    setToggling(true);
    try {
      await setUserSubscription(user.uid, next);
      setSubscription(next);
    } catch { /* ignore */ }
    finally { setToggling(false); }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="rounded-xl border border-white/10 overflow-hidden"
      style={{ background: "rgba(255,255,255,0.05)" }}
    >
      {/* User header row */}
      <div
        onClick={() => setExpanded((e) => !e)}
        role="button"
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-white/4 transition-colors cursor-pointer"
      >
        <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-sm font-black"
          style={{ background: `${gradeColor(user.avgPct)}22`, color: gradeColor(user.avgPct) }}>
          {user.avgPct}%
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-white text-xs font-semibold truncate font-mono">{shortId}</p>
            {subscription === "premium" && (
              <span className="text-xs px-1.5 py-0.5 rounded-full font-bold shrink-0"
                style={{ background: "rgba(251,191,36,0.2)", color: "#fbbf24", fontSize: "9px" }}>
                👑 PRO
              </span>
            )}
          </div>
          <p className="text-white/30 text-xs mt-0.5">
            {user.totalSessions} test{user.totalSessions !== 1 ? "s" : ""}
            {" · "}
            <span style={{ color: noActivityToday ? "#f59e0b" : "rgba(255,255,255,0.22)" }}>
              {noActivityToday ? "⚠️ " : ""}{timeAgo(user.lastActive)}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {phone && noActivityToday && (
            <a
              href={`https://wa.me/${phone}?text=${encodeURIComponent(`Namaste! 👋 SHIKEN पर आज practice करो aur apni streak bachao! 🔥 Open app: ${APP_URL}`)}`}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-xs px-2 py-1 rounded-lg font-bold shrink-0 flex items-center gap-1"
              style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.3)" }}
              title="Send WhatsApp reminder"
            >
              💬 Remind
            </a>
          )}
          {!phone && noActivityToday && (
            <span className="text-xs text-amber-500/60" title="No phone number saved">⚠️</span>
          )}
          <button
            onClick={handleToggle}
            disabled={toggling || subscription === "loading"}
            className="text-xs px-2 py-1 rounded-lg font-bold transition-all shrink-0"
            style={
              subscription === "premium"
                ? { background: "rgba(251,191,36,0.15)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.35)" }
                : { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.28)", border: "1px solid rgba(255,255,255,0.10)" }
            }
          >
            {toggling ? "…" : subscription === "loading" ? "·" : subscription === "premium" ? "Premium" : "Free"}
          </button>
          <div className="flex items-center gap-1">
            {user.subjectSet.slice(0, 3).map((s) => (
              <span key={s} className="text-sm" title={s}>{SUBJECT_ICONS[s] ?? "📚"}</span>
            ))}
          </div>
          <span className="text-white/25 text-xs transition-transform"
            style={{ display: "inline-block", transform: expanded ? "rotate(90deg)" : "rotate(0deg)" }}>›</span>
        </div>
      </div>

      {/* Expanded session list */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-white/8 px-4 py-3 flex flex-col gap-2">
              {/* Subject breakdown */}
              <div className="flex flex-wrap gap-1.5 mb-2">
                {user.subjectSet.map((s) => {
                  const subSessions = user.sessions.filter((r) => r.subject === s);
                  const avg = Math.round(subSessions.reduce((a, r) => a + r.pct, 0) / subSessions.length);
                  return (
                    <div key={s} className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs"
                      style={{ background: `${SUBJECT_COLORS[s] ?? "#8b5cf6"}18`, color: SUBJECT_COLORS[s] ?? "#8b5cf6" }}>
                      {SUBJECT_ICONS[s] ?? "📚"} {s} · avg {avg}%
                    </div>
                  );
                })}
              </div>

              {/* Recent sessions */}
              <p className="text-white/25 text-xs font-medium mb-1">Recent sessions</p>
              {user.sessions.slice(0, 8).map((sess, si) => (
                <div key={si} className="flex items-center gap-2 py-1.5 border-b border-white/5 last:border-0">
                  <span className="text-base">{SUBJECT_ICONS[sess.subject] ?? "📚"}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-white/70 text-xs font-medium capitalize">
                      {sess.subject} · {sess.mode === "ai" ? "Smart Test" : sess.mode === "full" ? "Full Test" : sess.chapter}
                    </p>
                    <p className="text-white/30 text-xs">{new Date(sess.timestamp).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-bold" style={{ color: gradeColor(sess.pct) }}>{sess.pct}%</p>
                    <p className="text-white/25 text-xs">{sess.score}/{sess.total}</p>
                  </div>
                </div>
              ))}
              {user.sessions.length > 8 && (
                <p className="text-white/20 text-xs text-center mt-1">+{user.sessions.length - 8} more sessions</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function UsersPanel() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setUsers(await fetchUsers());
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        className="w-7 h-7 rounded-full border-2 border-transparent"
        style={{ borderTopColor: "#8b5cf6", borderRightColor: "#06b6d4" }} />
      <p className="text-white/30 text-xs">Loading user activity…</p>
    </div>
  );

  if (error) return (
    <div className="text-center py-12">
      <p className="text-red-400 text-sm mb-3">Failed to load: {error}</p>
      <button onClick={load} className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white/50 text-xs hover:text-white/80 transition-colors">Retry</button>
    </div>
  );

  if (users.length === 0) return (
    <div className="text-center py-16">
      <p className="text-4xl mb-3">👤</p>
      <p className="text-white/40 text-sm font-medium">No activity yet</p>
      <p className="text-white/20 text-xs mt-1">User data appears here after students complete tests</p>
    </div>
  );

  const totalSessions = users.reduce((s, u) => s + u.totalSessions, 0);
  const overallAvg    = Math.round(users.reduce((s, u) => s + u.avgPct, 0) / users.length);

  return (
    <div>
      {/* Summary */}
      <div className="grid grid-cols-3 gap-2 mb-5">
        {[
          { label: "Total Users",    value: users.length,    color: "#8b5cf6" },
          { label: "Total Sessions", value: totalSessions,   color: "#06b6d4" },
          { label: "Avg Score",      value: `${overallAvg}%`, color: gradeColor(overallAvg) },
        ].map((s) => (
          <div key={s.label} className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
            <p className="text-xs text-white/30 mb-1 leading-tight">{s.label}</p>
            <p className="text-lg font-black" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between mb-3">
        <p className="text-white/40 text-xs font-medium">All users — sorted by last active</p>
        <button onClick={load} className="text-white/25 hover:text-white/50 text-xs transition-colors">↻ Refresh</button>
      </div>

      <div className="flex flex-col gap-2">
        {users.map((u, i) => <UserCard key={u.deviceId} user={u} index={i} />)}
      </div>
    </div>
  );
}

// ─── Ratings Panel ────────────────────────────────────────────────────────────

interface AdminRatingEntry { stars: number; feedback: string; ts: number; }

function RatingsPanel() {
  const [entries, setEntries] = useState<{ id: string; data: AdminRatingEntry }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  async function load() {
    setLoading(true); setError("");
    try {
      const snap = await get(ref(db, "ratings"));
      const raw = snap.exists() ? snap.val() as Record<string, AdminRatingEntry> : null;
      if (!raw) { setEntries([]); return; }
      setEntries(
        Object.entries(raw)
          .map(([id, data]) => ({ id, data }))
          .sort((a, b) => b.data.ts - a.data.ts)
      );
    } catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        className="w-7 h-7 rounded-full border-2 border-transparent"
        style={{ borderTopColor: "#f59e0b", borderRightColor: "#f59e0b50" }} />
      <p className="text-white/30 text-xs">Loading ratings…</p>
    </div>
  );

  if (error) return (
    <div className="text-center py-12">
      <p className="text-red-400 text-sm mb-3">Failed to load: {error}</p>
      <button onClick={load} className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white/50 text-xs hover:text-white/80 transition-colors">Retry</button>
    </div>
  );

  if (entries.length === 0) return (
    <div className="text-center py-16">
      <p className="text-4xl mb-3">⭐</p>
      <p className="text-white/40 text-sm font-medium">No ratings yet</p>
      <p className="text-white/20 text-xs mt-1">Ratings appear here once students submit them</p>
    </div>
  );

  const avg = entries.reduce((s, e) => s + e.data.stars, 0) / entries.length;
  const dist = [5,4,3,2,1].map((star) => ({
    star,
    count: entries.filter((e) => e.data.stars === star).length,
    pct: Math.round((entries.filter((e) => e.data.stars === star).length / entries.length) * 100),
  }));
  const withFeedback = entries.filter((e) => e.data.feedback?.trim());

  return (
    <div>
      {/* Summary */}
      <div className="rounded-2xl p-5 mb-5"
        style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}>
        <div className="flex items-center gap-5 mb-4">
          <div className="text-center">
            <p className="text-4xl font-black text-amber-400 leading-none">{avg.toFixed(1)}</p>
            <div className="flex gap-0.5 justify-center mt-1">
              {[1,2,3,4,5].map((s) => (
                <span key={s} className="text-sm" style={{ color: s <= Math.round(avg) ? "#fbbf24" : "rgba(255,255,255,0.12)" }}>★</span>
              ))}
            </div>
            <p className="text-white/35 text-xs mt-1">{entries.length} rating{entries.length !== 1 ? "s" : ""}</p>
          </div>
          <div className="flex-1 flex flex-col gap-1.5">
            {dist.map(({ star, count, pct }) => (
              <div key={star} className="flex items-center gap-2">
                <span className="text-amber-400/70 text-xs w-3 text-right shrink-0">{star}</span>
                <span className="text-amber-400/50 text-xs shrink-0">★</span>
                <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(0,0,0,0.08)" }}>
                  <motion.div
                    initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                    className="h-full rounded-full" style={{ background: "#f59e0b" }} />
                </div>
                <span className="text-white/25 text-xs w-6 text-right shrink-0">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* WhatsApp Broadcast */}
      <a
        href={`https://wa.me/?text=${encodeURIComponent(
          `📊 SHIKEN App Rating Update!\n\n⭐ ${avg.toFixed(1)}/5 stars from ${entries.length} student${entries.length !== 1 ? "s" : ""}!\n\nThank you for your feedback — it helps us improve every day. Keep studying hard! 🎓\n\n🔗 ${APP_URL}`
        )}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-3 px-4 py-3 rounded-xl mb-5 transition-opacity hover:opacity-85"
        style={{ background: "rgba(37,211,102,0.12)", border: "1px solid rgba(37,211,102,0.28)" }}
      >
        <svg viewBox="0 0 24 24" className="w-5 h-5 flex-shrink-0" fill="#25d366">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.555 4.116 1.526 5.847L.057 23.882l6.198-1.625A11.93 11.93 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.793 9.793 0 01-5.012-1.376l-.36-.214-3.68.965.982-3.587-.234-.368A9.787 9.787 0 012.182 12C2.182 6.57 6.57 2.182 12 2.182S21.818 6.57 21.818 12 17.43 21.818 12 21.818z"/>
        </svg>
        <div className="flex-1">
          <p className="text-white/85 text-xs font-bold">Broadcast Rating Update</p>
          <p className="text-white/35 text-xs">Share ⭐ {avg.toFixed(1)}/5 summary with your WhatsApp group</p>
        </div>
        <span className="text-white/25 text-xs">→</span>
      </a>

      {/* Feedback section */}
      {withFeedback.length > 0 && (
        <div className="mb-5">
          <p className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-3">
            Written Feedback ({withFeedback.length})
          </p>
          <div className="flex flex-col gap-2">
            {withFeedback.map(({ id, data }) => (
              <motion.div key={id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className="rounded-xl px-4 py-3"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(0,0,0,0.08)" }}>
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="flex gap-0.5">
                    {[1,2,3,4,5].map((s) => (
                      <span key={s} className="text-xs" style={{ color: s <= data.stars ? "#fbbf24" : "rgba(255,255,255,0.12)" }}>★</span>
                    ))}
                  </div>
                  <span className="text-white/20 text-xs ml-auto">
                    {data.ts ? new Date(data.ts).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" }) : "—"}
                  </span>
                </div>
                <p className="text-white/65 text-xs leading-relaxed">"{data.feedback}"</p>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* All ratings list */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-white/40 text-xs font-semibold uppercase tracking-widest">All Ratings</p>
        <button onClick={load} className="text-white/25 hover:text-white/50 text-xs transition-colors">↻ Refresh</button>
      </div>
      <div className="flex flex-col gap-1.5">
        {entries.map(({ id, data }, i) => (
          <motion.div key={id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
            className="flex items-center gap-3 px-4 py-2.5 rounded-xl"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="flex gap-0.5 shrink-0">
              {[1,2,3,4,5].map((s) => (
                <span key={s} className="text-xs" style={{ color: s <= data.stars ? "#fbbf24" : "rgba(255,255,255,0.10)" }}>★</span>
              ))}
            </div>
            <p className="flex-1 text-white/40 text-xs truncate">
              {data.feedback?.trim() || <span className="italic text-white/20">no comment</span>}
            </p>
            <span className="text-white/20 text-xs shrink-0">
              {data.ts ? new Date(data.ts).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—"}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

const ALL_SUBJECTS = [
  { id: "maths",    dbPath: "maths",    label: "Maths",          icon: "📐", accent: "#06b6d4", gradient: "from-cyan-500/20 to-blue-600/20",    border: "border-cyan-400/20" },
  { id: "english",  dbPath: "english",  label: "English",         icon: "📖", accent: "#8b5cf6", gradient: "from-violet-500/20 to-purple-700/20", border: "border-violet-400/20" },
  { id: "hindi",    dbPath: "hindi",    label: "Hindi",           icon: "🔤", accent: "#f97316", gradient: "from-orange-500/20 to-red-600/20",    border: "border-orange-400/20" },
  { id: "science",  dbPath: "science",  label: "Science",         icon: "🔬", accent: "#10b981", gradient: "from-emerald-500/20 to-teal-600/20",  border: "border-emerald-400/20" },
  { id: "social",   dbPath: "social science", label: "Social Science",  icon: "🌍", accent: "#f59e0b", gradient: "from-amber-500/20 to-yellow-600/20", border: "border-amber-400/20" },
  { id: "sanskrit", dbPath: "sanskrit", label: "Sanskrit",        icon: "📜", accent: "#ec4899", gradient: "from-pink-500/20 to-rose-600/20",    border: "border-pink-400/20" },
];

const ALL_C12_SUBJECTS = [
  { id: "c12_physics",   dbPath: "class12/physics",   label: "Physics",   icon: "⚡", accent: "#3b82f6", gradient: "from-blue-500/20 to-indigo-600/20",    border: "border-blue-400/20" },
  { id: "c12_chemistry", dbPath: "class12/chemistry", label: "Chemistry", icon: "🧪", accent: "#10b981", gradient: "from-emerald-500/20 to-teal-600/20",  border: "border-emerald-400/20" },
  { id: "c12_biology",   dbPath: "class12/biology",   label: "Biology",   icon: "🌿", accent: "#22c55e", gradient: "from-green-500/20 to-lime-600/20",    border: "border-green-400/20" },
  { id: "c12_maths",     dbPath: "class12/maths",     label: "Maths",     icon: "📐", accent: "#06b6d4", gradient: "from-cyan-500/20 to-blue-600/20",     border: "border-cyan-400/20" },
  { id: "c12_social",    dbPath: "class12/social",    label: "Social",    icon: "🌍", accent: "#f59e0b", gradient: "from-amber-500/20 to-yellow-600/20",  border: "border-amber-400/20" },
  { id: "c12_hindi",     dbPath: "class12/hindi",     label: "Hindi",     icon: "🔤", accent: "#f97316", gradient: "from-orange-500/20 to-red-600/20",    border: "border-orange-400/20" },
  { id: "c12_english",   dbPath: "class12/english",   label: "English",   icon: "📖", accent: "#8b5cf6", gradient: "from-violet-500/20 to-purple-700/20", border: "border-violet-400/20" },
];

type AdminSubject = (typeof ALL_SUBJECTS)[0] | (typeof ALL_C12_SUBJECTS)[0];

type SubjectStatus = "loading" | "loaded" | "empty" | "error";

interface SubjectInfo {
  count: number;
  status: SubjectStatus;
  error?: string;
}

interface AIQuestion {
  key: string;
  english: string;
  hindi: string;
  options: string[];
  correctAnswer: number;
  chapter: string;
}

async function fetchCount(dbPath: string): Promise<SubjectInfo> {
  try {
    const snap = await get(ref(db, dbPath));
    const data = snap.exists() ? snap.val() : null;
    if (data === null || data === true || data === false) {
      return { count: data === null ? 0 : 1, status: data === null ? "empty" : "error", error: data !== null ? "Invalid data (not an object)" : undefined };
    }
    if (typeof data !== "object") {
      return { count: 0, status: "error", error: `Unexpected type: ${typeof data}` };
    }
    const count = Object.keys(data).length;
    return { count, status: count === 0 ? "empty" : "loaded" };
  } catch (e) {
    return { count: 0, status: "error", error: String(e) };
  }
}

async function fetchCollection(path: string): Promise<Record<string, unknown> | null> {
  const snap = await get(ref(db, path));
  if (!snap.exists()) return null;
  const data = snap.val();
  if (typeof data !== "object" || data === null) return null;
  return data as Record<string, unknown>;
}

async function setupCollection(path: string): Promise<void> {
  await set(ref(db, path), { __initialized: true });
}

async function fetchAIQuestions(dbPath: string): Promise<AIQuestion[]> {
  const snap = await get(ref(db, dbPath));
  const data = snap.exists() ? snap.val() as Record<string, unknown> : null;
  if (!data || typeof data !== "object") return [];

  const results: AIQuestion[] = [];
  for (const [key, raw] of Object.entries(data)) {
    const q = raw as Record<string, unknown>;
    const chapter = String(q.chapter ?? q.chapter_name ?? "");
    if (chapter !== "AI Generated") continue;

    let opts: string[] = [];
    if (Array.isArray(q.options)) opts = (q.options as unknown[]).map(String);

    const ansRaw = q.correctAnswer ?? q.correct_answer ?? q.answer;
    const answerIndex = typeof ansRaw === "number" ? ansRaw : (Number(ansRaw) || 0);

    results.push({
      key,
      english: String(q.english ?? q.question_english ?? q.question ?? ""),
      hindi: String(q.hindi ?? q.question_hindi ?? ""),
      options: opts,
      correctAnswer: Math.max(0, Math.min(answerIndex, opts.length - 1)),
      chapter,
    });
  }
  return results;
}

async function approveQuestion(subjectId: string, key: string): Promise<void> {
  await update(ref(db, `${subjectId}/${key}`), { chapter: "General" });
}

async function rejectQuestion(subjectId: string, key: string): Promise<void> {
  await remove(ref(db, `${subjectId}/${key}`));
}

function StatusBadge({ status, count }: { status: SubjectStatus; count: number }) {
  if (status === "loading") {
    return (
      <div className="flex items-center gap-1.5">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-3.5 h-3.5 rounded-full border-2 border-white/20 border-t-white/60"
        />
        <span className="text-white/40 text-xs">Fetching...</span>
      </div>
    );
  }
  if (status === "error") return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/20 border border-red-400/30 text-red-400 text-xs font-medium">⚠ Error</span>
  );
  if (status === "empty") return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/30 text-xs font-medium">○ Empty</span>
  );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-400 text-xs font-medium">
      ✓ {count.toLocaleString()} questions
    </span>
  );
}

function SubjectRow({ subject, info, index }: { subject: AdminSubject; info: SubjectInfo; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.1 + index * 0.06, duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
      className={`flex items-center gap-4 bg-gradient-to-r ${subject.gradient} backdrop-blur-xl border ${subject.border} rounded-xl px-5 py-4`}
      style={{ boxShadow: `0 4px 20px ${subject.accent}10` }}
    >
      <div className="text-2xl select-none w-8 text-center">{subject.icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-white font-semibold text-sm">{subject.label}</p>
        <p className="text-white/30 text-xs font-mono mt-0.5">/{subject.dbPath}</p>
      </div>
      <div className="shrink-0"><StatusBadge status={info.status} count={info.count} /></div>
      {info.status === "loaded" && (
        <div className="shrink-0 w-16 h-1.5 rounded-full overflow-hidden" style={{ background: `${subject.accent}20` }}>
          <motion.div
            initial={{ width: 0 }} animate={{ width: "100%" }}
            transition={{ delay: 0.3 + index * 0.06, duration: 0.8, ease: "easeOut" }}
            className="h-full rounded-full" style={{ background: subject.accent }}
          />
        </div>
      )}
    </motion.div>
  );
}

function AIQuestionCard({
  question, subject, onApprove, onReject,
}: {
  question: AIQuestion;
  subject: AdminSubject;
  onApprove: () => void;
  onReject: () => void;
}) {
  const [action, setAction] = useState<"approving" | "rejecting" | null>(null);
  const [done, setDone] = useState<"approved" | "rejected" | null>(null);

  async function handleApprove() {
    setAction("approving");
    try { await approveQuestion(subject.dbPath, question.key); setDone("approved"); onApprove(); }
    catch { setAction(null); }
  }

  async function handleReject() {
    setAction("rejecting");
    try { await rejectQuestion(subject.dbPath, question.key); setDone("rejected"); onReject(); }
    catch { setAction(null); }
  }

  if (done === "approved") {
    return (
      <motion.div initial={{ opacity: 1 }} animate={{ opacity: 0, height: 0, marginBottom: 0 }} transition={{ delay: 0.6, duration: 0.4 }}
        className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 flex items-center gap-2">
        <span className="text-emerald-400 text-sm">✓ Approved — moved to General</span>
      </motion.div>
    );
  }
  if (done === "rejected") {
    return (
      <motion.div initial={{ opacity: 1 }} animate={{ opacity: 0, height: 0, marginBottom: 0 }} transition={{ delay: 0.6, duration: 0.4 }}
        className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 flex items-center gap-2">
        <span className="text-red-400 text-sm">✗ Rejected — deleted from database</span>
      </motion.div>
    );
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border px-4 py-4"
      style={{ background: `${subject.accent}08`, borderColor: `${subject.accent}25` }}
    >
      <p className="text-white font-medium text-sm leading-relaxed mb-1">{question.english}</p>
      {question.hindi && <p className="text-white/35 text-xs mb-3 leading-snug">{question.hindi}</p>}

      <div className="grid grid-cols-2 gap-1.5 mb-3">
        {question.options.map((opt, i) => (
          <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs"
            style={{
              background: i === question.correctAnswer ? `${subject.accent}22` : "rgba(255,255,255,0.05)",
              border: `1px solid ${i === question.correctAnswer ? subject.accent + "50" : "rgba(0,0,0,0.08)"}`,
              color: i === question.correctAnswer ? subject.accent : "rgba(255,255,255,0.40)",
              fontWeight: i === question.correctAnswer ? 700 : 400,
            }}>
            <span className="shrink-0 font-bold" style={{ color: i === question.correctAnswer ? subject.accent : "rgba(255,255,255,0.20)" }}>
              {String.fromCharCode(65 + i)}
            </span>
            {opt}
            {i === question.correctAnswer && <span className="ml-auto shrink-0">✓</span>}
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <motion.button
          onClick={handleApprove}
          disabled={action !== null}
          whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
          className="flex-1 py-2 rounded-lg text-xs font-bold transition-all"
          style={{
            background: action === "approving" ? `${subject.accent}30` : `${subject.accent}20`,
            border: `1px solid ${subject.accent}40`,
            color: subject.accent,
            opacity: action === "rejecting" ? 0.4 : 1,
          }}
        >
          {action === "approving" ? "Approving…" : "✓ Approve"}
        </motion.button>
        <motion.button
          onClick={handleReject}
          disabled={action !== null}
          whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
          className="flex-1 py-2 rounded-lg text-xs font-bold transition-all"
          style={{
            background: action === "rejecting" ? "rgba(239,68,68,0.2)" : "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.3)",
            color: "#f87171",
            opacity: action === "approving" ? 0.4 : 1,
          }}
        >
          {action === "rejecting" ? "Deleting…" : "✗ Reject"}
        </motion.button>
      </div>
    </motion.div>
  );
}

function AIReviewPanel({ subject, onClose }: { subject: AdminSubject; onClose: () => void }) {
  const [questions, setQuestions] = useState<AIQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [counts, setCounts] = useState({ total: 0, remaining: 0 });

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchAIQuestions(subject.dbPath)
      .then((qs) => {
        setQuestions(qs);
        setCounts({ total: qs.length, remaining: qs.length });
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [subject.id]);

  function handleAction() {
    setCounts((c) => ({ ...c, remaining: c.remaining - 1 }));
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
      className="mt-6"
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-xl">{subject.icon}</span>
          <div>
            <p className="text-white font-bold text-sm">{subject.label} — AI Questions</p>
            {!loading && !error && (
              <p className="text-white/35 text-xs">
                {counts.remaining} pending · {counts.total - counts.remaining} reviewed
              </p>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-white/30 hover:text-white/60 hover:bg-white/5 transition-all text-sm"
        >
          ✕
        </button>
      </div>

      {/* Progress bar */}
      {!loading && !error && counts.total > 0 && (
        <div className="mb-4 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(0,0,0,0.08)" }}>
          <motion.div
            animate={{ width: `${((counts.total - counts.remaining) / counts.total) * 100}%` }}
            transition={{ duration: 0.4 }}
            className="h-full rounded-full"
            style={{ background: `linear-gradient(90deg, ${subject.accent}, ${subject.accent}80)` }}
          />
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12 gap-3">
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-8 h-8 rounded-full border-2 border-transparent"
            style={{ borderTopColor: subject.accent, borderRightColor: `${subject.accent}50` }} />
          <span className="text-white/40 text-sm">Loading AI questions…</span>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-red-400 text-sm">
          Failed to load: {error}
        </div>
      ) : questions.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/3 px-4 py-10 text-center">
          <p className="text-3xl mb-3">🤖</p>
          <p className="text-white/50 text-sm font-medium">No AI questions pending review</p>
          <p className="text-white/25 text-xs mt-1">Start a Full Test to generate new AI questions</p>
        </div>
      ) : counts.remaining === 0 ? (
        <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-10 text-center">
          <p className="text-3xl mb-3">🎉</p>
          <p className="text-emerald-400 text-sm font-bold">All {counts.total} questions reviewed!</p>
          <p className="text-white/30 text-xs mt-1">Approved ones are now in the General chapter</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {questions.map((q) => (
            <AIQuestionCard
              key={q.key}
              question={q}
              subject={subject}
              onApprove={handleAction}
              onReject={handleAction}
            />
          ))}
        </div>
      )}
    </motion.div>
  );
}

// ─── Payments Panel ────────────────────────────────────────────────────────────

interface PaymentRecord {
  uid: string;
  plan: string;
  amount: number;
  requestedAt: number;
  premiumUntil: number;
  status: "awaiting_verify" | "verified" | "revoked";
}

const PLAN_AMOUNTS: Record<string, number> = { monthly: 49, biannual: 199 };
const PLAN_LABELS:  Record<string, string>  = { monthly: "Basic Monthly (30d)", biannual: "Topper's Choice (6mo)" };
const ADMIN_WA_NUMBER = "918340472013";

async function fetchPayments(): Promise<PaymentRecord[]> {
  const snap = await get(ref(db, "users"));
  const data = snap.exists() ? snap.val() as Record<string, {
    subscriptionType?: string;
    plan?: string;
    activatedAt?: number;
    requestedAt?: number;
    premiumUntil?: number;
    paymentVerified?: boolean;
  }> : null;
  if (!data) return [];

  return Object.entries(data)
    .filter(([, u]) => u.subscriptionType === "premium" && (u.activatedAt || u.requestedAt))
    .map(([uid, u]) => {
      const plan = u.plan ?? "monthly";
      return {
        uid,
        plan,
        amount: PLAN_AMOUNTS[plan] ?? 49,
        requestedAt: u.requestedAt ?? u.activatedAt ?? 0,
        premiumUntil: u.premiumUntil ?? 0,
        status: u.paymentVerified === true ? "verified" as const : "awaiting_verify" as const,
      };
    })
    .sort((a, b) => b.requestedAt - a.requestedAt);
}

async function fetchPendingCount(): Promise<number> {
  const snap = await get(ref(db, "users"));
  if (!snap.exists()) return 0;
  const data = snap.val() as Record<string, { subscriptionType?: string; paymentVerified?: boolean }>;
  return Object.values(data).filter(u =>
    u.subscriptionType === "premium" && !u.paymentVerified
  ).length;
}

function PaymentCard({ rec, onAction }: { rec: PaymentRecord; onAction: () => void }) {
  const [working, setWorking] = useState(false);
  const [localStatus, setLocalStatus] = useState(rec.status);
  const shortUid = rec.uid.length > 20 ? rec.uid.slice(0, 20) + "…" : rec.uid;
  const dateLabel = rec.requestedAt
    ? new Date(rec.requestedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
    : "—";
  const validTill = rec.premiumUntil
    ? new Date(rec.premiumUntil).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : "—";

  async function verify() {
    setWorking(true);
    try {
      await update(ref(db, `users/${rec.uid}`), {
        subscriptionType: "premium",
        premiumUntil: rec.premiumUntil,
        plan: rec.plan,
        activatedAt: Date.now(),
        paymentVerified: true,
      });
      setLocalStatus("verified");
    } catch { /* ignore */ }
    finally { setWorking(false); }
  }

  async function revoke() {
    setWorking(true);
    try {
      await update(ref(db, `users/${rec.uid}`), { subscriptionType: "free", paymentVerified: false });
      onAction();
    } catch { /* ignore */ }
    finally { setWorking(false); }
  }

  const waMsg = encodeURIComponent(`Namaste! 🎉 Aapki SHIKEN Premium payment verify ho gayi. Ab aap app open karke premium features use kar sakte hain! 👑`);
  const waLink = `https://wa.me/${ADMIN_WA_NUMBER}?text=${waMsg}`;

  const statusStyle =
    localStatus === "verified"
      ? { bg: "rgba(16,185,129,0.06)", border: "rgba(16,185,129,0.22)", badge: { bg: "rgba(16,185,129,0.18)", color: "#10b981" }, label: "✓ Verified" }
      : { bg: "rgba(251,191,36,0.06)", border: "rgba(251,191,36,0.22)", badge: { bg: "rgba(251,191,36,0.15)", color: "#fbbf24" }, label: "⏳ Awaiting Verify" };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl overflow-hidden"
      style={{ background: statusStyle.bg, border: `1px solid ${statusStyle.border}` }}
    >
      {/* Top row */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-black text-sm"
          style={{ background: "rgba(251,191,36,0.15)", color: "#fbbf24" }}>
          ₹{rec.amount}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white/80 text-xs font-mono truncate">{shortUid}</p>
          <p className="text-white/35 text-xs mt-0.5">{PLAN_LABELS[rec.plan] ?? rec.plan}</p>
        </div>
        <span className="text-xs font-bold px-2 py-1 rounded-full shrink-0"
          style={statusStyle.badge}>
          {statusStyle.label}
        </span>
      </div>

      {/* Dates row */}
      <div className="flex items-center gap-3 px-4 pb-2 text-xs text-white/25">
        <span>Requested: {dateLabel}</span>
        <span>·</span>
        <span>Valid till: {validTill}</span>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 px-4 pb-3">
        {localStatus === "awaiting_verify" && (
          <motion.button onClick={verify} disabled={working} whileTap={{ scale: 0.96 }}
            className="flex-1 py-2 rounded-lg text-xs font-black transition-all"
            style={{ background: "rgba(16,185,129,0.15)", color: "#10b981", border: "1px solid rgba(16,185,129,0.3)" }}>
            {working ? "…" : "✓ Verify & Activate"}
          </motion.button>
        )}
        {localStatus === "verified" && (
          <a href={waLink} target="_blank" rel="noreferrer"
            className="flex-1 py-2 rounded-lg text-xs font-black text-center transition-all"
            style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.25)" }}>
            💬 WhatsApp User
          </a>
        )}
        <motion.button onClick={revoke} disabled={working} whileTap={{ scale: 0.96 }}
          className="flex-1 py-2 rounded-lg text-xs font-bold transition-all"
          style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.22)" }}>
          {working ? "…" : "✕ Revoke"}
        </motion.button>
      </div>
    </motion.div>
  );
}

function PaymentsPanel() {
  const [records, setRecords] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | "awaiting" | "verified">("awaiting");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try { setRecords(await fetchPayments()); }
    catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const awaiting = records.filter(r => r.status === "awaiting_verify").length;
  const verified = records.filter(r => r.status === "verified").length;
  const revenue  = records.filter(r => r.status === "verified").reduce((s, r) => s + r.amount, 0);

  const filtered = records.filter(r =>
    filter === "all"      ? true :
    filter === "awaiting" ? r.status === "awaiting_verify" :
    r.status === "verified"
  );

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        className="w-7 h-7 rounded-full border-2 border-transparent"
        style={{ borderTopColor: "#f59e0b", borderRightColor: "#fbbf24" }} />
      <p className="text-white/30 text-xs">Loading payment requests…</p>
    </div>
  );

  if (error) return (
    <div className="text-center py-12">
      <p className="text-red-400 text-sm mb-3">Failed: {error}</p>
      <button onClick={load} className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white/50 text-xs">Retry</button>
    </div>
  );

  return (
    <div>
      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 mb-5">
        {[
          { label: "Verified Revenue", value: `₹${revenue}`, color: "#10b981" },
          { label: "Needs Review",     value: awaiting,       color: awaiting > 0 ? "#f59e0b" : "rgba(255,255,255,0.18)" },
          { label: "Verified",         value: verified,       color: "#8b5cf6" },
        ].map(s => (
          <div key={s.label} className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
            <p className="text-xs text-white/30 mb-1 leading-tight">{s.label}</p>
            <p className="text-lg font-black" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {awaiting > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="rounded-xl px-4 py-3 mb-4 flex items-center gap-3"
          style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.3)" }}>
          <span className="text-xl">🔔</span>
          <div>
            <p className="text-amber-400 font-black text-xs">{awaiting} payment{awaiting > 1 ? "s" : ""} need your verification</p>
            <p className="text-white/30 text-xs mt-0.5">Check UPI history → Verify or Revoke below</p>
          </div>
        </motion.div>
      )}

      {/* Filter pills */}
      <div className="flex gap-2 mb-4">
        {([
          { id: "awaiting", label: `⏳ Needs Review (${awaiting})` },
          { id: "verified", label: `✓ Verified (${verified})` },
          { id: "all",      label: `All (${records.length})` },
        ] as const).map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            className="px-3 py-1 rounded-full text-xs font-bold transition-all"
            style={{
              background: filter === f.id ? "rgba(251,191,36,0.2)" : "rgba(255,255,255,0.05)",
              color:      filter === f.id ? "#fbbf24"             : "rgba(255,255,255,0.22)",
              border: `1px solid ${filter === f.id ? "rgba(251,191,36,0.4)" : "rgba(255,255,255,0.10)"}`,
            }}>
            {f.label}
          </button>
        ))}
        <button onClick={load} className="ml-auto text-white/25 hover:text-white/50 text-xs transition-colors">↻</button>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">💳</p>
          <p className="text-white/40 text-sm font-medium">
            {filter === "awaiting" ? "कोई pending payment नहीं 🎉" : filter === "verified" ? "No verified payments yet" : "No payments yet"}
          </p>
          <p className="text-white/20 text-xs mt-1">Payment requests appear here when users submit via the app</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map(r => <PaymentCard key={r.uid} rec={r} onAction={load} />)}
        </div>
      )}
    </div>
  );
}

// ─── Cache Stats Panel ────────────────────────────────────────────────────────

interface CacheChapter {
  subjectKey:   string;
  chapterKey:   string;
  count:        number;
  updatedAt:    number;
}

interface CacheSubjectGroup {
  subjectKey: string;
  chapters:   CacheChapter[];
  total:      number;
}

interface AdminCollection {
  path: string;
  label: string;
  icon: string;
  accent: string;
}

function prettifySlug(slug: string): string {
  return slug.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

async function fetchCacheStats(): Promise<CacheSubjectGroup[]> {
  const snap = await get(ref(db, "aiQuestionsCache"));
  const data = snap.exists() ? snap.val() as Record<string, Record<string, { questions?: unknown[]; updatedAt?: number }>> : null;
  if (!data) return [];

  return Object.entries(data).map(([subjectKey, chapters]) => {
    const chapterList: CacheChapter[] = Object.entries(chapters ?? {}).map(([chapterKey, val]) => ({
      subjectKey,
      chapterKey,
      count:     Array.isArray(val.questions) ? val.questions.length : 0,
      updatedAt: val.updatedAt ?? 0,
    })).sort((a, b) => b.count - a.count);
    return {
      subjectKey,
      chapters: chapterList,
      total: chapterList.reduce((s, c) => s + c.count, 0),
    };
  }).sort((a, b) => b.total - a.total);
}

async function clearChapterCache(subjectKey: string, chapterKey: string): Promise<void> {
  await remove(ref(db, `aiQuestionsCache/${subjectKey}/${chapterKey}`));
}

async function clearSubjectCache(subjectKey: string): Promise<void> {
  await remove(ref(db, `aiQuestionsCache/${subjectKey}`));
}

function CachePanel() {
  const [groups, setGroups]   = useState<CacheSubjectGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const [clearing, setClearing] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setGroups(await fetchCacheStats()); }
    catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleClearChapter(subjectKey: string, chapterKey: string) {
    const key = `${subjectKey}/${chapterKey}`;
    setClearing(key);
    try {
      await clearChapterCache(subjectKey, chapterKey);
      setGroups((gs) => gs.map((g) =>
        g.subjectKey !== subjectKey ? g :
        { ...g, chapters: g.chapters.filter((c) => c.chapterKey !== chapterKey),
          total: g.chapters.filter((c) => c.chapterKey !== chapterKey).reduce((s, c) => s + c.count, 0) }
      ).filter((g) => g.chapters.length > 0));
    } catch { /* ignore */ }
    finally { setClearing(null); }
  }

  async function handleClearSubject(subjectKey: string) {
    setClearing(subjectKey);
    try {
      await clearSubjectCache(subjectKey);
      setGroups((gs) => gs.filter((g) => g.subjectKey !== subjectKey));
    } catch { /* ignore */ }
    finally { setClearing(null); }
  }

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        className="w-7 h-7 rounded-full border-2 border-transparent"
        style={{ borderTopColor: "#06b6d4", borderRightColor: "#06b6d420" }} />
      <p className="text-white/30 text-xs">Loading cache stats…</p>
    </div>
  );

  if (error) return (
    <div className="text-center py-12">
      <p className="text-red-400 text-sm mb-3">Failed: {error}</p>
      <button onClick={load} className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white/50 text-xs">Retry</button>
    </div>
  );

  const totalCached  = groups.reduce((s, g) => s + g.total, 0);
  const totalChapters = groups.reduce((s, g) => s + g.chapters.length, 0);
  const totalSubjects = groups.length;

  return (
    <div>
      {/* Summary */}
      <div className="grid grid-cols-3 gap-2 mb-5">
        {[
          { label: "Cached Questions", value: totalCached,   color: "#06b6d4" },
          { label: "Chapters Cached",  value: totalChapters, color: "#8b5cf6" },
          { label: "Subjects",         value: totalSubjects, color: "#10b981" },
        ].map((s) => (
          <div key={s.label} className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
            <p className="text-xs text-white/30 mb-1 leading-tight">{s.label}</p>
            <p className="text-lg font-black" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {totalCached === 0 ? (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">🗄️</p>
          <p className="text-white/40 text-sm font-medium">Cache is empty</p>
          <p className="text-white/20 text-xs mt-1">Questions get cached automatically when students take AI tests</p>
        </div>
      ) : (
        <>
          {/* How it works note */}
          <div className="rounded-xl px-4 py-3 mb-4 flex items-start gap-3"
            style={{ background: "rgba(6,182,212,0.06)", border: "1px solid rgba(6,182,212,0.18)" }}>
            <span className="text-lg shrink-0 mt-0.5">⚡</span>
            <div>
              <p className="text-cyan-400 text-xs font-bold">Shared question cache</p>
              <p className="text-white/30 text-xs mt-0.5 leading-relaxed">
                Cached chapters load instantly — zero Gemini API calls. New questions are generated only when a chapter has no cache yet. Max 100 per chapter.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between mb-3">
            <p className="text-white/40 text-xs font-medium">Cached by subject</p>
            <button onClick={load} className="text-white/25 hover:text-white/50 text-xs transition-colors">↻ Refresh</button>
          </div>

          <div className="flex flex-col gap-2">
            {groups.map((group, gi) => {
              const subjectMeta = ALL_SUBJECTS.find((s) => s.id === group.subjectKey || s.label.toLowerCase() === group.subjectKey);
              const accent  = subjectMeta?.accent ?? "#8b5cf6";
              const icon    = subjectMeta?.icon   ?? "📚";
              const isOpen  = expanded === group.subjectKey;

              return (
                <motion.div key={group.subjectKey} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: gi * 0.05 }}
                  className="rounded-xl overflow-hidden"
                  style={{ background: `${accent}08`, border: `1px solid ${accent}20` }}>

                  {/* Subject header */}
                  <div className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                    onClick={() => setExpanded(isOpen ? null : group.subjectKey)}>
                    <span className="text-xl shrink-0">{icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold text-sm">{prettifySlug(group.subjectKey)}</p>
                      <p className="text-white/30 text-xs">
                        {group.chapters.length} chapter{group.chapters.length !== 1 ? "s" : ""}
                        {" · "}{group.total} questions cached
                      </p>
                    </div>

                    {/* Capacity bar */}
                    <div className="w-14 h-1.5 rounded-full overflow-hidden shrink-0" style={{ background: "rgba(0,0,0,0.08)" }}>
                      <div className="h-full rounded-full transition-all"
                        style={{ width: `${Math.min(100, (group.total / (group.chapters.length * 100)) * 100)}%`, background: accent }} />
                    </div>

                    <button
                      onClick={(e) => { e.stopPropagation(); handleClearSubject(group.subjectKey); }}
                      disabled={clearing !== null}
                      className="text-xs px-2 py-1 rounded-lg font-bold shrink-0 transition-all"
                      style={{ background: "rgba(239,68,68,0.1)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" }}
                      title="Clear all chapters for this subject">
                      {clearing === group.subjectKey ? "…" : "Clear"}
                    </button>

                    <span className="text-white/25 text-xs transition-transform shrink-0"
                      style={{ display: "inline-block", transform: isOpen ? "rotate(90deg)" : "rotate(0)" }}>›</span>
                  </div>

                  {/* Chapter list */}
                  <AnimatePresence>
                    {isOpen && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                        <div className="border-t px-4 py-3 flex flex-col gap-2" style={{ borderColor: `${accent}18` }}>
                          {group.chapters.map((ch) => {
                            const chKey = `${ch.subjectKey}/${ch.chapterKey}`;
                            const fillPct = Math.min(100, (ch.count / 100) * 100);
                            const updatedLabel = ch.updatedAt
                              ? new Date(ch.updatedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
                              : "—";
                            return (
                              <div key={ch.chapterKey} className="flex items-center gap-3 py-1.5">
                                <div className="flex-1 min-w-0">
                                  <p className="text-white/75 text-xs font-medium truncate">{prettifySlug(ch.chapterKey)}</p>
                                  <div className="flex items-center gap-2 mt-1">
                                    <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                                      <motion.div initial={{ width: 0 }} animate={{ width: `${fillPct}%` }}
                                        transition={{ duration: 0.5, ease: "easeOut" }}
                                        className="h-full rounded-full" style={{ background: accent }} />
                                    </div>
                                    <span className="text-white/35 text-xs shrink-0 w-14">{ch.count}/100 q</span>
                                  </div>
                                  <p className="text-white/20 text-xs mt-0.5">Updated {updatedLabel}</p>
                                </div>
                                <button
                                  onClick={() => handleClearChapter(ch.subjectKey, ch.chapterKey)}
                                  disabled={clearing !== null}
                                  className="text-xs px-2 py-1 rounded-lg shrink-0 transition-all"
                                  style={{ background: "rgba(239,68,68,0.08)", color: "#f87171aa", border: "1px solid rgba(239,68,68,0.15)" }}>
                                  {clearing === chKey ? "…" : "✕"}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function CollectionPanel({ collection }: { collection: AdminCollection }) {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await fetchCollection(collection.path));
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [collection.path]);

  useEffect(() => { load(); }, [load]);

  async function handleSetup() {
    setBusy(true);
    setError("");
    try {
      await setupCollection(collection.path);
      await load();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  const count = data ? Object.keys(data).filter((k) => k !== "__initialized").length : 0;

  return (
    <div className="rounded-xl border p-4" style={{ background: `${collection.accent}08`, borderColor: `${collection.accent}20` }}>
      <div className="flex items-center gap-3 mb-4">
        <span className="text-2xl">{collection.icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-sm">{collection.label}</p>
          <p className="text-white/30 text-xs font-mono">/{collection.path}</p>
        </div>
        <button onClick={load} className="text-white/30 hover:text-white/60 text-xs transition-colors">↻</button>
      </div>
      {loading ? (
        <p className="text-white/30 text-xs">Loading…</p>
      ) : error ? (
        <div className="text-red-400 text-xs">{error}</div>
      ) : count === 0 ? (
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-white/60 text-sm font-medium">Collection is empty</p>
            <p className="text-white/25 text-xs mt-0.5">Create it to start managing records</p>
          </div>
          <button
            onClick={handleSetup}
            disabled={busy}
            className="px-3 py-1.5 rounded-lg text-xs font-bold"
            style={{ background: `${collection.accent}20`, color: collection.accent, border: `1px solid ${collection.accent}40` }}
          >
            {busy ? "…" : "Setup Collection"}
          </button>
        </div>
      ) : (
        <div className="text-white/35 text-xs">{count} records found</div>
      )}
    </div>
  );
}

// ─── Questions Bank Panel ─────────────────────────────────────────────────────

interface BankQuestion {
  subjectKey: string;
  chapterKey: string;
  indexInArray: number;
  english: string;
  hindi: string;
  options: string[];
  optionsHindi: string[];
  answerIndex: number;
}

type RawBankQ = {
  english?: string;
  hindi?: string;
  options?: unknown[];
  optionsHindi?: unknown[];
  answerIndex?: number;
};

async function fetchAllBankQuestions(): Promise<BankQuestion[]> {
  const snap = await get(ref(db, "aiQuestionsCache"));
  const data = snap.exists() ? snap.val() as Record<string, Record<string, { questions?: RawBankQ[] }>> : null;
  if (!data) return [];
  const result: BankQuestion[] = [];
  for (const [subjectKey, chapters] of Object.entries(data)) {
    for (const [chapterKey, val] of Object.entries(chapters ?? {})) {
      const qs = Array.isArray(val.questions) ? val.questions : [];
      qs.forEach((q, i) => {
        if (!q.english) return;
        result.push({
          subjectKey, chapterKey, indexInArray: i,
          english: String(q.english ?? ""),
          hindi: String(q.hindi ?? ""),
          options: Array.isArray(q.options) ? q.options.map(String) : [],
          optionsHindi: Array.isArray(q.optionsHindi) ? q.optionsHindi.map(String) : [],
          answerIndex: typeof q.answerIndex === "number" ? q.answerIndex : 0,
        });
      });
    }
  }
  return result;
}

async function saveBankChapter(subjectKey: string, chapterKey: string, questions: RawBankQ[]): Promise<void> {
  await set(ref(db, `aiQuestionsCache/${subjectKey}/${chapterKey}/questions`), questions);
}

function EditQuestionModal({
  q, accent, saving, onSave, onCancel,
}: {
  q: BankQuestion; accent: string; saving: boolean;
  onSave: (updated: BankQuestion) => void; onCancel: () => void;
}) {
  const [draft, setDraft] = useState<BankQuestion>({ ...q, options: [...q.options], optionsHindi: [...q.optionsHindi] });
  const inp = (extra?: object) => ({
    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: 8, color: "#fff" as const, fontSize: 12, padding: "7px 10px", outline: "none",
    ...extra,
  });
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      className="rounded-xl border px-4 py-4"
      style={{ background: "rgba(14,14,26,0.98)", borderColor: `${accent}45` }}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-white font-bold text-xs">Edit Question</p>
        <button onClick={onCancel} className="text-white/30 hover:text-white/60 text-sm transition-colors">✕</button>
      </div>
      <div className="flex flex-col gap-3">
        <div>
          <p className="text-white/35 text-xs mb-1">English</p>
          <textarea value={draft.english} onChange={(e) => setDraft((d) => ({ ...d, english: e.target.value }))}
            rows={3} style={{ ...inp({ resize: "vertical" as const, width: "100%" }) }} />
        </div>
        <div>
          <p className="text-white/35 text-xs mb-1">Hindi</p>
          <textarea value={draft.hindi} onChange={(e) => setDraft((d) => ({ ...d, hindi: e.target.value }))}
            rows={2} style={{ ...inp({ resize: "vertical" as const, width: "100%" }) }} />
        </div>
        <div>
          <p className="text-white/35 text-xs mb-2">Options — click circle to set correct answer</p>
          {draft.options.map((opt, i) => (
            <div key={i} className="flex items-center gap-2 mb-2">
              <button onClick={() => setDraft((d) => ({ ...d, answerIndex: i }))}
                className="w-5 h-5 rounded-full shrink-0 border-2 flex items-center justify-center transition-all"
                style={{ borderColor: i === draft.answerIndex ? accent : "rgba(255,255,255,0.18)", background: i === draft.answerIndex ? `${accent}30` : "transparent" }}>
                {i === draft.answerIndex && <span className="w-2.5 h-2.5 rounded-full" style={{ background: accent }} />}
              </button>
              <span className="text-white/30 text-xs w-4 shrink-0 font-bold">{String.fromCharCode(65 + i)}</span>
              <input value={opt} onChange={(e) => {
                const opts = [...draft.options]; opts[i] = e.target.value;
                setDraft((d) => ({ ...d, options: opts }));
              }} style={{ ...inp({ flex: 1 }) }} />
            </div>
          ))}
        </div>
      </div>
      <div className="flex gap-2 mt-4">
        <motion.button onClick={() => onSave(draft)} disabled={saving} whileTap={{ scale: 0.97 }}
          className="flex-1 py-2.5 rounded-lg text-xs font-black"
          style={{ background: `${accent}25`, color: accent, border: `1px solid ${accent}50` }}>
          {saving ? "Saving…" : "✓ Save Changes"}
        </motion.button>
        <motion.button onClick={onCancel} disabled={saving} whileTap={{ scale: 0.97 }}
          className="px-4 py-2.5 rounded-lg text-xs font-semibold"
          style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.32)", border: "1px solid rgba(255,255,255,0.10)" }}>
          Cancel
        </motion.button>
      </div>
    </motion.div>
  );
}

function BankQuestionCard({
  q, flatLabel, accent, onDelete, onEdit, deleting,
}: {
  q: BankQuestion; flatLabel: string; accent: string;
  onDelete: () => void; onEdit: () => void; deleting: boolean;
}) {
  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }}
      className="rounded-xl border px-4 py-4"
      style={{ background: `${accent}07`, borderColor: `${accent}22` }}>
      <div className="flex items-center gap-1.5 mb-2 flex-wrap">
        <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
          style={{ background: `${accent}20`, color: accent }}>{prettifySlug(q.subjectKey)}</span>
        <span className="text-xs px-2 py-0.5 rounded-full"
          style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.32)" }}>{prettifySlug(q.chapterKey)}</span>
        <span className="text-white/20 text-xs ml-auto">{flatLabel}</span>
      </div>
      <p className="text-white text-sm font-medium leading-relaxed mb-1">{q.english}</p>
      {q.hindi && <p className="text-white/35 text-xs mb-3 leading-snug">{q.hindi}</p>}
      <div className="flex flex-col gap-1 mb-3">
        {q.options.map((opt, i) => (
          <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs"
            style={{
              background: i === q.answerIndex ? `${accent}22` : "rgba(255,255,255,0.05)",
              border: `1px solid ${i === q.answerIndex ? accent + "50" : "rgba(255,255,255,0.06)"}`,
              color: i === q.answerIndex ? accent : "rgba(255,255,255,0.40)",
              fontWeight: i === q.answerIndex ? 700 : 400,
            }}>
            <span className="shrink-0 font-bold w-4" style={{ color: i === q.answerIndex ? accent : "rgba(255,255,255,0.20)" }}>
              {String.fromCharCode(65 + i)}
            </span>
            <span className="flex-1 truncate">{opt}</span>
            {i === q.answerIndex && <span className="shrink-0">✓</span>}
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <motion.button onClick={onEdit} whileTap={{ scale: 0.97 }}
          className="flex-1 py-2 rounded-lg text-xs font-bold"
          style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.55)", border: "1px solid rgba(255,255,255,0.10)" }}>
          ✎ Edit
        </motion.button>
        <motion.button onClick={onDelete} disabled={deleting} whileTap={{ scale: 0.97 }}
          className="flex-1 py-2 rounded-lg text-xs font-bold"
          style={{ background: "rgba(239,68,68,0.08)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" }}>
          {deleting ? "Deleting…" : "✕ Delete"}
        </motion.button>
      </div>
    </motion.div>
  );
}

function QuestionsBankPanel() {
  const [questions, setQuestions] = useState<BankQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [chapterFilter, setChapterFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [editingFlatIdx, setEditingFlatIdx] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingFlatIdx, setDeletingFlatIdx] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 15;

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setQuestions(await fetchAllBankQuestions()); }
    catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(0); }, [subjectFilter, chapterFilter, search]);

  const subjects = [...new Set(questions.map((q) => q.subjectKey))].sort();
  const filteredForChapters = subjectFilter === "all" ? questions : questions.filter((q) => q.subjectKey === subjectFilter);
  const chapters = [...new Set(filteredForChapters.map((q) => q.chapterKey))].sort();

  const filtered = questions.filter((q) => {
    if (subjectFilter !== "all" && q.subjectKey !== subjectFilter) return false;
    if (chapterFilter !== "all" && q.chapterKey !== chapterFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      if (!q.english.toLowerCase().includes(s) && !q.hindi.toLowerCase().includes(s)) return false;
    }
    return true;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageStart = page * PAGE_SIZE;
  const paged = filtered.slice(pageStart, pageStart + PAGE_SIZE);

  async function handleDelete(q: BankQuestion, flatIdx: number) {
    setDeletingFlatIdx(flatIdx);
    try {
      const snap = await get(ref(db, `aiQuestionsCache/${q.subjectKey}/${q.chapterKey}/questions`));
      const arr = (snap.exists() ? snap.val() : []) as RawBankQ[];
      const updated = arr.filter((_, i) => i !== q.indexInArray);
      await saveBankChapter(q.subjectKey, q.chapterKey, updated);
      setQuestions((prev) =>
        prev.filter((_, i) => i !== flatIdx)
          .map((p) => p.subjectKey === q.subjectKey && p.chapterKey === q.chapterKey && p.indexInArray > q.indexInArray
            ? { ...p, indexInArray: p.indexInArray - 1 } : p)
      );
    } catch { /* ignore */ }
    finally { setDeletingFlatIdx(null); }
  }

  async function handleSaveEdit(updated: BankQuestion, flatIdx: number) {
    setSaving(true);
    try {
      const snap = await get(ref(db, `aiQuestionsCache/${updated.subjectKey}/${updated.chapterKey}/questions`));
      const arr = (snap.exists() ? snap.val() : []) as RawBankQ[];
      arr[updated.indexInArray] = {
        english: updated.english, hindi: updated.hindi,
        options: updated.options, optionsHindi: updated.optionsHindi,
        answerIndex: updated.answerIndex,
      };
      await saveBankChapter(updated.subjectKey, updated.chapterKey, arr);
      setQuestions((prev) => prev.map((q, i) => i === flatIdx ? { ...updated } : q));
      setEditingFlatIdx(null);
    } catch { /* ignore */ }
    finally { setSaving(false); }
  }

  const selStyle = {
    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: 8, color: "rgba(255,255,255,0.58)" as const, fontSize: 12,
    padding: "7px 10px", outline: "none", cursor: "pointer" as const,
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        className="w-8 h-8 rounded-full border-2 border-transparent"
        style={{ borderTopColor: "#8b5cf6", borderRightColor: "#8b5cf620" }} />
      <p className="text-white/30 text-sm">Loading questions bank…</p>
    </div>
  );
  if (error) return (
    <div className="text-center py-16">
      <p className="text-red-400 text-sm mb-3">Failed: {error}</p>
      <button onClick={load} className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white/50 text-xs">Retry</button>
    </div>
  );

  return (
    <div>
      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 mb-5">
        {[
          { label: "Total Cached",  value: questions.length, color: "#8b5cf6" },
          { label: "After Filters", value: filtered.length,  color: "#06b6d4" },
          { label: "Subjects",      value: subjects.length,  color: "#10b981" },
        ].map((s) => (
          <div key={s.label} className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
            <p className="text-xs text-white/30 mb-1 leading-tight">{s.label}</p>
            <p className="text-lg font-black" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-2 mb-4">
        <div className="flex gap-2">
          <select value={subjectFilter} onChange={(e) => { setSubjectFilter(e.target.value); setChapterFilter("all"); }}
            style={{ ...selStyle, flex: 1 }}>
            <option value="all">All Subjects</option>
            {subjects.map((s) => <option key={s} value={s}>{prettifySlug(s)}</option>)}
          </select>
          <select value={chapterFilter} onChange={(e) => setChapterFilter(e.target.value)}
            style={{ ...selStyle, flex: 1 }}>
            <option value="all">All Chapters</option>
            {chapters.map((c) => <option key={c} value={c}>{prettifySlug(c)}</option>)}
          </select>
        </div>
        <input type="text" placeholder="🔍 Search questions…" value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)",
            borderRadius: 8, color: "#fff", fontSize: 12, padding: "8px 12px", outline: "none", width: "100%",
          }} />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">🔍</p>
          <p className="text-white/40 text-sm font-medium">No questions found</p>
          <p className="text-white/20 text-xs mt-1">Try adjusting the filters above</p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-3">
            <p className="text-white/35 text-xs">
              {pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, filtered.length)} of {filtered.length} questions
            </p>
            <button onClick={load} className="text-white/25 hover:text-white/50 text-xs transition-colors">↻ Reload</button>
          </div>

          <AnimatePresence mode="popLayout">
            <div className="flex flex-col gap-3">
              {paged.map((q, pi) => {
                const flatIdx = questions.indexOf(q);
                const sm = ALL_SUBJECTS.find(
                  (s) => s.id === q.subjectKey
                    || s.label.toLowerCase() === q.subjectKey
                    || s.label.toLowerCase().replace(/ /g, "_") === q.subjectKey
                );
                const accent = sm?.accent ?? "#8b5cf6";

                if (editingFlatIdx === flatIdx) {
                  return (
                    <EditQuestionModal key={`edit-${flatIdx}`} q={q} accent={accent} saving={saving}
                      onSave={(updated) => handleSaveEdit(updated, flatIdx)}
                      onCancel={() => setEditingFlatIdx(null)} />
                  );
                }
                return (
                  <BankQuestionCard key={`${q.subjectKey}-${q.chapterKey}-${q.indexInArray}`}
                    q={q} flatLabel={`#${pageStart + pi + 1}`} accent={accent}
                    deleting={deletingFlatIdx === flatIdx}
                    onDelete={() => handleDelete(q, flatIdx)}
                    onEdit={() => setEditingFlatIdx(flatIdx)} />
                );
              })}
            </div>
          </AnimatePresence>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-5">
              <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={{ background: "rgba(255,255,255,0.05)", color: page === 0 ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.50)", border: "1px solid rgba(255,255,255,0.10)" }}>
                ← Prev
              </button>
              <span className="text-white/30 text-xs">Page {page + 1} / {totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={{ background: "rgba(255,255,255,0.05)", color: page === totalPages - 1 ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.50)", border: "1px solid rgba(255,255,255,0.10)" }}>
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── PDF Import Panel ─────────────────────────────────────────────────────────

const PDF_SUBJECTS: Record<"c10" | "c12", Array<{ id: string; label: string; icon: string; accent: string; path: string }>> = {
  c10: [
    { id: "maths",    label: "Maths",          icon: "📐", accent: "#06b6d4", path: "maths" },
    { id: "english",  label: "English",        icon: "📖", accent: "#8b5cf6", path: "english" },
    { id: "hindi",    label: "Hindi",          icon: "🔤", accent: "#f97316", path: "hindi" },
    { id: "science",  label: "Science",        icon: "🔬", accent: "#10b981", path: "science" },
    { id: "social",   label: "Social Science", icon: "🌍", accent: "#f59e0b", path: "social science" },
    { id: "sanskrit", label: "Sanskrit",       icon: "📜", accent: "#ec4899", path: "sanskrit" },
  ],
  c12: [
    { id: "physics",   label: "Physics",   icon: "⚡", accent: "#3b82f6", path: "class12/physics" },
    { id: "chemistry", label: "Chemistry", icon: "🧪", accent: "#10b981", path: "class12/chemistry" },
    { id: "biology",   label: "Biology",   icon: "🌿", accent: "#22c55e", path: "class12/biology" },
    { id: "maths12",   label: "Maths",     icon: "📐", accent: "#06b6d4", path: "class12/maths" },
    { id: "social12",  label: "Social",    icon: "🌍", accent: "#f59e0b", path: "class12/social" },
    { id: "hindi12",   label: "Hindi",     icon: "🔤", accent: "#f97316", path: "class12/hindi" },
    { id: "english12", label: "English",   icon: "📖", accent: "#8b5cf6", path: "class12/english" },
  ],
};

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => { resolve((reader.result as string).split(",")[1]); };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

type ImportStep = "idle" | "reading" | "parsing" | "preview" | "saving" | "done";

function PDFImportPanel() {
  const [classId,   setClassId]     = useState<"c10" | "c12">("c10");
  const [subjectId, setSubjectId]   = useState("english");
  const [chapter,   setChapter]     = useState("");
  const [file,      setFile]        = useState<File | null>(null);
  const [step,      setStep]        = useState<ImportStep>("idle");
  const [questions, setQuestions]   = useState<GeneratedQuestion[]>([]);
  const [savedCount, setSavedCount] = useState(0);
  const [error,     setError]       = useState("");
  const [expandedQ, setExpandedQ]   = useState<number | null>(null);
  const [dragOver,  setDragOver]    = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const pdfSubjects = PDF_SUBJECTS[classId];
  const activeSub   = pdfSubjects.find((s) => s.id === subjectId) ?? pdfSubjects[0];
  const accent      = activeSub.accent;
  const busy        = step === "reading" || step === "parsing" || step === "saving";

  useEffect(() => {
    const first = PDF_SUBJECTS[classId][0];
    if (first && !PDF_SUBJECTS[classId].find((s) => s.id === subjectId)) {
      setSubjectId(first.id);
    }
  }, [classId, subjectId]);

  async function handleExtract() {
    if (!file || !chapter.trim()) { setError("Chapter name is required."); return; }
    setError(""); setStep("reading");
    try {
      const base64 = await readFileAsBase64(file);
      setStep("parsing");
      const extracted = await parsePDFQuestions(base64, activeSub.label, chapter.trim());
      if (extracted.length === 0) throw new Error("No MCQ questions found in this PDF.");
      setQuestions(extracted);
      setStep("preview");
    } catch (e) {
      setError(String(e));
      setStep("idle");
    }
  }

  async function handleSave() {
    const path = activeSub.path;
    setStep("saving"); setSavedCount(0);
    let saved = 0;
    for (const q of questions) {
      try {
        await push(ref(db, path), {
          english:      q.english,
          hindi:        q.hindi,
          options:      q.options,
          optionsHindi: q.optionsHindi,
          correctAnswer: q.answerIndex,
          chapter:      chapter.trim(),
        });
        saved++;
        setSavedCount(saved);
      } catch { /* skip failed */ }
    }
    setStep("done");
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault(); setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped?.type === "application/pdf") { setFile(dropped); setStep("idle"); setQuestions([]); setError(""); }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    if (picked) { setFile(picked); setStep("idle"); setQuestions([]); setError(""); }
  }

  return (
    <div>
      <div className="rounded-xl px-4 py-3 mb-5 flex items-start gap-3"
        style={{ background: "rgba(99,102,241,0.07)", border: "1px solid rgba(99,102,241,0.2)" }}>
        <span className="text-xl shrink-0 mt-0.5">📄</span>
        <div>
          <p className="text-indigo-400 text-xs font-bold">PDF → Firebase Importer</p>
          <p className="text-white/30 text-xs mt-0.5 leading-relaxed">
            Upload a question paper PDF. Gemini AI reads it and extracts all MCQ questions — both in English and Hindi — then saves them directly to Firebase.
          </p>
        </div>
      </div>

      {/* Step 1 — Class + Subject + Chapter */}
      <div className="flex flex-col gap-3 mb-4">
        <div>
          <p className="text-white/40 text-xs font-semibold mb-1.5">Class</p>
          <div className="grid grid-cols-2 gap-2">
            {(["c10", "c12"] as const).map((id) => {
              const meta = CLASS_UPLOAD_META[id];
              const isActive = classId === id;
              return (
                <button key={id} onClick={() => { setClassId(id); setStep("idle"); setQuestions([]); }} disabled={busy}
                  className="py-2 px-3 rounded-xl text-xs font-bold transition-all"
                  style={{
                    background: isActive ? `${meta.accent}25` : "rgba(255,255,255,0.05)",
                    border: `1px solid ${isActive ? meta.accent : "rgba(0,0,0,0.08)"}`,
                    color: isActive ? meta.accent : "rgba(255,255,255,0.40)",
                  }}>
                  {meta.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <p className="text-white/40 text-xs font-semibold mb-1.5">Subject</p>
          <div className="grid grid-cols-3 gap-2">
            {pdfSubjects.map((s) => (
              <button key={s.id} onClick={() => setSubjectId(s.id)} disabled={busy}
                className="flex flex-col items-center gap-1 py-2.5 rounded-xl border text-xs font-semibold transition-all"
                style={{
                  background:   activeSub.id === s.id ? `${s.accent}20` : "rgba(255,255,255,0.05)",
                  borderColor:  activeSub.id === s.id ? `${s.accent}50` : "rgba(0,0,0,0.08)",
                  color:        activeSub.id === s.id ? s.accent : "rgba(255,255,255,0.28)",
                }}>
                <span className="text-base">{s.icon}</span>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-white/40 text-xs font-semibold mb-1.5">Chapter / Topic Name</p>
          <input
            value={chapter} onChange={(e) => setChapter(e.target.value)}
            placeholder="e.g. Grammar, Trigonometry, Light..."
            disabled={busy}
            className="w-full px-3 py-2.5 rounded-xl text-sm text-white placeholder-white/20 outline-none border transition-all"
            style={{ background: "rgba(255,255,255,0.05)", borderColor: chapter ? `${accent}45` : "rgba(255,255,255,0.10)" }}
          />
        </div>
      </div>

      {/* Step 2 — PDF Upload */}
      <div
        onClick={() => !busy && fileInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className="relative rounded-2xl border-2 border-dashed flex flex-col items-center justify-center py-8 px-4 mb-4 cursor-pointer transition-all"
        style={{
          borderColor: dragOver ? accent : file ? `${accent}50` : "rgba(255,255,255,0.10)",
          background:  dragOver ? `${accent}0a` : file ? `${accent}06` : "transparent",
        }}>
        <input ref={fileInputRef} type="file" accept=".pdf,application/pdf" className="hidden" onChange={handleFileChange} />
        {file ? (
          <>
            <span className="text-3xl mb-2">📋</span>
            <p className="text-white/70 text-sm font-semibold text-center">{file.name}</p>
            <p className="text-white/25 text-xs mt-1">{(file.size / 1024).toFixed(0)} KB — click to change</p>
          </>
        ) : (
          <>
            <span className="text-3xl mb-2">📂</span>
            <p className="text-white/50 text-sm font-semibold">Drop PDF here or tap to browse</p>
            <p className="text-white/20 text-xs mt-1">Bihar Board question paper / practice set</p>
          </>
        )}
      </div>

      {error && (
        <div className="rounded-xl px-4 py-3 mb-4 text-red-400 text-xs"
          style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
          ⚠️ {error}
        </div>
      )}

      {/* Step 3 — Extract / Progress */}
      {step !== "preview" && step !== "done" && (
        <motion.button
          onClick={handleExtract}
          disabled={!file || !chapter.trim() || busy}
          whileTap={{ scale: 0.97 }}
          className="w-full py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2"
          style={{
            background:   (!file || !chapter.trim()) ? "rgba(255,255,255,0.05)" : `${accent}22`,
            borderColor:  (!file || !chapter.trim()) ? "rgba(255,255,255,0.10)"  : `${accent}45`,
            border:       "1px solid",
            color:        (!file || !chapter.trim()) ? "rgba(255,255,255,0.18)"  : accent,
          }}>
          {step === "reading" ? (
            <><motion.span animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>⏳</motion.span> Reading PDF…</>
          ) : step === "parsing" ? (
            <><motion.span animate={{ rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}>🤖</motion.span> Gemini is extracting questions…</>
          ) : (
            <>🔍 Extract Questions with AI</>
          )}
        </motion.button>
      )}

      {/* Step 4 — Preview */}
      {step === "preview" && questions.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="rounded-xl px-4 py-3 mb-4 flex items-center gap-3"
            style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)" }}>
            <span className="text-lg">✅</span>
            <div>
              <p className="text-emerald-400 text-xs font-bold">{questions.length} questions extracted!</p>
              <p className="text-white/30 text-xs">Review below, then save to Firebase.</p>
            </div>
            <button onClick={() => { setStep("idle"); setQuestions([]); }}
              className="ml-auto text-white/25 hover:text-white/50 text-xs transition-colors">Reset</button>
          </div>

          <div className="flex flex-col gap-2 mb-4 max-h-72 overflow-y-auto pr-1">
            {questions.map((q, i) => (
              <div key={i} className="rounded-xl border overflow-hidden"
                style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(0,0,0,0.08)" }}>
                <button onClick={() => setExpandedQ(expandedQ === i ? null : i)}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-left">
                  <span className="text-xs font-bold px-1.5 py-0.5 rounded-md shrink-0"
                    style={{ background: `${accent}20`, color: accent }}>Q{i + 1}</span>
                  <p className="text-white/70 text-xs flex-1 line-clamp-1">{q.english || q.hindi}</p>
                  <span className="text-white/25 text-xs">{expandedQ === i ? "▲" : "▼"}</span>
                </button>
                {expandedQ === i && (
                  <div className="px-3 pb-3 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                    {q.hindi && <p className="text-white/35 text-xs mt-2 mb-2">{q.hindi}</p>}
                    <div className="flex flex-col gap-1">
                      {q.options.map((opt, oi) => (
                        <p key={oi} className="text-xs px-2 py-1 rounded-lg"
                          style={{
                            background: oi === q.answerIndex ? `${accent}20` : "rgba(255,255,255,0.05)",
                            color:      oi === q.answerIndex ? accent : "rgba(255,255,255,0.32)",
                          }}>
                          {String.fromCharCode(65 + oi)}. {opt} {oi === q.answerIndex ? "✓" : ""}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <motion.button onClick={handleSave} whileTap={{ scale: 0.97 }}
            className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 border"
            style={{ background: `${accent}20`, borderColor: `${accent}45`, color: accent }}>
            💾 Save {questions.length} questions to Firebase
          </motion.button>
        </motion.div>
      )}

      {/* Step 5 — Saving progress */}
      {step === "saving" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-6">
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-10 h-10 rounded-full border-2 border-transparent mx-auto mb-3"
            style={{ borderTopColor: accent, borderRightColor: `${accent}40` }} />
          <p className="text-white/60 text-sm font-semibold">Saving to Firebase…</p>
          <p className="text-white/30 text-xs mt-1">{savedCount} / {questions.length} saved</p>
        </motion.div>
      )}

      {/* Step 6 — Done */}
      {step === "done" && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          className="text-center py-8">
          <p className="text-4xl mb-3">🎉</p>
          <p className="text-white font-bold text-base mb-1">{savedCount} questions saved!</p>
          <p className="text-white/30 text-xs mb-5">Now live in Firebase under "{activeSub.path}" → chapter "{chapter}"</p>
          <button onClick={() => { setStep("idle"); setFile(null); setQuestions([]); setChapter(""); setSavedCount(0); setError(""); }}
            className="px-5 py-2 rounded-xl text-sm font-semibold border transition-all"
            style={{ background: `${accent}15`, borderColor: `${accent}40`, color: accent }}>
            Import another PDF
          </button>
        </motion.div>
      )}
    </div>
  );
}

// ─── Upload Panel ─────────────────────────────────────────────────────────────

const CLASS_UPLOAD_SUBJECTS: Record<"c10" | "c12", Record<string, { label: string; path: string; accent: string }>> = {
  c10: {
    maths:    { label: "Maths",          path: "maths",          accent: "#06b6d4" },
    english:  { label: "English",        path: "english",        accent: "#8b5cf6" },
    hindi:    { label: "Hindi",          path: "hindi",          accent: "#f97316" },
    science:  { label: "Science",        path: "science",        accent: "#10b981" },
    social:   { label: "Social Science", path: "social science", accent: "#f59e0b" },
    sanskrit: { label: "Sanskrit",       path: "sanskrit",       accent: "#ec4899" },
  },
  c12: {
    physics:   { label: "Physics",   path: "class12/physics",   accent: "#3b82f6" },
    chemistry: { label: "Chemistry", path: "class12/chemistry", accent: "#10b981" },
    biology:   { label: "Biology",   path: "class12/biology",   accent: "#22c55e" },
    maths12:   { label: "Maths",     path: "class12/maths",     accent: "#06b6d4" },
    social12:  { label: "Social",    path: "class12/social",    accent: "#f59e0b" },
    hindi12:   { label: "Hindi",     path: "class12/hindi",     accent: "#f97316" },
    english12: { label: "English",   path: "class12/english",   accent: "#8b5cf6" },
  },
};

const CLASS_UPLOAD_META = {
  c10: { label: "Class 10", accent: "#8b5cf6" },
  c12: { label: "Class 12", accent: "#06b6d4" },
} as const;

function UploadPanel() {
  const [classId, setClassId] = useState<"c10" | "c12">("c10");
  const [subjectId, setSubjectId] = useState("maths");
  const [mode, setMode]   = useState<"single" | "bulk">("single");
  const [chapter, setChapter] = useState("");
  const [qEn, setQEn] = useState("");
  const [qHi, setQHi] = useState("");
  const [opts, setOpts] = useState(["", "", "", ""]);
  const [correct, setCorrect] = useState(0);
  const [bulkJson, setBulkJson] = useState("");
  const [status, setStatus] = useState<{ type: "idle" | "ok" | "err"; msg: string }>({ type: "idle", msg: "" });
  const [saving, setSaving] = useState(false);

  const subjects = CLASS_UPLOAD_SUBJECTS[classId];
  const subject = subjects[subjectId] ?? Object.values(subjects)[0];
  const accent  = subject?.accent ?? "#8b5cf6";

  useEffect(() => {
    const firstSubject = Object.keys(subjects)[0];
    if (firstSubject && !subjects[subjectId]) {
      setSubjectId(firstSubject);
    }
  }, [classId, subjectId, subjects]);

  async function uploadQuestions(questions: Array<{ english: string; hindi: string; options: string[]; answerIndex: number; chapter: string }>) {
    setSaving(true);
    setStatus({ type: "idle", msg: "" });
    const dbPath = subject.path.toLowerCase();
    let successCount = 0;
    for (const q of questions) {
      const payload = {
        question_english: q.english,
        question_hindi:   q.hindi,
        options: { A: q.options[0], B: q.options[1], C: q.options[2], D: q.options[3] },
        correct_answer: ["A","B","C","D"][q.answerIndex] ?? "A",
        chapter_name: q.chapter || "General",
      };
      try {
        await push(ref(db, dbPath), payload);
        successCount++;
      } catch { /* skip failed */ }
    }
    setSaving(false);
    if (successCount === questions.length) {
      setStatus({ type: "ok", msg: `✅ ${successCount} question${successCount !== 1 ? "s" : ""} uploaded to "${subject.path}"!` });
    } else {
      setStatus({ type: "err", msg: `⚠️ ${successCount}/${questions.length} uploaded. Check your Firebase rules.` });
    }
  }

  async function handleSingleUpload() {
    if (!qEn.trim() || opts.some(o => !o.trim()) || !chapter.trim()) {
      setStatus({ type: "err", msg: "Please fill in all fields (Question, all 4 options, chapter)." });
      return;
    }
    await uploadQuestions([{ english: qEn.trim(), hindi: qHi.trim(), options: opts.map(o => o.trim()), answerIndex: correct, chapter: chapter.trim() }]);
    setQEn(""); setQHi(""); setOpts(["","","",""]); setCorrect(0);
  }

  async function handleBulkUpload() {
    let parsed: Array<{ english: string; hindi?: string; options: string[]; answerIndex?: number; correct_answer?: string; chapter?: string }>;
    try {
      parsed = JSON.parse(bulkJson);
      if (!Array.isArray(parsed)) throw new Error("Not an array");
    } catch {
      setStatus({ type: "err", msg: "Invalid JSON. Must be an array of question objects." });
      return;
    }
    const qs = parsed.map(q => ({
      english:    String(q.english ?? ""),
      hindi:      String(q.hindi ?? ""),
      options:    (Array.isArray(q.options) ? q.options : []).map(String).slice(0, 4),
      answerIndex: typeof q.answerIndex === "number" ? q.answerIndex
        : (typeof q.correct_answer === "string" ? "ABCD".indexOf(q.correct_answer.toUpperCase()) : 0),
      chapter:    String(q.chapter ?? "General"),
    })).filter(q => q.english && q.options.length === 4);
    if (qs.length === 0) {
      setStatus({ type: "err", msg: "No valid questions found. Each must have english, options (4 items)." });
      return;
    }
    await uploadQuestions(qs);
    setBulkJson("");
  }

  return (
    <div className="flex flex-col gap-5">
        <div>
          <p className="text-white/40 text-xs mb-2">Select class:</p>
          <div className="grid grid-cols-2 gap-2 mb-3">
            {(["c10", "c12"] as const).map((id) => {
              const meta = CLASS_UPLOAD_META[id];
              const isActive = classId === id;
              return (
                <button
                  key={id}
                  onClick={() => setClassId(id)}
                  className="py-2 px-3 rounded-xl text-xs font-semibold transition-all"
                  style={{
                    background: isActive ? `${meta.accent}25` : "rgba(255,255,255,0.05)",
                    border: `1px solid ${isActive ? meta.accent : "rgba(0,0,0,0.08)"}`,
                    color: isActive ? meta.accent : "rgba(255,255,255,0.40)",
                  }}
                >
                  {meta.label}
                </button>
              );
            })}
          </div>

          <p className="text-white/40 text-xs mb-2">Select subject:</p>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(subjects).map(([id, s]) => (
              <button key={id} onClick={() => setSubjectId(id)}
                className="py-2 px-3 rounded-xl text-xs font-semibold text-left transition-all"
                style={{
                  background: subjectId === id ? `${s.accent}25` : "rgba(255,255,255,0.05)",
                  border: `1px solid ${subjectId === id ? s.accent : "rgba(0,0,0,0.08)"}`,
                  color: subjectId === id ? s.accent : "rgba(255,255,255,0.40)",
                }}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

      <div className="flex gap-2">
        {(["single", "bulk"] as const).map((m) => (
          <button key={m} onClick={() => setMode(m)}
            className="flex-1 py-2 rounded-xl text-xs font-bold transition-all"
            style={{
              background: mode === m ? `${accent}25` : "rgba(255,255,255,0.05)",
              border: `1px solid ${mode === m ? accent : "rgba(0,0,0,0.08)"}`,
              color: mode === m ? accent : "rgba(255,255,255,0.32)",
            }}>
            {m === "single" ? "✏️ One-by-One" : "📋 Bulk JSON"}
          </button>
        ))}
      </div>

      {mode === "single" && (
        <div className="flex flex-col gap-3">
          <div>
            <p className="text-white/40 text-xs mb-1">Chapter name</p>
            <input value={chapter} onChange={e => setChapter(e.target.value)} placeholder="e.g. Trigonometry"
              className="w-full px-3 py-2 rounded-xl text-sm text-white bg-white/5 border border-white/10 outline-none" />
          </div>
          <div>
            <p className="text-white/40 text-xs mb-1">Question (English)</p>
            <textarea value={qEn} onChange={e => setQEn(e.target.value)} rows={2} placeholder="Question in English..."
              className="w-full px-3 py-2 rounded-xl text-sm text-white bg-white/5 border border-white/10 outline-none resize-none" />
          </div>
          <div>
            <p className="text-white/40 text-xs mb-1">Question (Hindi) — optional</p>
            <textarea value={qHi} onChange={e => setQHi(e.target.value)} rows={2} placeholder="प्रश्न हिंदी में..."
              className="w-full px-3 py-2 rounded-xl text-sm text-white bg-white/5 border border-white/10 outline-none resize-none" />
          </div>
          {["A","B","C","D"].map((ltr, i) => (
            <div key={ltr} className="flex items-center gap-2">
              <button onClick={() => setCorrect(i)}
                className="w-7 h-7 rounded-lg text-xs font-black shrink-0 transition-all"
                style={{ background: correct === i ? `${accent}30` : "rgba(255,255,255,0.06)", color: correct === i ? accent : "rgba(255,255,255,0.28)", border: `1px solid ${correct === i ? accent : "rgba(255,255,255,0.10)"}` }}>
                {ltr}
              </button>
              <input value={opts[i]} onChange={e => setOpts(opts.map((o, j) => j === i ? e.target.value : o))}
                placeholder={`Option ${ltr}`}
                className="flex-1 px-3 py-2 rounded-xl text-sm text-white bg-white/5 border border-white/10 outline-none" />
            </div>
          ))}
          <p className="text-white/30 text-xs">Tap A/B/C/D button to mark correct answer. Currently: <span style={{ color: accent }}>{["A","B","C","D"][correct]}</span></p>
          <motion.button onClick={handleSingleUpload} disabled={saving} whileTap={{ scale: 0.97 }}
            className="w-full py-3 rounded-xl font-bold text-sm"
            style={{ background: saving ? "rgba(255,255,255,0.06)" : `${accent}25`, color: accent, border: `1px solid ${accent}40` }}>
            {saving ? "Uploading…" : `📤 Upload Question to ${subject.label}`}
          </motion.button>
        </div>
      )}

      {mode === "bulk" && (
        <div className="flex flex-col gap-3">
          <p className="text-white/40 text-xs leading-relaxed">
            Paste a JSON array. Each item: <span className="text-white/60 font-mono text-xs">{"{"}"english","hindi","options":[A,B,C,D],"answerIndex":0,"chapter"{"}"}</span>
          </p>
          <textarea value={bulkJson} onChange={e => setBulkJson(e.target.value)} rows={10}
            placeholder={`[\n  {\n    "english": "What is 2+2?",\n    "hindi": "2+2 क्या है?",\n    "options": ["3","4","5","6"],\n    "answerIndex": 1,\n    "chapter": "Numbers"\n  }\n]`}
            className="w-full px-3 py-2 rounded-xl text-xs text-white/80 font-mono bg-white/5 border border-white/10 outline-none resize-none" />
          <motion.button onClick={handleBulkUpload} disabled={saving} whileTap={{ scale: 0.97 }}
            className="w-full py-3 rounded-xl font-bold text-sm"
            style={{ background: saving ? "rgba(255,255,255,0.06)" : `${accent}25`, color: accent, border: `1px solid ${accent}40` }}>
            {saving ? "Uploading…" : `📤 Validate & Upload to ${subject.label}`}
          </motion.button>
        </div>
      )}

      {status.type !== "idle" && (
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
          className="px-4 py-3 rounded-xl text-sm text-center font-semibold"
          style={{
            background: status.type === "ok" ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.1)",
            border: `1px solid ${status.type === "ok" ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.25)"}`,
            color: status.type === "ok" ? "#10b981" : "#ef4444",
          }}>
          {status.msg}
        </motion.div>
      )}
    </div>
  );
}

// ─── Main Admin Page ───────────────────────────────────────────────────────────

const ALL_ADMIN_SUBJECTS = [...ALL_SUBJECTS, ...ALL_C12_SUBJECTS];

export default function AdminPage({ onSignOut }: { onSignOut?: () => void }) {
  const [, navigate] = useLocation();
  const [subjectData, setSubjectData] = useState<Record<string, SubjectInfo>>(
    Object.fromEntries(ALL_ADMIN_SUBJECTS.map((s) => [s.id, { count: 0, status: "loading" as SubjectStatus }]))
  );
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [reviewSubject, setReviewSubject] = useState<AdminSubject | null>(null);
  const [overviewClass, setOverviewClass] = useState<"c10" | "c12">("c10");
  const [aiClass, setAiClass] = useState<"c10" | "c12">("c10");
  const initialTab = (() => {
    const p = new URLSearchParams(window.location.search).get("tab");
    return (["overview", "ai", "users", "payments", "ratings", "cache", "pdf", "bank", "upload"] as const).find(t => t === p) ?? "overview";
  })();
  const [activeTab, setActiveTab] = useState<"overview" | "ai" | "users" | "payments" | "ratings" | "cache" | "pdf" | "bank" | "upload" | "coupons" | "announcements">(initialTab);
  const jumpRef = useRef<HTMLDivElement | null>(null);
  const [pendingBadge, setPendingBadge] = useState(0);

  const loadAll = useCallback(async () => {
    setRefreshing(true);
    setSubjectData(Object.fromEntries(ALL_ADMIN_SUBJECTS.map((s) => [s.id, { count: 0, status: "loading" }])));
    const [results, pending] = await Promise.all([
      Promise.all(ALL_ADMIN_SUBJECTS.map(async (s) => ({ id: s.id, info: await fetchCount(s.dbPath) }))),
      fetchPendingCount(),
    ]);
    setSubjectData(Object.fromEntries(results.map((r) => [r.id, r.info])));
    setPendingBadge(pending);
    setLastRefreshed(new Date());
    setRefreshing(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const visibleOverviewSubjects = overviewClass === "c10" ? ALL_SUBJECTS : ALL_C12_SUBJECTS;
  const visibleAiSubjects = aiClass === "c10" ? ALL_SUBJECTS : ALL_C12_SUBJECTS;

  const totalQuestions = ALL_ADMIN_SUBJECTS.reduce((sum, s) => sum + (subjectData[s.id]?.status === "loaded" ? subjectData[s.id].count : 0), 0);
  const loadedCount   = ALL_ADMIN_SUBJECTS.filter((s) => subjectData[s.id]?.status === "loaded").length;
  const errorCount    = ALL_ADMIN_SUBJECTS.filter((s) => subjectData[s.id]?.status === "error").length;
  const emptyCount    = ALL_ADMIN_SUBJECTS.filter((s) => subjectData[s.id]?.status === "empty").length;

  return (
    <div className="min-h-screen w-full relative overflow-hidden" style={{ background: "#07080f" }}>
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full blur-3xl opacity-10"
          style={{ background: "radial-gradient(circle, #8b5cf6, transparent)" }} />
        <div className="absolute bottom-0 -left-32 w-80 h-80 rounded-full blur-3xl opacity-10"
          style={{ background: "radial-gradient(circle, #06b6d4, transparent)" }} />
        <div className="absolute inset-0 opacity-[0.02]"
          style={{ backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)`, backgroundSize: "32px 32px" }} />
      </div>

      <div className="relative z-10 max-w-lg mx-auto px-4 py-10">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }} className="mb-8">
          <button onClick={() => navigate("/")}
            className="flex items-center gap-2 text-white/30 hover:text-white/60 transition-colors text-sm mb-6">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 4L6 8l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Back to Dashboard
          </button>

          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl">🛠</span>
                <h1 className="text-2xl font-black text-white tracking-tight">Admin Panel</h1>
              </div>
              <p className="text-white/30 text-xs">Firebase Realtime Database — Subject Overview</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <motion.button onClick={loadAll} disabled={refreshing} whileTap={{ scale: 0.95 }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/50 hover:text-white/80 hover:bg-white/10 transition-all text-xs font-medium disabled:opacity-40">
                <motion.span animate={refreshing ? { rotate: 360 } : { rotate: 0 }}
                  transition={refreshing ? { duration: 1, repeat: Infinity, ease: "linear" } : {}}>↻</motion.span>
                Refresh
              </motion.button>
              {onSignOut && (
                <motion.button onClick={onSignOut} whileTap={{ scale: 0.95 }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400/70 hover:text-red-400 hover:bg-red-500/15 transition-all text-xs font-medium"
                  title="Sign out">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M4.5 2H2.5A.5.5 0 002 2.5v7a.5.5 0 00.5.5h2M8 4l2 2-2 2M10 6H5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Sign Out
                </motion.button>
              )}
            </div>
          </div>
        </motion.div>

        {/* Summary stats */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }} className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: "Total Questions", value: totalQuestions.toLocaleString(), color: "#8b5cf6" },
            { label: "Subjects Loaded",  value: `${loadedCount} / ${ALL_SUBJECTS.length}`, color: "#10b981" },
            { label: "Issues",           value: errorCount + emptyCount, color: errorCount > 0 ? "#ef4444" : "#f59e0b" },
          ].map((stat, i) => (
            <motion.div key={stat.label} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.15 + i * 0.05 }}
              className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
              <p className="text-xs text-white/30 mb-1 leading-tight">{stat.label}</p>
              <p className="text-lg font-black" style={{ color: stat.color }}>{stat.value}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* Tab switcher — horizontal scroll for all admin tools */}
        <motion.div
          ref={jumpRef}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex gap-2 mb-6 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {([
            { id: "overview",  icon: "📊", label: "Database",  badge: 0 },
            { id: "ai",        icon: "🤖", label: "AI Review", badge: 0 },
            { id: "users",     icon: "👥", label: "Users",     badge: 0 },
            { id: "payments",  icon: "💳", label: "Payments",  badge: pendingBadge },
            { id: "ratings",   icon: "⭐", label: "Ratings",   badge: 0 },
            { id: "cache",     icon: "🗄️", label: "Cache",     badge: 0 },
            { id: "pdf",       icon: "📄", label: "PDF Import",badge: 0 },
            { id: "bank",      icon: "📚", label: "Q Bank",    badge: 0 },
            { id: "upload",    icon: "📤", label: "Upload",    badge: 0 },
          ] as const).map(({ id, icon, label, badge }) => {
            const isActive = activeTab === id;
            return (
              <button key={id}
                onClick={() => { setActiveTab(id); setReviewSubject(null); }}
                className="relative flex flex-col items-center gap-1.5 py-3 px-3 rounded-xl transition-all shrink-0 min-w-[92px]"
                style={{
                  background: isActive
                    ? "linear-gradient(135deg, rgba(139,92,246,0.25), rgba(6,182,212,0.15))"
                    : "rgba(255,255,255,0.04)",
                  border: isActive
                    ? "1px solid rgba(139,92,246,0.4)"
                    : "1px solid rgba(255,255,255,0.07)",
                  boxShadow: isActive ? "0 0 12px rgba(139,92,246,0.18)" : "none",
                }}>
                <span className="text-lg leading-none">{icon}</span>
                <span className="text-[11px] font-semibold leading-tight text-center"
                  style={{ color: isActive ? "#fff" : "rgba(255,255,255,0.40)" }}>
                  {label}
                </span>
                {badge > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full text-black font-black flex items-center justify-center"
                    style={{ background: "#f59e0b", fontSize: "10px" }}>
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </motion.div>

        <AnimatePresence mode="wait">
          {activeTab === "overview" && (
            <motion.div key="overview" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.25 }}>
              {/* Class toggle */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                {(["c10", "c12"] as const).map((cls) => {
                  const isActive = overviewClass === cls;
                  return (
                    <button key={cls} onClick={() => setOverviewClass(cls)}
                      className="py-2 rounded-xl text-xs font-bold transition-all"
                      style={{
                        background: isActive ? "rgba(139,92,246,0.2)" : "rgba(255,255,255,0.04)",
                        border: `1px solid ${isActive ? "rgba(139,92,246,0.5)" : "rgba(255,255,255,0.08)"}`,
                        color: isActive ? "#a78bfa" : "rgba(255,255,255,0.35)",
                      }}>
                      {cls === "c10" ? "Class 10" : "Class 12"}
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-col gap-3 mb-6">
                {visibleOverviewSubjects.map((subject, index) => (
                  <SubjectRow key={subject.id} subject={subject}
                    info={subjectData[subject.id] ?? { count: 0, status: "loading" }} index={index} />
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === "ai" && (
            <motion.div key="ai-review" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.25 }}>
              {!reviewSubject ? (
                <div>
                  {/* Class toggle */}
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    {(["c10", "c12"] as const).map((cls) => {
                      const isActive = aiClass === cls;
                      return (
                        <button key={cls} onClick={() => setAiClass(cls)}
                          className="py-2 rounded-xl text-xs font-bold transition-all"
                          style={{
                            background: isActive ? "rgba(139,92,246,0.2)" : "rgba(255,255,255,0.04)",
                            border: `1px solid ${isActive ? "rgba(139,92,246,0.5)" : "rgba(255,255,255,0.08)"}`,
                            color: isActive ? "#a78bfa" : "rgba(255,255,255,0.35)",
                          }}>
                          {cls === "c10" ? "Class 10" : "Class 12"}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-white/40 text-xs mb-3 font-medium">Select a subject to review its AI-generated questions:</p>
                  <div className="flex flex-col gap-2">
                    {visibleAiSubjects.map((subject, i) => (
                      <motion.button
                        key={subject.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        onClick={() => setReviewSubject(subject)}
                        whileHover={{ scale: 1.02, x: 4 }}
                        whileTap={{ scale: 0.98 }}
                        className="flex items-center gap-3 px-4 py-3.5 rounded-xl border text-left group"
                        style={{ background: `${subject.accent}0a`, borderColor: `${subject.accent}25` }}
                      >
                        <span className="text-xl">{subject.icon}</span>
                        <div className="flex-1">
                          <p className="text-white font-semibold text-sm">{subject.label}</p>
                          <p className="text-white/30 text-xs">Review AI-generated questions</p>
                        </div>
                        <span className="text-white/25 group-hover:text-white/60 transition-colors text-sm">→</span>
                      </motion.button>
                    ))}
                  </div>
                </div>
              ) : (
                <AIReviewPanel subject={reviewSubject} onClose={() => setReviewSubject(null)} />
              )}
            </motion.div>
          )}

          {activeTab === "users" && (
            <motion.div key="users" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.25 }}>
              <UsersPanel />
            </motion.div>
          )}

          {activeTab === "payments" && (
            <motion.div key="payments" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.25 }}>
              <PaymentsPanel />
            </motion.div>
          )}

          {activeTab === "ratings" && (
            <motion.div key="ratings" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.25 }}>
              <RatingsPanel />
            </motion.div>
          )}

          {activeTab === "cache" && (
            <motion.div key="cache" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.25 }}>
              <CachePanel />
            </motion.div>
          )}

          {activeTab === "pdf" && (
            <motion.div key="pdf" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.25 }}>
              <PDFImportPanel />
            </motion.div>
          )}

          {activeTab === "bank" && (
            <motion.div key="bank" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.25 }}>
              <QuestionsBankPanel />
            </motion.div>
          )}

          {activeTab === "upload" && (
            <motion.div key="upload" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.25 }}>
              <UploadPanel />
            </motion.div>
          )}

          {activeTab === "coupons" && (
            <motion.div key="coupons" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.25 }}>
              <CollectionPanel collection={{ path: "coupons", label: "Coupons", icon: "🏷️", accent: "#f59e0b" }} />
            </motion.div>
          )}

          {activeTab === "announcements" && (
            <motion.div key="announcements" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.25 }}>
              <CollectionPanel collection={{ path: "announcements", label: "Announcements", icon: "📣", accent: "#06b6d4" }} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }} className="text-center mt-6">
          {lastRefreshed && (
            <p className="text-white/20 text-xs">Last refreshed: {lastRefreshed.toLocaleTimeString()}</p>
          )}
          <p className="text-white/10 text-xs mt-1">shiken-d8789-default-rtdb.firebaseio.com</p>
        </motion.div>
      </div>
    </div>
  );
}
