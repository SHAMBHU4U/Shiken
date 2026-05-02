import { useState } from "react";
import { motion } from "framer-motion";

const CONTACT_EMAIL = "your@email.com"; // ← UPDATE with your email

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
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-white text-sm"
              style={{ background: "conic-gradient(from 0deg, #8b5cf6, #06b6d4, #10b981, #f97316, #8b5cf6)" }}>
              S
            </div>
            <div>
              <p className="text-white font-black">SHIKEN</p>
              <p className="text-white/30 text-xs">Bihar Board Exam Preparation</p>
            </div>
          </div>
          <p className="text-white/45 text-xs leading-relaxed">
            SHIKEN is a free exam preparation app for Bihar Board students. Practice questions, track your progress, and get AI-powered explanations — all in Hindi and English.
          </p>
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
