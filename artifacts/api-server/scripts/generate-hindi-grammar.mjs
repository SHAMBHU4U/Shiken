/**
 * Generates Bihar Board Class 10 Hindi Grammar MCQ questions
 * and saves them to Firebase /hindi with proper chapter tags.
 */
import { GoogleGenAI } from '@google/genai';
import { writeFileSync } from 'fs';

const DB_URL  = 'https://shiken-d8789-default-rtdb.firebaseio.com';
const API_KEY = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
if (!API_KEY) { console.error('No API key'); process.exit(1); }

const ai    = new GoogleGenAI({ apiKey: API_KEY });
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── Grammar topics with question counts ───────────────────────────────────────
const TOPICS = [
  { chapter: 'वर्ण विचार',           count: 8,  hint: 'स्वर, व्यंजन, उच्चारण, वर्गीकरण, अनुस्वार, विसर्ग' },
  { chapter: 'संज्ञा',               count: 8,  hint: 'व्यक्तिवाचक, जातिवाचक, भाववाचक, द्रव्यवाचक, समूहवाचक' },
  { chapter: 'सर्वनाम',             count: 7,  hint: 'पुरुषवाचक, निश्चयवाचक, अनिश्चयवाचक, सम्बन्धवाचक, प्रश्नवाचक, निजवाचक' },
  { chapter: 'क्रिया',               count: 7,  hint: 'सकर्मक, अकर्मक, प्रेरणार्थक, द्विकर्मक, संयुक्त क्रिया' },
  { chapter: 'विशेषण',              count: 7,  hint: 'गुणवाचक, संख्यावाचक, परिमाणवाचक, सार्वनामिक, विशेष्य, विशेषण के भेद' },
  { chapter: 'संधि',                count: 10, hint: 'स्वर संधि (दीर्घ, गुण, वृद्धि, यण, अयादि), व्यंजन संधि, विसर्ग संधि, संधि विच्छेद' },
  { chapter: 'समास',                count: 10, hint: 'तत्पुरुष, कर्मधारय, द्विगु, बहुव्रीहि, द्वंद्व, अव्ययीभाव, विग्रह' },
  { chapter: 'काल',                 count: 8,  hint: 'वर्तमान काल (सामान्य, अपूर्ण, पूर्ण), भूतकाल, भविष्यत काल के भेद, वाक्य पहचान' },
  { chapter: 'कारक',                count: 8,  hint: 'कर्ता, कर्म, करण, सम्प्रदान, अपादान, सम्बन्ध, अधिकरण, सम्बोधन, परसर्ग/विभक्ति' },
  { chapter: 'मुहावरे',             count: 10, hint: 'Bihar Board Class 10 Hindi पाठ्यक्रम से मुहावरे — अर्थ और वाक्य प्रयोग MCQ' },
  { chapter: 'लोकोक्तियाँ',         count: 8,  hint: 'Bihar Board Class 10 Hindi पाठ्यक्रम से कहावतें/लोकोक्तियाँ — अर्थ MCQ' },
  { chapter: 'शुद्ध-अशुद्ध वाक्य', count: 8,  hint: 'वर्तनी शुद्धि, व्याकरणिक अशुद्धि, सही वाक्य पहचानना, शब्द-रूप की अशुद्धि' },
  { chapter: 'एक शब्द',            count: 8,  hint: 'अनेक शब्दों के लिए एक शब्द — Bihar Board Class 10 स्तर के' },
];

const PROMPT_TEMPLATE = (chapter, count, hint) => `तुम Bihar Board Class 10 Hindi Vyakaran (व्याकरण) के expert हो।

"${chapter}" topic पर EXACTLY ${count} MCQ questions बनाओ।
Topic details: ${hint}

STRICT RULES:
- Return ONLY a valid JSON array — no markdown, no explanation, no code fences.
- Primary language: HINDI (Devanagari script).
- Each question MUST test actual grammar knowledge — definitions, examples, identification, filling blanks.
- "hindi" field: प्रश्न का पूर्ण text Devanagari में।
- "english" field: same question translated to English (simple).
- "options": EXACTLY 4 options as Devanagari Hindi strings.
- "optionsHindi": same 4 options (copy of options — Hindi is primary).
- "answerIndex": 0-3 (correct option index).
- "chapter": "${chapter}" (exact, always).
- Questions should vary: definitions, fill-in-blank, error identification, examples.

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
        model: 'gemini-2.5-flash-lite',
        contents: [{ role: 'user', parts: [{ text: PROMPT_TEMPLATE(chapter, count, hint) }] }],
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
      if (String(e).includes('429') && attempt < retries) {
        const w = 35000 * attempt;
        console.log(`  ⏳ 429 on "${chapter}" — wait ${w/1000}s (attempt ${attempt}/${retries})`);
        await sleep(w);
      } else { console.log(`  ⚠️  "${chapter}" failed: ${String(e).slice(0, 100)}`); return []; }
    }
  }
  return [];
}

// ── Process all topics (one at a time with delay) ─────────────────────────────
const allQuestions = [];
for (let i = 0; i < TOPICS.length; i++) {
  if (i > 0) { process.stdout.write(`  ⏳ 15s delay…\n`); await sleep(15000); }
  console.log(`\n[${i+1}/${TOPICS.length}] Generating "${TOPICS[i].chapter}"…`);
  const qs = await generateTopic(TOPICS[i]);
  allQuestions.push(...qs);
}

console.log(`\n📊 Total grammar questions generated: ${allQuestions.length}`);

// Normalize
const normalised = allQuestions.map((q, i) => ({
  id:           `hin_gram_${String(i + 1).padStart(4, '0')}`,
  hindi:        String(q.hindi        ?? '').trim(),
  english:      String(q.english      ?? '').trim(),
  options:      (Array.isArray(q.options)      ? q.options      : []).slice(0, 4).map(String),
  optionsHindi: (Array.isArray(q.optionsHindi) ? q.optionsHindi : (Array.isArray(q.options) ? q.options : [])).slice(0, 4).map(String),
  correctAnswer: typeof q.answerIndex === 'number' ? q.answerIndex : 0,
  chapter:      String(q.chapter ?? 'व्याकरण').trim(),
}));

writeFileSync('/tmp/hindi_grammar_questions.json', JSON.stringify(normalised, null, 2));
console.log('  📁 Preview saved to /tmp/hindi_grammar_questions.json');

// ── Save to Firebase ──────────────────────────────────────────────────────────
console.log(`\n💾 Saving ${normalised.length} questions to Firebase /hindi…`);
let saved = 0;
for (const q of normalised) {
  try {
    const r = await fetch(`${DB_URL}/hindi.json`, {
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
const check = await fetch(`${DB_URL}/hindi.json?shallow=true`);
const keys  = Object.keys(await check.json() || {});
console.log(`\n🎉 Done! ${saved} grammar questions added.`);
console.log(`   Firebase /hindi now has ${keys.length} total entries`);

// Chapter breakdown
const chapMap = {};
normalised.forEach(q => { chapMap[q.chapter] = (chapMap[q.chapter] || 0) + 1; });
console.log('\n── Grammar chapters ──');
Object.entries(chapMap).forEach(([ch, n]) => console.log(`  ${ch}: ${n}`));
