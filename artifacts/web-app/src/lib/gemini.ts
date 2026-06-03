import { GoogleGenAI } from "@google/genai";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;

const FREE_MODEL = "gemini-2.0-flash-lite";

function buildPrompt(params: {
  questionEnglish: string;
  questionHindi:   string;
  options:         string[];
  optionsHindi?:   string[];
  correctAnswer:   string;
  subject:         string;
  lang:            "en" | "hi";
  classId?:        string;
}): string {
  const { questionEnglish, questionHindi, options, optionsHindi, correctAnswer, subject, lang, classId = "10" } = params;

  const isEntrance = classId === "entrance";
  const cls = classId === "12" ? "12" : isEntrance ? "" : "10";
  const isNEET = isEntrance && subject.toLowerCase().includes("biology");
  const isJEE  = isEntrance && !isNEET;
  const examName = isNEET ? "NEET" : isJEE ? "JEE Main" : "";

  const optsList = options
    .map((opt, i) => {
      const h = optionsHindi?.[i];
      if (lang === "en") return `${String.fromCharCode(65 + i)}. ${opt}`;
      return h ? `${String.fromCharCode(65 + i)}. ${h}` : `${String.fromCharCode(65 + i)}. ${opt}`;
    })
    .join("\n");

  const questionLine = lang === "en" ? questionEnglish : (questionHindi || questionEnglish);

  const writingRule = lang === "en"
    ? "Write ENTIRELY in simple English. Short sentences. Beginner-friendly."
    : "पूरा जवाब Hindi (Devanagari) में लिखो। English सिर्फ formulas, numbers, technical terms, और NCERT chapter names के लिए। सरल आम Hindi use करो।";

  if (isEntrance) {
    const answerLabel  = lang === "en" ? `Correct Answer: ${correctAnswer}` : `सही जवाब: ${correctAnswer}`;
    const solutionLabel = lang === "en" ? "Step-by-Step Solution:" : "हल:";
    const formulaLabel  = lang === "en" ? "Key Formula / Concept:" : "मुख्य सूत्र / अवधारणा:";
    const rememberLabel = lang === "en" ? "Points to Remember:" : "याद रखो (Extra Points):";

    return `You are a top ${examName} faculty. Explain this ${subject} question to a student preparing for ${examName}.

Question: ${questionLine}

Options:
${optsList}

${answerLabel}

${writingRule}

STRICT FORMATTING:
- No asterisk (*), hash (#), or dash (-) as bullet — use • only
- No markdown bold/italic/heading — plain text only
- Math: inline $formula$, display $$formula$$ (LaTeX/KaTeX)
- Total: 14-18 lines — sharp, exam-focused, not a textbook

Write in this EXACT structure:

${answerLabel}
[One line — why this option is correct, exam-focused]

${solutionLabel}
• [Identify the concept/law/formula this question tests — name it clearly]
• [Apply the formula or logic — show calculation or reasoning step by step]
• [Show all key steps — intermediate results if numerical]
• [Confirm the final answer matches option ${correctAnswer}]

${formulaLabel}
[LaTeX formula if applicable. Name the law/formula. If no formula, give the key NCERT statement/definition.]

${rememberLabel}
• [Most important exam fact about this topic — tested frequently in ${examName}]
• [Common mistake students make and how to avoid it]
• [Quick trick or mnemonic for this type of ${examName} question]
• [High-yield related concept that often appears alongside in ${examName}]`;
  }

  const boardCtx  = `BSEB/CBSE Class ${cls} ${subject}`;
  const ncertRef  = `NCERT Class ${cls} ${subject}`;
  const answerLabel   = lang === "en" ? `Correct Answer: ${correctAnswer}` : `सही जवाब: ${correctAnswer}`;
  const solutionLabel = lang === "en" ? "Solution:" : "हल:";
  const ncertLabel    = lang === "en" ? `NCERT Concept (${ncertRef}):` : `NCERT अवधारणा (${ncertRef}):`;
  const rememberLabel = lang === "en" ? "Remember:" : "याद रखो:";

  return `तुम ${boardCtx} के expert teacher हो। Explanation strictly NCERT Class ${cls} ${subject} textbook content पर आधारित होनी चाहिए।

Question: ${questionLine}

Options:
${optsList}

${answerLabel}

${writingRule}

STRICT FORMATTING — हर rule follow करो:
- कोई asterisk (*), star, hash (#) या dash (-) as bullet मत use करो — सिर्फ • use करो
- कोई markdown bold, italic, heading मत use करो — plain text only
- Math: inline $formula$, block $$formula$$ (LaTeX/KaTeX)
- NCERT chapter name mention करो जहाँ relevant हो
- Total: 12-16 lines। Short, clear, exam-focused।

इस EXACT structure में लिखो:

${answerLabel}
[एक line — यह जवाब सही क्यों है, NCERT concept से connect करो]

${solutionLabel}
• [NCERT Class ${cls} का कौन सा chapter/topic यह question cover करता है — clearly बताओ]
• [NCERT textbook की definition, formula, या key statement जो इस question को solve करती है]
• [Step-by-step working — calculation या logic clearly दिखाओ]
• [Final answer confirm करो — सही option बताओ और क्यों बाकी options wrong हैं]

${ncertLabel}
[Relevant formula LaTeX में, या NCERT की exact key definition/rule। Chapter name mention करो।]

${rememberLabel}
• [इस NCERT topic की सबसे important बात जो Board exam में बार-बार आती है]
• [Students यहाँ सबसे common गलती करते हैं — और उससे कैसे बचें]
• [एक sharp memory trick जो Board exam में काम आएगी]`;
}

