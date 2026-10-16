import { useState, useEffect, useRef } from "react";
import { useAuth } from "../contexts/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import { db, auth } from "../firebase";
import { ref, push, get, set } from "firebase/database";
import { explainWithShikenEngine, generateQuestions, generateComprehension, aiHeaders } from "@/lib/gemini";
import { createQuestionId, normalizeQuestionRecord } from "@/lib/questionSchema";
import { getCachedQuestions, mergeQuestionsToCache } from "@/lib/aiCache";
import { useParams, useLocation } from "wouter";
import MathText from "@/components/MathText";
import ExplainText from "@/components/ExplainText";
import { SubjectIcon } from "@/components/SubjectIcon";
import { useSubscription } from "../hooks/useSubscription";
import UpgradeModal from "../components/UpgradeModal";
import { normalizeChapter, getCanonicalChapters } from "@/lib/chapterMap";
import { saveQuestionsToCache, loadQuestionsFromCache } from "@/lib/questionCache";

const CHAPTER_ICONS: Record<string, string> = {
  // Language / Generic
  "Grammar":         "📝",
  "Prose":           "📖",
  "Poetry":          "🎭",
  "Vocabulary":      "🔤",
  "Comprehension":   "🔍",
  "Unseen Passage":  "📄",
  "Writing Skills":  "✍️",
  "General":         "📚",
  "AI Generated":    "🤖",
  "Shiken Generated": "🤖",
  // Class 10 Maths
  "Numbers":                                        "🔢",
  "Real Numbers":                                   "🔢",
  "Polynomials":                                    "📈",
  "Pair of Linear Equations in Two Variables":      "⚖️",
  "Quadratic Equations":                            "🔄",
  "Arithmetic Progressions":                        "📊",
  "Triangles":                                      "🔺",
  "Coordinate Geometry":                            "📍",
  "Introduction to Trigonometry":                   "📐",
  "Some Applications of Trigonometry":              "🏗️",
  "Circles":                                        "⭕",
  "Areas Related to Circles":                       "🔵",
  "Surface Areas and Volumes":                      "📦",
  "Statistics":                                     "📊",
  "Probability":                                    "🎲",
  "Geometry":                                       "📐",
  "Finance":                                        "💰",
  // Class 10 Science
  "Chemical Reactions and Equations":               "⚗️",
  "Acids, Bases and Salts":                         "🧪",
  "Metals and Non-metals":                          "⚙️",
  "Carbon and its Compounds":                       "💎",
  "Life Processes":                                 "🌱",
  "Control and Coordination":                       "🧠",
  "How do Organisms Reproduce":                     "🧬",
  "Heredity":                                       "🧬",
  "Light – Reflection and Refraction":              "💡",
  "Human Eye and Colourful World":                  "👁️",
  "Electricity":                                    "⚡",
  "Magnetic Effects of Electric Current":           "🔋",
  "Our Environment":                                "🌍",
  "Biology":                                        "🌿",
  "Chemistry":                                      "⚗️",
  "Physics":                                        "⚡",
  "Astronomy":                                      "🌌",
  // Class 10 Social Science
  "The Rise of Nationalism in Europe":              "🗺️",
  "Nationalism in India":                           "🇮🇳",
  "The Making of a Global World":                   "🌐",
  "The Age of Industrialisation":                   "🏭",
  "Print Culture and the Modern World":             "📰",
  "Resources and Development":                      "⛏️",
  "Forest and Wildlife Resources":                  "🌲",
  "Water Resources":                                "💧",
  "Agriculture":                                    "🌾",
  "Minerals and Energy Resources":                  "⛽",
  "Manufacturing Industries":                       "🏭",
  "Lifelines of National Economy":                  "🚂",
  "Power Sharing":                                  "🤝",
  "Federalism":                                     "🏛️",
  "Democracy and Diversity":                        "🌈",
  "Gender, Religion and Caste":                     "⚖️",
  "Popular Struggles and Movements":                "✊",
  "Political Parties":                              "🗳️",
  "Outcomes of Democracy":                          "🏅",
  "Challenges to Democracy":                        "⚠️",
  "Development":                                    "📈",
  "Sectors of the Indian Economy":                  "🏗️",
  "Money and Credit":                               "💳",
  "Globalisation and the Indian Economy":           "🌐",
  "Consumer Rights":                                "🛒",
  "History":                                        "🏛️",
  "Geography":                                      "🗺️",
  "Polity":                                         "🏛️",
  // Class 12 Physics
  "Electric Charges and Fields":                    "⚡",
  "Electrostatic Potential and Capacitance":        "🔋",
  "Current Electricity":                            "🔌",
  "Moving Charges and Magnetism":                   "🧲",
  "Magnetism and Matter":                           "🧲",
  "Electromagnetic Induction":                      "🌀",
  "Alternating Current":                            "〰️",
  "Electromagnetic Waves":                          "📡",
  "Ray Optics and Optical Instruments":             "🔭",
  "Wave Optics":                                    "🌊",
  "Dual Nature of Radiation and Matter":            "☢️",
  "Atoms":                                          "⚛️",
  "Nuclei":                                         "⚛️",
  "Semiconductor Electronics":                      "💻",
  // Class 12 Chemistry
  "The Solid State":                                "💎",
  "Solutions":                                      "🧪",
  "Electrochemistry":                               "🔋",
  "Chemical Kinetics":                              "⏱️",
  "Surface Chemistry":                              "🔬",
  "General Principles and Processes of Isolation of Elements": "⚙️",
  "The p-Block Elements":                           "🧬",
  "The d and f Block Elements":                     "⚗️",
  "Coordination Compounds":                         "🔗",
  "Haloalkanes and Haloarenes":                     "🧪",
  "Alcohols, Phenols and Ethers":                   "⚗️",
  "Aldehydes, Ketones and Carboxylic Acids":        "⚗️",
  "Amines":                                         "🧬",
  "Biomolecules":                                   "🌿",
  // Class 12 Biology
  "Reproduction in Organisms":                      "🌱",
  "Sexual Reproduction in Flowering Plants":        "🌸",
  "Human Reproduction":                             "👶",
  "Reproductive Health":                            "❤️",
  "Principles of Inheritance and Variation":        "🧬",
  "Molecular Basis of Inheritance":                 "🔬",
  "Evolution":                                      "🦕",
  "Human Health and Disease":                       "🏥",
  "Strategies for Enhancement in Food Production":  "🌾",
  "Microbes in Human Welfare":                      "🦠",
  "Biotechnology: Principles and Processes":        "⚗️",
  "Biotechnology and its Applications":             "💉",
  "Organisms and Populations":                      "🌍",
  "Ecosystem":                                      "🌲",
  "Biodiversity and Conservation":                  "🐾",
  "Environmental Issues":                           "♻️",
  // Class 12 Maths
  "Relations and Functions":                        "🔗",
  "Inverse Trigonometric Functions":                "📐",
  "Matrices":                                       "📊",
  "Determinants":                                   "🔢",
  "Continuity and Differentiability":               "📈",
  "Application of Derivatives":                     "📉",
  "Integrals":                                      "∫",
  "Application of Integrals":                       "📐",
  "Differential Equations":                         "🔄",
  "Vector Algebra":                                 "➡️",
  "Three Dimensional Geometry":                     "📦",
  "Linear Programming":                             "🎯",
  "व्याकरण":              "📝",
  "शब्द-भंडार":           "🔤",
  "साहित्य":              "📖",
  "शब्द-ज्ञान":           "💡",
  "वाक्य":                "✍️",
  "वर्ण विचार":           "🔡",
  "संज्ञा":               "🏷️",
  "सर्वनाम":             "👤",
  "क्रिया":               "⚡",
  "विशेषण":              "🎨",
  "संधि":                "🔗",
  "समास":                "🧩",
  "काल":                 "⏰",
  "कारक":                "🔄",
  "मुहावरे":             "💬",
  "लोकोक्तियाँ":         "📜",
  "शुद्ध-अशुद्ध वाक्य":  "✅",
  "एक शब्द":            "💡",
  // Sanskrit grammar chapters
  "प्रकरणम्":           "📋",
  "प्रत्यय":             "🔧",
  "शब्दरूप":             "📊",
  "धातुरूप":             "⚙️",
  "वाक्य रचना":          "✏️",
};
function getChapterIcon(name: string) { return CHAPTER_ICONS[name] ?? "📂"; }

const subjectMeta: Record<string, { label: string; labelHindi: string; icon: string; accent: string; path: string }> = {
  maths:   { label: "Maths",          labelHindi: "गणित",             icon: "📐", accent: "#06b6d4", path: "maths"          },
  english: { label: "English",        labelHindi: "अंग्रेज़ी",         icon: "📖", accent: "#8b5cf6", path: "english"        },
  hindi:   { label: "Hindi",          labelHindi: "हिंदी",             icon: "🔤", accent: "#f97316", path: "hindi"          },
  science: { label: "Science",        labelHindi: "विज्ञान",           icon: "🔬", accent: "#10b981", path: "science"        },
  social:  { label: "Social Science", labelHindi: "सामाजिक विज्ञान",  icon: "🌍", accent: "#f59e0b", path: "social science" },
  sanskrit:{ label: "Sanskrit",       labelHindi: "संस्कृत",           icon: "📜", accent: "#ec4899", path: "sanskrit"       },
};

const class12SubjectMeta: Record<string, { label: string; labelHindi: string; icon: string; accent: string; path: string }> = {
  physics:   { label: "Physics",        labelHindi: "भौतिकी",          icon: "⚡", accent: "#3b82f6", path: "class12/physics"   },
  chemistry: { label: "Chemistry",      labelHindi: "रसायन विज्ञान",   icon: "⚗️", accent: "#10b981", path: "class12/chemistry" },
  biology:   { label: "Biology",        labelHindi: "जीव विज्ञान",     icon: "🌿", accent: "#22c55e", path: "class12/biology"   },
  maths:     { label: "Maths",          labelHindi: "गणित",             icon: "📐", accent: "#06b6d4", path: "class12/maths"     },
  social:    { label: "Social Science", labelHindi: "सामाजिक विज्ञान", icon: "🌍", accent: "#f59e0b", path: "class12/social"    },
  hindi:     { label: "Hindi",          labelHindi: "हिंदी",            icon: "🔤", accent: "#f97316", path: "class12/hindi"     },
  english:   { label: "English",        labelHindi: "अंग्रेज़ी",        icon: "📖", accent: "#8b5cf6", path: "class12/english"   },
};

const entranceSubjectMeta: Record<string, Record<string, { label: string; labelHindi: string; icon: string; accent: string; path: string }>> = {
  jee: {
    physics:   { label: "JEE Physics",    labelHindi: "भौतिकी",          icon: "⚡", accent: "#3b82f6", path: "entrance_exams/jee/physics"    },
    chemistry: { label: "JEE Chemistry",  labelHindi: "रसायन विज्ञान",   icon: "⚗️", accent: "#10b981", path: "entrance_exams/jee/chemistry"  },
    maths:     { label: "JEE Maths",      labelHindi: "गणित",             icon: "📐", accent: "#06b6d4", path: "entrance_exams/jee/maths"      },
  },
  neet: {
    physics:   { label: "NEET Physics",   labelHindi: "भौतिकी",          icon: "⚡", accent: "#3b82f6", path: "entrance_exams/neet/physics"   },
    chemistry: { label: "NEET Chemistry", labelHindi: "रसायन विज्ञान",   icon: "⚗️", accent: "#10b981", path: "entrance_exams/neet/chemistry" },
    biology:   { label: "NEET Biology",   labelHindi: "जीव विज्ञान",     icon: "🌿", accent: "#22c55e", path: "entrance_exams/neet/biology"   },
  },
};

type QuestionLanguage = "en" | "hi";

interface QuestionContent {
  question: string;
  options: string[];
  explanation?: string;
}

interface Question {
  questionId?: string;
  subject?: string;
  en?: QuestionContent;
  hi?: QuestionContent;
  english: string;
  hindi: string;
  options: string[];
  optionsHindi?: string[];
  answerIndex: number;
  chapter: string;
  explanation?: string;
}

function getQuestionContent(q: Question, lang: QuestionLanguage): QuestionContent {
  const stored = q[lang];
  if (stored && (stored.question || stored.options.some((option) => option.trim()) || stored.explanation)) return stored;
  return lang === "en"
    ? { question: q.english, options: q.options, explanation: q.explanation }
    : { question: q.hindi || q.english, options: q.optionsHindi?.some((option) => option.trim()) ? q.optionsHindi : q.options, explanation: q.explanation };
}

// ─── Progress persistence ──────────────────────────────────────────────────────

