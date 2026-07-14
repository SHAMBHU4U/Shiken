#!/usr/bin/env node
/**
 * Push current workspace files to GitHub via REST API,
 * bypassing broken git push (corrupt object error).
 *
 * Uses Git Data API:
 *  1. Get current GitHub HEAD
 *  2. Get current GitHub tree (recursive)
 *  3. Upload changed/new blobs
 *  4. Create new tree
 *  5. Create new commit
 *  6. Update HEAD ref
 */

import { createHash } from "crypto";
import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative } from "path";

const REPO    = "SHAMBHU4U/Shiken";
const BRANCH  = "main";
const TOKEN   = process.env.GH_TOKEN || "";
const ROOT    = process.env.REPO_ROOT || process.cwd();
const MSG     = process.env.COMMIT_MSG || "Sync latest code from Replit";

// Directories / patterns to exclude entirely
const EXCLUDE = new Set([
  ".git", "node_modules", "dist", ".vite", ".turbo",
  "attached_assets", ".local", ".agents", ".upm",
  "__pycache__", ".cache", "coverage",
]);

const EXCLUDE_EXT = new Set([".log", ".lock", ".ico", ".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".woff", ".woff2", ".ttf", ".eot"]);

// Also exclude large generated / binary files by name
const EXCLUDE_NAMES = new Set(["pnpm-lock.yaml"]);

const api = async (method, path, body) => {
  const res = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Authorization: `token ${TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`GitHub API ${method} ${path} → ${res.status}: ${txt.slice(0, 300)}`);
  }
  return res.json();
};

/** Compute git blob SHA (sha1 of "blob {size}\0{content}") */
function blobSha(buf) {
  const h = createHash("sha1");
  h.update(`blob ${buf.length}\0`);
  h.update(buf);
  return h.digest("hex");
}

/** Recursively list files under dir, returning paths relative to ROOT */
function listFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    if (EXCLUDE.has(entry) || EXCLUDE_NAMES.has(entry)) continue;
    const full = join(dir, entry);
    const rel  = relative(ROOT, full);
    const st   = statSync(full);
    if (st.isDirectory()) {
      files.push(...listFiles(full));
    } else {
      const ext = entry.includes(".") ? "." + entry.split(".").pop() : "";
      if (!EXCLUDE_EXT.has(ext) && st.size < 500_000) {
        files.push(rel);
      }
    }
  }
  return files;
}

async function main() {
  if (!TOKEN) { console.error("❌  Set GH_TOKEN env var"); process.exit(1); }

  console.log("🔍  Getting current GitHub HEAD…");
  const branchData = await api("GET", `/repos/${REPO}/branches/${BRANCH}`);
  const parentSha  = branchData.commit.sha;
  const treeSha    = branchData.commit.commit.tree.sha;
  console.log(`   HEAD: ${parentSha.slice(0, 10)} | tree: ${treeSha.slice(0, 10)}`);

  console.log("🌳  Fetching GitHub tree (recursive)…");
  const treeData = await api("GET", `/repos/${REPO}/git/trees/${treeSha}?recursive=1`);
  const ghIndex  = new Map(treeData.tree.filter(n => n.type === "blob").map(n => [n.path, n.sha]));
  console.log(`   GitHub has ${ghIndex.size} blobs`);

  console.log("📁  Listing local files…");
  const localFiles = listFiles(ROOT);
  console.log(`   Local has ${localFiles.length} files`);

  // Determine what needs uploading
  const toUpload = [];
  for (const rel of localFiles) {
    const buf     = readFileSync(join(ROOT, rel));
    const sha     = blobSha(buf);
    const ghSha   = ghIndex.get(rel);
    if (sha !== ghSha) {
      toUpload.push({ path: rel, buf });
    }
  }
  console.log(`\n📤  ${toUpload.length} files to upload (new or changed)`);
  if (toUpload.length === 0) { console.log("✅  Nothing to push — GitHub is already up to date"); return; }

  // Upload blobs in batches of 10
  const newTreeItems = [];
  const BATCH = 10;
  for (let i = 0; i < toUpload.length; i += BATCH) {
    const batch = toUpload.slice(i, i + BATCH);
    process.stdout.write(`   Uploading ${i + 1}–${Math.min(i + BATCH, toUpload.length)} / ${toUpload.length}…`);
    const results = await Promise.all(batch.map(async ({ path, buf }) => {
      const { sha } = await api("POST", `/repos/${REPO}/git/blobs`, {
        content: buf.toString("base64"),
        encoding: "base64",
      });
      return { path, mode: "100644", type: "blob", sha };
    }));
    newTreeItems.push(...results);
    console.log(" ✓");
  }

  // Create new tree (based on existing tree + our changes)
  console.log("🌲  Creating new tree…");
  const newTree = await api("POST", `/repos/${REPO}/git/trees`, {
    base_tree: treeSha,
    tree: newTreeItems,
  });
  console.log(`   New tree: ${newTree.sha.slice(0, 10)}`);

  // Create commit
  console.log("💾  Creating commit…");
  const newCommit = await api("POST", `/repos/${REPO}/git/commits`, {
    message: MSG,
    tree: newTree.sha,
    parents: [parentSha],
  });
  console.log(`   Commit: ${newCommit.sha.slice(0, 10)}`);

  // Update ref
  console.log("🔀  Updating branch ref…");
  await api("PATCH", `/repos/${REPO}/git/refs/heads/${BRANCH}`, {
    sha: newCommit.sha,
    force: true,
  });

  console.log(`\n✅  Done! Pushed ${toUpload.length} files → ${newCommit.sha.slice(0, 10)}`);
  console.log("   GitHub Actions will now build and deploy to Firebase.\n");
}

main().catch((err) => { console.error("❌  Error:", err.message); process.exit(1); });
