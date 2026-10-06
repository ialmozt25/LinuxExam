#!/usr/bin/env node
/**
 * check-colors.mjs — fitness-проверка «no-hex-in-tsx» (severity: high).
 *
 * Запрещает hex-цвета в src/**​/*.tsx: цвета берутся из
 * src/presentation/theme/tokens.css через var(--token).
 *
 * Второе правило (token-bypass): hex в .tsx, значение которого СОВПАДАЕТ со
 * значением существующего токена, — это не «случайный цвет», а обойдённый токен
 * (значение скопировали литералом, и смена палитры его больше не заденет).
 * Такая находка пишется отдельной строкой `[token-bypass] … — есть токен
 * --name` и считается нарушением. Правило не дублирует allowlist: записи
 * `scripts/fitness/allowlist.json` остаются исключениями и в token-bypass не
 * попадают (иначе капитан-approved hex из main.tsx ломал бы гейт дважды);
 * их число печатается справочно (`allowlisted-совпадений`).
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
 * Exit 1 — есть неисключённые находки (в т.ч. token-bypass) или истёкшие
 * исключения; exit 0 — чисто.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, '..', '..');

const HEX_RE = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/g;
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'dist-ssr', 'test-results']);
const ALLOWLIST = path.join(SCRIPT_DIR, 'allowlist.json');
const TOKENS_CSS = path.join(ROOT, 'src', 'presentation', 'theme', 'tokens.css');
const CHECK_ID = 'no-hex-in-tsx';
const DECL_RE = /^\s*(--[a-z0-9-]+)\s*:\s*([^;]+);/;
const VAR_RE = /var\(\s*(--[a-z0-9-]+)\s*(?:,\s*([^)]*))?\)/g;

/** Все .tsx под каталогом, рекурсивно, без разворота symlink-каталогов. */
export function findTsx(dir, out = []) {
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

export const normHex = (h) => String(h).trim().toUpperCase();
const normFile = (f) => String(f).trim().replace(/\\/g, '/');

/**
 * Значения токенов: имя → все hex, до которых оно разворачивается.
 * Разворот покрывает цепочки `var()` и фолбэки (`var(--tg-x, var(--role))`),
 * поэтому `#1565C0` находится за `--accent`, а `#EAEAEA` — за `--bg-elevated`.
 * Одно имя может встречаться в нескольких блоках (root / light / dark) — все
 * значения собираются, потому что hex-литерал в .tsx ломает любой из вариантов.
 */
export function buildTokenIndex(cssText) {
  const declarations = new Map(); // name -> raw values[]
  for (const line of String(cssText).split(/\r?\n/)) {
    const m = line.match(DECL_RE);
    if (!m) continue;
    if (!declarations.has(m[1])) declarations.set(m[1], []);
    declarations.get(m[1]).push(m[2].trim());
  }

  const memo = new Map();
  const hexesOf = (name, seen = new Set()) => {
    if (memo.has(name)) return memo.get(name);
    if (seen.has(name) || !declarations.has(name)) return [];
    seen.add(name);
    const out = new Set();
    for (const raw of declarations.get(name)) {
      for (const hex of raw.match(HEX_RE) ?? []) out.add(normHex(hex));
      VAR_RE.lastIndex = 0;
      for (const varMatch of raw.matchAll(VAR_RE)) {
        for (const hex of hexesOf(varMatch[1], seen)) out.add(hex);
        if (varMatch[2]) {
          for (const hex of varMatch[2].match(HEX_RE) ?? []) out.add(normHex(hex));
          VAR_RE.lastIndex = 0;
          const inner = varMatch[2].matchAll(VAR_RE);
          for (const nested of inner) for (const hex of hexesOf(nested[1], seen)) out.add(hex);
        }
      }
    }
    const list = [...out];
    memo.set(name, list);
    return list;
  };

  const index = new Map(); // hex -> token names
  for (const name of declarations.keys()) {
    for (const hex of hexesOf(name)) {
      if (!index.has(hex)) index.set(hex, []);
      if (!index.get(hex).includes(name)) index.get(hex).push(name);
    }
  }
  return index;
}

/** Токены, значение которых совпадает с hex (пустой массив — «литерал без токена»). */
export function tokensForHex(hex, index) {
  return index.get(normHex(hex)) ?? [];
}

const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');

function main() {
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

  // --- индекс токенов (token-bypass)
  let tokenIndex = new Map();
  try {
    tokenIndex = buildTokenIndex(fs.readFileSync(TOKENS_CSS, 'utf8'));
  } catch (e) {
    console.log(`[${CHECK_ID}] warn: tokens.css не прочитан (${e.code || e.message}) — token-bypass пропущен`);
  }

  // --- классификация по allowlist
  const today = todayIso();
  const entries = readAllowlist()
    .filter((e) => e && typeof e === 'object')
    .map((e) => ({ ...e, file: normFile(e.file), hex: normHex(e.hex), matched: 0 }));

  const violations = [];
  const allowlisted = [];
  const expired = [];
  let allowlistedShadowed = 0;

  for (const f of findings) {
    const tokens = tokensForHex(f.hex, tokenIndex);
    const hit = entries.find((e) => e.file === normFile(f.file) && e.hex === normHex(f.hex));
    if (!hit) {
      violations.push(tokens.length > 0 ? { ...f, tokens } : f);
      continue;
    }
    hit.matched += 1;
    if (tokens.length > 0) allowlistedShadowed += 1;
    if (typeof hit.expires === 'string' && hit.expires < today) expired.push({ ...f, expires: hit.expires });
    else allowlisted.push(f);
  }

  const stale = entries.filter((e) => e.matched === 0);
  const bypass = violations.filter((f) => f.tokens);
  const plain = violations.filter((f) => !f.tokens);
  const total = violations.length + expired.length;

  console.log(`[${CHECK_ID}] найдено hex: ${findings.length} (в ${files.length} .tsx)`);
  for (const f of allowlisted) console.log(`  [allowlisted] ${f.file}:${f.line}: ${f.hex}`);
  for (const f of expired) console.log(`  [expired] ${f.file}:${f.line}: ${f.hex} (expires ${f.expires})`);
  for (const f of plain) console.log(`  ${f.file}:${f.line}: ${f.hex}`);
  for (const f of bypass) {
    console.log(`  [token-bypass] ${f.file}:${f.line}: ${f.hex} — есть токен ${f.tokens.join(', ')}, взять var(--…)`);
  }
  for (const e of stale) console.log(`  [stale] ${e.file} ${e.hex} — исключение не совпало ни с одной находкой, удалить`);
  console.log(
    `[${CHECK_ID}] token-bypass: ${bypass.length} (токенов в индексе: ${tokenIndex.size} значений, ` +
      `hex-совпадений среди allowlisted: ${allowlistedShadowed})`,
  );

  if (total === 0) {
    console.log(
      `[${CHECK_ID}] OK — нарушений нет (allowlisted=${allowlisted.length}, stale=${stale.length})`,
    );
    console.log(`[summary] violations=0 allowlisted=${allowlisted.length} stale=${stale.length}`);
    process.exit(0);
  }

  console.log(`[${CHECK_ID}] FAIL — нарушений: ${total}`);
  if (expired.length) console.log('  fix: продлить/снять исключение в scripts/fitness/allowlist.json (expires истёк)');
  if (bypass.length) console.log('  fix: hex совпадает со значением токена → заменить на var(--token) из tokens.css');
  if (plain.length) console.log('  fix: взять токен из src/presentation/theme/tokens.css → var(--token)');
  console.log(`[summary] violations=${total} allowlisted=${allowlisted.length} stale=${stale.length}`);
  process.exit(1);
}

// CLI-режим: npm run fitness / audit-ui.mjs запускают скрипт как файл. При
// импорте (self-test разбора токенов) main() не выполняется.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