export interface GeneratedQuestion {
  english:      string;
  hindi:        string;
  options:      string[];
  optionsHindi: string[];
  answerIndex:  number;
}

export interface ComprehensionResult {
  title:     string;
  passage:   string;
  questions: GeneratedQuestion[];
}

export async function generateComprehension(
  count = 7,
  subject: "english" | "hindi" | "sanskrit" = "english",
): Promise<ComprehensionResult> {
  if (!API_KEY) throw new Error("Shiken Engine API key not set");
  const ai = new GoogleGenAI({ apiKey: API_KEY });

  let prompt: string;

  if (subject === "hindi") {
    const topics = [
      "पर्यावरण की रक्षा और पेड़-पौधों का महत्त्व",
      "जल संरक्षण की आवश्यकता",
      "किसी महान भारतीय नेता या वैज्ञानिक का जीवन परिचय",
      "शिक्षा का महत्त्व और राष्ट्र-निर्माण",
      "स्वास्थ्य और स्वच्छता का जीवन में महत्त्व",
    ];
    const topic = topics[Math.floor(Math.random() * topics.length)];
    prompt = `आप बोर्ड कक्षा 10 हिंदी परीक्षा के विशेषज्ञ हैं।
विषय "${topic}" पर एक अपठित गद्यांश बनाइए जिसमें EXACTLY ${count} बहुविकल्पीय प्रश्न हों।

गद्यांश की आवश्यकताएँ:
- 180-220 शब्द
- सरल और शुद्ध हिंदी, कक्षा 10 स्तर
- Board परीक्षा-शैली

प्रश्नों की आवश्यकताएँ:
- सभी प्रश्न केवल गद्यांश पर आधारित हों
- तथ्यात्मक, भावार्थ, शीर्षक और शब्द-अर्थ के प्रश्नों का मिश्रण
- प्रत्येक प्रश्न में 4 विकल्प, एक सही उत्तर

Return ONLY this JSON (no markdown, no explanation):
{"title":"...","passage":"पूरा गद्यांश...","questions":[{"english":"Hindi question in Devanagari?","hindi":"Same question in Devanagari?","options":["A","B","C","D"],"optionsHindi":["A","B","C","D"],"answerIndex":0}]}

Note: For Hindi subject, put the Hindi Devanagari question in BOTH the "english" and "hindi" fields. Options must also be in Hindi Devanagari.`;
  } else if (subject === "sanskrit") {
    const topics = [
      "सत्यस्य महत्त्वम्",
      "विद्यायाः महत्त्वम्",
      "प्रकृतिः एव माता",
      "परिश्रमस्य फलम्",
      "मातृभूमिः स्वर्गादपि गरीयसी",
    ];
    const topic = topics[Math.floor(Math.random() * topics.length)];
    prompt = `You are a Board Class 10 Sanskrit exam expert.
Create ONE unseen Sanskrit गद्यांश (prose passage) on: "${topic}"
With EXACTLY ${count} MCQ questions based strictly on the passage.

Passage requirements:
- 150-200 words in simple Sanskrit (easy Class 10 BSEB level)
- Use simple Sanskrit vocabulary suitable for Board students

Question requirements:
- Strictly passage-based
- Mix of: factual recall, word meaning (शब्दार्थ), grammatical identification, title/theme
- Each has exactly 4 options, one correct answer
- Write questions and options primarily in Hindi (Devanagari) for accessibility

Return ONLY this JSON (no markdown, no explanation):
{"title":"...","passage":"Full Sanskrit passage in Devanagari...","questions":[{"english":"Question in Hindi Devanagari?","hindi":"Same question in Hindi Devanagari?","options":["A","B","C","D"],"optionsHindi":["A","B","C","D"],"answerIndex":0}]}`;
  } else {
    const topics = [
      "the importance of trees and forests",
      "water conservation and saving water",
      "the life of a great Indian leader or scientist",
      "the importance of education for progress",
      "environmental pollution and its effects",
    ];
    const topic = topics[Math.floor(Math.random() * topics.length)];
    prompt = `You are a Board Class 10 English exam expert.
Create ONE unseen comprehension passage on: "${topic}"
With EXACTLY ${count} MCQ questions strictly based on the passage.

Passage requirements:
- 180-240 words
- Class 10 level formal English
- Clear and informative

Question requirements:
- Strictly passage-based (no general knowledge)
- Mix of: factual recall, inference, vocabulary in context, title identification
- Each has exactly 4 options, one correct answer

Return ONLY this JSON (no markdown, no explanation):
{"title":"...","passage":"Full passage text...","questions":[{"english":"Q?","hindi":"हिंदी प्रश्न?","options":["A","B","C","D"],"optionsHindi":["A","B","C","D"],"answerIndex":0}]}`;
  }

  const response = await ai.models.generateContent({
    model: FREE_MODEL,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: { maxOutputTokens: 4096 },
  });

  const raw = (response.text ?? "").trim();
  let parsed: Record<string, unknown>;
  try { parsed = JSON.parse(raw); }
  catch { const m = raw.match(/\{[\s\S]*\}/); parsed = m ? JSON.parse(m[0]) : {}; }

  const isHindiLike = subject === "hindi" || subject === "sanskrit";
  const questions: GeneratedQuestion[] = Array.isArray(parsed.questions)
    ? (parsed.questions as Record<string, unknown>[])
        .map((q) => ({
          english:      String(q.english      ?? ""),
          hindi:        String(q.hindi        ?? ""),
          options:      Array.isArray(q.options)      ? (q.options as unknown[]).map(String).slice(0, 4) : [],
          optionsHindi: Array.isArray(q.optionsHindi) ? (q.optionsHindi as unknown[]).map(String).slice(0, 4) : [],
          answerIndex:  typeof q.answerIndex === "number" ? q.answerIndex : 0,
        }))
        .filter((q) => (isHindiLike ? (q.english || q.hindi) : q.english) && q.options.length >= 2)
    : [];

  return {
    title:     String(parsed.title   ?? "Unseen Passage"),
    passage:   String(parsed.passage ?? ""),
    questions,
  };
}

