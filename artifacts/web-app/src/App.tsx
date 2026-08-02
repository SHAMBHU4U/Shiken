import { useState, useEffect, useRef, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { signInWithEmailAndPassword, onAuthStateChanged, signOut, setPersistence, browserLocalPersistence, type User } from "firebase/auth";
import { auth, db } from "@/firebase";
import { SubjectIcon } from "@/components/SubjectIcon";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useSubscription } from "@/hooks/useSubscription";
import SubjectPage from "@/pages/SubjectPage";
import AdminPage from "@/pages/AdminPage";
import ProgressPage from "@/pages/ProgressPage";
import ProfilePage from "@/pages/ProfilePage";
import CounsellingPage from "@/pages/CounsellingPage";
import ContactPage from "@/pages/ContactPage";
import LeaderboardPage from "@/pages/LeaderboardPage";
import PricingPage from "@/pages/PricingPage";
import PrivacyPage from "@/pages/PrivacyPage";
import TermsPage from "@/pages/TermsPage";
import QuestionAdminPage from "@/pages/QuestionAdminPage";
import GoalSelectPage from "@/pages/GoalSelectPage";
import MockTestPage from "@/pages/MockTestPage";
import ReferralPage from "@/pages/ReferralPage";
import ChoosePlanPage from "@/pages/ChoosePlanPage";
import { AuthProvider, useAuth, type UserGoal } from "@/contexts/AuthContext";
import {
  getLocalStreak, hasTestedToday, isBannerDismissedToday, dismissBannerForToday,
  getNotificationPermission, requestAndScheduleReminder,
} from "@/utils/streakUtils";

// ─── Username helpers ──────────────────────────────────────────────────────────
const USERNAME_KEY = "shiken_username";
const DEVICE_ID_KEY = "shiken_device_id";
const DB_URL = "https://shiken-d8789-default-rtdb.firebaseio.com";

function getStoredUsername(): string { return localStorage.getItem(USERNAME_KEY) ?? ""; }
function getDeviceId(): string { return localStorage.getItem(DEVICE_ID_KEY) ?? ""; }
function getMyId(): string { return auth.currentUser?.uid ?? getDeviceId(); }

