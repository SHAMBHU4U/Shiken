import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { auth } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { useSubscription } from "../hooks/useSubscription";
import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";

const API_BASE = import.meta.env.BASE_URL;
const RAZORPAY_KEY = "rzp_live_SqePWVSFlT9MSp";

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

function formatGatewayError(err: unknown): string {
  const msg = normalizeErrorMessage(err, "Payment failed.");
  return msg.toLowerCase().includes("object object") ? "Payment failed. Please try again." : msg;
}

// ==================== 1. ALL NEW UPDATED PLANS ARRAY ====================
const PLANS = [
  // ------------------- JEE PREMIUM -------------------
  {
    id: "jee_7d",
    name: "JEE Premium (7 Days)",
    price: "₹51",
    amount: 51,
    days: 7,
    period: "7 days",
    perMonth: "₹51/week",
    tag: "Weekly Pass" as string | null,
    accent: "#3b82f6",
    emoji: "⚡",
    singleSubject: false,
    category: "jee" as const,
    features: [
      "Full Access to JEE Physics, Chemistry, Maths",
      "JEE Main Pattern Mock Tests",
      "Chapter-wise PYQs with Solutions",
      "Shiken Engine Premium Questions",
    ],
  },
  {
    id: "jee_1m",
    name: "JEE Premium (Monthly)",
    price: "₹75",
    amount: 75,
    days: 30,
    period: "30 days",
    perMonth: "₹75/maah",
    tag: "Popular" as string | null,
    accent: "#2563eb",
    emoji: "🚀",
    singleSubject: false,
    category: "jee" as const,
    features: [
      "Full Access to JEE Physics, Chemistry, Maths",
      "JEE Main Pattern Mock Tests",
      "Chapter-wise PYQs with Solutions",
      "Priority AI Doubt Explanations",
    ],
  },
  {
    id: "jee_6m",
    name: "JEE Premium (6 Months)",
    price: "₹399",
    amount: 399,
    days: 180,
    period: "6 months",
    perMonth: "₹66.50/maah",
    tag: "🏆 Best Value" as string | null,
    accent: "#1d4ed8",
    emoji: "👑",
    singleSubject: false,
    category: "jee" as const,
    features: [
      "Full Access to JEE Physics, Chemistry, Maths",
      "JEE Main & Advanced Level Mock Tests",
      "6 Months All Subjects Access",
      "Exclusive Premium Dashboard Theme",
    ],
  },

  // ------------------- NEET PREMIUM -------------------
  {
    id: "neet_7d",
    name: "NEET Premium (7 Days)",
    price: "₹51",
    amount: 51,
    days: 7,
    period: "7 days",
    perMonth: "₹51/week",
    tag: "Weekly Pass" as string | null,
    accent: "#10b981",
    emoji: "🩺",
    singleSubject: false,
    category: "neet" as const,
    features: [
      "Full Access to NEET Physics, Chemistry, Biology",
      "NEET Pattern NCERT-Based Mock Tests",
      "Chapter-wise PYQs with Solutions",
      "7 Days Complete Pro Access",
    ],
  },
  {
    id: "neet_1m",
    name: "NEET Premium (Monthly)",
    price: "₹75",
    amount: 75,
    days: 30,
    period: "30 days",
    perMonth: "₹75/maah",
    tag: "Popular" as string | null,
    accent: "#059669",
    emoji: "🧪",
    singleSubject: false,
    category: "neet" as const,
    features: [
      "Full Access to NEET Physics, Chemistry, Biology",
      "NEET Pattern NCERT-Based Mock Tests",
      "Chapter-wise PYQs with Solutions",
      "30 Days Complete Pro Access",
    ],
  },
  {
    id: "neet_6m",
    name: "NEET Premium (6 Months)",
    price: "₹399",
    amount: 399,
    days: 180,
    period: "6 months",
    perMonth: "₹66.50/maah",
    tag: "🏆 Best Value" as string | null,
    accent: "#047857",
    emoji: "🧬",
    singleSubject: false,
    category: "neet" as const,
    features: [
      "Full Access to NEET Physics, Chemistry, Biology",
      "Full Length Real Exam-Pattern Papers",
      "All Chapters PYQs & Detailed Analytics",
      "6 Months Complete Pro Access",
    ],
  },

  // ------------------- CLASS 10TH PLANS -------------------
  {
    id: "c10_1m",
    name: "Class 10 Full Access",
    price: "₹49",
    amount: 49,
    days: 30,
    period: "30 days",
    perMonth: "₹49/maah",
    tag: "All Subjects" as string | null,
    accent: "#f59e0b",
    emoji: "📚",
    singleSubject: false,
    category: "class10" as const,
    features: [
      "Full Access to ALL Class 10 Board Subjects",
      "Chapter-wise Practice Tests",
      "Shiken Engine Questions & Analysis",
      "30 Days Access",
    ],
  },
  {
    id: "c10_6m_single",
    name: "Class 10 Single Subject",
    price: "₹99",
    amount: 99,
    days: 180,
    period: "6 months",
    perMonth: "₹16.50/maah",
    tag: "1 Subject Pass" as string | null,
    accent: "#eab308",
    emoji: "✏️",
    singleSubject: true,
    category: "class10" as const,
    features: [
      "1 Chosen Subject Unlimited Full Tests",
      "Chapter-wise Board Practice Papers",
      "Shiken Engine Analytics Tracker",
      "6 Months Subject Access",
    ],
  },
  {
    id: "c10_6m_full",
    name: "Class 10 Full Premium",
    price: "₹199",
    amount: 199,
    days: 180,
    period: "6 months",
    perMonth: "₹33/maah",
    tag: "🔥 Best Combo" as string | null,
    accent: "#d97706",
    emoji: "🎯",
    singleSubject: false,
    category: "class10" as const,
    features: [
      "Full Access to ALL Class 10 Subjects",
      "Unlimited Chapter-wise Tests + Mock Tests",
      "Board Previous Year Papers (PYQs)",
      "6 Months Full Premium Access",
    ],
  },

  // ------------------- CLASS 12TH PLANS -------------------
  {
    id: "c12_1m",
    name: "Class 12 Full Access",
    price: "₹49",
    amount: 49,
    days: 30,
    period: "30 days",
    perMonth: "₹49/maah",
    tag: "All Subjects" as string | null,
    accent: "#8b5cf6",
    emoji: "📓",
    singleSubject: false,
    category: "class12" as const,
    features: [
      "Full Access to ALL Class 12 Board Subjects",
      "Chapter-wise Practice Tests",
      "Shiken Engine Questions & Analysis",
      "30 Days Access",
    ],
  },
  {
    id: "c12_6m_single",
    name: "Class 12 Single Subject",
    price: "₹99",
    amount: 99,
    days: 180,
    period: "6 months",
    perMonth: "₹16.50/maah",
    tag: "1 Subject Pass" as string | null,
    accent: "#a855f7",
    emoji: "✒️",
    singleSubject: true,
    category: "class12" as const,
    features: [
      "1 Chosen Subject Unlimited Full Tests",
      "Chapter-wise Board Practice Papers",
      "Shiken Engine Analytics Tracker",
      "6 Months Subject Access",
    ],
  },
  {
    id: "c12_6m_full",
    name: "Class 12 Full Premium",
    price: "₹199",
    amount: 199,
    days: 180,
    period: "6 months",
    perMonth: "₹33/maah",
    tag: "🔥 Best Combo" as string | null,
    accent: "#7c3aed",
    emoji: "🌟",
    singleSubject: false,
    category: "class12" as const,
    features: [
      "Full Access to ALL Class 12 Subjects",
      "Unlimited Chapter-wise Tests + Mock Tests",
      "Board Previous Year Papers (PYQs)",
      "6 Months Full Premium Access",
    ],
  },
];