// Hindi grammar chapters for Board Class 10
const HINDI_GRAMMAR_CHAPTERS = [
  "वर्ण विचार", "संज्ञा", "सर्वनाम", "क्रिया", "विशेषण",
  "संधि", "समास", "काल", "कारक",
  "मुहावरे", "लोकोक्तियाँ", "शुद्ध-अशुद्ध वाक्य", "एक शब्द",
];

// Sanskrit grammar chapters for Board Class 10
const SANSKRIT_GRAMMAR_CHAPTERS = [
  "संधि", "समास", "प्रकरणम्", "प्रत्यय", "शब्दरूप", "धातुरूप", "वाक्य रचना",
];

export async function generateQuestions(
  subject: string,
  chapter: string,
  count: number,
  classId = "10",
): Promise<GeneratedQuestion[]> {
  if (!API_KEY) throw new Error("Shiken Engine API key not set");

  const ai = new GoogleGenAI({ apiKey: API_KEY });

  const isHindi    = subject.toLowerCase().includes("hindi");
  const isSanskrit = subject.toLowerCase().includes("sanskrit");
  const isEntrance = classId === "entrance";
  const cls = classId === "12" ? "12" : isEntrance ? "" : "10";
  const isNEET = isEntrance && subject.toLowerCase().includes("biology");

  const effectiveChapter =
    isHindi    && (!chapter || chapter === "?" || chapter === "General")
      ? HINDI_GRAMMAR_CHAPTERS[Math.floor(Math.random() * HINDI_GRAMMAR_CHAPTERS.length)]
    : isSanskrit && (!chapter || chapter === "?" || chapter === "General")
      ? SANSKRIT_GRAMMAR_CHAPTERS[Math.floor(Math.random() * SANSKRIT_GRAMMAR_CHAPTERS.length)]
    : chapter;

  let prompt: string;

  if (isHindi) {
    const boardLine = cls
      ? `BSEB/CBSE Class ${cls} Hindi Vyakaran Board exam 2022-2025 pattern, NCERT Class ${cls} पाठ्यक्रम पर आधारित`
      : "latest Board exam pattern";
    prompt = `तुम ${boardLine} के Hindi Vyakaran (व्याकरण) के expert हो।

"${effectiveChapter}" topic पर EXACTLY ${count} MCQ questions बनाओ।

प्रश्न की विशेषताएँ:
- ${boardLine} के अनुसार
- Questions vary करें: definitions, fill-in-blank, identification, examples, sentence correction
- Difficulty: 30% easy, 50% medium, 20% hard

STRICT RULES:
- Return ONLY a valid JSON array — no markdown, no code fences.
- "hindi": प्रश्न Devanagari में (यही main question है)
- "english": same question in English
- "options": EXACTLY 4 Devanagari Hindi strings
- "optionsHindi": same 4 options (copy)
- "answerIndex": 0-3

JSON format (return ONLY this):
[{"hindi":"...","english":"...","options":["...","...","...","..."],"optionsHindi":["...","...","...","..."],"answerIndex":0}]`;
  } else if (isSanskrit) {
    const boardLine = cls
      ? `BSEB/CBSE Class ${cls} Sanskrit Board exam pattern, NCERT Class ${cls} Sanskrit पाठ्यक्रम पर आधारित`
      : "latest Board exam pattern";
    prompt = `तुम ${boardLine} के Sanskrit Vyakaran expert हो।

"${effectiveChapter}" topic पर EXACTLY ${count} MCQ questions बनाओ।

STRICT RULES:
- Return ONLY a valid JSON array — no markdown, no code fences।
- "hindi": प्रश्न Devanagari में (Sanskrit/Hindi)।
- "english": same question in simple English।
- "options": EXACTLY 4 Devanagari strings।
- "optionsHindi": same 4 options (copy)।
- "answerIndex": 0-3।
- Questions must vary: रूप पहचानना, विग्रह, नाम पहचानना, fill-in-blank।

JSON format (return ONLY this):
[{"hindi":"...","english":"...","options":["...","...","...","..."],"optionsHindi":["...","...","...","..."],"answerIndex":0}]`;
  } else if (isEntrance) {
    const examName = isNEET ? "NEET" : "JEE Main";
    prompt = `You are an expert NTA ${examName} question setter for ${subject}.

Generate EXACTLY ${count} MCQ questions on: "${effectiveChapter}"

Strictly follow NTA ${examName} 2022-2025 official pattern:
- ${isNEET ? "100% NCERT-based: factual (30%), conceptual (40%), application/diagram-based (30%)" : "Conceptual (30%), numerical-based MCQ (40%), statement/assertion-reason (15%), match-the-column (15%)"}
- Difficulty: ${isNEET ? "50% medium (NCERT direct), 30% conceptual, 20% application" : "40% medium, 60% hard (JEE Main standard)"}
- All 4 options must be plausible — target common misconceptions

STRICT RULES:
- Return ONLY a valid JSON array. No markdown, no code fences.
- Each question has EXACTLY 4 options.
- answerIndex: 0, 1, 2, or 3
- Use $...$ for inline math and $$...$$ for display math (KaTeX)
- "hindi": Hindi translation of the question
- "optionsHindi": same 4 options in Hindi

JSON format (return ONLY this):
[
  {
    "english": "Question text in English",
    "hindi": "प्रश्न का Hindi अनुवाद",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "optionsHindi": ["विकल्प A", "विकल्प B", "विकल्प C", "विकल्प D"],
    "answerIndex": 0
  }
]`;
  } else {
    const boardCtx = `BSEB/CBSE Class ${cls} ${subject} Board exam 2022-2025 pattern, strictly based on NCERT Class ${cls} ${subject} textbook`;
    prompt = `You are an expert ${boardCtx} question creator.

Generate EXACTLY ${count} MCQ questions on: "${effectiveChapter}"

Strictly follow ${boardCtx}:
- Base questions directly on NCERT Class ${cls} ${subject} textbook content
- Mix question types: direct recall (NCERT text), diagram/application-based, fill-in-the-blank, NCERT exercise style
- Match the exact style of recent BSEB/CBSE 2022-2025 board papers
- Difficulty: 40% easy (NCERT direct), 40% medium, 20% application-based
- Use $...$ for inline math, $$...$$ for display math (KaTeX)

STRICT RULES:
- Return ONLY a valid JSON array. No markdown, no explanation, no code fences.
- Each question has exactly 4 options. answerIndex: 0, 1, 2, or 3.
- "hindi": simple Hindi translation (Devanagari).
- "optionsHindi": same 4 options in Hindi (same order).

JSON format (return ONLY this):
[
  {
    "english": "Question text in English",
    "hindi": "प्रश्न का Hindi अनुवाद",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "optionsHindi": ["विकल्प A", "विकल्प B", "विकल्प C", "विकल्प D"],
    "answerIndex": 0
  }
]`;
  }

  const response = await ai.models.generateContent({
    model: FREE_MODEL,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: { maxOutputTokens: 4096, responseMimeType: "application/json" },
  });

  const raw = response.text ?? "[]";
  let questions: unknown[];
  try {
    questions = JSON.parse(raw);
  } catch {
    const match = raw.match(/\[[\s\S]*\]/);
    questions = match ? JSON.parse(match[0]) : [];
  }

  if (!Array.isArray(questions) || questions.length === 0) {
    throw new Error("No questions returned from AI");
  }

  return (questions as Record<string, unknown>[])
    .map((q) => ({
      english:      String(q.english      ?? ""),
      hindi:        String(q.hindi        ?? ""),
      options:      Array.isArray(q.options)      ? (q.options      as unknown[]).map(String) : [],
      optionsHindi: Array.isArray(q.optionsHindi) ? (q.optionsHindi as unknown[]).map(String) : [],
      answerIndex:  typeof q.answerIndex === "number" ? q.answerIndex : 0,
    }))
    // For Hindi, questions are Devanagari-primary so accept if either field is present
    .filter((q) => (q.english || q.hindi) && q.options.length >= 2);
}

