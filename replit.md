# SHIKEN — Bihar Board Quiz App

## Overview

pnpm workspace monorepo. The main product is **SHIKEN**, a student quiz app for Bihar Board exam prep. It lives in `artifacts/web-app`.

## Stack

- **Monorepo**: pnpm workspaces
- **Frontend**: React 18 + Vite + TypeScript (`artifacts/web-app`)
- **Styling**: Tailwind CSS v4, glassmorphism dark UI (`#07080f` bg)
- **Animations**: Framer Motion
- **Math rendering**: KaTeX (inline `$...$` and display `$$...$$`)
- **Database**: Firebase Realtime Database (public read, no auth required)
- **Persistence**: localStorage per-subject progress

## Firebase

- DB URL: `https://shiken-d8789-default-rtdb.firebaseio.com`
- Public read; paths: `maths`, `english`, `hindi`, `science`, `social%20science`, `sanskrit`
- Subject question counts: maths(100), english(94), hindi(100), science(80), social science(80), sanskrit(0 — no data)

## Firebase Question Schemas (per subject)

Each subject uses a **different field structure** — the parser handles all of them:

| Subject | Question fields | Options type | Answer field |
|---|---|---|---|
| Maths | `question_english`, `question_hindi` | Object `{A,B,C,D}` | `correct_answer` = letter |
| Science | `question_english`, `question_hindi`, `chapter_name` | Object `{A,B,C,D}` | `correct_answer` = letter |
| English | `question`, `question_hi`, `options_hi` | Array | `answer` = numeric index |
| Hindi | `question` (Hindi text) | Array with `(A)/(B)...` prefixes | `answer` = full text e.g. `"(D) 1908 ई॰ में"` |
| Social Science | `question` (bilingual with `/`) | Array | `answer` = numeric index |

## Key Files

- `artifacts/web-app/src/App.tsx` — dashboard with 6 subject cards + routing
- `artifacts/web-app/src/pages/SubjectPage.tsx` — full quiz page: fetch, parseQuestions, mode-select, chapter-select, quiz render, result screen, localStorage progress, palette, Gemini explain
- `artifacts/web-app/src/components/MathText.tsx` — KaTeX renderer (safe, `throwOnError: false`)
- `artifacts/web-app/src/firebase.js` — Firebase config (keeps SDK alive)
- `artifacts/web-app/src/main.tsx` — app entry (no StrictMode)
- `artifacts/api-server/src/routes/explain/index.ts` — POST /api/explain SSE streaming Gemini route
- `lib/integrations-gemini-ai/` — Replit AI Integrations Gemini SDK wrapper

## Features

- **Modes**: Full Length Test (50 random Qs, 60 min), Chapter-wise (20 random Qs per chapter, 20 min)
- **Shuffle**: Fisher-Yates on every session start
- **Progress**: localStorage saves after every answer; "Resume" banner on mode-select
- **Result screen**: score, per-question review with correct answer highlight
- **Bilingual**: English + Hindi questions shown together
- **Math**: KaTeX for `$...$` inline and `$$...$$` display math
- **Floating timer**: glassmorphism pill, dismissible, sound alerts at 5 min / 1 min / last 10 sec / time-up
- **Question palette**: bottom sheet grid showing answered/current/unanswered; tap to jump to any question
- **AI Explain (Gemini)**: "दोस्त से समझो" button after answering; streams a friendly Hindi explanation via Gemini 2.5 Flash; includes why correct answer is right, why others are wrong, real-life example, exam tip

## Gemini Integration

- Uses Replit AI Integrations proxy (no API key needed, billed to Replit credits)
- Env vars: `AI_INTEGRATIONS_GEMINI_BASE_URL`, `AI_INTEGRATIONS_GEMINI_API_KEY` (auto-set)
- Route: `POST /api/explain` → SSE stream → frontend reads with `ReadableStream`
- Model: `gemini-2.5-flash`
- `@google/genai` is bundled by esbuild (removed from external list in `build.mjs`)

## Key Commands

- `pnpm run typecheck` — full typecheck
- `pnpm --filter @workspace/api-server run build` — build API server
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API client/zod from OpenAPI spec
