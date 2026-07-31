---
name: Payment entitlement rules
description: Durable rules for Razorpay verification, premium activation, and subscription expiry.
---

Premium entitlements must be derived from the verified plan on the server, not from browser-supplied duration or price values. Store canonical activation and expiry fields while retaining legacy aliases when existing clients depend on them. Treat premium as active only when the premium flag is true and the expiry timestamp is still in the future.

**Why:** Client-controlled duration caused premature or incorrect expiration, and a subscription flag alone could keep expired accounts active.

**How to apply:** Any future checkout, webhook, admin activation, or premium-check change must preserve server-owned plan metadata and expiry-gated access.