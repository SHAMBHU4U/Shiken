import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useParams, useLocation } from "wouter";
import { db } from "@/firebase";
import { ref, get, set } from "firebase/database";
import MathText from "@/components/MathText";

// ─── Types ────────────────────────────────────────────────────────────────────

type ExamType = "jee" | "neet";
type Section = "A" | "B";
type AssemblyStatus = "pending" | "loading" | "done" | "error";

interface MockQuestion {
  id: string;
  subject: string;
  section: Section;
  english: string;
  hindi: string;
  options: string[];
  optionsHindi: string[];
  answerIndex: number;
  correctNumerical: string | null;
}

interface UserAnswer {
  selectedIndex?: number;
  numericalInput?: string;
  visited: boolean;
  flagged: boolean;
}

interface SubjectCfg {
  id: string;
  label: string;
  labelHindi: string;
  emoji: string;
  accent: string;
  sectionA: number;
  sectionB: number;
  attemptLimit: number;
}

// ─── Exam configs ─────────────────────────────────────────────────────────────

const EXAM_CONFIG: Record<ExamType, { examName: string; maxMarks: number; subjects: SubjectCfg[] }> = {
  neet: {
    examName: "NEET",
    maxMarks: 720,
    subjects: [
      { id: "physics",   label: "Physics",   labelHindi: "भौतिकी",       emoji: "⚡", accent: "#3b82f6", sectionA: 50,  sectionB: 0, attemptLimit: 45 },
      { id: "chemistry", label: "Chemistry", labelHindi: "रसायन विज्ञान", emoji: "⚗️", accent: "#10b981", sectionA: 50,  sectionB: 0, attemptLimit: 45 },
      { id: "biology",   label: "Biology",   labelHindi: "जीव विज्ञान",   emoji: "🌿", accent: "#22c55e", sectionA: 100, sectionB: 0, attemptLimit: 90 },
    ],
  },
  jee: {
    examName: "JEE Main",
    maxMarks: 300,
    subjects: [
      { id: "physics",   label: "Physics",   labelHindi: "भौतिकी",        emoji: "⚡", accent: "#3b82f6", sectionA: 20, sectionB: 10, attemptLimit: Infinity },
      { id: "chemistry", label: "Chemistry", labelHindi: "रसायन विज्ञान",  emoji: "⚗️", accent: "#10b981", sectionA: 20, sectionB: 10, attemptLimit: Infinity },
      { id: "maths",     label: "Maths",     labelHindi: "गणित",           emoji: "📐", accent: "#8b5cf6", sectionA: 20, sectionB: 10, attemptLimit: Infinity },
    ],
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

function cachePath(examType: ExamType, subject: string, section: Section) {
  return `mockTestCache/${examType}/${subject}_${section}`;
}

async function loadFromCache(examType: ExamType, subject: string, section: Section): Promise<MockQuestion[]> {
  try {
    const snap = await get(ref(db, cachePath(examType, subject, section) + "/questions"));
    if (!snap.exists()) return [];
    const arr = snap.val() as MockQuestion[];
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

async function saveToCache(examType: ExamType, subject: string, section: Section, incoming: MockQuestion[]) {
  try {
    const path = cachePath(examType, subject, section);
    const snap = await get(ref(db, path + "/questions"));
    const existing: MockQuestion[] = snap.exists() ? (snap.val() as MockQuestion[]) : [];
    const existingKeys = new Set(existing.map((q) => q.english.slice(0, 60).toLowerCase()));
    const newOnes = incoming.filter((q) => !existingKeys.has(q.english.slice(0, 60).toLowerCase()));
    if (newOnes.length === 0) return;
    const merged = [...existing, ...newOnes].slice(-200);
    await set(ref(db, path), { questions: merged, updatedAt: Date.now() });
  } catch { /* non-critical */ }
}

async function generateFromAPI(
  examType: ExamType,
  subject: string,
  section: Section,
  count: number,
): Promise<MockQuestion[]> {
  const res = await fetch("/api/generate-mock-questions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ examType, subject, section, count }),
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  const raw = await res.json() as Record<string, unknown>[];
  return raw.map((q) => ({
    id: makeId(),
    subject,
    section,
    english:          String(q.english          ?? ""),
    hindi:            String(q.hindi            ?? ""),
    options:          Array.isArray(q.options)      ? (q.options      as unknown[]).map(String) : [],
    optionsHindi:     Array.isArray(q.optionsHindi) ? (q.optionsHindi as unknown[]).map(String) : [],
    answerIndex:      typeof q.answerIndex === "number" ? q.answerIndex : -1,
    correctNumerical: q.correctNumerical != null ? String(q.correctNumerical) : null,
  })).filter((q) => q.english.length > 5);
}

function scoreQuestion(q: MockQuestion, answer: UserAnswer | undefined): number {
  if (!answer) return 0;
  if (q.section === "B") {
    // JEE Section B: +4 correct, 0 wrong (no negative per latest NTA guidelines)
    if (!answer.numericalInput?.trim()) return 0;
    const userVal = parseFloat(answer.numericalInput.trim());
    const correctVal = parseFloat(q.correctNumerical ?? "NaN");
    if (isNaN(userVal) || isNaN(correctVal)) return 0;
    return Math.abs(userVal - correctVal) < 0.01 ? 4 : 0;
  } else {
    // MCQ: +4 correct, -1 incorrect
    if (answer.selectedIndex === undefined) return 0;
    return answer.selectedIndex === q.answerIndex ? 4 : -1;
  }
}

function formatTime(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function AssemblingScreen({
  examName,
  subjects,
  progress,
}: {
  examName: string;
  subjects: SubjectCfg[];
  progress: Record<string, { status: AssemblyStatus; loaded: number; total: number }>;
}) {
  const allDone = subjects.every((s) => progress[s.id]?.status === "done" || progress[s.id]?.status === "error");

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 gap-8" style={{ background: "#07080f" }}>
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full blur-3xl opacity-15"
          style={{ background: "radial-gradient(circle, #3b82f6, transparent)" }} />
      </div>

      <div className="relative z-10 w-full max-w-md text-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: allDone ? 0 : Infinity, ease: "linear" }}
          className="w-16 h-16 rounded-2xl mx-auto mb-6 flex items-center justify-center text-3xl"
          style={{ background: "rgba(59,130,246,0.15)", border: "1.5px solid rgba(59,130,246,0.4)" }}
        >
          📋
        </motion.div>

        <h2 className="text-white font-black text-xl mb-1">Assembling Mock Test</h2>
        <p className="text-white/40 text-sm mb-6">
          Assembling Full Length Mock Test based on latest NTA pattern...
        </p>

        <div className="flex flex-col gap-3">
          {subjects.map((sub) => {
            const p = progress[sub.id] ?? { status: "pending", loaded: 0, total: sub.sectionA + sub.sectionB };
            return (
              <div
                key={sub.id}
                className="flex items-center gap-3 px-4 py-3 rounded-2xl"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                <span className="text-xl w-8 text-center">{sub.emoji}</span>
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-white text-sm font-semibold">{sub.label}</span>
                    <span className="text-white/40 text-xs">
                      {p.status === "done" ? `${p.total} questions` :
                       p.status === "loading" ? `${p.loaded}/${p.total}...` :
                       p.status === "error" ? "Error" : "Waiting..."}
                    </span>
                  </div>
                  <div className="w-full h-1 rounded-full" style={{ background: "rgba(255,255,255,0.08)" }}>
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: sub.accent }}
                      animate={{ width: p.status === "done" ? "100%" : p.status === "loading" ? `${Math.max(15, (p.loaded / p.total) * 100)}%` : "0%" }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                </div>
                <span className="text-lg shrink-0">
                  {p.status === "done" ? "✅" :
                   p.status === "loading" ? (
                     <motion.span
                       animate={{ rotate: 360 }}
                       transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                       className="inline-block w-5 h-5 rounded-full border-2 border-transparent"
                       style={{ borderTopColor: sub.accent, borderRightColor: `${sub.accent}50` }}
                     />
                   ) :
                   p.status === "error" ? "⚠️" : "⏳"}
                </span>
              </div>
            );
          })}
        </div>

        <p className="text-white/20 text-xs mt-6">
          Fetching from question bank + generating fresh Shiken Engine questions...
        </p>
      </div>
    </div>
  );
}

function ResultScreen({
  examType,
  subjects,
  allQuestions,
  answers,
  onRetry,
  onHome,
}: {
  examType: ExamType;
  subjects: SubjectCfg[];
  allQuestions: MockQuestion[];
  answers: Record<string, UserAnswer>;
  onRetry: () => void;
  onHome: () => void;
}) {
  const cfg = EXAM_CONFIG[examType];

  const bySubject = Object.fromEntries(
    subjects.map((sub) => {
      const qs = allQuestions.filter((q) => q.subject === sub.id);
      let correct = 0, incorrect = 0, skipped = 0, score = 0;
      const attemptedIdxs: number[] = [];
      qs.forEach((q, i) => {
        const ans = answers[q.id];
        const answered = ans?.selectedIndex !== undefined || (ans?.numericalInput?.trim().length ?? 0) > 0;
        if (answered) {
          attemptedIdxs.push(i);
          const s = scoreQuestion(q, ans);
          score += s;
          if (s > 0) correct++;
          else if (s < 0) incorrect++;
          else {
            // JEE numerical wrong = 0, not incorrect
            if (q.section === "A") incorrect++;
            else skipped++; // treated as skipped for display
          }
        } else {
          skipped++;
        }
      });
      const maxScore = qs.filter((q) => q.section === "B").length * 4 + qs.filter((q) => q.section === "A").length * 4;
      const attempted = qs.length - skipped;
      const accuracy = attempted > 0 ? Math.round((correct / attempted) * 100) : 0;
      const overLimit = sub.attemptLimit !== Infinity && attempted > sub.attemptLimit;
      return [sub.id, { correct, incorrect, skipped, score, maxScore, attempted, accuracy, overLimit, total: qs.length }];
    }),
  );

  const totalScore = Object.values(bySubject).reduce((s, v) => s + v.score, 0);
  const totalCorrect = Object.values(bySubject).reduce((s, v) => s + v.correct, 0);
  const totalAttempted = Object.values(bySubject).reduce((s, v) => s + v.attempted, 0);
  const overallAccuracy = totalAttempted > 0 ? Math.round((totalCorrect / totalAttempted) * 100) : 0;
  const pct = cfg.maxMarks > 0 ? Math.round((totalScore / cfg.maxMarks) * 100) : 0;
  const grade = pct >= 85 ? { label: "Excellent", color: "#10b981" } :
                pct >= 70 ? { label: "Very Good", color: "#3b82f6" } :
                pct >= 55 ? { label: "Good", color: "#f59e0b" } :
                pct >= 40 ? { label: "Average", color: "#f97316" } :
                            { label: "Needs Work", color: "#ef4444" };

  return (
    <div className="min-h-screen w-full overflow-y-auto" style={{ background: "#07080f" }}>
      <div className="max-w-lg mx-auto px-4 pt-8 pb-24">
        <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
          <div className="text-5xl mb-3">
            {pct >= 70 ? "🏆" : pct >= 50 ? "📊" : "📈"}
          </div>
          <h1 className="text-white font-black text-2xl mb-1">{cfg.examName} Mock Test — Result</h1>
          <p className="text-white/40 text-sm">परिणाम • Result</p>
        </motion.div>

        {/* Score ring */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="rounded-3xl p-6 mb-5 text-center"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <div className="text-5xl font-black mb-1" style={{ color: grade.color }}>
            {totalScore}
          </div>
          <div className="text-white/40 text-sm mb-3">out of {cfg.maxMarks}</div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold"
            style={{ background: `${grade.color}22`, color: grade.color, border: `1px solid ${grade.color}40` }}>
            {grade.label} · {pct}%
          </div>
          <div className="grid grid-cols-3 gap-3 mt-4">
            {[
              { label: "Correct", value: totalCorrect, color: "#10b981" },
              { label: "Accuracy", value: `${overallAccuracy}%`, color: "#3b82f6" },
              { label: "Attempted", value: totalAttempted, color: "#f59e0b" },
            ].map((s) => (
              <div key={s.label} className="rounded-xl py-3 px-2"
                style={{ background: `${s.color}12`, border: `1px solid ${s.color}25` }}>
                <div className="text-lg font-black" style={{ color: s.color }}>{s.value}</div>
                <div className="text-white/40 text-[10px] mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Subject breakdown */}
        <h3 className="text-white font-black text-sm mb-3 tracking-wide uppercase">Subject-wise Scorecard</h3>
        <div className="flex flex-col gap-3 mb-6">
          {subjects.map((sub, i) => {
            const s = bySubject[sub.id];
            const subPct = s.maxScore > 0 ? Math.round((s.score / s.maxScore) * 100) : 0;
            return (
              <motion.div
                key={sub.id}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + i * 0.07 }}
                className="rounded-2xl p-4"
                style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${sub.accent}25` }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{sub.emoji}</span>
                    <div>
                      <p className="text-white font-bold text-sm">{sub.label}</p>
                      <p className="text-white/40 text-[10px]">{sub.labelHindi}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-lg" style={{ color: sub.accent }}>{s.score}</p>
                    <p className="text-white/30 text-xs">/{s.maxScore}</p>
                  </div>
                </div>

                <div className="w-full h-1.5 rounded-full mb-3" style={{ background: "rgba(255,255,255,0.06)" }}>
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: sub.accent }}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.max(0, subPct)}%` }}
                    transition={{ delay: 0.4 + i * 0.1, duration: 0.8, ease: [0.23, 1, 0.32, 1] }}
                  />
                </div>

                <div className="grid grid-cols-4 gap-1.5 text-center text-xs">
                  {[
                    { label: "Correct", value: s.correct, color: "#10b981" },
                    { label: "Wrong", value: s.incorrect, color: "#ef4444" },
                    { label: "Skipped", value: s.skipped, color: "#6b7280" },
                    { label: "Accuracy", value: `${s.accuracy}%`, color: sub.accent },
                  ].map((item) => (
                    <div key={item.label} className="py-1.5 rounded-lg"
                      style={{ background: `${item.color}12` }}>
                      <div className="font-black text-sm" style={{ color: item.color }}>{item.value}</div>
                      <div className="text-white/30 text-[9px]">{item.label}</div>
                    </div>
                  ))}
                </div>

                {s.overLimit && (
                  <p className="text-amber-400/80 text-[10px] mt-2 text-center">
                    ⚠️ Exceeded attempt limit ({sub.attemptLimit}). Extra answers may not count in actual exam.
                  </p>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Marking scheme info */}
        <div className="rounded-2xl p-4 mb-6"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <p className="text-white/30 text-xs text-center">
            {examType === "jee"
              ? "Marking: MCQ +4/−1 · Numerical (Sec B) +4/0 · Max: 300 marks"
              : "Marking: +4/−1 · Attempt limit: Phy 45, Chem 45, Bio 90 · Max: 720 marks"}
          </p>
        </div>

        <div className="flex gap-3">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={onHome}
            className="flex-1 py-3.5 rounded-2xl text-sm font-bold text-white/60 border border-white/10"
            style={{ background: "rgba(255,255,255,0.04)" }}
          >
            ← Home
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={onRetry}
            className="flex-1 py-3.5 rounded-2xl text-sm font-bold text-white"
            style={{ background: "linear-gradient(135deg, #3b82f6, #8b5cf6)", boxShadow: "0 4px 20px rgba(59,130,246,0.35)" }}
          >
            Retake Test →
          </motion.button>
        </div>
      </div>
    </div>
  );
}

// ─── Main MockTestPage ────────────────────────────────────────────────────────

export default function MockTestPage() {
  const params = useParams<{ examType: string }>();
  const [, navigate] = useLocation();
  const examType: ExamType = params.examType === "jee" ? "jee" : "neet";
  const cfg = EXAM_CONFIG[examType];

  // Phase
  const [phase, setPhase] = useState<"assembling" | "quiz" | "result">("assembling");

  // Assembly
  const [assemblyProgress, setAssemblyProgress] = useState<
    Record<string, { status: AssemblyStatus; loaded: number; total: number }>
  >({});
  const [allQuestions, setAllQuestions] = useState<MockQuestion[]>([]);

  // Quiz
  const [activeSubject, setActiveSubject] = useState(cfg.subjects[0].id);
  const [currentIdxBySubject, setCurrentIdxBySubject] = useState<Record<string, number>>({});
  const [answers, setAnswers] = useState<Record<string, UserAnswer>>({});
  const [timeLeft, setTimeLeft] = useState(3 * 60 * 60);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [langMode, setLangMode] = useState<"both" | "en" | "hi">("both");
  const assemblyRef = useRef(false);

  // ── Assembly logic ──────────────────────────────────────────────────────────

  const assembleTest = useCallback(async () => {
    if (assemblyRef.current) return;
    assemblyRef.current = true;
    const collected: MockQuestion[] = [];

    for (const sub of cfg.subjects) {
      const total = sub.sectionA + sub.sectionB;
      setAssemblyProgress((p) => ({ ...p, [sub.id]: { status: "loading", loaded: 0, total } }));

      try {
        // ── Section A (MCQ) ──────────────────────────────────────────────────
        let sectionAQuestions: MockQuestion[] = [];
        if (sub.sectionA > 0) {
          const cached = await loadFromCache(examType, sub.id, "A");
          const fromCache = shuffled(cached).slice(0, Math.min(cached.length, Math.floor(sub.sectionA * 0.5)));
          const needGen = sub.sectionA - fromCache.length;

          setAssemblyProgress((p) => ({ ...p, [sub.id]: { status: "loading", loaded: fromCache.length, total } }));

          let generated: MockQuestion[] = [];
          if (needGen > 0) {
            generated = await generateFromAPI(examType, sub.id, "A", needGen);
            if (generated.length > 0) {
              await saveToCache(examType, sub.id, "A", generated);
            }
          }

          sectionAQuestions = shuffled([...fromCache, ...generated])
            .slice(0, sub.sectionA)
            .map((q) => ({ ...q, id: makeId(), subject: sub.id, section: "A" as Section }));
        }

        // ── Section B (Numerical — JEE only) ─────────────────────────────────
        let sectionBQuestions: MockQuestion[] = [];
        if (sub.sectionB > 0) {
          const cached = await loadFromCache(examType, sub.id, "B");
          const fromCache = shuffled(cached).slice(0, Math.min(cached.length, Math.floor(sub.sectionB * 0.5)));
          const needGen = sub.sectionB - fromCache.length;

          let generated: MockQuestion[] = [];
          if (needGen > 0) {
            generated = await generateFromAPI(examType, sub.id, "B", needGen);
            if (generated.length > 0) {
              await saveToCache(examType, sub.id, "B", generated);
            }
          }

          sectionBQuestions = shuffled([...fromCache, ...generated])
            .slice(0, sub.sectionB)
            .map((q) => ({ ...q, id: makeId(), subject: sub.id, section: "B" as Section }));
        }

        const subjectQuestions = [...sectionAQuestions, ...sectionBQuestions];
        collected.push(...subjectQuestions);
        setAssemblyProgress((p) => ({ ...p, [sub.id]: { status: "done", loaded: subjectQuestions.length, total } }));
      } catch (err) {
        console.error(`Assembly failed for ${sub.id}:`, err);
        setAssemblyProgress((p) => ({ ...p, [sub.id]: { status: "error", loaded: 0, total } }));
      }
    }

    setAllQuestions(collected);

    // Auto-start quiz after a short pause
    setTimeout(() => setPhase("quiz"), 800);
  }, [examType]);

  useEffect(() => { assembleTest(); }, [assembleTest]);

  // ── Timer ───────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (phase !== "quiz") return;
    const interval = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 0) { setPhase("result"); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [phase]);

  // ── Derived state ───────────────────────────────────────────────────────────

  const questionsBySubject = Object.fromEntries(
    cfg.subjects.map((s) => [s.id, allQuestions.filter((q) => q.subject === s.id)]),
  );

  const activeSubjectCfg = cfg.subjects.find((s) => s.id === activeSubject)!;
  const activeQuestions = questionsBySubject[activeSubject] ?? [];
  const currentIdx = currentIdxBySubject[activeSubject] ?? 0;
  const currentQ = activeQuestions[currentIdx];

  function setCurrentIdx(subjectId: string, idx: number) {
    setCurrentIdxBySubject((prev) => ({ ...prev, [subjectId]: idx }));
  }

  function answerMCQ(questionId: string, index: number) {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { ...prev[questionId], selectedIndex: prev[questionId]?.selectedIndex === index ? undefined : index, visited: true, flagged: prev[questionId]?.flagged ?? false },
    }));
  }

  function answerNumerical(questionId: string, value: string) {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { ...prev[questionId], numericalInput: value, visited: true, flagged: prev[questionId]?.flagged ?? false },
    }));
  }

  function toggleFlag(questionId: string) {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { ...prev[questionId], flagged: !(prev[questionId]?.flagged), visited: true },
    }));
  }

  function markVisited(questionId: string) {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { ...prev[questionId], visited: true, flagged: prev[questionId]?.flagged ?? false },
    }));
  }

  function getAnswerStatus(q: MockQuestion): "answered" | "flagged" | "visited" | "not-visited" {
    const a = answers[q.id];
    if (!a) return "not-visited";
    const answered = a.selectedIndex !== undefined || (a.numericalInput?.trim().length ?? 0) > 0;
    if (answered && a.flagged) return "flagged";
    if (answered) return "answered";
    if (a.flagged) return "flagged";
    return "visited";
  }

  function getAttemptedCount(subjectId: string): number {
    const qs = questionsBySubject[subjectId] ?? [];
    return qs.filter((q) => {
      const a = answers[q.id];
      return a?.selectedIndex !== undefined || (a?.numericalInput?.trim().length ?? 0) > 0;
    }).length;
  }

  // ── Rendering ───────────────────────────────────────────────────────────────

  if (phase === "assembling") {
    return (
      <AssemblingScreen
        examName={cfg.examName}
        subjects={cfg.subjects}
        progress={assemblyProgress}
      />
    );
  }

  if (phase === "result") {
    return (
      <ResultScreen
        examType={examType}
        subjects={cfg.subjects}
        allQuestions={allQuestions}
        answers={answers}
        onRetry={() => {
          assemblyRef.current = false;
          setPhase("assembling");
          setAllQuestions([]);
          setAnswers({});
          setCurrentIdxBySubject({});
          setTimeLeft(3 * 60 * 60);
          setAssemblyProgress({});
          assembleTest();
        }}
        onHome={() => navigate("/")}
      />
    );
  }

  // ── Quiz Screen ─────────────────────────────────────────────────────────────

  const timerColor = timeLeft <= 600 ? "#ef4444" : timeLeft <= 1800 ? "#f59e0b" : "#10b981";
  const attemptedCount = getAttemptedCount(activeSubject);
  const overLimit = activeSubjectCfg.attemptLimit !== Infinity && attemptedCount > activeSubjectCfg.attemptLimit;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#07080f" }}>

      {/* ── Top bar ── */}
      <div className="sticky top-0 z-40 flex flex-col"
        style={{ background: "rgba(7,8,15,0.95)", backdropFilter: "blur(16px)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>

        {/* Timer row */}
        <div className="flex items-center justify-between px-4 py-2">
          <button onClick={() => navigate("/")} className="text-white/30 hover:text-white/60 text-xs transition-colors">
            ✕ Exit
          </button>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
            style={{ background: `${timerColor}18`, border: `1px solid ${timerColor}40` }}>
            <span className="text-[11px] font-bold" style={{ color: timerColor }}>⏱ {formatTime(timeLeft)}</span>
          </div>
          <button
            onClick={() => setPhase("result")}
            className="text-xs font-bold px-3 py-1.5 rounded-xl text-white"
            style={{ background: "linear-gradient(135deg, #3b82f6, #8b5cf6)", boxShadow: "0 2px 10px rgba(59,130,246,0.35)" }}
          >
            Submit →
          </button>
        </div>

        {/* Exam info row */}
        <div className="flex items-center justify-between px-4 pb-2">
          <span className="text-white/40 text-[11px]">{cfg.examName} · {allQuestions.length} Questions</span>
          <button onClick={() => setLangMode((m) => m === "both" ? "en" : m === "en" ? "hi" : "both")}
            className="text-white/30 hover:text-white/60 text-[11px] transition-colors px-2 py-0.5 rounded-lg border border-white/10">
            {langMode === "both" ? "A/अ" : langMode === "en" ? "A" : "अ"}
          </button>
        </div>

        {/* Subject tabs */}
        <div className="flex border-t border-white/5">
          {cfg.subjects.map((sub) => {
            const isActive = sub.id === activeSubject;
            const subAttempted = getAttemptedCount(sub.id);
            const subTotal = (questionsBySubject[sub.id] ?? []).length;
            return (
              <button
                key={sub.id}
                onClick={() => setActiveSubject(sub.id)}
                className="flex-1 flex flex-col items-center py-2 transition-all text-xs font-semibold relative"
                style={{ color: isActive ? sub.accent : "rgba(255,255,255,0.30)", borderBottom: `2px solid ${isActive ? sub.accent : "transparent"}` }}
              >
                <span>{sub.emoji} {sub.label}</span>
                <span className="text-[9px] mt-0.5 opacity-70">{subAttempted}/{subTotal}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Attempt warning ── */}
      <AnimatePresence>
        {overLimit && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 text-center"
          >
            <p className="text-amber-400 text-xs font-semibold">
              ⚠️ Attempt limit reached ({activeSubjectCfg.attemptLimit} for {activeSubjectCfg.label}) — extra answers won't count in actual {cfg.examName}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Question area ── */}
      <div className="flex-1 overflow-y-auto">
        {activeQuestions.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-white/20 text-sm">No questions loaded for this subject</div>
        ) : currentQ ? (
          <div className="max-w-lg mx-auto px-4 py-6">

            {/* Question meta */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-white/40 text-xs font-mono">Q {currentIdx + 1}/{activeQuestions.length}</span>
                {currentQ.section === "B" && (
                  <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold text-orange-300 bg-orange-500/15 border border-orange-500/25">
                    Section B · Numerical
                  </span>
                )}
              </div>
              <button
                onClick={() => { toggleFlag(currentQ.id); }}
                className="text-lg transition-all"
                style={{ opacity: answers[currentQ.id]?.flagged ? 1 : 0.3 }}
                title="Flag for review"
              >
                🚩
              </button>
            </div>

            {/* Question text */}
            <div className="mb-6 p-4 rounded-2xl"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              {(langMode === "both" || langMode === "en") && (
                <MathText text={currentQ.english} className="text-white text-base leading-relaxed font-medium block" />
              )}
              {(langMode === "both" || langMode === "hi") && currentQ.hindi && (
                <MathText text={currentQ.hindi} className="text-white/55 text-sm leading-relaxed mt-2 block" />
              )}
            </div>

            {/* MCQ options */}
            {currentQ.section === "A" && currentQ.options.length >= 2 && (
              <div className="flex flex-col gap-2.5">
                {currentQ.options.map((opt, idx) => {
                  const selected = answers[currentQ.id]?.selectedIndex === idx;
                  const label = String.fromCharCode(65 + idx);
                  const optHindi = currentQ.optionsHindi[idx];
                  return (
                    <motion.button
                      key={idx}
                      whileTap={{ scale: 0.985 }}
                      onClick={() => { answerMCQ(currentQ.id, idx); markVisited(currentQ.id); }}
                      className="w-full text-left p-4 rounded-2xl transition-all"
                      style={{
                        background: selected ? `${activeSubjectCfg.accent}20` : "rgba(255,255,255,0.04)",
                        border: `1.5px solid ${selected ? activeSubjectCfg.accent : "rgba(255,255,255,0.08)"}`,
                        boxShadow: selected ? `0 0 16px ${activeSubjectCfg.accent}30` : "none",
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <span className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black shrink-0"
                          style={{
                            background: selected ? activeSubjectCfg.accent : "rgba(255,255,255,0.08)",
                            color: selected ? "#fff" : "rgba(255,255,255,0.5)",
                          }}>
                          {label}
                        </span>
                        <div className="flex-1 min-w-0">
                          {(langMode === "both" || langMode === "en") && (
                            <MathText text={opt} className="text-white text-sm leading-snug block" />
                          )}
                          {(langMode === "both" || langMode === "hi") && optHindi && (
                            <MathText text={optHindi} className="text-white/45 text-xs leading-snug mt-0.5 block" />
                          )}
                        </div>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            )}

            {/* Numerical input (JEE Section B) */}
            {currentQ.section === "B" && (
              <div className="flex flex-col gap-3">
                <div className="p-4 rounded-2xl"
                  style={{ background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.25)" }}>
                  <p className="text-orange-300/80 text-xs mb-3">
                    Type your numerical answer. No negative marking for Section B (+4 if correct, 0 if wrong).
                  </p>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      step="any"
                      value={answers[currentQ.id]?.numericalInput ?? ""}
                      onChange={(e) => { answerNumerical(currentQ.id, e.target.value); markVisited(currentQ.id); }}
                      placeholder="Enter numerical answer..."
                      className="flex-1 px-4 py-3 rounded-xl text-white text-lg font-bold placeholder-white/20 outline-none"
                      style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)" }}
                    />
                    {answers[currentQ.id]?.numericalInput && (
                      <button
                        onClick={() => answerNumerical(currentQ.id, "")}
                        className="text-white/30 hover:text-white/60 text-sm transition-colors px-2"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between mt-8">
              <motion.button
                whileTap={{ scale: 0.95 }}
                disabled={currentIdx === 0}
                onClick={() => setCurrentIdx(activeSubject, currentIdx - 1)}
                className="px-5 py-3 rounded-xl text-sm font-bold text-white/60 border border-white/10 transition-all disabled:opacity-30"
                style={{ background: "rgba(255,255,255,0.04)" }}
              >
                ← Prev
              </motion.button>

              <button
                onClick={() => setPaletteOpen(true)}
                className="px-4 py-3 rounded-xl text-xs font-semibold text-white/50 border border-white/08 transition-all"
                style={{ background: "rgba(255,255,255,0.03)" }}
              >
                📊 Palette
              </button>

              <motion.button
                whileTap={{ scale: 0.95 }}
                disabled={currentIdx >= activeQuestions.length - 1}
                onClick={() => setCurrentIdx(activeSubject, currentIdx + 1)}
                className="px-5 py-3 rounded-xl text-sm font-bold text-white border border-transparent transition-all disabled:opacity-30"
                style={{ background: `linear-gradient(135deg, ${activeSubjectCfg.accent}, ${activeSubjectCfg.accent}cc)`, boxShadow: `0 2px 12px ${activeSubjectCfg.accent}40` }}
              >
                Next →
              </motion.button>
            </div>

            {/* Section label for JEE */}
            {examType === "jee" && (
              <div className="mt-6 flex gap-2 justify-center text-[10px] text-white/25">
                <span>Sec A: {activeSubjectCfg.sectionA} MCQ (+4/−1)</span>
                <span>·</span>
                <span>Sec B: {activeSubjectCfg.sectionB} Numerical (+4/0)</span>
              </div>
            )}
            {examType === "neet" && (
              <div className="mt-6 text-center text-[10px] text-white/25">
                Attempt limit: {activeSubjectCfg.attemptLimit} out of {activeSubjectCfg.sectionA} · Attempted: {attemptedCount}
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* ── Question Palette ── */}
      <AnimatePresence>
        {paletteOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end"
            style={{ background: "rgba(0,0,0,0.6)" }}
            onClick={() => setPaletteOpen(false)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 420, damping: 38 }}
              className="w-full max-h-[80vh] overflow-y-auto rounded-t-3xl p-5"
              style={{ background: "#0f1020", border: "1px solid rgba(255,255,255,0.08)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-black text-base">Question Palette</h3>
                <button onClick={() => setPaletteOpen(false)} className="text-white/40 hover:text-white/70 text-lg">✕</button>
              </div>

              {/* Legend */}
              <div className="flex flex-wrap gap-2 mb-4 text-[10px]">
                {[
                  { status: "answered", label: "Answered", color: "#10b981" },
                  { status: "flagged", label: "Flagged", color: "#f59e0b" },
                  { status: "visited", label: "Visited", color: "#6b7280" },
                  { status: "not-visited", label: "Not visited", color: "#374151" },
                ].map((l) => (
                  <div key={l.status} className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-sm" style={{ background: l.color }} />
                    <span className="text-white/40">{l.label}</span>
                  </div>
                ))}
              </div>

              {/* Per-subject grids */}
              {cfg.subjects.map((sub) => {
                const qs = questionsBySubject[sub.id] ?? [];
                if (qs.length === 0) return null;
                return (
                  <div key={sub.id} className="mb-4">
                    <p className="text-white/40 text-xs font-semibold mb-2 uppercase tracking-wider">{sub.emoji} {sub.label}</p>
                    <div className="grid grid-cols-8 gap-1.5">
                      {qs.map((q, idx) => {
                        const st = getAnswerStatus(q);
                        const statusColor =
                          st === "answered" ? "#10b981" :
                          st === "flagged"  ? "#f59e0b" :
                          st === "visited"  ? "#4b5563" : "#1f2937";
                        const isCurrentQ = sub.id === activeSubject && idx === currentIdx;
                        return (
                          <button
                            key={q.id}
                            onClick={() => {
                              setActiveSubject(sub.id);
                              setCurrentIdx(sub.id, idx);
                              setPaletteOpen(false);
                            }}
                            className="w-full aspect-square rounded-lg text-xs font-bold transition-all flex items-center justify-center"
                            style={{
                              background: statusColor,
                              color: st === "not-visited" ? "rgba(255,255,255,0.2)" : "white",
                              border: isCurrentQ ? `2px solid ${sub.accent}` : "2px solid transparent",
                              boxShadow: isCurrentQ ? `0 0 8px ${sub.accent}60` : "none",
                            }}
                          >
                            {idx + 1}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
