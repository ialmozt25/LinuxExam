#!/usr/bin/env node
/**
 * m2.9 batch 5A — deterministic, format-preserving integration (text_files, spec 015).
 *
 * Takes the ACCEPTED candidate JSON (bank format, .project/drafts/batch-5a-candidates.json),
 * appends it to src/data/questions/text_files.json and appends the 6 ids to the END of
 * src/data/questions/_order.json — without reordering anything (HANDOFF §7.1 / MEMORY-FACTORY
 * lesson 2026-09-27: the _order.json order is never normalized).
 *
 * Textual insertion only: pre-existing bytes are never re-serialised, so the diff contains
 * the new questions and nothing else. Write: UTF-8 без BOM, LF, последний байт 0x0A.
 *
 * Modelled on the canonical .project/drafts/m2.9-batch4-integrate.mjs (batch 4).
 *
 * Usage:
 *   node .project/drafts/m2.9-batch5a-integrate.mjs <accepted.json> [--dry-run]
 *
 * Refuses to run unless the bank is exactly 206 (guards against double-apply).
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const BANK_DIR = join(ROOT, 'src', 'data', 'questions');
const TARGET_FILE = join(BANK_DIR, 'text_files.json');
const ORDER_FILE = join(BANK_DIR, '_order.json');

const EXPECTED_IDS = ['tf_011', 'tf_012', 'tf_013', 'tf_014', 'tf_015', 'tf_016'];
const EXPECTED_TOPIC = 'text_files';
const BANK_BEFORE = 206;
const BANK_AFTER = 212;

/** Ровно тот набор ключей, что у существующих tf_001..tf_010 — «формат 1:1». */
const QUESTION_KEYS = ['id', 'topic', 'difficulty', 'objective_domain', 'subtopic', 'question', 'options', 'explanation'];
const OPTION_KEYS = ['text', 'correct'];

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const src = args.find((a) => !a.startsWith('--'));
if (!src) {
  console.error('usage: node .project/drafts/m2.9-batch5a-integrate.mjs <accepted.json> [--dry-run]');
  process.exit(2);
}

// ---- guards ----------------------------------------------------------------
const files = readdirSync(BANK_DIR).filter((f) => f.endsWith('.json') && !f.startsWith('_'));
let bankBefore = 0;
const allIds = new Set();
for (const f of files) {
  for (const q of JSON.parse(readFileSync(join(BANK_DIR, f), 'utf8'))) {
    bankBefore++;
    allIds.add(q.id);
  }
}
if (bankBefore !== BANK_BEFORE) {
  console.error(`REFUSING: bank is ${bankBefore}, expected ${BANK_BEFORE}. Integration already applied or bank drifted.`);
  process.exit(3);
}

const accepted = JSON.parse(readFileSync(src, 'utf8'));
const list = Array.isArray(accepted) ? accepted : accepted.questions;
if (!Array.isArray(list) || list.length === 0) {
  console.error('accepted file must be a non-empty JSON array or {questions:[...]}');
  process.exit(2);
}

const gotOrder = list.map((q) => q.id);
if (JSON.stringify(gotOrder) !== JSON.stringify(EXPECTED_IDS)) {
  console.error(`ids must be exactly ${EXPECTED_IDS.join(', ')} in canonical order.`);
  console.error(`  got:  ${gotOrder.join(', ')}`);
  process.exit(2);
}

for (const q of list) {
  if (allIds.has(q.id)) {
    console.error(`REFUSING: id ${q.id} already exists in the bank`);
    process.exit(3);
  }
  if (q.topic !== EXPECTED_TOPIC) {
    console.error(`REFUSING: ${q.id} topic=${q.topic}, expected ${EXPECTED_TOPIC}`);
    process.exit(3);
  }
  const keys = Object.keys(q).join(',');
  if (keys !== QUESTION_KEYS.join(',')) {
    console.error(`REFUSING: ${q.id} key set "${keys}" != canonical "${QUESTION_KEYS.join(',')}"`);
    process.exit(3);
  }
  if (!Array.isArray(q.options) || q.options.length !== 4) {
    console.error(`REFUSING: ${q.id} must have exactly 4 options`);
    process.exit(3);
  }
  if (q.options.filter((o) => o.correct).length !== 1) {
    console.error(`REFUSING: ${q.id} must have exactly 1 correct option`);
    process.exit(3);
  }
  for (const o of q.options) {
    if (Object.keys(o).join(',') !== OPTION_KEYS.join(',')) {
      console.error(`REFUSING: ${q.id} option key set != "text,correct"`);
      process.exit(3);
    }
  }
}

