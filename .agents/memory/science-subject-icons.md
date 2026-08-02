---
name: Science subject icon mapping
description: Dedicated icon roles for Physics, Chemistry, and Biology.
---

Use a prism/light-ray symbol for Physics, a laboratory flask for Chemistry, and a leaf/cell symbol for Biology. Keep these separate from the existing Maths, English, Hindi, Science, Social Science, and Sanskrit icon shapes.

**Why:** Physics, Chemistry, and Biology previously fell through to the same fallback glyph, making subject cards indistinguishable.

**How to apply:** Add future subject-specific artwork inside the shared `SubjectIcon` component so all card, quiz, result, and navigation usages stay consistent through the existing `id`, `color`, and `size` props.