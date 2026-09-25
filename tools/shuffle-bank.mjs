import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Deterministic option shuffler for the question bank.
//
// Why: the authored bank stored `correct: true` on index 0 in all 122 questions
// (legacy generation prompts demanded key=[1]). The UI compensates at render time
// (`shuffleOptions(options, seedFromId(id))` in Question.tsx), but every consumer
// that reads the JSON directly - MAS voters, pending drafts, audits - still saw the
// bias. This tool normalizes the stored order so the bank itself is unbiased.
//
// Usage:
//   node tools/shuffle-bank.mjs --check            # report distribution, read-only
//   node tools/shuffle-bank.mjs --apply            # rewrite all 12 topic files
//   node tools/shuffle-bank.mjs --apply <topic>    # rewrite one topic file
//
// Algorithm: per topic, the tool first searches a salt in 0..99 and keeps the
// first one whose shuffles hold the topic's correct-answer positions at or
// below BALANCE_SHARE (40%), falling back to FALLBACK_SHARE (50%), then to 0.
// Every question is then ordered by
// fisherYates(canonicalBase(options), cyrb53(id [NUL salt])) with mulberry32.
// Salt 0 keeps the original pre-2026-09-28 seed, so an already-balanced topic is
// not rewritten for nothing. The salt is internal and is never written to JSON.
//
// Why per topic: a single global seed is deterministic but does not constrain
// the per-topic distribution - on an 8-question topic a fluctuation can put
// 62.5% of keys on one position, which `--check` reports per topic even though
// the bank-level spread (about 25% each) looks healthy.
//
// No Math.random anywhere.
//
// Idempotency: Fisher-Yates applied to the *current* array would not be idempotent -
// P(arr) != P(P(arr)) in general, so a second --apply would keep rewriting files.
// Sorting into a canonical order first, derived only from the option's own text
// (cyrb53(id + NUL + text)), makes the result a pure function of the content:
// a second --apply recomputes the same canonical base and the same permutation,
// so the file bytes are unchanged. `correct` always travels with its own option
// object; question/subtopic/explanation/_meta are never touched.
//
// cyrb53 is used here instead of quizService.seedFromId on purpose: the bank order
// must not depend on a UI-internal seed, so this tool stays independent of the
// presentation layer. cyrb53: https://github.com/bryc/code/blob/master/jshash/PRNGs.md#cyrb53

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BANK_DIR = path.join(root, 'src', 'data', 'questions');
const WARN_SHARE = 0.6;
/** Preferred per-topic ceiling for one correct-answer position. */
const BALANCE_SHARE = 0.4;
/** Accepted per-topic ceiling when no salt reaches the preferred share. */
const FALLBACK_SHARE = 0.5;
/** Salt search space per topic (0 keeps the legacy seed). */
const SALT_SEARCH_LIMIT = 100;

/**
 * cyrb53 (Bryc, public domain). Standard 32-bit accumulator loop and avalanche;
 * the two halves are folded into a uint32 because mulberry32 needs a 32-bit seed.
 */
export function cyrb53(str, seed = 0) {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h1 ^ h2) >>> 0;
}

