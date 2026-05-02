import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { db as _db } from "../firebase.js"; void _db;
import { useParams, useLocation } from "wouter";
import MathText from "@/components/MathText";
import ExplainText from "@/components/ExplainText";

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
  mode: "full" | "chapter" | "ai";
  chapter: string;
  questions: Question[];
  currentIndex: number;
  answers: Record<number, number>;
  timestamp: number;
  timerLeft?: number;
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

// ─── Bookmark persistence ──────────────────────────────────────────────────────

function bookmarkKey(subject: string) { return `shiken_bookmarks_${subject}`; }

function loadBookmarks(subject: string): Question[] {
  try {
    const raw = localStorage.getItem(bookmarkKey(subject));
    if (!raw) return [];
    return JSON.parse(raw) as Question[];
  } catch { return []; }
}

function isBookmarked(bookmarks: Question[], q: Question): boolean {
  return bookmarks.some((b) => b.english === q.english);
}

function toggleBookmark(subject: string, bookmarks: Question[], q: Question): Question[] {
  const next = isBookmarked(bookmarks, q)
    ? bookmarks.filter((b) => b.english !== q.english)
    : [q, ...bookmarks];
  try { localStorage.setItem(bookmarkKey(subject), JSON.stringify(next)); } catch { /* quota */ }
  return next;
}

// ─── Audio alerts (Web Audio API — no external deps) ──────────────────────────

function playBeep(
  frequency: number,
  duration: number,
  count = 1,
  gapMs = 140,
  volume = 0.28,
) {
  try {
    const AudioCtx = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const schedule = (when: number) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0, when);
      gain.gain.linearRampToValueAtTime(volume, when + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
      osc.start(when);
      osc.stop(when + duration + 0.02);
    };
    for (let i = 0; i < count; i++) {
      schedule(ctx.currentTime + i * (duration + gapMs / 1000));
    }
    // Auto-close context after all beeps finish
    setTimeout(() => ctx.close(), (count * (duration + gapMs / 1000) + 0.5) * 1000);
  } catch { /* AudioContext blocked or unsupported — silent fallback */ }
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

// Resolves the correct answer index across all Firebase schemas
function resolveAnswerIndex(q: Record<string, unknown>, opts: string[]): number {
  const raw = q.correct_answer ?? q.answer;

  // Numeric index (e.g. English, Social Science: answer=0,1,2,3)
  if (typeof raw === "number") return Math.max(0, Math.min(raw, opts.length - 1));

  const s = String(raw ?? "").trim();

  // Numeric string "0","1","2","3"
  const asNum = Number(s);
  if (s !== "" && !isNaN(asNum) && Number.isInteger(asNum)) {
    return Math.max(0, Math.min(asNum, opts.length - 1));
  }

  // Single letter key e.g. "A","B","C","D" (Maths/Science object options)
  if (/^[A-Da-d]$/.test(s)) {
    if (!Array.isArray(q.options) && q.options && typeof q.options === "object") {
      const keys = Object.keys(q.options as object).sort();
      const idx = keys.findIndex((k) => k.toUpperCase() === s.toUpperCase());
      return idx >= 0 ? idx : 0;
    }
    return s.toUpperCase().charCodeAt(0) - 65;
  }

  // "(D) 1908 ई॰ में" format (Hindi — extract the letter)
  const letterMatch = s.match(/^\(([A-D])\)/i);
  if (letterMatch) return letterMatch[1].toUpperCase().charCodeAt(0) - 65;

  // Full text match fallback
  const textIdx = opts.findIndex((o) => o === s || o.includes(s) || s.includes(o));
  return textIdx >= 0 ? textIdx : 0;
}

