export interface BilingualQuestionContent {
  question: string;
  options: string[];
  explanation: string;
}

export interface NormalizedQuestion {
  questionId: string;
  subject: string;
  chapter: string;
  correctOptionIndex: number;
  en: BilingualQuestionContent;
  hi: BilingualQuestionContent;
}

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as UnknownRecord
    : {};
}

function text(value: unknown): string {
  return value == null ? "" : String(value);
}

export function questionSlug(value: string): string {
  return value.trim().toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 32) || "general";
}

function hashText(value: string): string {
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    first = Math.imul(first ^ code, 0x01000193);
    second = Math.imul(second ^ (code + i), 0x85ebca6b);
  }
  return `${(first >>> 0).toString(36)}${(second >>> 0).toString(36)}`;
}

/** Creates a compact, URL/Firebase-safe ID. Supplying identitySeed makes it stable. */
export function createQuestionId(subject: string, chapter: string, identitySeed?: string): string {
  const seed = identitySeed ?? `${Date.now()}-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`;
  return `q_${questionSlug(subject)}_${questionSlug(chapter)}_${hashText(`${subject}|${chapter}|${seed}`)}`;
}

function normalizeOptions(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(text);
  const object = asRecord(value);
  const keys = Object.keys(object).sort((a, b) => {
    const aNum = Number(a);
    const bNum = Number(b);
    if (Number.isInteger(aNum) && Number.isInteger(bNum)) return aNum - bNum;
    return a.localeCompare(b);
  });
  return keys.map((key) => text(object[key]));
}

function resolveOptionIndex(record: UnknownRecord, options: string[]): number {
  const raw = record.correctOptionIndex ?? record.answerIndex ?? record.correct_answer ?? record.correctAnswer ?? record.answer;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return Math.max(0, Math.min(Math.trunc(raw), Math.max(options.length - 1, 0)));
  }
  const answer = text(raw).trim();
  if (/^[A-D]$/i.test(answer)) return answer.toUpperCase().charCodeAt(0) - 65;
  const prefixed = answer.match(/^\(([A-D])\)/i);
  if (prefixed) return prefixed[1].toUpperCase().charCodeAt(0) - 65;
  const numeric = Number(answer);
  if (answer && Number.isInteger(numeric)) {
    return Math.max(0, Math.min(numeric, Math.max(options.length - 1, 0)));
  }
  const matched = options.findIndex((option) => option === answer || option.includes(answer) || answer.includes(option));
  return matched < 0 ? 0 : matched;
}

/**
 * Accepts the current bilingual record and the app's historical flat formats.
 * Missing Hindi content is represented by empty strings/arrays, never copied from English.
 */
export function normalizeQuestionRecord(
  value: unknown,
  defaults: { subject?: string; chapter?: string; identitySeed?: string } = {},
): NormalizedQuestion {
  const record = asRecord(value);
  const enRaw = asRecord(record.en);
  const hiRaw = asRecord(record.hi);

  let englishQuestion = text(enRaw.question ?? record.question_english ?? record.english ?? record.question);
  let hindiQuestion = text(hiRaw.question ?? record.question_hindi ?? record.question_hi ?? record.hindi);
  if (!englishQuestion && !hindiQuestion && record.question) {
    const combined = text(record.question);
    const separator = combined.indexOf(" / ");
    if (separator >= 0) {
      hindiQuestion = combined.slice(0, separator).trim();
      englishQuestion = combined.slice(separator + 3).trim();
    } else {
      englishQuestion = combined;
    }
  }

  const enOptions = normalizeOptions(enRaw.options).length
    ? normalizeOptions(enRaw.options)
    : normalizeOptions(record.options);
  const hiOptions = normalizeOptions(hiRaw.options).length
    ? normalizeOptions(hiRaw.options)
    : normalizeOptions(record.optionsHindi ?? record.options_hindi);
  const normalizedHiOptions = hiOptions.length
    ? hiOptions
    : enOptions.map(() => "");
  const subject = text(record.subject ?? defaults.subject);
  const chapter = text(record.chapter ?? record.chapter_name ?? defaults.chapter);
  const correctOptionIndex = resolveOptionIndex(record, enOptions);
  const enExplanation = text(enRaw.explanation ?? record.explanation);
  const hiExplanation = text(hiRaw.explanation ?? record.explanation_hi ?? "");
  const identitySeed = defaults.identitySeed ?? `${englishQuestion}|${hindiQuestion}`;
  const questionId = text(record.questionId).trim()
    || createQuestionId(subject, chapter, identitySeed);

  return {
    questionId,
    subject,
    chapter,
    correctOptionIndex,
    en: { question: englishQuestion, options: enOptions, explanation: enExplanation },
    hi: { question: hindiQuestion, options: normalizedHiOptions, explanation: hiExplanation },
  };
}

export function normalizeQuestionStatement(value: string): string {
  return value.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}
