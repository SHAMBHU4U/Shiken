import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createQuestionId } from "@/lib/questionSchema";

const DB_URL = "https://shiken-d8789-default-rtdb.firebaseio.com";
const ADMIN_PASSWORD = "#Shiken@468%";

function toChapterSlug(chapter: string): string {
  return chapter.trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u0900-\u097f]+/g, "_")
    .replace(/^_+|_+$/g, "") || "general";
}

const SUBJECTS = [
  { id: "maths",          dbPath: "maths",           label: "Maths (गणित)",            accent: "#06b6d4", schema: "maths" },
  { id: "science",        dbPath: "science",         label: "Science (विज्ञान)",         accent: "#10b981", schema: "science" },
  { id: "english",        dbPath: "english",         label: "English (अंग्रेज़ी)",       accent: "#8b5cf6", schema: "english" },
  { id: "hindi",          dbPath: "hindi",           label: "Hindi (हिंदी)",             accent: "#f97316", schema: "hindi" },
  { id: "social_science", dbPath: "social science",  label: "Social Science (सामाजिक विज्ञान)", accent: "#f59e0b", schema: "social" },
  { id: "sanskrit",       dbPath: "sanskrit",        label: "Sanskrit (संस्कृत)",        accent: "#ec4899", schema: "social" },
];

const OPTIONS = ["A", "B", "C", "D"] as const;

interface FormState {
  subject: string;
  chapter: string;
  questionEn: string;
  questionHi: string;
  optionsEn: Record<string, string>;
  optionsHi: Record<string, string>;
  correctAnswer: string;
  explanationEn: string;
  explanationHi: string;
}

const defaultForm = (): FormState => ({
  subject: "maths",
  chapter: "",
  questionEn: "",
  questionHi: "",
  optionsEn: { A: "", B: "", C: "", D: "" },
  optionsHi: { A: "", B: "", C: "", D: "" },
  correctAnswer: "A",
  explanationEn: "",
  explanationHi: "",
});

function buildPayload(form: FormState) {
  const subject = SUBJECTS.find((s) => s.id === form.subject)!;
  const idx = OPTIONS.indexOf(form.correctAnswer as typeof OPTIONS[number]);
  const optionsEn = OPTIONS.map((letter) => form.optionsEn[letter].trim());
  const optionsHi = OPTIONS.map((letter) => form.optionsHi[letter].trim());
  const chapter = form.chapter.trim() || "General";
  const question = form.questionEn.trim();

  return {
    questionId: createQuestionId(subject.id, chapter),
    subject: subject.label,
    chapter,
    correctOptionIndex: idx,
    en: {
      question,
      options: optionsEn,
      explanation: form.explanationEn.trim(),
    },
    hi: {
      question: form.questionHi.trim(),
      options: optionsHi,
      explanation: form.explanationHi.trim(),
    },
    source: "admin-portal",
    addedAt: Date.now(),
  };
}

