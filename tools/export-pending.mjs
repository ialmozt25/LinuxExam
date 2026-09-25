import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Regenerates a pending draft envelope from the question bank for a topic.
// Usage:
//   node tools/export-pending.mjs <topic> [YYYY-MM-DD] [--force]
//
// Reads:  src/data/questions/<topic>.json
// Writes: drafts/pending-<topic>_<date>.json
//
// The envelope is minimal: { batch_id, meta: { checks: {} }, questions }.
// questions is copied verbatim from the bank (no transformers, no docs).
// Refuses to overwrite an existing file unless --force is passed (exit 2).

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function localDate() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const args = process.argv.slice(2);
const force = args.includes('--force');
const positional = args.filter((a) => !a.startsWith('--'));

const topic = positional[0];
const date = positional[1] ?? localDate();

if (!topic) {
  console.error('usage: node tools/export-pending.mjs <topic> [YYYY-MM-DD] [--force]');
  process.exit(1);
}

if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
  console.error('invalid date (expected YYYY-MM-DD): ' + date);
  process.exit(1);
}

const srcPath = path.join(root, 'src', 'data', 'questions', `${topic}.json`);
if (!fs.existsSync(srcPath)) {
  console.error('bank file not found: ' + srcPath);
  process.exit(2);
}

let questions;
try {
  questions = JSON.parse(fs.readFileSync(srcPath, 'utf8'));
} catch (err) {
  console.error('failed to parse bank file: ' + err.message);
  process.exit(3);
}

if (!Array.isArray(questions)) {
  console.error('bank file is not a JSON array: ' + srcPath);
  process.exit(3);
}

const outPath = path.join(root, 'drafts', `pending-${topic}_${date}.json`);
if (fs.existsSync(outPath) && !force) {
  console.error('refusing to overwrite existing file: ' + outPath + ' (use --force)');
  process.exit(2);
}

const out = {
  batch_id: `${topic}_${date}`,
  meta: { checks: {} },
  questions,
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n', 'utf8');

console.log(`OK: ${questions.length} questions -> ${outPath}`);
