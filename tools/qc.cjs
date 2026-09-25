const fs = require('fs');
const path = require('path');
const { checkRatio, RULES } = require('./_lib/ratio.cjs');

const BANK_DIR = path.join(__dirname, '..', 'src/data/questions');
const TOPICS = path.join(__dirname, '..', 'src/data/topics.ts');

// Единица измерения option ratio. Банк 106 выверялся по СИМВОЛАМ (исторически,
// см. tools/qc.cjs — o.text.length). Аудит 2026-09-25: по словам 10 вопросов
// дают FAIL (в т.ч. fm_003, который должен остаться Warn), по символам — 0.
// Поэтому здесь 'chars'; словесная шкала доступна как checkRatio(opts) в
// tools/_lib/ratio.cjs и как --batch в tools/haladyna.cjs.
const RATIO_UNIT = 'chars';

// Cosine-буфер 0.75–0.80 (мягкий near-duplicate warn) СОЗНАТЕЛЬНО не здесь:
// он требует прогона трансформера (5565 пар, ~1–2 мин) и превратил бы
// субсекундный гейт в медленный. Решение 2026-09-25: отложено в отдельный
// инструмент/сессию (tools/cosine-warn.cjs) либо явный прогон
// `node tools/cosine.cjs --self-check`. qc.cjs остаётся model-free и быстрым.

// The bank used to be a single questions.json. It is now split into one file per
// topic (src/data/questions/<topic>.json) plus two manifests that hold no questions
// (_order.json = quiz order, _topics.json = counters). The bank is assembled here in
// a deterministic order: file names sorted, question order inside a file kept as is.
const BANK_FILES = fs
  .readdirSync(BANK_DIR)
  .filter((f) => f.endsWith('.json') && f !== '_order.json' && f !== '_topics.json')
  .sort();

