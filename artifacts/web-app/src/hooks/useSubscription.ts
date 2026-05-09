import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { saveSubscriptionToCache, loadSubscriptionFromCache } from "@/lib/questionCache";

const DB_URL = "https://shiken-d8789-default-rtdb.firebaseio.com";

export type SubscriptionType = "free" | "premium";

export function useSubscription() {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionType>("free");
  const [plan, setPlan]                 = useState<string | null>(null);
  const [premiumSubjects, setPremiumSubjects] = useState<string[]>([]);
  const [subLoading, setSubLoading]     = useState(false);

  useEffect(() => {
    if (!user) {
      setSubscription("free");
      setPlan(null);
      setPremiumSubjects([]);
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
        setSubscription(subType);
        setPlan(planVal);
        setPremiumSubjects(subjects);
        saveSubscriptionToCache(user.uid, { subscriptionType: subType, plan: planVal, premiumSubjects: subjects });
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
  const isTopper  = isPremium && plan === "biannual";

  function isSubjectPremium(subjectId: string): boolean {
    if (!isPremium) return false;
    if (premiumSubjects.length === 0) return true;
    return premiumSubjects.includes(subjectId);
  }

  return { subscription, isPremium, isTopper, plan, premiumSubjects, isSubjectPremium, subLoading };
}
