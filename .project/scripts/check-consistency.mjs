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
 *   R5 SPEC-COMMIT — для спеки со статусом `done` каждая её completed-задача
 *                    имеет хотя бы один коммит с `spec-<id спеки>` и токеном
 *                    задачи (`tN`) в subject. Правило spec-gate (spec 034/B.1).
 *
 * R5 — источники и сопоставление (spec 034, задача t1):
 *
 *   Лист задач. `.agent-teams/<teamId>/team.json` — объект
 *   { name, id, members[], tasks[{ id, subject, status }] }. Допустимые статусы
 *   задач: pending / claimed / in_progress / completed / failed / cancelled.
 *   Обход рекурсивный по `.agent-teams/**` (глубина <= 4), поэтому
 *   архивированные команды (`.agent-teams/archive/<teamId>/team.json`)
 *   учитываются наравне с живыми.
 *
 *   Сопоставление teamId <-> spec id. Spec-ключ берётся из имени каталога
 *   команды: /^spec-([0-9a-z]+?)(?:-|$)/i — `spec-032-mas-autonomy-a` -> `032`,
 *   `spec-033a-mas-autonomy-spike` -> `033a`, `spec-034-mas-autonomy-b` -> `034`
 *   (fallback — поле `name` в team.json). Ключ привязывается к спеке из
 *   `.project/specs`, если он равен frontmatter `id` спеки ИЛИ равен `id` +
 *   буквенный суффикс (`033a` -> спека с `id: 033`; так закрывается фактическое
 *   расхождение: у `033a-mas-autonomy-spike.md` frontmatter `id: 033`, а
 *   каталог команды называется `spec-033a-...`).
 *   Команды без спеки, спеки без листа задач и спеки не в статусе `done`
 *   правило молча пропускает — findings не выдумываются.
 *
 *   Коммиты. `git log --all --format=%H%x00%s` (по всем ref, а не только HEAD):
 *   subject проверяется на `spec-<label>` (label — frontmatter id или spec-ключ
 *   команды) без склейки с буквенно-цифровым хвостом (`spec-999a` != `spec-999`)
 *   и на токен задачи как отдельное слово (`\bt1\b`, поэтому `t1` не
 *   схлопывается с `t10`). Требуется ХОТЯ БЫ ОДИН
 *   коммит — multi-commit задачи допустимы; «чужие» записи в subject безвредны,
 *   так как проверяется наличие своей записи, а не отсутствие посторонних
 *   (alerts 2026-09-30: параллельный writer может вклиниться между чтением
 *   файла и `git add` — на такой шум гейт падать не должен).
 *
 *   Whitelist R5_WHITELIST ниже — адресный, каждая запись обязана нести
 *   `reason`. Blanket-skip (отключение R5 целиком) и «пустое» правило
 *   запрещены: fixture-прогон через `--root <dir>` доказывает невакуумность.
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

/* --------------------------------------------------------- R5 whitelist */

/**
 * R5 SPEC-COMMIT whitelist — адресные исключения, у каждого обязателен `reason`.
 * Запись без reason останавливает правило (exit 2), а не пропускает проверку
 * молча. Исключения бывают только двух видов:
 *   kind: 'task-status' — статус задачи, для которого коммит не требуется;
 *   kind: 'spec'        — конкретная спека (legacy-прогон), `aliases` — её
 *                         spec-ключи/ид, встречающиеся в именах каталогов.
 */
const R5_WHITELIST = [
  {
    kind: 'task-status',
    status: 'cancelled',
    reason: 'cancelled — работа отменена до исполнения: изменений в репозитории нет, коммита быть не может',
  },
  {
    kind: 'spec',
    spec: '032',
    aliases: [],
    reason: 'legacy-прогон до появления R5 (spec-032 закрыта коммитом 2539526 "feat(spec-032): order-manifest ..."): коммиты нумеровались по спеке, токенов задач tN в subject нет',
  },
  {
    kind: 'spec',
    spec: '033',
    aliases: ['033a'],
    reason: 'legacy-прогон до появления R5 (spec 033a, каталог spec-033a-mas-autonomy-spike, закрыта коммитом f43b060 "feat(spec-033a): run-spec.mjs ..."): коммиты не нумеровались по задачам',
  },
];

/* -------------------------------------------------------- R5 primitives */

const TEAMS_DIR = rel('.agent-teams');

/** Экранирование литерала для RegExp. */
const escRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Рекурсивный поиск `team.json` под `.agent-teams` (archive/** — включительно). */
function readTeamListFiles(dir, depth = 0) {
  if (depth > 4 || !fs.existsSync(dir)) return [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    throw new Error(`не читается: ${dir} (${e.code || e.message})`);
  }
  const out = [];
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...readTeamListFiles(p, depth + 1));
    else if (e.name === 'team.json') out.push(p);
  }
  return out.sort();
}

