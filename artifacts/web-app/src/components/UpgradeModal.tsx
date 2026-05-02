import { motion, AnimatePresence } from "framer-motion";

const WHATSAPP_URL =
  "https://wa.me/918340472013?text=" +
  encodeURIComponent("Hi! I want to upgrade to SHIKEN Premium. Please guide me.");

const features = [
  { icon: "🎯", text: "Full 50-question tests (25 DB + 25 AI-generated)" },
  { icon: "📂", text: "Chapter-wise targeted deep practice" },
  { icon: "🤖", text: "Gemini AI fresh questions every session" },
  { icon: "🧠", text: "AI-powered test analysis in Hindi" },
  { icon: "💡", text: "Per-question AI explanations with caching" },
  { icon: "📹", text: "Priority video consultation with mentor" },
  { icon: "👑", text: "Golden badge & premium profile theme" },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function UpgradeModal({ open, onClose }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, y: 80, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.97 }}
            transition={{ type: "spring", damping: 28, stiffness: 340 }}
            className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl px-5 pt-5 pb-10 max-w-lg mx-auto"
            style={{
              background: "linear-gradient(160deg, #1c1628 0%, #0d0d18 100%)",
              border: "1px solid rgba(251,191,36,0.28)",
              borderBottom: "none",
              boxShadow: "0 -12px 64px rgba(251,191,36,0.18)",
            }}
          >
            <div className="w-10 h-1 rounded-full bg-white/15 mx-auto mb-5" />

            <div className="flex items-center gap-3 mb-5">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0"
                style={{
                  background: "linear-gradient(135deg, rgba(251,191,36,0.28), rgba(245,158,11,0.14))",
                  border: "1px solid rgba(251,191,36,0.4)",
                }}
              >
                👑
              </div>
              <div>
                <p className="text-white font-black text-xl leading-tight">Upgrade to Premium</p>
                <p className="text-yellow-400/70 text-xs mt-0.5">Unlock the full SHIKEN experience</p>
              </div>
            </div>

            <div className="flex flex-col gap-2 mb-5">
              {features.map((f, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -14 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.04 + i * 0.04 }}
                  className="flex items-center gap-3 px-3 py-2 rounded-xl"
                  style={{
                    background: "rgba(251,191,36,0.05)",
                    border: "1px solid rgba(251,191,36,0.12)",
                  }}
                >
                  <span className="text-base shrink-0">{f.icon}</span>
                  <span className="text-white/80 text-sm">{f.text}</span>
                  <span className="ml-auto text-yellow-400/50 text-xs shrink-0">✓</span>
                </motion.div>
              ))}
            </div>

            <motion.a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              className="flex items-center justify-center gap-2.5 w-full py-4 rounded-2xl font-black text-sm"
              style={{
                background: "linear-gradient(135deg, #f59e0b, #d97706)",
                color: "#000",
                boxShadow: "0 6px 32px rgba(251,191,36,0.45)",
              }}
            >
              <span className="text-lg">👑</span>
              Contact Mentor to Upgrade
            </motion.a>

            <button
              onClick={onClose}
              className="mt-3 w-full py-2.5 text-white/35 text-sm hover:text-white/60 transition-colors"
            >
              Not now
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
