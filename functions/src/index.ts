import * as functions from "firebase-functions";
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
  })
  .https.onRequest(wrapper);// Deployment check
