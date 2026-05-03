/**
 * Generates remaining 2 Sanskrit grammar chapters: धातुरूप + वाक्य रचना
 * Uses Replit AI proxy
 */
import { GoogleGenAI } from '@google/genai';

const DB_URL  = 'https://shiken-d8789-default-rtdb.firebaseio.com';
const BASE_URL = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL;
const API_KEY  = process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
if (!BASE_URL || !API_KEY) { console.error('Missing proxy env vars'); process.exit(1); }

const ai    = new GoogleGenAI({ apiKey: API_KEY, httpOptions: { apiVersion: '', baseUrl: BASE_URL } });
const MODEL = 'gemini-2.5-flash';
const sleep = ms => new Promise(r => setTimeout(r, ms));

const TOPICS = [
  {
    chapter: 'धातुरूप',
    count: 12,
    hint: 'लट् लकार (वर्तमान), लृट् लकार (भविष्यत्), लङ् लकार (भूतकाल), लोट् लकार (आज्ञार्थ), विधिलिङ् लकार (चाहिए/उचित). पठ्, गम्, दृश्, कृ, भू, वद् धातुओं के रूप। सही लकार/पुरुष/वचन पहचानना।',
  },
  {
    chapter: 'वाक्य रचना',
    count: 8,
    hint: 'हिंदी वाक्यों का संस्कृत में सही अनुवाद। सही विभक्ति और धातुरूप का प्रयोग। सरल दैनिक जीवन के वाक्य।',
  },
];

function makePrompt(chapter, count, hint) {
  return `तुम Bihar Board Class 10 Sanskrit Vyakaran के expert हो।

"${chapter}" topic पर EXACTLY ${count} MCQ questions बनाओ जो BSEB Class 10 परीक्षा के लिए हों।
Topic details: ${hint}

STRICT RULES:
- Return ONLY a valid JSON array — no markdown, no code fences, no explanation.
- "hindi": प्रश्न Devanagari में (यही main question है)
- "english": same question in simple English
- "options": EXACTLY 4 Devanagari strings
- "optionsHindi": same 4 options (copy of options)
- "answerIndex": 0-3 (correct option index)
- "chapter": "${chapter}"
- Questions vary: रूप पहचान, fill-in-blank, सही रूप चुनना, नाम पहचान

Return ONLY this JSON array:
[{"hindi":"प्रश्न","english":"Question","options":["A","B","C","D"],"optionsHindi":["A","B","C","D"],"answerIndex":0,"chapter":"${chapter}"}]`;
}

async function generateTopic(topic, retries = 3) {
  const { chapter, count, hint } = topic;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const resp = await ai.models.generateContent({
        model: MODEL,
        contents: [{ role: 'user', parts: [{ text: makePrompt(chapter, count, hint) }] }],
        config: { maxOutputTokens: 4096, responseMimeType: 'application/json' },
      });
      const raw = (resp.text ?? '').trim();
      let parsed;
      try { parsed = JSON.parse(raw); }
      catch { const m = raw.match(/\[[\s\S]*\]/); parsed = m ? JSON.parse(m[0]) : []; }
      if (!Array.isArray(parsed)) parsed = [];
      const valid = parsed
        .filter(q => (q.hindi || q.english) && Array.isArray(q.options) && q.options.length >= 2)
        .map(q => ({ ...q, chapter }));
      console.log(`  ✅ "${chapter}": ${valid.length}/${count}`);
      return valid;
    } catch (e) {
      const msg = String(e);
      if ((msg.includes('429') || msg.includes('rate')) && attempt < retries) {
        const w = 15000 * attempt;
        console.log(`  ⏳ rate-limited — waiting ${w/1000}s (attempt ${attempt}/${retries})`);
        await sleep(w);
      } else {
        console.log(`  ⚠️  Failed: ${msg.slice(0, 120)}`);
        return [];
      }
    }
  }
  return [];
}

const allQ = [];
for (let i = 0; i < TOPICS.length; i++) {
  if (i > 0) { console.log('  ⏳ 8s delay…'); await sleep(8000); }
  console.log(`[${i+1}/${TOPICS.length}] Generating "${TOPICS[i].chapter}"…`);
  allQ.push(...(await generateTopic(TOPICS[i])));
}
console.log(`\n📊 Total: ${allQ.length} questions`);

// Save to Firebase
console.log(`\n💾 Saving to Firebase /sanskrit…`);
let saved = 0;
for (const q of allQ) {
  const norm = {
    hindi:        String(q.hindi        ?? '').trim(),
    english:      String(q.english      ?? '').trim(),
    options:      (Array.isArray(q.options)      ? q.options      : []).slice(0, 4).map(String),
    optionsHindi: (Array.isArray(q.optionsHindi) ? q.optionsHindi : (Array.isArray(q.options) ? q.options : [])).slice(0, 4).map(String),
    correctAnswer: typeof q.answerIndex === 'number' ? q.answerIndex : 0,
    chapter:      String(q.chapter ?? 'व्याकरण').trim(),
  };
  try {
    const r = await fetch(`${DB_URL}/sanskrit.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(norm),
    });
    if (r.ok) saved++; else console.log(`  ⚠️  HTTP ${r.status}`);
  } catch (e) { console.log(`  ⚠️  ${e}`); }
}

const check = await fetch(`${DB_URL}/sanskrit.json?shallow=true`);
const keys  = Object.keys((await check.json()) || {});
console.log(`\n🎉 Done! ${saved}/${allQ.length} saved. Firebase /sanskrit total: ${keys.length}`);
