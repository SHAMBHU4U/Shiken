import { Router } from "express";
import { z } from "zod";
import { genai } from "../lib/gemini";

const router = Router();

const TranslateBody = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("toEnglish"),
    hindi: z.string().min(1),
    subject: z.string().optional(),
  }),
  z.object({
    type: z.literal("fullTranslation"),
    english: z.string().min(1),
    options: z.array(z.string()).min(2).max(4),
    subject: z.string().optional(),
  }),
]);

router.post("/translate", async (req, res) => {
  const parsed = TranslateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  try {
    if (parsed.data.type === "toEnglish") {
      const { hindi } = parsed.data;
      const prompt = `Translate the following Hindi question to English for a Bihar Board Class 10 student.

STRICT RULES:
- Return ONLY the translated English question text.
- Keep fill-in-the-blank markers (............, ........., ___) exactly as-is.
- Keep any English words, numbers, or formulas unchanged.
- Use simple, clear English suitable for a 10th grade student.
- Do NOT add any explanation, prefix, or extra text. Just the translation.

Hindi question:
${hindi}`;

      const response = await genai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: { temperature: 0.2, maxOutputTokens: 256 },
      });

      res.json({ result: (response.text ?? "").trim() });

    } else {
      const { english, options, subject } = parsed.data;
      const prompt = `You are a Bihar Board exam translator. Translate this ${subject ?? "exam"} question and its options from English into simple Hindi (Devanagari).

English Question:
${english}

Options:
${options.map((o, i) => `${String.fromCharCode(65 + i)}. ${o}`).join("\n")}

STRICT RULES:
- Return ONLY valid JSON, no markdown, no explanation.
- Keep numbers, formulas, scientific symbols, and proper nouns unchanged.
- Use simple Hindi that a Class 10/12 Bihar Board student easily understands.
- JSON format exactly:
{"hindi":"translated question here","optionsHindi":["option A Hindi","option B Hindi","option C Hindi","option D Hindi"]}`;

      const response = await genai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: { temperature: 0.1, maxOutputTokens: 512, responseMimeType: "application/json" },
      });

      const raw = (response.text ?? "").trim();
      let result: Record<string, unknown>;
      try { result = JSON.parse(raw); }
      catch { const m = raw.match(/\{[\s\S]*\}/); result = m ? JSON.parse(m[0]) : {}; }

      res.json({
        hindi: String(result.hindi ?? english),
        optionsHindi: Array.isArray(result.optionsHindi)
          ? (result.optionsHindi as unknown[]).map(String).slice(0, 4)
          : options,
      });
    }
  } catch (err) {
    req.log.error(err, "Translate error");
    res.status(500).json({ error: "Translation failed" });
  }
});

export default router;
