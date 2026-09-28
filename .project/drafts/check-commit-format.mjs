#!/usr/bin/env node
/**
 * Проверка, что `commit_format`/`commit_regex` в спеке согласованы с ПАРСЕРОМ
 * tools/gen-state.mjs (:103-104, :127-128), а не просто «выглядят похоже».
 * README требует, чтобы subject будущего коммита матчил ОБЕ регулярки парсера —
 * иначе goal.added_today / avg_daily_7d молча обнуляются.
 *
 * Usage: node .project/drafts/check-commit-format.mjs <spec.md>
 */
import fs from 'node:fs';

const file = process.argv[2];
if (!file) {
  console.error('usage: node .project/drafts/check-commit-format.mjs <spec.md>');
  process.exit(2);
}
const text = fs.readFileSync(file, 'utf8');
const fm = text.split(/^---$/m)[1] ?? '';
const grab = (key) => {
  const m = new RegExp(`^${key}:\\s*"(.*)"\\s*$`, 'm').exec(fm);
  return m ? m[1] : null;
};
const format = grab('commit_format');
const declaredRegexRaw = grab('commit_regex');
/**
 * В YAML double-quoted скаляре `\\` — escape-последовательность, дающая ОДИН
 * обратный слэш. Поэтому `"^feat\\(bank\\)"` читается как `^feat\(bank\)`.
 * Первая версия этого чекера сравнивала сырой текст и давала ложный FAIL —
 * эталон в README и в спеках 004/005/006 записан именно с двойными слэшами.
 */
const unescapeYaml = (s) => (s === null ? null : s.replace(/\\\\/g, '\\'));
const declaredRegex = unescapeYaml(declaredRegexRaw);

// Точные копии регулярок парсера.
const R1 = /^feat\(bank\)/i;
const R2 = /(\d+)\s+questions?/i;

console.log(`spec           : ${file}`);
console.log(`commit_format  : ${format}`);
console.log(`commit_regex   : ${declaredRegexRaw}  (как записано)`);
console.log(`                 ${declaredRegex}  (после YAML-разэкранирования)`);

let ok = true;
if (!format) { console.log('FAIL: нет commit_format'); ok = false; }
if (!declaredRegexRaw) { console.log('FAIL: нет commit_regex'); ok = false; }
if (format) {
  const m1 = R1.test(format);
  const m2 = format.match(R2);
  console.log(`  /^feat\\(bank\\)/i            -> ${m1}`);
  console.log(`  /(\\d+)\\s+questions?/i       -> ${m2 ? `"${m2[0]}" = ${m2[1]}` : 'НЕТ СОВПАДЕНИЯ'}`);
  if (!m1 || !m2) ok = false;
  const expectedRaw = '^feat\\\\(bank\\\\), (\\\\d+)\\\\s+questions?';
  const matchesRepoConvention = declaredRegexRaw === expectedRaw;
  console.log(`  запись совпадает с README / spec 004,005,006 -> ${matchesRepoConvention}`);
  console.log(
    '  (информационно, не критерий: README описывает commit_regex как ПАРУ регулярок ' +
      'парсера, объединённых через запятую, а не как одну регулярку. Если commit_format ' +
      'записан шаблоном с подстановками — как в spec 004 (<N>, <A>, <B>) — он по ' +
      'построению не матчит выборку числа вопросов; это нормально для шаблона.)',
  );
  if (!matchesRepoConvention) ok = false;
}
console.log(ok ? '\nOK: subject из commit_format матчит обе регулярки парсера' : '\nFAIL');
process.exitCode = ok ? 0 : 1;
