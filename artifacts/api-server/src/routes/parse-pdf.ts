import { Router } from "express";
import { z } from "zod";
import { genai } from "../lib/gemini";

const router = Router();

const ParsePDFBody = z.object({
  pdfBase64: z.string().min(1),
  subject: z.string().min(1),
  chapter: z.string().min(1),
});

router.post("/parse-pdf", async (req, res) => {
  const parsed = ParsePDFBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { pdfBase64, subject, chapter } = parsed.data;

  const prompt = `You are an expert at extracting multiple-choice questions from Bihar Board Class 10 exam papers.

Extract ALL multiple-choice questions from this PDF document.
Subject: ${subject}
Chapter / Topic: ${chapter}

For each question:
- Write "english" field: the full question in English
- Write "hindi" field: the full question in Hindi (Devanagari script)
- Write "options": exactly 4 answer choices in English (A, B, C, D)
- Write "optionsHindi": same 4 choices translated to Hindi
- Write "answerIndex": 0, 1, 2, or 3 (index of correct answer). If answer key is provided use it; otherwise use subject knowledge.

STRICT RULES:
- Return ONLY a valid JSON array. No markdown, no code fences, no explanation.
- Skip incomplete questions or those with fewer than 4 options.
- Ignore page numbers, headers, footers, instructions text.
- If question is only in Hindi, still fill English field with a translation.

JSON format (return ONLY this):
[
  {
    "english": "Question text in English",
    "hindi": "प्रश्न हिंदी में",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "optionsHindi": ["विकल्प A", "विकल्प B", "विकल्प C", "विकल्प D"],
    "answerIndex": 0
  }
]`;

  try {
    const response = await genai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{
        role: "user",
        parts: [
          { inlineData: { mimeType: "application/pdf", data: pdfBase64 } },
          { text: prompt },
        ],
      }],
      config: { maxOutputTokens: 8192, responseMimeType: "application/json" },
    });

    const raw = response.text ?? "[]";
    let questions: unknown[];
    try {
      questions = JSON.parse(raw);
    } catch {
      const match = raw.match(/\[[\s\S]*\]/);
      questions = match ? JSON.parse(match[0]) : [];
    }

    if (!Array.isArray(questions)) {
      res.status(500).json({ error: "AI returned no questions" });
      return;
    }

    const filtered = (questions as Record<string, unknown>[])
      .map((q) => ({
        english:      String(q.english      ?? ""),
        hindi:        String(q.hindi        ?? ""),
        options:      Array.isArray(q.options)      ? (q.options      as unknown[]).map(String) : [],
        optionsHindi: Array.isArray(q.optionsHindi) ? (q.optionsHindi as unknown[]).map(String) : [],
        answerIndex:  typeof q.answerIndex === "number" ? q.answerIndex : 0,
      }))
      .filter((q) => (q.english || q.hindi) && q.options.length >= 2);

    res.json({ questions: filtered });
  } catch (err) {
    req.log.error(err, "PDF parse error");
    res.status(500).json({ error: "PDF parsing failed" });
  }
});

export default router;