function parseQuestions(data: unknown): Question[] {
  const raw =
    typeof data === "object" && data !== null && !Array.isArray(data)
      ? Object.values(data as Record<string, unknown>)
      : Array.isArray(data) ? data : [];

  return (raw as Record<string, unknown>[]).map((q) => {
    // ── Options ──────────────────────────────────────────────────────────────
    let opts: string[] = [];
    if (Array.isArray(q.options)) {
      opts = (q.options as unknown[]).map(String);
    } else if (q.options && typeof q.options === "object") {
      const optObj = q.options as Record<string, string>;
      opts = Object.keys(optObj).sort().map((k) => optObj[k]);
    }

    // ── Answer index ──────────────────────────────────────────────────────────
    const answerIndex = resolveAnswerIndex(q, opts);

    // Strip leading "(A)/(B)/(C)/(D)" prefixes from options (Hindi schema)
    // so the quiz UI's own A/B/C/D labels aren't duplicated
    opts = opts.map((o) => o.replace(/^\([A-Da-d]\)\s*/, "").trim());

    // ── Question text ─────────────────────────────────────────────────────────
    // english: question_english > question > english
    // hindi:   question_hindi   > question_hi > hindi
    const english = String(q.question_english ?? q.question  ?? q.english ?? "");
    const hindi   = String(q.question_hindi   ?? q.question_hi ?? q.hindi ?? "");

    // ── Chapter ───────────────────────────────────────────────────────────────
    const chapter = String(q.chapter ?? q.chapter_name ?? "General");

    return { english, hindi, options: opts, answerIndex, chapter };
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
  meta, totalCount, savedProgress, onFull, onChapterWise, onAI, onSaved, onResume, savedCount,
}: {
  meta: { label: string; icon: string; accent: string };
  totalCount: number;
  savedProgress: SavedProgress | null;
  onFull: () => void;
  onChapterWise: () => void;
  onAI: () => void;
  onSaved: () => void;
  onResume: () => void;
  savedCount: number;
}) {
  const modes = [
    {
      id: "full",
      title: "Full Length Test",
      subtitle: `50 random questions from all ${totalCount}`,
      icon: "🎯",
      desc: "Covers the entire syllabus. Best for final revision. ⏱ 60 min",
      onClick: onFull,
      glowColor: meta.accent,
    },
    {
      id: "chapter",
      title: "Chapter-wise Test",
      subtitle: "20 random questions per chapter",
      icon: "📂",
      desc: "Focus on one chapter at a time. Perfect for targeted practice. ⏱ 20 min",
      onClick: onChapterWise,
      glowColor: meta.accent,
    },
    {
      id: "ai",
      title: "AI Practice",
      subtitle: "5 fresh AI-generated questions",
      icon: "🤖",
      desc: "Gemini बनाएगा नए सवाल तुम्हारे लिए। हर बार अलग, हर बार नया! ⚡ Free",
      onClick: onAI,
      glowColor: "#6366f1",
    },
  ];

  const hasSaved = savedCount > 0;

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

        {/* Saved Questions button */}
        {hasSaved && (
          <motion.button
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05, duration: 0.4 }}
            whileHover={{ scale: 1.02, y: -2 }} whileTap={{ scale: 0.97 }}
            onClick={onSaved}
            className="relative overflow-hidden text-left rounded-2xl border p-4 flex items-center gap-4 group"
            style={{ background: "linear-gradient(135deg,rgba(251,191,36,0.1),rgba(251,191,36,0.03))", borderColor: "rgba(251,191,36,0.3)", boxShadow: "0 4px 28px rgba(251,191,36,0.1)" }}
          >
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-2xl"
              style={{ background: "radial-gradient(ellipse at 50% 0%,rgba(251,191,36,0.14),transparent 70%)" }} />
            <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0"
              style={{ background: "rgba(251,191,36,0.15)" }}>⭐</div>
            <div className="flex-1 relative z-10">
              <p className="text-white font-bold text-sm">Saved Questions</p>
              <p className="text-xs" style={{ color: "rgba(251,191,36,0.8)" }}>{savedCount} question{savedCount !== 1 ? "s" : ""} bookmarked • Revise anytime</p>
            </div>
            <span className="text-white/30 group-hover:text-white/60 transition-colors relative z-10 text-lg">→</span>
          </motion.button>
        )}

        {/* Mode cards */}
        {modes.map((m, i) => (
          <motion.button
            key={m.id}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.12, ease: [0.23, 1, 0.32, 1], duration: 0.5 }}
            whileHover={{ scale: 1.03, y: -3 }}
            whileTap={{ scale: 0.97 }}
            onClick={m.onClick}
            className="relative overflow-hidden text-left rounded-2xl border p-5 group"
            style={{
              background: `linear-gradient(135deg, ${m.glowColor}18, rgba(255,255,255,0.03))`,
              borderColor: `${m.glowColor}30`,
              boxShadow: `0 4px 32px ${m.glowColor}12`,
            }}
          >
            {m.id === "ai" && (
              <div className="absolute top-2 right-2 text-xs px-2 py-0.5 rounded-full font-bold"
                style={{ background: "#6366f130", color: "#a5b4fc" }}>
                NEW ✨
              </div>
            )}
            <div
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-2xl"
              style={{ background: `radial-gradient(ellipse at 50% 0%, ${m.glowColor}18, transparent 70%)` }}
            />
            <div className="flex items-start gap-4 relative z-10">
              <div
                className="text-2xl w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: `${m.glowColor}20` }}
              >
                {m.icon}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-0.5">
                  <h3 className="text-white font-bold text-base">{m.title}</h3>
                  <span className="text-white/30 group-hover:text-white/60 transition-colors text-lg">→</span>
                </div>
                <p className="text-xs font-semibold mb-1" style={{ color: m.glowColor }}>{m.subtitle}</p>
                <p className="text-white/40 text-xs leading-snug">{m.desc}</p>
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
  questions, answers, accent, label, icon, isDemo, mode, chapter, subject, onHome, onRetry,
}: {
  questions: Question[];
  answers: Record<number, number>;
  accent: string; label: string; icon: string; isDemo: boolean;
  mode: "full" | "chapter" | "ai"; chapter: string; subject: string;
  onHome: () => void; onRetry: () => void;
}) {
  const score = questions.reduce((acc, q, i) => acc + (answers[i] === q.answerIndex ? 1 : 0), 0);
  const pct   = Math.round((score / questions.length) * 100);
  const msg   = pct === 100 ? "Perfect! Outstanding! 🏆" : pct >= 80 ? "Excellent! ⭐" : pct >= 60 ? "Good effort! 💪" : "Keep going! 🌱";

  // Bookmarks (local state — syncs with localStorage)
  const [bmks, setBmks] = useState<Question[]>(() => loadBookmarks(subject));
  const bmkToggle = (q: Question) => setBmks((prev) => toggleBookmark(subject, prev, q));

  // Per-question explanation state
  const [explainTexts,   setExplainTexts]   = useState<Record<number, string>>({});
  const [explainLoading, setExplainLoading] = useState<number | null>(null);
  const [explainOpen,    setExplainOpen]    = useState<Record<number, boolean>>({});

  async function fetchExplain(i: number, q: Question) {
    if (explainLoading !== null) return;
    setExplainOpen((o) => ({ ...o, [i]: true }));
    if (explainTexts[i]) return; // already fetched
    setExplainLoading(i);
    setExplainTexts((t) => ({ ...t, [i]: "" }));
    try {
      const resp = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionEnglish: q.english,
          questionHindi: q.hindi || "",
          options: q.options,
          correctAnswer: q.options[q.answerIndex] ?? "",
          subject: label,
        }),
      });
      const reader = resp.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error("No stream");
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const payload = JSON.parse(line.slice(6));
            if (payload.content) setExplainTexts((t) => ({ ...t, [i]: (t[i] ?? "") + payload.content }));
          } catch { /* skip */ }
        }
      }
    } catch {
      setExplainTexts((t) => ({ ...t, [i]: "Explanation नहीं मिली 🙏" }));
    } finally {
      setExplainLoading(null);
    }
  }

  // AI analysis state
  const [analysisOpen,    setAnalysisOpen]    = useState(false);
  const [analysisText,    setAnalysisText]    = useState("");
  const [analysisLoading, setAnalysisLoading] = useState(false);

  async function fetchAnalysis() {
    if (analysisLoading) return;
    setAnalysisOpen(true);
    setAnalysisText("");
    setAnalysisLoading(true);
    const wrong = questions
      .map((q, i) => ({
        questionEnglish: q.english,
        correctAnswer: q.options[q.answerIndex] ?? "",
        userAnswer: answers[i] !== undefined ? (q.options[answers[i]] ?? "") : undefined,
      }))
      .filter((_, i) => answers[i] !== questions[i].answerIndex);
    try {
      const resp = await fetch("/api/analyze-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, score, total: questions.length, mode, chapter, wrong }),
      });
      const reader = resp.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error("No stream");
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const payload = JSON.parse(line.slice(6));
            if (payload.content) setAnalysisText((t) => t + payload.content);
            if (payload.error)   setAnalysisText((t) => t + payload.error);
          } catch { /* skip */ }
        }
      }
    } catch {
      setAnalysisText("Analysis में दिक्कत आई। फिर से try करो 🙏");
    } finally {
      setAnalysisLoading(false);
    }
  }

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

        <div className="flex gap-3 mb-4">
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

        {/* ── AI Test Analysis ─────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
          className="mb-6"
        >
          <motion.button
            onClick={() => analysisOpen ? setAnalysisOpen(false) : fetchAnalysis()}
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
            className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-2xl border text-sm font-bold"
            style={{
              background: analysisOpen ? "linear-gradient(135deg,#6366f128,#8b5cf628)" : "rgba(99,102,241,0.12)",
              borderColor: analysisOpen ? "#6366f155" : "rgba(99,102,241,0.3)",
              color: "#a5b4fc",
              boxShadow: analysisOpen ? "0 0 30px rgba(99,102,241,0.2)" : "none",
            }}
          >
            <span className="text-lg">{analysisLoading ? "⏳" : "🧠"}</span>
            {analysisLoading ? "AI विश्लेषण कर रहा है..." : analysisOpen ? "विश्लेषण बंद करो ↑" : "AI से Test विश्लेषण लो (Hindi में)"}
          </motion.button>

          <AnimatePresence>
            {analysisOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.45, ease: [0.23, 1, 0.32, 1] }}
                className="overflow-hidden"
              >
                <div className="mt-3 rounded-2xl border p-5"
                  style={{ background: "linear-gradient(135deg,rgba(99,102,241,0.1),rgba(139,92,246,0.06))", borderColor: "rgba(99,102,241,0.22)", boxShadow: "0 4px 40px rgba(99,102,241,0.12)" }}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xl">🧠</span>
                    <span className="text-sm font-bold text-indigo-300">AI Teacher — Personal Analysis</span>
                    <span className="text-xs text-white/25 ml-auto">Gemini · Hindi</span>
                  </div>
                  {analysisText ? (
                    <div className="text-sm leading-relaxed text-white/85 whitespace-pre-wrap">
                      {analysisText}
                      {analysisLoading && (
                        <motion.span animate={{ opacity: [1, 0, 1] }} transition={{ repeat: Infinity, duration: 0.8 }}
                          className="inline-block w-1.5 h-4 bg-indigo-400 rounded-sm ml-0.5 align-middle" />
                      )}
                    </div>
                  ) : analysisLoading ? (
                    <div className="flex items-center gap-3 py-3">
                      <div className="flex gap-1">
                        {[0,1,2].map((i) => (
                          <motion.div key={i} animate={{ y: [0,-6,0] }} transition={{ repeat: Infinity, duration: 0.7, delay: i*0.15 }}
                            className="w-2 h-2 rounded-full bg-indigo-400" />
                        ))}
                      </div>
                      <span className="text-xs text-white/40">तुम्हारे results analyse कर रहा हूँ...</span>
                    </div>
                  ) : null}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        <div className="flex flex-col gap-4 mb-8">
          {questions.map((q, i) => {
            const userAnswer  = answers[i] ?? -1;
            const isRight     = userAnswer === q.answerIndex;
            const isSkipped   = userAnswer === -1;
            const isExOpen    = explainOpen[i] ?? false;
            const isExLoading = explainLoading === i;
            const exText      = explainTexts[i] ?? "";
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.04 }}
                className="rounded-xl border p-4"
                style={{
                  background: isRight ? `${accent}12` : isSkipped ? "rgba(255,255,255,0.03)" : "rgba(255,80,80,0.06)",
                  borderColor: isRight ? `${accent}40` : isSkipped ? "rgba(255,255,255,0.07)" : "rgba(255,80,80,0.18)",
                }}
              >
                <div className="flex items-start gap-2 mb-2">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full mt-0.5 shrink-0"
                    style={{
                      background: isRight ? `${accent}30` : isSkipped ? "rgba(255,255,255,0.1)" : "rgba(255,80,80,0.2)",
                      color: isRight ? accent : isSkipped ? "rgba(255,255,255,0.4)" : "#f87171",
                    }}>
                    {isRight ? "✓" : isSkipped ? "–" : "✗"}
                  </span>
                  <p className="text-white/80 text-sm font-medium leading-snug flex-1">
                    {i + 1}. <MathText text={q.english} />
                  </p>
                  <motion.button
                    onClick={() => bmkToggle(q)}
                    whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.82 }}
                    className="text-base leading-none shrink-0 ml-1"
                    title={isBookmarked(bmks, q) ? "Remove bookmark" : "Bookmark"}
                  >
                    {isBookmarked(bmks, q) ? "⭐" : "☆"}
                  </motion.button>
                </div>
                {q.hindi && <p className="text-white/35 text-xs mb-2 pl-1"><MathText text={q.hindi} /></p>}
                <div className="flex flex-col gap-1 pl-1 mb-3">
                  {q.options.map((opt, oi) => {
                    const isCorrect = oi === q.answerIndex;
                    const isUser    = oi === userAnswer;
                    return (
                      <div key={oi} className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg"
                        style={{
                          background: isCorrect ? `${accent}25` : isUser && !isRight ? "rgba(255,80,80,0.12)" : "transparent",
                          color:      isCorrect ? accent : isUser && !isRight ? "#f87171" : "rgba(255,255,255,0.28)",
                        }}>
                        <span className="font-bold w-4 shrink-0">{String.fromCharCode(65 + oi)}.</span>
                        <MathText text={opt} />
                        {isCorrect          && <span className="ml-auto font-semibold">✓ Correct</span>}
                        {isUser && !isRight && <span className="ml-auto">Your pick</span>}
                      </div>
                    );
                  })}
                </div>

                {/* ── Per-question AI Explain ── */}
                <motion.button
                  onClick={() => isExOpen
                    ? setExplainOpen((o) => ({ ...o, [i]: false }))
                    : fetchExplain(i, q)}
                  whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
                  disabled={explainLoading !== null && !isExLoading}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-semibold transition-all"
                  style={{
                    background: isExOpen ? "rgba(99,102,241,0.14)" : "rgba(99,102,241,0.06)",
                    borderColor: isExOpen ? "rgba(99,102,241,0.35)" : "rgba(99,102,241,0.18)",
                    color: isExLoading ? "#a5b4fc" : "#818cf8",
                    opacity: explainLoading !== null && !isExLoading ? 0.4 : 1,
                    cursor: explainLoading !== null && !isExLoading ? "not-allowed" : "pointer",
                  }}
                >
                  <span>{isExLoading ? "⏳" : "🤖"}</span>
                  <span>
                    {isExLoading ? "Explanation आ रही है..." : isExOpen ? "Explanation छुपाओ ↑" : "Explain करो (Hindi)"}
                  </span>
                  {!isExLoading && !isExOpen && <span className="ml-auto text-white/20 text-xs">Gemini ✦</span>}
                </motion.button>

                <AnimatePresence>
                  {isExOpen && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
                      className="overflow-hidden"
                    >
                      <div className="mt-2 px-3 py-3 rounded-lg border"
                        style={{ background: "rgba(99,102,241,0.07)", borderColor: "rgba(99,102,241,0.2)" }}>
                        {(exText || isExLoading) ? (
                          <ExplainText text={exText} loading={isExLoading} />
                        ) : null}
                        {!exText && isExLoading && (
                          <div className="flex items-center gap-2 py-1">
                            {[0, 1, 2].map((j) => (
                              <motion.div key={j} animate={{ y: [0, -4, 0] }}
                                transition={{ repeat: Infinity, duration: 0.6, delay: j * 0.12 }}
                                className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                            ))}
                            <span className="text-xs text-white/35 ml-1">समझा रहा हूँ...</span>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Main SubjectPage ─────────────────────────────────────────────────────────

type Screen = "loading" | "mode-select" | "chapter-select" | "ai-chapter-select" | "ai-generating" | "quiz" | "result" | "saved-questions";

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
  const [mode, setMode]           = useState<"full" | "chapter" | "ai">("full");
  const [selectedChapter, setSelectedChapter] = useState("");

  // Active quiz state
  const [questions, setQuestions]       = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers]           = useState<Record<number, number>>({});
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [rippleKey, setRippleKey]       = useState(0);
  const [direction, setDirection]       = useState(1);

  // Timer state: -1 = not started, 0 = expired, >0 = seconds remaining
  const FULL_TIMER    = 60 * 60; // 60 min
  const CHAPTER_TIMER = 20 * 60; // 20 min
  const [timerLeft, setTimerLeft]   = useState(-1);
  const [timerHidden, setTimerHidden] = useState(false);

  // Question palette
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Bookmarks
  const [bookmarks, setBookmarks] = useState<Question[]>(() => loadBookmarks(subject));


  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  // ── Timer countdown (setTimeout pattern: re-fires each second) ────────────────
  useEffect(() => {
    if (screen !== "quiz" || timerLeft <= 0) return;
    const id = setTimeout(() => setTimerLeft((t) => t - 1), 1000);
    return () => clearTimeout(id);
  }, [timerLeft, screen]);

  // ── Auto-submit when timer expires ────────────────────────────────────────────
  useEffect(() => {
    if (screen !== "quiz" || timerLeft !== 0) return;
    clearProgress(subject);
    setSavedProgress(null);
    setScreen("result");
  }, [timerLeft, screen]);

  // ── Sound alerts ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (screen !== "quiz" || timerLeft < 0) return;
    if (timerLeft === 300) {
      // 5-minute warning: two calm double-tone beeps (low → high)
      playBeep(520, 0.18, 1);
      setTimeout(() => playBeep(700, 0.22, 1), 260);
    } else if (timerLeft === 60) {
      // 1-minute alert: three urgent ascending beeps
      playBeep(700, 0.14, 1);
      setTimeout(() => playBeep(850, 0.14, 1), 210);
      setTimeout(() => playBeep(1020, 0.20, 1), 420);
    } else if (timerLeft <= 10 && timerLeft > 0) {
      // Final 10-second tick: short sharp click each second
      playBeep(880, 0.07, 1, 0, 0.18);
    } else if (timerLeft === 0) {
      // Time's up: low descending chord
      playBeep(600, 0.25, 1);
      setTimeout(() => playBeep(440, 0.35, 1), 280);
    }
  }, [timerLeft, screen]);

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
    const dbPath = meta.path.toLowerCase(); // always lowercase; "social science" keeps its space
    const dbUrl  = `https://shiken-d8789-default-rtdb.firebaseio.com/${encodeURIComponent(dbPath)}.json`;

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
      timerLeft:    timerLeft > 0 ? timerLeft : undefined,
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
    setTimerLeft(FULL_TIMER);
    setTimerHidden(false);
    saveProgress(subject, { mode: "full", chapter: "All Chapters", questions: picked, currentIndex: 0, answers: {}, timestamp: Date.now(), timerLeft: FULL_TIMER });
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
    setTimerLeft(CHAPTER_TIMER);
    setTimerHidden(false);
    saveProgress(subject, { mode: "chapter", chapter, questions: picked, currentIndex: 0, answers: {}, timestamp: Date.now(), timerLeft: CHAPTER_TIMER });
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
    setTimerLeft(savedProgress.timerLeft ?? (savedProgress.mode === "full" ? FULL_TIMER : CHAPTER_TIMER));
    setTimerHidden(false);
    setScreen("quiz");
  }

  function resetQuizState() {
    setCurrentIndex(0);
    setAnswers({});
    setSelectedOption(null);
    setRippleKey(0);
    setDirection(1);
    setTimerLeft(-1);
    setTimerHidden(false);
  }

  function retryTest() {
    if (mode === "full") { startFullTest(); }
    else if (mode === "chapter") { startChapterTest(selectedChapter); }
    else { startAIPractice(selectedChapter); }
  }

  async function startAIPractice(chapter: string) {
    clearProgress(subject);
    setSavedProgress(null);
    setMode("ai");
    setSelectedChapter(chapter);
    setScreen("ai-generating");
    try {
      const resp = await fetch("/api/generate-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: meta?.label ?? subject, chapter, count: 5 }),
      });
      const data = await resp.json() as { questions?: Question[]; error?: string };
      if (!data.questions?.length) throw new Error("No questions returned");
      const generated: Question[] = data.questions.map((q: Question) => ({
        english: q.english ?? "",
        hindi: q.hindi ?? "",
        options: Array.isArray(q.options) ? q.options : [],
        answerIndex: typeof q.answerIndex === "number" ? q.answerIndex : 0,
        chapter,
      }));
      setQuestions(generated);
      setCurrentIndex(0);
      setAnswers({});
      setSelectedOption(null);
      setRippleKey(0);
      setDirection(1);
      setTimerLeft(-1);
      setTimerHidden(false);
      setScreen("quiz");
    } catch {
      setScreen("mode-select");
    }
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

  const jumpToQuestion = (idx: number) => {
    setDirection(idx > currentIndex ? 1 : -1);
    setCurrentIndex(idx);
    setSelectedOption(answers[idx] ?? null);
    setPaletteOpen(false);
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
        onAI={() => setScreen("ai-chapter-select")}
        onSaved={() => setScreen("saved-questions")}
        onResume={handleResume}
        savedCount={bookmarks.length}
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

  if (screen === "ai-chapter-select") {
    return (
      <ChapterSelect
        meta={{ ...meta, label: "AI Practice — " + meta.label }}
        chapters={chapters}
        onBack={() => setScreen("mode-select")}
        onSelect={startAIPractice}
      />
    );
  }

  if (screen === "saved-questions") {
    return (
      <div className="min-h-screen px-4 py-6" style={{ background: "#07080f" }}>
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(251,191,36,0.12) 0%, transparent 55%)" }} />
        <div className="max-w-lg mx-auto relative z-10">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <motion.button whileHover={{ scale: 1.07 }} whileTap={{ scale: 0.93 }}
              onClick={() => setScreen("mode-select")}
              className="w-9 h-9 rounded-xl flex items-center justify-center border text-sm"
              style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)" }}>
              ←
            </motion.button>
            <div>
              <h2 className="text-white font-black text-xl">⭐ Saved Questions</h2>
              <p className="text-white/35 text-xs">{bookmarks.length} question{bookmarks.length !== 1 ? "s" : ""} · {meta.label}</p>
            </div>
            {bookmarks.length > 0 && (
              <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                onClick={() => {
                  const qs = [...bookmarks].sort(() => Math.random() - 0.5).slice(0, Math.min(bookmarks.length, 20));
                  setQuestions(qs); setCurrentIndex(0); setAnswers({}); setSelectedOption(null);
                  setRippleKey(0); setDirection(1); setMode("chapter"); setSelectedChapter("Saved Questions");
                  setTimerLeft(-1); setTimerHidden(false); setScreen("quiz");
                }}
                className="ml-auto px-4 py-2 rounded-xl text-xs font-bold"
                style={{ background: "rgba(251,191,36,0.2)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.4)" }}>
                Start Quiz ▶
              </motion.button>
            )}
          </div>

          {bookmarks.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-5xl mb-4">☆</p>
              <p className="text-white/50 text-sm">Quiz करते वक्त किसी question पर ⭐ tap करो</p>
              <p className="text-white/25 text-xs mt-1">वो question यहाँ save हो जाएगा</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {bookmarks.map((q, i) => (
                <motion.div key={q.english}
                  initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                  className="rounded-xl border p-4"
                  style={{ background: "rgba(251,191,36,0.06)", borderColor: "rgba(251,191,36,0.2)" }}>
                  <div className="flex items-start gap-2 mb-2">
                    <span className="text-yellow-400/60 text-xs shrink-0 mt-0.5 font-bold">Q{i + 1}</span>
                    <p className="text-white/85 text-sm font-medium leading-snug flex-1">
                      <MathText text={q.english} />
                    </p>
                    <motion.button
                      whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.85 }}
                      onClick={() => setBookmarks(toggleBookmark(subject, bookmarks, q))}
                      className="text-base leading-none shrink-0 opacity-60 hover:opacity-100 transition-opacity">
                      ⭐
                    </motion.button>
                  </div>
                  {q.hindi && <p className="text-white/30 text-xs mb-2 pl-4"><MathText text={q.hindi} /></p>}
                  <div className="pl-4">
                    <p className="text-xs" style={{ color: "rgba(251,191,36,0.7)" }}>
                      ✓ <MathText text={q.options[q.answerIndex] ?? ""} />
                    </p>
                    {q.chapter && <p className="text-white/25 text-xs mt-0.5">{q.chapter}</p>}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (screen === "ai-generating") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-6" style={{ background: "#07080f" }}>
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse at 50% 40%, rgba(99,102,241,0.18) 0%, transparent 60%)" }} />
        <motion.div className="relative z-10 text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
            className="w-14 h-14 rounded-full border-2 border-transparent mx-auto mb-5"
            style={{ borderTopColor: "#6366f1", borderRightColor: "#6366f150" }}
          />
          <p className="text-white font-bold text-lg mb-1">🤖 Gemini सोच रहा है...</p>
          <p className="text-white/40 text-sm">तुम्हारे लिए नए सवाल बना रहा हूँ</p>
          <p className="text-indigo-400/60 text-xs mt-2">Chapter: {selectedChapter}</p>
        </motion.div>
      </div>
    );
  }

  if (screen === "result") {
    return (
      <ResultScreen
        questions={questions} answers={answers}
        accent={meta.accent} label={meta.label} icon={meta.icon}
        isDemo={isDemo} mode={mode} chapter={selectedChapter}
        onHome={() => navigate("/")} onRetry={retryTest} subject={subject}
      />
    );
  }

  // ── Quiz screen ───────────────────────────────────────────────────────────────
  // Safety guard — should never happen, but prevents crash if state is stale
  if (questions.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: "#07080f" }}>
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-10 h-10 rounded-full border-2 border-transparent"
          style={{ borderTopColor: meta.accent, borderRightColor: `${meta.accent}50` }} />
        <p className="text-white/40 text-sm">Preparing questions…</p>
        <button onClick={() => setScreen("mode-select")} className="text-white/30 text-xs underline mt-2">← Go back</button>
      </div>
    );
  }

  const q        = questions[currentIndex];
  const progress = ((currentIndex + 1) / questions.length) * 100;
  const magicColors = ["#f59e0b", "#06b6d4"];
  const magicColor  = magicColors[rippleKey % 2];

  // ── Timer display helpers ─────────────────────────────────────────────────────
  const timerMM  = String(Math.floor(Math.max(0, timerLeft) / 60)).padStart(2, "0");
  const timerSS  = String(Math.max(0, timerLeft) % 60).padStart(2, "0");
  const timerDanger  = timerLeft >= 0 && timerLeft <= 60;
  const timerWarning = timerLeft >= 0 && timerLeft <= 300 && !timerDanger;
  const timerColor   = timerDanger ? "#ef4444" : timerWarning ? "#f59e0b" : "rgba(255,255,255,0.85)";
  const timerBg      = timerDanger ? "rgba(239,68,68,0.15)"  : timerWarning ? "rgba(245,158,11,0.14)" : "rgba(255,255,255,0.07)";
  const timerBorder  = timerDanger ? "#ef444445"             : timerWarning ? "#f59e0b45"             : "rgba(255,255,255,0.13)";
  const timerGlow    = timerDanger ? "0 0 22px rgba(239,68,68,0.35)" : timerWarning ? "0 0 18px rgba(245,158,11,0.25)" : "none";

  return (
    <div className="min-h-screen w-full overflow-hidden relative" style={{ background: "#07080f" }}>
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-32 -left-32 w-80 h-80 rounded-full blur-3xl opacity-15"
          style={{ background: `radial-gradient(circle, ${meta.accent}, transparent)` }} />
        <div className="absolute -bottom-20 -right-20 w-64 h-64 rounded-full blur-3xl opacity-10"
          style={{ background: `radial-gradient(circle, ${meta.accent}, transparent)` }} />
      </div>

      {/* ── Floating Timer ──────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {timerLeft >= 0 && (
          <motion.div
            key="timer-widget"
            initial={{ opacity: 0, y: -16, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.85 }}
            transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
            className="fixed top-4 right-4 z-50 flex items-center gap-1.5"
          >
            {timerHidden ? (
              /* Minimised clock pill — click to expand */
              <motion.button
                onClick={() => setTimerHidden(false)}
                whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.93 }}
                className="flex items-center justify-center w-10 h-10 rounded-full backdrop-blur-md border text-base"
                style={{ background: timerBg, borderColor: timerBorder, boxShadow: timerGlow, color: timerColor }}
                title="Show timer"
              >
                ⏱
              </motion.button>
            ) : (
              /* Full timer pill */
              <motion.div
                className="flex items-center gap-2 px-3.5 py-2 rounded-2xl backdrop-blur-md border"
                animate={timerDanger ? { scale: [1, 1.03, 1] } : {}}
                transition={timerDanger ? { repeat: Infinity, duration: 0.75 } : {}}
                style={{ background: timerBg, borderColor: timerBorder, boxShadow: timerGlow }}
              >
                <span className="text-sm" style={{ color: timerColor }}>⏱</span>
                <span
                  className="font-mono font-bold text-sm tracking-wide"
                  style={{ color: timerColor, minWidth: "3.6rem", textAlign: "center" }}
                >
                  {timerMM}:{timerSS}
                </span>
                <motion.button
                  onClick={() => setTimerHidden(true)}
                  whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.9 }}
                  className="text-white/25 hover:text-white/55 transition-colors text-xs leading-none ml-0.5"
                  title="Hide timer"
                >
                  ✕
                </motion.button>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Question Palette Sheet ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {paletteOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              key="palette-backdrop"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.22 }}
              className="fixed inset-0 z-40"
              style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
              onClick={() => setPaletteOpen(false)}
            />

            {/* Sheet */}
            <motion.div
              key="palette-sheet"
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ duration: 0.38, ease: [0.23, 1, 0.32, 1] }}
              className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl border-t border-x overflow-hidden"
              style={{
                background: "linear-gradient(180deg, #0f1118 0%, #09090f 100%)",
                borderColor: `${meta.accent}25`,
                boxShadow: `0 -8px 60px ${meta.accent}18`,
                maxHeight: "72vh",
              }}
            >
              {/* Drag handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-white/15" />
              </div>

              {/* Header row */}
              <div className="flex items-center justify-between px-5 py-3">
                <div>
                  <h3 className="text-white font-bold text-base">Question Palette</h3>
                  <p className="text-xs mt-0.5" style={{ color: `${meta.accent}aa` }}>
                    {Object.keys(answers).length} answered · {questions.length - Object.keys(answers).length} remaining
                  </p>
                </div>
                <motion.button
                  onClick={() => setPaletteOpen(false)}
                  whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm"
                  style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)" }}
                >
                  ✕
                </motion.button>
              </div>

              {/* Legend */}
              <div className="flex items-center gap-4 px-5 pb-3">
                {[
                  { label: "Current",    bg: meta.accent,           border: meta.accent },
                  { label: "Answered",   bg: `${meta.accent}40`,    border: `${meta.accent}60` },
                  { label: "Unanswered", bg: "rgba(255,255,255,0.06)", border: "rgba(255,255,255,0.14)" },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-1.5">
                    <div className="w-4 h-4 rounded-md border" style={{ background: item.bg, borderColor: item.border }} />
                    <span className="text-xs text-white/40">{item.label}</span>
                  </div>
                ))}
              </div>

              {/* Divider */}
              <div className="h-px mx-5" style={{ background: `${meta.accent}18` }} />

              {/* Number grid */}
              <div className="overflow-y-auto px-5 py-4" style={{ maxHeight: "calc(72vh - 140px)" }}>
                <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(46px, 1fr))" }}>
                  {questions.map((_, idx) => {
                    const isCurrent  = idx === currentIndex;
                    const isAnswered = idx in answers;
                    const bg     = isCurrent  ? meta.accent
                                 : isAnswered ? `${meta.accent}38`
                                 : "rgba(255,255,255,0.06)";
                    const border = isCurrent  ? meta.accent
                                 : isAnswered ? `${meta.accent}55`
                                 : "rgba(255,255,255,0.12)";
                    const color  = isCurrent  ? "#000"
                                 : isAnswered ? meta.accent
                                 : "rgba(255,255,255,0.4)";
                    const glow   = isCurrent  ? `0 0 14px ${meta.accent}70` : "none";

                    return (
                      <motion.button
                        key={idx}
                        onClick={() => jumpToQuestion(idx)}
                        whileHover={{ scale: 1.12, y: -2 }}
                        whileTap={{ scale: 0.93 }}
                        className="aspect-square rounded-xl border flex items-center justify-center text-xs font-bold transition-colors"
                        style={{ background: bg, borderColor: border, color, boxShadow: glow }}
                      >
                        {idx + 1}
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

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
              <motion.button
                onClick={() => setPaletteOpen(true)}
                whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.93 }}
                className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold"
                style={{ background: `${meta.accent}18`, borderColor: `${meta.accent}35`, color: meta.accent }}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                  <rect x="0" y="0" width="5" height="5" rx="1"/><rect x="7" y="0" width="5" height="5" rx="1"/>
                  <rect x="0" y="7" width="5" height="5" rx="1"/><rect x="7" y="7" width="5" height="5" rx="1"/>
                </svg>
                {currentIndex + 1}/{questions.length}
              </motion.button>
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
                <div className="rounded-2xl p-5 mb-4 border relative"
                  style={{ background: `linear-gradient(135deg, ${meta.accent}18, rgba(255,255,255,0.03))`, borderColor: `${meta.accent}30`, boxShadow: `0 4px 32px ${meta.accent}15` }}>
                  {/* Bookmark button */}
                  <motion.button
                    onClick={() => setBookmarks(toggleBookmark(subject, bookmarks, q))}
                    whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.85 }}
                    className="absolute top-3 right-3 text-lg leading-none"
                    title={isBookmarked(bookmarks, q) ? "Remove bookmark" : "Bookmark this question"}
                  >
                    <motion.span
                      animate={{ scale: isBookmarked(bookmarks, q) ? [1, 1.35, 1] : 1 }}
                      transition={{ duration: 0.3 }}
                    >
                      {isBookmarked(bookmarks, q) ? "⭐" : "☆"}
                    </motion.span>
                  </motion.button>
                  <p className="text-white font-semibold text-base leading-relaxed mb-2 pr-8">
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
          <div className="flex gap-2 mt-5 pb-4">
            <motion.button
              whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              onClick={handlePrev} disabled={currentIndex === 0}
              className="w-12 h-12 rounded-xl flex items-center justify-center border shrink-0 text-base"
              style={{
                background: "rgba(255,255,255,0.04)",
                borderColor: "rgba(255,255,255,0.09)",
                color: currentIndex === 0 ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.55)",
                cursor: currentIndex === 0 ? "not-allowed" : "pointer",
              }}>
              ←
            </motion.button>

            {selectedOption === null && currentIndex < questions.length - 1 && (
              <motion.button
                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                onClick={handleNext}
                className="flex-1 py-3 rounded-xl text-sm font-semibold border"
                style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.09)", color: "rgba(255,255,255,0.45)" }}>
                Skip ↷
              </motion.button>
            )}

            <motion.button
              whileHover={selectedOption !== null ? { scale: 1.03 } : {}}
              whileTap={selectedOption  !== null ? { scale: 0.97 } : {}}
              onClick={selectedOption !== null ? handleNext : undefined}
              disabled={selectedOption === null}
              className="flex-[2] py-3 rounded-xl text-sm font-bold transition-all duration-300"
              style={{
                background: selectedOption !== null ? `linear-gradient(135deg, ${meta.accent}, ${meta.accent}80)` : "rgba(255,255,255,0.06)",
                color:      selectedOption !== null ? "#fff" : "rgba(255,255,255,0.22)",
                boxShadow:  selectedOption !== null ? `0 4px 20px ${meta.accent}40` : "none",
                cursor:     selectedOption === null ? "not-allowed" : "pointer",
              }}>
              {currentIndex < questions.length - 1 ? "Next →" : "See Results ✦"}
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  );
}
