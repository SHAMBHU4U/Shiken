import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { db as _db } from "../firebase.js"; void _db;
import { useParams, useLocation } from "wouter";
import MathText from "@/components/MathText";

const subjectMeta: Record<string, { label: string; icon: string; accent: string; path: string }> = {
  maths:   { label: "Maths",          icon: "📐", accent: "#06b6d4", path: "maths"          },
  english: { label: "English",        icon: "📖", accent: "#8b5cf6", path: "english"        },
  hindi:   { label: "Hindi",          icon: "🔤", accent: "#f97316", path: "hindi"          },
  science: { label: "Science",        icon: "🔬", accent: "#10b981", path: "science"        },
  social:  { label: "Social Science", icon: "🌍", accent: "#f59e0b", path: "social science" },
  sanskrit:{ label: "Sanskrit",       icon: "📜", accent: "#ec4899", path: "sanskrit"       },
};

interface Question {
  english: string;
  hindi: string;
  options: string[];
  answerIndex: number;
  chapter: string;
}

// ─── Progress persistence ──────────────────────────────────────────────────────

interface SavedProgress {
  mode: "full" | "chapter";
  chapter: string;
  questions: Question[];
  currentIndex: number;
  answers: Record<number, number>;
  timestamp: number;
}

function progressKey(subject: string) { return `shiken_progress_${subject}`; }

function loadProgress(subject: string): SavedProgress | null {
  try {
    const raw = localStorage.getItem(progressKey(subject));
    if (!raw) return null;
    const p = JSON.parse(raw) as SavedProgress;
    if (!p.questions?.length) return null;
    return p;
  } catch { return null; }
}

function saveProgress(subject: string, data: SavedProgress) {
  try { localStorage.setItem(progressKey(subject), JSON.stringify(data)); } catch { /* quota */ }
}

