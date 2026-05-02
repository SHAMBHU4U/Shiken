import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { signInWithEmailAndPassword, onAuthStateChanged, signOut, type User } from "firebase/auth";
import { auth } from "@/firebase";
import SubjectPage from "@/pages/SubjectPage";
import AdminPage from "@/pages/AdminPage";
import ProgressPage from "@/pages/ProgressPage";

function AdminGuard() {
  const [user, setUser] = useState<User | null | "loading">("loading");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [shake, setShake] = useState(false);
  const [, navigate] = useLocation();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return unsub;
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? "";
      if (code === "auth/user-not-found" || code === "auth/wrong-password" || code === "auth/invalid-credential") {
        setError("Invalid email or password");
      } else if (code === "auth/invalid-email") {
        setError("Enter a valid email address");
      } else if (code === "auth/too-many-requests") {
        setError("Too many attempts — try again later");
      } else {
        setError("Sign in failed. Check your credentials.");
      }
      setShake(true);
      setPassword("");
      setTimeout(() => setShake(false), 600);
    } finally {
      setSubmitting(false);
    }
  }

  if (user === "loading") {
    return (
      <div className="min-h-screen w-full flex items-center justify-center" style={{ background: "#07080f" }}>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
          className="w-8 h-8 rounded-full border-2 border-transparent"
          style={{ borderTopColor: "#8b5cf6", borderRightColor: "#06b6d4" }}
        />
      </div>
    );
  }

  if (user) return <AdminPage onSignOut={() => signOut(auth)} />;

  return (
    <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden" style={{ background: "#07080f" }}>
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-32 -left-32 w-80 h-80 rounded-full blur-3xl opacity-15"
          style={{ background: "radial-gradient(circle, #8b5cf6, transparent)" }} />
        <div className="absolute -bottom-24 -right-24 w-72 h-72 rounded-full blur-3xl opacity-10"
          style={{ background: "radial-gradient(circle, #06b6d4, transparent)" }} />
        <div className="absolute inset-0 opacity-[0.02]"
          style={{ backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)", backgroundSize: "32px 32px" }} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
        className="relative z-10 w-full max-w-sm mx-4"
      >
        <div className="text-center mb-8">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
            className="w-12 h-12 rounded-full mx-auto mb-4"
            style={{ background: "conic-gradient(from 0deg, #8b5cf6, #06b6d4, #10b981, #f97316, #8b5cf6)" }}
          />
          <h1 className="text-white font-black text-2xl tracking-tight mb-1">Admin Access</h1>
          <p className="text-white/30 text-sm">Sign in with your Firebase admin account</p>
        </div>

        <motion.form
          onSubmit={handleSubmit}
          animate={shake ? { x: [-10, 10, -8, 8, -4, 4, 0] } : { x: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col gap-3"
        >
          <input
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setError(""); }}
            placeholder="Admin Email"
            autoComplete="email"
            autoFocus
            required
            className="w-full px-4 py-3.5 rounded-xl text-sm text-white placeholder-white/25 outline-none transition-all"
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.12)",
            }}
          />
          <div className="relative">
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(""); }}
              placeholder="Password"
              autoComplete="current-password"
              required
              className="w-full px-4 py-3.5 rounded-xl text-sm text-white placeholder-white/25 outline-none transition-all"
              style={{
                background: error ? "rgba(239,68,68,0.08)" : "rgba(255,255,255,0.06)",
                border: `1px solid ${error ? "rgba(239,68,68,0.4)" : "rgba(255,255,255,0.12)"}`,
              }}
            />
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute -bottom-5 left-1 text-xs text-red-400"
              >
                {error}
              </motion.p>
            )}
          </div>

          <motion.button
            type="submit"
            disabled={submitting}
            whileHover={{ scale: submitting ? 1 : 1.02 }}
            whileTap={{ scale: submitting ? 1 : 0.98 }}
            className="mt-3 w-full py-3.5 rounded-xl text-sm font-bold text-white transition-all flex items-center justify-center gap-2"
            style={{
              background: submitting ? "rgba(139,92,246,0.4)" : "linear-gradient(135deg, #8b5cf6, #6366f1)",
              boxShadow: submitting ? "none" : "0 4px 20px rgba(139,92,246,0.35)",
            }}
          >
            {submitting ? (
              <>
                <motion.span
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                  className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white inline-block"
                />
                Signing in…
              </>
            ) : "Sign In →"}
          </motion.button>
        </motion.form>

        <button
          onClick={() => navigate("/")}
          className="mt-6 w-full text-center text-white/20 hover:text-white/40 transition-colors text-xs"
        >
          ← Back to app
        </button>
      </motion.div>
    </div>
  );
}

const queryClient = new QueryClient();

