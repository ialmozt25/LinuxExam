'use strict';

// Общая библиотека оценки option ratio по ЧИСЛУ СЛОВ (не символов).
// Правила — HANDOFF §5.2 / docs/DISTRACTOR-TYPES.md §1.
// Подключается из tools/qc.cjs и tools/haladyna.cjs.

const RULES = {
  sentences: { threshold: 1.3, warnFrom: 1.25 },
  token: { threshold: 2.0, warnFrom: 1.35 },
  mixed: { threshold: 1.5, warnFrom: 1.35 },
};

// Опции в банке — объекты { text, correct }, но принимаем и строки.
function textOf(option) {
  if (typeof option === 'string') return option;
  if (option && typeof option.text === 'string') return option.text;
  return '';
}

function wordCount(text) {
  return String(text).trim().split(/\s+/).filter(Boolean).length;
}

// Единица измерения длины. Правило §5.2 записано «в словах», но банк 106
// исторически выверялся по символам (см. tools/qc.cjs: o.text.length).
// Аудит 2026-09-25: по словам 10 вопросов дают FAIL (в т.ч. fm_003), по
// символам — 0. Поэтому единица параметризована, а qc.cjs зовёт 'chars'.
function lengthOf(option, unit) {
  return unit === 'chars' ? textOf(option).length : wordCount(textOf(option));
}

// sentences: все опции ≥ 4 слов; token: все ≤ 3 слов; иначе mixed.
function classifyOptions(options) {
  const counts = (options || []).map((o) => wordCount(textOf(o)));
  if (counts.length === 0) return 'mixed';
  if (counts.every((c) => c >= 4)) return 'sentences';
  if (counts.every((c) => c <= 3)) return 'token';
  return 'mixed';
}

// max(len) / min(len). Пустая опция даёт Infinity — это сигнал, не 0.
function computeRatio(options, unit = 'words') {
  const counts = (options || []).map((o) => lengthOf(o, unit));
  if (counts.length === 0) return 0;
  const min = Math.min(...counts);
  const max = Math.max(...counts);
  if (min <= 0) return Infinity;
  return max / min;
}

function checkRatio(options, unit = 'words') {
  const type = classifyOptions(options);
  const ratio = computeRatio(options, unit);
  const rule = RULES[type];
  let verdict = 'ok';
  if (ratio > rule.threshold) verdict = 'fail';
  else if (ratio > rule.warnFrom) verdict = 'warn';
  return { type, ratio, verdict, threshold: rule.threshold, unit };
}

module.exports = { RULES, textOf, wordCount, lengthOf, classifyOptions, computeRatio, checkRatio };
