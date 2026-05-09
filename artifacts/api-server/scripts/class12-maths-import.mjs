/**
 * Bihar Board Class 12 Maths 2026 (Set-E) — PDF → Firebase importer
 *
 * - Reads the PDF using Gemini vision (inline base64)
 * - Extracts MCQs with correct answers and explanations
 * - Deletes ALL existing questions at /class12/maths in Firebase
 * - Uploads new questions to /class12/maths (separate from Class 10 /maths)
 *
 * Run: node artifacts/api-server/scripts/class12-maths-import.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { GoogleGenAI } from '@google/genai';

const DB_URL   = 'https://shiken-d8789-default-rtdb.firebaseio.com';
const PDF_PATH = '/home/runner/workspace/attached_assets/bihar-board-class-12-mathematics-121-327-set-e-2026-1770220912_1778299905206.pdf';

// Use Replit AI integration proxy if available, else fall back to direct key
const BASE_URL = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL;
const API_KEY  = BASE_URL
  ? process.env.AI_INTEGRATIONS_GEMINI_API_KEY
  : (process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY);

if (!API_KEY) {
  console.error('❌ No Gemini API key found. Set AI_INTEGRATIONS_GEMINI_API_KEY or GEMINI_API_KEY.');
  process.exit(1);
}

const ai = BASE_URL
  ? new GoogleGenAI({ apiKey: API_KEY, httpOptions: { apiVersion: '', baseUrl: BASE_URL } })
  : new GoogleGenAI({ apiKey: API_KEY });

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ── 1. Read PDF as base64 ─────────────────────────────────────────────────────
console.log('📂 Reading PDF…');
const pdfBase64 = readFileSync(PDF_PATH).toString('base64');
console.log(`   Size: ${(pdfBase64.length / 1024).toFixed(0)} KB base64, path: ${PDF_PATH}`);

// ── 2. Extract MCQs using Gemini (inline PDF) ─────────────────────────────────
console.log('\n🤖 Sending to Gemini for question extraction…');

const prompt = `You are an expert at extracting multiple-choice questions from Bihar Board Class 12 Mathematics exam papers.

This is the Bihar Board Annual Examination 2026, Class 12 Mathematics (Set-E) paper (Intermediate level).

Extract EVERY multiple-choice/objective question from this PDF.

For each question return a JSON object with EXACTLY these fields:
- "question_english": full question text in English (translate from Hindi if needed; include any formula/expression)
- "question_hindi": full question text in Hindi (original Hindi text from paper)
- "options": an object with keys "A", "B", "C", "D" — each value is the option text in English
- "options_hindi": an object with keys "A", "B", "C", "D" — same options in Hindi
- "correct_answer": a single uppercase letter "A", "B", "C", or "D"
- "explanation_english": clear step-by-step solution/explanation in English (3–6 sentences, show the math)
- "explanation_hindi": same explanation in Hindi (3–6 sentences)
- "chapter": the Mathematics chapter/topic this question belongs to. Use one of:
  ["Relations and Functions", "Inverse Trigonometric Functions", "Matrices", "Determinants",
   "Continuity and Differentiability", "Application of Derivatives", "Integration",
   "Application of Integrals", "Differential Equations", "Vector Algebra", "Three Dimensional Geometry",
   "Linear Programming", "Probability", "Complex Numbers", "General"]

STRICT RULES:
- Return ONLY a raw JSON array — no markdown fences, no explanation text.
- Include EVERY objective/MCQ question from ALL sections of the paper.
- Questions may be in Hindi; translate to English for "question_english".
- correct_answer MUST be "A", "B", "C", or "D" (uppercase letter only).
- Every options object must have exactly 4 keys: A, B, C, D.
- Use actual mathematical knowledge to determine the correct answer if not explicitly shown.
- For formulas: write them in plain text (e.g., "sin²x + cos²x = 1") or LaTeX inline ($...$).

Output format (nothing else):
[{"question_english":"...","question_hindi":"...","options":{"A":"...","B":"...","C":"...","D":"..."},"options_hindi":{"A":"...","B":"...","C":"...","D":"..."},"correct_answer":"A","explanation_english":"...","explanation_hindi":"...","chapter":"..."}]`;

let raw = '';
let questions = [];

async function extractWithGemini(model = 'gemini-2.5-flash') {
  const response = await ai.models.generateContent({
    model,
    contents: [{
      role: 'user',
      parts: [
        { inlineData: { mimeType: 'application/pdf', data: pdfBase64 } },
        { text: prompt },
      ],
    }],
    config: { maxOutputTokens: 32768, responseMimeType: 'application/json' },
  });
  return (response.text ?? '').trim();
}

// Try extraction with retries + fallback model
for (let attempt = 1; attempt <= 3; attempt++) {
  try {
    const model = attempt <= 2 ? 'gemini-2.5-flash' : 'gemini-2.0-flash';
    console.log(`   Attempt ${attempt}/3 — model: ${model}`);
    raw = await extractWithGemini(model);
    console.log(`   Raw response length: ${raw.length} chars`);
    if (raw.length > 100) break;
  } catch (err) {
    const wait = 15000 * attempt;
    console.log(`   ⚠️  Attempt ${attempt} failed: ${String(err).slice(0, 120)}`);
    if (attempt < 3) {
      console.log(`   Waiting ${wait / 1000}s…`);
      await sleep(wait);
    }
  }
}

if (!raw || raw.length < 50) {
  console.error('❌ Empty response from Gemini. Aborting.');
  process.exit(1);
}

// ── 3. Parse JSON ─────────────────────────────────────────────────────────────
try {
  questions = JSON.parse(raw);
} catch {
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) {
    console.error('❌ Could not parse JSON response:\n', raw.slice(0, 1000));
    writeFileSync('/tmp/class12_maths_raw.txt', raw);
    console.log('Raw response saved to /tmp/class12_maths_raw.txt');
    process.exit(1);
  }
  try { questions = JSON.parse(match[0]); }
  catch (e) { console.error('❌ JSON parse failed:', e); process.exit(1); }
}

if (!Array.isArray(questions)) {
  console.error('❌ Response is not an array');
  process.exit(1);
}

console.log(`\n✅ Raw extraction: ${questions.length} questions`);

// ── 4. Normalise + validate ───────────────────────────────────────────────────
const VALID_LETTERS = new Set(['A', 'B', 'C', 'D']);

const cleaned = questions
  .filter(q => (q.question_english || q.question_hindi))
  .filter(q => q.options && typeof q.options === 'object' && VALID_LETTERS.has(String(q.correct_answer ?? '').toUpperCase()))
  .map((q, i) => {
    const optE = q.options || {};
    const optH = q.options_hindi || {};
    return {
      question_english:    String(q.question_english ?? q.question_hindi ?? '').trim(),
      question_hindi:      String(q.question_hindi   ?? q.question_english ?? '').trim(),
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
      correct_answer:       String(q.correct_answer).toUpperCase(),
      explanation_english:  String(q.explanation_english ?? '').trim(),
      explanation_hindi:    String(q.explanation_hindi   ?? '').trim(),
      chapter:              String(q.chapter ?? 'General').trim(),
      source:               'Bihar Board 2026 Set-E',
      class:                12,
    };
  });

console.log(`   After validation: ${cleaned.length} valid questions`);

if (cleaned.length === 0) {
  console.error('❌ No valid questions after cleanup. Aborting.');
  process.exit(1);
}

// Save preview
writeFileSync('/tmp/class12_maths_questions.json', JSON.stringify(cleaned, null, 2));
console.log('   📁 Preview saved to /tmp/class12_maths_questions.json');

// ── 5. Delete ALL existing Class 12 Maths questions ──────────────────────────
console.log('\n🗑️  Deleting all existing questions at Firebase /class12/maths…');
const delRes = await fetch(`${DB_URL}/class12%2Fmaths.json`, { method: 'DELETE' });
console.log(`   DELETE /class12/maths → HTTP ${delRes.status}`);
if (!delRes.ok) {
  // Try alternate encoding
  const delRes2 = await fetch(`${DB_URL}/class12/maths.json`, { method: 'DELETE' });
  console.log(`   DELETE /class12/maths (alt) → HTTP ${delRes2.status}`);
}

// ── 6. Upload new questions to /class12/maths ─────────────────────────────────
console.log(`\n💾 Uploading ${cleaned.length} questions to Firebase /class12/maths…`);
let saved = 0, failed = 0;

for (const q of cleaned) {
  try {
    const r = await fetch(`${DB_URL}/class12/maths.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(q),
    });
    if (r.ok) {
      saved++;
    } else {
      failed++;
      const body = await r.text();
      if (failed <= 3) console.log(`   ⚠️  Save failed HTTP ${r.status}: ${body.slice(0, 80)}`);
    }
  } catch (e) {
    failed++;
    if (failed <= 3) console.log(`   ⚠️  Save error: ${e}`);
  }
  if (saved % 10 === 0 && saved > 0) console.log(`   … ${saved}/${cleaned.length} saved`);
}

console.log(`\n🎉 Done! ${saved}/${cleaned.length} questions saved to Firebase /class12/maths`);
if (failed > 0) console.log(`   ⚠️  ${failed} failed uploads`);

// ── 7. Print sample ───────────────────────────────────────────────────────────
console.log('\n── Sample questions ────────────────────────────────────────────');
cleaned.slice(0, 5).forEach((q, i) => {
  console.log(`\nQ${i + 1} [${q.chapter}]`);
  console.log(`  EN: ${q.question_english.slice(0, 100)}`);
  console.log(`  HI: ${q.question_hindi.slice(0, 80)}`);
  ['A', 'B', 'C', 'D'].forEach(l => {
    const mark = l === q.correct_answer ? ' ✓' : '';
    console.log(`    ${l}. ${q.options[l]}${mark}`);
  });
  if (q.explanation_english) {
    console.log(`  Exp: ${q.explanation_english.slice(0, 120)}`);
  }
});

console.log('\n✅ Firebase /class12/maths now contains Bihar Board 2026 Set-E questions.');
console.log('   Class 10 Maths route (/maths) is UNAFFECTED — completely separate path.');
