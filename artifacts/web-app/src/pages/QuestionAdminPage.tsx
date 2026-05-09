import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const DB_URL = "https://shiken-d8789-default-rtdb.firebaseio.com";
const ADMIN_PASSWORD = "shiken@admin2025";

const SUBJECTS = [
  { id: "maths",          label: "Maths (गणित)",            accent: "#06b6d4", schema: "maths" },
  { id: "science",        label: "Science (विज्ञान)",         accent: "#10b981", schema: "science" },
  { id: "english",        label: "English (अंग्रेज़ी)",       accent: "#8b5cf6", schema: "english" },
  { id: "hindi",          label: "Hindi (हिंदी)",             accent: "#f97316", schema: "hindi" },
  { id: "social%20science", label: "Social Science (सामाजिक विज्ञान)", accent: "#f59e0b", schema: "social" },
  { id: "sanskrit",       label: "Sanskrit (संस्कृत)",        accent: "#ec4899", schema: "social" },
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
  explanation: string;
}

const defaultForm = (): FormState => ({
  subject: "maths",
  chapter: "",
  questionEn: "",
  questionHi: "",
  optionsEn: { A: "", B: "", C: "", D: "" },
  optionsHi: { A: "", B: "", C: "", D: "" },
  correctAnswer: "A",
  explanation: "",
});

