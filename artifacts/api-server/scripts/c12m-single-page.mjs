/**
 * Process pages ONE AT A TIME for reliable extraction.
 * Usage: node c12m-single-page.mjs <startPage> <endPage> <outFile>
 */

import { readFileSync, writeFileSync } from 'fs';
import { GoogleGenAI } from '@google/genai';

const [,, startStr, endStr, outFile] = process.argv;
const startPage = parseInt(startStr, 10);
const endPage   = parseInt(endStr, 10);
const PAGES_DIR = '/tmp/c12maths_pages';

if (!outFile || isNaN(startPage) || isNaN(endPage)) {
  console.error('Usage: node c12m-single-page.mjs <startPage> <endPage> <outFile>');
  process.exit(1);
}

const BASE_URL = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL;
const API_KEY  = BASE_URL
  ? process.env.AI_INTEGRATIONS_GEMINI_API_KEY
  : (process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY);

if (!API_KEY) { console.error('No Gemini API key'); process.exit(1); }

const ai = BASE_URL
  ? new GoogleGenAI({ apiKey: API_KEY, httpOptions: { apiVersion: '', baseUrl: BASE_URL } })
  : new GoogleGenAI({ apiKey: API_KEY });

const sleep = ms => new Promise(r => setTimeout(r, ms));
const pad = n => String(n).padStart(2, '0');

const PROMPT = `This is a page from Bihar Board Class 12 Mathematics Annual Examination 2026 (Set-E).

Extract ALL multiple-choice questions on this page.

Return a JSON array. Each object must have EXACTLY these keys:
{
  "question_english": "question text in English (translate from Hindi if needed; include all math formulas)",
  "question_hindi": "question text in Hindi (as printed or transliterated)",
  "options": {"A":"...","B":"...","C":"...","D":"..."},
  "options_hindi": {"A":"...","B":"...","C":"...","D":"..."},
  "correct_answer": "A",
  "explanation_english": "step-by-step solution in English (2-4 sentences, show the math)",
  "explanation_hindi": "same explanation in Hindi (2-4 sentences)",
  "chapter": "Relations and Functions"
}

chapter must be one of: Relations and Functions, Inverse Trigonometric Functions, Matrices, Determinants, Continuity and Differentiability, Application of Derivatives, Integration, Application of Integrals, Differential Equations, Vector Algebra, Three Dimensional Geometry, Linear Programming, Probability, Complex Numbers, General

RULES:
- Return ONLY a raw JSON array. No markdown, no explanation text outside the array.
- If page has no MCQs, return [].
- correct_answer must be exactly: A, B, C, or D (uppercase, no period).
- Use $LaTeX$ for math formulas.
- Keep JSON compact to avoid truncation.`;

async function extractOnePage(pageNum, retries = 3) {
  const path = `${PAGES_DIR}/page-${pad(pageNum)}.jpg`;
  let data;
  try { data = readFileSync(path).toString('base64'); }
  catch { console.log(`  pg${pad(pageNum)}: file not found`); return []; }

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const stream = await ai.models.generateContentStream({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [
          { inlineData: { mimeType: 'image/jpeg', data } },
          { text: PROMPT },
        ]}],
        config: { maxOutputTokens: 4096 },
      });
      let raw = '';
      for await (const chunk of stream) { if (chunk.text) raw += chunk.text; }
      raw = raw.trim();

      // Try to extract a JSON array from the response
      let parsed = [];
      try { parsed = JSON.parse(raw); }
      catch {
        // find innermost complete array
        const start = raw.indexOf('[');
        const end   = raw.lastIndexOf(']');
        if (start !== -1 && end !== -1 && end > start) {
          try { parsed = JSON.parse(raw.slice(start, end + 1)); }
          catch {
            // Try to recover partial JSON by taking complete objects
            const objMatches = raw.matchAll(/\{[^{}]*"correct_answer"[^{}]*\}/g);
            const objs = [];
            for (const m of objMatches) {
              try { objs.push(JSON.parse(m[0])); } catch {}
            }
            parsed = objs;
          }
        }
      }
      if (!Array.isArray(parsed)) parsed = [];
      return parsed;
    } catch (err) {
      const isRate = /429|quota|Resource/i.test(String(err));
      if (attempt < retries) {
        const wait = isRate ? 20000 : 5000;
        await sleep(wait);
      } else {
        console.log(`  pg${pad(pageNum)}: FAILED — ${String(err).slice(0, 80)}`);
        return [];
      }
    }
  }
  return [];
}

const allRaw = [];
console.log(`Processing pages ${startPage}–${endPage} → ${outFile}`);

for (let p = startPage; p <= endPage; p++) {
  if (p > startPage) await sleep(2000); // small cooldown between pages
  const qs = await extractOnePage(p);
  process.stdout.write(`  pg${pad(p)}: ${qs.length} questions\n`);
  allRaw.push(...qs);
}

console.log(`\nTotal: ${allRaw.length} raw questions from pages ${startPage}-${endPage}`);
writeFileSync(outFile, JSON.stringify(allRaw, null, 2));
console.log(`Saved → ${outFile}`);
