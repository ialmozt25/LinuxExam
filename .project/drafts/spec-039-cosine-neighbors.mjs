#!/usr/bin/env node
/**
 * spec 039 — cosine-гейт для правок банка на месте (in-place rewrite).
 *
 * Зачем: `tools/cosine.cjs <pending.json>` сверяет кандидата против ВСЕГО банка,
 * включая его самого. Для правок «на месте» (msw_011: `.el9` → `.el10`, ug_002:
 * переформулировка) это даёт ложный REJECT (cos = 1.0 с собственной строкой банка),
 * поэтому тем же экспортируемым API считается максимум по банку С ИСКЛЮЧЕНИЕМ
 * самого id.
 *
 * Тот же модуль, тот же порог, что и у гейта: `DEFAULT_COSINE_THRESHOLD`
 * из `tools/cosine-calibration.json` (`thresholds.cosine`).
 *
 * Usage: node .project/drafts/spec-039-cosine-neighbors.mjs <id> [<id> ...]
 * Выход:  0 — у всех id max cosine <= порога; 1 — есть id выше порога; 2 — ошибка входа.
 */

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { embed, cosine, loadBank, DEFAULT_COSINE_THRESHOLD } = require('../../tools/cosine.cjs');

const TOP_N = 3;
const ids = process.argv.slice(2).filter((a) => !a.startsWith('--'));

if (ids.length === 0) {
  console.error('usage: node .project/drafts/spec-039-cosine-neighbors.mjs <id> [<id> ...]');
  process.exit(2);
}

const bank = loadBank();
const vectors = await embed(bank.map((q) => q.question));

const over = [];
console.log(`bank=${bank.length} threshold=${DEFAULT_COSINE_THRESHOLD}`);

for (const id of ids) {
  const k = bank.findIndex((q) => q.id === id);
  if (k < 0) {
    console.error(`MISSING id in bank: ${id}`);
    process.exit(2);
  }
  const top = bank
    .map((q, i) => ({ id: q.id, topic: q.topic, c: cosine(vectors[k], vectors[i]) }))
    .filter((s) => s.id !== id)
    .sort((a, b) => b.c - a.c)
    .slice(0, TOP_N);
  const max = top.length ? top[0].c : 0;
  const bad = max > DEFAULT_COSINE_THRESHOLD;
  if (bad) over.push(id);
  console.log(
    `${bad ? 'REJECT' : 'ok    '} ${id}  max=${max.toFixed(4)}  ` +
      top.map((s) => `${s.id}:${s.c.toFixed(4)}`).join(' ')
  );
}

console.log(`checked=${ids.length} over_threshold=${over.length}${over.length ? ' :: ' + over.join(',') : ''}`);
process.exit(over.length ? 1 : 0);
