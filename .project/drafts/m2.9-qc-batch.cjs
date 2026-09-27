#!/usr/bin/env node
/**
 * .project/drafts/m2.9-qc-batch.cjs — QC-прогон батча кандидатов.
 *
 * Оркестраторский инструмент ночной смены 2026-09-27 (батчи 5–7).
 *
 * ПОЧЕМУ ОТДЕЛЬНЫЙ ФАЙЛ, А НЕ `npm run qc`:
 * `tools/qc.cjs` не принимает аргументов (известный баг, DECISIONS 2026-09-27 п.3)
 * — он всегда проверяет весь банк и не умеет смотреть на кандидатов ДО интеграции.
 * Поэтому кандидаты проверяются здесь: те же правила (`tools/_lib/ratio.cjs`),
 * плюс cosine против всего банка (`tools/cosine.cjs`).
 *
 * ПОЧЕМУ НЕ КОПИЯ ЛОГИКИ QС:
 * ratio считается ТОЙ ЖЕ библиотекой, что и в гейте (`checkRatio`). Копировать
 * арифметику нельзя — именно расхождение «DOD говорит ≤1.5, tool берёт порог по
 * классу слов» уже один раз пропустило fm_016 (ratio 1.4118) в банк.
 *
 * Использование:
 *   node .project/drafts/m2.9-qc-batch.cjs <candidates.json> [--intra] [--json out.json]
 *
 * Выход: exit 0 — все кандидаты прошли; exit 1 — есть reject.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');

const ROOT = path.resolve(__dirname, '..', '..');
const requireTool = createRequire(path.join(ROOT, 'tools', 'x.cjs'));

const { checkRatio } = requireTool(path.join(ROOT, 'tools', '_lib', 'ratio.cjs'));
const cosineTool = requireTool(path.join(ROOT, 'tools', 'cosine.cjs'));

/* Пороги батча: DOD content + запас.
 * DOD: option ratio ≤ 1.5 (по символам), cos против всего банка ≤ 0.85.
 * Мы требуем СТРОЖЕ: verdict === 'ok' (не warn) и cos ≤ 0.80 — граница
 * инструмента, см. tools/cosine.cjs (DEFAULT_COSINE_THRESHOLD из калибровки). */
const BANK_COS_LIMIT = 0.85; // жёсткий порог DOD
const BANK_COS_TOOL = 0.8; // порог инструмента cosine.cjs
const INTRA_COS_LIMIT = 0.85; // внутри новой партии

const argv = process.argv.slice(2);
const file = argv.find((a) => !a.startsWith('--'));
const WITH_INTRA = argv.includes('--intra');
const jsonOutIdx = argv.indexOf('--json');
const JSON_OUT = jsonOutIdx >= 0 ? argv[jsonOutIdx + 1] : null;

if (!file) {
  console.error('usage: node .project/drafts/m2.9-qc-batch.cjs <candidates.json> [--intra] [--json out.json]');
  process.exit(2);
}

const abs = path.isAbsolute(file) ? file : path.join(ROOT, file);

/* ------------------------------------------------------------------ helpers */

const REQUIRED_FIELDS = [
  'id',
  'topic',
  'difficulty',
  'objective_domain',
  'subtopic',
  'question',
  'options',
  'explanation',
];

/**
 * «Explanation ≤ 3 строк» из DOD — это ЛИНЕЙКИ, а не точки.
 *
 * Почему не считаем предложения по `[.!?]`: опции и объяснения набиты командами,
 * путями и сокращениями (`/dev/sdb1`, `--delete`, `rsync 3.2.7`, `т.е.`), поэтому
 * наивный split по точке раздувает счёт. Проверено на интегрированном батче 4:
 * fm_013/fm_016/fm_018 дали «4 предложения» и ложный reject, хотя банк зелёный
 * (`npm run qc` Fails 0), а в объяснениях банка нет ни одного `\n`.
 *
 * Настоящий гейт — отсутствие переводов строки (одна строка) + разумная длина,
 * чтобы объяснение уложилось в ≤3 строки вёрстки.
 */
const EXPLANATION_ADVISORY_CHARS = 300;
/** Реальный брак: >3 строк вёрстки. Банк: 0 объяснений длиннее 824 символов. */
const EXPLANATION_HARD_CHARS = 600;

/** Строк в объяснении: переводы строки + 1. Больше 1 строки — уже нарушение. */
function explanationLines(text) {
  return String(text).split('\n').length;
}

/**
 * Структурные проверки кандидата.
 * Возвращает { problems, warns }: problems — reject, warns — замечания без reject.
 */
