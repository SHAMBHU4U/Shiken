import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { signInWithEmailAndPassword, onAuthStateChanged, signOut, type User } from "firebase/auth";
import { auth } from "@/firebase";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
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
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import {
  getLocalStreak, hasTestedToday, isBannerDismissedToday, dismissBannerForToday,
  getNotificationPermission, requestAndScheduleReminder,
} from "@/utils/streakUtils";

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
    body: JSON.stringify({ name }),
  }).catch(() => {});
}

const queryClient = new QueryClient();

function OfflineBanner() {
  const isOnline = useOnlineStatus();
  const [dismissed, setDismissed] = useState(false);
  const [visible, setVisible] = useState(false);
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
          boxShadow: "0 2px 16px rgba(0,0,0,0.45)",
        }}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm">{isOnline ? "✅" : "📶"}</span>
          <span className="text-white text-xs font-bold">{isOnline ? "Back online!" : "You're offline — using cached questions"}</span>
        </div>
        {!isOnline && (
          <button onClick={() => setDismissed(true)} className="text-white/70 hover:text-white text-lg leading-none ml-3" aria-label="Dismiss">×</button>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

function AppRoutes() {
  return (
    <>
      <OfflineBanner />
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/admin" component={AdminGuard} />
        <Route path="/progress" component={ProgressPage} />
        <Route path="/profile" component={ProfilePage} />
        <Route path="/counselling" component={CounsellingPage} />
        <Route path="/contact" component={ContactPage} />
        <Route path="/leaderboard" component={LeaderboardPage} />
        <Route path="/pricing" component={PricingPage} />
        <Route path="/privacy" component={PrivacyPage} />
        <Route path="/terms" component={TermsPage} />
        <Route path="/admin-shiken-portal" component={QuestionAdminPage} />
        <Route path="/c10/:subject" component={SubjectPage} />
        <Route path="/c12/:subject" component={SubjectPage} />
        <Route path="/:subject" component={SubjectPage} />
      </Switch>
      <BottomNav />
    </>
  );
}

export default App;
