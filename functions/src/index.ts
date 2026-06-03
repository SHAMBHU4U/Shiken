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

export const api = onRequest({
  secrets: ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "GEMINI_API_KEY"], 
  serviceAccount: "101540280667-compute@developer.gserviceaccount.com",
  cors: true,
  // 👇 Gemini ko fast karne ke liye memory aur time badha diya
  memory: "1GiB",           
  timeoutSeconds: 60        
}, wrapper);
