/**
 * Generates Bihar Board Class 10 Sanskrit Grammar MCQs using
 * Replit AI Integrations proxy (no quota limits).
 * Saves to Firebase /sanskrit
 */
import { GoogleGenAI } from '@google/genai';
import { writeFileSync } from 'fs';

const DB_URL  = 'https://shiken-d8789-default-rtdb.firebaseio.com';
const BASE_URL = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL;
const API_KEY  = process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
if (!BASE_URL || !API_KEY) { console.error('Missing AI_INTEGRATIONS_GEMINI_BASE_URL or API_KEY'); process.exit(1); }

const ai = new GoogleGenAI({
  apiKey: API_KEY,
  httpOptions: { apiVersion: '', baseUrl: BASE_URL },
});
const MODEL = 'gemini-2.5-flash';
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── Grammar topics ─────────────────────────────────────────────────────────────
const TOPICS = [
  {
    chapter: 'संधि',
    count: 10,
    hint: 'स्वर संधि (दीर्घ, गुण, वृद्धि, यण, अयादि), व्यंजन संधि, विसर्ग संधि। संधि विच्छेद, संधि नाम पहचान। BSEB Class 10।',
  },
  {
    chapter: 'समास',
    count: 10,
    hint: 'तत्पुरुष, कर्मधारय, द्विगु, बहुव्रीहि, द्वंद्व, अव्ययीभाव। समास विग्रह, समास नाम पहचान। BSEB Class 10।',
  },
  {
    chapter: 'प्रकरणम्',
    count: 10,
    hint: 'कारक (कर्ता, कर्म, करण, सम्प्रदान, अपादान, सम्बन्ध, अधिकरण, सम्बोधन), विभक्ति प्रयोग, अव्यय (इव, च, एव, तु, अपि, सदा), उपसर्ग (प्र, परा, अप, सम्, अनु, अव, नि, निस्, दुर्, वि, सु, उद्, अभि, प्रति, परि, उप)। BSEB Class 10।',
  },
  {
    chapter: 'प्रत्यय',
    count: 10,
    hint: 'स्त्री प्रत्यय (टाप्/आ, ङीप्/ई): राजा→राज्ञी, छात्र→छात्रा। कृदन्त: क्त्वा (गत्वा, पठित्वा), तुमुन् (पठितुम्), ल्यप् (आगत्य), क्त (गत, पठित)। तद्धित: मतुप् (बलवान्), इन् (धनिन्)। BSEB Class 10।',
  },
  {
    chapter: 'शब्दरूप',
    count: 12,
    hint: 'बाल (अकारान्त पुल्लिंग), रमा (आकारान्त स्त्रीलिंग), फल (नपुंसक), मुनि (इकारान्त), नदी (ईकारान्त), पितृ (ऋकारान्त), अस्मद् (मैं/हम), युष्मद् (तुम/आप) — विभक्ति पहचान, सही रूप चुनना। BSEB Class 10।',
  },
  {
    chapter: 'धातुरूप',
    count: 12,
    hint: 'लट् (वर्तमान), लृट् (भविष्यत्), लङ् (भूतकाल), लोट् (आज्ञार्थ), विधिलिङ् (चाहिए) — पठ्, गम्, दृश्, कृ, भू, वद् धातुओं के रूप। सही लकार/पुरुष/वचन पहचानना। BSEB Class 10।',
  },
  {
    chapter: 'वाक्य रचना',
    count: 8,
    hint: 'हिंदी वाक्यों का संस्कृत में अनुवाद, सही विभक्ति/धातुरूप का प्रयोग। सरल वाक्य। BSEB Class 10।',
  },
];

// ── Prompt ─────────────────────────────────────────────────────────────────────
const PROMPT = (chapter, count, hint) =>
`तुम Bihar Board Class 10 Sanskrit Vyakaran (व्याकरण) के expert हो।

"${chapter}" topic पर EXACTLY ${count} MCQ questions बनाओ जो BSEB Class 10 परीक्षा के लिए उपयुक्त हों।
Topic details: ${hint}

STRICT RULES:
- Return ONLY a valid JSON array — no markdown, no explanation, no code fences.
- "hindi" field: प्रश्न Devanagari में (Sanskrit/Hindi — यही main question है)।
- "english" field: same question in simple English।
- "options": EXACTLY 4 Devanagari strings।
- "optionsHindi": same 4 options (copy)।
- "answerIndex": 0-3 (correct option index)।
- "chapter": "${chapter}" (exact, always)।
- Questions vary: रूप पहचान, विग्रह, fill-in-blank, नाम पहचान, examples।

JSON (return ONLY this):
[{"hindi":"...","english":"...","options":["...","...","...","..."],"optionsHindi":["...","...","...","..."],"answerIndex":0,"chapter":"${chapter}"}]`;

