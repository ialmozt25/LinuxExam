#!/usr/bin/env node
/**
 * check-tokens.mjs — fitness-проверка «no-dead-tokens» (severity: medium).
 *
 * Берёт объявления CSS-переменных (`--name:` в начале строки) из
 * src/presentation/theme/tokens.css и ищет их использование в
 * src/**\/*.{tsx,ts,css} кроме самого tokens.css.
 *
 * Токен считается живым, если встречается вне tokens.css как `--name` со
 * свободной правой границей (не `--name-2`, не `--nameX`).
 *
 * Zero-deps: только node:*. Exit 1 — есть мёртвые токены; exit 0 — чисто.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, '..', '..');

const TOKENS_CSS = path.join(ROOT, 'src', 'presentation', 'theme', 'tokens.css');
const DECL_RE = /^\s*(--[a-z0-9-]+)\s*:/;
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'dist-ssr', 'test-results']);

function walk(dir, out = []) {
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
      walk(full, out);
    } else if (e.isFile() && /\.(tsx|ts|css)$/.test(e.name)) {
      out.push(full);
    }
  }
  return out;
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');

if (!fs.existsSync(TOKENS_CSS)) {
  console.log('[no-dead-tokens] SKIP — tokens.css не найден (src/presentation/theme/tokens.css)');
  process.exit(0);
}

const declared = [];
for (const line of fs.readFileSync(TOKENS_CSS, 'utf8').split(/\r?\n/)) {
  const m = line.match(DECL_RE);
  if (m && !declared.includes(m[1])) declared.push(m[1]);
}

const files = walk(path.join(ROOT, 'src')).filter((f) => f !== TOKENS_CSS);
const source = files.map((f) => fs.readFileSync(f, 'utf8')).join('\n');

const dead = declared.filter((token) => {
  const re = new RegExp(escapeRe(token) + '(?![a-z0-9-])');
  return !re.test(source);
});

if (dead.length === 0) {
  console.log(`[no-dead-tokens] OK — мёртвых токенов нет (объявлено: ${declared.length}, просканировано файлов: ${files.length})`);
  console.log('[summary] violations=0');
  process.exit(0);
}

console.log(`[no-dead-tokens] FAIL — мёртвых токенов: ${dead.length} из ${declared.length}`);
for (const t of dead.sort()) console.log(`  dead: ${t}`);
console.log('  fix: удалить токен из tokens.css или использовать его в src/**');
console.log(`[summary] violations=${dead.length}`);
process.exit(1);