const subjects = [
  {
    id: "maths",
    label: "Maths",
    icon: "📐",
    gradient: "from-cyan-500/30 to-blue-600/30",
    border: "border-cyan-400/30",
    accent: "#06b6d4",
  },
  {
    id: "english",
    label: "English",
    icon: "📖",
    gradient: "from-violet-500/30 to-purple-700/30",
    border: "border-violet-400/30",
    accent: "#8b5cf6",
  },
  {
    id: "hindi",
    label: "Hindi",
    icon: "🔤",
    gradient: "from-orange-500/30 to-red-600/30",
    border: "border-orange-400/30",
    accent: "#f97316",
  },
  {
    id: "science",
    label: "Science",
    icon: "🔬",
    gradient: "from-emerald-500/30 to-teal-600/30",
    border: "border-emerald-400/30",
    accent: "#10b981",
  },
  {
    id: "social",
    label: "Social Science",
    icon: "🌍",
    gradient: "from-amber-500/30 to-yellow-600/30",
    border: "border-amber-400/30",
    accent: "#f59e0b",
  },
  {
    id: "sanskrit",
    label: "Sanskrit",
    icon: "📜",
    gradient: "from-pink-500/30 to-rose-600/30",
    border: "border-pink-400/30",
    accent: "#ec4899",
  },
];

type Ripple = { id: number; x: number; y: number; color: string };

function SubjectCard({
  subject,
  index,
  onClick,
}: {
  subject: (typeof subjects)[0];
  index: number;
  onClick: () => void;
}) {
  const [ripples, setRipples] = useState<Ripple[]>([]);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const id = Date.now();
      setRipples((prev) => [...prev, { id, x, y, color: subject.accent }]);
      setTimeout(() => {
        setRipples((prev) => prev.filter((r) => r.id !== id));
        onClick();
      }, 320);
    },
    [subject.accent, onClick]
  );

  return (
    <motion.button
      onClick={handleClick}
      initial={{ opacity: 0, y: 40, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: 0.15 + index * 0.1, duration: 0.55, ease: [0.23, 1, 0.32, 1] }}
      whileHover={{ scale: 1.04, y: -4 }}
      whileTap={{ scale: 0.97 }}
      className={`relative overflow-hidden w-full bg-gradient-to-br ${subject.gradient} backdrop-blur-xl border ${subject.border} rounded-2xl p-6 text-left shadow-xl transition-all duration-300 cursor-pointer group`}
      style={{ boxShadow: `0 8px 32px ${subject.accent}18, 0 2px 8px rgba(0,0,0,0.4)` }}
    >
      <AnimatePresence>
        {ripples.map((ripple) => (
          <motion.span
            key={ripple.id}
            initial={{ width: 0, height: 0, opacity: 0.7, x: ripple.x, y: ripple.y }}
            animate={{ width: 400, height: 400, opacity: 0, x: ripple.x - 200, y: ripple.y - 200 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="pointer-events-none absolute rounded-full"
            style={{
              background: `radial-gradient(circle, ${ripple.color}70 0%, transparent 70%)`,
            }}
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
          whileHover={{ x: 4 }}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path
              d="M7 4l6 6-6 6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </motion.div>
      </div>
    </motion.button>
  );
}

function Dashboard() {
  const [, navigate] = useLocation();

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
                background:
                  "conic-gradient(from 0deg, #8b5cf6, #06b6d4, #10b981, #f97316, #8b5cf6)",
              }}
            />
            <span className="text-white/40 text-sm font-medium tracking-widest uppercase">
              Bihar Board
            </span>
          </div>

          <h1
            className="text-6xl font-black tracking-tight mb-1"
            style={{
              background: "linear-gradient(135deg, #fff 30%, #8b5cf6 60%, #06b6d4 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            SHIKEN
          </h1>
          <p className="text-white/40 text-sm font-medium">
            Choose your subject and start learning
          </p>
        </motion.div>

        <div className="flex flex-col gap-4">
          {subjects.map((subject, index) => (
            <SubjectCard
              key={subject.id}
              subject={subject}
              index={index}
              onClick={() => navigate(`/${subject.id}`)}
            />
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.0 }}
          className="flex items-center justify-between mt-10"
        >
          <button
            onClick={() => navigate("/progress")}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/8 hover:border-white/15 transition-all text-white/50 hover:text-white/80 text-xs font-medium"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 10l3-3 3 2 3-4 3 2" stroke="currentColor" strokeWidth="1.5"
                strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            My Progress
          </button>
          <button
            onClick={() => navigate("/admin")}
            className="text-white/5 hover:text-white/10 transition-colors text-xs select-none"
            title=""
            aria-hidden="true"
          >
            ·
          </button>
        </motion.div>
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
          <Route path="/admin" component={AdminGuard} />
          <Route path="/progress" component={ProgressPage} />
          <Route path="/:subject" component={SubjectPage} />
        </Switch>
      </WouterRouter>
    </QueryClientProvider>
  );
}

export default App;
