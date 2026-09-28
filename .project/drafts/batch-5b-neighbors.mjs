#!/usr/bin/env node
/**
 * Диагностика cosine для кандидатов батча (batch 5B).
 *
 * `tools/cosine.cjs <file>` печатает только максимальные jaccard/cosine, но не
 * говорит, ЧЕЙ это сосед. Этот скрипт использует экспорты того же модуля
 * (embed/cosine/loadBank) и печатает top-N ближайших вопросов банка для каждого
 * кандидата — чтобы править стем по адресу, а не вслепую.
 *
 * Usage: node .project/drafts/batch-5b-neighbors.mjs <candidates.json> [topN]
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { embed, cosine, loadBank, DEFAULT_COSINE_THRESHOLD } = require('../../tools/cosine.cjs');

const [file, topNArg] = process.argv.slice(2);
if (!file) {
  console.error('usage: node .project/drafts/batch-5b-neighbors.mjs <candidates.json> [topN]');
  process.exit(2);
}
const topN = Number(topNArg) || 5;

const fs = require('node:fs');
const json = JSON.parse(fs.readFileSync(file, 'utf8'));
const candidates = Array.isArray(json) ? json : json.questions;

const bank = loadBank();
const bankVecs = await embed(bank.map((q) => q.question));
const candVecs = await embed(candidates.map((q) => q.question));

console.log(`threshold cosine > ${DEFAULT_COSINE_THRESHOLD}, bank=${bank.length}`);
for (let i = 0; i < candidates.length; i++) {
  const scored = bank
    .map((q, k) => ({ id: q.id, topic: q.topic, c: cosine(candVecs[i], bankVecs[k]), stem: q.question }))
    .sort((a, b) => b.c - a.c)
    .slice(0, topN);
  const worst = scored[0].c;
  const flag = worst > DEFAULT_COSINE_THRESHOLD ? 'REJECT' : 'ok    ';
  console.log(`\n${flag} ${candidates[i].id}  max=${worst.toFixed(4)}`);
  for (const s of scored) {
    console.log(`   ${s.c.toFixed(4)}  ${s.id} (${s.topic})  ${s.stem.slice(0, 88)}`);
  }
}
