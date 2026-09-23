// Offline-only: everything must come from the local model cache.
process.env.HF_HUB_OFFLINE = '1';
process.env.TRANSFORMERS_OFFLINE = '1';

const fs = require('fs');
const path = require('path');

const DEFAULT_MODEL = 'Xenova/all-MiniLM-L6-v2';
const EXPECTED_DIM = 384;
const DEFAULT_JACCARD_THRESHOLD = 0.9;

// The cosine threshold is read from tools/cosine-calibration.json so the measured
// calibration is the single source of truth instead of a code constant. 0.80 is
// the fallback when the file is missing or unreadable.
function loadCalibration() {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, 'cosine-calibration.json'), 'utf8'));
  } catch {
    return null;
  }
}

const CALIBRATION = loadCalibration();
const DEFAULT_COSINE_THRESHOLD = CALIBRATION && CALIBRATION.thresholds && typeof CALIBRATION.thresholds.cosine === 'number'
  ? CALIBRATION.thresholds.cosine
  : 0.8;

const ROOT = path.join(__dirname, '..');
const BANK = path.join(ROOT, 'src/data/questions.json');

let _enc = null;

async function getEncoder(modelId = DEFAULT_MODEL) {
  if (!_enc) {
    const { AutoTokenizer, AutoModel } = await import('@xenova/transformers');
    const tokenizer = await AutoTokenizer.from_pretrained(modelId);
    const model = await AutoModel.from_pretrained(modelId);
    _enc = { tokenizer, model, modelId };
  }
  return _enc;
}

/**
 * Mean pooling over the token axis, weighted by attention_mask:
 *   mask   = attention_mask.unsqueeze(-1).expand(last_hidden_state.size())
 *   pooled = sum(last_hidden_state * mask, axis=1) / clamp(sum(mask, axis=1), 1e-9)
 * then L2-normalised on the feature axis.
 *
 * Implemented on plain nested arrays rather than tensor ops: @xenova/transformers
 * v2 exposes `.dims` and `.data` but no `.unsqueeze/.expand/.div`, so the formula
 * above is evaluated directly. Same maths, same result.
 */
function meanPoolNormalize(lastHiddenState, attentionMask) {
  const dims = lastHiddenState.dims;
  if (!dims || dims.length !== 3) throw new Error(`last_hidden_state must be rank 3, got ${dims}`);
  const [batch, seqLen, hidden] = dims;
  if (hidden !== EXPECTED_DIM) throw new Error(`unexpected dim: ${hidden} (expected ${EXPECTED_DIM})`);
  if (!attentionMask || !attentionMask.dims || attentionMask.dims[0] !== batch) {
    throw new Error('attention_mask shape mismatch');
  }

  const h = lastHiddenState.data;
  const m = attentionMask.data;
  const out = [];

  for (let b = 0; b < batch; b++) {
    const pooled = new Array(hidden).fill(0);
    let count = 0;
    for (let s = 0; s < seqLen; s++) {
      const mask = Number(m[b * seqLen + s]) || 0;
      count += mask;
      if (mask === 0) continue;
      const base = (b * seqLen + s) * hidden;
      for (let d = 0; d < hidden; d++) pooled[d] += h[base + d] * mask;
    }
    const denom = Math.max(count, 1e-9);
    for (let d = 0; d < hidden; d++) pooled[d] /= denom;

    let norm = 0;
    for (let d = 0; d < hidden; d++) norm += pooled[d] * pooled[d];
    norm = Math.sqrt(norm) || 1e-9;
    for (let d = 0; d < hidden; d++) pooled[d] /= norm;

    out.push(pooled);
  }
  return out;
}

/** Embed an array of texts -> array of unit-length vectors (dim 384). */
async function embed(texts, modelId = DEFAULT_MODEL) {
  const { tokenizer, model } = await getEncoder(modelId);
  const input = await tokenizer(texts, { padding: true, truncation: true });
  const output = await model(input);
  return meanPoolNormalize(output.last_hidden_state, input.attention_mask);
}

