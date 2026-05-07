import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { auth } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { useSubscription } from "../hooks/useSubscription";

const DB_URL = "https://shiken-d8789-default-rtdb.firebaseio.com";
const API_BASE = import.meta.env.BASE_URL;
const RAZORPAY_KEY = "rzp_live_SmHIAPIgMMiDhq";

declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  image?: string;
  order_id?: string;
  prefill?: { name?: string; email?: string; contact?: string };
  theme?: { color?: string };
  modal?: { ondismiss?: () => void };
  handler: (response: RazorpayResponse) => void;
}

interface RazorpayResponse {
  razorpay_payment_id: string;
  razorpay_order_id?: string;
  razorpay_signature?: string;
}

interface RazorpayInstance {
  open(): void;
  on(event: string, handler: () => void): void;
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
      "📖 गद्यांश Comprehension (Hindi, English, Sanskrit)",
      "Board exams तक access",
      "Direct mentor sessions",
      "Priority support",
      "AI mentorship",
    ],
  },
];

type Plan = (typeof PLANS)[0];

const ADMIN_WA = "918340472013";

function buildAdminWaLink(uid: string, plan: Plan, paymentId: string) {
  const msg = `Namaste! 🙏 Maine SHIKEN ${plan.name} (${plan.price}) ke liye Razorpay payment kar diya hai.\n\nMera User ID: ${uid}\nPayment ID: ${paymentId}\n\nPlease verify karke premium activate kar dijiye. Dhanyawad! 🙏`;
  return `https://wa.me/${ADMIN_WA}?text=${encodeURIComponent(msg)}`;
}

