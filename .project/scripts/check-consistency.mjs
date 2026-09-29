#!/usr/bin/env node
/**
 * .project/scripts/check-consistency.mjs — Layer 1: сверка документов на
 * STALE-СНАПШОТЫ (документ описывает состояние, которое уже переехало).
 *
 * Зачем отдельный гейт. `npm run sync:check` ловит расхождение «источник →
 * производные» (state.json, SPEC.md, STATE.md, index.html). `npm run
 * check:episodic` (правило 12) сверяет закрытые фазы планов с записями в
 * episodic.md. Ни один из них не смотрит на ТЕКСТ решений и спек: там живут
 * утверждения вида «статус спеки — draft» или «перевод в approved — отдельный
 * шаг X», которые после перехода становятся ложью, при этом все файлы
 * сгенерированы, закоммичены и гейты зелёные.
 *
 * Правила (Layer 1):
 *   R1 SPEC-STALE  — индекс `.project/SPEC.md` отстал от frontmatter спек.
 *   R2 PLAN-DRAFT  — в «Решениях» `docs/C-PLAN.md` объявлен статус `draft`
 *                    для спеки, которая уже `approved`/`done`/`rejected`.
 *   R3 PLAN-STEP   — в спеке шаг `X` назван «отдельным», хотя `X` уже
 *                    присутствует записью в `.project/log.md` (шаг выполнен).
 *   R4 ORPHAN-SHA  — в спеке или плане указан SHA коммита, которого нет в
 *                    репозитории (перебазирование/history rewrite/spec 009).
 *
 * Формат вывода — ASCII, без emoji и без внешних зависимостей.
 * Exit codes: 0 — чисто, 1 — найдены findings, 2 — ошибка чтения.
 *
 * Запуск из корня репозитория (или с --root для fixture-проверок):
 *   node .project/scripts/check-consistency.mjs
 *   node .project/scripts/check-consistency.mjs --root <dir>
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/* --------------------------------------------------------------- paths */

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** `--root <dir>` — переопределение корня (fixture-прогоны, Pass 5). */
function resolveRoot() {
  const i = process.argv.indexOf('--root');
  if (i !== -1 && process.argv[i + 1]) return path.resolve(process.argv[i + 1]);
  if (process.env.CONSISTENCY_ROOT) return path.resolve(process.env.CONSISTENCY_ROOT);
  // .project/scripts/ → корень репозитория (спец-случай копии в шаблон фабрики).
  if (path.basename(path.dirname(HERE)) === '.project') return path.resolve(HERE, '..', '..');
  return process.cwd();
}

const ROOT = resolveRoot();
const rel = (p) => path.join(ROOT, p);

const SPECS_DIR = rel('.project/specs');
const SPEC_INDEX = rel('.project/SPEC.md');
const CPLAN = rel('docs/C-PLAN.md');
const LOG = rel('.project/log.md');

/* ---------------------------------------------------------- primitives */

const readTextSafe = (p) => {
  try {
    return fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
  } catch {
    return null;
  }
};

/** YAML-шапка: блок между первой парой `---`. Плоские `key: value`. */
function parseFrontmatter(text) {
  const lines = String(text).split('\n');
  if (!lines.length || lines[0].trim() !== '---') return {};
  const meta = {};
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i].trim() === '---') break;
    const m = /^([A-Za-z_][\w-]*)\s*:\s*(.*)$/.exec(lines[i]);
    if (m) meta[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return meta;
}

/** Все спеки каталога: id, slug, status, file, текст. */
function readSpecs(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const name of fs.readdirSync(dir).sort()) {
    if (!name.endsWith('.md') || name.toLowerCase() === 'readme.md') continue;
    const p = path.join(dir, name);
    const text = readTextSafe(p);
    if (text === null) throw new Error(`не читается: ${p}`);
    const meta = parseFrontmatter(text);
    out.push({
      id: meta.id || name.replace(/\.md$/, '').split('-')[0],
      slug: meta.slug || name.replace(/\.md$/, '').replace(/^\d+-/, ''),
      status: (meta.status || '').toLowerCase(),
      file: path.relative(ROOT, p).split(path.sep).join('/'),
      text,
    });
  }
  return out;
}

/** Индекс SPEC.md → Map(id → status). null — файла нет (не ошибка fixture). */
function readSpecIndex(file) {
  const text = readTextSafe(file);
  if (text === null) return null;
  const map = new Map();
  for (const line of text.split('\n')) {
    const m = /^\|\s*(\d+)\s*\|[^|]*\|[^|]*\|\s*([a-z_]+)\s*\|/.exec(line);
    if (m) map.set(m[1], m[2]);
  }
  return map;
}

/**
 * Секция «Решения …» из C-PLAN: строки от первого `## Решения…` до следующего `##`.
 * Возвращает [{ line, text }].
 */
