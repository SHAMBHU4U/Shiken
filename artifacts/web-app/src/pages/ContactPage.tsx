import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const CONTACT_EMAIL = "shiken.query@gmail.com";
const APP_URL = "https://shiken.replit.app";

const socials = [
  { icon: "📘", label: "Facebook",  href: "#", color: "#1877f2" },
  { icon: "📸", label: "Instagram", href: "#", color: "#e1306c" },
  { icon: "🎬", label: "YouTube",   href: "#", color: "#ff0000" },
  { icon: "🐦", label: "Twitter/X", href: "#", color: "#1d9bf0" },
];

export default function ContactPage() {
  const [name,    setName]    = useState("");
  const [email,   setEmail]   = useState("");
  const [message, setMessage] = useState("");
  const [shared,  setShared]  = useState<"idle" | "copied" | "shared">("idle");

  async function handleShare() {
    const shareData = {
      title: "SHIKEN — Bihar Board Class 10 Prep",
      text: "🎓 Free AI-powered exam prep for Bihar Board Class 10! Practice questions in Hindi & English with instant AI explanations.",
      url: APP_URL,
    };
    if (navigator.share) {
      try { await navigator.share(shareData); setShared("shared"); }
      catch { /* user cancelled */ }
    } else {
      await navigator.clipboard.writeText(APP_URL);
      setShared("copied");
    }
    setTimeout(() => setShared("idle"), 3000);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const subject = encodeURIComponent(`SHIKEN App — Message from ${name || "User"}`);
    const body    = encodeURIComponent(`Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`);
    window.open(`mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`, "_blank");
  }

  return (
    <div className="min-h-screen w-full relative overflow-hidden pb-28" style={{ background: "#07080f" }}>
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 -right-32 w-80 h-80 rounded-full blur-3xl opacity-10"
          style={{ background: "radial-gradient(circle, #06b6d4, transparent)" }} />
        <div className="absolute bottom-0 -left-24 w-72 h-72 rounded-full blur-3xl opacity-8"
          style={{ background: "radial-gradient(circle, #8b5cf6, transparent)" }} />
        <div className="absolute inset-0 opacity-[0.02]"
          style={{ backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)", backgroundSize: "32px 32px" }} />
      </div>

      <div className="relative z-10 max-w-lg mx-auto px-4 pt-12 pb-4">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }} className="text-center mb-10">
          <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center text-3xl"
            style={{ background: "rgba(6,182,212,0.1)", border: "1px solid rgba(6,182,212,0.2)" }}>
            📩
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight mb-2">Contact Us</h1>
          <p className="text-white/40 text-sm">Have a question or feedback? We'd love to hear from you.</p>
        </motion.div>

        {/* About the App */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="rounded-2xl p-5 mb-6"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>

          {/* Brand row */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: "linear-gradient(145deg, #5b21b6, #312e81, #0c4a6e)", boxShadow: "0 4px 16px rgba(139,92,246,0.4)" }}>
              <svg viewBox="0 0 40 40" className="w-7 h-7" fill="none">
                <rect x="7" y="5" width="19" height="27" rx="2.5" stroke="white" strokeWidth="1.5" strokeOpacity="0.92" />
                <path d="M20 5v5h6" stroke="white" strokeWidth="1.5" strokeOpacity="0.92" strokeLinejoin="round" />
                <path d="M11 15h11M11 19h11M11 23h7" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.7" />
                <path d="M29.5 3.5l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9z" fill="#fcd34d" />
              </svg>
            </div>
            <div>
              <p className="text-white font-black text-base tracking-tight">SHIKEN · शिकेन</p>
              <p className="text-violet-400/70 text-xs font-medium">Bihar Board Class 10 · AI Powered</p>
            </div>
          </div>

          {/* Description */}
          <p className="text-white/55 text-sm leading-relaxed mb-4">
            SHIKEN (試験 — "exam" in Japanese) is a <span className="text-white/75 font-semibold">free, AI-powered exam preparation app</span> built exclusively for Bihar Board Class 10 students. Every feature is designed to help students prepare smarter and score higher.
          </p>

          {/* Features grid */}
          <div className="grid grid-cols-1 gap-2 mb-4">
            {[
              {
                icon: "📚",
                title: "6 Core Subjects",
                desc: "Maths, Science, Social Science, Hindi, English, and Sanskrit — all Bihar Board syllabus.",
              },
              {
                icon: "🤖",
                title: "AI Explanations (Gemini)",
                desc: "Get instant step-by-step explanations for any question in Hindi or English, powered by Google Gemini.",
              },
              {
                icon: "📝",
                title: "AI-Generated Question Banks",
                desc: "Fresh practice questions are generated on-demand by AI, aligned with the Bihar Board pattern.",
              },
              {
                icon: "📊",
                title: "Progress Tracking",
                desc: "Track your scores, average accuracy, and subject-wise performance over time.",
              },
              {
                icon: "🏆",
                title: "Leaderboard",
                desc: "Compete with other students and see where you rank across all subjects.",
              },
              {
                icon: "🎓",
                title: "Career Counselling",
                desc: "Explore career paths and streams after Class 10 — Science, Commerce, Arts, and more.",
              },
            ].map((f) => (
              <div key={f.title} className="flex items-start gap-3 px-3 py-2.5 rounded-xl"
                style={{ background: "rgba(255,255,255,0.04)" }}>
                <span className="text-lg mt-0.5 flex-shrink-0">{f.icon}</span>
                <div>
                  <p className="text-white/85 text-xs font-bold">{f.title}</p>
                  <p className="text-white/35 text-xs leading-relaxed mt-0.5">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <p className="text-white/25 text-xs text-center leading-relaxed">
            Fully bilingual · Hindi &amp; English · 100% Free · No login required
          </p>
        </motion.div>

        {/* Share App */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18, duration: 0.5 }}
          className="rounded-2xl p-5 mb-6 relative overflow-hidden"
          style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.15) 0%, rgba(6,182,212,0.10) 100%)", border: "1px solid rgba(139,92,246,0.3)" }}>
          <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full blur-2xl opacity-20"
            style={{ background: "radial-gradient(circle, #8b5cf6, transparent)" }} />
          <div className="relative z-10 flex items-center gap-4">
            <div className="flex-1">
              <p className="text-white font-black text-sm mb-0.5">Share SHIKEN 🚀</p>
              <p className="text-white/45 text-xs leading-relaxed">
                Help a classmate prepare better — share this app with your friends!
              </p>
              <p className="text-violet-300/60 text-[11px] mt-1.5 font-medium truncate">{APP_URL}</p>
            </div>
            <motion.button
              onClick={handleShare}
              whileTap={{ scale: 0.95 }}
              className="relative flex-shrink-0 px-5 py-3 rounded-xl font-bold text-sm text-white overflow-hidden"
              style={{
                background: shared !== "idle"
                  ? "linear-gradient(135deg, #10b981, #059669)"
                  : "linear-gradient(135deg, #8b5cf6, #06b6d4)",
                boxShadow: shared !== "idle"
                  ? "0 4px 16px rgba(16,185,129,0.4)"
                  : "0 4px 20px rgba(139,92,246,0.45)",
                transition: "background 0.3s, box-shadow 0.3s",
              }}
            >
              <AnimatePresence mode="wait">
                {shared === "idle" && (
                  <motion.span key="idle" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                    className="flex items-center gap-1.5">
                    <svg viewBox="0 0 20 20" className="w-4 h-4" fill="none">
                      <path d="M13 4l4 4-4 4M3 12v-1a4 4 0 014-4h10" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Share
                  </motion.span>
                )}
                {shared === "copied" && (
                  <motion.span key="copied" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                    className="flex items-center gap-1.5">
                    <svg viewBox="0 0 20 20" className="w-4 h-4" fill="none">
                      <path d="M4 10l4 4 8-8" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Copied!
                  </motion.span>
                )}
                {shared === "shared" && (
                  <motion.span key="shared" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                    className="flex items-center gap-1.5">
                    <svg viewBox="0 0 20 20" className="w-4 h-4" fill="none">
                      <path d="M4 10l4 4 8-8" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Shared!
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          </div>

          {/* Quick share row */}
          <div className="relative z-10 flex items-center gap-2 mt-4 pt-4"
            style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
            <span className="text-white/25 text-[11px] font-semibold uppercase tracking-wider flex-shrink-0">Share via</span>
            {[
              {
                label: "WhatsApp",
                color: "#25d366",
                href: `https://wa.me/?text=${encodeURIComponent("🎓 Check out SHIKEN — Free AI-powered Bihar Board Class 10 prep! " + APP_URL)}`,
                icon: (
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.555 4.116 1.526 5.847L.057 23.882l6.198-1.625A11.93 11.93 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.793 9.793 0 01-5.012-1.376l-.36-.214-3.68.965.982-3.587-.234-.368A9.787 9.787 0 012.182 12C2.182 6.57 6.57 2.182 12 2.182S21.818 6.57 21.818 12 17.43 21.818 12 21.818z"/>
                  </svg>
                ),
              },
              {
                label: "Telegram",
                color: "#229ed9",
                href: `https://t.me/share/url?url=${encodeURIComponent(APP_URL)}&text=${encodeURIComponent("🎓 Free AI-powered Bihar Board Class 10 prep!")}`,
                icon: (
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
                    <path d="M11.944 0A12 12 0 100 12a12 12 0 0011.944-12zm3.037 7.28l-2.04 9.61c-.15.695-.547.866-1.107.538l-3.06-2.254-1.478 1.422c-.163.163-.3.3-.616.3l.22-3.105 5.65-5.107c.245-.218-.054-.34-.38-.122L6.4 13.807l-2.985-.935c-.648-.203-.66-.648.135-.96l11.66-4.495c.54-.196 1.012.132.77.862z"/>
                  </svg>
                ),
              },
            ].map((s) => (
              <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-opacity hover:opacity-80"
                style={{ background: `${s.color}22`, color: s.color, border: `1px solid ${s.color}33` }}>
                {s.icon}
                {s.label}
              </a>
            ))}
          </div>
        </motion.div>

        {/* Contact Form */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="rounded-2xl p-5 mb-6"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <p className="text-white font-bold text-sm mb-4">Send a Message</p>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <input value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Your name" required
              className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-white/25 outline-none"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)" }} />
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="Your email" required
              className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-white/25 outline-none"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)" }} />
            <textarea value={message} onChange={(e) => setMessage(e.target.value)}
              placeholder="Your message…" required rows={4}
              className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-white/25 outline-none resize-none"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)" }} />
            <motion.button type="submit" whileTap={{ scale: 0.98 }}
              className="w-full py-3.5 rounded-xl text-sm font-bold text-white"
              style={{ background: "linear-gradient(135deg,#06b6d4,#3b82f6)", boxShadow: "0 4px 16px rgba(6,182,212,0.3)" }}>
              Send Message →
            </motion.button>
          </form>
          <p className="text-white/20 text-xs text-center mt-3">Opens your default email app</p>
        </motion.div>

        {/* Direct contact */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }} className="mb-6">
          <a href={`mailto:${CONTACT_EMAIL}`}
            className="flex items-center gap-3 px-4 py-3.5 rounded-xl transition-colors"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <span className="text-xl">✉️</span>
            <div>
              <p className="text-white text-sm font-semibold">Email</p>
              <p className="text-white/40 text-xs">{CONTACT_EMAIL}</p>
            </div>
            <span className="ml-auto text-white/25 text-sm">→</span>
          </a>
        </motion.div>

        {/* Social Media */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}>
          <p className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-3">Follow Us</p>
          <div className="grid grid-cols-2 gap-2">
            {socials.map((s, i) => (
              <motion.a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer"
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.45 + i * 0.04 }}
                whileTap={{ scale: 0.97 }}
                className="flex items-center gap-2 px-4 py-3 rounded-xl transition-colors"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <span className="text-xl">{s.icon}</span>
                <span className="text-white/60 text-sm font-medium">{s.label}</span>
              </motion.a>
            ))}
          </div>
        </motion.div>

        <p className="text-white/15 text-xs text-center mt-8">SHIKEN v1.0 · Bihar Board Prep</p>
      </div>
    </div>
  );
}
