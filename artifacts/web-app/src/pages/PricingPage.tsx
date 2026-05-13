import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { auth } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { useSubscription } from "../hooks/useSubscription";

const API_BASE = import.meta.env.BASE_URL;
const RAZORPAY_KEY = "rzp_live_SmHIAPIgMMiDhq";

declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

interface RazorpayOptions {
  key: string; amount: number; currency: string; name: string;
  description: string; image?: string; order_id?: string;
  prefill?: { name?: string; email?: string; contact?: string };
  theme?: { color?: string }; modal?: { ondismiss?: () => void };
  handler: (response: RazorpayResponse) => void;
}
interface RazorpayResponse {
  razorpay_payment_id: string; razorpay_order_id?: string; razorpay_signature?: string;
}
interface RazorpayInstance { open(): void; on(event: string, handler: () => void): void; }

function normalizeErrorMessage(err: unknown, fallback: string): string {
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message || fallback;
  if (err && typeof err === "object") {
    const maybe = (err as { error?: unknown; message?: unknown }).error ?? (err as { message?: unknown }).message;
    if (typeof maybe === "string" && maybe.trim()) return maybe;
    try { return JSON.stringify(err); } catch { return fallback; }
  }
  return fallback;
}

const PLANS = [
  {
    id: "monthly_one",
    name: "Monthly — 1 Subject",
    price: "₹49",
    amount: 49,
    days: 30,
    period: "30 days",
    perMonth: "₹49/माह",
    tag: null as string | null,
    accent: "#8b5cf6",
    emoji: "📅",
    singleSubject: true,
    features: [
      "1 विषय unlimited Full Tests",
      "Chapter-wise practice tests",
      "AI questions + test analysis",
      "30 days access",
    ],
  },
  {
    id: "biannual_one",
    name: "6 Months — 1 Subject",
    price: "₹99",
    amount: 99,
    days: 180,
    period: "6 months",
    perMonth: "₹16.50/माह",
    tag: null as string | null,
    accent: "#10b981",
    emoji: "📆",
    singleSubject: true,
    features: [
      "1 विषय unlimited Full Tests",
      "Chapter-wise practice tests",
      "AI questions + test analysis",
      "6 months access",
    ],
  },
  {
    id: "biannual_all",
    name: "All Subjects — 6 Months",
    price: "₹199",
    amount: 199,
    days: 180,
    period: "6 months",
    perMonth: "₹33/माह",
    tag: "🏆 Best Value" as string | null,
    accent: "#f59e0b",
    emoji: "🚀",
    singleSubject: false,
    features: [
      "सभी विषय unlimited tests",
      "Chapter-wise + AI tests",
      "Full AI analysis",
      "Board exams तक access",
      "Priority counselling",
    ],
  },
];

const SUBJECT_OPTIONS = [
  { id: "maths",     label: "Maths / गणित" },
  { id: "science",   label: "Science / विज्ञान" },
  { id: "social",    label: "Social Science / सामाजिक" },
  { id: "hindi",     label: "Hindi / हिंदी" },
  { id: "english",   label: "English / अंग्रेज़ी" },
  { id: "sanskrit",  label: "Sanskrit / संस्कृत" },
  { id: "physics",   label: "Physics / भौतिकी" },
  { id: "chemistry", label: "Chemistry / रसायन" },
  { id: "biology",   label: "Biology / जीव विज्ञान" },
];

type Plan = (typeof PLANS)[0];

const ADMIN_WA = "918340472013";

function buildAdminWaLink(uid: string, plan: Plan, paymentId: string, subject?: string) {
  const subjectLine = subject ? `\nSubject: ${subject}` : "";
  const msg = `Namaste! 🙏 Maine SHIKEN ${plan.name} (${plan.price}) ke liye payment kar diya hai.\n\nUID: ${uid}${subjectLine}\nPayment ID: ${paymentId}\n\nPlease verify karke premium activate kar dijiye. Dhanyawad! 🙏`;
  return `https://wa.me/${ADMIN_WA}?text=${encodeURIComponent(msg)}`;
}