// Clean filtered subject structures to avoid contamination
const SUBJECTS_BOARD_10TH = [
  { id: "maths",      label: "Maths / गणित" },
  { id: "science",    label: "Science / विज्ञान" },
  { id: "social",     label: "Social Science / सामाजिक विज्ञान" },
  { id: "hindi",      label: "Hindi / हिंदी" },
  { id: "english",    label: "English / अंग्रेज़ी" },
  { id: "sanskrit",   label: "Sanskrit / संस्कृत" },
];

const SUBJECTS_BOARD_12TH = [
  { id: "physics",    label: "Physics / भौतिकी" },
  { id: "chemistry",  label: "Chemistry / रसायन" },
  { id: "maths",      label: "Maths / गणित" },
  { id: "biology",    label: "Biology / जीव विज्ञान" },
  { id: "english",    label: "English / अंग्रेज़ी" },
  { id: "Hindi",      label: "Hindi / हिन्दी" },
  { id: "Social Science",    label: "Social Science / सामाजिक विज्ञान" },
];

type Plan = (typeof PLANS)[0];
const ADMIN_WA = "918340472013";

function buildAdminWaLink(uid: string, plan: Plan, paymentId: string, subject?: string) {
  const subjectLine = subject ? `\nSubject: ${subject}` : "";
  const msg = `Namaste! 🙏 Maine SHIKEN ${plan.name} (${plan.price}) ke liye payment kar diya hai.\n\nUID: ${uid}${subjectLine}\nPayment ID: ${paymentId}\n\nPlease verify karke premium activate kar dijiye. Dhanyawad! 🙏`;
  return `https://wa.me/${ADMIN_WA}?text=${encodeURIComponent(msg)}`;
}