function saveUsername(name: string) {
  localStorage.setItem(USERNAME_KEY, name);
  const myId = getMyId();
  if (!myId) return;
  const safeId = myId.replace(/[.#$/[\]]/g, "_");
  fetch(`${DB_URL}/userActivity/${safeId}/meta.json`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: name, deviceId: getDeviceId() }),
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
        const avgPct = Math.round(sessions.reduce((s, r) => s + Number(r.pct || 0), 0) / sessions.length);
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

interface AnnouncementItem {
  id: string;
  title: string;
  body: string;
  type: "info" | "warning" | "success";
  active: boolean;
  createdAt: number;
}

const ANN_META = {
  info: { color: "#06b6d4", bg: "rgba(6,182,212,0.08)", icon: "ℹ️" },
  warning: { color: "#f59e0b", bg: "rgba(245,158,11,0.08)", icon: "⚠️" },
  success: { color: "#10b981", bg: "rgba(16,185,129,0.08)", icon: "✅" },
} as const;

function AnnouncementBanner() {
  const [items, setItems] = useState<AnnouncementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem("shiken_announcement_dismissed") === "1");

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const res = await fetch(`${DB_URL}/announcements.json`);
        if (!res.ok) return;
        const data = await res.json() as Record<string, Omit<AnnouncementItem, "id">> | null;
        if (!alive) return;
        const list = Object.entries(data ?? {})
          .map(([id, a]) => ({ id, ...a }))
          .filter((a) => a.active)
          .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
        setItems(list);
      } catch {
        if (alive) setItems([]);
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    const t = setInterval(load, 60_000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  if (loading || items.length === 0 || dismissed) return null;

  const a = items[0];
  const meta = ANN_META[a.type] ?? ANN_META.info;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[80] flex items-center justify-center px-4 bg-black/75 backdrop-blur-sm"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-md rounded-3xl p-5"
        style={{ background: "var(--app-bg)", border: `1px solid ${meta.color}40`, boxShadow: "0 24px 80px rgba(0,0,0,0.5)" }}
      >
        <div className="flex items-start gap-3">
          <span className="text-2xl">{meta.icon}</span>
          <div className="flex-1 min-w-0">
            <p className="text-white font-black text-lg">{a.title}</p>
            <p className="text-white/50 text-sm mt-2 leading-relaxed">{a.body}</p>
          </div>
        </div>
        <div className="mt-5 flex gap-2">
          <button
            onClick={() => { sessionStorage.setItem("shiken_announcement_dismissed", "1"); setDismissed(true); }}
            className="flex-1 py-3 rounded-xl text-sm font-bold text-white"
            style={{ background: `linear-gradient(135deg, ${meta.color}, ${meta.color}cc)` }}
          >
            Got it
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Streak Reminder Banner ────────────────────────────────────────────────────

function StreakReminderBanner({ onPractice }: { onPractice: () => void }) {
  const [streak, setStreak] = useState(0);
  const [visible, setVisible] = useState(false);
  const [notifStatus, setNotifStatus] = useState<"idle"|"scheduled"|"denied"|"unsupported">("idle");

  useEffect(() => {
    const s = getLocalStreak();
    if (s >= 1 && !hasTestedToday() && !isBannerDismissedToday()) {
      setStreak(s);
      setVisible(true);
    }
    const perm = getNotificationPermission();
    if (perm === "granted") setNotifStatus("scheduled");
    if (perm === "denied") setNotifStatus("denied");
    if (perm === "unsupported") setNotifStatus("unsupported");
  }, []);

  async function handleRemind() {
    const result = await requestAndScheduleReminder();
    setNotifStatus(result);
  }

  function dismiss() {
    dismissBannerForToday();
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -12, scale: 0.97 }}
      transition={{ duration: 0.45, ease: [0.23, 1, 0.32, 1] }}
      className="mb-5 rounded-2xl p-4"
      style={{
        background: "linear-gradient(135deg, rgba(251,191,36,0.22), rgba(245,158,11,0.13))",
        border: "1px solid rgba(251,191,36,0.45)",
      }}
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl shrink-0 leading-none mt-0.5">🔥</span>
        <div className="flex-1 min-w-0">
          <p className="text-white font-black text-sm mb-0.5">
            {streak}-day streak टूटने वाला है!
          </p>
          <p className="text-white/50 text-xs mb-3">
            आज practice नहीं हुई अभी तक। एक छोटा Mini Test दो और streak बचाओ!
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <motion.button
              onClick={onPractice}
              className="px-3 py-1.5 rounded-xl text-xs font-black text-black"
              style={{ background: "#f59e0b" }}
            >
              Practice Now →
            </motion.button>
            {notifStatus === "idle" && (
              <motion.button
                onClick={handleRemind}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors"
                style={{ border: "1px solid rgba(251,191,36,0.3)", color: "#fbbf24", background: "transparent" }}
              >
                🔔 रात 8 बजे याद दिलाओ
              </motion.button>
            )}
            {notifStatus === "scheduled" && (
              <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                ✓ रात 8 बजे reminder set है
              </span>
            )}
            {notifStatus === "denied" && (
              <span className="text-xs text-white/25">Notifications blocked in browser</span>
            )}
          </div>
        </div>
        <button
          onClick={dismiss}
          className="shrink-0 text-white/25 hover:text-white/60 transition-colors text-base leading-none mt-0.5"
          aria-label="Dismiss"
        >✕</button>
      </div>
    </motion.div>
  );
}

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
      style={{ background: "var(--app-surface)", border: "1px solid rgba(0,0,0,0.08)" }}
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
                background: isMe ? "rgba(139,92,246,0.1)" : i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.03)",
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
          style={{ background: "var(--app-surface)", border: "1px solid rgba(255,255,255,0.10)" }}
        />
        <motion.button type="submit"
          className="px-4 py-2.5 rounded-xl text-sm font-bold text-white shrink-0"
          style={{ background: "#6366f1" }}>
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
      await setPersistence(auth, browserLocalPersistence);
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
      <div className="min-h-screen w-full flex items-center justify-center" style={{ background: "var(--app-bg)" }}>
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
    <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden" style={{ background: "var(--app-bg)" }}>
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
              background: "var(--app-surface)",
              border: "1px solid rgba(255,255,255,0.10)",
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
                background: error ? "rgba(239,68,68,0.08)" : "var(--app-surface)",
                border: `1px solid ${error ? "rgba(239,68,68,0.4)" : "var(--app-border)"}`,
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
            className="mt-3 w-full py-3.5 rounded-xl text-sm font-bold text-white transition-all flex items-center justify-center gap-2"
            style={{
              background: submitting ? "rgba(139,92,246,0.4)" : "linear-gradient(135deg, #8b5cf6, #6366f1)",
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

// ─── Global spinner ───────────────────────────────────────────────────────────

function SplashLoader() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center" style={{ background: "var(--app-bg)" }}>
      <div className="flex flex-col items-center gap-4">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
          className="w-10 h-10 rounded-full border-2 border-transparent"
          style={{ borderTopColor: "#8b5cf6", borderRightColor: "#06b6d4" }}
        />
        <p className="text-white/30 text-xs font-medium tracking-wide">Loading…</p>
      </div>
    </div>
  );
}

// ─── Auth Guard ───────────────────────────────────────────────────────────────
// Public paths that bypass the auth+goal check
const PUBLIC_PATHS = ["/admin", "/admin-shiken-portal", "/privacy", "/terms"];

function AuthGuard({ children }: { children: ReactNode }) {
  const { user, loading, goal, goalLoading } = useAuth();
  const [location] = useLocation();

  const isPublic = PUBLIC_PATHS.some((p) => location === p || location.startsWith(p + "/"));
  if (isPublic) return <>{children}</>;

  if (loading) return <SplashLoader />;
  if (!user) return <ProfilePage />;
  if (goalLoading) return <SplashLoader />;
  if (!goal) return <GoalSelectPage />;

  return <>{children}</>;
}

// ─── Username prompt wrapper ──────────────────────────────────────────────────

