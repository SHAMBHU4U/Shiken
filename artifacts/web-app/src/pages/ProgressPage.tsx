import { useMemo } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";

interface TestRecord {
  date: number;
  score: number;
  total: number;
  pct: number;
  mode: "full" | "chapter" | "ai";
  chapter: string;
}

const ALL_SUBJECTS = [
  { id: "maths",    label: "Maths",         icon: "📐", accent: "#06b6d4", gradient: "from-cyan-500/20 to-blue-600/20",    border: "border-cyan-400/20"   },
  { id: "english",  label: "English",       icon: "📖", accent: "#8b5cf6", gradient: "from-violet-500/20 to-purple-700/20", border: "border-violet-400/20" },
  { id: "hindi",    label: "Hindi",         icon: "🔤", accent: "#f97316", gradient: "from-orange-500/20 to-red-600/20",   border: "border-orange-400/20" },
  { id: "science",  label: "Science",       icon: "🔬", accent: "#10b981", gradient: "from-emerald-500/20 to-teal-600/20", border: "border-emerald-400/20"},
  { id: "social",   label: "Social Science",icon: "🌍", accent: "#f59e0b", gradient: "from-amber-500/20 to-yellow-600/20", border: "border-amber-400/20"  },
  { id: "sanskrit", label: "Sanskrit",      icon: "📜", accent: "#ec4899", gradient: "from-pink-500/20 to-rose-600/20",   border: "border-pink-400/20"   },
];

function loadHistory(subject: string): TestRecord[] {
  try {
    const raw = localStorage.getItem(`shiken_history_${subject}`);
    if (!raw) return [];
    return JSON.parse(raw) as TestRecord[];
  } catch { return []; }
}

function gradeColor(pct: number) {
  if (pct >= 80) return "#10b981";
  if (pct >= 60) return "#f59e0b";
  return "#ef4444";
}

function gradeLabel(pct: number) {
  if (pct >= 90) return "Excellent";
  if (pct >= 80) return "Great";
  if (pct >= 60) return "Good";
  if (pct >= 40) return "Fair";
  return "Needs Work";
}

// Mini sparkline SVG
function Sparkline({ records, accent }: { records: TestRecord[]; accent: string }) {
  const pts = records.slice(-10);
  if (pts.length < 2) {
    return (
      <div className="flex items-center justify-center h-10 text-white/20 text-xs">
        Not enough data
      </div>
    );
  }
  const W = 120, H = 36, PX = 4, PY = 4;
  const iW = W - PX * 2, iH = H - PY * 2;
  const xs = pts.map((_, i) => PX + (i / (pts.length - 1)) * iW);
  const ys = pts.map((r) => PY + (1 - r.pct / 100) * iH);
  const linePath = pts.reduce((acc, _p, i) => {
    if (i === 0) return `M ${xs[0]},${ys[0]}`;
    const cpX = (xs[i - 1] + xs[i]) / 2;
    return `${acc} C ${cpX},${ys[i - 1]} ${cpX},${ys[i]} ${xs[i]},${ys[i]}`;
  }, "");
  const fillPath = `${linePath} L ${xs[xs.length - 1]},${H} L ${xs[0]},${H} Z`;
  const gradId = `sg-${accent.replace("#", "")}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 36 }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={accent} stopOpacity="0.4" />
          <stop offset="100%" stopColor={accent} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={fillPath} fill={`url(#${gradId})`} />
      <path d={linePath} fill="none" stroke={accent} strokeWidth="1.5" strokeLinecap="round" />
      <circle cx={xs[xs.length - 1]} cy={ys[ys.length - 1]} r="2.5"
        fill={gradeColor(pts[pts.length - 1].pct)} stroke="#07080f" strokeWidth="1" />
    </svg>
  );
}

// Radial progress ring
function RingChart({ pct, accent, size = 72 }: { pct: number; accent: string; size?: number }) {
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="rgba(255,255,255,0.06)" strokeWidth="5" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={accent} strokeWidth="5"
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x={size / 2} y={size / 2 + 1} textAnchor="middle" dominantBaseline="middle"
        fill="white" fontSize="13" fontWeight="700">{pct}%</text>
    </svg>
  );
}

