const CACHE_PREFIX  = "shiken_qcache_";
const CACHE_MAX_AGE = 14 * 24 * 60 * 60 * 1000; // 14 days

interface CacheEntry {
  questions: unknown[];
  savedAt:   number;
}

function cacheKey(classId: string, subject: string): string {
  return `${CACHE_PREFIX}${classId}_${subject}`;
}

export function saveQuestionsToCache(classId: string, subject: string, questions: unknown[]): void {
  if (!questions.length) return;
  try {
    const entry: CacheEntry = { questions, savedAt: Date.now() };
    localStorage.setItem(cacheKey(classId, subject), JSON.stringify(entry));
  } catch { /* quota exceeded — silent */ }
}

export function loadQuestionsFromCache(classId: string, subject: string): unknown[] | null {
  try {
    const raw = localStorage.getItem(cacheKey(classId, subject));
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry;
    if (Date.now() - entry.savedAt > CACHE_MAX_AGE) return null;
    if (!Array.isArray(entry.questions) || entry.questions.length === 0) return null;
    return entry.questions;
  } catch { return null; }
}

export function getCacheInfo(classId: string, subject: string): { count: number; savedAt: number } | null {
  try {
    const raw = localStorage.getItem(cacheKey(classId, subject));
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry;
    if (!Array.isArray(entry.questions)) return null;
    return { count: entry.questions.length, savedAt: entry.savedAt };
  } catch { return null; }
}

const SUB_CACHE_KEY = "shiken_subscription_cache";

interface SubCache {
  uid:              string;
  subscriptionType: string;
  plan:             string | null;
  premiumSubjects:  string[];
  savedAt:          number;
}

export function saveSubscriptionToCache(uid: string, data: Omit<SubCache, "uid" | "savedAt">): void {
  try {
    const entry: SubCache = { uid, ...data, savedAt: Date.now() };
    localStorage.setItem(SUB_CACHE_KEY, JSON.stringify(entry));
  } catch { /* quota */ }
}

export function loadSubscriptionFromCache(uid: string): Omit<SubCache, "uid" | "savedAt"> | null {
  try {
    const raw = localStorage.getItem(SUB_CACHE_KEY);
    if (!raw) return null;
    const entry = JSON.parse(raw) as SubCache;
    if (entry.uid !== uid) return null;
    return { subscriptionType: entry.subscriptionType, plan: entry.plan, premiumSubjects: entry.premiumSubjects };
  } catch { return null; }
}
