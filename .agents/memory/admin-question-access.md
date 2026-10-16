---
name: Admin question management access
description: The selected server-side authorization source for question-bank CRUD.
---

Question-bank API requests must have a valid Firebase ID token, and the corresponding Realtime Database record `users/{uid}/isAdmin` must be the boolean `true`.

**Why:** The user chose the Realtime Database admin flag instead of Firebase custom claims.

**How to apply:** Keep authorization checks server-side on every list, edit, and delete request. Set this flag only through trusted admin tooling and ensure Realtime Database rules prevent users from granting the flag to themselves.
