import { Router } from "express";
import { z } from "zod";
import { generateCachedText, AIRateLimitError } from "../../lib/ai-guard";

const router = Router();

// ─── Wikipedia free-context helper ───────────────────────────────────────────
// Fetches a plain-text summary for a topic from the Wikipedia REST API (free,
// no key, server-side only). Used as factual context before calling Gemini so
// questions are grounded in real content, not hallucinated.
async function fetchWikipediaSummary(topic: string): Promise<string | null> {
  try {
    const slug = encodeURIComponent(topic.trim().replace(/\s+/g, "_"));
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${slug}`,
      {
        headers: { "User-Agent": "ShikenEducationalApp/1.0" },
        signal: AbortSignal.timeout(3500),
      }
    );
    if (!res.ok) return null;
    const data = await res.json() as { extract?: string; type?: string };
    if (data.type === "disambiguation" || !data.extract) return null;
    // Cap at 600 chars to stay within token budget
    return data.extract.slice(0, 600);
  } catch {
    return null;
  }
}

const HINDI_GRAMMAR_CHAPTERS = [
  "वर्ण विचार","संज्ञा","सर्वनाम","क्रिया","विशेषण",
  "संधि","समास","काल","कारक","मुहावरे","लोकोक्तियाँ","शुद्ध-अशुद्ध वाक्य","एक शब्द",
];

const GenerateBody = z.object({
  subject: z.string().min(1),
  chapter: z.string().min(1),
  count: z.number().int().min(1).max(25).default(5),
  classId: z.string().optional().default("10"),
});

function getBoardContext(classId: string, subject: string): string {
  const cls = classId === "12" ? "12" : "10";
  const board = `BSEB (Bihar Board) and CBSE Class ${cls}`;
  const ncert = `NCERT Class ${cls} ${subject}`;
  return `${board} latest exam pattern, strictly based on ${ncert} textbook`;
}

router.post("/generate-questions", async (req, res) => {
  const parsed = GenerateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { subject, count, classId } = parsed.data;
  const cls = classId === "12" ? "12" : classId === "entrance" ? "" : "10";
  const isEntrance = classId === "entrance";
  const isHindi = subject.toLowerCase().includes("hindi");
  const boardCtx = getBoardContext(classId, subject);

  const effectiveChapter = isHindi && (!parsed.data.chapter || parsed.data.chapter === "?" || parsed.data.chapter === "General")
    ? HINDI_GRAMMAR_CHAPTERS[(count + subject.length) % HINDI_GRAMMAR_CHAPTERS.length]
    : parsed.data.chapter;

  // ── Wikipedia free context (non-blocking, best-effort) ───────────────────
  // Fetch a summary to ground Gemini in real factual content.
  // Falls back gracefully — no Wikipedia = still works, just less grounded.
  const wikiSummary = !isHindi
    ? await fetchWikipediaSummary(`${effectiveChapter} ${subject}`)
    : null;
  const wikiContext = wikiSummary
    ? `\n\nFACTUAL CONTEXT (from Wikipedia — use as reference, do not copy verbatim):\n${wikiSummary}\n`
    : "";

  let prompt: string;

  if (isHindi) {
    prompt = `तुम BSEB और CBSE Class ${cls} Hindi Vyakaran (व्याकरण) के expert हो।
NCERT Class ${cls} Hindi व्याकरण पर आधारित प्रश्न बनाओ।

"${effectiveChapter}" topic पर EXACTLY ${count} MCQ questions बनाओ।

प्रश्न की विशेषताएँ:
- Latest BSEB/CBSE Board exam 2022-2025 के pattern पर आधारित हों
- NCERT Class ${cls} पाठ्यक्रम के अनुसार हों
- Questions vary करें: definitions, fill-in-blank, identification, examples, sentence correction
- Difficulty: 30% easy, 50% medium, 20% hard (Board pattern)

STRICT RULES:
- Return ONLY a valid JSON array — no markdown, no code fences.
- Primary language: HINDI (Devanagari)।
- "hindi": प्रश्न Devanagari में (यही main question है)
- "english": same question in English
- "options": EXACTLY 4 Devanagari Hindi strings
- "optionsHindi": same 4 options (copy)
- "answerIndex": 0-3 (correct option index)

JSON format (return ONLY this):
[{"hindi":"...","english":"...","options":["...","...","...","..."],"optionsHindi":["...","...","...","..."],"answerIndex":0}]`;
  } else if (isEntrance) {
    const examName = subject.toLowerCase().includes("biology") ? "NEET" : "JEE Main";
    prompt = `You are an expert NTA ${examName} question setter for ${subject}.
${wikiContext}
Generate EXACTLY ${count} MCQ questions on: "${effectiveChapter}"

Question style:
- Strictly follow NTA ${examName} official pattern (2022-2025 papers)
- ${examName === "NEET" ? "NCERT-based: factual, conceptual, and application questions as per NEET Biology pattern" : "Mix of conceptual understanding, formula application, and numerical problems as per JEE Main pattern"}
- Include assertion-reason or statement-based questions (1-2 out of ${count})
- Difficulty: ${examName === "NEET" ? "60% medium (NCERT direct), 40% application" : "40% medium, 60% hard (JEE Main standard)"}
- Distractors must be closely related to eliminate guessing

STRICT RULES:
- Return ONLY a valid JSON array. No markdown, no code fences.
- Each question has EXACTLY 4 options.
- answerIndex: 0, 1, 2, or 3
- Use $...$ for inline math and $$...$$ for display math (KaTeX)
- "hindi": Hindi translation of the question
- "optionsHindi": same 4 options in Hindi

JSON format (return ONLY this):
[
  {
    "english": "Question text in English",
    "hindi": "प्रश्न का Hindi अनुवाद",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "optionsHindi": ["विकल्प A", "विकल्प B", "विकल्प C", "विकल्प D"],
    "answerIndex": 0
  }
]`;
  } else {
    prompt = `You are an expert ${boardCtx} question creator.
${wikiContext}
Generate EXACTLY ${count} MCQ questions on the topic: "${effectiveChapter}"

Question style — strictly follow ${boardCtx}:
- Based directly on NCERT Class ${cls} ${subject} textbook content
- Mix question types: direct recall (NCERT text), diagram/figure based, application-based, fill-in-the-blank style
- Include questions from NCERT in-text questions and exercise questions (paraphrased)
- Match the exact style of recent BSEB/CBSE 2022-2025 board papers
- Difficulty: 40% easy (NCERT direct), 40% medium, 20% application-based

STRICT RULES:
- Return ONLY a valid JSON array. No markdown, no explanation, no code fences.
- Each question must have exactly 4 options.
- answerIndex must be 0, 1, 2, or 3 (index of correct option).
- "hindi": Hindi translation of the question (simple, clear Devanagari).
- "options": answer choices in English.
- "optionsHindi": same 4 options translated to Hindi (same order and index).
- Use $...$ for inline math, $$...$$ for display math (KaTeX).

JSON format (return ONLY this, nothing else):
[
  {
    "english": "Question text in English",
    "hindi": "प्रश्न का Hindi अनुवाद",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "optionsHindi": ["विकल्प A का हिंदी", "विकल्प B का हिंदी", "विकल्प C का हिंदी", "विकल्प D का हिंदी"],
    "answerIndex": 0
  }
]`;
  }

  try {
    const { text: raw } = await generateCachedText(
      req,
      prompt,
      "questions",
      { subject, chapter: effectiveChapter, count, classId },
      { responseMimeType: "application/json" },
    );
    let questions: unknown[];
    try {
      questions = JSON.parse(raw);
    } catch {
      const match = raw.match(/\[[\s\S]*\]/);
      questions = match ? JSON.parse(match[0]) : [];
    }

    if (!Array.isArray(questions) || questions.length === 0) {
      res.status(500).json({ error: "Failed to generate questions" });
      return;
    }

    res.json({ questions });
  } catch (err) {
    if (err instanceof AIRateLimitError) {
      res.status(429).json({ error: err.message });
      return;
    }
    req.log.error(err, "Gemini generate-questions error");
    res.status(500).json({ error: "Question generation failed" });
  }
});

export default router;
