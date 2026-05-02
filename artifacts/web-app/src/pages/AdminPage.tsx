import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";

const DB_URL = "https://shiken-d8789-default-rtdb.firebaseio.com";

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
  if (status === "error") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/20 border border-red-400/30 text-red-400 text-xs font-medium">
        ⚠ Error
      </span>
    );
  }
  if (status === "empty") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/30 text-xs font-medium">
        ○ Empty
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-400 text-xs font-medium">
      ✓ {count.toLocaleString()} questions
    </span>
  );
}

function SubjectRow({
  subject,
  info,
  index,
}: {
  subject: (typeof ALL_SUBJECTS)[0];
  info: SubjectInfo;
  index: number;
}) {
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
      <div className="shrink-0">
        <StatusBadge status={info.status} count={info.count} />
      </div>
      {info.status === "loaded" && (
        <div
          className="shrink-0 w-16 h-1.5 rounded-full overflow-hidden"
          style={{ background: `${subject.accent}20` }}
        >
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: "100%" }}
            transition={{ delay: 0.3 + index * 0.06, duration: 0.8, ease: "easeOut" }}
            className="h-full rounded-full"
            style={{ background: subject.accent }}
          />
        </div>
      )}
    </motion.div>
  );
}

export default function AdminPage() {
  const [, navigate] = useLocation();
  const [subjectData, setSubjectData] = useState<Record<string, SubjectInfo>>(
    Object.fromEntries(ALL_SUBJECTS.map((s) => [s.id, { count: 0, status: "loading" as SubjectStatus }]))
  );
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadAll = useCallback(async () => {
    setRefreshing(true);
    setSubjectData(Object.fromEntries(ALL_SUBJECTS.map((s) => [s.id, { count: 0, status: "loading" }])));
    const results = await Promise.all(
      ALL_SUBJECTS.map(async (s) => ({ id: s.id, info: await fetchCount(s.id) }))
    );
    setSubjectData(Object.fromEntries(results.map((r) => [r.id, r.info])));
    setLastRefreshed(new Date());
    setRefreshing(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const totalQuestions = ALL_SUBJECTS.reduce((sum, s) => {
    const info = subjectData[s.id];
    return sum + (info?.status === "loaded" ? info.count : 0);
  }, 0);

  const loadedCount = ALL_SUBJECTS.filter((s) => subjectData[s.id]?.status === "loaded").length;
  const errorCount = ALL_SUBJECTS.filter((s) => subjectData[s.id]?.status === "error").length;
  const emptyCount = ALL_SUBJECTS.filter((s) => subjectData[s.id]?.status === "empty").length;

  return (
    <div className="min-h-screen w-full relative overflow-hidden" style={{ background: "#07080f" }}>
      {/* Background glows */}
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
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
          className="mb-8"
        >
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 text-white/30 hover:text-white/60 transition-colors text-sm mb-6"
          >
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
            <motion.button
              onClick={loadAll}
              disabled={refreshing}
              whileTap={{ scale: 0.95 }}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/50 hover:text-white/80 hover:bg-white/10 transition-all text-xs font-medium disabled:opacity-40"
            >
              <motion.span
                animate={refreshing ? { rotate: 360 } : { rotate: 0 }}
                transition={refreshing ? { duration: 1, repeat: Infinity, ease: "linear" } : {}}
              >
                ↻
              </motion.span>
              Refresh
            </motion.button>
          </div>
        </motion.div>

        {/* Summary stats */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="grid grid-cols-3 gap-3 mb-6"
        >
          {[
            { label: "Total Questions", value: totalQuestions.toLocaleString(), color: "#8b5cf6" },
            { label: "Subjects Loaded", value: `${loadedCount} / ${ALL_SUBJECTS.length}`, color: "#10b981" },
            { label: "Issues", value: errorCount + emptyCount, color: errorCount > 0 ? "#ef4444" : "#f59e0b" },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.15 + i * 0.05 }}
              className="bg-white/5 border border-white/10 rounded-xl p-3 text-center"
            >
              <p className="text-xs text-white/30 mb-1 leading-tight">{stat.label}</p>
              <p className="text-lg font-black" style={{ color: stat.color }}>{stat.value}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* Subject rows */}
        <div className="flex flex-col gap-3 mb-6">
          <AnimatePresence>
            {ALL_SUBJECTS.map((subject, index) => (
              <SubjectRow
                key={subject.id}
                subject={subject}
                info={subjectData[subject.id] ?? { count: 0, status: "loading" }}
                index={index}
              />
            ))}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-center"
        >
          {lastRefreshed && (
            <p className="text-white/20 text-xs">
              Last refreshed: {lastRefreshed.toLocaleTimeString()}
            </p>
          )}
          <p className="text-white/10 text-xs mt-1">
            shiken-d8789-default-rtdb.firebaseio.com
          </p>
        </motion.div>
      </div>
    </div>
  );
}
