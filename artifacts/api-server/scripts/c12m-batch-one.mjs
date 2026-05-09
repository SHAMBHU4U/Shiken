/**
 * Process a single batch range of pages and append to a JSON lines file.
 * Usage: node c12m-batch-one.mjs <startPage> <endPage> <outFile>
 * e.g.:  node c12m-batch-one.mjs 1 8 /tmp/c12m_part_a.json
 */

import { readFileSync, writeFileSync } from 'fs';
import { GoogleGenAI } from '@google/genai';

const [,, startStr, endStr, outFile] = process.argv;
const startPage = parseInt(startStr, 10);
const endPage   = parseInt(endStr, 10);
const PAGES_DIR = '/tmp/c12maths_pages';
const BATCH_SIZE = 4;
const BATCH_DELAY_MS = 5000;

if (!outFile || isNaN(startPage) || isNaN(endPage)) {
  console.error('Usage: node c12m-batch-one.mjs <startPage> <endPage> <outFile>');
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

async function streamToText(request) {
  const stream = await ai.models.generateContentStream(request);
  let out = '';
  for await (const chunk of stream) { if (chunk.text) out += chunk.text; }
  return out.trim();
}

const pad = n => String(n).padStart(2, '0');
const pageFiles = [];
for (let p = startPage; p <= endPage; p++) {
  pageFiles.push(`${PAGES_DIR}/page-${pad(p)}.jpg`);
}

const batches = [];
for (let i = 0; i < pageFiles.length; i += BATCH_SIZE) {
  batches.push(pageFiles.slice(i, i + BATCH_SIZE));
}
console.log(`Pages ${startPage}-${endPage} → ${batches.length} batch(es) → ${outFile}`);

const PROMPT = `These are pages from Bihar Board Class 12 Mathematics Annual Examination 2026 (Set-E).

Extract ALL multiple-choice / objective questions visible on these pages.

Return a JSON array. Each element must have EXACTLY these fields:
- "question_english": full question text in English (translate from Hindi; include all math)
- "question_hindi": full question text in Hindi (as printed or translated)
- "options": object with keys "A","B","C","D" — option text in English
- "options_hindi": same with option texts in Hindi
- "correct_answer": single uppercase letter "A", "B", "C", or "D" — use math knowledge
- "explanation_english": concise step-by-step solution in English (2-5 sentences, show calculation)
- "explanation_hindi": same explanation in Hindi (2-5 sentences)
- "chapter": one of ["Relations and Functions","Inverse Trigonometric Functions","Matrices","Determinants","Continuity and Differentiability","Application of Derivatives","Integration","Application of Integrals","Differential Equations","Vector Algebra","Three Dimensional Geometry","Linear Programming","Probability","Complex Numbers","General"]

STRICT RULES:
- Return ONLY a JSON array — no markdown fences, no explanation outside the array.
- If no MCQs on these pages, return [].
- Skip essays, long-answer, fill-in-blank without options.
- Every "options" object must have exactly 4 keys: A, B, C, D.
- correct_answer must be exactly one of: A B C D.
- Use $LaTeX$ notation for math expressions.`;

const allRaw = [];

for (let b = 0; b < batches.length; b++) {
  if (b > 0) { await sleep(BATCH_DELAY_MS); }
  const pages = batches[b];
  const nums = pages.map(p => p.match(/page-(\d+)/)?.[1]).join(',');
  process.stdout.write(`  Batch pages ${nums}… `);

  const imageParts = pages
    .filter(p => { try { readFileSync(p); return true; } catch { return false; } })
    .map(p => ({ inlineData: { mimeType: 'image/jpeg', data: readFileSync(p).toString('base64') } }));

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const raw = await streamToText({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [...imageParts, { text: PROMPT }] }],
        config: { maxOutputTokens: 8192 },
      });

      let parsed = [];
      try { parsed = JSON.parse(raw); }
      catch {
        const match = raw.match(/\[[\s\S]*?\]/s);
        if (match) { try { parsed = JSON.parse(match[0]); } catch {} }
      }
      if (!Array.isArray(parsed)) parsed = [];
      console.log(`${parsed.length} questions`);
      allRaw.push(...parsed);
      break;
    } catch (err) {
      const isRate = /429|quota|Resource/i.test(String(err));
      if (attempt < 3) {
        const wait = isRate ? 30000 : 8000;
        console.log(`\n    retry ${attempt+1} in ${wait/1000}s (${String(err).slice(0,80)})`);
        await sleep(wait);
      } else {
        console.log(`\n    FAILED: ${String(err).slice(0, 100)}`);
      }
    }
  }
}

console.log(`Total from pages ${startPage}-${endPage}: ${allRaw.length} raw questions`);
writeFileSync(outFile, JSON.stringify(allRaw, null, 2));
console.log(`Saved → ${outFile}`);