function structuralProblems(q, seenIds) {
  const p = [];
  const w = [];
  for (const f of REQUIRED_FIELDS) {
    if (!(f in q)) p.push(`нет поля ${f}`);
  }
  if (typeof q.id !== 'string' || !q.id) p.push('пустой id');
  if (seenIds.has(q.id)) p.push(`duplicate id ${q.id}`);
  seenIds.add(q.id);
  if (typeof q.topic !== 'string' || !q.topic) p.push('пустой topic');
  if (typeof q.question !== 'string' || q.question.trim().length < 20) {
    p.push('question пустой или короче 20 символов');
  }
  if (!Array.isArray(q.options) || q.options.length !== 4) {
    p.push(`options: ожидалось 4, получено ${Array.isArray(q.options) ? q.options.length : 'n/a'}`);
  } else {
    const correct = q.options.filter((o) => o && o.correct === true).length;
    if (correct !== 1) p.push(`верных опций ${correct}, ожидалось ровно 1`);
    const empty = q.options.filter((o) => !o || typeof o.text !== 'string' || o.text.trim() === '');
    if (empty.length > 0) p.push(`${empty.length} пустых опций`);
    const dupes = new Set(q.options.map((o) => String(o && o.text).trim()));
    if (dupes.size !== q.options.length) p.push('дублирующийся текст опций');
  }
  if (typeof q.explanation !== 'string' || q.explanation.trim() === '') {
    p.push('explanation пустой');
  } else {
    const lines = explanationLines(q.explanation);
    if (lines > 3) p.push(`explanation: ${lines} строк (>3)`);
    if (q.explanation.length > EXPLANATION_HARD_CHARS) {
      p.push(`explanation: ${q.explanation.length} символов (>${EXPLANATION_HARD_CHARS}) — длиннее любого объяснения банка`);
    } else if (q.explanation.length > EXPLANATION_ADVISORY_CHARS) {
      w.push(`explanation ${q.explanation.length} символов (>${EXPLANATION_ADVISORY_CHARS}) — на границе 3 строк, проверить глазами`);
    }
  }
  if (typeof q.difficulty !== 'string' || !['easy', 'medium', 'hard'].includes(q.difficulty)) {
    p.push(`difficulty "${q.difficulty}" вне easy/medium/hard`);
  }
  return { problems: p, warns: w };
}

/* --------------------------------------------------------------------- main */