function clearProgress(subject: string) {
  try { localStorage.removeItem(progressKey(subject)); } catch { /* noop */ }
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pick<T>(arr: T[], n: number): T[] {
  return shuffle(arr).slice(0, n);
}

function parseQuestions(data: unknown): Question[] {
  const raw =
    typeof data === "object" && data !== null && !Array.isArray(data)
      ? Object.values(data as Record<string, unknown>)
      : Array.isArray(data) ? data : [];

  return (raw as Record<string, unknown>[]).map((q) => {
    const opts: string[] = [];
    let answerIndex = 0;
    const correctAnswer = q.correct_answer ?? q.answer ?? "";

    if (Array.isArray(q.options)) {
      q.options.forEach((o: unknown) => opts.push(String(o)));
      answerIndex = typeof correctAnswer === "number" ? correctAnswer : 0;
    } else if (q.options && typeof q.options === "object") {
      const optObj = q.options as Record<string, string>;
      const keys = Object.keys(optObj).sort();
      keys.forEach((k) => opts.push(optObj[k]));
      const answerKey = String(correctAnswer).toUpperCase();
      const idx = keys.findIndex((k) => k.toUpperCase() === answerKey);
      answerIndex = idx >= 0 ? idx : 0;
    }

    return {
      english:    String(q.question_english ?? q.english ?? ""),
      hindi:      String(q.question_hindi   ?? q.hindi   ?? ""),
      options:    opts,
      answerIndex,
      chapter:    String(q.chapter ?? "General"),
    };
  }).filter((q) => (q.english || q.hindi) && q.options.length >= 2);
}

// ─── Demo questions (shown when Firebase has no data) ─────────────────────────

const demoQuestions: Record<string, Question[]> = {
  maths: [
    { english: "What is the value of $\\pi$ up to two decimal places?", hindi: "$\\pi$ का मान दो दशमलव स्थानों तक क्या है?", options: ["3.14", "3.41", "3.12", "3.16"], answerIndex: 0, chapter: "Numbers" },
    { english: "If a triangle has all angles $60°$, it is:", hindi: "यदि त्रिभुज के सभी कोण $60°$ हों तो वह होगा:", options: ["Scalene", "Isosceles", "Equilateral", "Right-angled"], answerIndex: 2, chapter: "Geometry" },
    { english: "What is $\\sqrt{144}$?", hindi: "$\\sqrt{144}$ का मान क्या है?", options: ["11", "12", "13", "14"], answerIndex: 1, chapter: "Numbers" },
    { english: "Simple interest on ₹1000 at 5% for 2 years:", hindi: "₹1000 पर 5% से 2 वर्षों का साधारण ब्याज:", options: ["₹50", "₹100", "₹150", "₹200"], answerIndex: 1, chapter: "Finance" },
    { english: "15% of 200 is:", hindi: "200 का 15% है:", options: ["25", "30", "35", "40"], answerIndex: 1, chapter: "Numbers" },
  ],
  science: [
    { english: "Plants absorb which gas during photosynthesis?", hindi: "प्रकाश संश्लेषण में पौधे कौन सी गैस लेते हैं?", options: ["Oxygen", "Nitrogen", "Carbon Dioxide", "Hydrogen"], answerIndex: 2, chapter: "Biology" },
    { english: "Chemical formula of water:", hindi: "पानी का रासायनिक सूत्र:", options: ["H₂O₂", "HO", "H₂O", "H₃O"], answerIndex: 2, chapter: "Chemistry" },
    { english: "Unit of electric current:", hindi: "विद्युत धारा की इकाई:", options: ["Volt", "Watt", "Ohm", "Ampere"], answerIndex: 3, chapter: "Physics" },
    { english: "Which planet is the Red Planet?", hindi: "लाल ग्रह कौन है?", options: ["Venus", "Mars", "Jupiter", "Saturn"], answerIndex: 1, chapter: "Astronomy" },
    { english: "Newton's first law is also called:", hindi: "न्यूटन का पहला नियम कहलाता है:", options: ["Acceleration", "Inertia", "Action-Reaction", "Gravity"], answerIndex: 1, chapter: "Physics" },
  ],
  english: [
    { english: "Synonym of 'Brave':", hindi: "'Brave' का पर्यायवाची:", options: ["Cowardly", "Courageous", "Fearful", "Timid"], answerIndex: 1, chapter: "Vocabulary" },
    { english: "She __ to school every day.", hindi: "She __ to school every day.", options: ["go", "goes", "going", "gone"], answerIndex: 1, chapter: "Grammar" },
    { english: "Which is a noun?", hindi: "कौन सा शब्द संज्ञा है?", options: ["Run", "Happy", "Quickly", "Freedom"], answerIndex: 3, chapter: "Grammar" },
    { english: "Antonym of 'Ancient':", hindi: "'Ancient' का विलोम:", options: ["Old", "Modern", "Historical", "Aged"], answerIndex: 1, chapter: "Vocabulary" },
    { english: "Passive: 'The teacher teaches the students.'", hindi: "Passive voice:", options: ["Students are taught by teacher.", "Students were taught.", "Students have been taught.", "Students taught."], answerIndex: 0, chapter: "Grammar" },
  ],
  hindi: [
    { english: "Feminine of 'राजा':", hindi: "'राजा' का स्त्रीलिंग:", options: ["रानी", "राजनी", "राजकुमारी", "महारानी"], answerIndex: 0, chapter: "व्याकरण" },
    { english: "Which is a compound word (samas)?", hindi: "कौन सा समास है?", options: ["और", "लेकिन", "राजमहल", "परंतु"], answerIndex: 2, chapter: "व्याकरण" },
    { english: "'पुस्तक' means:", hindi: "'पुस्तक' का अर्थ:", options: ["School", "Teacher", "Book", "Pen"], answerIndex: 2, chapter: "शब्द-भंडार" },
    { english: "Who wrote 'Ramcharitmanas'?", hindi: "'रामचरितमानस' के लेखक:", options: ["कबीरदास", "तुलसीदास", "मीराबाई", "सूरदास"], answerIndex: 1, chapter: "साहित्य" },
    { english: "Number of vowels (swar) in Hindi:", hindi: "हिंदी में स्वरों की संख्या:", options: ["10", "11", "12", "13"], answerIndex: 1, chapter: "व्याकरण" },
  ],
  social: [
    { english: "First President of India:", hindi: "भारत के पहले राष्ट्रपति:", options: ["Nehru", "Patel", "Dr. Rajendra Prasad", "Ambedkar"], answerIndex: 2, chapter: "Polity" },
    { english: "'Sorrow of Bihar' river:", hindi: "'बिहार का शोक' नदी:", options: ["Ganga", "Kosi", "Son", "Gandak"], answerIndex: 1, chapter: "Geography" },
    { english: "India's independence date:", hindi: "भारतीय स्वतंत्रता दिवस:", options: ["26 Jan 1950", "15 Aug 1947", "2 Oct 1869", "14 Aug 1947"], answerIndex: 1, chapter: "History" },
    { english: "Tropic of Cancer passes through how many Indian states?", hindi: "कर्क रेखा कितने भारतीय राज्यों से गुजरती है?", options: ["6", "7", "8", "9"], answerIndex: 2, chapter: "Geography" },
    { english: "Largest continent in the world:", hindi: "विश्व का सबसे बड़ा महाद्वीप:", options: ["Africa", "North America", "Asia", "Europe"], answerIndex: 2, chapter: "Geography" },
  ],
  sanskrit: [
    { english: "What does 'नमस्ते' mean?", hindi: "'नमस्ते' का अर्थ:", options: ["Goodbye", "Hello / I bow to you", "Thank you", "Sorry"], answerIndex: 1, chapter: "शब्द-ज्ञान" },
    { english: "How many vowels are in Sanskrit?", hindi: "संस्कृत में स्वर:", options: ["10", "14", "16", "18"], answerIndex: 2, chapter: "व्याकरण" },
    { english: "'सूर्य' means:", hindi: "'सूर्य' का अर्थ:", options: ["Moon", "Star", "Sun", "Sky"], answerIndex: 2, chapter: "शब्द-ज्ञान" },
    { english: "Language family of Sanskrit:", hindi: "संस्कृत किस भाषा परिवार की है?", options: ["Dravidian", "Indo-European", "Sino-Tibetan", "Austroasiatic"], answerIndex: 1, chapter: "परिचय" },
    { english: "'अहम् पठामि' means:", hindi: "'अहम् पठामि' का अर्थ:", options: ["I eat", "I sleep", "I read", "I write"], answerIndex: 2, chapter: "वाक्य" },
  ],
};

// ─── Slide variants ───────────────────────────────────────────────────────────

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? "100%" : "-100%", opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit:  (dir: number) => ({ x: dir > 0 ? "-100%" : "100%", opacity: 0 }),
};

