// @ts-nocheck
import * as functions from "firebase-functions";
import app from "../../artifacts/api-server/src/app";

// Cloud Functions Gen 1 — keeps the same URL:
// https://us-central1-shiken-d8789.cloudfunctions.net/api/api/<route>
export const api = functions.https.onRequest(app);
