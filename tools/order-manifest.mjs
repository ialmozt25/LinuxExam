import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// The single writer/validator for the question id order manifest
// `src/data/questions/_order.json` (spec 032, task t1).
//
// Why: `_order.json` used to be hand-edited. `tools/split-questions.mjs` can only
// write it while the removed monolith `src/data/questions.json` exists, and
// `tools/gen-topics-manifest.mjs` only validates it (see docs/memory/alerts.md,
// 2026-09-29 "`_order.json` - временно ручной механизм" and docs/memory/procedural.md:28,
// step 6 "обновить `_order.json`"). This tool closes that gap.
//
// Usage:
//   node tools/order-manifest.mjs --check           # read-only, exit 0/1
//   node tools/order-manifest.mjs --add <id>        # append a missing id
//   node tools/order-manifest.mjs --remove <id>     # cut an id out
//   npm run order:check | npm run order:add <id> | npm run order:remove <id>
//
// The flag set is exactly these three; an id may be given either as the next argument
// (`--add fp_099`) or attached to the flag (`--add=fp_099`).
//
// DETERMINISTIC PLACEMENT RULE (--add): a new id is APPENDED TO THE END of the array.
// The file is a chronological log of authored batches (the current array ends with a
// batch of later-added ids), so appending is the rule that produced the file in the
// first place: it needs no judgement and no extra ordering input, the byte result is a
// pure function of (current array, id), and the relative order of every existing id is
// preserved by construction. Rejected alternative: inserting beside the id's topic
// neighbours - that would reshuffle curated content inside the array on every add and
// would still need a tie-break rule for unknown prefixes.
//
// Id format: `<topic>_<3 digits>` (fp_001, msw_016). The format is validated by
// --add/--remove only; --check deliberately keeps the set-comparison logic of
// tools/gen-topics-manifest.mjs and adds no format rule of its own.
//
// --check is READ-ONLY. It exits 0 when _order.json is an array of unique ids whose set
// equals the set of ids in all topic files, otherwise it exits 1 and lists every
// divergence (missing, extra, duplicated, malformed structure).
//
// Writes: UTF-8 without BOM, LF-only, 2-space indent, final 0x0A - the same writeLf-style
// contract as tools/gen-state.mjs:635. The order of the remaining ids never changes.
//
// Exit codes: 0 - ok / no-op warning; 1 - `--check` mismatches or a failed write; 2 - usage
// or input error (bad flag, bad id, missing/unparsable _order.json).

/** Id convention: `<topic>_<3 digits>`, e.g. fp_001 / msw_016. */
export const ID_PATTERN = /^[a-z]+_\d{3}$/;

/** Manifest file name inside the questions directory. */
export const ORDER_NAME = '_order.json';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const QUESTIONS_DIR = path.join(ROOT, 'src', 'data', 'questions');

const USAGE =
  'usage: node tools/order-manifest.mjs --add <id> | --remove <id> | --check\n' +
  '       (npm run order:add <id> | npm run order:remove <id> | npm run order:check)';

/** True for ids that follow the `<topic>_<3 digits>` convention. */
export function isValidId(id) {
  return typeof id === 'string' && ID_PATTERN.test(id);
}

/**
 * Parses the CLI arguments. Returns `{ ok: true, mode, id }` or `{ ok: false, error }`.
 * `mode` is one of 'add' | 'remove' | 'check'; `id` is only set for add/remove.
 */
export function parseArgs(argv) {
  const modes = [];
  let id;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    let flag = arg;
    let inline;
    const eq = arg.startsWith('--') ? arg.indexOf('=') : -1;
    if (eq !== -1) {
      flag = arg.slice(0, eq);
      inline = arg.slice(eq + 1);
    }
    if (flag === '--check') {
      if (inline !== undefined) return { ok: false, error: '--check does not take a value' };
      modes.push('check');
      continue;
    }
    if (flag === '--add' || flag === '--remove') {
      const value = inline !== undefined ? inline : argv[i + 1];
      if (inline === undefined) i += 1;
      if (value === undefined || value === '' || value.startsWith('--')) {
        return { ok: false, error: 'missing id: ' + flag + ' <id>' };
      }
      modes.push(flag.slice(2));
      id = value;
      continue;
    }
    return { ok: false, error: 'unknown argument: ' + arg };
  }
  if (modes.length !== 1) {
    return { ok: false, error: 'exactly one of --add <id> | --remove <id> | --check is required' };
  }
  return { ok: true, mode: modes[0], id };
}

