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
    id: "acceptance",
    icon: "📋",
    title: "Acceptance of Terms",
    content: [
      "By downloading, installing, or using SHIKEN, you agree to be bound by these Terms of Use. If you do not agree to these terms, you may not use the app.",
      "These terms are subject to change at any time. Continued use of SHIKEN after changes constitutes acceptance of the modified terms.",
    ],
  },
  {
    id: "license",
    icon: "📖",
    title: "Use License & Restrictions",
    content: [
      "SHIKEN grants you a non-exclusive, limited license to use the app for personal educational purposes only.",
      {
        type: "list",
        items: [
          "You may not sell, rent, distribute, or modify any part of SHIKEN or its content.",
          "You may not reproduce, republish, or transmit questions, answers, or explanations without explicit permission.",
          "You may not use SHIKEN for commercial purposes, coaching businesses, or coaching centres without a written agreement.",
          "You may not attempt to hack, reverse-engineer, or circumvent any security features.",
          "You may not scrape or automate the collection of data from SHIKEN.",
        ],
      },
    ],
  },
  {
    id: "content",
    icon: "📚",
    title: "Educational Content & Shiken Engine-Generated Questions",
    content: [
      "SHIKEN provides practice questions and explanations powered by the Shiken Engine.",
      "While we strive for accuracy, generated content may occasionally contain errors or incomplete explanations. We do not guarantee that all questions and answers are 100% correct.",
      "Questions are cached and reused across students to improve load times. This is normal and helps the app run faster.",
      "Official Bihar Board textbooks and past exam papers remain the authoritative source for exam preparation. SHIKEN is a supplement, not a replacement.",
    ],
  },
  {
    id: "premium",
    icon: "👑",
    title: "Premium Subscription",
    content: [
      "SHIKEN offers two premium subscription plans:",
      {
        type: "list",
        items: [
          "Basic Monthly (₹49) — 30-day access to premium features.",
          "Topper's Choice (₹199) — 6-month access to premium features.",
        ],
      },
      "Premium features may include access to additional questions, full tests, and priority support. Features may be added or changed over time.",
      "Refunds: All subscription purchases are final. We do not offer refunds or credits for partial usage. You can cancel your subscription at any time, and access will end at the end of your paid period.",
      "Refund requests due to app performance issues must be submitted within 7 days of purchase with supporting evidence. Refunds are at our sole discretion.",
    ],
  },
  {
    id: "payments",
    icon: "💳",
    title: "Payments & Billing",
    content: [
      "When you purchase a premium subscription, you authorize us to charge the amount shown at the time of purchase.",
      "All payments are processed securely. We do not store your card or UPI details — this is handled by our payment processor.",
      "Subscription renewal and billing cycles will be clearly indicated before purchase.",
      "If you believe you were charged incorrectly, please contact us at the email below within 14 days of the transaction.",
    ],
  },
  {
    id: "ip",
    icon: "©️",
    title: "Intellectual Property",
    content: [
      "All content in SHIKEN — including questions, explanations, branding, code, and design — is owned by SHIKEN or our licensors.",
      "You retain ownership of any notes or custom content you create within the app.",
      "Unauthorized reproduction or distribution of our content is prohibited and may result in legal action.",
    ],
  },
  {
    id: "conduct",
    icon: "⚠️",
    title: "Prohibited Conduct",
    content: [
      "You agree not to:",
      {
        type: "list",
        items: [
          "Harass, threaten, or abuse other users (including on leaderboards).",
          "Use fake or misleading usernames to impersonate others.",
          "Submit false or defamatory content.",
          "Engage in any illegal activity.",
          "Interfere with or disrupt the normal operation of SHIKEN.",
          "Use bots, scrapers, or automated tools to gain unfair advantage on leaderboards.",
        ],
      },
      "Violation of these rules may result in account suspension or termination without refund.",
    ],
  },
  {
    id: "termination",
    icon: "🚫",
    title: "Termination of Service",
    content: [
      "We reserve the right to suspend or terminate your access to SHIKEN at any time if you:",
      {
        type: "list",
        items: [
          "Violate these terms or our Privacy Policy.",
          "Engage in abusive, harassing, or illegal behavior.",
          "Attempt to hack or exploit security vulnerabilities.",
          "Violate copyright or intellectual property rights.",
        ],
      },
      "Termination is at our sole discretion. No refund will be provided for unused premium time if your account is terminated due to violation of these terms.",
    ],
  },
  {
    id: "disclaimers",
    icon: "⚡",
    title: "Disclaimers & Limitations",
    content: [
      "SHIKEN is provided \"as is\" without warranties of any kind, expressed or implied.",
      "We do not guarantee that:",
      {
        type: "list",
        items: [
          "The app will be uninterrupted, error-free, or always available.",
          "Exam questions will match the actual Bihar Board exam.",
          "Using SHIKEN will guarantee passing or scoring any particular grade.",
          "All generated questions are 100% accurate.",
        ],
      },
      "Your success depends on your effort, understanding, and preparation. SHIKEN is a tool to aid learning, not a guarantee of success.",
    ],
  },
  {
    id: "liability",
    icon: "⚖️",
    title: "Limitation of Liability",
    content: [
      "To the maximum extent permitted by law, SHIKEN is not liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the app — including loss of data, lost revenue, or poor exam performance.",
      "Our total liability is limited to the amount you paid for your subscription in the last 12 months.",
    ],
  },
  {
    id: "changes",
    icon: "📝",
    title: "Changes to Terms",
    content: [
      "We may update these Terms of Use at any time. When we do, we will update the 'Last updated' date at the top of this page.",
      "Your continued use of SHIKEN after any changes constitutes acceptance of the new terms.",
    ],
  },
  {
    id: "contact",
    icon: "📬",
    title: "Contact Us",
    content: [
      `If you have questions or concerns about these Terms of Use, please email us at: ${CONTACT_EMAIL}`,
      "We will respond to all inquiries within 7 business days.",
    ],
  },
];

export default function TermsPage() {
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
              style={{ background: "linear-gradient(135deg, #06b6d420, #10b98120)", border: "1px solid rgba(6,182,212,0.25)" }}>
              ⚖️
            </div>
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight">Terms of Use</h1>
              <p className="text-white/30 text-xs mt-0.5">Last updated: {LAST_UPDATED}</p>
            </div>
          </div>

          <p className="text-white/40 text-sm leading-relaxed">
            These Terms of Use govern your use of SHIKEN. Please read them carefully.
          </p>
        </motion.div>

        {/* Table of contents */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="rounded-2xl border mb-8 px-4 py-4"
          style={{ background: "rgba(6,182,212,0.06)", border: "1px solid rgba(6,182,212,0.18)" }}
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
                              style={{ background: "rgba(6,182,212,0.6)" }} />
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
          style={{ background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.15)" }}
        >
          <p className="text-white/40 text-xs leading-relaxed">
            Questions about our Terms?{" "}
            <a href={`mailto:${CONTACT_EMAIL}`}
              className="text-red-400/80 hover:text-red-400 transition-colors font-semibold">
              {CONTACT_EMAIL}
            </a>
          </p>
          <p className="text-white/20 text-xs mt-1">SHIKEN — Bihar Board Class 10 Exam Prep</p>
        </motion.div>

      </div>
    </div>
  );
}
