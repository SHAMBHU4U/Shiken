import { Router } from "express";
import { z } from "zod";
import { AIRateLimitError, generateCachedText } from "../lib/ai-guard";

const router = Router();
const Eli16Body = z.object({
  query: z.string().min(1).max(4000),
  subject: z.string().max(80).optional(),
});

router.post("/eli16", async (req, res) => {
  const parsed = Eli16Body.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "query is required" });
    return;
  }

  const { query, subject } = parsed.data;
  const prompt = `Explain this to a Class 10 student in very simple language.
Use short sentences, one practical example, and no markdown.
Subject: ${subject ?? "general"}
Question: ${query}`;

  try {
    const { text } = await generateCachedText(req, prompt, "eli16", { query, subject }, { temperature: 0.2 });
    res.json({ result: text.trim() });
  } catch (err) {
    if (err instanceof AIRateLimitError) {
      res.status(429).json({ error: err.message });
      return;
    }
    req.log.error(err, "eli16 generation error");
    res.status(500).json({ error: "Simple explanation failed" });
  }
});

export default router;