interface SavedProgress {
  mode: "full" | "chapter" | "ai" | "mini";
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

// ─── Test history persistence ──────────────────────────────────────────────────

interface TestRecord {
  date: number;
  score: number;
  total: number;
  pct: number;
  mode: "full" | "chapter" | "ai" | "mini";
  chapter: string;
}

function historyKey(subject: string) { return `shiken_history_${subject}`; }

function stableContentKey(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `v1_${(hash >>> 0).toString(36)}`;
}

function loadHistory(subject: string): TestRecord[] {
  try {
    const raw = localStorage.getItem(historyKey(subject));
    if (!raw) return [];
    return JSON.parse(raw) as TestRecord[];
  } catch { return []; }
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

function inferSubjectCategory(subject: string): "c10" | "c12" | "jee" | "neet" {
  if (subject.startsWith("entrance_exams/jee/")) return "jee";
  if (subject.startsWith("entrance_exams/neet/")) return "neet";
  if (subject.startsWith("entrance_exams/")) return "jee";
  if (subject.startsWith("class12/")) return "c12";
  return "c10";
}

function addRecord(subject: string, rec: TestRecord, callerUid?: string): TestRecord[] {
  const prev = loadHistory(subject);
  const next = [...prev, rec].slice(-50);
  try { localStorage.setItem(historyKey(subject), JSON.stringify(next)); } catch { /* quota */ }

  // ── Push to Firebase for admin analytics ──────────────────────────────────
  try {
    const resolvedUid = callerUid ?? auth.currentUser?.uid;
    const deviceId = resolvedUid ?? getDeviceId();
    const safeId = deviceId.replace(/[.#$/[\]]/g, "_");
    const safeSubject = (typeof subject === "string" && subject.trim()) ? subject : "unknown";
    const safePct = isFinite(rec.pct) ? rec.pct : 0;
    push(ref(db, `userActivity/${safeId}/sessions`), {
      subject: safeSubject,
      category: inferSubjectCategory(safeSubject),
      score: rec.score,
      total: rec.total,
      pct: safePct,
      mode: rec.mode,
      chapter: rec.chapter || "",
      timestamp: rec.date,
    }).catch(() => { /* offline — ignore */ });
    const username =
      localStorage.getItem("shiken_username") ||
      auth.currentUser?.displayName ||
      "";
    const metaPayload: Record<string, unknown> = {
      lastActive: rec.date,
      deviceId,
    };
    if (username) metaPayload.username = username;
    set(ref(db, `userActivity/${safeId}/meta`), metaPayload).catch(
      () => { /* offline — ignore */ }
    );
  } catch { /* never block quiz flow */ }

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
  const raw = q.correctOptionIndex ?? q.correct_option_index ?? q.answerIndex ?? q.correct_answer ?? q.correctAnswer ?? q.answer;

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

function toChapterSlug(chapter: string): string {
  return chapter.trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u0900-\u097f]+/g, "_")
    .replace(/^_+|_+$/g, "") || "general";
}

// ─── Daily Mini Test helpers ──────────────────────────────────────────────────

/** Returns human-readable time remaining (e.g. "5h 23m") if the 24-hour
 *  window is still active, or null if expired / no record exists yet. */
function getDailyMiniTimeRemaining(key: string): string | null {
  const ts = localStorage.getItem(key);
  if (!ts) return null;
  const diff = 24 * 60 * 60 * 1000 - (Date.now() - Number(ts));
  if (diff <= 0) return null;
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function parseQuestions(data: unknown, subject = "", classId = "10"): Question[] {
  if (typeof data !== "object" || data === null || Array.isArray(data)) return [];

  const dataObj = data as Record<string, unknown>;

  const isQuestionLike = (v: unknown): boolean => {
    if (typeof v !== "object" || v === null) return false;
    const q = v as Record<string, unknown>;
    // Hindi questions often use question_hindi instead of hindi
    const hasText = !!(q.en || q.hi || q.english || q.question || q.question_english || q.hindi);
    const isHindiQuestion = subject === "hindi" && !!(q.question_hindi || q.question_hi);
    return hasText || isHindiQuestion;
  };

  const pairs: Array<[Record<string, unknown>, string | undefined]> = [];

  // Recursive collector — walks any depth, attaches chapter from first
  // non-question ancestor key. Used as the sole parser for Hindi (which has
  // a mix of 2-level and 3-level deep chapter nesting).
  const collectRecursive = (node: unknown, chapterHint?: string) => {
    if (typeof node !== "object" || node === null || Array.isArray(node)) return;
    const entries = Object.entries(node as Record<string, unknown>);
    // If any direct child looks like a question, treat this level as a question list
    const hasDirectQuestions = entries.some(([, v]) => isQuestionLike(v));
    if (hasDirectQuestions) {
      for (const [, v] of entries) {
        if (isQuestionLike(v)) pairs.push([v as Record<string, unknown>, chapterHint]);
      }
      return;
    }
    // Otherwise recurse, using the current key as chapter hint
    for (const [key, value] of entries) {
      collectRecursive(value, chapterHint ?? key.replace(/_/g, " "));
    }
  };

  // Use the recursive collector for ALL subjects — it handles any nesting
  // depth (chapter → topic → question, or flat lists) without duplicating.
  collectRecursive(dataObj);

  return pairs.map(([q, chapterHint], questionIndex) => {
    // ── Options ──────────────────────────────────────────────────────────────
    const normalizeOptions = (raw: unknown): string[] => {
      if (Array.isArray(raw)) return raw.map(String);
      if (raw && typeof raw === "object") {
        const optObj = raw as Record<string, string>;
        return subject === "hindi"
          ? Object.values(optObj).map(String)
          : Object.keys(optObj).sort().map((k) => String(optObj[k]));
      }
      return [];
    };

    const legacyOptions = normalizeOptions(q.options);
    const enData = q.en && typeof q.en === "object" ? q.en as Record<string, unknown> : {};
    const hiData = q.hi && typeof q.hi === "object" ? q.hi as Record<string, unknown> : {};
    let opts = normalizeOptions(enData.options);
    if (opts.length === 0) opts = legacyOptions;
    let hiOpts = normalizeOptions(hiData.options);
    if (hiOpts.length === 0) hiOpts = normalizeOptions(q.optionsHindi);
    if (hiOpts.length === 0) hiOpts = opts.map(() => "");
    if (opts.length === 0 && q.options && typeof q.options === "object") {
      const optObj = q.options as Record<string, string>;
      // Hindi: options are stored as objects with numeric keys (0,1,2) — use Object.values
      // Other subjects: may use letter keys (A,B,C,D) — preserve alphabetical order
      opts = subject === "hindi"
        ? Object.values(optObj).map(String)
        : Object.keys(optObj).sort().map((k) => String(optObj[k]));
    }

    // ── Answer index ──────────────────────────────────────────────────────────
    const answerIndex = resolveAnswerIndex(q, opts);

    // Strip leading "(A)/(B)/(C)/(D)" prefixes from options (Hindi schema)
    // so the quiz UI's own A/B/C/D labels aren't duplicated
    opts = opts.map((o) => o.replace(/^\([A-Da-d]\)\s*/, "").trim());
    hiOpts = hiOpts.map((o) => o.replace(/^\([A-Da-d]\)\s*/, "").trim());

    // ── Question text ─────────────────────────────────────────────────────────
    // english: question_english > question > english
    // hindi:   question_hindi   > question_hi > hindi
    // New format: q.question is bilingual "Hindi / English" split by " / "
    let english = String(enData.question ?? q.question_english ?? q.english ?? "");
    let hindi   = String(hiData.question ?? q.question_hindi ?? q.question_hi ?? q.hindi ?? "");
    if (!english && !hindi && q.question) {
      const combined = String(q.question);
      const slashIdx = combined.indexOf(" / ");
      if (slashIdx !== -1) {
        hindi   = combined.slice(0, slashIdx).trim();
        english = combined.slice(slashIdx + 3).trim();
      } else {
        english = combined;
      }
    }

    // ── Normalize mislabeled fields ───────────────────────────────────────────
    const devanagariRe = /[\u0900-\u097F]/;
    if (!english && hindi && !devanagariRe.test(hindi)) {
      english = hindi;
      hindi   = "";
    }
    if (hindi && hindi === english) {
      hindi = "";
    }

    // ── Chapter ───────────────────────────────────────────────────────────────
    const rawChapter = String(q.chapter ?? q.chapter_name ?? chapterHint ?? "General");
    const chapter = normalizeChapter(subject, classId, rawChapter);
    const questionId = String(q.questionId ?? "").trim()
      || createQuestionId(subject, chapter, `${questionIndex}|${english}|${hindi}`);
    const rawSubject = String(q.subject ?? subject);

    const enExplanation = enData.explanation ?? q.explanation;
    const hiExplanation = hiData.explanation ?? q.explanation_hi ?? "";
    const explanation = enExplanation ? String(enExplanation) : hiExplanation ? String(hiExplanation) : undefined;
    const enContent: QuestionContent = {
      question: english,
      options: opts,
      ...(enExplanation ? { explanation: String(enExplanation) } : {}),
    };
    const hiContent: QuestionContent = {
      question: hindi,
      options: hiOpts,
      ...(hiExplanation ? { explanation: String(hiExplanation) } : {}),
    };

    return { questionId, subject: rawSubject, en: enContent, hi: hiContent, english, hindi, options: opts, optionsHindi: hiOpts, answerIndex, chapter, explanation };
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

// ─── Choose Plan Overlay (for expired subscriptions) ──────────────────────────

function ChoosePlanOverlay({ goal, onClose }: { goal: "jee" | "neet" | "c10" | "c12"; onClose: () => void }) {
  const [, navigate] = useLocation();
  const plans: Record<string, { id: string; name: string; price: string; accent: string; emoji: string; features: string[] }[]> = {
    jee: [
      { id: "jee_neet_weekly", name: "Weekly Pass", price: "₹29", accent: "#3b82f6", emoji: "📅", features: ["All JEE subjects", "7 days access", "Shiken Engine questions"] },
      { id: "jee_neet_monthly", name: "Monthly Plan", price: "₹69", accent: "#6366f1", emoji: "📆", features: ["All JEE subjects", "30 days access", "Priority counselling"] },
      { id: "jee_neet_yearly", name: "Yearly Pro", price: "₹499", accent: "#f59e0b", emoji: "🎯", features: ["All JEE subjects", "1 year access", "Golden badge", "Priority counselling"] },
    ],
    neet: [
      { id: "jee_neet_weekly", name: "Weekly Pass", price: "₹29", accent: "#10b981", emoji: "📅", features: ["All NEET subjects", "7 days access", "Shiken Engine questions"] },
      { id: "jee_neet_monthly", name: "Monthly Plan", price: "₹69", accent: "#059669", emoji: "📆", features: ["All NEET subjects", "30 days access", "Priority counselling"] },
      { id: "jee_neet_yearly", name: "Yearly Pro", price: "₹499", accent: "#f59e0b", emoji: "🎯", features: ["All NEET subjects", "1 year access", "Golden badge", "Priority counselling"] },
    ],
    c10: [
      { id: "c10_monthly", name: "Monthly Pass", price: "₹49", accent: "#f59e0b", emoji: "📅", features: ["1 subject unlimited", "30 days access", "Shiken Engine questions"] },
      { id: "c10_6month", name: "6 Months", price: "₹99", accent: "#10b981", emoji: "📆", features: ["1 subject unlimited", "6 months access", "Shiken Engine questions"] },
    ],
    c12: [
      { id: "c12_monthly", name: "Monthly Pass", price: "₹49", accent: "#8b5cf6", emoji: "📅", features: ["1 subject unlimited", "30 days access", "Shiken Engine questions"] },
      { id: "c12_6month", name: "6 Months", price: "₹99", accent: "#10b981", emoji: "📆", features: ["1 subject unlimited", "6 months access", "Shiken Engine questions"] },
    ],
  };
  const list = plans[goal] || plans.c10;
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center px-5"
      style={{ background: "rgba(7,8,15,0.92)", backdropFilter: "blur(12px)" }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="text-3xl mb-2">⏰</div>
          <h2 className="text-white font-black text-xl mb-1">Plan Expired</h2>
          <p className="text-white/40 text-sm">Your premium access has ended. Choose a plan to continue.</p>
        </div>
        <div className="flex flex-col gap-3 mb-6">
          {list.map((plan, i) => (
            <motion.div key={plan.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
              className="rounded-2xl p-4"
              style={{ background: "var(--app-surface)", border: `1px solid ${plan.accent}25` }}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{plan.emoji}</span>
                  <p className="text-white font-bold text-sm">{plan.name}</p>
                </div>
                <p className="font-black text-lg" style={{ color: plan.accent }}>{plan.price}</p>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {plan.features.map(f => (
                  <span key={f} className="text-[10px] px-2 py-0.5 rounded-full text-white/50"
                    style={{ background: `${plan.accent}15` }}>{f}</span>
                ))}
              </div>
              <motion.button
                onClick={() => { onClose(); navigate(`/pricing?plan=${plan.id}`); }}
                className="w-full py-2.5 rounded-xl font-bold text-xs text-black"
                style={{ background: plan.accent }}>
                Get {plan.name} →
              </motion.button>
            </motion.div>
          ))}
        </div>
        <motion.button onClick={onClose}
          className="w-full py-3 rounded-xl font-bold text-xs text-white/50"
          style={{ background: "var(--app-surface)", border: "1px solid rgba(255,255,255,0.08)" }}>
          ← Back to Free Mode
        </motion.button>
      </div>
    </motion.div>
  );
}

// ─── Progress Chart ────────────────────────────────────────────────────────────

function ProgressChart({ records, accent }: { records: TestRecord[]; accent: string }) {
  const pts = records.slice(-12);
  if (pts.length < 2) return null;

  const W = 300, H = 72, PX = 10, PY = 8;
  const iW = W - PX * 2, iH = H - PY * 2;

  const xs = pts.map((_, i) => PX + (i / (pts.length - 1)) * iW);
  const ys = pts.map((r) => PY + (1 - r.pct / 100) * iH);

  // Smooth cubic bezier path
  const linePath = pts.reduce((acc, _p, i) => {
    if (i === 0) return `M ${xs[0]},${ys[0]}`;
    const cpX = (xs[i - 1] + xs[i]) / 2;
    return `${acc} C ${cpX},${ys[i - 1]} ${cpX},${ys[i]} ${xs[i]},${ys[i]}`;
  }, "");

  const fillPath = `${linePath} L ${xs[xs.length - 1]},${H} L ${xs[0]},${H} Z`;

  const dotColor = (pct: number) =>
    pct >= 80 ? "#10b981" : pct >= 60 ? "#f59e0b" : "#ef4444";

  const gradId = `cg-${accent.replace("#", "")}`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 72 }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={accent} stopOpacity="0.35" />
          <stop offset="100%" stopColor={accent} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {/* 60% and 80% guide lines */}
      {[60, 80].map((pct) => {
        const y = PY + (1 - pct / 100) * iH;
        return (
          <line key={pct} x1={PX} y1={y} x2={W - PX} y2={y}
            stroke="var(--app-surface)" strokeWidth="1" strokeDasharray="3 3" />
        );
      })}
      <path d={fillPath} fill={`url(#${gradId})`} />
      <path d={linePath} fill="none" stroke={accent} strokeWidth="1.8"
        strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((r, i) => {
        const last = i === pts.length - 1;
        const dc = dotColor(r.pct);
        return (
          <g key={i}>
            {last && <circle cx={xs[i]} cy={ys[i]} r={7} fill={dc} opacity={0.22} />}
            <circle cx={xs[i]} cy={ys[i]} r={last ? 3.5 : 2.5}
              fill={last ? dc : accent} stroke={last ? "#07080f" : "none"} strokeWidth={1} />
          </g>
        );
      })}
    </svg>
  );
}

// ─── Mode Select Screen ────────────────────────────────────────────────────────

function ModeSelect({
  meta, subject, totalCount, savedProgress, onFull, onChapterWise, onAI, onSaved, onResume, savedCount, history,
  isPremium, onMiniTest, onUpgrade, hasUsedFreeFull,
}: {
  meta: { label: string; labelHindi?: string; icon: string; accent: string };
  subject: string;
  totalCount: number;
  savedProgress: SavedProgress | null;
  onFull: () => void;
  onChapterWise: () => void;
  onAI: () => void;
  onSaved: () => void;
  onResume: () => void;
  savedCount: number;
  history?: TestRecord[];
  isPremium: boolean;
  onMiniTest: () => void;
  onUpgrade: () => void;
  hasUsedFreeFull: boolean;
}) {
  const modes = [
    {
      id: "mini",
      title: "Mini Test",
      subtitle: `10 questions · Free · Choose any chapter`,
      icon: "⚡",
      desc: "Quick revision in ~10 minutes. Pick a chapter or practice all. Available to all students!",
      onClick: onMiniTest,
      glowColor: meta.accent,
      locked: false,
    },
    {
      id: "full",
      title: "Full Length Test",
      subtitle: isPremium
        ? `43 DB + 7 Shiken Engine questions (50 total)`
        : !hasUsedFreeFull
          ? "1 Free Test Available! · 50 questions"
          : "Upgrade for unlimited tests",
      icon: "🎯",
      desc: isPremium
        ? "Covers entire syllabus with Shiken Engine questions. ⏱ 60 min"
        : !hasUsedFreeFull
          ? "Try your first Full Length Test free! ⏱ 60 min"
          : "You've used your 1 free test. Upgrade to Premium for unlimited tests.",
      onClick: (isPremium || !hasUsedFreeFull) ? onFull : onUpgrade,
      glowColor: (isPremium || !hasUsedFreeFull) ? meta.accent : "#fbbf24",
      locked: !isPremium && hasUsedFreeFull,
    },
    {
      id: "chapter",
      title: "Chapter-wise Test",
      subtitle: isPremium ? "20 random questions per chapter" : "Chapter tests — Premium only",
      icon: "📂",
      desc: isPremium
        ? "Focus on one chapter at a time. Perfect for targeted practice. ⏱ 20 min"
        : "Upgrade to Premium for chapter-wise deep practice.",
      onClick: isPremium ? onChapterWise : onUpgrade,
      glowColor: isPremium ? meta.accent : "#fbbf24",
      locked: !isPremium,
    },
    {
      id: "ai",
      title: "Shiken Practice",
      subtitle: isPremium ? "5 fresh Shiken Engine questions" : "Shiken Engine practice — Premium only",
      icon: "🤖",
      desc: isPremium
        ? "नए सवाल तुम्हारे लिए तैयार किए जा रहे हैं। हर बार अलग, हर बार नया!"
        : "Upgrade to Premium for Shiken Engine practice sessions.",
      onClick: isPremium ? onAI : onUpgrade,
      glowColor: isPremium ? "#6366f1" : "#fbbf24",
      locked: !isPremium,
    },
  ];

  const hasSaved = savedCount > 0;
  const safeHistory = history ?? [];
  const hasHistory = safeHistory.length > 0;
  const avgPct = hasHistory
    ? Math.round(safeHistory.reduce((a, r) => a + Number(r.pct || 0), 0) / safeHistory.length)
    : 0;
  const bestPct = hasHistory ? Math.max(...safeHistory.map((r) => Number(r.pct || 0))) : 0;

  function formatRelativeTime(ts: number) {
    const diffMin = Math.round((Date.now() - ts) / 60000);
    if (diffMin < 1)  return "just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffH = Math.round(diffMin / 60);
    if (diffH < 24)   return `${diffH}h ago`;
    return `${Math.round(diffH / 24)}d ago`;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10" style={{ background: "var(--app-bg)" }}>
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8 relative z-10"
      >
        <div className="mb-3 flex justify-center"><SubjectIcon id={subject} color={meta.accent} size="lg" /></div>
        <h2 className="text-3xl font-black text-slate-900 mb-0.5 leading-tight">{meta.label}</h2>
        <p className="text-base font-bold mb-2 text-emerald-600">{meta.labelHindi}</p>
        <p className="text-slate-500 text-sm">Choose your test mode</p>
      </motion.div>

      <div className="w-full max-w-sm flex flex-col gap-4 relative z-10">
        {/* Resume banner */}
        {savedProgress && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="rounded-2xl border border-slate-200 bg-white p-4 flex items-center gap-4"
            style={{ background: "var(--app-card-bg)", borderColor: "var(--app-border)" }}
          >
            <div className="text-2xl w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${meta.accent}25` }}>
              ⏸️
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-slate-900 font-bold text-sm">Resume where you left off</p>
              <p className="text-xs mt-0.5 text-emerald-600">
                {savedProgress.mode === "full" ? "Full Test" : savedProgress.chapter}
                {" · "}Q{savedProgress.currentIndex + 1}/{savedProgress.questions.length}
                {" · "}{formatRelativeTime(savedProgress.timestamp)}
              </p>
            </div>
            <motion.button
              onClick={onResume}
              className="px-4 py-2 rounded-xl text-xs font-bold shrink-0 bg-emerald-600 text-white"
              style={{ background: "#059669", color: "#ffffff" }}
            >
              Resume →
            </motion.button>
          </motion.div>
        )}

        {/* History stats card */}
        {hasHistory && (
          <motion.div
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}
            className="rounded-2xl border border-slate-200 bg-white p-4"
            style={{ background: "var(--app-card-bg)", borderColor: "var(--app-border)" }}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-slate-700 text-xs font-semibold">📈 Your Progress</p>
              <div className="flex gap-3">
                <div className="text-right">
                  <p className="text-slate-900 text-xs font-bold">{bestPct}%</p>
                  <p className="text-slate-400 text-[10px]">Best</p>
                </div>
                <div className="text-right">
                  <p className="text-slate-900 text-xs font-bold">{avgPct}%</p>
                  <p className="text-slate-400 text-[10px]">Avg</p>
                </div>
                <div className="text-right">
                  <p className="text-slate-900 text-xs font-bold">{safeHistory.length}</p>
                  <p className="text-slate-400 text-[10px]">Tests</p>
                </div>
              </div>
            </div>
            <ProgressChart records={safeHistory} accent={meta.accent} />
            <div className="flex justify-between mt-1 px-1">
              <span className="text-slate-400 text-[10px]">Oldest</span>
              <span className="text-slate-400 text-[10px]">Latest →</span>
            </div>
          </motion.div>
        )}

        {/* Saved Questions button */}
        {hasSaved && (
          <motion.button
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05, duration: 0.4 }}
            onClick={onSaved}
            className="relative overflow-hidden text-left rounded-2xl border border-slate-200 bg-white p-4 flex items-center gap-4 group"
            style={{ background: "var(--app-card-bg)", borderColor: "var(--app-border)" }}
          >
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-2xl"
              style={{ background: "radial-gradient(ellipse at 50% 0%,rgba(251,191,36,0.14),transparent 70%)" }} />
            <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0"
              style={{ background: "rgba(251,191,36,0.15)" }}>⭐</div>
            <div className="flex-1 relative z-10">
              <p className="text-slate-900 font-bold text-sm">Saved Questions</p>
              <p className="text-xs text-slate-500">{savedCount} question{savedCount !== 1 ? "s" : ""} bookmarked • Revise anytime</p>
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
            onClick={m.onClick}
            className="relative overflow-hidden text-left rounded-2xl border border-slate-200 bg-white p-6 group hover:shadow-sm transition-shadow"
            style={{
              background: "var(--app-card-bg)",
              borderColor: "var(--app-border)",
            }}
          >
            {m.id === "ai" && !m.locked && (
              <div className="absolute top-2 right-2 text-xs px-2 py-0.5 rounded-full font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
                NEW ✨
              </div>
            )}
            {m.locked && (
              <div className="absolute top-2 right-2 flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-amber-50 text-amber-700 border border-amber-100">
                👑 Premium
              </div>
            )}
            <div className="flex items-start gap-4 relative z-10">
              <div
                className="text-2xl w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: `${m.glowColor}20` }}
              >
                {m.icon}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-0.5">
                  <h3 className="text-slate-900 font-bold text-base">{m.title}</h3>
                  <span className="text-slate-400 group-hover:text-slate-600 transition-colors text-lg">→</span>
                </div>
                <p className="text-xs font-semibold mb-1" style={{ color: m.glowColor }}>{m.subtitle}</p>
                <p className="text-slate-500 text-xs leading-snug">{m.desc}</p>
              </div>
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
}

// ─── Hindi ↔ English transliteration for chapter search ────────────────────────
// Maps individual Devanagari characters / matras → common Roman equivalents so
// that a student typing "karak" or "ras" will find "कारक" or "रस" chapters.
const DEVA_TO_ROMAN: [string, string][] = [
  // Multi-char sequences first (order matters — checked before single chars)
  ["क्ष", "ksh"], ["त्र", "tr"], ["ज्ञ", "gya"], ["श्र", "shr"],
  ["ड़", "r"],  ["ढ़", "rh"],
  // Consonants
  ["क", "k"],  ["ख", "kh"], ["ग", "g"],  ["घ", "gh"], ["ङ", "ng"],
  ["च", "ch"], ["छ", "chh"],["ज", "j"],  ["झ", "jh"], ["ञ", "ny"],
  ["ट", "t"],  ["ठ", "th"], ["ड", "d"],  ["ढ", "dh"], ["ण", "n"],
  ["त", "t"],  ["थ", "th"], ["द", "d"],  ["ध", "dh"], ["न", "n"],
  ["प", "p"],  ["फ", "ph"], ["ब", "b"],  ["भ", "bh"], ["म", "m"],
  ["य", "y"],  ["र", "r"],  ["ल", "l"],  ["व", "v"],  ["श", "sh"],
  ["ष", "sh"], ["स", "s"],  ["ह", "h"],
  // Independent vowels
  ["अ", "a"],  ["आ", "aa"], ["इ", "i"],  ["ई", "ee"], ["उ", "u"],
  ["ऊ", "oo"], ["ए", "e"],  ["ऐ", "ai"], ["ओ", "o"],  ["औ", "au"],
  ["ऋ", "ri"], ["अं","an"], ["अः","ah"],
  // Dependent matras
  ["ा", "a"],  ["ि", "i"],  ["ी", "ee"], ["ु", "u"],  ["ू", "oo"],
  ["े", "e"],  ["ै", "ai"], ["ो", "o"],  ["ौ", "au"], ["ृ", "ri"],
  // Nasalisation / virama
  ["ं", "n"],  ["ँ", "n"],  ["ः", "h"],  ["्", ""],
];

/** Convert a Devanagari string to an approximate Roman transliteration. */
function hindiToRoman(text: string): string {
  let result = "";
  let i = 0;
  while (i < text.length) {
    let matched = false;
    for (const [deva, roman] of DEVA_TO_ROMAN) {
      if (text.startsWith(deva, i)) {
        result += roman;
        i += deva.length;
        matched = true;
        break;
      }
    }
    if (!matched) {
      result += text[i];
      i++;
    }
  }
  return result.toLowerCase();
}

/**
 * Returns true when `query` (user input) matches `chapterName`.
 * Supports:
 *  - Direct substring match on the Hindi name (e.g. "कारक")
 *  - Roman transliteration match  (e.g. "karak" → "कारक")
 *  - English keyword match against the translated name
 */
function chapterMatchesQuery(name: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (name.toLowerCase().includes(q)) return true;          // Hindi direct
  if (hindiToRoman(name).includes(q)) return true;          // transliteration
  return false;
}

// ─── Chapter Select Screen ─────────────────────────────────────────────────────

function ChapterSelect({
  meta, chapters, onBack, onSelect, title, showAll, allLabel,
  lockedChapters, topperChapters, onUpgrade,
}: {
  meta: { label: string; icon: string; accent: string };
  chapters: { name: string; count: number }[];
  onBack: () => void;
  onSelect: (chapter: string) => void;
  title?: string;
  showAll?: boolean;
  allLabel?: string;
  lockedChapters?: string[];
  topperChapters?: string[];
  onUpgrade?: () => void;
}) {
  const displayTitle = title ?? "Chapter-wise Test";
  const allTotalCount = chapters.reduce((s, c) => s + c.count, 0);
  const [chapterQuery, setChapterQuery] = useState("");

  const visibleChapters = chapters.filter((ch) => chapterMatchesQuery(ch.name, chapterQuery));

  return (
    <div className="min-h-screen px-4 py-6" style={{ background: "var(--app-bg)" }}>
      <div className="max-w-sm mx-auto relative z-10">
        <div className="flex items-center gap-3 mb-5">
          <button onClick={onBack} className="text-slate-400 hover:text-slate-700 transition-colors text-xl p-1">←</button>
          <div>
            <p className="text-slate-500 text-xs">{displayTitle}</p>
            <h2 className="text-slate-900 font-bold text-lg">{meta.label} — Pick a Chapter</h2>
          </div>
        </div>

        {/* ── Bilingual search bar ── */}
        <div className="relative mb-4">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none select-none">🔍</span>
          <input
            type="text"
            value={chapterQuery}
            onChange={(e) => setChapterQuery(e.target.value)}
            placeholder="Search chapter… e.g. कारक or karak"
            className="w-full rounded-xl pl-9 pr-9 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none bg-white border border-slate-200"
            style={{
              background: "var(--app-card-bg)",
              border: `1px solid ${chapterQuery ? "#059669" : "var(--app-border)"}`,
              caretColor: meta.accent,
            }}
          />
          {chapterQuery && (
            <button
              onClick={() => setChapterQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors text-base leading-none"
            >
              ×
            </button>
          )}
        </div>

        {/* ── Result count hint ── */}
        {chapterQuery.trim() && (
          <p className="text-slate-500 text-xs mb-3 pl-1">
            {visibleChapters.length === 0
              ? "No chapters found"
              : `${visibleChapters.length} chapter${visibleChapters.length !== 1 ? "s" : ""} found`}
          </p>
        )}

        <div className="flex flex-col gap-3">
          {showAll && !chapterQuery.trim() && (
            <motion.button
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
              whileHover={{ scale: 1.02, x: 4 }} whileTap={{ scale: 0.97 }}
              onClick={() => onSelect("All Chapters")}
              className="relative overflow-hidden text-left rounded-2xl border border-slate-200 bg-white px-4 py-3.5 flex items-center gap-3 group hover:shadow-sm transition-shadow"
              style={{ background: "var(--app-card-bg)", borderColor: "var(--app-border)" }}
            >
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-xl"
                style={{ background: `linear-gradient(90deg, ${meta.accent}20, transparent)` }} />
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0"
                style={{ background: `${meta.accent}25` }}>
                🌟
              </div>
              <div className="flex-1 relative z-10">
                <p className="font-semibold text-sm text-emerald-700">{allLabel ?? "All Chapters"}</p>
                <p className="text-slate-500 text-xs">{allTotalCount} questions · Mix of everything</p>
              </div>
              <span className="text-slate-400 group-hover:text-slate-700 transition-colors relative z-10">→</span>
            </motion.button>
          )}

          {visibleChapters.map((ch, i) => {
            const isTopper  = topperChapters?.includes(ch.name) ?? false;
            const isLocked  = isTopper || (lockedChapters?.includes(ch.name) ?? false);
            const badgeLabel = isTopper ? "🏆 Topper" : "👑 Premium";
            return (
              <motion.button
                key={ch.name}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04, duration: 0.3 }}
                whileHover={{ scale: 1.02, x: 4 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => isLocked ? onUpgrade?.() : onSelect(ch.name)}
                className="relative overflow-hidden text-left rounded-2xl border border-slate-200 bg-white px-4 py-3.5 flex items-center gap-3 group hover:shadow-sm transition-shadow"
                style={{
                  background: "var(--app-card-bg)",
                  borderColor: "var(--app-border)",
                }}
              >
                <div
                  className="hidden"
                />
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0"
                  style={{ background: isLocked ? "#fffbeb" : "#ecfdf5" }}
                >
                  {getChapterIcon(ch.name)}
                </div>
                <div className="flex-1 relative z-10">
                  <p className={`font-semibold text-sm ${isLocked ? "text-slate-500" : "text-slate-900"}`}>{ch.name}</p>
                  <p className="text-slate-500 text-xs">{ch.count} question{ch.count !== 1 ? "s" : ""}</p>
                </div>
                {isLocked ? (
                  <span className="relative z-10 text-xs font-medium px-3 py-1 rounded-full shrink-0 bg-amber-50 text-amber-700 border border-amber-100">
                    {badgeLabel}
                  </span>
                ) : (
                  <span className="text-slate-400 group-hover:text-slate-700 transition-colors relative z-10">→</span>
                )}
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Result Screen ─────────────────────────────────────────────────────────────

function ResultScreen({
  questions, answers, accent, label, icon, isDemo, isOfflineCached, mode, chapter, subject, onHome, onRetry,
  isPremium, onUpgrade, classId,
}: {
  questions: Question[];
  answers: Record<number, number>;
  accent: string; label: string; icon: string; isDemo: boolean; isOfflineCached: boolean;
  mode: "full" | "chapter" | "ai" | "mini"; chapter: string; subject: string;
  onHome: () => void; onRetry: () => void;
  isPremium: boolean; onUpgrade: () => void;
  classId: string;
}) {
  const { user } = useAuth();
  const score = questions.reduce((acc, q, i) => acc + (answers[i] === q.answerIndex ? 1 : 0), 0);
  const pct   = Math.round((score / questions.length) * 100);
  const msg   = pct === 100 ? "Perfect! Outstanding! 🏆" : pct >= 80 ? "Excellent! ⭐" : pct >= 60 ? "Good effort! 💪" : "Keep going! 🌱";

  // Bookmarks (local state — syncs with localStorage)
  const [bmks, setBmks] = useState<Question[]>(() => loadBookmarks(subject));
  const bmkToggle = (q: Question) => setBmks((prev) => toggleBookmark(subject, prev, q));

  // History — record this test once on mount (skip demo)
  const [history, setHistory] = useState<TestRecord[]>(() => loadHistory(subject));
  const recordedRef = useRef(false);
  useEffect(() => {
    if (recordedRef.current || isDemo) return;
    recordedRef.current = true;
    const rec: TestRecord = { date: Date.now(), score, total: questions.length, pct, mode, chapter };
    setHistory(addRecord(subject, rec, user?.uid));
  }, []);

  // Explanations are on-demand only — user clicks "Explain करें ↓" per question.
  // Auto-explaining all wrong answers on load was removed to prevent unnecessary API calls.

  // Per-question explanation state
  const [explainTexts,   setExplainTexts]   = useState<Record<string, string>>({});
  const [explainLoading, setExplainLoading] = useState<Record<string, boolean>>({});
  const [explainOpen,    setExplainOpen]    = useState<Record<number, boolean>>({});

  // Explanation language toggle
  const [explainLang, setExplainLang] = useState<"en" | "hi">("hi");
  function cycleExplainLang() { setExplainLang((l) => l === "hi" ? "en" : "hi"); }
  const explainLangLabel = explainLang === "hi" ? "हिंदी" : "English";

  // Stable Firebase key from question text + lang (safe for Firebase paths)
  function explainCacheKey(questionEnglish: string, lang: string): string {
    return btoa(unescape(encodeURIComponent(questionEnglish.slice(0, 60)))).replace(/[/+=]/g, "_") + "_" + lang;
  }

  async function fetchExplain(i: number, q: Question, lang: "both" | "en" | "hi" = "both") {
    if (!isPremium) { onUpgrade(); return; }
    const effectiveLang: "en" | "hi" = lang === "en" ? "en" : "hi";
    const stateKey = `${i}-${effectiveLang}`;
    if (explainLoading[stateKey]) return;
    setExplainOpen((o) => ({ ...o, [i]: true }));
    if (explainTexts[stateKey]) return; // already fetched in session
    setExplainLoading((l) => ({ ...l, [stateKey]: true }));
    setExplainTexts((t) => ({ ...t, [stateKey]: "" }));

    try {
      // ── Use DB-stored explanation if available (no API call needed) ───────
      const storedExplanation = q[effectiveLang]?.explanation?.trim()
        || (effectiveLang === "en" ? q.explanation?.trim() : "");
      if (storedExplanation) {
        setExplainTexts((t) => ({ ...t, [stateKey]: storedExplanation }));
        setExplainLoading((l) => { const n = { ...l }; delete n[stateKey]; return n; });
        return;
      }

      // ── Check Firebase cache first ────────────────────────────────────────
      const cacheKey = explainCacheKey(q.english, effectiveLang);
      const cached = await get(ref(db, `explanations/${subject}/${cacheKey}`));
      if (cached.exists()) {
        const text = cached.val() as string;
        setExplainTexts((t) => ({ ...t, [stateKey]: text }));
        setExplainLoading((l) => { const n = { ...l }; delete n[stateKey]; return n; });
        return;
      }

      // ── Not cached — call Shiken Engine once ─────────────────────────────
      // explainWithShikenEngine already posts to /api/explain. Retrying the
      // same endpoint after a stream/network error can create a second Gemini
      // request for one click, so do not duplicate that request.
      let fullText = "";
      fullText = await explainWithShikenEngine(
        {
          questionEnglish: q.english,
          questionHindi:   q.hindi || "",
          options:         q.options,
          optionsHindi:    q.optionsHindi,
          correctAnswer:   q.options[q.answerIndex] ?? "",
          subject:         label,
          lang:            effectiveLang,
          classId,
        },
        (chunk) => setExplainTexts((t) => ({ ...t, [stateKey]: (t[stateKey] ?? "") + chunk })),
      );

      if (fullText.length > 10) {
        const cacheKey = explainCacheKey(q.english, effectiveLang);
        set(ref(db, `explanations/${subject}/${cacheKey}`), fullText).catch(() => {});
      }
    } catch {
      setExplainTexts((t) => ({ ...t, [stateKey]: "Explanation नहीं मिली 🙏" }));
    } finally {
      setExplainLoading((l) => { const n = { ...l }; delete n[stateKey]; return n; });
    }
  }

  // Shiken Engine analysis state
  const [analysisOpen,    setAnalysisOpen]    = useState(false);
  const [analysisText,    setAnalysisText]    = useState("");
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const autoAnalysisRef = useRef(false);

  async function fetchAnalysis() {
    if (!isPremium) { onUpgrade(); return; }
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
    const analysisKey = stableContentKey(JSON.stringify({
      subject,
      score,
      total: questions.length,
      mode,
      chapter,
      classId,
      wrong,
    }));
    const safeSubject = subject.replace(/[.#$/[\]]/g, "_");
    try {
      // Reuse analysis for the same completed result instead of charging
      // Gemini again when the result is reopened.
      const cached = await get(ref(db, `testAnalyses/${safeSubject}/${analysisKey}`));
      if (cached.exists()) {
        setAnalysisText(String(cached.val() ?? ""));
        return;
      }

      let fullAnalysisText = "";
      const resp = await fetch("/api/analyze-test", {
        method: "POST",
        headers: aiHeaders(),
        body: JSON.stringify({ subject, score, total: questions.length, mode, chapter, wrong, classId }),
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
            if (payload.content) {
              fullAnalysisText += payload.content;
              setAnalysisText((t) => t + payload.content);
            }
            if (payload.error) {
              fullAnalysisText += payload.error;
              setAnalysisText((t) => t + payload.error);
            }
          } catch { /* skip */ }
        }
      }
      if (fullAnalysisText.length > 10) {
        set(ref(db, `testAnalyses/${safeSubject}/${analysisKey}`), fullAnalysisText).catch(() => {});
      }
    } catch {
      setAnalysisText("Analysis में दिक्कत आई। फिर से try करो 🙏");
    } finally {
      setAnalysisLoading(false);
    }
  }

  // Auto-trigger Shiken Engine analysis for premium users after test
  useEffect(() => {
    if (!isPremium || isDemo || autoAnalysisRef.current) return;
    autoAnalysisRef.current = true;
    setAnalysisOpen(true);
    const t = setTimeout(() => { fetchAnalysis(); }, 1000);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
      className="result-screen min-h-screen w-full px-4 py-8" style={{ background: "var(--app-bg)" }}
    >
      <div className="max-w-lg mx-auto">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="text-center mb-6">
          <div className="mb-2 flex justify-center"><SubjectIcon id={subject} color={accent} size="lg" /></div>
          <h2 className="text-2xl font-bold text-slate-900 mb-0 leading-tight">{label} — Results</h2>
          {subjectMeta[subject]?.labelHindi && (
            <p className="text-sm font-semibold mb-0.5" style={{ color: accent }}>{subjectMeta[subject].labelHindi}</p>
          )}
          <p className="text-slate-600 text-xs mb-1">
            {mode === "full" ? "Full Length Test" : `Chapter: ${chapter}`}
          </p>
          <p className="text-slate-700 text-sm font-medium">{msg}</p>
          {isDemo && (
            <span className="mt-2 text-xs px-3 py-1 rounded-full inline-block" style={{ background: `${accent}20`, color: accent }}>
              Demo questions — add yours to Firebase
            </span>
          )}
          {isOfflineCached && (
            <span className="mt-2 text-xs px-3 py-1 rounded-full inline-block" style={{ background: "rgba(251,146,60,0.15)", color: "#fb923c", border: "1px solid rgba(251,146,60,0.3)" }}>
              📶 Offline — using cached questions
            </span>
          )}
          {isPremium && (
            <div className="flex items-center justify-center gap-2 mt-3">
              <span className="text-slate-600 text-xs">Explanation language:</span>
              <motion.button onClick={cycleExplainLang} whileTap={{ scale: 0.93 }}
                className="px-3 py-1 rounded-full text-xs font-semibold border transition-all"
                style={{ background: "#e0f2fe", borderColor: "#7dd3fc", color: "#075985" }}>
                {explainLangLabel}
              </motion.button>
            </div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="rounded-2xl p-6 mb-5 text-center border"
          style={{ background: "#ffffff", borderColor: "#cbd5e1", boxShadow: "0 8px 26px rgba(15,23,42,0.08)" }}
        >
          <p className="text-7xl font-black mb-1 text-slate-900">
            {score}/{questions.length}
          </p>
          <p className="text-slate-700 text-sm font-medium">{pct}% correct</p>
          <div className="mt-4 h-2 rounded-full bg-slate-200 overflow-hidden">
            <motion.div className="h-full rounded-full" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ delay: 0.4, duration: 0.8, ease: "easeOut" }}
              style={{ background: `linear-gradient(90deg, ${accent}, ${accent}bb)` }} />
          </div>
        </motion.div>

        {/* ── Progress Snapshot ────────────────────────────────────────────── */}
        {history.length >= 1 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
            className="rounded-2xl border p-4 mb-4"
            style={{ background: "#ffffff", borderColor: "#cbd5e1", boxShadow: "0 4px 18px rgba(15,23,42,0.05)" }}
          >
            <p className="text-slate-700 text-xs font-bold uppercase tracking-widest mb-3">📊 Progress Snapshot</p>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {[
                { label: "This Test", value: `${pct}%`, color: pct >= 80 ? "#10b981" : pct >= 60 ? "#f59e0b" : "#ef4444" },
                {
                  label: "Avg Score",
                  value: `${Math.round(history.reduce((a, r) => a + r.pct, 0) / history.length)}%`,
                  color: (() => { const avg = Math.round(history.reduce((a, r) => a + r.pct, 0) / history.length); return avg >= 80 ? "#10b981" : avg >= 60 ? "#f59e0b" : "#ef4444"; })(),
                },
                { label: "Best", value: `${Math.max(...history.map(r => r.pct))}%`, color: "#10b981" },
              ].map((s) => (
                <div key={s.label} className="text-center rounded-xl p-2.5" style={{ background: "#f1f5f9" }}>
                  <p className="font-black text-base" style={{ color: s.color }}>{s.value}</p>
                  <p className="text-slate-600 text-xs mt-0.5 font-medium">{s.label}</p>
                </div>
              ))}
            </div>
            {history.length >= 2 && (() => {
              const trend = history[history.length - 1].pct - history[history.length - 2].pct;
              return (
                <div className="flex items-center justify-center gap-1.5 pt-3"
                  style={{ borderTop: "1px solid #e2e8f0" }}>
                  <span className="text-sm">{trend > 0 ? "📈" : trend < 0 ? "📉" : "➡️"}</span>
                  <span className="text-xs font-bold" style={{ color: trend > 0 ? "#10b981" : trend < 0 ? "#ef4444" : "var(--app-text-ghost)" }}>
                    {trend > 0 ? `+${trend}%` : trend === 0 ? "Same as last test" : `${trend}%`}
                    <span className="font-normal text-slate-600"> vs last test</span>
                  </span>
                </div>
              );
            })()}
          </motion.div>
        )}

        {/* ── Marketing Banner (free users after mini test) ────────────────── */}
        {!isPremium && mode === "mini" && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.28 }}
            className="rounded-2xl p-4 mb-4"
            style={{
              background: "linear-gradient(135deg, #fffbeb, #fef3c7)",
              border: "1px solid #fcd34d",
              boxShadow: "0 4px 18px rgba(180,83,9,0.08)",
            }}
          >
            <div className="flex items-start gap-3">
              <motion.span
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 2 }}
                className="text-2xl shrink-0"
              >💡</motion.span>
              <div className="flex-1 min-w-0">
                <p className="text-amber-800 font-black text-xs uppercase tracking-widest mb-1">Kya aap jante hain?</p>
                <p className="text-slate-900 text-sm font-semibold leading-relaxed mb-3">
                  ₹199/- mein aap board exams tak{" "}
                  <span className="text-amber-900 font-bold">unlimited Shiken Engine tests</span> aur{" "}
                  <span className="text-amber-900 font-bold">direct mentorship</span> pa sakte hain!
                  <span className="text-slate-600 font-normal"> (Sirf ₹33 mahina)</span>
                </p>
                <motion.a
                  href={`${import.meta.env.BASE_URL}pricing`.replace("//", "/")}
                  whileTap={{ scale: 0.96 }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black text-black"
                  style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)", boxShadow: "0 2px 12px rgba(245,158,11,0.4)" }}
                >
                  👑 Upgrade करो — ₹199 / 6 months
                </motion.a>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── Progress chart ────────────────────────────────────────────────── */}
        {history.length >= 2 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="rounded-2xl border p-4 mb-4"
            style={{ background: "#ffffff", borderColor: "#cbd5e1", boxShadow: "0 4px 18px rgba(15,23,42,0.05)" }}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-slate-800 text-xs font-bold">📈 Your Progress ({history.length} tests)</p>
              <div className="flex gap-3">
                {(() => {
                  const best = Math.max(...history.map((r) => r.pct));
                  const avg  = Math.round(history.reduce((a, r) => a + r.pct, 0) / history.length);
                  const trend = history.length >= 2
                    ? history[history.length - 1].pct - history[history.length - 2].pct
                    : 0;
                  return (
                    <>
                      <div className="text-right">
                          <p className="text-slate-900 text-xs font-bold">{best}%</p>
                          <p className="text-slate-600 text-[10px]">Best</p>
                      </div>
                      <div className="text-right">
                          <p className="text-slate-900 text-xs font-bold">{avg}%</p>
                          <p className="text-slate-600 text-[10px]">Avg</p>
                      </div>
                      <div className="text-right">
                        <p className={`text-xs font-bold ${trend > 0 ? "text-emerald-700" : trend < 0 ? "text-red-700" : "text-slate-600"}`}>
                          {trend > 0 ? `+${trend}` : trend === 0 ? "–" : trend}%
                        </p>
                        <p className="text-slate-600 text-[10px]">vs prev</p>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
            <ProgressChart records={history} accent={accent} />
            <div className="flex justify-between mt-1 px-1">
              <span className="text-slate-600 text-[10px]">Older tests</span>
              <span className="text-slate-600 text-[10px]">This test →</span>
            </div>
          </motion.div>
        )}

        <div className="flex gap-3 mb-4">
          <motion.button
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}
            whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            onClick={() => { onRetry(); }}
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
            style={{ background: "var(--app-surface)", borderColor: "var(--app-border)", color: "var(--app-text-muted)" }}
          >
            ← Dashboard
          </motion.button>
        </div>

        {/* ── Shiken Engine Test Analysis ─────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
          className="mb-6"
        >
          <motion.button
            onClick={() => analysisOpen ? setAnalysisOpen(false) : fetchAnalysis()}
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
            className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-2xl border text-sm font-bold"
            style={{
              background: analysisOpen ? "#e0e7ff" : "#eef2ff",
              borderColor: "#c7d2fe",
              color: "#3730a3",
              boxShadow: analysisOpen ? "0 4px 16px rgba(67,56,202,0.12)" : "none",
            }}
          >
            {analysisLoading ? "विश्लेषण हो रहा है..." : analysisOpen ? "विश्लेषण बंद करो ↑" : "Test का विश्लेषण करो ↓"}
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
                  style={{ background: "#ffffff", borderColor: "#c7d2fe", boxShadow: "0 4px 18px rgba(67,56,202,0.08)" }}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-sm font-bold text-indigo-900">Performance Analysis</span>
                  </div>
                  {analysisText ? (
                    <div className="text-sm leading-relaxed text-slate-800 whitespace-pre-wrap">
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
                       <span className="text-xs text-slate-600">तुम्हारे results analyse कर रहा हूँ...</span>
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
            const explainKey  = `${i}-${explainLang}`;
            const isExLoading = explainLoading[explainKey] === true;
            const exText      = explainTexts[explainKey] ?? "";
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.04 }}
                className="rounded-xl border p-4"
                style={{
                  background: isRight ? "#ecfdf5" : isSkipped ? "#ffffff" : "#fff1f2",
                  borderColor: isRight ? "#86efac" : isSkipped ? "#cbd5e1" : "#fda4af",
                  boxShadow: "0 4px 16px rgba(15,23,42,0.04)",
                }}
              >
                <div className="flex items-start gap-2 mb-2">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full mt-0.5 shrink-0"
                    style={{
                      background: isRight ? "#bbf7d0" : isSkipped ? "#e2e8f0" : "#fecdd3",
                      color: isRight ? "#166534" : isSkipped ? "#475569" : "#b91c1c",
                    }}>
                    {isRight ? "✓" : isSkipped ? "–" : "✗"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-900 text-sm font-semibold leading-snug">
                      {i + 1}. <MathText text={q.english || q.hindi} />
                    </p>
                  </div>
                  <motion.button
                    onClick={() => bmkToggle(q)}
                    whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.85 }}
                    className="w-7 h-7 flex items-center justify-center rounded-lg shrink-0 ml-1"
                    style={{
                      background: isBookmarked(bmks, q) ? "#fef3c7" : "#f1f5f9",
                      border: isBookmarked(bmks, q) ? "1px solid #fbbf24" : "1px solid #cbd5e1",
                    }}
                    title={isBookmarked(bmks, q) ? "Remove bookmark" : "Bookmark"}
                  >
                    <motion.svg
                      width="13" height="13" viewBox="0 0 24 24" fill="none"
                      animate={{ scale: isBookmarked(bmks, q) ? [1, 1.3, 1] : 1 }}
                      transition={{ duration: 0.25 }}
                    >
                      {isBookmarked(bmks, q)
                        ? <path d="M5 3h14a1 1 0 0 1 1 1v18l-8-4-8 4V4a1 1 0 0 1 1-1z" fill="#fbbf24" />
                        : <path d="M5 3h14a1 1 0 0 1 1 1v18l-8-4-8 4V4a1 1 0 0 1 1-1z" fill="none" stroke="#64748b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      }
                    </motion.svg>
                  </motion.button>
                </div>
                {q.english && q.hindi && (
                  <p className="text-slate-600 text-xs mb-2 pl-1">
                    <MathText text={q.hindi} />
                  </p>
                )}
                <div className="flex flex-col gap-1 pl-1 mb-3">
                  {q.options.map((opt, oi) => {
                    const isCorrect  = oi === q.answerIndex;
                    const isUser     = oi === userAnswer;
                    const optHindi   = q.optionsHindi?.[oi];
                    const showHindiFirst = Boolean(optHindi);
                    return (
                      <div key={oi} className="flex items-start gap-2 text-xs px-3 py-1.5 rounded-lg"
                        style={{
                          background: isCorrect ? "#dcfce7" : isUser && !isRight ? "#fee2e2" : "#f8fafc",
                          border: `1px solid ${isCorrect ? "#86efac" : isUser && !isRight ? "#fca5a5" : "#e2e8f0"}`,
                          color:      isCorrect ? "#166534" : isUser && !isRight ? "#b91c1c" : "#334155",
                        }}>
                        <span className="font-bold w-4 shrink-0 mt-0.5">{String.fromCharCode(65 + oi)}.</span>
                        <span className="flex flex-col gap-0.5 flex-1 min-w-0">
                          {showHindiFirst ? (
                            <>
                              <MathText text={optHindi ?? opt} />
                              <span style={{ opacity: 0.65, fontSize: "10px" }}><MathText text={opt} /></span>
                            </>
                          ) : (
                            <MathText text={opt} />
                          )}
                        </span>
                        {isCorrect          && <span className="ml-auto font-semibold shrink-0">✓ Correct</span>}
                        {isUser && !isRight && <span className="ml-auto shrink-0">Your pick</span>}
                      </div>
                    );
                  })}
                </div>

                {/* ── Per-question Explanation ── */}
                {isPremium ? (
                  <div className="mt-2 rounded-xl border overflow-hidden"
                    style={{ background: "#eef2ff", borderColor: "#c7d2fe" }}>
                    <button
                      onClick={() => {
                        if (!isExOpen) {
                          if (!exText) { void fetchExplain(i, q, explainLang); }
                          else setExplainOpen((o) => ({ ...o, [i]: true }));
                        } else if (!exText && !isExLoading) {
                          void fetchExplain(i, q, explainLang);
                        } else {
                          setExplainOpen((o) => ({ ...o, [i]: false }));
                        }
                      }}
                      className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-semibold"
                      style={{ color: isExLoading ? "#4338ca" : "#3730a3" }}
                    >
                      <span>{isExLoading ? "समझाया जा रहा है…" : isExOpen ? "Explanation छुपाएं ↑" : "🤖 Explain करें ↓"}</span>
                      {q.chapter && q.chapter !== "General" && q.chapter !== "AI Generated" && q.chapter !== "Shiken Generated" && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium ml-2 shrink-0"
                          style={{ background: "#e0e7ff", color: "#3730a3", border: "1px solid #c7d2fe" }}>
                          {q.chapter}
                        </span>
                      )}
                    </button>

                    <AnimatePresence>
                      {(isExOpen || isExLoading) && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                          className="overflow-hidden"
                        >
                          <div className="px-3 pb-4 pt-0 border-t" style={{ borderColor: "#c7d2fe" }}>
                            {isExLoading && !exText ? (
                              <div className="flex items-center gap-2 py-3">
                                {[0, 1, 2].map((j) => (
                                  <motion.div key={j} animate={{ y: [0, -4, 0] }}
                                    transition={{ repeat: Infinity, duration: 0.6, delay: j * 0.12 }}
                                    className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                                ))}
                                <span className="text-xs text-slate-600 ml-1">समझाया जा रहा है...</span>
                              </div>
                            ) : (
                              <div className="pt-3">
                                <ExplainText text={exText} loading={isExLoading} />
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ) : (
                  <button onClick={() => fetchExplain(i, q, explainLang)}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-xs font-semibold mt-2"
                    style={{ background: "#eef2ff", borderColor: "#c7d2fe", color: "#3730a3" }}>
                    <span>🤖 Explain करें — Premium unlock करें</span>
                    {q.chapter && q.chapter !== "General" && q.chapter !== "AI Generated" && q.chapter !== "Shiken Generated" && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium ml-2 shrink-0"
                        style={{ background: "#e0e7ff", color: "#3730a3", border: "1px solid #c7d2fe" }}>
                        {q.chapter}
                      </span>
                    )}
                  </button>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Main SubjectPage ─────────────────────────────────────────────────────────

type Screen = "loading" | "mode-select" | "mini-chapter-select" | "chapter-select" | "chapter-generating" | "ai-chapter-select" | "ai-generating" | "smart-generating" | "comprehension-generating" | "comprehension-passage" | "quiz" | "result" | "saved-questions";

export default function SubjectPage() {
  const params  = useParams<{ subject: string }>();
  const [location, navigate] = useLocation();
  const entranceType = location.startsWith("/jee/") ? "jee" : location.startsWith("/neet/") ? "neet" : null;
  const classId = entranceType ? "entrance" : location.startsWith("/c12/") ? "12" : "10";
  const subject = params.subject ?? "";
  const meta    = entranceType
    ? (entranceSubjectMeta[entranceType][subject] ?? entranceSubjectMeta.jee[subject] ?? subjectMeta[subject])
    : classId === "12"
      ? (class12SubjectMeta[subject] ?? subjectMeta[subject])
      : subjectMeta[subject];
  const fullTestKey  = `shiken_free_full_used_${classId}_${subject}`;
  const dailyMiniKey = `shiken_daily_mini_${classId}_${subject}`;

  // All questions fetched from Firebase (or demo)
  const [allQuestions, setAllQuestions]     = useState<Question[]>([]);
  const [isDemo, setIsDemo]                 = useState(false);
  const [isOfflineCached, setIsOfflineCached] = useState(false);
  const [screen, setScreen]                 = useState<Screen>("loading");

  // Dynamic chapter keys fetched directly from Firebase (shallow query).
  // Used for Hindi (Class 10) where chapter keys are Hindi-script strings.
  const [dynamicChapterKeys, setDynamicChapterKeys] = useState<string[]>([]);

  // Saved progress (from localStorage)
  const [savedProgress, setSavedProgress] = useState<SavedProgress | null>(null);

  // Test config chosen by user
  const [mode, setMode]           = useState<"full" | "chapter" | "ai" | "mini">("full");
  const [selectedChapter, setSelectedChapter] = useState("");

  // Active quiz state
  const [questions, setQuestions]       = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers]           = useState<Record<number, number>>({});
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [direction, setDirection]       = useState(1);

  // Timer state: -1 = not started, 0 = expired, >0 = seconds remaining
  const FULL_TIMER    = 60 * 60; // 60 min
  const CHAPTER_TIMER = 20 * 60; // 20 min
  const [timerLeft, setTimerLeft]   = useState(-1);
  const [timerHidden, setTimerHidden] = useState(false);

  // Question palette
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Language toggle reads the selected language directly from each question.
  const [lang, setLang] = useState<QuestionLanguage>("en");
  function cycleLang() { setLang((current) => current === "en" ? "hi" : "en"); }
  const langLabel = lang === "en" ? "English" : "हिंदी";

  // Bookmarks
  const [bookmarks, setBookmarks] = useState<Question[]>(() => loadBookmarks(subject));

  // History (refreshed when returning from result screen)
  const [subjectHistory, setSubjectHistory] = useState<TestRecord[]>(() => loadHistory(subject));
  const refreshHistory = () => setSubjectHistory(loadHistory(subject));

  // Subscription & upgrade modal
  const { isPremium, isTopper, isSubjectPremium, isActive, daysLeft, expiryDate } = useSubscription();
  const isSubjectPrem = isSubjectPremium(subject);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [showChoosePlan, setShowChoosePlan] = useState(false);
  const [hasUsedFreeFull, setHasUsedFreeFull] = useState(() => localStorage.getItem(fullTestKey) === "used");
  const [dailyMiniCooldown, setDailyMiniCooldown] = useState<string | null>(null);

  // Comprehension passage state
  const [passageTitle,       setPassageTitle]       = useState("");
  const [passageText,        setPassageText]        = useState("");
  const [showPassageInQuiz,  setShowPassageInQuiz]  = useState(false);

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

  // ── Shallow-fetch chapter keys for Hindi (Class 10) ─────────────────────────
  // Reads only the top-level keys of hindi/ (chapter slugs) without downloading
  // all question data. This lets the chapter-select screen appear immediately
  // while the full question load runs in the background.
  useEffect(() => {
    if (subject !== "hindi" || classId === "12") {
      setDynamicChapterKeys([]);
      return;
    }
    let cancelled = false;
    const doShallow = async () => {
      try {
        let token: string | null = null;
        try { if (auth.currentUser) token = await auth.currentUser.getIdToken(); } catch { /* ignore */ }
        const url = `https://shiken-d8789-default-rtdb.firebaseio.com/hindi.json?shallow=true${token ? `&auth=${token}` : ""}`;
        const r   = await fetch(url);
        const data = await r.json() as Record<string, boolean> | { error: string } | null;
        if (cancelled || !data || typeof data !== "object" || "error" in data) return;
        // Filter out any metadata keys and sort alphabetically for consistent display
        const keys = Object.keys(data).filter((k) => k.length > 0);
        if (!cancelled) setDynamicChapterKeys(keys);
      } catch { /* ignore — full-question load is the fallback */ }
    };
    void doShallow();
    return () => { cancelled = true; };
  }, [subject, classId]);

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
    const dbPath = meta.path; // preserve exact case to match Firebase paths

    const doFetch = async () => {
      // Get auth token if user is logged in so Firebase rules allow the read
      let token: string | null = null;
      try {
        if (auth.currentUser) {
          token = await auth.currentUser.getIdToken();
        }
      } catch { /* ignore token errors */ }

      const encodedPath = dbPath.split("/").map(encodeURIComponent).join("/");
      const dbUrl = `https://shiken-d8789-default-rtdb.firebaseio.com/${encodedPath}.json${token ? `?auth=${token}` : ""}`;

      const r = await fetch(dbUrl, { signal: controller.signal });
      return r.json();
    };

    doFetch()
      .then((data: unknown) => {
        if (!mountedRef.current) return;
        // Firebase returns {"error":"..."} on permission denied — that's an object with no questions
        const parsed = data && typeof data === "object" && !("error" in (data as object))
          ? parseQuestions(data, subject, classId)
          : [];
        if (parsed.length > 0) {
          setAllQuestions(parsed);
          setIsDemo(false);
          setIsOfflineCached(false);
          saveQuestionsToCache(classId, subject, parsed);
        } else {
          // No data or permission denied — try local cache first
          const cached = loadQuestionsFromCache(classId, subject);
          if (cached && (cached as Question[]).length > 0) {
            setAllQuestions(cached as Question[]);
            setIsDemo(false);
            setIsOfflineCached(true);
          } else {
            setAllQuestions(demoQuestions[subject] ?? demoQuestions.maths);
            setIsDemo(true);
            setIsOfflineCached(false);
          }
        }
        setSavedProgress(loadProgress(subject));
        setScreen("mode-select");
      })
      .catch((err: Error) => {
        if (err.name === "AbortError" || !mountedRef.current) return;
        const cached = loadQuestionsFromCache(classId, subject);
        if (cached && (cached as Question[]).length > 0) {
          setAllQuestions(cached as Question[]);
          setIsDemo(false);
          setIsOfflineCached(true);
        } else {
          setAllQuestions(demoQuestions[subject] ?? demoQuestions.maths);
          setIsDemo(true);
          setIsOfflineCached(false);
        }
        setSavedProgress(loadProgress(subject));
        setScreen("mode-select");
      });

    return () => controller.abort();
  }, [subject]);

  // ── Derived data ─────────────────────────────────────────────────────────────
  const chapters = (() => {
    // Build a question-count map from loaded questions
    const map = new Map<string, number>();
    allQuestions.forEach((q) => map.set(q.chapter, (map.get(q.chapter) ?? 0) + 1));

    let list: { name: string; count: number }[];

    if (subject === "hindi" && classId !== "12" && dynamicChapterKeys.length > 0) {
      // ── Hindi (Class 10): Use Firebase chapter keys directly ─────────────────
      // Convert underscore-encoded keys (e.g. अति_सूधो_सनेह_को_मारग_है) to
      // display names with spaces. Counts come from the loaded question pool.
      list = dynamicChapterKeys.map((key) => {
        const displayName = key.replace(/_/g, " ");
        // Count may be stored under the display name or the original slug
        const count = map.get(displayName) ?? map.get(key) ?? 0;
        return { name: displayName, count };
      }).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "hi"));
    } else {
      // ── All other subjects: derive chapters from parsed questions, sorted by
      //    NCERT canonical textbook order; unknowns sorted by count at the end ──
      const canonOrder = getCanonicalChapters(subject, classId);
      const canonIndex = (name: string) => {
        const i = canonOrder.indexOf(name);
        return i === -1 ? canonOrder.length : i;
      };

      list = Array.from(map.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => {
          const ia = canonIndex(a.name);
          const ib = canonIndex(b.name);
          if (ia !== ib) return ia - ib;
          // Both unrecognised: sort by question count (more first), then name
          if (ia === canonOrder.length) return b.count - a.count || a.name.localeCompare(b.name);
          return a.name.localeCompare(b.name);
        });
    }

    // Inject virtual Comprehension chapter for Hindi and Sanskrit (Shiken Engine passages)
    if ((subject === "hindi" || subject === "sanskrit") && !list.some((c) => c.name === "Comprehension")) {
      list.push({ name: "Comprehension", count: 7 });
    }
    return list;
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

  // ── Firebase: save Shiken Engine-generated questions (dedup by english text) ─────────────
  async function saveAIQuestionsToFirebase(generated: Question[]) {
    if (!meta || generated.length === 0) return;
    const dbPath = meta.path; // preserve exact case to match Firebase paths
    try {
      const subjectRef = ref(db, dbPath);
      const snap = await get(subjectRef);
      const existing = parseQuestions(snap.val(), subject, classId);
      const existingSet = new Set(existing.map((q) => q.english.toLowerCase().trim().slice(0, 80)));
      const newOnes = generated.filter(
        (q) => q.english && !existingSet.has(q.english.toLowerCase().trim().slice(0, 80))
      );
      for (const q of newOnes) {
        const chSlug = toChapterSlug(q.chapter || "Shiken Generated");
        const chapter = q.chapter || "Shiken Generated";
        await push(ref(db, `${dbPath}/${chSlug}`), {
          questionId: q.questionId || createQuestionId(subject, chapter),
          subject: meta.label,
          chapter,
          correctOptionIndex: q.answerIndex,
          en: {
            question: q.english,
            options: q.options,
            explanation: q.en?.explanation ?? q.explanation ?? "",
          },
          hi: {
            question: q.hindi || "",
            options: q.optionsHindi ?? [],
            explanation: q.hi?.explanation ?? "",
          },
        });
      }
    } catch { /* non-critical — DB save failed, quiz continues */ }
  }

  // ── Start quiz helpers ────────────────────────────────────────────────────────
  async function startFullTest() {
    clearProgress(subject);
    setSavedProgress(null);
    setMode("full");
    setSelectedChapter("All Chapters");
    setScreen("smart-generating");

    // Pick ~85% from existing DB (43) and ~15% AI-generated (7) for 50 total
    const DB_COUNT = 43;
    const AI_COUNT = 7;
    const existingQuestions = pick(allQuestions, DB_COUNT);

    // Pick representative chapters for AI prompt
    const HINDI_GRAMMAR_CHAPTERS = [
      "वर्ण विचार","संज्ञा","सर्वनाम","क्रिया","विशेषण",
      "संधि","समास","काल","कारक","मुहावरे","लोकोक्तियाँ","शुद्ध-अशुद्ध वाक्य","एक शब्द",
    ];
    const SANSKRIT_GRAMMAR_CHAPTERS = [
      "संधि","समास","प्रकरणम्","प्रत्यय","शब्दरूप","धातुरूप","वाक्य रचना",
    ];
    const isHindiSubject   = subject === "hindi";
    const isSanskritSubject = subject === "sanskrit";
    const isGrammarSubject  = isHindiSubject || isSanskritSubject;
    const chapterCounts = new Map<string, number>();
    allQuestions.forEach((q) => {
      if (isGrammarSubject && q.chapter === "?") return;
      chapterCounts.set(q.chapter, (chapterCounts.get(q.chapter) ?? 0) + 1);
    });
    const fallbackGrammarChapters = isSanskritSubject ? SANSKRIT_GRAMMAR_CHAPTERS : HINDI_GRAMMAR_CHAPTERS;
    const topChapters = chapterCounts.size > 0
      ? [...chapterCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([c]) => c).join(", ")
      : isGrammarSubject
        ? fallbackGrammarChapters.sort(() => Math.random() - 0.5).slice(0, 4).join(", ")
        : "General";

    let aiQuestions: Question[] = [];
    try {
      const subjectLabel = meta?.label ?? subject;
      const chapterKey   = topChapters || "General";

      // ── 1. Check shared Firebase cache first (instant, no API call) ───────────
      const cached = await getCachedQuestions(subjectLabel, chapterKey, AI_COUNT);
      if (cached && cached.length >= AI_COUNT) {
        aiQuestions = cached.map((q) => ({ ...q, chapter: "Shiken Generated" }));
      } else {
        // ── 2. Generate via Shiken Engine (browser-direct, server fallback) ────────────
        const fetched = await (async () => {
          try {
            return await generateQuestions(subjectLabel, chapterKey, AI_COUNT, classId);
          } catch {
            const resp = await fetch("/api/generate-questions", {
              method: "POST",
              headers: aiHeaders(),
              body: JSON.stringify({ subject: subjectLabel, chapter: chapterKey, count: AI_COUNT, classId }),
            });
            const data = await resp.json() as { questions?: unknown[] };
            if (!Array.isArray(data.questions) || data.questions.length === 0) throw new Error("empty");
            return (data.questions as Record<string, unknown>[]).map((q) => ({
              english:      String(q.english      ?? ""),
              hindi:        String(q.hindi        ?? ""),
              options:      Array.isArray(q.options)      ? (q.options      as unknown[]).map(String) : [],
              optionsHindi: Array.isArray(q.optionsHindi) ? (q.optionsHindi as unknown[]).map(String) : [],
              answerIndex:  typeof q.answerIndex === "number" ? q.answerIndex : 0,
            }));
          }
        })();
        aiQuestions = fetched
          .map((q) => ({ ...q, chapter: "Shiken Generated" }))
          .filter((q) => q.english && q.options.length >= 2);
        // ── 3. Merge into shared cache + subject DB (non-blocking) ───────────
        mergeQuestionsToCache(subjectLabel, chapterKey, fetched).catch(() => {});
        saveAIQuestionsToFirebase(aiQuestions).catch(() => {});
      }
    } catch { /* AI generation failed — fall back to DB-only */ }

    // Fill up to 50 total (pad with more DB questions if AI failed)
    const needed = Math.max(0, 50 - existingQuestions.length - aiQuestions.length);
    const usedEnglish = new Set(existingQuestions.map((q) => q.english));
    const extra = needed > 0 ? pick(allQuestions.filter((q) => !usedEnglish.has(q.english)), needed) : [];
    const combined = shuffle([...existingQuestions, ...aiQuestions, ...extra]).slice(0, 50);

    setQuestions(combined);
    setCurrentIndex(0);
    setAnswers({});
    setSelectedOption(null);
    setDirection(1);
    setTimerLeft(FULL_TIMER);
    setTimerHidden(false);
    saveProgress(subject, { mode: "full", chapter: "All Chapters", questions: combined, currentIndex: 0, answers: {}, timestamp: Date.now(), timerLeft: FULL_TIMER });
    // Mark free full test as used (1 free test per class+subject)
    if (!isSubjectPrem) {
      localStorage.setItem(fullTestKey, "used");
      setHasUsedFreeFull(true);
    }
    setScreen("quiz");
  }

  function startMiniTest(chapter = "All Chapters") {
    // ── Daily limit: free users get 1 mini test per 24 hours ─────────────────
    if (!isSubjectPrem) {
      const remaining = getDailyMiniTimeRemaining(dailyMiniKey);
      if (remaining) {
        setDailyMiniCooldown(remaining);
        return;
      }
      // Stamp the start time so subsequent checks block further tests
      localStorage.setItem(dailyMiniKey, String(Date.now()));
    }
    setDailyMiniCooldown(null);
    clearProgress(subject);
    setSavedProgress(null);
    setMode("mini");
    setSelectedChapter(chapter);
    setPassageTitle("");
    setPassageText("");
    setShowPassageInQuiz(false);
    const pool = chapter === "All Chapters" ? allQuestions : allQuestions.filter(q => q.chapter === chapter);
    const picked = pick(pool.length > 0 ? pool : allQuestions, 10);
    setQuestions(picked);
    setCurrentIndex(0);
    setAnswers({});
    setSelectedOption(null);
    setDirection(1);
    setTimerLeft(10 * 60);
    setTimerHidden(false);
    saveProgress(subject, { mode: "mini", chapter, questions: picked, currentIndex: 0, answers: {}, timestamp: Date.now(), timerLeft: 10 * 60 });
    setScreen("quiz");
  }

  async function startComprehensionTest() {
    clearProgress(subject);
    setSavedProgress(null);
    setMode("mini");
    setSelectedChapter("Comprehension");
    setShowPassageInQuiz(false);
    setScreen("comprehension-generating");

    const subj = subject as "english" | "hindi" | "sanskrit";
    const fbPath = subj === "hindi" ? "hindi_passages" : subj === "sanskrit" ? "sanskrit_passages" : "english_passages";

    try {
      // 1. Try Firebase passage bank first
      const snap = await get(ref(db, fbPath));
      const data = snap.val() as Record<string, { title: string; passage: string; questions: unknown[] }> | null;

      if (data) {
        const passages = Object.entries(data);
        const pickedIndex = Math.floor(Math.random() * passages.length);
        const [passageId, picked] = passages[pickedIndex];
        setPassageTitle(picked.title);
        setPassageText(picked.passage);
        const qs = picked.questions
          .map((q, questionIndex) => {
            const normalized = normalizeQuestionRecord(q, {
              subject: meta?.label ?? subject,
              chapter: "Comprehension",
              identitySeed: `${fbPath}/${passageId}/${questionIndex}`,
            });
            return {
              ...normalized,
              questionId: normalized.questionId,
              english: normalized.en.question,
              hindi: normalized.hi.question,
              options: normalized.en.options.slice(0, 4),
              optionsHindi: normalized.hi.options.slice(0, 4),
              answerIndex: normalized.correctOptionIndex,
              chapter: "Comprehension",
              explanation: normalized.en.explanation,
            };
          })
          .filter((q) => (q.english || q.hindi) && q.options.length >= 2);
        setQuestions(qs);
      } else {
        // 2. Generate via Shiken Engine (browser-direct, server fallback)
        const result = await (async () => {
          try {
            return await generateComprehension(7, subj);
          } catch {
            const resp = await fetch("/api/generate-comprehension", {
              method: "POST",
              headers: aiHeaders(),
              body: JSON.stringify({ count: 7, subject: subj }),
            });
            if (!resp.ok) throw new Error("Server comprehension failed");
            return await resp.json() as { title: string; passage: string; questions: Array<{ english: string; hindi: string; options: string[]; optionsHindi: string[]; answerIndex: number }> };
          }
        })();
        setPassageTitle(result.title);
        setPassageText(result.passage);
        const canonicalQuestions = result.questions.map((q, index) => ({
          questionId: createQuestionId(subj, "Comprehension"),
          subject: meta?.label ?? subj,
          chapter: "Comprehension",
          correctOptionIndex: q.answerIndex,
          en: { question: q.english, options: q.options, explanation: "" },
          hi: { question: q.hindi || "", options: q.optionsHindi ?? q.options.map(() => ""), explanation: "" },
          english: q.english,
          hindi: q.hindi || "",
          options: q.options,
          optionsHindi: q.optionsHindi ?? [],
          answerIndex: q.answerIndex,
          explanation: undefined,
        }));
        setQuestions(canonicalQuestions);
        // Cache to Firebase for future students
        push(ref(db, fbPath), {
          title:     result.title,
          passage:   result.passage,
          questions: canonicalQuestions.map(({ questionId, subject, chapter, correctOptionIndex, en, hi }) => ({
            questionId, subject, chapter, correctOptionIndex, en, hi,
          })),
        }).catch(() => {});
      }
    } catch {
      // Fallback: use existing Comprehension questions (no passage shown)
      const pool = allQuestions.filter((q) => q.chapter === "Comprehension");
      setQuestions(pick(pool.length > 0 ? pool : allQuestions, 7));
      setPassageTitle("Comprehension");
      setPassageText("");
    }

    setCurrentIndex(0);
    setAnswers({});
    setSelectedOption(null);
    setDirection(1);
    setTimerLeft(-1);
    setTimerHidden(false);
    setScreen("comprehension-passage");
  }

  function handleMiniChapterSelect(chapter: string) {
    const isComprehensionSubject = subject === "english" || subject === "hindi" || subject === "sanskrit";
    if (isComprehensionSubject && chapter === "Comprehension") {
      if (!isTopper) { setUpgradeOpen(true); return; }
      void startComprehensionTest();
    } else {
      startMiniTest(chapter);
    }
  }

  async function startChapterTest(chapter: string) {
    clearProgress(subject);
    setSavedProgress(null);
    setMode("chapter");
    setSelectedChapter(chapter);
    const pool   = allQuestions.filter((q) => q.chapter === chapter);
    const picked = pick(pool, 20);

    // ── If DB has fewer than 20, generate AI questions to fill ──
    let finalQuestions = picked;
    if (picked.length < 20) {
      const need = 20 - picked.length;
      setScreen("chapter-generating");
      try {
        const subjectLabel = meta?.label ?? subject;
        // Reuse the shared Firebase AI cache before asking Gemini for the
        // same chapter content again.
        const cachedAI = await getCachedQuestions(subjectLabel, chapter, need);
        let fetched;
        if (cachedAI && cachedAI.length >= need) {
          fetched = cachedAI;
        } else {
          fetched = await (async () => {
            try {
              return await generateQuestions(subjectLabel, chapter, need, classId);
            } catch {
              const resp = await fetch("/api/generate-questions", {
                method: "POST",
                headers: aiHeaders(),
                body: JSON.stringify({ subject: subjectLabel, chapter, count: need, classId }),
              });
              const data = await resp.json() as { questions?: unknown[] };
              if (!Array.isArray(data.questions) || data.questions.length === 0) throw new Error("empty");
              return (data.questions as Record<string, unknown>[]).map((q) => ({
                english:      String(q.english      ?? ""),
                hindi:        String(q.hindi        ?? ""),
                options:      Array.isArray(q.options)      ? (q.options      as unknown[]).map(String) : [],
                optionsHindi: Array.isArray(q.optionsHindi) ? (q.optionsHindi as unknown[]).map(String) : [],
                answerIndex:  typeof q.answerIndex === "number" ? q.answerIndex : 0,
              }));
            }
          })();
        }
        const ai = fetched
          .map((q) => ({ ...q, chapter: chapter || "Shiken Generated" }))
          .filter((q) => q.english && q.options.length >= 2);
        // Save fresh results to both caches so later tests can reuse them.
        if (!cachedAI && fetched.length > 0) {
          mergeQuestionsToCache(subjectLabel, chapter, fetched).catch(() => {});
          saveAIQuestionsToFirebase(ai.map(q => ({ ...q, chapter: chapter || "Shiken Generated" }))).catch(() => {});
        }
        finalQuestions = shuffle([...picked, ...ai.slice(0, need)]);
      } catch {
        // AI generation failed — proceed with whatever DB gave us
      }
    }

    setQuestions(finalQuestions);
    setCurrentIndex(0);
    setAnswers({});
    setSelectedOption(null);
    setDirection(1);
    setTimerLeft(CHAPTER_TIMER);
    setTimerHidden(false);
    saveProgress(subject, { mode: "chapter", chapter, questions: finalQuestions, currentIndex: 0, answers: {}, timestamp: Date.now(), timerLeft: CHAPTER_TIMER });
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
    setDirection(1);
    setTimerLeft(savedProgress.timerLeft ?? (savedProgress.mode === "full" ? FULL_TIMER : CHAPTER_TIMER));
    setTimerHidden(false);
    setScreen("quiz");
  }

  function resetQuizState() {
    setCurrentIndex(0);
    setAnswers({});
    setSelectedOption(null);
    setDirection(1);
    setTimerLeft(-1);
    setTimerHidden(false);
  }

  function retryTest() {
    if (mode === "full") { void startFullTest(); }
    else if (mode === "mini" && selectedChapter === "Comprehension" && isTopper && (subject === "english" || subject === "hindi" || subject === "sanskrit")) { void startComprehensionTest(); }
    else if (mode === "mini") { startMiniTest(selectedChapter); }
    else if (mode === "chapter") { startChapterTest(selectedChapter); }
    else { startAIPractice(selectedChapter); }
  }

  async function startAIPractice(chapter: string) {
    clearProgress(subject);
    setSavedProgress(null);
    setMode("ai");
    setSelectedChapter(chapter);
    setScreen("ai-generating");

    // Preserve the "Generating…" UX feel with a short delay
    await new Promise<void>((resolve) => setTimeout(resolve, 700));

    try {
      // ── Pick 5 random questions from the already-loaded DB pool ──────────────
      // Filter to the selected chapter; "All Chapters" / "General" uses the full pool.
      const isAllChapters = !chapter || chapter === "All Chapters" || chapter === "General";
      const pool = isAllChapters
        ? allQuestions
        : allQuestions.filter(
            (q) =>
              !q.chapter ||
              q.chapter.toLowerCase() === chapter.toLowerCase() ||
              q.chapter === "General"
          );

      // Shuffle and take up to 5; if fewer exist just use all of them
      const shuffled = [...pool].sort(() => Math.random() - 0.5);
      const picked   = shuffled.slice(0, 5);

      if (picked.length === 0) throw new Error("No questions available for this chapter");

      const qs: Question[] = picked.map((q) => ({ ...q, chapter }));
      setQuestions(qs);
      setCurrentIndex(0);
      setAnswers({});
      setSelectedOption(null);
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
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--app-bg)" }}>
        <p className="text-white/50">Subject not found.</p>
      </div>
    );
  }

  if (screen === "loading") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: "var(--app-bg)" }}>
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-10 h-10 rounded-full border-2 border-transparent"
          style={{ borderTopColor: meta.accent, borderRightColor: `${meta.accent}50` }} />
        <p className="text-white/40 text-sm">Loading {meta.label} questions...</p>
      </div>
    );
  }

  if (screen === "mode-select") {
    return (
      <>
        <ModeSelect
          meta={meta}
          subject={subject}
          totalCount={allQuestions.length}
          savedProgress={savedProgress}
          onFull={startFullTest}
          onChapterWise={() => setScreen("chapter-select")}
          onAI={() => setScreen("ai-chapter-select")}
          onSaved={() => setScreen("saved-questions")}
          onResume={handleResume}
          savedCount={bookmarks.length}
          history={subjectHistory}
          isPremium={isSubjectPrem}
          onMiniTest={() => {
            if (!isSubjectPrem) {
              const r = getDailyMiniTimeRemaining(dailyMiniKey);
              if (r) { setDailyMiniCooldown(r); setScreen("mini-chapter-select"); return; }
            }
            setDailyMiniCooldown(null);
            setScreen("mini-chapter-select");
          }}
          onUpgrade={() => {
            if (isPremium && !isActive) setShowChoosePlan(true);
            else setUpgradeOpen(true);
          }}
          hasUsedFreeFull={hasUsedFreeFull}
        />
        <UpgradeModal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} />
        {showChoosePlan && (
          <ChoosePlanOverlay
            goal={entranceType ? (entranceType as "jee" | "neet") : classId === "12" ? "c12" : "c10"}
            onClose={() => setShowChoosePlan(false)}
          />
        )}
      </>
    );
  }

  if (screen === "mini-chapter-select") {
    // ── Daily limit reached — show cooldown screen ────────────────────────────
    if (!isSubjectPrem && dailyMiniCooldown) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center"
          style={{ background: "var(--app-bg)" }}>
          <p className="text-4xl mb-4">⏳</p>
          <p className="text-white font-black text-xl mb-2">Aaj ka Mini Test ho gaya!</p>
          <p className="text-white/50 text-sm mb-1">Free users ko 24 ghante mein 1 Mini Test milta hai.</p>
          <p className="text-white/30 text-xs mb-6">
            Next test available in{" "}
            <span style={{ color: "#fbbf24", fontWeight: 700 }}>{dailyMiniCooldown}</span>
          </p>
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={() => { setDailyMiniCooldown(null); setScreen("mode-select"); }}
            className="px-6 py-3 rounded-xl text-sm font-bold border"
            style={{ background: "var(--app-surface)", borderColor: "var(--app-border)", color: "rgba(255,255,255,0.6)" }}
          >
            ← Back
          </motion.button>
        </div>
      );
    }
    return (
      <>
        <ChapterSelect
          meta={meta}
          chapters={chapters}
          onBack={() => setScreen("mode-select")}
          onSelect={handleMiniChapterSelect}
          title="Mini Test · Free"
          showAll
          allLabel="All Chapters — Mixed"
          topperChapters={!isTopper && (subject === "english" || subject === "hindi" || subject === "sanskrit") ? ["Comprehension"] : []}
          onUpgrade={() => setUpgradeOpen(true)}
        />
        <UpgradeModal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} />
      </>
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
        meta={{ ...meta, label: "Shiken Practice — " + meta.label }}
        chapters={chapters}
        onBack={() => setScreen("mode-select")}
        onSelect={startAIPractice}
      />
    );
  }

  if (screen === "saved-questions") {
    return (
      <div className="min-h-screen px-4 py-6" style={{ background: "var(--app-bg)" }}>
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(251,191,36,0.12) 0%, transparent 55%)" }} />
        <div className="max-w-lg mx-auto relative z-10">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <motion.button whileHover={{ scale: 1.07 }} whileTap={{ scale: 0.93 }}
              onClick={() => setScreen("mode-select")}
              className="w-9 h-9 rounded-xl flex items-center justify-center border text-sm"
              style={{ background: "var(--app-surface)", borderColor: "var(--app-border)", color: "var(--app-text-muted)" }}>
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
                  setDirection(1); setMode("chapter"); setSelectedChapter("Saved Questions");
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

  if (screen === "chapter-generating") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-6" style={{ background: "var(--app-bg)" }}>
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse at 50% 40%, rgba(6,182,212,0.18) 0%, transparent 60%)" }} />
        <motion.div className="relative z-10 text-center w-full max-w-sm">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
            className="w-14 h-14 rounded-full border-2 border-transparent mx-auto mb-5"
            style={{ borderTopColor: "#06b6d4", borderRightColor: "#06b6d450" }}
          />
          <p className="text-white font-bold text-lg mb-1">Shiken Engine is generating questions...</p>
          <p className="text-white/40 text-sm mb-4">शिकेन इंज़िन इस chapter के लिए सवाल बना रहा है</p>
          <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden mb-2">
            <motion.div
              className="h-full rounded-full"
              style={{ background: "linear-gradient(90deg, #06b6d4, #8b5cf6)" }}
              animate={{ width: ["0%", "60%", "85%", "100%"] }}
              transition={{ duration: 4, ease: "easeInOut", repeat: Infinity }}
            />
          </div>
          <p className="text-cyan-400/60 text-xs">Chapter: {selectedChapter}</p>
        </motion.div>
      </div>
    );
  }

