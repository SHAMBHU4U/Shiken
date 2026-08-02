---
name: Login dashboard color roles
description: Contrast and semantic color guidance for the SHIKEN sign-in and sign-up form.
---

The authentication screen should keep the off-white canvas and avoid bright white fields. Use dark navy text for headings and supporting copy, blue for Google sign-in, indigo for Sign In, violet for Sign Up, cyan for the email field, amber for the password field, and emerald for the primary submit action.

**Why:** The original form had low-contrast copy and mostly white controls, making the login screen visually flat while reducing readability.

**How to apply:** Preserve the existing Firebase auth handlers, tab state, reset-password flow, loading states, and error red treatment. Change only the visual roles and keep input values/labels accessible.