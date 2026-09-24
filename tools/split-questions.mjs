import fs from 'node:fs';
import path from 'node:path';

// Splits the monolithic questions.json into one file per topic plus the id-order
// manifest. Usage:
//   node tools/split-questions.mjs
//   node tools/split-questions.mjs --input=path --outdir=dir
//
// Writes: <outdir>/<topic>.json (one array per topic), <outdir>/_order.json.
// Counters (_topics.json) are produced separately: run `npm run manifest` afterwards.
//
// Checks: every question has an id and a topic, ids are unique, and the number of
// written questions equals the number read.

const args = process.argv.slice(2);
const get = (k, d) => {
  const a = args.find((x) => x.startsWith(k + '='));
  return a ? a.split('=')[1] : d;
};

const INPUT = get('--input', 'src/data/questions.json');
const OUTDIR = get('--outdir', 'src/data/questions');

if (!fs.existsSync(INPUT)) {
  console.error('Input not found: ' + INPUT);
  console.error('(This is expected if the monolith has already been split.)');
  process.exit(2);
}

const bank = JSON.parse(fs.readFileSync(INPUT, 'utf8'));
if (!Array.isArray(bank)) {
  console.error('Input is not a JSON array: ' + INPUT);
  process.exit(3);
}

const ids = new Set();
for (const q of bank) {
  if (!q || typeof q.id !== 'string' || !q.id) throw new Error('question without id');
  if (ids.has(q.id)) throw new Error('duplicate id: ' + q.id);
  ids.add(q.id);
  if (typeof q.topic !== 'string' || !q.topic) throw new Error('question without topic: ' + q.id);
}

const byTopic = {};
for (const q of bank) {
  (byTopic[q.topic] = byTopic[q.topic] || []).push(q);
}

fs.mkdirSync(OUTDIR, { recursive: true });

// Sorted for deterministic file writing (content order inside a topic is preserved).
const topics = Object.keys(byTopic).sort();
let written = 0;
for (const topic of topics) {
  const items = byTopic[topic];
  for (const q of items) {
    if (q.topic !== topic) throw new Error('topic mismatch: ' + q.id);
  }
  fs.writeFileSync(path.join(OUTDIR, topic + '.json'), JSON.stringify(items, null, 2) + '\n', 'utf8');
  written += items.length;
}
if (written !== bank.length) throw new Error('written ' + written + ' != read ' + bank.length);

const orderIds = bank.map((q) => q.id);
fs.writeFileSync(path.join(OUTDIR, '_order.json'), JSON.stringify(orderIds, null, 2) + '\n', 'utf8');

console.log('OK: ' + bank.length + ' questions -> ' + topics.length + ' topics');
console.log('_order.json: ' + orderIds.length + ' ids');
console.log('Next: run `npm run manifest` to refresh _topics.json, then delete ' + INPUT + '.');
