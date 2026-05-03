/**
 * Usage: node extract-pages.mjs <startPage> <endPage> <outputFile>
 * e.g.:  node extract-pages.mjs 1 8 /tmp/eq_a.json
 */
import { readFileSync, writeFileSync } from 'fs';
import { GoogleGenAI } from '@google/genai';

const [,, startStr, endStr, outFile] = process.argv;
const startPage = parseInt(startStr, 10);
const endPage   = parseInt(endStr,   10);
const PAGES_DIR = '/tmp/eng_pages';
const BATCH_SIZE = 4;
const BATCH_DELAY_MS = 18000;

if (!outFile) { console.error('Missing args'); process.exit(1); }

const API_KEY = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey: API_KEY });
const sleep = ms => new Promise(r => setTimeout(r, ms));

const pad = n => String(n).padStart(2, '0');
const pageFiles = [];
for (let p = startPage; p <= endPage; p++) {
  pageFiles.push(`${PAGES_DIR}/page-${pad(p)}.jpg`);
}

const batches = [];
for (let i = 0; i < pageFiles.length; i += BATCH_SIZE) {
  batches.push(pageFiles.slice(i, i + BATCH_SIZE));
}
console.log(`Pages ${startPage}-${endPage} → ${batches.length} batch(es)`);

const PROMPT = `These are pages from a Bihar Board Class 10 English exam paper (2025).
Extract ALL multiple-choice questions visible in these pages.
Return a JSON array. Each object must have exactly these keys:
- "english": question text in English
- "hindi": Hindi translation of the question (use your knowledge if not printed)
- "options": exactly 4 answer strings (A,B,C,D text — no letter prefix)
- "optionsHindi": same 4 options in Hindi
- "answerIndex": integer 0-3 (0=A, 1=B, 2=C, 3=D). Use answer key if visible; else correct answer.
- "chapter": one of "Grammar","Comprehension","Vocabulary","Prose","Poetry","Writing Skills","Unseen Passage","General"

RULES: Return ONLY a raw JSON array (no markdown, no code fences). If no MCQ on these pages return [].
Skip essays, short-answer, fill-blank without choices. Each "options" must have exactly 4 strings.`;

const allQ = [];

for (let b = 0; b < batches.length; b++) {
  if (b > 0) { console.log(`  ⏳ ${BATCH_DELAY_MS/1000}s delay…`); await sleep(BATCH_DELAY_MS); }
  const pages = batches[b];
  const nums  = pages.map(p => p.match(/page-(\d+)/)?.[1]).join(', ');
  console.log(`Batch ${b+1}/${batches.length} — pages ${nums}…`);

  const imageParts = pages.map(p => ({ inlineData: { mimeType: 'image/jpeg', data: readFileSync(p).toString('base64') } }));

  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const resp = await ai.models.generateContent({
        model: 'gemini-2.5-flash-lite',
        contents: [{ role: 'user', parts: [...imageParts, { text: PROMPT }] }],
        config: { maxOutputTokens: 4096 },
      });
      const raw = (resp.text ?? '').trim();
      let parsed;
      try { parsed = JSON.parse(raw); }
      catch { const m = raw.match(/\[[\s\S]*\]/); parsed = m ? JSON.parse(m[0]) : []; }
      if (!Array.isArray(parsed)) parsed = [];
      console.log(`  ✅ ${parsed.length} questions`);
      allQ.push(...parsed);
      break;
    } catch (e) {
      if (String(e).includes('429') && attempt < 4) {
        const w = 35000 * attempt;
        console.log(`  ⏳ 429 — wait ${w/1000}s (attempt ${attempt}/4)`);
        await sleep(w);
      } else { console.log(`  ⚠️  failed: ${String(e).slice(0,100)}`); break; }
    }
  }
}

writeFileSync(outFile, JSON.stringify(allQ));
console.log(`Saved ${allQ.length} questions → ${outFile}`);