function UsernamePromptWrap({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [location] = useLocation();
  const [done, setDone] = useState(false);

  const isPublic = PUBLIC_PATHS.some((p) => location === p || location.startsWith(p + "/"));
  if (isPublic) return <>{children}</>;

  const hasName = !!(localStorage.getItem(USERNAME_KEY) || user?.displayName);
  if (!user || hasName || done) return <>{children}</>;

  return (
    <>
      <UsernameSetup onDone={() => setDone(true)} />
      {children}
    </>
  );
}

const queryClient = new QueryClient();

const subjects = [
  { id: "maths",    label: "Maths",          labelHindi: "गणित",               gradient: "from-cyan-500/30 to-blue-600/30",    border: "border-cyan-400/30",    accent: "#06b6d4" },
  { id: "english",  label: "English",         labelHindi: "अंग्रेज़ी",           gradient: "from-violet-500/30 to-purple-700/30",border: "border-violet-400/30",  accent: "#8b5cf6" },
  { id: "hindi",    label: "Hindi",           labelHindi: "हिंदी",               gradient: "from-orange-500/30 to-red-600/30",   border: "border-orange-400/30",  accent: "#f97316" },
  { id: "science",  label: "Science",         labelHindi: "विज्ञान",             gradient: "from-emerald-500/30 to-teal-600/30", border: "border-emerald-400/30", accent: "#10b981" },
  { id: "social",   label: "Social Science",  labelHindi: "सामाजिक विज्ञान",    gradient: "from-amber-500/30 to-yellow-600/30", border: "border-amber-400/30",   accent: "#f59e0b" },
  { id: "sanskrit", label: "Sanskrit",        labelHindi: "संस्कृत",             gradient: "from-pink-500/30 to-rose-600/30",    border: "border-pink-400/30",    accent: "#ec4899" },
];

const class12Subjects = [
  { id: "physics",   label: "Physics",        labelHindi: "भौतिकी",          gradient: "from-blue-500/30 to-indigo-600/30",   border: "border-blue-400/30",    accent: "#3b82f6" },
  { id: "chemistry", label: "Chemistry",      labelHindi: "रसायन विज्ञान",   gradient: "from-emerald-500/30 to-teal-600/30", border: "border-emerald-400/30", accent: "#10b981" },
  { id: "biology",   label: "Biology",        labelHindi: "जीव विज्ञान",     gradient: "from-green-500/30 to-lime-600/30",   border: "border-green-400/30",   accent: "#22c55e" },
  { id: "maths",     label: "Maths",          labelHindi: "गणित",            gradient: "from-cyan-500/30 to-blue-600/30",    border: "border-cyan-400/30",    accent: "#06b6d4" },
  { id: "social",    label: "Social Science", labelHindi: "सामाजिक विज्ञान", gradient: "from-amber-500/30 to-yellow-600/30", border: "border-amber-400/30",   accent: "#f59e0b" },
  { id: "hindi",     label: "Hindi",          labelHindi: "हिंदी",            gradient: "from-orange-500/30 to-red-600/30",   border: "border-orange-400/30",  accent: "#f97316" },
  { id: "english",   label: "English",        labelHindi: "अंग्रेज़ी",        gradient: "from-violet-500/30 to-purple-700/30",border: "border-violet-400/30",  accent: "#8b5cf6" },
];

const entranceSubjects = [
  { id: "physics",   label: "JEE Physics",    labelHindi: "भौतिकी",          gradient: "from-blue-500/30 to-indigo-600/30",   border: "border-blue-400/30",    accent: "#3b82f6" },
  { id: "chemistry", label: "JEE Chemistry",  labelHindi: "रसायन विज्ञान",   gradient: "from-emerald-500/30 to-teal-600/30", border: "border-emerald-400/30", accent: "#10b981" },
  { id: "maths",     label: "JEE Maths",      labelHindi: "गणित",            gradient: "from-cyan-500/30 to-blue-600/30",    border: "border-cyan-400/30",    accent: "#06b6d4" },
];

const neetSubjects = [
  { id: "physics",   label: "NEET Physics",   labelHindi: "भौतिकी",          gradient: "from-blue-500/30 to-indigo-600/30",   border: "border-blue-400/30",    accent: "#3b82f6" },
  { id: "chemistry", label: "NEET Chemistry", labelHindi: "रसायन विज्ञान",   gradient: "from-emerald-500/30 to-teal-600/30", border: "border-emerald-400/30", accent: "#10b981" },
  { id: "biology",   label: "NEET Biology",   labelHindi: "जीव विज्ञान",     gradient: "from-green-500/30 to-lime-600/30",   border: "border-green-400/30",   accent: "#22c55e" },
];

const CLASS_KEY = "shiken_class";

// ─── Goal → subjects mapping ──────────────────────────────────────────────────

type GoalConfig = {
  label: string;
  labelHindi: string;
  classId: "10" | "12" | "entrance";
  badge: string;
  accent: string;
  subjectIds: string[];
};

const GOAL_CONFIG: Record<UserGoal, GoalConfig> = {
  neet: {
    label: "NEET",
    labelHindi: "मेडिकल प्रवेश",
    classId: "entrance",
    badge: "🩺",
    accent: "#10b981",
    subjectIds: ["physics", "chemistry", "biology"],
  },
  jee: {
    label: "JEE Main",
    labelHindi: "इंजीनियरिंग प्रवेश",
    classId: "entrance",
    badge: "⚙️",
    accent: "#3b82f6",
    subjectIds: ["physics", "chemistry", "maths"],
  },
  c10: {
    label: "Class 10",
    labelHindi: "बोर्ड दसवीं",
    classId: "10",
    badge: "📚",
    accent: "#f59e0b",
    subjectIds: ["maths", "english", "hindi", "science", "social", "sanskrit"],
  },
  c12: {
    label: "Class 12",
    labelHindi: "बोर्ड बारहवीं",
    classId: "12",
    badge: "🎓",
    accent: "#8b5cf6",
    subjectIds: ["physics", "chemistry", "biology", "maths", "social", "hindi", "english"],
  },
};

function getSubjectIconTone(subjectId: string, classId?: string) {
  if (classId === "entrance") return "bg-emerald-100 text-emerald-600";
  if (subjectId === "maths" || subjectId === "science" || subjectId === "physics" || subjectId === "chemistry" || subjectId === "biology") {
    return "bg-blue-100 text-blue-600";
  }
  if (subjectId === "english" || subjectId === "hindi" || subjectId === "sanskrit") {
    return "bg-rose-100 text-rose-600";
  }
  return "bg-amber-100 text-amber-600";
}

function SubjectCard({
  subject,
  index,
  onClick,
  classId,
}: {
  subject: (typeof subjects)[0];
  index: number;
  onClick: () => void;
  classId?: string;
}) {
  return (
    <motion.button
      onClick={onClick}
      initial={{ opacity: 0, y: 40, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: 0.15 + index * 0.1, duration: 0.55, ease: [0.23, 1, 0.32, 1] }}
      className="relative w-full bg-white rounded-2xl p-6 shadow-sm border border-slate-100 text-left transition-shadow duration-300 cursor-pointer group hover:shadow-md"
    >
      <div className="relative z-10">
        <div
          className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 ${getSubjectIconTone(subject.id, classId)}`}
        >
          <SubjectIcon id={subject.id} color="currentColor" size="lg" />
        </div>
        <div className="min-w-0 pr-7">
          {/* Goal badge — emerald pill */}
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100 mb-1">
            {classId === "entrance" ? "Entrance Exam" : `Class ${classId ?? "10"}`}
          </span>
          <h3 className="text-lg font-bold leading-tight text-slate-900">{subject.label}</h3>
          <p className="text-sm font-medium mt-0.5 text-slate-500">{subject.labelHindi}</p>
        </div>
        <div className="absolute top-6 right-6 text-slate-300 group-hover:text-slate-500 transition-colors duration-200">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path
              d="M9 5l7 7-7 7"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>
    </motion.button>
  );
}

// ─── Full Mock Test Card (JEE / NEET dashboard) ──────────────────────────────

function FullMockCard({ goal }: { goal: "jee" | "neet" }) {
  const [, navigate] = useLocation();
  const { isPremium } = useSubscription();

  const isJee = goal === "jee";
  const accent1 = isJee ? "#3b82f6" : "#10b981";
  const accent2 = isJee ? "#8b5cf6" : "#06b6d4";
  const accent3 = isJee ? "#06b6d4" : "#22c55e";
  const subjects = isJee
    ? ["Physics", "Chemistry", "Maths"]
    : ["Physics", "Chemistry", "Biology"];
  const subAccents = isJee ? [accent1, accent2, accent3] : [accent1, accent2, accent3];
  const examLabel = goal.toUpperCase();

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: 0.1, duration: 0.55, ease: [0.23, 1, 0.32, 1] }}
      className="mb-2"
    >
      <motion.button
        onClick={() => navigate(`/mock-test/${goal}${isPremium ? "" : "?demo=true"}`)}
        className="relative w-full bg-white rounded-2xl p-6 shadow-sm border border-slate-100 text-left cursor-pointer transition-shadow duration-300 hover:shadow-md"
      >
        <div className="relative z-10">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 bg-emerald-100 text-emerald-600 text-2xl">
            {isJee ? "⚙️" : "🩺"}
          </div>
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <p className={`text-[10px] font-bold uppercase tracking-widest mb-0.5 ${isPremium ? "text-amber-600" : "text-slate-500"}`}>
                {isPremium ? "👑 Premium Access" : "🆓 Free Demo Available"}
              </p>
              <h3 className="text-lg font-bold leading-tight text-slate-900">
                Full Mock Test
              </h3>
            </div>
            <div className="px-3 py-1 rounded-full text-[11px] font-medium bg-emerald-100 text-emerald-700 shrink-0">
              {examLabel}
            </div>
          </div>

          {/* Subject pills */}
          <div className="flex gap-2 mb-4 flex-wrap">
            {subjects.map((sub, i) => (
              <span
                key={sub}
                 className="px-3 py-1 rounded-full text-[12px] font-medium bg-slate-50 text-slate-600 border border-slate-100"
              >
                {sub}
              </span>
            ))}
          </div>

          {/* Stats row + CTA */}
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-0.5">
               <span className="text-xs text-slate-500">
                {isPremium
                  ? `📋 ${isJee ? "90 Qs · 3 sections" : "200 Qs · 3 sections"}`
                  : "📋 5 Qs × 3 subjects · Demo"}
              </span>
               <span className="text-xs text-slate-500">
                {isPremium
                  ? `⏱ ${isJee ? "3 hours" : "3 hours"}`
                  : "⏱ 15 min · Free trial"}
              </span>
            </div>
            <motion.div
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-black text-white"
              style={{
                background: accent1,
              }}
            >
              {isPremium ? "Start →" : "Try Demo →"}
            </motion.div>
          </div>
        </div>
      </motion.button>
    </motion.div>
  );
}

const QUIZ_SLUGS = ["maths", "english", "hindi", "science", "social", "sanskrit"];

function NavIcon({ id, color }: { id: string; color: string }) {
  const sw: React.SVGProps<SVGSVGElement> = {
    viewBox: "0 0 24 24", fill: "none", stroke: color,
    strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round",
    width: 22, height: 22,
  };
  if (id === "home") return (
    <svg {...sw}>
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9.5z" />
      <path d="M9 21V12h6v9" />
    </svg>
  );
  if (id === "ranks") return (
    <svg {...sw}>
      <path d="M8 21V10M12 21V4M16 21v-6" />
      <path d="M6 21h12" />
    </svg>
  );
  if (id === "profile") return (
    <svg {...sw}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
  if (id === "counselling") return (
    <svg {...sw}>
      <path d="M3 11a9 9 0 1 1 18 0c0 5-4 9-9 9" />
      <path d="M9 14s1 1 3 1 3-1 3-1" />
      <circle cx="9" cy="11" r="1" fill={color} stroke="none" />
      <circle cx="15" cy="11" r="1" fill={color} stroke="none" />
      <path d="M12 20v-4" strokeWidth="1.5" />
      <path d="M9 20h6" strokeWidth="1.5" />
    </svg>
  );
  if (id === "premium") return (
    <svg {...sw} stroke="none">
      <path
        d="M3 18h18l-2.5-8L14 14l-2-7-2 7-4.5-4L3 18z"
        fill={color}
        stroke="none"
      />
      <path d="M3 18h18" stroke={color} strokeWidth="1.8" strokeLinecap="round" fill="none" />
    </svg>
  );
  return (
    <svg {...sw}>
      <path d="M4 4h16c1.1 0 2 .9 2 2v10c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  );
}

function BottomNav() {
  const [location, navigate] = useLocation();
  const { user } = useAuth();
  const isQuiz  = QUIZ_SLUGS.some((s) => location === `/${s}`) || location.startsWith("/c10/") || location.startsWith("/c12/") || location.startsWith("/mock-test/");
  const isAdmin = location === "/admin";
  if (isQuiz || isAdmin) return null;

  const tabs = [
    { path: "/",             iconId: "home",        label: "Home",        color: "#4aa6a5" },
    { path: "/leaderboard",  iconId: "ranks",       label: "Ranks",       color: "#ff6b6b" },
    { path: "/profile",      iconId: "profile",     label: "Profile",     color: "#8f0027" },
    { path: "/pricing",      iconId: "premium",     label: "Premium 👑",  color: "#f59e0b" },
    { path: "/counselling",  iconId: "counselling", label: "Counselling", color: "#ed841c" },
    { path: "/contact",      iconId: "contact",     label: "Contact",     color: "#2563eb" },
  ];

  return (
    <motion.div
      initial={{ y: 80 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
      className="fixed bottom-0 left-0 right-0 z-50"
      style={{
        background: "var(--app-nav-bg)",
        borderTop: "1px solid var(--app-nav-border)",
      }}
    >
      <div className="max-w-lg mx-auto flex items-stretch justify-around px-1 py-1 pb-safe">
        {tabs.map((tab) => {
          const active = location === tab.path;
          return (
            <motion.button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className="relative flex flex-col items-center justify-center gap-1 flex-1 py-3 min-w-0 rounded-xl transition-all duration-200"
              style={{ background: "transparent" }}
            >
              {active && (
                <motion.div
                  layoutId="nav-indicator"
                  className="absolute top-0 left-1/2 -translate-x-1/2 rounded-full"
                  style={{
                    width: 32, height: 2,
                    background: tab.color,
                  }}
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                />
              )}
              <div className="relative">
                <NavIcon id={tab.iconId} color={tab.color} />
                {tab.iconId === "profile" && user && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 border border-white" />
                )}
              </div>
              <span
                className="text-[10px] font-semibold leading-none tracking-wide transition-colors duration-200"
                 style={{ color: active ? tab.color : "#64748b" }}
              >
                {tab.label}
              </span>
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}


// ─── Daily Quote ──────────────────────────────────────────────────────────────
const DAILY_QUOTES = [
  { hi: "मेहनत वो जादू है जो किस्मत बदल देती है।", en: "Hard work is the magic that changes destiny.", emoji: "✨", accent: "#a78bfa", grad: "linear-gradient(135deg,rgba(124,58,237,0.18),rgba(79,70,229,0.10))", border: "#7c3aed" },
  { hi: "एक दिन की मेहनत, एक कदम आगे।", en: "One day's effort, one step ahead.", emoji: "🚶", accent: "#34d399", grad: "linear-gradient(135deg,rgba(16,185,129,0.15),rgba(6,182,212,0.08))", border: "#10b981" },
  { hi: "सपना देखो, सोचो नहीं — बस कर दो!", en: "Dream it. Think less. Just do it!", emoji: "🚀", accent: "#38bdf8", grad: "linear-gradient(135deg,rgba(56,189,248,0.18),rgba(99,102,241,0.10))", border: "#0ea5e9" },
  { hi: "हर सवाल का जवाब तुम्हारे अंदर है।", en: "Every answer lies within you.", emoji: "🧠", accent: "#f472b6", grad: "linear-gradient(135deg,rgba(244,114,182,0.15),rgba(167,139,250,0.10))", border: "#ec4899" },
  { hi: "कल का इंतजार मत करो — आज से शुरुआत करो।", en: "Don't wait for tomorrow — start today.", emoji: "⚡", accent: "#fbbf24", grad: "linear-gradient(135deg,rgba(251,191,36,0.18),rgba(245,158,11,0.10))", border: "#f59e0b" },
  { hi: "जो पढ़ता है, वो बढ़ता है।", en: "Those who read, grow.", emoji: "📚", accent: "#22d3ee", grad: "linear-gradient(135deg,rgba(34,211,238,0.15),rgba(16,185,129,0.08))", border: "#06b6d4" },
  { hi: "हार वहाँ होती है जहाँ कोशिश रुक जाती है।", en: "Failure only happens when effort stops.", emoji: "💪", accent: "#fb923c", grad: "linear-gradient(135deg,rgba(251,146,60,0.18),rgba(239,68,68,0.08))", border: "#f97316" },
  { hi: "छोटे-छोटे कदम भी मंज़िल तक पहुँचाते हैं।", en: "Small steps still reach the destination.", emoji: "🎯", accent: "#a78bfa", grad: "linear-gradient(135deg,rgba(139,92,246,0.18),rgba(59,130,246,0.10))", border: "#8b5cf6" },
  { hi: "आज का Revision कल की Rank है।", en: "Today's revision is tomorrow's rank.", emoji: "🏆", accent: "#fbbf24", grad: "linear-gradient(135deg,rgba(251,191,36,0.20),rgba(234,179,8,0.10))", border: "#eab308" },
  { hi: "उठो, जागो और तब तक मत रुको जब तक लक्ष्य न मिले।", en: "Arise, awake, and stop not till the goal is reached.", emoji: "🌅", accent: "#f472b6", grad: "linear-gradient(135deg,rgba(244,114,182,0.18),rgba(251,113,133,0.10))", border: "#ec4899", from: "— Swami Vivekananda" },
  { hi: "नींद से ज़्यादा ज़रूरी है तुम्हारा सपना।", en: "Your dream is more important than your sleep.", emoji: "🌙", accent: "#818cf8", grad: "linear-gradient(135deg,rgba(129,140,248,0.18),rgba(167,139,250,0.10))", border: "#6366f1" },
  { hi: "किताब वो दोस्त है जो कभी धोखा नहीं देती।", en: "A book is the friend that never betrays you.", emoji: "📖", accent: "#34d399", grad: "linear-gradient(135deg,rgba(52,211,153,0.15),rgba(16,185,129,0.08))", border: "#10b981" },
  { hi: "हौसला रखो — मंज़िल पास है।", en: "Keep courage — the destination is near.", emoji: "🦋", accent: "#38bdf8", grad: "linear-gradient(135deg,rgba(56,189,248,0.15),rgba(34,211,238,0.08))", border: "#0ea5e9" },
  { hi: "सफलता उन्हें मिलती है जो रुकते नहीं।", en: "Success comes to those who don't stop.", emoji: "🔥", accent: "#fb923c", grad: "linear-gradient(135deg,rgba(251,146,60,0.20),rgba(239,68,68,0.10))", border: "#f97316" },
  { hi: "अपने आप पर भरोसा रखो — तुम कर सकते हो।", en: "Believe in yourself — you can do it.", emoji: "💡", accent: "#fbbf24", grad: "linear-gradient(135deg,rgba(251,191,36,0.18),rgba(252,211,77,0.10))", border: "#f59e0b" },
  { hi: "पढ़ाई में लगन ही असली पूजा है।", en: "Dedication in study is the truest devotion.", emoji: "🌺", accent: "#f472b6", grad: "linear-gradient(135deg,rgba(244,114,182,0.15),rgba(251,113,133,0.08))", border: "#db2777" },
  { hi: "रोज़ थोड़ा-थोड़ा — एक दिन बहुत बड़ा।", en: "A little every day — enormous one day.", emoji: "📈", accent: "#22d3ee", grad: "linear-gradient(135deg,rgba(34,211,238,0.15),rgba(99,102,241,0.08))", border: "#06b6d4" },
  { hi: "सवाल गलत हो तो डरो मत — सीखो।", en: "If the answer is wrong, don't fear — learn.", emoji: "🛠️", accent: "#a78bfa", grad: "linear-gradient(135deg,rgba(139,92,246,0.18),rgba(124,58,237,0.10))", border: "#7c3aed" },
  { hi: "जितना पढ़ोगे, उतना राज खुलेंगे।", en: "The more you read, the more secrets unlock.", emoji: "🔓", accent: "#34d399", grad: "linear-gradient(135deg,rgba(16,185,129,0.18),rgba(52,211,153,0.10))", border: "#059669" },
  { hi: "परीक्षा डराती नहीं, तैयारी करती है निडर।", en: "Exams don't scare — preparation makes fearless.", emoji: "🎓", accent: "#818cf8", grad: "linear-gradient(135deg,rgba(129,140,248,0.18),rgba(99,102,241,0.10))", border: "#4f46e5" },
  { hi: "खुद को कम मत आँको — तुम्हारी क्षमता असीम है।", en: "Don't underestimate yourself — your potential is infinite.", emoji: "🌟", accent: "#fbbf24", grad: "linear-gradient(135deg,rgba(251,191,36,0.20),rgba(253,224,71,0.10))", border: "#ca8a04" },
  { hi: "डॉ. कलाम ने कहा था — सपने वो नहीं जो नींद में आएं, सपने वो हैं जो सोने न दें।", en: "\"Dreams are not what you see in sleep; dreams are things which don't let you sleep.\"", emoji: "🇮🇳", accent: "#fb923c", grad: "linear-gradient(135deg,rgba(251,146,60,0.18),rgba(234,179,8,0.08))", border: "#f97316", from: "— Dr. A.P.J. Abdul Kalam" },
  { hi: "आज का focus कल की success है।", en: "Today's focus is tomorrow's success.", emoji: "🎯", accent: "#38bdf8", grad: "linear-gradient(135deg,rgba(56,189,248,0.18),rgba(6,182,212,0.10))", border: "#0284c7" },
  { hi: "मुश्किलें बताती हैं तुम कितने मज़बूत हो।", en: "Hardships reveal how strong you truly are.", emoji: "⚔️", accent: "#f472b6", grad: "linear-gradient(135deg,rgba(244,114,182,0.15),rgba(167,139,250,0.10))", border: "#be185d" },
  { hi: "जो आज पसीना बहाएगा, कल इतिहास बनाएगा।", en: "Those who sweat today will make history tomorrow.", emoji: "🏅", accent: "#34d399", grad: "linear-gradient(135deg,rgba(52,211,153,0.20),rgba(16,185,129,0.10))", border: "#047857" },
];

function DailyQuote() {
  const [pool, setPool] = useState<typeof DAILY_QUOTES>(DAILY_QUOTES);

  useEffect(() => {
    import("firebase/database").then(({ ref, get }) => {
      get(ref(db, "quotes")).then((snap) => {
        if (snap.exists()) {
          const data = snap.val();
          const arr = Array.isArray(data) ? data : Object.values(data);
          if (arr.length > 0) setPool(arr as typeof DAILY_QUOTES);
        }
      }).catch(() => {/* fallback to hardcoded */});
    });
  }, []);

  const dayIndex = Math.floor(Date.now() / 86400000) % pool.length;
  const q = pool[dayIndex];

  return (
    <motion.div
      key={q.hi}
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: 0.5, duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
      className="mb-6 rounded-2xl px-5 py-4 relative overflow-hidden bg-white border border-slate-200"
      style={{ background: "var(--app-card-bg)", border: "1px solid var(--app-border)" }}
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl mt-0.5 shrink-0 select-none">{q.emoji}</span>
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-snug mb-1 text-emerald-700">
            {q.hi}
          </p>
          <p className="text-slate-500 text-[11px] leading-snug italic">
            {q.en}
          </p>
          {q.from && (
            <p className="text-[10px] mt-1 font-semibold text-slate-400">
              {q.from}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function Dashboard() {
  const [, navigate] = useLocation();
  const { goal, clearGoal } = useAuth();
  const goalCfg = goal ? GOAL_CONFIG[goal] : GOAL_CONFIG.c10;
  const allSubjectPool =
    goal === "jee" ? entranceSubjects :
    goal === "neet" ? neetSubjects :
    goalCfg.classId === "entrance" ? entranceSubjects :
    goalCfg.classId === "12" ? class12Subjects : subjects;
  const activeSubjects = allSubjectPool.filter((s) => goalCfg.subjectIds.includes(s.id));

  return (
    <div className="min-h-screen w-full relative overflow-hidden" style={{ background: "var(--app-bg)" }}>
      <div className="relative z-10 max-w-lg mx-auto px-4 pt-10 pb-28">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
          className="text-center mb-10"
        >
          {/* ── Logo mark ─────────────────────────────────────────── */}
          <div className="flex justify-center mb-5">
            <motion.div
              initial={{ scale: 0.7, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ delay: 0.05, duration: 0.7, ease: [0.23, 1, 0.32, 1] }}
              className="relative"
            >
              <div
                className="relative w-[80px] h-[80px] rounded-2xl flex items-center justify-center overflow-hidden bg-white border border-slate-200 shadow-sm"
                style={{
                  background: "#ffffff",
                }}
              >
                <img src="/shiken-logo.png" alt="SHIKEN" className="w-[60px] h-[60px] object-contain" />
              </div>
            </motion.div>
          </div>

          {/* ── Goal badge ─────────────────────────────────────────── */}
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            onClick={() => clearGoal()}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-4 cursor-pointer group"
            style={{
              background: "#ecfdf5",
              border: "1px solid #d1fae5",
            }}
            title="Change goal"
          >
            <span className="text-sm">{goalCfg.badge}</span>
            <span className="text-[11px] font-medium tracking-[0.15em] uppercase text-emerald-700">
              {goalCfg.label} · {goalCfg.labelHindi}
            </span>
            <span className="text-[11px] text-slate-400 group-hover:text-slate-600 transition-colors ml-0.5">✎</span>
          </motion.button>


          {/* ── SHIKEN title ───────────────────────────────────────── */}
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.65, ease: [0.23, 1, 0.32, 1] }}
            className="text-[4.5rem] font-black tracking-tight leading-none mb-1 select-none text-slate-950 dark:text-white"
          >
            SHIKEN
          </motion.h1>

          {/* ── Hindi name ─────────────────────────────────────────── */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35, duration: 0.5 }}
            className="text-base font-bold mb-1"
            style={{ color: "#059669", letterSpacing: "0.13em" }}
          >
            शिकेन &nbsp;·&nbsp; परीक्षा की तैयारी
          </motion.p>

          {/* ── Subtitle ───────────────────────────────────────────── */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="text-sm font-medium text-slate-500"
          >
            Subject चुनो और शुरू करो
          </motion.p>

        </motion.div>

        <AnnouncementBanner />
        <DailyQuote />
        <StreakReminderBanner onPractice={() => {
          document.getElementById("subject-cards")?.scrollIntoView({ behavior: "smooth" });
        }} />

        {(goal === "jee" || goal === "neet") && (
          <FullMockCard goal={goal} />
        )}

        <div id="subject-cards" className="flex flex-col gap-5">
          {activeSubjects.map((subject, index) => (
            <SubjectCard
              key={subject.id}
              subject={subject}
              index={index}
              classId={goalCfg.classId}
              onClick={() => {
                const route = goal === "jee" ? `/jee/${subject.id}` : goal === "neet" ? `/neet/${subject.id}` : `/c${goalCfg.classId === "entrance" ? "12" : goalCfg.classId}/${subject.id}`;
                navigate(route);
              }}
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
            className="flex items-center gap-2 px-4 py-2 rounded-xl border transition-all text-xs font-medium"
            style={{ background: "#ffffff", borderColor: "#e2e8f0", color: "#64748b" }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 10l3-3 3 2 3-4 3 2" stroke="currentColor" strokeWidth="1.5"
                strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            My Progress
          </button>
          <button
            onClick={() => navigate("/admin")}
            className="transition-colors text-xs select-none"
            style={{ color: "rgba(17,17,17,0.06)" }}
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

function OfflineBanner() {
  const isOnline = useOnlineStatus();
  const [dismissed, setDismissed] = useState(false);
  const [visible, setVisible]     = useState(false);
  const prevOnline = useRef(isOnline);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | null = null;
    if (!isOnline) {
      setDismissed(false);
      setVisible(true);
    } else if (prevOnline.current === false) {
      setVisible(true);
      t = setTimeout(() => setVisible(false), 3000);
    } else {
      setVisible(false);
    }
    prevOnline.current = isOnline;
    return () => { if (t !== null) clearTimeout(t); };
  }, [isOnline]);

  if (dismissed || !visible) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="offline-banner"
        initial={{ y: -48, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -48, opacity: 0 }}
        transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
        className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-between px-4 py-2.5"
        style={{
          background: isOnline
            ? "linear-gradient(90deg, rgba(16,185,129,0.92), rgba(5,150,105,0.92))"
            : "linear-gradient(90deg, rgba(234,88,12,0.95), rgba(194,65,12,0.95))",
          backdropFilter: "blur(12px)",
          boxShadow: "0 2px 16px rgba(255,255,255,0.45)",
        }}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm">{isOnline ? "✅" : "📶"}</span>
          <span className="text-white text-xs font-bold">
            {isOnline ? "Back online!" : "You're offline — using cached questions"}
          </span>
        </div>
        {!isOnline && (
          <button
            onClick={() => setDismissed(true)}
            className="text-white/70 hover:text-white text-lg leading-none ml-3"
            aria-label="Dismiss"
          >
            ×
          </button>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Single-session kicked-out modal ─────────────────────────────────────────

function SessionKickedModal() {
  const { sessionKickedOut, clearSessionKickedOut } = useAuth();
  if (!sessionKickedOut) return null;
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[200] flex items-center justify-center px-4 bg-black/80 backdrop-blur-sm"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.93, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
        className="w-full max-w-sm rounded-3xl p-6 text-center"
        style={{
          background: "var(--app-bg)",
          border: "1px solid rgba(239,68,68,0.35)",
          boxShadow: "0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(239,68,68,0.10)",
        }}
      >
        <div className="text-4xl mb-4">🔐</div>
        <h2 className="text-white font-black text-lg mb-2">Logged Out</h2>
        <p className="text-white/50 text-sm leading-relaxed mb-1">
          आपका account किसी दूसरे device पर open हो गया।
        </p>
        <p className="text-white/35 text-xs leading-relaxed mb-6">
          Security के लिए यहाँ से sign out कर दिया गया है।
          <br />एक बार में एक ही device पर login हो सकता है।
        </p>
        <button
          onClick={clearSessionKickedOut}
          className="w-full py-3 rounded-2xl text-sm font-black text-white transition-opacity hover:opacity-90"
          style={{ background: "linear-gradient(135deg, #ef4444, #dc2626)" }}
        >
          ठीक है, दोबारा Login करें
        </button>
      </motion.div>
    </motion.div>
  );
}

function AppRoutes() {
  return (
    <>
      <SessionKickedModal />
      <OfflineBanner />
      <AuthGuard>
        <UsernamePromptWrap>
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/admin" component={AdminGuard} />
            <Route path="/progress" component={ProgressPage} />
            <Route path="/profile" component={ProfilePage} />
            <Route path="/counselling" component={CounsellingPage} />
            <Route path="/contact" component={ContactPage} />
            <Route path="/leaderboard" component={LeaderboardPage} />
            <Route path="/pricing" component={PricingPage} />
            <Route path="/referral" component={ReferralPage} />
            <Route path="/choose-plan" component={() => <ChoosePlanPage />} />
            <Route path="/privacy" component={PrivacyPage} />
            <Route path="/terms" component={TermsPage} />
            <Route path="/admin-shiken-portal" component={QuestionAdminPage} />
            <Route path="/mock-test/:examType" component={MockTestPage} />
            <Route path="/jee/:subject" component={SubjectPage} />
            <Route path="/neet/:subject" component={SubjectPage} />
            <Route path="/c10/:subject" component={SubjectPage} />
            <Route path="/c12/:subject" component={SubjectPage} />
            <Route path="/:subject" component={SubjectPage} />
          </Switch>
        </UsernamePromptWrap>
      </AuthGuard>
      <BottomNav />
    </>
  );
}

// Strip any persisted dark class — app is fixed light
if (typeof document !== "undefined") {
  document.documentElement.classList.remove("dark");
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