// ==================== 2. PAYMENT SHEET COMPONENT ====================
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
  const { walletBalance } = useSubscription();
  const [paying, setPaying]                 = useState(false);
  const [error, setError]                   = useState("");
  const [couponInput, setCouponInput]       = useState("");
  const [couponChecking, setCouponChecking] = useState(false);
  const [couponResult, setCouponResult]     = useState<{ applied: boolean; discount: number; finalAmount: number } | null>(null);
  const [couponError, setCouponError]       = useState("");
  const [useWallet, setUseWallet]           = useState(false);

  const baseAfterCoupon = couponResult?.applied ? couponResult.finalAmount : plan.amount;
  const walletDiscount  = useWallet && walletBalance > 0
    ? Math.min(walletBalance, baseAfterCoupon - 1) 
    : 0;
  const finalDisplayAmount = baseAfterCoupon - walletDiscount;

  // Find dynamic labels for display inside sheet
  const combinedOptions = [...SUBJECTS_BOARD_10TH, ...SUBJECTS_BOARD_12TH];
  const renderedSubjectLabel = combinedOptions.find(s => s.id === selectedSubject)?.label ?? selectedSubject;

  async function handleCheckCoupon() {
    const code = couponInput.trim().toUpperCase();
    if (!code) return;
    setCouponChecking(true); setCouponError(""); setCouponResult(null);
    try {
      const res = await fetch(`/api/razorpay/validate-coupon`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ couponCode: code, amount: plan.amount }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setCouponError(normalizeErrorMessage(data, "Invalid coupon code."));
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
      const orderRes = await fetch('/api/razorpay/create-order', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount:     plan.amount,
          planId:     plan.id,
          uid,
          couponCode: couponInput.trim() || undefined,
          useWallet:  useWallet && walletBalance > 0,
        }),
      });
      const orderData = await orderRes.json();
      if (!orderRes.ok || !orderData.ok) {
        setError(normalizeErrorMessage(orderData, "Could not create order. Please try again."));
        setPaying(false);
        return;
      }

      const orderId  = typeof orderData.orderId === "string" ? orderData.orderId : "";
      const amountRs = Number(orderData.amount);
      const key      = typeof orderData.key === "string" ? orderData.key : RAZORPAY_KEY;
      if (!orderId || !Number.isFinite(amountRs)) {
        setError("Payment gateway returned invalid order data. Please try again.");
        setPaying(false);
        return;
      }
      const amount = Math.round(amountRs * 100);

      const options: RazorpayOptions = {
        key,
        amount,
        currency:    "INR",
        name:        "SHIKEN",
        description: `${plan.name}${plan.singleSubject && selectedSubject ? " · " + selectedSubject : ""} — ${plan.period}`,
        order_id:    orderId,
        prefill: {
          email: auth.currentUser.email       ?? undefined,
          name:  auth.currentUser.displayName ?? undefined,
        },
        theme: { color: plan.accent },
        modal: { ondismiss: () => setPaying(false) },

        handler: async (response: RazorpayResponse) => {
          const VERIFY_URL = `/api/razorpay/verify-payment`;
          const verifyBody = {
            razorpay_order_id:   response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature:  response.razorpay_signature,
            uid,
            planId: plan.id,
            days:   plan.days,
            planSubject: plan.singleSubject ? selectedSubject : undefined,
          };

          console.log("[SHIKEN] verify-payment URL:", VERIFY_URL);
          console.log("[SHIKEN] verify-payment body:", JSON.stringify(verifyBody, null, 2));

          try {
            setPaying(true);
            const verifyRes = await fetch(VERIFY_URL, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(verifyBody),
            });

            console.log("[SHIKEN] verify-payment HTTP status:", verifyRes.status, verifyRes.statusText);

            let verifyData: Record<string, unknown> = {};
            try {
              verifyData = await verifyRes.json();
              console.log("[SHIKEN] verify-payment response body:", JSON.stringify(verifyData, null, 2));
            } catch (parseErr) {
              const raw = await verifyRes.text().catch(() => "(could not read body)");
              console.error("[SHIKEN] verify-payment response is NOT valid JSON. Raw text:", raw);
              setError("Server returned an unexpected response. Contact support with Payment ID: " + response.razorpay_payment_id);
              setPaying(false);
              return;
            }

            if (!verifyRes.ok || !verifyData.ok) {
              console.error("[SHIKEN] verify-payment failed:", verifyData);
              setError(normalizeErrorMessage(verifyData, "Verification failed. Contact support with Payment ID: " + response.razorpay_payment_id));
              setPaying(false);
              return;
            }

            console.log("[SHIKEN] Payment verified successfully. Sending WhatsApp notification...");

            // Fire-and-forget WhatsApp notification
            fetch(`${API_BASE}api/notify-whatsapp`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                message: [
                  `✅ Payment Verified`,
                  `👤 UID: ${uid}`,
                  `📦 Plan: ${plan.name}`,
                  plan.singleSubject && selectedSubject ? `📚 Subject: ${selectedSubject}` : "",
                  `💰 Amount: ₹${orderData.amount}${orderData.walletDiscount > 0 ? ` (₹${orderData.walletDiscount} from wallet)` : ""}`,
                  `🔑 Payment ID: ${response.razorpay_payment_id}`,
                ].filter(Boolean).join("\n"),
              }),
            }).catch((e) => console.warn("[SHIKEN] WhatsApp notify failed (non-critical):", e));

            // Success — show confirmation and reload so premium status loads fresh
            alert("Payment Successful and Account Upgraded!");
            window.location.reload();

          } catch (err) {
            console.error("[SHIKEN] verify-payment threw an exception:", err);
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
        setError("Payment gateway failed to open. Please refresh and try again.");
        setPaying(false);
      }
    } catch (err) {
      setError(formatGatewayError(err));
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
            <span className="text-white/70 text-sm font-semibold">{renderedSubjectLabel}</span>
          </div>
        )}

        {walletBalance > 0 && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
            className="mb-3 px-4 py-3 rounded-2xl flex items-center justify-between"
            style={{ background: "linear-gradient(135deg, rgba(245,158,11,0.12), rgba(251,191,36,0.06))", border: "1px solid rgba(251,191,36,0.25)" }}>
            <div className="flex items-center gap-2.5">
              <span className="text-base">💵</span>
              <div>
                <p className="text-amber-300 text-xs font-black leading-tight">Shiken Wallet</p>
                <p className="text-amber-200/60 text-xs">Balance: ₹{walletBalance}</p>
              </div>
            </div>
            <button
              onClick={() => setUseWallet(v => !v)}
              disabled={paying}
              className="relative w-11 h-6 rounded-full transition-all shrink-0"
              style={{
                background: useWallet ? "rgba(245,158,11,0.8)" : "rgba(255,255,255,0.12)",
                border: useWallet ? "1px solid rgba(245,158,11,0.5)" : "1px solid rgba(255,255,255,0.15)",
              }}>
              <span className="absolute top-0.5 transition-all duration-200 w-5 h-5 rounded-full bg-white shadow"
                style={{ left: useWallet ? "calc(100% - 1.375rem)" : "0.125rem" }} />
            </button>
          </motion.div>
        )}

        {useWallet && walletDiscount > 0 && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
            className="mb-3 px-3 py-2 rounded-xl flex items-center justify-between"
            style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}>
            <span className="text-amber-400 text-xs font-bold">🪙 Wallet applied: −₹{walletDiscount}</span>
            <span className="text-amber-300 text-sm font-black">₹{finalDisplayAmount}</span>
          </motion.div>
        )}

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
          {couponError && <p className="text-red-400 text-xs mt-1.5 px-1">{couponError}</p>}
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
              background: paying ? "rgba(139,92,246,0.3)" : `linear-gradient(135deg, ${plan.accent}, #111115)`,
              color: paying ? "#fff" : "#fff",
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
              <><span className="text-lg">💳</span> Pay ₹{finalDisplayAmount} Securely</>
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

