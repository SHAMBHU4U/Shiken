import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient();

const subjects = [
  {
    id: "maths",
    label: "Maths",
    icon: "📐",
    gradient: "from-cyan-500/30 to-blue-600/30",
    border: "border-cyan-400/30",
    glow: "shadow-cyan-500/20",
    accent: "#06b6d4",
    hoverGradient: "hover:from-cyan-500/40 hover:to-blue-600/40",
  },
  {
    id: "english",
    label: "English",
    icon: "📖",
    gradient: "from-violet-500/30 to-purple-700/30",
    border: "border-violet-400/30",
    glow: "shadow-violet-500/20",
    accent: "#8b5cf6",
    hoverGradient: "hover:from-violet-500/40 hover:to-purple-700/40",
  },
  {
    id: "hindi",
    label: "Hindi",
    icon: "🔤",
    gradient: "from-orange-500/30 to-red-600/30",
    border: "border-orange-400/30",
    glow: "shadow-orange-500/20",
    accent: "#f97316",
    hoverGradient: "hover:from-orange-500/40 hover:to-red-600/40",
  },
  {
    id: "science",
    label: "Science",
    icon: "🔬",
    gradient: "from-emerald-500/30 to-teal-600/30",
    border: "border-emerald-400/30",
    glow: "shadow-emerald-500/20",
    accent: "#10b981",
    hoverGradient: "hover:from-emerald-500/40 hover:to-teal-600/40",
  },
  {
    id: "social",
    label: "Social Science",
    icon: "🌍",
    gradient: "from-amber-500/30 to-yellow-600/30",
    border: "border-amber-400/30",
    glow: "shadow-amber-500/20",
    accent: "#f59e0b",
    hoverGradient: "hover:from-amber-500/40 hover:to-yellow-600/40",
  },
];

type Ripple = { id: number; x: number; y: number; color: string };

function SubjectCard({ subject, index }: { subject: typeof subjects[0]; index: number }) {
  const [ripples, setRipples] = useState<Ripple[]>([]);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const id = Date.now();
      setRipples((prev) => [...prev, { id, x, y, color: subject.accent }]);
      setTimeout(() => setRipples((prev) => prev.filter((r) => r.id !== id)), 800);
    },
    [subject.accent]
  );

  return (
    <motion.button
      onClick={handleClick}
      initial={{ opacity: 0, y: 40, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: 0.15 + index * 0.1, duration: 0.55, ease: [0.23, 1, 0.32, 1] }}
      whileHover={{ scale: 1.04, y: -4 }}
      whileTap={{ scale: 0.97 }}
      className={`
        relative overflow-hidden w-full
        bg-gradient-to-br ${subject.gradient} ${subject.hoverGradient}
        backdrop-blur-xl border ${subject.border}
        rounded-2xl p-6 text-left
        shadow-xl ${subject.glow}
        transition-all duration-300 cursor-pointer
        group
      `}
      style={{
        boxShadow: `0 8px 32px ${subject.accent}18, 0 2px 8px rgba(0,0,0,0.4)`,
      }}
    >
      <AnimatePresence>
        {ripples.map((ripple) => (
          <motion.span
            key={ripple.id}
            initial={{ width: 0, height: 0, opacity: 0.7, x: ripple.x, y: ripple.y }}
            animate={{ width: 400, height: 400, opacity: 0, x: ripple.x - 200, y: ripple.y - 200 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.75, ease: "easeOut" }}
            className="pointer-events-none absolute rounded-full"
            style={{ background: `radial-gradient(circle, ${ripple.color}60 0%, transparent 70%)` }}
          />
        ))}
      </AnimatePresence>

      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-2xl"
        style={{
          background: `radial-gradient(ellipse at 50% 0%, ${subject.accent}20 0%, transparent 70%)`,
        }}
      />

      <div className="relative z-10 flex items-center gap-4">
        <motion.div
          className="text-4xl select-none"
          whileHover={{ rotate: [0, -10, 10, 0], scale: 1.2 }}
          transition={{ duration: 0.4 }}
        >
          {subject.icon}
        </motion.div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-0.5">
            Bihar Board
          </p>
          <h3 className="text-xl font-bold text-white">{subject.label}</h3>
        </div>
        <motion.div
          className="ml-auto text-white/30 group-hover:text-white/70 transition-colors"
          initial={{ x: 0 }}
          whileHover={{ x: 4 }}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M7 4l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </motion.div>
      </div>
    </motion.button>
  );
}

function Dashboard() {
  return (
    <div className="min-h-screen w-full relative overflow-hidden" style={{ background: "#07080f" }}>
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute -top-40 -left-40 w-96 h-96 rounded-full blur-3xl opacity-20"
          style={{ background: "radial-gradient(circle, #8b5cf6, transparent)" }}
        />
        <div
          className="absolute top-1/2 -right-32 w-80 h-80 rounded-full blur-3xl opacity-15"
          style={{ background: "radial-gradient(circle, #06b6d4, transparent)" }}
        />
        <div
          className="absolute -bottom-20 left-1/3 w-72 h-72 rounded-full blur-3xl opacity-10"
          style={{ background: "radial-gradient(circle, #10b981, transparent)" }}
        />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)`,
            backgroundSize: "32px 32px",
          }}
        />
      </div>

      <div className="relative z-10 max-w-lg mx-auto px-4 py-10">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
          className="text-center mb-10"
        >
          <div className="inline-flex items-center gap-2 mb-3">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
              className="w-8 h-8 rounded-full"
              style={{
                background: "conic-gradient(from 0deg, #8b5cf6, #06b6d4, #10b981, #f97316, #8b5cf6)",
              }}
            />
            <span className="text-white/40 text-sm font-medium tracking-widest uppercase">
              Bihar Board
            </span>
          </div>

          <motion.h1
            className="text-6xl font-black tracking-tight mb-1"
            style={{
              background: "linear-gradient(135deg, #fff 30%, #8b5cf6 60%, #06b6d4 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            SHIKEN
          </motion.h1>
          <p className="text-white/40 text-sm font-medium">
            Choose your subject and start learning
          </p>
        </motion.div>

        <div className="flex flex-col gap-4">
          {subjects.map((subject, index) => (
            <SubjectCard key={subject.id} subject={subject} index={index} />
          ))}
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.0 }}
          className="text-center text-white/20 text-xs mt-10 tracking-wide"
        >
          Tap a subject to begin your session
        </motion.p>
      </div>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <Switch>
          <Route path="/" component={Dashboard} />
        </Switch>
      </WouterRouter>
    </QueryClientProvider>
  );
}

export default App;
