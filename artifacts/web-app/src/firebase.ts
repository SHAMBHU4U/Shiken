import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyCTdmjIe8Io-N6whfT-TySuUVYlGhMeTR8",
  authDomain: "shiken-d8789.firebaseapp.com",
  databaseURL: "https://shiken-d8789-default-rtdb.firebaseio.com",
  projectId: "shiken-d8789",
  storageBucket: "shiken-d8789.firebasestorage.app",
  messagingSenderId: "101540280667",
  appId: "1:101540280667:web:a05f3033240ac6f79c427e",
  measurementId: "G-09RZ8DZ5Z8",
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
export default app;
