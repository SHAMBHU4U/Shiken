import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { updateProfile } from "firebase/auth";
import { auth } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { useSubscription } from "../hooks/useSubscription";
import { requestAndScheduleReminder, scheduleEveningReminder } from "../utils/streakUtils";
import { AVATARS, getAvatarEmoji } from "../utils/avatarUtils";

const DB_URL = "https://shiken-d8789-default-rtdb.firebaseio.com";

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
          <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {[60, 80].map((pct) => {
        const y = PY + (1 - pct / 100) * iH;
        return <line key={pct} x1={PX} y1={y} x2={W - PX} y2={y}
          stroke="rgba(255,255,255,0.06)" strokeWidth="1" strokeDasharray="3 3" />;
      })}
      <path d={fillPath} fill="url(#profile-trend-grad)" />
      <path d={linePath} fill="none" stroke="#8b5cf6" strokeWidth="1.8"
        strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((r, i) => {
        const last = i === pts.length - 1;
        const dc = dotColor(r.pct);
        return (
          <g key={i}>
            {last && <circle cx={xs[i]} cy={ys[i]} r={7} fill={dc} opacity={0.22} />}
            <circle cx={xs[i]} cy={ys[i]} r={last ? 3.5 : 2.5}
              fill={last ? dc : "#8b5cf6"} stroke={last ? "#07080f" : "none"} strokeWidth={1} />
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
  const { signInWithGoogle, signInWithEmail, signUpWithEmail, resetPassword } = useAuth();
  const [tab,         setTab]         = useState<"in" | "up" | "reset">("in");
  const [name,        setName]        = useState("");
  const [email,       setEmail]       = useState("");
  const [password,    setPassword]    = useState("");
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

  async function handleGoogle() {
    setError(""); setLoading(true);
    try { await signInWithGoogle(); }
    catch (e: unknown) { setError(friendlyError((e as { code?: string }).code ?? "")); }
    finally { setLoading(false); }
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
      if (tab === "in") await signInWithEmail(email.trim(), password);
      else              await signUpWithEmail(email.trim(), password, name.trim());
    } catch (e: unknown) {
      setError(friendlyError((e as { code?: string }).code ?? ""));
      setShake(true); setPassword("");
      setTimeout(() => setShake(false), 600);
    } finally { setLoading(false); }
  }

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

      <motion.div initial={{ opacity: 0, y: 24, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
        className="relative z-10 w-full max-w-sm mx-4">

        {/* ── Forgot Password screen ── */}
        <AnimatePresence mode="wait">
          {tab === "reset" && (
            <motion.div key="reset"
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}>
              <div className="text-center mb-8">
                <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center text-2xl"
                  style={{ background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.25)" }}>
                  🔑
                </div>
                <h1 className="text-white font-black text-2xl tracking-tight mb-1">Reset Password</h1>
                <p className="text-white/30 text-sm">We'll send a reset link to your email</p>
              </div>

              {resetSent ? (
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                  className="text-center p-6 rounded-2xl"
                  style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)" }}>
                  <p className="text-3xl mb-3">📬</p>
                  <p className="text-white font-bold text-sm mb-1">Email sent!</p>
                  <p className="text-white/40 text-xs mb-4">Check your inbox at <span className="text-white/70">{email}</span> and follow the link to reset your password.</p>
                  <button onClick={() => { setTab("in"); setResetSent(false); setError(""); }}
                    className="text-purple-400 text-sm font-semibold hover:text-purple-300 transition-colors">
                    ← Back to Sign In
                  </button>
                </motion.div>
              ) : (
                <motion.form onSubmit={handleReset}
                  animate={shake ? { x: [-8, 8, -6, 6, -3, 3, 0] } : { x: 0 }}
                  transition={{ duration: 0.5 }} className="flex flex-col gap-3">
                  <input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setError(""); }}
                    placeholder="Your email address" required autoFocus
                    className="w-full px-4 py-3.5 rounded-xl text-sm text-white placeholder-white/25 outline-none"
                    style={{
                      background: error ? "rgba(239,68,68,0.08)" : "rgba(255,255,255,0.06)",
                      border: `1px solid ${error ? "rgba(239,68,68,0.4)" : "rgba(255,255,255,0.12)"}`,
                    }} />
                  {error && <p className="text-xs text-red-400 -mt-1 ml-1">{error}</p>}
                  <motion.button type="submit" disabled={loading} whileTap={{ scale: 0.98 }}
                    className="w-full py-3.5 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2"
                    style={{
                      background: loading ? "rgba(139,92,246,0.4)" : "linear-gradient(135deg,#8b5cf6,#6366f1)",
                      boxShadow: loading ? "none" : "0 4px 20px rgba(139,92,246,0.35)",
                    }}>
                    {loading ? (
                      <><motion.span animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                        className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white inline-block" />
                        Sending…</>
                    ) : "Send Reset Link →"}
                  </motion.button>
                  <button type="button" onClick={() => { setTab("in"); setError(""); }}
                    className="text-center text-white/25 hover:text-white/50 text-xs transition-colors mt-1">
                    ← Back to Sign In
                  </button>
                </motion.form>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {tab !== "reset" && (<>
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center font-black text-white text-xl"
            style={{ background: "conic-gradient(from 0deg, #8b5cf6, #06b6d4, #10b981, #f97316, #8b5cf6)" }}>
            S
          </div>
          <h1 className="text-white font-black text-2xl tracking-tight mb-1">
            {tab === "in" ? "Welcome Back" : "Join SHIKEN"}
          </h1>
          <p className="text-white/30 text-sm">
            {tab === "in" ? "Sign in to view your profile & stats" : "Create an account to save your progress"}
          </p>
        </div>

        {/* Google button */}
        <motion.button onClick={handleGoogle} disabled={loading} whileTap={{ scale: 0.98 }}
          className="w-full flex items-center justify-center gap-3 py-3.5 rounded-xl text-sm font-bold mb-4 transition-all"
          style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.15)", color: "white" }}>
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path fill="#4285f4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34a853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#fbbc05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#ea4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </motion.button>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-white/25 text-xs">or</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        {/* Tab switcher */}
        <div className="flex gap-1 p-1 rounded-xl mb-4" style={{ background: "rgba(255,255,255,0.05)" }}>
          {(["in", "up"] as const).map((t) => (
            <button key={t} onClick={() => { setTab(t); setError(""); }}
              className="flex-1 py-2 rounded-lg text-xs font-bold transition-all"
              style={{
                background: tab === t ? "rgba(255,255,255,0.1)" : "transparent",
                color: tab === t ? "#fff" : "rgba(255,255,255,0.35)",
                border: tab === t ? "1px solid rgba(255,255,255,0.15)" : "1px solid transparent",
              }}>
              {t === "in" ? "Sign In" : "Sign Up"}
            </button>
          ))}
        </div>

        <motion.form onSubmit={handleSubmit}
          animate={shake ? { x: [-8, 8, -6, 6, -3, 3, 0] } : { x: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col gap-3">
          {tab === "up" && (
            <input value={name} onChange={(e) => { setName(e.target.value); setError(""); }}
              placeholder="Full name" required className="w-full px-4 py-3.5 rounded-xl text-sm text-white placeholder-white/25 outline-none"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }} />
          )}
          <input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setError(""); }}
            placeholder="Email address" required className="w-full px-4 py-3.5 rounded-xl text-sm text-white placeholder-white/25 outline-none"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }} />
          <div className="relative">
            <input type="password" value={password} onChange={(e) => { setPassword(e.target.value); setError(""); }}
              placeholder="Password" required className="w-full px-4 py-3.5 rounded-xl text-sm text-white placeholder-white/25 outline-none"
              style={{
                background: error ? "rgba(239,68,68,0.08)" : "rgba(255,255,255,0.06)",
                border: `1px solid ${error ? "rgba(239,68,68,0.4)" : "rgba(255,255,255,0.12)"}`,
              }} />
            {error && <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
              className="absolute -bottom-5 left-1 text-xs text-red-400">{error}</motion.p>}
          </div>

          <motion.button type="submit" disabled={loading} whileTap={{ scale: 0.98 }}
            className="mt-3 w-full py-3.5 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2"
            style={{
              background: loading ? "rgba(139,92,246,0.4)" : "linear-gradient(135deg,#8b5cf6,#6366f1)",
              boxShadow: loading ? "none" : "0 4px 20px rgba(139,92,246,0.35)",
            }}>
            {loading ? (
              <><motion.span animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white inline-block" />
                Please wait…</>
            ) : tab === "in" ? "Sign In →" : "Create Account →"}
          </motion.button>

          {tab === "in" && (
            <button type="button"
              onClick={() => { setTab("reset"); setError(""); setPassword(""); }}
              className="text-center w-full text-white/30 hover:text-white/60 text-xs transition-colors mt-1">
              Forgot your password?
            </button>
          )}
        </motion.form>
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
  const [avatarId,     setAvatarId]     = useState<string | null>(null);
  const [avatarOpen,   setAvatarOpen]   = useState(false);
  const [phone,        setPhone]        = useState("");
  const [phoneSaving,  setPhoneSaving]  = useState(false);
  const [phoneSaved,   setPhoneSaved]   = useState(false);
  const [notifPerm,    setNotifPerm]    = useState<"default"|"granted"|"denied"|"unsupported">("default");
  const nameInputRef = useRef<HTMLInputElement>(null);
  const { isPremium } = useSubscription();

  async function handleAvatarSelect(id: string) {
    setAvatarId(id);
    setAvatarOpen(false);
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;
    fetch(`${DB_URL}/users/${uid}.json`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ avatarId: id }),
    }).catch(() => {});
    const safeId = uid.replace(/[.#$/[\]]/g, "_");
    fetch(`${DB_URL}/userActivity/${safeId}/meta.json`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ avatarId: id }),
    }).catch(() => {});
  }

  async function handleNameSave() {
    const trimmed = nameVal.trim().slice(0, 30);
    if (!trimmed || !auth.currentUser) return;
    setNameSaving(true);
    try {
      await updateProfile(auth.currentUser, { displayName: trimmed });
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
    const safeId = user.uid.replace(/[.#$/[\]]/g, "_");
    // Fetch sessions
    fetch(`${DB_URL}/userActivity/${safeId}/sessions.json`)
      .then((r) => r.json())
      .then((data) => {
        if (!data || typeof data !== "object") return;
        const list = Object.values(data) as Session[];
        setSessions(list.sort((a, b) => b.timestamp - a.timestamp));
      })
      .catch(() => {})
      .finally(() => setStatsLoading(false));
    // Fetch saved phone + avatarId
    fetch(`${DB_URL}/users/${user.uid}.json`)
      .then((r) => r.json())
      .then((d) => {
        if (d && typeof d === "object") {
          if (typeof d.phone === "string") setPhone(d.phone);
          if (typeof d.avatarId === "string") setAvatarId(d.avatarId);
        }
      })
      .catch(() => {});
    // Check notification permission
    if (typeof Notification !== "undefined") {
      setNotifPerm(Notification.permission as "default"|"granted"|"denied");
    } else {
      setNotifPerm("unsupported");
    }
  }, [user]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#07080f" }}>
      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
        className="w-8 h-8 rounded-full border-2 border-transparent"
        style={{ borderTopColor: "#8b5cf6", borderRightColor: "#06b6d4" }} />
    </div>
  );

  if (!user) return <AuthForm />;

  const totalSessions = sessions.length;
  const avgPct = totalSessions ? Math.round(sessions.reduce((s, r) => s + r.pct, 0) / totalSessions) : 0;
  const subjectMap: Record<string, { count: number; total: number }> = {};
  sessions.forEach((s) => {
    if (!subjectMap[s.subject]) subjectMap[s.subject] = { count: 0, total: 0 };
    subjectMap[s.subject].count++;
    subjectMap[s.subject].total += s.pct;
  });
  const bestSubject = Object.entries(subjectMap).sort((a, b) => (b[1].total / b[1].count) - (a[1].total / a[1].count))[0]?.[0] ?? null;

  return (
    <div className="min-h-screen w-full relative overflow-hidden pb-28" style={{ background: "#07080f" }}>
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 -left-32 w-80 h-80 rounded-full blur-3xl opacity-10"
          style={{ background: "radial-gradient(circle, #8b5cf6, transparent)" }} />
        <div className="absolute bottom-0 -right-24 w-72 h-72 rounded-full blur-3xl opacity-8"
          style={{ background: "radial-gradient(circle, #06b6d4, transparent)" }} />
        <div className="absolute inset-0 opacity-[0.02]"
          style={{ backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)", backgroundSize: "32px 32px" }} />
      </div>

      <div className="relative z-10 max-w-lg mx-auto px-4 pt-12 pb-4">

        {/* Profile card */}
        <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
          className="flex items-center gap-4 p-5 rounded-2xl mb-6"
          style={isPremium
            ? { background: "linear-gradient(135deg, rgba(251,191,36,0.10), rgba(245,158,11,0.05))", border: "1px solid rgba(251,191,36,0.35)", boxShadow: "0 0 32px rgba(251,191,36,0.12)" }
            : { background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.2)" }}>
          {/* Avatar picker */}
          <div className="relative shrink-0">
            <Avatar name={user.displayName || user.email || "U"} avatarId={avatarId} size={64} isPremium={isPremium} />
            <motion.button
              onClick={() => setAvatarOpen((o) => !o)}
              whileTap={{ scale: 0.9 }}
              title="Change avatar"
              className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center border-2 text-xs"
              style={{ background: isPremium ? "#d97706" : "#7c3aed", borderColor: "#07080f" }}
            >✏</motion.button>
          </div>

          {/* Avatar selector sheet */}
          <AnimatePresence>
            {avatarOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 8 }}
                transition={{ duration: 0.2 }}
                className="absolute top-24 left-4 right-4 z-20 rounded-2xl p-4"
                style={{ background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.12)", boxShadow: "0 16px 64px rgba(0,0,0,0.7)" }}
              >
                <div className="flex items-center justify-between mb-3">
                  <p className="text-white/70 text-xs font-black uppercase tracking-widest">Avatar चुनो</p>
                  <button onClick={() => setAvatarOpen(false)} className="text-white/30 hover:text-white/70 transition-colors text-sm">✕</button>
                </div>
                <div className="grid grid-cols-6 gap-2">
                  {AVATARS.map((av) => (
                    <motion.button
                      key={av.id}
                      onClick={() => handleAvatarSelect(av.id)}
                      whileTap={{ scale: 0.88 }}
                      className="w-full aspect-square rounded-xl flex items-center justify-center text-xl transition-all"
                      style={{
                        background: avatarId === av.id
                          ? isPremium ? "rgba(251,191,36,0.25)" : "rgba(139,92,246,0.3)"
                          : "rgba(255,255,255,0.06)",
                        border: avatarId === av.id
                          ? isPremium ? "2px solid rgba(251,191,36,0.6)" : "2px solid rgba(139,92,246,0.6)"
                          : "1px solid rgba(255,255,255,0.08)",
                      }}
                      title={av.label}
                    >
                      {av.emoji}
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
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
                    className="flex-1 min-w-0 px-2 py-1 rounded-lg text-sm font-bold text-white outline-none"
                    style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(139,92,246,0.5)" }}
                  />
                  <motion.button onClick={handleNameSave} disabled={nameSaving} whileTap={{ scale: 0.9 }}
                    className="shrink-0 px-2 py-1 rounded-lg text-xs font-bold text-white"
                    style={{ background: nameSaving ? "rgba(139,92,246,0.3)" : "rgba(139,92,246,0.7)" }}>
                    {nameSaving ? "…" : "Save"}
                  </motion.button>
                  <button onClick={() => setEditingName(false)}
                    className="shrink-0 px-2 py-1 rounded-lg text-xs text-white/40 hover:text-white/70 transition-colors">
                    ✕
                  </button>
                </motion.div>
              ) : (
                <motion.div key="display" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="flex items-center gap-1.5 mb-0.5">
                  <p className="text-white font-black text-lg truncate">
                    {user.displayName || "Student"}
                  </p>
                  <motion.button onClick={startEdit} whileTap={{ scale: 0.9 }} title="Edit name"
                    className="shrink-0 w-6 h-6 rounded-md flex items-center justify-center transition-colors"
                    style={{ background: "rgba(255,255,255,0.07)" }}>
                    <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                      <path d="M7.5 1.5l2 2L3 10H1V8L7.5 1.5z" stroke="rgba(255,255,255,0.5)" strokeWidth="1.2" strokeLinejoin="round"/>
                    </svg>
                  </motion.button>
                  {nameSaved && (
                    <motion.span initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }} className="text-xs text-emerald-400 font-medium">
                      ✓ Saved
                    </motion.span>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
            {isPremium && (
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full mb-1"
                style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)", boxShadow: "0 2px 12px rgba(251,191,36,0.4)" }}>
                <span className="text-xs">👑</span>
                <span className="text-black font-black text-xs">Premium Member</span>
              </motion.div>
            )}
            <p className="text-white/40 text-xs truncate">{user.email}</p>
            <p className="text-white/25 text-xs mt-0.5">
              Joined {new Date(user.metadata.creationTime || "").toLocaleDateString("en-IN", { month: "short", year: "numeric" })}
            </p>
          </div>
          <motion.button onClick={signOut} whileTap={{ scale: 0.95 }}
            className="shrink-0 self-start flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "rgba(239,68,68,0.8)" }}>
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
            { label: "Tests Taken",  value: statsLoading ? "…" : String(totalSessions), color: "#8b5cf6" },
            { label: "Avg Score",    value: statsLoading ? "…" : `${avgPct}%`,           color: gradeColor(avgPct) },
            { label: "Best Subject", value: statsLoading ? "…" : bestSubject ? SUBJECT_ICONS[bestSubject] ?? "📚" : "—", color: bestSubject ? SUBJECT_COLORS[bestSubject] : "#ffffff40" },
            { label: "Day Streak",   value: statsLoading ? "…" : streak > 0 ? `🔥 ${streak}` : "—", color: streak >= 7 ? "#f59e0b" : streak >= 3 ? "#fb923c" : "#8b5cf6" },
          ];
          return (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12, duration: 0.4 }}
              className="grid grid-cols-2 gap-3 mb-4">
              {stats.map((s, i) => (
                <motion.div key={s.label} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.15 + i * 0.05 }}
                  className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
                  <p className="text-xs text-white/30 mb-1 leading-tight">{s.label}</p>
                  <p className="text-xl font-black" style={{ color: s.color }}>{s.value}</p>
                </motion.div>
              ))}
            </motion.div>
          );
        })()}

        {/* Score trend chart */}
        {sessions.length >= 2 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18, duration: 0.4 }}
            className="mb-6 rounded-2xl border p-4"
            style={{ background: "rgba(139,92,246,0.06)", borderColor: "rgba(139,92,246,0.2)" }}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-white/50 text-xs font-semibold">📈 Score Trend ({sessions.length} tests)</p>
              <div className="flex gap-3">
                {(() => {
                  const best = Math.max(...sessions.map(s => s.pct));
                  const trend = sessions.length >= 2 ? sessions[0].pct - sessions[1].pct : 0;
                  return (
                    <>
                      <div className="text-right">
                        <p className="text-white text-xs font-bold">{best}%</p>
                        <p className="text-white/25 text-[10px]">Best</p>
                      </div>
                      <div className="text-right">
                        <p className={`text-xs font-bold ${trend > 0 ? "text-emerald-400" : trend < 0 ? "text-red-400" : "text-white/40"}`}>
                          {trend > 0 ? `+${trend}` : trend === 0 ? "–" : trend}%
                        </p>
                        <p className="text-white/25 text-[10px]">vs prev</p>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
            <TrendChart sessions={sessions} />
            <div className="flex justify-between mt-1 px-1">
              <span className="text-white/15 text-[10px]">Older tests</span>
              <span className="text-white/15 text-[10px]">Latest →</span>
            </div>
          </motion.div>
        )}

        {/* Subject breakdown */}
        {Object.keys(subjectMap).length > 0 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }} className="mb-6">
            <p className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-3">Subject Breakdown</p>
            <div className="flex flex-col gap-2">
              {Object.entries(subjectMap).map(([subj, info], i) => {
                const avg = Math.round(info.total / info.count);
                return (
                  <motion.div key={subj} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.22 + i * 0.04 }}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl"
                    style={{ background: `${SUBJECT_COLORS[subj] ?? "#8b5cf6"}10`, border: `1px solid ${SUBJECT_COLORS[subj] ?? "#8b5cf6"}25` }}>
                    <span className="text-xl">{SUBJECT_ICONS[subj] ?? "📚"}</span>
                    <div className="flex-1">
                      <p className="text-white text-sm font-semibold capitalize">{subj}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.1)" }}>
                          <div className="h-full rounded-full transition-all" style={{ width: `${avg}%`, background: SUBJECT_COLORS[subj] ?? "#8b5cf6" }} />
                        </div>
                        <span className="text-xs font-bold" style={{ color: gradeColor(avg) }}>{avg}%</span>
                      </div>
                    </div>
                    <span className="text-white/25 text-xs">{info.count} test{info.count !== 1 ? "s" : ""}</span>
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
            <p className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-3">Recent Activity</p>
            <div className="flex flex-col gap-2">
              {sessions.slice(0, 10).map((s, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.32 + i * 0.03 }}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <span className="text-xl">{SUBJECT_ICONS[s.subject] ?? "📚"}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-white/80 text-xs font-semibold capitalize">
                      {s.subject} · {s.mode === "ai" ? "Smart Test" : s.mode === "full" ? "Full Test" : s.chapter}
                    </p>
                    <p className="text-white/30 text-xs">
                      {new Date(s.timestamp).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-black" style={{ color: gradeColor(s.pct) }}>{s.pct}%</p>
                    <p className="text-white/25 text-xs">{s.score}/{s.total}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {sessions.length === 0 && !statsLoading && (
          <div className="text-center py-12">
            <p className="text-4xl mb-3">📝</p>
            <p className="text-white/40 text-sm font-medium">No tests yet</p>
            <p className="text-white/20 text-xs mt-1">Complete a quiz to see your stats here</p>
            <motion.button onClick={() => navigate("/")} whileTap={{ scale: 0.97 }}
              className="mt-4 px-6 py-2.5 rounded-xl text-sm font-bold text-white"
              style={{ background: "linear-gradient(135deg,#8b5cf6,#6366f1)", boxShadow: "0 4px 16px rgba(139,92,246,0.3)" }}>
              Start Practising →
            </motion.button>
          </div>
        )}

        {/* ── Notifications & WhatsApp Reminders ───────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="rounded-2xl p-5"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <h3 className="text-white/70 text-xs font-black uppercase tracking-widest mb-4">
            🔔 Reminders
          </h3>

          {/* Browser push notifications */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-white/80 text-sm font-semibold">Browser Notifications</p>
              {notifPerm === "granted" && (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ background: "rgba(16,185,129,0.15)", color: "#10b981" }}>ON</span>
              )}
              {notifPerm === "denied" && (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444" }}>Blocked</span>
              )}
            </div>
            <p className="text-white/35 text-xs mb-3">
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
                className="px-4 py-2 rounded-xl text-xs font-bold text-white"
                style={{ background: "linear-gradient(135deg,#8b5cf6,#6366f1)", boxShadow: "0 2px 12px rgba(139,92,246,0.3)" }}
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
          <div className="border-t border-white/8 pt-4">
            <p className="text-white/80 text-sm font-semibold mb-1">WhatsApp Reminders</p>
            <p className="text-white/35 text-xs mb-3">
              अपना WhatsApp number save करो। Admin सीधे तुम्हें message भेज सकता है streak miss पर।
            </p>
            <div className="flex gap-2">
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="91XXXXXXXXXX"
                maxLength={15}
                className="flex-1 px-3 py-2 rounded-xl text-sm font-medium text-white placeholder-white/20 bg-white/6 border border-white/10 focus:border-white/25 outline-none transition-colors"
              />
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={handlePhoneSave}
                disabled={phoneSaving || !phone.trim()}
                className="px-4 py-2 rounded-xl text-xs font-bold shrink-0"
                style={{
                  background: phoneSaved ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.08)",
                  color: phoneSaved ? "#10b981" : "rgba(255,255,255,0.6)",
                  border: phoneSaved ? "1px solid rgba(16,185,129,0.3)" : "1px solid rgba(255,255,255,0.1)",
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
