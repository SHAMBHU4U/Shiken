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
}): string {
  const { questionEnglish, questionHindi, options, optionsHindi, correctAnswer, subject, lang } = params;

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
    : "पूरा जवाब Hindi (Devanagari) में लिखो। English सिर्फ formulas, numbers, और scientific terms के लिए। सरल और आम Hindi words use करो।";

  const sectionLabels = lang === "en"
    ? { answer: `Correct Answer: ${correctAnswer}`, solution: "Solution:", formula: "Formula / Theory:", notes: "Remember:" }
    : { answer: `सही जवाब: ${correctAnswer}`, solution: "हल:", formula: "सूत्र / सिद्धांत:", notes: "याद रखो:" };

  return `तुम Bihar Board Class 10 के ${subject} teacher हो। एक student पहली बार यह topic पढ़ रहा है — उसे clearly समझाओ।

Question: ${questionLine}

Options:
${optsList}

Correct Answer: ${correctAnswer}

${writingRule}

STRICT FORMATTING RULES — हर rule follow करो, कोई exception नहीं:
- कोई asterisk (*), star, hash (#) या dash (-) as bullet मत use करो
- कोई markdown bold, italic, heading मत use करो
- Plain text only
- हर point के लिए • symbol use करो (number नहीं)
- Math के लिए: inline $formula$, block $$formula$$ (LaTeX)
- सूत्र का नाम Hindi में लिखो
- Total length: 12-16 lines। Short और sharp।

इस EXACT structure में लिखो — यही sections, यही order:

${sectionLabels.answer}
[एक line में — यह जवाब सही क्यों है, simple words में]

${sectionLabels.solution}
• [यह question किस concept/topic पर है — एक line में सरलता से]
• [solve करने का तरीका या सूत्र — clearly बताओ]
• [step-by-step working दिखाओ — calculation या logic के साथ]
• [final result confirm करो और सही option बताओ]

${sectionLabels.formula}
[अगर formula है तो LaTeX में लिखो। सूत्र का नाम ${lang === "hi" ? "Hindi" : "English"} में लिखो। अगर formula नहीं है तो एक line में key definition या rule।]

${sectionLabels.notes}
• [इस topic की सबसे important बात जो हर student को याद रखनी चाहिए]
• [students यहाँ सबसे common गलती करते हैं — और उससे कैसे बचें]
• [एक sharp memory trick या quick shortcut इस type के questions के लिए]`;
}

export interface GeneratedQuestion {
  english:      string;
  hindi:        string;
  options:      string[];
  optionsHindi: string[];
  answerIndex:  number;
}

export async function generateQuestions(
  subject: string,
  chapter: string,
  count: number,
): Promise<GeneratedQuestion[]> {
  if (!API_KEY) throw new Error("VITE_GEMINI_API_KEY not set");

  const ai = new GoogleGenAI({ apiKey: API_KEY });

  const prompt = `You are an expert Bihar Board exam question creator for ${subject}.

Generate exactly ${count} multiple-choice questions on the topic: "${chapter}" for Bihar Board Class 10 level.

STRICT RULES:
- Return ONLY a valid JSON array. No markdown, no explanation, no code fences.
- Each question must have exactly 4 options.
- answerIndex must be 0, 1, 2, or 3 (index of correct option).
- "hindi" field: Hindi translation of the question text (simple, clear Hindi).
- "options": answer choices written in English.
- "optionsHindi": the same 4 answer choices translated into Hindi (same order, same index).
- Questions must be factual, syllabus-appropriate, and varied in difficulty.
- Both the question AND all options must make sense in both languages.

JSON format (return ONLY this, nothing else):
[
  {
    "english": "Question text in English",
    "hindi": "प्रश्न का Hindi अनुवाद",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "optionsHindi": ["विकल्प A का हिंदी", "विकल्प B का हिंदी", "विकल्प C का हिंदी", "विकल्प D का हिंदी"],
    "answerIndex": 0
  }
]`;

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
    throw new Error("No questions returned from Gemini");
  }

  return (questions as Record<string, unknown>[])
    .map((q) => ({
      english:      String(q.english      ?? ""),
      hindi:        String(q.hindi        ?? ""),
      options:      Array.isArray(q.options)      ? (q.options      as unknown[]).map(String) : [],
      optionsHindi: Array.isArray(q.optionsHindi) ? (q.optionsHindi as unknown[]).map(String) : [],
      answerIndex:  typeof q.answerIndex === "number" ? q.answerIndex : 0,
    }))
    .filter((q) => q.english && q.options.length >= 2);
}

export async function parsePDFQuestions(
  pdfBase64: string,
  subject:   string,
  chapter:   string,
): Promise<GeneratedQuestion[]> {
  if (!API_KEY) throw new Error("VITE_GEMINI_API_KEY not set");

  const ai = new GoogleGenAI({ apiKey: API_KEY });

  const prompt = `You are an expert at extracting multiple-choice questions from Bihar Board Class 10 exam papers.

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
  if (!Array.isArray(parsed)) throw new Error("Gemini returned no questions");

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

export async function translateToEnglish(hindiText: string): Promise<string> {
  if (!API_KEY) throw new Error("VITE_GEMINI_API_KEY not set");

  const ai = new GoogleGenAI({ apiKey: API_KEY });

  const prompt = `Translate the following Hindi question to English for a Bihar Board Class 10 student.

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

export async function explainWithGemini(
  params: {
    questionEnglish: string;
    questionHindi:   string;
    options:         string[];
    optionsHindi?:   string[];
    correctAnswer:   string;
    subject:         string;
    lang:            "en" | "hi";
  },
  onChunk: (text: string) => void,
): Promise<string> {
  if (!API_KEY) throw new Error("VITE_GEMINI_API_KEY not set");

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
