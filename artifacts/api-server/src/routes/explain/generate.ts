import { Router } from "express";
import { z } from "zod";
import { genai } from "../../lib/gemini";

const router = Router();

const GenerateBody = z.object({
  subject: z.string().min(1),
  chapter: z.string().min(1),
  count: z.number().int().min(1).max(10).default(5),
});

router.post("/generate-questions", async (req, res) => {
  const parsed = GenerateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { subject, chapter, count } = parsed.data;

  const prompt = `You are an expert Bihar Board exam question creator for ${subject}.

Generate exactly ${count} multiple-choice questions on the topic: "${chapter}" for Bihar Board Class 10 level.

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
      model: "gemini-2.5-flash",
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
