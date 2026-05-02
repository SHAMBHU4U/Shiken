import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ref, get } from "firebase/database";
import { db } from "../firebase.js";
import { useParams, useLocation } from "wouter";

const subjectMeta: Record<string, { label: string; icon: string; accent: string; path: string }> = {
  maths:   { label: "Maths",         icon: "📐", accent: "#06b6d4", path: "maths"   },
  english: { label: "English",       icon: "📖", accent: "#8b5cf6", path: "english" },
  hindi:   { label: "Hindi",         icon: "🔤", accent: "#f97316", path: "hindi"   },
  science: { label: "Science",       icon: "🔬", accent: "#10b981", path: "science" },
  social:  { label: "Social Science",icon: "🌍", accent: "#f59e0b", path: "social"  },
};

interface Question {
  english: string;
  hindi: string;
  options: string[];
  answerIndex: number;
}

const demoQuestions: Record<string, Question[]> = {
  maths: [
    {
      english: "What is the value of π (Pi) up to two decimal places?",
      hindi: "π (पाई) का मान दो दशमलव स्थानों तक क्या है?",
      options: ["3.14", "3.41", "3.12", "3.16"],
      answerIndex: 0,
    },
    {
      english: "If a triangle has angles 60°, 60°, and 60°, what type of triangle is it?",
      hindi: "यदि त्रिभुज के कोण 60°, 60° और 60° हैं, तो यह किस प्रकार का त्रिभुज है?",
      options: ["Scalene / विषमबाहु", "Isosceles / समद्विबाहु", "Equilateral / समबाहु", "Right-angled / समकोण"],
      answerIndex: 2,
    },
    {
      english: "What is the square root of 144?",
      hindi: "144 का वर्गमूल क्या है?",
      options: ["11", "12", "13", "14"],
      answerIndex: 1,
    },
    {
      english: "The simple interest on ₹1000 at 5% per annum for 2 years is:",
      hindi: "₹1000 पर 5% वार्षिक ब्याज दर से 2 वर्षों का साधारण ब्याज है:",
      options: ["₹50", "₹100", "₹150", "₹200"],
      answerIndex: 1,
    },
    {
      english: "What is 15% of 200?",
      hindi: "200 का 15% क्या है?",
      options: ["25", "30", "35", "40"],
      answerIndex: 1,
    },
  ],
  science: [
    {
      english: "Which gas do plants absorb during photosynthesis?",
      hindi: "प्रकाश संश्लेषण के दौरान पौधे कौन सी गैस अवशोषित करते हैं?",
      options: ["Oxygen / ऑक्सीजन", "Nitrogen / नाइट्रोजन", "Carbon Dioxide / कार्बन डाइऑक्साइड", "Hydrogen / हाइड्रोजन"],
      answerIndex: 2,
    },
    {
      english: "What is the chemical formula of water?",
      hindi: "पानी का रासायनिक सूत्र क्या है?",
      options: ["H₂O₂", "HO", "H₂O", "H₃O"],
      answerIndex: 2,
    },
    {
      english: "The unit of electric current is:",
      hindi: "विद्युत धारा की इकाई है:",
      options: ["Volt / वोल्ट", "Watt / वाट", "Ohm / ओम", "Ampere / एम्पीयर"],
      answerIndex: 3,
    },
    {
      english: "Which planet is known as the Red Planet?",
      hindi: "किस ग्रह को लाल ग्रह के नाम से जाना जाता है?",
      options: ["Venus / शुक्र", "Mars / मंगल", "Jupiter / बृहस्पति", "Saturn / शनि"],
      answerIndex: 1,
    },
    {
      english: "Newton's first law of motion is also called the law of:",
      hindi: "न्यूटन का गति का पहला नियम किसका नियम भी कहलाता है?",
      options: ["Acceleration / त्वरण", "Inertia / जड़त्व", "Action-Reaction / क्रिया-प्रतिक्रिया", "Gravity / गुरुत्वाकर्षण"],
      answerIndex: 1,
    },
  ],
  english: [
    {
      english: "Choose the correct synonym of 'Brave':",
      hindi: "'Brave' का सही पर्यायवाची चुनें:",
      options: ["Cowardly", "Courageous", "Fearful", "Timid"],
      answerIndex: 1,
    },
    {
      english: "Fill in the blank: She __ to school every day.",
      hindi: "रिक्त स्थान भरें: She __ to school every day.",
      options: ["go", "goes", "going", "gone"],
      answerIndex: 1,
    },
    {
      english: "Which of these is a noun?",
      hindi: "इनमें से कौन सा संज्ञा (Noun) है?",
      options: ["Run", "Happy", "Quickly", "Freedom"],
      answerIndex: 3,
    },
    {
      english: "The antonym of 'Ancient' is:",
      hindi: "'Ancient' का विलोम शब्द है:",
      options: ["Old", "Modern", "Historical", "Aged"],
      answerIndex: 1,
    },
    {
      english: "Identify the correct passive voice: 'The teacher teaches the students.'",
      hindi: "सही passive voice पहचानें: 'The teacher teaches the students.'",
      options: [
        "The students are taught by the teacher.",
        "The students were taught by the teacher.",
        "The students have been taught by the teacher.",
        "The students taught by the teacher.",
      ],
      answerIndex: 0,
    },
  ],
  hindi: [
    {
      english: "What is the feminine form of 'राजा' (King)?",
      hindi: "'राजा' का स्त्रीलिंग क्या है?",
      options: ["रानी", "राजनी", "राजकुमारी", "महारानी"],
      answerIndex: 0,
    },
    {
      english: "Which of the following is a samas (compound word) in Hindi?",
      hindi: "निम्नलिखित में से कौन सा हिंदी में समास है?",
      options: ["और", "लेकिन", "राजमहल", "परंतु"],
      answerIndex: 2,
    },
    {
      english: "The word 'पुस्तक' means:",
      hindi: "'पुस्तक' शब्द का अर्थ है:",
      options: ["School / विद्यालय", "Teacher / अध्यापक", "Book / किताब", "Pen / कलम"],
      answerIndex: 2,
    },
    {
      english: "Which poet wrote 'Ramcharitmanas'?",
      hindi: "'रामचरितमानस' किस कवि ने लिखी?",
      options: ["कबीरदास", "तुलसीदास", "मीराबाई", "सूरदास"],
      answerIndex: 1,
    },
    {
      english: "How many vowels (swar) are there in Hindi?",
      hindi: "हिंदी में कितने स्वर हैं?",
      options: ["10", "11", "12", "13"],
      answerIndex: 1,
    },
  ],
  social: [
    {
      english: "Who was the first President of India?",
      hindi: "भारत के पहले राष्ट्रपति कौन थे?",
      options: ["Jawaharlal Nehru / जवाहरलाल नेहरू", "Sardar Patel / सरदार पटेल", "Dr. Rajendra Prasad / डॉ. राजेंद्र प्रसाद", "B.R. Ambedkar / बी.आर. अंबेडकर"],
      answerIndex: 2,
    },
    {
      english: "Which river is known as the 'Sorrow of Bihar'?",
      hindi: "किस नदी को 'बिहार का शोक' कहा जाता है?",
      options: ["Ganga / गंगा", "Kosi / कोसी", "Son / सोन", "Gandak / गंडक"],
      answerIndex: 1,
    },
    {
      english: "India got independence on which date?",
      hindi: "भारत को किस तारीख को स्वतंत्रता मिली?",
      options: ["26 January 1950", "15 August 1947", "2 October 1869", "14 August 1947"],
      answerIndex: 1,
    },
    {
      english: "The Tropic of Cancer passes through how many Indian states?",
      hindi: "कर्क रेखा कितने भारतीय राज्यों से होकर गुजरती है?",
      options: ["6", "7", "8", "9"],
      answerIndex: 2,
    },
    {
      english: "Which is the largest continent in the world?",
      hindi: "विश्व का सबसे बड़ा महाद्वीप कौन सा है?",
      options: ["Africa / अफ्रीका", "North America / उत्तर अमेरिका", "Asia / एशिया", "Europe / यूरोप"],
      answerIndex: 2,
    },
  ],
};

