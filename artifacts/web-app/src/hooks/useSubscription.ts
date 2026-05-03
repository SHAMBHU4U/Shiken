import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";

const DB_URL = "https://shiken-d8789-default-rtdb.firebaseio.com";

export type SubscriptionType = "free" | "premium";

export function useSubscription() {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionType>("free");
  const [plan, setPlan]                 = useState<string | null>(null);
  const [subLoading, setSubLoading]     = useState(false);

  useEffect(() => {
    if (!user) { setSubscription("free"); setPlan(null); return; }
    setSubLoading(true);
    const safeId = user.uid.replace(/[.#$/[\]]/g, "_");
    fetch(`${DB_URL}/users/${safeId}.json`)
      .then((r) => r.json())
      .then((data: Record<string, unknown> | null) => {
        setSubscription(data?.subscriptionType === "premium" ? "premium" : "free");
        setPlan(typeof data?.plan === "string" ? data.plan : null);
      })
      .catch(() => { setSubscription("free"); setPlan(null); })
      .finally(() => setSubLoading(false));
  }, [user?.uid]);

  const isPremium = subscription === "premium";
  const isTopper  = isPremium && plan === "biannual";
  return { subscription, isPremium, isTopper, plan, subLoading };
}
