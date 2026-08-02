import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from "react";
import {
  signInWithPopup, signInWithRedirect, getRedirectResult,
  setPersistence, browserLocalPersistence,
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut as fbSignOut, onAuthStateChanged, GoogleAuthProvider, updateProfile,
  type User,
} from "firebase/auth";
import { ref, get, set, onValue, onDisconnect, serverTimestamp } from "firebase/database";
import { auth, db } from "../firebase";

export type UserGoal = "neet" | "jee" | "c10" | "c12";

export interface UserProfile {
  paymentVerified?: boolean;
  subscriptionType?: string;
  premiumUntil?: number;
  [key: string]: unknown;
}

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  isPremium: boolean;
  loading: boolean;
  goal: UserGoal | null;
  goalLoading: boolean;
  sessionKickedOut: boolean;
  clearSessionKickedOut: () => void;
  setGoal: (goal: UserGoal) => Promise<void>;
  clearGoal: () => Promise<void>;
  refreshUserProfile: (u?: User) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, name: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

function isInIframe() {
  try { return window.self !== window.top; } catch { return true; }
}

function isMobileBrowser() {
  return /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(navigator.userAgent);
}

function calculateIsPremium(userProfile: UserProfile | null): boolean {
  const premiumUntil = userProfile?.premiumUntil;
  return userProfile?.paymentVerified === true
    && userProfile?.subscriptionType === "premium"
    && typeof premiumUntil === "number"
    && premiumUntil > Date.now();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]               = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isPremium, setIsPremium]     = useState(false);
  const [loading, setLoading]         = useState(true);
  const [goal, setGoalState]          = useState<UserGoal | null>(null);
  const [goalLoading, setGoalLoading] = useState(false);
  const [sessionKickedOut, setSessionKickedOut] = useState(false);

  // In-memory session ID — unique per page-load, never persisted
  const currentSessionIdRef = useRef<string | null>(null);
  // Keeps the Firebase `onValue` unsubscribe handle so we can tear it down
  const sessionUnsubRef = useRef<(() => void) | null>(null);
  // Keeps the Firebase user-profile listener live for payment/admin changes
  const profileUnsubRef = useRef<(() => void) | null>(null);

  const clearSessionKickedOut = () => setSessionKickedOut(false);

  /** Tear down the active session listener without touching Firebase data. */
  const detachSessionListener = () => {
    if (sessionUnsubRef.current) {
      sessionUnsubRef.current();
      sessionUnsubRef.current = null;
    }
  };

  const detachProfileListener = () => {
    if (profileUnsubRef.current) {
      profileUnsubRef.current();
      profileUnsubRef.current = null;
    }
  };

  const applyUserProfile = (profile: UserProfile | null) => {
    setUserProfile(profile);
    setIsPremium(calculateIsPremium(profile));
  };

  useEffect(() => {
    const premiumUntil = userProfile?.premiumUntil;
    if (typeof premiumUntil !== "number" || premiumUntil <= Date.now()) return;

    let expiryTimer: number;
    const checkExpiry = () => {
      const remaining = premiumUntil - Date.now();
      if (remaining <= 0) {
        setIsPremium(false);
        return;
      }
      expiryTimer = window.setTimeout(checkExpiry, Math.min(remaining + 1, 2_147_483_647));
    };
    checkExpiry();

    return () => window.clearTimeout(expiryTimer);
  }, [userProfile]);

  /**
   * Called once per login:
   * 1. Generates a fresh UUID for this device/tab.
   * 2. Writes it to Firebase — displacing any previous session.
   * 3. Sets presence to "online" and registers onDisconnect → "offline".
   * 4. Listens for session changes: if another device writes a different UUID
   *    (or an admin deletes it), this device is signed out automatically.
   */
  const startSession = async (u: User) => {
    detachSessionListener();

    const sessionId = crypto.randomUUID();
    currentSessionIdRef.current = sessionId;

    const sessionRef  = ref(db, `users/${u.uid}/sessionId`);
    const statusRef   = ref(db, `users/${u.uid}/status`);
    const lastSeenRef = ref(db, `users/${u.uid}/lastSeen`);

    try {
      // Write session ID (displaces any old session on another device)
      await set(sessionRef, sessionId);
      // Mark presence online
      await set(statusRef, "online");
      await set(lastSeenRef, Date.now());
      // Firebase automatically writes these when the client disconnects
      await onDisconnect(statusRef).set("offline");
      await onDisconnect(lastSeenRef).set(serverTimestamp());
    } catch {
      // Non-blocking — listener still protects against duplicate sessions
    }

    const unsub = onValue(sessionRef, (snap) => {
      const dbId = snap.val() as string | null;
      // Kick if: our session exists AND DB value no longer matches
      // (handles both: other device login → new UUID, or admin revoke → null)
      if (currentSessionIdRef.current !== null && dbId !== currentSessionIdRef.current) {
        currentSessionIdRef.current = null;
        detachSessionListener();
        setSessionKickedOut(true);
        fbSignOut(auth).catch(() => {});
      }
    });
    sessionUnsubRef.current = unsub;
  };

  const syncUserToDB = async (u: User) => {
    const userRef  = ref(db, `users/${u.uid}`);
    const userSnap = await get(userRef);
    const safeId = u.uid.replace(/[.#$/[\]]/g, "_");
    const name = u.displayName || "New Student";

    if (!userSnap.exists()) {
      await set(userRef, {
        uid: u.uid,
        name,
        email: u.email,
        photoURL: u.photoURL,
        createdAt: serverTimestamp(),
        role: "student",
      });
    }

    // Sync username to leaderboard meta (idempotent — no overwrite if already set)
    try {
      const metaRef = ref(db, `userActivity/${safeId}/meta`);
      const metaSnap = await get(metaRef);
      const meta = metaSnap.exists() ? (metaSnap.val() as Record<string, unknown>) : {};
      if (!meta.username) {
        await set(metaRef, {
          ...meta,
          username: name,
          lastActive: Date.now(),
        });
      }
    } catch { /* non-blocking */ }
  };

  const refreshUserProfile = async (u?: User) => {
    const currentUser = u ?? auth.currentUser;
    if (!currentUser) {
      applyUserProfile(null);
      return;
    }

    const snap = await get(ref(db, `users/${currentUser.uid}`));
    if (auth.currentUser?.uid !== currentUser.uid) return;
    applyUserProfile(snap.exists() ? (snap.val() as UserProfile) : null);
  };

  const startProfileSync = async (u: User) => {
    detachProfileListener();
    await refreshUserProfile(u);
    if (auth.currentUser?.uid !== u.uid) return;

    const profileRef = ref(db, `users/${u.uid}`);
    profileUnsubRef.current = onValue(
      profileRef,
      (snap) => {
        if (auth.currentUser?.uid !== u.uid) return;
        applyUserProfile(snap.exists() ? (snap.val() as UserProfile) : null);
      },
      (error) => console.error("User profile sync error:", error),
    );
  };

  const loadGoal = async (u: User) => {
    setGoalLoading(true);
    try {
      const snap = await get(ref(db, `users/${u.uid}/goal`));
      setGoalState(snap.exists() ? (snap.val() as UserGoal) : null);
    } catch {
      setGoalState(null);
    } finally {
      setGoalLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    // 1️⃣ Handle mobile redirect result
    getRedirectResult(auth)
      .then(async (result) => {
        if (isMounted && result?.user) {
          await syncUserToDB(result.user);
          await loadGoal(result.user);
        }
      })
      .catch((err) => console.error("Redirect check error:", err));

    // 2️⃣ Global auth state change listener
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!isMounted) return;

      if (u) {
        setUser(u);
        applyUserProfile(null);
        setLoading(false);
        syncUserToDB(u)
          .catch(console.error)
          .finally(() => startProfileSync(u).catch(console.error));
        loadGoal(u).catch(console.error);
        // Start single-session enforcement for this login
        startSession(u).catch(console.error);
      } else {
        // User signed out — tear down session listener
        detachSessionListener();
        detachProfileListener();
        currentSessionIdRef.current = null;
        setUser(null);
        applyUserProfile(null);
        setGoalState(null);
        setGoalLoading(false);
        setLoading(false);
      }
    });

    const handleSubscriptionUpdated = () => {
      const current = auth.currentUser;
      if (current) refreshUserProfile(current).catch(console.error);
    };
    window.addEventListener("shiken:subscription-updated", handleSubscriptionUpdated);

    return () => {
      isMounted = false;
      unsub();
      detachSessionListener();
      detachProfileListener();
      window.removeEventListener("shiken:subscription-updated", handleSubscriptionUpdated);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setGoal = async (g: UserGoal) => {
    if (!user) return;
    await set(ref(db, `users/${user.uid}/goal`), g);
    setGoalState(g);
  };

  const clearGoal = async () => {
    if (!user) return;
    await set(ref(db, `users/${user.uid}/goal`), null);
    setGoalState(null);
  };

  const signInWithGoogle = async () => {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });

  try {
    // 🌟 Persistence set kar rahe hain taaki mobile redirect ke baad login data save rahe
    await setPersistence(auth, browserLocalPersistence);

    if (isMobileBrowser() && !isInIframe()) {
      return signInWithRedirect(auth, provider);
    }

    const result = await signInWithPopup(auth, provider);
    if (result.user) {
      await syncUserToDB(result.user);
      await loadGoal(result.user);
    }
  } catch (err: unknown) {
    const code = (err as { code?: string }).code ?? "";
    if (code === "auth/popup-blocked" || code === "auth/popup-closed-by-user") {
      await signInWithRedirect(auth, provider);
    } else {
      throw err;
    }
  }
};

  const signInWithEmail = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signUpWithEmail = async (email: string, password: string, name: string) => {
    const cred    = await createUserWithEmailAndPassword(auth, email, password);
    const newUser = cred.user;

    if (name.trim()) {
      await updateProfile(newUser, { displayName: name.trim() });
    }

    await set(ref(db, `users/${newUser.uid}`), {
      uid: newUser.uid,
      name: name.trim() || newUser.displayName || "Student",
      email: newUser.email,
      createdAt: serverTimestamp(),
      role: "student",
    });
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const signOut = async (uid?: string) => {
    // Grab uid before clearing refs (auth.currentUser may become null after signOut)
    const targetUid = uid ?? auth.currentUser?.uid;
    currentSessionIdRef.current = null;
    detachSessionListener();
    if (targetUid) {
      try {
        await set(ref(db, `users/${targetUid}/status`), "offline");
        await set(ref(db, `users/${targetUid}/lastSeen`), Date.now());
      } catch { /* non-blocking */ }
    }
    await fbSignOut(auth);
    detachProfileListener();
    applyUserProfile(null);
    setGoalState(null);
  };

  return (
    <AuthContext.Provider value={{
      user, userProfile, isPremium, loading,
      goal, goalLoading, setGoal, clearGoal,
      refreshUserProfile,
      sessionKickedOut, clearSessionKickedOut,
      signInWithGoogle, signInWithEmail, signUpWithEmail, resetPassword, signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
