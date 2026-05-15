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

export function useSubscription() {
  const { user } = useAuth();
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
    setSubLoading(true);
    const safeId = user.uid.replace(/[.#$/[\]]/g, "_");
    fetch(`${DB_URL}/users/${safeId}.json`)
      .then((r) => r.json())
      .then((data: Record<string, unknown> | null) => {
        const subType = data?.subscriptionType === "premium" ? "premium" : "free";
        const planVal = typeof data?.plan === "string" ? data.plan : null;
        let subjects: string[] = [];
        if (Array.isArray(data?.premiumSubjects)) {
          subjects = data.premiumSubjects as string[];
        } else if (data?.premiumSubjects && typeof data.premiumSubjects === "object") {
          subjects = Object.values(data.premiumSubjects as Record<string, string>);
        }
        const exp = typeof data?.premiumUntil === "number" ? data.premiumUntil : null;
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
          setSubscription(cached.subscriptionType === "premium" ? "premium" : "free");
          setPlan(cached.plan);
          setPremiumSubjects(cached.premiumSubjects);
        } else {
          setSubscription("free");
          setPlan(null);
          setPremiumSubjects([]);
        }
      })
      .finally(() => setSubLoading(false));
  }, [user?.uid]);

  const isPremium = subscription === "premium";
  const isTopper  = isPremium;
  const now = Date.now();
  const isActive = isPremium && expiryDate !== null && expiryDate > now;
  const daysLeft = expiryDate && expiryDate > now
    ? Math.ceil((expiryDate - now) / 86_400_000)
    : 0;

  function isSubjectPremium(subjectId: string): boolean {
    if (!isActive) return false;
    if (premiumSubjects.length === 0) return true;
    return premiumSubjects.includes(subjectId);
  }

  return {
    subscription, isPremium, isTopper, isActive, daysLeft,
    plan, premiumSubjects, isSubjectPremium, subLoading,
    expiryDate, walletBalance, referralCode, referralCount, referredBy,
  };
}
