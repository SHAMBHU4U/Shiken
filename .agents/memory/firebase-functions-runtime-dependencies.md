---
name: Firebase Functions runtime dependencies
description: Dependency rules for the bundled Firebase API function
---

When `functions/src/index.ts` bundles code from the sibling API server, every non-Node runtime import used by that bundled code must also be declared in `functions/package.json`, not only in the API server package.

**Why:** A local bundle can load because the monorepo hoists dependencies, while Firebase Cloud Build installs only the functions package and the container can fail during startup.

**How to apply:** Audit the complete bundled import graph before deploying. Keep the Firebase export on `onRequest`; never add an HTTP listener under `functions/`. Build and `require()` the generated `lib/index.js` from a clean functions install.