import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { updateProfile } from "firebase/auth";
import { ArrowRight, CheckCircle2, Eye, EyeOff, LockKeyhole, Mail, UserRound } from "lucide-react";
import { auth } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { useSubscription } from "../hooks/useSubscription";
import { requestAndScheduleReminder, scheduleEveningReminder } from "../utils/streakUtils";
import { AVATARS, getAvatarEmoji } from "../utils/avatarUtils";

const DB_URL = "https://shiken-d8789-default-rtdb.firebaseio.com";

function getDeviceId(): string {
  const KEY = "shiken_device_id";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = "u_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
    localStorage.setItem(KEY, id);
  }
  return id;
}

interface Session {
  subject: string;
  score: number;
  total: number;
  pct: number;
  mode: string;
  chapter: string;
  timestamp: number;
}

const SUBJECT_ICONS: Record<string, string> = {
  maths: "📐", english: "📖", hindi: "🔤",
  science: "🔬", social: "🌍", sanskrit: "📜",
};
const SUBJECT_COLORS: Record<string, string> = {
  maths: "#06b6d4", english: "#8b5cf6", hindi: "#f97316",
  science: "#10b981", social: "#f59e0b", sanskrit: "#ec4899",
};

function gradeColor(p: number) { return p >= 80 ? "#10b981" : p >= 60 ? "#f59e0b" : "#ef4444"; }
function gradeLabel(p: number) {
  if (p >= 90) return "Excellent";
  if (p >= 80) return "Great";
  if (p >= 60) return "Good";
  if (p >= 40) return "Fair";
  return "Needs Work";
}

function computeStreak(sessions: Session[]): number {
  if (!sessions.length) return 0;
  const daySet = new Set(sessions.map(s => {
    const d = new Date(s.timestamp);
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  }));
  let streak = 0;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const cur = new Date(today);
  // If haven't tested today, still allow counting from yesterday
  const todayKey = `${cur.getFullYear()}-${cur.getMonth()}-${cur.getDate()}`;
  if (!daySet.has(todayKey)) cur.setDate(cur.getDate() - 1);
  while (true) {
    const key = `${cur.getFullYear()}-${cur.getMonth()}-${cur.getDate()}`;
    if (daySet.has(key)) { streak++; cur.setDate(cur.getDate() - 1); }
    else break;
  }
  return streak;
}

function TrendChart({ sessions }: { sessions: Session[] }) {
  const pts = [...sessions].reverse().slice(-20);
  if (pts.length < 2) return null;
  const W = 300, H = 72, PX = 10, PY = 8;
  const iW = W - PX * 2, iH = H - PY * 2;
  const xs = pts.map((_, i) => PX + (i / (pts.length - 1)) * iW);
  const ys = pts.map((r) => PY + (1 - r.pct / 100) * iH);
  const linePath = pts.reduce((acc, _p, i) => {
    if (i === 0) return `M ${xs[0]},${ys[0]}`;
    const cpX = (xs[i - 1] + xs[i]) / 2;
    return `${acc} C ${cpX},${ys[i - 1]} ${cpX},${ys[i]} ${xs[i]},${ys[i]}`;
  }, "");
  const fillPath = `${linePath} L ${xs[xs.length - 1]},${H} L ${xs[0]},${H} Z`;
  const dotColor = (p: number) => p >= 80 ? "#10b981" : p >= 60 ? "#f59e0b" : "#ef4444";
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 72 }}>
      <defs>
        <linearGradient id="profile-trend-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.03" />
        </linearGradient>
      </defs>
      {[60, 80].map((pct) => {
        const y = PY + (1 - pct / 100) * iH;
        return <line key={pct} x1={PX} y1={y} x2={W - PX} y2={y}
          stroke="var(--app-surface)" strokeWidth="1" strokeDasharray="3 3" />;
      })}
      <path d={fillPath} fill="url(#profile-trend-grad)" />
       <path d={linePath} fill="none" stroke="#4f46e5" strokeWidth="1.8"
        strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((r, i) => {
        const last = i === pts.length - 1;
        const dc = dotColor(r.pct);
        return (
          <g key={i}>
            {last && <circle cx={xs[i]} cy={ys[i]} r={7} fill={dc} opacity={0.22} />}
            <circle cx={xs[i]} cy={ys[i]} r={last ? 3.5 : 2.5}
               fill={last ? dc : "#4f46e5"} stroke={last ? "#eef2ff" : "none"} strokeWidth={1} />
          </g>
        );
      })}
    </svg>
  );
}

function Avatar({ name, avatarId, size = 64, isPremium: isP }: { name: string; avatarId?: string | null; size?: number; isPremium?: boolean }) {
  const colors = ["#8b5cf6", "#06b6d4", "#10b981", "#f97316", "#ec4899", "#f59e0b"];
  const color  = colors[(name.charCodeAt(0) || 0) % colors.length];
  const emoji  = getAvatarEmoji(avatarId);
  if (avatarId) {
    return (
      <div className="relative inline-flex">
        <div className="rounded-full flex items-center justify-center"
          style={{ width: size, height: size, background: isP ? "linear-gradient(135deg,#f59e0b,#d97706)" : color, fontSize: size * 0.52 }}>
          {emoji}
        </div>
        {isP && (
          <span className="absolute -top-1 -right-1 text-xs leading-none"
            style={{ fontSize: size * 0.3 }}>👑</span>
        )}
      </div>
    );
  }
  return (
    <div className="relative inline-flex">
      <div className="rounded-full flex items-center justify-center font-black text-white"
        style={{ width: size, height: size, background: color, fontSize: size * 0.38 }}>
        {(name || "?")[0].toUpperCase()}
      </div>
      {isP && (
        <span className="absolute -top-1 -right-1 text-xs leading-none"
          style={{ fontSize: size * 0.3 }}>👑</span>
      )}
    </div>
  );
}