function cosine(a, b) {
  if (a.length !== b.length) throw new Error('vector length mismatch');
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}

// ---- intra-batch (L5c) -------------------------------------------------------
// The forward check above only scores a candidate against the bank and the other
// drafts, never against the other candidates in its own batch. Intra-batch mode
// closes that gap: C(N,2) cosine pairs inside one draft file.
const INTRA_FAIL_THRESHOLD = 0.80;
const INTRA_WARN_THRESHOLD = 0.75;
const INTRA_PAIR_LIMIT = 10;

// --- bigram Jaccard (same definition as tools/qc.cjs, duplicated on purpose so
// --- each tool stays a standalone script) ---
function tokenize(text) {
  if (typeof text !== 'string') return [];
  return text
    .split(/\s+/)
    .map((t) => t.replace(/^[,.;:!?()\[\]{}"']+|[,.;:!?()\[\]{}"']+$/g, ''))
    .filter(Boolean);
}

function bigrams(tokens) {
  if (tokens.length < 2) return tokens.map((t) => `[${t}]`);
  const grams = [];
  for (let i = 0; i < tokens.length - 1; i++) grams.push(`${tokens[i]} ${tokens[i + 1]}`);
  return grams;
}

function jaccard(a, b) {
  const A = new Set(a);
  const B = new Set(b);
  if (A.size === 0 && B.size === 0) return 1;
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / new Set([...A, ...B]).size;
}

const bigramJaccard = (a, b) => jaccard(bigrams(tokenize(a)), bigrams(tokenize(b)));

/** All draft question pools: drafts/pending-*.json and drafts/_tools/*.json. */
function loadDraftQuestions() {
  const out = [];
  const dirs = [path.join(ROOT, 'drafts'), path.join(ROOT, 'drafts', '_tools')];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir)) {
      if (!name.endsWith('.json')) continue;
      const file = path.join(dir, name);
      try {
        const json = JSON.parse(fs.readFileSync(file, 'utf8'));
        const arr = Array.isArray(json) ? json : json.questions;
        if (!Array.isArray(arr)) continue;
        for (const q of arr) if (q && typeof q.id === 'string' && typeof q.question === 'string') out.push({ ...q, _source: path.relative(ROOT, file) });
      } catch {
        // not a question pool - skip
      }
    }
  }
  return out;
}

/** Read the bank (same shape as drafts). */
function loadBank() {
  const json = JSON.parse(fs.readFileSync(BANK, 'utf8'));
  return json.map((q) => ({ ...q, _source: 'src/data/questions.json' }));
}

/**
 * Duplicate check for a candidate question against a reference pool.
 * Order matters: Jaccard first (cheap), cosine second (expensive).
 * Returns best (max) scores plus the winning ids, so the caller can reject.
 */
async function checkDuplicate(candidate, referenceVectors, cosineThreshold = DEFAULT_COSINE_THRESHOLD, jaccardThreshold = DEFAULT_JACCARD_THRESHOLD) {
  let jacMax = 0;
  let jacId = null;
  for (const { question, id } of referenceVectors.pool) {
    const j = bigramJaccard(candidate.question, question);
    if (j > jacMax) {
      jacMax = j;
      jacId = id;
    }
  }

  let cosMax = 0;
  let cosId = null;
  let vec = null;
  if (referenceVectors.pool.length > 0) {
    vec = (await embed([candidate.question]))[0];
    for (let i = 0; i < referenceVectors.pool.length; i++) {
      const c = cosine(vec, referenceVectors.vectors[i]);
      if (c > cosMax) {
        cosMax = c;
        cosId = referenceVectors.pool[i].id;
      }
    }
  }

  return {
    jaccard_max: Number(jacMax.toFixed(4)),
    jaccard_id: jacId,
    jaccard_reject: jacMax > jaccardThreshold,
    cosine_max: Number(cosMax.toFixed(4)),
    cosine_id: cosId,
    cosine_reject: cosMax > cosineThreshold,
    reject: jacMax > jaccardThreshold || cosMax > cosineThreshold,
  };
}

