// @ts-nocheck
import { Router } from "express";
import { z } from "zod";
import { streamCachedText } from "../../lib/ai-guard";

const router = Router();

const ExplainBodySchema = z.object({
  questionEnglish: z.string().min(1),
  questionHindi:   z.string().optional(),
  options:         z.array(z.string()).min(2),
  optionsHindi:    z.array(z.string()).optional(),
  correctAnswer:   z.string().min(1),
  subject:         z.string().min(1),
  lang:            z.enum(["en", "hi"]).default("hi"),
  classId:         z.string().optional().default("10"),
});

router.post("/explain", async (req, res) => {
  const parsed = ExplainBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { questionEnglish, questionHindi, options, optionsHindi, correctAnswer, subject, lang, classId } = parsed.data;

  const isEntrance = classId === "entrance";
  const cls = classId === "12" ? "12" : isEntrance ? "" : "10";
  const isNEET = isEntrance && subject.toLowerCase().includes("biology");
  const isJEE  = isEntrance && !isNEET;

  const optsList = options
    .map((opt, i) => {
      const h = optionsHindi?.[i];
      if (lang === "en") return `${String.fromCharCode(65 + i)}. ${opt}`;
      return h ? `${String.fromCharCode(65 + i)}. ${h}` : `${String.fromCharCode(65 + i)}. ${opt}`;
    })
    .join("\n");

  const questionLine = lang === "en" ? questionEnglish : (questionHindi || questionEnglish);

  const writingRule = lang === "en"
    ? "Write ENTIRELY in simple English. Short sentences. Beginner-friendly."
    : "पूरा जवाब Hindi (Devanagari) में लिखो। English सिर्फ formulas, numbers, technical terms, और NCERT chapter names के लिए। सरल आम Hindi use करो।";

  let prompt: string;

  if (isEntrance) {
    const examName = isNEET ? "NEET" : "JEE Main";
    const answerLabel = lang === "en" ? `Correct Answer: ${correctAnswer}` : `सही जवाब: ${correctAnswer}`;
    const solutionLabel = lang === "en" ? "Step-by-Step Solution:" : "हल:";
    const formulaLabel  = lang === "en" ? "Key Formula / Concept:" : "मुख्य सूत्र / अवधारणा:";
    const rememberLabel = lang === "en" ? "Points to Remember:" : "याद रखो (Extra Points):";

    prompt = `You are a top ${examName} faculty. Explain this ${subject} question to a student preparing for ${examName}.

Question: ${questionLine}

Options:
${optsList}

${answerLabel}

${writingRule}

STRICT FORMATTING:
- No asterisk (*), hash (#), or dash (-) as bullet — use • only
- No markdown bold/italic/heading — plain text only
- Math: inline $formula$, display $$formula$$ (LaTeX/KaTeX)
- Total: 14-18 lines — sharp, exam-focused, not a textbook

Write in this EXACT structure:

${answerLabel}
[One line — why this option is correct, exam-focused]

${solutionLabel}
• [Identify the concept/law/formula this question tests — name it clearly]
• [Apply the formula or logic — show calculation or reasoning step by step]
• [Show all key steps — intermediate results if numerical]
• [Confirm the final answer matches option ${correctAnswer}]

${formulaLabel}
[LaTeX formula if applicable. Name the law/formula. If no formula, give the key NCERT statement/definition.]

${rememberLabel}
• [Most important exam fact about this topic — tested frequently in ${examName}]
• [Common mistake students make and how to avoid it]
• [Quick trick or mnemonic for this type of ${examName} question]
• [High-yield related concept that often appears alongside in ${examName}]`;
  } else {
    const boardCtx = `BSEB/CBSE Class ${cls} ${subject}`;
    const ncertRef  = `NCERT Class ${cls} ${subject}`;
    const answerLabel = lang === "en" ? `Correct Answer: ${correctAnswer}` : `सही जवाब: ${correctAnswer}`;
    const solutionLabel = lang === "en" ? "Solution:" : "हल:";
    const ncertLabel    = lang === "en" ? `NCERT Concept (${ncertRef}):` : `NCERT अवधारणा (${ncertRef}):`;
    const rememberLabel = lang === "en" ? "Remember:" : "याद रखो:";

    prompt = `तुम ${boardCtx} के expert teacher हो। Explanation strictly NCERT Class ${cls} ${subject} textbook content पर आधारित होनी चाहिए।

Question: ${questionLine}

Options:
${optsList}

${answerLabel}

${writingRule}

STRICT FORMATTING — हर rule follow करो:
- कोई asterisk (*), star, hash (#) या dash (-) as bullet मत use करो — सिर्फ • use करो
- कोई markdown bold, italic, heading मत use करो — plain text only
- Math: inline $formula$, block $$formula$$ (LaTeX/KaTeX)
- NCERT chapter name mention करो जहाँ relevant हो
- Total: 12-16 lines। Short, clear, exam-focused।

इस EXACT structure में लिखो:

${answerLabel}
[एक line — यह जवाब सही क्यों है, NCERT concept से connect करो]

${solutionLabel}
• [NCERT Class ${cls} का कौन सा chapter/topic यह question cover करता है — clearly बताओ]
• [NCERT textbook की definition, formula, या key statement जो इस question को solve करती है]
• [Step-by-step working — calculation या logic clearly दिखाओ]
• [Final answer confirm करो — सही option बताओ और क्यों बाकी options wrong हैं]

${ncertLabel}
[Relevant formula LaTeX में, या NCERT की exact key definition/rule। Chapter name mention करो।]

${rememberLabel}
• [इस NCERT topic की सबसे important बात जो Board exam में बार-बार आती है]
• [Students यहाँ सबसे common गलती करते हैं — और उससे कैसे बचें]
• [एक sharp memory trick जो Board exam में काम आएगी]`;
  }

  await streamCachedText(
    req,
    res,
    prompt,
    "explain",
    { questionEnglish, questionHindi, options, optionsHindi, correctAnswer, subject, lang, classId },
    "Explanation नहीं मिली। Please try again.",
    req.log,
  );
});

export default router;