function AuthForm() {
  const { signInWithEmail, resetPassword } = useAuth();
  const [, navigate] = useLocation();
  const [tab,         setTab]         = useState<"in" | "up" | "reset">("in");
  const [email,       setEmail]       = useState("");
  const [password,    setPassword]    = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error,       setError]       = useState("");
  const [loading,     setLoading]     = useState(false);
  const [shake,       setShake]       = useState(false);
  const [resetSent,   setResetSent]   = useState(false);

  function friendlyError(code: string) {
    if (code.includes("user-not-found") || code.includes("wrong-password") || code.includes("invalid-credential")) return "Invalid email or password";
    if (code.includes("email-already-in-use")) return "Account already exists — try signing in";
    if (code.includes("weak-password")) return "Password must be at least 6 characters";
    if (code.includes("invalid-email")) return "Enter a valid email address";
    if (code.includes("too-many-requests")) return "Too many attempts — try again later";
    if (code.includes("unauthorized-domain")) return "Domain not authorized in Firebase Console. Add this site's domain under Authentication → Authorized Domains.";
    if (code.includes("popup-blocked")) return "Popup was blocked by your browser. Trying redirect…";
    if (code.includes("cancelled-popup-request") || code.includes("popup-closed-by-user")) return "Sign-in cancelled. Please try again.";
    if (code.includes("network-request-failed")) return "Network error. Check your internet connection.";
    if (code) return `Sign-in error: ${code}`;
    return "Something went wrong. Please try again.";
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) { setError("Enter your email address first"); return; }
    setError(""); setLoading(true);
    try {
      await resetPassword(email.trim());
      setResetSent(true);
    } catch (e: unknown) {
      const code = (e as { code?: string }).code ?? "";
      setError(code.includes("user-not-found") ? "No account found with that email" : friendlyError(code));
      setShake(true);
      setTimeout(() => setShake(false), 600);
    } finally { setLoading(false); }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      await signInWithEmail(email.trim(), password);
    } catch (e: unknown) {
      setError(friendlyError((e as { code?: string }).code ?? ""));
      setShake(true); setPassword("");
      setTimeout(() => setShake(false), 600);
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen w-full overflow-y-auto bg-[#edf4ff] px-4 py-8 sm:flex sm:items-center sm:justify-center sm:px-6">
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -left-24 -top-28 h-72 w-72 rounded-full bg-[#9cc9ff]/35 blur-3xl" />
        <div className="absolute -bottom-32 -right-20 h-80 w-80 rounded-full bg-[#74d8c7]/30 blur-3xl" />
      </div>
      <motion.div initial={{ opacity: 0, y: 24, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
        className="relative z-10 w-full max-w-md overflow-hidden rounded-[32px] border border-white/70 bg-white shadow-[0_24px_70px_rgba(24,78,138,0.18)]">

        {/* ── Forgot Password screen ── */}
        <AnimatePresence mode="wait">
          {tab === "reset" && (
            <motion.div key="reset"
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}>
              <div className="text-center mb-8">
                <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center text-2xl bg-emerald-50 border border-emerald-100">
                  🔑
                </div>
                <h1 className="text-slate-900 font-bold text-2xl tracking-tight mb-1">Reset Password</h1>
                <p className="text-slate-500 text-sm">We'll send a reset link to your email</p>
              </div>

              {resetSent ? (
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                  className="text-center p-6 rounded-2xl"
                  style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)" }}>
                  <p className="text-3xl mb-3">📬</p>
                  <p className="text-slate-900 font-bold text-sm mb-1">Email sent!</p>
                  <p className="text-slate-500 text-xs mb-4">Check your inbox at <span className="text-slate-700">{email}</span> and follow the link to reset your password.</p>
                  <button onClick={() => { setTab("in"); setResetSent(false); setError(""); }}
                    className="text-emerald-700 text-sm font-semibold hover:text-emerald-800 transition-colors">
                    ← Back to Sign In
                  </button>
                </motion.div>
              ) : (
                <motion.form onSubmit={handleReset}
                  animate={shake ? { x: [-8, 8, -6, 6, -3, 3, 0] } : { x: 0 }}
                  transition={{ duration: 0.5 }} className="flex flex-col gap-3">
                  <input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setError(""); }}
                    placeholder="Your email address" required autoFocus
                    className="w-full px-4 py-3.5 rounded-xl text-sm text-slate-900 placeholder-slate-400 outline-none bg-white"
                    style={{
                      background: error ? "#fef2f2" : "#ffffff",
                      border: `1px solid ${error ? "rgba(239,68,68,0.4)" : "var(--app-border)"}`,
                    }} />
                  {error && <p className="text-xs text-red-400 -mt-1 ml-1">{error}</p>}
                  <motion.button type="submit" disabled={loading} whileTap={{ scale: 0.98 }}
                    className="w-full py-3.5 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 transition-colors"
                    style={{
                      opacity: loading ? 0.65 : 1,
                    }}>
                    {loading ? (
                      <><motion.span animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                        className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white inline-block" />
                        Sending…</>
                    ) : "Send Reset Link →"}
                  </motion.button>
                  <button type="button" onClick={() => { setTab("in"); setError(""); }}
                    className="text-center text-slate-400 hover:text-slate-700 text-xs transition-colors mt-1">
                    ← Back to Sign In
                  </button>
                </motion.form>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {tab !== "reset" && (<>
        <div className="relative overflow-hidden rounded-t-[32px] bg-gradient-to-br from-[#155fc7] via-[#246ed0] to-[#1ba497] px-5 pb-16 pt-8 text-white sm:px-9" style={{ color: "#ffffff" }}>
          <div className="absolute -right-16 -top-20 h-48 w-48 rounded-full border-[22px] border-white/10" aria-hidden="true" />
          <div className="absolute -bottom-28 -left-10 h-48 w-48 rounded-full bg-white/10" aria-hidden="true" />
          <div className="relative">
            <div className="mb-7 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/95 p-1.5 shadow-lg shadow-blue-950/15">
                  <img src="/shiken-logo.png" alt="SHIKEN logo" className="h-full w-full rounded-xl object-cover" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-black tracking-[0.24em]" style={{ color: "#ffffff" }}>SHIKEN</p>
                  <p className="mt-0.5 text-[9px] font-semibold tracking-[0.18em] text-white/70" style={{ color: "rgba(255,255,255,0.72)" }}>PREPARE WITH PURPOSE</p>
                </div>
              </div>
              <span className="hidden rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-[10px] font-bold tracking-wide text-white/90 min-[360px]:block">
                BOARD · JEE · NEET
              </span>
            </div>
            <p className="mb-2 text-left text-[11px] font-bold uppercase tracking-[0.2em] text-white/70">
              {tab === "in" ? "Your study space" : "Start your journey"}
            </p>
            <h1 className="text-left text-[2.35rem] font-black leading-[1.05] tracking-[-0.045em]" style={{ color: "#ffffff" }}>
              {tab === "in" ? "Welcome back" : "Create your account"}
            </h1>
            <p className="mt-3 max-w-[300px] text-left text-sm leading-6 text-white/80" style={{ color: "rgba(255,255,255,0.8)" }}>
              Board & Entrance की तैयारी, अब Shiken की ज़िम्मेदारी
            </p>
          </div>
        </div>
        <div className="-mt-8 relative rounded-t-[30px] bg-white px-5 pb-7 pt-7 sm:px-9">
        <div className="mb-5">
          <p className="text-lg font-extrabold tracking-tight text-slate-900">
            {tab === "in" ? "Your credentials" : "A focused plan starts here"}
          </p>
          <p className="mt-1 text-sm leading-5 text-slate-500">
            {tab === "in" ? "Email and password for a secure sign-in" : "Tell us about yourself, verify your email, and choose your exams."}
          </p>
        </div>

        {/* Authentication mode switcher */}
         <div className="grid grid-cols-2 rounded-2xl border border-slate-200 bg-slate-100 p-1 mb-6" role="tablist" aria-label="Authentication mode">
          {(["in", "up"] as const).map((t) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t}
              onClick={() => { setTab(t); setError(""); }}
              className={`h-11 rounded-xl text-sm font-extrabold transition-all ${tab === t ? "bg-white text-[#155fc7] shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>
              {t === "in" ? "Sign in" : "Create account"}
            </button>
          ))}
        </div>

         {tab === "up" ? (
           <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
             className="rounded-2xl border border-blue-100 bg-[#f3f8ff] p-5">
             <div className="mb-4 flex items-start gap-3">
               <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-[#1763c4]">
                 <UserRound size={19} aria-hidden="true" />
               </div>
               <div>
                 <p className="text-sm font-extrabold text-slate-900">Complete guided registration</p>
                 <p className="mt-1 text-xs leading-5 text-slate-500">Your details, password, email verification, and exam goals—all in one simple flow.</p>
               </div>
             </div>
             <motion.button type="button" onClick={() => navigate("/onboarding")} whileTap={{ scale: 0.98 }}
               data-testid="button-start-onboarding"
               className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#1763c4] to-[#1aa394] text-sm font-extrabold text-white shadow-lg shadow-blue-900/15">
               Start registration <ArrowRight size={17} aria-hidden="true" />
             </motion.button>
           </motion.div>
         ) : (
            <motion.form onSubmit={handleSubmit}
             animate={shake ? { x: [-8, 8, -6, 6, -3, 3, 0] } : { x: 0 }}
             transition={{ duration: 0.5 }}
              className="space-y-4">
              <div>
                <label htmlFor="signin-email" className="mb-2 block text-sm font-extrabold text-slate-900">Email address</label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} aria-hidden="true" />
                  <input id="signin-email" type="email" value={email} onChange={(e) => { setEmail(e.target.value); setError(""); }}
                    placeholder="Enter your registered email" required autoComplete="email"
                    className="h-14 w-full rounded-2xl border border-slate-200 bg-[#f4f7fc] pl-11 pr-4 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-[#2872d2] focus:bg-white focus:ring-4 focus:ring-blue-100"
                    data-testid="input-signin-email" />
                </div>
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label htmlFor="signin-password" className="text-sm font-extrabold text-slate-900">Password</label>
                  <button type="button" onClick={() => { setTab("reset"); setError(""); setPassword(""); }}
                    className="text-xs font-bold text-[#1763c4] hover:text-[#124e99]">Forgot password?</button>
                </div>
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} aria-hidden="true" />
                  <input id="signin-password" type={showPassword ? "text" : "password"} value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(""); }}
                    placeholder="Enter your password" required autoComplete="current-password"
                    className={`h-14 w-full rounded-2xl border bg-[#f4f7fc] pl-11 pr-12 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:bg-white focus:ring-4 ${error ? "border-red-300 focus:border-red-400 focus:ring-red-100" : "border-slate-200 focus:border-[#2872d2] focus:ring-blue-100"}`}
                    data-testid="input-signin-password" />
                  <button type="button" onClick={() => setShowPassword((visible) => !visible)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700">
                    {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                  </button>
                </div>
              </div>
              {error && <p className="text-xs font-semibold text-red-600" role="alert" data-testid="status-signin-error">{error}</p>}

             <motion.button type="submit" disabled={loading} whileTap={{ scale: 0.98 }}
                data-testid="button-sign-in"
                className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#1763c4] to-[#1aa394] text-base font-extrabold text-white shadow-lg shadow-blue-900/15 transition-opacity disabled:opacity-60">
               {loading ? (
                  <><motion.span animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                    className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white" /> Signing in…</>
                ) : <>Sign in <ArrowRight size={18} aria-hidden="true" /></>}
             </motion.button>
           </motion.form>
         )}
          <div className="mt-6 border-t border-slate-100 pt-5 text-center">
            <p className="text-sm text-slate-500">{tab === "in" ? "New here?" : "Already have an account?"}</p>
            <button type="button" onClick={() => { setTab(tab === "in" ? "up" : "in"); setError(""); }}
              className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-2xl border-2 border-[#1763c4]/20 bg-[#f3f8ff] text-sm font-extrabold text-[#1763c4] transition-colors hover:border-[#1763c4]/40 hover:bg-blue-50">
              {tab === "in" ? "Create account" : "Back to sign in"} <ArrowRight size={16} aria-hidden="true" />
            </button>
          </div>
        </div>
        </>)}
      </motion.div>
    </div>
  );
}

export default function ProfilePage() {
  const { user, loading, signOut } = useAuth();
  const [, navigate] = useLocation();
  const [sessions,     setSessions]     = useState<Session[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);
  const [editingName,  setEditingName]  = useState(false);
  const [nameVal,      setNameVal]      = useState("");
  const [nameSaving,   setNameSaving]   = useState(false);
  const [nameSaved,    setNameSaved]    = useState(false);
  const [avatarId,     setAvatarId]     = useState<string | null>(() => {
    try { return localStorage.getItem("shiken_avatar_id"); } catch { return null; }
  });
  const [avatarOpen,   setAvatarOpen]   = useState(false);
  const [phone,        setPhone]        = useState("");
  const [phoneSaving,  setPhoneSaving]  = useState(false);
  const [phoneSaved,   setPhoneSaved]   = useState(false);
  const [notifPerm,    setNotifPerm]    = useState<"default"|"granted"|"denied"|"unsupported">("default");
  const nameInputRef = useRef<HTMLInputElement>(null);
  const { isPremium, isActive, daysLeft, expiryDate, walletBalance, referralCode, referralCount } = useSubscription();

  async function handleAvatarSelect(id: string) {
    setAvatarId(id);
    setAvatarOpen(false);
    // Persist locally first so it survives refreshes even if Firebase fails
    try { localStorage.setItem("shiken_avatar_id", id); } catch { /* ignore */ }
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;
    try {
      const token = await auth.currentUser.getIdToken();
      await fetch(`${DB_URL}/users/${uid}.json?auth=${token}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarId: id }),
      });
      const safeId = uid.replace(/[.#$/[\]]/g, "_");
      await fetch(`${DB_URL}/userActivity/${safeId}/meta.json?auth=${token}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarId: id }),
      });
    } catch { /* ignore */ }
  }

  async function handleNameSave() {
    const trimmed = nameVal.trim().slice(0, 30);
    if (!trimmed || !auth.currentUser) return;
    setNameSaving(true);
    try {
      await updateProfile(auth.currentUser, { displayName: trimmed });
      // Persist to localStorage so test recordings pick it up immediately
      try { localStorage.setItem("shiken_username", trimmed); } catch { /* ignore */ }
      // Also sync to leaderboard meta
      const safeId = auth.currentUser.uid.replace(/[.#$/[\]]/g, "_");
      fetch(`https://shiken-d8789-default-rtdb.firebaseio.com/userActivity/${safeId}/meta.json`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: trimmed }),
      }).catch(() => {});
      setEditingName(false);
      setNameSaved(true);
      setTimeout(() => setNameSaved(false), 2500);
    } catch { /* ignore */ }
    finally { setNameSaving(false); }
  }

  function startEdit() {
    setNameVal(user?.displayName || "");
    setEditingName(true);
    setTimeout(() => nameInputRef.current?.focus(), 50);
  }

  async function handlePhoneSave() {
    if (!auth.currentUser || !phone.trim()) return;
    setPhoneSaving(true);
    try {
      const digits = phone.replace(/\D/g, "").slice(0, 15);
      await fetch(`${DB_URL}/users/${auth.currentUser.uid}.json`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: digits }),
      });
      setPhone(digits);
      setPhoneSaved(true);
      setTimeout(() => setPhoneSaved(false), 2500);
    } catch { /* ignore */ }
    finally { setPhoneSaving(false); }
  }

  useEffect(() => {
    if (!user) return;
    setStatsLoading(true);
    const safeId = (auth.currentUser?.uid ?? user.uid).replace(/[.#$/[\]]/g, "_");
    const deviceId = getDeviceId().replace(/[.#$/[\]]/g, "_");
    let cancelled = false;
    (async () => {
      let token = "";
      try { token = await user.getIdToken(); } catch { /* ignore */ }
      if (cancelled) return;
      const authSuffix = token ? `?auth=${token}` : "";
      // Fetch from UID path (current + future data)
      const uidPromise = fetch(`${DB_URL}/userActivity/${safeId}/sessions.json${authSuffix}`).then((r) => r.json());
      // Fetch from legacy deviceId path (old data before auth fix)
      const devicePromise = fetch(`${DB_URL}/userActivity/${deviceId}/sessions.json${authSuffix}`).then((r) => r.json());
      Promise.all([uidPromise, devicePromise])
        .then(([uidData, deviceData]) => {
          if (cancelled) return;
          const seen = new Set<number>();
          const all: Session[] = [];
          const pushSessions = (data: unknown) => {
            if (!data || typeof data !== "object") return;
            (Object.values(data) as Session[]).forEach((s) => {
              const ts = Number(s.timestamp) || 0;
              if (seen.has(ts)) return;
              seen.add(ts);
              all.push({
                subject: s.subject || "unknown",
                pct: isFinite(Number(s.pct)) ? Number(s.pct) : 0,
                score: Number(s.score) || 0,
                total: Number(s.total) || 0,
                timestamp: ts,
                mode: s.mode || "",
                chapter: s.chapter || "",
              });
            });
          };
          pushSessions(uidData);
          pushSessions(deviceData);
          setSessions(all.sort((a, b) => b.timestamp - a.timestamp));
          // One-time migration: copy old deviceId sessions to UID path so future reads are clean
          if (deviceData && typeof deviceData === "object" && uidData && typeof uidData === "object") {
            const uidKeys = Object.keys(uidData).length;
            const deviceKeys = Object.keys(deviceData).length;
            if (deviceKeys > 0 && uidKeys === 0) {
              fetch(`${DB_URL}/userActivity/${safeId}/sessions.json${authSuffix}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(deviceData),
              }).catch(() => {});
            }
          }
        })
        .catch(() => {})
        .finally(() => setStatsLoading(false));
      // Fetch saved phone + avatarId
      fetch(`${DB_URL}/users/${user.uid}.json${authSuffix}`)
        .then((r) => r.json())
        .then((d) => {
          if (cancelled) return;
          // d may be null if the user node doesn't exist yet — still restore localStorage
          if (d && typeof d === "object") {
            if (typeof d.phone === "string") setPhone(d.phone);
            if (typeof d.avatarId === "string") {
              setAvatarId(d.avatarId);
              // sync Firebase value back to localStorage so both are consistent
              try { localStorage.setItem("shiken_avatar_id", d.avatarId); } catch { /* ignore */ }
            }
          }
          // Always restore from localStorage if Firebase has no avatarId
          // (covers first-time users, null responses, or missing field)
          const savedAvatar = localStorage.getItem("shiken_avatar_id");
          if (savedAvatar && !d?.avatarId) setAvatarId(savedAvatar);
        })
        .catch(() => {
          // If Firebase fetch fails, restore avatar from localStorage
          const savedAvatar = localStorage.getItem("shiken_avatar_id");
          if (savedAvatar) setAvatarId(savedAvatar);
        });
    })();
    // Check notification permission
    if (typeof Notification !== "undefined") {
      setNotifPerm(Notification.permission as "default"|"granted"|"denied");
    } else {
      setNotifPerm("unsupported");
    }
    return () => { cancelled = true; };
  }, [user]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--app-bg)" }}>
      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
        className="w-8 h-8 rounded-full border-2 border-transparent"
        style={{ borderTopColor: "#8b5cf6", borderRightColor: "#06b6d4" }} />
    </div>
  );

  if (!user) return <AuthForm />;

  const totalSessions = sessions.length;
  const validSessions = sessions.filter(s => isFinite(Number(s.pct)));
  const avgPct = validSessions.length
    ? Math.round(validSessions.reduce((s, r) => s + Number(r.pct), 0) / validSessions.length)
    : 0;
  const subjectMap: Record<string, { count: number; total: number }> = {};
  sessions.forEach((s) => {
    const key = s.subject && s.subject !== "unknown" ? s.subject : null;
    if (!key) return;
    const pct = isFinite(Number(s.pct)) ? Number(s.pct) : 0;
    if (!subjectMap[key]) subjectMap[key] = { count: 0, total: 0 };
    subjectMap[key].count++;
    subjectMap[key].total += pct;
  });
  const bestSubject = Object.entries(subjectMap).sort((a, b) => (b[1].total / b[1].count) - (a[1].total / a[1].count))[0]?.[0] ?? null;

  return (
    <div className="min-h-screen w-full relative overflow-hidden pb-28 bg-slate-100">

      {/* Avatar picker — fixed full-screen overlay */}
      <AnimatePresence>
        {avatarOpen && (
          <motion.div
            key="avatar-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-50 flex items-end justify-center"
            style={{ background: "rgba(0,0,0,0.75)" }}
            onClick={() => setAvatarOpen(false)}
          >
            <motion.div
              initial={{ y: 80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 80, opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
              className="w-full max-w-lg mx-auto rounded-t-3xl p-6 pb-10 bg-white border border-slate-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                 <p className="text-slate-900 font-bold text-base">Avatar चुनो</p>
                 <button onClick={() => setAvatarOpen(false)} className="text-slate-400 hover:text-slate-700 transition-colors text-lg leading-none">✕</button>
              </div>
              <div className="grid grid-cols-6 gap-3">
                {AVATARS.map((av) => (
                  <motion.button
                    key={av.id}
                    onClick={() => handleAvatarSelect(av.id)}
                    whileTap={{ scale: 0.85 }}
                    className="w-full aspect-square rounded-2xl flex items-center justify-center text-2xl transition-all"
                    style={{
                      background: avatarId === av.id
                         ? isPremium ? "#fffbeb" : "#ecfdf5"
                         : "#f8fafc",
                      border: avatarId === av.id
                         ? isPremium ? "2px solid #fcd34d" : "2px solid #6ee7b7"
                         : "1px solid #e2e8f0",
                    }}
                    title={av.label}
                  >
                    {av.emoji}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative z-10 max-w-lg mx-auto px-4 pt-12 pb-4">

        {/* Profile card */}
        <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
           className="flex items-center gap-4 p-5 rounded-2xl mb-6 bg-slate-50 border border-slate-300 shadow-sm">
          {/* Avatar picker */}
          <div className="relative shrink-0">
            <Avatar name={user.displayName || user.email || "U"} avatarId={avatarId} size={64} isPremium={isPremium} />
            <motion.button
              onClick={() => setAvatarOpen((o) => !o)}
              whileTap={{ scale: 0.9 }}
              title="Change avatar"
              className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center border-2 text-sm z-10"
               style={{ background: isPremium ? "#d97706" : "#059669", borderColor: "#ffffff" }}
            >✏</motion.button>
          </div>
          <div className="flex-1 min-w-0">
            <AnimatePresence mode="wait">
              {editingName ? (
                <motion.div key="editing" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="flex items-center gap-1.5 mb-1">
                  <input
                    ref={nameInputRef}
                    value={nameVal}
                    onChange={(e) => setNameVal(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleNameSave(); if (e.key === "Escape") setEditingName(false); }}
                    maxLength={30}
                     className="flex-1 min-w-0 px-2 py-1 rounded-lg text-sm font-bold text-slate-900 outline-none bg-white border border-slate-200"
                  />
                  <motion.button onClick={handleNameSave} disabled={nameSaving} whileTap={{ scale: 0.9 }}
                     className="shrink-0 px-2 py-1 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700">
                    {nameSaving ? "…" : "Save"}
                  </motion.button>
                  <button onClick={() => setEditingName(false)}
                     className="shrink-0 px-2 py-1 rounded-lg text-xs text-slate-400 hover:text-slate-700 transition-colors">
                    ✕
                  </button>
                </motion.div>
              ) : (
                <motion.div key="display" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="flex items-center gap-1.5 mb-0.5">
                   <p className="text-slate-900 font-bold text-lg truncate">
                    {user.displayName || "Student"}
                  </p>
                  <motion.button onClick={startEdit} whileTap={{ scale: 0.9 }} title="Edit name"
                     className="shrink-0 w-6 h-6 rounded-md flex items-center justify-center transition-colors bg-slate-50 border border-slate-200">
                    <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                       <path d="M7.5 1.5l2 2L3 10H1V8L7.5 1.5z" stroke="#64748b" strokeWidth="1.2" strokeLinejoin="round"/>
                    </svg>
                  </motion.button>
                  {nameSaved && (
                    <motion.span initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                       exit={{ opacity: 0 }} className="text-xs text-emerald-700 font-medium">
                      ✓ Saved
                    </motion.span>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
            {isPremium && isActive && (
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                 className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full mb-1 bg-amber-50 border border-amber-100">
                <span className="text-xs">👑</span>
                 <span className="text-amber-800 font-semibold text-xs">Premium Member</span>
              </motion.div>
            )}
            {isPremium && !isActive && (
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                 className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full mb-1 bg-red-50 border border-red-100 text-red-600">
                <span className="text-xs">⏰</span>
                <span className="font-black text-xs">Expired</span>
              </motion.div>
            )}
             <p className="text-slate-600 text-xs truncate">{user.email}</p>
            {expiryDate && (
                <p className="text-slate-500 text-xs mt-0.5">
                {isActive ? `Expires in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}` : `Expired on ${new Date(expiryDate).toLocaleDateString("en-IN")}`}
              </p>
            )}
              <p className="text-slate-500 text-xs mt-0.5">
              Joined {new Date(user.metadata.creationTime || "").toLocaleDateString("en-IN", { month: "short", year: "numeric" })}
            </p>
          </div>
          <motion.button onClick={signOut} whileTap={{ scale: 0.95 }}
             className="shrink-0 self-start flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors bg-red-50 border border-red-100 text-red-600 hover:bg-red-100">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M4.5 2H2.5A.5.5 0 002 2.5v7a.5.5 0 00.5.5h2M8 4l2 2-2 2M10 6H5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Sign Out
          </motion.button>
        </motion.div>

        {/* Stats */}
        {(() => {
          const streak = computeStreak(sessions);
           const stats = [
             { label: "Tests Taken", value: statsLoading ? "…" : String(totalSessions), color: "#2563eb", surface: "#eff6ff", border: "#bfdbfe" },
             { label: "Avg Score", value: statsLoading ? "…" : `${avgPct}%`, color: "#dc2626", surface: "#fef2f2", border: "#fecaca" },
             { label: "Best Subject", value: statsLoading ? "…" : bestSubject ? SUBJECT_ICONS[bestSubject] ?? "📚" : "—", color: "#7c3aed", surface: "#f5f3ff", border: "#ddd6fe" },
             { label: "Day Streak", value: statsLoading ? "…" : streak > 0 ? `🔥 ${streak}` : "—", color: "#d97706", surface: "#fffbeb", border: "#fde68a" },
          ];
          return (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12, duration: 0.4 }}
              className="grid grid-cols-2 gap-3 mb-4">
              {stats.map((s, i) => (
                <motion.div key={s.label} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.15 + i * 0.05 }}
                  className="rounded-2xl p-4 text-center shadow-sm"
                  style={{ background: s.surface, border: `1px solid ${s.border}` }}>
                  <p className="text-xs text-slate-700 font-semibold mb-1 leading-tight">{s.label}</p>
                  <p className="text-xl font-black" style={{ color: s.color }}>{s.value}</p>
                </motion.div>
              ))}
            </motion.div>
          );
        })()}

        {/* Wallet + Referral */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}
           className="rounded-2xl p-3 mb-4 bg-slate-50 border border-slate-300 shadow-sm">
          <div className="flex items-center justify-between mb-2 rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <span className="text-sm">💰</span>
                <p className="text-emerald-900 text-xs font-bold uppercase tracking-widest">Wallet</p>
            </div>
             <p className="text-emerald-700 font-black text-sm">₹{walletBalance}</p>
          </div>
          <div className="flex items-center justify-between mb-2 rounded-xl bg-pink-50 border border-pink-200 px-3 py-2.5">
             <div className="flex items-center gap-2">
              <span className="text-sm">📞</span>
                <p className="text-pink-900 text-xs font-bold uppercase tracking-widest">Referrals</p>
            </div>
             <p className="text-pink-700 font-bold text-sm">{referralCount} invited</p>
          </div>
           {referralCode && (
            <div className="flex items-center gap-2 mb-3 px-3">
              <span className="text-sm">🔗</span>
              <p className="text-slate-700 text-xs">Code: <span className="font-mono text-slate-900 font-bold">{referralCode}</span></p>
            </div>
          )}
           <motion.button whileTap={{ scale: 0.97 }} onClick={() => navigate("/referral")}
             className="w-full py-2.5 rounded-xl font-bold text-xs text-white bg-emerald-600 hover:bg-emerald-700 transition-colors">
            Earn Rewards →
          </motion.button>
        </motion.div>

        {/* Score trend chart */}
        {sessions.length >= 2 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18, duration: 0.4 }}
           className="mb-6 rounded-2xl border border-indigo-200 bg-indigo-50 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
               <p className="text-indigo-900 text-xs font-bold">📈 Score Trend ({sessions.length} tests)</p>
              <div className="flex gap-3">
                {(() => {
                  const best = Math.max(...sessions.map(s => s.pct));
                  const trend = sessions.length >= 2 ? sessions[0].pct - sessions[1].pct : 0;
                  return (
                    <>
                      <div className="text-right">
                         <p className="text-indigo-800 text-xs font-black">{best}%</p>
                         <p className="text-indigo-600 text-[10px] font-semibold">Best</p>
                      </div>
                      <div className="text-right">
                         <p className={`text-xs font-bold ${trend > 0 ? "text-emerald-600" : trend < 0 ? "text-red-600" : "text-slate-400"}`}>
                          {trend > 0 ? `+${trend}` : trend === 0 ? "–" : trend}%
                        </p>
                          <p className="text-indigo-600 text-[10px] font-semibold">vs prev</p>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
            <TrendChart sessions={sessions} />
            <div className="flex justify-between mt-1 px-1">
                <span className="text-indigo-600 text-[10px] font-medium">Older tests</span>
                <span className="text-indigo-600 text-[10px] font-medium">Latest →</span>
            </div>
          </motion.div>
        )}

        {/* Subject breakdown */}
        {Object.keys(subjectMap).length > 0 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }} className="mb-6">
            <p className="text-slate-500 text-xs font-semibold uppercase tracking-widest mb-3">Subject Breakdown</p>
            <div className="flex flex-col gap-2">
              {Object.entries(subjectMap).map(([subj, info], i) => {
                const avg = Math.round(info.total / info.count);
                return (
                  <motion.div key={subj} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.22 + i * 0.04 }}
                      className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-slate-50 border border-slate-300 shadow-sm">
                    <span className="text-xl">{SUBJECT_ICONS[subj] ?? "📚"}</span>
                    <div className="flex-1">
                       <p className="text-slate-900 text-sm font-semibold capitalize">{subj}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--app-border)" }}>
                          <div className="h-full rounded-full transition-all" style={{ width: `${avg}%`, background: SUBJECT_COLORS[subj] ?? "#8b5cf6" }} />
                        </div>
                        <span className="text-xs font-bold" style={{ color: gradeColor(avg) }}>{avg}%</span>
                      </div>
                    </div>
                      <span className="text-slate-500 text-xs font-medium">{info.count} test{info.count !== 1 ? "s" : ""}</span>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Recent activity */}
        {sessions.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.4 }}>
            <p className="text-slate-500 text-xs font-semibold uppercase tracking-widest mb-3">Recent Activity</p>
            <div className="flex flex-col gap-2">
              {sessions.slice(0, 10).map((s, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.32 + i * 0.03 }}
                   className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-slate-50 border border-slate-300 shadow-sm">
                  <span className="text-xl">{SUBJECT_ICONS[s.subject] ?? "📚"}</span>
                  <div className="flex-1 min-w-0">
                     <p className="text-slate-700 text-xs font-semibold capitalize">
                      {s.subject} · {s.mode === "ai" ? "Smart Test" : s.mode === "full" ? "Full Test" : s.chapter}
                    </p>
                     <p className="text-slate-500 text-xs">
                      {new Date(s.timestamp).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-black" style={{ color: gradeColor(s.pct) }}>{s.pct}%</p>
                     <p className="text-slate-500 text-xs font-medium">{s.score}/{s.total}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {sessions.length === 0 && !statsLoading && (
          <div className="text-center py-12">
            <p className="text-4xl mb-3">📝</p>
            <p className="text-slate-500 text-sm font-medium">No tests yet</p>
            <p className="text-slate-500 text-xs mt-1">Complete a quiz to see your stats here</p>
            <motion.button onClick={() => navigate("/")} whileTap={{ scale: 0.97 }}
              className="mt-4 px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors">
              Start Practising →
            </motion.button>
          </div>
        )}

        {/* ── Notifications & WhatsApp Reminders ───────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="rounded-2xl p-5 bg-slate-50 border border-slate-300 shadow-sm"
        >
          <h3 className="text-slate-600 text-xs font-semibold uppercase tracking-widest mb-4">
            🔔 Reminders
          </h3>

          {/* Browser push notifications */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-slate-700 text-sm font-semibold">Browser Notifications</p>
              {notifPerm === "granted" && (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ background: "rgba(16,185,129,0.15)", color: "#10b981" }}>ON</span>
              )}
              {notifPerm === "denied" && (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444" }}>Blocked</span>
              )}
            </div>
            <p className="text-slate-500 text-xs mb-3">
              {notifPerm === "granted"
                ? "रात 8 बजे practice reminder आएगा अगर आज test नहीं दिया।"
                : notifPerm === "denied"
                ? "Browser में notifications blocked हैं। Settings से allow करो।"
                : notifPerm === "unsupported"
                ? "This browser doesn't support notifications."
                : "Practice miss करने पर हम remind करेंगे — रात 8 बजे।"}
            </p>
            {notifPerm === "default" && (
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={async () => {
                  const result = await requestAndScheduleReminder();
                  if (result === "scheduled") setNotifPerm("granted");
                  else if (result === "denied") setNotifPerm("denied");
                  else setNotifPerm("unsupported");
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors"
              >
                🔔 Enable Reminders
              </motion.button>
            )}
            {notifPerm === "granted" && (
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={() => scheduleEveningReminder()}
                className="px-4 py-2 rounded-xl text-xs font-semibold"
                style={{ background: "rgba(16,185,129,0.1)", color: "#10b981", border: "1px solid rgba(16,185,129,0.2)" }}
              >
                ✓ Reschedule tonight's reminder
              </motion.button>
            )}
          </div>

          {/* WhatsApp phone number */}
          <div className="border-t border-slate-200 pt-4">
            <p className="text-slate-700 text-sm font-semibold mb-1">WhatsApp Reminders</p>
            <p className="text-slate-500 text-xs mb-3">
              अपना WhatsApp number save करो। Admin सीधे तुम्हें message भेज सकता है streak miss पर।
            </p>
            <div className="flex gap-2">
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="91XXXXXXXXXX"
                maxLength={15}
                className="flex-1 px-3 py-2 rounded-xl text-sm font-medium text-slate-900 placeholder-slate-400 bg-white border border-slate-200 focus:border-emerald-500 outline-none transition-colors"
              />
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={handlePhoneSave}
                disabled={phoneSaving || !phone.trim()}
                className="px-4 py-2 rounded-xl text-xs font-bold shrink-0"
                style={{
                  background: phoneSaved ? "rgba(16,185,129,0.15)" : "rgba(0,0,0,0.08)",
                  color: phoneSaved ? "#10b981" : "rgba(255,255,255,0.50)",
                  border: phoneSaved ? "1px solid rgba(16,185,129,0.3)" : "1px solid rgba(255,255,255,0.10)",
                }}
              >
                {phoneSaving ? "…" : phoneSaved ? "✓ Saved" : "Save"}
              </motion.button>
            </div>
          </div>
        </motion.div>

      </div>
    </div>
  );
}
