---
name: Firebase onboarding profile writes
description: Constraint for creating Firebase profiles during email onboarding while auth listeners are active.
---

When creating an onboarding profile, use merge-style Realtime Database writes for root profile data rather than competing full replacements.

**Why:** Firebase authentication can notify the app while the registration handler is still persisting the profile. A racing full `set` can overwrite onboarding fields written by the other path.

**How to apply:** Keep registration and first-login synchronization writes additive at the profile root; use targeted child writes for onboarding progress and selected exams.