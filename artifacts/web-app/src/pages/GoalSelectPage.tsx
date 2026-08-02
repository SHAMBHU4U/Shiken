import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";

type Goal = "neet" | "jee" | "c10" | "c12";

const GOALS: {
  id: Goal;
  emoji: string;
  title: string;
  titleHindi: string;
  description: string;
  subjects: string[];
  accent: string;
  gradient: string;
  border: string;
}[] = [
  {
    id: "neet",
    emoji: "🩺",
    title: "NEET",
    titleHindi: "मेडिकल प्रवेश परीक्षा",
    description: "Medical entrance — Physics, Chemistry, Biology",
    subjects: ["Physics", "Chemistry", "Biology"],
    accent: "#10b981",
    gradient: "from-emerald-500/20 to-teal-600/15",
    border: "border-emerald-400/30",
  },
  {
    id: "jee",
    emoji: "⚙️",
    title: "JEE Main",
    titleHindi: "इंजीनियरिंग प्रवेश परीक्षा",
    description: "Engineering entrance — Physics, Chemistry, Maths",
    subjects: ["Physics", "Chemistry", "Maths"],
    accent: "#3b82f6",
    gradient: "from-blue-500/20 to-indigo-600/15",
    border: "border-blue-400/30",
  },
  {
    id: "c10",
    emoji: "📚",
    title: "Class 10",
    titleHindi: "बोर्ड दसवीं",
    description: "Board Exam — Maths, Science, English, Hindi, Social, Sanskrit",
    subjects: ["Maths", "Science", "Hindi", "English", "Social", "Sanskrit"],
    accent: "#f59e0b",
    gradient: "from-amber-500/20 to-yellow-600/15",
    border: "border-amber-400/30",
  },
  {
    id: "c12",
    emoji: "🎓",
    title: "Class 12",
    titleHindi: "बोर्ड बारहवीं",
    description: "Board Exam — Physics, Chemistry, Biology, Maths, Social, Hindi, English",
    subjects: ["Physics", "Chemistry", "Biology", "Maths"],
    accent: "#8b5cf6",
    gradient: "from-violet-500/20 to-purple-600/15",
    border: "border-violet-400/30",
  },
];

export default function GoalSelectPage({ isChanging = false }: { isChanging?: boolean }) {
  const { setGoal, user, signOut } = useAuth();
  const [saving, setSaving] = useState<Goal | null>(null);

  async function handleSelect(goalId: Goal) {
    if (saving) return;
    setSaving(goalId);
    try {
      await setGoal(goalId);
    } catch (err) {
      console.error("Goal save error:", err);
      setSaving(null);
    }
  }

  return (
    <div className="min-h-screen w-full relative overflow-hidden" style={{ background: "var(--app-bg)" }}>
      <div className="relative z-10 max-w-lg mx-auto px-4 pt-10 pb-28">
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.23, 1, 0.32, 1] }}
          className="text-center mb-8"
        >
          <div className="flex justify-center mb-4">
            <div className="relative">
              <div className="relative w-[70px] h-[70px] rounded-[18px] flex items-center justify-center overflow-hidden bg-white border border-slate-200">
                <img src="/shiken-logo.png" alt="SHIKEN" className="w-[52px] h-[52px] object-contain" />
              </div>
            </div>
          </div>

          <motion.h1
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="text-3xl font-bold text-slate-900 tracking-tight mb-1"
          >
            {isChanging ? "Change your Goal" : "What's your Goal?"}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-slate-500 text-sm"
          >
            {isChanging
              ? "Choose a different preparation path"
              : "अपना लक्ष्य चुनो — हम सब तैयार करेंगे"}
          </motion.p>

          {user && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.25 }}
              className="text-slate-500 text-xs mt-1.5"
            >
              {user.displayName || user.email}
            </motion.p>
          )}
        </motion.div>

        <div className="flex flex-col gap-4">
          {GOALS.map((goal, index) => (
            <motion.button
              key={goal.id}
              onClick={() => handleSelect(goal.id)}
              disabled={saving !== null}
              initial={{ opacity: 0, y: 32, scale: 0.93 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.15 + index * 0.09, duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
              whileHover={saving ? {} : { scale: 1.025, y: -3 }}
              whileTap={saving ? {} : { scale: 0.975 }}
              className="relative overflow-hidden w-full bg-white rounded-2xl p-6 shadow-sm border border-slate-100 text-left transition-shadow duration-300 hover:shadow-md"
              style={{
                opacity: saving !== null && saving !== goal.id ? 0.45 : 1,
              }}
            >
              {saving === goal.id && (
                <motion.div
                  className="absolute inset-x-0 top-0 h-1 bg-emerald-600"
                />
              )}

              <div className="relative z-10 flex items-center gap-4">
                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shrink-0 ${
                    goal.id === "neet" || goal.id === "jee"
                      ? "bg-emerald-100 text-emerald-600"
                      : goal.id === "c10"
                        ? "bg-blue-100 text-blue-600"
                        : "bg-amber-100 text-amber-600"
                  }`}
                >
                  {saving === goal.id ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                       className="w-6 h-6 rounded-full border-2 border-emerald-200 border-t-emerald-600"
                    />
                  ) : goal.emoji}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <h3 className="text-xl font-bold text-slate-900">{goal.title}</h3>
                    <span className="text-xs font-medium text-slate-500">
                      {goal.titleHindi}
                    </span>
                  </div>
                  <p className="text-slate-500 text-xs mt-0.5 mb-2">{goal.description}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {goal.subjects.map((sub) => (
                      <span
                        key={sub}
                        className="px-2 py-0.5 rounded-lg text-[10px] font-bold"
                         style={{ background: "#f8fafc", color: "#475569", border: "1px solid #e2e8f0" }}
                      >
                        {sub}
                      </span>
                    ))}
                  </div>
                </div>

                <motion.div
                  className="shrink-0 text-slate-400 transition-colors"
                  animate={saving === goal.id ? {} : {}}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </motion.div>
              </div>
            </motion.button>
          ))}
        </div>

        {!isChanging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="mt-8 text-center"
          >
            <button
              onClick={() => signOut()}
              className="text-slate-400 hover:text-slate-700 text-xs transition-colors"
            >
              Sign out
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
