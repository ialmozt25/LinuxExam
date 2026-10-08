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

/**
 * Читает boundaries.exceptions из Contract: список `- path:` с полями
 * `reason` / `approved` / `expires` (тот же zero-deps-сканер блока boundaries).
 * Исключение — разрешение закоммитить конкретный forbidden-путь в рамках одной
 * задачи; `expires` (YYYY-MM-DD) обязателен по смыслу: без даты исключение
 * бессрочно, поэтому такие строки guard печатает как предупреждение.
 */
function readExceptions() {
  if (!fs.existsSync(CONTRACT)) return [];
  const lines = fs.readFileSync(CONTRACT, 'utf8').split(/\r?\n/);
  const start = lines.findIndex((l) => /^\s*exceptions\s*:/.test(l));
  if (start === -1) return [];
  const baseIndent = lines[start].search(/\S/);
  const out = [];
  let cur = null;
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.trim() === '') continue;
    const indent = line.search(/\S/);
    if (indent <= baseIndent) break;
    const item = line.match(/^\s*-\s*([A-Za-z_]+)\s*:\s*(.*)$/);
    if (item) {
      cur = { [item[1]]: parseScalar(item[2]) };
      out.push(cur);
      continue;
    }
    const kv = line.match(/^\s*([A-Za-z_]+)\s*:\s*(.*)$/);
    if (kv && cur) cur[kv[1]] = parseScalar(kv[2]);
  }
  return out.filter((e) => typeof e.path === 'string' && e.path !== '');
}

/**
 * Значение YAML-строки: в кавычках — как есть (внутри может быть `#`), без
 * кавычек — до начала комментария. Нужен, т.к. `reason` содержит «(#28)».
 */
function parseScalar(raw) {
  const value = String(raw).trim();
  const quoted = /^(["'])([\s\S]*)\1$/.exec(value);
  if (quoted) return quoted[2];
  return value.replace(/\s+#.*$/, '').trim();
}

/** Локальная дата YYYY-MM-DD — граница `expires` сравнивается по ней. */
function todayIso() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Делит исключения на действующие и просроченные/без `expires`. */
function splitExceptions(list, today) {
  const active = [];
  const expired = [];
  for (const ex of list) {
    if (typeof ex.expires === 'string' && ex.expires !== '' && ex.expires >= today) active.push(ex);
    else expired.push(ex);
  }
  return { active, expired };
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

// Contract → boundaries.exceptions: разрешение закоммитить конкретный
// forbidden-путь в рамках одной задачи. Просроченное исключение НЕ применяется —
// путь блокируется снова (см. readExceptions/splitExceptions).
const { active, expired } = splitExceptions(readExceptions(), todayIso());
for (const ex of expired) {
  console.log(`[boundaries-guard] exception EXPIRED — ${ex.path} (expires ${ex.expires ?? 'нет'}) — путь снова под forbidden_paths`);
}
const applied = [];
const remaining = [];
for (const h of hits) {
  const ex = active.find((e) => globToRe(e.path).test(h));
  if (ex) applied.push({ path: h, ex }); else remaining.push(h);
}
for (const a of applied) {
  console.log(`[boundaries-guard] exception applied — ${a.path} (${a.ex.reason ?? 'без reason'}; approved ${a.ex.approved ?? '—'}; expires ${a.ex.expires})`);
}

if (remaining.length === 0) {
  console.log(`[boundaries-guard] OK — изменённых путей: ${paths.size}, пересечений с forbidden_paths: 0${
    applied.length > 0 ? `, применено исключений: ${applied.length}` : ''}`);
  console.log('[summary] violations=0');
  process.exit(0);
}

console.log(`[boundaries-guard] FAIL — forbidden-путей затронуто: ${remaining.length}`);
for (const h of remaining) console.log(`  forbidden: ${h}`);
console.log('  fix: откатить правки этих путей (contract boundaries.forbidden_paths)');
console.log(`[summary] violations=${remaining.length}`);
process.exit(1);
