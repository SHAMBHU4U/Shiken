import { Router } from "express";
import { z } from "zod";
import { ai } from "@workspace/integrations-gemini-ai";

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

  const prompt = `तुम एक दोस्त हो जो Bihar Board के ${subject} subject का expert है। एक student ने यह question पूछा है।

**Question (English):** ${questionEnglish}
${questionHindi ? `**Question (Hindi):** ${questionHindi}` : ""}

**Options:**
${optionsList}

**Correct Answer:** ${correctAnswer}

अब इस question को इस student को बिल्कुल आसान Hindi में समझाओ जैसे कोई दोस्त समझाता है। इन बातों का ध्यान रखो:
- पहले सही जवाब बताओ और क्यों सही है यह explain करो
- बाकी options क्यों गलत हैं यह भी बताओ
- कोई real life example दो अगर हो सके
- Bihar Board exam के लिए कोई tip दो
- Language बिल्कुल simple और friendly रखो - जैसे WhatsApp पर बात करते हो
- Emojis use करो थोड़े बहुत

जवाब Hindi में दो (थोड़े English words चलेंगे जो normally use होते हैं जैसे formula, concept etc.)`;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");

  try {
    const stream = await ai.models.generateContentStream({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { maxOutputTokens: 8192 },
    });

    for await (const chunk of stream) {
      const text = chunk.text;
      if (text) {
        res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
      }
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  } catch (err) {
    req.log.error(err, "Gemini explain error");
    res.write(`data: ${JSON.stringify({ error: "समझाने में दिक्कत आई, फिर से कोशिश करो 🙏" })}\n\n`);
  }

  res.end();
});

export default router;
