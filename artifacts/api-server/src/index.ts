import * as functions from "firebase-functions";
import app from "./app";

// Firebase ko batana zaroori hai ki use ye secrets read karne hain
export const api = functions
  .runWith({
    secrets: ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"],
  })
  .https.onRequest(app);
