import { useEffect, useMemo, useState } from "react";
import { get, push, ref, remove, set, update } from "firebase/database";
import { useLocation } from "wouter";
import { db } from "@/firebase";
import {
  BPSC_CATEGORIES,
  BPSC_CURRENT_AFFAIRS_CATEGORIES,
  BPSC_DB_ROOT,
  BPSC_DEFAULT_DURATION_SECONDS,
  BPSC_PLAN_ID,
  emptyBpscOptions,
  safeBpscSlug,
  type BpscCategory,
  type BpscCurrentAffairsCategory,
  type BpscLanguage,
} from "@/lib/bpsc";

type AnswerKey = "A" | "B" | "C" | "D";
const ANSWERS: AnswerKey[] = ["A", "B", "C", "D"];
const INPUT = "w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/25 focus:border-emerald-400";
const PANEL = "rounded-2xl border border-white/10 bg-white/[0.04] p-4";

type QuestionRecord = {
  id: string;
  category: BpscCategory;
  question_hi: string;
  question_en: string;
  options_hi: Record<AnswerKey, string>;
  options_en: Record<AnswerKey, string>;
  correct_answer: AnswerKey;
  explanation_hi?: string;
  explanation_en?: string;
  topic?: string;
  year?: string;
  published: boolean;
};

type QuestionForm = Omit<QuestionRecord, "id" | "published"> & { id?: string; published: boolean };
type AdminTab = "questions" | "tests" | "affairs" | "notes" | "pricing";

const emptyQuestion = (): QuestionForm => ({
  category: "history",
  question_hi: "",
  question_en: "",
  options_hi: emptyBpscOptions(),
  options_en: emptyBpscOptions(),
  correct_answer: "A",
  explanation_hi: "",
  explanation_en: "",
  topic: "",
  year: "",
  published: true,
});

function cleanOptions(value: unknown): Record<AnswerKey, string> {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return Object.fromEntries(ANSWERS.map((key) => [key, String(source[key] ?? "")])) as Record<AnswerKey, string>;
}

function normalizeQuestion(raw: Record<string, unknown>, category: BpscCategory, id = ""): QuestionRecord {
  return {
    id,
    category,
    question_hi: String(raw.question_hi ?? ""),
    question_en: String(raw.question_en ?? ""),
    options_hi: cleanOptions(raw.options_hi),
    options_en: cleanOptions(raw.options_en),
    correct_answer: String(raw.correct_answer ?? "A").toUpperCase() as AnswerKey,
    explanation_hi: String(raw.explanation_hi ?? ""),
    explanation_en: String(raw.explanation_en ?? ""),
    topic: String(raw.topic ?? ""),
    year: String(raw.year ?? ""),
    published: raw.published !== false,
  };
}

function questionPayload(question: QuestionForm) {
  return {
    category: question.category,
    question_hi: question.question_hi.trim(),
    question_en: question.question_en.trim(),
    options_hi: Object.fromEntries(ANSWERS.map((key) => [key, question.options_hi[key].trim()])),
    options_en: Object.fromEntries(ANSWERS.map((key) => [key, question.options_en[key].trim()])),
    correct_answer: question.correct_answer,
    explanation_hi: question.explanation_hi?.trim() || "",
    explanation_en: question.explanation_en?.trim() || "",
    topic: question.topic?.trim() || "",
    year: question.year?.trim() || "",
    published: question.published,
    updatedAt: Date.now(),
  };
}

function validateQuestion(question: QuestionForm): string[] {
  const errors: string[] = [];
  if (!question.question_hi.trim()) errors.push("Hindi question is required");
  if (!question.question_en.trim()) errors.push("English question is required");
  for (const key of ANSWERS) {
    if (!question.options_hi[key].trim()) errors.push(`Hindi option ${key} is required`);
    if (!question.options_en[key].trim()) errors.push(`English option ${key} is required`);
  }
  if (!ANSWERS.includes(question.correct_answer)) errors.push("Correct answer must be A, B, C or D");
  return errors;
}

