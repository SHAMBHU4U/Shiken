import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import {
  signInWithPopup, signInWithRedirect, getRedirectResult,
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut as fbSignOut, onAuthStateChanged, GoogleAuthProvider, updateProfile,
  type User,
} from "firebase/auth";
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  serverTimestamp 
} from "firebase/firestore";
import { auth } from "../firebase";

// Firestore database initialize karein
const db = getFirestore();

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

  // User ka data Firestore mein save karne ka helper function
  const syncUserToFirestore = async (u: User) => {
    const userRef = doc(db, "users", u.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      await setDoc(userRef, {
        uid: u.uid,
        name: u.displayName || "New Student",
        email: u.email,
        photoURL: u.photoURL,
        createdAt: serverTimestamp(),
        role: "student"
      });
      console.log("Naya user database mein save ho gaya!");
    }
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        // Jab bhi login state badle, check karo ki user database mein hai ya nahi
        await syncUserToFirestore(u);
      }
      setUser(u);
      setLoading(false);
    });

    // Redirect result handle karein (Mobile users ke liye)
    getRedirectResult(auth).then(async (result) => {
      if (result?.user) {
        await syncUserToFirestore(result.user);
      }
    }).catch((err) => console.error("Redirect error:", err));

    return unsub;
  }, []);

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });

    if (isMobileBrowser() && !isInIframe()) {
      return signInWithRedirect(auth, provider);
    }

    try {
      const result = await signInWithPopup(auth, provider);
      if (result.user) {
        await syncUserToFirestore(result.user);
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
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const newUser = cred.user;

    if (name.trim()) {
      await updateProfile(newUser, { displayName: name.trim() });
    }

    // Manual signup ke waqt bhi database entry banayein
    await setDoc(doc(db, "users", newUser.uid), {
      uid: newUser.uid,
      name: name.trim() || newUser.displayName || "Student",
      email: newUser.email,
      createdAt: serverTimestamp(),
      role: "student"
    });
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