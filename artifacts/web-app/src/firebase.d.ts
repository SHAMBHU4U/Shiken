declare module "../firebase.js" {
  import { Database } from "firebase/database";
  import { FirebaseApp } from "firebase/app";
  export const db: Database;
  const app: FirebaseApp;
  export default app;
}
