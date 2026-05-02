import { Router } from "express";
import { z } from "zod";
import { streamGemini } from "../../lib/gemini";

const router = Router();

const ExplainBodySchema = z.object({
  questionEnglish: z.string().min(1),
  questionHindi: z.string().optional(),
  options: z.array(z.string()).min(2),
  correctAnswer: z.string().min(1),
  subject: z.string().min(1),
});

router.post("/explain", async (req, res) => {
  const parsed = ExplainBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { questionEnglish, questionHindi, options, correctAnswer, subject } = parsed.data;

  const optionsList = options
    .map((opt, i) => `${String.fromCharCode(65 + i)}. ${opt}`)
    .join("\n");

  const prompt = `Bihar Board ${subject} — इस question का structured explanation दो।

Question: ${questionEnglish}
${questionHindi ? `(Hindi: ${questionHindi})` : ""}
Options:
${optionsList}
Correct Answer: ${correctAnswer}

नीचे दिए format में **exactly** respond करो (यही sections, यही order):

✅ **सही जवाब:** ${correctAnswer}
[1 line में — यह option सही क्यों है, सीधे reason]

📐 **Formula / Theory:**
[सभी relevant formulas LaTeX में लिखो — inline math के लिए $formula$ और block display के लिए $$formula$$ use करो। अगर कोई formula न हो तो key definition/rule लिखो।]

💡 **Key Points:**
→ [Point 1 — सबसे important concept]
→ [Point 2 — दूसरा important point]
→ [Point 3 — exam में अक्सर पूछा जाता है यह angle]

🎯 **याद रखो:**
[एक line का memory trick / shortcut / mnemonic — जो exam में काम आए]

Rules:
- Hindi में लिखो, technical terms (formula names, English words) as-is रखो
- LaTeX properly लिखो: $x^2 + y^2 = z^2$, $$\\frac{a}{b} = c$$
- Emojis only section headers में
- Short and crisp रखो — total 8-10 lines से ज्यादा नहीं`;

  await streamGemini(res, prompt, "Explanation नहीं मिली 🙏", req.log);
});

export default router;
