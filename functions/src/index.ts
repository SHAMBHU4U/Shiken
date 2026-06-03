import { onRequest } from "firebase-functions/v2/https";
import express from "express";
import app from "../../artifacts/api-server/src/app";

const wrapper = express();
wrapper.use((req, _res, next) => {
  if (!req.url.startsWith("/api")) {
    req.url = "/api" + req.url;
  }
  next();
});
wrapper.use(app);

// Gen 2 shifted: Isse purana deleted account bypass ho jayega
export const api = onRequest({
  secrets: ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"],
  serviceAccount: "101540280667-compute@developer.gserviceaccount.com",
  cors: true // APIs ke liye sahi rehta hai
}, wrapper);
