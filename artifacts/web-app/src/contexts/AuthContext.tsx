import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import {
  signInWithPopup, signInWithRedirect, getRedirectResult,
  setPersistence, browserLocalPersistence, // 🌟 Yeh dono naye add kiye hain
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut as fbSignOut, onAuthStateChanged, GoogleAuthProvider, updateProfile,
  type User,
} from "firebase/auth";
import { ref, get, set, serverTimestamp } from "firebase/database";
import { auth, db } from "../firebase";

export type UserGoal = "neet" | "jee" | "c10" | "c12";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  goal: UserGoal | null;
  goalLoading: boolean;
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
  const [user, setUser]         = useState<User | null>(null);
  const [loading, setLoading]   = useState(true);
  const [goal, setGoalState]    = useState<UserGoal | null>(null);
  const [goalLoading, setGoalLoading] = useState(false);

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

  // ✅ YEH NAYA CODE PASTE KARO:
useEffect(() => {
  let isMounted = true;

  // 1️⃣ Sabse pehle mobile redirect ka data handle karo
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
      // User ko turant state mein set karo taaki redirect loop na bane
      setUser(u);
      setLoading(false);
      
      // Database ka kaam background mein hone do
      syncUserToDB(u).catch(console.error);
      loadGoal(u).catch(console.error);
    } else {
      setUser(null);
      setGoalState(null);
      setGoalLoading(false);
      setLoading(false);
    }
  });

  return () => {
    isMounted = false;
    unsub();
  };
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
    await fbSignOut(auth);
    setGoalState(null);
  };

  return (
    <AuthContext.Provider value={{
      user, loading,
      goal, goalLoading, setGoal, clearGoal,
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