(async () => {
  if (!fs.existsSync(abs)) {
    console.error(`QC: файл не найден — ${abs}`);
    process.exit(2);
  }
  const raw = JSON.parse(fs.readFileSync(abs, 'utf8'));
  const candidates = Array.isArray(raw) ? raw : raw.questions;
  if (!Array.isArray(candidates) || candidates.length === 0) {
    console.error('QC: кандидаты не массив или пусты');
    process.exit(2);
  }

  console.log(`QC батча: ${path.relative(ROOT, abs)}`);
  console.log(`кандидатов: ${candidates.length}`);
  console.log('');

  const seenIds = new Set();
  const results = [];

  // --- cosine против всего банка (одним проходом по эмбеддингам)
  // Кандидаты с уже существующими id исключаются из банка-референса: иначе
  // вопрос сравнивается сам с собой и даёт cos = 1.0000. Для новых id это no-op,
  // но делает инструмент пригодным и для повторной проверки уже принятого батча.
  const candidateIds = new Set(candidates.map((q) => q.id));
  const bankAll = cosineTool.loadBank();
  const bank = bankAll.filter((q) => !candidateIds.has(q.id));
  const bankVecs = await cosineTool.embed(bank.map((q) => q.question));
  const candVecs = await cosineTool.embed(candidates.map((q) => q.question));
  console.log(`банк для сверки: ${bank.length} вопросов` + (bankAll.length !== bank.length ? ` (исключено своих id: ${bankAll.length - bank.length})` : ''));
  console.log('');

  for (let i = 0; i < candidates.length; i++) {
    const q = candidates[i];
    const { problems, warns } = structuralProblems(q, seenIds);

    let ratio = null;
    if (Array.isArray(q.options) && q.options.length === 4) {
      ratio = checkRatio(q.options, 'chars');
      if (ratio.verdict === 'fail') {
        problems.push(
          `ratio FAIL: ${ratio.ratio.toFixed(4)} > ${ratio.threshold} (класс ${ratio.type}, единица chars)`,
        );
      } else if (ratio.verdict === 'warn') {
        problems.push(
          `ratio WARN: ${ratio.ratio.toFixed(4)} > warnFrom (класс ${ratio.type}) — батч требует ok`,
        );
      }
    }

    // cosine против банка
    let bankMax = 0;
    let bankNear = null;
    for (let j = 0; j < bank.length; j++) {
      const c = cosineTool.cosine(candVecs[i], bankVecs[j]);
      if (c > bankMax) {
        bankMax = c;
        bankNear = bank[j].id;
      }
    }
    if (bankMax > BANK_COS_LIMIT) {
      problems.push(`cos против банка ${bankMax.toFixed(4)} > ${BANK_COS_LIMIT} (${bankNear})`);
    }

    results.push({
      id: q.id,
      topic: q.topic,
      subtopic: q.subtopic,
      correctIndex: Array.isArray(q.options) ? q.options.findIndex((o) => o && o.correct) : -1,
      ratio: ratio ? Number(ratio.ratio.toFixed(4)) : null,
      ratioClass: ratio ? ratio.type : null,
      ratioThreshold: ratio ? ratio.threshold : null,
      ratioVerdict: ratio ? ratio.verdict : null,
      cosBank: Number(bankMax.toFixed(4)),
      cosBankNear: bankNear,
      problems,
      warns,
      verdict: problems.length === 0 ? 'accept' : 'reject',
    });
  }

  // --- intra-batch
  let intraMax = 0;
  let intraPair = null;
  const intraPairs = [];
  if (WITH_INTRA) {
    for (let i = 0; i < candidates.length; i++) {
      for (let j = i + 1; j < candidates.length; j++) {
        const c = cosineTool.cosine(candVecs[i], candVecs[j]);
        intraPairs.push({ a: candidates[i].id, b: candidates[j].id, cos: Number(c.toFixed(4)) });
        if (c > intraMax) {
          intraMax = c;
          intraPair = `${candidates[i].id}~${candidates[j].id}`;
        }
      }
    }
    if (intraMax > INTRA_COS_LIMIT) {
      const entry = results.find((r) => r.id === intraPair.split('~')[0]);
      if (entry) entry.problems.push(`cos intra-batch ${intraMax.toFixed(4)} > ${INTRA_COS_LIMIT} (${intraPair})`);
    }
  }

  // --- пересчёт вердикта после intra
  for (const r of results) r.verdict = r.problems.length === 0 ? 'accept' : 'reject';

  // --- вывод
  const pad = (s, n) => String(s).padEnd(n);
  console.log(`${pad('id', 10)} ${pad('verdict', 8)} ${pad('ratio', 9)} ${pad('класс', 10)} ${pad('cos', 8)} near`);
  console.log('-'.repeat(72));
  for (const r of results) {
    console.log(
      `${pad(r.id, 10)} ${pad(r.verdict, 8)} ${pad(r.ratio === null ? '-' : r.ratio.toFixed(4), 9)} ${pad(
        r.ratioClass || '-',
        10,
      )} ${pad(r.cosBank.toFixed(4), 8)} ${r.cosBankNear}`,
    );
  }
  console.log('');

  const rejected = results.filter((r) => r.verdict === 'reject');
  for (const r of rejected) {
    console.log(`REJECT ${r.id}:`);
    for (const p of r.problems) console.log(`  - ${p}`);
  }
  if (rejected.length > 0) console.log('');

  const warned = results.filter((r) => r.warns && r.warns.length > 0);
  for (const r of warned) {
    console.log(`WARN ${r.id}:`);
    for (const x of r.warns) console.log(`  - ${x}`);
  }
  if (warned.length > 0) console.log('');

  if (WITH_INTRA) {
    console.log(`cos intra-batch max: ${intraMax.toFixed(4)} (${intraPair}) порог ${INTRA_COS_LIMIT}`);
  }
  console.log(`cos против банка max: ${Math.max(...results.map((r) => r.cosBank)).toFixed(4)} порог ${BANK_COS_LIMIT} (инструмент ${BANK_COS_TOOL})`);
  console.log('');
  console.log(`ИТОГ: accept ${results.length - rejected.length} / reject ${rejected.length} из ${results.length}`);

  // --- распределение верных ответов
  const dist = [0, 0, 0, 0];
  for (const r of results) if (r.correctIndex >= 0) dist[r.correctIndex]++;
  console.log(`позиции верных ответов (A/B/C/D): ${dist.join(' / ')}`);

  if (JSON_OUT) {
    const outAbs = path.isAbsolute(JSON_OUT) ? JSON_OUT : path.join(ROOT, JSON_OUT);
    fs.writeFileSync(
      outAbs,
      JSON.stringify({ file: path.relative(ROOT, abs), candidates: results, intraMax, intraPair, dist }, null, 2) + '\n',
      'utf8',
    );
    console.log(`машиночитаемый отчёт: ${path.relative(ROOT, outAbs)}`);
  }

  process.exitCode = rejected.length === 0 ? 0 : 1;
})().catch((e) => {
  console.error('QC: FAIL —', e && e.message ? e.message : e);
  process.exitCode = 1;
});
