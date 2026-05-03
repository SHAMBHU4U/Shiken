import { readFileSync, writeFileSync } from 'fs';
import { GoogleGenAI } from '@google/genai';

const DB_URL = 'https://shiken-d8789-default-rtdb.firebaseio.com';
const API_KEY = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
const PDF_PATH = '/home/runner/workspace/attached_assets/english2025_1777792181654.pdf';

if (!API_KEY) { console.error('No API key'); process.exit(1); }

// ── 1. Read PDF ──────────────────────────────────────────────────────────────
console.log('📂 Reading PDF…');
const pdfBase64 = readFileSync(PDF_PATH).toString('base64');
console.log(`   Size: ${(pdfBase64.length / 1024).toFixed(0)} KB base64`);

// ── 2. Extract MCQs with Gemini ───────────────────────────────────────────────
console.log('🤖 Sending to Gemini 2.0 Flash…');
const ai = new GoogleGenAI({ apiKey: API_KEY });

const prompt = `You are an expert at extracting multiple-choice questions from Bihar Board Class 10 English exam papers.

Extract EVERY multiple-choice question from this PDF. This is a Bihar Board Class 10 English question paper.

For each MCQ return a JSON object with:
- "english": full question text in English
- "hindi": Hindi translation of the question text  
- "options": array of exactly 4 answer choices in English (the A/B/C/D options as plain strings)
- "optionsHindi": same 4 options translated to Hindi
- "answerIndex": integer 0-3 (0=A, 1=B, 2=C, 3=D). Use the answer key if present in the PDF; otherwise use correct subject knowledge.
- "chapter": section/topic label such as "Grammar", "Comprehension", "Vocabulary", "Prose", "Poetry", "Writing Skills"

STRICT RULES:
- Return ONLY a raw JSON array — no markdown, no code fences, no explanation.
- Include MCQs from ALL sections and ALL pages.
- Skip non-MCQ questions (essays, fill-in-blank without choices, short-answer).
- Ignore page numbers, headers, footers, instructions text.
- Each "options" array must have exactly 4 strings.
- answerIndex must be a number 0, 1, 2 or 3.

Output format (nothing else):
[{"english":"...","hindi":"...","options":["A text","B text","C text","D text"],"optionsHindi":["A हिंदी","B हिंदी","C हिंदी","D हिंदी"],"answerIndex":1,"chapter":"Grammar"}]`;

const response = await ai.models.generateContent({
  model: 'gemini-2.0-flash-lite',
  contents: [{
    role: 'user',
    parts: [
      { inlineData: { mimeType: 'application/pdf', data: pdfBase64 } },
      { text: prompt },
    ],
  }],
  config: { maxOutputTokens: 8192, responseMimeType: 'application/json' },
});

const raw = (response.text ?? '').trim();
console.log(`   Raw response: ${raw.length} chars`);

let questions;
try {
  questions = JSON.parse(raw);
} catch {
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) { console.error('Could not parse JSON:\n', raw.slice(0, 800)); process.exit(1); }
  questions = JSON.parse(match[0]);
}

if (!Array.isArray(questions) || questions.length === 0) {
  console.error('No questions extracted'); process.exit(1);
}

// Normalise + add IDs
const cleaned = questions
  .filter(q => (q.english || q.hindi) && Array.isArray(q.options) && q.options.length >= 2)
  .map((q, i) => ({
    id:           `eng_${String(i + 1).padStart(4, '0')}`,
    english:      String(q.english      ?? '').trim(),
    hindi:        String(q.hindi        ?? '').trim(),
    options:      (Array.isArray(q.options)      ? q.options      : []).slice(0, 4).map(String),
    optionsHindi: (Array.isArray(q.optionsHindi) ? q.optionsHindi : []).slice(0, 4).map(String),
    correctAnswer: typeof q.answerIndex === 'number' ? q.answerIndex : 0,
    chapter:      String(q.chapter ?? 'General').trim(),
  }));

console.log(`✅ Extracted ${cleaned.length} MCQ questions`);

// Save preview JSON locally
writeFileSync('/tmp/english_questions.json', JSON.stringify(cleaned, null, 2));
console.log('   Saved preview to /tmp/english_questions.json');

// ── 3. Fetch current English questions from Firebase ─────────────────────────
console.log('🔥 Fetching current English DB…');
const fetchRes = await fetch(`${DB_URL}/english.json?shallow=true`);
const existing = await fetchRes.json();
const existingKeys = existing ? Object.keys(existing) : [];
console.log(`   Found ${existingKeys.length} existing entries`);

// ── 4. Delete ALL existing English questions (all are Hindi-language questions)
if (existingKeys.length > 0) {
  console.log('🗑️  Deleting all existing English questions…');
  const delRes = await fetch(`${DB_URL}/english.json`, { method: 'DELETE' });
  console.log(`   DELETE status: ${delRes.status}`);
}

// ── 5. Save new questions to Firebase ────────────────────────────────────────
console.log(`💾 Saving ${cleaned.length} questions to Firebase…`);
let saved = 0;
for (const q of cleaned) {
  const r = await fetch(`${DB_URL}/english.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(q),
  });
  if (r.ok) { saved++; }
  if (saved % 10 === 0) console.log(`   … ${saved}/${cleaned.length}`);
}

console.log(`\n🎉 Done! ${saved} questions saved to Firebase /english`);
console.log('\nSample questions:');
cleaned.slice(0, 3).forEach((q, i) => {
  console.log(`\nQ${i+1} [${q.chapter}]: ${q.english.slice(0, 80)}`);
  q.options.forEach((o, oi) => console.log(`  ${String.fromCharCode(65+oi)}. ${o}${oi === q.correctAnswer ? ' ✓' : ''}`));
});
