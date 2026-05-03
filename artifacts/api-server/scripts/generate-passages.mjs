/**
 * Seeds Hindi and Sanskrit comprehension passages into Firebase.
 * Generates 3 passages per subject using Gemini AI.
 */
import { GoogleGenAI } from '@google/genai';

const DB_URL  = 'https://shiken-d8789-default-rtdb.firebaseio.com';
const API_KEY = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
if (!API_KEY) { console.error('No API key'); process.exit(1); }

const ai    = new GoogleGenAI({ apiKey: API_KEY });
const MODEL = 'gemini-2.0-flash-lite';
const sleep = ms => new Promise(r => setTimeout(r, ms));

const HINDI_TOPICS = [
  'पर्यावरण की रक्षा और पेड़-पौधों का महत्त्व',
  'जल संरक्षण की आवश्यकता',
  'शिक्षा का महत्त्व और राष्ट्र-निर्माण',
];

const SANSKRIT_TOPICS = [
  'विद्यायाः महत्त्वम्',
  'परिश्रमस्य फलम्',
  'मातृभूमिः स्वर्गादपि गरीयसी',
];

function buildHindiPrompt(topic) {
  return `आप बिहार बोर्ड कक्षा 10 हिंदी परीक्षा के विशेषज्ञ हैं।
विषय "${topic}" पर एक अपठित गद्यांश बनाइए जिसमें EXACTLY 7 बहुविकल्पीय प्रश्न हों।

गद्यांश की आवश्यकताएँ:
- 180-220 शब्द
- सरल और शुद्ध हिंदी, कक्षा 10 स्तर
- Bihar Board BSEB परीक्षा-शैली

प्रश्नों की आवश्यकताएँ:
- सभी प्रश्न केवल गद्यांश पर आधारित हों
- तथ्यात्मक, भावार्थ, शीर्षक और शब्द-अर्थ के प्रश्नों का मिश्रण
- प्रत्येक प्रश्न में 4 विकल्प, एक सही उत्तर

Return ONLY this JSON (no markdown, no explanation):
{"title":"...","passage":"पूरा गद्यांश...","questions":[{"english":"हिंदी प्रश्न?","hindi":"हिंदी प्रश्न?","options":["A","B","C","D"],"optionsHindi":["A","B","C","D"],"answerIndex":0}]}

Note: Put the Hindi Devanagari question in BOTH "english" and "hindi" fields. Options must also be in Hindi Devanagari.`;
}

function buildSanskritPrompt(topic) {
  return `You are a Bihar Board Class 10 Sanskrit exam expert.
Create ONE unseen Sanskrit गद्यांश (prose passage) on: "${topic}"
With EXACTLY 7 MCQ questions based strictly on the passage.

Passage requirements:
- 150-200 words in simple Sanskrit (easy Class 10 BSEB level)
- Use simple Sanskrit vocabulary suitable for Bihar Board students

Question requirements:
- Strictly passage-based
- Mix of: factual recall, word meaning (शब्दार्थ), grammatical identification, title/theme
- Each has exactly 4 options, one correct answer
- Write questions and options primarily in Hindi (Devanagari) for accessibility

Return ONLY this JSON (no markdown, no explanation):
{"title":"...","passage":"Full Sanskrit passage in Devanagari...","questions":[{"english":"Question in Hindi Devanagari?","hindi":"Same question in Hindi Devanagari?","options":["A","B","C","D"],"optionsHindi":["A","B","C","D"],"answerIndex":0}]}`;
}

async function generate(prompt) {
  const res = await ai.models.generateContent({
    model: MODEL,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: { maxOutputTokens: 4096 },
  });
  const raw = (res.text ?? '').trim();
  try { return JSON.parse(raw); }
  catch { const m = raw.match(/\{[\s\S]*\}/); return m ? JSON.parse(m[0]) : null; }
}

async function saveToFirebase(fbPath, data) {
  const res = await fetch(`${DB_URL}/${fbPath}.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.ok;
}

async function run() {
  console.log('🔤 Generating Hindi passages...');
  for (const topic of HINDI_TOPICS) {
    console.log(`  → ${topic}`);
    try {
      const data = await generate(buildHindiPrompt(topic));
      if (!data?.title || !data?.passage || !Array.isArray(data?.questions)) {
        console.log('    ✗ Invalid response, skipping');
        continue;
      }
      const payload = {
        title: data.title,
        passage: data.passage,
        questions: data.questions.map(q => ({
          english: String(q.english ?? ''),
          hindi: String(q.hindi ?? ''),
          options: (q.options ?? []).slice(0, 4).map(String),
          optionsHindi: (q.optionsHindi ?? q.options ?? []).slice(0, 4).map(String),
          correctAnswer: typeof q.answerIndex === 'number' ? q.answerIndex : 0,
          chapter: 'Comprehension',
        })),
      };
      const ok = await saveToFirebase('hindi_passages', payload);
      console.log(`    ${ok ? '✓' : '✗'} Saved: "${data.title}" (${payload.questions.length} questions)`);
      await sleep(2000);
    } catch (e) {
      console.error(`    ✗ Error: ${e.message}`);
      await sleep(3000);
    }
  }

  console.log('\n📜 Generating Sanskrit passages...');
  for (const topic of SANSKRIT_TOPICS) {
    console.log(`  → ${topic}`);
    try {
      const data = await generate(buildSanskritPrompt(topic));
      if (!data?.title || !data?.passage || !Array.isArray(data?.questions)) {
        console.log('    ✗ Invalid response, skipping');
        continue;
      }
      const payload = {
        title: data.title,
        passage: data.passage,
        questions: data.questions.map(q => ({
          english: String(q.english ?? ''),
          hindi: String(q.hindi ?? ''),
          options: (q.options ?? []).slice(0, 4).map(String),
          optionsHindi: (q.optionsHindi ?? q.options ?? []).slice(0, 4).map(String),
          correctAnswer: typeof q.answerIndex === 'number' ? q.answerIndex : 0,
          chapter: 'Comprehension',
        })),
      };
      const ok = await saveToFirebase('sanskrit_passages', payload);
      console.log(`    ${ok ? '✓' : '✗'} Saved: "${data.title}" (${payload.questions.length} questions)`);
      await sleep(2000);
    } catch (e) {
      console.error(`    ✗ Error: ${e.message}`);
      await sleep(3000);
    }
  }

  console.log('\n✅ Done! Check Firebase /hindi_passages and /sanskrit_passages');
}

run().catch(console.error);
