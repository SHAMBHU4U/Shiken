# SHIKEN — Bihar Board Quiz App

## Overview

pnpm workspace monorepo. The main product is **SHIKEN**, a student quiz app for Bihar Board exam prep. It lives in `artifacts/web-app`.

## Stack

- **Monorepo**: pnpm workspaces
- **Frontend**: React 18 + Vite + TypeScript (`artifacts/web-app`)
- **Styling**: Tailwind CSS v4, glassmorphism dark UI (`#07080f` bg)
- **Animations**: Framer Motion
- **Math rendering**: KaTeX (inline `$...$` and display `$$...$$`)
- **Database**: Firebase Realtime Database
- **Auth**: Firebase Auth (Google + Email/Password)
- **Storage**: Firebase Storage (for profile photo uploads)
- **Persistence**: localStorage per-subject progress

## Firebase

- DB URL: `https://shiken-d8789-default-rtdb.firebaseio.com`
- Storage Bucket: `shiken-d8789.firebasestorage.app`
- Exports from `src/firebase.ts`: `db`, `auth`, `storage`
- Class 10 subject paths: `maths`, `english`, `hindi`, `science`, `social%20science`, `sanskrit`
- Class 12 subject paths: `class12/physics`, `class12/chemistry`, `class12/biology`, `class12/maths`, `class12/social`, `class12/hindi`, `class12/english`
- Subscription type stored at: `/users/{uid}/subscriptionType` = "free" | "premium"
- Premium subjects stored at: `/users/{uid}/premiumSubjects` = [] (all) | ["physics"] (single-subject)
- Explanations cached at: `/explanations/{subject}/{cacheKey}`
- AI questions pushed to: `/{subject}` with `chapter: "AI Generated"`

## Auth & Profile

- `src/contexts/AuthContext.tsx` — `AuthProvider`, `useAuth` (user, loading, signInWithGoogle, signInWithEmail, signUpWithEmail, resetPassword, signOut)
- Google Sign-In: `signInWithRedirect` in iframe, popup otherwise
- `src/hooks/useSubscription.ts` — reads `/users/{uid}/subscriptionType` from Firebase DB; returns `{ subscription, isPremium, subLoading }`

## Payment

- **Razorpay** integrated in `src/pages/PricingPage.tsx`
- Key: `rzp_live_SmHIAPIgMMiDhq` (public key, hardcoded in PricingPage)
- Supports: UPI, Card, Net Banking via Razorpay checkout popup
- On success: user record patched at `/users/{safeUid}` with `subscriptionType: "premium"`, `razorpayPaymentId`, `paymentVerified: true`
- Admin notified via WhatsApp API (`/api/notify-whatsapp`) with payment ID
- Razorpay JS loaded via `<script>` in `index.html`

## Class Selector

- Dashboard has Class 10 / Class 12 toggle (persisted in `localStorage.shiken_class`)
- Class 10 routes: `/c10/:subject` (also backward-compat `/:subject`)
- Class 12 routes: `/c12/:subject`
- Class 12 subjects: physics, chemistry, biology, maths, social, hindi, english
- SubjectPage derives `classId` from `location.startsWith("/c12/")`, uses `class12SubjectMeta`
- Firebase path encoding: `dbPath.split("/").map(encodeURIComponent).join("/")` — handles spaces and slashes

## Freemium System

### Free Users
- **Mini Test**: unlimited (10 random questions, 10 min)
- **1 Free Full Test** per subject (tracked in `localStorage.shiken_free_full_used_${classId}_${subject}`)

### Premium Users
- **Full Length Test**: 25 DB questions + 25 Gemini AI-generated = 50 questions (60 min)
- **Chapter-wise Test**: 20 questions per chapter (20 min)
- **AI Practice**: 5 fresh Gemini-generated questions
- **AI Explanations**: per-question Gemini explanation (Firebase-cached)
- **AI Test Analysis**: full test analysis in Hindi
- **Priority counselling** via WhatsApp
- **Golden badge** + gold profile theme
- **Photo upload** to Firebase Storage

### Setting Premium
Admin can toggle per-user in Admin Panel → Users tab (tap "Free/Premium" button on any user card).

## Firebase Question Schemas (per subject)

Each subject uses a **different field structure** — the parser handles all of them:

| Subject | Question fields | Options type | Answer field |
|---|---|---|---|
| Maths | `question_english`, `question_hindi` | Object `{A,B,C,D}` | `correct_answer` = letter |
| Science | `question_english`, `question_hindi`, `chapter_name` | Object `{A,B,C,D}` | `correct_answer` = letter |
| English | `question`, `question_hi`, `options_hi` | Array | `answer` = numeric index |
| Hindi | `question` (Hindi text) | Array with `(A)/(B)...` prefixes | `answer` = full text |
| Social Science | `question` (bilingual with `/`) | Array | `answer` = numeric index |

## Key Files

- `artifacts/web-app/src/App.tsx` — dashboard + routing + BottomNav + AdminGuard
- `artifacts/web-app/src/pages/SubjectPage.tsx` — full quiz: modes, freemium gates, AI generation, explanations
- `artifacts/web-app/src/pages/ProfilePage.tsx` — auth form + profile card (golden badge, photo upload, name edit)
- `artifacts/web-app/src/pages/AdminPage.tsx` — admin panel (DB overview, AI question review, user activity + premium toggle)
- `artifacts/web-app/src/pages/CounsellingPage.tsx` — WhatsApp counselling + premium priority section
- `artifacts/web-app/src/pages/ContactPage.tsx` — contact form (shiken.query@gmail.com)
- `artifacts/web-app/src/hooks/useSubscription.ts` — subscription hook
- `artifacts/web-app/src/components/UpgradeModal.tsx` — premium paywall bottom sheet
- `artifacts/web-app/src/firebase.ts` — exports `db`, `auth`, `storage`
- `artifacts/api-server/src/routes/` — explain (SSE), analyze-test (SSE), generate-questions

## Features

- **Freemium gates**: Mini Test (free), Full/Chapter/AI (Premium with 👑 badge + UpgradeModal)
- **Smart Full Test**: 25 DB + 25 Gemini AI = 50 Qs; new AI Qs auto-pushed to Firebase
- **Explanations**: Firebase-cached; generates via Gemini only on cache miss
- **AI Analysis**: full test breakdown in Hindi (Premium only)
- **Progress**: localStorage save after every answer; Resume banner
- **Bilingual**: English + Hindi questions shown together
- **Math**: KaTeX for `$...$` inline and `$$...$$` display
- **Timer**: glassmorphism pill, sound alerts, dismissible
- **Question palette**: bottom sheet grid, tap to jump
- **Bookmarks**: star any question, review in Saved Questions
- **BottomNav**: Home / Profile / Counselling / Contact (hidden on quiz/admin routes)
- **Admin panel**: protected by `sessionStorage.shiken_admin_session`; DB stats, AI question moderation, user activity + premium toggle
- **Contact**: shiken.query@gmail.com
- **WhatsApp counselling**: 918340472013

## Gemini Integration

- Uses `GEMINI_API_KEY` environment variable
- API server routes: `/api/explain`, `/api/analyze-test`, `/api/generate-questions`
- Model: `gemini-2.5-flash`
- All AI content is bilingual (Hindi + English)

## Firebase Storage (Photo Upload)
- Requires Firebase Storage enabled in Firebase Console
- Rules should allow: `allow read, write: if request.auth != null;`
- Avatars stored at: `avatars/{uid}/profile.{ext}`

## Key Commands

- `pnpm run typecheck` — full typecheck
- `pnpm --filter @workspace/api-server run build` — build API server
