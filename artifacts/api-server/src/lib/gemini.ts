// @ts-nocheck
import { GoogleGenAI } from "@google/genai";

// Prefer Replit AI Integration proxy (no daily cap, uses Replit credits).
// Falls back to direct GEMINI_API_KEY if proxy is not configured.
// Lazy initialisation — does NOT throw at import time so the server can start
// even if Gemini is not configured. Routes that need Gemini call getGenai().
function getGenai(): GoogleGenAI {
  const useProxy = !!process.env.AI_INTEGRATIONS_GEMINI_BASE_URL;
  const apiKey   = useProxy
    ? process.env.AI_INTEGRATIONS_GEMINI_API_KEY
    : process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("No Gemini API key found. Set GEMINI_API_KEY or provision the AI integration.");
  }

  return new GoogleGenAI(
    useProxy
      ? { apiKey, httpOptions: { apiVersion: "", baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL } }
      : { apiKey }
  );
}

// Keep a module-level accessor that callers can import as before
export const genai = new Proxy({} as GoogleGenAI, {
  get(_target, prop) {
    return (getGenai() as any)[prop];
  },
});

export const MODEL = "gemini-2.5-flash";

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
      model: MODEL,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { maxOutputTokens: 1000, thinkingConfig: { thinkingBudget: 0 } },
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