function readCPlanDecisions(file) {
  const text = readTextSafe(file);
  if (text === null) return [];
  const lines = text.split('\n');
  const start = lines.findIndex((l) => /^##\s+Решения/i.test(l));
  if (start === -1) return [];
  const out = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    if (/^##\s+/.test(lines[i])) break;
    if (lines[i].trim() !== '') out.push({ line: i + 1, text: lines[i] });
  }
  return out;
}

/** Строки log.md (для проверки «шаг уже выполнен»). */
function readLogLines(file) {
  const text = readTextSafe(file);
  return text === null ? [] : text.split('\n');
}

/** Метка «снапшот уже снят» — снимает срабатывание R2/R3. */
const CLEARED_RE = /Снято|Обновлено|approved шагом|\[closed/i;

/** Проверка объекта git: true/false/null (null — git недоступен). */
const shaCache = new Map();
function isGitObject(sha) {
  if (shaCache.has(sha)) return shaCache.get(sha);
  const r = spawnSync('git', ['cat-file', '-t', sha], { cwd: ROOT, encoding: 'utf8' });
  const known = r.error ? null : r.status === 0;
  shaCache.set(sha, known);
  return known;
}

/* -------------------------------------------------------------- rules */

const findings = [];
const add = (rule, file, line, message) => findings.push({ rule, file, line, message });

/** R1: SPEC.md (индекс) отстал от frontmatter спек. */
function ruleSpecIndex(specs, index) {
  if (index === null) return;
  for (const s of specs) {
    const shown = index.get(s.id);
    if (shown === undefined || !s.status) continue;
    if (shown !== s.status) {
      add(
        'R1',
        path.relative(ROOT, SPEC_INDEX).split(path.sep).join('/'),
        0,
        `спека ${s.id} (${s.slug}): индекс показывает "${shown}", frontmatter — "${s.status}"`,
      );
    }
  }
}

/** R2: в «Решениях» C-PLAN спека названа draft, хотя она уже переведена. */
function rulePlanDraft(decisions, specs) {
  const byId = new Map(specs.map((s) => [s.id, s]));
  const file = path.relative(ROOT, CPLAN).split(path.sep).join('/');
  for (const { line, text } of decisions) {
    if (!/\bdraft\b/i.test(text)) continue;
    if (CLEARED_RE.test(text)) continue;
    for (const m of text.matchAll(/0(\d{2})|spec\s+(\d{3})|`(\d{3})/gi)) {
      const id = (m[1] || m[2] || m[3] || '').replace(/^0?(?=\d{2}$)/, '');
      const spec = byId.get(id) || byId.get(String(id).padStart(3, '0'));
      if (!spec) continue;
      if (spec.status && spec.status !== 'draft') {
        add('R2', file, line, `строка объявляет "${spec.slug}" (spec ${spec.id}) как draft, в спеке статус "${spec.status}"`);
      }
    }
  }
}

/** R3: «отдельный шаг X», хотя X уже отмечен в log.md. */
function rulePlanStep(specs, logLines) {
  const stepDone = (token) =>
    logLines.some((l) => new RegExp('^[^|]+\\|\\s*' + token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\|').test(l));
  for (const s of specs) {
    s.text.split('\n').forEach((text, i) => {
      if (CLEARED_RE.test(text)) return;
      // Первая альтернатива: «… — отдельный шаг C1-close.» (точка на конце — часть фразы,
      // поэтому токен обрезается по пунктуации ниже). Вторая: «C1-close — отдельный шаг».
      const m = /отдельный шаг\s+([\p{L}\p{N}][\p{L}\p{N}_.·-]*)|\b([A-Za-z][A-Za-z0-9]*-[a-z0-9][A-Za-z0-9-]*)\s+—\s+отдельный шаг/u.exec(text);
      if (!m) return;
      const token = String(m[1] || m[2]).replace(/[.·]+$/, '');
      if (!token || !stepDone(token)) return;
      add('R3', s.file, i + 1, `шаг "${token}" назван отдельным, но уже есть записью в log.md`);
    });
  }
}

/** R4: SHA коммита в спеке/плане, которого нет в репозитории. */
const SHA_RE = /`([0-9a-f]{7,40})`|\b(?:commit|коммит|HEAD)\s+`?([0-9a-f]{7,40})`?/gi;
function ruleOrphanSha(file, text) {
  const relFile = path.relative(ROOT, file).split(path.sep).join('/');
  text.split('\n').forEach((line, i) => {
    for (const m of line.matchAll(SHA_RE)) {
      const sha = m[1] || m[2];
      if (!sha || /^\d+$/.test(sha)) continue;
      if (isGitObject(sha) !== false) continue; // true — есть; null — git недоступен
      add('R4', relFile, i + 1, `SHA ${sha} отсутствует в репозитории`);
    }
  });
}

/* --------------------------------------------------------------- main */

function main() {
  try {
    const specs = readSpecs(SPECS_DIR);
    ruleSpecIndex(specs, readSpecIndex(SPEC_INDEX));
    rulePlanDraft(readCPlanDecisions(CPLAN), specs);
    rulePlanStep(specs, readLogLines(LOG));
    for (const s of specs) ruleOrphanSha(path.join(SPECS_DIR, s.file.split('/').pop()), s.text);
    const cplanText = readTextSafe(CPLAN);
    if (cplanText !== null) ruleOrphanSha(CPLAN, cplanText);
  } catch (e) {
    process.stdout.write(`consistency: read error — ${e.message}\n`);
    process.exitCode = 2;
    return;
  }

  if (findings.length === 0) {
    process.stdout.write('consistency: OK (0 findings)\n');
    process.exitCode = 0;
    return;
  }

  process.stdout.write(`consistency: ${findings.length} findings\n`);
  for (const f of findings) {
    const where = f.line > 0 ? `${f.file}:${f.line}` : f.file;
    process.stdout.write(`[${f.rule}] ${where}: ${f.message}\n`);
  }
  process.exitCode = 1;
}

main();
