const fs = require('fs');
const path = require('path');

const BANK = path.join(__dirname, '..', 'src/data/questions.json');
const TOPICS = path.join(__dirname, '..', 'src/data/topics.ts');

const questions = JSON.parse(fs.readFileSync(BANK, 'utf8'));
const topicsRaw = fs.readFileSync(TOPICS, 'utf8');
const validTopics = new Set(
  [...topicsRaw.matchAll(/key:\s*['"]([a-zA-Z0-9_-]+)['"]/g)].map(m => m[1])
);

let fails = 0;
let warns = 0;
const MAX_WARNS_PRINT = 30;

function fail(id, msg) { fails++; console.log(`FAIL ${id}: ${msg}`); }
function warn(id, msg) { if (warns < MAX_WARNS_PRINT) console.log(`WARN ${id}: ${msg}`); warns++; }

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

const ids = new Set();

for (const q of questions) {
  if (!q.id || typeof q.id !== 'string') { fail('?', 'missing or invalid id'); continue; }
  if (ids.has(q.id)) fail(q.id, 'duplicate id');
  ids.add(q.id);

  if (!q.question || typeof q.question !== 'string' || !q.question.trim()) {
    fail(q.id, 'empty question');
  }
  if (!q.explanation || typeof q.explanation !== 'string' || !q.explanation.trim()) {
    fail(q.id, 'empty explanation');
  }
  if (!q.topic) fail(q.id, 'missing topic');
  else if (!validTopics.has(q.topic)) fail(q.id, `unknown topic: ${q.topic}`);
  if (!q.objective_domain || !/^[1-9]$/.test(q.objective_domain)) {
    fail(q.id, `invalid objective_domain: ${q.objective_domain}`);
  }

  if (!Array.isArray(q.options) || q.options.length !== 4) {
    fail(q.id, `options length ${q.options?.length}, expected 4`);
    continue;
  }
  let shapeOk = true;
  for (const o of q.options) {
    if (!o || typeof o.text !== 'string' || typeof o.correct !== 'boolean') {
      fail(q.id, `invalid option shape: ${JSON.stringify(o).slice(0, 80)}`);
      shapeOk = false;
    }
    if (typeof o.text === 'string' && !o.text.trim()) fail(q.id, 'empty option text');
  }
  if (!shapeOk) continue;

  const correct = q.options.filter(o => o.correct === true).length;
  if (correct !== 1) fail(q.id, `correct count ${correct}, expected 1`);

  const grams = q.options.map(o => bigrams(tokenize(o.text)));
  for (let i = 0; i < grams.length; i++) {
    for (let j = i + 1; j < grams.length; j++) {
      const jac = jaccard(grams[i], grams[j]);
      if (jac > 0.9) fail(q.id, `options ${i}/${j} bigram jaccard ${jac.toFixed(2)} > 0.9`);
    }
  }

  const placeholder = /<[^>]+>|\[[^\]]+\]|\{[^}]+\}/;
  for (const o of q.options) {
    if (placeholder.test(o.text)) fail(q.id, `placeholder in option: ${o.text.slice(0, 50)}`);
  }
  if (placeholder.test(q.question)) fail(q.id, 'placeholder in question');

  const lens = q.options.map(o => o.text.length);
  const minLen = Math.min(...lens);
  if (minLen >= 20) {
    const ratio = Math.max(...lens) / minLen;
    if (ratio > 2.5) warn(q.id, `option length ratio ${ratio.toFixed(2)} > 2.5`);
  }

  // Latin: \b работает.
  // Cyrillic: \b не работает — используем lookaround с учётом ё.
  // Negation guard: «не всегда» ≠ «всегда».
  const absEn = /\b(all|none|except|never|always)\b/i.test(q.question);
  const absRu = /(?<![а-яё])(все|всё|ни один|кроме|всегда|никогда)(?![а-яё])/iu.test(q.question)
    && !/не\s+(все|всё|всегда|никогда)/iu.test(q.question);
  if (absEn || absRu) {
    warn(q.id, 'absolute term in question stem');
  }
}

console.log(`\n---\nTotal: ${questions.length} questions`);
console.log(`Fails: ${fails}, Warns: ${warns}`);
if (warns > MAX_WARNS_PRINT) console.log(`(показаны первые ${MAX_WARNS_PRINT} warns)`);
process.exitCode = fails > 0 ? 1 : 0;