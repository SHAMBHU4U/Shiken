/**
 * Generates धातुरूप Sanskrit grammar questions via Replit AI proxy
 * in two smaller batches of 6 to avoid JSON truncation issues.
 */
import { GoogleGenAI } from '@google/genai';

const DB_URL   = 'https://shiken-d8789-default-rtdb.firebaseio.com';
const BASE_URL = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL;
const API_KEY  = process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
if (!BASE_URL || !API_KEY) { console.error('Missing proxy env vars'); process.exit(1); }

const ai    = new GoogleGenAI({ apiKey: API_KEY, httpOptions: { apiVersion: '', baseUrl: BASE_URL } });
const sleep = ms => new Promise(r => setTimeout(r, ms));

const BATCHES = [
  { batch: 'A', count: 6, focus: 'लट् लकार (वर्तमान काल) और लृट् लकार (भविष्यत् काल)। पठ्, गम्, भू धातुओं के प्रथम, मध्यम, उत्तम पुरुष एकवचन/बहुवचन रूप।' },
  { batch: 'B', count: 6, focus: 'लङ् लकार (भूतकाल), लोट् लकार (आज्ञार्थ), विधिलिङ् लकार (चाहिए)। दृश्, कृ, वद् धातुओं के रूप।' },
];

function makePrompt(count, focus) {
  return `तुम Bihar Board Class 10 Sanskrit Vyakaran के expert हो।

"धातुरूप" topic पर EXACTLY ${count} MCQ questions बनाओ।
Focus: ${focus}

RULES:
- Return ONLY valid JSON array, no markdown, no code fences.
- Keep option text SHORT (max 20 characters each) to avoid JSON issues.
- "hindi": प्रश्न Devanagari में
- "english": Question in English
- "options": EXACTLY 4 short Devanagari strings
- "optionsHindi": same 4 options
- "answerIndex": 0-3
- "chapter": "धातुरूप"

Return ONLY:
[{"hindi":"...","english":"...","options":["A","B","C","D"],"optionsHindi":["A","B","C","D"],"answerIndex":0,"chapter":"धातुरूप"}]`;
}

async function generate(count, focus, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const resp = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: makePrompt(count, focus) }] }],
        config: { maxOutputTokens: 2048 },
      });
      const raw = (resp.text ?? '').trim();
      let parsed;
      try { parsed = JSON.parse(raw); }
      catch {
        // Try extracting just the array
        const m = raw.match(/\[[\s\S]*\]/);
        if (!m) { console.log('  No array found in response'); return []; }
        try { parsed = JSON.parse(m[0]); }
        catch (e2) {
          // Try to extract individual objects
          const objects = [];
          const objRegex = /\{[^{}]*\}/g;
          let match;
          while ((match = objRegex.exec(m[0])) !== null) {
            try { objects.push(JSON.parse(match[0])); } catch {}
          }
          parsed = objects;
        }
      }
      if (!Array.isArray(parsed)) parsed = [];
      const valid = parsed
        .filter(q => (q.hindi || q.english) && Array.isArray(q.options) && q.options.length >= 2)
        .map(q => ({ ...q, chapter: 'धातुरूप' }));
      console.log(`  ✅ Got ${valid.length}/${count}`);
      return valid;
    } catch (e) {
      const msg = String(e);
      if (attempt < retries) { console.log(`  ⏳ Retry ${attempt+1}…`); await sleep(8000 * attempt); }
      else { console.log(`  ⚠️  Failed: ${msg.slice(0, 100)}`); return []; }
    }
  }
  return [];
}

const allQ = [];
for (let i = 0; i < BATCHES.length; i++) {
  if (i > 0) { console.log('  ⏳ 6s…'); await sleep(6000); }
  const { batch, count, focus } = BATCHES[i];
  console.log(`[Batch ${batch}] ${count} questions…`);
  allQ.push(...(await generate(count, focus)));
}
console.log(`\n📊 Total धातुरूप: ${allQ.length}`);

// Save to Firebase
let saved = 0;
for (const q of allQ) {
  const norm = {
    hindi:        String(q.hindi        ?? '').trim(),
    english:      String(q.english      ?? '').trim(),
    options:      (Array.isArray(q.options)      ? q.options      : []).slice(0, 4).map(String),
    optionsHindi: (Array.isArray(q.optionsHindi) ? q.optionsHindi : (Array.isArray(q.options) ? q.options : [])).slice(0, 4).map(String),
    correctAnswer: typeof q.answerIndex === 'number' ? q.answerIndex : 0,
    chapter:      'धातुरूप',
  };
  try {
    const r = await fetch(`${DB_URL}/sanskrit.json`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(norm),
    });
    if (r.ok) saved++; else console.log(`  ⚠️  HTTP ${r.status}`);
  } catch (e) { console.log(`  ⚠️  ${e}`); }
}

const check = await fetch(`${DB_URL}/sanskrit.json?shallow=true`);
const keys  = Object.keys((await check.json()) || {});
console.log(`\n🎉 Saved ${saved}/${allQ.length} धातुरूप questions.`);
console.log(`   Firebase /sanskrit total: ${keys.length} entries`);