/** Pre-embed a pool once, so N candidates are not re-embedded N times. */
async function buildReference(pool, modelId = DEFAULT_MODEL) {
  const texts = pool.map((q) => q.question);
  const vectors = texts.length ? await embed(texts, modelId) : [];
  return { pool, vectors };
}

/**
 * --intra-batch <file> [--whitelist-aware]: pairwise cosine between the
 * candidates inside a single draft file.
 *
 * --self-check deliberately stays whitelist-unaware (see the CLI below); this
 * mode is the only place that reads known_exceptions, because a pre-accept
 * batch review has to be able to distinguish an agreed-around background pair
 * from a real duplicate.
 */
async function runIntraBatch(file, whitelistAware) {
  let json;
  try {
    json = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    console.error("failed to read/parse '" + file + "': " + e.message);
    process.exitCode = 2;
    return;
  }
  const questions = Array.isArray(json) ? json : json.questions;
  if (!Array.isArray(questions)) {
    console.error('no questions array found in ' + file);
    process.exitCode = 2;
    return;
  }

  const n = questions.length;
  const totalPairs = (n * (n - 1)) / 2;
  if (n < 2) {
    console.log('need >=2 questions, got ' + n);
    process.exitCode = 0;
    return;
  }

  const vectors = await embed(questions.map((q) => q.question));
  const pairs = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      pairs.push({ a: questions[i].id, b: questions[j].id, c: cosine(vectors[i], vectors[j]) });
    }
  }
  pairs.sort((x, y) => y.c - x.c);

  let whitelist = [];
  if (whitelistAware) {
    try {
      const calib = JSON.parse(fs.readFileSync(path.join(__dirname, 'cosine-calibration.json'), 'utf8'));
      whitelist = calib.known_exceptions || [];
    } catch (e) {
      console.warn('calibration.json not found, whitelist empty');
    }
  }
  const whitelisted = new Set(whitelist);
  const isWhitelisted = (p) => whitelisted.has(p.a + '~' + p.b) || whitelisted.has(p.b + '~' + p.a);

  const aboveFail = pairs.filter((p) => p.c > INTRA_FAIL_THRESHOLD);
  const aboveWarn = pairs.filter((p) => p.c > INTRA_WARN_THRESHOLD);
  const unwhitelistedFails = whitelistAware ? aboveFail.filter((p) => !isWhitelisted(p)) : aboveFail;

  console.log('intra-batch pairs: ' + totalPairs);
  console.log('max cosine: ' + pairs[0].c.toFixed(4) + ' (' + pairs[0].a + '~' + pairs[0].b + ')');
  console.log('threshold: ' + INTRA_FAIL_THRESHOLD);
  console.log('pairs > ' + INTRA_FAIL_THRESHOLD + ': ' + aboveFail.length);
  for (const p of aboveFail.slice(0, INTRA_PAIR_LIMIT)) {
    console.log('  ' + p.a + '~' + p.b + ': ' + p.c.toFixed(4) + (whitelistAware && isWhitelisted(p) ? ' (whitelisted)' : ''));
  }
  console.log('pairs > ' + INTRA_WARN_THRESHOLD + ': ' + aboveWarn.length);
  for (const p of aboveWarn.slice(0, INTRA_PAIR_LIMIT)) {
    console.log('  ' + p.a + '~' + p.b + ': ' + p.c.toFixed(4) + (whitelistAware && isWhitelisted(p) ? ' (whitelisted)' : ''));
  }
  if (whitelistAware) {
    console.log('whitelisted exceptions: ' + whitelist.length);
    console.log('unwhitelisted pairs > ' + INTRA_FAIL_THRESHOLD + ': ' + unwhitelistedFails.length);
  }

  process.exitCode = unwhitelistedFails.length > 0 ? 1 : 0;
  return unwhitelistedFails;
}

module.exports = {
  DEFAULT_MODEL,
  EXPECTED_DIM,
  DEFAULT_COSINE_THRESHOLD,
  DEFAULT_JACCARD_THRESHOLD,
  embed,
  cosine,
  bigramJaccard,
  tokenize,
  bigrams,
  loadBank,
  loadDraftQuestions,
  buildReference,
  checkDuplicate,
};

