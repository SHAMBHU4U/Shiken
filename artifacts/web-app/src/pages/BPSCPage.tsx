import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation, useParams } from "wouter";
import { get, push, ref, set } from "firebase/database";
import { auth, db } from "@/firebase";
import MathText from "@/components/MathText";
import { useSubscription } from "@/hooks/useSubscription";
import {
  BPSC_CATEGORIES,
  BPSC_CURRENT_AFFAIRS_CATEGORIES,
  BPSC_DB_ROOT,
  BPSC_DEMO_QUESTION_COUNT,
  BPSC_DEFAULT_DURATION_SECONDS,
  BPSC_DEFAULT_TEST_NAME,
  type BpscCategory,
  type BpscCurrentAffairsCategory,
  type BpscCurrentAffair,
  type BpscLanguage,
  type BpscMockTest,
  type BpscNote,
  type BpscQuestion,
} from "@/lib/bpsc";

type Section = "home" | "pyq" | "mock" | "affairs" | "notes" | "quiz" | "result";
type AnswerKey = "A" | "B" | "C" | "D";
type YearWiseSet = { year: string; examType: string; questions: BpscQuestion[] };

const OPTION_KEYS: AnswerKey[] = ["A", "B", "C", "D"];
const LANGUAGE_KEY = "shiken_bpsc_language";

function parseOptions(value: unknown): { A: string; B: string; C: string; D: string } {
  if (Array.isArray(value)) {
    return { A: String(value[0] ?? ""), B: String(value[1] ?? ""), C: String(value[2] ?? ""), D: String(value[3] ?? "") };
  }
  const record = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return { A: String(record.A ?? ""), B: String(record.B ?? ""), C: String(record.C ?? ""), D: String(record.D ?? "") };
}

function parseQuestion(id: string, category: BpscCategory, raw: Record<string, unknown>): BpscQuestion {
  return {
    id,
    category,
    topic: typeof raw.topic === "string" ? raw.topic : undefined,
    year: typeof raw.year === "string" ? raw.year : undefined,
    question_hi: String(raw.question_hi ?? raw.question_hindi ?? ""),
    question_en: String(raw.question_en ?? raw.question_english ?? ""),
    options_hi: parseOptions(raw.options_hi ?? raw.optionsHindi),
    options_en: parseOptions(raw.options_en ?? raw.options),
    correct_answer: String(raw.correct_answer ?? "A").toUpperCase() as AnswerKey,
    explanation_hi: typeof raw.explanation_hi === "string" ? raw.explanation_hi : undefined,
    explanation_en: typeof raw.explanation_en === "string" ? raw.explanation_en : (typeof raw.explanation === "string" ? raw.explanation : undefined),
    question_type: typeof raw.question_type === "string" ? raw.question_type : undefined,
  };
}

async function loadCategoryQuestions(category: BpscCategory): Promise<BpscQuestion[]> {
  const snapshot = await get(ref(db, `${BPSC_DB_ROOT}/questions/${category}`));
  if (!snapshot.exists()) return [];
  const value = snapshot.val();
  if (!value || typeof value !== "object") return [];
  return Object.entries(value as Record<string, Record<string, unknown>>)
    .filter(([, raw]) => raw.published !== false)
    .map(([id, raw]) => parseQuestion(id, category, raw))
    .filter((question) => question.question_hi.trim() || question.question_en.trim());
}