// Overall trend line (all subjects combined, last 30 tests by date)
function OverallTrend({ allRecords }: { allRecords: TestRecord[] }) {
  const pts = allRecords.slice(-20);
  if (pts.length < 2) return null;
  const W = 280, H = 56, PX = 6, PY = 6;
  const iW = W - PX * 2, iH = H - PY * 2;
  const xs = pts.map((_, i) => PX + (i / (pts.length - 1)) * iW);
  const ys = pts.map((r) => PY + (1 - r.pct / 100) * iH);
  const linePath = pts.reduce((acc, _p, i) => {
    if (i === 0) return `M ${xs[0]},${ys[0]}`;
    const cpX = (xs[i - 1] + xs[i]) / 2;
    return `${acc} C ${cpX},${ys[i - 1]} ${cpX},${ys[i]} ${xs[i]},${ys[i]}`;
  }, "");
  const fillPath = `${linePath} L ${xs[xs.length - 1]},${H} L ${xs[0]},${H} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 56 }}>
      <defs>
        <linearGradient id="ot-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.01" />
        </linearGradient>
      </defs>
      {[60, 80].map((p) => {
        const y = PY + (1 - p / 100) * iH;
        return <line key={p} x1={PX} y1={y} x2={W - PX} y2={y}
          stroke="rgba(255,255,255,0.06)" strokeWidth="1" strokeDasharray="3 3" />;
      })}
      <path d={fillPath} fill="url(#ot-grad)" />
      <path d={linePath} fill="none" stroke="#8b5cf6" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={xs[xs.length - 1]} cy={ys[ys.length - 1]} r="4"
        fill={gradeColor(pts[pts.length - 1].pct)} stroke="#07080f" strokeWidth="1.5" />
    </svg>
  );
}

export default function ProgressPage() {
  const [, navigate] = useLocation();

  const subjectData = useMemo(() => {
    return ALL_SUBJECTS.map((s) => {
      const history = loadHistory(s.id);
      const total = history.length;
      const avg = total > 0 ? Math.round(history.reduce((a, r) => a + r.pct, 0) / total) : 0;
      const best = total > 0 ? Math.max(...history.map((r) => r.pct)) : 0;
      const last = history[history.length - 1] ?? null;

      // Chapter breakdown: avg per chapter (from last 30 records)
      const chapterMap = new Map<string, number[]>();
      history.slice(-30).forEach((r) => {
        if (!chapterMap.has(r.chapter)) chapterMap.set(r.chapter, []);
        chapterMap.get(r.chapter)!.push(r.pct);
      });
      const chapters = Array.from(chapterMap.entries()).map(([name, scores]) => ({
        name,
        avg: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
        count: scores.length,
      })).sort((a, b) => a.avg - b.avg);

      return { ...s, history, total, avg, best, last, chapters };
    });
  }, []);

  // Overall stats
  const allRecordsSorted = useMemo(() => {
    return ALL_SUBJECTS.flatMap((s) =>
      loadHistory(s.id).map((r) => ({ ...r, subjectId: s.id }))
    ).sort((a, b) => a.date - b.date);
  }, []);

  const totalTests = allRecordsSorted.length;
  const overallAvg = totalTests > 0
    ? Math.round(allRecordsSorted.reduce((a, r) => a + r.pct, 0) / totalTests) : 0;
  const bestSubject = subjectData.reduce((best, s) =>
    s.total > 0 && s.avg > best.avg ? s : best,
    { avg: -1, label: "—", icon: "" } as typeof subjectData[0] & { avg: number }
  );

  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const testsThisWeek = allRecordsSorted.filter((r) => r.date >= weekAgo).length;

  // All weak chapters across subjects
  const weakChapters = useMemo(() => {
    return subjectData.flatMap((s) =>
      s.chapters.filter((c) => c.avg < 60 && c.count >= 1).map((c) => ({
        ...c,
        subject: s.label,
        icon: s.icon,
        accent: s.accent,
      }))
    ).sort((a, b) => a.avg - b.avg).slice(0, 6);
  }, [subjectData]);

  // Recent 8 tests
  const recentTests = useMemo(() => {
    const labeled = allRecordsSorted.slice(-8).reverse().map((r) => {
      const subj = ALL_SUBJECTS.find((s) => s.id === r.subjectId)!;
      return { ...r, subjectLabel: subj.label, icon: subj.icon, accent: subj.accent };
    });
    return labeled;
  }, [allRecordsSorted]);

  const hasAnyData = totalTests > 0;

  return (
    <div className="min-h-screen w-full relative overflow-hidden" style={{ background: "#07080f" }}>
      {/* Ambient blobs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 -left-32 w-80 h-80 rounded-full blur-3xl opacity-15"
          style={{ background: "radial-gradient(circle, #8b5cf6, transparent)" }} />
        <div className="absolute top-1/2 -right-24 w-64 h-64 rounded-full blur-3xl opacity-10"
          style={{ background: "radial-gradient(circle, #06b6d4, transparent)" }} />
        <div className="absolute -bottom-16 left-1/3 w-64 h-64 rounded-full blur-3xl opacity-10"
          style={{ background: "radial-gradient(circle, #10b981, transparent)" }} />
        <div className="absolute inset-0 opacity-[0.025]"
          style={{ backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)", backgroundSize: "32px 32px" }} />
      </div>

      <div className="relative z-10 max-w-lg mx-auto px-4 py-8 pb-16">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
          className="flex items-center gap-3 mb-7">
          <button onClick={() => navigate("/")}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-white/50 hover:text-white/80">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M11 4L6 9l5 5" stroke="currentColor" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div>
            <h1 className="text-xl font-bold text-white leading-tight">My Progress</h1>
            <p className="text-white/30 text-xs">Performance across all subjects</p>
          </div>
        </motion.div>

        {!hasAnyData ? (
          /* Empty state */
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="flex flex-col items-center justify-center py-24 text-center gap-4">
            <div className="text-6xl">📊</div>
            <h2 className="text-white font-semibold text-lg">No tests yet</h2>
            <p className="text-white/40 text-sm max-w-xs">
              Complete a test in any subject and your progress will appear here.
            </p>
            <button onClick={() => navigate("/")}
              className="mt-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
              style={{ background: "linear-gradient(135deg, #8b5cf6, #06b6d4)" }}>
              Start a Test
            </button>
          </motion.div>
        ) : (
          <>
            {/* ── Overall Stats ─────────────────────────────────────── */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05, duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
              className="rounded-2xl p-5 mb-4 border border-white/8"
              style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.15), rgba(6,182,212,0.08))" }}>
              <p className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-4">
                Overall Performance
              </p>
              <div className="grid grid-cols-3 gap-3 mb-5">
                {[
                  { label: "Tests Done", value: totalTests.toString(), sub: `${testsThisWeek} this week` },
                  { label: "Avg Score", value: `${overallAvg}%`, sub: gradeLabel(overallAvg) },
                  { label: "Best Subject", value: bestSubject.icon, sub: bestSubject.label },
                ].map((stat, i) => (
                  <div key={i} className="bg-white/5 rounded-xl p-3 text-center border border-white/5">
                    <p className="text-white font-bold text-xl leading-tight">{stat.value}</p>
                    <p className="text-white/60 text-xs mt-0.5">{stat.label}</p>
                    <p className="text-white/30 text-[10px] mt-0.5 truncate">{stat.sub}</p>
                  </div>
                ))}
              </div>
              <div>
                <p className="text-white/25 text-[10px] uppercase tracking-widest mb-1.5">
                  Score trend · last {Math.min(allRecordsSorted.length, 20)} tests
                </p>
                <OverallTrend allRecords={allRecordsSorted} />
              </div>
            </motion.div>

            {/* ── Per-Subject Cards ─────────────────────────────────── */}
            <p className="text-white/30 text-xs uppercase tracking-widest font-semibold mb-3 px-1">
              By Subject
            </p>
            <div className="flex flex-col gap-3 mb-4">
              {subjectData.map((s, i) => (
                <motion.div key={s.id}
                  initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.08 + i * 0.06, duration: 0.45, ease: [0.23, 1, 0.32, 1] }}
                  className={`rounded-2xl border ${s.border} p-4 bg-gradient-to-br ${s.gradient}`}
                  style={{ boxShadow: `0 4px 24px ${s.accent}12` }}>
                  {s.total === 0 ? (
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{s.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-semibold text-sm">{s.label}</p>
                        <p className="text-white/30 text-xs">No tests yet</p>
                      </div>
                      <button onClick={() => navigate(`/${s.id}`)}
                        className="text-xs px-3 py-1.5 rounded-lg font-medium text-white/70 hover:text-white bg-white/5 hover:bg-white/10 transition-colors">
                        Start
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start gap-3">
                        <RingChart pct={s.avg} accent={s.accent} size={60} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-xl">{s.icon}</span>
                              <p className="text-white font-bold text-sm">{s.label}</p>
                            </div>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                              style={{ background: `${gradeColor(s.avg)}22`, color: gradeColor(s.avg) }}>
                              {gradeLabel(s.avg)}
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-1.5 mt-2">
                            {[
                              { label: "Tests", val: s.total.toString() },
                              { label: "Best", val: `${s.best}%` },
                              { label: "Last", val: s.last ? `${s.last.pct}%` : "—" },
                            ].map((m) => (
                              <div key={m.label} className="bg-black/20 rounded-lg p-1.5 text-center">
                                <p className="text-white font-semibold text-xs">{m.val}</p>
                                <p className="text-white/35 text-[10px]">{m.label}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                      {s.history.length >= 2 && (
                        <div className="mt-3 pt-3 border-t border-white/5">
                          <p className="text-white/25 text-[10px] uppercase tracking-widest mb-1">
                            Recent trend
                          </p>
                          <Sparkline records={s.history} accent={s.accent} />
                        </div>
                      )}
                    </>
                  )}
                </motion.div>
              ))}
            </div>

            {/* ── Weak Chapters ─────────────────────────────────────── */}
            {weakChapters.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.45 }}>
                <p className="text-white/30 text-xs uppercase tracking-widest font-semibold mb-3 px-1">
                  Focus Areas · Below 60%
                </p>
                <div className="rounded-2xl border border-red-500/15 bg-red-500/5 p-4 mb-4">
                  <div className="flex flex-col gap-2">
                    {weakChapters.map((c, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <span className="text-base shrink-0">{c.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-white/80 text-xs font-medium truncate pr-2">{c.name}</p>
                            <p className="text-xs font-bold shrink-0" style={{ color: gradeColor(c.avg) }}>
                              {c.avg}%
                            </p>
                          </div>
                          <div className="h-1 rounded-full bg-white/8 overflow-hidden">
                            <motion.div className="h-full rounded-full"
                              initial={{ width: 0 }}
                              animate={{ width: `${c.avg}%` }}
                              transition={{ delay: 0.6 + i * 0.05, duration: 0.6, ease: "easeOut" }}
                              style={{ background: gradeColor(c.avg) }} />
                          </div>
                          <p className="text-white/25 text-[10px] mt-0.5">{c.subject} · {c.count} test{c.count > 1 ? "s" : ""}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── Recent Activity ───────────────────────────────────── */}
            {recentTests.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.55, duration: 0.45 }}>
                <p className="text-white/30 text-xs uppercase tracking-widest font-semibold mb-3 px-1">
                  Recent Activity
                </p>
                <div className="rounded-2xl border border-white/8 bg-white/3 overflow-hidden">
                  {recentTests.map((r, i) => {
                    const d = new Date(r.date);
                    const dateStr = d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
                    const timeStr = d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
                    const modeLabel = r.mode === "full" ? "Full Test" : r.mode === "chapter" ? r.chapter : "AI Practice";
                    return (
                      <div key={i}
                        className={`flex items-center gap-3 px-4 py-3 ${i < recentTests.length - 1 ? "border-b border-white/5" : ""}`}>
                        <span className="text-lg shrink-0">{r.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-white/80 text-xs font-medium truncate">{r.subjectLabel}</p>
                          <p className="text-white/30 text-[10px] truncate">{modeLabel}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-bold" style={{ color: gradeColor(r.pct) }}>
                            {r.score}/{r.total}
                          </p>
                          <p className="text-white/25 text-[10px]">{dateStr} {timeStr}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
