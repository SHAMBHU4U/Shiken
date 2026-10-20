// @ts-nocheck
import { Router } from "express";
import { firebaseServices } from "../lib/firebase-admin-services";
import { logger } from "../lib/logger";

const router = Router();

const SUBJECT_ROOTS = [
  { id: "maths", label: "Maths", path: "maths" },
  { id: "english", label: "English", path: "english" },
  { id: "hindi", label: "Hindi", path: "hindi" },
  { id: "science", label: "Science", path: "science" },
  { id: "social", label: "Social Science", path: "social science" },
  { id: "sanskrit", label: "Sanskrit", path: "sanskrit" },
  { id: "c12_physics", label: "Physics", path: "class12/physics" },
  { id: "c12_chemistry", label: "Chemistry", path: "class12/chemistry" },
  { id: "c12_biology", label: "Biology", path: "class12/biology" },
  { id: "c12_maths", label: "Maths", path: "class12/maths" },
  { id: "c12_social", label: "Social", path: "class12/social" },
  { id: "c12_hindi", label: "Hindi", path: "class12/hindi" },
  { id: "c12_english", label: "English", path: "class12/english" },
  { id: "jee_physics", label: "JEE Physics", path: "entrance_exams/jee/physics" },
  { id: "jee_chemistry", label: "JEE Chemistry", path: "entrance_exams/jee/chemistry" },
  { id: "jee_maths", label: "JEE Maths", path: "entrance_exams/jee/maths" },
  { id: "neet_physics", label: "NEET Physics", path: "entrance_exams/neet/physics" },
  { id: "neet_chemistry", label: "NEET Chemistry", path: "entrance_exams/neet/chemistry" },
  { id: "neet_biology", label: "NEET Biology", path: "entrance_exams/neet/biology" },
  { id: "jee_full_mock", label: "JEE Full Mock", path: "jee_full_mock" },
  { id: "neet_full_mock", label: "NEET Full Mock", path: "neet_full_mock" },
];

type RecordValue = Record<string, unknown>;
type Content = { question: string; options: string[]; explanation: string };
type CanonicalQuestion = {
  questionId: string;
  subject: string;
  chapter: string;
  correctOptionIndex: number;
  en: Content;
  hi: Content;
};
type QuestionLocation = {
  questionId: string;
  subjectKey: string;
  chapterKey: string;
  sourceKind: "cache" | "subject";
  identitySeed: string;
  storagePath: string;
  arrayIndex?: number;
  raw: RecordValue;
  question: CanonicalQuestion;
};

function asRecord(value: unknown): RecordValue {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as RecordValue
    : {};
}

function text(value: unknown): string {
  return value == null ? "" : String(value);
}