function formatTime(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function safeUid(uid: string) {
  return uid.replace(/[.#$/[\]]/g, "_");
}

function displayText(hi: string | undefined, en: string | undefined, language: BpscLanguage) {
  const hindi = hi?.trim();
  const english = en?.trim();
  if (language === "hi") return hindi || english || "—";
  if (language === "en") return english || hindi || "—";
  return [hindi, english].filter(Boolean).join("\n") || "—";
}

function BpscHeader({ onBack, title = "BPSC Prelims CCE" }: { onBack?: () => void; title?: string }) {
  return (
    <div className="mb-6 flex items-center gap-3">
      {onBack && <button type="button" onClick={onBack} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-600 shadow-sm">←</button>}
      <div>
        <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">SHIKEN · BPSC</p>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950">{title}</h1>
      </div>
    </div>
  );
}

function LanguageToggle({ value, onChange }: { value: BpscLanguage; onChange: (value: BpscLanguage) => void }) {
  return (
    <div className="flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm" aria-label="Question language">
      {([
        ["hi", "हिंदी"],
        ["en", "English"],
        ["both", "दोनों"],
      ] as const).map(([id, label]) => (
        <button key={id} type="button" data-testid={`button-language-${id}`} onClick={() => onChange(id)} className={`flex-1 rounded-lg px-2 py-1.5 text-[11px] font-bold ${value === id ? "bg-emerald-600 text-white" : "text-slate-600"}`}>
          {label}
        </button>
      ))}
    </div>
  );
}

function SectionCard({ mark, title, description, color, onClick }: { mark: string; title: string; description: string; color: string; onClick: () => void }) {
  return (
    <motion.button type="button" data-testid={`button-section-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`} whileTap={{ scale: 0.98 }} onClick={onClick} className="rounded-3xl border bg-white p-5 text-left shadow-sm transition-shadow hover:shadow-md" style={{ borderColor: `${color}45` }}>
      <span className="flex h-11 w-11 items-center justify-center rounded-2xl font-mono text-sm font-black" style={{ background: `${color}15`, color }}>{mark}</span>
      <h2 className="mt-4 text-base font-black text-slate-900">{title}</h2>
      <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
      <span className="mt-4 inline-flex rounded-full px-3 py-1 text-[11px] font-bold" style={{ background: `${color}12`, color }}>Open section →</span>
    </motion.button>
  );
}

function QuizScreen({
  questions,
  title,
  durationSeconds,
  marksPerQuestion,
  negativeMark,
  language,
  onLanguage,
  onFinish,
  onExit,
}: {
  questions: BpscQuestion[];
  title: string;
  durationSeconds: number;
  marksPerQuestion: number;
  negativeMark: number;
  language: BpscLanguage;
  onLanguage: (value: BpscLanguage) => void;
  onFinish: (answers: Record<string, AnswerKey>, saved: string[], flagged: string[]) => void;
  onExit: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, AnswerKey>>({});
  const [saved, setSaved] = useState<string[]>([]);
  const [flagged, setFlagged] = useState<string[]>([]);
  const [timeLeft, setTimeLeft] = useState(durationSeconds);
  const question = questions[index];

  useEffect(() => {
    setTimeLeft(durationSeconds);
    setAnswers({});
    setSaved([]);
    setFlagged([]);
    setIndex(0);
  }, [questions, durationSeconds]);

  useEffect(() => {
    const timer = window.setInterval(() => setTimeLeft((current) => Math.max(0, current - 1)), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (timeLeft === 0) onFinish(answers, saved, flagged);
  }, [timeLeft, answers, saved, flagged, onFinish]);

  if (!question) return <div className="p-8 text-center text-slate-500">No questions available.</div>;
  const selected = answers[question.id];
  const optionText = (key: AnswerKey) => displayText(question.options_hi[key], question.options_en[key], language);
  const next = () => index < questions.length - 1 ? setIndex((current) => current + 1) : onFinish(answers, saved, flagged);
  const toggle = (items: string[], id: string, setter: (items: string[]) => void) => setter(items.includes(id) ? items.filter((item) => item !== id) : [...items, id]);

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
        <div className="mx-auto max-w-lg">
          <div className="flex items-center justify-between gap-2">
            <button type="button" onClick={onExit} className="text-xs font-bold text-slate-500">✕ Exit</button>
            <div className="text-center">
              <p className="max-w-[190px] truncate text-xs font-black text-slate-900">{title}</p>
              <p className="text-[10px] text-slate-500">Q {index + 1}/{questions.length} · {formatTime(timeLeft)}</p>
            </div>
            <button type="button" onClick={() => onFinish(answers, saved, flagged)} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white">Submit</button>
          </div>
          <div className="mt-3 flex gap-2">
            <LanguageToggle value={language} onChange={onLanguage} />
            <div className="flex flex-1 items-center justify-end gap-2 text-[10px] font-bold text-slate-500">
              <span className="rounded-full bg-emerald-50 px-2 py-1 text-emerald-700">{Object.keys(answers).length} answered</span>
              <span className="rounded-full bg-amber-50 px-2 py-1 text-amber-700">{saved.length} saved</span>
            </div>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${((index + 1) / questions.length) * 100}%` }} />
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-lg px-4 pb-10 pt-6">
        <div className="mb-4 flex items-center justify-between">
          <span className="rounded-full bg-white px-3 py-1 text-[11px] font-bold text-slate-500 shadow-sm">{question.category}</span>
          <div className="flex gap-2">
            <button type="button" onClick={() => toggle(saved, question.id, setSaved)} className={`rounded-xl border px-3 py-2 text-[11px] font-bold ${saved.includes(question.id) ? "border-amber-300 bg-amber-50 text-amber-700" : "border-slate-200 bg-white text-slate-500"}`}>
              {saved.includes(question.id) ? "★ Saved" : "☆ Save"}
            </button>
            <button type="button" onClick={() => toggle(flagged, question.id, setFlagged)} className={`rounded-xl border px-3 py-2 text-[11px] font-bold ${flagged.includes(question.id) ? "border-rose-300 bg-rose-50 text-rose-700" : "border-slate-200 bg-white text-slate-500"}`}>
              {flagged.includes(question.id) ? "⚑ Flagged" : "⚐ Flag"}
            </button>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <MathText text={displayText(question.question_hi, question.question_en, language)} className="whitespace-pre-line text-base font-bold leading-7 text-slate-900" />
          <div className="mt-5 flex flex-col gap-2.5">
            {OPTION_KEYS.map((key) => (
              <button key={key} type="button" onClick={() => setAnswers((current) => ({ ...current, [question.id]: key }))} className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition-colors ${selected === key ? "border-emerald-500 bg-emerald-50" : "border-slate-200 bg-slate-50 hover:bg-white"}`}>
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-black ${selected === key ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-600"}`}>{key}</span>
                <MathText text={optionText(key)} className="whitespace-pre-line text-sm leading-6 text-slate-700" />
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between gap-2">
          <button type="button" disabled={index === 0} onClick={() => setIndex((current) => Math.max(0, current - 1))} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-bold text-slate-600 disabled:opacity-40">← Previous</button>
          <button type="button" onClick={next} className="flex-1 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white">{index === questions.length - 1 ? "Submit Test" : selected ? "Submit & Next →" : "Skip & Next →"}</button>
        </div>
      </main>
    </div>
  );
}

function ResultScreen({
  questions,
  answers,
  title,
  marksPerQuestion,
  negativeMark,
  rank,
  onRetry,
  onHome,
}: {
  questions: BpscQuestion[];
  answers: Record<string, AnswerKey>;
  title: string;
  marksPerQuestion: number;
  negativeMark: number;
  rank: number | null;
  onRetry: () => void;
  onHome: () => void;
}) {
  const correct = questions.filter((question) => answers[question.id] === question.correct_answer).length;
  const attempted = Object.keys(answers).length;
  const wrong = questions.filter((question) => answers[question.id] && answers[question.id] !== question.correct_answer).length;
  const score = correct * marksPerQuestion - wrong * negativeMark;
  const total = questions.length * marksPerQuestion;
  const accuracy = attempted ? Math.round((correct / attempted) * 100) : 0;
  return (
    <div className="min-h-screen bg-slate-100">
      <main className="mx-auto max-w-lg px-4 pb-28 pt-10">
        <BpscHeader title="Test Result" onBack={onHome} />
        <div className="rounded-3xl bg-gradient-to-br from-emerald-700 to-teal-700 p-6 text-center text-white shadow-lg">
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-white/70">{title}</p>
          <p className="mt-3 text-5xl font-black">{score}<span className="text-xl text-white/60">/{total}</span></p>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-2xl bg-white/10 p-3"><p className="text-xl font-black">{correct}</p><p className="text-[10px] text-white/70">Correct</p></div>
            <div className="rounded-2xl bg-white/10 p-3"><p className="text-xl font-black">{wrong}</p><p className="text-[10px] text-white/70">Wrong</p></div>
            <div className="rounded-2xl bg-white/10 p-3"><p className="text-xl font-black">{accuracy}%</p><p className="text-[10px] text-white/70">Accuracy</p></div>
          </div>
        </div>
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-amber-700">Overall BPSC rank</p>
          <p className="mt-1 text-3xl font-black text-amber-900">{rank ? `#${rank}` : "Calculating…"}</p>
          <p className="mt-1 text-[11px] text-amber-700">Rank is calculated from submitted BPSC attempts.</p>
        </div>
        <div className="mt-6 flex gap-2">
          <button type="button" onClick={onHome} className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-600">BPSC Home</button>
          <button type="button" onClick={onRetry} className="flex-1 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white">Retake Test</button>
        </div>
        <h2 className="mt-8 text-sm font-black uppercase tracking-[0.12em] text-slate-600">Answer explanations</h2>
        <div className="mt-3 flex flex-col gap-3">
          {questions.map((question, index) => {
            const userAnswer = answers[question.id];
            const isCorrect = userAnswer === question.correct_answer;
            return (
              <details key={question.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <summary className="cursor-pointer list-none text-sm font-bold text-slate-800">
                  <span className={`mr-2 inline-flex h-6 w-6 items-center justify-center rounded-lg text-xs text-white ${isCorrect ? "bg-emerald-500" : "bg-rose-500"}`}>{index + 1}</span>
                  {isCorrect ? "Correct" : userAnswer ? `Wrong · Correct answer ${question.correct_answer}` : `Skipped · Correct answer ${question.correct_answer}`}
                </summary>
                <MathText text={question.question_en || question.question_hi} className="mt-3 text-sm font-semibold leading-6 text-slate-800" />
                <p className="mt-2 whitespace-pre-line text-xs leading-5 text-slate-500">{question.explanation_en || question.explanation_hi || "Explanation will be added by the admin."}</p>
              </details>
            );
          })}
        </div>
      </main>
    </div>
  );
}

export default function BPSCPage() {
  const [, navigate] = useLocation();
  const params = useParams<{ examSlug: string }>();
  const { isActive, isCompetitiveExamPremium } = useSubscription();
  const hasAccess = isActive && (isCompetitiveExamPremium?.(params.examSlug || "bpsc-cce") ?? false);
  const [section, setSection] = useState<Section>("home");
  const [language, setLanguage] = useState<BpscLanguage>(() => {
    const stored = localStorage.getItem(LANGUAGE_KEY);
    return stored === "hi" || stored === "en" || stored === "both" ? stored : "both";
  });
  const [category, setCategory] = useState<BpscCategory>("history");
  const [questions, setQuestions] = useState<BpscQuestion[]>([]);
  const [yearWiseSets, setYearWiseSets] = useState<YearWiseSet[]>([]);
  const [selectedYearSet, setSelectedYearSet] = useState<YearWiseSet | null>(null);
  const [tests, setTests] = useState<BpscMockTest[]>([]);
  const [affairs, setAffairs] = useState<BpscCurrentAffair[]>([]);
  const [notes, setNotes] = useState<BpscNote[]>([]);
  const [affairCategory, setAffairCategory] = useState<BpscCurrentAffairsCategory | "all">("all");
  const [loading, setLoading] = useState(true);
  const [loadingContent, setLoadingContent] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState<BpscQuestion[]>([]);
  const [quizTitle, setQuizTitle] = useState("");
  const [quizDuration, setQuizDuration] = useState(BPSC_DEFAULT_DURATION_SECONDS);
  const [marksPerQuestion, setMarksPerQuestion] = useState(1);
  const [negativeMark, setNegativeMark] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, AnswerKey>>({});
  const [rank, setRank] = useState<number | null>(null);
  const [selectedNote, setSelectedNote] = useState<BpscNote | null>(null);
  const saveResultRef = useRef(false);

  useEffect(() => {
    localStorage.setItem(LANGUAGE_KEY, language);
  }, [language]);

  useEffect(() => {
    let cancelled = false;
    async function loadHomeData() {
      setLoading(true);
      try {
        const [testsSnap, affairsSnap, notesSnap, pyqsSnap] = await Promise.all([
          get(ref(db, `${BPSC_DB_ROOT}/tests`)),
          get(ref(db, `${BPSC_DB_ROOT}/currentAffairs`)),
          get(ref(db, `${BPSC_DB_ROOT}/notes`)),
          get(ref(db, `${BPSC_DB_ROOT}/pyqs`)),
        ]);
        if (cancelled) return;
        const testValue = testsSnap.exists() ? testsSnap.val() as Record<string, Record<string, unknown>> : {};
        setTests(Object.entries(testValue).map(([id, raw]) => ({
          id,
          name: String(raw.name ?? id),
          description: typeof raw.description === "string" ? raw.description : undefined,
          durationSeconds: Number(raw.durationSeconds ?? BPSC_DEFAULT_DURATION_SECONDS),
          marksPerQuestion: Number(raw.marksPerQuestion ?? 1),
          negativeMark: Number(raw.negativeMark ?? 0),
          questionIds: Array.isArray(raw.questionIds) ? raw.questionIds.map(String) : [],
          questions: Array.isArray(raw.questions) ? raw.questions as Array<Record<string, unknown>> : undefined,
          published: raw.published !== false,
          updatedAt: Number(raw.updatedAt ?? 0),
        })).filter((test) => test.published));
        const affairValue = affairsSnap.exists() ? affairsSnap.val() as Record<string, Record<string, unknown>> : {};
        setAffairs(Object.entries(affairValue).map(([id, raw]) => ({ id, ...raw } as BpscCurrentAffair)).filter((item) => item.published !== false));
        const noteValue = notesSnap.exists() ? notesSnap.val() as Record<string, Record<string, unknown>> : {};
        setNotes(Object.entries(noteValue).map(([id, raw]) => ({ id, ...raw } as BpscNote)).filter((item) => item.published !== false));
        const yearValue = pyqsSnap.exists() ? pyqsSnap.val() as Record<string, Record<string, Record<string, Record<string, unknown>>>> : {};
        const sets: YearWiseSet[] = [];
        Object.entries(yearValue).forEach(([year, exams]) => Object.entries(exams ?? {}).forEach(([examType, records]) => {
          const parsed = Object.entries(records ?? {}).filter(([, raw]) => raw.published !== false).map(([id, raw]) => {
            const category = String(raw.category ?? "history") as BpscCategory;
            return parseQuestion(id, category, { ...raw, year: String(raw.year ?? year) });
          }).filter((item) => item.question_hi.trim() || item.question_en.trim());
          if (parsed.length) sets.push({ year, examType, questions: parsed });
        }));
        sets.sort((a, b) => Number(b.year) - Number(a.year) || a.examType.localeCompare(b.examType));
        setYearWiseSets(sets);
      } catch (error) {
        console.error("[BPSC] failed to load content", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadHomeData();
    return () => { cancelled = true; };
  }, []);

  const setStudentLanguage = (value: BpscLanguage) => setLanguage(value);

  async function openCategory(nextCategory: BpscCategory) {
    setCategory(nextCategory);
    setSelectedYearSet(null);
    setSection("pyq");
    setLoadingContent(true);
    try { setQuestions(await loadCategoryQuestions(nextCategory)); }
    catch { setQuestions([]); }
    finally { setLoadingContent(false); }
  }

  async function startDemo() {
    setLoadingContent(true);
    try {
      const loaded = await Promise.all(BPSC_CATEGORIES.map((item) => loadCategoryQuestions(item.id)));
      const demo = loaded.flat().sort(() => Math.random() - 0.5).slice(0, BPSC_DEMO_QUESTION_COUNT);
      setQuizQuestions(demo);
      setQuizTitle("BPSC CCE · 10 Question Demo");
      setQuizDuration(20 * 60);
      setMarksPerQuestion(1);
      setNegativeMark(0);
      saveResultRef.current = false;
      setSection("quiz");
    } finally { setLoadingContent(false); }
  }

  async function startTest(test: BpscMockTest) {
    setLoadingContent(true);
    try {
      const snapshotList = (test as BpscMockTest & { questions?: Array<Record<string, unknown>> }).questions;
      if (snapshotList?.length) {
        setQuizQuestions(snapshotList.map((raw) => parseQuestion(String(raw.id ?? raw.sourceId ?? ""), String(raw.category ?? "history") as BpscCategory, raw)));
        setQuizTitle(test.name);
        setQuizDuration(test.durationSeconds);
        setMarksPerQuestion(test.marksPerQuestion);
        setNegativeMark(test.negativeMark);
        saveResultRef.current = false;
        setSection("quiz");
        return;
      }
      const loaded = await Promise.all(BPSC_CATEGORIES.map((item) => loadCategoryQuestions(item.id)));
      const byId = new Map(loaded.flat().map((question) => [question.id, question]));
      const selectedQuestions = test.questionIds.map((id) => byId.get(id)).filter((question): question is BpscQuestion => Boolean(question));
      setQuizQuestions(selectedQuestions);
      setQuizTitle(test.name);
      setQuizDuration(test.durationSeconds);
      setMarksPerQuestion(test.marksPerQuestion);
      setNegativeMark(test.negativeMark);
      saveResultRef.current = false;
      setSection("quiz");
    } finally { setLoadingContent(false); }
  }

  const finishQuiz = (answers: Record<string, AnswerKey>) => {
    if (saveResultRef.current) return;
    saveResultRef.current = true;
    setQuizAnswers(answers);
    setSection("result");
    void saveScoreAndRank(answers);
  };

  async function saveScoreAndRank(answers: Record<string, AnswerKey>) {
    const uid = auth.currentUser?.uid;
    if (!uid || quizQuestions.length === 0) return;
    const correct = quizQuestions.filter((question) => answers[question.id] === question.correct_answer).length;
    const wrong = quizQuestions.filter((question) => answers[question.id] && answers[question.id] !== question.correct_answer).length;
    const score = correct * marksPerQuestion - wrong * negativeMark;
    const total = quizQuestions.length * marksPerQuestion;
    const percentage = total > 0 ? Math.round((score / total) * 100) : 0;
    const base = `${BPSC_DB_ROOT}/scores`;
    try {
      await push(ref(db, `${base}/${safeUid(uid)}`), { score, total, percentage, test: quizTitle, createdAt: Date.now() });
      const snap = await get(ref(db, base));
      const bestByUser = new Map<string, number>();
      if (snap.exists()) {
        Object.entries(snap.val() as Record<string, Record<string, { percentage?: number }>>).forEach(([studentId, attempts]) => {
          bestByUser.set(studentId, Math.max(...Object.values(attempts || {}).map((attempt) => Number(attempt.percentage ?? 0)), 0));
        });
      }
      const ordered = [...bestByUser.values()].sort((a, b) => b - a);
      setRank(ordered.findIndex((value) => value <= percentage) + 1);
    } catch {
      setRank(null);
    }
  }

  const filteredAffairs = useMemo(() => affairCategory === "all" ? affairs : affairs.filter((item) => item.category === affairCategory), [affairs, affairCategory]);
  const updateLanguage = (value: BpscLanguage) => setStudentLanguage(value);

  if (section === "quiz") {
    return <QuizScreen questions={quizQuestions} title={quizTitle} durationSeconds={quizDuration} marksPerQuestion={marksPerQuestion} negativeMark={negativeMark} language={language} onLanguage={updateLanguage} onFinish={finishQuiz} onExit={() => setSection("home")} />;
  }
  if (section === "result") {
    return <ResultScreen questions={quizQuestions} answers={quizAnswers} title={quizTitle} marksPerQuestion={marksPerQuestion} negativeMark={negativeMark} rank={rank} onRetry={() => { saveResultRef.current = false; setSection("quiz"); }} onHome={() => setSection("home")} />;
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <main className="mx-auto max-w-lg px-4 pb-28 pt-10">
        <BpscHeader onBack={() => navigate("/")} />
        {loading ? <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Loading BPSC content…</div> : (
          <>
            {section === "home" && (
              <>
                <div className="rounded-3xl bg-gradient-to-br from-[#17344f] to-[#2c8d78] p-5 text-white shadow-lg">
                  <p className="text-xs font-bold uppercase tracking-[0.15em] text-white/70">BPSC CCE Prelims</p>
                  <h2 className="mt-2 text-2xl font-black">Prepare for Bihar with purpose.</h2>
                  <p className="mt-2 text-sm leading-6 text-white/75">Bilingual PYQs, admin-curated mock tests, current affairs and notes.</p>
                  <div className="mt-5 flex gap-2">
                    <button type="button" onClick={() => void startDemo()} disabled={loadingContent} className="rounded-xl bg-white px-4 py-2.5 text-xs font-black text-[#17344f]">{loadingContent ? "Loading…" : `Try ${BPSC_DEMO_QUESTION_COUNT} Question Demo`}</button>
                    {!hasAccess && <button type="button" onClick={() => navigate("/pricing?category=competitive")} className="rounded-xl border border-white/30 px-4 py-2.5 text-xs font-black text-white">Unlock Full Test</button>}
                  </div>
                </div>
                {!hasAccess && <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800">Demo is free. Full-length BPSC tests require the BPSC Premium plan.</p>}
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <SectionCard mark="PYQ" title="PYQ Questions" description="Practice by year and exam, or use the subject-wise legacy bank." color="#a34e19" onClick={() => setSection("pyq")} />
                  <SectionCard mark="TEST" title="Mock Tests" description={`${tests.length} published test${tests.length === 1 ? "" : "s"} available.`} color="#14745b" onClick={() => setSection("mock")} />
                  <SectionCard mark="NEWS" title="Current Affairs" description="National, International and Bihar current affairs." color="#376c82" onClick={() => setSection("affairs")} />
                  <SectionCard mark="PDF" title="E-Books / Notes" description="Open admin-published study material online." color="#66588c" onClick={() => setSection("notes")} />
                </div>
              </>
            )}

            {section === "pyq" && (
              <section>
                <BpscHeader title="PYQ Questions" onBack={() => setSection("home")} />
                <LanguageToggle value={language} onChange={updateLanguage} />
                {yearWiseSets.length > 0 ? (
                  <div className="mt-4 space-y-3">
                    <p className="text-xs leading-5 text-slate-600">Choose a published paper. Answers and explanations are provided in the language selected above.</p>
                    {yearWiseSets.map((set) => <article key={`${set.year}-${set.examType}`} className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm">
                      <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.14em] text-emerald-700">{set.examType}</p><h2 className="mt-1 text-base font-black text-slate-900">{set.year} · {set.questions.length} questions</h2></div>
                        <button type="button" data-testid={`button-start-pyq-${set.year}-${set.examType}`} onClick={() => { setQuizQuestions(set.questions); setQuizTitle(`${set.year} ${set.examType} PYQ`); setQuizDuration(BPSC_DEFAULT_DURATION_SECONDS); setMarksPerQuestion(1); setNegativeMark(0); saveResultRef.current = false; setSection("quiz"); }} className="rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-black text-white">Practice this paper</button>
                      </div>
                    </article>)}
                  </div>
                ) : (
                  <>
                    <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">Year-wise PYQ sets are not available yet. Browse the existing subject-wise question bank below.</div>
                    <div className="mt-4 grid grid-cols-2 gap-2.5">
                      {BPSC_CATEGORIES.map((item) => <button key={item.id} type="button" data-testid={`button-pyq-category-${item.id}`} onClick={() => void openCategory(item.id)} className={`rounded-2xl border p-4 text-left ${category === item.id ? "ring-2 ring-emerald-500" : ""}`} style={{ background: `${item.color}0d`, borderColor: `${item.color}35` }}>
                        <span className="font-mono text-xs font-black" style={{ color: item.color }}>{item.id.slice(0, 3).toUpperCase()}</span><p className="mt-2 text-xs font-black text-slate-800">{item.label}</p><p className="text-[10px] text-slate-600">{item.labelHindi}</p>
                      </button>)}
                    </div>
                    <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                      {loadingContent ? <p className="text-sm text-slate-600">Loading questions…</p> : questions.length ? <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-sm font-bold text-slate-800">{questions.length} questions in {BPSC_CATEGORIES.find((item) => item.id === category)?.label}.</p>
                        <button type="button" data-testid="button-start-legacy-pyq" onClick={() => { setQuizQuestions(questions); setQuizTitle(`${BPSC_CATEGORIES.find((item) => item.id === category)?.label} PYQ Practice`); setQuizDuration(BPSC_DEFAULT_DURATION_SECONDS); setMarksPerQuestion(1); setNegativeMark(0); saveResultRef.current = false; setSection("quiz"); }} className="rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-black text-white">Start practice</button>
                      </div> : <p className="text-xs leading-5 text-slate-600">Select a subject to load questions from the existing question bank.</p>}
                    </div>
                  </>
                )}
              </section>
            )}

            {section === "mock" && (
              <section>
                <BpscHeader title="Mock Tests" onBack={() => setSection("home")} />
                <div className="flex flex-col gap-3">
                  {tests.length === 0 && <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">Admin has not published a BPSC mock test yet.</div>}
                  {tests.map((test) => (
                    <div key={test.id} className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div><h2 className="text-sm font-black text-slate-900">{test.name}</h2><p className="mt-1 text-xs text-slate-500">{test.description || "BPSC Prelims practice test"}</p></div>
                        <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">{test.questionIds.length} Q</span>
                      </div>
                      <div className="mt-3 flex items-center justify-between text-[11px] text-slate-600"><span>{Math.round(test.durationSeconds / 60)} min</span><span>+{test.marksPerQuestion} / −{test.negativeMark}</span><button type="button" disabled={loadingContent || !hasAccess} onClick={() => void startTest(test)} className="rounded-xl bg-emerald-700 px-3 py-2 font-black text-white disabled:bg-slate-200 disabled:text-slate-500">{hasAccess ? "Start Test" : "Unlock to Start"}</button></div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {section === "affairs" && (
              <section>
                <BpscHeader title="Current Affairs" onBack={() => setSection("home")} />
                <div className="mb-4 grid grid-cols-4 gap-1 rounded-xl border border-slate-200 bg-white p-1">
                  {([["all", "All"], ...BPSC_CURRENT_AFFAIRS_CATEGORIES.map((item) => [item.id, item.label])] as const).map(([id, label]) => <button key={id} type="button" onClick={() => setAffairCategory(id as BpscCurrentAffairsCategory | "all")} className={`rounded-lg px-1 py-2 text-[10px] font-bold ${affairCategory === id ? "bg-blue-600 text-white" : "text-slate-500"}`}>{label}</button>)}
                </div>
                <div className="flex flex-col gap-3">
                  {filteredAffairs.length === 0 && <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">No published current affairs yet.</div>}
                  {filteredAffairs.map((item) => <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex justify-between gap-2"><h2 className="text-sm font-black text-slate-900">{displayText(item.title_hi, item.title_en, language)}</h2><span className="shrink-0 text-[10px] text-slate-400">{item.date || item.year}</span></div><p className="mt-3 whitespace-pre-line text-xs leading-6 text-slate-600">{displayText(item.content_hi, item.content_en, language)}</p></article>)}
                </div>
              </section>
            )}

            {section === "notes" && (
              <section>
                <BpscHeader title="E-Books / Notes" onBack={() => setSection("home")} />
                <div className="flex flex-col gap-3">
                  {notes.length === 0 && <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">No published notes yet.</div>}
                  {notes.map((note) => <article key={note.id} className="rounded-2xl border border-violet-200 bg-white p-4 shadow-sm"><div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 font-mono text-xs font-black text-violet-800">PDF</span><div className="min-w-0 flex-1"><h2 className="text-sm font-black text-slate-900">{note.title}</h2><p className="mt-1 text-xs text-slate-600">{note.description || note.category} · {note.language}</p><button type="button" data-testid={`button-read-note-${note.id}`} onClick={() => setSelectedNote(note)} className="mt-3 rounded-xl bg-violet-700 px-3 py-2 text-xs font-black text-white">Read online</button></div></div></article>)}
                </div>
              </section>
            )}
          </>
        )}
      </main>
      <AnimatePresence>
        {selectedNote && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/60 p-0 sm:items-center sm:p-4" onClick={() => setSelectedNote(null)}><motion.div initial={{ y: 40 }} animate={{ y: 0 }} exit={{ y: 40 }} onClick={(event) => event.stopPropagation()} className="h-[90dvh] w-full max-w-2xl overflow-hidden rounded-t-3xl bg-white sm:rounded-3xl"><div className="flex items-center justify-between border-b border-slate-200 px-4 py-3"><p className="truncate text-sm font-black text-slate-900">{selectedNote.title}</p><button type="button" onClick={() => setSelectedNote(null)} className="text-slate-500">✕</button></div><iframe title={selectedNote.title} src={selectedNote.pdfUrl} className="h-[calc(100%-56px)] w-full" /></motion.div></motion.div>}
      </AnimatePresence>
    </div>
  );
}