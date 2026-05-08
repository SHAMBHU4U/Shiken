import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";

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
        setSubscription(data?.subscriptionType === "premium" ? "premium" : "free");
        setPlan(typeof data?.plan === "string" ? data.plan : null);
        // premiumSubjects: empty/absent = all subjects; non-empty = only those subjects
        if (Array.isArray(data?.premiumSubjects)) {
          setPremiumSubjects(data.premiumSubjects as string[]);
        } else if (data?.premiumSubjects && typeof data.premiumSubjects === "object") {
          setPremiumSubjects(Object.values(data.premiumSubjects as Record<string, string>));
        } else {
          setPremiumSubjects([]);
        }
      })
      .catch(() => {
        setSubscription("free");
        setPlan(null);
        setPremiumSubjects([]);
      })
      .finally(() => setSubLoading(false));
  }, [user?.uid]);

  const isPremium = subscription === "premium";
  const isTopper  = isPremium && plan === "biannual";

  // Returns true if user has premium access for the given subject.
  // If premiumSubjects is empty → all subjects are premium (backward compat / all-subjects plan).
  // If premiumSubjects is non-empty → only those specific subjects.
  function isSubjectPremium(subjectId: string): boolean {
    if (!isPremium) return false;
    if (premiumSubjects.length === 0) return true;
    return premiumSubjects.includes(subjectId);
  }

  return { subscription, isPremium, isTopper, plan, premiumSubjects, isSubjectPremium, subLoading };
}
