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
  lang:            z.enum(["en", "hi"]).default("hi"),
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
      if (lang === "en") return `${String.fromCharCode(65 + i)}. ${opt}`;
      return h ? `${String.fromCharCode(65 + i)}. ${h}` : `${String.fromCharCode(65 + i)}. ${opt}`;
    })
    .join("\n");

  const questionLine =
    lang === "en" ? questionEnglish
    : (questionHindi || questionEnglish);

  const writingRule = lang === "en"
    ? "Write ENTIRELY in simple English. Short sentences. Beginner-friendly."
    : "पूरा जवाब Hindi (Devanagari) में लिखो। English सिर्फ formulas, numbers, और scientific terms के लिए। सरल और आम Hindi words use करो।";

  const sectionLabels = lang === "en"
    ? { answer: `Correct Answer: ${correctAnswer}`, solution: "Solution:", formula: "Formula / Theory:", notes: "Remember:" }
    : { answer: `सही जवाब: ${correctAnswer}`, solution: "हल:", formula: "सूत्र / सिद्धांत:", notes: "याद रखो:" };

  const prompt = `तुम Bihar Board Class 10 के ${subject} teacher हो। एक student पहली बार यह topic पढ़ रहा है — उसे clearly समझाओ।

Question: ${questionLine}

Options:
${optsList}

Correct Answer: ${correctAnswer}

${writingRule}

STRICT FORMATTING RULES — हर rule follow करो, कोई exception नहीं:
- कोई asterisk (*), star, hash (#) या dash (-) as bullet मत use करो
- कोई markdown bold, italic, heading मत use करो
- Plain text only
- हर point के लिए • symbol use करो (number नहीं)
- Math के लिए: inline $formula$, block $$formula$$ (LaTeX)
- सूत्र का नाम Hindi में लिखो
- Total length: 12-16 lines। Short और sharp।

इस EXACT structure में लिखो — यही sections, यही order:

${sectionLabels.answer}
[एक line में — यह जवाब सही क्यों है, simple words में]

${sectionLabels.solution}
• [यह question किस concept/topic पर है — एक line में सरलता से]
• [solve करने का तरीका या सूत्र — clearly बताओ]
• [step-by-step working दिखाओ — calculation या logic के साथ]
• [final result confirm करो और सही option बताओ]

${sectionLabels.formula}
[अगर formula है तो LaTeX में लिखो। सूत्र का नाम ${lang === "hi" ? "Hindi" : "English"} में लिखो। अगर formula नहीं है तो एक line में key definition या rule।]

${sectionLabels.notes}
• [इस topic की सबसे important बात जो हर student को याद रखनी चाहिए]
• [students यहाँ सबसे common गलती करते हैं — और उससे कैसे बचें]
• [एक sharp memory trick या quick shortcut इस type के questions के लिए]`;

  await streamGemini(res, prompt, "Explanation नहीं मिली। Please try again.", req.log);
});

export default router;
