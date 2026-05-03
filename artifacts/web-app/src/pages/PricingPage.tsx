import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { auth } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { useSubscription } from "../hooks/useSubscription";

const DB_URL = "https://shiken-d8789-default-rtdb.firebaseio.com";
const API_BASE = import.meta.env.BASE_URL;

// UPI deep-link — ID is never rendered in the DOM
function buildUpiLink(amount: number, note: string) {
  const p = new URLSearchParams({
    pa: atob("ODM0MDQ3MjAxM0BwdHllcw=="),
    pn: "SHIKEN",
    am: String(amount),
    cu: "INR",
    tn: note,
  });
  return `upi://pay?${p.toString()}`;
}

const PLANS = [
  {
    id: "monthly",
    name: "Basic Monthly",
    price: "₹49",
    amount: 49,
    days: 30,
    period: "30 days",
    perMonth: "₹49/माह",
    tag: null as string | null,
    accent: "#8b5cf6",
    emoji: "📅",
    features: [
      "Mini Test (unlimited)",
      "Full 50-question tests",
      "Chapter-wise tests",
      "AI Smart Tests",
      "AI test analysis",
    ],
  },
  {
    id: "biannual",
    name: "Topper's Choice",
    price: "₹199",
    amount: 199,
    days: 180,
    period: "6 months",
    perMonth: "सिर्फ ₹33/माह",
    tag: "🏆 Best Value",
    accent: "#f59e0b",
    emoji: "🚀",
    features: [
      "सब कुछ Basic में +",
      "Board exams तक access",
      "Direct mentor sessions",
      "Priority support",
      "AI mentorship",
    ],
  },
];

type Plan = typeof PLANS[0];

const ADMIN_WA = "918340472013";

function buildAdminWaLink(uid: string, plan: Plan) {
  const msg = `Namaste! 🙏 Maine SHIKEN ${plan.name} (${plan.price}) ke liye UPI payment kar diya hai.\n\nMera User ID: ${uid}\n\nPlease verify karke premium activate kar dijiye. Dhanyawad! 🙏`;
  return `https://wa.me/${ADMIN_WA}?text=${encodeURIComponent(msg)}`;
}

