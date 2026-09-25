'use strict';

// Автоматический скоринг MCQ по 10 критериям Haladyna (docs/HALADYNA.md).
// 5 AUTO (детерминированные) + 3 SEMI (полуавтомат, помечаются) + 2 MANUAL (человек).
//
// CLI:
//   node tools/haladyna.cjs <id>              — один вопрос из банка
//   node tools/haladyna.cjs all               — весь банк
//   node tools/haladyna.cjs --batch file.json — массив вопросов (схема банка)
//   --auto-only                               — exit только по AUTO (SEMI печатается, но не влияет)
//
// Exit code: 0 если у ВСЕХ обработанных вопросов auto=5/5 (и semi=3/3, если не указан
// --auto-only), иначе 1.

const fs = require('fs');
const path = require('path');
const { checkRatio } = require('./_lib/ratio.cjs');

const ROOT = path.join(__dirname, '..');
const BANK_DIR = path.join(ROOT, 'src/data/questions');

// Единица измерения для ratio: банк 106 выверялся по символам (см. qc.cjs).
// Аудит 2026-09-25: по словам 10 вопросов дают FAIL, по символам — 0.
const RATIO_UNIT = 'chars';

const MANUAL = [9, 10];

function loadBank() {
  const files = fs
    .readdirSync(BANK_DIR)
    .filter((f) => f.endsWith('.json') && f !== '_order.json' && f !== '_topics.json')
    .sort();
  return files.flatMap((f) => JSON.parse(fs.readFileSync(path.join(BANK_DIR, f), 'utf8')));
}

function textOf(o) {
  return o && typeof o.text === 'string' ? o.text : '';
}

function isCommandToken(o) {
  return /^[a-z][a-z0-9_-]*\s/.test(textOf(o).trim());
}

function isNumeric(o) {
  return /^\d+$/.test(textOf(o).trim());
}

function startsLike(text, prefixes) {
  return prefixes.some((p) => text.startsWith(p));
}

// --- AUTO -------------------------------------------------------------------

function auto1OneCorrect(q) {
  const n = (q.options || []).filter((o) => o && o.correct === true).length;
  return n === 1;
}

function auto2Balanced(q) {
  return checkRatio(q.options, RATIO_UNIT).verdict !== 'fail';
}

function auto3StemIsQuestion(q) {
  const stem = String(q.question || '').trim();
  if (stem.includes('?')) return true;
  return startsLike(stem, ['Какая', 'Какой', 'Какое', 'Что', 'Как', 'Нужно', 'Требуется', 'Дано', 'Скрипту']);
}

function auto5NoLengthHint(q) {
  const opts = q.options || [];
  const correct = opts.filter((o) => o && o.correct === true);
  const distractors = opts.filter((o) => o && o.correct !== true);
  if (correct.length !== 1 || distractors.length === 0) return false;
  const avg = distractors.reduce((s, o) => s + textOf(o).length, 0) / distractors.length;
  if (avg <= 0) return true;
  return textOf(correct[0]).length <= avg * 1.4;
}

function auto6Explanation(q) {
  const ex = String(q.explanation || '').trim();
  return ex.length >= 30;
}

// --- SEMI -------------------------------------------------------------------

// Критерий 4 — только STEM. «все ресурсы»/«оба режима» в опциях-дистракторах
// легальны; absolute terms опасны именно в стеме. Перенесён из AUTO 2026-09-25:
// absolute term в стеме — сигнал человеку, а не автоматический блокер.
function semi4NoAllBoth(q) {
  const re = /(?<![а-яё])(все|оба|ни одно|ни один)(?![а-яё])/iu;
  return !re.test(String(q.question || ''));
}

function semi7SameCategory(q) {
  const opts = q.options || [];
  if (opts.length === 0) return false;
  if (opts.every(isCommandToken)) return true;
  if (opts.every(isNumeric)) return true;
  if (opts.every((o) => startsLike(textOf(o).trim(), ['Зона', 'В', 'Поле']))) return true;
  return false;
}