/** mulberry32 PRNG; returns a function producing floats in [0, 1). */
export function mulberry32(seed) {
  let s = seed >>> 0;
  return function next() {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher-Yates on a copy; `seed` drives mulberry32. Never mutates the input. */
export function fisherYates(arr, seed) {
  const out = [...arr];
  const rng = mulberry32(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Content-derived canonical base order: independent of the array's current order. */
function canonicalBase(options, id) {
  return options
    .map((option) => ({ option, key: cyrb53(id + '\u0000' + option.text) }))
    .sort((a, b) => (a.key - b.key) || (a.option.text < b.option.text ? -1 : 1))
    .map((entry) => entry.option);
}

/** Seed for one question at one salt; salt 0 keeps the legacy (unsalted) seed. */
function saltSeed(id, salt) {
  return salt === 0 ? cyrb53(id) : cyrb53(id + '\u0000' + String(salt));
}

/** Target stored order for one question under one salt. Pure in content + salt. */
function targetOrder(question, salt) {
  return fisherYates(canonicalBase(question.options, question.id), saltSeed(question.id, salt));
}

/** Correct-answer position this question would get under one salt. */
function saltedCorrectPos(question, salt) {
  return targetOrder(question, salt).findIndex((option) => option.correct === true);
}

/**
 * First salt whose per-topic distribution is balanced. The search is a pure
 * function of the topic's content, so the same input always picks the same salt
 * and a second --apply rewrites nothing.
 */
function pickSalt(questions) {
  let fallback = -1;
  for (let salt = 0; salt < SALT_SEARCH_LIMIT; salt++) {
    const counts = [0, 0, 0, 0];
    for (const q of questions) {
      const pos = saltedCorrectPos(q, salt);
      if (pos < 0 || pos >= 4) throw new Error(`${q.id}: expected exactly one correct option at index 0..3`);
      counts[pos]++;
    }
    const total = questions.length === 0 ? 1 : questions.length;
    const share = Math.max(...counts) / total;
    if (share <= BALANCE_SHARE) return salt;
    if (fallback === -1 && share <= FALLBACK_SHARE) fallback = salt;
  }
  return fallback === -1 ? 0 : fallback;
}

function topicFiles() {
  return fs
    .readdirSync(BANK_DIR)
    .filter((f) => f.endsWith('.json') && !f.startsWith('_'))
    .sort()
    .map((f) => f.replace(/\.json$/, ''));
}

function readBank(topic) {
  return JSON.parse(fs.readFileSync(path.join(BANK_DIR, topic + '.json'), 'utf8'));
}

/** Visual position of the single `correct: true` option, or -1 when malformed. */
function correctPos(question) {
  const idx = question.options.findIndex((o) => o.correct === true);
  return idx;
}

function distribution(topics) {
  const rows = [];
  const bank = [0, 0, 0, 0];
  for (const topic of topics) {
    const questions = readBank(topic);
    const counts = [0, 0, 0, 0];
    for (const q of questions) {
      const pos = correctPos(q);
      if (pos >= 0 && pos < 4) counts[pos]++;
      else throw new Error(`${q.id}: expected exactly one correct option at index 0..3`);
    }
    rows.push({ topic, total: questions.length, counts });
    for (let i = 0; i < 4; i++) bank[i] += counts[i];
  }
  return { rows, bank };
}

function pad(value, width) {
  return String(value).padEnd(width);
}

function report(topics) {
  const { rows, bank } = distribution(topics);
  const total = bank.reduce((a, b) => a + b, 0);
  console.log('| topic | total | pos0 | pos1 | pos2 | pos3 |');
  console.log('|---|---|---|---|---|---|');
  for (const row of rows) {
    console.log(
      `| ${pad(row.topic, 22)} | ${pad(row.total, 5)} | ${pad(row.counts[0], 4)} | ${pad(row.counts[1], 4)} | ${pad(row.counts[2], 4)} | ${pad(row.counts[3], 4)} |`
    );
  }
  console.log(
    `| ${pad('BANK', 22)} | ${pad(total, 5)} | ${pad(bank[0], 4)} | ${pad(bank[1], 4)} | ${pad(bank[2], 4)} | ${pad(bank[3], 4)} |`
  );

  const warnings = [];
  bank.forEach((count, pos) => {
    const share = total === 0 ? 0 : count / total;
    if (share > WARN_SHARE) {
      warnings.push(`BANK: pos${pos} holds ${count}/${total} (${(share * 100).toFixed(1)}%) > ${WARN_SHARE * 100}%`);
    }
  });
  for (const row of rows) {
    const rowTotal = row.total || 1;
    row.counts.forEach((count, pos) => {
      if (count / rowTotal > WARN_SHARE) {
        warnings.push(`${row.topic}: pos${pos} holds ${count}/${row.total} (${((count / rowTotal) * 100).toFixed(1)}%) > ${WARN_SHARE * 100}%`);
      }
    });
  }
  for (const warning of warnings) console.log('WARN ' + warning);
  return { rows, bank, total, warnings };
}

function sameOptions(a, b) {
  if (a.length !== b.length) return false;
  return a.every((option, i) => option.text === b[i].text && option.correct === b[i].correct);
}

function apply(topics) {
  let changedFiles = 0;
  let changedQuestions = 0;
  for (const topic of topics) {
    const file = path.join(BANK_DIR, topic + '.json');
    const questions = readBank(topic);
    const salt = pickSalt(questions);
    let changed = 0;
    for (const q of questions) {
      const target = targetOrder(q, salt);
      if (!sameOptions(q.options, target)) {
        q.options = target; // key order of each option object is preserved: same refs
        changed++;
      }
    }
    if (changed === 0) {
      console.log(`unchanged ${topic} (salt ${salt})`);
      continue;
    }
    const out = JSON.stringify(questions, null, 2) + '\n';
    fs.writeFileSync(file, out, 'utf8');
    const bytes = fs.readFileSync(file);
    if (bytes[0] === 0xef) throw new Error(`${topic}: BOM detected after write`);
    if (bytes.includes(13)) throw new Error(`${topic}: CR byte detected after write (expected LF)`);
    changedFiles++;
    changedQuestions += changed;
    console.log(`shuffled ${topic}: ${changed} questions (salt ${salt})`);
  }
  console.log(`--- files changed: ${changedFiles}, questions changed: ${changedQuestions}`);
}

const args = process.argv.slice(2);
const mode = args.includes('--apply') ? 'apply' : args.includes('--check') ? 'check' : null;
const positional = args.filter((a) => !a.startsWith('--'));

if (mode === null) {
  console.error('usage: node tools/shuffle-bank.mjs --check | --apply [topic]');
  process.exit(2);
}

const all = topicFiles();
const topics = positional.length > 0 ? positional : all;
for (const topic of topics) {
  if (!all.includes(topic)) {
    console.error(`unknown topic: ${topic}`);
    process.exit(2);
  }
}

if (mode === 'check') {
  const { warnings } = report(topics);
  process.exit(warnings.length > 0 ? 1 : 0);
}
apply(topics);