// ── Generate one topic ─────────────────────────────────────────────────────────
async function generateTopic(topic, retries = 4) {
  const { chapter, count, hint } = topic;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const resp = await ai.models.generateContent({
        model: MODEL,
        contents: [{ role: 'user', parts: [{ text: PROMPT(chapter, count, hint) }] }],
        config: { maxOutputTokens: 4096 },
      });
      const raw = (resp.text ?? '').trim();
      let parsed;
      try { parsed = JSON.parse(raw); }
      catch { const m = raw.match(/\[[\s\S]*\]/); parsed = m ? JSON.parse(m[0]) : []; }
      if (!Array.isArray(parsed)) parsed = [];
      const valid = parsed.filter(q => (q.hindi || q.english) && Array.isArray(q.options) && q.options.length >= 2);
      console.log(`  ✅ "${chapter}": ${valid.length}/${count} questions`);
      return valid.map(q => ({ ...q, chapter }));
    } catch (e) {
      const msg = String(e);
      if ((msg.includes('429') || msg.includes('rate')) && attempt < retries) {
        const w = 20000 * attempt;
        console.log(`  ⏳ rate-limited on "${chapter}" — waiting ${w/1000}s (attempt ${attempt}/${retries})`);
        await sleep(w);
      } else { console.log(`  ⚠️  "${chapter}" failed: ${msg.slice(0, 120)}`); return []; }
    }
  }
  return [];
}

// ── Run all topics ─────────────────────────────────────────────────────────────
console.log('🚀 Generating Sanskrit grammar questions via Replit AI proxy…\n');
const allQuestions = [];
for (let i = 0; i < TOPICS.length; i++) {
  if (i > 0) { process.stdout.write('  ⏳ 8s delay…\n'); await sleep(8000); }
  console.log(`[${i+1}/${TOPICS.length}] "${TOPICS[i].chapter}"…`);
  const qs = await generateTopic(TOPICS[i]);
  allQuestions.push(...qs);
}
console.log(`\n📊 Total generated: ${allQuestions.length}`);

// Normalize
const normalised = allQuestions.map((q, i) => ({
  id:           `san_gram_${String(i + 1).padStart(4, '0')}`,
  hindi:        String(q.hindi        ?? '').trim(),
  english:      String(q.english      ?? '').trim(),
  options:      (Array.isArray(q.options)      ? q.options      : []).slice(0, 4).map(String),
  optionsHindi: (Array.isArray(q.optionsHindi) ? q.optionsHindi : (Array.isArray(q.options) ? q.options : [])).slice(0, 4).map(String),
  correctAnswer: typeof q.answerIndex === 'number' ? q.answerIndex : 0,
  chapter:      String(q.chapter ?? 'व्याकरण').trim(),
}));

writeFileSync('/tmp/sanskrit_grammar_proxy.json', JSON.stringify(normalised, null, 2));
console.log('  📁 Preview → /tmp/sanskrit_grammar_proxy.json');

// ── Save to Firebase /sanskrit ─────────────────────────────────────────────────
console.log(`\n💾 Saving ${normalised.length} questions to Firebase /sanskrit…`);
let saved = 0;
for (const q of normalised) {
  try {
    const r = await fetch(`${DB_URL}/sanskrit.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(q),
    });
    if (r.ok) saved++;
    else console.log(`  ⚠️  HTTP ${r.status}`);
  } catch (e) { console.log(`  ⚠️  ${e}`); }
}

const check = await fetch(`${DB_URL}/sanskrit.json?shallow=true`);
const keys  = Object.keys((await check.json()) || {});
console.log(`\n🎉 Done! ${saved}/${normalised.length} saved.`);
console.log(`   Firebase /sanskrit total entries: ${keys.length}`);

const chapMap = {};
normalised.forEach(q => { chapMap[q.chapter] = (chapMap[q.chapter] || 0) + 1; });
console.log('\n── Chapter breakdown ──');
Object.entries(chapMap).forEach(([ch, n]) => console.log(`  ${ch}: ${n}`));
