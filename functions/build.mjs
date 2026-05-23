import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { rm } from "node:fs/promises";

const dir = path.dirname(fileURLToPath(import.meta.url));

await rm(path.resolve(dir, "lib"), { recursive: true, force: true });

await build({
  entryPoints: [path.resolve(dir, "src/index.ts")],
  platform: "node",
  bundle: true,
  format: "cjs",
  outfile: path.resolve(dir, "lib/index.js"),
  logLevel: "info",
  sourcemap: false,
  // firebase-admin and firebase-functions are provided by Cloud Functions runtime
  // pino and thread-stream are externalized to avoid worker bundling issues
  external: [
    "firebase-admin",
    "firebase-functions",
    "pino",
    "pino-http",
    "pino-pretty",
    "pino-worker",
    "thread-stream",
    "*.node",
  ],
});