export async function parsePDFQuestions(
  pdfBase64: string,
  subject:   string,
  chapter:   string,
): Promise<GeneratedQuestion[]> {
  if (!API_KEY) throw new Error("Shiken Engine API key not set");

  const ai = new GoogleGenAI({ apiKey: API_KEY });

  const prompt = `You are an expert at extracting multiple-choice questions from Board Class 10 exam papers.

Extract ALL multiple-choice questions from this PDF document.
Subject: ${subject}
Chapter / Topic: ${chapter}

For each question:
- Write "english" field: the full question in English
- Write "hindi" field: the full question in Hindi (Devanagari script)
- Write "options": exactly 4 answer choices in English (A, B, C, D)
- Write "optionsHindi": same 4 choices translated to Hindi
- Write "answerIndex": 0, 1, 2, or 3 (index of correct answer). If answer key is provided use it; otherwise use subject knowledge.

STRICT RULES:
- Return ONLY a valid JSON array. No markdown, no code fences, no explanation.
- Skip incomplete questions or those with fewer than 4 options.
- Ignore page numbers, headers, footers, instructions text.
- If question is only in Hindi, still fill English field with a translation.

JSON format (return ONLY this):
[
  {
    "english": "Question text in English",
    "hindi": "प्रश्न हिंदी में",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "optionsHindi": ["विकल्प A", "विकल्प B", "विकल्प C", "विकल्प D"],
    "answerIndex": 0
  }
]`;

  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: [{
      role: "user",
      parts: [
        { inlineData: { mimeType: "application/pdf", data: pdfBase64 } },
        { text: prompt },
      ],
    }],
    config: { maxOutputTokens: 8192, responseMimeType: "application/json" },
  });

  const raw = response.text ?? "[]";
  let parsed: unknown[];
  try {
    parsed = JSON.parse(raw);
  } catch {
    const match = raw.match(/\[[\s\S]*\]/);
    parsed = match ? JSON.parse(match[0]) : [];
  }
  if (!Array.isArray(parsed)) throw new Error("AI returned no questions");

  return (parsed as Record<string, unknown>[])
    .map((q) => ({
      english:      String(q.english      ?? ""),
      hindi:        String(q.hindi        ?? ""),
      options:      Array.isArray(q.options)      ? (q.options      as unknown[]).map(String) : [],
      optionsHindi: Array.isArray(q.optionsHindi) ? (q.optionsHindi as unknown[]).map(String) : [],
      answerIndex:  typeof q.answerIndex === "number" ? q.answerIndex : 0,
    }))
    .filter((q) => (q.english || q.hindi) && q.options.length >= 2);
}

