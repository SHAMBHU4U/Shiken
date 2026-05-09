import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { SubjectIcon } from "@/components/SubjectIcon";
import { useAuth } from "@/contexts/AuthContext";

export default function ContactPage() {
  usePageTitle("About SHIKEN");
  const [, navigate] = useLocation();
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      const timer = setTimeout(() => navigate("/profile"), 2200);
      return () => clearTimeout(timer);
    }
  }, [navigate, user]);

  return (
    <div className="min-h-screen w-full px-4 py-8 pb-28" style={{ background: "#07080f" }}>
      <div className="max-w-lg mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="rounded-[28px] border p-5 sm:p-6"
          style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.08)", boxShadow: "0 18px 70px rgba(0,0,0,0.35)" }}
        >
          <div className="flex items-center gap-4 mb-5">
            <div className="w-16 h-16 rounded-[18px] flex items-center justify-center shrink-0 overflow-hidden" style={{ background: "linear-gradient(135deg, #5b21b6, #2563eb, #0f766e)", boxShadow: "0 10px 28px rgba(91,33,182,0.35)" }}>
              <img src="@assets/Screenshot_2026-05-08_195228_1778295164173.png" alt="SHIKEN" className="w-11 h-11 object-contain" />
            </div>
            <div>
              <p className="text-white font-black text-2xl tracking-tight">SHIKEN · शिकेन</p>
              <p className="text-violet-400/70 text-xs font-medium">Bihar Board Class 10 & 12 · AI Powered</p>
            </div>
          </div>

          <p className="text-white/62 text-sm leading-relaxed mb-5">
            SHIKEN is a free, AI-powered exam preparation app for Bihar Board students. It helps Class 10 and 12 learners practice smarter, revise faster, and build confidence with quizzes, explanations, and progress tracking.
          </p>

          <div className="grid grid-cols-1 gap-2 mb-4">
            {[
              { icon: "📚", title: "Bihar Board Subjects", desc: "Practice the core Class 10 and Class 12 subjects in one place." },
              { icon: "🤖", title: "AI Explanations", desc: "Get step-by-step answers in Hindi or English when you need help." },
              { icon: "📝", title: "Offline Quiz Support", desc: "Continue with cached questions even when the network drops." },
              { icon: "📊", title: "Progress Tracking", desc: "See your scores, accuracy, and learning history over time." },
              { icon: "🏆", title: "Leaderboard", desc: "Stay motivated by comparing progress with other students." },
              { icon: "🎓", title: "Counselling", desc: "Get guidance on streams, careers, and next steps after school." },
            ].map((f) => (
              <div key={f.title} className="flex items-start gap-3 px-3 py-2.5 rounded-xl" style={{ background: "rgba(255,255,255,0.04)" }}>
                <span className="text-lg mt-0.5 flex-shrink-0">{f.icon}</span>
                <div>
                  <p className="text-white text-sm font-semibold">{f.title}</p>
                  <p className="text-white/42 text-xs leading-5">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <button onClick={() => navigate("/")} className="w-full py-3 rounded-xl text-sm font-bold" style={{ background: "linear-gradient(135deg, #8b5cf6, #06b6d4)", color: "white" }}>
            Back to Home
          </button>
        </motion.div>
      </div>
    </div>
  );
}
