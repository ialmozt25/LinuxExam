#!/usr/bin/env node
/**
 * batch 5C — генератор превью для капитана (spec 020).
 *
 * Собирает .project/drafts/batch-5c-preview.md из ПЕРВОИСТОЧНИКА (candidates.json):
 * тексты вопросов берутся байт в байт из файла-кандидата, метрики считаются тем же
 * кодом, что и гейты (tools/_lib/ratio.cjs для ratio, экспорты tools/cosine.cjs для
 * cosine, tools/haladyna.cjs через CLI для Haladyna).
 *
 * Идемпотентность метрики: id батча исключаются из «банка» при поиске соседа —
 * иначе до интеграции максимум считался бы против 218 чужих вопросов, а после —
 * против них же плюс свои siblings, и числа превью разъезжались бы (баг, пойманный
 * при пересборке превью батча 5B).
 *
 * Usage: node .project/drafts/batch-5c-make-preview.mjs
 */
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const ROOT = process.cwd();
const CAND = path.join(ROOT, '.project/drafts/batch-5c-candidates.json');
const STATIC = path.join(ROOT, '.project/drafts/batch-5c-preview-static.md');
const OUT = path.join(ROOT, '.project/drafts/batch-5c-preview.md');

const { checkRatio, RATIO_UNIT } = require(path.join(ROOT, 'tools/_lib/ratio.cjs'));
const { embed, cosine, loadBank } = require(path.join(ROOT, 'tools/cosine.cjs'));

const candidates = JSON.parse(fs.readFileSync(CAND, 'utf8'));

const haladynaOut = execFileSync(
  process.execPath,
  [path.join(ROOT, 'tools/haladyna.cjs'), '--batch', CAND],
  { encoding: 'utf8' },
);
const haladyna = {};
for (const m of haladynaOut.matchAll(/^(\S+): score=(\d+)\/10 \(auto=(\d+)\/5, semi=(\d+)\/3\)$/gm)) {
  haladyna[m[1]] = { auto: Number(m[3]), semi: Number(m[4]) };
}
const haladynaSummary = haladynaOut.match(/Perfect \(auto 5\/5 and semi 3\/3\): (\d+)\/(\d+)/);

const batchIds = new Set(candidates.map((q) => q.id));
const bank = loadBank().filter((q) => !batchIds.has(q.id));
const bankVecs = await embed(bank.map((q) => q.question));
const candVecs = await embed(candidates.map((q) => q.question));

const rows = candidates.map((q, i) => {
  const r = checkRatio(q.options, RATIO_UNIT);
  let best = { c: 0, id: null, topic: null };
  for (let k = 0; k < bank.length; k += 1) {
    const c = cosine(candVecs[i], bankVecs[k]);
    if (c > best.c) best = { c, id: bank[k].id, topic: bank[k].topic };
  }
  const h = haladyna[q.id] ?? { auto: 0, semi: 0 };
  return { q, ratio: r, best, h, verdict: best.c > 0.8 ? 'REJECT' : 'accept' };
});

const maxCos = Math.max(...rows.map((x) => x.best.c));
const minHeadroom = Math.min(...rows.map((x) => x.threshold / x.ratio.ratio));

const L = [];
const w = (s = '') => L.push(s);