function csvCells(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"' && line[i + 1] === '"') { current += '"'; i += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { cells.push(current.trim()); current = ""; }
    else current += char;
  }
  cells.push(current.trim());
  return cells;
}

function parseBulkText(text: string): QuestionForm[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("[")) {
    const parsed = JSON.parse(trimmed) as Array<Record<string, unknown>>;
    return parsed.map((raw) => normalizeQuestion(raw, String(raw.category ?? "history") as BpscCategory)).map(({ id: _id, ...question }) => question);
  }
  const lines = trimmed.split(/\r?\n/).filter(Boolean);
  const headers = csvCells(lines[0]).map((header) => header.toLowerCase().trim());
  return lines.slice(1).map((line) => {
    const values = Object.fromEntries(headers.map((header, index) => [header, csvCells(line)[index] ?? ""]));
    const options = (prefix: string) => Object.fromEntries(ANSWERS.map((key) => [key, values[`${prefix}_${key.toLowerCase()}`] ?? ""])) as Record<AnswerKey, string>;
    return {
      category: (values.category || "history") as BpscCategory,
      question_hi: values.question_hi || "",
      question_en: values.question_en || "",
      options_hi: options("option_hi"),
      options_en: options("option_en"),
      correct_answer: (values.correct_answer || "A").toUpperCase() as AnswerKey,
      explanation_hi: values.explanation_hi || "",
      explanation_en: values.explanation_en || "",
      topic: values.topic || "",
      year: values.year || "",
      published: values.published !== "false",
    };
  });
}

