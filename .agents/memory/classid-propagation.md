---
name: classId propagation in SubjectPage
description: classId is declared in SubjectPage but used inside ResultScreen (a separate component) — must be passed as a prop.
---

`classId` is computed in `SubjectPage` (line ~1780): `"entrance" | "12" | "10"`.

ResultScreen is a separate function component defined at line ~1099. Functions inside ResultScreen (like `fetchExplain`, `fetchAnalysis`) cannot close over `classId` from SubjectPage — TypeScript TS18004 error if you try shorthand `{ classId }`.

**Why:** React component boundaries break closure scope — sub-components receive data via props only.

**How to apply:** Any new data from SubjectPage needed inside ResultScreen must be threaded through as a prop. Same pattern applies to other sibling components like ModeSelect, ChapterSelect.

All AI API calls (generate-questions, explain, analyze-test) now accept `classId` in their request body, and backend routes use it to select BSEB/CBSE (Class 10/12) vs NTA (entrance) prompt templates.
