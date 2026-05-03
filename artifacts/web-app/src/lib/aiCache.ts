import { db } from "@/firebase";
import { ref, get, set } from "firebase/database";
import type { GeneratedQuestion } from "./gemini";

const MAX_CACHED = 100;

function chapterSlug(chapter: string): string {
  return chapter
    .toLowerCase()
    .replace(/[^a-z0-9\u0900-\u097f]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60) || "general";
}

function subjectSlug(subject: string): string {
  return subject
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40) || "subject";
}

function dedupeKey(q: { english: string }): string {
  return q.english.toLowerCase().trim().slice(0, 80);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function cachePath(subject: string, chapter: string): string {
  return `aiQuestionsCache/${subjectSlug(subject)}/${chapterSlug(chapter)}`;
}

export async function getCachedQuestions(
  subject: string,
  chapter: string,
  count: number,
): Promise<GeneratedQuestion[] | null> {
  try {
    const snap = await get(ref(db, cachePath(subject, chapter)));
    if (!snap.exists()) return null;
    const data = snap.val() as { questions?: unknown[] } | null;
    if (!data || !Array.isArray(data.questions) || data.questions.length < count) return null;
    const valid = (data.questions as GeneratedQuestion[]).filter(
      (q) => q.english && Array.isArray(q.options) && q.options.length >= 2,
    );
    if (valid.length < count) return null;
    return shuffle(valid).slice(0, count);
  } catch {
    return null;
  }
}

export async function mergeQuestionsToCache(
  subject: string,
  chapter: string,
  incoming: GeneratedQuestion[],
): Promise<void> {
  try {
    const path = cachePath(subject, chapter);
    const snap = await get(ref(db, path));
    const existing: GeneratedQuestion[] = snap.exists()
      ? ((snap.val() as { questions?: GeneratedQuestion[] })?.questions ?? [])
      : [];
    const existingKeys = new Set(existing.map(dedupeKey));
    const newOnes = incoming.filter((q) => q.english && !existingKeys.has(dedupeKey(q)));
    if (newOnes.length === 0) return;
    const merged = [...existing, ...newOnes].slice(-MAX_CACHED);
    await set(ref(db, path), { questions: merged, updatedAt: Date.now() });
  } catch {
    // non-critical — cache write failure is fine
  }
}
