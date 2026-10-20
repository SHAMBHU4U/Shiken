import { useEffect, useMemo, useState, type ReactNode } from "react";
import { get, push, ref, remove, set, update } from "firebase/database";
import { useLocation } from "wouter";
import { auth, db } from "@/firebase";
import {
  BPSC_CATEGORIES, BPSC_CURRENT_AFFAIRS_CATEGORIES, BPSC_DB_ROOT,
  BPSC_DEFAULT_DURATION_SECONDS, BPSC_PLAN_ID, emptyBpscOptions, safeBpscSlug,
  type BpscCategory, type BpscCurrentAffairsCategory, type BpscLanguage,
} from "@/lib/bpsc";

type AnswerKey = "A" | "B" | "C" | "D";
const ANSWERS: AnswerKey[] = ["A", "B", "C", "D"];
const INPUT = "w-full min-w-0 rounded-xl border border-[#cbd3dc] bg-[#fbfaf6] px-3 py-2.5 text-sm text-[#172b35] placeholder:text-[#71818a] outline-none focus:border-[#187760] focus:ring-2 focus:ring-[#187760]/15";
const PANEL = "rounded-2xl border border-[#dce2df] bg-[#fffefa] p-4 shadow-[0_8px_24px_rgba(31,54,47,.045)] sm:p-5";
const BUTTON = "rounded-xl px-4 py-2.5 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50";
type QuestionRecord = {
  id: string; category: BpscCategory; sourceId?: string; question_hi: string; question_en: string;
  options_hi: Record<AnswerKey, string>; options_en: Record<AnswerKey, string>;
  correct_answer: AnswerKey; explanation_hi?: string; explanation_en?: string;
  relatedFacts_hi?: string; relatedFacts_en?: string; topic?: string; year?: string; published: boolean;
};
type QuestionForm = Omit<QuestionRecord, "id"> & { id?: string };
type Tab = "questions" | "pyqs" | "tests" | "affairs" | "notes" | "pricing";
type Row = Record<string, unknown> & { id: string };
const newQuestion = (): QuestionForm => ({
  category: "history", sourceId: "", question_hi: "", question_en: "", options_hi: emptyBpscOptions(),
  options_en: emptyBpscOptions(), correct_answer: "A", explanation_hi: "", explanation_en: "",
  relatedFacts_hi: "", relatedFacts_en: "", topic: "", year: "", published: true,
});
const optionsOf = (value: unknown): Record<AnswerKey, string> => {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return Object.fromEntries(ANSWERS.map((key) => [key, String(source[key] ?? "")])) as Record<AnswerKey, string>;
};
function normalize(raw: Record<string, unknown>, category: BpscCategory, id = ""): QuestionRecord {
  const hi = raw.hi && typeof raw.hi === "object" ? raw.hi as Record<string, unknown> : {};
  const en = raw.en && typeof raw.en === "object" ? raw.en as Record<string, unknown> : {};
  const pick = (flat: string, lang: Record<string, unknown>, key: string) => raw[flat] ?? lang[key] ?? "";
  return {
    id, category, sourceId: String(raw.sourceId ?? raw.source_id ?? ""),
    question_hi: String(pick("question_hi", hi, "question")),
    question_en: String(pick("question_en", en, "question")),
    options_hi: optionsOf(raw.options_hi ?? hi.options), options_en: optionsOf(raw.options_en ?? en.options),
    correct_answer: String(raw.correct_answer ?? raw.answer ?? "A").toUpperCase() as AnswerKey,
    explanation_hi: String(pick("explanation_hi", hi, "explanation")),
    explanation_en: String(pick("explanation_en", en, "explanation")),
    relatedFacts_hi: String(pick("relatedFacts_hi", hi, "relatedFacts")),
    relatedFacts_en: String(pick("relatedFacts_en", en, "relatedFacts")),
    topic: String(raw.topic ?? ""), year: String(raw.year ?? raw.session ?? ""),
    published: raw.published !== false,
  };
}
function payload(q: QuestionForm) {
  return {
    category: q.category, sourceId: q.sourceId?.trim() || "",
    question_hi: q.question_hi.trim(), question_en: q.question_en.trim(),
    options_hi: Object.fromEntries(ANSWERS.map((k) => [k, q.options_hi[k].trim()])),
    options_en: Object.fromEntries(ANSWERS.map((k) => [k, q.options_en[k].trim()])),
    correct_answer: q.correct_answer, explanation_hi: q.explanation_hi?.trim() || "",
    explanation_en: q.explanation_en?.trim() || "", relatedFacts_hi: q.relatedFacts_hi?.trim() || "",
    relatedFacts_en: q.relatedFacts_en?.trim() || "", topic: q.topic?.trim() || "",
    year: q.year?.trim() || "", published: q.published, updatedAt: Date.now(),
  };
}
function validate(q: QuestionForm): string[] {
  const errors: string[] = [];
  if (!BPSC_CATEGORIES.some((category) => category.id === q.category)) errors.push("Choose a valid BPSC category");
  if (!q.question_hi.trim()) errors.push("Hindi question is required");
  if (!q.question_en.trim()) errors.push("English question is required");
  ANSWERS.forEach((key) => {
    if (!q.options_hi[key].trim()) errors.push(`Hindi option ${key} is required`);
    if (!q.options_en[key].trim()) errors.push(`English option ${key} is required`);
  });
  if (!ANSWERS.includes(q.correct_answer)) errors.push("Correct answer must be A, B, C or D");
  return errors;
}
function csvCells(line: string): string[] {
  const cells: string[] = []; let value = ""; let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (c === '"' && line[i + 1] === '"') { value += '"'; i += 1; }
    else if (c === '"') quoted = !quoted;
    else if (c === "," && !quoted) { cells.push(value.trim()); value = ""; }
    else value += c;
  }
  cells.push(value.trim()); return cells;
}
function parseQuestions(text: string, defaultCategory: BpscCategory): QuestionForm[] {
  const source = text.trim(); if (!source) return [];
  if (source.startsWith("[") || source.startsWith("{")) {
    const parsed = JSON.parse(source) as unknown;
    const rows = Array.isArray(parsed) ? parsed : Object.values(parsed as Record<string, unknown>);
    return rows.map((item) => normalize(item as Record<string, unknown>, String((item as Record<string, unknown>).category ?? defaultCategory) as BpscCategory));
  }
  const lines = source.split(/\r?\n/).filter((line) => line.trim());
  const headers = csvCells(lines[0]).map((header) => header.toLowerCase().trim());
  return lines.slice(1).map((line) => {
    const values = Object.fromEntries(headers.map((h, i) => [h, csvCells(line)[i] ?? ""]));
    const opts = (lang: "hi" | "en") => Object.fromEntries(ANSWERS.map((key) => [key, values[`option_${lang}_${key.toLowerCase()}`] ?? values[`options_${lang}_${key.toLowerCase()}`] ?? ""])) as Record<AnswerKey, string>;
    return {
      ...newQuestion(), category: (values.category || defaultCategory) as BpscCategory,
      sourceId: values.sourceid ?? values.source_id ?? "", question_hi: values.question_hi ?? "",
      question_en: values.question_en ?? "", options_hi: opts("hi"), options_en: opts("en"),
      correct_answer: (values.correct_answer || "A").toUpperCase() as AnswerKey,
      explanation_hi: values.explanation_hi ?? "", explanation_en: values.explanation_en ?? "",
      relatedFacts_hi: values.relatedfacts_hi ?? "", relatedFacts_en: values.relatedfacts_en ?? "",
      topic: values.topic ?? "", year: values.year ?? values.session ?? "",
      published: values.published !== "false",
    };
  });
}
function downloadTemplate() {
  const header = "category,sourceId,question_hi,question_en,option_hi_a,option_hi_b,option_hi_c,option_hi_d,option_en_a,option_en_b,option_en_c,option_en_d,correct_answer,explanation_hi,explanation_en,relatedFacts_hi,relatedFacts_en,topic,year,published";
  const blob = new Blob([`${header}\n`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob); const a = document.createElement("a");
  a.href = url; a.download = "shiken-bpsc-question-template.csv"; a.click(); URL.revokeObjectURL(url);
}
function Field({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return <label className={`block min-w-0 ${className}`}><span className="mb-1.5 block text-xs font-bold text-[#344a53]">{label}</span>{children}</label>;
}
function Area({ value, onChange, label, placeholder }: { value: string; onChange: (v: string) => void; label: string; placeholder?: string }) {
  return <Field label={label}><textarea data-testid={`textarea-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={3} className={`${INPUT} resize-y`} /></Field>;
}
function fileText(file: File): Promise<string> { return file.text(); }

export default function BPSCAdminPage() {
  const [, navigate] = useLocation();
  const [tab, setTab] = useState<Tab>("questions");
  const [questions, setQuestions] = useState<QuestionRecord[]>([]);
  const [pyqs, setPyqs] = useState<Array<QuestionRecord & { examType: string; session: string }>>([]);
  const [tests, setTests] = useState<Row[]>([]);
  const [affairs, setAffairs] = useState<Row[]>([]);
  const [notes, setNotes] = useState<Row[]>([]);
  const [question, setQuestion] = useState<QuestionForm>(newQuestion);
  const [editingId, setEditingId] = useState("");
  const [bulkText, setBulkText] = useState("");
  const [bulkPreview, setBulkPreview] = useState<QuestionForm[]>([]);
  const [bulkErrors, setBulkErrors] = useState<string[]>([]);
  const [pyqText, setPyqText] = useState("");
  const [pyqPreview, setPyqPreview] = useState<QuestionForm[]>([]);
  const [pyqErrors, setPyqErrors] = useState<string[]>([]);
  const [pyqMeta, setPyqMeta] = useState({ examType: "BPSC Prelims", year: new Date().getFullYear().toString(), session: "Prelims" });
  const [message, setMessage] = useState("");
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testForm, setTestForm] = useState({ name: "", description: "", minutes: String(BPSC_DEFAULT_DURATION_SECONDS / 60), marks: "1", negative: "0" });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [testCategory, setTestCategory] = useState<BpscCategory | "all">("all");
  const [editingTestId, setEditingTestId] = useState("");
  const [affairForm, setAffairForm] = useState({ category: "national" as BpscCurrentAffairsCategory, title_hi: "", title_en: "", content_hi: "", content_en: "", date: "", published: true });
  const [editingAffairId, setEditingAffairId] = useState("");
  const [noteForm, setNoteForm] = useState({ title: "", description: "", category: "General", language: "both" as BpscLanguage, published: true });
  const [noteFile, setNoteFile] = useState<File | null>(null);
  const [editingNoteId, setEditingNoteId] = useState("");
  const [priceForm, setPriceForm] = useState({ amount: "199", days: "30" });
  const [search, setSearch] = useState("");
  const flash = (text: string) => { setMessage(text); window.setTimeout(() => setMessage(""), 4000); };

  async function loadData() {
    setLoading(true); setLoadError("");
    try {
      const [questionSnaps, testSnap, affairSnap, noteSnap, priceSnap, pyqSnap] = await Promise.all([
        Promise.all(BPSC_CATEGORIES.map(async (c) => ({ category: c.id, snap: await get(ref(db, `${BPSC_DB_ROOT}/questions/${c.id}`)) }))),
        get(ref(db, `${BPSC_DB_ROOT}/tests`)), get(ref(db, `${BPSC_DB_ROOT}/currentAffairs`)),
        get(ref(db, `${BPSC_DB_ROOT}/notes`)), get(ref(db, `competitiveExams/planConfig/${BPSC_PLAN_ID}`)),
        get(ref(db, `${BPSC_DB_ROOT}/pyqs`)),
      ]);
      setQuestions(questionSnaps.flatMap(({ category, snap }) => snap.exists()
        ? Object.entries(snap.val() as Record<string, Record<string, unknown>>).map(([id, raw]) => normalize(raw, category, id)) : []));
      const rows = (snap: typeof testSnap): Row[] => snap.exists() ? Object.entries(snap.val() as Record<string, Record<string, unknown>>).map(([id, raw]) => ({ ...raw, id })) : [];
      setTests(rows(testSnap)); setAffairs(rows(affairSnap)); setNotes(rows(noteSnap));
      const parsedPyqs: Array<QuestionRecord & { examType: string; session: string }> = [];
      if (pyqSnap.exists()) {
        Object.entries(pyqSnap.val() as Record<string, Record<string, Record<string, Record<string, unknown>>>>).forEach(([year, types]) =>
          Object.entries(types ?? {}).forEach(([examType, records]) => Object.entries(records ?? {}).forEach(([id, raw]) =>
            parsedPyqs.push({ ...normalize({ ...raw, year: raw.year ?? year }, String(raw.category ?? "history") as BpscCategory, id), examType: String(raw.examType ?? examType), session: String(raw.session ?? year) }))));
      }
      setPyqs(parsedPyqs);
      if (priceSnap.exists()) { const raw = priceSnap.val() as Record<string, unknown>; setPriceForm({ amount: String(raw.amount ?? 199), days: String(raw.days ?? 30) }); }
    } catch (error) {
      console.error("[BPSC admin] load failed", error); setLoadError("BPSC content could not be loaded. Check your connection and retry.");
    } finally { setLoading(false); }
  }
  useEffect(() => { void loadData(); }, []);

  const filteredQuestions = useMemo(() => questions.filter((q) => `${q.question_en} ${q.question_hi} ${q.category} ${q.topic}`.toLowerCase().includes(search.toLowerCase())), [questions, search]);
  const availableForTest = useMemo(() => questions.filter((q) => q.published && (testCategory === "all" || q.category === testCategory)), [questions, testCategory]);
  const setQuestionField = <K extends keyof QuestionForm>(key: K, value: QuestionForm[K]) => setQuestion((v) => ({ ...v, [key]: value }));
  const setOption = (language: "hi" | "en", key: AnswerKey, value: string) => setQuestion((v) => ({ ...v, [`options_${language}`]: { ...v[`options_${language}`], [key]: value } }));

  async function saveQuestion() {
    const errors = validate(question); if (errors.length) return flash(errors.join(" · "));
    setSaving(true);
    try {
      const data = payload(question);
      if (editingId) await update(ref(db, `${BPSC_DB_ROOT}/questions/${question.category}/${editingId}`), data);
      else await set(ref(db, `${BPSC_DB_ROOT}/questions/${question.category}/${push(ref(db)).key}`), data);
      setQuestion(newQuestion()); setEditingId(""); await loadData(); flash("Question saved to the BPSC bank.");
    } catch { flash("Question could not be saved. Please retry."); } finally { setSaving(false); }
  }
  async function saveBulk() {
    if (!bulkPreview.length || bulkErrors.length) return;
    setSaving(true);
    try {
      await Promise.all(bulkPreview.map((row) => set(ref(db, `${BPSC_DB_ROOT}/questions/${row.category}/${push(ref(db)).key}`), payload(row))));
      const count = bulkPreview.length; setBulkText(""); setBulkPreview([]); setBulkErrors([]); await loadData(); flash(`${count} questions uploaded.`);
    } catch { flash("Bulk upload did not complete. Please retry."); } finally { setSaving(false); }
  }
  async function savePyqs() {
    if (!pyqPreview.length || pyqErrors.length) return;
    if (!pyqMeta.year.trim() || !pyqMeta.examType.trim()) return flash("Add the PYQ year and exam type before saving.");
    setSaving(true);
    try {
      const year = pyqMeta.year.trim().replace(/[.#$/\[\]]/g, "_"); const examType = safeBpscSlug(pyqMeta.examType) || "bpsc-prelims";
      await Promise.all(pyqPreview.map((row) => set(ref(db, `${BPSC_DB_ROOT}/pyqs/${year}/${examType}/${push(ref(db)).key}`), {
        ...payload({ ...row, year, published: true }), examType: pyqMeta.examType.trim(), year, session: pyqMeta.session.trim(), published: true,
      })));
      const count = pyqPreview.length; setPyqPreview([]); setPyqErrors([]); setPyqText(""); await loadData(); flash(`${count} PYQs saved under ${year}.`);
    } catch { flash("PYQs could not be saved. Please retry."); } finally { setSaving(false); }
  }
  async function saveTest() {
    if (!testForm.name.trim()) return flash("Add a name for this mock test.");
    if (!selectedIds.length || selectedIds.length > 150) return flash("Choose between 1 and 150 published questions.");
    setSaving(true);
    try {
      const snapshots = selectedIds.map((id) => questions.find((item) => item.id === id)).filter((item): item is QuestionRecord => Boolean(item)).map((item) => ({
        ...payload(item), id: item.id, sourceId: item.sourceId || item.id, category: item.category,
      }));
      if (snapshots.length !== selectedIds.length) return flash("One or more selected questions are no longer available. Refresh and retry.");
      const id = editingTestId || `${safeBpscSlug(testForm.name)}-${Date.now()}`;
      await set(ref(db, `${BPSC_DB_ROOT}/tests/${id}`), {
        name: testForm.name.trim(), description: testForm.description.trim(),
        durationSeconds: Math.max(60, Number(testForm.minutes) * 60), marksPerQuestion: Number(testForm.marks) || 1,
        negativeMark: Number(testForm.negative) || 0, questionIds: selectedIds, questions: snapshots,
        published: true, updatedAt: Date.now(),
      });
      setTestForm({ name: "", description: "", minutes: "120", marks: "1", negative: "0" }); setSelectedIds([]); setEditingTestId("");
      await loadData(); flash("Mock test saved with bilingual question snapshots.");
    } catch { flash("Mock test could not be saved."); } finally { setSaving(false); }
  }
  async function saveAffair() {
    if (!affairForm.title_hi.trim() || !affairForm.title_en.trim() || !affairForm.content_en.trim()) return flash("Add both titles and English content.");
    setSaving(true);
    try {
      const id = editingAffairId || `${safeBpscSlug(affairForm.title_en)}-${Date.now()}`;
      await set(ref(db, `${BPSC_DB_ROOT}/currentAffairs/${id}`), { ...affairForm, updatedAt: Date.now() });
      setAffairForm({ category: "national", title_hi: "", title_en: "", content_hi: "", content_en: "", date: "", published: true }); setEditingAffairId("");
      await loadData(); flash("Current affair saved.");
    } catch { flash("Current affair could not be saved."); } finally { setSaving(false); }
  }
  async function saveNote() {
    if (!noteForm.title.trim()) return flash("Note title is required.");
    if (!noteFile && !editingNoteId) return flash("Choose a PDF file to upload.");
    setSaving(true);
    try {
      if (noteFile) {
        const token = await auth.currentUser?.getIdToken();
        if (!token) throw new Error("Admin session unavailable");
        const metadata = encodeURIComponent(JSON.stringify({ ...noteForm, noteId: editingNoteId || undefined }));
        const response = await fetch("/api/admin/bpsc/notes/upload", {
          method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/pdf", "x-bpsc-note-metadata": metadata, "x-bpsc-file-name": encodeURIComponent(noteFile.name) },
          body: noteFile,
        });
        if (!response.ok) throw new Error("PDF upload failed");
        const result = await response.json() as { ok: boolean; note: Record<string, unknown> };
        if (!result.ok || !result.note?.id) throw new Error("Upload response was incomplete");
        await set(ref(db, `${BPSC_DB_ROOT}/notes/${result.note.id}`), { ...noteForm, ...result.note, updatedAt: Date.now() });
      } else {
        await update(ref(db, `${BPSC_DB_ROOT}/notes/${editingNoteId}`), { ...noteForm, updatedAt: Date.now() });
      }
      setNoteForm({ title: "", description: "", category: "General", language: "both", published: true }); setNoteFile(null); setEditingNoteId("");
      await loadData(); flash("PDF note saved.");
    } catch (error) { console.error("[BPSC admin] note upload failed", error); flash("PDF could not be saved. Check the file and retry."); }
    finally { setSaving(false); }
  }
  async function deleteNote(item: Row) {
    if (!window.confirm(`Delete “${String(item.title ?? "this note")}”?`)) return;
    setSaving(true);
    try {
      const token = await auth.currentUser?.getIdToken(); if (!token) throw new Error("Admin session unavailable");
      const response = await fetch(`/api/admin/bpsc/notes/${encodeURIComponent(item.id)}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error("Delete failed");
      await remove(ref(db, `${BPSC_DB_ROOT}/notes/${item.id}`)); await loadData(); flash("Note deleted.");
    } catch { flash("Note could not be deleted."); } finally { setSaving(false); }
  }
  async function savePricing() {
    const amount = Number(priceForm.amount), days = Number(priceForm.days);
    if (!Number.isInteger(amount) || amount < 1 || amount > 100000 || !Number.isInteger(days) || days < 1 || days > 3650) return flash("Price and duration are outside the allowed range.");
    try { await set(ref(db, `competitiveExams/planConfig/${BPSC_PLAN_ID}`), { amount, days, updatedAt: Date.now(), name: "BPSC Prelims CCE Premium", currency: "INR" }); flash("BPSC pricing saved."); }
    catch { flash("Pricing could not be saved."); }
  }
  function editQuestion(q: QuestionRecord) { setQuestion({ ...q, options_hi: { ...q.options_hi }, options_en: { ...q.options_en } }); setEditingId(q.id); setTab("questions"); window.scrollTo({ top: 0, behavior: "smooth" }); }
  function editTest(item: Row) {
    setEditingTestId(item.id); setTestForm({ name: String(item.name ?? ""), description: String(item.description ?? ""), minutes: String(Math.round(Number(item.durationSeconds ?? BPSC_DEFAULT_DURATION_SECONDS) / 60)), marks: String(item.marksPerQuestion ?? 1), negative: String(item.negativeMark ?? 0) });
    setSelectedIds(Array.isArray(item.questionIds) ? item.questionIds.map(String).slice(0, 150) : []); setTab("tests");
  }
  function editAffair(item: Row) { setEditingAffairId(item.id); setAffairForm({ category: String(item.category ?? "national") as BpscCurrentAffairsCategory, title_hi: String(item.title_hi ?? ""), title_en: String(item.title_en ?? ""), content_hi: String(item.content_hi ?? ""), content_en: String(item.content_en ?? ""), date: String(item.date ?? ""), published: item.published !== false }); setTab("affairs"); }
  function editNote(item: Row) { setEditingNoteId(item.id); setNoteForm({ title: String(item.title ?? ""), description: String(item.description ?? ""), category: String(item.category ?? "General"), language: String(item.language ?? "both") as BpscLanguage, published: item.published !== false }); setNoteFile(null); setTab("notes"); }
  const tabs: Array<[Tab, string]> = [["questions", "Question bank"], ["pyqs", "PYQ sets"], ["tests", "Mock tests"], ["affairs", "Current affairs"], ["notes", "Notes / PDFs"], ["pricing", "Pricing"]];
  const toggle = async (path: string, item: Row) => { await update(ref(db, path), { published: item.published === false, updatedAt: Date.now() }); await loadData(); };
  const removeRecord = async (path: string) => { if (window.confirm("Delete this BPSC content item?")) { await remove(ref(db, path)); await loadData(); flash("Content deleted."); } };
  const previewRows = (kind: "question" | "pyq") => {
    const text = kind === "question" ? bulkText : pyqText;
    try {
      const rows = parseQuestions(text, question.category);
      const errors = rows.flatMap((row, i) => validate(row).map((error) => `Row ${i + 1}: ${error}`));
      if (kind === "question") { setBulkPreview(rows); setBulkErrors(errors); } else { setPyqPreview(rows); setPyqErrors(errors); }
      flash(`${rows.length} rows parsed. Review the validation report.`);
    } catch { if (kind === "question") { setBulkPreview([]); setBulkErrors(["Unable to parse this CSV or JSON."]); } else { setPyqPreview([]); setPyqErrors(["Unable to parse this CSV or JSON."]); } }
  };
  const uploadFile = async (file: File | undefined, kind: "question" | "pyq") => {
    if (!file) return;
    try { const text = await fileText(file); kind === "question" ? setBulkText(text) : setPyqText(text); flash(`${file.name} loaded. Preview it before upload.`); }
    catch { flash("This file could not be read."); }
  };
  const validation = (items: string[]) => items.length > 0 && <div className="mt-3 rounded-xl border border-[#e7c3bb] bg-[#fff4f1] p-3 text-xs leading-5 text-[#823c30]"><p className="font-bold">Review these issues:</p>{items.slice(0, 8).map((e) => <p key={e}>{e}</p>)}{items.length > 8 && <p>{items.length - 8} more issues</p>}</div>;
  const textArea = (value: string, onChange: (v: string) => void, placeholder: string, testId: string) => <textarea data-testid={testId} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={5} className={`${INPUT} resize-y font-mono text-xs leading-5`} />;

  return <div className="min-h-[100dvh] bg-[#edf1ed] px-3 py-5 text-[#172b35] sm:px-6 sm:py-8">
    <main className="mx-auto max-w-7xl">
      <header className="mb-6 rounded-3xl border border-[#dbe3dd] bg-[#fffefa] p-5 shadow-sm sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><button type="button" data-testid="button-admin-home" onClick={() => navigate("/admin")} className="mb-4 text-xs font-bold text-[#55716d] hover:text-[#14745b]">← Admin dashboard</button>
            <p className="text-[11px] font-black uppercase tracking-[.19em] text-[#15745b]">SHIKEN / BPSC PRELIMS</p>
            <h1 className="mt-1 font-serif text-3xl font-bold tracking-tight sm:text-4xl">Content console</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5a6d72]">Manage bilingual questions, year-wise PYQs, practice tests and study materials. BPSC data remains in its own Firebase namespace.</p>
          </div>
          <button type="button" data-testid="button-refresh-data" onClick={() => void loadData()} className={`${BUTTON} border border-[#cbd8d1] bg-[#f5f7f1] text-[#31594f]`}>Refresh data</button>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[["Questions", questions.length], ["PYQ records", pyqs.length], ["Mock tests", tests.length], ["Published notes", notes.filter((n) => n.published !== false).length]].map(([label, value]) =>
            <div key={label} className="rounded-xl border border-[#e0e6e0] bg-[#f6f7f2] px-3 py-2"><p className="text-[10px] font-bold uppercase tracking-wide text-[#71817d]">{label}</p><p className="mt-0.5 font-mono text-lg font-bold text-[#243b42]">{value}</p></div>)}
        </div>
      </header>
      {message && <div role="status" data-testid="status-feedback" className="mb-4 rounded-xl border border-[#b5d3c6] bg-[#e5f2e9] px-4 py-3 text-sm font-semibold text-[#205843]">{message}</div>}
      {loadError && <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-[#e4c4b6] bg-[#fff2eb] px-4 py-3 text-sm text-[#813f31]"><span>{loadError}</span><button type="button" data-testid="button-retry-load" onClick={() => void loadData()} className="font-bold underline">Retry</button></div>}
      <nav aria-label="BPSC admin sections" className="mb-5 flex gap-2 overflow-x-auto rounded-2xl border border-[#dce3de] bg-[#f9faf6] p-2">
        {tabs.map(([id, label]) => <button key={id} type="button" data-testid={`tab-${id}`} aria-current={tab === id ? "page" : undefined} onClick={() => setTab(id)} className={`shrink-0 rounded-xl px-3 py-2.5 text-xs font-bold transition-colors sm:px-4 ${tab === id ? "bg-[#1b7059] text-white shadow-sm" : "text-[#566a6e] hover:bg-[#eaf0eb]"}`}>{label}{id === "pyqs" && pyqs.length > 0 ? ` · ${pyqs.length}` : ""}</button>)}
      </nav>
      {loading ? <div className="grid gap-4 lg:grid-cols-2"><div className={`${PANEL} h-64 animate-pulse bg-[#e5ebe5]`} /><div className={`${PANEL} h-64 animate-pulse bg-[#e5ebe5]`} /></div> : <>
      {tab === "questions" && <div className="grid items-start gap-4 xl:grid-cols-[1.1fr_.9fr]">
        <section className={PANEL}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.14em] text-[#688079]">Content operations / 01</p><h2 className="mt-1 text-xl font-bold">{editingId ? "Edit question" : "Add a question"}</h2></div><button type="button" data-testid="button-question-template" onClick={downloadTemplate} className="text-xs font-bold text-[#14745b] underline">CSV template</button></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Question category"><select data-testid="select-question-category" value={question.category} onChange={(e) => setQuestionField("category", e.target.value as BpscCategory)} className={INPUT}>{BPSC_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label} / {c.labelHindi}</option>)}</select></Field>
            <Field label="Source ID"><input data-testid="input-question-source" value={question.sourceId ?? ""} onChange={(e) => setQuestionField("sourceId", e.target.value)} placeholder="Optional source reference" className={INPUT} /></Field>
            <Area label="Question / हिंदी" value={question.question_hi} onChange={(v) => setQuestionField("question_hi", v)} placeholder="हिंदी में प्रश्न" />
            <Area label="Question / English" value={question.question_en} onChange={(v) => setQuestionField("question_en", v)} placeholder="Question in English" />
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">{ANSWERS.map((key) => <div key={key} className="rounded-xl border border-[#e1e7e2] bg-[#f8f9f5] p-2.5"><p className="mb-2 text-[11px] font-black text-[#536c66]">OPTION {key}</p><div className="grid gap-2"><Field label={`Hindi option ${key}`}><input data-testid={`input-option-hi-${key.toLowerCase()}`} value={question.options_hi[key]} onChange={(e) => setOption("hi", key, e.target.value)} className={INPUT} /></Field><Field label={`English option ${key}`}><input data-testid={`input-option-en-${key.toLowerCase()}`} value={question.options_en[key]} onChange={(e) => setOption("en", key, e.target.value)} className={INPUT} /></Field></div></div>)}</div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="Correct answer"><select data-testid="select-correct-answer" value={question.correct_answer} onChange={(e) => setQuestionField("correct_answer", e.target.value as AnswerKey)} className={INPUT}>{ANSWERS.map((a) => <option key={a}>{a}</option>)}</select></Field>
            <Field label="Topic"><input data-testid="input-question-topic" value={question.topic} onChange={(e) => setQuestionField("topic", e.target.value)} placeholder="Topic / chapter" className={INPUT} /></Field>
            <Field label="Year"><input data-testid="input-question-year" value={question.year} onChange={(e) => setQuestionField("year", e.target.value)} placeholder="e.g. 2024" className={INPUT} /></Field>
            <Field label="Publication"><select data-testid="select-question-published" value={question.published ? "yes" : "no"} onChange={(e) => setQuestionField("published", e.target.value === "yes")} className={INPUT}><option value="yes">Published</option><option value="no">Unpublished</option></select></Field>
            <Area label="Explanation / हिंदी" value={question.explanation_hi ?? ""} onChange={(v) => setQuestionField("explanation_hi", v)} placeholder="हिंदी में व्याख्या" />
            <Area label="Explanation / English" value={question.explanation_en ?? ""} onChange={(v) => setQuestionField("explanation_en", v)} placeholder="Answer explanation" />
            <Area label="Related facts / हिंदी" value={question.relatedFacts_hi ?? ""} onChange={(v) => setQuestionField("relatedFacts_hi", v)} placeholder="संबंधित तथ्य" />
            <Area label="Related facts / English" value={question.relatedFacts_en ?? ""} onChange={(v) => setQuestionField("relatedFacts_en", v)} placeholder="Related facts" />
          </div>
          <div className="mt-4 flex flex-wrap gap-2"><button type="button" data-testid="button-save-question" disabled={saving} onClick={() => void saveQuestion()} className={`${BUTTON} bg-[#1b7059] text-white`}>{saving ? "Saving…" : editingId ? "Update question" : "Save question"}</button>{editingId && <button type="button" data-testid="button-cancel-question" onClick={() => { setEditingId(""); setQuestion(newQuestion()); }} className={`${BUTTON} border border-[#d5ded8] text-[#53676b]`}>Cancel edit</button>}</div>
        </section>
        <section className={PANEL}>
          <p className="text-[10px] font-black uppercase tracking-[.14em] text-[#688079]">Batch entry / CSV or JSON</p><h2 className="mt-1 text-xl font-bold">Import question bank</h2>
          <Field label="Select CSV or JSON file"><input data-testid="file-question-import" type="file" accept=".csv,.json,text/csv,application/json" onChange={(e) => void uploadFile(e.target.files?.[0], "question")} className={`${INPUT} file:mr-3 file:rounded-lg file:border-0 file:bg-[#e6eee8] file:px-3 file:py-1.5 file:text-xs file:font-bold`} /></Field>
          <div className="mt-3"><Field label="Or paste bilingual CSV / JSON">{textArea(bulkText, setBulkText, "Paste an array of question objects or the downloadable CSV format.", "textarea-question-import")}</Field></div>
          <div className="mt-3 flex flex-wrap gap-2"><button type="button" data-testid="button-preview-questions" onClick={() => previewRows("question")} className={`${BUTTON} border border-[#cbd8d1] bg-[#f6f8f3] text-[#38574e]`}>Preview and validate</button><button type="button" data-testid="button-upload-questions" disabled={!bulkPreview.length || !!bulkErrors.length || saving} onClick={() => void saveBulk()} className={`${BUTTON} bg-[#1b7059] text-white`}>Upload {bulkPreview.length || ""} rows</button></div>
          {bulkPreview.length > 0 && <p className="mt-3 text-xs font-semibold text-[#287452]">{bulkPreview.length} questions parsed. Both language prompts and all eight options are validated.</p>}{validation(bulkErrors)}
          <div className="mt-6 border-t border-[#e4e9e4] pt-5"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.14em] text-[#688079]">Bilingual library</p><h3 className="mt-1 text-lg font-bold">Question bank <span className="font-mono text-sm text-[#71817d]">{questions.length}</span></h3></div><Field label="Search questions"><input data-testid="input-question-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search topic, category, text" className={INPUT} /></Field></div>
            <div className="mt-3 grid gap-2">{filteredQuestions.slice(0, 100).map((item) => <div key={`${item.category}-${item.id}`} data-testid={`row-question-${item.id}`} className="flex flex-wrap items-center gap-2 rounded-xl border border-[#e2e8e3] bg-[#f8f9f5] p-3"><span className="rounded-md bg-[#e6eee8] px-2 py-1 text-[10px] font-bold text-[#375f52]">{item.category}</span><p className="min-w-[180px] flex-1 text-sm font-medium text-[#293e46]">{item.question_en || item.question_hi}</p><span className={`text-[10px] font-bold ${item.published ? "text-[#23744f]" : "text-[#9a6a28]"}`}>{item.published ? "Published" : "Draft"}</span><button type="button" data-testid={`button-edit-question-${item.id}`} onClick={() => editQuestion(item)} className="text-xs font-bold text-[#216b58]">Edit</button><button type="button" data-testid={`button-toggle-question-${item.id}`} onClick={() => void toggle(`${BPSC_DB_ROOT}/questions/${item.category}/${item.id}`, { id: item.id, published: item.published })} className="text-xs font-bold text-[#826123]">{item.published ? "Unpublish" : "Publish"}</button><button type="button" data-testid={`button-delete-question-${item.id}`} onClick={() => void removeRecord(`${BPSC_DB_ROOT}/questions/${item.category}/${item.id}`)} className="text-xs font-bold text-[#9a493c]">Delete</button></div>)}</div>
            {filteredQuestions.length > 100 && <p className="mt-3 text-xs text-[#677973]">Showing 100 of {filteredQuestions.length}. Refine the search to see more.</p>}
            {!filteredQuestions.length && <p className="mt-4 rounded-xl border border-dashed border-[#cbd8d1] p-5 text-center text-sm text-[#60716e]">No matching questions yet.</p>}
          </div>
        </section>
      </div>}
      {tab === "pyqs" && <div className="grid items-start gap-4 xl:grid-cols-[.9fr_1.1fr]">
        <section className={PANEL}><p className="text-[10px] font-black uppercase tracking-[.14em] text-[#688079]">Year-wise archival</p><h2 className="mt-1 text-xl font-bold">Upload previous-year questions</h2><p className="mt-2 text-sm leading-5 text-[#5f7172]">Each set is written to its year and exam-type node, then appears in the student PYQ section.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2"><Field label="Exam type"><input data-testid="input-pyq-exam-type" value={pyqMeta.examType} onChange={(e) => setPyqMeta({ ...pyqMeta, examType: e.target.value })} className={INPUT} /></Field><Field label="Year"><input data-testid="input-pyq-year" value={pyqMeta.year} onChange={(e) => setPyqMeta({ ...pyqMeta, year: e.target.value })} inputMode="numeric" className={INPUT} /></Field><Field label="Session / paper"><input data-testid="input-pyq-session" value={pyqMeta.session} onChange={(e) => setPyqMeta({ ...pyqMeta, session: e.target.value })} className={INPUT} /></Field></div>
          <Field label="Choose CSV or JSON file"><input data-testid="file-pyq-import" type="file" accept=".csv,.json,text/csv,application/json" onChange={(e) => void uploadFile(e.target.files?.[0], "pyq")} className={`${INPUT} file:mr-3 file:rounded-lg file:border-0 file:bg-[#e6eee8] file:px-3 file:py-1.5 file:text-xs file:font-bold`} /></Field>
          <div className="mt-3"><Field label="Or paste nested bilingual JSON / CSV">{textArea(pyqText, setPyqText, "JSON supports Hindi and English question, options, explanation and related facts, or flattened bilingual columns.", "textarea-pyq-import")}</Field></div>
          <div className="mt-3 flex flex-wrap gap-2"><button type="button" data-testid="button-preview-pyqs" onClick={() => previewRows("pyq")} className={`${BUTTON} border border-[#cbd8d1] text-[#38574e]`}>Preview and validate</button><button type="button" data-testid="button-save-pyqs" disabled={!pyqPreview.length || !!pyqErrors.length || saving} onClick={() => void savePyqs()} className={`${BUTTON} bg-[#1b7059] text-white`}>Save year-wise set</button></div>
          {pyqPreview.length > 0 && <p className="mt-3 text-xs font-semibold text-[#287452]">{pyqPreview.length} rows ready for {pyqMeta.year || "year"} / {pyqMeta.examType}.</p>}{validation(pyqErrors)}
        </section>
        <section className={PANEL}><div className="flex items-end justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.14em] text-[#688079]">Published archive</p><h2 className="mt-1 text-xl font-bold">PYQ sets by year</h2></div><span className="font-mono text-sm text-[#6c7b77]">{pyqs.length} questions</span></div>
          {!pyqs.length ? <div className="mt-4 rounded-xl border border-dashed border-[#cbd8d1] p-7 text-center text-sm text-[#60716e]">No year-wise PYQ set has been uploaded yet. Older question-bank PYQs remain available to students.</div> :
            <div className="mt-4 grid gap-2">{[...pyqs].sort((a, b) => Number(b.year) - Number(a.year)).map((q) => <div key={`${q.year}-${q.examType}-${q.id}`} data-testid={`row-pyq-${q.id}`} className="rounded-xl border border-[#e2e8e3] bg-[#f8f9f5] p-3"><div className="flex flex-wrap items-center gap-2"><span className="rounded-md bg-[#e5eee8] px-2 py-1 text-[10px] font-bold text-[#375f52]">{q.year}</span><span className="text-xs font-bold text-[#51666a]">{q.examType} · {q.category}</span><span className="ml-auto text-[10px] font-bold text-[#287452]">Published</span><button type="button" data-testid={`button-delete-pyq-${q.id}`} onClick={() => void removeRecord(`${BPSC_DB_ROOT}/pyqs/${q.year}/${safeBpscSlug(q.examType)}/${q.id}`)} className="text-xs font-bold text-[#9a493c]">Delete</button></div><p className="mt-2 line-clamp-2 text-sm text-[#293e46]">{q.question_en || q.question_hi}</p></div>)}</div>}
        </section>
      </div>}
      {tab === "tests" && <div className="grid items-start gap-4 xl:grid-cols-[.9fr_1.1fr]">
        <section className={PANEL}><p className="text-[10px] font-black uppercase tracking-[.14em] text-[#688079]">Assessment builder / maximum 150 questions</p><h2 className="mt-1 text-xl font-bold">{editingTestId ? "Edit mock test" : "Create a mock test"}</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="Test name"><input data-testid="input-test-name" value={testForm.name} onChange={(e) => setTestForm({ ...testForm, name: e.target.value })} placeholder="e.g. BPSC Prelims Full Mock 01" className={INPUT} /></Field>
            <Field label="Description"><input data-testid="input-test-description" value={testForm.description} onChange={(e) => setTestForm({ ...testForm, description: e.target.value })} placeholder="Short student-facing description" className={INPUT} /></Field>
            <Field label="Duration (minutes)"><input data-testid="input-test-duration" type="number" min="1" value={testForm.minutes} onChange={(e) => setTestForm({ ...testForm, minutes: e.target.value })} className={INPUT} /></Field>
            <Field label="Marks per question"><input data-testid="input-test-marks" type="number" step="0.25" value={testForm.marks} onChange={(e) => setTestForm({ ...testForm, marks: e.target.value })} className={INPUT} /></Field>
            <Field label="Negative mark"><input data-testid="input-test-negative" type="number" step="0.25" value={testForm.negative} onChange={(e) => setTestForm({ ...testForm, negative: e.target.value })} className={INPUT} /></Field>
          </div>
          <div className="mt-5 rounded-xl border border-[#e1e7e2] bg-[#f7f8f4] p-3"><div className="flex flex-wrap items-end justify-between gap-3"><Field label="Question-bank category"><select data-testid="select-test-category" value={testCategory} onChange={(e) => setTestCategory(e.target.value as BpscCategory | "all")} className={INPUT}><option value="all">All categories</option>{BPSC_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select></Field><span className="text-xs font-bold text-[#5c716b]">{selectedIds.length} / 150 selected</span></div>
            <div className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1">{availableForTest.map((q) => <label key={`${q.category}-${q.id}`} data-testid={`checkbox-test-question-${q.id}`} className="flex cursor-pointer items-start gap-3 rounded-lg border border-[#e1e7e2] bg-[#fffefa] p-3 hover:border-[#9ebcaf]"><input type="checkbox" checked={selectedIds.includes(q.id)} disabled={!selectedIds.includes(q.id) && selectedIds.length >= 150} onChange={(e) => setSelectedIds((current) => e.target.checked ? [...current, q.id] : current.filter((id) => id !== q.id))} className="mt-1 accent-[#1b7059]" /><span className="min-w-0 flex-1"><span className="block text-xs font-bold text-[#2c474c]">{q.category} · {q.year || "No year"}</span><span className="mt-1 block text-xs leading-5 text-[#5d7072]">{q.question_en || q.question_hi}</span></span></label>)}
              {!availableForTest.length && <p className="rounded-lg border border-dashed border-[#cbd8d1] p-4 text-center text-xs text-[#62736e]">No published questions in this selection. Add and publish questions first.</p>}
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2"><button type="button" data-testid="button-save-test" disabled={saving} onClick={() => void saveTest()} className={`${BUTTON} bg-[#1b7059] text-white`}>{editingTestId ? "Update mock test" : "Save mock test"}</button>{editingTestId && <button type="button" data-testid="button-cancel-test" onClick={() => { setEditingTestId(""); setSelectedIds([]); }} className={`${BUTTON} border border-[#d5ded8] text-[#53676b]`}>Cancel edit</button>}</div>
        </section>
        <section className={PANEL}><p className="text-[10px] font-black uppercase tracking-[.14em] text-[#688079]">Student-ready assessments</p><h2 className="mt-1 text-xl font-bold">Mock test library ({tests.length})</h2>
          <div className="mt-4 grid gap-2">{tests.map((item) => <div key={item.id} data-testid={`row-test-${item.id}`} className="flex flex-wrap items-center gap-3 rounded-xl border border-[#e2e8e3] bg-[#f8f9f5] p-3"><div className="min-w-[160px] flex-1"><p className="text-sm font-bold text-[#2b4248]">{String(item.name ?? "Untitled test")}</p><p className="mt-1 text-xs text-[#637575]">{Array.isArray(item.questionIds) ? item.questionIds.length : 0} questions · {Math.round(Number(item.durationSeconds ?? 0) / 60)} min · +{String(item.marksPerQuestion ?? 1)} / −{String(item.negativeMark ?? 0)}</p></div><span className={`text-[10px] font-bold ${item.published === false ? "text-[#9a6a28]" : "text-[#23744f]"}`}>{item.published === false ? "Draft" : "Published"}</span><button type="button" data-testid={`button-edit-test-${item.id}`} onClick={() => editTest(item)} className="text-xs font-bold text-[#216b58]">Edit</button><button type="button" data-testid={`button-toggle-test-${item.id}`} onClick={() => void toggle(`${BPSC_DB_ROOT}/tests/${item.id}`, item)} className="text-xs font-bold text-[#826123]">{item.published === false ? "Publish" : "Unpublish"}</button><button type="button" data-testid={`button-delete-test-${item.id}`} onClick={() => void removeRecord(`${BPSC_DB_ROOT}/tests/${item.id}`)} className="text-xs font-bold text-[#9a493c]">Delete</button></div>)}</div>
        </section>
      </div>}
      {tab === "affairs" && <section className={PANEL}><p className="text-[10px] font-black uppercase tracking-[.14em] text-[#688079]">Daily editorial</p><h2 className="mt-1 text-xl font-bold">{editingAffairId ? "Edit current affair" : "Current affairs"}</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2"><Field label="Section"><select data-testid="select-affair-category" value={affairForm.category} onChange={(e) => setAffairForm({ ...affairForm, category: e.target.value as BpscCurrentAffairsCategory })} className={INPUT}>{BPSC_CURRENT_AFFAIRS_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label} / {c.labelHindi}</option>)}</select></Field><Field label="Date / month"><input data-testid="input-affair-date" value={affairForm.date} onChange={(e) => setAffairForm({ ...affairForm, date: e.target.value })} placeholder="e.g. 12 June 2025" className={INPUT} /></Field><Area label="Title / हिंदी" value={affairForm.title_hi} onChange={(v) => setAffairForm({ ...affairForm, title_hi: v })} placeholder="शीर्षक" /><Area label="Title / English" value={affairForm.title_en} onChange={(v) => setAffairForm({ ...affairForm, title_en: v })} placeholder="Headline" /><Area label="Content / हिंदी" value={affairForm.content_hi} onChange={(v) => setAffairForm({ ...affairForm, content_hi: v })} placeholder="विस्तृत जानकारी" /><Area label="Content / English" value={affairForm.content_en} onChange={(v) => setAffairForm({ ...affairForm, content_en: v })} placeholder="Context and key details" /></div>
        <div className="mt-4 flex gap-2"><button type="button" data-testid="button-save-affair" disabled={saving} onClick={() => void saveAffair()} className={`${BUTTON} bg-[#1b7059] text-white`}>{editingAffairId ? "Update item" : "Save current affair"}</button>{editingAffairId && <button type="button" data-testid="button-cancel-affair" onClick={() => { setEditingAffairId(""); setAffairForm({ category: "national", title_hi: "", title_en: "", content_hi: "", content_en: "", date: "", published: true }); }} className={`${BUTTON} border border-[#d5ded8] text-[#53676b]`}>Cancel edit</button>}</div>
        <div className="mt-6 grid gap-2">{affairs.map((item) => <div key={item.id} data-testid={`row-affair-${item.id}`} className="flex flex-wrap items-center gap-3 rounded-xl border border-[#e2e8e3] bg-[#f8f9f5] p-3"><p className="min-w-[160px] flex-1 truncate text-sm font-bold">{String(item.title_en ?? item.title_hi ?? "Untitled")}</p><button type="button" data-testid={`button-edit-affair-${item.id}`} onClick={() => editAffair(item)} className="text-xs font-bold text-[#216b58]">Edit</button><button type="button" data-testid={`button-toggle-affair-${item.id}`} onClick={() => void toggle(`${BPSC_DB_ROOT}/currentAffairs/${item.id}`, item)} className="text-xs font-bold text-[#826123]">{item.published === false ? "Publish" : "Unpublish"}</button><button type="button" data-testid={`button-delete-affair-${item.id}`} onClick={() => void removeRecord(`${BPSC_DB_ROOT}/currentAffairs/${item.id}`)} className="text-xs font-bold text-[#9a493c]">Delete</button></div>)}</div>
      </section>}
      {tab === "notes" && <div className="grid items-start gap-4 lg:grid-cols-[.85fr_1.15fr]">
        <section className={PANEL}><p className="text-[10px] font-black uppercase tracking-[.14em] text-[#688079]">Study material / PDF storage</p><h2 className="mt-1 text-xl font-bold">{editingNoteId ? "Edit note details" : "Add notes or PDF"}</h2>
          <div className="mt-4 grid gap-3"><Field label="Note title"><input data-testid="input-note-title" value={noteForm.title} onChange={(e) => setNoteForm({ ...noteForm, title: e.target.value })} placeholder="Bihar history revision notes" className={INPUT} /></Field><Field label="Description"><textarea data-testid="input-note-description" value={noteForm.description} onChange={(e) => setNoteForm({ ...noteForm, description: e.target.value })} rows={3} className={`${INPUT} resize-y`} /></Field><Field label="Category"><input data-testid="input-note-category" value={noteForm.category} onChange={(e) => setNoteForm({ ...noteForm, category: e.target.value })} placeholder="History, Bihar special…" className={INPUT} /></Field><Field label="Language"><select data-testid="select-note-language" value={noteForm.language} onChange={(e) => setNoteForm({ ...noteForm, language: e.target.value as BpscLanguage })} className={INPUT}><option value="both">Hindi + English</option><option value="hi">Hindi</option><option value="en">English</option></select></Field><Field label={editingNoteId ? "Replace PDF (optional)" : "Choose PDF file"}><input data-testid="file-note-pdf" type="file" accept="application/pdf,.pdf" onChange={(e) => setNoteFile(e.target.files?.[0] ?? null)} className={`${INPUT} file:mr-3 file:rounded-lg file:border-0 file:bg-[#e6eee8] file:px-3 file:py-1.5 file:text-xs file:font-bold`} />{noteFile && <span className="mt-1 block text-xs text-[#55716d]">{noteFile.name} · {(noteFile.size / 1024 / 1024).toFixed(2)} MB</span>}</Field><Field label="Student visibility"><select data-testid="select-note-published" value={noteForm.published ? "yes" : "no"} onChange={(e) => setNoteForm({ ...noteForm, published: e.target.value === "yes" })} className={INPUT}><option value="yes">Published</option><option value="no">Unpublished</option></select></Field></div>
          <div className="mt-4 flex flex-wrap gap-2"><button type="button" data-testid="button-save-note" disabled={saving} onClick={() => void saveNote()} className={`${BUTTON} bg-[#1b7059] text-white`}>{saving ? "Saving PDF…" : editingNoteId ? "Save note changes" : "Upload and publish"}</button>{editingNoteId && <button type="button" data-testid="button-cancel-note" onClick={() => { setEditingNoteId(""); setNoteFile(null); setNoteForm({ title: "", description: "", category: "General", language: "both", published: true }); }} className={`${BUTTON} border border-[#d5ded8] text-[#53676b]`}>Cancel edit</button>}</div>
        </section>
        <section className={PANEL}><p className="text-[10px] font-black uppercase tracking-[.14em] text-[#688079]">Content library</p><h2 className="mt-1 text-xl font-bold">Notes and PDFs ({notes.length})</h2>
          <div className="mt-4 grid gap-2">{notes.map((item) => <div key={item.id} data-testid={`row-note-${item.id}`} className="flex flex-wrap items-center gap-3 rounded-xl border border-[#e2e8e3] bg-[#f8f9f5] p-3"><div className="min-w-[150px] flex-1"><p className="text-sm font-bold text-[#293e46]">{String(item.title ?? "Untitled note")}</p><p className="mt-1 text-xs text-[#637575]">{String(item.category ?? "General")} · {String(item.language ?? "both")} · {item.fileName ? String(item.fileName) : "PDF"}</p><p className="mt-1 text-[10px] font-bold text-[#71817d]">{item.published === false ? "Unpublished" : "Published"}</p></div>{typeof item.pdfUrl === "string" && <a data-testid={`link-open-note-${item.id}`} href={item.pdfUrl} target="_blank" rel="noreferrer" className="text-xs font-bold text-[#216b58] underline">Open PDF</a>}<button type="button" data-testid={`button-edit-note-${item.id}`} onClick={() => editNote(item)} className="text-xs font-bold text-[#216b58]">Edit</button><button type="button" data-testid={`button-toggle-note-${item.id}`} onClick={() => void toggle(`${BPSC_DB_ROOT}/notes/${item.id}`, item)} className="text-xs font-bold text-[#826123]">{item.published === false ? "Publish" : "Unpublish"}</button><button type="button" data-testid={`button-delete-note-${item.id}`} disabled={saving} onClick={() => void deleteNote(item)} className="text-xs font-bold text-[#9a493c]">Delete</button></div>)}</div>
          {!notes.length && <div className="mt-4 rounded-xl border border-dashed border-[#cbd8d1] p-7 text-center text-sm text-[#60716e]">No notes uploaded yet. Select a PDF to publish the first study resource.</div>}
        </section>
      </div>}
      {tab === "pricing" && <section className={PANEL}><p className="text-[10px] font-black uppercase tracking-[.14em] text-[#688079]">Plan configuration</p><h2 className="mt-1 text-xl font-bold">BPSC premium pricing</h2><p className="mt-2 max-w-2xl text-sm leading-5 text-[#607273]">This retains the existing competitive plan configuration and BPSC plan ID. The payment server remains authoritative for new orders.</p><div className="mt-4 grid max-w-xl gap-3 sm:grid-cols-2"><Field label="Price (INR)"><input data-testid="input-price-amount" type="number" min="1" value={priceForm.amount} onChange={(e) => setPriceForm({ ...priceForm, amount: e.target.value })} className={INPUT} /></Field><Field label="Access duration (days)"><input data-testid="input-price-days" type="number" min="1" value={priceForm.days} onChange={(e) => setPriceForm({ ...priceForm, days: e.target.value })} className={INPUT} /></Field></div><button type="button" data-testid="button-save-pricing" onClick={() => void savePricing()} className={`${BUTTON} mt-4 bg-[#1b7059] text-white`}>Save BPSC pricing</button></section>}
      </>}
    </main>
  </div>;
}
