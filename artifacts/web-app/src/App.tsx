import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { signInWithEmailAndPassword, onAuthStateChanged, signOut, type User } from "firebase/auth";
import { auth } from "@/firebase";
import SubjectPage from "@/pages/SubjectPage";
import AdminPage from "@/pages/AdminPage";
import ProgressPage from "@/pages/ProgressPage";
import ProfilePage from "@/pages/ProfilePage";
import CounsellingPage from "@/pages/CounsellingPage";
import ContactPage from "@/pages/ContactPage";
import LeaderboardPage from "@/pages/LeaderboardPage";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";

// ─── Username helpers ──────────────────────────────────────────────────────────
const USERNAME_KEY = "shiken_username";
const DEVICE_ID_KEY = "shiken_device_id";
const DB_URL = "https://shiken-d8789-default-rtdb.firebaseio.com";

function getStoredUsername(): string { return localStorage.getItem(USERNAME_KEY) ?? ""; }
function getDeviceId(): string { return localStorage.getItem(DEVICE_ID_KEY) ?? ""; }
function getMyId(): string { return auth.currentUser?.uid ?? getDeviceId(); }

function saveUsername(name: string) {
  localStorage.setItem(USERNAME_KEY, name);
  const deviceId = getDeviceId();
  if (!deviceId) return;
  const safeId = deviceId.replace(/[.#$/[\]]/g, "_");
  fetch(`${DB_URL}/userActivity/${safeId}/meta.json`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: name, deviceId }),
  }).catch(() => {});
}

// ─── Leaderboard types & fetch ────────────────────────────────────────────────

interface LeaderEntry {
  deviceId: string;
  username: string;
  avgPct: number;
  totalSessions: number;
  subjectCount: number;
}

