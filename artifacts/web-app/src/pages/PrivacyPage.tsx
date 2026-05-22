import { motion } from "framer-motion";
import { useLocation } from "wouter";

const CONTACT_EMAIL = "shiken.query@gmail.com";
const LAST_UPDATED  = "May 3, 2025";

interface Section {
  id: string;
  icon: string;
  title: string;
  content: (string | { type: "list"; items: string[] })[];
}

const SECTIONS: Section[] = [
  {
    id: "intro",
    icon: "📋",
    title: "Introduction",
    content: [
      "SHIKEN is a board and entrance exam preparation platform. This Privacy Policy explains what information we collect when you use the app, how we use it, and the choices you have.",
      "By using SHIKEN, you agree to the practices described in this policy. If you do not agree, please stop using the app.",
    ],
  },
  {
    id: "collect",
    icon: "🗂️",
    title: "Information We Collect",
    content: [
      "We collect only what is necessary to provide and improve the service:",
      {
        type: "list",
        items: [
          "Device ID — A randomly generated identifier stored in your browser's local storage. It is used to save your progress without requiring account registration.",
          "Username — A display name you voluntarily enter. It appears on the leaderboard and is stored in our database.",
          "Quiz & Practice Data — Your subject choices, chapter selections, test scores, and timestamps so we can show you your progress history.",
          "Phone Number (optional) — Only if you choose to share it for WhatsApp-based support or payment confirmation. Never used for marketing without consent.",
          "Payment Information — If you subscribe to a premium plan, we record your subscription type, plan name, payment request timestamp, and validity period. We do not store any card or UPI credentials.",
          "App Ratings & Feedback — Stars and optional written comments you submit on the Contact page.",
        ],
      },
      "We do not collect your real name, government ID, location data, camera, or microphone access.",
    ],
  },
  {
    id: "use",
    icon: "⚙️",
    title: "How We Use Your Information",
    content: [
      "The information we collect is used solely to run and improve SHIKEN:",
      {
        type: "list",
        items: [
          "Saving and displaying your quiz progress and scores.",
          "Powering the leaderboard so students can see how they rank.",
          "Activating and verifying premium subscriptions.",
          "Sending WhatsApp confirmation messages when you request support or a payment is verified (only if you provided a phone number).",
          "Generating and caching practice questions using the Shiken Engine so they load faster on subsequent visits.",
          "Analysing overall usage patterns (not tied to personal identity) to improve question quality and app performance.",
        ],
      },
    ],
  },
  {
    id: "ai",
    icon: "🤖",
    title: "Shiken Engine & Third-Party Services",
    content: [
      "SHIKEN uses the following third-party services:",
      {
        type: "list",
        items: [
          "Google Firebase Realtime Database \u2014 stores quiz sessions, user metadata, and generated questions. Data is hosted on Google Cloud infrastructure.",
          "Google Firebase Authentication \u2014 used for user login (Google + Email/Password).",
          "Shiken Engine \u2014 generates practice questions from your chosen subject and chapter. Your question requests (subject + chapter name) are processed securely. No personal identifying information is included in these requests.",
        ],
      },
      "We do not sell, rent, or trade your information with any third party. Google's own privacy policy governs how Google processes data on its infrastructure.",
    ],
  },
  {
    id: "storage",
    icon: "🔒",
    title: "Data Storage & Security",
    content: [
      "All user data is stored in Google Firebase Realtime Database. Firebase uses industry-standard HTTPS encryption in transit and Google's security practices at rest.",
      "Your device ID and username are also stored in your browser's local storage (localStorage). Clearing your browser data will remove this local copy, though your progress record in Firebase will remain.",
      "We take reasonable precautions to protect your data, but no internet-based system can be guaranteed 100% secure.",
    ],
  },
  {
    id: "retention",
    icon: "🗓️",
    title: "Data Retention",
    content: [
      "We retain quiz session data and leaderboard entries for as long as the app is active or until you request deletion.",
      "If you request account or data deletion, write to us at the contact email below and we will remove your records from our Firebase database within 14 business days.",
    ],
  },
  {
    id: "children",
    icon: "🎓",
    title: "Students & Minors",
    content: [
      "SHIKEN is designed for board & competitive students, who are typically 14–18 years old. We are aware that our primary users may be minors.",
      "We do not knowingly collect sensitive personal information from minors beyond what is described in this policy. We do not run targeted advertising.",
      "Parents or guardians who believe their child's data has been collected inappropriately may contact us to request review or deletion.",
    ],
  },
  {
    id: "rights",
    icon: "✅",
    title: "Your Rights & Choices",
    content: [
      "You have the following rights with respect to your data:",
      {
        type: "list",
        items: [
          "Access — You can request a summary of data we hold associated with your device ID.",
          "Correction — You can update your username at any time from the Profile page.",
          "Deletion — You can request full deletion of your data by emailing us.",
          "Opt-out of leaderboard — You may choose not to enter a username; your scores will then appear anonymously.",
        ],
      },
    ],
  },
  {
    id: "changes",
    icon: "📝",
    title: "Changes to This Policy",
    content: [
      "We may update this Privacy Policy from time to time. When we do, we will update the 'Last updated' date at the top of this page.",
      "Continued use of SHIKEN after a policy change constitutes acceptance of the revised policy.",
    ],
  },
  {
    id: "contact",
    icon: "📬",
    title: "Contact Us",
    content: [
      `If you have any questions, concerns, or requests regarding this Privacy Policy or your personal data, please reach out to us at: ${CONTACT_EMAIL}`,
      "We aim to respond to all privacy-related enquiries within 7 business days.",
    ],
  },
];