/** Spec-ключ из имени каталога команды: `spec-033a-mas-autonomy-spike` -> `033a`. */
function specKeyOf(name) {
  const m = /^spec-([0-9a-z]+?)(?:-|$)/i.exec(String(name || ''));
  return m ? m[1].toLowerCase() : null;
}

/** Привязка spec-ключа команды к спеке: `034` -> spec 034, `033a` -> spec 033. */
function specOfKey(specs, key) {
  if (!key) return null;
  for (const s of specs) {
    const id = String(s.id).toLowerCase();
    if (!id) continue;
    if (key === id) return s;
    if (key.startsWith(id) && /^[a-z]+$/.test(key.slice(id.length))) return s;
  }
  return null;
}

/** Лист задач команды: { file, key, tasks[] }. Битый JSON/нет файла — ошибка чтения. */
function readTeamList(file) {
  const text = readTextSafe(file);
  if (text === null) throw new Error(`не читается: ${file}`);
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new Error(`team.json не парсится: ${file} (${e.message})`);
  }
  const dirName = path.basename(path.dirname(file));
  const named = typeof data?.name === 'string' ? data.name : '';
  return {
    file: path.relative(ROOT, file).split(path.sep).join('/'),
    key: specKeyOf(dirName) || specKeyOf(named),
    tasks: Array.isArray(data?.tasks) ? data.tasks : [],
  };
}

/** Задача исключена по whitelist (статус). */
const r5TaskExempt = (task) =>
  R5_WHITELIST.some(
    (w) => w.kind === 'task-status' && w.status === String(task?.status || '').toLowerCase(),
  );

/** Спека исключена по whitelist (legacy-прогон); сверяются id спеки и spec-ключ команды. */
function r5SpecExempt(spec, key) {
  const labels = [String(spec.id).toLowerCase(), String(key || '').toLowerCase()];
  return R5_WHITELIST.some(
    (w) =>
      w.kind === 'spec' &&
      [w.spec, ...(Array.isArray(w.aliases) ? w.aliases : [])].some((x) =>
        labels.includes(String(x || '').toLowerCase()),
      ),
  );
}

/** Валидация whitelist: каждая запись объяснена, kind известен. */
function validateR5Whitelist() {
  for (const w of R5_WHITELIST) {
    if (!w || typeof w.reason !== 'string' || w.reason.trim() === '') {
      throw new Error('R5 whitelist: запись без reason — исключение обязано объясняться');
    }
    if (w.kind !== 'task-status' && w.kind !== 'spec') {
      throw new Error(`R5 whitelist: неизвестный kind "${w.kind}"`);
    }
  }
}

/** Subjects коммитов репозитория. null — git недоступен/нет истории (правило молчит, как R4). */
let commitCache;
function readCommitSubjects() {
  if (commitCache !== undefined) return commitCache;
  const r = spawnSync('git', ['log', '--all', '--format=%H%x00%s'], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (r.error || r.status !== 0) {
    commitCache = null;
    return commitCache;
  }
  commitCache = String(r.stdout)
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const i = l.indexOf('\u0000');
      return { sha: i === -1 ? l : l.slice(0, i), subject: i === -1 ? '' : l.slice(i + 1) };
    });
  return commitCache;
}

/** R5: completed-задача спеки в статусе done без коммита `spec-<id>` + `tN`. */
function ruleSpecCommit(specs, teamLists) {
  const commits = readCommitSubjects();
  if (commits === null) return;
  for (const team of teamLists) {
    const spec = specOfKey(specs, team.key);
    if (!spec) continue; // команда без спеки — молча
    if (spec.status !== 'done') continue; // проверяются только закрытые спеки
    if (r5SpecExempt(spec, team.key)) continue; // legacy-прогон (whitelist + reason)
    const labels = [...new Set([String(spec.id), String(team.key || '')].filter(Boolean))];
    for (const task of team.tasks) {
      if (r5TaskExempt(task)) continue; // cancelled и прочие исключённые статусы
      if (String(task?.status || '').toLowerCase() !== 'completed') continue;
      const id = String(task?.id || '').trim();
      if (!id) continue;
      const covered = commits.some(
        ({ subject }) =>
          labels.some((l) => new RegExp(`\\bspec-${escRe(l)}(?![a-z0-9])`, 'i').test(subject)) &&
          new RegExp(`\\b${escRe(id)}\\b`).test(subject),
      );
      if (covered) continue;
      add(
        'R5',
        spec.file,
        0,
        `спека ${spec.id} (${spec.slug}) в статусе done: задача ${id} (completed) без коммита — нет subject с "spec-${labels[0]}" и токеном "${id}" (лист задач: ${team.file})`,
      );
    }
  }
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
    validateR5Whitelist();
    ruleSpecCommit(specs, readTeamListFiles(TEAMS_DIR).map(readTeamList));
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