function slug(value: string): string {
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

function createQuestionId(subject: string, chapter: string, identitySeed: string): string {
  return `q_${slug(subject)}_${slug(chapter)}_${hashText(`${subject}|${chapter}|${identitySeed}`)}`;
}

function normalizeOptions(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(text);
  const record = asRecord(value);
  return Object.keys(record)
    .sort((a, b) => {
      const an = Number(a);
      const bn = Number(b);
      if (Number.isInteger(an) && Number.isInteger(bn)) return an - bn;
      return a.localeCompare(b);
    })
    .map((key) => text(record[key]));
}

function resolveOptionIndex(record: RecordValue, options: string[]): number {
  const raw = record.correctOptionIndex ?? record.answerIndex ?? record.correct_answer
    ?? record.correctAnswer ?? record.answer;
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

function normalizeQuestion(
  value: unknown,
  defaults: { subject: string; chapter: string; identitySeed: string },
): CanonicalQuestion {
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
  const rawHiOptions = normalizeOptions(hiRaw.options).length
    ? normalizeOptions(hiRaw.options)
    : normalizeOptions(record.optionsHindi ?? record.options_hindi);
  const subject = text(record.subject ?? defaults.subject);
  const chapter = text(record.chapter ?? record.chapter_name ?? defaults.chapter);
  const questionId = text(record.questionId).trim()
    || createQuestionId(subject, chapter, defaults.identitySeed);

  return {
    questionId,
    subject,
    chapter,
    correctOptionIndex: resolveOptionIndex(record, enOptions),
    en: {
      question: englishQuestion,
      options: enOptions,
      explanation: text(enRaw.explanation ?? record.explanation),
    },
    hi: {
      question: hindiQuestion,
      options: rawHiOptions.length ? rawHiOptions : enOptions.map(() => ""),
      explanation: text(hiRaw.explanation ?? record.explanation_hi ?? ""),
    },
  };
}

function isQuestionRecord(record: RecordValue): boolean {
  return !!(record.en || record.hi || record.english || record.hindi || record.question
    || record.question_english || record.question_hindi || record.question_hi);
}

function cacheLocation(
  subjectKey: string,
  chapterKey: string,
  index: number,
  rawValue: unknown,
): QuestionLocation | null {
  const raw = asRecord(rawValue);
  const identitySeed = `aiQuestionsCache/${subjectKey}/${chapterKey}/${index}`;
  const question = normalizeQuestion(raw, { subject: subjectKey, chapter: chapterKey, identitySeed });
  if (!question.en.question && !question.hi.question) return null;
  return {
    questionId: question.questionId,
    subjectKey,
    chapterKey,
    sourceKind: "cache",
    identitySeed,
    storagePath: `aiQuestionsCache/${subjectKey}/${chapterKey}/questions`,
    arrayIndex: index,
    raw,
    question,
  };
}

async function collectQuestions(db: ReturnType<typeof getDatabase>): Promise<QuestionLocation[]> {
  const result: QuestionLocation[] = [];
  const cacheSnapshot = await db.ref("aiQuestionsCache").get();
  const cache = asRecord(cacheSnapshot.val());
  for (const [subjectKey, chapterValue] of Object.entries(cache)) {
    const chapters = asRecord(chapterValue);
    for (const [chapterKey, value] of Object.entries(chapters)) {
      const chapter = asRecord(value);
      if (!Array.isArray(chapter.questions)) continue;
      chapter.questions.forEach((raw, index) => {
        const location = cacheLocation(subjectKey, chapterKey, index, raw);
        if (location) result.push(location);
      });
    }
  }

  const roots = await Promise.all(SUBJECT_ROOTS.map(async (subject) => ({
    subject,
    snapshot: await db.ref(subject.path).get(),
  })));

  for (const { subject, snapshot } of roots) {
    if (!snapshot.exists()) continue;
    const walk = (node: unknown, pathParts: string[], chapterHint: string) => {
      if (Array.isArray(node)) {
        node.forEach((child, index) => {
          if (child && typeof child === "object" && !Array.isArray(child) && isQuestionRecord(asRecord(child))) {
            const raw = asRecord(child);
            const identitySeed = [...pathParts, String(index)].join("/");
            const chapterKey = text(raw.chapter ?? raw.chapter_name ?? chapterHint ?? "General");
            const question = normalizeQuestion(raw, {
              subject: subject.label,
              chapter: chapterKey,
              identitySeed,
            });
            if (question.en.question || question.hi.question) {
              result.push({
                questionId: question.questionId,
                subjectKey: subject.id,
                chapterKey,
                sourceKind: "subject",
                identitySeed,
                storagePath: pathParts.join("/"),
                arrayIndex: index,
                raw,
                question,
              });
            }
          } else {
            walk(child, [...pathParts, String(index)], chapterHint || String(index));
          }
        });
        return;
      }
      if (!node || typeof node !== "object") return;
      const record = asRecord(node);
      if (isQuestionRecord(record)) {
        const chapterKey = text(record.chapter ?? record.chapter_name ?? chapterHint ?? "General");
        const storagePath = pathParts.join("/");
        const question = normalizeQuestion(record, {
          subject: subject.label,
          chapter: chapterKey,
          identitySeed: storagePath,
        });
        if (question.en.question || question.hi.question) {
          result.push({
            questionId: question.questionId,
            subjectKey: subject.id,
            chapterKey,
            sourceKind: "subject",
            identitySeed: storagePath,
            storagePath,
            raw: record,
            question,
          });
        }
        return;
      }
      for (const [key, child] of Object.entries(record)) {
        walk(child, [...pathParts, key], chapterHint || key);
      }
    };
    walk(snapshot.val(), subject.path.split("/"), "");
  }
  return result;
}

async function requireQuestionAdmin(req: any, res: any, next: any) {
  try {
    const match = String(req.headers.authorization ?? "").match(/^Bearer\s+(.+)$/i);
    if (!match) return res.status(401).json({ ok: false, error: "Sign in is required." });
    const { auth, db } = firebaseServices();
    const decoded = await auth.verifyIdToken(match[1]);
    const adminSnapshot = await db.ref(`users/${decoded.uid}/isAdmin`).get();
    if (adminSnapshot.val() !== true) {
      return res.status(403).json({ ok: false, error: "This account is not authorized to manage questions." });
    }
    req.questionAdminUid = decoded.uid;
    next();
  } catch (err) {
    logger.warn({ err }, "Admin question authorization failed");
    return res.status(401).json({ ok: false, error: "Your session could not be verified. Sign in again." });
  }
}

function canonicalPayload(value: unknown, pathQuestionId: string): CanonicalQuestion | null {
  const record = asRecord(value);
  const en = asRecord(record.en);
  const hi = asRecord(record.hi);
  const questionId = text(record.questionId).trim();
  const subject = text(record.subject).trim();
  const chapter = text(record.chapter).trim();
  const enOptions = Array.isArray(en.options) ? en.options : null;
  const hiOptions = Array.isArray(hi.options) ? hi.options : null;
  const correctOptionIndex = Number(record.correctOptionIndex);
  if (!questionId || questionId.toLowerCase() !== pathQuestionId.toLowerCase()
    || !subject || !chapter || !enOptions || enOptions.length < 2
    || !enOptions.every((option) => typeof option === "string")
    || typeof en.question !== "string" || typeof en.explanation !== "string"
    || !Number.isInteger(correctOptionIndex) || correctOptionIndex < 0 || correctOptionIndex >= enOptions.length) {
    return null;
  }
  const hindiOptions = hiOptions ?? enOptions.map(() => "");
  if (hindiOptions.length !== enOptions.length || !hindiOptions.every((option) => typeof option === "string")
    || typeof hi.question !== "string" || typeof hi.explanation !== "string") {
    return null;
  }
  if (subject.length > 160 || chapter.length > 160 || en.question.length > 20000 || hi.question.length > 20000
    || en.explanation.length > 30000 || hi.explanation.length > 30000
    || [...enOptions, ...hindiOptions].some((option) => option.length > 4000)) {
    return null;
  }
  return {
    questionId,
    subject,
    chapter,
    correctOptionIndex,
    en: { question: en.question, options: enOptions, explanation: en.explanation },
    hi: { question: hi.question, options: hindiOptions, explanation: hi.explanation },
  };
}

async function mutateQuestion(location: QuestionLocation, questionId: string, replacement: CanonicalQuestion | null) {
  const { db } = firebaseServices();
  const targetId = questionId.toLowerCase();
  if (location.arrayIndex !== undefined) {
    const ref = db.ref(location.storagePath);
    return ref.transaction((current: unknown) => {
      if (!Array.isArray(current)) return;
      const targetIndex = current.findIndex((item, index) => {
        const identitySeed = location.sourceKind === "cache"
          ? `${location.storagePath.replace(/\/questions$/, "")}/${index}`
          : `${location.storagePath}/${index}`;
        const defaults = {
          subject: location.sourceKind === "cache" ? location.subjectKey : SUBJECT_ROOTS.find((s) => s.id === location.subjectKey)?.label ?? location.subjectKey,
          chapter: location.chapterKey,
          identitySeed,
        };
        return normalizeQuestion(item, defaults).questionId.toLowerCase() === targetId;
      });
      if (targetIndex < 0) return;
      const next = current.slice();
      if (replacement) next[targetIndex] = replacement;
      else next.splice(targetIndex, 1);
      return next;
    }, undefined, false);
  }

  const ref = db.ref(location.storagePath);
  return ref.transaction((current: unknown) => {
    if (!current || typeof current !== "object" || Array.isArray(current)) return;
    const defaults = {
      subject: SUBJECT_ROOTS.find((s) => s.id === location.subjectKey)?.label ?? location.subjectKey,
      chapter: location.chapterKey,
      identitySeed: location.identitySeed,
    };
    if (normalizeQuestion(current, defaults).questionId.toLowerCase() !== targetId) return;
    return replacement;
  }, undefined, false);
}

router.use("/admin/questions", requireQuestionAdmin);

router.get("/admin/questions", async (_req, res) => {
  try {
    const { db } = firebaseServices();
    const locations = await collectQuestions(db);
    const questions = locations.map(({ question, sourceKind, subjectKey, chapterKey }) => ({
      ...question,
      sourceKind,
      subjectKey,
      chapterKey,
    }));
    return res.json({ ok: true, questions });
  } catch (err) {
    logger.error({ err }, "Admin question bank load failed");
    return res.status(500).json({ ok: false, error: "Could not load the question bank." });
  }
});

router.put("/admin/questions/:questionId", async (req, res) => {
  try {
    const questionId = text(req.params.questionId).trim();
    const replacement = canonicalPayload(req.body, questionId);
    if (!replacement) {
      return res.status(400).json({ ok: false, error: "Question data is invalid. Check both languages, options, and answer index." });
    }
    const { db } = firebaseServices();
    const locations = (await collectQuestions(db))
      .filter((item) => item.questionId.toLowerCase() === questionId.toLowerCase());
    if (locations.length > 1) {
      return res.status(409).json({ ok: false, error: "This question ID is duplicated. Resolve duplicate IDs before editing." });
    }
    if (!locations.length) return res.status(404).json({ ok: false, error: "Question not found." });
    const result = await mutateQuestion(locations[0], questionId, replacement);
    if (!result.committed) return res.status(409).json({ ok: false, error: "Question changed or was removed. Reload the question bank and retry." });
    return res.json({ ok: true, question: replacement });
  } catch (err) {
    logger.error({ err }, "Admin question update failed");
    return res.status(500).json({ ok: false, error: "Could not save this question." });
  }
});

router.delete("/admin/questions/:questionId", async (req, res) => {
  try {
    const questionId = text(req.params.questionId).trim();
    if (!questionId || questionId.length > 200) {
      return res.status(400).json({ ok: false, error: "A valid question ID is required." });
    }
    const { db } = firebaseServices();
    const locations = (await collectQuestions(db))
      .filter((item) => item.questionId.toLowerCase() === questionId.toLowerCase());
    if (locations.length > 1) {
      return res.status(409).json({ ok: false, error: "This question ID is duplicated. Resolve duplicate IDs before deleting." });
    }
    if (!locations.length) return res.status(404).json({ ok: false, error: "Question not found." });
    const result = await mutateQuestion(locations[0], questionId, null);
    if (!result.committed) return res.status(409).json({ ok: false, error: "Question changed or was removed. Reload the question bank and retry." });
    return res.json({ ok: true, questionId });
  } catch (err) {
    logger.error({ err }, "Admin question deletion failed");
    return res.status(500).json({ ok: false, error: "Could not delete this question." });
  }
});

export default router;