// ─── Payment bottom-sheet modal ────────────────────────────────────────────────
function PaymentSheet({
  plan,
  onClose,
  onSuccess,
}: {
  plan: Plan;
  onClose: () => void;
  onSuccess: (uid: string) => void;
}) {
  const { user } = useAuth();
  const [step, setStep] = useState<"pay" | "confirm" | "activating">("pay");
  const [activating, setActivating] = useState(false);
  const upiLink = buildUpiLink(plan.amount, `SHIKEN ${plan.name}`);

  async function handleActivate() {
    if (!auth.currentUser) return;
    setStep("activating");
    setActivating(true);
    try {
      const uid = auth.currentUser.uid;
      const message = `New premium request:\nUser ID: ${uid}\nPlan: ${plan.name}\nAmount: ${plan.price}\nAction: verify in admin panel`;
      await fetch(`${DB_URL}/users/${uid}.json`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscriptionType: "premium",
          premiumUntil: Date.now() + plan.days * 86400000,
          plan: plan.id,
          activatedAt: Date.now(),
          requestedAt: Date.now(),
          paymentVerified: false,
        }),
      });
      await fetch(`${API_BASE}api/notify-whatsapp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      onSuccess(uid);
    } catch { /* ignore */ }
    finally { setActivating(false); }
  }

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm"
      />

      {/* Sheet */}
      <motion.div
        initial={{ y: "100%", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0 }}
        transition={{ type: "spring", damping: 30, stiffness: 340 }}
        className="fixed inset-x-0 bottom-0 z-50 max-w-lg mx-auto rounded-t-3xl px-5 pt-4 pb-10"
        style={{
          background: "linear-gradient(170deg, #12101f 0%, #0a0915 100%)",
          border: `1px solid ${plan.accent}40`,
          borderBottom: "none",
          boxShadow: `0 -16px 64px ${plan.accent}25`,
        }}
      >
        {/* Pull handle */}
        <div className="w-10 h-1 rounded-full bg-white/15 mx-auto mb-5" />

        {/* Plan summary */}
        <div className="flex items-center gap-3 mb-5 px-4 py-3 rounded-2xl"
          style={{ background: `${plan.accent}12`, border: `1px solid ${plan.accent}30` }}>
          <span className="text-3xl">{plan.emoji}</span>
          <div className="flex-1 min-w-0">
            <p className="text-white font-black text-base leading-tight">{plan.name}</p>
            <p className="text-white/40 text-xs">{plan.period} · {plan.perMonth}</p>
          </div>
          <p className="font-black text-2xl shrink-0" style={{ color: plan.accent }}>{plan.price}</p>
        </div>

        <AnimatePresence mode="wait">
          {step === "pay" && (
            <motion.div key="pay" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <p className="text-white/40 text-xs text-center mb-4">
                नीचे button दबाओ — आपका UPI app खुलेगा (PhonePe / GPay / Paytm)
              </p>

              {/* UPI apps row */}
              <div className="flex justify-center gap-4 mb-5">
                {["📱 PhonePe", "🟡 GPay", "📲 Paytm"].map(app => (
                  <div key={app} className="text-xs text-white/25 flex flex-col items-center gap-1">
                    <span className="text-xl">{app.split(" ")[0]}</span>
                    <span>{app.split(" ")[1]}</span>
                  </div>
                ))}
              </div>

              <motion.a
                href={upiLink}
                onClick={() => setTimeout(() => setStep("confirm"), 1800)}
                whileTap={{ scale: 0.97 }}
                className="flex items-center justify-center gap-2.5 w-full py-4 rounded-2xl font-black text-base mb-3"
                style={{
                  background: `linear-gradient(135deg, ${plan.accent}, ${plan.id === "monthly" ? "#6366f1" : "#d97706"})`,
                  color: "#000",
                  boxShadow: `0 6px 32px ${plan.accent}50`,
                }}
              >
                <span className="text-xl">💳</span>
                Pay {plan.price} via UPI →
              </motion.a>

              <button
                onClick={() => setStep("confirm")}
                className="w-full py-2 text-white/25 text-xs hover:text-white/50 transition-colors"
              >
                Already paid? Confirm here
              </button>
            </motion.div>
          )}

          {step === "confirm" && (
            <motion.div key="confirm" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className="text-center mb-5">
                <motion.div
                  animate={{ scale: [1, 1.15, 1] }}
                  transition={{ duration: 0.6, repeat: 2 }}
                  className="text-4xl mb-2"
                >✅</motion.div>
                <p className="text-white font-bold text-sm">Payment हो गई?</p>
                <p className="text-white/35 text-xs mt-1">
                  Confirm करो — premium तुरंत activate होगा।
                </p>
              </div>

              {!user ? (
                <a href="/profile"
                  className="flex items-center justify-center w-full py-4 rounded-2xl font-black text-sm text-black"
                  style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)", boxShadow: "0 6px 28px rgba(251,191,36,0.4)" }}>
                  Sign in to Activate →
                </a>
              ) : (
                <motion.button
                  onClick={handleActivate}
                  disabled={activating}
                  whileTap={{ scale: 0.97 }}
                  className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl font-black text-sm text-black"
                  style={{
                    background: "linear-gradient(135deg, #10b981, #059669)",
                    boxShadow: "0 6px 28px rgba(16,185,129,0.4)",
                    opacity: activating ? 0.7 : 1,
                  }}
                >
                  {activating
                    ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                        className="w-4 h-4 rounded-full border-2 border-black/30" style={{ borderTopColor: "#000" }} />
                    : <>👑 हाँ, payment हो गई — Activate करो</>}
                </motion.button>
              )}

              <button
                onClick={() => setStep("pay")}
                className="mt-3 w-full py-2 text-white/25 text-xs hover:text-white/50 transition-colors"
              >
                ← वापस जाओ
              </button>
            </motion.div>
          )}

          {step === "activating" && (
            <motion.div key="activating" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-4">
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
                className="w-10 h-10 rounded-full border-3 mx-auto mb-3"
                style={{ border: `3px solid ${plan.accent}30`, borderTopColor: plan.accent }} />
              <p className="text-white/50 text-sm">Submitting payment request…</p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </>
  );
}

// ─── Main Pricing Page ─────────────────────────────────────────────────────────
export default function PricingPage() {
  const [, navigate] = useLocation();
  const { isPremium } = useSubscription();
  const [payPlan, setPayPlan] = useState<Plan | null>(null);
  const [success, setSuccess] = useState<{ plan: Plan; uid: string } | null>(null);

  if (success) {
    const waLink = buildAdminWaLink(success.uid, success.plan);
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 pb-28" style={{ background: "#07080f" }}>
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", damping: 18, stiffness: 260 }}
          className="text-center max-w-xs mx-auto"
        >
          <motion.div
            animate={{ rotate: [0, -10, 10, -5, 5, 0], scale: [1, 1.2, 1.2, 1] }}
            transition={{ duration: 1.2, delay: 0.2 }}
            className="text-7xl mb-4 block"
          >👑</motion.div>
          <h2 className="text-white font-black text-3xl mb-2">Premium Active!</h2>
          <p className="text-white/50 text-sm mb-6 leading-relaxed">
            {success.plan.period} का Premium अब activate हो गया।<br/>
            <span className="text-white/30 text-xs">All premium features unlocked 🎉</span>
          </p>

          {/* Optional: notify admin */}
          <div className="rounded-2xl p-4 mb-5 text-left"
            style={{ background: "rgba(34,197,94,0.07)", border: "1px solid rgba(34,197,94,0.2)" }}>
            <p className="text-emerald-400 font-black text-xs mb-1.5">📩 Admin को Payment बताओ</p>
            <p className="text-white/40 text-xs mb-3 leading-relaxed">
              Admin को UPI screenshot / reference भेजो ताकि वो payment confirm कर सकें।
            </p>
            <motion.a
              href={waLink}
              target="_blank"
              rel="noreferrer"
              whileTap={{ scale: 0.97 }}
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl font-bold text-sm"
              style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.3)" }}
            >
              💬 WhatsApp Admin
            </motion.a>
          </div>

          <motion.button
            onClick={() => navigate("/")}
            whileTap={{ scale: 0.96 }}
            className="w-full py-4 rounded-2xl font-black text-base text-black"
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
      {/* Background glows */}
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
        <div className="flex flex-col gap-4 mb-8">
          {PLANS.map((plan, i) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.08 }}
              className="rounded-2xl p-5 cursor-pointer"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <div className="flex items-start justify-between mb-4">
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
                <p className="font-black text-2xl shrink-0" style={{ color: plan.accent }}>{plan.price}</p>
              </div>

              <ul className="flex flex-col gap-1.5 mb-4">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-xs text-white/60">
                    <span className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 text-xs"
                      style={{ background: `${plan.accent}20`, color: plan.accent }}>✓</span>
                    {f}
                  </li>
                ))}
              </ul>

              <motion.button
                onClick={() => setPayPlan(plan)}
                whileTap={{ scale: 0.97 }}
                className="w-full py-3 rounded-xl font-black text-sm"
                style={{
                  background: `linear-gradient(135deg, ${plan.accent}, ${plan.id === "monthly" ? "#6366f1" : "#d97706"})`,
                  color: "#000",
                  boxShadow: `0 4px 20px ${plan.accent}40`,
                }}
              >
                💳 {plan.price} में Subscribe करो
              </motion.button>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-center text-white/20 text-xs pb-4"
        >
          Questions? <a href="https://wa.me/918340472013" className="text-white/40 underline">WhatsApp करो</a>
        </motion.div>
      </div>

      {/* Payment sheet portal */}
      <AnimatePresence>
        {payPlan && (
          <PaymentSheet
            plan={payPlan}
            onClose={() => setPayPlan(null)}
            onSuccess={(uid) => { setSuccess({ plan: payPlan, uid }); setPayPlan(null); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