function parseQuestions(data: unknown): Question[] {
  const raw =
    typeof data === "object" && data !== null && !Array.isArray(data)
      ? Object.values(data as Record<string, unknown>)
      : Array.isArray(data)
      ? data
      : [];

  const parsed = (raw as Record<string, unknown>[]).map((q) => {
    const opts: string[] = [];
    let answerIndex = 0;

    if (Array.isArray(q.options)) {
      q.options.forEach((o: unknown) => opts.push(String(o)));
      answerIndex = typeof q.answer === "number" ? q.answer : 0;
    } else if (q.options && typeof q.options === "object") {
      const optObj = q.options as Record<string, string>;
      const keys = Object.keys(optObj).sort();
      keys.forEach((k) => opts.push(optObj[k]));
      const answerKey = String(q.answer ?? "").toLowerCase();
      answerIndex = Math.max(0, keys.indexOf(answerKey));
    }

    return {
      english: String(q.english ?? ""),
      hindi: String(q.hindi ?? ""),
      options: opts.length ? opts : [],
      answerIndex,
    };
  }).filter((q) => (q.english || q.hindi) && q.options.length >= 2);

  return parsed;
}

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? "100%" : "-100%", opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit:  (dir: number) => ({ x: dir > 0 ? "-100%" : "100%", opacity: 0 }),
};