/** Appends `id` to the end of `order` (the deterministic rule). No-op if present. */
export function placeId(order, id) {
  if (order.includes(id)) return { order, added: false };
  return { order: [...order, id], added: true };
}

/** Drops every occurrence of `id`; the order of the remaining ids is preserved. */
export function removeId(order, id) {
  if (!order.includes(id)) return { order, removed: false };
  return { order: order.filter((entry) => entry !== id), removed: true };
}

/** LF-only serialization with 2-space indent and a final newline. */
export function serializeOrder(ids) {
  return JSON.stringify(ids, null, 2).replace(/\r\n/g, '\n') + '\n';
}

/** Reads and shape-checks the manifest. Returns `{ ok, file, ids }` or `{ ok: false, error }`. */
export function readOrder(dir) {
  const file = path.join(dir, ORDER_NAME);
  if (!fs.existsSync(file)) return { ok: false, error: ORDER_NAME + ' not found: ' + file };
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    return { ok: false, error: ORDER_NAME + ': not JSON (' + err.message + ')' };
  }
  if (!Array.isArray(parsed)) return { ok: false, error: ORDER_NAME + ': root is not an array' };
  return { ok: true, file, ids: parsed };
}

/** Writes the manifest and verifies LF/no BOM/final 0x0A/read-back. Throws on violation. */
export function writeOrder(file, ids) {
  fs.writeFileSync(file, serializeOrder(ids), { encoding: 'utf8' });
  const bytes = fs.readFileSync(file);
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    throw new Error(ORDER_NAME + ': BOM detected after write');
  }
  if (bytes.includes(13)) throw new Error(ORDER_NAME + ': CR byte detected after write (expected LF)');
  if (bytes[bytes.length - 1] !== 0x0a) throw new Error(ORDER_NAME + ': last byte is not 0x0A');
  const reparsed = JSON.parse(bytes.toString('utf8'));
  if (JSON.stringify(reparsed) !== JSON.stringify(ids)) {
    throw new Error(ORDER_NAME + ': read-back does not match the written ids');
  }
}

/**
 * Collects the ids of every topic file in `dir` (the same file filter and per-file
 * checks as tools/gen-topics-manifest.mjs). Read-only.
 */
export function collectTopicIds(dir) {
  const problems = [];
  if (!fs.existsSync(dir)) return { ids: new Set(), problems: ['dir not found: ' + dir], files: [] };
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json') && f !== ORDER_NAME && f !== '_topics.json')
    .sort();
  if (files.length === 0) problems.push('no topic files found in ' + dir);
  const ids = new Set();
  for (const file of files) {
    const topicName = file.replace(/\.json$/, '');
    let items;
    try {
      items = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
    } catch (err) {
      problems.push(file + ': not JSON (' + err.message + ')');
      continue;
    }
    if (!Array.isArray(items)) {
      problems.push(file + ': root is not an array');
      continue;
    }
    for (const q of items) {
      if (!q || typeof q.id !== 'string' || !q.id) {
        problems.push(file + ': question without id');
        continue;
      }
      if (ids.has(q.id)) problems.push('duplicate id across topic files: ' + q.id);
      ids.add(q.id);
      if (q.topic !== topicName) problems.push(file + ': ' + q.id + ' has topic ' + q.topic);
    }
  }
  return { ids, problems, files };
}

/**
 * Compares the manifest against the topic-file id set (both directions) and checks that
 * the manifest is an array of unique non-empty strings. Pure; returns `{ ok, problems }`.
 */
export function diffOrder(order, topicIds) {
  if (!Array.isArray(order)) return { ok: false, problems: [ORDER_NAME + ': root is not an array'] };
  const problems = [];
  const seen = new Set();
  for (const entry of order) {
    if (typeof entry !== 'string' || entry === '') {
      problems.push(ORDER_NAME + ': not a non-empty string entry: ' + JSON.stringify(entry));
      continue;
    }
    if (seen.has(entry)) problems.push(ORDER_NAME + ': duplicate id: ' + entry);
    seen.add(entry);
  }
  for (const id of topicIds) {
    if (!seen.has(id)) problems.push('id in topic files, not in ' + ORDER_NAME + ': ' + id);
  }
  for (const id of seen) {
    if (!topicIds.has(id)) problems.push('id in ' + ORDER_NAME + ', not in topic files: ' + id);
  }
  return { ok: problems.length === 0, problems };
}