function PaymentSheet({
  plan,
  onClose,
  onSuccess,
}: {
  plan: Plan;
  onClose: () => void;
  onSuccess: (uid: string, paymentId: string) => void;
}) {
  const { user } = useAuth();
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");

  async function handleActivate() {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;
    const safeId = uid.replace(/[.#$/[\]]/g, "_");

    if (!window.Razorpay) {
      setError("Razorpay failed to load. Please refresh and try again.");
      return;
    }

    setPaying(true);
    setError("");

    const options: RazorpayOptions = {
      key: RAZORPAY_KEY,
      amount: plan.amount * 100,
      currency: "INR",
      name: "SHIKEN",
      description: `${plan.name} — ${plan.period}`,
      prefill: {
        email: auth.currentUser.email ?? undefined,
        name: auth.currentUser.displayName ?? undefined,
      },
      theme: { color: plan.accent },
      modal: {
        ondismiss: () => {
          setPaying(false);
        },
      },
      handler: async (response: RazorpayResponse) => {
        try {
          const paymentId = response.razorpay_payment_id;

          await fetch(`${DB_URL}/users/${safeId}.json`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              subscriptionType: "premium",
              premiumUntil: Date.now() + plan.days * 86400000,
              plan: plan.id,
              activatedAt: Date.now(),
              paymentVerified: true,
              razorpayPaymentId: paymentId,
            }),
          });

          const phoneRes = await fetch(`${DB_URL}/users/${safeId}/phone.json`);
          const phone: string | null = await phoneRes.json();
          const verifyLink = `${window.location.origin}/admin?tab=payments`;

          const lines = [
            `💳 New Premium Payment (Razorpay)!`,
            ``,
            `👤 UID: ${uid}`,
            `📱 Phone: ${phone ?? "not saved"}`,
            `📦 Plan: ${plan.name}`,
            `💰 Amount: ${plan.price}`,
            `🔑 Payment ID: ${paymentId}`,
            ``,
            `✅ Verify now: ${verifyLink}`,
          ];

          await fetch(`${API_BASE}api/notify-whatsapp`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: lines.join("\n") }),
          });

          onSuccess(uid, paymentId);
        } catch {
          setError("Payment succeeded but activation failed. Contact support with your payment ID.");
        } finally {
          setPaying(false);
        }
      },
    };

    const rzp = new window.Razorpay(options);
    rzp.on("payment.failed", () => {
      setError("Payment failed. Please try again.");
      setPaying(false);
    });
    rzp.open();
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm"
      />

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
        <div className="w-10 h-1 rounded-full bg-white/15 mx-auto mb-5" />

        <div
          className="flex items-center gap-3 mb-5 px-4 py-3 rounded-2xl"
          style={{ background: `${plan.accent}12`, border: `1px solid ${plan.accent}30` }}
        >
          <span className="text-3xl">{plan.emoji}</span>
          <div className="flex-1 min-w-0">
            <p className="text-white font-black text-base leading-tight">{plan.name}</p>
            <p className="text-white/40 text-xs">{plan.period} · {plan.perMonth}</p>
          </div>
          <p className="font-black text-2xl shrink-0" style={{ color: plan.accent }}>{plan.price}</p>
        </div>

        <p className="text-white/40 text-xs text-center mb-5">
          Secure payment powered by Razorpay · UPI, Card, Net Banking supported
        </p>

        <div className="flex justify-center gap-5 mb-6">
          {["💳 Card", "📱 UPI", "🏦 Net Banking"].map((m) => (
            <div key={m} className="text-xs text-white/30 flex flex-col items-center gap-1">
              <span className="text-lg">{m.split(" ")[0]}</span>
              <span>{m.split(" ").slice(1).join(" ")}</span>
            </div>
          ))}
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 px-4 py-3 rounded-xl text-sm text-red-400 text-center"
            style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}
          >
            {error}
          </motion.div>
        )}

        {!user ? (
          <a
            href="/profile"
            className="flex items-center justify-center w-full py-4 rounded-2xl font-black text-sm text-black"
            style={{
              background: "linear-gradient(135deg, #f59e0b, #d97706)",
              boxShadow: "0 6px 28px rgba(251,191,36,0.4)",
            }}
          >
            Sign in to Pay →
          </a>
        ) : (
          <motion.button
            onClick={handleActivate}
            disabled={paying}
            whileTap={{ scale: paying ? 1 : 0.97 }}
            className="flex items-center justify-center gap-2.5 w-full py-4 rounded-2xl font-black text-base mb-3"
            style={{
              background: paying
                ? "rgba(139,92,246,0.3)"
                : `linear-gradient(135deg, ${plan.accent}, ${plan.id === "monthly" ? "#6366f1" : "#d97706"})`,
              color: paying ? "#fff" : "#000",
              boxShadow: paying ? "none" : `0 6px 32px ${plan.accent}50`,
              opacity: paying ? 0.8 : 1,
            }}
          >
            {paying ? (
              <>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                  className="w-4 h-4 rounded-full border-2 border-white/30"
                  style={{ borderTopColor: "#fff" }}
                />
                Opening Payment…
              </>
            ) : (
              <>
                <span className="text-lg">💳</span>
                Pay {plan.price} Securely
              </>
            )}
          </motion.button>
        )}

        <p className="text-center text-white/20 text-xs mt-3">
          🔒 100% secure · Razorpay PCI-DSS certified
        </p>
      </motion.div>
    </>
  );
}

