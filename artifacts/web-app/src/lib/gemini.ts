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

export interface FullTranslation {
  hindi:        string;
  optionsHindi: string[];
}

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`/api/${path}`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

export async function generateQuestions(
  subject: string,
  chapter: string,
  count:   number,
  classId = "10",
): Promise<GeneratedQuestion[]> {
  const data = await apiPost<{ questions: GeneratedQuestion[] }>("generate-questions", {
    subject, chapter, count, classId,
  });
  return data.questions;
}

export async function generateComprehension(
  count   = 7,
  subject: "english" | "hindi" | "sanskrit" = "english",
): Promise<ComprehensionResult> {
  return apiPost<ComprehensionResult>("generate-comprehension", { count, subject });
}

export async function parsePDFQuestions(
  pdfBase64: string,
  subject:   string,
  chapter:   string,
): Promise<GeneratedQuestion[]> {
  const data = await apiPost<{ questions: GeneratedQuestion[] }>("parse-pdf", {
    pdfBase64, subject, chapter,
  });
  return data.questions;
}

export async function translateQuestionFull(
  english: string,
  options: string[],
  subject: string,
): Promise<FullTranslation> {
  return apiPost<FullTranslation>("translate", {
    type: "fullTranslation", english, options, subject,
  });
}

export async function translateToEnglish(hindiText: string): Promise<string> {
  const data = await apiPost<{ result: string }>("translate", {
    type: "toEnglish", hindi: hindiText,
  });
  return data.result;
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
  const res = await fetch("/api/explain", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(params),
  });

  if (!res.ok || !res.body) {
    throw new Error("Explanation request failed");
  }

  const reader  = res.body.getReader();
  const decoder = new TextDecoder();
  let fullText  = "";
  let buffer    = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      try {
        const msg = JSON.parse(line.slice(6)) as { content?: string; done?: boolean; error?: string };
        if (msg.error) throw new Error(msg.error);
        if (msg.content) {
          fullText += msg.content;
          onChunk(msg.content);
        }
      } catch { /* malformed chunk — skip */ }
    }
  }
  return fullText;
}