const questions = BANK_FILES.flatMap((f) =>
  JSON.parse(fs.readFileSync(path.join(BANK_DIR, f), 'utf8'))
);
const topicsRaw = fs.readFileSync(TOPICS, 'utf8');
const validTopics = new Set(
  [...topicsRaw.matchAll(/key:\s*['"]([a-zA-Z0-9_-]+)['"]/g)].map(m => m[1])
);

let fails = 0;
let warns = 0;
const MAX_WARNS_PRINT = 30;
const failByCat = {};
const warnByCat = {};

function fail(id, msg, cat = 'other') {
  fails++;
  failByCat[cat] = (failByCat[cat] || 0) + 1;
  console.log(`FAIL ${id}: ${msg}`);
}
function warn(id, msg, cat = 'other') {
  if (warns < MAX_WARNS_PRINT) console.log(`WARN ${id}: ${msg}`);
  warns++;
  warnByCat[cat] = (warnByCat[cat] || 0) + 1;
}

// Токенизация: split по whitespace, strip ТОЛЬКО крайних знаков.
// Командные символы (> >> | & 2>&1 - + = : % $ /) сохраняются.
// Регистр значим (-R vs -r).
function tokenize(text) {
  if (typeof text !== 'string') return [];
  return text
    .split(/\s+/)
    .map(t => t.replace(/^[,.;:!?()\[\]{}"']+|[,.;:!?()\[\]{}"']+$/g, ''))
    .filter(Boolean);
}

// Bigram Jaccard — учитывает ПОРЯДОК токенов.
function bigrams(tokens) {
  if (tokens.length < 2) return tokens.map(t => `[${t}]`);
  const grams = [];
  for (let i = 0; i < tokens.length - 1; i++) {
    grams.push(`${tokens[i]} ${tokens[i + 1]}`);
  }
  return grams;
}

function jaccard(a, b) {
  const A = new Set(a), B = new Set(b);
  if (A.size === 0 && B.size === 0) return 1;
  if (A.size === 0 || B.size === 0) return 0;
  const inter = [...A].filter(x => B.has(x)).length;
  const union = new Set([...A, ...B]).size;
  return inter / union;
}

const ID_RE = /^[a-z]{2,4}_\d{3}$/;

const ids = new Set();

for (const q of questions) {
  if (!q.id || typeof q.id !== 'string') { fail('?', 'missing or invalid id', 'id'); continue; }
  if (ids.has(q.id)) fail(q.id, 'duplicate id', 'id');
  ids.add(q.id);
  if (!ID_RE.test(q.id)) fail(q.id, `id does not match ${ID_RE}`, 'id');

  if (!q.question || typeof q.question !== 'string' || !q.question.trim()) {
    fail(q.id, 'empty question', 'stem');
  } else if (q.question.trim().length < 10) {
    fail(q.id, `question shorter than 10 chars (${q.question.trim().length})`, 'stem');
  }
  if (!q.explanation || typeof q.explanation !== 'string' || !q.explanation.trim()) {
    fail(q.id, 'empty explanation', 'explanation');
  } else if (q.explanation.trim().length < 30) {
    fail(q.id, `explanation shorter than 30 chars (${q.explanation.trim().length})`, 'explanation');
  }
  if (!q.topic) fail(q.id, 'missing topic', 'topic');
  else if (!validTopics.has(q.topic)) fail(q.id, `unknown topic: ${q.topic}`, 'topic');
  if (!q.objective_domain || !/^[1-9]$/.test(q.objective_domain)) {
    fail(q.id, `invalid objective_domain: ${q.objective_domain}`, 'domain');
  }

  if (!Array.isArray(q.options) || q.options.length !== 4) {
    fail(q.id, `options length ${q.options?.length}, expected 4`, 'schema');
    continue;
  }
  let shapeOk = true;
  for (const o of q.options) {
    if (!o || typeof o.text !== 'string' || typeof o.correct !== 'boolean') {
      fail(q.id, `invalid option shape: ${JSON.stringify(o).slice(0, 80)}`, 'schema');
      shapeOk = false;
    }
    if (typeof o.text === 'string' && !o.text.trim()) fail(q.id, 'empty option text', 'schema');
  }
  if (!shapeOk) continue;

  const correct = q.options.filter(o => o.correct === true).length;
  if (correct !== 1) fail(q.id, `correct count ${correct}, expected 1`, 'schema');

  const grams = q.options.map(o => bigrams(tokenize(o.text)));
  for (let i = 0; i < grams.length; i++) {
    for (let j = i + 1; j < grams.length; j++) {
      const jac = jaccard(grams[i], grams[j]);
      if (jac > 0.9) fail(q.id, `options ${i}/${j} bigram jaccard ${jac.toFixed(2)} > 0.9`, 'jaccard');
    }
  }

  const placeholder = /<[^>]+>|\[[^\]]+\]|\{[^}]+\}/;
  for (const o of q.options) {
    if (placeholder.test(o.text)) fail(q.id, `placeholder in option: ${o.text.slice(0, 50)}`, 'placeholder');
  }
  if (placeholder.test(q.question)) fail(q.id, 'placeholder in question', 'placeholder');

  // --- option ratio ---------------------------------------------------------
  // Историческая проверка по символам (грубый порог 2.5) — сохранена.
  const lens = q.options.map(o => o.text.length);
  const minLen = Math.min(...lens);
  if (minLen >= 20) {
    const ratio = Math.max(...lens) / minLen;
    if (ratio > 2.5) warn(q.id, `option length ratio ${ratio.toFixed(2)} > 2.5`, 'ratio-char');
  }
  // Новая проверка через общую библиотеку (тип + порог 1.30/2.0/1.5).
  const r = checkRatio(q.options, RATIO_UNIT);
  if (r.verdict === 'fail') {
    fail(q.id, `option ratio (${r.type}) ${r.ratio.toFixed(2)} > ${r.threshold}`, 'ratio');
  } else if (r.verdict === 'warn') {
    warn(q.id, `option ratio (${r.type}) ${r.ratio.toFixed(2)} > warn ${RULES[r.type].warnFrom}`, 'ratio');
  }

  // --- подсказка по длине правильного ответа --------------------------------
  const correctOpts = q.options.filter(o => o.correct === true);
  const distractorOpts = q.options.filter(o => o.correct !== true);
  if (correctOpts.length === 1 && distractorOpts.length > 0) {
    const avg = distractorOpts.reduce((s, o) => s + o.text.length, 0) / distractorOpts.length;
    if (avg > 0 && correctOpts[0].text.length > avg * 1.3) {
      warn(q.id, `correct option > avg distractor by >30% (${correctOpts[0].text.length} vs ${avg.toFixed(1)})`, 'length-hint');
    }
  }

  // --- стоп-слова и типографика --------------------------------------------
  const stopwordCheck = (label, text) => {
    if (typeof text !== 'string') return;
    if (/в течении/iu.test(text)) warn(q.id, `stopword "в течении" in ${label}`, 'stopword');
    const zag = text.match(/загрузк[а-яё]+/iu);
    if (zag) warn(q.id, `stopword "${zag[0]}" in ${label}`, 'stopword');
    if (/ {2,}/.test(text)) warn(q.id, `double space in ${label}`, 'stopword');
    // Пробел перед знаком препинания. Точка НЕ считается нарушением, если за ней
    // идёт имя расширения/глоба (`.conf`, `.txt`), — иначе «файлы .conf» ложно падало.
    if (/\s+[,;:!?]/.test(text) || /\s+\.(?![A-Za-zА-Яа-яЁё0-9])/.test(text)) {
      warn(q.id, `space before punctuation in ${label}`, 'stopword');
    }
  };
  stopwordCheck('stem', q.question);
  q.options.forEach((o, i) => stopwordCheck(`option ${i}`, o.text));
  stopwordCheck('explanation', q.explanation);

  // Latin: \b работает.
  // Cyrillic: \b не работает — используем lookaround с учётом ё.
  // Negation guard: «не всегда» ≠ «всегда».
  const absEn = /\b(all|none|except|never|always)\b/i.test(q.question);
  const absRu = /(?<![а-яё])(все|всё|ни один|кроме|всегда|никогда)(?![а-яё])/iu.test(q.question)
    && !/не\s+(все|всё|всегда|никогда)/iu.test(q.question);
  if (absEn || absRu) {
    warn(q.id, 'absolute term in question stem', 'absolute');
  }
}

console.log(`\n---\nTotal: ${questions.length} questions`);
console.log(`Fails: ${fails}, Warns: ${warns}`);
const fmtCats = (obj) => Object.keys(obj).sort().map(k => `${k}=${obj[k]}`).join(' ');
if (fails > 0) console.log(`FAIL by category: ${fmtCats(failByCat)}`);
if (warns > 0) console.log(`WARN by category: ${fmtCats(warnByCat)}`);
if (warns > MAX_WARNS_PRINT) console.log(`(показаны первые ${MAX_WARNS_PRINT} warns)`);
process.exitCode = fails > 0 ? 1 : 0;