export default function PricingPage() {
  const [, navigate] = useLocation();
  const { isPremium } = useSubscription();
  const [payPlan, setPayPlan] = useState<Plan | null>(null);
  const [success, setSuccess] = useState<{ plan: Plan; uid: string; paymentId: string } | null>(null);

  if (success) {
    const waLink = buildAdminWaLink(success.uid, success.plan, success.paymentId);
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center px-6 pb-28"
        style={{ background: "#07080f" }}
      >
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
          >
            👑
          </motion.div>
          <h2 className="text-white font-black text-3xl mb-2">Premium Active!</h2>
          <p className="text-white/50 text-sm mb-2 leading-relaxed">
            {success.plan.period} का Premium अब activate हो गया।
            <br />
            <span className="text-white/30 text-xs">All premium features unlocked 🎉</span>
          </p>
          <p className="text-white/25 text-xs mb-6 font-mono">
            Payment ID: {success.paymentId}
          </p>

          <div
            className="rounded-2xl p-4 mb-5 text-left"
            style={{ background: "rgba(34,197,94,0.07)", border: "1px solid rgba(34,197,94,0.2)" }}
          >
            <p className="text-emerald-400 font-black text-xs mb-1.5">📩 Admin को Payment बताओ</p>
            <p className="text-white/40 text-xs mb-3 leading-relaxed">
              Payment ID के साथ WhatsApp पर admin को message करो।
            </p>
            <motion.a
              href={waLink}
              target="_blank"
              rel="noreferrer"
              whileTap={{ scale: 0.97 }}
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl font-bold text-sm"
              style={{
                background: "rgba(34,197,94,0.15)",
                color: "#22c55e",
                border: "1px solid rgba(34,197,94,0.3)",
              }}
            >
              💬 WhatsApp Admin
            </motion.a>
          </div>

          <motion.button
            onClick={() => navigate("/")}
            whileTap={{ scale: 0.96 }}
            className="w-full py-4 rounded-2xl font-black text-base text-black"
            style={{
              background: "linear-gradient(135deg, #f59e0b, #d97706)",
              boxShadow: "0 6px 32px rgba(251,191,36,0.4)",
            }}
          >
            Start Learning 🚀
          </motion.button>
        </motion.div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen w-full pb-32 relative overflow-hidden"
      style={{ background: "#07080f" }}
    >
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute -top-40 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full blur-3xl opacity-15"
          style={{ background: "radial-gradient(circle, #f59e0b, transparent)" }}
        />
        <div
          className="absolute -bottom-24 -right-24 w-72 h-72 rounded-full blur-3xl opacity-8"
          style={{ background: "radial-gradient(circle, #8b5cf6, transparent)" }}
        />
      </div>

      <div className="relative z-10 max-w-lg mx-auto px-4 pt-14">
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-8"
        >
          <button
            onClick={() => navigate(-1 as never)}
            className="absolute left-4 top-4 w-9 h-9 rounded-xl flex items-center justify-center text-white/40 hover:text-white/80 transition-colors"
            style={{ background: "rgba(255,255,255,0.06)" }}
          >
            ←
          </button>
          <motion.div
            animate={{ rotate: [0, -8, 8, -4, 4, 0] }}
            transition={{ duration: 2, repeat: Infinity, repeatDelay: 4 }}
            className="text-4xl mb-3"
          >
            👑
          </motion.div>
          <h1 className="text-white font-black text-2xl mb-1">SHIKEN Premium</h1>
          <p className="text-white/40 text-sm">Board exams तक unlimited access चाहिए?</p>
        </motion.div>

        {isPremium && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-6 rounded-2xl p-4 text-center"
            style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)" }}
          >
            <p className="text-emerald-400 font-bold text-sm">✓ आप पहले से Premium Member हैं!</p>
          </motion.div>
        )}

        <div className="flex flex-col gap-4 mb-8">
          {PLANS.map((plan, i) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.08 }}
              className="rounded-2xl p-5"
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
                      <span
                        className="text-xs font-black px-2 py-0.5 rounded-full"
                        style={{
                          background: "linear-gradient(135deg, #f59e0b, #d97706)",
                          color: "#000",
                        }}
                      >
                        {plan.tag}
                      </span>
                    )}
                  </div>
                  <p className="text-white/40 text-xs">{plan.period} · {plan.perMonth}</p>
                </div>
                <p className="font-black text-2xl shrink-0" style={{ color: plan.accent }}>
                  {plan.price}
                </p>
              </div>

              <ul className="flex flex-col gap-1.5 mb-4">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-xs text-white/60">
                    <span
                      className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 text-xs"
                      style={{ background: `${plan.accent}20`, color: plan.accent }}
                    >
                      ✓
                    </span>
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
          className="text-center space-y-2 pb-4"
        >
          <div className="flex items-center justify-center gap-3 text-white/20 text-xs">
            <span>🔒 Razorpay Secured</span>
            <span>·</span>
            <span>💳 Card / UPI / Net Banking</span>
          </div>
          <p className="text-white/20 text-xs">
            Questions?{" "}
            <a href="https://wa.me/918340472013" className="text-white/40 underline">
              WhatsApp करो
            </a>
          </p>
        </motion.div>
      </div>

      <AnimatePresence>
        {payPlan && (
          <PaymentSheet
            plan={payPlan}
            onClose={() => setPayPlan(null)}
            onSuccess={(uid, paymentId) => {
              setSuccess({ plan: payPlan, uid, paymentId });
              setPayPlan(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