function downloadTemplate() {
  const header = "category,question_hi,question_en,option_hi_a,option_hi_b,option_hi_c,option_hi_d,option_en_a,option_en_b,option_en_c,option_en_d,correct_answer,explanation_hi,explanation_en,topic,year,published";
  const sample = "history,\"प्रश्न लिखें\",\"Write the question\",\"विकल्प A\",\"विकल्प B\",\"विकल्प C\",\"विकल्प D\",\"Option A\",\"Option B\",\"Option C\",\"Option D\",A,\"हिंदी व्याख्या\",\"English explanation\",General,2025,true";
  const url = URL.createObjectURL(new Blob([`${header}\n${sample}\n`], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "bpsc-question-template.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

function TextArea({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return <textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} rows={3} className={`${INPUT} resize-y`} />;
}

export default function BPSCAdminPage() {
  const [, navigate] = useLocation();
  const [tab, setTab] = useState<AdminTab>("questions");
  const [questions, setQuestions] = useState<QuestionRecord[]>([]);
  const [tests, setTests] = useState<Array<Record<string, unknown> & { id: string }>>([]);
  const [affairs, setAffairs] = useState<Array<Record<string, unknown> & { id: string }>>([]);
  const [notes, setNotes] = useState<Array<Record<string, unknown> & { id: string }>>([]);
  const [question, setQuestion] = useState<QuestionForm>(emptyQuestion);
  const [bulkText, setBulkText] = useState("");
  const [bulkPreview, setBulkPreview] = useState<QuestionForm[]>([]);
  const [bulkErrors, setBulkErrors] = useState<string[]>([]);
  const [editingId, setEditingId] = useState("");
  const [message, setMessage] = useState("");
  const [testForm, setTestForm] = useState({ name: "", description: "", minutes: "120", marks: "1", negative: "0", questionIds: "" });
  const [editingTestId, setEditingTestId] = useState("");
  const [affairForm, setAffairForm] = useState({ category: "national" as BpscCurrentAffairsCategory, title_hi: "", title_en: "", content_hi: "", content_en: "", date: "", published: true });
  const [editingAffairId, setEditingAffairId] = useState("");
  const [noteForm, setNoteForm] = useState({ title: "", description: "", category: "General", language: "both" as BpscLanguage, pdfUrl: "", published: true });
  const [editingNoteId, setEditingNoteId] = useState("");
  const [priceForm, setPriceForm] = useState({ amount: "199", days: "30" });

  async function loadData() {
    const [questionSnaps, testSnap, affairSnap, noteSnap, priceSnap] = await Promise.all([
      Promise.all(BPSC_CATEGORIES.map(async (item) => ({ category: item.id, snap: await get(ref(db, `${BPSC_DB_ROOT}/questions/${item.id}`)) }))),
      get(ref(db, `${BPSC_DB_ROOT}/tests`)),
      get(ref(db, `${BPSC_DB_ROOT}/currentAffairs`)),
      get(ref(db, `${BPSC_DB_ROOT}/notes`)),
      get(ref(db, `competitiveExams/planConfig/${BPSC_PLAN_ID}`)),
    ]);
    setQuestions(questionSnaps.flatMap(({ category, snap }) => snap.exists()
      ? Object.entries(snap.val() as Record<string, Record<string, unknown>>).map(([id, raw]) => normalizeQuestion(raw, category, id))
      : []));
    const records = (snap: { exists: () => boolean; val: () => unknown }) => snap.exists() ? Object.entries(snap.val() as Record<string, Record<string, unknown>>).map(([id, raw]) => ({ id, ...raw })) : [];
    setTests(records(testSnap));
    setAffairs(records(affairSnap));
    setNotes(records(noteSnap));
    if (priceSnap.exists()) {
      const raw = priceSnap.val() as Record<string, unknown>;
      setPriceForm({ amount: String(raw.amount ?? 199), days: String(raw.days ?? 30) });
    }
  }

  useEffect(() => { void loadData(); }, []);

  const visibleQuestions = useMemo(() => questions.slice().sort((a, b) => Number(b.year || 0) - Number(a.year || 0)), [questions]);
  const setQuestionField = <K extends keyof QuestionForm>(key: K, value: QuestionForm[K]) => setQuestion((current) => ({ ...current, [key]: value }));
  const setOption = (language: "hi" | "en", key: AnswerKey, value: string) => setQuestion((current) => ({ ...current, [`options_${language}`]: { ...current[`options_${language}`], [key]: value } }));
  const flash = (text: string) => { setMessage(text); window.setTimeout(() => setMessage(""), 3000); };

  async function saveQuestion() {
    const errors = validateQuestion(question);
    if (errors.length) { flash(errors.join(" · ")); return; }
    const payload = questionPayload(question);
    if (editingId) await update(ref(db, `${BPSC_DB_ROOT}/questions/${question.category}/${editingId}`), payload);
    else await set(ref(db, `${BPSC_DB_ROOT}/questions/${question.category}/${push(ref(db)).key}`), payload);
    setQuestion(emptyQuestion()); setEditingId(""); await loadData(); flash("Question saved.");
  }

  async function saveBulk() {
    const rows = bulkPreview.length ? bulkPreview : parseBulkText(bulkText);
    if (!rows.length) { flash("Paste CSV/JSON and preview it first."); return; }
    const invalid = rows.flatMap((row, index) => validateQuestion(row).map((error) => `Row ${index + 1}: ${error}`));
    if (invalid.length) { setBulkErrors(invalid); flash("Fix the validation errors shown in the preview."); return; }
    await Promise.all(rows.map((row) => set(ref(db, `${BPSC_DB_ROOT}/questions/${row.category}/${push(ref(db)).key}`), questionPayload(row))));
    setBulkText(""); setBulkPreview([]); setBulkErrors([]); await loadData(); flash(`${rows.length} questions uploaded.`);
  }

  async function toggleQuestion(item: QuestionRecord) {
    await update(ref(db, `${BPSC_DB_ROOT}/questions/${item.category}/${item.id}`), { published: !item.published, updatedAt: Date.now() });
    await loadData();
  }

  async function saveTest() {
    const ids = testForm.questionIds.split(",").map((id) => id.trim()).filter(Boolean);
    if (!testForm.name.trim() || !ids.length) { flash("Test name and at least one question ID are required."); return; }
    const testId = editingTestId || `${safeBpscSlug(testForm.name)}-${Date.now()}`;
    await set(ref(db, `${BPSC_DB_ROOT}/tests/${testId}`), {
      name: testForm.name.trim(), description: testForm.description.trim(), durationSeconds: Math.max(60, Number(testForm.minutes) * 60),
      marksPerQuestion: Number(testForm.marks) || 1, negativeMark: Number(testForm.negative) || 0, questionIds: ids, published: true, updatedAt: Date.now(),
    });
    setTestForm({ name: "", description: "", minutes: "120", marks: "1", negative: "0", questionIds: "" }); setEditingTestId(""); await loadData(); flash("Mock test saved.");
  }

  async function saveAffair() {
    if (!affairForm.title_hi.trim() || !affairForm.title_en.trim() || !affairForm.content_en.trim()) { flash("Both titles and English content are required."); return; }
    const affairId = editingAffairId || `${safeBpscSlug(affairForm.title_en)}-${Date.now()}`;
    await set(ref(db, `${BPSC_DB_ROOT}/currentAffairs/${affairId}`), { ...affairForm, updatedAt: Date.now() });
    setAffairForm({ category: "national", title_hi: "", title_en: "", content_hi: "", content_en: "", date: "", published: true }); setEditingAffairId(""); await loadData(); flash("Current affair saved.");
  }

  async function saveNote() {
    if (!noteForm.title.trim() || !noteForm.pdfUrl.trim()) { flash("Note title and PDF URL are required."); return; }
    const noteId = editingNoteId || `${safeBpscSlug(noteForm.title)}-${Date.now()}`;
    await set(ref(db, `${BPSC_DB_ROOT}/notes/${noteId}`), { ...noteForm, updatedAt: Date.now() });
    setNoteForm({ title: "", description: "", category: "General", language: "both", pdfUrl: "", published: true }); setEditingNoteId(""); await loadData(); flash("Note saved.");
  }

  async function savePricing() {
    const amount = Number(priceForm.amount);
    const days = Number(priceForm.days);
    if (!Number.isInteger(amount) || amount < 1 || amount > 100000 || !Number.isInteger(days) || days < 1 || days > 3650) { flash("Price and duration are outside the allowed range."); return; }
    await set(ref(db, `competitiveExams/planConfig/${BPSC_PLAN_ID}`), { amount, days, updatedAt: Date.now(), name: "BPSC Prelims CCE Premium", currency: "INR" });
    flash("BPSC pricing saved. New orders use this server-side configuration.");
  }

  function editItem(item: QuestionRecord) {
    setQuestion({ ...item, options_hi: { ...item.options_hi }, options_en: { ...item.options_en } }); setEditingId(item.id); setTab("questions");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function editTest(item: Record<string, unknown> & { id: string }) {
    setEditingTestId(item.id);
    setTestForm({
      name: String(item.name ?? ""),
      description: String(item.description ?? ""),
      minutes: String(Math.round(Number(item.durationSeconds ?? BPSC_DEFAULT_DURATION_SECONDS) / 60)),
      marks: String(item.marksPerQuestion ?? 1),
      negative: String(item.negativeMark ?? 0),
      questionIds: Array.isArray(item.questionIds) ? item.questionIds.join(", ") : "",
    });
    setTab("tests");
  }

  function editAffair(item: Record<string, unknown> & { id: string }) {
    setEditingAffairId(item.id);
    setAffairForm({
      category: String(item.category ?? "national") as BpscCurrentAffairsCategory,
      title_hi: String(item.title_hi ?? ""),
      title_en: String(item.title_en ?? ""),
      content_hi: String(item.content_hi ?? ""),
      content_en: String(item.content_en ?? ""),
      date: String(item.date ?? ""),
      published: item.published !== false,
    });
    setTab("affairs");
  }

  function editNote(item: Record<string, unknown> & { id: string }) {
    setEditingNoteId(item.id);
    setNoteForm({
      title: String(item.title ?? ""),
      description: String(item.description ?? ""),
      category: String(item.category ?? "General"),
      language: String(item.language ?? "both") as BpscLanguage,
      pdfUrl: String(item.pdfUrl ?? ""),
      published: item.published !== false,
    });
    setTab("notes");
  }

  const tabs: Array<[AdminTab, string]> = [["questions", "Questions"], ["tests", "Mock Tests"], ["affairs", "Current Affairs"], ["notes", "Notes / PDFs"], ["pricing", "Pricing"]];
  return (
    <div className="min-h-screen bg-[#0d1424] px-4 py-8 text-white">
      <main className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div><button type="button" onClick={() => navigate("/admin")} className="mb-3 text-xs text-white/45 hover:text-white">← Admin dashboard</button><p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-400">SHIKEN · BPSC CCE</p><h1 className="mt-1 text-3xl font-black">BPSC Content & Pricing</h1><p className="mt-2 text-sm text-white/45">Bilingual content stays isolated under competitiveExams/bpsc-cce.</p></div>
          <button type="button" onClick={() => void loadData()} className="rounded-xl border border-white/10 px-3 py-2 text-xs font-bold text-white/60 hover:bg-white/5">Refresh data</button>
        </div>
        {message && <div className="mb-4 rounded-xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-300">{message}</div>}
        <div className="mb-6 grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-2 sm:grid-cols-5">{tabs.map(([id, label]) => <button key={id} type="button" onClick={() => setTab(id)} className={`rounded-xl px-3 py-2.5 text-xs font-black ${tab === id ? "bg-emerald-500 text-[#07251f]" : "text-white/50 hover:bg-white/5"}`}>{label}</button>)}</div>

        {tab === "questions" && <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <section className={PANEL}>
            <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-black">{editingId ? "Edit question" : "Add question"}</h2><button type="button" onClick={downloadTemplate} className="text-xs font-bold text-emerald-300">Download CSV template</button></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <select value={question.category} onChange={(event) => setQuestionField("category", event.target.value as BpscCategory)} className={INPUT}>{BPSC_CATEGORIES.map((item) => <option key={item.id} value={item.id}>{item.label} / {item.labelHindi}</option>)}</select>
              <input value={question.year} onChange={(event) => setQuestionField("year", event.target.value)} placeholder="Year (optional)" className={INPUT} />
              <TextArea value={question.question_hi} onChange={(value) => setQuestionField("question_hi", value)} placeholder="Question in Hindi *" />
              <TextArea value={question.question_en} onChange={(value) => setQuestionField("question_en", value)} placeholder="Question in English *" />
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">{ANSWERS.map((key) => <div key={key} className="grid grid-cols-[28px_1fr] gap-2"><span className="flex items-center justify-center rounded-lg bg-white/10 text-xs font-black">{key}</span><div className="grid gap-2"><input value={question.options_hi[key]} onChange={(event) => setOption("hi", key, event.target.value)} placeholder={`Hindi option ${key}`} className={INPUT} /><input value={question.options_en[key]} onChange={(event) => setOption("en", key, event.target.value)} placeholder={`English option ${key}`} className={INPUT} /></div></div>)}</div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2"><select value={question.correct_answer} onChange={(event) => setQuestionField("correct_answer", event.target.value as AnswerKey)} className={INPUT}>{ANSWERS.map((key) => <option key={key}>{key}</option>)}</select><input value={question.topic} onChange={(event) => setQuestionField("topic", event.target.value)} placeholder="Topic (optional)" className={INPUT} /><TextArea value={question.explanation_hi ?? ""} onChange={(value) => setQuestionField("explanation_hi", value)} placeholder="Explanation in Hindi" /><TextArea value={question.explanation_en ?? ""} onChange={(value) => setQuestionField("explanation_en", value)} placeholder="Explanation in English" /></div>
            <div className="mt-4 flex gap-2"><button type="button" onClick={() => void saveQuestion()} className="rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-black text-[#07251f]">{editingId ? "Update question" : "Save question"}</button>{editingId && <button type="button" onClick={() => { setQuestion(emptyQuestion()); setEditingId(""); }} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-bold text-white/60">Cancel edit</button>}</div>
          </section>
          <section className={PANEL}>
            <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-black">Bulk upload</h2><span className="text-xs text-white/40">CSV or JSON</span></div>
            <TextArea value={bulkText} onChange={setBulkText} placeholder="Paste template CSV or a JSON array of bilingual questions" />
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={() => { try { const rows = parseBulkText(bulkText); setBulkPreview(rows); setBulkErrors(rows.flatMap((row, index) => validateQuestion(row).map((error) => `Row ${index + 1}: ${error}`))); flash("Preview generated. Review the validation report below."); } catch { setBulkPreview([]); setBulkErrors(["Could not parse CSV/JSON."]); flash("Could not parse CSV/JSON."); } }} className="rounded-xl border border-white/15 px-3 py-2 text-xs font-bold text-white/70">Preview & validate</button>
              <button type="button" onClick={() => void saveBulk()} disabled={!bulkPreview.length || Boolean(bulkErrors.length)} className="rounded-xl bg-emerald-500 px-3 py-2 text-xs font-black text-[#07251f] disabled:opacity-40">Upload preview</button>
            </div>
            {bulkPreview.length > 0 && <p className="mt-3 text-xs text-emerald-300">{bulkPreview.length} rows previewed. Required bilingual fields and all 8 options are checked before upload.</p>}
            {bulkErrors.length > 0 && <div className="mt-3 rounded-xl border border-rose-400/25 bg-rose-400/10 p-3 text-xs leading-5 text-rose-200"><p className="font-black">Fix these rows before upload:</p>{bulkErrors.slice(0, 10).map((error) => <p key={error}>• {error}</p>)}{bulkErrors.length > 10 && <p>• {bulkErrors.length - 10} more validation errors</p>}</div>}
          </section>
          <section className={`${PANEL} lg:col-span-2`}><div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-black">Question bank ({visibleQuestions.length})</h2><span className="text-xs text-white/40">Publish state is student-visible</span></div><div className="grid gap-2">{visibleQuestions.map((item) => <div key={`${item.category}-${item.id}`} className="flex flex-wrap items-center gap-3 rounded-xl border border-white/8 bg-black/10 p-3"><span className="rounded-lg bg-white/10 px-2 py-1 text-[10px] font-black">{item.category}</span><p className="min-w-[220px] flex-1 truncate text-sm text-white/80">{item.question_en}</p><span className={`text-[10px] font-bold ${item.published ? "text-emerald-300" : "text-amber-300"}`}>{item.published ? "Published" : "Unpublished"}</span><button type="button" onClick={() => editItem(item)} className="text-xs font-bold text-sky-300">Edit</button><button type="button" onClick={() => void toggleQuestion(item)} className="text-xs font-bold text-amber-300">{item.published ? "Unpublish" : "Publish"}</button><button type="button" onClick={() => { if (window.confirm("Delete this BPSC question?")) void remove(ref(db, `${BPSC_DB_ROOT}/questions/${item.category}/${item.id}`)).then(loadData); }} className="text-xs font-bold text-rose-300">Delete</button></div>)}</div></section>
        </div>}

        {tab === "tests" && <section className={PANEL}><h2 className="text-lg font-black">{editingTestId ? "Edit mock test" : "Create editable mock test"}</h2><p className="mt-1 text-xs text-white/40">Use question IDs from the bank. Duration defaults to the required 2 hours.</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><input value={testForm.name} onChange={(event) => setTestForm({ ...testForm, name: event.target.value })} placeholder="Test name" className={INPUT} /><input value={testForm.description} onChange={(event) => setTestForm({ ...testForm, description: event.target.value })} placeholder="Description" className={INPUT} /><input value={testForm.minutes} onChange={(event) => setTestForm({ ...testForm, minutes: event.target.value })} type="number" placeholder="Duration minutes" className={INPUT} /><input value={testForm.questionIds} onChange={(event) => setTestForm({ ...testForm, questionIds: event.target.value })} placeholder="Question IDs, comma-separated" className={`${INPUT} sm:col-span-2`} /></div><div className="mt-4 flex gap-2"><button type="button" onClick={() => void saveTest()} className="rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-black text-[#07251f]">{editingTestId ? "Update mock test" : "Save mock test"}</button>{editingTestId && <button type="button" onClick={() => { setEditingTestId(""); setTestForm({ name: "", description: "", minutes: "120", marks: "1", negative: "0", questionIds: "" }); }} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-bold text-white/60">Cancel edit</button>}</div><div className="mt-6 grid gap-2">{tests.map((item) => <div key={item.id} className="flex items-center gap-3 rounded-xl border border-white/8 p-3"><p className="flex-1 text-sm font-bold">{String(item.name)}</p><span className="text-xs text-white/40">{Array.isArray(item.questionIds) ? item.questionIds.length : 0} Q · {Math.round(Number(item.durationSeconds ?? 0) / 60)} min</span><button type="button" onClick={() => editTest(item)} className="text-xs text-sky-300">Edit</button><button type="button" onClick={() => void update(ref(db, `${BPSC_DB_ROOT}/tests/${item.id}`), { published: item.published === false }).then(loadData)} className="text-xs text-amber-300">{item.published === false ? "Publish" : "Unpublish"}</button><button type="button" onClick={() => void remove(ref(db, `${BPSC_DB_ROOT}/tests/${item.id}`)).then(loadData)} className="text-xs text-rose-300">Delete</button></div>)}</div></section>}

        {tab === "affairs" && <section className={PANEL}><h2 className="text-lg font-black">{editingAffairId ? "Edit current affair" : "Current affairs management"}</h2><div className="mt-4 grid gap-3 sm:grid-cols-2"><select value={affairForm.category} onChange={(event) => setAffairForm({ ...affairForm, category: event.target.value as BpscCurrentAffairsCategory })} className={INPUT}>{BPSC_CURRENT_AFFAIRS_CATEGORIES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select><input value={affairForm.date} onChange={(event) => setAffairForm({ ...affairForm, date: event.target.value })} placeholder="Date / month" className={INPUT} /><TextArea value={affairForm.title_hi} onChange={(value) => setAffairForm({ ...affairForm, title_hi: value })} placeholder="Title in Hindi" /><TextArea value={affairForm.title_en} onChange={(value) => setAffairForm({ ...affairForm, title_en: value })} placeholder="Title in English" /><TextArea value={affairForm.content_hi} onChange={(value) => setAffairForm({ ...affairForm, content_hi: value })} placeholder="Content in Hindi" /><TextArea value={affairForm.content_en} onChange={(value) => setAffairForm({ ...affairForm, content_en: value })} placeholder="Content in English" /></div><div className="mt-4 flex gap-2"><button type="button" onClick={() => void saveAffair()} className="rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-black text-[#07251f]">{editingAffairId ? "Update current affair" : "Publish current affair"}</button>{editingAffairId && <button type="button" onClick={() => { setEditingAffairId(""); setAffairForm({ category: "national", title_hi: "", title_en: "", content_hi: "", content_en: "", date: "", published: true }); }} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-bold text-white/60">Cancel edit</button>}</div><div className="mt-6 grid gap-2">{affairs.map((item) => <div key={item.id} className="flex items-center gap-3 rounded-xl border border-white/8 p-3"><p className="flex-1 truncate text-sm font-bold">{String(item.title_en)}</p><button type="button" onClick={() => editAffair(item)} className="text-xs text-sky-300">Edit</button><button type="button" onClick={() => void update(ref(db, `${BPSC_DB_ROOT}/currentAffairs/${item.id}`), { published: item.published === false }).then(loadData)} className="text-xs text-amber-300">{item.published === false ? "Publish" : "Unpublish"}</button><button type="button" onClick={() => void remove(ref(db, `${BPSC_DB_ROOT}/currentAffairs/${item.id}`)).then(loadData)} className="text-xs text-rose-300">Delete</button></div>)}</div></section>}

        {tab === "notes" && <section className={PANEL}><h2 className="text-lg font-black">{editingNoteId ? "Edit PDF metadata" : "E-books / PDF metadata"}</h2><div className="mt-4 grid gap-3 sm:grid-cols-2"><input value={noteForm.title} onChange={(event) => setNoteForm({ ...noteForm, title: event.target.value })} placeholder="Note title" className={INPUT} /><input value={noteForm.category} onChange={(event) => setNoteForm({ ...noteForm, category: event.target.value })} placeholder="Category" className={INPUT} /><input value={noteForm.pdfUrl} onChange={(event) => setNoteForm({ ...noteForm, pdfUrl: event.target.value })} placeholder="Public PDF URL" className={`${INPUT} sm:col-span-2`} /><input value={noteForm.description} onChange={(event) => setNoteForm({ ...noteForm, description: event.target.value })} placeholder="Description" className={INPUT} /><select value={noteForm.language} onChange={(event) => setNoteForm({ ...noteForm, language: event.target.value as BpscLanguage })} className={INPUT}><option value="both">Hindi + English</option><option value="hi">Hindi</option><option value="en">English</option></select></div><div className="mt-4 flex gap-2"><button type="button" onClick={() => void saveNote()} className="rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-black text-[#07251f]">{editingNoteId ? "Update note metadata" : "Publish note metadata"}</button>{editingNoteId && <button type="button" onClick={() => { setEditingNoteId(""); setNoteForm({ title: "", description: "", category: "General", language: "both", pdfUrl: "", published: true }); }} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-bold text-white/60">Cancel edit</button>}</div><div className="mt-6 grid gap-2">{notes.map((item) => <div key={item.id} className="flex items-center gap-3 rounded-xl border border-white/8 p-3"><p className="flex-1 truncate text-sm font-bold">{String(item.title)}</p><button type="button" onClick={() => editNote(item)} className="text-xs text-sky-300">Edit</button><button type="button" onClick={() => void update(ref(db, `${BPSC_DB_ROOT}/notes/${item.id}`), { published: item.published === false }).then(loadData)} className="text-xs text-amber-300">{item.published === false ? "Publish" : "Unpublish"}</button><button type="button" onClick={() => void remove(ref(db, `${BPSC_DB_ROOT}/notes/${item.id}`)).then(loadData)} className="text-xs text-rose-300">Delete</button></div>)}</div></section>}

        {tab === "pricing" && <section className={PANEL}><h2 className="text-lg font-black">Competitive pricing</h2><p className="mt-1 text-xs text-white/40">This configuration is read by the payment server. Browser values cannot override it.</p><div className="mt-4 grid max-w-md gap-3 sm:grid-cols-2"><input value={priceForm.amount} onChange={(event) => setPriceForm({ ...priceForm, amount: event.target.value })} type="number" min="1" placeholder="Amount INR" className={INPUT} /><input value={priceForm.days} onChange={(event) => setPriceForm({ ...priceForm, days: event.target.value })} type="number" min="1" placeholder="Access days" className={INPUT} /></div><button type="button" onClick={() => void savePricing()} className="mt-4 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-black text-[#07251f]">Save BPSC price</button></section>}
      </main>
    </div>
  );
}