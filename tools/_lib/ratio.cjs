'use strict';

// Общая библиотека оценки option ratio. Подключается из tools/qc.cjs и
// tools/haladyna.cjs.
//
// Две РАЗНЫЕ величины, которые легко перепутать (spec 007):
//   * длина опции измеряется в СИМВОЛАХ — единица гейта RATIO_UNIT ниже;
//   * класс порогов выбирается по ЧИСЛУ СЛОВ — колонка `when` в RATIO_TABLE.
// Writer, считающий запас арифметикой по «≤ 1.5», систематически переоценивал
// его и валил гейт на зелёном по DOD вопросе (fm_016, batch 4; DECISIONS
// 2026-09-27 п. 2). Поэтому единица объявлена здесь один раз, а пороги сведены
// в одну таблицу-источник истины.
//
// Правила — HANDOFF §5.2 / docs/DISTRACTOR-TYPES.md §1.

// Единственная единица измерения option ratio в проекте: длина опции в символах.
// Её импортируют tools/qc.cjs и tools/haladyna.cjs — собственных литералов
// 'chars' у потребителей быть не должно.
const RATIO_UNIT = 'chars';

// Человекочитаемое имя единицы — для логов, документации и тестов.
const RATIO_UNIT_LABEL = 'символы';

// ЕДИНСТВЕННЫЙ ИСТОЧНИК ИСТИНЫ по порогам и классам.
//   when      — условие класса по ЧИСЛУ СЛОВ (не по символам);
//   threshold — FAIL при ratio > threshold;
//   warnFrom  — WARN при ratio > warnFrom (иначе ok);
//   unit      — единица измерения ratio (RATIO_UNIT, см. выше).
const RATIO_TABLE = [
  { type: 'sentences', when: 'все 4 опции ≥ 4 слов', threshold: 1.3, warnFrom: 1.25, unit: RATIO_UNIT },
  { type: 'token', when: 'все 4 опции ≤ 3 слов', threshold: 2.0, warnFrom: 1.35, unit: RATIO_UNIT },
  { type: 'mixed', when: 'иначе', threshold: 1.5, warnFrom: 1.35, unit: RATIO_UNIT },
];

// Производный вид таблицы для кода: RULES[type] = { threshold, warnFrom }.
// Числа здесь не дублируются — они берутся из RATIO_TABLE.
const RULES = Object.fromEntries(
  RATIO_TABLE.map((r) => [r.type, { threshold: r.threshold, warnFrom: r.warnFrom }])
);

// Человекочитаемое описание класса (строка таблицы) — для логов и документации.
function describeRule(type) {
  const rule = RATIO_TABLE.find((r) => r.type === type);
  if (!rule) return `${type}: неизвестный класс (нет в RATIO_TABLE)`;
  return `${rule.type} «${rule.when}»: fail > ${rule.threshold.toFixed(2)}, warn > ${rule.warnFrom.toFixed(2)} (${RATIO_UNIT})`;
}

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
// символам — 0. Поэтому единица параметризована; словесная шкала — это дефолт
// библиотеки для разовых замеров, гейт её не использует: qc.cjs и haladyna.cjs
// передают RATIO_UNIT.
function lengthOf(option, unit) {
  return unit === RATIO_UNIT ? textOf(option).length : wordCount(textOf(option));
}

// sentences: все опции ≥ 4 слов; token: все ≤ 3 слов; иначе mixed.
// Условия заданы таблицей RATIO_TABLE (колонка `when`) — порядок проверок здесь
// совпадает с порядком строк таблицы.
function classifyOptions(options) {
  const counts = (options || []).map((o) => wordCount(textOf(o)));
  if (counts.length === 0) return 'mixed';
  if (counts.every((c) => c >= 4)) return 'sentences';
  if (counts.every((c) => c <= 3)) return 'token';
  return 'mixed';
}

// max(len) / min(len). Пустая опция даёт Infinity — это сигнал, не 0.
// Дефолт 'words' — словесная шкала для разовых замеров; сам гейт всегда
// передаёт RATIO_UNIT ('chars').
function computeRatio(options, unit = 'words') {
  const counts = (options || []).map((o) => lengthOf(o, unit));
  if (counts.length === 0) return 0;
  const min = Math.min(...counts);
  const max = Math.max(...counts);
  if (min <= 0) return Infinity;
  return max / min;
}

// Вердикт по строке RATIO_TABLE: fail при ratio > threshold, иначе warn при
// ratio > warnFrom, иначе ok.
function checkRatio(options, unit = 'words') {
  const type = classifyOptions(options);
  const ratio = computeRatio(options, unit);
  const rule = RULES[type];
  const row = RATIO_TABLE.find((r) => r.type === type);
  let verdict = 'ok';
  if (ratio > rule.threshold) verdict = 'fail';
  else if (ratio > rule.warnFrom) verdict = 'warn';
  return {
    type,
    ratio,
    verdict,
    threshold: rule.threshold,
    warnFrom: rule.warnFrom,
    // unit — единица, которой реально измерено (аргумент вызова, у гейта RATIO_UNIT);
    // ruleUnit — единица, объявленная для класса в RATIO_TABLE.
    unit,
    ruleUnit: row ? row.unit : unit,
  };
}

module.exports = {
  RATIO_UNIT,
  RATIO_UNIT_LABEL,
  RATIO_TABLE,
  RULES,
  describeRule,
  textOf,
  wordCount,
  lengthOf,
  classifyOptions,
  computeRatio,
  checkRatio,
};
