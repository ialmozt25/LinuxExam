#!/usr/bin/env node
/**
 * m2.9 batch 4 — Orchestrator's independent acceptance harness.
 *
 * Does NOT trust the Writer's evidence: it re-reads the candidate JSON and the
 * on-disk bank and re-derives every DOD/`content` constraint itself.
 *
 * Usage:
 *   node .project/drafts/m2.9-batch4-verify.mjs <candidates.json> [--json]
 *
 * Candidate file = JSON array of bank-format questions (the pending file).
 * Exit 0 = every hard check passed, exit 1 = at least one hard fail.
 */
import { createRequire } from 'node:module';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { checkRatio } = require('../../tools/_lib/ratio.cjs');

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const BANK_DIR = join(ROOT, 'src', 'data', 'questions');

const TOPIC = 'file_management';
const EXPECTED_IDS = ['fm_013', 'fm_014', 'fm_015', 'fm_016', 'fm_017', 'fm_018'];
const AVOID_LIST = [
  'ds_002', 'ds_014', 'rs_001', 'pm_014', 'pm_010',
  'fs_005', 'fs_006', 'fs_013', 'ls_002', 'ls_005', 'ls_007',
];
const CHAR_RATIO_HARD_MAX = 1.5; // DOD content
const CHAR_RATIO_SAFE_MAX = 1.3; // strictest qc.cjs class (sentences)

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const target = args.find((a) => !a.startsWith('--'));
if (!target) {
  console.error('usage: node .project/drafts/m2.9-batch4-verify.mjs <candidates.json> [--json]');
  process.exit(2);
}

// ---- bank ------------------------------------------------------------------
const bankFiles = readdirSync(BANK_DIR).filter((f) => f.endsWith('.json') && !f.startsWith('_'));
const bank = [];
for (const f of bankFiles) {
  for (const q of JSON.parse(readFileSync(join(BANK_DIR, f), 'utf8'))) bank.push(q);
}
const byId = new Map(bank.map((q) => [q.id, q]));

// ---- similarity (bigram Jaccard, same spirit as tools/qc.cjs) --------------
const norm = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/[^a-zа-яё0-9]+/giu, ' ')
    .trim();
function bigrams(s) {
  const t = norm(s).replace(/\s+/g, ' ');
  const set = new Set();
  for (let i = 0; i < t.length - 1; i++) set.add(t.slice(i, i + 2));
  return set;
}
function jaccard(a, b) {
  const A = bigrams(a);
  const B = bigrams(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const g of A) if (B.has(g)) inter++;
  return inter / (A.size + B.size - inter);
}

// ---- checks ----------------------------------------------------------------
const cands = JSON.parse(readFileSync(target, 'utf8'));
const list = Array.isArray(cands) ? cands : cands.questions;
if (!Array.isArray(list)) {
  console.error('candidate file must be a JSON array or {questions:[...]}');
  process.exit(2);
}

const hardFails = [];
const warns = [];
const rows = [];
const seenIds = new Set();