// ── Password Gate ──────────────────────────────────────────────────────────────
function PasswordGate({ onUnlock }: { onUnlock: () => void }) {
  const [pw, setPw] = useState("");
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);

  function attempt(e: React.FormEvent) {
    e.preventDefault();
    if (pw === ADMIN_PASSWORD) {
      onUnlock();
    } else {
      setError(true);
      setShake(true);
      setPw("");
      setTimeout(() => setShake(false), 600);
    }
  }

  return (
    <div className="question-admin-shell min-h-screen flex items-center justify-center px-4" style={{ background: "var(--app-bg)" }}>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
        className="w-full max-w-xs"
      >
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center text-2xl"
            style={{ background: "rgba(139,92,246,0.14)", border: "1px solid rgba(139,92,246,0.3)" }}>
            🔐
          </div>
          <h1 className="text-white font-black text-xl">Question Portal</h1>
          <p className="text-white/30 text-xs mt-1">Admin access only</p>
        </div>

        <motion.form
          onSubmit={attempt}
          animate={shake ? { x: [-10, 10, -8, 8, -4, 4, 0] } : { x: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col gap-3"
        >
          <input
            type="password"
            value={pw}
            onChange={(e) => { setPw(e.target.value); setError(false); }}
            placeholder="Enter admin password"
            autoFocus
            required
            className="w-full px-4 py-3.5 rounded-xl text-sm text-white placeholder-white/25 outline-none"
            style={{
              background: error ? "rgba(239,68,68,0.08)" : "rgba(255,255,255,0.06)",
              border: `1px solid ${error ? "rgba(239,68,68,0.4)" : "rgba(255,255,255,0.10)"}`,
            }}
          />
          {error && (
            <p className="text-red-400 text-xs -mt-1 ml-1">Wrong password. Try again.</p>
          )}
          <motion.button
            type="submit"
            whileTap={{ scale: 0.97 }}
            className="w-full py-3.5 rounded-xl text-sm font-bold text-white"
            style={{ background: "linear-gradient(135deg, #8b5cf6, #6366f1)", boxShadow: "0 4px 20px rgba(139,92,246,0.35)" }}
          >
            Unlock →
          </motion.button>
        </motion.form>
      </motion.div>
    </div>
  );
}

// ── Main Admin Form ────────────────────────────────────────────────────────────
function QuestionForm() {
  const [form, setForm] = useState<FormState>(defaultForm());
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);
  const [activeLanguage, setActiveLanguage] = useState<"en" | "hi">("en");

  const currentSubject = SUBJECTS.find((s) => s.id === form.subject)!;

  function setField<K extends keyof FormState>(key: K, val: FormState[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  function setOptionEn(letter: string, val: string) {
    setForm((f) => ({ ...f, optionsEn: { ...f.optionsEn, [letter]: val } }));
  }

  function setOptionHi(letter: string, val: string) {
    setForm((f) => ({ ...f, optionsHi: { ...f.optionsHi, [letter]: val } }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Basic validation
    if (!form.questionEn.trim()) return showToast(false, "Question (English) is required.");
    for (const l of OPTIONS) {
      if (!form.optionsEn[l].trim()) return showToast(false, `Option ${l} is required.`);
    }

    setSubmitting(true);
    try {
      const payload = buildPayload(form);
      const subj = SUBJECTS.find((s) => s.id === form.subject)!;
      const chSlug = toChapterSlug(form.chapter || "general");
      const path = `${DB_URL}/${subj.dbPath}/${chSlug}.json`;
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      showToast(true, "Question added successfully! 🎉");
      setForm((f) => ({ ...defaultForm(), subject: f.subject, chapter: f.chapter }));
    } catch (err) {
      showToast(false, `Failed to add question: ${(err as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  }

  function showToast(ok: boolean, msg: string) {
    setToast({ ok, msg });
    setTimeout(() => setToast(null), 4000);
  }

  const inputStyle = {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.10)",
    color: "#fff",
    borderRadius: "12px",
    padding: "10px 14px",
    fontSize: "14px",
    width: "100%",
    outline: "none",
  } as React.CSSProperties;

  const labelStyle: React.CSSProperties = {
    color: "rgba(255,255,255,0.40)",
    fontSize: "11px",
    fontWeight: 700,
    letterSpacing: "0.05em",
    textTransform: "uppercase",
    marginBottom: "6px",
    display: "block",
  };

  return (
    <div className="question-admin-shell min-h-screen pb-16 px-4 pt-8" style={{ background: "var(--app-bg)" }}>
      <div className="max-w-xl mx-auto">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-3 text-xs font-bold"
            style={{ background: "rgba(139,92,246,0.14)", border: "1px solid rgba(139,92,246,0.3)", color: "#a78bfa" }}>
            🔒 Admin Portal
          </div>
          <h1 className="text-white font-black text-2xl mb-1">Add New Question</h1>
          <p className="text-white/30 text-sm">Push questions directly to Firebase</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">

          {/* Subject + Chapter */}
          <div className="rounded-2xl p-4 flex flex-col gap-4"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div>
              <label style={labelStyle}>Subject</label>
              <select
                value={form.subject}
                onChange={(e) => setField("subject", e.target.value)}
                style={{ ...inputStyle, appearance: "none" }}
              >
                {SUBJECTS.map((s) => (
                  <option key={s.id} value={s.id} style={{ background: "#1a1a2e" }}>{s.label}</option>
                ))}
              </select>
              <p className="text-xs mt-1.5" style={{ color: currentSubject.accent }}>
                Firebase path: /{currentSubject.id}/
              </p>
            </div>

            <div>
              <label style={labelStyle}>Chapter Name</label>
              <input
                type="text"
                value={form.chapter}
                onChange={(e) => setField("chapter", e.target.value)}
                placeholder="e.g. Algebra, Photosynthesis, The Hack Driver…"
                style={inputStyle}
              />
            </div>
          </div>

          {/* Bilingual question and explanation */}
          <div className="rounded-2xl p-4 flex flex-col gap-4"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="flex gap-2 rounded-xl p-1" style={{ background: "rgba(148,163,184,0.16)" }}>
              {(["en", "hi"] as const).map((language) => (
                <button
                  key={language}
                  type="button"
                  onClick={() => setActiveLanguage(language)}
                  className="flex-1 rounded-lg px-3 py-2 text-xs font-black transition-all"
                  style={{
                    background: activeLanguage === language ? "#ffffff" : "transparent",
                    color: activeLanguage === language ? "#17263d" : "#52647b",
                    boxShadow: activeLanguage === language ? "0 2px 8px rgba(51,65,85,0.12)" : "none",
                  }}
                >
                  {language === "en" ? "English" : "हिंदी"}
                </button>
              ))}
            </div>
            <div>
              <label style={labelStyle}>Question Text ({activeLanguage === "en" ? "English" : "Hindi"}) {activeLanguage === "en" ? "*" : ""}</label>
              <textarea
                value={activeLanguage === "en" ? form.questionEn : form.questionHi}
                onChange={(e) => setField(activeLanguage === "en" ? "questionEn" : "questionHi", e.target.value)}
                placeholder={activeLanguage === "en" ? "Enter the question in English…" : "प्रश्न हिंदी में लिखें…"}
                rows={3}
                required={activeLanguage === "en"}
                style={{ ...inputStyle, resize: "vertical" }}
              />
            </div>
            <div>
              <label style={labelStyle}>Explanation ({activeLanguage === "en" ? "English" : "Hindi"}) <span style={{ color: "#718198", fontWeight: 400 }}>optional</span></label>
              <textarea
                value={activeLanguage === "en" ? form.explanationEn : form.explanationHi}
                onChange={(e) => setField(activeLanguage === "en" ? "explanationEn" : "explanationHi", e.target.value)}
                placeholder={activeLanguage === "en" ? "Explain why this answer is correct…" : "यह उत्तर सही क्यों है, हिंदी में लिखें…"}
                rows={3}
                style={{ ...inputStyle, resize: "vertical" }}
              />
            </div>
          </div>

          {/* Bilingual options */}
          <div className="rounded-2xl p-4 flex flex-col gap-3"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="flex items-center justify-between mb-1">
              <span style={{ ...labelStyle, marginBottom: 0 }}>Options ({activeLanguage === "en" ? "English" : "Hindi"})</span>
              <span className="text-xs font-semibold" style={{ color: "#52647b" }}>
                Switch tabs to complete both
              </span>
            </div>

            {OPTIONS.map((letter) => (
              <div key={letter} className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black shrink-0"
                    style={{
                      background: form.correctAnswer === letter ? `${currentSubject.accent}25` : "#dbe4ee",
                      color: form.correctAnswer === letter ? currentSubject.accent : "#52647b",
                      border: form.correctAnswer === letter ? `1px solid ${currentSubject.accent}50` : "1px solid rgba(0,0,0,0.08)",
                    }}>
                    {letter}
                  </span>
                  <input
                    type="text"
                    value={activeLanguage === "en" ? form.optionsEn[letter] : form.optionsHi[letter]}
                    onChange={(e) => activeLanguage === "en" ? setOptionEn(letter, e.target.value) : setOptionHi(letter, e.target.value)}
                    placeholder={activeLanguage === "en" ? `Option ${letter}…` : `विकल्प ${letter}…`}
                    required
                    style={{ ...inputStyle, flex: 1 }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Correct Answer */}
          <div className="rounded-2xl p-4"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <label style={labelStyle}>Correct Answer *</label>
            <div className="flex gap-2">
              {OPTIONS.map((letter) => (
                <button
                  key={letter}
                  type="button"
                  onClick={() => setField("correctAnswer", letter)}
                  className="flex-1 py-3 rounded-xl text-sm font-black transition-all"
                  style={{
                    background: form.correctAnswer === letter
                      ? `linear-gradient(135deg, ${currentSubject.accent}, ${currentSubject.accent}bb)`
                      : "rgba(255,255,255,0.05)",
                    color: form.correctAnswer === letter ? "#000" : "rgba(255,255,255,0.32)",
                    border: form.correctAnswer === letter ? "none" : "1px solid rgba(0,0,0,0.08)",
                    boxShadow: form.correctAnswer === letter ? `0 4px 16px ${currentSubject.accent}40` : "none",
                  }}
                >
                  {letter}
                </button>
              ))}
            </div>
            {form.optionsEn[form.correctAnswer] && (
              <p className="text-xs mt-2.5 pl-1" style={{ color: currentSubject.accent }}>
                ✓ {form.optionsEn[form.correctAnswer]}
              </p>
            )}
          </div>

          {/* Submit */}
          <motion.button
            type="submit"
            disabled={submitting}
            whileTap={{ scale: submitting ? 1 : 0.97 }}
            className="w-full py-4 rounded-2xl font-black text-base transition-all flex items-center justify-center gap-2"
            style={{
              background: submitting
                ? "rgba(139,92,246,0.3)"
                : `linear-gradient(135deg, ${currentSubject.accent}, ${currentSubject.accent}99)`,
              color: submitting ? "#fff" : "#000",
              boxShadow: submitting ? "none" : `0 6px 28px ${currentSubject.accent}40`,
            }}
          >
            {submitting ? (
              <>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                  className="w-4 h-4 rounded-full border-2 border-white/30"
                  style={{ borderTopColor: "#fff" }}
                />
                Pushing to Firebase…
              </>
            ) : (
              <>⚡ Add Question to Firebase</>
            )}
          </motion.button>
        </form>
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 inset-x-4 max-w-sm mx-auto rounded-2xl px-4 py-3.5 text-sm font-semibold text-center"
            style={{
              background: toast.ok ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)",
              border: `1px solid ${toast.ok ? "rgba(16,185,129,0.4)" : "rgba(239,68,68,0.4)"}`,
              color: toast.ok ? "#10b981" : "#ef4444",
              backdropFilter: "blur(12px)",
            }}
          >
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Page root ─────────────────────────────────────────────────────────────────
export default function QuestionAdminPage() {
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem("qa_portal") === "1");

  function unlock() {
    sessionStorage.setItem("qa_portal", "1");
    setUnlocked(true);
  }

  return unlocked ? <QuestionForm /> : <PasswordGate onUnlock={unlock} />;
}
