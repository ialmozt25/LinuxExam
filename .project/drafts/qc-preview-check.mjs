#!/usr/bin/env node
/**
 * Offline pre-check кандидатов батча по ПРАВИЛАМ ГЕЙТА `tools/qc.cjs`.
 *
 * Зачем отдельный файл (а не прогон `npm run qc`): `qc.cjs` проверяет банк, а не
 * черновик, поэтому блокер вида «опции токен-идентичны» обнаружился бы только
 * ПОСЛЕ интеграции в `src/data/**` (так и вышло в батче 5B: Fails 2 на sh_012, и
 * потребовался rework уже интегрированного контента).
 *
 * Правила продублированы ДОСЛОВНО по `tools/qc.cjs:61-195` — и это осознанно:
 * `qc.cjs` менять нельзя (вне скоупа заданий), а расхождение копии с оригиналом
 * ловится тем, что после интеграции всё равно прогоняется настоящий `qc`.
 *
 * Проверяет: id-схему, 4 опции / ровно 1 верная, bigram Jaccard ≤ 0.9 между
 * опциями, placeholder'ы (`[...]`, `{...}`, `<...>`), option ratio (пороги класса),
 * подсказку по длине верной опции, стоп-слова и пробел перед знаком препинания.
 * Дополнительно проверяет то, что qc.cjs не смотрит, но смотрят гейты DOD:
 * cosine против банка (экспорты tools/cosine.cjs) и Haladyna (через CLI).
 *
 * Usage: node .project/drafts/qc-preview-check.mjs <candidates.json> [--no-cosine]
 */
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const ROOT = process.cwd();
const [file] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (!file) {
  console.error('usage: node .project/drafts/qc-preview-check.mjs <candidates.json>');
  process.exit(2);
}

const { checkRatio, RATIO_UNIT, RULES } = require(path.join(ROOT, 'tools/_lib/ratio.cjs'));
const candidates = JSON.parse(fs.readFileSync(file, 'utf8'));

