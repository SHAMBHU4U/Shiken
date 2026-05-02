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

  const prompt = `Bihar Board ${subject} — एक question का crisp explanation दो।

Question: ${questionEnglish}
${questionHindi ? `(Hindi: ${questionHindi})` : ""}
Options:
${optionsList}
Correct Answer: ${correctAnswer}

3-4 lines में Hindi में explain करो:
1. सही जवाब क्यों सही है (1-2 lines, key reason/formula)
2. एक simple trick या याद रखने का तरीका
Emojis थोड़े use करो। बहुत short और to-the-point रखो।`;

  await streamGemini(res, prompt, "Explanation में दिक्कत आई 🙏", req.log);
});

export default router;