function buildPayload(form: FormState) {
  const subj = SUBJECTS.find((s) => s.id === form.subject)!;
  const schema = subj.schema;

  if (schema === "maths" || schema === "science") {
    return {
      question_english: form.questionEn.trim(),
      question_hindi: form.questionHi.trim() || form.questionEn.trim(),
      chapter_name: form.chapter.trim() || "General",
      options: {
        A: form.optionsEn.A.trim(),
        B: form.optionsEn.B.trim(),
        C: form.optionsEn.C.trim(),
        D: form.optionsEn.D.trim(),
      },
      options_hindi: form.optionsHi.A
        ? { A: form.optionsHi.A.trim(), B: form.optionsHi.B.trim(), C: form.optionsHi.C.trim(), D: form.optionsHi.D.trim() }
        : undefined,
      correct_answer: form.correctAnswer,
      explanation: form.explanation.trim() || undefined,
      source: "admin-portal",
      addedAt: Date.now(),
    };
  }

  if (schema === "english") {
    const idx = OPTIONS.indexOf(form.correctAnswer as typeof OPTIONS[number]);
    return {
      question: form.questionEn.trim(),
      question_hi: form.questionHi.trim() || undefined,
      options: [form.optionsEn.A.trim(), form.optionsEn.B.trim(), form.optionsEn.C.trim(), form.optionsEn.D.trim()],
      options_hi: form.optionsHi.A
        ? [form.optionsHi.A.trim(), form.optionsHi.B.trim(), form.optionsHi.C.trim(), form.optionsHi.D.trim()]
        : undefined,
      answer: idx,
      chapter: form.chapter.trim() || "General",
      explanation: form.explanation.trim() || undefined,
      source: "admin-portal",
      addedAt: Date.now(),
    };
  }

  if (schema === "hindi") {
    const letter = form.correctAnswer;
    const correctText = `(${letter}) ${form.optionsEn[letter].trim()}`;
    return {
      question: form.questionHi.trim() || form.questionEn.trim(),
      options: [
        `(A) ${form.optionsEn.A.trim()}`,
        `(B) ${form.optionsEn.B.trim()}`,
        `(C) ${form.optionsEn.C.trim()}`,
        `(D) ${form.optionsEn.D.trim()}`,
      ],
      answer: correctText,
      chapter: form.chapter.trim() || "General",
      explanation: form.explanation.trim() || undefined,
      source: "admin-portal",
      addedAt: Date.now(),
    };
  }

  // social / sanskrit — bilingual question with /
  const idx = OPTIONS.indexOf(form.correctAnswer as typeof OPTIONS[number]);
  const qBilingual = form.questionHi.trim()
    ? `${form.questionEn.trim()} / ${form.questionHi.trim()}`
    : form.questionEn.trim();
  return {
    question: qBilingual,
    options: [form.optionsEn.A.trim(), form.optionsEn.B.trim(), form.optionsEn.C.trim(), form.optionsEn.D.trim()],
    answer: idx,
    chapter: form.chapter.trim() || "General",
    explanation: form.explanation.trim() || undefined,
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
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "#f8f9ff" }}>
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
              background: error ? "rgba(239,68,68,0.08)" : "rgba(0,0,0,0.06)",
              border: `1px solid ${error ? "rgba(239,68,68,0.4)" : "rgba(0,0,0,0.10)"}`,
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
  const [showHindi, setShowHindi] = useState(false);

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
      const path = `${DB_URL}/${form.subject}.json`;
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
    background: "rgba(0,0,0,0.05)",
    border: "1px solid rgba(0,0,0,0.10)",
    color: "#fff",
    borderRadius: "12px",
    padding: "10px 14px",
    fontSize: "14px",
    width: "100%",
    outline: "none",
  } as React.CSSProperties;

  const labelStyle: React.CSSProperties = {
    color: "rgba(0,0,0,0.40)",
    fontSize: "11px",
    fontWeight: 700,
    letterSpacing: "0.05em",
    textTransform: "uppercase",
    marginBottom: "6px",
    display: "block",
  };

  return (
    <div className="min-h-screen pb-16 px-4 pt-8" style={{ background: "#f8f9ff" }}>
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
            style={{ background: "rgba(0,0,0,0.05)", border: "1px solid rgba(0,0,0,0.06)" }}>
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

          {/* Question */}
          <div className="rounded-2xl p-4 flex flex-col gap-4"
            style={{ background: "rgba(0,0,0,0.05)", border: "1px solid rgba(0,0,0,0.06)" }}>
            <div>
              <label style={labelStyle}>Question Text (English) *</label>
              <textarea
                value={form.questionEn}
                onChange={(e) => setField("questionEn", e.target.value)}
                placeholder="Enter the question in English…"
                rows={3}
                required
                style={{ ...inputStyle, resize: "vertical" }}
              />
            </div>
            <div>
              <label style={labelStyle}>Question Text (Hindi) <span style={{ color: "rgba(0,0,0,0.20)", fontWeight: 400 }}>optional</span></label>
              <textarea
                value={form.questionHi}
                onChange={(e) => setField("questionHi", e.target.value)}
                placeholder="प्रश्न हिंदी में लिखें (वैकल्पिक)…"
                rows={2}
                style={{ ...inputStyle, resize: "vertical" }}
              />
            </div>
          </div>

          {/* Options */}
          <div className="rounded-2xl p-4 flex flex-col gap-3"
            style={{ background: "rgba(0,0,0,0.05)", border: "1px solid rgba(0,0,0,0.06)" }}>
            <div className="flex items-center justify-between mb-1">
              <span style={{ ...labelStyle, marginBottom: 0 }}>Options</span>
              <button
                type="button"
                onClick={() => setShowHindi((v) => !v)}
                className="text-xs font-semibold transition-colors"
                style={{ color: showHindi ? "#a78bfa" : "rgba(0,0,0,0.22)" }}
              >
                {showHindi ? "✓ Hindi options on" : "+ Add Hindi options"}
              </button>
            </div>

            {OPTIONS.map((letter) => (
              <div key={letter} className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black shrink-0"
                    style={{
                      background: form.correctAnswer === letter ? `${currentSubject.accent}25` : "rgba(0,0,0,0.06)",
                      color: form.correctAnswer === letter ? currentSubject.accent : "rgba(0,0,0,0.32)",
                      border: form.correctAnswer === letter ? `1px solid ${currentSubject.accent}50` : "1px solid rgba(0,0,0,0.08)",
                    }}>
                    {letter}
                  </span>
                  <input
                    type="text"
                    value={form.optionsEn[letter]}
                    onChange={(e) => setOptionEn(letter, e.target.value)}
                    placeholder={`Option ${letter}…`}
                    required
                    style={{ ...inputStyle, flex: 1 }}
                  />
                </div>
                {showHindi && (
                  <div className="flex items-center gap-2 pl-9">
                    <input
                      type="text"
                      value={form.optionsHi[letter]}
                      onChange={(e) => setOptionHi(letter, e.target.value)}
                      placeholder={`Option ${letter} in Hindi…`}
                      style={{ ...inputStyle, flex: 1, fontSize: "13px" }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Correct Answer */}
          <div className="rounded-2xl p-4"
            style={{ background: "rgba(0,0,0,0.05)", border: "1px solid rgba(0,0,0,0.06)" }}>
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
                      : "rgba(0,0,0,0.05)",
                    color: form.correctAnswer === letter ? "#000" : "rgba(0,0,0,0.32)",
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

          {/* Explanation */}
          <div className="rounded-2xl p-4"
            style={{ background: "rgba(0,0,0,0.05)", border: "1px solid rgba(0,0,0,0.06)" }}>
            <label style={labelStyle}>Explanation <span style={{ color: "rgba(0,0,0,0.20)", fontWeight: 400 }}>optional</span></label>
            <textarea
              value={form.explanation}
              onChange={(e) => setField("explanation", e.target.value)}
              placeholder="Explain why this answer is correct (shown after test)…"
              rows={3}
              style={{ ...inputStyle, resize: "vertical" }}
            />
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
