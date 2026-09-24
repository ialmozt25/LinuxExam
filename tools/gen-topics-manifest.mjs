import fs from 'node:fs';
import path from 'node:path';

// Regenerates _topics.json (per-topic counters used by the Dashboard) from the topic
// files, and cross-checks them against the _order.json id manifest.
// Usage: node tools/gen-topics-manifest.mjs [--dir=path]
//
// Output format is the one src/data/questions/index.ts consumes:
//   { "total": <number>, "byTopic": { "<topic>": <count>, ... } }
//
// Checks: every topic file is a JSON array, ids are unique across files, and the id
// sets in the topic files and _order.json are identical (both directions).

const args = process.argv.slice(2);
const get = (k, d) => {
  const a = args.find((x) => x.startsWith(k + '='));
  return a ? a.split('=')[1] : d;
};

const DIR = get('--dir', 'src/data/questions');

if (!fs.existsSync(DIR)) {
  console.error('Dir not found: ' + DIR);
  process.exit(2);
}

const files = fs
  .readdirSync(DIR)
  .filter((f) => f.endsWith('.json') && f !== '_order.json' && f !== '_topics.json')
  .sort();

if (files.length === 0) {
  console.error('No topic files found in ' + DIR);
  process.exit(2);
}

const byTopic = {};
const allIds = new Set();
let total = 0;

for (const file of files) {
  const topicName = file.replace(/\.json$/, '');
  const items = JSON.parse(fs.readFileSync(path.join(DIR, file), 'utf8'));
  if (!Array.isArray(items)) {
    console.error('Not an array: ' + file);
    process.exit(3);
  }
  for (const q of items) {
    if (!q || typeof q.id !== 'string' || !q.id) {
      console.error('Question without id in ' + file);
      process.exit(3);
    }
    if (allIds.has(q.id)) {
      console.error('Duplicate id: ' + q.id);
      process.exit(4);
    }
    allIds.add(q.id);
    if (q.topic !== topicName) {
      console.error('Topic mismatch in ' + file + ': ' + q.id + ' has topic ' + q.topic);
      process.exit(4);
    }
  }
  byTopic[topicName] = items.length;
  total += items.length;
}

const orderPath = path.join(DIR, '_order.json');
if (fs.existsSync(orderPath)) {
  const order = JSON.parse(fs.readFileSync(orderPath, 'utf8'));
  if (!Array.isArray(order)) {
    console.error('_order.json is not an array');
    process.exit(5);
  }
  if (order.length !== total) {
    console.error('MISMATCH: _order.json=' + order.length + ' topic files=' + total);
    process.exit(5);
  }
  const inOrder = new Set(order);
  for (const id of allIds) {
    if (!inOrder.has(id)) {
      console.error('id in topic files, not in _order.json: ' + id);
      process.exit(6);
    }
  }
  for (const id of inOrder) {
    if (!allIds.has(id)) {
      console.error('id in _order.json, not in topic files: ' + id);
      process.exit(7);
    }
  }
}

const out = { total, byTopic };
fs.writeFileSync(path.join(DIR, '_topics.json'), JSON.stringify(out, null, 2) + '\n', 'utf8');

console.log('OK: ' + total + ' questions, ' + Object.keys(byTopic).length + ' topics');
