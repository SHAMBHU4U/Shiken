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

  const wrongList = wrong.slice(0, 15)
    .map((w, i) => `${i + 1}. Q: ${w.questionEnglish}\n   Correct: ${w.correctAnswer}${w.userAnswer ? `\n   Your answer: ${w.userAnswer}` : ""}`)
    .join("\n\n");

  const prompt = `तुम Bihar Board के एक expert teacher और mentor हो। एक student ने अभी ${subject} का test दिया है।

📊 **Test Result:**
- Subject: ${subject}
- Mode: ${mode === "full" ? "Full Length Test (50 questions)" : mode === "chapter" ? `Chapter Test: ${chapter}` : `AI Practice: ${chapter}`}
- Score: ${score} / ${total} (${pct}%)
- Wrong answers: ${wrong.length}

${wrong.length > 0 ? `❌ **Questions जो गलत हुईं:**\n${wrongList}` : ""}

अब इस student को एकदम detailed और personalized analysis दो Hindi में। इन sections में लिखो:

🎯 **Performance Summary** - score का मतलब क्या है, कहाँ खड़े हो तुम
💪 **Strong Points** - क्या अच्छा किया
⚠️ **Weak Areas** - किन topics पर ध्यान देना है (wrong questions देखकर)
📚 **Study Plan** - अगले 1 हफ्ते के लिए specific tips और strategy
🏆 **Bihar Board Exam Tips** - exam में इस subject के लिए खास सलाह
✨ **Motivational Message** - एक encouraging message Hindi में

Language casual और friendly रखो जैसे एक अच्छा दोस्त/mentor बात करता है। Emojis use करो। WhatsApp जैसी simple Hindi लिखो।`;

  await streamGemini(res, prompt, "Analysis में दिक्कत आई, फिर से try करो 🙏", req.log);
});

export default router;
