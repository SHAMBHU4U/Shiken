import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { auth } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { useSubscription } from "../hooks/useSubscription";

const DB_URL = "https://shiken-d8789-default-rtdb.firebaseio.com";
const UPI_ID = "8340472013@ptyes";

const PLANS = [
  {
    id: "monthly",
    name: "Basic Monthly",
    price: "₹49",
    days: 30,
    period: "30 days",
    perMonth: "₹49/माह",
    tag: null,
    accent: "#8b5cf6",
    features: ["Mini Test (unlimited)", "Full 50-question tests", "Chapter-wise tests", "AI Smart Tests", "AI test analysis"],
  },
  {
    id: "biannual",
    name: "Topper's Choice",
    price: "₹199",
    days: 180,
    period: "6 months",
    perMonth: "सिर्फ ₹33/माह",
    tag: "🏆 Best Value",
    accent: "#f59e0b",
    features: ["सब कुछ Basic में +", "Board exams तक access", "Direct mentor sessions", "Priority support", "AI mentorship"],
  },
];

export default function PricingPage() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { isPremium } = useSubscription();
  const [selectedPlan, setSelectedPlan] = useState<typeof PLANS[0] | null>(null);
  const [copied, setCopied] = useState(false);
  const [activating, setActivating] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleActivate() {
    if (!auth.currentUser || !selectedPlan) return;
    setActivating(true);
    try {
      const uid = auth.currentUser.uid;
      const premiumUntil = Date.now() + selectedPlan.days * 86400000;
      await fetch(`${DB_URL}/users/${uid}.json`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscriptionType: "premium",
          premiumUntil,
          plan: selectedPlan.id,
          activatedAt: Date.now(),
        }),
      });
      setSuccess(true);
    } catch { /* ignore */ }
    finally { setActivating(false); }
  }

  function copyUPI() {
    navigator.clipboard.writeText(UPI_ID).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (success) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 pb-28" style={{ background: "#07080f" }}>
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", damping: 18, stiffness: 260 }}
          className="text-center"
        >
          <motion.div
            animate={{ rotate: [0, -10, 10, -5, 5, 0], scale: [1, 1.2, 1.2, 1] }}
            transition={{ duration: 1.2, delay: 0.2 }}
            className="text-7xl mb-5 block"
          >👑</motion.div>
          <h2 className="text-white font-black text-3xl mb-2">Premium Active!</h2>
          <p className="text-white/50 text-sm mb-2">
            {selectedPlan?.period} का Premium अब activate हो गया।
          </p>
          <p className="text-white/30 text-xs mb-8">
            अगर payment verify नहीं हुई, 24 घंटे में Admin review करेगा।
          </p>
          <motion.button
            onClick={() => navigate("/")}
            whileTap={{ scale: 0.96 }}
            className="px-8 py-3.5 rounded-2xl font-black text-black"
            style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)", boxShadow: "0 6px 32px rgba(251,191,36,0.4)" }}
          >
            Start Learning 🚀
          </motion.button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full pb-32 relative overflow-hidden" style={{ background: "#07080f" }}>
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full blur-3xl opacity-15"
          style={{ background: "radial-gradient(circle, #f59e0b, transparent)" }} />
        <div className="absolute -bottom-24 -right-24 w-72 h-72 rounded-full blur-3xl opacity-8"
          style={{ background: "radial-gradient(circle, #8b5cf6, transparent)" }} />
      </div>

      <div className="relative z-10 max-w-lg mx-auto px-4 pt-14">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-8"
        >
          <button onClick={() => navigate(-1 as never)}
            className="absolute left-4 top-4 w-9 h-9 rounded-xl flex items-center justify-center text-white/40 hover:text-white/80 transition-colors"
            style={{ background: "rgba(255,255,255,0.06)" }}>
            ←
          </button>
          <motion.div
            animate={{ rotate: [0, -8, 8, -4, 4, 0] }}
            transition={{ duration: 2, repeat: Infinity, repeatDelay: 4 }}
            className="text-4xl mb-3"
          >👑</motion.div>
          <h1 className="text-white font-black text-2xl mb-1">SHIKEN Premium</h1>
          <p className="text-white/40 text-sm">Board exams तक unlimited access चाहिए?</p>
        </motion.div>

        {isPremium && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="mb-6 rounded-2xl p-4 text-center"
            style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)" }}>
            <p className="text-emerald-400 font-bold text-sm">✓ आप पहले से Premium Member हैं!</p>
          </motion.div>
        )}

        {/* Plan cards */}
        <div className="flex flex-col gap-4 mb-6">
          {PLANS.map((plan, i) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.08 }}
              onClick={() => setSelectedPlan(plan)}
              className="rounded-2xl p-5 cursor-pointer transition-all"
              style={{
                background: selectedPlan?.id === plan.id
                  ? `linear-gradient(135deg, ${plan.accent}20, ${plan.accent}08)`
                  : "rgba(255,255,255,0.04)",
                border: selectedPlan?.id === plan.id
                  ? `2px solid ${plan.accent}60`
                  : "1px solid rgba(255,255,255,0.08)",
                boxShadow: selectedPlan?.id === plan.id
                  ? `0 0 32px ${plan.accent}20`
                  : "none",
              }}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-white font-black text-base">{plan.name}</p>
                    {plan.tag && (
                      <span className="text-xs font-black px-2 py-0.5 rounded-full"
                        style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)", color: "#000" }}>
                        {plan.tag}
                      </span>
                    )}
                  </div>
                  <p className="text-white/40 text-xs">{plan.period} · {plan.perMonth}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-black text-2xl" style={{ color: plan.accent }}>{plan.price}</p>
                  {selectedPlan?.id === plan.id && (
                    <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}
                      className="text-xs font-bold" style={{ color: plan.accent }}>✓ Selected</motion.span>
                  )}
                </div>
              </div>
              <ul className="flex flex-col gap-1.5">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-xs text-white/60">
                    <span className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 text-xs"
                      style={{ background: `${plan.accent}20`, color: plan.accent }}>✓</span>
                    {f}
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>

        {/* Pay via UPI section */}
        <AnimatePresence>
          {selectedPlan && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
              className="rounded-2xl p-5 mb-4"
              style={{
                background: "linear-gradient(135deg, rgba(251,191,36,0.08), rgba(245,158,11,0.04))",
                border: "1px solid rgba(251,191,36,0.3)",
              }}
            >
              <p className="text-white/70 text-xs font-black uppercase tracking-widest mb-3">💳 UPI से Payment करो</p>

              {/* UPI ID display */}
              <div className="flex items-center gap-3 mb-4 px-4 py-3 rounded-xl"
                style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(251,191,36,0.25)" }}>
                <div className="flex-1 min-w-0">
                  <p className="text-white/40 text-xs mb-0.5">UPI ID</p>
                  <p className="text-white font-black text-base font-mono tracking-wide">{UPI_ID}</p>
                </div>
                <motion.button
                  onClick={copyUPI}
                  whileTap={{ scale: 0.92 }}
                  className="shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
                  style={copied
                    ? { background: "rgba(16,185,129,0.2)", color: "#10b981", border: "1px solid rgba(16,185,129,0.3)" }
                    : { background: "rgba(251,191,36,0.15)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.3)" }}
                >
                  {copied ? "✓ Copied!" : "Copy"}
                </motion.button>
              </div>

              <div className="flex items-center gap-2 mb-4 text-xs text-white/40">
                <div className="flex-1 h-px bg-white/10" />
                <span>Amount: <strong className="text-white">{selectedPlan.price}</strong> · {selectedPlan.period}</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>

              <p className="text-white/40 text-xs mb-4 text-center">
                PhonePe / GPay / Paytm से UPI ID पर {selectedPlan.price} भेजो, फिर नीचे बटन दबाओ।
              </p>

              {!user ? (
                <motion.button
                  onClick={() => navigate("/profile")}
                  whileTap={{ scale: 0.96 }}
                  className="w-full py-4 rounded-2xl font-black text-sm text-black"
                  style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)", boxShadow: "0 6px 32px rgba(251,191,36,0.35)" }}
                >
                  Sign in to Activate →
                </motion.button>
              ) : (
                <motion.button
                  onClick={handleActivate}
                  disabled={activating}
                  whileTap={{ scale: 0.96 }}
                  className="w-full py-4 rounded-2xl font-black text-sm text-black flex items-center justify-center gap-2"
                  style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)", boxShadow: "0 6px 32px rgba(251,191,36,0.35)", opacity: activating ? 0.7 : 1 }}
                >
                  {activating ? (
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                      className="w-4 h-4 rounded-full border-2 border-black/30" style={{ borderTopColor: "#000" }} />
                  ) : (
                    <>✅ मैंने payment कर दी — Premium Activate करो</>
                  )}
                </motion.button>
              )}
              <p className="text-white/20 text-xs text-center mt-2">
                Payment verify होने तक 24 घंटे लग सकते हैं।
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Feature comparison footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-center text-white/20 text-xs pb-4"
        >
          Questions? WhatsApp: <a href="https://wa.me/918340472013" className="text-white/40 underline">8340472013</a>
        </motion.div>
      </div>
    </div>
  );
}
