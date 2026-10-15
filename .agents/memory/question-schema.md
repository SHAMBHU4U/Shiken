---
name: Question schema and legacy imports
description: Project-wide format for question records, generated identifiers, and legacy bilingual data handling.
---

New question records use `questionId`, `subject`, `chapter`, and `correctOptionIndex`, with English and Hindi content nested under `en` and `hi`. Each language object contains `question`, `options`, and `explanation`. Missing Hindi content is represented by empty strings (and matching empty option slots), not copied from English. Legacy flat records remain supported at import/read boundaries and should be normalized into this shape.

**Why:** The user specified this as the common format for admin search, editing, deletion, and bulk upload.

**How to apply:** Persist the nested schema for every new or edited question; assign IDs when absent; retain legacy aliases only in normalizers, not in newly written records.
