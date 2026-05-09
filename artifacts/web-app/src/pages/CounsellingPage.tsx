import { motion } from "framer-motion";
import { useLocation } from "wouter";

// ── UPDATE THIS with your WhatsApp number (with country code, no + sign) ──────
const WHATSAPP_NUMBER = "918340472013";
const WHATSAPP_MSG = encodeURIComponent("Hi, I need career guidance after 10th.");
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}?text=${WHATSAPP_MSG}`;

const faqs = [
  { q: "Which stream should I choose after 10th?", a: "Science, Commerce, or Arts — each has great careers. The mentor will help you decide based on your strengths and interests." },
  { q: "What career options are available after 12th?", a: "Engineering, Medical, Law, Management, Arts & Design, Government Jobs, and more. We'll map them to your subject scores." },
  { q: "Can I prepare for competitive exams like JEE/NEET?", a: "Absolutely. The mentor will guide you on the right study plan and resources." },
  { q: "Is this counselling really free?", a: "Yes. The initial WhatsApp chat is completely free. Video calls are also available on request." },
];

export default function CounsellingPage() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen w-full relative overflow-hidden pb-28" style={{ background: "#f8f9ff" }}>
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full blur-3xl opacity-10"
          style={{ background: "radial-gradient(circle, #10b981, transparent)" }} />
        <div className="absolute top-1/2 -right-32 w-80 h-80 rounded-full blur-3xl opacity-8"
          style={{ background: "radial-gradient(circle, #f59e0b, transparent)" }} />
        <div className="absolute inset-0 opacity-[0.02]"
          style={{ backgroundImage: "radial-gradient(circle, rgba(0,0,0,0.07) 1px, transparent 1px)", backgroundSize: "32px 32px" }} />
      </div>

      <div className="relative z-10 max-w-lg mx-auto px-4 pt-12 pb-4">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }} className="text-center mb-10">
          <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center text-3xl"
            style={{ background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.25)" }}>
            🎓
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight mb-2">Free Counselling</h1>
          <p className="text-white/40 text-sm leading-relaxed">
            Get personalised career guidance after 10th &amp; 12th from an expert mentor — completely free.
          </p>
        </motion.div>

        {/* WhatsApp CTA */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
          className="rounded-2xl p-6 mb-6"
          style={{ background: "rgba(37,211,102,0.08)", border: "1px solid rgba(37,211,102,0.2)" }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
              style={{ background: "rgba(37,211,102,0.15)" }}>
              💬
            </div>
            <div>
              <p className="text-white font-black text-base">Chat with Mentor</p>
              <p className="text-white/40 text-xs">Free · Instant reply · Hindi & English</p>
            </div>
          </div>
          <motion.a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center justify-center gap-3 w-full py-4 rounded-xl font-black text-white text-base"
            style={{ background: "linear-gradient(135deg, #25d366, #128c7e)", boxShadow: "0 4px 24px rgba(37,211,102,0.35)" }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            Chat on WhatsApp Now
          </motion.a>
        </motion.div>

        {/* Video Consultation */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
          className="rounded-2xl p-5 mb-4"
          style={{ background: "rgba(139,92,246,0.07)", border: "1px solid rgba(139,92,246,0.15)" }}>
          <div className="flex items-start gap-3">
            <span className="text-2xl mt-0.5">📹</span>
            <div>
              <p className="text-white font-bold text-sm mb-1">WhatsApp Video Consultations</p>
              <p className="text-white/50 text-xs leading-relaxed">
                You can ask career questions face-to-face via WhatsApp video call. The mentor's camera stays off for privacy — only your questions matter.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Premium Priority Access */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.32, duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
          className="rounded-2xl p-5 mb-6"
          style={{
            background: "linear-gradient(135deg, rgba(251,191,36,0.08), rgba(245,158,11,0.04))",
            border: "1px solid rgba(251,191,36,0.25)",
          }}>
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0"
              style={{ background: "rgba(251,191,36,0.15)" }}>
              👑
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <p className="text-white font-bold text-sm">Premium Priority Consultation</p>
                <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                  style={{ background: "rgba(251,191,36,0.2)", color: "#fbbf24" }}>
                  Premium
                </span>
              </div>
              <p className="text-white/50 text-xs leading-relaxed">
                Premium students get <span className="text-yellow-400/80 font-semibold">priority response</span> within 2 hours, scheduled video calls, and a personalised study roadmap — not available in free plan.
              </p>
            </div>
          </div>
        </motion.div>

        {/* What you can ask */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }} className="mb-6">
          <p className="text-white/50 text-xs font-semibold uppercase tracking-widest mb-3">What you can ask</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { icon: "🎯", text: "Stream selection after 10th" },
              { icon: "📚", text: "Study plan guidance" },
              { icon: "💼", text: "Career options after 12th" },
              { icon: "🏛️", text: "Govt job preparation" },
              { icon: "🔬", text: "JEE / NEET strategy" },
              { icon: "🌍", text: "Scholarship & college info" },
            ].map((item, i) => (
              <motion.div key={i} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.35 + i * 0.04 }}
                className="flex items-center gap-2 p-3 rounded-xl"
                style={{ background: "rgba(0,0,0,0.05)", border: "1px solid rgba(0,0,0,0.06)" }}>
                <span className="text-base">{item.icon}</span>
                <span className="text-white/60 text-xs leading-tight">{item.text}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* FAQ */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }} className="mb-4">
          <p className="text-white/50 text-xs font-semibold uppercase tracking-widest mb-3">Frequently Asked</p>
          <div className="flex flex-col gap-3">
            {faqs.map((faq, i) => (
              <div key={i} className="rounded-xl p-4"
                style={{ background: "rgba(0,0,0,0.05)", border: "1px solid rgba(0,0,0,0.06)" }}>
                <p className="text-white text-sm font-semibold mb-1.5">❓ {faq.q}</p>
                <p className="text-white/45 text-xs leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Bottom CTA */}
        <motion.a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.55 }}
          className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl text-sm font-bold mt-4"
          style={{ background: "rgba(37,211,102,0.1)", border: "1px solid rgba(37,211,102,0.2)", color: "#25d366" }}>
          💬 Start Free Counselling →
        </motion.a>
      </div>
    </div>
  );
}
