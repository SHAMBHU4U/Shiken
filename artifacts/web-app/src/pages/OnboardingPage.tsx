import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Eye,
  EyeOff,
  GraduationCap,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";

export interface OnboardingValues {
  fullName: string;
  mobileNumber: string;
  email: string;
  state: string;
  district: string;
  village: string;
  password: string;
  confirmPassword: string;
}

export interface OnboardingPageProps {
  initialValues: OnboardingValues;
  onRegister: (values: OnboardingValues) => Promise<void>;
  onVerify: () => Promise<boolean>;
  onResendVerification: () => Promise<void>;
  onSelectExams: (examIds: string[]) => Promise<void>;
  onSkipExams: () => Promise<void>;
  onSignOut: () => Promise<void>;
  onComplete?: () => void;
  isAuthenticated: boolean;
  emailVerified: boolean;
  registering: boolean;
  verifying: boolean;
  saving: boolean;
  verificationError: string;
  registrationError: string;
}

type Step = 0 | 1 | 2 | 3;
type ExamId = "neet" | "jee-main" | "class-10" | "class-12" | "cuet" | "ssc" | "railway" | "banking" | "defence" | "state-govt" | "iit" | "nta" | "crpf" | "bpsc-cce";

const STEPS = [
  { label: "Profile", caption: "A little about you", icon: UserRound },
  { label: "Password", caption: "Secure your account", icon: KeyRound },
  { label: "Verify", caption: "Confirm your email", icon: ShieldCheck },
  { label: "Exams", caption: "Choose your focus", icon: GraduationCap },
] as const;

const STATES = [
  "Andhra Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Delhi",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Tamil Nadu",
  "Telangana",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
];

const DISTRICTS: Record<string, string[]> = {
  Bihar: ["Patna", "Gaya", "Muzaffarpur", "Bhagalpur", "Darbhanga", "Nalanda", "Vaishali"],
  Delhi: ["Central Delhi", "East Delhi", "New Delhi", "North Delhi", "South Delhi", "West Delhi"],
  Jharkhand: ["Ranchi", "Dhanbad", "Bokaro", "Jamshedpur", "Hazaribagh"],
  Maharashtra: ["Mumbai", "Pune", "Nagpur", "Nashik", "Thane", "Aurangabad"],
  Rajasthan: ["Jaipur", "Jodhpur", "Kota", "Udaipur", "Ajmer", "Bikaner"],
  "Uttar Pradesh": ["Lucknow", "Kanpur", "Varanasi", "Prayagraj", "Agra", "Meerut", "Gorakhpur"],
  "West Bengal": ["Kolkata", "Howrah", "Darjeeling", "Siliguri", "Durgapur"],
};

const EXAMS: Array<{
  id: ExamId;
  shortLabel: string;
  title: string;
  description: string;
  subjects: string[];
  tint: string;
}> = [
  {
    id: "neet",
    shortLabel: "NEET",
    title: "Medical entrance",
    description: "Build a steady Physics, Chemistry and Biology rhythm.",
    subjects: ["PCB", "MCQ practice"],
    tint: "coral",
  },
  {
    id: "jee-main",
    shortLabel: "JEE",
    title: "Engineering entrance",
    description: "Keep concepts sharp across Physics, Chemistry and Maths.",
    subjects: ["PCM", "Numericals"],
    tint: "blue",
  },
  {
    id: "class-10",
    shortLabel: "10",
    title: "Class 10 boards",
    description: "Organise your board subjects before the final stretch.",
    subjects: ["Maths", "Science"],
    tint: "gold",
  },
  {
    id: "class-12",
    shortLabel: "12",
    title: "Class 12 boards",
    description: "Plan revision around the subjects that matter most.",
    subjects: ["Boards", "Revision"],
    tint: "teal",
  }, 
  {
    id: "ssc",
    shortLabel: "SSC",
    title: "SSC exams",
    description: "Build a strong base for SSC aptitude and general awareness.",
    subjects: ["Aptitude", "GK"],
    tint: "blue",
  },
  {
    id: "railway",
    shortLabel: "RRB",
    title: "Railway exams",
    description: "Keep RRB reasoning and general science practice focused.",
    subjects: ["Reasoning", "Science"],
    tint: "gold",
  },
  {
    id: "bpsc-cce",
    shortLabel: "BPSC",
    title: "BPSC Prelims CCE",
    description: "Prepare with bilingual Bihar-focused PYQs, mocks and current affairs.",
    subjects: ["Bihar GK", "GS", "Aptitude"],
    tint: "teal",
  },
];

const initialForm: OnboardingValues = {
  fullName: "",
  mobileNumber: "",
  email: "",
  state: "",
  district: "",
  village: "",
  password: "",
  confirmPassword: "",
};

