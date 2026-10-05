#!/usr/bin/env node
/**
 * check-boundaries.mjs — fitness-проверка «boundaries-guard» (severity: high).
 *
 * Сравнивает пути из `git diff --cached --name-only --diff-filter=ACMRT` (только
 * STAGED, то есть то, что реально войдёт в коммит) с boundaries.forbidden_paths из
 * .project/governance/frontend-contract.yaml и блокирует пересечения.
 *
 * Worktree и untracked-файлы намеренно НЕ читаются: незакоммиченный мусор в
 * рабочем дереве (черновики, скриншоты, probe-скрипты) не должен блокировать
 * коммит. Поэтому standalone-запуск на пустом staging даёт violations=0.
 *
 * Contract читается простым сканером блока boundaries.forbidden_paths: файл
 * остаётся источником истины для человека, а не рантайм-зависимостью (js-yaml
 * в проекте есть, но fitness-скрипты обязаны быть zero-deps).
 *
 * Zero-deps: только node:*. Exit 1 — есть пересечения; exit 0 — чисто.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, '..', '..');

const CONTRACT = path.join(ROOT, '.project', 'governance', 'frontend-contract.yaml');

/** Читает список boundaries.forbidden_paths из YAML без парсера. */
function readForbiddenPaths() {
  if (!fs.existsSync(CONTRACT)) return null;
  const lines = fs.readFileSync(CONTRACT, 'utf8').split(/\r?\n/);
  const start = lines.findIndex((l) => /^\s*forbidden_paths\s*:/.test(l));
  if (start === -1) return null;
  const baseIndent = lines[start].search(/\S/);
  const out = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.trim() === '') continue;
    const indent = line.search(/\S/);
    if (indent <= baseIndent) break;
    const m = line.match(/^\s*-\s*["']?([^"'\s#]+)["']?\s*(?:#.*)?$/);
    if (m) out.push(m[1]);
  }
  return out;
}

/** 'src/data/**' → RegExp, где ** перекрывает сегменты, а * — внутри сегмента. */
function globToRe(glob) {
  const norm = glob.replace(/\\/g, '/');
  let re = '';
  for (let i = 0; i < norm.length; i += 1) {
    const c = norm[i];
    if (c === '*') {
      if (norm[i + 1] === '*') {
        const afterSlash = norm[i + 2] === '/';
        re += afterSlash ? '(?:.*/)?' : '.*';
        i += afterSlash ? 2 : 1;
      } else {
        re += '[^/]*';
      }
    } else if (c === '?') {
      re += '[^/]';
    } else {
      re += /[a-z0-9_\-./]/.test(c) ? c : '\\' + c;
    }
  }
  return new RegExp('^' + re + '$');
}

function runGit(args) {
  const res = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8', shell: false });
  if (res.error) return { ok: false, reason: res.error.message, stdout: '' };
  if (res.status !== 0) {
    return { ok: false, reason: (res.stderr || '').trim() || `git exit ${res.status}`, stdout: '' };
  }
  return { ok: true, stdout: res.stdout || '' };
}

const forbidden = readForbiddenPaths();
if (forbidden === null) {
  console.log('[boundaries-guard] SKIP — contract или boundaries.forbidden_paths не найдены');
  process.exit(0);
}

const base = runGit(['diff', '--cached', '--name-only', '--diff-filter=ACMRT']);

if (!base.ok) {
  console.log(`[boundaries-guard] SKIP — git недоступен (${base.reason}); проверка не выполнена`);
  process.exit(0);
}

// Источник — только staged (git diff --cached). Worktree не читается: незакоммиченный
// мусор не должен блокировать коммит. --diff-filter=ACMRT исключает D (удаления) и
// T-подстановки, оставляя добавленные/изменённые/скопированные/переименованные.
const paths = new Set(
  base.stdout
    .split(/\r?\n/)
    .map((s) => s.trim().replace(/\\/g, '/'))
    .filter(Boolean),
);

const matchers = forbidden.map((g) => ({ glob: g, re: globToRe(g) }));
const hits = [...paths].filter((p) => matchers.some((m) => m.re.test(p))).sort();

if (hits.length === 0) {
  console.log(`[boundaries-guard] OK — изменённых путей: ${paths.size}, пересечений с forbidden_paths: 0`);
  console.log('[summary] violations=0');
  process.exit(0);
}

console.log(`[boundaries-guard] FAIL — forbidden-путей затронуто: ${hits.length}`);
for (const h of hits) console.log(`  forbidden: ${h}`);
console.log('  fix: откатить правки этих путей (contract boundaries.forbidden_paths)');
console.log(`[summary] violations=${hits.length}`);
process.exit(1);
