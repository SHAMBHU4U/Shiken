import { Router } from "express";
import { z } from "zod";
import { genai } from "../lib/gemini";

const router = Router();

const ComprehensionBody = z.object({
  count: z.number().int().min(3).max(10).default(7),
  subject: z.enum(["english", "hindi", "sanskrit"]).default("english"),
});

router.post("/generate-comprehension", async (req, res) => {
  const parsed = ComprehensionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { count, subject } = parsed.data;
  let prompt: string;

  if (subject === "hindi") {
    const topics = [
      "पर्यावरण की रक्षा और पेड़-पौधों का महत्त्व",
      "जल संरक्षण की आवश्यकता",
      "किसी महान भारतीय नेता या वैज्ञानिक का जीवन परिचय",
      "शिक्षा का महत्त्व और राष्ट्र-निर्माण",
      "स्वास्थ्य और स्वच्छता का जीवन में महत्त्व",
    ];
    const topic = topics[Math.floor(Math.random() * topics.length)];
    prompt = `आप बिहार बोर्ड कक्षा 10 हिंदी परीक्षा के विशेषज्ञ हैं।
विषय "${topic}" पर एक अपठित गद्यांश बनाइए जिसमें EXACTLY ${count} बहुविकल्पीय प्रश्न हों।

गद्यांश की आवश्यकताएँ:
- 180-220 शब्द
- सरल और शुद्ध हिंदी, कक्षा 10 स्तर
- Bihar Board BSEB परीक्षा-शैली

प्रश्नों की आवश्यकताएँ:
- सभी प्रश्न केवल गद्यांश पर आधारित हों
- तथ्यात्मक, भावार्थ, शीर्षक और शब्द-अर्थ के प्रश्नों का मिश्रण
- प्रत्येक प्रश्न में 4 विकल्प, एक सही उत्तर

Return ONLY this JSON (no markdown, no explanation):
{"title":"...","passage":"पूरा गद्यांश...","questions":[{"english":"Hindi question in Devanagari?","hindi":"Same question in Devanagari?","options":["A","B","C","D"],"optionsHindi":["A","B","C","D"],"answerIndex":0}]}`;
  } else if (subject === "sanskrit") {
    const topics = [
      "सत्यस्य महत्त्वम्", "विद्यायाः महत्त्वम्", "प्रकृतिः एव माता",
      "परिश्रमस्य फलम्", "मातृभूमिः स्वर्गादपि गरीयसी",
    ];
    const topic = topics[Math.floor(Math.random() * topics.length)];
    prompt = `You are a Bihar Board Class 10 Sanskrit exam expert.
Create ONE unseen Sanskrit गद्यांश (prose passage) on: "${topic}"
With EXACTLY ${count} MCQ questions based strictly on the passage.

Passage requirements:
- 150-200 words in simple Sanskrit (easy Class 10 BSEB level)
- Use simple Sanskrit vocabulary suitable for Bihar Board students

Question requirements:
- Strictly passage-based
- Mix of: factual recall, word meaning (शब्दार्थ), grammatical identification, title/theme
- Each has exactly 4 options, one correct answer
- Write questions and options primarily in Hindi (Devanagari) for accessibility

Return ONLY this JSON (no markdown, no explanation):
{"title":"...","passage":"Full Sanskrit passage in Devanagari...","questions":[{"english":"Question in Hindi Devanagari?","hindi":"Same question in Hindi Devanagari?","options":["A","B","C","D"],"optionsHindi":["A","B","C","D"],"answerIndex":0}]}`;
  } else {
    const topics = [
      "the importance of trees and forests", "water conservation and saving water",
      "the life of a great Indian leader or scientist",
      "the importance of education for progress",
      "environmental pollution and its effects",
    ];
    const topic = topics[Math.floor(Math.random() * topics.length)];
    prompt = `You are a Bihar Board Class 10 English exam expert.
Create ONE unseen comprehension passage on: "${topic}"
With EXACTLY ${count} MCQ questions strictly based on the passage.

Passage requirements:
- 180-240 words
- Class 10 level formal English
- Clear and informative

Question requirements:
- Strictly passage-based (no general knowledge)
- Mix of: factual recall, inference, vocabulary in context, title identification
- Each has exactly 4 options, one correct answer

Return ONLY this JSON (no markdown, no explanation):
{"title":"...","passage":"Full passage text...","questions":[{"english":"Q?","hindi":"हिंदी प्रश्न?","options":["A","B","C","D"],"optionsHindi":["A","B","C","D"],"answerIndex":0}]}`;
  }

  try {
    const response = await genai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { maxOutputTokens: 4096 },
    });

    const raw = (response.text ?? "").trim();
    let parsed: Record<string, unknown>;
    try { parsed = JSON.parse(raw); }
    catch { const m = raw.match(/\{[\s\S]*\}/); parsed = m ? JSON.parse(m[0]) : {}; }

    const isHindiLike = subject === "hindi" || subject === "sanskrit";
    const questions = Array.isArray(parsed.questions)
      ? (parsed.questions as Record<string, unknown>[])
          .map((q) => ({
            english:      String(q.english      ?? ""),
            hindi:        String(q.hindi        ?? ""),
            options:      Array.isArray(q.options)      ? (q.options as unknown[]).map(String).slice(0, 4) : [],
            optionsHindi: Array.isArray(q.optionsHindi) ? (q.optionsHindi as unknown[]).map(String).slice(0, 4) : [],
            answerIndex:  typeof q.answerIndex === "number" ? q.answerIndex : 0,
          }))
          .filter((q) => (isHindiLike ? (q.english || q.hindi) : q.english) && q.options.length >= 2)
      : [];

    if (questions.length === 0) {
      res.status(500).json({ error: "No questions generated" });
      return;
    }

    res.json({
      title:     String(parsed.title   ?? "Comprehension"),
      passage:   String(parsed.passage ?? ""),
      questions,
    });
  } catch (err) {
    req.log.error(err, "Comprehension generation error");
    res.status(500).json({ error: "Comprehension generation failed" });
  }
});

export default router;