// ─── Magic ripple ─────────────────────────────────────────────────────────────

function MagicRipple({ color }: { color: string }) {
  return (
    <motion.span
      className="absolute inset-0 rounded-xl pointer-events-none"
      initial={{ opacity: 0.7, scale: 0.85 }}
      animate={{ opacity: 0, scale: 1.6 }}
      transition={{ duration: 0.7, ease: "easeOut" }}
      style={{ background: `radial-gradient(ellipse at center, ${color}60 0%, transparent 70%)` }}
    />
  );
}

// ─── Mode Select Screen ────────────────────────────────────────────────────────

function ModeSelect({
  meta, totalCount, savedProgress, onFull, onChapterWise, onResume,
}: {
  meta: { label: string; icon: string; accent: string };
  totalCount: number;
  savedProgress: SavedProgress | null;
  onFull: () => void;
  onChapterWise: () => void;
  onResume: () => void;
}) {
  const modes = [
    {
      id: "full",
      title: "Full Length Test",
      subtitle: `50 random questions from all ${totalCount}`,
      icon: "🎯",
      desc: "Covers the entire syllabus. Best for final revision.",
      onClick: onFull,
    },
    {
      id: "chapter",
      title: "Chapter-wise Test",
      subtitle: "20 random questions per chapter",
      icon: "📂",
      desc: "Focus on one chapter at a time. Perfect for targeted practice.",
      onClick: onChapterWise,
    },
  ];

  function formatRelativeTime(ts: number) {
    const diffMin = Math.round((Date.now() - ts) / 60000);
    if (diffMin < 1)  return "just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffH = Math.round(diffMin / 60);
    if (diffH < 24)   return `${diffH}h ago`;
    return `${Math.round(diffH / 24)}d ago`;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10" style={{ background: "#07080f" }}>
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: `radial-gradient(ellipse at 50% 0%, ${meta.accent}18 0%, transparent 60%)` }}
      />
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8 relative z-10"
      >
        <div className="text-5xl mb-3">{meta.icon}</div>
        <h2 className="text-3xl font-black text-white mb-1">{meta.label}</h2>
        <p className="text-white/40 text-sm">Choose your test mode</p>
      </motion.div>

      <div className="w-full max-w-sm flex flex-col gap-4 relative z-10">
        {/* Resume banner */}
        {savedProgress && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="rounded-2xl border p-4 flex items-center gap-4"
            style={{ background: `linear-gradient(135deg, ${meta.accent}22, ${meta.accent}08)`, borderColor: `${meta.accent}50`, boxShadow: `0 0 24px ${meta.accent}20` }}
          >
            <div className="text-2xl w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${meta.accent}25` }}>
              ⏸️
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-sm">Resume where you left off</p>
              <p className="text-xs mt-0.5" style={{ color: `${meta.accent}cc` }}>
                {savedProgress.mode === "full" ? "Full Test" : savedProgress.chapter}
                {" · "}Q{savedProgress.currentIndex + 1}/{savedProgress.questions.length}
                {" · "}{formatRelativeTime(savedProgress.timestamp)}
              </p>
            </div>
            <motion.button
              whileHover={{ scale: 1.07 }} whileTap={{ scale: 0.95 }}
              onClick={onResume}
              className="px-4 py-2 rounded-xl text-xs font-bold shrink-0"
              style={{ background: meta.accent, color: "#000" }}
            >
              Resume →
            </motion.button>
          </motion.div>
        )}

        {/* Mode cards */}
        {modes.map((mode, i) => (
          <motion.button
            key={mode.id}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.12, ease: [0.23, 1, 0.32, 1], duration: 0.5 }}
            whileHover={{ scale: 1.03, y: -3 }}
            whileTap={{ scale: 0.97 }}
            onClick={mode.onClick}
            className="relative overflow-hidden text-left rounded-2xl border p-5 group"
            style={{
              background: `linear-gradient(135deg, ${meta.accent}18, rgba(255,255,255,0.03))`,
              borderColor: `${meta.accent}30`,
              boxShadow: `0 4px 32px ${meta.accent}12`,
            }}
          >
            <div
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-2xl"
              style={{ background: `radial-gradient(ellipse at 50% 0%, ${meta.accent}18, transparent 70%)` }}
            />
            <div className="flex items-start gap-4 relative z-10">
              <div
                className="text-2xl w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: `${meta.accent}20` }}
              >
                {mode.icon}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-0.5">
                  <h3 className="text-white font-bold text-base">{mode.title}</h3>
                  <span className="text-white/30 group-hover:text-white/60 transition-colors text-lg">→</span>
                </div>
                <p className="text-xs font-semibold mb-1" style={{ color: meta.accent }}>{mode.subtitle}</p>
                <p className="text-white/40 text-xs leading-snug">{mode.desc}</p>
              </div>
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
}

