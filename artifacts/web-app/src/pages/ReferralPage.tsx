import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";

const DB_URL = "https://shiken-d8789-default-rtdb.firebaseio.com";

function generateReferralCode(uid: string): string {
  const prefix = uid.slice(0, 6).toUpperCase();
  return `SKN${prefix}`;
}

export default function ReferralPage() {
  const { user } = useAuth();
  const { walletBalance, referralCount, referralCode, referredBy } = useSubscription();
  const [, navigate] = useLocation();
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  const myCode = referralCode || (user ? generateReferralCode(user.uid) : "");
  const shareUrl = typeof window !== "undefined"
    ? `${window.location.origin}/referral?ref=${encodeURIComponent(myCode)}`
    : "";

  async function handleApply() {
    if (!user || !code.trim()) return;
    setSubmitting(true); setError(""); setMsg("");
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/referral/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: user.uid, referralCode: code.trim().toUpperCase() }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "Invalid referral code.");
      } else {
        setMsg(`✅ ${data.message}`);
        setCode("");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(myCode);
      setMsg("📋 Code copied to clipboard!");
    } catch {
      setMsg(myCode);
    }
  }

  async function shareReferral() {
    const text = `Join SHIKEN — Board & Entrance exam prep app! Use my referral code ${myCode} and start learning. ${shareUrl}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "SHIKEN Referral", text, url: shareUrl });
      } catch { /* user cancelled */ }
    } else {
      await navigator.clipboard.writeText(text);
      setMsg("📋 Referral message copied!");
    }
  }

  return (
    <div className="min-h-screen w-full pb-32 relative overflow-hidden" style={{ background: "#07080f" }}>
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full blur-3xl opacity-15"
          style={{ background: "radial-gradient(circle, #8b5cf6, transparent)" }} />
      </div>

      <div className="relative z-10 max-w-lg mx-auto px-4 pt-14">
        <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
          <button onClick={() => navigate(-1 as never)}
            className="absolute left-4 top-4 w-9 h-9 rounded-xl flex items-center justify-center text-white/40 hover:text-white/80 transition-colors"
            style={{ background: "rgba(255,255,255,0.06)" }}>←</button>
          <div className="text-4xl mb-3">🤝</div>
          <h1 className="text-white font-black text-2xl mb-1">Refer & Earn</h1>
          <p className="text-white/40 text-sm">Invite friends, earn Shiken Wallet rewards</p>
        </motion.div>

        {/* Wallet balance */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="mb-6 rounded-2xl p-5 text-center"
          style={{ background: "linear-gradient(135deg, rgba(245,158,11,0.15), rgba(251,191,36,0.08))", border: "1px solid rgba(251,191,36,0.25)" }}>
          <p className="text-white/50 text-xs font-semibold mb-1">💵 Shiken Wallet</p>
          <p className="text-white font-black text-3xl">₹{walletBalance}</p>
          <p className="text-white/40 text-xs mt-1">{referralCount} successful referral{referralCount !== 1 ? "s" : ""}</p>
        </motion.div>

        {/* My referral code */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="mb-6 rounded-2xl p-5"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <p className="text-white/60 text-xs font-semibold mb-3">Your Referral Code</p>
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 px-4 py-3 rounded-xl text-center font-mono text-lg font-black text-white tracking-wider"
              style={{ background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.3)" }}>
              {myCode || "—"}
            </div>
            <motion.button onClick={copyCode} whileTap={{ scale: 0.95 }}
              className="px-4 py-3 rounded-xl text-xs font-bold text-violet-300"
              style={{ background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.3)" }}>
              Copy
            </motion.button>
          </div>
          <motion.button onClick={shareReferral} whileTap={{ scale: 0.97 }}
            className="w-full py-3 rounded-xl font-bold text-sm text-black"
            style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)", boxShadow: "0 4px 20px rgba(251,191,36,0.3)" }}>
            📤 Share with Friends
          </motion.button>
        </motion.div>

        {/* Rewards info */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="mb-6 rounded-2xl p-5"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <p className="text-white/70 font-bold text-xs mb-3">🎁 Reward Structure</p>
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0"
                style={{ background: "rgba(16,185,129,0.15)", color: "#10b981" }}>🤝</span>
              <div>
                <p className="text-white/80 text-sm font-semibold">JEE / NEET Referral</p>
                <p className="text-white/40 text-xs">₹5 per successful referral</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0"
                style={{ background: "rgba(59,130,246,0.15)", color: "#3b82f6" }}>📚</span>
              <div>
                <p className="text-white/80 text-sm font-semibold">Class 10 / 12 Referral</p>
                <p className="text-white/40 text-xs">₹10 per successful referral</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Apply a code */}
        {!referredBy && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            className="mb-6 rounded-2xl p-5"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <p className="text-white/70 font-bold text-xs mb-3">Have a referral code?</p>
            <div className="flex gap-2">
              <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="Enter code (e.g. SKNABC12)"
                className="flex-1 px-3 py-2.5 rounded-xl text-sm text-white placeholder-white/25 bg-white/5 border border-white/10 outline-none font-mono font-bold tracking-wider"
                disabled={submitting} onKeyDown={(e) => e.key === "Enter" && handleApply()} />
              <motion.button onClick={handleApply} disabled={!code.trim() || submitting} whileTap={{ scale: 0.95 }}
                className="px-4 py-2.5 rounded-xl text-xs font-bold transition-all"
                style={{ background: "rgba(139,92,246,0.2)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.35)", opacity: !code.trim() || submitting ? 0.5 : 1 }}>
                {submitting ? "..." : "Apply"}
              </motion.button>
            </div>
            {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
          </motion.div>
        )}

        {referredBy && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="mb-6 rounded-2xl p-4 text-center"
            style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)" }}>
            <p className="text-emerald-400 text-xs font-bold">✅ You were referred by {referredBy}</p>
          </motion.div>
        )}

        {msg && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
            className="mb-4 px-4 py-3 rounded-xl text-sm text-center text-emerald-400"
            style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)" }}>
            {msg}
          </motion.div>
        )}
      </div>
    </div>
  );
}
