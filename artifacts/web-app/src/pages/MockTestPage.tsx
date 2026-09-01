import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useParams, useLocation } from "wouter";
import { db, auth } from "@/firebase";
import { ref, get, set, push } from "firebase/database";
import MathText from "@/components/MathText";
import { useSubscription } from "@/hooks/useSubscription";

// ─── Types ────────────────────────────────────────────────────────────────────

type ExamType = "jee" | "neet";
type Section = "A" | "B";
type SubjectLoadState = "pending" | "loading" | "done" | "error";

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
    if (!answer.numericalInput?.trim()) return 0;
    const userVal = parseFloat(answer.numericalInput.trim());
    const correctVal = parseFloat(q.correctNumerical ?? "NaN");
    if (isNaN(userVal) || isNaN(correctVal)) return 0;
    return Math.abs(userVal - correctVal) < 0.01 ? 4 : 0;
  } else {
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

function getDeviceId(): string {
  const KEY = "shiken_device_id";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = "u_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
    localStorage.setItem(KEY, id);
  }
  return id;
}

function saveMockScore(
  examType: ExamType,
  allQuestions: MockQuestion[],
  answers: Record<string, UserAnswer>,
  maxMarks: number
) {
  try {
    const uid = auth.currentUser?.uid;
    const deviceId = uid ?? getDeviceId();
    const safeId = deviceId.replace(/[.#$/[\]]/g, "_");

    let totalScore = 0;
    for (const sub of EXAM_CONFIG[examType].subjects) {
      const qs = allQuestions.filter((q) => q.subject === sub.id);
      for (const q of qs) {
        totalScore += scoreQuestion(q, answers[q.id]);
      }
    }
    const pct = maxMarks > 0 ? Math.round((totalScore / maxMarks) * 100) : 0;

    push(ref(db, `userActivity/${safeId}/mockScores`), {
      examType,
      score: totalScore,
      maxMarks,
      pct,
      timestamp: Date.now(),
    }).catch(() => { /* offline */ });

    const username =
      localStorage.getItem("shiken_username") ||
      auth.currentUser?.displayName ||
      "";
    const metaPayload: Record<string, unknown> = {
      lastActive: Date.now(),
      deviceId,
    };
    if (username) metaPayload.username = username;
    set(ref(db, `userActivity/${safeId}/meta`), metaPayload).catch(
      () => { /* offline */ }
    );
  } catch { /* never block result screen */ }
}

// ─── Mock Progress Persistence ────────────────────────────────────────────────

interface SavedProgress {
  examType: ExamType;
  isDemo: boolean;
  subjectStatus: Record<string, SubjectLoadState>;
  questionsBySubject: Record<string, MockQuestion[]>;
  currentIdxBySubject: Record<string, number>;
  answers: Record<string, UserAnswer>;
  timeLeft: number;
  activeSubject: string;
  savedAt: number;
}

function progressKey(examType: ExamType, isDemo: boolean) {
  return `shiken_mock_progress_${examType}${isDemo ? "_demo" : ""}`;
}

function saveMockProgress(data: SavedProgress) {
  try {
    localStorage.setItem(progressKey(data.examType, data.isDemo), JSON.stringify(data));
  } catch { /* quota exceeded */ }
}

function loadMockProgress(examType: ExamType, isDemo: boolean): SavedProgress | null {
  try {
    const raw = localStorage.getItem(progressKey(examType, isDemo));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedProgress;
    if (parsed.examType !== examType || parsed.isDemo !== isDemo) return null;
    // Discard if older than 24h
    if (Date.now() - (parsed.savedAt ?? 0) > 24 * 60 * 60 * 1000) {
      clearMockProgress(examType, isDemo);
      return null;
    }
    return parsed;
  } catch { return null; }
}

function clearMockProgress(examType: ExamType, isDemo: boolean) {
  try { localStorage.removeItem(progressKey(examType, isDemo)); } catch { /* */ }
}

// ─── Subject Skeleton Loader ──────────────────────────────────────────────────

function SubjectSkeletonLoader({ label, accent }: { label: string; accent: string }) {
  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <style>{`
        @keyframes sk-shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
        .sk-pulse {
          position: relative;
          overflow: hidden;
        }
        .sk-pulse::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.07) 50%, transparent 100%);
          animation: sk-shimmer 1.6s ease-in-out infinite;
        }
      `}</style>

      {/* Q number + flag skeleton */}
      <div className="flex items-center justify-between mb-4">
        <div className="sk-pulse h-3 w-20 rounded-full" style={{ background: "var(--app-surface-2)" }} />
        <div className="sk-pulse h-5 w-5 rounded-lg" style={{ background: "var(--app-surface)" }} />
      </div>

      {/* Question text box skeleton */}
      <div className="mb-6 p-4 rounded-2xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="flex flex-col gap-2.5">
          <div className="sk-pulse h-3 w-full rounded-full" style={{ background: "var(--app-surface-2)" }} />
          <div className="sk-pulse h-3 w-5/6 rounded-full" style={{ background: "rgba(255,255,255,0.07)" }} />
          <div className="sk-pulse h-3 w-3/4 rounded-full" style={{ background: "var(--app-surface)" }} />
          <div className="sk-pulse h-3 w-2/3 rounded-full mt-1" style={{ background: "var(--app-surface)" }} />
        </div>
      </div>

      {/* Option skeletons */}
      <div className="flex flex-col gap-2.5">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="p-4 rounded-2xl"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", opacity: 1 - i * 0.12 }}
          >
            <div className="flex items-center gap-3">
              <div className="sk-pulse w-7 h-7 rounded-lg shrink-0" style={{ background: "var(--app-surface-2)" }} />
              <div className="sk-pulse h-3 rounded-full flex-1" style={{ background: "rgba(255,255,255,0.07)", width: `${72 - i * 8}%` }} />
            </div>
          </div>
        ))}
      </div>

      {/* Loading label */}
      <div className="mt-8 flex flex-col items-center gap-3">
        <div className="flex items-center gap-2">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-4 h-4 rounded-full border-2 border-transparent"
            style={{ borderTopColor: accent, borderRightColor: `${accent}55` }}
          />
          <p className="text-white/30 text-xs font-medium">Assembling {label} questions in background…</p>
        </div>
        <p className="text-white/15 text-[11px]">Timer is running — you can answer other subjects</p>
      </div>
    </div>
  );
}

