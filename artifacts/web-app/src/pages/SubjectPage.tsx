import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { db, auth } from "../firebase";
import { ref, push, get, set } from "firebase/database";
import { explainWithShikenEngine, generateQuestions, generateComprehension, type FullTranslation } from "@/lib/gemini";
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

interface Question {
  english: string;
  hindi: string;
  options: string[];
  optionsHindi?: string[];
  answerIndex: number;
  chapter: string;
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

function inferSubjectCategory(subject: string): "c10" | "c12" | "entrance" {
  if (subject.startsWith("entrance_exams/")) return "entrance";
  if (subject.startsWith("class12/")) return "c12";
  return "c10";
}

function addRecord(subject: string, rec: TestRecord): TestRecord[] {
  const prev = loadHistory(subject);
  const next = [...prev, rec].slice(-50);
  try { localStorage.setItem(historyKey(subject), JSON.stringify(next)); } catch { /* quota */ }

  // ── Push to Firebase for admin analytics ──────────────────────────────────
  try {
    const uid = auth.currentUser?.uid;
    const deviceId = uid ?? getDeviceId();
    const safeId = deviceId.replace(/[.#$/[\]]/g, "_");
    push(ref(db, `userActivity/${safeId}/sessions`), {
      subject,
      category: inferSubjectCategory(subject),
      score: rec.score,
      total: rec.total,
      pct: rec.pct,
      mode: rec.mode,
      chapter: rec.chapter,
      timestamp: rec.date,
    }).catch(() => { /* offline — ignore */ });
    const username = localStorage.getItem("shiken_username") || "";
    set(ref(db, `userActivity/${safeId}/meta`), {
      lastActive: rec.date,
      deviceId,
      ...(username ? { username } : {}),
    }).catch(() => { /* offline — ignore */ });
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
  const raw = q.correct_answer ?? q.correctAnswer ?? q.answer;

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

function parseQuestions(data: unknown, subject = "", classId = "10"): Question[] {
  if (typeof data !== "object" || data === null || Array.isArray(data)) return [];

  const dataObj = data as Record<string, unknown>;

  const isQuestionLike = (v: unknown): boolean => {
    if (typeof v !== "object" || v === null) return false;
    const q = v as Record<string, unknown>;
    return !!(q.english || q.question || q.question_english || q.hindi);
  };

  const pairs: Array<[Record<string, unknown>, string | undefined]> = [];

  const firstVal = Object.values(dataObj)[0];
  if (isQuestionLike(firstVal)) {
    for (const v of Object.values(dataObj)) {
      if (typeof v === "object" && v !== null) {
        pairs.push([v as Record<string, unknown>, undefined]);
      }
    }
  } else {
    for (const [chapterSlug, chapterNode] of Object.entries(dataObj)) {
      if (typeof chapterNode === "object" && chapterNode !== null) {
        for (const v of Object.values(chapterNode as Record<string, unknown>)) {
          if (isQuestionLike(v)) {
            pairs.push([v as Record<string, unknown>, chapterSlug.replace(/_/g, " ")]);
          }
        }
      }
    }
  }

  return pairs.map(([q, chapterHint]) => {
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
    // New format: q.question is bilingual "Hindi / English" split by " / "
    let english = String(q.question_english ?? q.english ?? "");
    let hindi   = String(q.question_hindi   ?? q.question_hi ?? q.hindi ?? "");
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
              style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${plan.accent}25` }}>
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
              <motion.button whileTap={{ scale: 0.97 }}
                onClick={() => { onClose(); navigate(`/pricing?plan=${plan.id}`); }}
                className="w-full py-2.5 rounded-xl font-bold text-xs text-black"
                style={{ background: `linear-gradient(135deg, ${plan.accent}, ${plan.accent}cc)`, boxShadow: `0 4px 16px ${plan.accent}40` }}>
                Get {plan.name} →
              </motion.button>
            </motion.div>
          ))}
        </div>
        <motion.button whileTap={{ scale: 0.97 }} onClick={onClose}
          className="w-full py-3 rounded-xl font-bold text-xs text-white/50"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}>
          ← Back to Free Mode
        </motion.button>
      </div>
    </motion.div>
  );
}

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
            stroke="rgba(255,255,255,0.06)" strokeWidth="1" strokeDasharray="3 3" />
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
        ? `25 DB + 25 Shiken Engine questions (50 total)`
        : !hasUsedFreeFull
          ? "1 Free Test Available! · 50 questions"
          : "Upgrade for unlimited tests",
      icon: "🎯",
      desc: isPremium
        ? "Covers entire syllabus with Shiken Engine questions. ⏱ 60 min"
        : !hasUsedFreeFull
          ? "Try your first Full Length Test free! Includes Shiken Engine questions. ⏱ 60 min"
          : "You've used your 1 free test. Upgrade to Premium for unlimited Shiken Engine tests.",
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
  const avgPct = hasHistory ? Math.round(safeHistory.reduce((a, r) => a + r.pct, 0) / safeHistory.length) : 0;
  const bestPct = hasHistory ? Math.max(...safeHistory.map((r) => r.pct)) : 0;

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
        <div className="mb-3 flex justify-center"><SubjectIcon id={subject} color={meta.accent} size="lg" /></div>
        <h2 className="text-3xl font-black text-white mb-0.5 leading-tight">{meta.label}</h2>
        <p className="text-base font-bold mb-2" style={{ color: meta.accent }}>{meta.labelHindi}</p>
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

        {/* History stats card */}
        {hasHistory && (
          <motion.div
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}
            className="rounded-2xl border p-4"
            style={{ background: `linear-gradient(135deg, ${meta.accent}10, rgba(255,255,255,0.03))`, borderColor: `${meta.accent}25` }}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-white/70 text-xs font-semibold">📈 Your Progress</p>
              <div className="flex gap-3">
                <div className="text-right">
                  <p className="text-white text-xs font-bold">{bestPct}%</p>
                  <p className="text-white/30 text-[10px]">Best</p>
                </div>
                <div className="text-right">
                  <p className="text-white text-xs font-bold">{avgPct}%</p>
                  <p className="text-white/30 text-[10px]">Avg</p>
                </div>
                <div className="text-right">
                  <p className="text-white text-xs font-bold">{safeHistory.length}</p>
                  <p className="text-white/30 text-[10px]">Tests</p>
                </div>
              </div>
            </div>
            <ProgressChart records={safeHistory} accent={meta.accent} />
            <div className="flex justify-between mt-1 px-1">
              <span className="text-white/20 text-[10px]">Oldest</span>
              <span className="text-white/20 text-[10px]">Latest →</span>
            </div>
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
              background: `linear-gradient(135deg, ${m.glowColor}18, rgba(255,255,255,0.05))`,
              borderColor: `${m.glowColor}30`,
              boxShadow: `0 4px 32px ${m.glowColor}12`,
            }}
          >
            {m.id === "ai" && !m.locked && (
              <div className="absolute top-2 right-2 text-xs px-2 py-0.5 rounded-full font-bold"
                style={{ background: "#6366f130", color: "#a5b4fc" }}>
                NEW ✨
              </div>
            )}
            {m.locked && (
              <div className="absolute top-2 right-2 flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-bold"
                style={{ background: "rgba(251,191,36,0.15)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.3)" }}>
                👑 Premium
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

  return (
    <div className="min-h-screen px-4 py-6" style={{ background: "#07080f" }}>
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: `radial-gradient(ellipse at 50% 0%, ${meta.accent}15 0%, transparent 50%)` }}
      />
      <div className="max-w-sm mx-auto relative z-10">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={onBack} className="text-white/40 hover:text-white/70 transition-colors text-xl p-1">←</button>
          <div>
            <p className="text-white/40 text-xs">{displayTitle}</p>
            <h2 className="text-white font-bold text-lg">{meta.label} — Pick a Chapter</h2>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {showAll && (
            <motion.button
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
              whileHover={{ scale: 1.02, x: 4 }} whileTap={{ scale: 0.97 }}
              onClick={() => onSelect("All Chapters")}
              className="relative overflow-hidden text-left rounded-xl border px-4 py-3.5 flex items-center gap-3 group"
              style={{ background: `${meta.accent}12`, borderColor: `${meta.accent}40` }}
            >
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-xl"
                style={{ background: `linear-gradient(90deg, ${meta.accent}20, transparent)` }} />
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0"
                style={{ background: `${meta.accent}25` }}>
                🌟
              </div>
              <div className="flex-1 relative z-10">
                <p className="font-semibold text-sm" style={{ color: meta.accent }}>{allLabel ?? "All Chapters"}</p>
                <p className="text-white/40 text-xs">{allTotalCount} questions · Mix of everything</p>
              </div>
              <span className="text-white/30 group-hover:text-white/60 transition-colors relative z-10">→</span>
            </motion.button>
          )}

          {chapters.map((ch, i) => {
            const isTopper  = topperChapters?.includes(ch.name) ?? false;
            const isLocked  = isTopper || (lockedChapters?.includes(ch.name) ?? false);
            const badgeLabel = isTopper ? "🏆 Topper" : "👑 Premium";
            return (
              <motion.button
                key={ch.name}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: (showAll ? i + 1 : i) * 0.06, duration: 0.35 }}
                whileHover={{ scale: 1.02, x: 4 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => isLocked ? onUpgrade?.() : onSelect(ch.name)}
                className="relative overflow-hidden text-left rounded-xl border px-4 py-3.5 flex items-center gap-3 group"
                style={{
                  background: isTopper ? "rgba(245,158,11,0.06)" : isLocked ? "rgba(251,191,36,0.05)" : "rgba(255,255,255,0.05)",
                  borderColor: isTopper ? "rgba(245,158,11,0.25)" : isLocked ? "rgba(251,191,36,0.2)" : "rgba(0,0,0,0.08)",
                }}
              >
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-xl"
                  style={{ background: isLocked ? "linear-gradient(90deg, rgba(245,158,11,0.14), transparent)" : `linear-gradient(90deg, ${meta.accent}18, transparent)` }}
                />
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0"
                  style={{ background: isLocked ? "rgba(245,158,11,0.15)" : `${meta.accent}20` }}
                >
                  {getChapterIcon(ch.name)}
                </div>
                <div className="flex-1 relative z-10">
                  <p className={`font-semibold text-sm ${isLocked ? "text-white/60" : "text-white"}`}>{ch.name}</p>
                  <p className="text-white/40 text-xs">{ch.count} question{ch.count !== 1 ? "s" : ""}</p>
                </div>
                {isLocked ? (
                  <span className="relative z-10 text-xs font-bold px-2 py-0.5 rounded-full shrink-0"
                    style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.35)" }}>
                    {badgeLabel}
                  </span>
                ) : (
                  <span className="text-white/30 group-hover:text-white/60 transition-colors relative z-10">→</span>
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
  isPremium, onUpgrade,
}: {
  questions: Question[];
  answers: Record<number, number>;
  accent: string; label: string; icon: string; isDemo: boolean; isOfflineCached: boolean;
  mode: "full" | "chapter" | "ai" | "mini"; chapter: string; subject: string;
  onHome: () => void; onRetry: () => void;
  isPremium: boolean; onUpgrade: () => void;
}) {
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
    setHistory(addRecord(subject, rec));
  }, []);

  // Per-question explanation state
  const [explainTexts,   setExplainTexts]   = useState<Record<number, string>>({});
  const [explainLoading, setExplainLoading] = useState<Record<number, boolean>>({});
  const [explainOpen,    setExplainOpen]    = useState<Record<number, boolean>>({});

  // Explanation language toggle
  const [explainLang, setExplainLang] = useState<"en" | "hi">("hi");
  function cycleExplainLang() { setExplainLang((l) => l === "hi" ? "en" : "hi"); }
  const explainLangLabel = explainLang === "hi" ? "हिंदी" : "English";

  // Per-question translation state (for questions stored only in Hindi)
  const [translateTexts,   setTranslateTexts]   = useState<Record<number, string>>({});
  const [translateLoading, setTranslateLoading] = useState<Record<number, boolean>>({});
  const [fullTranslations,   setFullTranslations]   = useState<Record<number, FullTranslation>>({});
  const [fullTranslating,    setFullTranslating]    = useState<Record<number, boolean>>({});
  const fullTranslationCache = useRef<Record<string, FullTranslation>>({});

  function translateCacheKey(hindiText: string): string {
    return btoa(unescape(encodeURIComponent(hindiText.slice(0, 80)))).replace(/[/+=]/g, "_") + "_en";
  }

  async function fetchTranslation(i: number, hindiText: string) {
    if (translateLoading[i] || translateTexts[i]) return;
    setTranslateLoading((l) => ({ ...l, [i]: true }));
    try {
      const cacheKey = translateCacheKey(hindiText);
      const cached = await get(ref(db, `translations/${subject}/${cacheKey}`));
      if (cached.exists()) {
        setTranslateTexts((t) => ({ ...t, [i]: cached.val() as string }));
      } else {
        const resp = await fetch("/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "toEnglish", hindi: hindiText, subject }),
        });
        const json = await resp.json() as { result?: string };
        const text = json.result ?? hindiText;
        setTranslateTexts((t) => ({ ...t, [i]: text }));
        set(ref(db, `translations/${subject}/${cacheKey}`), text).catch(() => {});
      }
    } catch {
      setTranslateTexts((t) => ({ ...t, [i]: "Translation failed. Try again." }));
    } finally {
      setTranslateLoading((l) => { const n = { ...l }; delete n[i]; return n; });
    }
  }

  // Stable Firebase key from question text + lang (safe for Firebase paths)
  function explainCacheKey(questionEnglish: string, lang: string): string {
    return btoa(unescape(encodeURIComponent(questionEnglish.slice(0, 60)))).replace(/[/+=]/g, "_") + "_" + lang;
  }

  async function fetchExplain(i: number, q: Question, lang: "both" | "en" | "hi" = "both") {
    if (!isPremium) { onUpgrade(); return; }
    if (explainLoading[i]) return;
    setExplainOpen((o) => ({ ...o, [i]: true }));
    if (explainTexts[i]) return; // already fetched in session
    setExplainLoading((l) => ({ ...l, [i]: true }));
    setExplainTexts((t) => ({ ...t, [i]: "" }));

    const effectiveLang: "en" | "hi" = lang === "en" ? "en" : "hi";

    try {
      // ── Check Firebase cache first ────────────────────────────────────────
      const cacheKey = explainCacheKey(q.english, effectiveLang);
      const cached = await get(ref(db, `explanations/${subject}/${cacheKey}`));
      if (cached.exists()) {
        const text = cached.val() as string;
        setExplainTexts((t) => ({ ...t, [i]: text }));
        setExplainLoading((l) => { const n = { ...l }; delete n[i]; return n; });
        return;
      }

      // ── Not cached — call Shiken Engine directly from browser ─────────
      let fullText = "";
      const tryDirect = async () => {
        fullText = await explainWithShikenEngine(
          {
            questionEnglish: q.english,
            questionHindi:   q.hindi || "",
            options:         q.options,
            optionsHindi:    q.optionsHindi,
            correctAnswer:   q.options[q.answerIndex] ?? "",
            subject:         label,
            lang:            effectiveLang,
          },
          (chunk) => setExplainTexts((t) => ({ ...t, [i]: (t[i] ?? "") + chunk })),
        );
      };

      // ── Fallback to API server if direct call fails ─────────────────────────
      try {
        await tryDirect();
      } catch {
        setExplainTexts((t) => ({ ...t, [i]: "" }));
        fullText = "";
        const resp = await fetch("/api/explain", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            questionEnglish: q.english,
            questionHindi:   q.hindi || "",
            options:         q.options,
            optionsHindi:    q.optionsHindi,
            correctAnswer:   q.options[q.answerIndex] ?? "",
            subject:         label,
            lang:            effectiveLang,
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
              if (payload.content) {
                fullText += payload.content;
                setExplainTexts((t) => ({ ...t, [i]: (t[i] ?? "") + payload.content }));
              }
            } catch { /* skip */ }
          }
        }
      }

      if (fullText.length > 10) {
        const cacheKey = explainCacheKey(q.english, effectiveLang);
        set(ref(db, `explanations/${subject}/${cacheKey}`), fullText).catch(() => {});
      }
    } catch {
      setExplainTexts((t) => ({ ...t, [i]: "Explanation नहीं मिली 🙏" }));
    } finally {
      setExplainLoading((l) => { const n = { ...l }; delete n[i]; return n; });
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
      className="min-h-screen w-full px-4 py-8" style={{ background: "#07080f" }}
    >
      <div className="max-w-lg mx-auto">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="text-center mb-6">
          <div className="mb-2 flex justify-center"><SubjectIcon id={subject} color={accent} size="lg" /></div>
          <h2 className="text-2xl font-bold text-white mb-0 leading-tight">{label} — Results</h2>
          {subjectMeta[subject]?.labelHindi && (
            <p className="text-sm font-semibold mb-0.5" style={{ color: accent }}>{subjectMeta[subject].labelHindi}</p>
          )}
          <p className="text-white/40 text-xs mb-1">
            {mode === "full" ? "Full Length Test" : `Chapter: ${chapter}`}
          </p>
          <p className="text-white/40 text-sm">{msg}</p>
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
              <span className="text-white/25 text-xs">Explanation language:</span>
              <motion.button onClick={cycleExplainLang} whileTap={{ scale: 0.93 }}
                className="px-3 py-1 rounded-full text-xs font-semibold border transition-all"
                style={{ background: `${accent}12`, borderColor: `${accent}35`, color: `${accent}cc` }}>
                {explainLangLabel}
              </motion.button>
            </div>
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

        {/* ── Progress Snapshot ────────────────────────────────────────────── */}
        {history.length >= 1 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
            className="rounded-2xl border p-4 mb-4"
            style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.06)" }}
          >
            <p className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-3">📊 Progress Snapshot</p>
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
                <div key={s.label} className="text-center rounded-xl p-2.5" style={{ background: "rgba(255,255,255,0.05)" }}>
                  <p className="font-black text-base" style={{ color: s.color }}>{s.value}</p>
                  <p className="text-white/25 text-xs mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
            {history.length >= 2 && (() => {
              const trend = history[history.length - 1].pct - history[history.length - 2].pct;
              return (
                <div className="flex items-center justify-center gap-1.5 pt-3"
                  style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                  <span className="text-sm">{trend > 0 ? "📈" : trend < 0 ? "📉" : "➡️"}</span>
                  <span className="text-xs font-bold" style={{ color: trend > 0 ? "#10b981" : trend < 0 ? "#ef4444" : "rgba(255,255,255,0.28)" }}>
                    {trend > 0 ? `+${trend}%` : trend === 0 ? "Same as last test" : `${trend}%`}
                    <span className="font-normal text-white/30"> vs last test</span>
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
              background: "linear-gradient(135deg, rgba(251,191,36,0.12), rgba(245,158,11,0.06))",
              border: "1px solid rgba(251,191,36,0.3)",
              boxShadow: "0 0 28px rgba(251,191,36,0.08)",
            }}
          >
            <div className="flex items-start gap-3">
              <motion.span
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 2 }}
                className="text-2xl shrink-0"
              >💡</motion.span>
              <div className="flex-1 min-w-0">
                <p className="text-amber-300 font-black text-xs uppercase tracking-widest mb-1">Kya aap jante hain?</p>
                <p className="text-white text-sm font-semibold leading-relaxed mb-3">
                  ₹199/- mein aap board exams tak{" "}
                  <span style={{ color: "#fbbf24" }}>unlimited Shiken Engine tests</span> aur{" "}
                  <span style={{ color: "#fbbf24" }}>direct mentorship</span> pa sakte hain!
                  <span className="text-white/50 font-normal"> (Sirf ₹33 mahina)</span>
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
            style={{ background: `linear-gradient(135deg, ${accent}10, rgba(255,255,255,0.03))`, borderColor: `${accent}25` }}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-white/70 text-xs font-semibold">📈 Your Progress ({history.length} tests)</p>
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
                        <p className="text-white text-xs font-bold">{best}%</p>
                        <p className="text-white/30 text-[10px]">Best</p>
                      </div>
                      <div className="text-right">
                        <p className="text-white text-xs font-bold">{avg}%</p>
                        <p className="text-white/30 text-[10px]">Avg</p>
                      </div>
                      <div className="text-right">
                        <p className={`text-xs font-bold ${trend > 0 ? "text-emerald-400" : trend < 0 ? "text-red-400" : "text-white/40"}`}>
                          {trend > 0 ? `+${trend}` : trend === 0 ? "–" : trend}%
                        </p>
                        <p className="text-white/30 text-[10px]">vs prev</p>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
            <ProgressChart records={history} accent={accent} />
            <div className="flex justify-between mt-1 px-1">
              <span className="text-white/20 text-[10px]">Older tests</span>
              <span className="text-white/20 text-[10px]">This test →</span>
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
            style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.58)" }}
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
              background: analysisOpen ? "linear-gradient(135deg,#6366f128,#8b5cf628)" : "rgba(99,102,241,0.12)",
              borderColor: analysisOpen ? "#6366f155" : "rgba(99,102,241,0.3)",
              color: "#a5b4fc",
              boxShadow: analysisOpen ? "0 0 30px rgba(99,102,241,0.2)" : "none",
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
                  style={{ background: "linear-gradient(135deg,rgba(99,102,241,0.1),rgba(139,92,246,0.06))", borderColor: "rgba(99,102,241,0.22)", boxShadow: "0 4px 40px rgba(99,102,241,0.12)" }}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-sm font-bold text-indigo-300">Performance Analysis</span>
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
            const isExLoading = explainLoading[i] === true;
            const exText      = explainTexts[i] ?? "";
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.04 }}
                className="rounded-xl border p-4"
                style={{
                  background: isRight ? `${accent}12` : isSkipped ? "rgba(255,255,255,0.05)" : "rgba(255,80,80,0.06)",
                  borderColor: isRight ? `${accent}40` : isSkipped ? "rgba(255,255,255,0.06)" : "rgba(255,80,80,0.18)",
                }}
              >
                <div className="flex items-start gap-2 mb-2">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full mt-0.5 shrink-0"
                    style={{
                      background: isRight ? `${accent}30` : isSkipped ? "rgba(255,255,255,0.10)" : "rgba(255,80,80,0.2)",
                      color: isRight ? accent : isSkipped ? "rgba(255,255,255,0.32)" : "#f87171",
                    }}>
                    {isRight ? "✓" : isSkipped ? "–" : "✗"}
                  </span>
                  <div className="flex-1 min-w-0">
                    {!q.english && q.hindi ? (
                      <>
                        {translateTexts[i] && (
                          <p className="text-white/85 text-sm font-semibold leading-snug mb-0.5">
                            {i + 1}. <MathText text={translateTexts[i]} />
                          </p>
                        )}
                        <p className={`leading-snug font-medium ${translateTexts[i] ? "text-white/35 text-xs" : "text-white/80 text-sm"}`}>
                          {!translateTexts[i] && <>{i + 1}. </>}<MathText text={q.hindi} />
                        </p>
                        {!translateTexts[i] && (
                          <button
                            onClick={() => { void fetchTranslation(i, q.hindi); }}
                            disabled={!!translateLoading[i]}
                            className="mt-1.5 text-xs flex items-center gap-1 px-2.5 py-0.5 rounded-full border transition-all"
                            style={{ background: `${accent}0f`, borderColor: `${accent}35`, color: `${accent}bb` }}>
                            {translateLoading[i] ? "🔄 Translating..." : "🔤 Translate to English"}
                          </button>
                        )}
                      </>
                    ) : (
                      <p className="text-white/80 text-sm font-medium leading-snug">
                        {i + 1}. <MathText text={q.english || q.hindi} />
                      </p>
                    )}
                  </div>
                  <motion.button
                    onClick={() => bmkToggle(q)}
                    whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.85 }}
                    className="w-7 h-7 flex items-center justify-center rounded-lg shrink-0 ml-1"
                    style={{
                      background: isBookmarked(bmks, q) ? "rgba(251,191,36,0.18)" : "rgba(255,255,255,0.06)",
                      border: isBookmarked(bmks, q) ? "1px solid rgba(251,191,36,0.4)" : "1px solid rgba(255,255,255,0.10)",
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
                        : <path d="M5 3h14a1 1 0 0 1 1 1v18l-8-4-8 4V4a1 1 0 0 1 1-1z" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      }
                    </motion.svg>
                  </motion.button>
                </div>
                {q.english && (q.hindi || fullTranslations[i]?.hindi) && (
                  <p className="text-white/35 text-xs mb-2 pl-1">
                    <MathText text={q.hindi || fullTranslations[i].hindi} />
                  </p>
                )}
                <div className="flex flex-col gap-1 pl-1 mb-3">
                  {q.options.map((opt, oi) => {
                    const isCorrect  = oi === q.answerIndex;
                    const isUser     = oi === userAnswer;
                    const optHindi   = q.optionsHindi?.[oi] ?? fullTranslations[i]?.optionsHindi?.[oi];
                    const showHindiFirst = Boolean(optHindi);
                    return (
                      <div key={oi} className="flex items-start gap-2 text-xs px-3 py-1.5 rounded-lg"
                        style={{
                          background: isCorrect ? `${accent}25` : isUser && !isRight ? "rgba(255,80,80,0.12)" : "transparent",
                          color:      isCorrect ? accent : isUser && !isRight ? "#f87171" : "rgba(255,255,255,0.22)",
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
                    style={{ background: "rgba(99,102,241,0.05)", borderColor: "rgba(99,102,241,0.16)" }}>
                    <button
                      onClick={() => {
                        if (!isExOpen && !exText) { void fetchExplain(i, q, explainLang); }
                        else { setExplainOpen((o) => ({ ...o, [i]: !isExOpen })); }
                      }}
                      className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-semibold"
                      style={{ color: isExLoading ? "#a5b4fc" : "#818cf8" }}
                    >
                      <span>{isExLoading ? "समझाया जा रहा है…" : isExOpen ? "Explanation छुपाएं ↑" : "🤖 Explain करें ↓"}</span>
                      {q.chapter && q.chapter !== "General" && q.chapter !== "AI Generated" && q.chapter !== "Shiken Generated" && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium ml-2 shrink-0"
                          style={{ background: `${accent}18`, color: `${accent}cc`, border: `1px solid ${accent}30` }}>
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
                          <div className="px-3 pb-4 pt-0 border-t" style={{ borderColor: "rgba(99,102,241,0.13)" }}>
                            {isExLoading && !exText ? (
                              <div className="flex items-center gap-2 py-3">
                                {[0, 1, 2].map((j) => (
                                  <motion.div key={j} animate={{ y: [0, -4, 0] }}
                                    transition={{ repeat: Infinity, duration: 0.6, delay: j * 0.12 }}
                                    className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                                ))}
                                <span className="text-xs text-white/30 ml-1">समझाया जा रहा है...</span>
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
                    style={{ background: "rgba(99,102,241,0.04)", borderColor: "rgba(99,102,241,0.16)", color: "#818cf8" }}>
                    <span>🤖 Explain करें — Premium unlock करें</span>
                    {q.chapter && q.chapter !== "General" && q.chapter !== "AI Generated" && q.chapter !== "Shiken Generated" && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium ml-2 shrink-0"
                        style={{ background: `${accent}18`, color: `${accent}cc`, border: `1px solid ${accent}30` }}>
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

type Screen = "loading" | "mode-select" | "mini-chapter-select" | "chapter-select" | "ai-chapter-select" | "ai-generating" | "smart-generating" | "comprehension-generating" | "comprehension-passage" | "quiz" | "result" | "saved-questions";

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
  const fullTestKey = `shiken_free_full_used_${classId}_${subject}`;

  // All questions fetched from Firebase (or demo)
  const [allQuestions, setAllQuestions]     = useState<Question[]>([]);
  const [isDemo, setIsDemo]                 = useState(false);
  const [isOfflineCached, setIsOfflineCached] = useState(false);
  const [screen, setScreen]                 = useState<Screen>("loading");

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
  const [rippleKey, setRippleKey]       = useState(0);
  const [direction, setDirection]       = useState(1);

  // Timer state: -1 = not started, 0 = expired, >0 = seconds remaining
  const FULL_TIMER    = 60 * 60; // 60 min
  const CHAPTER_TIMER = 20 * 60; // 20 min
  const [timerLeft, setTimerLeft]   = useState(-1);
  const [timerHidden, setTimerHidden] = useState(false);

  // Question palette
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Language toggle: "both" | "en" | "hi"
  const [langMode, setLangMode] = useState<"both" | "en" | "hi">("both");
  function cycleLang() { setLangMode((m) => m === "both" ? "en" : m === "en" ? "hi" : "both"); }
  const langLabel = langMode === "both" ? "A / अ" : langMode === "en" ? "A" : "अ";

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

  // Comprehension passage state
  const [passageTitle,       setPassageTitle]       = useState("");
  const [passageText,        setPassageText]        = useState("");
  const [showPassageInQuiz,  setShowPassageInQuiz]  = useState(false);

  // Quiz per-question translation state (for questions stored only in Hindi)
  const [quizTranslateTexts,   setQuizTranslateTexts]   = useState<Record<number, string>>({});
  const [quizTranslateLoading, setQuizTranslateLoading] = useState<Record<number, boolean>>({});
  const [fullTranslations, setFullTranslations] = useState<Record<number, FullTranslation>>({});
  const [fullTranslating, setFullTranslating] = useState<Record<number, boolean>>({});
  const fullTranslationCache = useRef<Record<string, FullTranslation>>({});
  async function fetchQuizTranslation(i: number, hindiText: string) {
    if (quizTranslateLoading[i] || quizTranslateTexts[i]) return;
    setQuizTranslateLoading((l) => ({ ...l, [i]: true }));
    try {
      const cacheKey = btoa(unescape(encodeURIComponent(hindiText.slice(0, 80)))).replace(/[/+=]/g, "_") + "_en";
      const cached = await get(ref(db, `translations/${subject}/${cacheKey}`));
      if (cached.exists()) {
        setQuizTranslateTexts((t) => ({ ...t, [i]: cached.val() as string }));
      } else {
        const resp = await fetch("/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "toEnglish", hindi: hindiText, subject }),
        });
        const json = await resp.json() as { result?: string };
        const text = json.result ?? hindiText;
        setQuizTranslateTexts((t) => ({ ...t, [i]: text }));
        set(ref(db, `translations/${subject}/${cacheKey}`), text).catch(() => {});
      }
    } catch {
      setQuizTranslateTexts((t) => ({ ...t, [i]: "Translation failed." }));
    } finally {
      setQuizTranslateLoading((l) => { const n = { ...l }; delete n[i]; return n; });
    }
  }

  function fullTransCacheKey(englishQ: string): string {
    return btoa(unescape(encodeURIComponent(englishQ.slice(0, 80)))).replace(/[/+=]/g, "_") + "_full_hi";
  }

  async function fetchFullTranslation(i: number, q: { english: string; options: string[] }) {
    const cacheKey = fullTransCacheKey(q.english);
    const chapterKey = `${selectedChapter || ""}::${cacheKey}`;
    const cachedMemory = fullTranslationCache.current[chapterKey];
    if (fullTranslating[i] || fullTranslations[i]) return;
    if (cachedMemory) {
      setFullTranslations((t) => ({ ...t, [i]: cachedMemory }));
      return;
    }
    setFullTranslating((l) => ({ ...l, [i]: true }));
    try {
      const cached = await get(ref(db, `translations/${subject}/${cacheKey}`));
      if (cached.exists()) {
        const value = cached.val() as FullTranslation;
        fullTranslationCache.current[chapterKey] = value;
        setFullTranslations((t) => ({ ...t, [i]: value }));
      } else {
        const resp = await fetch("/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "fullTranslation", english: q.english, options: q.options, subject }),
        });
        const result = await resp.json() as FullTranslation;
        fullTranslationCache.current[chapterKey] = result;
        setFullTranslations((t) => ({ ...t, [i]: result }));
        set(ref(db, `translations/${subject}/${cacheKey}`), result).catch(() => {});
      }
    } catch {
      // silently fail — fallback to English
    } finally {
      setFullTranslating((l) => { const n = { ...l }; delete n[i]; return n; });
    }
  }


  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  // ── Auto-trigger full Hindi translation when in Hindi or Both mode ──────────
  useEffect(() => {
    if (screen !== "quiz" || langMode === "en") return;
    const q = questions[currentIndex];
    if (!q || !q.english) return;
    const needsTranslation = !q.hindi || !q.optionsHindi || q.optionsHindi.length === 0;
    if (needsTranslation && !fullTranslations[currentIndex] && !fullTranslating[currentIndex]) {
      void fetchFullTranslation(currentIndex, { english: q.english, options: q.options });
      // Prefetch next 2 questions silently
      for (let j = 1; j <= 2; j++) {
        const next = questions[currentIndex + j];
        if (next?.english && (!next.hindi || !next.optionsHindi?.length)) {
          void fetchFullTranslation(currentIndex + j, { english: next.english, options: next.options });
        }
      }
    }
  }, [langMode, currentIndex, screen]);

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
    const dbPath = meta.path.toLowerCase();

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
    const map = new Map<string, number>();
    allQuestions.forEach((q) => map.set(q.chapter, (map.get(q.chapter) ?? 0) + 1));

    // Sort chapters in NCERT textbook order; unknowns go alphabetically at the end
    const canonOrder = getCanonicalChapters(subject, classId);
    const canonIndex = (name: string) => {
      const i = canonOrder.indexOf(name);
      return i === -1 ? canonOrder.length : i;
    };

    const list = Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => {
        const ia = canonIndex(a.name);
        const ib = canonIndex(b.name);
        if (ia !== ib) return ia - ib;
        return a.name.localeCompare(b.name);
      });

    // Inject virtual Comprehension chapter for Hindi and Sanskrit (Shiken Engine passages)
    if ((subject === "hindi" || subject === "sanskrit") && !map.has("Comprehension")) {
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
    const dbPath = meta.path.toLowerCase();
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
        await push(ref(db, `${dbPath}/${chSlug}`), {
          english: q.english,
          hindi: q.hindi || "",
          options: q.options,
          correctAnswer: q.answerIndex,
          chapter: q.chapter || "Shiken Generated",
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

    // Pick 25 from existing DB questions
    const existing25 = pick(allQuestions, 25);

    // Pick representative chapters for Shiken Engine prompt
    // For Hindi/Sanskrit: filter out untagged "?" questions and prioritise grammar chapters
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
      const cached = await getCachedQuestions(subjectLabel, chapterKey, 25);
      if (cached && cached.length >= 25) {
        aiQuestions = cached.map((q) => ({ ...q, chapter: "Shiken Generated" }));
      } else {
        // ── 2. Generate via Shiken Engine (browser-direct, server fallback) ────────────
        const fetched = await (async () => {
          try {
            return await generateQuestions(subjectLabel, chapterKey, 25);
          } catch {
            const resp = await fetch("/api/generate-questions", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ subject: subjectLabel, chapter: chapterKey, count: 25 }),
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
    } catch { /* Shiken Engine generation failed — fall back to DB-only */ }

    // Fill up to 50 total (pad with more DB questions if Shiken Engine failed)
    const needed = Math.max(0, 50 - existing25.length - aiQuestions.length);
    const usedEnglish = new Set(existing25.map((q) => q.english));
    const extra = needed > 0 ? pick(allQuestions.filter((q) => !usedEnglish.has(q.english)), needed) : [];
    const combined = shuffle([...existing25, ...aiQuestions, ...extra]).slice(0, 50);

    setQuestions(combined);
    setCurrentIndex(0);
    setAnswers({});
    setSelectedOption(null);
    setRippleKey(0);
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
    setRippleKey(0);
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
      const data = snap.val() as Record<string, { title: string; passage: string; questions: Array<{ english?: string; hindi?: string; options: string[]; optionsHindi?: string[]; correctAnswer: number; chapter: string }> }> | null;

      if (data) {
        const passages = Object.values(data);
        const picked   = passages[Math.floor(Math.random() * passages.length)];
        setPassageTitle(picked.title);
        setPassageText(picked.passage);
        const qs = picked.questions
          .map((q) => ({
            english:      String(q.english ?? ""),
            hindi:        String(q.hindi   ?? ""),
            options:      (q.options       ?? []).slice(0, 4).map(String),
            optionsHindi: (q.optionsHindi  ?? q.options ?? []).slice(0, 4).map(String),
            answerIndex:  q.correctAnswer ?? 0,
            chapter:      "Comprehension",
          }))
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
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ count: 7, subject: subj }),
            });
            if (!resp.ok) throw new Error("Server comprehension failed");
            return await resp.json() as { title: string; passage: string; questions: Array<{ english: string; hindi: string; options: string[]; optionsHindi: string[]; answerIndex: number }> };
          }
        })();
        setPassageTitle(result.title);
        setPassageText(result.passage);
        setQuestions(result.questions.map((q) => ({ ...q, chapter: "Comprehension" })));
        // Cache to Firebase for future students
        push(ref(db, fbPath), {
          title:     result.title,
          passage:   result.passage,
          questions: result.questions.map((q) => ({ ...q, correctAnswer: q.answerIndex })),
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
    setRippleKey(0);
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
    try {
      const subjectLabel = meta?.label ?? subject;

      // ── 1. Check shared Firebase cache first (instant, no API call) ───────────
      const cached = await getCachedQuestions(subjectLabel, chapter, 5);
      let fetched = cached ?? [];

      if (fetched.length < 5) {
        // ── 2. Generate via Shiken Engine (browser-direct, server fallback) ────────────
        fetched = await (async () => {
          try {
            return await generateQuestions(subjectLabel, chapter, 5);
          } catch {
            const resp = await fetch("/api/generate-questions", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ subject: subjectLabel, chapter, count: 5 }),
            });
            const data = await resp.json() as { questions?: unknown[]; error?: string };
            if (!Array.isArray(data.questions) || data.questions.length === 0) throw new Error("No questions returned");
            return (data.questions as Record<string, unknown>[]).map((q) => ({
              english:      String(q.english      ?? ""),
              hindi:        String(q.hindi        ?? ""),
              options:      Array.isArray(q.options)      ? (q.options      as unknown[]).map(String) : [],
              optionsHindi: Array.isArray(q.optionsHindi) ? (q.optionsHindi as unknown[]).map(String) : [],
              answerIndex:  typeof q.answerIndex === "number" ? q.answerIndex : 0,
            }));
          }
        })();
        // ── 3. Merge into shared cache (non-blocking) ────────────────────────────
        mergeQuestionsToCache(subjectLabel, chapter, fetched).catch(() => {});
      }

      const generated: Question[] = fetched
        .filter((q) => q.english && q.options.length >= 2)
        .map((q) => ({ ...q, chapter }));
      if (generated.length === 0) throw new Error("No valid questions");
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
          onMiniTest={() => setScreen("mini-chapter-select")}
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
      <div className="min-h-screen px-4 py-6" style={{ background: "#07080f" }}>
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(251,191,36,0.12) 0%, transparent 55%)" }} />
        <div className="max-w-lg mx-auto relative z-10">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <motion.button whileHover={{ scale: 1.07 }} whileTap={{ scale: 0.93 }}
              onClick={() => setScreen("mode-select")}
              className="w-9 h-9 rounded-xl flex items-center justify-center border text-sm"
              style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.50)" }}>
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
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-6" style={{ background: "#07080f" }}>
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: `radial-gradient(ellipse at 50% 40%, ${meta.accent}22 0%, transparent 60%)` }} />
        <motion.div className="relative z-10 text-center px-4 w-full max-w-sm">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
            className="w-16 h-16 rounded-full border-2 border-transparent mx-auto mb-6"
            style={{ borderTopColor: meta.accent, borderRightColor: `${meta.accent}50` }}
          />
          <p className="text-white font-bold text-xl mb-2">Preparing your personalized test...</p>
          <p className="text-white/40 text-sm mb-5">शिकेन इंज़िन तुम्हारे लिए सवाल तैयार कर रहा है</p>
          <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden mb-5">
            <motion.div
              className="h-full rounded-full"
              style={{ background: `linear-gradient(90deg, ${meta.accent}, ${meta.accent}cc)` }}
              animate={{ width: ["0%", "40%", "70%", "100%"] }}
              transition={{ duration: 5, ease: "easeInOut", repeat: Infinity }}
            />
          </div>
          <div className="flex flex-col gap-2.5 text-left max-w-xs mx-auto">
            {[
              { emoji: "🗄️", text: "25 questions database से ले रहा हूँ" },
              { emoji: "🤖", text: "25 नए questions शिकेन इंज़िन से तैयार किए जा रहे हैं" },
              { emoji: "💾", text: "New questions database में save होंगे" },
            ].map(({ emoji, text }, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.4, duration: 0.5 }}
                className="flex items-center gap-3 px-4 py-2.5 rounded-xl"
                style={{ background: `${meta.accent}12`, border: `1px solid ${meta.accent}25` }}
              >
                <span className="text-lg">{emoji}</span>
                <span className="text-white/65 text-xs">{text}</span>
                <motion.div
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ repeat: Infinity, duration: 1.2, delay: idx * 0.4 }}
                  className="ml-auto w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: meta.accent }}
                />
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    );
  }

  if (screen === "comprehension-generating") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-6" style={{ background: "#07080f" }}>
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
      <div className="min-h-screen w-full overflow-auto relative" style={{ background: "#07080f" }}>
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
          isPremium={isPremium} onUpgrade={() => setUpgradeOpen(true)}
        />
        <UpgradeModal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} />
      </>
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
  const timerColor   = timerDanger ? "#ef4444" : timerWarning ? "#f59e0b" : "rgba(255,255,255,0.68)";
  const timerBg      = timerDanger ? "rgba(239,68,68,0.15)"  : timerWarning ? "rgba(245,158,11,0.14)" : "rgba(255,255,255,0.06)";
  const timerBorder  = timerDanger ? "#ef444445"             : timerWarning ? "#f59e0b45"             : "rgba(255,255,255,0.10)";
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
                  style={{ background: "rgba(0,0,0,0.08)", color: "rgba(255,255,255,0.40)" }}
                >
                  ✕
                </motion.button>
              </div>

              {/* Legend */}
              <div className="flex items-center gap-4 px-5 pb-3">
                {[
                  { label: "Current",    bg: meta.accent,           border: meta.accent },
                  { label: "Answered",   bg: `${meta.accent}40`,    border: `${meta.accent}60` },
                  { label: "Unanswered", bg: "rgba(255,255,255,0.06)", border: "rgba(255,255,255,0.10)" },
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
                                 : "rgba(255,255,255,0.10)";
                    const color  = isCurrent  ? "#000"
                                 : isAnswered ? meta.accent
                                 : "rgba(255,255,255,0.32)";
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

      <div className="relative z-10 max-w-lg mx-auto px-4 pt-6 pb-28 flex flex-col min-h-screen">

        {/* Passage toggle — shown when doing comprehension quiz */}
        {selectedChapter === "Comprehension" && passageText && (
          <div className="mb-3">
            <motion.button
              onClick={() => setShowPassageInQuiz((v) => !v)}
              whileTap={{ scale: 0.97 }}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border w-full transition-all"
              style={{
                background:   showPassageInQuiz ? `${meta.accent}18` : "rgba(255,255,255,0.05)",
                borderColor:  showPassageInQuiz ? `${meta.accent}45` : "rgba(255,255,255,0.10)",
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
                  style={{ background: `linear-gradient(135deg, ${meta.accent}18, rgba(255,255,255,0.05))`, borderColor: `${meta.accent}30`, boxShadow: `0 4px 32px ${meta.accent}15` }}>
                  {/* Bookmark button */}
                  <motion.button
                    onClick={() => setBookmarks(toggleBookmark(subject, bookmarks, q))}
                    whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.85 }}
                    className="absolute top-2.5 right-2.5 w-8 h-8 flex items-center justify-center rounded-xl"
                    style={{
                      background: isBookmarked(bookmarks, q) ? "rgba(251,191,36,0.18)" : "rgba(0,0,0,0.08)",
                      border: isBookmarked(bookmarks, q) ? "1px solid rgba(251,191,36,0.4)" : "1px solid rgba(255,255,255,0.10)",
                    }}
                    title={isBookmarked(bookmarks, q) ? "Remove bookmark" : "Bookmark this question"}
                  >
                    <motion.svg
                      width="16" height="16" viewBox="0 0 24 24" fill="none"
                      animate={{ scale: isBookmarked(bookmarks, q) ? [1, 1.3, 1] : 1 }}
                      transition={{ duration: 0.25 }}
                    >
                      {isBookmarked(bookmarks, q)
                        ? <path d="M5 3h14a1 1 0 0 1 1 1v18l-8-4-8 4V4a1 1 0 0 1 1-1z" fill="#fbbf24" />
                        : <path d="M5 3h14a1 1 0 0 1 1 1v18l-8-4-8 4V4a1 1 0 0 1 1-1z" fill="none" stroke="rgba(255,255,255,0.40)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      }
                    </motion.svg>
                  </motion.button>
                  {langMode !== "hi" && (
                    <div className="mb-1 pr-8">
                      {!q.english && q.hindi ? (
                        <>
                          {quizTranslateTexts[currentIndex] && (
                            <p className="text-white font-semibold text-base leading-relaxed mb-0.5">
                              {currentIndex + 1}. <MathText text={quizTranslateTexts[currentIndex]} />
                            </p>
                          )}
                          <p className={`font-semibold leading-relaxed ${quizTranslateTexts[currentIndex] ? "text-white/40 text-sm" : "text-white text-base"}`}>
                            {!quizTranslateTexts[currentIndex] && <>{currentIndex + 1}. </>}
                            <MathText text={q.hindi} />
                          </p>
                          {!quizTranslateTexts[currentIndex] && (
                            <motion.button
                              whileTap={{ scale: 0.95 }}
                              onClick={() => { void fetchQuizTranslation(currentIndex, q.hindi); }}
                              disabled={!!quizTranslateLoading[currentIndex]}
                              className="mt-2 text-xs flex items-center gap-1.5 px-3 py-1 rounded-full border transition-all"
                              style={{ background: `${meta.accent}10`, borderColor: `${meta.accent}35`, color: `${meta.accent}cc` }}>
                              {quizTranslateLoading[currentIndex] ? "🔄 Translating..." : "🔤 Translate to English"}
                            </motion.button>
                          )}
                        </>
                      ) : (
                        <p className="text-white font-semibold text-base leading-relaxed">
                          {currentIndex + 1}. <MathText text={q.english || q.hindi} />
                        </p>
                      )}
                    </div>
                  )}
                  {langMode === "hi" && (() => {
                    const ft = fullTranslations[currentIndex];
                    const isLoading = fullTranslating[currentIndex];
                    const hindiQ = q.hindi || ft?.hindi;
                    return (
                      <div className="mb-1 pr-8">
                        {isLoading && !hindiQ ? (
                          <div className="flex items-center gap-2">
                            <motion.span animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                              className="inline-block w-3.5 h-3.5 rounded-full border-2 border-transparent shrink-0"
                              style={{ borderTopColor: meta.accent, borderRightColor: `${meta.accent}40` }} />
                            <span className="text-white/30 text-sm">हिंदी में अनुवाद हो रहा है…</span>
                          </div>
                        ) : (
                          <p className="text-white font-semibold text-base leading-relaxed">
                            {currentIndex + 1}. <MathText text={hindiQ || q.english} />
                          </p>
                        )}
                        {!isLoading && !q.hindi && ft?.hindi && (
                          <p className="text-white/30 text-xs mt-0.5 leading-snug">
                            <MathText text={q.english} />
                          </p>
                        )}
                      </div>
                    );
                  })()}
                  {langMode === "both" && q.english && q.hindi && (
                    <p className="text-white/50 text-sm leading-relaxed pr-8">
                      <MathText text={q.hindi} />
                    </p>
                  )}
                  {langMode === "both" && q.english && !q.hindi && fullTranslations[currentIndex]?.hindi && (
                    <p className="text-white/50 text-sm leading-relaxed pr-8">
                      <MathText text={fullTranslations[currentIndex].hindi} />
                    </p>
                  )}
                </div>

                {/* Language toggle — below question, above options */}
                <div className="flex items-center justify-between mt-3 mb-1">
                  <motion.button
                    onClick={cycleLang}
                    whileTap={{ scale: 0.93 }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all"
                    style={{
                      background: langMode !== "both" ? `${meta.accent}22` : "rgba(255,255,255,0.05)",
                      borderColor: langMode !== "both" ? `${meta.accent}55` : "rgba(255,255,255,0.10)",
                      color: langMode !== "both" ? meta.accent : "rgba(255,255,255,0.35)",
                    }}
                    title="Toggle language: Both / English / Hindi"
                  >
                    🌐 {langLabel}
                  </motion.button>
                  {fullTranslating[currentIndex] && (
                    <div className="flex items-center gap-1.5">
                      <motion.span
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="inline-block w-3 h-3 rounded-full border-2 border-transparent"
                        style={{ borderTopColor: meta.accent, borderRightColor: `${meta.accent}40` }}
                      />
                      <span className="text-white/30 text-xs">हिंदी अनुवाद हो रहा है…</span>
                    </div>
                  )}
                </div>

                {/* Options */}
                <div className="flex flex-col gap-3">
                  {q.options.map((opt, oi) => {
                    const isSelected = selectedOption === oi;
                    const ft = fullTranslations[currentIndex];
                    const isTranslating = fullTranslating[currentIndex];
                    const optHindi   = q.optionsHindi?.[oi] ?? ft?.optionsHindi?.[oi];
                    const displayOpt = langMode === "hi" && optHindi ? optHindi : opt;
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
                          background:   isSelected ? `linear-gradient(135deg, ${magicColor}28, ${magicColor}10)` : "rgba(255,255,255,0.05)",
                          borderColor:  isSelected ? `${magicColor}60` : "rgba(0,0,0,0.08)",
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
                          style={{ background: isSelected ? `${magicColor}40` : "rgba(0,0,0,0.08)", color: isSelected ? magicColor : "rgba(255,255,255,0.32)" }}>
                          {String.fromCharCode(65 + oi)}
                        </span>
                        <span className="flex flex-col gap-0.5 min-w-0">
                          {langMode === "hi" ? (
                            <>
                              {isTranslating && !optHindi ? (
                                <span className="block h-4 rounded w-4/5 animate-pulse" style={{ background: "rgba(255,255,255,0.10)" }} />
                              ) : (
                                <span className="text-sm font-medium leading-snug" style={{ color: isSelected ? "#fff" : "rgba(255,255,255,0.85)" }}>
                                  <MathText text={displayOpt} />
                                </span>
                              )}
                              {optHindi && !isTranslating && (
                                <span className="text-xs leading-snug" style={{ color: isSelected ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.28)" }}>
                                  <MathText text={opt} />
                                </span>
                              )}
                            </>
                          ) : (
                            <>
                              <span className="text-sm font-medium leading-snug" style={{ color: isSelected ? "#fff" : "rgba(255,255,255,0.85)" }}>
                                <MathText text={opt} />
                              </span>
                              {optHindi && (
                                <span className="text-xs leading-snug" style={{ color: isSelected ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.28)" }}>
                                  <MathText text={optHindi} />
                                </span>
                              )}
                            </>
                          )}
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
              whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              onClick={handlePrev} disabled={currentIndex === 0}
              className="w-12 h-12 rounded-xl flex items-center justify-center border shrink-0 text-base"
              style={{
                background: "rgba(255,255,255,0.05)",
                borderColor: "rgba(0,0,0,0.08)",
                color: currentIndex === 0 ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.45)",
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
                style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(0,0,0,0.08)", color: "rgba(255,255,255,0.35)" }}>
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
                color:      selectedOption !== null ? "#fff" : "rgba(255,255,255,0.18)",
                boxShadow:  selectedOption !== null ? `0 4px 20px ${meta.accent}40` : "none",
                cursor:     selectedOption === null ? "not-allowed" : "pointer",
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
              background: "rgba(12,12,20,0.88)",
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
              border: `1px solid ${meta.accent}28`,
              boxShadow: `0 8px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05), 0 4px 24px ${meta.accent}1a`,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button
                onClick={() => setScreen("mode-select")}
                style={{ color: "rgba(255,255,255,0.32)", fontSize: 18, padding: 4, lineHeight: 1, flexShrink: 0, background: "none", border: "none", cursor: "pointer" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.62)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.32)")}
              >
                ←
              </button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <SubjectIcon id={subject} color={meta.accent} size="sm" />
                  <span style={{ color: "#fff", fontWeight: 700, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{meta.label}</span>
                  <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, background: `${meta.accent}20`, color: meta.accent, flexShrink: 0 }}>
                    {mode === "full" ? "Full Test" : selectedChapter}
                  </span>
                  <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                    <motion.button
                      onClick={cycleLang}
                      whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.93 }}
                      style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 8, border: `1px solid ${meta.accent}35`, background: langMode !== "both" ? `${meta.accent}28` : "rgba(255,255,255,0.06)", color: langMode !== "both" ? meta.accent : "rgba(255,255,255,0.35)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                      title="Toggle language"
                    >
                      🌐 {langLabel}
                    </motion.button>
                    <motion.button
                      onClick={() => setPaletteOpen(true)}
                      whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.93 }}
                      style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 8, border: `1px solid ${meta.accent}35`, background: `${meta.accent}18`, color: meta.accent, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                    >
                      <svg width="11" height="11" viewBox="0 0 12 12" fill="currentColor">
                        <rect x="0" y="0" width="5" height="5" rx="1"/><rect x="7" y="0" width="5" height="5" rx="1"/>
                        <rect x="0" y="7" width="5" height="5" rx="1"/><rect x="7" y="7" width="5" height="5" rx="1"/>
                      </svg>
                      {currentIndex + 1}/{questions.length}
                    </motion.button>
                  </div>
                </div>
                <div style={{ height: 6, borderRadius: 999, background: "rgba(0,0,0,0.08)", overflow: "hidden" }}>
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
