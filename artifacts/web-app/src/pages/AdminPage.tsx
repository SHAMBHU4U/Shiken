import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";

const DB_URL = "https://shiken-d8789-default-rtdb.firebaseio.com";

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
  deviceId: string;
  lastActive: number;
  sessions: UserSession[];
  totalSessions: number;
  avgPct: number;
  subjectSet: string[];
}

const SUBJECT_ICONS: Record<string, string> = {
  maths: "📐", english: "📖", hindi: "🔤",
  science: "🔬", social: "🌍", sanskrit: "📜",
};
const SUBJECT_COLORS: Record<string, string> = {
  maths: "#06b6d4", english: "#8b5cf6", hindi: "#f97316",
  science: "#10b981", social: "#f59e0b", sanskrit: "#ec4899",
};

async function fetchUsers(): Promise<UserRecord[]> {
  const res = await fetch(`${DB_URL}/userActivity.json`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json() as Record<string, { meta?: { deviceId: string; lastActive: number }; sessions?: Record<string, UserSession> }> | null;
  if (!data) return [];
  return Object.values(data).map((u) => {
    const sessions = u.sessions ? Object.values(u.sessions) : [];
    const avgPct = sessions.length ? Math.round(sessions.reduce((s, r) => s + r.pct, 0) / sessions.length) : 0;
    const subjectSet = [...new Set(sessions.map((s) => s.subject))];
    return {
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

function UserCard({ user, index }: { user: UserRecord; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const shortId = user.deviceId.length > 18 ? user.deviceId.slice(0, 18) + "…" : user.deviceId;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="rounded-xl border border-white/10 overflow-hidden"
      style={{ background: "rgba(255,255,255,0.04)" }}
    >
      {/* User header row */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-white/4 transition-colors"
      >
        <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-sm font-black"
          style={{ background: `${gradeColor(user.avgPct)}22`, color: gradeColor(user.avgPct) }}>
          {user.avgPct}%
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white text-xs font-semibold truncate font-mono">{shortId}</p>
          <p className="text-white/30 text-xs mt-0.5">
            {user.totalSessions} test{user.totalSessions !== 1 ? "s" : ""} · Last active {timeAgo(user.lastActive)}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {user.subjectSet.slice(0, 4).map((s) => (
            <span key={s} className="text-sm" title={s}>{SUBJECT_ICONS[s] ?? "📚"}</span>
          ))}
          {user.subjectSet.length > 4 && (
            <span className="text-white/30 text-xs">+{user.subjectSet.length - 4}</span>
          )}
          <span className="text-white/25 ml-1 text-xs transition-transform"
            style={{ display: "inline-block", transform: expanded ? "rotate(90deg)" : "rotate(0deg)" }}>›</span>
        </div>
      </button>

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

const ALL_SUBJECTS = [
  { id: "maths",    label: "Maths",          icon: "📐", accent: "#06b6d4", gradient: "from-cyan-500/20 to-blue-600/20",   border: "border-cyan-400/20" },
  { id: "english",  label: "English",         icon: "📖", accent: "#8b5cf6", gradient: "from-violet-500/20 to-purple-700/20", border: "border-violet-400/20" },
  { id: "hindi",    label: "Hindi",           icon: "🔤", accent: "#f97316", gradient: "from-orange-500/20 to-red-600/20",   border: "border-orange-400/20" },
  { id: "science",  label: "Science",         icon: "🔬", accent: "#10b981", gradient: "from-emerald-500/20 to-teal-600/20", border: "border-emerald-400/20" },
  { id: "social",   label: "Social Science",  icon: "🌍", accent: "#f59e0b", gradient: "from-amber-500/20 to-yellow-600/20", border: "border-amber-400/20" },
  { id: "sanskrit", label: "Sanskrit",        icon: "📜", accent: "#ec4899", gradient: "from-pink-500/20 to-rose-600/20",   border: "border-pink-400/20" },
];

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

async function fetchCount(subjectId: string): Promise<SubjectInfo> {
  try {
    const res = await fetch(`${DB_URL}/${subjectId}.json?shallow=true`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
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

async function fetchAIQuestions(subjectId: string): Promise<AIQuestion[]> {
  const res = await fetch(`${DB_URL}/${subjectId}.json`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json() as Record<string, unknown> | null;
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
  await fetch(`${DB_URL}/${subjectId}/${key}.json`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chapter: "General" }),
  });
}

async function rejectQuestion(subjectId: string, key: string): Promise<void> {
  await fetch(`${DB_URL}/${subjectId}/${key}.json`, { method: "DELETE" });
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

function SubjectRow({ subject, info, index }: { subject: (typeof ALL_SUBJECTS)[0]; info: SubjectInfo; index: number }) {
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
        <p className="text-white/30 text-xs font-mono mt-0.5">/{subject.id}</p>
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
  subject: (typeof ALL_SUBJECTS)[0];
  onApprove: () => void;
  onReject: () => void;
}) {
  const [action, setAction] = useState<"approving" | "rejecting" | null>(null);
  const [done, setDone] = useState<"approved" | "rejected" | null>(null);

  async function handleApprove() {
    setAction("approving");
    try { await approveQuestion(subject.id, question.key); setDone("approved"); onApprove(); }
    catch { setAction(null); }
  }

  async function handleReject() {
    setAction("rejecting");
    try { await rejectQuestion(subject.id, question.key); setDone("rejected"); onReject(); }
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
              background: i === question.correctAnswer ? `${subject.accent}22` : "rgba(255,255,255,0.04)",
              border: `1px solid ${i === question.correctAnswer ? subject.accent + "50" : "rgba(255,255,255,0.08)"}`,
              color: i === question.correctAnswer ? subject.accent : "rgba(255,255,255,0.5)",
              fontWeight: i === question.correctAnswer ? 700 : 400,
            }}>
            <span className="shrink-0 font-bold" style={{ color: i === question.correctAnswer ? subject.accent : "rgba(255,255,255,0.25)" }}>
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

function AIReviewPanel({ subject, onClose }: { subject: (typeof ALL_SUBJECTS)[0]; onClose: () => void }) {
  const [questions, setQuestions] = useState<AIQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [counts, setCounts] = useState({ total: 0, remaining: 0 });

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchAIQuestions(subject.id)
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
        <div className="mb-4 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
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

export default function AdminPage({ onSignOut }: { onSignOut?: () => void }) {
  const [, navigate] = useLocation();
  const [subjectData, setSubjectData] = useState<Record<string, SubjectInfo>>(
    Object.fromEntries(ALL_SUBJECTS.map((s) => [s.id, { count: 0, status: "loading" as SubjectStatus }]))
  );
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [reviewSubject, setReviewSubject] = useState<(typeof ALL_SUBJECTS)[0] | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "ai" | "users">("overview");

  const loadAll = useCallback(async () => {
    setRefreshing(true);
    setSubjectData(Object.fromEntries(ALL_SUBJECTS.map((s) => [s.id, { count: 0, status: "loading" }])));
    const results = await Promise.all(ALL_SUBJECTS.map(async (s) => ({ id: s.id, info: await fetchCount(s.id) })));
    setSubjectData(Object.fromEntries(results.map((r) => [r.id, r.info])));
    setLastRefreshed(new Date());
    setRefreshing(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const totalQuestions = ALL_SUBJECTS.reduce((sum, s) => sum + (subjectData[s.id]?.status === "loaded" ? subjectData[s.id].count : 0), 0);
  const loadedCount   = ALL_SUBJECTS.filter((s) => subjectData[s.id]?.status === "loaded").length;
  const errorCount    = ALL_SUBJECTS.filter((s) => subjectData[s.id]?.status === "error").length;
  const emptyCount    = ALL_SUBJECTS.filter((s) => subjectData[s.id]?.status === "empty").length;

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

        {/* Tab switcher */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
          className="flex gap-1.5 mb-5 p-1 rounded-xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
          {([ 
            { id: "overview", label: "📊 Database" },
            { id: "ai",       label: "🤖 AI Review" },
            { id: "users",    label: "👥 Users" },
          ] as const).map(({ id, label }) => (
            <button key={id} onClick={() => { setActiveTab(id); setReviewSubject(null); }}
              className="flex-1 py-2 rounded-lg text-xs font-bold transition-all"
              style={{
                background: activeTab === id ? "rgba(255,255,255,0.1)" : "transparent",
                color:      activeTab === id ? "#fff" : "rgba(255,255,255,0.35)",
                border:     activeTab === id ? "1px solid rgba(255,255,255,0.15)" : "1px solid transparent",
              }}>
              {label}
            </button>
          ))}
        </motion.div>

        <AnimatePresence mode="wait">
          {activeTab === "overview" && (
            <motion.div key="overview" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.25 }}>
              <div className="flex flex-col gap-3 mb-6">
                {ALL_SUBJECTS.map((subject, index) => (
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
                  <p className="text-white/40 text-xs mb-3 font-medium">Select a subject to review its AI-generated questions:</p>
                  <div className="flex flex-col gap-2">
                    {ALL_SUBJECTS.map((subject, i) => (
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
