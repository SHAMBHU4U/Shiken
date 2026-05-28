import * as functions from "firebase-functions";
import express from "express";
import app from "../../artifacts/api-server/src/app";

// Cloud Functions Gen 2 + Firebase Hosting rewrite path handling:
// - CF direct URL:    /api/healthz  → function receives /healthz
// - Hosting rewrite:  /api/healthz  → function receives /api/healthz (prefix kept)
// We need to handle both cases.
const wrapper = express();
wrapper.use((req, _res, next) => {
  const originalUrl = req.url;
  // If path already starts with /api (hosting rewrite case), keep it.
  // Otherwise (CF direct case), prepend /api.
  if (!req.url.startsWith("/api")) {
    req.url = "/api" + req.url;
  }
  // eslint-disable-next-line no-console
  console.log(`[CF-DEBUG] original=${originalUrl} modified=${req.url} method=${req.method}`);
  next();
});
wrapper.use(app);

// YAHAN SECRETS ADD KIYE GAYE HAIN:
export const api = functions
  .runWith({ 
    secrets: ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"] 
  })
  .https.onRequest(wrapper);