export interface FullTranslation {
  hindi: string;
  optionsHindi: string[];
}

// Translates an English question + options fully into Hindi using the Shiken Engine.
// Returns { hindi: translated question, optionsHindi: [4 translated options] }
export async function translateQuestionFull(
  english: string,
  options: string[],
  subject: string,
): Promise<FullTranslation> {
  if (!API_KEY) throw new Error("Shiken Engine API key not set");
  const ai = new GoogleGenAI({ apiKey: API_KEY });

  const prompt = `You are a Board exam translator. Translate this ${subject} question and its options from English into simple Hindi (Devanagari).

English Question:
${english}

Options:
${options.map((o, i) => `${String.fromCharCode(65 + i)}. ${o}`).join("\n")}

STRICT RULES:
- Return ONLY valid JSON, no markdown, no explanation.
- Keep numbers, formulas, scientific symbols, and proper nouns unchanged.
- Use simple Hindi that a Class 10/12 Board student easily understands.
- JSON format exactly:
{"hindi":"translated question here","optionsHindi":["option A Hindi","option B Hindi","option C Hindi","option D Hindi"]}`;

  const response = await ai.models.generateContent({
    model: FREE_MODEL,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: { temperature: 0.1, maxOutputTokens: 512, responseMimeType: "application/json" },
  });

  const raw = (response.text ?? "").trim();
  let parsed: Record<string, unknown>;
  try { parsed = JSON.parse(raw); }
  catch { const m = raw.match(/\{[\s\S]*\}/); parsed = m ? JSON.parse(m[0]) : {}; }

  return {
    hindi: String(parsed.hindi ?? english),
    optionsHindi: Array.isArray(parsed.optionsHindi)
      ? (parsed.optionsHindi as unknown[]).map(String).slice(0, 4)
      : options,
  };
}

