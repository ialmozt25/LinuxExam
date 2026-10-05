#!/usr/bin/env node
/**
 * check-colors.mjs — fitness-проверка «no-hex-in-tsx» (severity: high).
 *
 * Запрещает hex-цвета в src/**​/*.tsx: цвета берутся из
 * src/presentation/theme/tokens.css через var(--token).
 *
 * Exception path (governance Contract, секция fitness_policy):
 *   scripts/fitness/allowlist.json — список исключений по (file, hex) с
 *   обязательными reason и expires (ISO YYYY-MM-DD).
 *     - запись совпала и не истекла   → [allowlisted] (коммит не блокирует);
 *     - expires < сегодня             → [expired] → FAIL;
 *     - запись не совпала ни с одной находкой → [stale] (advisory, exit 0),
 *       чтобы правило «allowlist только уменьшается» было выполнимым.
 *   Inline-подавлений в коде нет намеренно: исключение живёт в одном файле
 *   и видно целиком.
 *
 * Zero-deps: только node:*. Дерево обходится рекурсивно, symlink не
 * разворачивается (каталоги-симлинки пропускаются, файлы-симлинки читаются
 * как файлы по своему пути).
 *
 * Exit 1 — есть неисключённые находки или истёкшие исключения; exit 0 — чисто.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, '..', '..');

const HEX_RE = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/g;
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'dist-ssr', 'test-results']);
const ALLOWLIST = path.join(SCRIPT_DIR, 'allowlist.json');
const CHECK_ID = 'no-hex-in-tsx';

/** Все .tsx под каталогом, рекурсивно, без разворота symlink-каталогов. */
function findTsx(dir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e.isSymbolicLink()) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      findTsx(full, out);
    } else if (e.isFile() && e.name.endsWith('.tsx')) {
      out.push(full);
    }
  }
  return out;
}

/** Записи allowlist для этой проверки. ENOENT/битый JSON → пустой список. */
function readAllowlist() {
  let raw;
  try {
    raw = fs.readFileSync(ALLOWLIST, 'utf8');
  } catch (e) {
    if (e.code !== 'ENOENT') console.log(`[${CHECK_ID}] warn: allowlist не прочитан (${e.code || e.message})`);
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    const list = parsed?.[CHECK_ID];
    return Array.isArray(list) ? list : [];
  } catch (e) {
    console.log(`[${CHECK_ID}] warn: allowlist.json не парсится (${e.message}) — считаю пустым`);
    return [];
  }
}

/** Сегодняшняя дата в локальной зоне как ISO YYYY-MM-DD. */
function todayIso() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const normHex = (h) => String(h).trim().toUpperCase();
const normFile = (f) => String(f).trim().replace(/\\/g, '/');

const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');
const root = path.join(ROOT, 'src');
const files = findTsx(root);

// --- сбор находок: (file, line, hex)
const findings = [];
for (const file of files) {
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const matches = lines[i].match(HEX_RE);
    if (!matches) continue;
    for (const hex of matches) findings.push({ file: rel(file), line: i + 1, hex });
  }
}

// --- классификация по allowlist
const today = todayIso();
const entries = readAllowlist()
  .filter((e) => e && typeof e === 'object')
  .map((e) => ({ ...e, file: normFile(e.file), hex: normHex(e.hex), matched: 0 }));

const violations = [];
const allowlisted = [];
const expired = [];

for (const f of findings) {
  const hit = entries.find((e) => e.file === normFile(f.file) && e.hex === normHex(f.hex));
  if (!hit) {
    violations.push(f);
    continue;
  }
  hit.matched += 1;
  if (typeof hit.expires === 'string' && hit.expires < today) expired.push({ ...f, expires: hit.expires });
  else allowlisted.push(f);
}

const stale = entries.filter((e) => e.matched === 0);
const total = violations.length + expired.length;

console.log(`[${CHECK_ID}] найдено hex: ${findings.length} (в ${files.length} .tsx)`);
for (const f of allowlisted) console.log(`  [allowlisted] ${f.file}:${f.line}: ${f.hex}`);
for (const f of expired) console.log(`  [expired] ${f.file}:${f.line}: ${f.hex} (expires ${f.expires})`);
for (const f of violations) console.log(`  ${f.file}:${f.line}: ${f.hex}`);
for (const e of stale) console.log(`  [stale] ${e.file} ${e.hex} — исключение не совпало ни с одной находкой, удалить`);

if (total === 0) {
  console.log(
    `[${CHECK_ID}] OK — нарушений нет (allowlisted=${allowlisted.length}, stale=${stale.length})`,
  );
  console.log(`[summary] violations=0 allowlisted=${allowlisted.length} stale=${stale.length}`);
  process.exit(0);
}

console.log(`[${CHECK_ID}] FAIL — нарушений: ${total}`);
if (expired.length) console.log('  fix: продлить/снять исключение в scripts/fitness/allowlist.json (expires истёк)');
if (violations.length) console.log('  fix: взять токен из src/presentation/theme/tokens.css → var(--token)');
console.log(`[summary] violations=${total} allowlisted=${allowlisted.length} stale=${stale.length}`);
process.exit(1);
