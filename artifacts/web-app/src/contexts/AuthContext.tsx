import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import {
  signInWithPopup, signInWithRedirect, getRedirectResult,
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signOut as fbSignOut, onAuthStateChanged, GoogleAuthProvider, updateProfile,
  type User,
} from "firebase/auth";
import { auth } from "../firebase";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, name: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

function isInIframe() {
  try { return window.self !== window.top; } catch { return true; }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]       = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Handle Google redirect result when page loads after a redirect sign-in
    getRedirectResult(auth).catch(() => {});

    const unsub = onAuthStateChanged(auth, (u) => { setUser(u); setLoading(false); });
    return unsub;
  }, []);

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });

    if (isInIframe()) {
      // Popup is blocked in iframes — use redirect flow instead
      await signInWithRedirect(auth, provider);
      return;
    }

    try {
      await signInWithPopup(auth, provider);
    } catch (e: unknown) {
      const code = (e as { code?: string }).code ?? "";
      // If popup was blocked, fall back to redirect
      if (
        code === "auth/popup-blocked" ||
        code === "auth/cancelled-popup-request" ||
        code === "auth/popup-closed-by-user"
      ) {
        await signInWithRedirect(auth, provider);
      } else {
        throw e;
      }
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signUpWithEmail = async (email: string, password: string, name: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    if (name.trim()) await updateProfile(cred.user, { displayName: name.trim() });
  };

  const signOut = async () => { await fbSignOut(auth); };

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, signInWithEmail, signUpWithEmail, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
