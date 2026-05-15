import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { db } from "@/firebase";
import { ref, set, get, onValue } from "firebase/database";

const CONTACT_EMAIL = "shiken.query@gmail.com";
const APP_URL = import.meta.env.VITE_APP_URL ?? window.location.origin;

const DEVICE_KEY = "shiken_device_id";
function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) { id = crypto.randomUUID(); localStorage.setItem(DEVICE_KEY, id); }
  return id;
}

interface RatingEntry { stars: number; feedback: string; ts: number; }
interface RatingSummary { avg: number; count: number; myStars: number; }

const socials = [
  { icon: "📘", label: "Facebook",  href: "#", color: "#1877f2" },
  { icon: "📸", label: "Instagram", href: "https://instagram.com/shiken4u", color: "#e1306c" },
  { icon: "🎬", label: "YouTube",   href: "https://youtube.com/@shiken4u", color: "#ff0000" },
  { icon: "🐦", label: "Twitter/X", href: "https://twitter.com/Shiken463554", color: "#1d9bf0" },
];

export default function ContactPage() {
  const [name,    setName]    = useState("");
  const [email,   setEmail]   = useState("");
  const [message, setMessage] = useState("");
  const [shared,  setShared]  = useState<"idle" | "copied" | "shared">("idle");

  // ── Rating state ────────────────────────────────────────────────
  const [hovered,   setHovered]   = useState(0);
  const [selected,  setSelected]  = useState(0);
  const [feedback,  setFeedback]  = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting,setSubmitting]= useState(false);
  const [summary,   setSummary]   = useState<RatingSummary>({ avg: 0, count: 0, myStars: 0 });

  useEffect(() => {
    const deviceId = getDeviceId();
    const ratingsRef = ref(db, "ratings");
    const unsub = onValue(ratingsRef, (snap) => {
      if (!snap.exists()) return;
      const data = snap.val() as Record<string, RatingEntry>;
      const entries = Object.entries(data);
      const total = entries.reduce((s, [, v]) => s + v.stars, 0);
      const avg   = entries.length ? total / entries.length : 0;
      const myEntry = data[deviceId.replace(/[.#$[\]]/g, "_")];
      setSummary({ avg, count: entries.length, myStars: myEntry?.stars ?? 0 });
      if (myEntry) { setSelected(myEntry.stars); setSubmitted(true); }
    });
    return () => unsub();
  }, []);

  async function handleRatingSubmit() {
    if (!selected) return;
    setSubmitting(true);
    const deviceId = getDeviceId().replace(/[.#$[\]]/g, "_");
    await set(ref(db, `ratings/${deviceId}`), {
      stars: selected, feedback: feedback.trim(), ts: Date.now(),
    });
    setSubmitting(false);
    setSubmitted(true);
  }

  async function handleShare() {
    const shareData = {
      title: "SHIKEN — Board & Entrance Prep",
      text: "🎓 Exam prep for BSEB Board Exam & Entrance Exam like JEE NEET! Practice questions in Hindi & English with instant Shiken Engine explanations.",
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
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(0,0,0,0.08)" }}>

          {/* Brand row */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: "linear-gradient(145deg, #5b21b6, #312e81, #0c4a6e)", boxShadow: "0 4px 16px rgba(139,92,246,0.4)" }}>
              <img src="/shiken-logo.png" alt="SHIKEN" className="w-8 h-8 object-contain" />
            </div>
            <div>
              <p className="text-white font-black text-base tracking-tight">SHIKEN · शिकेन</p>
              <p className="text-violet-400/70 text-xs font-medium">Board & Entrace Exam · Shiken Engine</p>
            </div>
          </div>

          {/* Description */}
          <p className="text-white/55 text-sm leading-relaxed mb-4">
            SHIKEN (試験 — "exam" in Japanese) is a <span className="text-white/75 font-semibold"> exam preparation app</span> built exclusively for BSEB Board & JEE,NEET Students. Every feature is designed to help students prepare smarter and score higher.
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
                title: "Shiken Explanation",
                desc: "Get instant step-by-step explanations for any question in Hindi or English, powered by Shiken Engine.",
              },
              {
                icon: "📝",
                title: "Shiken Engine-Generated Question Banks",
                desc: "Fresh practice questions are generated on-demand by Shiken Engine, aligned with the Bihar Board pattern.",
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
                style={{ background: "rgba(255,255,255,0.05)" }}>
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
            style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <span className="text-white/25 text-[11px] font-semibold uppercase tracking-wider flex-shrink-0">Share via</span>
            {[
              {
                label: "WhatsApp",
                color: "#25d366",
                href: `https://wa.me/?text=${encodeURIComponent("🎓 Check out SHIKEN — Best Exam prep App! " + APP_URL)}`,
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
                href: `https://t.me/share/url?url=${encodeURIComponent(APP_URL)}&text=${encodeURIComponent("🎓 Board & Entrance prep with Shiken Engine!")}`,
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
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(0,0,0,0.08)" }}>
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

        {/* Rate this App */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28, duration: 0.5 }}
          className="rounded-2xl p-5 mb-6"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(0,0,0,0.08)" }}>

          {/* Header row with aggregate */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-white font-black text-sm">Rate this App</p>
              <p className="text-white/35 text-xs mt-0.5">Your feedback helps us improve</p>
            </div>
            {summary.count > 0 && (
              <div className="text-right">
                <div className="flex items-center gap-1 justify-end">
                  <span className="text-amber-400 text-sm">★</span>
                  <span className="text-white font-black text-sm">{summary.avg.toFixed(1)}</span>
                </div>
                <p className="text-white/25 text-[11px]">{summary.count} {summary.count === 1 ? "rating" : "ratings"}</p>
              </div>
            )}
          </div>

          <AnimatePresence mode="wait">
            {submitted ? (
              <motion.div key="thanks"
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                className="flex flex-col items-center py-4 gap-3">
                <div className="flex gap-1">
                  {[1,2,3,4,5].map((s) => (
                    <span key={s} className="text-2xl transition-all"
                      style={{ color: s <= selected ? "#fbbf24" : "rgba(255,255,255,0.12)" }}>★</span>
                  ))}
                </div>
                <p className="text-white font-bold text-sm">Thanks for rating! 🎉</p>
                <p className="text-white/35 text-xs text-center">You gave {selected} star{selected !== 1 ? "s" : ""}. You can update your rating anytime.</p>
                <button onClick={() => setSubmitted(false)}
                  className="text-violet-400 text-xs font-semibold mt-1 hover:text-violet-300 transition-colors">
                  Edit rating →
                </button>
              </motion.div>
            ) : (
              <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {/* Star selector */}
                <div className="flex justify-center gap-2 mb-4">
                  {[1,2,3,4,5].map((s) => (
                    <motion.button key={s}
                      whileTap={{ scale: 0.85 }}
                      onMouseEnter={() => setHovered(s)}
                      onMouseLeave={() => setHovered(0)}
                      onClick={() => setSelected(s)}
                      className="text-3xl transition-all duration-150 select-none"
                      style={{
                        color: s <= (hovered || selected) ? "#fbbf24" : "rgba(255,255,255,0.14)",
                        filter: s <= (hovered || selected) ? "drop-shadow(0 0 6px rgba(251,191,36,0.6))" : "none",
                        transform: s <= (hovered || selected) ? "scale(1.15)" : "scale(1)",
                      }}>
                      ★
                    </motion.button>
                  ))}
                </div>

                {/* Label */}
                <AnimatePresence mode="wait">
                  {(hovered || selected) > 0 && (
                    <motion.p key={hovered || selected}
                      initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                      className="text-center text-xs font-semibold mb-3"
                      style={{ color: "#fbbf24" }}>
                      {["", "Poor 😞", "Fair 😐", "Good 🙂", "Great 😊", "Excellent! 🤩"][hovered || selected]}
                    </motion.p>
                  )}
                </AnimatePresence>

                {/* Feedback */}
                <textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Any suggestions? (optional)"
                  rows={2}
                  maxLength={200}
                  className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-white/25 outline-none resize-none mb-3"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)" }}
                />

                <motion.button
                  onClick={handleRatingSubmit}
                  whileTap={{ scale: 0.97 }}
                  disabled={!selected || submitting}
                  className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all"
                  style={{
                    background: selected
                      ? "linear-gradient(135deg, #f59e0b, #f97316)"
                      : "rgba(255,255,255,0.06)",
                    color: selected ? "white" : "rgba(255,255,255,0.20)",
                    boxShadow: selected ? "0 4px 16px rgba(245,158,11,0.35)" : "none",
                    cursor: selected ? "pointer" : "not-allowed",
                  }}>
                  {submitting ? "Submitting…" : selected ? `Submit ${selected}-Star Rating` : "Select a rating above"}
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Direct contact */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }} className="mb-6">
          <a href={`mailto:${CONTACT_EMAIL}`}
            className="flex items-center gap-3 px-4 py-3.5 rounded-xl transition-colors"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(0,0,0,0.08)" }}>
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
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(0,0,0,0.08)" }}>
                <span className="text-xl">{s.icon}</span>
                <span className="text-white/60 text-sm font-medium">{s.label}</span>
              </motion.a>
            ))}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
          className="flex items-center justify-center gap-2 mt-8 flex-wrap">
          <a href="/privacy"
            className="text-white/25 hover:text-white/50 text-xs transition-colors underline underline-offset-2">
            Privacy
          </a>
          <span className="text-white/15 text-xs">·</span>
          <a href="/terms"
            className="text-white/25 hover:text-white/50 text-xs transition-colors underline underline-offset-2">
            Terms
          </a>
          <span className="text-white/15 text-xs">·</span>
          <span className="text-white/15 text-xs">SHIKEN v1.0</span>
        </motion.div>
      </div>
    </div>
  );
}
