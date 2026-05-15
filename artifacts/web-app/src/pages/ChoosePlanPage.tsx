import { useState } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";

const GOAL_PLANS: Record<string, { id: string; name: string; price: string; amount: number; days: number; period: string; tag: string | null; accent: string; emoji: string; features: string[] }[]> = {
  jee: [
    {
      id: "jee_neet_weekly", name: "Weekly Pass", price: "\u20b929", amount: 29, days: 7,
      period: "7 days", tag: null, accent: "#3b82f6", emoji: "\ud83d\udcc5",
      features: ["Full access to all JEE subjects", "Unlimited tests for 7 days", "Shiken Engine questions & analysis"],
    },
    {
      id: "jee_neet_monthly", name: "Monthly Plan", price: "\u20b969", amount: 69, days: 30,
      period: "30 days", tag: null, accent: "#6366f1", emoji: "\ud83d\udcc6",
      features: ["Full access to all JEE subjects", "Unlimited tests for 30 days", "Shiken Engine questions & analysis", "Priority counselling"],
    },
    {
      id: "jee_neet_yearly", name: "Yearly Pro", price: "\u20b9499", amount: 499, days: 365,
      period: "1 year", tag: "\ud83c\udfc6 Best Value", accent: "#f59e0b", emoji: "\ud83c\udfaf",
      features: ["Full access to all JEE subjects", "Unlimited tests for 1 year", "Shiken Engine questions & analysis", "Priority counselling", "Golden badge & profile theme"],
    },
  ],
  neet: [
    {
      id: "jee_neet_weekly", name: "Weekly Pass", price: "\u20b929", amount: 29, days: 7,
      period: "7 days", tag: null, accent: "#10b981", emoji: "\ud83d\udcc5",
      features: ["Full access to all NEET subjects", "Unlimited tests for 7 days", "Shiken Engine questions & analysis"],
    },
    {
      id: "jee_neet_monthly", name: "Monthly Plan", price: "\u20b969", amount: 69, days: 30,
      period: "30 days", tag: null, accent: "#059669", emoji: "\ud83d\udcc6",
      features: ["Full access to all NEET subjects", "Unlimited tests for 30 days", "Shiken Engine questions & analysis", "Priority counselling"],
    },
    {
      id: "jee_neet_yearly", name: "Yearly Pro", price: "\u20b9499", amount: 499, days: 365,
      period: "1 year", tag: "\ud83c\udfc6 Best Value", accent: "#f59e0b", emoji: "\ud83c\udfaf",
      features: ["Full access to all NEET subjects", "Unlimited tests for 1 year", "Shiken Engine questions & analysis", "Priority counselling", "Golden badge & profile theme"],
    },
  ],
  c10: [
    {
      id: "c10_monthly", name: "Monthly Pass", price: "\u20b949", amount: 49, days: 30,
      period: "30 days", tag: null, accent: "#f59e0b", emoji: "\ud83d\udcc5",
      features: ["1 subject unlimited Full Tests", "Chapter-wise practice", "Shiken Engine questions & analysis"],
    },
    {
      id: "c10_6month", name: "6 Months", price: "\u20b999", amount: 99, days: 180,
      period: "6 months", tag: null, accent: "#10b981", emoji: "\ud83d\udcc6",
      features: ["1 subject unlimited Full Tests", "Chapter-wise practice", "Shiken Engine questions & analysis"],
    },
  ],
  c12: [
    {
      id: "c12_monthly", name: "Monthly Pass", price: "\u20b949", amount: 49, days: 30,
      period: "30 days", tag: null, accent: "#8b5cf6", emoji: "\ud83d\udcc5",
      features: ["1 subject unlimited Full Tests", "Chapter-wise practice", "Shiken Engine questions & analysis"],
    },
    {
      id: "c12_6month", name: "6 Months", price: "\u20b999", amount: 99, days: 180,
      period: "6 months", tag: null, accent: "#10b981", emoji: "\ud83d\udcc6",
      features: ["1 subject unlimited Full Tests", "Chapter-wise practice", "Shiken Engine questions & analysis"],
    },
  ],
};

interface ChoosePlanPageProps {
  goal?: "jee" | "neet" | "c10" | "c12";
  onClose?: () => void;
}

export default function ChoosePlanPage(props?: ChoosePlanPageProps) {
  const goal = props?.goal ?? "c10";
  const onClose = props?.onClose;
  const [, navigate] = useLocation();
  const plans = GOAL_PLANS[goal] || GOAL_PLANS.c10;

  return (
    <div className="min-h-screen w-full pb-32 relative overflow-hidden" style={{ background: "#07080f" }}>
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full blur-3xl opacity-15"
          style={{ background: "radial-gradient(circle, #f59e0b, transparent)" }} />
      </div>

      <div className="relative z-10 max-w-lg mx-auto px-4 pt-14">
        <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
          {onClose && (
            <button onClick={onClose}
              className="absolute left-4 top-4 w-9 h-9 rounded-xl flex items-center justify-center text-white/40 hover:text-white/80 transition-colors"
              style={{ background: "rgba(255,255,255,0.06)" }}>←</button>
          )}
          <div className="text-4xl mb-3">💎</div>
          <h1 className="text-white font-black text-2xl mb-1">Choose Your Plan</h1>
          <p className="text-white/40 text-sm">Unlock unlimited tests and Shiken Engine power</p>
        </motion.div>

        {/* Free perks reminder */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="mb-6 rounded-2xl p-4"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <p className="text-white/70 font-bold text-xs mb-2">🌟 Free Forever</p>
          <div className="flex flex-col gap-1">
            {["Daily 5 Questions — practice every day", "First Chapter Test — try any chapter once for free"].map(f => (
              <div key={f} className="flex items-center gap-2 text-xs text-white/45">
                <span className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 text-xs"
                  style={{ background: "rgba(0,0,0,0.08)", color: "rgba(255,255,255,0.40)" }}>✓</span>
                {f}
              </div>
            ))}
          </div>
        </motion.div>

        <div className="flex flex-col gap-5 mb-8">
          {plans.map((plan, i) => (
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
                  <p className="text-white/40 text-xs">{plan.period} full access</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-black text-2xl" style={{ color: plan.accent }}>{plan.price}</p>
                </div>
              </div>

              <div className="flex flex-col gap-1.5 mb-4">
                {plan.features.map((f, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs text-white/55">
                    <span className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 text-[10px]"
                      style={{ background: `${plan.accent}15`, color: `${plan.accent}cc` }}>✓</span>
                    {f}
                  </div>
                ))}
              </div>

              <motion.button
                onClick={() => navigate(`/pricing?plan=${plan.id}`)}
                whileTap={{ scale: 0.97 }}
                className="w-full py-3 rounded-xl font-bold text-sm text-black"
                style={{ background: `linear-gradient(135deg, ${plan.accent}, ${plan.accent}cc)`, boxShadow: `0 4px 20px ${plan.accent}40` }}>
                Get {plan.name} →
              </motion.button>
            </motion.div>
          ))}
        </div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
          className="text-center">
          <p className="text-white/25 text-xs">
            🔐 Secure payments via Razorpay · UPI, Card, Net Banking
          </p>
        </motion.div>
      </div>
    </div>
  );
}
