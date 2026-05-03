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
    lang === "en"
      ? "Write ENTIRELY in simple English. Use short sentences. Explain as if the student is hearing this topic for the first time."
      : lang === "hi"
      ? "Write ENTIRELY in Hindi (Devanagari). Keep English ONLY for formulas, numbers, and scientific terms. Use simple everyday Hindi words."
      : "Write mainly in Hindi (Devanagari). Use English for technical terms, formulas, and key scientific words. Simple Hinglish is fine.";

  const prompt = `You are a friendly Bihar Board Class 10 ${subject} teacher. A student who is learning this topic for the very first time needs your help understanding this question.

Question: ${questionLine}

Options:
${optsList}

Correct Answer: ${correctAnswer}

${writingRule}

STRICT FORMATTING RULES — follow every rule exactly, no exceptions:
- Do NOT use any asterisks (*), stars, hash symbols (#), or dashes (-) as bullet points
- Do NOT use any markdown bold, italic, or heading syntax whatsoever
- Write plain text only — no decorators of any kind
- Use numbers for steps: 1. 2. 3. 4.
- Use the arrow symbol for sub-points: →
- For math: use $formula$ for inline and $$formula$$ for block display (LaTeX syntax)
- Keep total length between 14 and 18 lines
- Every explanation must be simple enough for a first-time learner

Output the solution in this exact structure — use these exact section labels, nothing else:

सही जवाब: ${correctAnswer}
[One sentence in plain words — why this option is correct]

हल:
1. [What concept or topic is being tested — explain it simply in one line]
2. [What approach or formula is needed — state it clearly]
3. [Show the working step by step — include the calculation or logic]
4. [State the final result and confirm the correct option]

Formula / Theory:
[Write the formula using LaTeX ($...$) if applicable. If no formula exists, write the key definition or rule in one plain sentence.]

Notes:
1. [An important point about this topic every student must remember]
2. [A common mistake students make — and how to avoid it]
3. [A quick shortcut or memory tip for this type of question]`;

  await streamGemini(res, prompt, "Explanation नहीं मिली। Please try again.", req.log);
});

export default router;
