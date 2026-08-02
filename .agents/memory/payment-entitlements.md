---
name: Payment entitlement rules
description: Durable rules for Razorpay verification, premium activation, and subscription expiry.
---

Premium entitlements must be derived from the verified plan on the server, not from browser-supplied duration or price values. Store canonical activation and expiry fields while retaining legacy aliases when existing clients depend on them. Treat premium as active only when `paymentVerified === true`, `subscriptionType === "premium"`, and `premiumUntil > Date.now()`.

**Why:** Client-controlled duration caused premature or incorrect expiration, and a subscription flag alone could keep expired accounts active.

**How to apply:** Any future checkout, webhook, admin activation, or premium-check change must preserve server-owned plan metadata and expiry-gated access. The frontend Auth context should fetch and live-sync the complete `users/{uid}` profile so all feature guards share the same entitlement result.