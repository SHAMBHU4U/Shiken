/**
 * Bihar Board Class 12 Maths 2026 (Set-E) — Page-image batch importer
 *
 * Reads JPEG pages from /tmp/c12maths_pages/
 * Sends batches of 4 pages to Gemini (streaming) for MCQ extraction
 * Deletes ALL existing /class12/maths questions in Firebase
 * Uploads new questions to /class12/maths (separate from Class 10 /maths)
 *
 * Run: node artifacts/api-server/scripts/class12-maths-batch.mjs
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { GoogleGenAI } from '@google/genai';

const DB_URL    = 'https://shiken-d8789-default-rtdb.firebaseio.com';
const PAGES_DIR = '/tmp/c12maths_pages';
const BATCH_SIZE = 4;
const BATCH_DELAY_MS = 6000;

const BASE_URL = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL;
const API_KEY  = BASE_URL
  ? process.env.AI_INTEGRATIONS_GEMINI_API_KEY
  : (process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY);

if (!API_KEY) { console.error('No Gemini API key'); process.exit(1); }

const ai = BASE_URL
  ? new GoogleGenAI({ apiKey: API_KEY, httpOptions: { apiVersion: '', baseUrl: BASE_URL } })
  : new GoogleGenAI({ apiKey: API_KEY });

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ── Helper: collect streamed text ─────────────────────────────────────────────
async function streamToText(request) {
  const stream = await ai.models.generateContentStream(request);
  let out = '';
  for await (const chunk of stream) { if (chunk.text) out += chunk.text; }
  return out.trim();
}

// ── Load all page images ──────────────────────────────────────────────────────
const pageFiles = readdirSync(PAGES_DIR)
  .filter(f => f.endsWith('.jpg'))
  .sort()
  .map(f => `${PAGES_DIR}/${f}`);

console.log(`📄 ${pageFiles.length} page images found in ${PAGES_DIR}`);

const batches = [];
for (let i = 0; i < pageFiles.length; i += BATCH_SIZE) {
  batches.push(pageFiles.slice(i, i + BATCH_SIZE));
}
console.log(`   → ${batches.length} batches of ≤${BATCH_SIZE} pages\n`);

const PROMPT = `These are pages from Bihar Board Class 12 Mathematics Annual Examination 2026 (Set-E).

Extract ALL multiple-choice / objective questions visible on these pages.

Return a JSON array. Each element must have EXACTLY these fields:
- "question_english": full question text in English (translate from Hindi; include all math symbols/formulas)
- "question_hindi": full question text in Hindi (as printed; or Hindi translation if original is English)
- "options": object with keys "A","B","C","D" — each value is the option text in English
- "options_hindi": same object with option texts in Hindi
- "correct_answer": one uppercase letter "A", "B", "C", or "D" — use math knowledge for correct answer
- "explanation_english": concise step-by-step solution in English (show key calculation steps, 2-5 sentences)
- "explanation_hindi": same explanation in Hindi (2-5 sentences)
- "chapter": one of ["Relations and Functions","Inverse Trigonometric Functions","Matrices","Determinants","Continuity and Differentiability","Application of Derivatives","Integration","Application of Integrals","Differential Equations","Vector Algebra","Three Dimensional Geometry","Linear Programming","Probability","Complex Numbers","General"]

STRICT RULES:
- Return ONLY a JSON array — no markdown fences, no explanation text outside the array.
- If no MCQ questions on these pages, return [].
- Skip essays, long-answer, fill-in-blank without options.
- Every "options" object must have exactly 4 keys: A, B, C, D.
- correct_answer must be exactly one of: A B C D (single uppercase letter).
- For math: use plain text or $LaTeX$ inline notation.`;

// ── Extract MCQs from one batch ───────────────────────────────────────────────
async function extractBatch(pages, batchNum, retries = 3) {
  const nums = pages.map(p => p.match(/page-(\d+)/)?.[1]).join(', ');
  process.stdout.write(`🤖 Batch ${batchNum}/${batches.length} — pages ${nums}… `);

  const imageParts = pages.map(p => ({
    inlineData: { mimeType: 'image/jpeg', data: readFileSync(p).toString('base64') },
  }));

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const raw = await streamToText({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [...imageParts, { text: PROMPT }] }],
        config: { maxOutputTokens: 8192 },
      });

      let parsed;
      try { parsed = JSON.parse(raw); }
      catch {
        // Try to extract JSON array from response
        const match = raw.match(/\[[\s\S]*\]/);
        parsed = match ? JSON.parse(match[0]) : [];
      }
      if (!Array.isArray(parsed)) parsed = [];
      console.log(`✅ ${parsed.length} questions`);
      return parsed;
    } catch (err) {
      const isRateLimit = /429|Resource|quota/i.test(String(err));
      if (attempt < retries) {
        const wait = isRateLimit ? 30000 * attempt : 10000 * attempt;
        console.log(`\n   ⏳ Attempt ${attempt} failed — waiting ${wait / 1000}s… (${String(err).slice(0, 80)})`);
        await sleep(wait);
      } else {
        console.log(`\n   ⚠️  Batch ${batchNum} failed: ${String(err).slice(0, 120)}`);
        return [];
      }
    }
  }
  return [];
}

// ── Process all batches ───────────────────────────────────────────────────────
const allRaw = [];
for (let i = 0; i < batches.length; i++) {
  if (i > 0) {
    process.stdout.write(`   ⏳ ${BATCH_DELAY_MS / 1000}s cooldown… `);
    await sleep(BATCH_DELAY_MS);
    console.log('done');
  }
  const qs = await extractBatch(batches[i], i + 1);
  allRaw.push(...qs);
}

console.log(`\n📊 Total raw questions collected: ${allRaw.length}`);

// ── Normalise + deduplicate ───────────────────────────────────────────────────
const VALID = new Set(['A', 'B', 'C', 'D']);
const seen  = new Set();

const cleaned = allRaw
  .filter(q => (q.question_english || q.question_hindi))
  .filter(q => {
    const key = String(q.question_english || q.question_hindi).trim().slice(0, 70).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  })
  .filter(q => VALID.has(String(q.correct_answer ?? '').toUpperCase()))
  .map(q => {
    const optE = q.options || {};
    const optH = q.options_hindi || {};
    return {
      question_english:   String(q.question_english ?? q.question_hindi ?? '').trim(),
      question_hindi:     String(q.question_hindi   ?? q.question_english ?? '').trim(),
      options: {
        A: String(optE.A ?? '').trim(),
        B: String(optE.B ?? '').trim(),
        C: String(optE.C ?? '').trim(),
        D: String(optE.D ?? '').trim(),
      },
      options_hindi: {
        A: String(optH.A ?? optE.A ?? '').trim(),
        B: String(optH.B ?? optE.B ?? '').trim(),
        C: String(optH.C ?? optE.C ?? '').trim(),
        D: String(optH.D ?? optE.D ?? '').trim(),
      },
      correct_answer:      String(q.correct_answer).toUpperCase(),
      explanation_english: String(q.explanation_english ?? '').trim(),
      explanation_hindi:   String(q.explanation_hindi   ?? '').trim(),
      chapter:             String(q.chapter ?? 'General').trim(),
      source:              'Bihar Board 2026 Set-E',
      class:               12,
    };
  });

console.log(`   After dedup/validation: ${cleaned.length} unique questions`);

if (cleaned.length === 0) {
  console.error('\n❌ No valid questions. Aborting Firebase update.');
  process.exit(1);
}

writeFileSync('/tmp/class12_maths_final.json', JSON.stringify(cleaned, null, 2));
console.log('   📁 Preview → /tmp/class12_maths_final.json');

// ── Delete ALL existing Class 12 Maths questions ──────────────────────────────
console.log('\n🗑️  Deleting existing Firebase /class12/maths…');
const delRes = await fetch(`${DB_URL}/class12/maths.json`, { method: 'DELETE' });
console.log(`   DELETE → HTTP ${delRes.status}`);

// ── Upload new questions ──────────────────────────────────────────────────────
console.log(`\n💾 Uploading ${cleaned.length} questions to Firebase /class12/maths…`);
let saved = 0, failed = 0;
for (const q of cleaned) {
  try {
    const r = await fetch(`${DB_URL}/class12/maths.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(q),
    });
    if (r.ok) { saved++; }
    else {
      failed++;
      if (failed <= 3) console.log(`\n   ⚠️  HTTP ${r.status}: ${(await r.text()).slice(0, 80)}`);
    }
  } catch (e) {
    failed++;
    if (failed <= 3) console.log(`\n   ⚠️  ${e}`);
  }
  if (saved % 10 === 0 && saved > 0) process.stdout.write(`   … ${saved}/${cleaned.length}\r`);
}

console.log(`\n\n🎉 Done! ${saved}/${cleaned.length} questions → Firebase /class12/maths`);
if (failed > 0) console.log(`   ⚠️  ${failed} upload(s) failed`);

// ── Sample ────────────────────────────────────────────────────────────────────
console.log('\n── Sample ───────────────────────────────────────────────────────');
cleaned.slice(0, 5).forEach((q, i) => {
  console.log(`\nQ${i + 1} [${q.chapter}]`);
  console.log(`  EN: ${q.question_english.slice(0, 100)}`);
  console.log(`  HI: ${q.question_hindi.slice(0, 80)}`);
  ['A','B','C','D'].forEach(l => console.log(`    ${l}. ${String(q.options[l]).slice(0,60)}${l===q.correct_answer?' ✓':''}`));
  if (q.explanation_english) console.log(`  Exp: ${q.explanation_english.slice(0, 120)}`);
});

const byChapter = {};
for (const q of cleaned) byChapter[q.chapter] = (byChapter[q.chapter] ?? 0) + 1;
console.log('\n── Chapter breakdown ────────────────────────────────────────────');
Object.entries(byChapter).sort((a,b) => b[1]-a[1]).forEach(([ch,n]) => console.log(`  ${ch}: ${n}`));
console.log('\n✅ Class 10 /maths path is SEPARATE and UNAFFECTED.');