function FieldLabel({
  htmlFor,
  children,
  optional = false,
}: {
  htmlFor: string;
  children: string;
  optional?: boolean;
}) {
  return (
    <label htmlFor={htmlFor} className="mb-2 flex items-center justify-between text-[13px] font-semibold tracking-[-0.01em] text-[#24364b]">
      <span>{children}</span>
      {optional ? <span className="font-normal text-[#8a99a9]">Optional</span> : null}
    </label>
  );
}

function FieldError({ id, children }: { id: string; children: string }) {
  return (
    <p id={id} data-testid={id} className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-[#c6503d]" role="alert">
      <AlertCircle size={13} strokeWidth={2.5} aria-hidden="true" />
      {children}
    </p>
  );
}

function BusyLabel({ children }: { children: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />
      {children}
    </span>
  );
}

export default function OnboardingPage({
  initialValues,
  onRegister,
  onVerify,
  onResendVerification,
  onSelectExams,
  onSkipExams,
  onSignOut,
  onComplete,
  isAuthenticated,
  emailVerified,
  registering,
  verifying,
  saving,
  verificationError,
  registrationError,
}: OnboardingPageProps) {
  const [form, setForm] = useState<OnboardingValues>({ ...initialForm, ...initialValues });
  const [step, setStep] = useState<Step>(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState("");
  const [selectedExams, setSelectedExams] = useState<ExamId[]>([]);
  const [verificationChecked, setVerificationChecked] = useState(false);
  const [resending, setResending] = useState(false);
  const [examAction, setExamAction] = useState<"save" | "skip" | null>(null);
  const [completed, setCompleted] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    setForm((current) => ({
      ...current,
      fullName: current.fullName || initialValues.fullName,
      mobileNumber: current.mobileNumber || initialValues.mobileNumber,
      email: current.email || initialValues.email,
      state: current.state || initialValues.state,
      district: current.district || initialValues.district,
      village: current.village || initialValues.village,
    }));
  }, [
    initialValues.fullName,
    initialValues.mobileNumber,
    initialValues.email,
    initialValues.state,
    initialValues.district,
    initialValues.village,
  ]);

  useEffect(() => {
    if (emailVerified && step === 2) {
      setStep(3);
      setVerificationChecked(true);
    }
  }, [emailVerified, step]);

  const updateField = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value, ...(name === "state" ? { district: "" } : {}) }));
    setErrors((current) => {
      if (!current[name]) return current;
      const next = { ...current };
      delete next[name];
      return next;
    });
    setActionError("");
  };

  const validateProfile = () => {
    const next: Record<string, string> = {};
    if (form.fullName.trim().length < 2) next.fullName = "Enter your full name.";
    const digits = form.mobileNumber.replace(/\D/g, "");
    if (digits.length < 10) next.mobileNumber = "Enter a valid 10-digit mobile number.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) next.email = "Enter a valid email address.";
    if (!form.state) next.state = "Select your state.";
    if (!form.district.trim()) next.district = "Enter your district.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const validatePassword = () => {
    const next: Record<string, string> = {};
    if (form.password.length < 6) next.password = "Use at least 6 characters.";
    if (form.confirmPassword !== form.password) next.confirmPassword = "Passwords do not match.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleNext = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setActionError("");

    if (step === 0) {
      if (validateProfile()) setStep(1);
      return;
    }

    if (step === 1) {
      if (!validatePassword()) return;
      try {
        await onRegister(form);
        setStep(3);
      } catch {
        setActionError("We could not create your account. Please check your details and try again.");
      }
      return;
    }

 //   if (step === 2) {
      if (emailVerified) {
        setStep(3);
        return;
      }
      try {
        const verified = await onVerify();
        setVerificationChecked(true);
        if (verified) setStep(3);
      } catch {
        setActionError("We could not check your verification yet. Please try again.");
      }
    }
  };

  const handleResend = async () => {
    setActionError("");
    setResending(true);
    try {
      await onResendVerification();
    } catch {
      setActionError("The verification email could not be sent. Please try again.");
    } finally {
      setResending(false);
    }
  };

  const toggleExam = (examId: ExamId) => {
    setSelectedExams((current) =>
      current.includes(examId) ? current.filter((id) => id !== examId) : [...current, examId],
    );
  };

  const saveExams = async () => {
    if (selectedExams.length === 0) {
      setErrors({ exams: "Choose at least one stream, or skip this step." });
      return;
    }
    setErrors({});
    setActionError("");
    setExamAction("save");
    try {
      await onSelectExams(selectedExams);
      setCompleted(true);
    } catch {
      setActionError("Your exam choices were not saved. Please try again.");
    } finally {
      setExamAction(null);
    }
  };

  const skipExams = async () => {
    setErrors({});
    setActionError("");
    setExamAction("skip");
    try {
      await onSkipExams();
      setCompleted(true);
    } catch {
      setActionError("We could not skip this step right now. Please try again.");
    } finally {
      setExamAction(null);
    }
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await onSignOut();
    } catch {
      setActionError("You could not be signed out. Please try again.");
      setSigningOut(false);
    }
  };

  const goBack = () => {
    setActionError("");
    setErrors({});
    setStep((current) => (current > 0 ? ((current - 1) as Step) : current));
  };

  const currentStep = STEPS[step];
  const emailDisplay = form.email || "your email address";
  const districtOptions = DISTRICTS[form.state] ?? [];

  return (
    <main className="min-h-[100dvh] overflow-x-hidden bg-[#edf4ff] text-[#102e55]">
      <div className="pointer-events-none fixed inset-0 opacity-60" aria-hidden="true">
        <div className="absolute -left-20 top-24 h-72 w-72 rounded-full bg-[#cfe2ff] blur-3xl" />
        <div className="absolute -right-20 bottom-0 h-96 w-96 rounded-full bg-[#c8eee8] blur-3xl" />
      </div>

      <header className="relative z-10 mx-auto flex w-full max-w-[1240px] items-center justify-between px-5 py-5 sm:px-8 lg:px-12">
        <div className="flex items-center gap-3" data-testid="text-brand">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#d5e5f7] bg-white p-1.5 shadow-[0_8px_18px_rgba(31,78,121,0.12)]">
            <img src="/shiken-logo.png" alt="SHIKEN logo" className="h-full w-full rounded-xl object-contain" />
          </div>
          <div>
            <p className="text-[15px] font-black leading-none tracking-[0.22em] text-[#163a63]">SHIKEN</p>
            <p className="mt-1 text-[9px] font-bold leading-none tracking-[0.14em] text-[#4e7194]">PREPARE WITH PURPOSE</p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          data-testid="button-sign-out"
          className="inline-flex items-center gap-2 rounded-full border border-[#c9ddf4] bg-white/90 px-3.5 py-2 text-xs font-bold text-[#52708f] shadow-sm transition-colors hover:border-[#9dbfe5] hover:text-[#163a63] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {signingOut ? <LoaderCircle size={14} className="animate-spin" aria-hidden="true" /> : isAuthenticated ? <LogOut size={14} aria-hidden="true" /> : <ArrowLeft size={14} aria-hidden="true" />}
          <span>{signingOut ? "Signing out" : isAuthenticated ? "Sign out" : "Back to sign in"}</span>
        </button>
      </header>

      <div className="relative z-10 mx-auto grid w-full max-w-[1240px] gap-8 px-5 pb-10 pt-2 sm:px-8 lg:grid-cols-[280px_minmax(0,720px)] lg:gap-16 lg:px-12 lg:pb-16 lg:pt-10">
        <aside className="lg:pt-7">
          <div className="mb-7 max-w-[520px]">
            <p className="mb-3 inline-flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#2c8d78]">
              <Sparkles size={14} strokeWidth={2.2} aria-hidden="true" />
              Your study profile
            </p>
            <h1 className="max-w-[540px] text-[clamp(2.2rem,7vw,4.1rem)] font-black leading-[0.98] tracking-[-0.065em] text-[#163a63]">
              Start where
              <span className="block text-[#1763c4]">you are.</span>
            </h1>
            <p className="mt-4 max-w-[420px] text-[15px] font-medium leading-6 text-[#52708f]">
              A few details now, a clearer path to your next exam later. You can change your choices anytime.
            </p>
          </div>

          <nav aria-label="Onboarding progress" className="grid grid-cols-4 gap-2 lg:block lg:space-y-2">
            {STEPS.map((item, index) => {
              const Icon = item.icon;
              const isActive = index === step;
              const isDone = index < step || (index === 2 && emailVerified);
              return (
                <div
                  key={item.label}
                  data-testid={`step-${item.label.toLowerCase()}`}
                  aria-current={isActive ? "step" : undefined}
                  className={`relative flex items-center gap-3 rounded-2xl px-1 py-2.5 transition-colors lg:px-3 ${
                    isActive ? "bg-[#e1efff] lg:py-3" : ""
                  }`}
                >
                  <div
                    className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-sm transition-colors ${
                      isDone
                         ? "border-[#1aa394] bg-[#1aa394] text-white"
                        : isActive
                           ? "border-[#1763c4] bg-[#1763c4] text-white"
                           : "border-[#c9ddf4] bg-[#f6f9fd] text-[#829bb5]"
                    }`}
                  >
                    {isDone ? <Check size={16} strokeWidth={3} aria-hidden="true" /> : <Icon size={16} aria-hidden="true" />}
                  </div>
                  <div className="hidden min-w-0 lg:block">
                     <p className={`text-sm font-bold ${isActive ? "text-[#163a63]" : "text-[#6d88a4]"}`}>{item.label}</p>
                     <p className="mt-0.5 text-xs text-[#8da3ba]">{item.caption}</p>
                  </div>
                  <span className="sr-only">{item.label}{isActive ? " — current step" : isDone ? " — complete" : ""}</span>
                </div>
              );
            })}
          </nav>

           <div className="mt-7 hidden rounded-2xl border border-[#d5e5f7] bg-white/70 p-4 lg:block">
               <div className="mb-2 flex items-center gap-2 text-[#1aa394]">
              <ShieldCheck size={17} aria-hidden="true" />
              <span className="text-xs font-bold uppercase tracking-[0.12em]">Private by design</span>
            </div>
             <p className="text-xs leading-5 text-[#6d88a4]">Your details stay yours. SHIKEN only uses them to personalise your preparation.</p>
          </div>
        </aside>

        <section className="min-w-0">
          <div className="mb-5 flex items-center justify-between">
            <div>
               <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#6d88a4]" data-testid="text-step-count">
                Step {step + 1} of {STEPS.length}
              </p>
               <h2 className="mt-1 text-xl font-bold tracking-[-0.035em] text-[#163a63]" data-testid="text-step-title">
                {currentStep.label}
              </h2>
            </div>
             <div className="hidden h-1.5 w-32 overflow-hidden rounded-full bg-[#d7e7f8] sm:block" aria-label={`${((step + 1) / STEPS.length) * 100}% complete`}>
               <div className="h-full rounded-full bg-[#1aa394] transition-[width] duration-500" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
            </div>
          </div>

           <div className="rounded-[28px] border border-[#d5e5f7] bg-white/95 p-5 shadow-[0_20px_60px_rgba(31,78,121,0.1)] sm:p-8 lg:p-10">
            {completed ? (
              <div className="flex min-h-[390px] flex-col items-center justify-center py-10 text-center" data-testid="status-onboarding-complete">
                <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-[26px] bg-[#dcefe8] text-[#2c8d78]">
                  <CheckCircle2 size={42} strokeWidth={1.7} aria-hidden="true" />
                </div>
                <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-[#2c8d78]">Profile ready</p>
                <h2 className="max-w-md text-3xl font-bold tracking-[-0.055em] text-[#17344f]">Your next chapter starts here.</h2>
                <p className="mt-4 max-w-md text-sm leading-6 text-[#71828a]">
                  Your SHIKEN space is set up. We’ll use your profile and exam choices to keep every practice session focused.
                </p>
                <div className="mt-8 rounded-full border border-[#dbe5e0] bg-[#f0f6f2] px-4 py-2 text-xs font-semibold text-[#52716f]" data-testid="text-selected-exams">
                  {selectedExams.length > 0 ? `${selectedExams.length} exam stream${selectedExams.length === 1 ? "" : "s"} selected` : "You can choose exam streams later"}
                </div>
                 <button type="button" onClick={onComplete} data-testid="button-enter-dashboard" className="mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#d46148] px-6 text-sm font-bold text-[#fff9f3] shadow-[0_10px_20px_rgba(212,97,72,0.18)] transition-colors hover:bg-[#bd513b]">
                   Enter SHIKEN <ArrowRight size={17} aria-hidden="true" />
                 </button>
              </div>
            ) : (
              <>
                {actionError ? (
                  <div className="mb-6 flex items-start gap-3 rounded-2xl border border-[#f0c8be] bg-[#fff2ed] px-4 py-3.5 text-sm text-[#a94637]" role="alert" data-testid="status-action-error">
                    <AlertCircle className="mt-0.5 shrink-0" size={17} aria-hidden="true" />
                    <span>{actionError}</span>
                  </div>
                ) : null}
                {registrationError && step === 1 ? (
                  <div className="mb-6 flex items-start gap-3 rounded-2xl border border-[#f0c8be] bg-[#fff2ed] px-4 py-3.5 text-sm text-[#a94637]" role="alert" data-testid="status-registration-error">
                    <AlertCircle className="mt-0.5 shrink-0" size={17} aria-hidden="true" />
                    <span>{registrationError}</span>
                  </div>
                ) : null}
                {verificationError && step === 2 ? (
                  <div className="mb-6 flex items-start gap-3 rounded-2xl border border-[#f0c8be] bg-[#fff2ed] px-4 py-3.5 text-sm text-[#a94637]" role="alert" data-testid="status-verification-error">
                    <AlertCircle className="mt-0.5 shrink-0" size={17} aria-hidden="true" />
                    <span>{verificationError}</span>
                  </div>
                ) : null}

                {step === 0 ? (
                  <form onSubmit={handleNext} noValidate data-testid="form-profile">
                    <div className="mb-8">
                      <p className="mb-1 text-2xl font-bold tracking-[-0.045em] text-[#17344f]">Tell us about yourself</p>
                      <p className="text-sm leading-6 text-[#74858c]">This helps us make your study space feel like yours.</p>
                    </div>
                    <div className="grid gap-5 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <FieldLabel htmlFor="fullName">Full name</FieldLabel>
                        <div className="relative">
                          <UserRound className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#91a0a5]" size={17} aria-hidden="true" />
                          <input id="fullName" name="fullName" value={form.fullName} onChange={updateField} autoComplete="name" placeholder="e.g. Aanya Sharma" aria-invalid={Boolean(errors.fullName)} aria-describedby={errors.fullName ? "error-full-name" : undefined} data-testid="input-full-name" className={`h-12 w-full rounded-xl border bg-[#f5f8f5] pl-11 pr-4 text-sm text-[#17344f] outline-none transition-colors placeholder:text-[#a6b1b2] focus:border-[#2c8d78] focus:bg-[#fbfdfb] ${errors.fullName ? "border-[#d46148]" : "border-[#dbe5e0]"}`} />
                        </div>
                        {errors.fullName ? <FieldError id="error-full-name">{errors.fullName}</FieldError> : null}
                      </div>
                      <div>
                        <FieldLabel htmlFor="mobileNumber">Mobile number</FieldLabel>
                        <div className="relative">
                          <Phone className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#91a0a5]" size={17} aria-hidden="true" />
                          <input id="mobileNumber" name="mobileNumber" value={form.mobileNumber} onChange={updateField} type="tel" inputMode="tel" autoComplete="tel" placeholder="+91 98765 43210" aria-invalid={Boolean(errors.mobileNumber)} aria-describedby={errors.mobileNumber ? "error-mobile-number" : undefined} data-testid="input-mobile-number" className={`h-12 w-full rounded-xl border bg-[#f5f8f5] pl-11 pr-3 text-sm text-[#17344f] outline-none transition-colors placeholder:text-[#a6b1b2] focus:border-[#2c8d78] focus:bg-[#fbfdfb] ${errors.mobileNumber ? "border-[#d46148]" : "border-[#dbe5e0]"}`} />
                        </div>
                        {errors.mobileNumber ? <FieldError id="error-mobile-number">{errors.mobileNumber}</FieldError> : null}
                      </div>
                      <div>
                        <FieldLabel htmlFor="email">Email address</FieldLabel>
                        <div className="relative">
                          <Mail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#91a0a5]" size={17} aria-hidden="true" />
                          <input id="email" name="email" value={form.email} onChange={updateField} type="email" autoComplete="email" placeholder="you@example.com" aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? "error-email" : undefined} data-testid="input-email" className={`h-12 w-full rounded-xl border bg-[#f5f8f5] pl-11 pr-3 text-sm text-[#17344f] outline-none transition-colors placeholder:text-[#a6b1b2] focus:border-[#2c8d78] focus:bg-[#fbfdfb] ${errors.email ? "border-[#d46148]" : "border-[#dbe5e0]"}`} />
                        </div>
                        {errors.email ? <FieldError id="error-email">{errors.email}</FieldError> : null}
                      </div>
                      <div>
                        <FieldLabel htmlFor="state">State</FieldLabel>
                        <div className="relative">
                          <MapPin className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#91a0a5]" size={17} aria-hidden="true" />
                          <select id="state" name="state" value={form.state} onChange={updateField} aria-invalid={Boolean(errors.state)} aria-describedby={errors.state ? "error-state" : undefined} data-testid="select-state" className={`h-12 w-full appearance-none rounded-xl border bg-[#f5f8f5] pl-11 pr-9 text-sm outline-none transition-colors focus:border-[#2c8d78] focus:bg-[#fbfdfb] ${form.state ? "text-[#17344f]" : "text-[#a6b1b2]"} ${errors.state ? "border-[#d46148]" : "border-[#dbe5e0]"}`}>
                            <option value="">Select your state</option>
                            {STATES.map((stateName) => <option key={stateName} value={stateName}>{stateName}</option>)}
                          </select>
                          <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[#91a0a5]" size={16} aria-hidden="true" />
                        </div>
                        {errors.state ? <FieldError id="error-state">{errors.state}</FieldError> : null}
                      </div>
                       <div>
                        <FieldLabel htmlFor="district">District</FieldLabel>
                         <div className="relative">
                           <select id="district" name="district" value={form.district} onChange={updateField} aria-invalid={Boolean(errors.district)} aria-describedby={errors.district ? "error-district" : undefined} data-testid="select-district" className={`h-12 w-full appearance-none rounded-xl border bg-[#f5f8f5] px-4 pr-9 text-sm outline-none transition-colors focus:border-[#2c8d78] focus:bg-[#fbfdfb] ${form.district ? "text-[#17344f]" : "text-[#a6b1a5]"} ${errors.district ? "border-[#d46148]" : "border-[#dbe5e0]"}`}>
                             <option value="">{form.state ? "Select your district" : "Select state first"}</option>
                             {form.district && !districtOptions.includes(form.district) ? <option value={form.district}>{form.district}</option> : null}
                             {districtOptions.map((district) => <option key={district} value={district}>{district}</option>)}
                             {form.state && districtOptions.length === 0 ? <option value="Other district">Other district</option> : null}
                           </select>
                           <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[#91a0a5]" size={16} aria-hidden="true" />
                         </div>
                        {errors.district ? <FieldError id="error-district">{errors.district}</FieldError> : null}
                      </div>
                      <div className="sm:col-span-2">
                        <FieldLabel htmlFor="village" optional>Village / locality</FieldLabel>
                        <input id="village" name="village" value={form.village} onChange={updateField} autoComplete="address-level3" placeholder="e.g. Kothrud" data-testid="input-village" className="h-12 w-full rounded-xl border border-[#dbe5e0] bg-[#f5f8f5] px-4 text-sm text-[#17344f] outline-none transition-colors placeholder:text-[#a6b1b2] focus:border-[#2c8d78] focus:bg-[#fbfdfb]" />
                      </div>
                    </div>
                    <div className="mt-9 flex justify-end">
                      <button type="submit" data-testid="button-continue-profile" className="group inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#d46148] px-6 text-sm font-bold text-[#fff9f3] shadow-[0_10px_20px_rgba(212,97,72,0.18)] transition-[background-color,transform] hover:bg-[#bd513b] active:translate-y-px sm:w-auto">
                        Continue <ArrowRight size={17} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                      </button>
                    </div>
                  </form>
                ) : null}

                {step === 1 ? (
                  <form onSubmit={handleNext} noValidate data-testid="form-password">
                    <div className="mb-8">
                      <p className="mb-1 text-2xl font-bold tracking-[-0.045em] text-[#17344f]">Make it yours</p>
                      <p className="text-sm leading-6 text-[#74858c]">Create a password you’ll remember, but nobody else can guess.</p>
                    </div>
                    <div className="rounded-2xl border border-[#dbe5e0] bg-[#f2f7f3] p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#dcefe8] text-[#2c8d78]"><LockKeyhole size={18} aria-hidden="true" /></div>
                        <div>
                          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#52716f]">Account security</p>
                       <p className="mt-1 text-xs leading-5 text-[#7c8e90]">Use at least 6 characters and keep it private.</p>
                        </div>
                      </div>
                    </div>
                    <div className="mt-6 space-y-5">
                      <div>
                        <FieldLabel htmlFor="password">Password</FieldLabel>
                        <div className="relative">
                          <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#91a0a5]" size={17} aria-hidden="true" />
                           <input id="password" name="password" value={form.password} onChange={updateField} type={showPassword ? "text" : "password"} autoComplete="new-password" placeholder="At least 6 characters" aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? "error-password" : undefined} data-testid="input-password" className={`h-12 w-full rounded-xl border bg-[#f5f8f5] pl-11 pr-11 text-sm text-[#17344f] outline-none transition-colors placeholder:text-[#a6b1b2] focus:border-[#2c8d78] focus:bg-[#fbfdfb] ${errors.password ? "border-[#d46148]" : "border-[#dbe5e0]"}`} />
                           <button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Hide password" : "Show password"} data-testid="button-toggle-password" className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#91a0a5] hover:text-[#2c8d78]">
                             {showPassword ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
                           </button>
                        </div>
                        {errors.password ? <FieldError id="error-password">{errors.password}</FieldError> : null}
                      </div>
                      <div>
                        <FieldLabel htmlFor="confirmPassword">Confirm password</FieldLabel>
                        <div className="relative">
                          <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#91a0a5]" size={17} aria-hidden="true" />
                           <input id="confirmPassword" name="confirmPassword" value={form.confirmPassword} onChange={updateField} type={showConfirmPassword ? "text" : "password"} autoComplete="new-password" placeholder="Type it again" aria-invalid={Boolean(errors.confirmPassword)} aria-describedby={errors.confirmPassword ? "error-confirm-password" : undefined} data-testid="input-confirm-password" className={`h-12 w-full rounded-xl border bg-[#f5f8f5] pl-11 pr-11 text-sm text-[#17344f] outline-none transition-colors placeholder:text-[#a6b1b2] focus:border-[#2c8d78] focus:bg-[#fbfdfb] ${errors.confirmPassword ? "border-[#d46148]" : "border-[#dbe5e0]"}`} />
                           <button type="button" onClick={() => setShowConfirmPassword((visible) => !visible)} aria-label={showConfirmPassword ? "Hide confirmed password" : "Show confirmed password"} data-testid="button-toggle-confirm-password" className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#91a0a5] hover:text-[#2c8d78]">
                             {showConfirmPassword ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
                           </button>
                        </div>
                        {errors.confirmPassword ? <FieldError id="error-confirm-password">{errors.confirmPassword}</FieldError> : null}
                      </div>
                    </div>
                    <div className="mt-9 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <button type="button" onClick={goBack} data-testid="button-back-password" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold text-[#71838d] transition-colors hover:bg-[#eef4f0] hover:text-[#17344f]">
                        <ArrowLeft size={16} aria-hidden="true" /> Back
                      </button>
                      <button type="submit" disabled={registering} data-testid="button-create-account" className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#d46148] px-6 text-sm font-bold text-[#fff9f3] shadow-[0_10px_20px_rgba(212,97,72,0.18)] transition-colors hover:bg-[#bd513b] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto">
                        {registering ? <BusyLabel>Creating account</BusyLabel> : <>Create account <ArrowRight size={17} aria-hidden="true" /></>}
                      </button>
                    </div>
                    {registering ? <p className="mt-4 text-right text-xs text-[#71838d]" role="status" data-testid="status-registering">Setting up your study space…</p> : null}
                  </form>
                ) : null}

                {step === 2 ? (
                  <div data-testid="panel-email-verification">
                    <div className="mb-8">
                      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f8e5dc] text-[#d46148]"><Mail size={25} strokeWidth={1.8} aria-hidden="true" /></div>
                      <p className="mb-1 text-2xl font-bold tracking-[-0.045em] text-[#17344f]">Check your inbox</p>
                      <p className="text-sm leading-6 text-[#74858c]">We sent a verification link to <strong className="font-bold text-[#395469]">{emailDisplay}</strong>.</p>
                    </div>
                    <div className={`rounded-2xl border p-5 ${emailVerified ? "border-[#a9d6c9] bg-[#eaf7f1]" : "border-[#dbe5e0] bg-[#f4f8f5]"}`} role="status" data-testid="status-email-verification">
                      <div className="flex gap-3">
                        {emailVerified ? <CheckCircle2 className="mt-0.5 shrink-0 text-[#2c8d78]" size={20} aria-hidden="true" /> : <Mail className="mt-0.5 shrink-0 text-[#78918e]" size={20} aria-hidden="true" />}
                        <div>
                          <p className="text-sm font-bold text-[#29465a]">{emailVerified ? "Email verified" : "Open the link in your email"}</p>
                          <p className="mt-1 text-xs leading-5 text-[#71858a]">{emailVerified ? "Nice work. Your account is ready for the final step." : "After clicking it, come back here and check your status."}</p>
                        </div>
                      </div>
                    </div>
                    {!emailVerified && verificationChecked ? <p className="mt-3 text-center text-xs font-medium text-[#71838d]" data-testid="status-verification-pending" role="status">Still waiting for confirmation. It can take a few seconds.</p> : null}
                    <div className="mt-8 flex flex-col gap-3">
                      <button type="button" onClick={() => void handleNext({ preventDefault: () => {} } as FormEvent<HTMLFormElement>)} disabled={verifying || emailVerified} data-testid="button-check-verification" className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#d46148] px-6 text-sm font-bold text-[#fff9f3] shadow-[0_10px_20px_rgba(212,97,72,0.18)] transition-colors hover:bg-[#bd513b] disabled:cursor-not-allowed disabled:opacity-60">
                        {verifying ? <BusyLabel>Checking status</BusyLabel> : emailVerified ? <><Check size={17} strokeWidth={3} aria-hidden="true" /> Verified</> : <>I’ve verified my email <ArrowRight size={17} aria-hidden="true" /></>}
                      </button>
                      <button type="button" onClick={() => void handleResend()} disabled={resending} data-testid="button-resend-verification" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold text-[#687e88] transition-colors hover:bg-[#eef4f0] hover:text-[#17344f] disabled:cursor-not-allowed disabled:opacity-60">
                        {resending ? <BusyLabel>Sending again</BusyLabel> : <><RefreshCw size={15} aria-hidden="true" /> Resend verification email</>}
                      </button>
                    </div>
                    <button type="button" onClick={goBack} data-testid="button-back-verification" className="mt-7 inline-flex items-center gap-2 rounded-xl px-2 py-2 text-sm font-semibold text-[#71838d] transition-colors hover:bg-[#eef4f0] hover:text-[#17344f]">
                      <ArrowLeft size={16} aria-hidden="true" /> Back to password
                    </button>
                  </div>
                ) : null}

                {step === 3 ? (
                  <div data-testid="panel-exam-selection">
                    <div className="mb-8 flex items-start justify-between gap-4">
                      <div>
                        <p className="mb-1 text-2xl font-bold tracking-[-0.045em] text-[#17344f]">What are you preparing for?</p>
                        <p className="text-sm leading-6 text-[#74858c]">Pick one or more. We’ll tune your dashboard around them.</p>
                      </div>
                       <div className="flex shrink-0 flex-col items-end gap-2">
                         <div className="hidden rounded-full bg-[#e7f1ed] px-3 py-1.5 text-xs font-bold text-[#2c8d78] sm:block" data-testid="text-exam-count">{selectedExams.length} selected</div>
                         <button type="button" onClick={() => void skipExams()} disabled={Boolean(examAction) || saving} data-testid="button-skip-exams-top" className="text-xs font-semibold text-[#71838d] underline-offset-4 hover:text-[#17344f] hover:underline disabled:opacity-50">Skip for now</button>
                       </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {EXAMS.map((exam) => {
                        const selected = selectedExams.includes(exam.id);
                        return (
                          <label key={exam.id} data-testid={`card-exam-${exam.id}`} className={`group relative cursor-pointer rounded-2xl border p-4 transition-[border-color,background-color,transform] hover:-translate-y-0.5 ${selected ? "border-[#2c8d78] bg-[#edf8f3]" : "border-[#dbe5e0] bg-[#f8faf7] hover:border-[#a9c7bc]"}`}>
                            <input type="checkbox" checked={selected} onChange={() => toggleExam(exam.id)} data-testid={`input-exam-${exam.id}`} className="sr-only" />
                            <div className="flex items-start gap-3">
                              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xs font-black tracking-[-0.04em] ${selected ? "bg-[#2c8d78] text-[#f7fffb]" : "bg-[#e8efeb] text-[#52716f]"}`}>{exam.shortLabel}</span>
                              <span className="min-w-0 flex-1">
                                <span className="flex items-start justify-between gap-2">
                                  <span className="text-sm font-bold text-[#29465a]">{exam.title}</span>
                                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${selected ? "border-[#2c8d78] bg-[#2c8d78] text-[#f7fffb]" : "border-[#c8d7d1] text-transparent"}`}><Check size={12} strokeWidth={3} aria-hidden="true" /></span>
                                </span>
                                <span className="mt-1 block text-xs leading-5 text-[#7b8c91]">{exam.description}</span>
                                <span className="mt-2 flex flex-wrap gap-1.5">
                                  {exam.subjects.map((subject) => <span key={subject} className="rounded-md bg-[#edf2ef] px-2 py-1 text-[10px] font-bold text-[#72868a]">{subject}</span>)}
                                </span>
                              </span>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                    {errors.exams ? <FieldError id="error-exams">{errors.exams}</FieldError> : null}
                    <div className="mt-9 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <button type="button" onClick={goBack} disabled={Boolean(examAction) || saving} data-testid="button-back-exams" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold text-[#71838d] transition-colors hover:bg-[#eef4f0] hover:text-[#17344f] disabled:cursor-not-allowed disabled:opacity-50">
                        <ArrowLeft size={16} aria-hidden="true" /> Back
                      </button>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <button type="button" onClick={() => void skipExams()} disabled={Boolean(examAction) || saving} data-testid="button-skip-exams" className="inline-flex h-11 items-center justify-center rounded-xl px-4 text-sm font-semibold text-[#71838d] transition-colors hover:bg-[#eef4f0] hover:text-[#17344f] disabled:cursor-not-allowed disabled:opacity-50">
                          {examAction === "skip" ? <BusyLabel>Skipping</BusyLabel> : "I’ll choose later"}
                        </button>
                        <button type="button" onClick={() => void saveExams()} disabled={Boolean(examAction) || saving} data-testid="button-save-exams" className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#d46148] px-6 text-sm font-bold text-[#fff9f3] shadow-[0_10px_20px_rgba(212,97,72,0.18)] transition-colors hover:bg-[#bd513b] disabled:cursor-not-allowed disabled:opacity-60">
                          {examAction === "save" || saving ? <BusyLabel>Saving choices</BusyLabel> : <>Save choices <ArrowRight size={17} aria-hidden="true" /></>}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </div>
          <p className="mt-5 text-center text-xs text-[#829bb5]">Need help? Reach us at <span className="font-semibold text-[#52708f]">shiken.query@gmail.com</span></p>
        </section>
      </div>
    </main>
  );
}
