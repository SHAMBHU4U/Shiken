/**
 * Generates BSEB Class 10 comprehension passages (गद्यांश) for Hindi and Sanskrit
 * using Replit AI proxy and saves immediately to Firebase.
 *
 * Hindi  → /hindi_passages   (5 passages × 7 questions)
 * Sanskrit → /sanskrit_passages (5 passages × 7 questions)
 */
import { GoogleGenAI } from '@google/genai';

const DB_URL   = 'https://shiken-d8789-default-rtdb.firebaseio.com';
const BASE_URL = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL;
const API_KEY  = process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
if (!BASE_URL || !API_KEY) { console.error('Missing AI_INTEGRATIONS_GEMINI_BASE_URL / AI_INTEGRATIONS_GEMINI_API_KEY'); process.exit(1); }

const ai    = new GoogleGenAI({ apiKey: API_KEY, httpOptions: { apiVersion: '', baseUrl: BASE_URL } });
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── Passage topics ─────────────────────────────────────────────────────────────
const HINDI_TOPICS = [
  { title: 'पर्यावरण और प्रकृति',       theme: 'पर्यावरण प्रदूषण, पेड़-पौधों का महत्त्व, प्रकृति की रक्षा' },
  { title: 'जल संरक्षण',                theme: 'जल की महत्ता, जल बचाओ जीवन बचाओ, जल संरक्षण के उपाय' },
  { title: 'शिक्षा का महत्त्व',          theme: 'शिक्षा से राष्ट्र-निर्माण, अशिक्षा के दुष्परिणाम, ज्ञान की शक्ति' },
  { title: 'महापुरुषों से प्रेरणा',      theme: 'महात्मा गांधी, डॉ. भीमराव अम्बेडकर, या APJ अब्दुल कलाम के जीवन से प्रेरणा' },
  { title: 'स्वास्थ्य और योग',          theme: 'स्वस्थ जीवनशैली, योग का महत्त्व, आहार और व्यायाम' },
];

const SANSKRIT_TOPICS = [
  { title: 'विद्यायाः महत्त्वम्',        theme: 'शिक्षा का महत्त्व, विद्या से जीवन में उन्नति, ज्ञान की शक्ति' },
  { title: 'परिश्रमस्य फलम्',           theme: 'परिश्रम से सफलता, आलस्य का नुकसान, मेहनत का फल मीठा होता है' },
  { title: 'मातृभूमि-वन्दनम्',          theme: 'मातृभूमि की महिमा, देश-प्रेम, भारत की प्राकृतिक सुंदरता' },
  { title: 'सत्यस्य महिमा',             theme: 'सत्य की शक्ति, सच बोलने का महत्त्व, सत्य की विजय' },
  { title: 'स्वास्थ्यम् धनम्',          theme: 'स्वस्थ शरीर का महत्त्व, व्यायाम और आहार, आरोग्य की रक्षा' },
];

// ── Prompts ────────────────────────────────────────────────────────────────────
function hindiPrompt(topic, theme) {
  return `आप Bihar Board BSEB कक्षा 10 हिंदी परीक्षा के विशेषज्ञ हैं।
विषय "${topic}" (${theme}) पर एक अपठित गद्यांश बनाइए।

गद्यांश की आवश्यकताएँ:
- 180-220 शब्द, शुद्ध और सरल हिंदी, कक्षा 10 BSEB स्तर
- प्रवाहमय और जानकारीपूर्ण

EXACTLY 7 बहुविकल्पीय प्रश्न बनाइए:
- प्रश्न 1-3: गद्यांश पर आधारित तथ्यात्मक प्रश्न (factual comprehension)
- प्रश्न 4-5: भावार्थ / निष्कर्ष (inference)
- प्रश्न 6: शीर्षक या मुख्य विचार
- प्रश्न 7: शब्दार्थ (किसी शब्द का अर्थ गद्यांश के अनुसार)
- प्रत्येक प्रश्न में 4 विकल्प, एक सही उत्तर
- प्रश्न और विकल्प हिंदी Devanagari में

Return ONLY valid JSON (no markdown, no fences):
{"title":"गद्यांश का शीर्षक","passage":"पूरा गद्यांश...","questions":[{"english":"प्रश्न हिंदी में?","hindi":"प्रश्न हिंदी में?","options":["A","B","C","D"],"optionsHindi":["A","B","C","D"],"answerIndex":0}]}`;
}

