import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from "react";
import {
  signInWithPopup, signInWithRedirect, getRedirectResult,
  setPersistence, browserLocalPersistence,
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut as fbSignOut, onAuthStateChanged, GoogleAuthProvider, updateProfile,
  type User,
} from "firebase/auth";
import { ref, get, set, onValue, off, serverTimestamp } from "firebase/database";
import { auth, db } from "../firebase";

export type UserGoal = "neet" | "jee" | "c10" | "c12";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  goal: UserGoal | null;
  goalLoading: boolean;
  sessionKickedOut: boolean;
  clearSessionKickedOut: () => void;
  setGoal: (goal: UserGoal) => Promise<void>;
  clearGoal: () => Promise<void>;
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]               = useState<User | null>(null);
  const [loading, setLoading]         = useState(true);
  const [goal, setGoalState]          = useState<UserGoal | null>(null);
  const [goalLoading, setGoalLoading] = useState(false);
  const [sessionKickedOut, setSessionKickedOut] = useState(false);

  // In-memory session ID — unique per page-load, never persisted
  const currentSessionIdRef = useRef<string | null>(null);
  // Keeps the Firebase `onValue` unsubscribe handle so we can tear it down
  const sessionUnsubRef = useRef<(() => void) | null>(null);

  const clearSessionKickedOut = () => setSessionKickedOut(false);

  /** Tear down the active session listener without touching Firebase data. */
  const detachSessionListener = () => {
    if (sessionUnsubRef.current) {
      sessionUnsubRef.current();
      sessionUnsubRef.current = null;
    }
  };

  /**
   * Called once per login:
   * 1. Generates a fresh UUID for this device/tab.
   * 2. Writes it to Firebase — displacing any previous session.
   * 3. Listens for changes: if another device writes a different UUID, sign out.
   */
  const startSession = async (u: User) => {
    detachSessionListener();

    const sessionId = crypto.randomUUID();
    currentSessionIdRef.current = sessionId;

    const sessionRef = ref(db, `users/${u.uid}/sessionId`);
    try {
      await set(sessionRef, sessionId);
    } catch {
      // Non-blocking — if write fails, listener will still protect existing sessions
    }

    const unsub = onValue(sessionRef, (snap) => {
      const dbId = snap.val() as string | null;
      // If DB has a *different* session ID, this device was displaced
      if (dbId && currentSessionIdRef.current && dbId !== currentSessionIdRef.current) {
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
        setLoading(false);
        syncUserToDB(u).catch(console.error);
        loadGoal(u).catch(console.error);
        // Start single-session enforcement for this login
        startSession(u).catch(console.error);
      } else {
        // User signed out — tear down session listener
        detachSessionListener();
        currentSessionIdRef.current = null;
        setUser(null);
        setGoalState(null);
        setGoalLoading(false);
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      unsub();
      detachSessionListener();
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

  const signOut = async () => {
    // Clear session tracking before signing out so the listener doesn't fire
    currentSessionIdRef.current = null;
    detachSessionListener();
    await fbSignOut(auth);
    setGoalState(null);
  };

  return (
    <AuthContext.Provider value={{
      user, loading,
      goal, goalLoading, setGoal, clearGoal,
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
