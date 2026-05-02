import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";

const DB_URL = "https://shiken-d8789-default-rtdb.firebaseio.com";

export type SubscriptionType = "free" | "premium";

export function useSubscription() {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionType>("free");
  const [subLoading, setSubLoading] = useState(false);

  useEffect(() => {
    if (!user) { setSubscription("free"); return; }
    setSubLoading(true);
    const safeId = user.uid.replace(/[.#$/[\]]/g, "_");
    fetch(`${DB_URL}/users/${safeId}/subscriptionType.json`)
      .then((r) => r.json())
      .then((data) => setSubscription(data === "premium" ? "premium" : "free"))
      .catch(() => setSubscription("free"))
      .finally(() => setSubLoading(false));
  }, [user?.uid]);

  const isPremium = subscription === "premium";
  return { subscription, isPremium, subLoading };
}
