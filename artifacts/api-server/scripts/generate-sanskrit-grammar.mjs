/**
 * Generates Bihar Board Class 10 Sanskrit Grammar MCQ questions
 * and saves them to Firebase /sanskrit with chapter tags.
 *
 * Syllabus:
 *  संधि, समास, प्रकरणम् (कारक/विभक्ति/अव्यय/उपसर्ग),
 *  प्रत्यय, शब्दरूप, धातुरूप, वाक्य रचना
 */
import { GoogleGenAI } from '@google/genai';
import { writeFileSync } from 'fs';

const DB_URL  = 'https://shiken-d8789-default-rtdb.firebaseio.com';
const API_KEY = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
if (!API_KEY) { console.error('No API key'); process.exit(1); }

const ai    = new GoogleGenAI({ apiKey: API_KEY });
const MODEL = 'gemini-2.5-flash-lite';
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── Grammar topics with question counts ───────────────────────────────────────
const TOPICS = [
  {
    chapter: 'संधि',
    count: 10,
    hint: 'स्वर संधि (दीर्घ, गुण, वृद्धि, यण, अयादि), व्यंजन संधि, विसर्ग संधि। संधि विच्छेद, संधि नाम पहचान। BSEB Class 10 स्तर।',
  },
  {
    chapter: 'समास',
    count: 10,
    hint: 'तत्पुरुष, कर्मधारय, द्विगु, बहुव्रीहि, द्वंद्व, अव्ययीभाव समास। समास विग्रह, समास नाम पहचान। BSEB Class 10 स्तर।',
  },
  {
    chapter: 'प्रकरणम्',
    count: 10,
    hint: 'कारक (कर्ता, कर्म, करण, सम्प्रदान, अपादान, सम्बन्ध, अधिकरण, सम्बोधन) विभक्ति प्रयोग, अव्यय (इव, च, एव, तु, अपि, सदा), उपसर्ग (प्र, परा, अप, सम्, अनु, अव, नि, निस्, दुर्, वि, सु, उद्, अभि, प्रति, परि, उप)। BSEB Class 10।',
  },
  {
    chapter: 'प्रत्यय',
    count: 10,
    hint: 'स्त्री प्रत्यय (टाप्/आ, ङीप्/ई, ङीष्): राजा→राज्ञी, छात्र→छात्रा। कृदन्त प्रत्यय: क्त्वा (गत्वा, पठित्वा), तुमुन् (पठितुम्, गन्तुम्), ल्यप् (आगत्य, प्रपठ्य), क्त (गत, पठित)। तद्धित प्रत्यय: मतुप् (बलवान्), इन् (धनिन्)। BSEB Class 10।',
  },
  {
    chapter: 'शब्दरूप',
    count: 12,
    hint: 'बाल (अकारान्त पुल्लिंग), रमा (आकारान्त स्त्रीलिंग), फल (अकारान्त नपुंसकलिंग), मुनि (इकारान्त पुल्लिंग), नदी (ईकारान्त स्त्रीलिंग), पितृ (ऋकारान्त पुल्लिंग), अस्मद् (मैं/हम), युष्मद् (तुम/आप) — विभक्ति पहचान, सही रूप चुनना। BSEB Class 10।',
  },
  {
    chapter: 'धातुरूप',
    count: 12,
    hint: 'लट् लकार (वर्तमान), लृट् लकार (भविष्यत्), लङ् लकार (भूतकाल), लोट् लकार (आज्ञार्थ), विधिलिङ् लकार (चाहिए/उचित) — पठ्, गम्, दृश्, कृ, भू, वद् धातुओं के रूप। सही लकार/पुरुष/वचन पहचानना। BSEB Class 10।',
  },
  {
    chapter: 'वाक्य रचना',
    count: 8,
    hint: 'हिंदी वाक्यों का संस्कृत में अनुवाद, सही विभक्ति/धातुरूप/शब्दरूप का प्रयोग। सरल वाक्य। BSEB Class 10 स्तर।',
  },
];