// ─── Chapter Select Screen ─────────────────────────────────────────────────────

function ChapterSelect({
  meta, chapters, onBack, onSelect,
}: {
  meta: { label: string; icon: string; accent: string };
  chapters: { name: string; count: number }[];
  onBack: () => void;
  onSelect: (chapter: string) => void;
}) {
  return (
    <div className="min-h-screen px-4 py-6" style={{ background: "#07080f" }}>
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: `radial-gradient(ellipse at 50% 0%, ${meta.accent}15 0%, transparent 50%)` }}
      />
      <div className="max-w-sm mx-auto relative z-10">
        <div className="flex items-center gap-3 mb-8">
          <button onClick={onBack} className="text-white/40 hover:text-white/70 transition-colors text-xl p-1">←</button>
          <div>
            <p className="text-white/40 text-xs">Chapter-wise Test</p>
            <h2 className="text-white font-bold text-lg">{meta.label} — Pick a Chapter</h2>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {chapters.map((ch, i) => (
            <motion.button
              key={ch.name}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06, duration: 0.35 }}
              whileHover={{ scale: 1.02, x: 4 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => onSelect(ch.name)}
              className="relative overflow-hidden text-left rounded-xl border px-4 py-3.5 flex items-center gap-3 group"
              style={{
                background: "rgba(255,255,255,0.04)",
                borderColor: "rgba(255,255,255,0.08)",
              }}
            >
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-xl"
                style={{ background: `linear-gradient(90deg, ${meta.accent}18, transparent)` }}
              />
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
                style={{ background: `${meta.accent}20`, color: meta.accent }}
              >
                {i + 1}
              </div>
              <div className="flex-1 relative z-10">
                <p className="text-white font-semibold text-sm">{ch.name}</p>
                <p className="text-white/40 text-xs">{ch.count} questions</p>
              </div>
              <span className="text-white/30 group-hover:text-white/60 transition-colors relative z-10">→</span>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Result Screen ─────────────────────────────────────────────────────────────

function ResultScreen({
  questions, answers, accent, label, icon, isDemo, mode, chapter, onHome, onRetry,
}: {
  questions: Question[];
  answers: Record<number, number>;
  accent: string; label: string; icon: string; isDemo: boolean;
  mode: "full" | "chapter"; chapter: string;
  onHome: () => void; onRetry: () => void;
}) {
  const score = questions.reduce((acc, q, i) => acc + (answers[i] === q.answerIndex ? 1 : 0), 0);
  const pct   = Math.round((score / questions.length) * 100);
  const msg   = pct === 100 ? "Perfect! Outstanding! 🏆" : pct >= 80 ? "Excellent! ⭐" : pct >= 60 ? "Good effort! 💪" : "Keep going! 🌱";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
      className="min-h-screen w-full px-4 py-8" style={{ background: "#07080f" }}
    >
      <div className="max-w-lg mx-auto">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="text-center mb-6">
          <div className="text-4xl mb-2">{icon}</div>
          <h2 className="text-2xl font-bold text-white mb-0.5">{label} — Results</h2>
          <p className="text-white/40 text-xs mb-1">
            {mode === "full" ? "Full Length Test" : `Chapter: ${chapter}`}
          </p>
          <p className="text-white/40 text-sm">{msg}</p>
          {isDemo && (
            <span className="mt-2 text-xs px-3 py-1 rounded-full inline-block" style={{ background: `${accent}20`, color: accent }}>
              Demo questions — add yours to Firebase
            </span>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="rounded-2xl p-6 mb-5 text-center border"
          style={{ background: `linear-gradient(135deg, ${accent}22, ${accent}08)`, borderColor: `${accent}40`, boxShadow: `0 0 40px ${accent}20` }}
        >
          <p className="text-7xl font-black mb-1" style={{ background: `linear-gradient(135deg, #fff, ${accent})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            {score}/{questions.length}
          </p>
          <p className="text-white/50 text-sm">{pct}% correct</p>
          <div className="mt-4 h-2 rounded-full bg-white/10 overflow-hidden">
            <motion.div className="h-full rounded-full" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ delay: 0.4, duration: 0.8, ease: "easeOut" }}
              style={{ background: `linear-gradient(90deg, ${accent}, #fff)` }} />
          </div>
        </motion.div>

        <div className="flex gap-3 mb-6">
          <motion.button
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}
            whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            onClick={onRetry}
            className="flex-1 py-3 rounded-xl text-sm font-bold border"
            style={{ background: `${accent}20`, borderColor: `${accent}40`, color: accent }}
          >
            🔀 Retry Shuffled
          </motion.button>
          <motion.button
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
            whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            onClick={onHome}
            className="flex-1 py-3 rounded-xl text-sm font-bold border"
            style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)" }}
          >
            ← Dashboard
          </motion.button>
        </div>

        <div className="flex flex-col gap-4 mb-8">
          {questions.map((q, i) => {
            const userAnswer = answers[i] ?? -1;
            const isRight    = userAnswer === q.answerIndex;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.04 }}
                className="rounded-xl border p-4"
                style={{ background: isRight ? `${accent}12` : "rgba(255,255,255,0.04)", borderColor: isRight ? `${accent}40` : "rgba(255,255,255,0.08)" }}
              >
                <div className="flex items-start gap-2 mb-2">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full mt-0.5 shrink-0"
                    style={{ background: isRight ? `${accent}30` : "rgba(255,255,255,0.1)", color: isRight ? accent : "rgba(255,255,255,0.5)" }}>
                    {isRight ? "✓" : "✗"}
                  </span>
                  <p className="text-white/80 text-sm font-medium leading-snug">
                    {i + 1}. <MathText text={q.english} />
                  </p>
                </div>
                {q.hindi && <p className="text-white/35 text-xs mb-2 pl-1"><MathText text={q.hindi} /></p>}
                <div className="flex flex-col gap-1 pl-1">
                  {q.options.map((opt, oi) => {
                    const isCorrect = oi === q.answerIndex;
                    const isUser    = oi === userAnswer;
                    return (
                      <div key={oi} className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg"
                        style={{
                          background: isCorrect ? `${accent}25` : isUser && !isRight ? "rgba(255,255,255,0.08)" : "transparent",
                          color:      isCorrect ? accent : isUser && !isRight ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.28)",
                        }}>
                        <span className="font-bold w-4 shrink-0">{String.fromCharCode(65 + oi)}.</span>
                        <MathText text={opt} />
                        {isCorrect          && <span className="ml-auto font-semibold">✓ Answer</span>}
                        {isUser && !isRight && <span className="ml-auto">Your pick</span>}
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Main SubjectPage ─────────────────────────────────────────────────────────

type Screen = "loading" | "mode-select" | "chapter-select" | "quiz" | "result";

export default function SubjectPage() {
  const params  = useParams<{ subject: string }>();
  const [, navigate] = useLocation();
  const subject = params.subject ?? "";
  const meta    = subjectMeta[subject];

  // All questions fetched from Firebase (or demo)
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [isDemo, setIsDemo]             = useState(false);
  const [screen, setScreen]             = useState<Screen>("loading");

  // Saved progress (from localStorage)
  const [savedProgress, setSavedProgress] = useState<SavedProgress | null>(null);

  // Test config chosen by user
  const [mode, setMode]           = useState<"full" | "chapter">("full");
  const [selectedChapter, setSelectedChapter] = useState("");

  // Active quiz state
  const [questions, setQuestions]       = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers]           = useState<Record<number, number>>({});
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [rippleKey, setRippleKey]       = useState(0);
  const [direction, setDirection]       = useState(1);

  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  // ── Fetch questions ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!meta) {
      const fallback = demoQuestions[subject] ?? demoQuestions.maths;
      setAllQuestions(fallback);
      setIsDemo(true);
      setSavedProgress(loadProgress(subject));
      setScreen("mode-select");
      return;
    }

    setScreen("loading");
    const controller = new AbortController();
    const dbUrl = `https://shiken-d8789-default-rtdb.firebaseio.com/${encodeURIComponent(meta.path)}.json`;

    fetch(dbUrl, { signal: controller.signal })
      .then((r) => r.json())
      .then((data: unknown) => {
        if (!mountedRef.current) return;
        const parsed = data ? parseQuestions(data) : [];
        if (parsed.length > 0) {
          setAllQuestions(parsed);
          setIsDemo(false);
        } else {
          setAllQuestions(demoQuestions[subject] ?? demoQuestions.maths);
          setIsDemo(true);
        }
        setSavedProgress(loadProgress(subject));
        setScreen("mode-select");
      })
      .catch((err: Error) => {
        if (err.name === "AbortError" || !mountedRef.current) return;
        setAllQuestions(demoQuestions[subject] ?? demoQuestions.maths);
        setIsDemo(true);
        setSavedProgress(loadProgress(subject));
        setScreen("mode-select");
      });

    return () => controller.abort();
  }, [subject]);

  // ── Derived data ─────────────────────────────────────────────────────────────
  const chapters = (() => {
    const map = new Map<string, number>();
    allQuestions.forEach((q) => map.set(q.chapter, (map.get(q.chapter) ?? 0) + 1));
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  })();

  // ── Persist helper (called after any state mutation) ─────────────────────────
  function persist(opts: {
    qs?: Question[]; idx?: number; ans?: Record<number, number>;
    m?: "full" | "chapter"; ch?: string;
  }) {
    const snap: SavedProgress = {
      mode:         opts.m   ?? mode,
      chapter:      opts.ch  ?? selectedChapter,
      questions:    opts.qs  ?? questions,
      currentIndex: opts.idx ?? currentIndex,
      answers:      opts.ans ?? answers,
      timestamp:    Date.now(),
    };
    saveProgress(subject, snap);
  }

  // ── Start quiz helpers ────────────────────────────────────────────────────────
  function startFullTest() {
    clearProgress(subject);
    setSavedProgress(null);
    setMode("full");
    setSelectedChapter("All Chapters");
    const picked = pick(allQuestions, 50);
    setQuestions(picked);
    setCurrentIndex(0);
    setAnswers({});
    setSelectedOption(null);
    setRippleKey(0);
    setDirection(1);
    saveProgress(subject, { mode: "full", chapter: "All Chapters", questions: picked, currentIndex: 0, answers: {}, timestamp: Date.now() });
    setScreen("quiz");
  }

  function startChapterTest(chapter: string) {
    clearProgress(subject);
    setSavedProgress(null);
    setMode("chapter");
    setSelectedChapter(chapter);
    const pool   = allQuestions.filter((q) => q.chapter === chapter);
    const picked = pick(pool, 20);
    setQuestions(picked);
    setCurrentIndex(0);
    setAnswers({});
    setSelectedOption(null);
    setRippleKey(0);
    setDirection(1);
    saveProgress(subject, { mode: "chapter", chapter, questions: picked, currentIndex: 0, answers: {}, timestamp: Date.now() });
    setScreen("quiz");
  }

  function handleResume() {
    if (!savedProgress) return;
    setMode(savedProgress.mode);
    setSelectedChapter(savedProgress.chapter);
    setQuestions(savedProgress.questions);
    setCurrentIndex(savedProgress.currentIndex);
    setAnswers(savedProgress.answers);
    setSelectedOption(savedProgress.answers[savedProgress.currentIndex] ?? null);
    setRippleKey(0);
    setDirection(1);
    setScreen("quiz");
  }

  function resetQuizState() {
    setCurrentIndex(0);
    setAnswers({});
    setSelectedOption(null);
    setRippleKey(0);
    setDirection(1);
  }

  function retryTest() {
    if (mode === "full") { startFullTest(); }
    else { startChapterTest(selectedChapter); }
  }

  // ── Quiz handlers ─────────────────────────────────────────────────────────────
  const handleSelect = (oi: number) => {
    if (selectedOption !== null) return;
    setSelectedOption(oi);
    setRippleKey((k) => k + 1);
    const newAnswers = { ...answers, [currentIndex]: oi };
    setAnswers(newAnswers);
    persist({ ans: newAnswers });
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setDirection(1);
      const next = currentIndex + 1;
      setCurrentIndex(next);
      setSelectedOption(answers[next] ?? null);
      persist({ idx: next });
    } else {
      clearProgress(subject);
      setSavedProgress(null);
      setScreen("result");
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setDirection(-1);
      const prev = currentIndex - 1;
      setCurrentIndex(prev);
      setSelectedOption(answers[prev] ?? null);
      persist({ idx: prev });
    }
  };

  // ── Render guards ─────────────────────────────────────────────────────────────
  if (!meta) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#07080f" }}>
        <p className="text-white/50">Subject not found.</p>
      </div>
    );
  }

  if (screen === "loading") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: "#07080f" }}>
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-10 h-10 rounded-full border-2 border-transparent"
          style={{ borderTopColor: meta.accent, borderRightColor: `${meta.accent}50` }} />
        <p className="text-white/40 text-sm">Loading {meta.label} questions...</p>
      </div>
    );
  }

  if (screen === "mode-select") {
    return (
      <ModeSelect
        meta={meta}
        totalCount={allQuestions.length}
        savedProgress={savedProgress}
        onFull={startFullTest}
        onChapterWise={() => setScreen("chapter-select")}
        onResume={handleResume}
      />
    );
  }

  if (screen === "chapter-select") {
    return (
      <ChapterSelect
        meta={meta}
        chapters={chapters}
        onBack={() => setScreen("mode-select")}
        onSelect={startChapterTest}
      />
    );
  }

  if (screen === "result") {
    return (
      <ResultScreen
        questions={questions} answers={answers}
        accent={meta.accent} label={meta.label} icon={meta.icon}
        isDemo={isDemo} mode={mode} chapter={selectedChapter}
        onHome={() => navigate("/")} onRetry={retryTest}
      />
    );
  }

  // ── Quiz screen ───────────────────────────────────────────────────────────────
  const q        = questions[currentIndex];
  const progress = ((currentIndex + 1) / questions.length) * 100;
  const magicColors = ["#f59e0b", "#06b6d4"];
  const magicColor  = magicColors[rippleKey % 2];

  return (
    <div className="min-h-screen w-full overflow-hidden relative" style={{ background: "#07080f" }}>
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-32 -left-32 w-80 h-80 rounded-full blur-3xl opacity-15"
          style={{ background: `radial-gradient(circle, ${meta.accent}, transparent)` }} />
        <div className="absolute -bottom-20 -right-20 w-64 h-64 rounded-full blur-3xl opacity-10"
          style={{ background: `radial-gradient(circle, ${meta.accent}, transparent)` }} />
      </div>

      <div className="relative z-10 max-w-lg mx-auto px-4 py-6 flex flex-col min-h-screen">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => setScreen("mode-select")} className="text-white/40 hover:text-white/70 transition-colors p-1 text-xl">←</button>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-lg">{meta.icon}</span>
              <span className="text-white font-bold text-sm">{meta.label}</span>
              <span
                className="text-xs px-2 py-0.5 rounded-full"
                style={{ background: `${meta.accent}20`, color: meta.accent }}
              >
                {mode === "full" ? "Full Test" : selectedChapter}
              </span>
              <span className="ml-auto text-white/40 text-xs">{currentIndex + 1} / {questions.length}</span>
            </div>
            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
              <motion.div className="h-full rounded-full" animate={{ width: `${progress}%` }} transition={{ duration: 0.4, ease: "easeOut" }}
                style={{ background: `linear-gradient(90deg, ${meta.accent}, ${meta.accent}80)` }} />
            </div>
          </div>
        </div>

        {/* Question + Options */}
        <div className="flex-1 flex flex-col">
          <div className="relative overflow-hidden flex-1">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={currentIndex} custom={direction}
                variants={slideVariants} initial="enter" animate="center" exit="exit"
                transition={{ duration: 0.38, ease: [0.23, 1, 0.32, 1] }}
                className="w-full"
              >
                {/* Chapter badge */}
                {q.chapter && mode === "full" && (
                  <div className="mb-3">
                    <span className="text-xs px-2.5 py-1 rounded-full"
                      style={{ background: `${meta.accent}15`, color: `${meta.accent}cc`, border: `1px solid ${meta.accent}25` }}>
                      {q.chapter}
                    </span>
                  </div>
                )}

                {/* Question card */}
                <div className="rounded-2xl p-5 mb-4 border"
                  style={{ background: `linear-gradient(135deg, ${meta.accent}18, rgba(255,255,255,0.03))`, borderColor: `${meta.accent}30`, boxShadow: `0 4px 32px ${meta.accent}15` }}>
                  <p className="text-white font-semibold text-base leading-relaxed mb-2">
                    {currentIndex + 1}. <MathText text={q.english} />
                  </p>
                  {q.hindi && (
                    <p className="text-white/50 text-sm leading-relaxed"><MathText text={q.hindi} /></p>
                  )}
                </div>

                {/* Options */}
                <div className="flex flex-col gap-3">
                  {q.options.map((opt, oi) => {
                    const isSelected = selectedOption === oi;
                    return (
                      <motion.button
                        key={oi}
                        onClick={() => handleSelect(oi)}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: oi * 0.07, duration: 0.35 }}
                        whileHover={selectedOption === null ? { scale: 1.02, x: 4 } : {}}
                        whileTap={selectedOption === null ? { scale: 0.98 } : {}}
                        className="relative w-full text-left rounded-xl border px-4 py-3.5 flex items-center gap-3 overflow-hidden transition-colors duration-200"
                        style={{
                          background:   isSelected ? `linear-gradient(135deg, ${magicColor}28, ${magicColor}10)` : "rgba(255,255,255,0.04)",
                          borderColor:  isSelected ? `${magicColor}60` : "rgba(255,255,255,0.08)",
                          cursor:       selectedOption !== null ? "default" : "pointer",
                          boxShadow:    isSelected ? `0 0 20px ${magicColor}25` : "none",
                        }}
                      >
                        {isSelected && <MagicRipple key={rippleKey} color={magicColor} />}
                        {isSelected && (
                          <motion.div className="absolute inset-0 rounded-xl pointer-events-none"
                            initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0.5] }} transition={{ duration: 0.6 }}
                            style={{ background: `radial-gradient(ellipse at 50% 50%, ${magicColor}18, transparent 70%)` }} />
                        )}
                        <span className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
                          style={{ background: isSelected ? `${magicColor}40` : "rgba(255,255,255,0.08)", color: isSelected ? magicColor : "rgba(255,255,255,0.4)" }}>
                          {String.fromCharCode(65 + oi)}
                        </span>
                        <span className="text-sm font-medium leading-snug" style={{ color: isSelected ? "#fff" : "rgba(255,255,255,0.65)" }}>
                          <MathText text={opt} />
                        </span>
                      </motion.button>
                    );
                  })}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Nav buttons */}
          <div className="flex gap-3 mt-5 pb-4">
            {currentIndex > 0 && (
              <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={handlePrev}
                className="flex-1 py-3.5 rounded-xl text-sm font-semibold border"
                style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)" }}>
                ← Prev
              </motion.button>
            )}
            <motion.button
              whileHover={selectedOption !== null ? { scale: 1.03 } : {}}
              whileTap={selectedOption  !== null ? { scale: 0.97 } : {}}
              onClick={handleNext} disabled={selectedOption === null}
              className="flex-[2] py-3.5 rounded-xl text-sm font-bold transition-all duration-300"
              style={{
                background:  selectedOption !== null ? `linear-gradient(135deg, ${meta.accent}, ${meta.accent}80)` : "rgba(255,255,255,0.06)",
                color:       selectedOption !== null ? "#fff" : "rgba(255,255,255,0.25)",
                boxShadow:   selectedOption !== null ? `0 4px 20px ${meta.accent}40` : "none",
                cursor:      selectedOption === null ? "not-allowed" : "pointer",
              }}>
              {currentIndex < questions.length - 1 ? "Next Question →" : "See Results ✦"}
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  );
}
