#!/usr/bin/env node
/**
 * M2.9 batch 4 — builds the captain-facing preview.
 *
 * Inputs:
 *   --questions <final.json>   accepted questions, bank format (JSON array)
 *   --cosine    <cosine.json>  { "<id>": <max cosine against the whole bank> }
 *   --qc        <qc.yaml>      QC output (writer_to_qc -> qc_to_orchestrator)
 *   --out       <path>         default .project/drafts/batch-4-preview.md
 *
 * The preview content is generated from the SAME bytes that are about to be
 * committed, so the captain cannot approve something different from the diff.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import yaml from 'js-yaml';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { checkRatio } = require('../../tools/_lib/ratio.cjs');

const args = process.argv.slice(2);
const arg = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

const questionsPath = arg('questions');
const cosinePath = arg('cosine');
const qcPath = arg('qc');
const outPath = arg('out') || '.project/drafts/batch-4-preview.md';
if (!questionsPath) {
  console.error('usage: node .project/drafts/m2.9-batch4-make-preview.mjs --questions <final.json> [--cosine cos.json] [--qc qc.yaml] [--out path]');
  process.exit(2);
}

const questions = JSON.parse(readFileSync(questionsPath, 'utf8'));
const cosine = cosinePath ? JSON.parse(readFileSync(cosinePath, 'utf8')) : {};
const qc = qcPath ? yaml.load(readFileSync(qcPath, 'utf8')) : null;
const qcPer = new Map(((qc && qc.per_question) || []).map((p) => [p.question_id, p]));

const LETTERS = ['A', 'B', 'C', 'D'];
const lines = [];
const N = questions.length;

lines.push(`# Batch 4 preview — ${N} вопросов из 6`);
lines.push('');
lines.push(`Тема: \`file_management\` («Управление файлами», канон \`src/data/topics.ts:22\`) · ` +
  `банк 183 → ${183 + N} · spec \`001-file-management-batch-4\` · ${new Date().toISOString().slice(0, 10)}`);
lines.push('');
lines.push('> Файл сгенерирован из тех же байтов, которые пойдут в коммит.');
lines.push('');

// ---- 1. QC table -----------------------------------------------------------
lines.push('## Таблица QC');
lines.push('');
lines.push('| id | cos против банка | ratio (класс) | порог | вердикт QC | вердикт Оркестратора |');
lines.push('|---|---|---|---|---|---|');
for (const q of questions) {
  const r = checkRatio(q.options, 'chars');
  const cos = cosine[q.id];
  const pq = qcPer.get(q.id);
  lines.push(
    `| \`${q.id}\` | ${cos === undefined ? '—' : cos.toFixed(4)} | ${r.ratio.toFixed(4)} (${r.type}) | ${r.threshold} | ` +
      `${pq ? pq.verdict : '—'} | accept |`,
  );
}
lines.push('');
if (cosine.__intra_max !== undefined) {
  lines.push(`- cosine intra-batch max: **${cosine.__intra_max}** (порог 0.85 / инструмент 0.80)`);
}
const cosVals = questions.map((q) => cosine[q.id]).filter((v) => typeof v === 'number');
if (cosVals.length) {
  lines.push(`- cosine против всего банка max: **${Math.max(...cosVals).toFixed(4)}** (порог 0.85)`);
}
lines.push('');

// ---- 2. per question -------------------------------------------------------
lines.push('## Вопросы');
lines.push('');
for (const q of questions) {
  lines.push(`### \`${q.id}\` — ${q.subtopic}`);
  lines.push('');
  lines.push(`- **topic:** \`${q.topic}\` · **difficulty:** ${q.difficulty} · **objective_domain:** \`${q.objective_domain}\``);
  lines.push(`- **question:** ${q.question}`);
  lines.push('');
  for (const [i, o] of q.options.entries()) {
    lines.push(`  - **${LETTERS[i]}.** ${o.text}${o.correct ? '  ← **верный**' : ''}`);
  }
  lines.push('');
  const correct = q.options.findIndex((o) => o.correct);
  lines.push(`- **correct:** ${LETTERS[correct]}`);
  lines.push(`- **explanation:** ${q.explanation}`);
  lines.push('');
}

// ---- 3. rejected -----------------------------------------------------------
if (qc && qc.per_question) {
  const rejected = qc.per_question.filter((p) => p.verdict !== 'accept');
  lines.push('## Отклонённые');
  lines.push('');
  if (rejected.length) {
    for (const p of rejected) lines.push(`- \`${p.question_id}\` — ${p.reason}`);
  } else {
    lines.push('нет');
  }
  lines.push('');
  if (qc.issues && qc.issues.length) {
    lines.push('## Замечания QC (advisory)');
    lines.push('');
    lines.push('| id | severity | pass | описание |');
    lines.push('|---|---|---|---|');
    for (const i of qc.issues) {
      lines.push(`| \`${i.question_id}\` | ${i.severity} | ${i.pass} | ${i.description} |`);
    }
    lines.push('');
  }
}

writeFileSync(outPath, `${lines.join('\n')}\n`, 'utf8');
console.log(`wrote ${outPath} — ${N} questions`);
