import { GoogleGenAI } from "@google/genai";

if (!process.env.GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY env var must be set.");
}

export const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export function sseHeaders(res: import("express").Response) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");
}

export async function streamGemini(
  res: import("express").Response,
  prompt: string,
  onError: string,
  log: import("pino").Logger
) {
  sseHeaders(res);
  try {
    const stream = await genai.models.generateContentStream({
      model: "gemini-1.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { maxOutputTokens: 8192 },
    });
    for await (const chunk of stream) {
      if (chunk.text) res.write(`data: ${JSON.stringify({ content: chunk.text })}\n\n`);
    }
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  } catch (err) {
    log.error(err, "Gemini stream error");
    res.write(`data: ${JSON.stringify({ error: onError })}\n\n`);
  }
  res.end();
}
