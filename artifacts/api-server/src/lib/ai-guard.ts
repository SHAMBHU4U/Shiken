// @ts-nocheck
import crypto from "node:crypto";
import type { Request, Response } from "express";
import { genai, MODEL } from "./gemini";

const DATABASE_URL = (process.env.FIREBASE_DATABASE_URL || "https://shiken-d8789-default-rtdb.firebaseio.com").replace(/\/$/, "");
const MAX_OUTPUT_TOKENS = 1000;
const AI_HOURLY_LIMIT = 5;
const usage = new Map<string, { windowStarted: number; count: number }>();

export class AIRateLimitError extends Error {
  statusCode = 429;
  constructor() {
    super("AI generation limit reached. Please try again in about an hour.");
  }
}

export function cacheKey(operation: string, input: unknown): string {
  const digest = crypto.createHash("sha256")
    .update(JSON.stringify({ version: 1, operation, input }))
    .digest("hex");
  return `${operation.replace(/[^a-zA-Z0-9_-]/g, "_")}-${digest}`;
}

function requesterKey(req: Request): string {
  const userId = req.headers["x-user-id"];
  if (typeof userId === "string" && userId.trim()) return `user:${userId.trim().slice(0, 160)}`;
  const bodyUid = req.body?.uid;
  if (typeof bodyUid === "string" && bodyUid.trim()) return `user:${bodyUid.trim().slice(0, 160)}`;
  const forwarded = req.headers["x-forwarded-for"];
  return `ip:${typeof forwarded === "string" ? forwarded.split(",")[0].trim() : req.socket.remoteAddress ?? "unknown"}`;
}

export function checkAIRateLimit(req: Request): { allowed: boolean; remaining: number } {
  const key = requesterKey(req);
  const now = Date.now();
  const current = usage.get(key);
  if (!current || now - current.windowStarted >= 60 * 60 * 1000) {
    usage.set(key, { windowStarted: now, count: 1 });
    return { allowed: true, remaining: AI_HOURLY_LIMIT - 1 };
  }
  if (current.count >= AI_HOURLY_LIMIT) return { allowed: false, remaining: 0 };
  current.count += 1;
  return { allowed: true, remaining: AI_HOURLY_LIMIT - current.count };
}

function cacheUrl(key: string) {
  return `${DATABASE_URL}/ai_cache/${encodeURIComponent(key)}.json`;
}

export async function getCachedAI(key: string): Promise<string | null> {
  try {
    const response = await fetch(cacheUrl(key));
    if (!response.ok) return null;
    const value = await response.json() as { text?: unknown } | null;
    return typeof value?.text === "string" && value.text.length > 0 ? value.text : null;
  } catch {
    return null;
  }
}

export async function writeCachedAI(key: string, text: string, log?: { warn: (...args: any[]) => void }) {
  try {
    await fetch(cacheUrl(key), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, model: MODEL, createdAt: Date.now() }),
    });
  } catch (err) {
    log?.warn?.({ err, key }, "AI cache write failed");
  }
}

function guardedConfig(config: Record<string, unknown> = {}) {
  return {
    ...config,
    maxOutputTokens: Math.min(Number(config.maxOutputTokens) || MAX_OUTPUT_TOKENS, MAX_OUTPUT_TOKENS),
    thinkingConfig: { thinkingBudget: 0 },
  };
}

export async function generateCachedText(
  req: Request,
  prompt: string,
  operation: string,
  input: unknown,
  config: Record<string, unknown> = {},
  parts?: unknown[],
) {
  const key = cacheKey(operation, input ?? prompt);
  const cached = await getCachedAI(key);
  if (cached !== null) return { text: cached, cached: true, key };

  const rate = checkAIRateLimit(req);
  if (!rate.allowed) throw new AIRateLimitError();
  req.res?.setHeader("X-RateLimit-Remaining", String(rate.remaining));

  const response = await genai.models.generateContent({
    model: MODEL,
    contents: [{ role: "user", parts: parts ?? [{ text: prompt }] }],
    config: guardedConfig(config),
  });
  const text = response.text ?? "";
  void writeCachedAI(key, text, req.log);
  return { text, cached: false, key };
}

export async function streamCachedText(
  req: Request,
  res: Response,
  prompt: string,
  operation: string,
  input: unknown,
  onError: string,
  log: any,
  config: Record<string, unknown> = {},
) {
  const key = cacheKey(operation, input ?? prompt);
  const cached = await getCachedAI(key);
  if (cached !== null) {
    sseHeaders(res);
    res.write(`data: ${JSON.stringify({ content: cached, cached: true })}\n\n`);
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
    return;
  }

  const rate = checkAIRateLimit(req);
  if (!rate.allowed) {
    sseHeaders(res);
    res.statusCode = 429;
    res.write(`data: ${JSON.stringify({ error: new AIRateLimitError().message })}\n\n`);
    res.end();
    return;
  }
  res.setHeader("X-RateLimit-Remaining", String(rate.remaining));
  sseHeaders(res);
  try {
    const stream = await genai.models.generateContentStream({
      model: MODEL,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: guardedConfig(config),
    });
    let fullText = "";
    for await (const chunk of stream) {
      if (chunk.text) {
        fullText += chunk.text;
        res.write(`data: ${JSON.stringify({ content: chunk.text })}\n\n`);
      }
    }
    if (fullText) void writeCachedAI(key, fullText, log);
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  } catch (err) {
    log.error(err, "Gemini stream error");
    res.write(`data: ${JSON.stringify({ error: onError })}\n\n`);
  }
  res.end();
}

export function sseHeaders(res: Response) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");
}