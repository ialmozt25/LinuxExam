#!/usr/bin/env node
/**
 * m2.9 batch 4 — deterministic, format-preserving integration.
 *
 * Takes the ACCEPTED candidate JSON (bank format), appends it to
 * src/data/questions/file_management.json and _order.json, and bumps the
 * positional-distribution guard test 183 -> 189 (captain's decision D,
 * 2026-09-27). Textual insertion only: the pre-existing bytes are never
 * re-serialised, so the diff contains the new questions and nothing else.
 *
 * Usage:
 *   node .project/drafts/m2.9-batch4-integrate.mjs <accepted.json> [--dry-run]
 *
 * Refuses to run unless the bank is exactly 183 (guards against double-apply).
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const BANK_DIR = join(ROOT, 'src', 'data', 'questions');
const TARGET_FILE = join(BANK_DIR, 'file_management.json');
const ORDER_FILE = join(BANK_DIR, '_order.json');
const GUARD_FILE = join(BANK_DIR, '__tests__', 'positional-distribution.test.ts');

const EXPECTED_IDS = ['fm_013', 'fm_014', 'fm_015', 'fm_016', 'fm_017', 'fm_018'];
const BANK_BEFORE = 183;
const BANK_AFTER = 189;

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const src = args.find((a) => !a.startsWith('--'));
if (!src) {
  console.error('usage: node .project/drafts/m2.9-batch4-integrate.mjs <accepted.json> [--dry-run]');
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

// order must match EXPECTED_IDS (only the accepted subset, in canonical order)
const wantOrder = EXPECTED_IDS.filter((id) => list.some((q) => q.id === id));
const gotOrder = list.map((q) => q.id);
if (JSON.stringify(gotOrder) !== JSON.stringify(wantOrder)) {
  console.error(`ids must be a prefix-consistent subset of ${EXPECTED_IDS.join(', ')} in order.`);
  console.error(`  got:  ${gotOrder.join(', ')}`);
  console.error(`  want: ${wantOrder.join(', ')}`);
  process.exit(2);
}
for (const q of list) {
  if (allIds.has(q.id)) {
    console.error(`REFUSING: id ${q.id} already exists in the bank`);
    process.exit(3);
  }
  if (q.topic !== 'file_management') {
    console.error(`REFUSING: ${q.id} topic=${q.topic}, expected file_management`);
    process.exit(3);
  }
}

// ---- 1. topic file: append before the final `]` ----------------------------
const topicBytes = readFileSync(TARGET_FILE, 'utf8');
const topicBefore = JSON.parse(topicBytes).length;
const closeIdx = topicBytes.lastIndexOf(']');
if (closeIdx < 0) {
  console.error('malformed file_management.json: no closing ]');
  process.exit(4);
}
const head = topicBytes.slice(0, closeIdx).replace(/\s+$/, '');
const inner = JSON.stringify(list, null, 2).split('\n').slice(1, -1).join('\n');
const newTopicBytes = `${head},\n${inner}\n]\n`;

// ---- 2. _order.json: append ids before the final `]` -----------------------
const orderText = readFileSync(ORDER_FILE, 'utf8');
const order = JSON.parse(orderText);
if (order.length !== BANK_BEFORE) {
  console.error(`REFUSING: _order.json has ${order.length} ids, expected ${BANK_BEFORE}`);
  process.exit(3);
}
const orderClose = orderText.lastIndexOf(']');
const orderHead = orderText.slice(0, orderClose).replace(/\s+$/, '');
const newOrderBytes = `${orderHead},\n${wantOrder.map((id) => `  ${JSON.stringify(id)}`).join(',\n')}\n]\n`;

// ---- 3. guard test: 183 -> 189 + ledger comment ----------------------------
let guardText = readFileSync(GUARD_FILE, 'utf8');
let guardChanged = false;
if (guardText.includes(`const EXPECTED_QUESTIONS = ${BANK_BEFORE};`)) {
  guardText = guardText.replace(
    `const EXPECTED_QUESTIONS = ${BANK_BEFORE};`,
    `const EXPECTED_QUESTIONS = ${BANK_AFTER};`,
  );
  guardChanged = true;
}
const ledgerMarker = 'fm_013..fm_018';
if (!guardText.includes(ledgerMarker)) {
  guardText = guardText.replace(
    /(\/\/ batch \(ds_009\.\.ds_013\) to 14 \/ 177\.\n)/,
    `$1// the file_management MAS batch (fm_013..fm_018) to 14 / ${BANK_AFTER}.\n`,
  );
  guardChanged = true;
}

console.log(`accepted           : ${list.length} question(s) — ${wantOrder.join(', ')}`);
console.log(`bank               : ${bankBefore} -> ${bankBefore + list.length}`);
console.log(`file_management.json: +${newTopicBytes.length - topicBytes.length} bytes`);
console.log(`_order.json        : ${order.length} -> ${order.length + wantOrder.length}`);
console.log(`guard test         : ${guardChanged ? 'EXPECTED_QUESTIONS bumped to ' + BANK_AFTER : 'already up to date'}`);

if (dryRun) {
  // still validate that the produced bytes parse, so --dry-run proves the shape
  try {
    const parsedTopic = JSON.parse(newTopicBytes);
    const parsedOrder = JSON.parse(newOrderBytes);
    if (parsedTopic.length !== topicBefore + list.length) throw new Error('topic length mismatch');
    if (parsedOrder.length !== order.length + wantOrder.length) throw new Error('order length mismatch');
    console.log(`\n--dry-run: nothing written. Produced bytes parse OK (${parsedTopic.length} questions, ${parsedOrder.length} order ids).`);
  } catch (e) {
    console.error(`\n--dry-run FAILED validation: ${e.message}`);
    process.exit(5);
  }
  process.exit(0);
}

writeFileSync(TARGET_FILE, newTopicBytes, 'utf8');
writeFileSync(ORDER_FILE, newOrderBytes, 'utf8');
writeFileSync(GUARD_FILE, guardText, 'utf8');
console.log('\nwritten. Next: npm run manifest && npm run shuffle-bank (apply) && gates.');

// final self-check: the rewritten files must parse and agree
{
  const parsedTopic = JSON.parse(readFileSync(TARGET_FILE, 'utf8'));
  const parsedOrder = JSON.parse(readFileSync(ORDER_FILE, 'utf8'));
  if (parsedTopic.length !== BANK_AFTER - BANK_BEFORE + topicBefore) {
    console.error(`self-check: file_management.json has ${parsedTopic.length} questions, expected ${BANK_AFTER - BANK_BEFORE + topicBefore}`);
    process.exit(5);
  }
  if (parsedOrder.length !== BANK_AFTER) {
    console.error(`self-check: _order.json has ${parsedOrder.length} ids, expected ${BANK_AFTER}`);
    process.exit(5);
  }
  console.log(`self-check: file_management.json=${parsedTopic.length}, _order.json=${parsedOrder.length} — OK`);
}

