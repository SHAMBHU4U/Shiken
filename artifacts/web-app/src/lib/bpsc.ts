export const BPSC_EXAM_SLUG = "bpsc-cce";
export const BPSC_EXAM_LABEL = "BPSC Prelims CCE";
export const BPSC_DEFAULT_TEST_NAME = "BPSC CCE Prelims Test";
export const BPSC_DEFAULT_DURATION_SECONDS = 2 * 60 * 60;
export const BPSC_DEMO_QUESTION_COUNT = 10;
export const BPSC_PLAN_ID = "competitive_bpsc_cce_1m";
export const BPSC_DEFAULT_PRICE = 199;
export const BPSC_DEFAULT_ACCESS_DAYS = 30;
export const BPSC_DEFAULT_PLAN = {
  id: BPSC_PLAN_ID,
  name: "BPSC Prelims CCE Premium",
  price: `₹${BPSC_DEFAULT_PRICE}`,
  amount: BPSC_DEFAULT_PRICE,
  days: BPSC_DEFAULT_ACCESS_DAYS,
  period: `${BPSC_DEFAULT_ACCESS_DAYS} days`,
  perMonth: `₹${BPSC_DEFAULT_PRICE}/month`,
  tag: "BPSC Pass",
  accent: "#059669",
  emoji: "🏛️",
  singleSubject: false,
  category: "competitive" as const,
  features: [
    "Full BPSC Prelims PYQ access",
    "2-hour bilingual mock tests",
    "Current affairs and admin-published notes",
    "Score, accuracy and overall rank",
  ],
};

export const BPSC_CATEGORIES = [
  { id: "history", label: "History", labelHindi: "इतिहास", emoji: "🏛️", color: "#b45309" },
  { id: "bihar-special", label: "Bihar Special", labelHindi: "बिहार विशेष", emoji: "🌾", color: "#059669" },
  { id: "geography", label: "Geography", labelHindi: "भूगोल", emoji: "🌍", color: "#0891b2" },
  { id: "science", label: "Science", labelHindi: "विज्ञान", emoji: "🔬", color: "#2563eb" },
  { id: "polity", label: "Polity", labelHindi: "राजव्यवस्था", emoji: "⚖️", color: "#7c3aed" },
  { id: "economics", label: "Economics", labelHindi: "अर्थव्यवस्था", emoji: "📈", color: "#ca8a04" },
  { id: "reasoning", label: "Reasoning", labelHindi: "रीजनिंग", emoji: "🧠", color: "#db2777" },
  { id: "maths", label: "Maths", labelHindi: "गणित", emoji: "📐", color: "#ea580c" },
] as const;

export const BPSC_CURRENT_AFFAIRS_CATEGORIES = [
  { id: "national", label: "National", labelHindi: "राष्ट्रीय" },
  { id: "international", label: "International", labelHindi: "अंतरराष्ट्रीय" },
  { id: "bihar", label: "Bihar Special", labelHindi: "बिहार विशेष" },
] as const;

export type BpscCategory = (typeof BPSC_CATEGORIES)[number]["id"];
export type BpscCurrentAffairsCategory = (typeof BPSC_CURRENT_AFFAIRS_CATEGORIES)[number]["id"];
export type BpscLanguage = "hi" | "en" | "both";

export interface BpscQuestion {
  id: string;
  category: BpscCategory;
  topic?: string;
  year?: string;
  question_hi: string;
  question_en: string;
  options_hi: { A: string; B: string; C: string; D: string };
  options_en: { A: string; B: string; C: string; D: string };
  correct_answer: "A" | "B" | "C" | "D";
  explanation_hi?: string;
  explanation_en?: string;
  relatedFacts_hi?: string;
  relatedFacts_en?: string;
  question_type?: string;
}

export interface BpscMockTest {
  id: string;
  name: string;
  description?: string;
  durationSeconds: number;
  marksPerQuestion: number;
  negativeMark: number;
  questionIds: string[];
  published: boolean;
  updatedAt?: number;
}

export interface BpscCurrentAffair {
  id: string;
  category: BpscCurrentAffairsCategory;
  title_hi: string;
  title_en: string;
  content_hi: string;
  content_en: string;
  date?: string;
  month?: string;
  year?: string;
  question_hi?: string;
  question_en?: string;
  options_hi?: { A: string; B: string; C: string; D: string };
  options_en?: { A: string; B: string; C: string; D: string };
  correct_answer?: "A" | "B" | "C" | "D";
  explanation_hi?: string;
  explanation_en?: string;
  published: boolean;
}

export interface BpscNote {
  id: string;
  title: string;
  description?: string;
  category: string;
  language: "hi" | "en" | "both";
  pdfUrl: string;
  published: boolean;
  updatedAt?: number;
}

export const BPSC_DB_ROOT = `competitiveExams/${BPSC_EXAM_SLUG}`;

export function bpscQuestionRoot(category: string) {
  return `${BPSC_DB_ROOT}/questions/${category}`;
}

export function bpscTestRoot() {
  return `${BPSC_DB_ROOT}/tests`;
}

export function safeBpscSlug(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "test";
}

export function emptyBpscOptions() {
  return { A: "", B: "", C: "", D: "" };
}