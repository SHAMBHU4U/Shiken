import { readFileSync, writeFileSync } from 'fs';
import { readdirSync } from 'fs';
import { GoogleGenAI } from '@google/genai';

const DB_URL  = 'https://shiken-d8789-default-rtdb.firebaseio.com';
const API_KEY = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
const PAGES_DIR = '/tmp/eng_pages';
const BATCH_SIZE = 4;
const BATCH_DELAY_MS = 20000; // 20s between batches

if (!API_KEY) { console.error('No API key'); process.exit(1); }
const ai = new GoogleGenAI({ apiKey: API_KEY });

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ── Load all page images ──────────────────────────────────────────────────────
const pageFiles = readdirSync(PAGES_DIR)
  .filter(f => f.endsWith('.jpg'))
  .sort()
  .map(f => `${PAGES_DIR}/${f}`);

console.log(`📄 Found ${pageFiles.length} page images`);

// ── Batch page images ─────────────────────────────────────────────────────────
const batches = [];
for (let i = 0; i < pageFiles.length; i += BATCH_SIZE) {
  batches.push(pageFiles.slice(i, i + BATCH_SIZE));
}
console.log(`   Split into ${batches.length} batches of up to ${BATCH_SIZE} pages each\n`);

// ── Extract MCQs from a batch of page images ──────────────────────────────────
async function extractBatch(pages, batchNum, retries = 3) {
  const pageNums = pages.map(p => p.match(/page-(\d+)/)?.[1]).join(', ');
  console.log(`🤖 Batch ${batchNum}/${batches.length} — pages ${pageNums}…`);

  const imageParts = pages.map(p => ({
    inlineData: {
      mimeType: 'image/jpeg',
      data: readFileSync(p).toString('base64'),
    }
  }));

  const prompt = `These are pages from a Bihar Board Class 10 English exam paper (2025).

Extract ALL multiple-choice questions visible in these pages.
Return a JSON array. Each object must have:
- "english": full question text in English
- "hindi": Hindi translation of the question
- "options": exactly 4 answer choices as plain strings (the text of A, B, C, D — not including the letter)
- "optionsHindi": same 4 choices in Hindi
- "answerIndex": 0-3 (0=A, 1=B, 2=C, 3=D). Use answer key from the paper if visible; otherwise use correct English knowledge.
- "chapter": topic such as "Grammar", "Comprehension", "Vocabulary", "Prose", "Poetry", "Writing Skills", "Unseen Passage"

RULES:
- Return ONLY a JSON array, no markdown, no explanation.
- If no MCQ questions on these pages, return an empty array [].
- Skip essays, short-answer, fill-blank without options.
- Each question's "options" must have exactly 4 strings.`;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-lite',
        contents: [{ role: 'user', parts: [...imageParts, { text: prompt }] }],
        config: { maxOutputTokens: 4096, responseMimeType: 'application/json' },
      });

      const raw = (response.text ?? '').trim();
      let parsed;
      try { parsed = JSON.parse(raw); }
      catch {
        const match = raw.match(/\[[\s\S]*\]/);
        parsed = match ? JSON.parse(match[0]) : [];
      }
      if (!Array.isArray(parsed)) parsed = [];
      console.log(`   ✅ ${parsed.length} questions found`);
      return parsed;
    } catch (err) {
      const isRateLimit = String(err).includes('429');
      if (isRateLimit && attempt < retries) {
        const wait = 30000 * attempt;
        console.log(`   ⏳ Rate limit hit — waiting ${wait/1000}s before retry ${attempt+1}/${retries}…`);
        await sleep(wait);
      } else {
        console.log(`   ⚠️  Batch ${batchNum} failed: ${String(err).slice(0, 120)}`);
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
    console.log(`   ⏳ Waiting ${BATCH_DELAY_MS/1000}s before next batch…`);
    await sleep(BATCH_DELAY_MS);
  }
  const qs = await extractBatch(batches[i], i + 1);
  allRaw.push(...qs);
}

console.log(`\n📊 Total raw questions collected: ${allRaw.length}`);

// ── Normalise + deduplicate ───────────────────────────────────────────────────
const seen = new Set();
const cleaned = allRaw
  .filter(q => (q.english || q.hindi) && Array.isArray(q.options) && q.options.length >= 2)
  .filter(q => {
    const key = (q.english || q.hindi).trim().slice(0, 60).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  })
  .map((q, i) => ({
    id:           `eng_${String(i + 1).padStart(4, '0')}`,
    english:      String(q.english      ?? '').trim(),
    hindi:        String(q.hindi        ?? '').trim(),
    options:      (Array.isArray(q.options)      ? q.options      : []).slice(0, 4).map(String),
    optionsHindi: (Array.isArray(q.optionsHindi) ? q.optionsHindi : []).slice(0, 4).map(String),
    correctAnswer: typeof q.answerIndex === 'number' ? q.answerIndex : 0,
    chapter:      String(q.chapter ?? 'General').trim(),
  }));

console.log(`   After dedup: ${cleaned.length} unique questions`);

if (cleaned.length === 0) {
  console.error('\n❌ No questions extracted. Aborting Firebase update.');
  process.exit(1);
}

// Save JSON preview locally
writeFileSync('/tmp/english_questions_final.json', JSON.stringify(cleaned, null, 2));
console.log('   📁 Preview saved to /tmp/english_questions_final.json');

// ── Delete ALL existing English questions from Firebase ───────────────────────
console.log('\n🗑️  Deleting all existing English questions from Firebase…');
const delRes = await fetch(`${DB_URL}/english.json`, { method: 'DELETE' });
console.log(`   DELETE /english → ${delRes.status}`);

// ── Save new questions to Firebase ────────────────────────────────────────────
console.log(`\n💾 Saving ${cleaned.length} questions to Firebase /english…`);
let saved = 0;
for (const q of cleaned) {
  try {
    const r = await fetch(`${DB_URL}/english.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(q),
    });
    if (r.ok) {
      saved++;
    } else {
      console.log(`   ⚠️  Save failed: ${r.status}`);
    }
  } catch (e) {
    console.log(`   ⚠️  Save error: ${e}`);
  }
  if (saved % 20 === 0 && saved > 0) console.log(`   … ${saved}/${cleaned.length} saved`);
}

console.log(`\n🎉 Complete! ${saved}/${cleaned.length} questions saved to Firebase /english`);

// Print sample
console.log('\n── Sample questions ────────────────────────────────────────────');
cleaned.slice(0, 5).forEach((q, i) => {
  console.log(`\nQ${i+1} [${q.chapter}]`);
  console.log(`  EN: ${q.english.slice(0, 90)}`);
  if (q.hindi) console.log(`  HI: ${q.hindi.slice(0, 80)}`);
  q.options.forEach((o, oi) => console.log(`    ${String.fromCharCode(65+oi)}. ${o}${oi === q.correctAnswer ? ' ✓' : ''}`));
});
