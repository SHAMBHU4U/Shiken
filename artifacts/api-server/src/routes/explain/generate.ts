import { Router } from "express";
import { z } from "zod";
import { genai } from "../../lib/gemini";

const router = Router();

const HINDI_GRAMMAR_CHAPTERS = [
  "वर्ण विचार","संज्ञा","सर्वनाम","क्रिया","विशेषण",
  "संधि","समास","काल","कारक","मुहावरे","लोकोक्तियाँ","शुद्ध-अशुद्ध वाक्य","एक शब्द",
];

const GenerateBody = z.object({
  subject: z.string().min(1),
  chapter: z.string().min(1),
  count: z.number().int().min(1).max(25).default(5),
});

router.post("/generate-questions", async (req, res) => {
  const parsed = GenerateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { subject, count } = parsed.data;
  const isHindi = subject.toLowerCase().includes("hindi");

  const effectiveChapter = isHindi && (!parsed.data.chapter || parsed.data.chapter === "?" || parsed.data.chapter === "General")
    ? HINDI_GRAMMAR_CHAPTERS[Math.floor(Math.random() * HINDI_GRAMMAR_CHAPTERS.length)]
    : parsed.data.chapter;

  const prompt = isHindi
    ? `तुम Bihar Board Class 10 Hindi Vyakaran (व्याकरण) के expert हो।

"${effectiveChapter}" topic पर EXACTLY ${count} MCQ questions बनाओ जो Bihar Board Class 10 परीक्षा के लिए उपयुक्त हों।

STRICT RULES:
- Return ONLY a valid JSON array — no markdown, no code fences.
- Primary language: HINDI (Devanagari)।
- "hindi": प्रश्न Devanagari में (यही main question है)
- "english": same question in English
- "options": EXACTLY 4 Devanagari Hindi strings
- "optionsHindi": same 4 options (copy)
- "answerIndex": 0-3 (correct option index)
- Questions must vary: definitions, fill-in-blank, identification, examples।

JSON format (return ONLY this):
[{"hindi":"...","english":"...","options":["...","...","...","..."],"optionsHindi":["...","...","...","..."],"answerIndex":0}]`
    : `You are an expert Bihar Board exam question creator for ${subject}.

Generate exactly ${count} multiple-choice questions on the topic: "${effectiveChapter}" for Bihar Board Class 10 level.

STRICT RULES:
- Return ONLY a valid JSON array. No markdown, no explanation, no code fences.
- Each question must have exactly 4 options.
- answerIndex must be 0, 1, 2, or 3 (index of correct option).
- "hindi" field: Hindi translation of the question text (simple, clear Hindi).
- "options": answer choices written in English.
- "optionsHindi": the same 4 answer choices translated into Hindi (same order, same index).
- Questions must be factual, syllabus-appropriate, and varied in difficulty.
- Both the question AND all options must make sense in both languages.

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

  try {
    const response = await genai.models.generateContent({
      model: "gemini-2.0-flash-lite",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        maxOutputTokens: 4096,
        responseMimeType: "application/json",
      },
    });

    const raw = response.text ?? "[]";
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
    req.log.error(err, "Gemini generate-questions error");
    res.status(500).json({ error: "Question generation failed" });
  }
});

export default router;
