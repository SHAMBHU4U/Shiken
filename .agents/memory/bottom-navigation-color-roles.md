---
name: Bottom navigation color roles
description: Semantic colors for the SHIKEN bottom navigation destinations.
---

The shared bottom navigation uses teal for Home, rose for Ranks, deep rose for Profile, amber for Premium, orange for Counselling, and blue for Contact. Active items may use a subtle matching background tint while inactive labels retain a softened version of their destination color.

**Why:** The navigation reference uses distinct colors to make six destinations scannable at a glance, while the earlier implementation muted every inactive label to the same slate.

**How to apply:** Keep the existing routes, active indicator animation, profile status dot, and hidden quiz/admin behavior unchanged. Update colors in the centralized tab data rather than duplicating styles across pages.