async function fetchLeaderboard(): Promise<LeaderEntry[]> {
  try {
    const res = await fetch(`${DB_URL}/userActivity.json`);
    if (!res.ok) return [];
    const data = await res.json() as Record<string, {
      meta?: { deviceId: string; lastActive: number; username?: string };
      sessions?: Record<string, { pct: number; subject: string }>;
    }> | null;
    if (!data) return [];
    return Object.values(data)
      .map((u) => {
        const sessions = u.sessions ? Object.values(u.sessions) : [];
        if (sessions.length < 1) return null;
        const avgPct = Math.round(sessions.reduce((s, r) => s + r.pct, 0) / sessions.length);
        const subjectCount = new Set(sessions.map((s) => s.subject)).size;
        return {
          deviceId: u.meta?.deviceId ?? "",
          username: u.meta?.username?.trim() || "Anonymous",
          avgPct,
          totalSessions: sessions.length,
          subjectCount,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b!.avgPct - a!.avgPct || b!.totalSessions - a!.totalSessions)
      .slice(0, 10) as LeaderEntry[];
  } catch { return []; }
}

const RANK_MEDALS = ["🥇", "🥈", "🥉"];
const GRADE_COLOR = (p: number) => p >= 80 ? "#10b981" : p >= 60 ? "#f59e0b" : "#ef4444";

// ─── Leaderboard component ────────────────────────────────────────────────────

function Leaderboard() {
  const [entries, setEntries] = useState<LeaderEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const myId = getMyId();

  useEffect(() => {
    fetchLeaderboard().then((data) => { setEntries(data); setLoading(false); });
    const t = setInterval(() => fetchLeaderboard().then(setEntries), 60_000);
    return () => clearInterval(t);
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center gap-2 py-5 text-white/20 text-xs">
      <motion.span animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        className="inline-block w-3 h-3 rounded-full border border-white/20 border-t-white/60" />
      Loading leaderboard…
    </div>
  );

  if (entries.length === 0) return (
    <div className="text-center py-5 text-white/20 text-xs">
      No scores yet — complete a test to appear here!
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
      className="mb-8 rounded-2xl overflow-hidden"
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}
    >
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">🏆</span>
          <span className="text-white font-black text-sm tracking-tight">Leaderboard</span>
        </div>
        <span className="text-white/20 text-xs">Top {entries.length}</span>
      </div>

      <div className="flex flex-col">
        {entries.map((e, i) => {
          const isMe = e.deviceId === myId;
          return (
            <motion.div
              key={e.deviceId || i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.35 + i * 0.04 }}
              className="flex items-center gap-3 px-4 py-2.5 transition-colors"
              style={{
                background: isMe ? "rgba(139,92,246,0.1)" : i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.015)",
                borderLeft: isMe ? "2px solid #8b5cf6" : "2px solid transparent",
              }}
            >
              <span className="w-6 text-center text-sm shrink-0">
                {i < 3 ? RANK_MEDALS[i] : <span className="text-white/25 font-bold text-xs">{i + 1}</span>}
              </span>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate">
                  {e.username} {isMe && <span className="text-purple-400 text-xs font-medium">(you)</span>}
                </p>
                <p className="text-white/30 text-xs">{e.totalSessions} test{e.totalSessions !== 1 ? "s" : ""} · {e.subjectCount} subject{e.subjectCount !== 1 ? "s" : ""}</p>
              </div>

              <div className="shrink-0 text-right">
                <p className="text-sm font-black" style={{ color: GRADE_COLOR(e.avgPct) }}>{e.avgPct}%</p>
                <p className="text-white/20 text-xs">avg</p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

// ─── Username setup prompt ────────────────────────────────────────────────────

function UsernameSetup({ onDone }: { onDone: (name: string) => void }) {
  const [val, setVal] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const name = val.trim().slice(0, 20) || "Anonymous";
    saveUsername(name);
    onDone(name);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.97 }}
      transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
      className="mb-8 rounded-2xl p-5"
      style={{ background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.25)" }}
    >
      <p className="text-white font-black text-sm mb-0.5">👋 What's your name?</p>
      <p className="text-white/40 text-xs mb-4">Appear on the leaderboard by setting a display name.</p>
      <form onSubmit={submit} className="flex gap-2">
        <input
          ref={inputRef}
          value={val}
          onChange={(e) => setVal(e.target.value)}
          placeholder="Your name…"
          maxLength={20}
          className="flex-1 px-3 py-2.5 rounded-xl text-sm text-white placeholder-white/25 outline-none"
          style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)" }}
        />
        <motion.button type="submit" whileTap={{ scale: 0.96 }}
          className="px-4 py-2.5 rounded-xl text-sm font-bold text-white shrink-0"
          style={{ background: "linear-gradient(135deg,#8b5cf6,#6366f1)", boxShadow: "0 2px 12px rgba(139,92,246,0.35)" }}>
          Join →
        </motion.button>
      </form>
      <button onClick={() => { saveUsername("Anonymous"); onDone("Anonymous"); }}
        className="mt-2 text-white/20 hover:text-white/40 text-xs transition-colors">
        Skip
      </button>
    </motion.div>
  );
}

const ADMIN_SESSION = "shiken_admin_session";

function AdminGuard() {
  const [user, setUser] = useState<User | null | "loading">("loading");
  const [adminSession, setAdminSession] = useState(() => sessionStorage.getItem(ADMIN_SESSION) === "1");
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
      sessionStorage.setItem(ADMIN_SESSION, "1");
      setAdminSession(true);
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

  if (user && adminSession) return <AdminPage onSignOut={() => { sessionStorage.removeItem(ADMIN_SESSION); setAdminSession(false); signOut(auth); }} />;

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

const QUIZ_SLUGS = ["maths", "english", "hindi", "science", "social", "sanskrit"];

function BottomNav() {
  const [location, navigate] = useLocation();
  const { user } = useAuth();
  const isQuiz  = QUIZ_SLUGS.some((s) => location === `/${s}`);
  const isAdmin = location === "/admin";
  if (isQuiz || isAdmin) return null;

  const tabs = [
    { path: "/",             icon: "🏠", label: "Home"       },
    { path: "/leaderboard",  icon: "🏆", label: "Ranks"      },
    { path: "/profile",      icon: "👤", label: "Profile"    },
    { path: "/counselling",  icon: "🎓", label: "Counselling"},
    { path: "/contact",      icon: "📩", label: "Contact"    },
  ];

  return (
    <motion.div
      initial={{ y: 80 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
      className="fixed bottom-0 left-0 right-0 z-50"
      style={{ background: "rgba(7,8,15,0.92)", backdropFilter: "blur(20px)", borderTop: "1px solid rgba(255,255,255,0.07)" }}
    >
      <div className="max-w-lg mx-auto flex items-center justify-around px-2 py-2 pb-safe">
        {tabs.map((tab) => {
          const active = location === tab.path;
          return (
            <motion.button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              whileTap={{ scale: 0.92 }}
              className="flex flex-col items-center gap-0.5 px-4 py-2 rounded-xl transition-all min-w-0"
              style={{
                background: active ? "rgba(139,92,246,0.12)" : "transparent",
                border: active ? "1px solid rgba(139,92,246,0.2)" : "1px solid transparent",
              }}
            >
              <span className="text-lg leading-none">{tab.icon}</span>
              <span className="text-xs font-semibold leading-none"
                style={{ color: active ? "#a78bfa" : "rgba(255,255,255,0.3)" }}>
                {tab.label}
              </span>
              {tab.path === "/profile" && user && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-green-400 border border-black" />
              )}
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}

function Dashboard() {
  const [, navigate] = useLocation();
  const [username, setUsername] = useState(getStoredUsername);
  const hasName = username !== "";

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

      <div className="relative z-10 max-w-lg mx-auto px-4 pt-10 pb-28">
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

        <AnimatePresence mode="wait">
          {!hasName ? (
            <UsernameSetup key="setup" onDone={(n) => setUsername(n)} />
          ) : (
            <motion.div key="leaderboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="flex items-center justify-between mb-2 px-1">
                <span />
                <button
                  onClick={() => {
                    const n = prompt("Change your display name:", username);
                    if (n !== null && n.trim()) { const clean = n.trim().slice(0, 20); saveUsername(clean); setUsername(clean); }
                  }}
                  className="text-white/20 hover:text-white/50 text-xs transition-colors"
                >
                  ✏ {username}
                </button>
              </div>
              <Leaderboard />
            </motion.div>
          )}
        </AnimatePresence>

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

function AppRoutes() {
  return (
    <>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/admin" component={AdminGuard} />
        <Route path="/progress" component={ProgressPage} />
        <Route path="/profile" component={ProfilePage} />
        <Route path="/counselling" component={CounsellingPage} />
        <Route path="/contact" component={ContactPage} />
        <Route path="/leaderboard" component={LeaderboardPage} />
        <Route path="/:subject" component={SubjectPage} />
      </Switch>
      <BottomNav />
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AppRoutes />
        </WouterRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
