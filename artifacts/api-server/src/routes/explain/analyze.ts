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
  classId: z.string().optional().default("10"),
});

router.post("/analyze-test", async (req, res) => {
  const parsed = AnalyzeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { subject, score, total, mode, chapter, wrong, classId } = parsed.data;
  const pct = Math.round((score / total) * 100);

  const isEntrance = classId === "entrance";
  const cls = classId === "12" ? "12" : isEntrance ? "" : "10";

  const wrongTopics = wrong.slice(0, 10)
    .map((w, i) => `${i + 1}. ${w.questionEnglish.slice(0, 80)}`)
    .join("\n");

  const context = mode === "full"
    ? `Full Test (${total} questions)`
    : mode === "chapter"
    ? `Chapter: ${chapter}`
    : `AI Practice: ${chapter}`;

  let examContext: string;
  let studyAdvice: string;

  if (isEntrance) {
    const examName = subject.toLowerCase().includes("biology") ? "NEET" : "JEE Main";
    examContext = `${examName} preparation mock test`;
    studyAdvice = `NCERT + ${examName === "NEET" ? "HC Verma/DC Pandey" : "HC Verma/RD Sharma"} reference books`;
  } else {
    examContext = `BSEB/CBSE Class ${cls} Board exam`;
    studyAdvice = `NCERT Class ${cls} ${subject} textbook`;
  }

  const prompt = `तुम एक sharp और honest ${examContext} के ${subject} teacher हो।

Result: ${score}/${total} (${pct}%) — ${context}
गलत: ${wrong.length} question${wrong.length !== 1 ? "s" : ""}

${wrong.length > 0 ? `गलत questions (topics):\n${wrongTopics}` : "सभी जवाब सही थे — शानदार प्रदर्शन!"}

Student को Hindi में personal feedback दो। Rules:
- कोई headings नहीं, कोई sections नहीं — बस natural paragraphs
- कोई asterisk (*), star, dash bullet, या hash (#) मत use करो — plain text only
- पहले score का honest evaluation (direct और clear)
- फिर weak topics/chapters identify करो — गलत questions के आधार पर (${studyAdvice} के specific chapters mention करो)
- फिर एक concrete, actionable study plan — कौन से topics revise करें और कैसे
- आखिर में एक motivational line जो ${isEntrance ? "entrance exam" : "board exam"} की तैयारी को focus करे
- Tone: strict but caring mentor — जो student की सफलता चाहता हो
- Total: 8-10 lines। हर line meaningful और impactful हो।`;

  await streamGemini(res, prompt, "Analysis में दिक्कत आई, फिर से try करो।", req.log);
});

export default router;