function PaymentSheet({
  plan,
  selectedSubject,
  onClose,
  onSuccess,
}: {
  plan: Plan;
  selectedSubject: string;
  onClose: () => void;
  onSuccess: (uid: string, paymentId: string) => void;
}) {
  const { user } = useAuth();
  const [paying, setPaying]             = useState(false);
  const [error, setError]               = useState("");
  const [couponInput, setCouponInput]   = useState("");
  const [couponChecking, setCouponChecking] = useState(false);
  const [couponResult, setCouponResult] = useState<{ applied: boolean; discount: number; finalAmount: number } | null>(null);
  const [couponError, setCouponError]   = useState("");

  async function handleCheckCoupon() {
    const code = couponInput.trim().toUpperCase();
    if (!code) return;
    setCouponChecking(true); setCouponError(""); setCouponResult(null);
    try {
      const res = await fetch(`${API_BASE}api/razorpay/validate-coupon`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ couponCode: code, amount: plan.amount }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setCouponError(data.error ?? "Invalid coupon code.");
      } else if (!data.couponApplied) {
        setCouponError("Coupon code not valid or expired.");
      } else {
        setCouponResult({ applied: true, discount: data.discount, finalAmount: data.finalAmount });
      }
    } catch {
      setCouponError("Could not verify coupon. Please try again.");
    } finally {
      setCouponChecking(false);
    }
  }

  async function handleActivate() {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;

    if (!window.Razorpay) {
      setError("Payment gateway failed to load. Please refresh and try again.");
      return;
    }

    setPaying(true);
    setError("");

    try {
      const orderRes = await fetch(`${API_BASE}api/razorpay/create-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: plan.amount, planId: plan.id, uid, couponCode: couponInput.trim() || undefined }),
      });
      const orderData = await orderRes.json();
      if (!orderRes.ok || !orderData.ok) {
        setError(normalizeErrorMessage(orderData, "Could not create order. Please try again."));
        setPaying(false);
        return;
      }

      const options: RazorpayOptions = {
        key:         RAZORPAY_KEY,
        amount:      orderData.amount * 100,
        currency:    "INR",
        name:        "SHIKEN",
        description: `${plan.name}${plan.singleSubject && selectedSubject ? " · " + selectedSubject : ""} — ${plan.period}`,
        order_id:    orderData.orderId,
        prefill: {
          email: auth.currentUser.email   ?? undefined,
          name:  auth.currentUser.displayName ?? undefined,
        },
        theme: { color: plan.accent },
        modal: { ondismiss: () => setPaying(false) },

        handler: async (response: RazorpayResponse) => {
          try {
            const verifyRes = await fetch(`${API_BASE}api/razorpay/verify-payment`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_order_id:   response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature:  response.razorpay_signature,
                uid,
                planId: plan.id,
                days:   plan.days,
                planSubject: plan.singleSubject ? selectedSubject : undefined,
              }),
            });
            const verifyData = await verifyRes.json();

            if (!verifyRes.ok || !verifyData.ok) {
              setError(verifyData.error ?? "Verification failed. Contact support with Payment ID: " + response.razorpay_payment_id);
              setPaying(false);
              return;
            }

            await fetch(`${API_BASE}api/notify-whatsapp`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                message: [
                  `✅ Payment Verified`,
                  `👤 UID: ${uid}`,
                  `📦 Plan: ${plan.name}`,
                  plan.singleSubject && selectedSubject ? `📚 Subject: ${selectedSubject}` : "",
                  `💰 Amount: ₹${orderData.amount}`,
                  `🔑 Payment ID: ${response.razorpay_payment_id}`,
                ].filter(Boolean).join("\n"),
              }),
            }).catch(() => {});

            onSuccess(uid, response.razorpay_payment_id);
          } catch {
            setError("Payment captured but activation failed. Contact support with Payment ID: " + response.razorpay_payment_id);
            setPaying(false);
          }
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", () => {
        setError("Payment failed. Please try again.");
        setPaying(false);
      });
      try {
        rzp.open();
      } catch {
        window.location.href = `https://api.razorpay.com/v1/checkout?` + new URLSearchParams({
          key: RAZORPAY_KEY,
          order_id: orderData.orderId,
          amount: String(orderData.amount * 100),
          currency: "INR",
          name: "SHIKEN",
          description: `${plan.name}${plan.singleSubject && selectedSubject ? " · " + selectedSubject : ""} — ${plan.period}`,
        }).toString();
      }
    } catch (err) {
      setError(normalizeErrorMessage(err, "Network error. Please check your connection and try again."));
      setPaying(false);
    }
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm"
      />
      <motion.div
        initial={{ y: "100%", opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0 }}
        transition={{ type: "spring", damping: 30, stiffness: 340 }}
        className="fixed inset-x-0 bottom-0 z-50 max-w-lg mx-auto rounded-t-3xl px-5 pt-4 pb-10"
        style={{
          background: "linear-gradient(170deg, #12101f 0%, #0a0915 100%)",
          border: `1px solid ${plan.accent}40`, borderBottom: "none",
          boxShadow: `0 -16px 64px ${plan.accent}25`,
        }}
      >
        <div className="w-10 h-1 rounded-full bg-white/15 mx-auto mb-5" />

        <div className="flex items-center gap-3 mb-4 px-4 py-3 rounded-2xl"
          style={{ background: `${plan.accent}12`, border: `1px solid ${plan.accent}30` }}>
          <span className="text-3xl">{plan.emoji}</span>
          <div className="flex-1 min-w-0">
            <p className="text-white font-black text-base leading-tight">{plan.name}</p>
            <p className="text-white/40 text-xs">{plan.period} · {plan.perMonth}</p>
          </div>
          <p className="font-black text-2xl shrink-0" style={{ color: plan.accent }}>{plan.price}</p>
        </div>

        {plan.singleSubject && selectedSubject && (
          <div className="mb-4 px-4 py-2.5 rounded-xl flex items-center gap-2"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)" }}>
            <span className="text-sm">📚</span>
            <span className="text-white/70 text-sm font-semibold">
              {SUBJECT_OPTIONS.find(s => s.id === selectedSubject)?.label ?? selectedSubject}
            </span>
          </div>
        )}

        {/* Coupon code input */}
        <div className="mb-4">
          <div className="flex gap-2">
            <input
              value={couponInput}
              onChange={e => { setCouponInput(e.target.value.toUpperCase()); setCouponResult(null); setCouponError(""); }}
              placeholder="Coupon code (optional)"
              className="flex-1 px-3 py-2.5 rounded-xl text-sm text-white placeholder-white/25 bg-white/5 border border-white/10 outline-none font-mono"
              disabled={paying}
              onKeyDown={e => e.key === "Enter" && handleCheckCoupon()}
            />
            <motion.button
              onClick={handleCheckCoupon}
              disabled={!couponInput.trim() || couponChecking || paying}
              whileTap={{ scale: 0.95 }}
              className="px-3 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0"
              style={{
                background: couponResult?.applied ? "rgba(16,185,129,0.15)" : "rgba(139,92,246,0.15)",
                color: couponResult?.applied ? "#10b981" : "#a78bfa",
                border: `1px solid ${couponResult?.applied ? "rgba(16,185,129,0.3)" : "rgba(139,92,246,0.3)"}`,
                opacity: !couponInput.trim() || paying ? 0.4 : 1,
              }}>
              {couponChecking ? "…" : couponResult?.applied ? "✓" : "Apply"}
            </motion.button>
          </div>
          {couponError && (
            <p className="text-red-400 text-xs mt-1.5 px-1">{couponError}</p>
          )}
          {couponResult?.applied && (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
              className="mt-2 px-3 py-2 rounded-xl flex items-center justify-between"
              style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)" }}>
              <span className="text-emerald-400 text-xs font-bold">🎉 Coupon applied! −₹{couponResult.discount} off</span>
              <span className="text-emerald-300 text-sm font-black">₹{couponResult.finalAmount}</span>
            </motion.div>
          )}
        </div>

        <p className="text-white/40 text-xs text-center mb-5">
          Secure payment powered by Razorpay · UPI, Card, Net Banking supported
        </p>

        {error && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
            className="mb-4 px-4 py-3 rounded-xl text-sm text-red-400 text-center"
            style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}>
            {error}
          </motion.div>
        )}

        {!user ? (
          <a href="/profile"
            className="flex items-center justify-center w-full py-4 rounded-2xl font-black text-sm text-black"
            style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)", boxShadow: "0 6px 28px rgba(251,191,36,0.4)" }}>
            Sign in to Pay →
          </a>
        ) : (
          <motion.button
            onClick={handleActivate} disabled={paying}
            whileTap={{ scale: paying ? 1 : 0.97 }}
            className="flex items-center justify-center gap-2.5 w-full py-4 rounded-2xl font-black text-base mb-3"
            style={{
              background: paying ? "rgba(139,92,246,0.3)" : `linear-gradient(135deg, ${plan.accent}, ${plan.id === "monthly_one" ? "#6366f1" : plan.id === "biannual_one" ? "#059669" : "#d97706"})`,
              color: paying ? "#fff" : "#000",
              boxShadow: paying ? "none" : `0 6px 32px ${plan.accent}50`,
              opacity: paying ? 0.8 : 1,
            }}
          >
            {paying ? (
              <>
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                  className="w-4 h-4 rounded-full border-2 border-white/30" style={{ borderTopColor: "#fff" }} />
                Opening Payment…
              </>
            ) : (
              <><span className="text-lg">💳</span> Pay {plan.price} Securely</>
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
  const { isPremium, premiumSubjects } = useSubscription();
  const [payPlan, setPayPlan] = useState<Plan | null>(null);
  const [subjectForPlan, setSubjectForPlan] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState<{ plan: Plan; uid: string; paymentId: string; subject?: string } | null>(null);

  function handlePayClick(plan: Plan) {
    if (plan.singleSubject && !subjectForPlan[plan.id]) return;
    setPayPlan(plan);
  }

  if (success) {
    const waLink = buildAdminWaLink(success.uid, success.plan, success.paymentId, success.subject);
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 pb-28" style={{ background: "#07080f" }}>
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", damping: 18, stiffness: 260 }}
          className="text-center max-w-xs mx-auto"
        >
          <motion.div animate={{ rotate: [0, -10, 10, -5, 5, 0], scale: [1, 1.2, 1.2, 1] }}
            transition={{ duration: 1.2, delay: 0.2 }} className="text-7xl mb-4 block">👑</motion.div>
          <h2 className="text-white font-black text-3xl mb-2">Premium Active!</h2>
          <p className="text-white/50 text-sm mb-2 leading-relaxed">
            {success.plan.period} का Premium अब activate हो गया।
            {success.subject && <><br /><span style={{ color: success.plan.accent }}>Subject: {success.subject}</span></>}
            <br /><span className="text-white/30 text-xs">All premium features unlocked 🎉</span>
          </p>
          <p className="text-white/25 text-xs mb-6 font-mono">Payment ID: {success.paymentId}</p>

          <div className="rounded-2xl p-4 mb-5 text-left"
            style={{ background: "rgba(34,197,94,0.07)", border: "1px solid rgba(34,197,94,0.2)" }}>
            <p className="text-emerald-400 font-black text-xs mb-1.5">📩 Admin को Payment बताओ</p>
            <p className="text-white/40 text-xs mb-3 leading-relaxed">
              Payment ID के साथ WhatsApp पर admin को message करो।
            </p>
            <motion.a href={waLink} target="_blank" rel="noreferrer" whileTap={{ scale: 0.97 }}
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl font-bold text-sm"
              style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.3)" }}>
              💬 WhatsApp Admin
            </motion.a>
          </div>

          <motion.button onClick={() => navigate("/")} whileTap={{ scale: 0.96 }}
            className="w-full py-4 rounded-2xl font-black text-base text-black"
            style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)", boxShadow: "0 6px 32px rgba(251,191,36,0.4)" }}>
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
        <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
          className="text-center mb-8">
          <button onClick={() => navigate(-1 as never)}
            className="absolute left-4 top-4 w-9 h-9 rounded-xl flex items-center justify-center text-white/40 hover:text-white/80 transition-colors"
            style={{ background: "rgba(255,255,255,0.06)" }}>←</button>
          <motion.div animate={{ rotate: [0, -8, 8, -4, 4, 0] }}
            transition={{ duration: 2, repeat: Infinity, repeatDelay: 4 }} className="text-4xl mb-3">👑</motion.div>
          <h1 className="text-white font-black text-2xl mb-1">SHIKEN Premium</h1>
          <p className="text-white/40 text-sm">Unlimited tests chaaiye? Choose your plan!</p>
        </motion.div>

        {isPremium && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="mb-6 rounded-2xl p-4 text-center"
            style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)" }}>
            <p className="text-emerald-400 font-bold text-sm">
              ✓ आप पहले से Premium Member हैं!
              {premiumSubjects.length > 0 && (
                <span className="text-emerald-300/70 text-xs block mt-1">
                  Subjects: {premiumSubjects.join(", ")}
                </span>
              )}
            </p>
          </motion.div>
        )}

        {/* Freemium reminder */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="mb-6 rounded-2xl p-4"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <p className="text-white/70 font-bold text-xs mb-2">🆓 Free Plan (always available)</p>
          <div className="flex flex-col gap-1">
            {["Mini Test — unlimited (10 random questions)", "1 Full Length Test per subject (free trial)"].map(f => (
              <div key={f} className="flex items-center gap-2 text-xs text-white/45">
                <span className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 text-xs"
                  style={{ background: "rgba(0,0,0,0.08)", color: "rgba(255,255,255,0.40)" }}>✓</span>
                {f}
              </div>
            ))}
          </div>
        </motion.div>

        <div className="flex flex-col gap-5 mb-8">
          {PLANS.map((plan, i) => (
            <motion.div key={plan.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.08 }}
              className="rounded-2xl p-5"
              style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${plan.accent}25` }}>

              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xl">{plan.emoji}</span>
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

              {plan.singleSubject && (
                <div className="mb-3">
                  <p className="text-white/40 text-xs mb-1.5">Choose your subject:</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {SUBJECT_OPTIONS.map((s) => {
                      const sel = subjectForPlan[plan.id] === s.id;
                      return (
                        <button key={s.id}
                          onClick={() => setSubjectForPlan(prev => ({ ...prev, [plan.id]: s.id }))}
                          className="py-2 px-1 rounded-xl text-xs font-semibold text-center transition-all"
                          style={{
                            background: sel ? `${plan.accent}30` : "rgba(255,255,255,0.05)",
                            border: `1px solid ${sel ? plan.accent : "rgba(0,0,0,0.08)"}`,
                            color: sel ? plan.accent : "rgba(255,255,255,0.40)",
                          }}>
                          {s.label.split(" / ")[0]}
                        </button>
                      );
                    })}
                  </div>
                  {plan.singleSubject && !subjectForPlan[plan.id] && (
                    <p className="text-xs text-amber-400/70 mt-1.5">↑ कोई एक विषय चुनो</p>
                  )}
                </div>
              )}

              <motion.button
                onClick={() => handlePayClick(plan)}
                whileTap={{ scale: 0.97 }}
                disabled={plan.singleSubject && !subjectForPlan[plan.id]}
                className="w-full py-3 rounded-xl font-black text-sm"
                style={{
                  background: plan.singleSubject && !subjectForPlan[plan.id]
                    ? "rgba(255,255,255,0.06)"
                    : `linear-gradient(135deg, ${plan.accent}, ${plan.id === "monthly_one" ? "#6366f1" : plan.id === "biannual_one" ? "#059669" : "#d97706"})`,
                  color: plan.singleSubject && !subjectForPlan[plan.id] ? "rgba(255,255,255,0.20)" : "#000",
                  boxShadow: plan.singleSubject && !subjectForPlan[plan.id] ? "none" : `0 4px 20px ${plan.accent}40`,
                  cursor: plan.singleSubject && !subjectForPlan[plan.id] ? "not-allowed" : "pointer",
                }}>
                💳 {plan.price} में Subscribe करो
              </motion.button>
            </motion.div>
          ))}
        </div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
          className="text-center space-y-2 pb-4">
          <div className="flex items-center justify-center gap-3 text-white/20 text-xs">
            <span>🔒 Razorpay Secured</span>
            <span>·</span>
            <span>💳 Card / UPI / Net Banking</span>
          </div>
          <p className="text-white/20 text-xs">
            Questions?{" "}
            <a href="https://wa.me/918340472013" className="text-white/40 underline">WhatsApp करो</a>
          </p>
        </motion.div>
      </div>

      <AnimatePresence>
        {payPlan && (
          <PaymentSheet
            plan={payPlan}
            selectedSubject={payPlan.singleSubject ? (subjectForPlan[payPlan.id] ?? "") : ""}
            onClose={() => setPayPlan(null)}
            onSuccess={(uid, paymentId) => {
              setSuccess({ plan: payPlan, uid, paymentId, subject: payPlan.singleSubject ? subjectForPlan[payPlan.id] : undefined });
              setPayPlan(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