// ── Prompt template ────────────────────────────────────────────────────────────
const PROMPT = (chapter, count, hint) =>
`तुम Bihar Board Class 10 Sanskrit Vyakaran (व्याकरण) के expert हो।

"${chapter}" topic पर EXACTLY ${count} MCQ questions बनाओ जो BSEB Class 10 परीक्षा के लिए उपयुक्त हों।
Topic details: ${hint}

STRICT RULES:
- Return ONLY a valid JSON array — no markdown, no explanation, no code fences.
- Questions भी प्रश्न: संस्कृत/हिंदी में (Devanagari script) — जो परीक्षा में आते हैं।
- "hindi" field: प्रश्न का Hindi/Sanskrit Devanagari text (यही main question है)।
- "english" field: same question in simple English।
- "options": EXACTLY 4 Devanagari strings (Sanskrit/Hindi)।
- "optionsHindi": same 4 options (copy)।
- "answerIndex": 0-3 (correct option index)।
- "chapter": "${chapter}" (exact, always)।
- Questions should vary: रूप पहचानना, विग्रह, नाम पहचानना, fill-in-blank, example से identification।

JSON format (return ONLY this):
[
  {
    "hindi": "प्रश्न Devanagari में",
    "english": "Question in English",
    "options": ["विकल्प 1", "विकल्प 2", "विकल्प 3", "विकल्प 4"],
    "optionsHindi": ["विकल्प 1", "विकल्प 2", "विकल्प 3", "विकल्प 4"],
    "answerIndex": 0,
    "chapter": "${chapter}"
  }
]`;

// ── Generate questions for a single topic ──────────────────────────────────────
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
      if (msg.includes('429') && attempt < retries) {
        const w = 40000 * attempt;
        console.log(`  ⏳ 429 on "${chapter}" — waiting ${w/1000}s (attempt ${attempt}/${retries})`);
        await sleep(w);
      } else { console.log(`  ⚠️  "${chapter}" failed: ${msg.slice(0, 120)}`); return []; }
    }
  }
  return [];
}

// ── Process all topics sequentially with delay ────────────────────────────────
const allQuestions = [];
for (let i = 0; i < TOPICS.length; i++) {
  if (i > 0) { process.stdout.write(`  ⏳ 15s delay…\n`); await sleep(15000); }
  console.log(`\n[${i+1}/${TOPICS.length}] Generating "${TOPICS[i].chapter}"…`);
  const qs = await generateTopic(TOPICS[i]);
  allQuestions.push(...qs);
}

console.log(`\n📊 Total Sanskrit grammar questions: ${allQuestions.length}`);

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

writeFileSync('/tmp/sanskrit_grammar_questions.json', JSON.stringify(normalised, null, 2));
console.log('  📁 Preview → /tmp/sanskrit_grammar_questions.json');

// ── Save to Firebase /sanskrit ────────────────────────────────────────────────
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
    else console.log(`  ⚠️  ${r.status}`);
  } catch (e) { console.log(`  ⚠️  ${e}`); }
  if (saved % 20 === 0 && saved > 0) process.stdout.write(`  … ${saved}/${normalised.length}\n`);
}

// Verify
const check = await fetch(`${DB_URL}/sanskrit.json?shallow=true`);
const keys  = Object.keys((await check.json()) || {});
console.log(`\n🎉 Done! ${saved} grammar questions added.`);
console.log(`   Firebase /sanskrit now has ${keys.length} total entries`);

// Chapter breakdown
const chapMap = {};
normalised.forEach(q => { chapMap[q.chapter] = (chapMap[q.chapter] || 0) + 1; });
console.log('\n── Chapter breakdown ──');
Object.entries(chapMap).forEach(([ch, n]) => console.log(`  ${ch}: ${n}`));
