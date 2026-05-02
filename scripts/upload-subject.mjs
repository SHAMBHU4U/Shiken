/**
 * Firebase Subject Uploader
 * 
 * Usage:
 *   node scripts/upload-subject.mjs <subject> <json-file> [--overwrite]
 *
 * Examples:
 *   node scripts/upload-subject.mjs math attached_assets/math_questions.json
 *   node scripts/upload-subject.mjs history attached_assets/history_q.json --overwrite
 *
 * Options:
 *   --overwrite   Delete existing data at /<subject> before uploading (default: append)
 *   --no-delete   Keep the JSON file after upload (default: file is deleted on success)
 */

import { readFileSync, unlinkSync, existsSync } from 'fs';
import { request } from 'https';
import { resolve } from 'path';

// ── Parse CLI args ────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const subject = args[0];
const filePath = args[1];
const overwrite = args.includes('--overwrite');
const keepFile = args.includes('--no-delete');

if (!subject || !filePath) {
  console.error('\nUsage: node scripts/upload-subject.mjs <subject> <json-file> [--overwrite] [--no-delete]');
  console.error('Example: node scripts/upload-subject.mjs math attached_assets/math_questions.json\n');
  process.exit(1);
}

const absPath = resolve(filePath);
if (!existsSync(absPath)) {
  console.error(`\nFile not found: ${absPath}\n`);
  process.exit(1);
}

// ── Load & validate JSON ──────────────────────────────────────────────────────
let questions;
try {
  const raw = readFileSync(absPath, 'utf8');
  questions = JSON.parse(raw);
} catch (e) {
  console.error(`\nFailed to parse JSON: ${e.message}\n`);
  process.exit(1);
}

if (!Array.isArray(questions) || questions.length === 0) {
  console.error('\nJSON must be a non-empty array of question objects.\n');
  process.exit(1);
}

// Validate structure
const requiredFields = ['id', 'question', 'options', 'correctAnswer'];
const invalid = questions.filter(q => requiredFields.some(f => !(f in q)));
if (invalid.length > 0) {
  console.error(`\n${invalid.length} question(s) are missing required fields (id, question, options, correctAnswer).`);
  console.error('First invalid entry:', JSON.stringify(invalid[0], null, 2));
  process.exit(1);
}

console.log(`\n📚 Subject   : ${subject}`);
console.log(`📄 File      : ${filePath}`);
console.log(`📊 Questions : ${questions.length}`);
console.log(`🔁 Mode      : ${overwrite ? 'OVERWRITE (delete existing first)' : 'APPEND (keep existing data)'}\n`);

// ── Firebase helpers ──────────────────────────────────────────────────────────
const envA = (process.env.FIREBASE_DATABASE_URL || '').trim();
const envB = (process.env.FIREBASE_DATABASE_SECRET || '').trim();
const dbUrl = (envA.startsWith('https://') ? envA : envB).replace(/\/$/, '');
const secret = envA.startsWith('https://') ? envB : envA;

if (!dbUrl || !secret) {
  console.error('❌ Missing FIREBASE_DATABASE_URL or FIREBASE_DATABASE_SECRET environment variables.\n');
  process.exit(1);
}

function firebaseRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${dbUrl}${path}?auth=${secret}`);
    const bodyStr = body ? JSON.stringify(body) : null;
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers: bodyStr ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) } : {}
    };
    const req = request(options, (res) => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, body: raw }); }
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// ── Step 1: Check existing data ───────────────────────────────────────────────
console.log(`⏳ Checking existing data at /${subject}...`);
const existing = await firebaseRequest('GET', `/${subject}.json`);
let existingCount = 0;

if (existing.body && typeof existing.body === 'object' && !existing.body.error) {
  existingCount = Object.keys(existing.body).length;
}
console.log(`   Found ${existingCount} existing entries.`);

// ── Step 2: Optionally delete existing data ───────────────────────────────────
if (overwrite && existingCount > 0) {
  console.log(`🗑️  Overwrite mode: deleting existing /${subject} data...`);
  const del = await firebaseRequest('DELETE', `/${subject}.json`);
  if (del.status !== 200) {
    console.error(`❌ Failed to delete existing data: status=${del.status}`);
    process.exit(1);
  }
  console.log('   Deleted successfully.');
}

// ── Step 3: Upload questions ──────────────────────────────────────────────────
console.log(`\n⬆️  Uploading ${questions.length} questions to /${subject}...`);
let uploaded = 0;
let failed = 0;
const failedIds = [];

for (const question of questions) {
  const result = await firebaseRequest('POST', `/${subject}.json`, question);
  if (result.status === 200) {
    uploaded++;
    process.stdout.write(`\r   Progress: ${uploaded}/${questions.length}`);
  } else {
    failed++;
    failedIds.push(question.id);
    console.error(`\n   ❌ Failed id=${question.id}: HTTP ${result.status}`);
  }
}

console.log('\n');

// ── Step 4: Verify ────────────────────────────────────────────────────────────
console.log('🔍 Verifying upload...');
const verify = await firebaseRequest('GET', `/${subject}.json`);
const newCount = verify.body && typeof verify.body === 'object'
  ? Object.keys(verify.body).length
  : 0;
console.log(`   /${subject} now has ${newCount} total entries (was ${existingCount}).`);

// ── Step 5: Report & cleanup ──────────────────────────────────────────────────
if (failed === 0) {
  console.log(`\n✅ SUCCESS: All ${uploaded} questions uploaded to /${subject}.\n`);
  if (!keepFile) {
    unlinkSync(absPath);
    console.log(`🧹 Deleted source file: ${filePath}`);
  }
} else {
  console.log(`\n⚠️  PARTIAL: ${uploaded} uploaded, ${failed} failed.`);
  console.log(`   Failed IDs: ${failedIds.join(', ')}`);
  process.exit(1);
}
