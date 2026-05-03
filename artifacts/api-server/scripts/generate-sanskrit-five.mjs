/**
 * Generates first 5 Sanskrit grammar chapters and saves each immediately.
 * Uses Replit AI proxy (no quota limits).
 */
import { GoogleGenAI } from '@google/genai';

const DB_URL   = 'https://shiken-d8789-default-rtdb.firebaseio.com';
const BASE_URL = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL;
const API_KEY  = process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
if (!BASE_URL || !API_KEY) { console.error('Missing proxy env vars'); process.exit(1); }

const ai    = new GoogleGenAI({ apiKey: API_KEY, httpOptions: { apiVersion: '', baseUrl: BASE_URL } });
const sleep = ms => new Promise(r => setTimeout(r, ms));

const TOPICS = [
  { chapter: 'संधि',     count: 8,
    hint: 'स्वर संधि (दीर्घ, गुण, वृद्धि, यण), व्यंजन संधि, विसर्ग संधि। संधि विच्छेद, संधि नाम पहचान। BSEB Class 10।' },
  { chapter: 'समास',     count: 8,
    hint: 'तत्पुरुष, कर्मधारय, द्विगु, बहुव्रीहि, द्वंद्व, अव्ययीभाव। समास विग्रह, नाम पहचान। BSEB Class 10।' },
  { chapter: 'प्रकरणम्', count: 8,
    hint: 'कारक (कर्ता/कर्म/करण/सम्प्रदान/अपादान/सम्बन्ध/अधिकरण), विभक्ति, अव्यय (इव, च, एव, तु, अपि), उपसर्ग (प्र, परा, अप, सम्, अनु)। BSEB Class 10।' },
  { chapter: 'प्रत्यय',  count: 8,
    hint: 'स्त्री प्रत्यय (आ, ई): छात्र→छात्रा। कृदन्त: क्त्वा (गत्वा), तुमुन् (पठितुम्), क्त (गत/पठित)। तद्धित: मतुप् (बलवान्)। BSEB Class 10।' },
  { chapter: 'शब्दरूप',  count: 8,
    hint: 'बाल (पुल्लिंग), रमा (स्त्रीलिंग), फल (नपुंसक), मुनि, नदी, अस्मद् (मैं/हम), युष्मद् (तुम) — विभक्ति पहचान, सही रूप। BSEB Class 10।' },
];

// Strip markdown fences and extract JSON array robustly
function extractJsonArray(raw) {
  // Remove markdown code fences
  let text = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/,'').trim();
  // Try direct parse first
  try { const p = JSON.parse(text); if (Array.isArray(p)) return p; } catch {}
  // Find array boundaries
  const start = text.indexOf('[');
  const end   = text.lastIndexOf(']');
  if (start === -1 || end === -1 || end <= start) return [];
  const slice = text.slice(start, end + 1);
  try { const p = JSON.parse(slice); if (Array.isArray(p)) return p; } catch {}
  return [];
}

function makePrompt(chapter, count, hint) {
  return `You are a Bihar Board Class 10 Sanskrit grammar expert.
Generate EXACTLY ${count} MCQ questions on topic: "${chapter}"
Topic details: ${hint}

Return ONLY a valid JSON array (no markdown, no fences):
[{"hindi":"प्रश्न Devanagari में","english":"Question in English","options":["विकल्प1","विकल्प2","विकल्प3","विकल्प4"],"optionsHindi":["विकल्प1","विकल्प2","विकल्प3","विकल्प4"],"answerIndex":0,"chapter":"${chapter}"}]

Rules:
- "options" and "optionsHindi": EXACTLY 4 Devanagari strings, max 30 chars each
- "answerIndex": 0, 1, 2, or 3
- Questions vary: identification, fill-in-blank, examples, naming`;
}

async function saveToFirebase(questions) {
  let saved = 0;
  for (const q of questions) {
    const norm = {
      hindi:        String(q.hindi        ?? '').trim(),
      english:      String(q.english      ?? '').trim(),
      options:      (Array.isArray(q.options)      ? q.options      : []).slice(0, 4).map(String),
      optionsHindi: (Array.isArray(q.optionsHindi) ? q.optionsHindi : (Array.isArray(q.options) ? q.options : [])).slice(0, 4).map(String),
      correctAnswer: typeof q.answerIndex === 'number' ? q.answerIndex : 0,
      chapter:      String(q.chapter ?? '').trim(),
    };
    try {
      const r = await fetch(`${DB_URL}/sanskrit.json`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(norm),
      });
      if (r.ok) saved++; else console.log(`    ⚠️  HTTP ${r.status}`);
    } catch (e) { console.log(`    ⚠️  ${e}`); }
  }
  return saved;
}

async function generateAndSave(topic, retries = 3) {
  const { chapter, count, hint } = topic;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const resp = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: makePrompt(chapter, count, hint) }] }],
        config: { maxOutputTokens: 8192 },
      });
      const raw    = (resp.text ?? '').trim();
      const parsed = extractJsonArray(raw);
      console.log(`    parse got: ${parsed.length} items from ${raw.length} chars`);
      const valid = parsed.filter(q =>
        (q.hindi || q.english) && Array.isArray(q.options) && q.options.length >= 2
      ).map(q => ({ ...q, chapter }));
      const saved = await saveToFirebase(valid);
      console.log(`  ✅ "${chapter}": ${valid.length}/${count} generated, ${saved} saved`);
      return saved;
    } catch (e) {
      const msg = String(e);
      if (attempt < retries) {
        console.log(`    ⏳ Attempt ${attempt+1} in ${8 * attempt}s… [${msg.slice(0,60)}]`);
        await sleep(8000 * attempt);
      } else {
        console.log(`  ⚠️  "${chapter}" failed: ${msg.slice(0, 120)}`);
        return 0;
      }
    }
  }
  return 0;
}

let totalSaved = 0;
for (let i = 0; i < TOPICS.length; i++) {
  if (i > 0) { console.log('  ⏳ 5s…'); await sleep(5000); }
  console.log(`[${i+1}/${TOPICS.length}] "${TOPICS[i].chapter}"…`);
  totalSaved += await generateAndSave(TOPICS[i]);
}

const check = await fetch(`${DB_URL}/sanskrit.json?shallow=true`);
const keys  = Object.keys((await check.json()) || {});
console.log(`\n🎉 Total saved this run: ${totalSaved}`);
console.log(`   Firebase /sanskrit total: ${keys.length}`);