function MagicRipple({ color }: { color: string }) {
  return (
    <motion.span
      className="absolute inset-0 rounded-xl pointer-events-none"
      initial={{ opacity: 0.7, scale: 0.85 }}
      animate={{ opacity: 0, scale: 1.6 }}
      transition={{ duration: 0.7, ease: "easeOut" }}
      style={{ background: `radial-gradient(ellipse at center, ${color}60 0%, transparent 70%)` }}
    />
  );
}

function ResultScreen({
  questions, answers, accent, label, icon, onHome, isDemo,
}: {
  questions: Question[];
  answers: Record<number, number>;
  accent: string;
  label: string;
  icon: string;
  onHome: () => void;
  isDemo: boolean;
}) {
  const score = questions.reduce((acc, q, i) => acc + (answers[i] === q.answerIndex ? 1 : 0), 0);
  const pct = Math.round((score / questions.length) * 100);
  const getMessage = () => {
    if (pct === 100) return "Perfect! Outstanding work! 🏆";
    if (pct >= 80)  return "Excellent! You're on track! ⭐";
    if (pct >= 60)  return "Good effort! Keep practicing! 💪";
    return "Keep going! Every attempt makes you stronger! 🌱";
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
      className="min-h-screen w-full px-4 py-8"
      style={{ background: "#07080f" }}
    >
      <div className="max-w-lg mx-auto">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="text-center mb-8">
          <div className="text-5xl mb-3">{icon}</div>
          <h2 className="text-2xl font-bold text-white mb-1">{label} — Results</h2>
          <p className="text-white/40 text-sm">{getMessage()}</p>
          {isDemo && (
            <p className="mt-2 text-xs px-3 py-1 rounded-full inline-block" style={{ background: `${accent}20`, color: accent }}>
              Demo questions — add yours to Firebase to replace these
            </p>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="rounded-2xl p-6 mb-6 text-center border"
          style={{ background: `linear-gradient(135deg, ${accent}22, ${accent}08)`, borderColor: `${accent}40`, boxShadow: `0 0 40px ${accent}20` }}
        >
          <p className="text-7xl font-black mb-1" style={{ background: `linear-gradient(135deg, #fff, ${accent})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            {score}/{questions.length}
          </p>
          <p className="text-white/50 text-sm">{pct}% correct</p>
          <div className="mt-4 h-2 rounded-full bg-white/10 overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ delay: 0.4, duration: 0.8, ease: "easeOut" }}
              style={{ background: `linear-gradient(90deg, ${accent}, #fff)` }}
            />
          </div>
        </motion.div>

        <div className="flex flex-col gap-4 mb-8">
          {questions.map((q, i) => {
            const userAnswer = answers[i] ?? -1;
            const correct = q.answerIndex;
            const isRight = userAnswer === correct;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.07 }}
                className="rounded-xl border p-4"
                style={{ background: isRight ? `${accent}12` : "rgba(255,255,255,0.04)", borderColor: isRight ? `${accent}40` : "rgba(255,255,255,0.08)" }}
              >
                <div className="flex items-start gap-2 mb-3">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full mt-0.5 shrink-0"
                    style={{ background: isRight ? `${accent}30` : "rgba(255,255,255,0.1)", color: isRight ? accent : "rgba(255,255,255,0.5)" }}>
                    {isRight ? "✓ Correct" : "✗ Review"}
                  </span>
                  <p className="text-white/80 text-sm font-medium leading-snug">{i + 1}. {q.english}</p>
                </div>
                {q.hindi && <p className="text-white/40 text-xs mb-3 pl-1">{q.hindi}</p>}
                <div className="flex flex-col gap-1.5 pl-1">
                  {q.options.map((opt, oi) => {
                    const isCorrectOpt = oi === correct;
                    const isUserOpt    = oi === userAnswer;
                    const showWrong    = isUserOpt && !isRight;
                    return (
                      <div key={oi} className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg"
                        style={{ background: isCorrectOpt ? `${accent}25` : showWrong ? "rgba(255,255,255,0.08)" : "transparent", color: isCorrectOpt ? accent : showWrong ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.3)" }}>
                        <span className="font-bold text-xs w-4 shrink-0">{String.fromCharCode(65 + oi)}.</span>
                        <span>{opt}</span>
                        {isCorrectOpt && <span className="ml-auto text-xs font-semibold">✓ Answer</span>}
                        {showWrong    && <span className="ml-auto text-xs">Your pick</span>}
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            );
          })}
        </div>

        <motion.button
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
          whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
          onClick={onHome}
          className="w-full py-4 rounded-2xl font-bold text-sm tracking-wide"
          style={{ background: `linear-gradient(135deg, ${accent}80, ${accent}40)`, border: `1px solid ${accent}50`, color: "#fff", boxShadow: `0 4px 24px ${accent}30` }}
        >
          ← Back to Dashboard
        </motion.button>
      </div>
    </motion.div>
  );
}

export default function SubjectPage() {
  const params = useParams<{ subject: string }>();
  const [, navigate] = useLocation();
  const subject = params.subject ?? "";
  const meta = subjectMeta[subject];

  const [status, setStatus]         = useState<"loading" | "quiz" | "result">("loading");
  const [questions, setQuestions]   = useState<Question[]>([]);
  const [isDemo, setIsDemo]         = useState(false);
  const [firebaseNote, setFirebaseNote] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers]       = useState<Record<number, number>>({});
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [rippleKey, setRippleKey]   = useState(0);
  const [direction, setDirection]   = useState(1);

  useEffect(() => {
    const fallback = demoQuestions[subject] ?? demoQuestions.maths;

    if (!meta) {
      setQuestions(fallback);
      setIsDemo(true);
      setStatus("quiz");
      return;
    }

    // Show demo questions immediately — no waiting
    setQuestions(fallback);
    setIsDemo(true);
    setFirebaseNote(`No data at /${meta.path} in Firebase yet — showing demo questions.`);
    setStatus("quiz");

    // Try to load real questions from Firebase in the background
    let cancelled = false;
    get(ref(db, meta.path))
      .then((snap) => {
        if (cancelled) return;
        if (snap.exists()) {
          const parsed = parseQuestions(snap.val());
          if (parsed.length > 0) {
            setQuestions(parsed);
            setIsDemo(false);
            setFirebaseNote("");
          }
        }
      })
      .catch(() => {
        // silently keep demo questions
      });

    return () => { cancelled = true; };
  }, [subject]);

  const handleSelect = (oi: number) => {
    if (selectedOption !== null) return;
    setSelectedOption(oi);
    setRippleKey((k) => k + 1);
    setAnswers((prev) => ({ ...prev, [currentIndex]: oi }));
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setDirection(1);
      const next = currentIndex + 1;
      setCurrentIndex(next);
      setSelectedOption(answers[next] ?? null);
    } else {
      setStatus("result");
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setDirection(-1);
      const prev = currentIndex - 1;
      setCurrentIndex(prev);
      setSelectedOption(answers[prev] ?? null);
    }
  };

  if (!meta) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#07080f" }}>
        <p className="text-white/50">Subject not found.</p>
      </div>
    );
  }

  if (status === "loading") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: "#07080f" }}>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-10 h-10 rounded-full border-2 border-transparent"
          style={{ borderTopColor: meta.accent, borderRightColor: `${meta.accent}50` }}
        />
        <p className="text-white/40 text-sm">Loading questions...</p>
      </div>
    );
  }

  if (status === "result") {
    return (
      <ResultScreen
        questions={questions} answers={answers}
        accent={meta.accent} label={meta.label} icon={meta.icon}
        onHome={() => navigate("/")} isDemo={isDemo}
      />
    );
  }

  const q = questions[currentIndex];
  const progress = ((currentIndex + 1) / questions.length) * 100;
  const magicColors = ["#f59e0b", "#06b6d4"];
  const magicColor = magicColors[rippleKey % 2];

  return (
    <div className="min-h-screen w-full overflow-hidden relative" style={{ background: "#07080f" }}>
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-32 -left-32 w-80 h-80 rounded-full blur-3xl opacity-15"
          style={{ background: `radial-gradient(circle, ${meta.accent}, transparent)` }} />
        <div className="absolute -bottom-20 -right-20 w-64 h-64 rounded-full blur-3xl opacity-10"
          style={{ background: `radial-gradient(circle, ${meta.accent}, transparent)` }} />
      </div>

      <div className="relative z-10 max-w-lg mx-auto px-4 py-6 flex flex-col min-h-screen">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate("/")} className="text-white/40 hover:text-white/70 transition-colors p-1 text-xl">←</button>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">{meta.icon}</span>
              <span className="text-white font-bold text-sm">{meta.label}</span>
              <span className="ml-auto text-white/40 text-xs">{currentIndex + 1} / {questions.length}</span>
            </div>
            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                style={{ background: `linear-gradient(90deg, ${meta.accent}, ${meta.accent}80)` }}
              />
            </div>
          </div>
        </div>

        {isDemo && firebaseNote && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
            className="mb-4 px-3 py-2 rounded-xl text-xs border"
            style={{ background: `${meta.accent}12`, borderColor: `${meta.accent}30`, color: `${meta.accent}cc` }}
          >
            <span className="font-bold">ℹ️ Demo mode: </span>{firebaseNote || `Add questions to /${meta.path} in Firebase to use real data.`}
          </motion.div>
        )}

        <div className="flex-1 flex flex-col">
          <div className="relative overflow-hidden flex-1">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={currentIndex}
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.38, ease: [0.23, 1, 0.32, 1] }}
                className="w-full"
              >
                <div
                  className="rounded-2xl p-5 mb-5 border"
                  style={{ background: `linear-gradient(135deg, ${meta.accent}18, rgba(255,255,255,0.03))`, borderColor: `${meta.accent}30`, boxShadow: `0 4px 32px ${meta.accent}15` }}
                >
                  <p className="text-white font-semibold text-base leading-relaxed mb-2">
                    {currentIndex + 1}. {q.english}
                  </p>
                  {q.hindi && (
                    <p className="text-white/50 text-sm leading-relaxed">{q.hindi}</p>
                  )}
                </div>

                <div className="flex flex-col gap-3">
                  {q.options.map((opt, oi) => {
                    const isSelected = selectedOption === oi;
                    return (
                      <motion.button
                        key={oi}
                        onClick={() => handleSelect(oi)}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: oi * 0.07, duration: 0.35 }}
                        whileHover={selectedOption === null ? { scale: 1.02, x: 4 } : {}}
                        whileTap={selectedOption === null ? { scale: 0.98 } : {}}
                        className="relative w-full text-left rounded-xl border px-4 py-3.5 flex items-center gap-3 overflow-hidden transition-colors duration-200"
                        style={{
                          background: isSelected ? `linear-gradient(135deg, ${magicColor}28, ${magicColor}10)` : "rgba(255,255,255,0.04)",
                          borderColor: isSelected ? `${magicColor}60` : "rgba(255,255,255,0.08)",
                          cursor: selectedOption !== null ? "default" : "pointer",
                          boxShadow: isSelected ? `0 0 20px ${magicColor}25` : "none",
                        }}
                      >
                        {isSelected && <MagicRipple key={rippleKey} color={magicColor} />}
                        {isSelected && (
                          <motion.div
                            className="absolute inset-0 rounded-xl pointer-events-none"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: [0, 1, 0.5] }}
                            transition={{ duration: 0.6 }}
                            style={{ background: `radial-gradient(ellipse at 50% 50%, ${magicColor}18, transparent 70%)` }}
                          />
                        )}
                        <span
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
                          style={{ background: isSelected ? `${magicColor}40` : "rgba(255,255,255,0.08)", color: isSelected ? magicColor : "rgba(255,255,255,0.4)" }}
                        >
                          {String.fromCharCode(65 + oi)}
                        </span>
                        <span className="text-sm font-medium leading-snug" style={{ color: isSelected ? "#fff" : "rgba(255,255,255,0.65)" }}>
                          {opt}
                        </span>
                      </motion.button>
                    );
                  })}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="flex gap-3 mt-6 pb-4">
            {currentIndex > 0 && (
              <motion.button
                whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                onClick={handlePrev}
                className="flex-1 py-3.5 rounded-xl text-sm font-semibold border"
                style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)" }}
              >
                ← Prev
              </motion.button>
            )}
            <motion.button
              whileHover={selectedOption !== null ? { scale: 1.03 } : {}}
              whileTap={selectedOption  !== null ? { scale: 0.97 } : {}}
              onClick={handleNext}
              disabled={selectedOption === null}
              className="flex-[2] py-3.5 rounded-xl text-sm font-bold transition-all duration-300"
              style={{
                background: selectedOption !== null ? `linear-gradient(135deg, ${meta.accent}, ${meta.accent}80)` : "rgba(255,255,255,0.06)",
                color: selectedOption !== null ? "#fff" : "rgba(255,255,255,0.25)",
                boxShadow: selectedOption !== null ? `0 4px 20px ${meta.accent}40` : "none",
                cursor: selectedOption === null ? "not-allowed" : "pointer",
              }}
            >
              {currentIndex < questions.length - 1 ? "Next Question →" : "See Results ✦"}
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  );
}