// ---- 1. topic file: append before the final `]` ----------------------------
const topicBytes = readFileSync(TARGET_FILE, 'utf8');
const topicBefore = JSON.parse(topicBytes).length;
const closeIdx = topicBytes.lastIndexOf(']');
if (closeIdx < 0) {
  console.error('malformed text_files.json: no closing ]');
  process.exit(4);
}
const head = topicBytes.slice(0, closeIdx).replace(/\s+$/, '');
const inner = JSON.stringify(list, null, 2).split('\n').slice(1, -1).join('\n');
const newTopicBytes = `${head},\n${inner}\n]\n`;

// ---- 2. _order.json: APPEND 6 ids before the final `]` (END of array) ------
const orderText = readFileSync(ORDER_FILE, 'utf8');
const order = JSON.parse(orderText);
if (order.length !== BANK_BEFORE) {
  console.error(`REFUSING: _order.json has ${order.length} ids, expected ${BANK_BEFORE}`);
  process.exit(3);
}
for (const id of EXPECTED_IDS) {
  if (order.includes(id)) {
    console.error(`REFUSING: ${id} already present in _order.json`);
    process.exit(3);
  }
}
const orderClose = orderText.lastIndexOf(']');
const orderHead = orderText.slice(0, orderClose).replace(/\s+$/, '');
const newOrderBytes = `${orderHead},\n${EXPECTED_IDS.map((id) => `  ${JSON.stringify(id)}`).join(',\n')}\n]\n`;

// ---- 3. shape validation (both outputs must parse and agree) ---------------
let parsedTopic;
let parsedOrder;
try {
  parsedTopic = JSON.parse(newTopicBytes);
  parsedOrder = JSON.parse(newOrderBytes);
} catch (e) {
  console.error(`produced bytes do not parse: ${e.message}`);
  process.exit(5);
}
if (parsedTopic.length !== topicBefore + list.length || parsedTopic.length !== 16) {
  console.error(`topic length mismatch: ${parsedTopic.length}, expected 16`);
  process.exit(5);
}
if (parsedOrder.length !== BANK_AFTER) {
  console.error(`_order.json length mismatch: ${parsedOrder.length}, expected ${BANK_AFTER}`);
  process.exit(5);
}
// порядок: префикс _order.json побайтово сохранён, новые id — в хвосте
if (JSON.stringify(order) !== JSON.stringify(parsedOrder.slice(0, BANK_BEFORE))) {
  console.error('REFUSING: existing _order.json order was modified');
  process.exit(5);
}
if (JSON.stringify(parsedOrder.slice(BANK_BEFORE)) !== JSON.stringify(EXPECTED_IDS)) {
  console.error('REFUSING: new ids are not at the END of _order.json');
  process.exit(5);
}
// кодировка: LF, без BOM, 0x0A в конце
for (const [name, text] of [['text_files.json', newTopicBytes], ['_order.json', newOrderBytes]]) {
  if (text.includes('\r')) { console.error(`${name}: CR present`); process.exit(5); }
  if (text.charCodeAt(0) === 0xfeff) { console.error(`${name}: BOM present`); process.exit(5); }
  if (!text.endsWith('\n')) { console.error(`${name}: no trailing LF`); process.exit(5); }
}

console.log(`accepted           : ${list.length} question(s) — ${EXPECTED_IDS.join(', ')}`);
console.log(`bank               : ${bankBefore} -> ${bankBefore + list.length}`);
console.log(`text_files.json    : ${topicBefore} -> ${parsedTopic.length} questions (+${Buffer.byteLength(newTopicBytes) - Buffer.byteLength(topicBytes)} bytes)`);
console.log(`_order.json        : ${order.length} -> ${parsedOrder.length} ids (6 appended at the END, nothing reordered)`);

if (dryRun) {
  console.log('\n--dry-run: nothing written. Produced bytes parse OK and pass every guard.');
  process.exit(0);
}

writeFileSync(TARGET_FILE, newTopicBytes, 'utf8');
writeFileSync(ORDER_FILE, newOrderBytes, 'utf8');
console.log('\nwritten. Next: npm run manifest && gates (typecheck/test:run/build/qc/shuffle-bank:check).');

// ---- final self-check on the bytes actually on disk ------------------------
{
  const onDiskTopic = JSON.parse(readFileSync(TARGET_FILE, 'utf8'));
  const onDiskOrder = JSON.parse(readFileSync(ORDER_FILE, 'utf8'));
  if (onDiskTopic.length !== 16) { console.error(`self-check: text_files.json has ${onDiskTopic.length}, expected 16`); process.exit(5); }
  if (onDiskOrder.length !== BANK_AFTER) { console.error(`self-check: _order.json has ${onDiskOrder.length}, expected ${BANK_AFTER}`); process.exit(5); }
  console.log(`self-check: text_files.json=${onDiskTopic.length}, _order.json=${onDiskOrder.length} — OK`);
}
