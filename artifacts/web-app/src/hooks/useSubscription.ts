import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { saveSubscriptionToCache, loadSubscriptionFromCache } from "@/lib/questionCache";

const DB_URL = "https://shiken-d8789-default-rtdb.firebaseio.com";

export type SubscriptionType = "free" | "premium";

export interface SubscriptionData {
  subscriptionType: SubscriptionType;
  plan: string | null;
  premiumSubjects: string[];
  expiryDate: number | null;
  walletBalance: number;
  referralCode: string | null;
  referralCount: number;
  referredBy: string | null;
}

export interface SubscriptionUpdate {
  isPremium: boolean;
  subscriptionType: SubscriptionType;
  plan: string | null;
  premiumPlan?: string | null;
  premiumSubjects?: string[];
  purchasedAt?: number | null;
  expiresAt: number | null;
  premiumUntil?: number | null;
}

const SUBSCRIPTION_UPDATED_EVENT = "shiken:subscription-updated";

export function notifySubscriptionUpdated(update: SubscriptionUpdate): void {
  window.dispatchEvent(new CustomEvent<SubscriptionUpdate>(SUBSCRIPTION_UPDATED_EVENT, { detail: update }));
}

export function useSubscription() {
  const { user, userProfile, isPremium: authIsPremium } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionType>("free");
  const [plan, setPlan]                 = useState<string | null>(null);
  const [premiumSubjects, setPremiumSubjects] = useState<string[]>([]);
  const [expiryDate, setExpiryDate]     = useState<number | null>(null);
  const [walletBalance, setWalletBalance] = useState(0);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [referralCount, setReferralCount] = useState(0);
  const [referredBy, setReferredBy]     = useState<string | null>(null);
  const [subLoading, setSubLoading]     = useState(false);

  useEffect(() => {
    if (!user) {
      setSubscription("free");
      setPlan(null);
      setPremiumSubjects([]);
      setExpiryDate(null);
      setWalletBalance(0);
      setReferralCode(null);
      setReferralCount(0);
      setReferredBy(null);
      return;
    }

    const applySubscriptionUpdate = (update: SubscriptionUpdate) => {
      const exp = typeof update.expiresAt === "number"
        ? update.expiresAt
        : (typeof update.premiumUntil === "number" ? update.premiumUntil : null);
      const subType: SubscriptionType = authIsPremium ? "premium" : "free";
      const nextPlan = typeof update.plan === "string"
        ? update.plan
        : (typeof update.premiumPlan === "string" ? update.premiumPlan : null);
      const nextSubjects = Array.isArray(update.premiumSubjects) ? update.premiumSubjects : [];

      setSubscription(subType);
      setPlan(nextPlan);
      setPremiumSubjects(nextSubjects);
      setExpiryDate(exp);
      saveSubscriptionToCache(user.uid, {
        subscriptionType: subType,
        plan: nextPlan,
        premiumSubjects: nextSubjects,
      });
    };

    const onSubscriptionUpdated = (event: Event) => {
      const update = (event as CustomEvent<SubscriptionUpdate>).detail;
      if (update && typeof update === "object") applySubscriptionUpdate(update);
    };
    window.addEventListener(SUBSCRIPTION_UPDATED_EVENT, onSubscriptionUpdated);

    setSubLoading(true);
    const safeId = user.uid.replace(/[.#$/[\]]/g, "_");
    fetch(`${DB_URL}/users/${safeId}.json`)
      .then((r) => r.json())
      .then((data: Record<string, unknown> | null) => {
        const subType: SubscriptionType = authIsPremium ? "premium" : "free";
        const planVal = typeof data?.plan === "string" ? data.plan : null;
        let subjects: string[] = [];
        if (Array.isArray(data?.premiumSubjects)) {
          subjects = data.premiumSubjects as string[];
        } else if (data?.premiumSubjects && typeof data.premiumSubjects === "object") {
          subjects = Object.values(data.premiumSubjects as Record<string, string>);
        }
        const exp = typeof data?.expiresAt === "number"
          ? data.expiresAt
          : (typeof data?.premiumUntil === "number" ? data.premiumUntil : null);
        const wallet = typeof data?.walletBalance === "number" ? data.walletBalance : 0;
        const refCode = typeof data?.referralCode === "string" ? data.referralCode : null;
        const refCount = typeof data?.referralCount === "number" ? data.referralCount : 0;
        const refBy = typeof data?.referredBy === "string" ? data.referredBy : null;

        setSubscription(subType);
        setPlan(planVal);
        setPremiumSubjects(subjects);
        setExpiryDate(exp);
        setWalletBalance(wallet);
        setReferralCode(refCode);
        setReferralCount(refCount);
        setReferredBy(refBy);
        saveSubscriptionToCache(user.uid, {
          subscriptionType: subType, plan: planVal, premiumSubjects: subjects,
        });
      })
      .catch(() => {
        const cached = loadSubscriptionFromCache(user.uid);
        if (cached) {
          setSubscription(authIsPremium ? "premium" : "free");
          setPlan(cached.plan);
          setPremiumSubjects(cached.premiumSubjects);
        } else {
          setSubscription("free");
          setPlan(null);
          setPremiumSubjects([]);
        }
      })
    .finally(() => setSubLoading(false));

    return () => window.removeEventListener(SUBSCRIPTION_UPDATED_EVENT, onSubscriptionUpdated);
  }, [user?.uid, authIsPremium]);

  const now = Date.now();
  // AuthContext owns the exact verified payment + subscription + expiry check.
  const isPremium = authIsPremium;
  const isTopper  = isPremium;
  const effectiveExpiryDate = expiryDate ?? (
    typeof userProfile?.premiumUntil === "number" ? userProfile.premiumUntil : null
  );
  const isActive = isPremium && effectiveExpiryDate !== null && effectiveExpiryDate > now;
  const daysLeft = effectiveExpiryDate && effectiveExpiryDate > now
    ? Math.ceil((effectiveExpiryDate - now) / 86_400_000)
    : 0;

  function isSubjectPremium(subjectId: string): boolean {
    if (!isActive) return false;
    if (premiumSubjects.length === 0) return true;
    return premiumSubjects.includes(subjectId);
  }

  function isCompetitiveExamPremium(examSlug: string): boolean {
    if (!isActive || !plan) return false;
    const normalizedSlug = examSlug.replace(/-/g, "_");
    return plan.startsWith(`competitive_${normalizedSlug}_`) || plan.startsWith(`competitive_${examSlug}_`);
  }

  return {
    subscription, isPremium, isTopper, isActive, daysLeft,
    plan, premiumSubjects, isSubjectPremium, isCompetitiveExamPremium, subLoading,
    expiryDate: effectiveExpiryDate, walletBalance, referralCode, referralCount, referredBy,
  };
}
