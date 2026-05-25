// @ts-nocheck
// Explicitly use v1 API to keep Gen 1 (same URL, no CPU errors)
import * as functions from "firebase-functions/v1";
import app from "../../artifacts/api-server/src/app";

// Cloud Functions Gen 1 — keeps the same URL:
// https://us-central1-shiken-d8789.cloudfunctions.net/api/api/<route>
export const api = functions.https.onRequest(app);