function sanskritPrompt(topic, theme) {
  return `You are a Bihar Board BSEB Class 10 Sanskrit exam expert.
Create ONE unseen Sanskrit अपठित-गद्यांश on topic: "${topic}" (${theme})

Passage requirements:
- 100-130 words in simple, easy Sanskrit (BSEB Class 10 level)
- Use simple vocabulary; avoid very complex sandhi/samas
- Write in clear Devanagari script

EXACTLY 7 MCQ questions:
- Q1-2: Direct factual questions about the passage (passage से सीधे उत्तर)
- Q3-4: शब्दार्थ (word meaning from passage context)
- Q5: व्याकरण (identify कारक / विभक्ति / प्रत्यय in a word from passage)
- Q6: भावार्थ / निष्कर्ष (main idea or inference)
- Q7: शीर्षक (most suitable title for the passage)
- Write ALL questions and options in Hindi Devanagari for accessibility
- Each question has exactly 4 options, one correct answer

Return ONLY valid JSON (no markdown, no fences):
{"title":"संस्कृत शीर्षक","passage":"Full Sanskrit passage in Devanagari...","questions":[{"english":"प्रश्न हिंदी Devanagari में?","hindi":"प्रश्न हिंदी में?","options":["A","B","C","D"],"optionsHindi":["A","B","C","D"],"answerIndex":0}]}`;
}

// ── Parse JSON robustly (handles markdown fences) ──────────────────────────────
function parsePassage(raw) {
  // Strip markdown fences
  let text = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
  try { return JSON.parse(text); } catch {}
  // Find outermost object
  const start = text.indexOf('{');
  const end   = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try { return JSON.parse(text.slice(start, end + 1)); } catch {}
  return null;
}

// ── Save passage to Firebase ───────────────────────────────────────────────────
async function savePassage(fbPath, payload) {
  const r = await fetch(`${DB_URL}/${fbPath}.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return r.ok;
}

// ── Generate one passage with retry ───────────────────────────────────────────
async function generatePassage(promptText, fbPath, label, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const resp = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: promptText }] }],
        config: { maxOutputTokens: 8192 },
      });
      const raw    = (resp.text ?? '').trim();
      const parsed = parsePassage(raw);
      if (!parsed?.title || !parsed?.passage || !Array.isArray(parsed?.questions)) {
        console.log(`    ⚠️  Invalid structure (attempt ${attempt})`);
        if (attempt < retries) { await sleep(5000); continue; }
        return false;
      }
      const payload = {
        title:    parsed.title,
        passage:  parsed.passage,
        questions: parsed.questions.map(q => ({
          english:      String(q.english      ?? q.hindi ?? ''),
          hindi:        String(q.hindi        ?? q.english ?? ''),
          options:      (Array.isArray(q.options)      ? q.options      : []).slice(0, 4).map(String),
          optionsHindi: (Array.isArray(q.optionsHindi) ? q.optionsHindi : (Array.isArray(q.options) ? q.options : [])).slice(0, 4).map(String),
          correctAnswer: typeof q.answerIndex === 'number' ? q.answerIndex : 0,
          chapter: 'Comprehension',
        })),
      };
      const ok = await savePassage(fbPath, payload);
      console.log(`    ${ok ? '✅' : '⚠️ save failed'} "${parsed.title}" — ${payload.questions.length} questions`);
      return ok;
    } catch (e) {
      const msg = String(e);
      if (attempt < retries) {
        console.log(`    ⏳ retry ${attempt + 1} (${msg.slice(0, 60)})`);
        await sleep(6000 * attempt);
      } else {
        console.log(`    ❌ failed: ${msg.slice(0, 100)}`);
      }
    }
  }
  return false;
}

// ── Main ───────────────────────────────────────────────────────────────────────
console.log('📖 BSEB Class 10 Passage Generation (Replit AI Proxy)\n');

// Hindi passages
console.log('=== Hindi गद्यांश ===');
let hindiOk = 0;
for (let i = 0; i < HINDI_TOPICS.length; i++) {
  if (i > 0) { process.stdout.write('  ⏳ 5s…\n'); await sleep(5000); }
  const { title, theme } = HINDI_TOPICS[i];
  console.log(`[${i+1}/${HINDI_TOPICS.length}] ${title}`);
  if (await generatePassage(hindiPrompt(title, theme), 'hindi_passages', 'Hindi')) hindiOk++;
}

console.log(`\n=== Sanskrit गद्यांशम् ===`);
let sanOk = 0;
for (let i = 0; i < SANSKRIT_TOPICS.length; i++) {
  if (i > 0) { process.stdout.write('  ⏳ 5s…\n'); await sleep(5000); }
  const { title, theme } = SANSKRIT_TOPICS[i];
  console.log(`[${i+1}/${SANSKRIT_TOPICS.length}] ${title}`);
  if (await generatePassage(sanskritPrompt(title, theme), 'sanskrit_passages', 'Sanskrit')) sanOk++;
}

// Verify counts
const [hCheck, sCheck] = await Promise.all([
  fetch(`${DB_URL}/hindi_passages.json?shallow=true`).then(r => r.json()),
  fetch(`${DB_URL}/sanskrit_passages.json?shallow=true`).then(r => r.json()),
]);
console.log(`\n🎉 Done!`);
console.log(`   Hindi passages saved this run: ${hindiOk}/${HINDI_TOPICS.length} | Total in DB: ${Object.keys(hCheck||{}).length}`);
console.log(`   Sanskrit passages saved this run: ${sanOk}/${SANSKRIT_TOPICS.length} | Total in DB: ${Object.keys(sCheck||{}).length}`);
