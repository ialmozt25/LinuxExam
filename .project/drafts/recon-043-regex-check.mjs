// recon-043-regex-check.mjs — ФИНАЛЬНАЯ проверка шаблона коммита для spec 043
// Runtime Node.js — тот же, что у tools/gen-state.mjs (истинный гейт метрик цели).
// Запуск: node .project/drafts/recon-043-regex-check.mjs   (только чтение)
//
// Проверяется ровно требование капитана: образец subject обязан матчить ОБА
// шаблона парсера gen-state.mjs. Дополнительно проверяется поле commit_regex,
// которое пойдёт во frontmatter спеки.

import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

// --- 1. Шаблоны гейта: вырезаем ИЗ файла парсера, не перепечатываем ---
const lines = readFileSync('tools/gen-state.mjs', 'utf8').split('\n');
const litA = lines.find((l) => l.includes('/^feat') && l.includes('.test(msg)')).match(/\/(\^feat[^/]*)\/([a-z]*)/)[0];
const litB = lines.find((l) => l.includes('questions?') && l.includes('msg.match')).match(/\/(\([^/]*questions\?)\/([a-z]*)/)[0];
const gateA = eval(litA);
const gateB = eval(litB);

// --- 2. Образец subject для frontmatter commit_format ---
const subject = 'feat(bank): M2.9 batch 6 - 12 questions on deploy_systems (229->241)';

// --- 3. Поле commit_regex для frontmatter.
// ВАЖНО: count стоит в середине subject ('M2.9 batch 6 - 12 questions'), поэтому
// шаблон не может требовать (\d+) сразу после ': ' — между ними есть префикс темы.
// Шаблон описывает пару регулярок парсера (см. .project/specs/README.md:104).
const commitRegex = new RegExp('^feat\\(bank\\): .*?(\\d+)\\s+questions?');

console.log('=== recon-043: проверка шаблона коммита (runtime Node) ===');
console.log('гейт A из tools/gen-state.mjs      : ' + litA);
console.log('гейт B из tools/gen-state.mjs      : ' + litB);
console.log('commit_regex для frontmatter спеки : ' + commitRegex.source);
console.log('');
console.log('образец subject                    : ' + subject);
console.log('');

const a = gateA.test(subject);
const mb = subject.match(gateB);
const cr = commitRegex.test(subject);
const rows = [
  { проверка: 'гейт A /^feat\\(bank\\)/i', ожидалось: true, факт: a, итог: a ? 'PASS' : 'FAIL' },
  { проверка: 'гейт B /(\\d+)\\s+questions?/i', ожидалось: true, факт: Boolean(mb) && mb[1] === '12', итог: mb && mb[1] === '12' ? 'PASS' : 'FAIL' },
  { проверка: 'commit_regex (поле спеки)', ожидалось: true, факт: cr, итог: cr ? 'PASS' : 'FAIL' },
];
console.table(rows);
console.log(`захвачено количество вопросов: ${mb ? mb[1] : '-'} (ожидалось 12)`);
console.log('');

// --- 4. Контроль: шаблон обязан различать запятую и двоеточие ---
const wrongSep = new RegExp(commitRegex.source.replace(String.fromCharCode(58), String.fromCharCode(44)));
console.log('контроль разделителя: шаблон с запятой матчит образец?',
  wrongSep.test(subject), '(ожидалось false — доказывает, что двоеточие в шаблоне значимо)');
console.log('');

const allPass = rows.every((r) => r.итог === 'PASS');
console.log(allPass
  ? 'ВЕРДИКТ: OK — образец subject матчит ОБА шаблона гейта gen-state.mjs;\n         goal.added_today += 12, avg_daily_7d учтёт 12 в 7-дневном окне.'
  : 'ВЕРДИКТ: STOP — расхождение шаблона, спеку не создавать.');
process.exit(allPass ? 0 : 1);
