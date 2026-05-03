import { Router } from "express";
import { z } from "zod";
import { streamGemini } from "../../lib/gemini";

const router = Router();

const ExplainBodySchema = z.object({
  questionEnglish: z.string().min(1),
  questionHindi:   z.string().optional(),
  options:         z.array(z.string()).min(2),
  optionsHindi:    z.array(z.string()).optional(),
  correctAnswer:   z.string().min(1),
  subject:         z.string().min(1),
  lang:            z.enum(["both", "en", "hi"]).default("both"),
});

router.post("/explain", async (req, res) => {
  const parsed = ExplainBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { questionEnglish, questionHindi, options, optionsHindi, correctAnswer, subject, lang } = parsed.data;

  const optsList = options
    .map((opt, i) => {
      const h = optionsHindi?.[i];
      if (lang === "hi" && h) return `${String.fromCharCode(65 + i)}. ${h}`;
      if (lang === "en") return `${String.fromCharCode(65 + i)}. ${opt}`;
      return h ? `${String.fromCharCode(65 + i)}. ${opt} / ${h}` : `${String.fromCharCode(65 + i)}. ${opt}`;
    })
    .join("\n");

  const questionLine =
    lang === "en" ? questionEnglish
    : lang === "hi" ? (questionHindi || questionEnglish)
    : questionHindi ? `${questionEnglish}\n${questionHindi}` : questionEnglish;

  const writingRule =
    lang === "en" ? "Write ENTIRELY in English. Keep it simple and direct."
    : lang === "hi" ? "Write ENTIRELY in Hindi (Devanagari script). Keep English only for formulas, numbers, and proper nouns."
    : "Write mainly in Hindi. Use English for technical terms, formulas, and key words. Mix is fine (Hinglish).";

  const prompt = `You are a Bihar Board Class 10 ${subject} teacher. Solve this question step by step.

Question: ${questionLine}

Options:
${optsList}

Correct Answer: ${correctAnswer}

${writingRule}

STRICT OUTPUT RULES — follow exactly:
- NO asterisks, NO stars, NO hash symbols, NO markdown of any kind
- NO bold, NO italic, NO bullet symbols like -, *, #
- Plain text only. Clean. No decorators.
- Use numbered steps: 1. 2. 3.
- Use arrow for sub-points: → 
- Use $ for inline math, $$ for block math (LaTeX)
- Total length: 10-14 lines max. Short and clear.

Write the solution in this exact structure (no extra sections, no headers other than these):

सही जवाब: ${correctAnswer}
[One sentence — why this option is correct]

हल:
1. [First step — set up the problem or recall the concept]
2. [Second step — apply formula / logic]
3. [Third step — reach the answer, show calculation if any]

Formula / Theory:
[Write relevant formula in LaTeX if applicable. If no formula, write the key rule or definition in 1 line.]

याद रखो: [One sharp memory trick or shortcut for this type of question]`;

  await streamGemini(res, prompt, "Explanation नहीं मिली 🙏", req.log);
});

export default router;