for (const q of list) {
  const fail = (m) => hardFails.push(`${q.id ?? '(no id)'}: ${m}`);
  const warn = (m) => warns.push(`${q.id ?? '(no id)'}: ${m}`);

  // structure
  if (!/^fm_\d{3}$/.test(q.id || '')) fail(`id не соответствует ^fm_\\d{3}$: ${q.id}`);
  if (seenIds.has(q.id)) fail('id повторяется внутри партии');
  seenIds.add(q.id);
  if (byId.has(q.id)) fail('id уже существует в банке');
  if (!EXPECTED_IDS.includes(q.id)) fail(`id вне заявленного диапазона fm_013..fm_018`);
  if (q.topic !== TOPIC) fail(`topic != ${TOPIC} (получено ${q.topic})`);
  if (!['easy', 'medium'].includes(q.difficulty)) fail(`difficulty вне enum: ${q.difficulty}`);
  if (!/^[1-9]$/.test(String(q.objective_domain))) fail(`objective_domain не одна цифра: ${q.objective_domain}`);
  if (typeof q.subtopic !== 'string' || !q.subtopic.trim()) fail('пустой subtopic');
  if (typeof q.question !== 'string' || !q.question.trim()) fail('пустой question');

  const opts = Array.isArray(q.options) ? q.options : [];
  if (opts.length !== 4) fail(`опций ${opts.length}, нужно ровно 4`);
  const correctCount = opts.filter((o) => o.correct === true).length;
  if (correctCount !== 1) fail(`correct: true встречается ${correctCount} раз, нужно ровно 1`);
  for (const [i, o] of opts.entries()) {
    if (typeof o.text !== 'string' || !o.text.trim()) fail(`опция ${i} пустая`);
    if (typeof o.correct !== 'boolean') fail(`опция ${i}: correct не boolean`);
  }

  // ratio — qc.cjs semantics: class by WORDS, ratio in CHARS
  let ratioInfo = null;
  if (opts.length === 4) {
    ratioInfo = checkRatio(opts, 'chars');
    if (ratioInfo.verdict === 'fail') {
      fail(`option ratio (${ratioInfo.type}) ${ratioInfo.ratio.toFixed(2)} > ${ratioInfo.threshold}`);
    } else if (ratioInfo.ratio > CHAR_RATIO_SAFE_MAX) {
      warn(`option ratio ${ratioInfo.ratio.toFixed(2)} ≤ qc-порога ${ratioInfo.threshold}, но > безопасного ${CHAR_RATIO_SAFE_MAX}`);
    }
    if (ratioInfo.ratio > CHAR_RATIO_HARD_MAX) fail(`option ratio ${ratioInfo.ratio.toFixed(2)} > DOD 1.5`);
  }

  // explanation
  const expl = String(q.explanation || '');
  const chars = expl.length;
  const lines = expl.split(/\r?\n/).length;
  if (chars < 200 || chars > 500) fail(`explanation ${chars} символов вне 200-500`);
  if (lines > 3) fail(`explanation ${lines} строк > 3`);

  // avoid-list: semantic overlap with explicitly avoided ids
  let avoidMax = 0;
  let avoidPair = '';
  for (const id of AVOID_LIST) {
    const ref = byId.get(id);
    if (!ref) continue; // ds_014 отсутствует — намеренный no-op
    const j = jaccard(q.question, ref.question);
    if (j > avoidMax) {
      avoidMax = j;
      avoidPair = id;
    }
  }
  if (avoidMax >= 0.6) fail(`близко к avoid-list ${avoidPair}: Jaccard ${avoidMax.toFixed(3)}`);

  // intra-batch duplicate stems
  let intraMax = 0;
  let intraPair = '';
  for (const o of list) {
    if (o === q || !o.id) continue;
    const j = jaccard(q.question, o.question);
    if (j > intraMax) {
      intraMax = j;
      intraPair = o.id;
    }
    if (j >= 0.6) fail(`дубль внутри партии с ${o.id}: Jaccard ${j.toFixed(3)}`);
  }

  // nearest neighbour in the whole bank (stem overlap)
  let bankMax = 0;
  let bankPair = '';
  for (const b of bank) {
    const j = jaccard(q.question, b.question);
    if (j > bankMax) {
      bankMax = j;
      bankPair = b.id;
    }
  }
  if (bankMax >= 0.7) warn(`высокое пересечение стема с банком ${bankPair}: Jaccard ${bankMax.toFixed(3)}`);

  rows.push({
    id: q.id,
    difficulty: q.difficulty,
    subtopic: q.subtopic,
    ratio: ratioInfo ? Number(ratioInfo.ratio.toFixed(3)) : null,
    ratio_class: ratioInfo ? ratioInfo.type : null,
    ratio_verdict: ratioInfo ? ratioInfo.verdict : null,
    explanation_chars: chars,
    explanation_lines: lines,
    intra_jaccard_max: Number(intraMax.toFixed(3)),
    intra_pair: intraPair,
    avoid_jaccard_max: Number(avoidMax.toFixed(3)),
    avoid_pair: avoidPair,
    bank_jaccard_max: Number(bankMax.toFixed(3)),
    bank_pair: bankPair,
  });
}

// batch-level
const easy = list.filter((q) => q.difficulty === 'easy').length;
const medium = list.filter((q) => q.difficulty === 'medium').length;
if (list.length !== 6) hardFails.push(`в партии ${list.length} вопросов, нужно ровно 6`);
if (easy !== 3 || medium !== 3) warns.push(`difficulty: easy=${easy}, medium=${medium} (в контракте 3/3)`);
const missing = EXPECTED_IDS.filter((id) => !seenIds.has(id));
if (missing.length) hardFails.push(`отсутствуют id: ${missing.join(', ')}`);

const report = {
  candidate_file: target,
  bank_size_before: bank.length,
  candidates: list.length,
  difficulty: { easy, medium },
  rows,
  hard_fails: hardFails,
  warns,
  verdict: hardFails.length === 0 ? 'PASS' : 'FAIL',
};

if (asJson) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`candidate file : ${target}`);
  console.log(`bank before    : ${bank.length}`);
  console.log(`candidates     : ${list.length} (easy=${easy}, medium=${medium})`);
  console.log('');
  console.log('id       diff    ratio  class      chars  lines  intraJ  avoidJ  bankJ  subtopic');
  for (const r of rows) {
    console.log(
      `${r.id.padEnd(8)} ${String(r.difficulty).padEnd(7)} ${String(r.ratio).padEnd(6)} ${String(
        r.ratio_class,
      ).padEnd(10)} ${String(r.explanation_chars).padEnd(6)} ${String(r.explanation_lines).padEnd(
        6,
      )} ${String(r.intra_jaccard_max).padEnd(7)} ${String(r.avoid_jaccard_max).padEnd(7)} ${String(
        r.bank_jaccard_max,
      ).padEnd(6)} ${r.subtopic}`,
    );
  }
  console.log('');
  if (hardFails.length) {
    console.log(`HARD FAILS (${hardFails.length}):`);
    for (const f of hardFails) console.log(`  - ${f}`);
  } else {
    console.log('HARD FAILS: none');
  }
  if (warns.length) {
    console.log(`WARNS (${warns.length}):`);
    for (const w of warns) console.log(`  - ${w}`);
  }
  console.log('');
  console.log(`VERDICT: ${report.verdict}`);
}

process.exitCode = hardFails.length === 0 ? 0 : 1;