// ==================== 3. MAIN PRICING PAGE VIEW ====================
// Map UserGoal → plan category
function goalToCategory(goal: string | null): "jee" | "neet" | "class10" | "class12" | null {
  if (goal === "jee")  return "jee";
  if (goal === "neet") return "neet";
  if (goal === "c10")  return "class10";
  if (goal === "c12")  return "class12";
  return null;
}

const CATEGORY_LABELS: Record<string, string> = {
  jee: "JEE", neet: "NEET", class10: "Class 10th", class12: "Class 12th",
};

export default function PricingPage() {
  const [, navigate] = useLocation();
  const { isPremium, premiumSubjects } = useSubscription();
  const { goal } = useAuth();
  const [payPlan, setPayPlan] = useState<Plan | null>(null);
  const [subjectForPlan, setSubjectForPlan] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState<{ plan: Plan; uid: string; paymentId: string; subject?: string } | null>(null);

  // If user has a goal set, auto-lock to that category; otherwise let them pick
  const goalCategory = goalToCategory(goal);
  const [activeTab, setActiveTab] = useState<"jee" | "neet" | "class10" | "class12">(
    goalCategory ?? "jee"
  );

  const filteredPlans = PLANS.filter(plan => plan.category === activeTab);

  async function handlePayClick(plan: Plan) {
    if (plan.singleSubject && !subjectForPlan[plan.id]) return;

    if (Capacitor.getPlatform() === 'android' || (window as any).Capacitor?.getPlatform?.() === 'android') {
      await Browser.open({
        url: 'https://shiken-d8789.firebaseapp.com', 
        presentationStyle: 'popover'
      });
      return; 
    }
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
          className="text-center mb-6">
          <button onClick={() => navigate(-1 as never)}
            className="absolute left-4 top-4 w-9 h-9 rounded-xl flex items-center justify-center text-white/40 hover:text-white/80 transition-colors"
            style={{ background: "rgba(255,255,255,0.06)" }}>←</button>
          <motion.div animate={{ rotate: [0, -8, 8, -4, 4, 0] }}
            transition={{ duration: 2, repeat: Infinity, repeatDelay: 4 }} className="text-4xl mb-3">👑</motion.div>
          <h1 className="text-white font-black text-2xl mb-1">SHIKEN Premium</h1>
          <p className="text-white/40 text-sm">Choose your package to continue configuration</p>
        </motion.div>

        {/* Stream selector — hidden when user's goal is already known */}
        {goalCategory ? (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-center gap-2 mb-6 px-4 py-2.5 rounded-xl max-w-md mx-auto"
            style={{ background: "rgba(139,92,246,0.10)", border: "1px solid rgba(139,92,246,0.25)" }}>
            <span className="text-base">🎯</span>
            <p className="text-white/70 text-sm">
              Showing plans for <span className="text-white font-black">{CATEGORY_LABELS[goalCategory]}</span>
            </p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-4 gap-1 p-1 mb-6 bg-white/5 border border-white/10 rounded-xl max-w-md mx-auto">
            {(["jee", "neet", "class10", "class12"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-2 text-[11px] font-black uppercase tracking-wider rounded-lg transition-all ${
                  activeTab === tab
                    ? "bg-white/10 text-white shadow-sm ring-1 ring-white/10"
                    : "text-white/40 hover:text-white/70"
                }`}
              >
                {tab === "class10" ? "10th" : tab === "class12" ? "12th" : tab}
              </button>
            ))}
          </div>
        )}

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

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="mb-6 rounded-2xl p-4"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <p className="text-white/70 font-bold text-xs mb-2">Free Plan Feature Matrix</p>
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

        {/* Filtered Segment Loop Render */}
        <div className="flex flex-col gap-5 mb-8">
          {filteredPlans.map((plan, i) => {
            const isSingleSub = plan.singleSubject;
            const subjectList = plan.category === "class10" ? SUBJECTS_BOARD_10TH : SUBJECTS_BOARD_12TH;
            const isButtonDisabled = isSingleSub && !subjectForPlan[plan.id];

            return (
              <motion.div key={plan.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 + i * 0.05 }}
                className="rounded-2xl p-5"
                style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${plan.accent}25` }}>

                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xl">{plan.emoji}</span>
                      <p className="text-white font-black text-base">{plan.name}</p>
                      {plan.tag && (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full text-black"
                          style={{ background: `linear-gradient(135deg, ${plan.accent}, #fff)` }}>
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

                {isSingleSub && (
                  <div className="mb-4">
                    <p className="text-white/40 text-xs mb-1.5">Choose your subject:</p>
                    <div className="grid grid-cols-3 gap-1.5">
                      {subjectList.map((s) => {
                        const sel = subjectForPlan[plan.id] === s.id;
                        return (
                          <button key={s.id}
                            onClick={() => setSubjectForPlan(prev => ({ ...prev, [plan.id]: s.id }))}
                            className="py-2 px-1 rounded-xl text-[11px] font-bold text-center transition-all"
                            style={{
                              background: sel ? `${plan.accent}30` : "rgba(255,255,255,0.03)",
                              border: `1px solid ${sel ? plan.accent : "rgba(255,255,255,0.08)"}`,
                              color: sel ? "#fff" : "rgba(255,255,255,0.40)",
                            }}>
                            {s.label.split(" / ")[0]}
                          </button>
                        );
                      })}
                    </div>
                    {!subjectForPlan[plan.id] && (
                      <p className="text-xs text-amber-400/70 mt-2">↑ कोई एक विषय चुनो</p>
                    )}
                  </div>
                )}

                <motion.button
                  onClick={() => handlePayClick(plan)}
                  whileTap={{ scale: isButtonDisabled ? 1 : 0.97 }}
                  disabled={isButtonDisabled}
                  className="w-full py-3 rounded-xl font-black text-sm transition-all"
                  style={{
                    background: isButtonDisabled
                      ? "rgba(255,255,255,0.06)"
                      : `linear-gradient(135deg, ${plan.accent}, #111115)`,
                    color: isButtonDisabled ? "rgba(255,255,255,0.2)" : "#fff",
                    boxShadow: isButtonDisabled ? "none" : `0 4px 20px ${plan.accent}25`,
                  }}
                >
                  {isSingleSub && !subjectForPlan[plan.id] ? "Select Subject First" : "Activate Plan"}
                </motion.button>
              </motion.div>
            );
          })}
        </div>
      </div>

      <AnimatePresence>
        {payPlan && (
          <PaymentSheet
            plan={payPlan}
            selectedSubject={subjectForPlan[payPlan.id]}
            onClose={() => setPayPlan(null)}
            onSuccess={(uid, paymentId) => {
              const selectedSub = subjectForPlan[payPlan.id];
              setSuccess({ plan: payPlan, uid, paymentId, subject: selectedSub });
              setPayPlan(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