// ---- дословные копии из tools/qc.cjs --------------------------------------
function tokenize(text) {
  return text
    .split(/\s+/)
    .map((t) => t.replace(/^[,.;:!?()\[\]{}"']+|[,.;:!?()\[\]{}"']+$/g, ''))
    .filter(Boolean);
}
function bigrams(tokens) {
  if (tokens.length < 2) return tokens.map((t) => `[${t}]`);
  const grams = [];
  for (let i = 0; i < tokens.length - 1; i += 1) grams.push(`${tokens[i]} ${tokens[i + 1]}`);
  return grams;
}
function jaccard(a, b) {
  const A = new Set(a);
  const B = new Set(b);
  if (A.size === 0 && B.size === 0) return 1;
  if (A.size === 0 || B.size === 0) return 0;
  const inter = [...A].filter((x) => B.has(x)).length;
  return inter / new Set([...A, ...B]).size;
}
const ID_RE = /^[a-z]{2,4}_\d{3}$/;
const PLACEHOLDER = /<[^>]+>|\[[^\]]+\]|\{[^}]+\}/;

let fails = 0;
let warns = 0;
const fail = (id, msg) => { fails += 1; console.log(`FAIL ${id}: ${msg}`); };
const warn = (id, msg) => { warns += 1; console.log(`WARN ${id}: ${msg}`); };

const seen = new Set();
const rows = [];

for (const q of candidates) {
  if (!q.id || !ID_RE.test(q.id)) fail(q.id ?? '?', `bad id (${ID_RE})`);
  if (seen.has(q.id)) fail(q.id, 'duplicate id');
  seen.add(q.id);
  if (!q.question || q.question.trim().length < 10) fail(q.id, 'stem too short');
  if (!q.explanation || q.explanation.trim().length < 30) fail(q.id, 'explanation too short');
  if (!/^[1-9]$/.test(q.objective_domain ?? '')) fail(q.id, `objective_domain=${q.objective_domain}`);
  if (!Array.isArray(q.options) || q.options.length !== 4) { fail(q.id, 'options != 4'); continue; }
  if (q.options.filter((o) => o.correct === true).length !== 1) fail(q.id, 'correct count != 1');
  for (const o of q.options) {
    if (typeof o.text !== 'string' || !o.text.trim()) fail(q.id, 'empty option');
    if (PLACEHOLDER.test(o.text)) fail(q.id, `placeholder in option: ${o.text.slice(0, 60)}`);
  }
  if (PLACEHOLDER.test(q.question)) fail(q.id, 'placeholder in stem');

  const grams = q.options.map((o) => bigrams(tokenize(o.text)));
  for (let i = 0; i < grams.length; i += 1) {
    for (let j = i + 1; j < grams.length; j += 1) {
      const jac = jaccard(grams[i], grams[j]);
      if (jac > 0.9) fail(q.id, `options ${i}/${j} bigram jaccard ${jac.toFixed(2)} > 0.9 (токены: ${JSON.stringify(tokenize(q.options[i].text))} vs ${JSON.stringify(tokenize(q.options[j].text))})`);
    }
  }

  const r = checkRatio(q.options, RATIO_UNIT);
  if (r.verdict === 'fail') fail(q.id, `option ratio (${r.type}) ${r.ratio.toFixed(2)} > ${r.threshold}`);
  else if (r.verdict === 'warn') warn(q.id, `option ratio (${r.type}) ${r.ratio.toFixed(2)} > warn ${RULES[r.type].warnFrom}`);

  const correct = q.options.filter((o) => o.correct === true);
  const distractors = q.options.filter((o) => o.correct !== true);
  if (correct.length === 1 && distractors.length > 0) {
    const avg = distractors.reduce((s, o) => s + o.text.length, 0) / distractors.length;
    if (avg > 0 && correct[0].text.length > avg * 1.3) {
      warn(q.id, `correct option > avg distractor by >30% (${correct[0].text.length} vs ${avg.toFixed(1)})`);
    }
  }

  const stopwordCheck = (label, text) => {
    if (typeof text !== 'string') return;
    if (/в течении/iu.test(text)) warn(q.id, `stopword "в течении" in ${label}`);
    if (/ {2,}/.test(text)) warn(q.id, `double space in ${label}`);
    if (/\s+[,;:!?]/.test(text) || /[а-яА-ЯёЁ]\s+\.(?=\s|$)/.test(text)) {
      warn(q.id, `space before punctuation in ${label}`);
    }
  };
  stopwordCheck('stem', q.question);
  q.options.forEach((o, i) => stopwordCheck(`option ${i}`, o.text));
  stopwordCheck('explanation', q.explanation);

  const absRu = /(?<![а-яё])(все|всё|ни один|кроме|всегда|никогда)(?![а-яё])/iu;
  if (absRu.test(q.question) && !/не\s+(все|всё|всегда|никогда)/iu.test(q.question)) {
    warn(q.id, 'absolute term in question stem');
  }

  rows.push({ id: q.id, type: r.type, ratio: r.ratio, threshold: r.threshold });
}

// ---- Haladyna (тот же CLI, что в гейтах) ----------------------------------
let haladynaLine = 'н/д';
try {
  const out = execFileSync(process.execPath, [path.join(ROOT, 'tools/haladyna.cjs'), '--batch', file], { encoding: 'utf8' });
  haladynaLine = out.match(/Perfect \(auto 5\/5 and semi 3\/3\): \d+\/\d+/)?.[0] ?? 'н/д';
} catch (e) {
  haladynaLine = 'FAIL: ' + (e.stdout ?? e.message).toString().split('\n').slice(0, 3).join(' | ');
}

// ---- cosine против банка ---------------------------------------------------
const batchIds = new Set(candidates.map((q) => q.id));
const { embed, cosine, loadBank, DEFAULT_COSINE_THRESHOLD } = require(path.join(ROOT, 'tools/cosine.cjs'));
const bank = loadBank().filter((b) => !batchIds.has(b.id));
const vecs = await embed([...bank.map((q) => q.question), ...candidates.map((q) => q.question)]);
const bankVecs = vecs.slice(0, bank.length);
const candVecs = vecs.slice(bank.length);
const cosRows = [];
for (let i = 0; i < candidates.length; i += 1) {
  let best = { c: 0, id: null, topic: null };
  for (let k = 0; k < bank.length; k += 1) {
    const c = cosine(candVecs[i], bankVecs[k]);
    if (c > best.c) best = { c, id: bank[k].id, topic: bank[k].topic };
  }
  if (best.c > DEFAULT_COSINE_THRESHOLD) fails += 1;
  cosRows.push({ id: candidates[i].id, id_: best.id, ...best, reject: best.c > DEFAULT_COSINE_THRESHOLD });
}

console.log('\n--- pre-check ---');
console.log(`кандидатов: ${candidates.length} | fail: ${fails} | warn: ${warns}`);
for (const r of rows) console.log(`  ${r.id}  ratio ${r.ratio.toFixed(3)} (${r.type}, порог ${r.threshold})`);
console.log(`Haladyna: ${haladynaLine}`);
for (const c of cosRows) {
  console.log(`  ${c.reject ? 'REJECT' : 'ok    '} ${c.id}  cos ${c.c.toFixed(4)} ~ ${c.id_} (${c.topic})`);
}
process.exitCode = fails > 0 ? 1 : 0;
