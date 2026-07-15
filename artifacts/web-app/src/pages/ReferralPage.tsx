import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";

const DB_URL  = "https://shiken-d8789-default-rtdb.firebaseio.com";
const API_BASE = import.meta.env.BASE_URL;
const MIN_WITHDRAWAL = 151;

function generateReferralCode(uid: string): string {
  const prefix = uid.slice(0, 6).toUpperCase();
  return `SKN${prefix}`;
}

interface WithdrawalRequest {
  id: string;
  upiId: string;
  amount: number;
  status: "pending" | "paid" | "rejected";
  requestedAt: number;
}

export default function ReferralPage() {
  const { user } = useAuth();
  const { walletBalance, referralCount, referralCode, referredBy } = useSubscription();
  const [, navigate] = useLocation();

  // Referral code apply state
  const [code, setCode]           = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg]             = useState("");
  const [error, setError]         = useState("");

  // Withdrawal state
  const [showWithdraw, setShowWithdraw]       = useState(false);
  const [upiId, setUpiId]                     = useState("");
  const [withdrawAmount, setWithdrawAmount]   = useState("");
  const [withdrawing, setWithdrawing]         = useState(false);
  const [withdrawMsg, setWithdrawMsg]         = useState("");
  const [withdrawError, setWithdrawError]     = useState("");
  const [withdrawHistory, setWithdrawHistory] = useState<WithdrawalRequest[]>([]);
  const [historyLoading, setHistoryLoading]   = useState(false);

  const myCode  = referralCode || (user ? generateReferralCode(user.uid) : "");
  const shareUrl = typeof window !== "undefined"
    ? `${window.location.origin}/referral?ref=${encodeURIComponent(myCode)}`
    : "";

  // Load withdrawal history
  useEffect(() => {
    if (!user) return;
    setHistoryLoading(true);
    fetch(`${API_BASE}api/withdrawal/requests?uid=${encodeURIComponent(user.uid)}`)
      .then(r => r.json())
      .then(data => {
        if (data.ok) setWithdrawHistory(data.requests as WithdrawalRequest[]);
      })
      .catch(() => {})
      .finally(() => setHistoryLoading(false));
  }, [user, withdrawMsg]);

  async function handleApply() {
    if (!user || !code.trim()) return;
    setSubmitting(true); setError(""); setMsg("");
    try {
      const res  = await fetch(`${API_BASE}api/referral/apply`, {
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

  async function handleWithdraw() {
    if (!user) return;
    const amount = Number(withdrawAmount);
    if (!upiId.trim() || !upiId.includes("@")) {
      setWithdrawError("Please enter a valid UPI ID (e.g. name@upi)");
      return;
    }
    if (!Number.isFinite(amount) || amount < MIN_WITHDRAWAL) {
      setWithdrawError(`Minimum withdrawal amount is ₹${MIN_WITHDRAWAL}`);
      return;
    }
    if (amount > walletBalance) {
      setWithdrawError(`Your wallet balance is only ₹${walletBalance}`);
      return;
    }

    setWithdrawing(true); setWithdrawError(""); setWithdrawMsg("");
    try {
      const res  = await fetch(`${API_BASE}api/withdrawal/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: user.uid, upiId: upiId.trim(), amount }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setWithdrawError(data.error || "Withdrawal failed. Try again.");
      } else {
        setWithdrawMsg(data.message);
        setUpiId("");
        setWithdrawAmount("");
        setShowWithdraw(false);
      }
    } catch {
      setWithdrawError("Network error. Please try again.");
    } finally {
      setWithdrawing(false);
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

  function statusBadge(status: WithdrawalRequest["status"]) {
    const map = {
      pending:  { color: "#f59e0b", bg: "rgba(245,158,11,0.12)", label: "Pending" },
      paid:     { color: "#10b981", bg: "rgba(16,185,129,0.12)", label: "Paid ✓" },
      rejected: { color: "#ef4444", bg: "rgba(239,68,68,0.12)",  label: "Rejected" },
    };
    const s = map[status] ?? map.pending;
    return (
      <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ color: s.color, background: s.bg }}>
        {s.label}
      </span>
    );
  }

  return (
    <div className="min-h-screen w-full pb-32 relative overflow-hidden" style={{ background: "var(--app-bg)" }}>
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full blur-3xl opacity-15"
          style={{ background: "radial-gradient(circle, #8b5cf6, transparent)" }} />
      </div>

      <div className="relative z-10 max-w-lg mx-auto px-4 pt-14">
        <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
          <button onClick={() => navigate(-1 as never)}
            className="absolute left-4 top-4 w-9 h-9 rounded-xl flex items-center justify-center text-white/40 hover:text-white/80 transition-colors"
            style={{ background: "var(--app-surface)" }}>←</button>
          <div className="text-4xl mb-3">🤝</div>
          <h1 className="text-white font-black text-2xl mb-1">Refer & Earn</h1>
          <p className="text-white/40 text-sm">Invite friends, earn Shiken Wallet rewards</p>
        </motion.div>

        {/* Wallet balance */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="mb-4 rounded-2xl p-5"
          style={{ background: "linear-gradient(135deg, rgba(245,158,11,0.15), rgba(251,191,36,0.08))", border: "1px solid rgba(251,191,36,0.25)" }}>
          <div className="flex items-center justify-between mb-1">
            <p className="text-white/50 text-xs font-semibold">💵 Shiken Wallet</p>
            {walletBalance >= MIN_WITHDRAWAL && (
              <motion.button
                onClick={() => { setShowWithdraw(v => !v); setWithdrawError(""); setWithdrawMsg(""); }}
                whileTap={{ scale: 0.95 }}
                className="text-xs font-bold px-3 py-1 rounded-lg"
                style={{ background: "rgba(245,158,11,0.2)", color: "#fbbf24", border: "1px solid rgba(245,158,11,0.3)" }}>
                {showWithdraw ? "Cancel" : "Withdraw →"}
              </motion.button>
            )}
          </div>
          <p className="text-white font-black text-3xl">₹{walletBalance}</p>
          <p className="text-white/40 text-xs mt-1">{referralCount} successful referral{referralCount !== 1 ? "s" : ""}</p>
          {walletBalance > 0 && walletBalance < MIN_WITHDRAWAL && (
            <p className="text-amber-400/60 text-xs mt-2">Minimum ₹{MIN_WITHDRAWAL} required to withdraw · Need ₹{MIN_WITHDRAWAL - walletBalance} more</p>
          )}
        </motion.div>

        {/* Withdrawal form */}
        <AnimatePresence>
          {showWithdraw && (
            <motion.div
              initial={{ opacity: 0, height: 0, y: -8 }}
              animate={{ opacity: 1, height: "auto", y: 0 }}
              exit={{ opacity: 0, height: 0, y: -8 }}
              transition={{ duration: 0.3 }}
              className="mb-4 rounded-2xl p-5 overflow-hidden"
              style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)" }}>
              <p className="text-amber-300 font-bold text-xs mb-4">💸 Withdraw to UPI</p>

              <div className="flex flex-col gap-3">
                <div>
                  <p className="text-white/40 text-xs mb-1.5">UPI ID</p>
                  <input
                    value={upiId}
                    onChange={e => { setUpiId(e.target.value); setWithdrawError(""); }}
                    placeholder="yourname@upi / phone@paytm"
                    className="w-full px-3 py-2.5 rounded-xl text-sm text-white placeholder-white/25 bg-white/5 border border-white/10 outline-none"
                    disabled={withdrawing}
                  />
                </div>
                <div>
                  <p className="text-white/40 text-xs mb-1.5">Amount (min ₹{MIN_WITHDRAWAL})</p>
                  <input
                    type="number"
                    value={withdrawAmount}
                    onChange={e => { setWithdrawAmount(e.target.value); setWithdrawError(""); }}
                    placeholder={`₹${MIN_WITHDRAWAL} – ₹${walletBalance}`}
                    min={MIN_WITHDRAWAL}
                    max={walletBalance}
                    className="w-full px-3 py-2.5 rounded-xl text-sm text-white placeholder-white/25 bg-white/5 border border-white/10 outline-none"
                    disabled={withdrawing}
                  />
                </div>

                {withdrawError && (
                  <p className="text-red-400 text-xs px-1">{withdrawError}</p>
                )}

                <motion.button
                  onClick={handleWithdraw}
                  disabled={withdrawing || !upiId.trim() || !withdrawAmount}
                  whileTap={{ scale: 0.97 }}
                  className="w-full py-3 rounded-xl font-black text-sm text-black"
                  style={{
                    background: withdrawing || !upiId.trim() || !withdrawAmount
                      ? "var(--app-surface-2)"
                      : "linear-gradient(135deg, #f59e0b, #d97706)",
                    color: withdrawing || !upiId.trim() || !withdrawAmount ? "rgba(255,255,255,0.25)" : "#000",
                    boxShadow: withdrawing || !upiId.trim() || !withdrawAmount ? "none" : "0 4px 20px rgba(245,158,11,0.35)",
                  }}>
                  {withdrawing ? "Processing…" : "Request Withdrawal"}
                </motion.button>

                <p className="text-white/25 text-xs text-center">Processed within 2–3 business days via UPI</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Withdrawal success */}
        {withdrawMsg && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
            className="mb-4 px-4 py-3 rounded-xl text-sm text-center text-emerald-400"
            style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)" }}>
            {withdrawMsg}
          </motion.div>
        )}

        {/* Withdrawal history */}
        {withdrawHistory.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            className="mb-6 rounded-2xl p-5"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <p className="text-white/60 text-xs font-bold mb-3">📋 Withdrawal History</p>
            <div className="flex flex-col gap-2.5">
              {historyLoading ? (
                <p className="text-white/30 text-xs text-center py-2">Loading…</p>
              ) : withdrawHistory.map((req) => (
                <div key={req.id} className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-white/70 text-xs font-semibold">₹{req.amount}</p>
                    <p className="text-white/30 text-xs truncate">{req.upiId}</p>
                    <p className="text-white/20 text-xs">{new Date(req.requestedAt).toLocaleDateString("en-IN")}</p>
                  </div>
                  {statusBadge(req.status)}
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* My referral code */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="mb-6 rounded-2xl p-5"
          style={{ background: "var(--app-surface)", border: "1px solid rgba(255,255,255,0.08)" }}>
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
                <p className="text-white/40 text-xs">₹5 when friend buys ₹199 or ₹399 plan</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0"
                style={{ background: "rgba(59,130,246,0.15)", color: "#3b82f6" }}>📚</span>
              <div>
                <p className="text-white/80 text-sm font-semibold">Class 10 / 12 Referral</p>
                <p className="text-white/40 text-xs">₹10 when friend buys ₹199 or ₹399 plan</p>
              </div>
            </div>
            <div className="flex items-center gap-3 pt-1 mt-1 border-t border-white/5">
              <span className="w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0"
                style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b" }}>💸</span>
              <div>
                <p className="text-white/80 text-sm font-semibold">Withdraw via UPI</p>
                <p className="text-white/40 text-xs">Min ₹{MIN_WITHDRAWAL} · Processed in 2–3 days</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Apply a code */}
        {!referredBy && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            className="mb-6 rounded-2xl p-5"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <p className="text-white/70 font-bold text-xs mb-1">Have a referral code?</p>
            <p className="text-white/30 text-xs mb-3">Your referrer earns a reward when you buy a ₹199 or ₹399 plan.</p>
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
            <p className="text-white/30 text-xs mt-1">Your referrer earns ₹5–₹10 when you buy a ₹199 or ₹399 plan.</p>
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
