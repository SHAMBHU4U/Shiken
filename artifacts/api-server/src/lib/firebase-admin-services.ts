import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getDatabase } from "firebase-admin/database";
import { getStorage } from "firebase-admin/storage";

const DATABASE_URL = "https://shiken-d8789-default-rtdb.firebaseio.com";
const STORAGE_BUCKET = "shiken-d8789.firebasestorage.app";

export function firebaseServices() {
  let app = getApps().find((candidate) => candidate.name === "[DEFAULT]");
  if (!app) {
    const serviceAccountJson = process.env["FIREBASE_SERVICE_ACCOUNT"];
    if (serviceAccountJson) {
      app = initializeApp({
        credential: cert(JSON.parse(serviceAccountJson)),
        databaseURL: DATABASE_URL,
        storageBucket: STORAGE_BUCKET,
      });
    } else {
      app = initializeApp({
        credential: applicationDefault(),
        databaseURL: DATABASE_URL,
        storageBucket: STORAGE_BUCKET,
      });
    }
  }

  return {
    auth: getAuth(app),
    db: getDatabase(app),
    bucket: getStorage(app).bucket(STORAGE_BUCKET),
  };
}
