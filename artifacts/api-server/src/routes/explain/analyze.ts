import { Router } from "express";
import { z } from "zod";
import { streamGemini } from "../../lib/gemini";

const router = Router();

const WrongItem = z.object({
  questionEnglish: z.string(),
  correctAnswer: z.string(),
  userAnswer: z.string().optional(),
});

const AnalyzeBody = z.object({
  subject: z.string().min(1),
  score: z.number().int().min(0),
  total: z.number().int().min(1),
  mode: z.enum(["full", "chapter", "ai"]),
  chapter: z.string().optional(),
  wrong: z.array(WrongItem).max(50),
});

router.post("/analyze-test", async (req, res) => {
  const parsed = AnalyzeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { subject, score, total, mode, chapter, wrong } = parsed.data;
  const pct = Math.round((score / total) * 100);

  const wrongTopics = wrong.slice(0, 10)
    .map((w, i) => `${i + 1}. ${w.questionEnglish.slice(0, 80)}`)
    .join("\n");

  const context = mode === "full"
    ? `Full Test (${total} questions)`
    : mode === "chapter"
    ? `Chapter: ${chapter}`
    : `AI Practice: ${chapter}`;

  const prompt = `तुम एक sharp और honest Board Class 10 ${subject} teacher हो। Student का result देखकर 8-10 lines में सीधी बात करो।

Result: ${score}/${total} (${pct}%) — ${context}
गलत: ${wrong.length} question${wrong.length !== 1 ? "s" : ""}

${wrong.length > 0 ? `गलत questions:\n${wrongTopics}` : "सभी जवाब सही थे!"}

अब इस student को Hindi में feedback दो। Rules:
- कोई headings नहीं, कोई sections नहीं — बस natural paragraphs
- कोई asterisk (*), star, dash bullet, या hash (#) मत use करो — plain text only
- पहले score का honest evaluation (8-10 words में sharp)
- फिर weak areas identify करो — गलत questions देखकर
- फिर एक specific, actionable study tip
- आखिर में एक motivational line जो दिल को छुए
- Tone: strict but caring teacher — जैसे कोई अच्छा mentor बात करता हो
- Total: 8-10 lines। हर line impactful हो।`;

  await streamGemini(res, prompt, "Analysis में दिक्कत आई, फिर से try करो।", req.log);
});

export default router;
