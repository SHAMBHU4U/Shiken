import { readFileSync } from 'fs';
import { request } from 'https';

const data = readFileSync('./attached_assets/science_pyq2_1777731291602.json', 'utf8');
const questions = JSON.parse(data);
console.log(`Parsed ${questions.length} questions.`);

const dbUrl = (process.env.FIREBASE_DATABASE_URL || '').replace(/\/$/, '');
const secret = process.env.FIREBASE_DATABASE_SECRET;

if (!dbUrl || !secret) {
  console.error('Missing FIREBASE_DATABASE_URL or FIREBASE_DATABASE_SECRET');
  process.exit(1);
}

// Step 1: Fetch existing /science to find current entries
function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const req = request(url, { method: 'GET' }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(body) }); }
        catch(e) { reject(new Error('JSON parse error: ' + body)); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function httpsPost(url, payload) {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(payload);
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr)
      }
    };
    const req = request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(body) }); }
        catch(e) { reject(new Error('JSON parse error: ' + body)); }
      });
    });
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

// Fetch existing keys at /science (shallow)
const existing = await httpsGet(`${dbUrl}/science.json?auth=${secret}&shallow=true`);
console.log('Existing /science status:', existing.status);
console.log('Existing data:', JSON.stringify(existing.body));

// Determine existing count
let existingCount = 0;
if (existing.body && typeof existing.body === 'object' && !existing.body.error) {
  existingCount = Array.isArray(existing.body)
    ? existing.body.filter(Boolean).length
    : Object.keys(existing.body).length;
}
console.log(`Existing question count: ${existingCount}`);

// Upload each new question using POST (generates unique Firebase key, no overwrite)
let uploaded = 0;
let failed = 0;

for (const question of questions) {
  try {
    const result = await httpsPost(
      `${dbUrl}/science.json?auth=${secret}`,
      question
    );
    if (result.status === 200) {
      uploaded++;
      process.stdout.write(`\rUploaded: ${uploaded}/${questions.length}`);
    } else {
      console.error(`\nFailed to upload question id=${question.id}: status=${result.status}`, result.body);
      failed++;
    }
  } catch (err) {
    console.error(`\nError uploading question id=${question.id}:`, err.message);
    failed++;
  }
}

console.log(`\n\nDone! Uploaded: ${uploaded}, Failed: ${failed}`);

// Verify: re-fetch shallow count
const verify = await httpsGet(`${dbUrl}/science.json?auth=${secret}&shallow=true`);
const newCount = verify.body && typeof verify.body === 'object' && !verify.body.error
  ? (Array.isArray(verify.body) ? verify.body.filter(Boolean).length : Object.keys(verify.body).length)
  : 0;
console.log(`Verification: /science now has ${newCount} entries.`);

if (failed === 0) {
  console.log('SUCCESS: All questions uploaded successfully.');
} else {
  console.log(`WARNING: ${failed} questions failed to upload.`);
  process.exit(1);
}
