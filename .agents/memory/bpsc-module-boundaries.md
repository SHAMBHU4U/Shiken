---
name: BPSC module boundaries
description: Durable constraints for the BPSC Prelims CCE feature and its payment/content isolation.
---

BPSC content belongs in its own competitiveExams/bpsc-cce namespace and must remain bilingual at rest; student display may choose Hindi, English, or both, but there is no translation or question-generation dependency.

**Why:** The existing Class 10, Class 12, JEE, and NEET data and Gemini-backed flows must remain unchanged while BPSC content is administered independently.

**How to apply:** Keep BPSC admin CRUD, student reads, scores, and plan configuration on the isolated namespace. Treat the server as the authority for the competitive plan amount and access duration.