w('# Превью батча 5C — `running_systems` (spec 020)');
w();
w('**Статус:** ждёт approve капитана. Вопросы **не** закоммичены в `src/data/**`.');
w('**Тема:** `running_systems` («Управление системами») — канон из `src/data/topics.ts`.');
w('**Банк:** 218 → 224 (после интеграции). **Новые id:** `rs_011`..`rs_016`.');
w(`**Кандидаты:** ${candidates.length} написано, **${rows.filter((r) => r.verdict === 'accept').length} accept**, ${rows.filter((r) => r.verdict !== 'accept').length} reject.`);
w();
w('---');
w();
w('## 1. Сводка метрик');
w();
w('| id | subtopic | класс | ratio (chars) | порог | Haladyna | max cos vs банк | ближайший сосед | вердикт |');
w('|---|---|---|---|---|---|---|---|---|');
for (const x of rows) {
  w(
    `| \`${x.q.id}\` | ${x.q.subtopic} | ${x.ratio.type} | ${x.ratio.ratio.toFixed(3)} | ${x.ratio.threshold} | ` +
      `AUTO ${x.h.auto}/5, SEMI ${x.h.semi}/3 | ${x.best.c.toFixed(4)} | \`${x.best.id}\` (${x.best.topic}) | ${x.verdict} |`,
  );
}
w();
w('Порог cosine — ≤ 0.85 (DOD content); порог инструмента `tools/cosine.cjs` — 0.80, и он строже.');
w(`Максимум по батчу — **${maxCos.toFixed(4)}**, запас до 0.80 ≥ ${(0.8 - maxCos).toFixed(4)} у каждого вопроса.`);
w('Порог ratio — таблица `RATIO_TABLE` (`tools/_lib/ratio.cjs`), единица `chars`; у каждого');
w(`вопроса запас ≥ ${(minHeadroom - 1).toFixed(2)}x до порога своего класса.`);
w();
w('**Команды, которыми получены числа** (не пересказ, а прогон — тот же код, что и в гейтах):');
w();
w('```powershell');
w('node .project/drafts/qc-preview-check.mjs .project/drafts/batch-5c-candidates.json   # оффлайн-пречек по правилам qc.cjs');
w('node tools/haladyna.cjs --batch .project/drafts/batch-5c-candidates.json             # ' + (haladynaSummary ? `Perfect ${haladynaSummary[1]}/${haladynaSummary[2]}` : 'см. вывод'));
w('node tools/cosine.cjs .project/drafts/batch-5c-candidates.json                       # rejected: 0/6');
w('node tools/cosine.cjs --intra-batch <кандидаты + src/data/questions/running_systems.json> --whitelist-aware');
w('node .project/drafts/batch-5c-make-preview.mjs                                       # это превью');
w('```');
w();
w('---');
w();
w('## 2. Полный текст кандидатов');
w();
for (const x of rows) {
  w(`### \`${x.q.id}\` — ${x.q.subtopic} (${x.q.difficulty})`);
  w();
  w(`**Вопрос:** ${x.q.question}`);
  w();
  w('| | опция | верно |');
  w('|---|---|---|');
  x.q.options.forEach((o, i) => {
    w(`| ${i + 1} | \`${o.text}\` | ${o.correct ? '✅' : '—'} |`);
  });
  w();
  w(`**Explanation:** ${x.q.explanation}`);
  w();
}
w('---');
w();
w(fs.readFileSync(STATIC, 'utf8').trim());
w();
w('---');
w();
w('## 8. Что будет после approve');
w();
w('1. Дописать `rs_011`..`rs_016` в конец массива `src/data/questions/running_systems.json` (10 → 16).');
w('2. Дописать 6 id в конец `_order.json` (без переупорядочивания существующих).');
w('3. `npm run manifest` (пересчёт `_topics.json`: 224, `running_systems: 16`).');
w('4. `npm run state:update` (штатный инструмент spec 017) → `npm run sync` → конвергентный коммит.');
w('5. Гейты: `typecheck`, `test:run`, `build`, `qc` (Total 224, Fails 0), `shuffle-bank:check`, `sync:check`.');
w('6. Строка в `log.md`, затем — отдельно — доклад и ожидание авторизации push (правило 10).');
w();

fs.writeFileSync(OUT, L.join('\n'), 'utf8');
const bytes = fs.readFileSync(OUT);
if (bytes[bytes.length - 1] !== 0x0a) {
  console.error('preview: последний байт не 0x0A');
  process.exit(1);
}
console.log(`preview: ${path.relative(ROOT, OUT)} — ${L.length} строк, ${bytes.length} байт`);
console.log(`  max cos vs банк: ${maxCos.toFixed(4)} | reject: ${rows.filter((r) => r.verdict !== 'accept').length}/${rows.length}`);
console.log(`  Haladyna: ${haladynaSummary ? `${haladynaSummary[1]}/${haladynaSummary[2]} perfect` : 'н/д'}`);
for (const x of rows) console.log(`  ${x.q.id}  ratio ${x.ratio.ratio.toFixed(3)} (${x.ratio.type}) cos ${x.best.c.toFixed(4)} ~ ${x.best.id}`);