const COMMANDS = [
  'find', 'chmod', 'chown', 'chgrp', 'systemctl', 'journalctl', 'cut', 'grep', 'awk', 'sed',
  'tar', 'ls', 'cp', 'mv', 'rm', 'ss', 'firewall-cmd', 'useradd', 'usermod', 'chage', 'setfacl',
  'getfacl', 'renice', 'umask', 'mount', 'df', 'du', 'sort', 'uniq', 'head', 'tail', 'wc', 'tr',
  'tee', 'xargs', 'nice', 'kill', 'ps', 'ip', 'nmcli', 'dnf', 'rpm', 'passwd', 'ln', 'touch',
  'mkdir', 'rmdir', 'crontab', 'sudo', 'su', 'lsof', 'netstat', 'ping', 'curl', 'wget', 'date',
  'stat', 'file', 'which', 'alias', 'export', 'source', 'read', 'cd', 'pwd', 'ulimit', 'trap',
  'wait', 'jobs', 'bash', 'sh', 'sshd', 'fdisk', 'mkfs', 'lvm',
];

function semi8StemHasContext(q) {
  const stem = String(q.question || '');
  if (stem.includes('/')) return true;
  if (/\.(conf|txt|json)/i.test(stem)) return true;
  const words = stem.toLowerCase().split(/[^a-z0-9_-]+/);
  return words.some((w) => COMMANDS.includes(w));
}

// ---------------------------------------------------------------------------

function scoreQuestion(q) {
  const autoFails = [];
  const semiFails = [];

  if (!auto1OneCorrect(q)) autoFails.push(1);
  if (!auto2Balanced(q)) autoFails.push(2);
  if (!auto3StemIsQuestion(q)) autoFails.push(3);
  if (!auto5NoLengthHint(q)) autoFails.push(5);
  if (!auto6Explanation(q)) autoFails.push(6);

  if (!semi4NoAllBoth(q)) semiFails.push(4);
  if (!semi7SameCategory(q)) semiFails.push(7);
  if (!semi8StemHasContext(q)) semiFails.push(8);

  const autoPassed = 5 - autoFails.length;
  const semiPassed = 3 - semiFails.length;
  const perfect = autoFails.length === 0 && semiFails.length === 0;

  return { autoPassed, semiPassed, autoFails, semiFails, perfect };
}

function printQuestion(q) {
  const r = scoreQuestion(q);
  const score = r.autoPassed + r.semiPassed;
  console.log(`${q.id}: score=${score}/10 (auto=${r.autoPassed}/5, semi=${r.semiPassed}/3)`);
  console.log(`AUTO_FAIL: ${r.autoFails.length ? '[' + r.autoFails.join(', ') + ']' : 'нет'}`);
  console.log(`SEMI_FAIL: ${r.semiFails.length ? '[' + r.semiFails.join(', ') + ']' : 'нет'}`);
  console.log(`MANUAL: [${MANUAL.join(', ')}]`);
  return r;
}

function main() {
  const rawArgv = process.argv.slice(2);
  const autoOnly = rawArgv.includes('--auto-only');
  const argv = rawArgv.filter((a) => a !== '--auto-only');
  if (argv.length === 0) {
    console.error('usage: node tools/haladyna.cjs [--auto-only] <id|all|--batch file.json>');
    process.exitCode = 1;
    return;
  }

  let targets = [];
  if (argv[0] === '--batch') {
    const file = argv[1];
    if (!file) {
      console.error('usage: node tools/haladyna.cjs --batch file.json');
      process.exitCode = 1;
      return;
    }
    try {
      targets = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {
      console.error(`cannot read batch ${file}: ${e.message}`);
      process.exitCode = 1;
      return;
    }
    if (!Array.isArray(targets)) {
      console.error(`batch ${file} is not an array`);
      process.exitCode = 1;
      return;
    }
  } else if (argv[0] === 'all') {
    targets = loadBank();
  } else {
    const id = argv[0];
    const found = loadBank().filter((q) => q.id === id);
    if (found.length === 0) {
      console.error(`id not found in bank: ${id}`);
      process.exitCode = 1;
      return;
    }
    targets = found;
  }

  let perfect = 0;
  let autoPerfect = 0;
  for (const q of targets) {
    const r = printQuestion(q);
    if (r.perfect) perfect++;
    if (r.autoFails.length === 0) autoPerfect++;
  }

  if (targets.length > 1) {
    console.log(`\n---\nPerfect (auto 5/5 and semi 3/3): ${perfect}/${targets.length}`);
    console.log(`Auto-perfect (5/5): ${autoPerfect}/${targets.length}`);
  }
  process.exitCode = (autoOnly ? autoPerfect : perfect) === targets.length ? 0 : 1;
}

main();