// ─── Result Screen ────────────────────────────────────────────────────────────

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

  useEffect(() => {
    saveMockScore(examType, allQuestions, answers, cfg.maxMarks);
  }, []);

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
            if (q.section === "A") incorrect++;
            else skipped++;
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
    <div className="min-h-screen w-full overflow-y-auto" style={{ background: "var(--app-bg)" }}>
      <div className="max-w-lg mx-auto px-4 pt-8 pb-24">
        <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
          <div className="text-5xl mb-3">
            {pct >= 70 ? "🏆" : pct >= 50 ? "📊" : "📈"}
          </div>
          <h1 className="text-white font-black text-2xl mb-1">{cfg.examName} Mock Test — Result</h1>
          <p className="text-white/40 text-sm">परिणाम • Result</p>
        </motion.div>

        {/* Score */}
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

                <div className="w-full h-1.5 rounded-full mb-3" style={{ background: "var(--app-surface)" }}>
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

// ─── Demo Upgrade Screen ──────────────────────────────────────────────────────

function DemoUpgradeScreen({
  examType,
  subjects,
  allQuestions,
  answers,
  onHome,
}: {
  examType: ExamType;
  subjects: SubjectCfg[];
  allQuestions: MockQuestion[];
  answers: Record<string, UserAnswer>;
  onHome: () => void;
}) {
  const [, navigate] = useLocation();
  const isJee = examType === "jee";
  const accent = isJee ? "#3b82f6" : "#10b981";
  const accent2 = isJee ? "#8b5cf6" : "#06b6d4";

  useEffect(() => {
    const cfg = EXAM_CONFIG[examType];
    saveMockScore(examType, allQuestions, answers, cfg.maxMarks);
  }, []);

  const totalCorrect = allQuestions.filter((q) => {
    const a = answers[q.id];
    if (q.section === "B") {
      if (!a?.numericalInput?.trim()) return false;
      return Math.abs(parseFloat(a.numericalInput) - parseFloat(q.correctNumerical ?? "NaN")) < 0.01;
    }
    return a?.selectedIndex === q.answerIndex;
  }).length;

  const pct = allQuestions.length > 0 ? Math.round((totalCorrect / allQuestions.length) * 100) : 0;

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center px-4 py-12" style={{ background: "var(--app-bg)" }}>
      <style>{`
        @keyframes pulse-glow-upgrade {
          0%, 100% { box-shadow: 0 0 30px ${accent}44, 0 8px 40px rgba(0,0,0,0.6); }
          50% { box-shadow: 0 0 60px ${accent}88, 0 8px 40px rgba(0,0,0,0.6); }
        }
      `}</style>
      <div className="w-full max-w-md">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-6">
          <div className="text-5xl mb-3">🎯</div>
          <h1 className="text-white font-black text-2xl mb-1">Demo Complete!</h1>
          <p className="text-white/40 text-sm">आपने {allQuestions.length} प्रश्न पूरे किए • Demo Finished</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl p-5 mb-4"
          style={{
            background: `linear-gradient(135deg, ${accent}18, ${accent2}12)`,
            border: `1.5px solid ${accent}40`,
            animation: "pulse-glow-upgrade 2.5s ease-in-out infinite",
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-white/60 text-sm">Your Demo Score</span>
            <span className="text-3xl font-black" style={{ color: accent }}>{totalCorrect}/{allQuestions.length}</span>
          </div>
          <div className="w-full h-2 rounded-full" style={{ background: "var(--app-surface-2)" }}>
            <motion.div
              className="h-full rounded-full"
              style={{ background: `linear-gradient(90deg, ${accent}, ${accent2})` }}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ delay: 0.3, duration: 0.8 }}
            />
          </div>
          <div className="flex justify-between mt-1.5 text-xs text-white/40">
            <span>Correct: {totalCorrect}</span>
            <span>{pct}% accuracy</span>
            <span>Wrong: {allQuestions.length - totalCorrect}</span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex flex-col gap-2 mb-6"
        >
          {subjects.map((sub) => {
            const qs = allQuestions.filter((q) => q.subject === sub.id);
            const correct = qs.filter((q) => answers[q.id]?.selectedIndex === q.answerIndex).length;
            return (
              <div
                key={sub.id}
                className="flex items-center justify-between px-4 py-2.5 rounded-xl"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
              >
                <span className="text-white/70 text-sm">{sub.emoji} {sub.label}</span>
                <span className="font-black text-sm" style={{ color: sub.accent }}>{correct}/{qs.length}</span>
              </div>
            );
          })}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="rounded-2xl p-5 mb-4"
          style={{
            background: "linear-gradient(135deg, rgba(251,191,36,0.12), rgba(251,191,36,0.06))",
            border: "1.5px solid rgba(251,191,36,0.35)",
          }}
        >
          <div className="flex items-start gap-3 mb-4">
            <span className="text-2xl">👑</span>
            <div>
              <p className="text-white font-black text-base leading-tight mb-1">Unlock Full Mock Test</p>
              <p className="text-white/50 text-xs leading-relaxed">
                {isJee
                  ? "90 questions · PCM · 3 hours · Real JEE pattern with Section A + Section B"
                  : "200 questions · PCB · 3 hours · Real NEET pattern with Physics, Chemistry & Biology"}
              </p>
            </div>
          </div>
          <ul className="flex flex-col gap-1.5 mb-4">
            {[
              "Full 90/200 question mock test",
              "Chapter-wise & subject-wise tests",
              "AI-generated practice questions",
              "Detailed performance analysis",
              "Unlimited attempts",
            ].map((item) => (
              <li key={item} className="flex items-center gap-2 text-xs text-white/65">
                <span style={{ color: "#fbbf24" }}>✓</span> {item}
              </li>
            ))}
          </ul>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate("/pricing")}
            className="w-full py-3.5 rounded-xl font-black text-sm text-black"
            style={{
              background: "linear-gradient(135deg, #fbbf24, #f59e0b)",
              boxShadow: "0 4px 20px rgba(251,191,36,0.5)",
            }}
            animate={{
              boxShadow: [
                "0 4px 20px rgba(251,191,36,0.5)",
                "0 4px 32px rgba(251,191,36,0.85)",
                "0 4px 20px rgba(251,191,36,0.5)",
              ],
            }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            👑 Subscribe to Premium — Unlock Full Mock
          </motion.button>
        </motion.div>

        <div className="flex gap-3">
          <button
            onClick={onHome}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold border text-white/50 transition-colors"
            style={{ background: "rgba(255,255,255,0.04)", borderColor: "var(--app-border)" }}
          >
            ← Back to Home
          </button>
          <button
            onClick={() => navigate(`/mock-test/${examType}?demo=true`)}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all"
            style={{
              background: `${accent}18`,
              borderColor: `${accent}40`,
              color: accent,
            }}
          >
            Retry Demo
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main MockTestPage ────────────────────────────────────────────────────────

const DEMO_QUESTIONS_PER_SUBJECT = 5;

export default function MockTestPage() {
  const params = useParams<{ examType: string }>();
  const [, navigate] = useLocation();
  const examType: ExamType = params.examType === "jee" ? "jee" : "neet";
  const cfg = EXAM_CONFIG[examType];
  const { isPremium } = useSubscription();

  const isDemo = new URLSearchParams(window.location.search).get("demo") === "true" && !isPremium;
  const demoTimeSec = cfg.subjects.length * DEMO_QUESTIONS_PER_SUBJECT * 60;

  // ── Try restore saved progress ──────────────────────────────────────────────
  const saved = useRef(loadMockProgress(examType, isDemo));
  const hasSave = !!saved.current;

  // ── Core state ───────────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<"quiz" | "result">("quiz");
  const [loadKey, setLoadKey] = useState(0);
  const [showResumeBanner, setShowResumeBanner] = useState(hasSave);

  // Per-subject lazy loading — questions arrive independently
  const [subjectStatus, setSubjectStatus] = useState<Record<string, SubjectLoadState>>(() =>
    hasSave
      ? saved.current!.subjectStatus
      : Object.fromEntries(cfg.subjects.map((s) => [s.id, "pending"]))
  );
  const [questionsBySubject, setQuestionsBySubject] = useState<Record<string, MockQuestion[]>>(
    () => (hasSave ? saved.current!.questionsBySubject : {})
  );

  // Quiz UI state
  const [activeSubject, setActiveSubject] = useState(() =>
    hasSave ? saved.current!.activeSubject : cfg.subjects[0].id
  );
  const [currentIdxBySubject, setCurrentIdxBySubject] = useState<Record<string, number>>(
    () => (hasSave ? saved.current!.currentIdxBySubject : {})
  );
  const [answers, setAnswers] = useState<Record<string, UserAnswer>>(
    () => (hasSave ? saved.current!.answers : {})
  );
  const [timeLeft, setTimeLeft] = useState(
    hasSave ? saved.current!.timeLeft : (isDemo ? demoTimeSec : 3 * 60 * 60)
  );
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [langMode, setLangMode] = useState<"both" | "en" | "hi">("both");

  // Stable ref to the per-subject loader (reassigned each loadKey cycle)
  const loaderRef = useRef<((sub: SubjectCfg) => Promise<void>) | null>(null);

  // ── Lazy subject loader ───────────────────────────────────────────────────────

  useEffect(() => {
    // Reset per-subject state for this load cycle
    setSubjectStatus(Object.fromEntries(cfg.subjects.map((s) => [s.id, "pending"])));
    setQuestionsBySubject({});

    let cancelled = false;

    async function loadSubject(sub: SubjectCfg) {
      if (cancelled) return;
      setSubjectStatus((prev) => ({ ...prev, [sub.id]: "loading" }));

      try {
        let qs: MockQuestion[] = [];

        if (isDemo) {
          // ── Demo mode: 5 MCQ from cache or API ──────────────────────────────
          const cached = await loadFromCache(examType, sub.id, "A");
          const fromCache = shuffled(cached).slice(0, DEMO_QUESTIONS_PER_SUBJECT);
          let generated: MockQuestion[] = [];
          if (fromCache.length < DEMO_QUESTIONS_PER_SUBJECT) {
            try {
              generated = await generateFromAPI(examType, sub.id, "A", DEMO_QUESTIONS_PER_SUBJECT - fromCache.length);
              if (generated.length > 0) saveToCache(examType, sub.id, "A", generated);
            } catch { /* use cache fallback silently */ }
          }
          qs = shuffled([...fromCache, ...generated])
            .slice(0, DEMO_QUESTIONS_PER_SUBJECT)
            .map((q) => ({ ...q, id: makeId(), subject: sub.id, section: "A" as Section }));

        } else {
          // ── Full mode: Section A ─────────────────────────────────────────────
          let secA: MockQuestion[] = [];
          if (sub.sectionA > 0) {
            const cached = await loadFromCache(examType, sub.id, "A");
            // Reuse the Firebase question bank first. Once the bank has enough
            // questions, this avoids paying Gemini to recreate equivalent items.
            const fromCache = shuffled(cached).slice(0, sub.sectionA);
            let generated: MockQuestion[] = [];
            try {
              const needGen = sub.sectionA - fromCache.length;
              if (needGen > 0) {
                generated = await generateFromAPI(examType, sub.id, "A", needGen);
                if (generated.length > 0) saveToCache(examType, sub.id, "A", generated);
              }
            } catch {
              // API failed — fall back to all available cache instead
              const fullCache = shuffled(cached);
              generated = fullCache.slice(fromCache.length, sub.sectionA);
            }
            secA = shuffled([...fromCache, ...generated])
              .slice(0, sub.sectionA)
              .map((q) => ({ ...q, id: makeId(), subject: sub.id, section: "A" as Section }));
          }

          // ── Full mode: Section B ─────────────────────────────────────────────
          let secB: MockQuestion[] = [];
          if (sub.sectionB > 0) {
            const cached = await loadFromCache(examType, sub.id, "B");
            // Reuse the Firebase question bank first. Generate only the
            // shortfall while the cache is still being populated.
            const fromCache = shuffled(cached).slice(0, sub.sectionB);
            let generated: MockQuestion[] = [];
            try {
              const needGen = sub.sectionB - fromCache.length;
              if (needGen > 0) {
                generated = await generateFromAPI(examType, sub.id, "B", needGen);
                if (generated.length > 0) saveToCache(examType, sub.id, "B", generated);
              }
            } catch {
              const fullCache = shuffled(cached);
              generated = fullCache.slice(fromCache.length, sub.sectionB);
            }
            secB = shuffled([...fromCache, ...generated])
              .slice(0, sub.sectionB)
              .map((q) => ({ ...q, id: makeId(), subject: sub.id, section: "B" as Section }));
          }

          qs = [...secA, ...secB];
        }

        if (!cancelled) {
          setQuestionsBySubject((prev) => ({ ...prev, [sub.id]: qs }));
          setSubjectStatus((prev) => ({ ...prev, [sub.id]: qs.length > 0 ? "done" : "error" }));
        }

      } catch (err) {
        console.error(`[MockTest] Subject load failed [${sub.id}]:`, err);
        if (cancelled) return;

        // Last-resort: load everything available from cache
        try {
          const cached = await loadFromCache(examType, sub.id, "A");
          if (cached.length > 0) {
            const fallback = shuffled(cached)
              .slice(0, isDemo ? DEMO_QUESTIONS_PER_SUBJECT : sub.sectionA || 10)
              .map((q) => ({ ...q, id: makeId(), subject: sub.id, section: "A" as Section }));
            if (!cancelled) {
              setQuestionsBySubject((prev) => ({ ...prev, [sub.id]: fallback }));
              setSubjectStatus((prev) => ({ ...prev, [sub.id]: "done" }));
            }
          } else {
            if (!cancelled) setSubjectStatus((prev) => ({ ...prev, [sub.id]: "error" }));
          }
        } catch {
          if (!cancelled) setSubjectStatus((prev) => ({ ...prev, [sub.id]: "error" }));
        }
      }
    }

    // Expose so retry button can call it
    loaderRef.current = loadSubject;

    // Load all subjects in parallel — no blocking
    Promise.all(cfg.subjects.map(loadSubject));

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadKey, examType, isDemo]);

  // ── Timer (runs immediately — not gated on loading) ──────────────────────────

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

  // ── Auto-save progress every 3s ───────────────────────────────────────────────

  useEffect(() => {
    if (phase !== "quiz") return;
    const id = setInterval(() => {
      saveMockProgress({
        examType,
        isDemo,
        subjectStatus,
        questionsBySubject,
        currentIdxBySubject,
        answers,
        timeLeft,
        activeSubject,
        savedAt: Date.now(),
      });
    }, 3000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, examType, isDemo, subjectStatus, questionsBySubject, currentIdxBySubject, answers, timeLeft, activeSubject]);

  // ── Derived state ─────────────────────────────────────────────────────────────

  // Flat list for result screens
  const allQuestions = cfg.subjects.flatMap((s) => questionsBySubject[s.id] ?? []);

  const activeSubjectCfg = cfg.subjects.find((s) => s.id === activeSubject)!;
  const activeQuestions = questionsBySubject[activeSubject] ?? [];
  const activeStatus = subjectStatus[activeSubject] ?? "pending";
  const currentIdx = currentIdxBySubject[activeSubject] ?? 0;
  const currentQ = activeQuestions[currentIdx];

  function setCurrentIdx(subjectId: string, idx: number) {
    setCurrentIdxBySubject((prev) => ({ ...prev, [subjectId]: idx }));
  }

  function answerMCQ(questionId: string, index: number) {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        selectedIndex: prev[questionId]?.selectedIndex === index ? undefined : index,
        visited: true,
        flagged: prev[questionId]?.flagged ?? false,
      },
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

  // ── Result phase ──────────────────────────────────────────────────────────────

  if (phase === "result") {
    if (isDemo) {
      return (
        <DemoUpgradeScreen
          examType={examType}
          subjects={cfg.subjects}
          allQuestions={allQuestions}
          answers={answers}
          onHome={() => { clearMockProgress(examType, isDemo); navigate("/"); }}
        />
      );
    }
    return (
      <ResultScreen
        examType={examType}
        subjects={cfg.subjects}
        allQuestions={allQuestions}
        answers={answers}
        onRetry={() => {
          clearMockProgress(examType, isDemo);
          setAnswers({});
          setCurrentIdxBySubject({});
          setTimeLeft(3 * 60 * 60);
          setPhase("quiz");
          setLoadKey((k) => k + 1);
        }}
        onHome={() => { clearMockProgress(examType, isDemo); navigate("/"); }}
      />
    );
  }

  // ── Quiz Screen ───────────────────────────────────────────────────────────────

  const timerColor = timeLeft <= 600 ? "#ef4444" : timeLeft <= 1800 ? "#f59e0b" : "#10b981";
  const attemptedCount = getAttemptedCount(activeSubject);
  const overLimit = activeSubjectCfg.attemptLimit !== Infinity && attemptedCount > activeSubjectCfg.attemptLimit;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--app-bg)" }}>

      {/* ── Top bar ── */}
      <div className="sticky top-0 z-40 flex flex-col"
        style={{ background: "rgba(7,8,15,0.95)", backdropFilter: "blur(16px)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>

        {/* Timer row */}
        <div className="flex items-center justify-between px-4 py-2">
          <button onClick={() => { clearMockProgress(examType, isDemo); navigate("/"); }} className="text-white/30 hover:text-white/60 text-xs transition-colors">
            ✕ Exit
          </button>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
            style={{ background: `${timerColor}18`, border: `1px solid ${timerColor}40` }}>
            <span className="text-[11px] font-bold" style={{ color: timerColor }}>⏱ {formatTime(timeLeft)}</span>
          </div>
          <button
            onClick={() => { clearMockProgress(examType, isDemo); setPhase("result"); }}
            className="text-xs font-bold px-3 py-1.5 rounded-xl text-white"
            style={{ background: "linear-gradient(135deg, #3b82f6, #8b5cf6)", boxShadow: "0 2px 10px rgba(59,130,246,0.35)" }}
          >
            Submit →
          </button>
        </div>

        {/* Resume banner */}
        <AnimatePresence>
          {showResumeBanner && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden bg-emerald-500/10 border-b border-emerald-500/20 px-4 py-1.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-emerald-400 text-[11px] font-bold">
                  ↺ Resumed from last session — progress restored
                </span>
                <button
                  onClick={() => {
                    clearMockProgress(examType, isDemo);
                    setShowResumeBanner(false);
                  }}
                  className="text-emerald-400/60 hover:text-emerald-400 text-[11px] underline"
                >
                  discard
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Demo banner */}
        {isDemo && (
          <div className="flex items-center justify-center gap-2 px-4 py-1.5 bg-amber-500/10 border-b border-amber-500/20">
            <span className="text-amber-400 text-[11px] font-bold">🆓 Demo Mode — {DEMO_QUESTIONS_PER_SUBJECT} Qs/subject · Subscribe to unlock full test</span>
          </div>
        )}

        {/* Exam info row */}
        <div className="flex items-center justify-between px-4 pb-2">
          <span className="text-white/40 text-[11px]">{cfg.examName} · {allQuestions.length} Questions{isDemo ? " (Demo)" : ""}</span>
          <button onClick={() => setLangMode((m) => m === "both" ? "en" : m === "en" ? "hi" : "both")}
            className="text-white/30 hover:text-white/60 text-[11px] transition-colors px-2 py-0.5 rounded-lg border border-white/10">
            {langMode === "both" ? "A/अ" : langMode === "en" ? "A" : "अ"}
          </button>
        </div>

        {/* Subject tabs */}
        <div className="flex border-t border-white/5">
          {cfg.subjects.map((sub) => {
            const isActive = sub.id === activeSubject;
            const status = subjectStatus[sub.id] ?? "pending";
            const subAttempted = getAttemptedCount(sub.id);
            const subTotal = (questionsBySubject[sub.id] ?? []).length;
            const isLoading = status === "loading" || status === "pending";

            return (
              <button
                key={sub.id}
                onClick={() => setActiveSubject(sub.id)}
                className="flex-1 flex flex-col items-center py-2 transition-all text-xs font-semibold relative"
                style={{ color: isActive ? sub.accent : "rgba(255,255,255,0.30)", borderBottom: `2px solid ${isActive ? sub.accent : "transparent"}` }}
              >
                <span>{sub.emoji} {sub.label}</span>
                <span className="text-[9px] mt-0.5 opacity-70 flex items-center gap-0.5">
                  {isLoading ? (
                    <>
                      <motion.span
                        animate={{ rotate: 360 }}
                        transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
                        className="inline-block w-2.5 h-2.5 rounded-full border border-transparent"
                        style={{ borderTopColor: isActive ? sub.accent : "rgba(255,255,255,0.35)" }}
                      />
                      <span>loading</span>
                    </>
                  ) : status === "error" ? (
                    <span className="text-red-400">⚠ error</span>
                  ) : (
                    <span>{subAttempted}/{subTotal}</span>
                  )}
                </span>
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

        {/* Loading skeleton */}
        {(activeStatus === "loading" || activeStatus === "pending") && (
          <SubjectSkeletonLoader label={activeSubjectCfg.label} accent={activeSubjectCfg.accent} />
        )}

        {/* Error state with retry */}
        {activeStatus === "error" && (
          <div className="flex flex-col items-center justify-center h-64 gap-4 px-6">
            <div className="text-4xl">⚠️</div>
            <div className="text-center">
              <p className="text-white/50 text-sm font-semibold mb-1">{activeSubjectCfg.label} failed to load</p>
              <p className="text-white/25 text-xs">Network error or no cached questions available</p>
            </div>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => loaderRef.current?.(activeSubjectCfg)}
              className="px-5 py-2.5 rounded-xl text-sm font-bold text-white"
              style={{
                background: `linear-gradient(135deg, ${activeSubjectCfg.accent}, ${activeSubjectCfg.accent}bb)`,
                boxShadow: `0 2px 12px ${activeSubjectCfg.accent}40`,
              }}
            >
              ↺ Retry {activeSubjectCfg.label}
            </motion.button>
          </div>
        )}

        {/* Question view (only when loaded) */}
        {activeStatus === "done" && (
          currentQ ? (
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
                          border: `1.5px solid ${selected ? activeSubjectCfg.accent : "var(--app-surface-2)"}`,
                          boxShadow: selected ? `0 0 16px ${activeSubjectCfg.accent}30` : "none",
                        }}
                      >
                        <div className="flex items-start gap-3">
                          <span className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black shrink-0"
                            style={{
                              background: selected ? activeSubjectCfg.accent : "var(--app-surface-2)",
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

              {/* Section info footer */}
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
          ) : (
            <div className="flex items-center justify-center h-48 text-white/20 text-sm">No questions loaded</div>
          )
        )}
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
                const status = subjectStatus[sub.id] ?? "pending";
                if (status === "loading" || status === "pending") {
                  return (
                    <div key={sub.id} className="mb-4">
                      <p className="text-white/40 text-xs font-semibold mb-2 uppercase tracking-wider">{sub.emoji} {sub.label}</p>
                      <p className="text-white/20 text-xs flex items-center gap-1.5">
                        <motion.span
                          animate={{ rotate: 360 }}
                          transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
                          className="inline-block w-3 h-3 rounded-full border border-transparent"
                          style={{ borderTopColor: sub.accent }}
                        />
                        Loading questions…
                      </p>
                    </div>
                  );
                }
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
                          st === "visited"  ? "#6b7280" : "#374151";
                        const isCurrentQ = sub.id === activeSubject && idx === currentIdx;
                        return (
                          <button
                            key={q.id}
                            onClick={() => {
                              setActiveSubject(sub.id);
                              setCurrentIdx(sub.id, idx);
                              setPaletteOpen(false);
                            }}
                            className="w-full aspect-square rounded-lg text-[10px] font-bold transition-all"
                            style={{
                              background: statusColor,
                              color: st === "not-visited" ? "rgba(255,255,255,0.3)" : "#fff",
                              outline: isCurrentQ ? `2px solid ${sub.accent}` : "none",
                              outlineOffset: "1px",
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

              {/* Summary */}
              <div className="mt-4 pt-4 border-t border-white/08 grid grid-cols-3 gap-2 text-center text-xs">
                {cfg.subjects.map((sub) => {
                  const qs = questionsBySubject[sub.id] ?? [];
                  const attempted = qs.filter((q) => {
                    const a = answers[q.id];
                    return a?.selectedIndex !== undefined || (a?.numericalInput?.trim().length ?? 0) > 0;
                  }).length;
                  const status = subjectStatus[sub.id];
                  return (
                    <div key={sub.id} className="flex flex-col gap-0.5">
                      <span className="font-black" style={{ color: sub.accent }}>{status === "done" ? `${attempted}/${qs.length}` : "…"}</span>
                      <span className="text-white/30">{sub.label}</span>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
