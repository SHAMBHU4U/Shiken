import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import {
  signInWithPopup, signInWithRedirect, getRedirectResult,
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  sendPasswordResetEmail,
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
  const [user, setUser]   = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Set up auth state listener immediately — this is the source of truth.
    //    It fires right away with the current user (or null) and on every change.
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });

    // 2. Also consume any pending redirect result (from a previous signInWithRedirect call).
    //    onAuthStateChanged will automatically fire when the redirect completes,
    //    so we just need to call getRedirectResult to clear the pending state.
    //    Errors here (e.g. auth/unauthorized-domain) are surfaced in the catch.
    getRedirectResult(auth).catch(() => {});

    // 3. Return the cleanup function — this is what React uses on unmount.
    return unsub;
  }, []);

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });

    // Inside Replit's dev iframe: only popup can work
    // Mobile browsers: redirect works reliably; popups are blocked
    // Desktop production: popup gives instant UX
    if (isMobileBrowser() && !isInIframe()) {
      // Redirect flow: page navigates to Google and back.
      // getRedirectResult (in useEffect above) will handle the result.
      return signInWithRedirect(auth, provider);
    }

    // Try popup. If blocked by browser, fall back to redirect automatically.
    try {
      await signInWithPopup(auth, provider);
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? "";
      if (code === "auth/popup-blocked" || code === "auth/popup-closed-by-user") {
        // Fall back to redirect when popup is blocked
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
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    if (name.trim()) await updateProfile(cred.user, { displayName: name.trim() });
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const signOut = async () => { await fbSignOut(auth); };

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, signInWithEmail, signUpWithEmail, resetPassword, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