export default function PrivacyPage() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen w-full" style={{ background: "#07080f" }}>
      <div className="max-w-lg mx-auto px-4 pt-6 pb-32">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.23, 1, 0.32, 1] }}
          className="mb-8"
        >
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 text-white/35 hover:text-white/65 transition-colors text-sm mb-6"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Back
          </button>

          <div className="flex items-center gap-3 mb-3">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl shrink-0"
              style={{ background: "linear-gradient(135deg, #8b5cf620, #06b6d420)", border: "1px solid rgba(139,92,246,0.25)" }}>
              🔏
            </div>
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight">Privacy Policy</h1>
              <p className="text-white/30 text-xs mt-0.5">Last updated: {LAST_UPDATED}</p>
            </div>
          </div>

          <p className="text-white/40 text-sm leading-relaxed">
            SHIKEN is committed to protecting your privacy. This page explains clearly what we collect and why.
          </p>
        </motion.div>

        {/* Table of contents quick-links */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="rounded-2xl border mb-8 px-4 py-4"
          style={{ background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.18)" }}
        >
          <p className="text-white/50 text-xs font-semibold uppercase tracking-widest mb-3">Contents</p>
          <div className="flex flex-col gap-1.5">
            {SECTIONS.map((s, i) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="flex items-center gap-2.5 text-sm text-white/45 hover:text-white/80 transition-colors"
              >
                <span className="text-white/20 text-xs w-4 shrink-0 font-mono">{String(i + 1).padStart(2, "0")}</span>
                <span className="text-base leading-none">{s.icon}</span>
                <span>{s.title}</span>
              </a>
            ))}
          </div>
        </motion.div>

        {/* Sections */}
        <div className="flex flex-col gap-5">
          {SECTIONS.map((section, idx) => (
            <motion.div
              key={section.id}
              id={section.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 + idx * 0.05, duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
              className="rounded-2xl border overflow-hidden"
              style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(0,0,0,0.08)" }}
            >
              {/* Section header */}
              <div className="flex items-center gap-3 px-4 pt-4 pb-3"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <span className="text-xl shrink-0">{section.icon}</span>
                <h2 className="text-white font-bold text-sm">{section.title}</h2>
              </div>

              {/* Section body */}
              <div className="px-4 py-3 flex flex-col gap-3">
                {section.content.map((block, bi) => {
                  if (typeof block === "string") {
                    return (
                      <p key={bi} className="text-white/55 text-sm leading-relaxed">
                        {block}
                      </p>
                    );
                  }
                  return (
                    <ul key={bi} className="flex flex-col gap-2">
                      {block.items.map((item, ii) => {
                        const colonIdx = item.indexOf(" — ");
                        const hasLabel = colonIdx !== -1;
                        return (
                          <li key={ii} className="flex items-start gap-2.5 text-sm">
                            <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0"
                              style={{ background: "rgba(139,92,246,0.6)" }} />
                            <span className="text-white/50 leading-relaxed">
                              {hasLabel ? (
                                <>
                                  <span className="text-white/75 font-semibold">{item.slice(0, colonIdx)}</span>
                                  {item.slice(colonIdx)}
                                </>
                              ) : item}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  );
                })}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Footer note */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7, duration: 0.5 }}
          className="mt-8 rounded-2xl px-4 py-4 text-center"
          style={{ background: "rgba(6,182,212,0.05)", border: "1px solid rgba(6,182,212,0.15)" }}
        >
          <p className="text-white/40 text-xs leading-relaxed">
            Questions about your privacy?{" "}
            <a href={`mailto:${CONTACT_EMAIL}`}
              className="text-cyan-400/80 hover:text-cyan-400 transition-colors font-semibold">
              {CONTACT_EMAIL}
            </a>
          </p>
          <p className="text-white/20 text-xs mt-3 flex items-center justify-center gap-2">
            <a href="/terms" className="text-white/25 hover:text-white/50 transition-colors underline underline-offset-2">
              Terms of Use
            </a>
            <span className="text-white/15">·</span>
            <a href="/contact" className="text-white/25 hover:text-white/50 transition-colors underline underline-offset-2">
              Contact Us
            </a>
          </p>
        </motion.div>

      </div>
    </div>
  );
}