// ---- CLI: node tools/cosine.cjs <pending.json> | --self-check | --intra-batch <file> ----
if (require.main === module) {
  (async () => {
    const argv = process.argv.slice(2);

    if (argv.includes('--whitelist-aware') && !argv.includes('--intra-batch')) {
      console.error('--whitelist-aware requires --intra-batch');
      process.exitCode = 2;
      return;
    }

    if (argv.includes('--intra-batch')) {
      const idx = argv.indexOf('--intra-batch');
      const file = argv[idx + 1];
      if (!file || file.startsWith('--')) {
        console.error('--intra-batch requires a file argument');
        process.exitCode = 2;
        return;
      }
      await runIntraBatch(file, argv.includes('--whitelist-aware'));
      return;
    }

    const target = argv[0];

    // --self-check: pairwise cosine over the bank itself, verifying that the
    // background maximum still matches tools/cosine-calibration.json.
    if (target === '--self-check') {
      const bankQs = loadBank();
      const vecs = await embed(bankQs.map((q) => q.question));
      let max = 0;
      let pair = null;
      let gt80 = 0;
      let gt78 = 0;
      for (let i = 0; i < bankQs.length; i++) {
        for (let j = i + 1; j < bankQs.length; j++) {
          const c = cosine(vecs[i], vecs[j]);
          if (c > max) { max = c; pair = bankQs[i].id + '~' + bankQs[j].id; }
          if (c > 0.80) gt80++;
          if (c > 0.78) gt78++;
        }
      }
      const n = (bankQs.length * (bankQs.length - 1)) / 2;
      const expected = CALIBRATION && CALIBRATION.background ? CALIBRATION.background.max : null;
      console.log('pairs: ' + n);
      console.log('max cosine: ' + max.toFixed(4) + '  (' + pair + ')');
      console.log('threshold: ' + DEFAULT_COSINE_THRESHOLD);
      console.log('pairs > 0.80: ' + gt80);
      console.log('pairs > 0.78: ' + gt78);
      if (expected !== null) {
        const ok = Math.abs(max - expected) < 0.005;
        console.log('calibration expected max: ' + expected.toFixed(4) + '  ->  ' + (ok ? 'MATCH' : 'MISMATCH'));
        if (!ok) process.exitCode = 1;
      }
      return;
    }
    if (!target) {
      console.error('usage: node tools/cosine.cjs <pending.json> | --self-check');
      process.exitCode = 2;
      return;
    }
    const json = JSON.parse(fs.readFileSync(target, 'utf8'));
    const candidates = Array.isArray(json) ? json : json.questions;
    if (!Array.isArray(candidates)) {
      console.error('no questions array found in ' + target);
      process.exitCode = 2;
      return;
    }

    const bank = loadBank();
    const drafts = loadDraftQuestions().filter((q) => q.question !== undefined);
    console.log(`bank=${bank.length} drafts=${drafts.length} candidates=${candidates.length}`);
    console.log(`thresholds: cosine>${DEFAULT_COSINE_THRESHOLD} jaccard>${DEFAULT_JACCARD_THRESHOLD}`);

    const bankRef = await buildReference(bank);
    const draftRef = await buildReference(drafts);

    let rejected = 0;
    for (const c of candidates) {
      const vsBank = await checkDuplicate(c, bankRef);
      const vsDrafts = await checkDuplicate(c, draftRef);
      const bad = vsBank.reject || vsDrafts.reject;
      if (bad) rejected++;
      console.log(
        `${bad ? 'REJECT' : 'ok    '} ${c.id}  bank(j=${vsBank.jaccard_max} cos=${vsBank.cosine_max})  drafts(j=${vsDrafts.jaccard_max} cos=${vsDrafts.cosine_max})`
      );
    }
    console.log(`\nrejected: ${rejected}/${candidates.length}`);
    process.exitCode = rejected > 0 ? 1 : 0;
  })();
}