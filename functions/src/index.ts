import * as functions from "firebase-functions/v1";
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

export const api = functions
  .runWith({
    secrets: ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"],
    // Firebase ko batane ke liye ki isi active account ko use kare
    serviceAccount: "101540280667-compute@developer.gserviceaccount.com", 
  })
  .https.onRequest(wrapper);// Deployment check