  if (screen === "ai-generating") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-6" style={{ background: "var(--app-bg)" }}>
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse at 50% 40%, rgba(99,102,241,0.18) 0%, transparent 60%)" }} />
        <motion.div className="relative z-10 text-center w-full max-w-sm">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
            className="w-14 h-14 rounded-full border-2 border-transparent mx-auto mb-5"
            style={{ borderTopColor: "#6366f1", borderRightColor: "#6366f150" }}
          />
          <p className="text-white font-bold text-lg mb-1">Preparing your personalized test...</p>
          <p className="text-white/40 text-sm mb-4">शिकेन इंज़िन तुम्हारे लिए सवाल तैयार कर रहा है</p>
          <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden mb-2">
            <motion.div
              className="h-full rounded-full"
              style={{ background: "linear-gradient(90deg, #6366f1, #8b5cf6)" }}
              animate={{ width: ["0%", "60%", "85%", "100%"] }}
              transition={{ duration: 4, ease: "easeInOut", repeat: Infinity }}
            />
          </div>
          <p className="text-indigo-400/60 text-xs">Chapter: {selectedChapter}</p>
        </motion.div>
      </div>
    );
  }

  if (screen === "smart-generating") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-6" style={{ background: "var(--app-bg)" }}>
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: `radial-gradient(ellipse at 50% 40%, ${meta.accent}22 0%, transparent 60%)` }} />
        <motion.div className="relative z-10 text-center px-4 w-full max-w-sm">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
            className="w-16 h-16 rounded-full border-2 border-transparent mx-auto mb-6"
            style={{ borderTopColor: meta.accent, borderRightColor: `${meta.accent}50` }}
          />
          <p className="text-white font-bold text-xl mb-2">Preparing your test...</p>
          <p className="text-white/40 text-sm mb-5">आपका टेस्ट तैयार किया जा रहा है</p>
          <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: `linear-gradient(90deg, ${meta.accent}, ${meta.accent}cc)` }}
              animate={{ width: ["0%", "40%", "70%", "100%"] }}
              transition={{ duration: 3, ease: "easeInOut", repeat: Infinity }}
            />
          </div>
        </motion.div>
      </div>
    );
  }

  if (screen === "comprehension-generating") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-6" style={{ background: "var(--app-bg)" }}>
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: `radial-gradient(ellipse at 50% 40%, ${meta.accent}20 0%, transparent 60%)` }} />
        <motion.div className="relative z-10 text-center w-full max-w-sm">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.3, repeat: Infinity, ease: "linear" }}
            className="w-16 h-16 rounded-full border-2 border-transparent mx-auto mb-6"
            style={{ borderTopColor: meta.accent, borderRightColor: `${meta.accent}50` }}
          />
          <p className="text-white font-bold text-xl mb-2">Preparing your personalized test...</p>
          <p className="text-white/40 text-sm mb-4">शिकेन इंज़िन तुम्हारे लिए गद्यांश तैयार कर रहा है</p>
          <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: `linear-gradient(90deg, ${meta.accent}, ${meta.accent}cc)` }}
              animate={{ width: ["0%", "50%", "80%", "100%"] }}
              transition={{ duration: 4, ease: "easeInOut", repeat: Infinity }}
            />
          </div>
        </motion.div>
      </div>
    );
  }

  if (screen === "comprehension-passage") {
    return (
      <div className="min-h-screen w-full overflow-auto relative" style={{ background: "var(--app-bg)" }}>
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: `radial-gradient(ellipse at 50% 15%, ${meta.accent}18 0%, transparent 55%)` }} />

        <div className="relative z-10 max-w-lg mx-auto px-4 pt-6 pb-10 flex flex-col min-h-screen">
          {/* Top bar */}
          <div className="flex items-center justify-between mb-6">
            <motion.button
              onClick={() => setScreen("mini-chapter-select")}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-1.5 text-white/40 hover:text-white/70 transition-colors text-sm"
            >
              ← Back
            </motion.button>
            <span className="text-xs font-semibold px-3 py-1 rounded-full"
              style={{ background: `${meta.accent}18`, color: `${meta.accent}dd`, border: `1px solid ${meta.accent}30` }}>
              📖 Unseen Passage
            </span>
          </div>

          {/* Title */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="mb-5">
            <h1 className="text-2xl font-black text-white leading-tight">{passageTitle}</h1>
            <p className="text-white/35 text-xs mt-2 font-medium">
              {questions.length} questions · Read carefully before answering
            </p>
          </motion.div>

          {/* Passage card */}
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.1 }}
            className="rounded-2xl border p-5 mb-6 flex-1"
            style={{ background: `linear-gradient(145deg, ${meta.accent}10, rgba(255,255,255,0.03))`, borderColor: `${meta.accent}28` }}
          >
            <div className="flex items-center gap-2 mb-4 pb-3 border-b" style={{ borderColor: `${meta.accent}20` }}>
              <span className="text-lg">📄</span>
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: `${meta.accent}aa` }}>Read the passage</span>
            </div>
            <p className="text-white/85 text-sm leading-7 whitespace-pre-wrap">{passageText}</p>
          </motion.div>

          {/* Begin Quiz button */}
          <motion.button
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }}
            onClick={() => { setShowPassageInQuiz(false); setScreen("quiz"); }}
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
            className="w-full py-4 rounded-2xl font-bold text-base text-white"
            style={{ background: `linear-gradient(135deg, ${meta.accent}, ${meta.accent}cc)`, boxShadow: `0 4px 24px ${meta.accent}40` }}
          >
            Begin Quiz → ({questions.length} Questions)
          </motion.button>
        </div>
      </div>
    );
  }

  if (screen === "result") {
    return (
      <>
        <ResultScreen
          questions={questions} answers={answers}
          accent={meta.accent} label={meta.label} icon={meta.icon}
          isDemo={isDemo} isOfflineCached={isOfflineCached} mode={mode} chapter={selectedChapter}
          onHome={() => { refreshHistory(); setScreen("mode-select"); }} onRetry={retryTest} subject={subject}
          isPremium={isPremium} onUpgrade={() => setUpgradeOpen(true)} classId={classId}
        />
        <UpgradeModal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} />
      </>
    );
  }

  // ── Quiz screen ───────────────────────────────────────────────────────────────
  // Safety guard — should never happen, but prevents crash if state is stale
  if (questions.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: "var(--app-bg)" }}>
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
  // ── Timer display helpers ─────────────────────────────────────────────────────
  const timerMM  = String(Math.floor(Math.max(0, timerLeft) / 60)).padStart(2, "0");
  const timerSS  = String(Math.max(0, timerLeft) % 60).padStart(2, "0");
  const timerDanger  = timerLeft >= 0 && timerLeft <= 60;
  const timerWarning = timerLeft >= 0 && timerLeft <= 300 && !timerDanger;
  const timerColor   = timerDanger ? "#dc2626" : timerWarning ? "#b45309" : "#1d4ed8";
  const timerBg      = timerDanger ? "#fee2e2" : timerWarning ? "#fef3c7" : "#dbeafe";
  const timerBorder  = timerDanger ? "#fca5a5" : timerWarning ? "#fcd34d" : "#93c5fd";
  const timerGlow    = timerDanger ? "0 0 22px rgba(220,38,38,0.22)" : timerWarning ? "0 0 18px rgba(180,83,9,0.18)" : "0 0 18px rgba(37,99,235,0.15)";

  return (
    <div className="subject-quiz-shell min-h-screen w-full overflow-x-clip relative" style={{ background: "#eef2f7" }}>
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-32 -left-32 w-80 h-80 rounded-full blur-3xl opacity-15"
          style={{ background: `radial-gradient(circle, ${meta.accent}, transparent)` }} />
        <div className="absolute -bottom-20 -right-20 w-64 h-64 rounded-full blur-3xl opacity-10"
          style={{ background: `radial-gradient(circle, ${meta.accent}, transparent)` }} />
      </div>

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
                background: "var(--app-bg)",
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
                  style={{ background: "rgba(0,0,0,0.08)", color: "var(--app-text-faint)" }}
                >
                  ✕
                </motion.button>
              </div>

              {/* Legend */}
              <div className="flex items-center gap-4 px-5 pb-3">
                {[
                  { label: "Current",    bg: meta.accent,           border: meta.accent },
                  { label: "Answered",   bg: `${meta.accent}40`,    border: `${meta.accent}60` },
                  { label: "Unanswered", bg: "var(--app-surface)", border: "var(--app-border)" },
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
                                 : "var(--app-surface)";
                    const border = isCurrent  ? meta.accent
                                 : isAnswered ? `${meta.accent}55`
                                 : "var(--app-border)";
                    const color  = isCurrent  ? "#000"
                                 : isAnswered ? meta.accent
                                 : "var(--app-text-ghost)";
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

      <div className="relative z-10 max-w-lg mx-auto px-4 pt-0 pb-8 flex flex-col min-h-screen">
        <header className="sticky top-0 z-30 -mx-4 mb-4 border-b border-slate-300 bg-[#f8fafc]/95 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+10px)] shadow-sm backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-[11px] font-bold uppercase tracking-wide text-slate-600">
                {meta.label} · {mode === "full" ? "Full Test" : selectedChapter}
              </p>
              <h1 className="text-base font-black leading-tight text-slate-900">
                Question {currentIndex + 1} of {questions.length}
              </h1>
            </div>
            {timerLeft >= 0 && (
              timerHidden ? (
                <button
                  type="button"
                  onClick={() => setTimerHidden(false)}
                  aria-label="Show remaining time"
                  data-testid="button-show-quiz-timer"
                  className="shrink-0 rounded-xl border px-3 py-2 text-xs font-bold"
                  style={{ background: timerBg, borderColor: timerBorder, color: timerColor }}
                >
                  ⏱ Show
                </button>
              ) : (
                <div
                  className="flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2"
                  style={{ background: timerBg, borderColor: timerBorder, boxShadow: timerGlow }}
                  aria-label={`Time remaining ${timerMM}:${timerSS}`}
                >
                  <span className="text-sm" aria-hidden="true">⏱</span>
                  <span className="min-w-[3.5rem] text-center font-mono text-sm font-black tracking-wide" style={{ color: timerColor }}>
                    {timerMM}:{timerSS}
                  </span>
                  <button
                    type="button"
                    onClick={() => setTimerHidden(true)}
                    aria-label="Hide timer"
                    data-testid="button-hide-quiz-timer"
                    className="text-xs font-bold text-slate-600 hover:text-slate-900"
                  >
                    ✕
                  </button>
                </div>
              )
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              data-testid="button-open-question-palette"
              aria-label={`Open question palette, question ${currentIndex + 1} of ${questions.length}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-violet-300 bg-violet-100 px-3 py-2 text-xs font-bold text-violet-900"
            >
              <span aria-hidden="true">▦</span> Questions
            </button>
            <button
              type="button"
              onClick={() => setBookmarks(toggleBookmark(subject, bookmarks, q))}
              data-testid="button-save-current-question"
              aria-label={isBookmarked(bookmarks, q) ? "Remove saved question" : "Save current question"}
              aria-pressed={isBookmarked(bookmarks, q)}
              className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold"
              style={isBookmarked(bookmarks, q)
                ? { background: "#fef3c7", borderColor: "#fbbf24", color: "#92400e" }
                : { background: "#f1f5f9", borderColor: "#cbd5e1", color: "#334155" }}
            >
              <span aria-hidden="true">{isBookmarked(bookmarks, q) ? "★" : "☆"}</span>
              {isBookmarked(bookmarks, q) ? "Saved" : "Save question"}
            </button>
            <button
              type="button"
              onClick={cycleLang}
              data-testid="button-toggle-quiz-language"
              aria-label={`Switch question language from ${langLabel}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-300 bg-cyan-100 px-3 py-2 text-xs font-bold text-cyan-900"
            >
              <span aria-hidden="true">🌐</span> {langLabel}
            </button>
          </div>

          <div className="mt-3 flex items-center justify-between gap-2 text-[11px] font-semibold text-slate-600">
            <span>{Object.keys(answers).length} answered</span>
            <span>{Math.round(progress)}% complete</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200">
            <motion.div
              className="h-full rounded-full"
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              style={{ background: `linear-gradient(90deg, ${meta.accent}, ${meta.accent}bb)` }}
            />
          </div>
        </header>

        {/* Passage toggle — shown when doing comprehension quiz */}
        {selectedChapter === "Comprehension" && passageText && (
          <div className="mb-3">
            <motion.button
              onClick={() => setShowPassageInQuiz((v) => !v)}
              whileTap={{ scale: 0.97 }}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border w-full transition-all"
              style={{
                background:   showPassageInQuiz ? `${meta.accent}18` : "var(--app-surface)",
                borderColor:  showPassageInQuiz ? `${meta.accent}45` : "var(--app-border)",
                color:        showPassageInQuiz ? meta.accent : "rgba(255,255,255,0.32)",
              }}
            >
              <span>📖</span>
              <span className="flex-1 text-left truncate">{passageTitle || "View Passage"}</span>
              <span className="shrink-0">{showPassageInQuiz ? "▲ Hide" : "▼ Show"}</span>
            </motion.button>
            <AnimatePresence>
              {showPassageInQuiz && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                  className="overflow-hidden"
                >
                  <div className="mt-2 rounded-xl border p-4 max-h-52 overflow-y-auto"
                    style={{ background: `${meta.accent}08`, borderColor: `${meta.accent}22` }}>
                    <p className="text-white/75 text-xs leading-6 whitespace-pre-wrap">{passageText}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

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
               style={{ background: "linear-gradient(135deg, #f1f5f9, #e5ebf2)", borderColor: "#cbd5e1", boxShadow: "0 8px 26px rgba(51,65,85,0.10)" }}>
                  {(() => {
                    const content = getQuestionContent(q, lang);
                    return (
                      <div className="mb-1">
                        <p className="text-slate-900 font-semibold text-base leading-relaxed">
                          <MathText text={content.question} />
                        </p>
                      </div>
                    );
                  })()}
                </div>

                {/* Options */}
                <div className="flex flex-col gap-3">
                  {getQuestionContent(q, lang).options.map((opt, oi) => {
                    const isSelected = selectedOption === oi;
                    return (
                      <motion.button
                        key={oi}
                        onClick={() => handleSelect(oi)}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: oi * 0.07, duration: 0.35 }}
                        className={`quiz-option relative w-full text-left rounded-xl border px-4 py-3.5 flex items-center gap-3 overflow-hidden transition-colors duration-150 ${isSelected ? "quiz-option-selected" : ""}`}
                        style={{
                          cursor:       selectedOption !== null ? "default" : "pointer",
                        }}
                      >
                        <span className="quiz-option-label w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0">
                          {String.fromCharCode(65 + oi)}
                        </span>
                        <span className="flex flex-col gap-0.5 min-w-0">
                          <span className={`text-sm font-medium leading-snug ${isSelected ? "quiz-option-answer-selected" : ""}`}>
                            <MathText text={opt} />
                          </span>
                        </span>
                      </motion.button>
                    );
                  })}
                </div>

              </motion.div>
            </AnimatePresence>
          </div>

          {/* Nav buttons */}
          <div className="flex gap-2 mt-5 pb-2">
            <motion.button
              onClick={handlePrev} disabled={currentIndex === 0}
              className="w-12 h-12 rounded-xl flex items-center justify-center border shrink-0 text-base"
              style={{
                 background: "#e2e8f0",
                 borderColor: "#cbd5e1",
                 color: currentIndex === 0 ? "#cbd5e1" : "#475569",
                cursor: currentIndex === 0 ? "not-allowed" : "pointer",
              }}>
              ←
            </motion.button>

            {selectedOption === null && currentIndex < questions.length - 1 && (
              <motion.button
                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                onClick={handleNext}
                className="flex-1 py-3 rounded-xl text-sm font-semibold border"
                 style={{ background: "#fff7ed", borderColor: "#fdba74", color: "#c2410c" }}>
                Skip ↷
              </motion.button>
            )}

            <motion.button
              onClick={selectedOption !== null || currentIndex === questions.length - 1 ? handleNext : undefined}
              disabled={selectedOption === null && currentIndex < questions.length - 1}
              className="flex-[2] py-3 rounded-xl text-sm font-bold transition-all duration-300"
              style={{
                background: (selectedOption !== null || currentIndex === questions.length - 1)
                  ? `linear-gradient(135deg, ${meta.accent}, ${meta.accent}80)`
                   : "#e2e8f0",
                color: (selectedOption !== null || currentIndex === questions.length - 1)
                   ? "#ffffff"
                   : "#94a3b8",
                cursor: (selectedOption === null && currentIndex < questions.length - 1)
                  ? "not-allowed"
                  : "pointer",
              }}>
              {currentIndex < questions.length - 1 ? "Next →" : "See Results ✦"}
            </motion.button>
          </div>
        </div>
      </div>

      {/* Floating Progress Navigation Bar — rendered via portal so it escapes
          overflow:hidden / transform parents and stays fixed on the viewport */}
      {createPortal(
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 9999,
            display: "flex",
            justifyContent: "center",
            padding: "0 16px 16px",
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 512,
              borderRadius: 18,
              padding: "12px 16px",
              pointerEvents: "auto",
              background: "#e7edf3",
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
              border: "1px solid #cbd5e1",
              boxShadow: "0 8px 32px rgba(51,65,85,0.16)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button
                onClick={() => setScreen("mode-select")}
                style={{ color: "var(--app-text-ghost)", fontSize: 18, padding: 4, lineHeight: 1, flexShrink: 0, background: "none", border: "none", cursor: "pointer" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--app-text-muted)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--app-text-ghost)")}
              >
                ←
              </button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <SubjectIcon id={subject} color={meta.accent} size="sm" />
                  <span style={{ color: "var(--app-text)", fontWeight: 700, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{meta.label}</span>
                  <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, background: `${meta.accent}20`, color: meta.accent, flexShrink: 0 }}>
                    {mode === "full" ? "Full Test" : selectedChapter}
                  </span>
                  <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                    <motion.button
                      onClick={cycleLang}
                      whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.93 }}
                      style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 8, border: "1px solid #67e8f9", background: lang === "hi" ? "#cffafe" : "#dbeafe", color: "#0e7490", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                      title="Toggle language"
                    >
                      🌐 {langLabel}
                    </motion.button>
                    <motion.button
                      onClick={() => setPaletteOpen(true)}
                      whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.93 }}
                      style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 8, border: "1px solid #c4b5fd", background: "#ede9fe", color: "#6d28d9", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                    >
                      <svg width="11" height="11" viewBox="0 0 12 12" fill="currentColor">
                        <rect x="0" y="0" width="5" height="5" rx="1"/><rect x="7" y="0" width="5" height="5" rx="1"/>
                        <rect x="0" y="7" width="5" height="5" rx="1"/><rect x="7" y="7" width="5" height="5" rx="1"/>
                      </svg>
                      {currentIndex + 1}/{questions.length}
                    </motion.button>
                  </div>
                </div>
                <div style={{ height: 6, borderRadius: 999, background: "#cbd5e1", overflow: "hidden" }}>
                  <motion.div
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                    style={{ height: "100%", borderRadius: 999, background: `linear-gradient(90deg, ${meta.accent}, ${meta.accent}80)` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </motion.div>,
        document.body
      )}
    </div>
  );
}