export async function translateToEnglish(hindiText: string): Promise<string> {
  if (!API_KEY) throw new Error("Shiken Engine API key not set");

  const ai = new GoogleGenAI({ apiKey: API_KEY });

  const prompt = `Translate the following Hindi question to English for a Board Class 10 student.

STRICT RULES:
- Return ONLY the translated English question text.
- Keep fill-in-the-blank markers (............, ........., ___) exactly as-is.
- Keep any English words, numbers, or formulas unchanged.
- Use simple, clear English suitable for a 10th grade student.
- Do NOT add any explanation, prefix, or extra text. Just the translation.

Hindi question:
${hindiText}`;

  const response = await ai.models.generateContent({
    model: FREE_MODEL,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: { temperature: 0.2, maxOutputTokens: 256 },
  });

  return (response.text ?? "").trim();
}

export async function explainWithShikenEngine(
  params: {
    questionEnglish: string;
    questionHindi:   string;
    options:         string[];
    optionsHindi?:   string[];
    correctAnswer:   string;
    subject:         string;
    lang:            "en" | "hi";
    classId?:        string;
  },
  onChunk: (text: string) => void,
): Promise<string> {
  if (!API_KEY) throw new Error("Shiken Engine API key not set");

  const ai = new GoogleGenAI({ apiKey: API_KEY });
  const prompt = buildPrompt(params);

  const stream = await ai.models.generateContentStream({
    model: FREE_MODEL,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: { temperature: 0.4, maxOutputTokens: 1024 },
  });

  let fullText = "";
  for await (const chunk of stream) {
    const text = chunk.text ?? "";
    if (text) {
      fullText += text;
      onChunk(text);
    }
  }
  return fullText;
}