/**
 * Read-only full check of `dir`. Returns `{ code, problems, total, ordered, files }`
 * where `code` is 0 (consistent) or 1 (mismatches found). Nothing is written.
 */
export function checkDir(dir) {
  const { ids: topicIds, problems: topicProblems, files } = collectTopicIds(dir);
  const read = readOrder(dir);
  if (!read.ok) {
    return {
      code: 1,
      problems: [...topicProblems, read.error],
      total: topicIds.size,
      ordered: null,
      files: files.length,
    };
  }
  const diff = diffOrder(read.ids, topicIds);
  const problems = [...topicProblems, ...diff.problems];
  return {
    code: problems.length === 0 ? 0 : 1,
    problems,
    total: topicIds.size,
    ordered: read.ids.length,
    files: files.length,
  };
}

function runCheck(dir) {
  const result = checkDir(dir);
  if (result.code === 0) {
    console.log('OK: ' + ORDER_NAME + ' matches ' + result.total + ' ids from ' + result.files + ' topic files');
    return 0;
  }
  console.error('MISMATCH: ' + result.problems.length + ' problem(s)');
  for (const problem of result.problems) console.error('  - ' + problem);
  return 1;
}

function runAdd(dir, id) {
  const read = readOrder(dir);
  if (!read.ok) {
    console.error('ERROR: ' + read.error);
    return 2;
  }
  const { order, added } = placeId(read.ids, id);
  if (!added) {
    console.warn('WARN: ' + id + ' is already in ' + ORDER_NAME + ' - no-op');
    return 0;
  }
  const { ids: topicIds } = collectTopicIds(dir);
  try {
    writeOrder(read.file, order);
  } catch (err) {
    console.error('ERROR: ' + err.message);
    return 1;
  }
  console.log('OK: appended ' + id + ' to ' + ORDER_NAME + ' (' + read.ids.length + ' -> ' + order.length + ' ids)');
  console.log('tail: ' + order.slice(-3).join(', '));
  if (!topicIds.has(id)) {
    console.warn(
      'WARN: ' + id + ' is in no topic file - ' + ORDER_NAME + ' now diverges by set, `npm run order:check` returns 1 until the question exists',
    );
  }
  return 0;
}

function runRemove(dir, id) {
  const read = readOrder(dir);
  if (!read.ok) {
    console.error('ERROR: ' + read.error);
    return 2;
  }
  const { order, removed } = removeId(read.ids, id);
  if (!removed) {
    console.warn('WARN: ' + id + ' is not in ' + ORDER_NAME + ' - no-op');
    return 0;
  }
  try {
    writeOrder(read.file, order);
  } catch (err) {
    console.error('ERROR: ' + err.message);
    return 1;
  }
  console.log('OK: removed ' + id + ' from ' + ORDER_NAME + ' (' + read.ids.length + ' -> ' + order.length + ' ids)');
  return 0;
}

/** CLI entry point; returns the process exit code. */
export function main(argv) {
  const parsed = parseArgs(argv);
  if (!parsed.ok) {
    console.error(USAGE);
    console.error('ERROR: ' + parsed.error);
    return 2;
  }
  if (parsed.mode === 'check') return runCheck(QUESTIONS_DIR);
  if (!isValidId(parsed.id)) {
    console.error('ERROR: invalid id ' + JSON.stringify(parsed.id) + ' - expected <topic>_<3 digits>, e.g. fp_001');
    return 2;
  }
  return parsed.mode === 'add' ? runAdd(QUESTIONS_DIR, parsed.id) : runRemove(QUESTIONS_DIR, parsed.id);
}

const isMain =
  process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    process.exit(main(process.argv.slice(2)));
  } catch (err) {
    console.error('ERROR: ' + (err && err.message ? err.message : err));
    process.exit(1);
  }
}
