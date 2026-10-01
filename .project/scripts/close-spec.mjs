// close-spec.mjs — закрытие спеки одной командой (spec 038 «close-spec-automation»).
//
// Назначение: заменить ручную closing-фазу (8–10 детерминированных шагов) одной
// командой. Node ESM, zero-deps: только встроенные модули `node:*`.
//
// Спека — источник истины: `.project/specs/038-close-spec-automation.md`.
// Декомпозиция спеки (шаги 1–4, 12 / шаги 5–11, 13):
//   t1 (эта часть) — CLI, резолв спеки по frontmatter, поиск team.json, проверка
//                    reviewer-вердикта, извлечение task tokens и полный скелет
//                    `--dry-run` для шагов 5–11 (печать плана, ноль мутаций);
//   t2 (SEAM ниже) — исполнение шагов 5–11: R5-trace, frontmatter, episodic, log,
//                    commit-chain (задача + converge), `npm run sync:check`,
//                    `--refresh-working` и npm-скрипт `spec:close` в package.json.
//
// Использование:
//   node .project/scripts/close-spec.mjs <spec-id> [--dry-run] [--refresh-working] [--json]
//   node .project/scripts/close-spec.mjs <spec-id> --dry-run --repo-root <dir>
//   node .project/scripts/close-spec.mjs --help
//   npm run spec:close -- <spec-id> --dry-run        (npm-скрипт — шаг 13, задача t2)
//
// `--repo-root` — корень репозитория (по умолчанию — корень этого скрипта, т.е.
// `<root>/.project/scripts/close-spec.mjs`). Нужен для критерия 3 спеки: dry-run
// на фейковой approved-спеке в отдельном `git worktree`, где самого скрипта ещё
// нет (файл не в HEAD) — скрипт запускается из основного дерева, а дерево-цель
// указывается флагом.
//
// Коды выхода (см. § Edge Cases спеки 038):
//   0 — успех, в том числе no-op `WARN: already done` (спека уже `done`) — дерево
//       не изменяется;
//   1 — неожиданная ошибка ввода-вывода или повреждённые данные (каталог спек
//       недоступен, team.json не разбирается как JSON);
//   2 — STOP: закрывать нельзя — spec-id неоднозначен, status не `approved`,
//       reviewer-вердикт != `pass`, reviewer-задача отсутствует, а также режим
//       применения, пока шаги 5–11 не реализованы (t2);
//   3 — precondition-missing: спеки нет в `.project/specs/`, команды нет
//       (`.agent-teams/**/spec-<id>*/team.json` не найден).
//
// Инварианты:
//   * `--dry-run` не делает НИ ОДНОЙ мутации: ни `git add/commit`, ни
//     `npm run sync`, ни записи файлов — только печать плана шагов 5–11.
//   * Весь git — только read-only вербы (см. GIT_READ_VERBS).
//   * Все записи файлов — через `node:fs` с явным `\n` (правило 16), см.
//     writeTextLf()/appendTextLf() — этими хелперами обязаны пользоваться шаги
//     6–8 и 11 (t2).

import fsp from 'node:fs/promises';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/* ------------------------------------------------------------ константы */

const SCRIPT_FILE = fileURLToPath(import.meta.url);

/** Корень репозитория: `<repo>/.project/scripts/close-spec.mjs`. */
export const REPO_ROOT = path.resolve(path.dirname(SCRIPT_FILE), '..', '..');

/** Относительные пути значимых артефактов closing-фазы. */
export const PATHS = {
  specs: '.project/specs',
  teams: '.agent-teams',
  archive: 'archive',
  episodic: 'docs/memory/episodic.md',
  working: 'docs/memory/working.md',
  log: '.project/log.md',
  packageJson: 'package.json',
  syncScript: '.project/sync.mjs',
  specIndex: '.project/SPEC.md',
  stateMd: '.project/STATE.md',
  state: '.project/state.json',
  center: 'docs/index.html',
};

/** Роли, задача которых считается ревью (spec 034/036/037/038-прогоны: `reviewer`, `qc`). */
export const REVIEWER_ROLES = new Set(['reviewer', 'qc']);

/** Вердикты, которые останавливают закрытие (всё, кроме `pass`). */
export const PASS_VERDICT = 'pass';

/** Максимальная глубина обхода `.agent-teams` (команды лежат на 1–2 уровнях, archive/**). */
const TEAMS_MAX_DEPTH = 4;

/**
 * Git-вербы, допустимые в этом скрипте (t1: только чтение). Всё, что меняет
 * индекс/историю/удалённый репозиторий, обязано идти через процедуру t2 с
 * явным решением, а не через runGitRead().
 */
const GIT_READ_VERBS = new Set(['log', 'rev-parse', 'status', 'diff', 'show', 'branch']);

/**
 * Шум, который не может быть «feat-SHA» спеки: closing- и учётные коммиты
 * (R5-trace, converge, authorize push, approve/draft/decisions, `done -`, run log).
 */
const FEAT_SHA_NOISE_RE = /R5 trace|converge|authorize|\bpush\b|done\s*-|draft|approve|decisions|closure|run log/i;

/** Сколько последних коммитов просматривается при поиске кандидата feat-SHA. */
const FEAT_SHA_SCAN = 400;

/**
 * Производные артефакты, которые перегенерирует `node .project/sync.mjs`
 * (шаг 9 спеки: `sync → add → commit`). Выписаны явно, чтобы converge-коммит
 * не мог затянуть в индекс чужую правку дерева.
 */
export const DERIVED_PATHS = [PATHS.specIndex, PATHS.stateMd, PATHS.state, PATHS.center];

/** Коды выхода, как в § Edge Cases спеки 038 (см. шапку файла). */
export const EXIT = { ok: 0, ioError: 1, stop: 2, preconditionMissing: 3 };

export const USAGE = [
  'usage: node .project/scripts/close-spec.mjs <spec-id> [--dry-run] [--refresh-working] [--json]',
  '       node .project/scripts/close-spec.mjs <spec-id> --dry-run --repo-root <dir>',
  '       npm run spec:close -- <spec-id> [--dry-run] [--refresh-working] [--json]',
  '       node .project/scripts/close-spec.mjs --help',
  '',
  '  <spec-id>           id спеки (frontmatter `id` в .project/specs/<id>-<slug>.md), например 038',
  '  --dry-run           напечатать план шагов 5–11 и выйти; мутаций нет (git/npm/файлы не трогаются)',
  '  --refresh-working   запланировать/выполнить обновление docs/memory/working.md (шаг 11 спеки)',
  '  --repo-root <dir>   корень репозитория вместо корня скрипта (для dry-run в git worktree)',
  '  --json              машинный отчёт (JSON) в stdout',
  '  -h, --help          эта справка',
  '',
  'Коды выхода: 0 — успех (в т.ч. no-op «already done» / идемпотентный повтор);',
  '             1 — ошибка ввода-вывода или git/npm; 2 — STOP (вердикт != pass, гейт != 0, чужая правка дерева);',
  '             3 — precondition-missing (нет спеки или команды).',
].join('\n');

/* --------------------------------------- Telegram-уведомления (spec 042/T2) */

/** Ядро уведомлений (spec 042/T1). */
const NOTIFY_SCRIPT = path.join(REPO_ROOT, '.project', 'scripts', 'notify.mjs');

/**
 * Fire-and-forget Telegram-уведомление (spec 042/T2). Никогда не бросает, не
 * блокирует родителя, ничего не пишет в stdout парсеров и не влияет на
 * exit-код: дочерний процесс detached + unref, его вывод не читается
 * (`stdio: 'ignore'`). Сбой Telegram не ломает прогон закрытия.
 */
function notifyFireAndForget(event, message) {
  try {
    const child = spawn(process.execPath, [NOTIFY_SCRIPT, message, '--event', event], {
      cwd: REPO_ROOT,
      stdio: 'ignore',
      windowsHide: true,
      detached: true,
    });
    child.on('error', () => {});
    child.unref();
  } catch {
    /* уведомление не должно ломать прогон */
  }
}

/* --------------------------------------------------- хелперы I/O и EOL */

/** Код ошибки ввода-вывода (`ENOENT`, `EACCES`, …) или `UNKNOWN`. */
function errorCodeOf(error) {
  const code = error && typeof error === 'object' ? error.code : undefined;
  return typeof code === 'string' ? code : 'UNKNOWN';
}

/** Чтение текста с нормализацией EOL: CRLF/CR → LF (правило 16). */
export async function readTextLf(file) {
  const raw = await fsp.readFile(file, 'utf8');
  return String(raw).replace(/\r\n?/g, '\n');
}

/** Текст с явным `\n`, гарантированным финальным переводом строки (правило 16). */
export function normalizeLf(text) {
  const body = String(text).replace(/\r\n?/g, '\n');
  return body.endsWith('\n') ? body : `${body}\n`;
}

/**
 * Запись файла через `node:fs` с явным `\n` (правило 16). Используется шагами
 * 6 (frontmatter) и 11 (working.md) — задача t2; в t1 вызывается только тестами.
 */
export async function writeTextLf(file, text) {
  await fsp.mkdir(path.dirname(file), { recursive: true });
  await fsp.writeFile(file, normalizeLf(text), 'utf8');
}

/**
 * Дозапись в append-only файлы (`docs/memory/episodic.md`, `.project/log.md`)
 * с явным `\n` и без потери финального перевода строки предыдущего содержимого
 * (правило 16). Используется шагами 7–8 — задача t2.
 */
export async function appendTextLf(file, text) {
  let existing = '';
  try {
    existing = await fsp.readFile(file, 'utf8');
  } catch (error) {
    if (errorCodeOf(error) !== 'ENOENT') throw error;
  }
  const head = existing === '' || existing.endsWith('\n') ? existing : `${existing}\n`;
  await fsp.writeFile(file, head + normalizeLf(text), 'utf8');
}

/** Последний сегмент пути в POSIX-форме (для отчётов). */
const toPosix = (value) => String(value).split(path.sep).join('/');

/** Относительный путь от корня репозитория; вне репозитория — абсолютный. */
function relToRoot(root, target) {
  const rel = path.relative(root, target);
  if (rel === '') return '.';
  return rel.startsWith('..') ? toPosix(target) : toPosix(rel);
}

/** Экранирование литерала для RegExp. */
const escapeRe = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Локальная дата `YYYY-MM-DD` (формат строк log.md/episodic.md). */
export function formatLocalDate(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Естественное сравнение id задач: `t1 < t2 < … < t10`. */
export function naturalCompare(a, b) {
  const parts = (value) => String(value).match(/\d+|\D+/g) ?? [];
  const left = parts(a);
  const right = parts(b);
  const size = Math.max(left.length, right.length);
  for (let index = 0; index < size; index += 1) {
    const x = left[index];
    const y = right[index];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    const nx = /^\d+$/.test(x) ? Number(x) : null;
    const ny = /^\d+$/.test(y) ? Number(y) : null;
    if (nx !== null && ny !== null) {
      if (nx !== ny) return nx - ny;
      continue;
    }
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

/* ------------------------------------------------------------- CLI (шаг 1) */

const DEFAULTS = {
  specId: null,
  dryRun: false,
  refreshWorking: false,
  json: false,
  repoRoot: null,
};

/**
 * Разбор argv. Возвращает `{ ok: true, options }` либо `{ ok: false, error }`
 * (`error === 'help'` — запрошена справка, это не ошибка).
 */
export function parseArgs(argv) {
  const options = { ...DEFAULTS };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const [flag, inline] = arg.startsWith('--') ? arg.split('=', 2) : [arg, undefined];
    const takeValue = () => {
      if (inline !== undefined) return inline;
      index += 1;
      return argv[index];
    };
    if (arg === '-h' || flag === '--help') return { ok: false, error: 'help' };
    if (!arg.startsWith('--')) {
      if (options.specId !== null) return { ok: false, error: `лишний аргумент: ${arg}` };
      options.specId = arg;
      continue;
    }
    switch (flag) {
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--refresh-working':
        options.refreshWorking = true;
        break;
      case '--json':
        options.json = true;
        break;
      case '--repo-root': {
        const value = takeValue();
        if (value === undefined || value === '') return { ok: false, error: 'флаг --repo-root требует каталог' };
        options.repoRoot = value;
        break;
      }
      default:
        return { ok: false, error: `неизвестный флаг: ${flag}` };
    }
  }
  if (options.specId === null) return { ok: false, error: 'не задан <spec-id>' };
  const normalized = options.specId.replace(/\.md$/i, '').trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(normalized)) {
    return { ok: false, error: `недопустимый <spec-id>: ${options.specId}` };
  }
  options.specId = normalized;
  return { ok: true, options };
}

/* --------------------------------------------- резолв спеки (шаг 2 спеки) */

/**
 * Разбор markdown: frontmatter (`--- … ---`), H1, строки. Зависимостей нет,
 * парсер намеренно минимальный (совместим с `parseSpec()` в run-spec.mjs).
 */
export function parseSpecMarkdown(raw) {
  const lines = String(raw).replace(/\r\n?/g, '\n').split('\n');
  const fm = {};
  let closed = false;
  if (lines[0] !== undefined && lines[0].trim() === '---') {
    for (let index = 1; index < lines.length; index += 1) {
      const line = lines[index];
      if (line.trim() === '---') {
        closed = true;
        break;
      }
      const match = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
      if (match !== null) fm[match[1].toLowerCase()] = match[2].trim().replace(/^["']|["']$/g, '');
    }
  }
  let h1 = '';
  for (const line of lines) {
    if (line.startsWith('# ')) {
      h1 = line.slice(2).trim();
      break;
    }
  }
  return { fm, hasFrontmatter: closed, h1 };
}

/** Короткое имя спеки для subject'ов/строк лога: `Спека 038 — X` → `X`. */
export function shortSpecTitle(spec) {
  const h1 = String(spec.title ?? '').trim();
  const stripped = h1.replace(/^Спека\s+\S+\s*[—–-]\s*/, '').trim();
  return stripped !== '' ? stripped : h1 !== '' ? h1 : String(spec.slug ?? spec.id);
}

/**
 * Найти файл спеки в `specsDir`. Приоритет — frontmatter `id` (шаг 2 спеки);
 * если frontmatter-совпадений нет, допускается совпадение по имени файла
 * (`<id>.md`, `<id>-<slug>.md`) с предупреждением. Неоднозначность — STOP (2),
 * отсутствие спеки — precondition-missing (3).
 */
export async function resolveSpec(specsDir, specIdRaw) {
  const id = String(specIdRaw ?? '').replace(/\.md$/i, '').trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(id)) {
    return { ok: false, exitCode: 2, error: `недопустимый spec-id: ${specIdRaw}` };
  }
  let entries;
  try {
    entries = await fsp.readdir(specsDir, { withFileTypes: true });
  } catch (error) {
    const code = errorCodeOf(error);
    if (code === 'ENOENT') {
      return { ok: false, exitCode: 3, error: `каталог спек не найден: ${specsDir}` };
    }
    return { ok: false, exitCode: 1, error: `каталог спек недоступен: ${specsDir} (${code})` };
  }
  const names = entries
    .filter((entry) => entry.isFile() && /\.md$/i.test(entry.name))
    .map((entry) => entry.name)
    .filter((name) => name.toLowerCase() !== 'readme.md')
    .sort((a, b) => a.localeCompare(b));

  const parsed = [];
  for (const name of names) {
    const file = path.join(specsDir, name);
    let raw;
    try {
      raw = await fsp.readFile(file, 'utf8');
    } catch (error) {
      const code = errorCodeOf(error);
      if (code === 'ENOENT') continue; // файл исчез между readdir и read — пропускаем
      return { ok: false, exitCode: 1, error: `спека не читается: ${name} (${code})` };
    }
    const { fm, hasFrontmatter, h1 } = parseSpecMarkdown(raw);
    parsed.push({ name, file, fm, hasFrontmatter, h1, bytes: Buffer.byteLength(raw, 'utf8') });
  }

  const lower = id.toLowerCase();
  const byFrontmatter = parsed.filter((item) => String(item.fm.id ?? '').toLowerCase() === lower);
  let picked;
  let matchedBy;
  if (byFrontmatter.length === 1) {
    picked = byFrontmatter[0];
    matchedBy = 'frontmatter';
  } else if (byFrontmatter.length > 1) {
    return {
      ok: false,
      exitCode: 2,
      error: `spec-id "${id}" неоднозначен по frontmatter: ${byFrontmatter.map((item) => item.name).join(', ')}`,
    };
  } else {
    const byName = parsed.filter((item) => item.name.toLowerCase() === `${lower}.md` || item.name.toLowerCase().startsWith(`${lower}-`));
    if (byName.length === 0) {
      return {
        ok: false,
        exitCode: 3,
        error: `спека "${id}" не найдена в ${specsDir}`,
        hint: `доступны: ${parsed.map((item) => item.name.replace(/\.md$/, '')).join(', ')}`,
      };
    }
    if (byName.length > 1) {
      return {
        ok: false,
        exitCode: 2,
        error: `spec-id "${id}" неоднозначен по имени файла: ${byName.map((item) => item.name).join(', ')}`,
      };
    }
    picked = byName[0];
    matchedBy = 'filename';
  }

  const spec = {
    id,
    file: picked.name,
    path: picked.file,
    relativePath: relToRoot(path.dirname(specsDir), picked.file),
    fmId: picked.fm.id ?? null,
    slug: picked.fm.slug ?? null,
    type: picked.fm.type ?? null,
    status: picked.fm.status ?? null,
    commit: picked.fm.commit ?? null,
    title: picked.h1,
    matchedBy,
    bytes: picked.bytes,
  };
  return { ok: true, spec };
}

/* ------------------------------ поиск team.json (шаг 3 спеки, корень+archive) */

async function statOrNull(target) {
  try {
    return await fsp.stat(target);
  } catch (error) {
    if (errorCodeOf(error) === 'ENOENT') return null;
    throw error;
  }
}

/** Recursive-обход каталога команд: каталоги, чьё имя = `spec-<id>…`, с team.json. */
async function collectTeamCandidates(dir, rel, depth, pattern, spec, found) {
  if (depth > TEAMS_MAX_DEPTH) return;
  let entries;
  try {
    entries = await fsp.readdir(dir, { withFileTypes: true });
  } catch (error) {
    const code = errorCodeOf(error);
    if (code === 'ENOENT') return;
    throw error;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const abs = path.join(dir, entry.name);
    const childRel = rel === '' ? entry.name : `${rel}/${entry.name}`;
    if (pattern.test(entry.name)) {
      const file = path.join(abs, 'team.json');
      const stat = await statOrNull(file);
      if (stat !== null) {
        const expected = spec.slug === null ? null : `spec-${spec.id}-${spec.slug}`.toLowerCase();
        found.push({
          dir: abs,
          rel: childRel,
          file,
          fileRel: `${childRel}/team.json`,
          archived: childRel.split('/').includes(PATHS.archive),
          exactSlug: expected !== null && entry.name.toLowerCase() === expected,
          mtimeMs: stat.mtimeMs,
        });
      }
    }
    await collectTeamCandidates(abs, childRel, depth + 1, pattern, spec, found);
  }
}

/**
 * Найти `team.json` команды спеки: каталог `.agent-teams` (корень и `archive/`,
 * рекурсивно) → любой подкаталог с именем `spec-<id>…`, содержащий team.json.
 * Приоритет: живой каталог (не archive) → точное совпадение `spec-<id>-<slug>`
 * → свежий team.json → путь.
 */
export async function findTeamJson(teamsDir, spec) {
  const pattern = new RegExp(`^spec-${escapeRe(spec.id)}(?![0-9])`, 'i');
  const found = [];
  try {
    await collectTeamCandidates(teamsDir, '', 0, pattern, spec, found);
  } catch (error) {
    return { ok: false, exitCode: 1, error: `каталог команд недоступен: ${toPosix(teamsDir)} (${errorCodeOf(error)})` };
  }
  found.sort(
    (a, b) =>
      Number(a.archived) - Number(b.archived) ||
      Number(b.exactSlug) - Number(a.exactSlug) ||
      b.mtimeMs - a.mtimeMs ||
      a.rel.localeCompare(b.rel),
  );
  if (found.length === 0) {
    return {
      ok: false,
      exitCode: 3,
      error: `team.json не найден: ${toPosix(teamsDir)}/**/spec-${spec.id}*/team.json`,
      hint: 'precondition-missing: команда AgentTeams по этой спеке отсутствует (или каталог команд ещё не создан)',
      candidates: [],
    };
  }
  return { ok: true, picked: found[0], candidates: found };
}

/** Чтение `team.json`. Битый JSON — это данные, а не отсутствие (exit 1). */
export async function readTeamJson(file) {
  let raw;
  try {
    raw = await fsp.readFile(file, 'utf8');
  } catch (error) {
    return { ok: false, error: `team.json не читается: ${toPosix(file)} (${errorCodeOf(error)})` };
  }
  let data;
  try {
    data = JSON.parse(raw);
  } catch (error) {
    return { ok: false, error: `team.json не разбирается как JSON: ${toPosix(file)} (${error instanceof Error ? error.message : String(error)})` };
  }
  return {
    ok: true,
    data,
    name: typeof data?.name === 'string' ? data.name : null,
    members: Array.isArray(data?.members) ? data.members : [],
    tasks: Array.isArray(data?.tasks) ? data.tasks : [],
  };
}

/** Spec-ключ из имени каталога команды: `spec-033a-mas-autonomy-spike` → `033a`. */
export function teamSpecKey(teamRef) {
  const base = String(teamRef?.rel ?? '').split('/').pop() ?? '';
  const match = /^spec-([0-9a-z]+?)(?:-|$)/i.exec(base);
  return match === null ? null : match[1].toLowerCase();
}

/* ------------------- проверка verdict=pass и извлечение токенов (шаг 4) */

/** Вердикт задачи: структурное поле `verdict`, иначе — текст отчёта (fallback). */
export function readTaskVerdict(task) {
  const field = typeof task?.verdict === 'string' ? task.verdict.trim() : '';
  if (field !== '') return { verdict: field.toLowerCase(), source: 'field' };
  const output = typeof task?.output === 'string' ? task.output : '';
  const match = /\bverdict\s*[:=]\s*\**\s*(pass|passed|fail|failed|needs_revision|reject)\b/i.exec(output);
  if (match === null) return { verdict: null, source: null };
  return { verdict: match[1].toLowerCase(), source: 'output' };
}

/**
 * Проверка reviewer-вердикта. Ревьюер — задача, чей assignee имеет роль
 * `reviewer` (или `qc` — роль в прогонах spec 034/036). Решение принимает
 * финальная ревью-задача: с вердиктом `pass` и максимумом зависимостей.
 */
export function checkReviewVerdict(team) {
  const roleByName = new Map();
  for (const member of team.members) {
    if (member && typeof member.name === 'string') {
      roleByName.set(member.name.toLowerCase(), String(member.role ?? '').toLowerCase());
    }
  }
  const reviewerTasks = team.tasks
    .map((task, index) => ({
      task,
      index,
      id: String(task?.id ?? '').trim(),
      assignee: typeof task?.assignee === 'string' ? task.assignee : null,
      role: roleByName.get(String(task?.assignee ?? '').toLowerCase()) ?? null,
      deps: Array.isArray(task?.dependencies) ? task.dependencies.length : 0,
      ...readTaskVerdict(task),
    }))
    .filter((row) => row.role !== null && REVIEWER_ROLES.has(row.role));

  const summary = {
    candidates: reviewerTasks.map((row) => ({ id: row.id, assignee: row.assignee, role: row.role, verdict: row.verdict })),
    taskId: null,
    assignee: null,
    role: null,
    verdict: null,
    source: null,
  };

  if (reviewerTasks.length === 0) {
    return {
      ok: false,
      reason: 'reviewer-task-missing',
      message: 'reviewer-задача не найдена (нет задачи с assignee роли reviewer/qc)',
      details: [`роли в команде: ${[...new Set(roleByName.values())].join(', ') || '—'}`, `задачи: ${team.tasks.map((task) => `${task?.id ?? '?'}:${task?.assignee ?? '—'}`).join(', ') || '—'}`],
      summary,
    };
  }

  const byDeps = (a, b) => b.deps - a.deps || b.index - a.index;
  const passed = reviewerTasks.filter((row) => row.verdict === PASS_VERDICT).sort(byDeps);
  const decisive = (passed.length > 0 ? passed[0] : [...reviewerTasks].sort(byDeps)[0]);
  Object.assign(summary, {
    taskId: decisive.id,
    assignee: decisive.assignee,
    role: decisive.role,
    verdict: decisive.verdict,
    source: decisive.source,
  });

  if (decisive.verdict === PASS_VERDICT) {
    return { ok: true, summary, decisive };
  }
  const verdictText = decisive.verdict ?? 'отсутствует (задача ещё не завершена?)';
  return {
    ok: false,
    reason: decisive.verdict === null ? 'verdict-missing' : 'verdict-not-pass',
    message: `reviewer-задача ${decisive.id || '—'} (${decisive.role}/${decisive.assignee ?? '—'}): verdict=${verdictText} — ожидался ${PASS_VERDICT}`,
    details: [
      `статус задачи: ${decisive.task?.status ?? '—'}`,
      `ревью-задачи: ${reviewerTasks.map((row) => `${row.id}=${row.verdict ?? '—'}`).join(', ')}`,
    ],
    summary,
  };
}

/**
 * Извлечь task tokens для R5-trace: id completed-задач (в cancelled-задачах
 * коммита быть не может, R5 их не требует — whitelist check-consistency.mjs).
 * Порядок — естественный (`t1 t2 … t10`).
 */
export function extractTaskTokens(tasks) {
  const rows = tasks
    .map((task, index) => ({
      id: String(task?.id ?? '').trim(),
      status: String(task?.status ?? '').toLowerCase(),
      index,
    }))
    .filter((row) => row.id !== '')
    .sort((a, b) => naturalCompare(a.id, b.id) || a.index - b.index);
  const idsOf = (predicate) => rows.filter(predicate).map((row) => row.id);
  return {
    ordered: rows.map((row) => row.id),
    completed: idsOf((row) => row.status === 'completed'),
    cancelled: idsOf((row) => row.status === 'cancelled'),
    open: idsOf((row) => row.status !== 'completed' && row.status !== 'cancelled').map((id) => {
      const row = rows.find((item) => item.id === id);
      return `${id}:${row.status === '' ? '?' : row.status}`;
    }),
  };
}

/* --------------------- read-only git: кандидат feat-SHA для шага 6 спеки */

/** Выполнить read-only git-команду. Write-вербы отвергаются до запуска. */
export function runGitRead(root, args) {
  const verb = String(args[0] ?? '');
  if (!GIT_READ_VERBS.has(verb)) {
    return { ok: false, error: `git ${verb} не является read-only вербом (${[...GIT_READ_VERBS].join(', ')})` };
  }
  const result = spawnSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.error) return { ok: false, error: `git недоступен: ${result.error.message}` };
  if (result.status !== 0) {
    const stderr = String(result.stderr ?? '').trim().split('\n')[0];
    return { ok: false, error: `git ${verb} → exit ${result.status}${stderr === '' ? '' : ` (${stderr})`}` };
  }
  return { ok: true, stdout: String(result.stdout ?? '') };
}

/** Метки спеки: id из frontmatter + spec-ключ каталога команды (`033` + `033a`). */
export function specLabels(spec, teamRef) {
  const key = teamSpecKey(teamRef);
  return [...new Set([String(spec.id), key].filter((value) => value !== null && value !== ''))];
}

/**
 * Предварительный выбор `commit:` для frontmatter (шаг 6 спеки) — read-only
 * подсказка для плана:
 *   A) свежайший `feat|fix|refactor|perf|test(spec-<label>)` — коммит реализации;
 *   B) иначе свежайший `docs(spec-<label>):` без closing-шума (draft/approve/
 *      `done -`/decisions/closure/run log) — коммит-артефакт спеки.
 * Финальную логику шага 6 (и подтверждение SHA после коммита задачи) держит t2.
 */
export function resolveFeatSha(root, labels) {
  const log = runGitRead(root, ['log', `-n${FEAT_SHA_SCAN}`, '--format=%H%x00%s']);
  if (!log.ok) return { ok: false, sha: null, subject: null, kind: null, error: log.error, scanned: 0 };
  const rows = log.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const split = line.indexOf('\u0000');
      return split === -1 ? { sha: line, subject: '' } : { sha: line.slice(0, split), subject: line.slice(split + 1) };
    });
  const alt = labels.map((label) => escapeRe(label)).join('|');
  if (alt === '') return { ok: true, sha: null, subject: null, kind: null, error: null, scanned: rows.length };
  const implRe = new RegExp(`^(?:feat|fix|refactor|perf|test)\\(spec-(?:${alt})\\)`, 'i');
  const contentRe = new RegExp(`^docs\\(spec-(?:${alt})\\):`, 'i');
  const impl = rows.find((row) => implRe.test(row.subject));
  if (impl !== undefined) return { ok: true, sha: impl.sha, subject: impl.subject, kind: 'impl', error: null, scanned: rows.length };
  const content = rows.find((row) => contentRe.test(row.subject) && !FEAT_SHA_NOISE_RE.test(row.subject));
  if (content !== undefined) return { ok: true, sha: content.sha, subject: content.subject, kind: 'content', error: null, scanned: rows.length };
  return { ok: true, sha: null, subject: null, kind: null, error: null, scanned: rows.length };
}

/* --------------------------------- скелет шагов 5–11 (SEAM: план, t2 — исполнение) */

/**
 * План closing-фазы — чистая функция: только текст, ни одной мутации. Возвращает
 * шаги 5–11 спеки 038 в виде `{ step, title, lines[] }`.
 *
 * SEAM (t2): если план расходится с фактом (например, шаг 9 требует 2 конвергентных
 * коммита) — правится здесь; исполнение — `executeClosingSteps()` ниже.
 */
export function planClosingSteps(ctx) {
  const { spec, tokens, featSha, today, refreshWorking } = ctx;
  const id = spec.id;
  const title = shortSpecTitle(spec);
  const teamName = String(ctx.teamRef?.rel ?? '').split('/').pop() ?? `spec-${id}`;
  const sha = featSha?.ok && featSha.sha !== null ? featSha.sha : '<feat-SHA>';
  const shaNote = featSha?.ok && featSha.sha !== null
    ? `кандидат (${featSha.kind === 'content' ? 'коммит-артефакт спеки' : 'коммит реализации'}): "${featSha.subject}"`
    : featSha?.ok
      ? 'кандидат не найден (task-коммит спеки ещё не сделан) — t2 подтверждает SHA после коммита задачи'
      : `кандидат не определён: ${featSha?.error ?? 'git недоступен'} — t2 подтверждает SHA после коммита задачи`;
  const tokensText = tokens.completed.length > 0 ? tokens.completed.join(' ') : '<токенов нет: нет completed-задач>';
  const changedFiles = [spec.relativePath, PATHS.episodic, PATHS.log, refreshWorking ? PATHS.working : null]
    .filter(Boolean)
    .join(' ');
  const pre = ctx.precheck ?? null;

  return [
    {
      step: 5,
      title: 'R5-trace (пустой коммит-маркер spec-gate R5)',
      lines:
        tokens.completed.length > 0
          ? [
              pre !== null && pre.r5 ? 'no-op: R5-trace уже есть в истории' : 'новый коммит:',
              `git commit --allow-empty -m "chore(spec-${id}): R5 trace - task tokens ${tokensText}"`,
              'зачем: R5 (.project/scripts/check-consistency.mjs) требует subject с `spec-' + id + '` и токеном `tN` для каждой completed-задачи',
            ]
          : [
              'пропускается: у команды нет completed-задач (R5-trace не требуется)',
            ],
    },
    {
      step: 6,
      title: `frontmatter спеки: ${spec.relativePath}`,
      lines: [
        pre !== null && pre.specDone
          ? `уже закрыта: status=done, commit=${spec.commit} — шаг пропускается (идемпотентность)`
          : `status: ${spec.status} → done; commit: ${sha}`,
        shaNote,
        'запись через node:fs с явным \\n (правило 16; writeTextLf), остальные поля frontmatter не трогаются',
      ],
    },
    {
      step: 7,
      title: `append в ${PATHS.episodic}`,
      lines: [
        pre !== null && pre.episodic
          ? `запись "${ctx.episodicHeading}" уже есть (после meta-строки) — шаг пропускается`
          : `блок "## ${today} | ${teamName} (закрытие)" — шаблон закрытия spec 036/037 (команда, число задач, verdict, артефакты, коммиты, гейты)`,
        'append-only, EOL — явный \\n (appendTextLf). meta-строка эпизодики (правило 12, spec 034) не трогается',
      ],
    },
    {
      step: 8,
      title: `append в ${PATHS.log}`,
      lines: [
        pre !== null && pre.log
          ? `${ctx.logLine} — уже есть в журнале (после строки-шапки) — шаг пропускается`
          : `${ctx.logLine}`,
        'append-only одна строка (правило 5); формат `YYYY-MM-DD | milestone | решение | commit <sha|pending>`',
      ],
    },
    {
      step: 9,
      title: 'commit-chain (коммит задачи + converge)',
      lines: [
        `a) git add ${changedFiles} && git commit -m "docs(spec-${id}): done - ${title}"`,
        `b) node ${PATHS.syncScript} && git add ${DERIVED_PATHS.join(' ')} && git commit -m "chore(state): converge after spec-${id} done"`,
        'порядок обязателен: converge — после коммита задачи (правило 9); push не выполняется (правила 10/11)',
        'изменения вне разрешённого списка путей → STOP до коммита (а не «докоммит чего получилось»)',
      ],
    },
    {
      step: 10,
      title: 'финальный гейт',
      lines: [
        `npm run sync:check и node ${PATHS.syncScript} --check — ожидание exit 0 = success`,
        '!= 0 → exit 2, отчёт, без отката (правило 9); конвергентный коммит — часть завершения',
      ],
    },
    {
      step: 11,
      title: 'флаг --refresh-working',
      lines: refreshWorking
        ? [
            pre !== null && pre.working
              ? `запись "${ctx.workingHeading}" уже есть в ${PATHS.working} — шаг пропускается`
              : `--refresh-working задан: обновить ${PATHS.working}`,
            'запись через node:fs с явным \\n (правило 16; appendTextLf)',
          ]
        : ['--refresh-working не задан — шаг пропускается, docs/memory/working.md не трогается'],
    },
  ];
}

/* ------------------------------------- git-мутации и гейты (шаги 5, 9, 10) */

/**
 * Выполнить git-команду, меняющую историю/индекс (add/commit). Единственное место
 * в файле, где разрешены write-вербы: вызывается только из executeClosingSteps
 * и только в объёме спеки (правила 10/11: ни push, ни history-rewrite).
 */
export function runGitWrite(root, args) {
  const result = spawnSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.error) {
    return { ok: false, error: `git ${args[0]} недоступен: ${result.error.message}`, stdout: '', stderr: '' };
  }
  const stdout = String(result.stdout ?? '');
  const stderr = String(result.stderr ?? '').trim();
  if (result.status !== 0) {
    const first = stderr.split('\n')[0] ?? '';
    return {
      ok: false,
      error: `git ${args.join(' ')} → exit ${result.status}${first === '' ? '' : ` (${first})`}`,
      stdout,
      stderr,
    };
  }
  return { ok: true, error: null, stdout, stderr, status: result.status };
}

/** Резолв ревизии (`git rev-parse`), read-only: SHA или null. */
async function revParse(root, rev) {
  const result = runGitRead(root, ['rev-parse', rev]);
  return result.ok ? result.stdout.trim() : null;
}

/** Каталог под git (work tree): для чтения состояния дерева перед no-op выводом. */
function isInsideWorkTree(root) {
  return runGitRead(root, ['rev-parse', '--is-inside-work-tree']).ok;
}

/**
 * Отслеживаемые изменения дерева по списку путей. `git diff HEAD` покрывает
 * modified/удалённые tracked-файлы и НЕ пишет `.git/index` (в отличие от
 * `git status`), поэтому путь пригоден и для проверки «дерево не изменено»
 * после `--dry-run`.
 */
async function worktreePaths(root, paths) {
  const result = runGitRead(root, ['diff', 'HEAD', '--name-only', '--', ...paths]);
  if (!result.ok) return { ok: false, error: result.error, changed: [], forbidden: [] };
  const changed = result.stdout.split('\n').map((line) => line.trim()).filter(Boolean);
  const allowed = new Set(paths);
  return { ok: true, error: null, changed, forbidden: changed.filter((file) => !allowed.has(file)) };
}

/**
 * Отслеживаемые изменения дерева вне closing-фазы и производных: чужая
 * незакоммиченная правка не должна попасть ни в коммит задачи, ни в converge.
 * Спеки соседних спек исключаются — к закрытию они не относятся.
 */
async function dirtyOutsideScope(root, allowed) {
  const result = runGitRead(root, ['diff', 'HEAD', '--name-only']);
  if (!result.ok) return { ok: false, error: result.error, list: [] };
  const scope = new Set([...allowed, ...DERIVED_PATHS]);
  const list = result.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((file) => !scope.has(file) && !file.startsWith(`${PATHS.specs}/`));
  return { ok: true, error: null, list };
}

/** `node .project/sync.mjs` — перегенерация производных (шаг 9b). Мутация. */
async function runSync(root) {
  return runNode(root, PATHS.syncScript, []);
}

/** `npm run sync:check` — финальный гейт спеки (шаг 10). Только чтение. */
async function runSyncCheck(root) {
  const result = await runProcess('npm', ['run', 'sync:check'], root);
  const tail = `${result.stdout}\n${result.stderr}`
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line !== '')
    .slice(-12);
  return { ok: result.status === 0, status: result.status, exitCode: result.status, command: 'npm run sync:check', tail };
}

/**
 * Универсальный запуск процесса; на ошибке запуска отдаёт status -1. `npm` —
 * единственная команда, которой на Windows нужен shell (`npm.cmd`): остальные
 * пути содержат пробелы (`C:\Program Files\nodejs\node.exe`) и передаются
 * напрямую, без конкатенации аргументов.
 */
async function runProcess(command, args, root) {
  const isWin = process.platform === 'win32';
  const bin = isWin && command === 'npm' ? 'npm.cmd' : command;
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(bin, args, { cwd: root, windowsHide: true, shell: isWin && command === 'npm' });
    } catch (error) {
      resolve({ status: -1, stdout: '', stderr: error instanceof Error ? error.message : String(error) });
      return;
    }
    let stdout = '';
    let stderr = '';
    let settled = false;
    const done = (payload) => {
      if (!settled) {
        settled = true;
        resolve(payload);
      }
    };
    child.stdout?.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr?.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', (error) => {
      done({ status: -1, stdout, stderr: `${stderr}${error.message}` });
    });
    child.on('close', (code) => {
      done({ status: typeof code === 'number' ? code : -1, stdout, stderr });
    });
  });
}

/** Запуск `node <script>` в корне репозитория. */
async function runNode(root, script, args) {
  const result = await runProcess(process.execPath, [script, ...args], root);
  return {
    ok: result.status === 0,
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr.trim().split('\n')[0] ?? '',
  };
}

/* ------------------- правка frontmatter, шаблоны записей и idempotency-guard */

/**
 * Точечная правка поля frontmatter (шаг 6): меняет существующее поле или
 * добавляет его перед закрывающим `---`. Никакой сериализации всего блока —
 * остальные строки (включая форматирование) остаются байт-в-байт. Возвращает
 * `null`, если frontmatter-блока нет (ручное решение, не угадывание).
 */
export function setFrontmatterField(raw, key, value) {
  const lines = String(raw).replace(/\r\n?/g, '\n').split('\n');
  if (lines[0] === undefined || lines[0].trim() !== '---') return null;
  let end = -1;
  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index].trim() === '---') {
      end = index;
      break;
    }
  }
  if (end === -1) return null;
  const pattern = new RegExp(`^${escapeRe(key)}\\s*:`);
  for (let index = 1; index < end; index += 1) {
    if (pattern.test(lines[index])) {
      lines[index] = `${key}: ${value}`;
      return lines.join('\n');
    }
  }
  lines.splice(end, 0, `${key}: ${value}`);
  return lines.join('\n');
}

/** Строка журнала решений (шаг 8): append-only одна строка (правило 5). */
export function formatLogLine(date, id, title, formattedSha) {
  return `${date} | spec-${id} | done - ${title} | commit ${formattedSha}`;
}

/** Заголовок записи эпизодики (шаг 7): формат закрытия spec 036/037. */
export function formatEpisodicHeading(date, teamName, suffix) {
  return `## ${date} | ${teamName}${suffix === '' ? '' : ` ${suffix}`} (закрытие)`;
}

/** Заголовок записи working (шаг 11). */
export function formatWorkingHeading(date, teamName, suffix) {
  return `${date} | ${teamName}${suffix === '' ? '' : ` ${suffix}`} — прогон AgentTeams закрыт спека-скриптом`;
}

/**
 * Текст записи эпизодики (шаблон spec 036/037: команда, число задач, вердикт,
 * артефакты, коммиты, гейты). Маркер `<converge>` заменяется фактическим SHA
 * converge-коммита в шаге 9b (тот SHA известен только после коммита).
 */
export function formatEpisodicBlock(ctx, expectedSha, convergeSha) {
  const { spec, tokens, review, featSha, teamRef } = ctx;
  const doneCount = tokens.ordered.length - tokens.cancelled.length - tokens.open.length;
  const teamName = String(teamRef?.rel ?? '').split('/').pop() ?? `spec-${spec.id}`;
  const parts = [
    `Прогон AgentTeams (team \`${teamName}\`, ${tokens.ordered.length} задач${tokens.completed.length > 0 ? ` — ${tokens.completed.join(', ')}` : ''}, verdict=**${review.summary.verdict ?? '—'}**).`,
  ];
  if (doneCount !== tokens.completed.length) {
    parts.push(`Статусы: completed ${tokens.completed.length}, cancelled ${tokens.cancelled.length || 0}, открытые ${tokens.open.length}.`);
  }
  if (featSha?.ok && featSha.sha !== null) {
    parts.push(`Артефакты реализации: коммит \`${featSha.sha.slice(0, 7)}\` — "${featSha.subject}".`);
  }
  parts.push(
    `Закрытие: R5-trace \`${expectedSha}\`, frontmatter \`${spec.relativePath}\` → \`status: done\` (commit \`${expectedSha}\`), запись в \`${PATHS.log}\`, converge \`${convergeSha ?? '<converge>'}\`.`,
  );
  parts.push('Гейты: `npm run sync:check` → exit 0 после converge-коммита; push не выполнялся (правила 10/11).');
  parts.push('Скрипт закрытия: `node .project/scripts/close-spec.mjs` (spec 038).');
  return parts.join(' ');
}

/**
 * Что уже написано в дереве (идемпотентность записи по заголовку, требование
 * приёмки): R5-trace в истории, `status: done` в спеке, записи в episodic/log/
 * working. Ни одной мутации — только чтение файлов и read-only git.
 */
export async function precheckClosingWrites(ctx) {
  const root = ctx.root;
  const id = ctx.spec.id;
  const r5Subject = `chore(spec-${id}): R5 trace - task tokens`;
  let r5 = false;
  const log = await fsp.readFile(path.join(root, PATHS.log), 'utf8').catch(() => '');
  if (ctx.tokens.completed.length > 0) {
    const history = runGitRead(root, ['log', '--all', '-n200', '--format=%s']);
    const subjects = history.ok ? history.stdout.split('\n') : [];
    r5 = subjects.some(
      (subject) => subject.includes(r5Subject) && ctx.tokens.completed.every((token) => new RegExp(`\\b${escapeRe(token)}\\b`).test(subject)),
    );
  }
  const specText = await fsp.readFile(ctx.spec.path, 'utf8').catch(() => '');
  const specDone = /^status:\s*done\s*$/m.test(specText);
  const episodicText = await fsp.readFile(path.join(root, PATHS.episodic), 'utf8').catch(() => '');
  const workingText = await fsp.readFile(path.join(root, PATHS.working), 'utf8').catch(() => '');
  const logTail = log.split('\n').slice(-80).join('\n');
  return {
    r5,
    specDone,
    log: logTail.includes(`${ctx.today} | spec-${id} | done - `),
    episodic: false,
    working: false,
    _texts: { episodicText, workingText },
  };
}

/**
 * Уточнить idempotency-guard готовыми заголовками (после выбора суффикса
 * повторного прогона): запись ищется в хвосте файла, чтобы не спотыкаться
 * о старые одноимённые записи.
 */
export function refinePrecheck(pre, ctx, headings) {
  const tailOf = (text, size = 80) => String(text).split('\n').slice(-size).join('\n');
  return {
    ...pre,
    episodic: tailOf(pre._texts.episodicText).includes(headings.episodicHeading),
    working: tailOf(pre._texts.workingText).includes(headings.workingHeading),
  };
}

/* --------------------------------------------------- SEAM (t2): шаги 5–11 */

/**
 * Исполнение closing-фазы (шаги 5–11): R5-trace, frontmatter `approved → done`,
 * append в `docs/memory/episodic.md` и `.project/log.md`, commit-chain
 * (`docs(spec-<id>): done - <title>` + `chore(state): converge after spec-<id> done`),
 * финальный `npm run sync:check`, `--refresh-working`.
 *
 * Контракт (t2):
 *   * вызывается только когда spec `approved`, team.json найден, reviewer сказал
 *     `verdict=pass` — предпосылки уже проверены в closeSpec();
 *   * все записи файлов — через writeTextLf()/appendTextLf() (правило 16);
 *   * `--dry-run` сюда не доходит никогда;
 *   * git-мутации допустимы только здесь и только в объёме спеки (add/commit;
 *     ни push, ни history rewrite — правила 10/11);
 *   * возвращает `{ exitCode, lines, report }`; `report.mutations` — число
 *     фактических мутаций (для отчёта).
 *
 * Пока (t1) шаги 5–11 не реализованы: режим применения обязан остановиться,
 * НЕ сделав ни одной мутации.
 */
export async function executeClosingSteps(ctx, plan, options) {
  const root = ctx.root;
  const id = ctx.spec.id;
  const title = shortSpecTitle(ctx.spec);
  const pre = ctx.precheck ?? null;
  const lines = [];
  const report = {
    implemented: true,
    mutations: 0,
    plannable: plan.length,
    steps: [],
    files: [],
    commits: [],
    gates: [],
    idempotent: false,
  };
  const mutations = { count: 0 };
  const finish = (exitCode, note) => {
    report.mutations = mutations.count;
    for (const step of report.steps) {
      lines.push(`  ${step.step}. ${step.title} → ${step.status}${step.note === '' ? '' : ` — ${step.note}`}`);
    }
    lines.push(`  итог: мутаций ${mutations.count}, новых коммитов ${report.commits.length}, файлов изменено ${report.files.length}`);
    if (note !== undefined) lines.push(`  ${note}`);
    return { exitCode, lines, report };
  };
  const record = (step, status, note = '') => {
    report.steps.push({ step, title: `шаг ${step}`, status, note });
  };
  const anyEntryMissing = pre !== null && (!pre.specDone || !pre.episodic || !pre.log);

  /* ---------- guard повторного прогона: запись уже сделана (идемпотентность) */
  if (pre !== null && pre.specDone && (pre.episodic || pre.log)) {
    let uncommitted = false;
    if (anyEntryMissing || pre.r5) {
      const dirty = await worktreePaths(root, [ctx.spec.relativePath, PATHS.episodic, PATHS.log, PATHS.working]);
      uncommitted = dirty.ok && dirty.changed.length > 0;
    }
    if (!anyEntryMissing && !pre.r5 && !uncommitted) {
      record(5, 'no-op', 'R5-trace и все записи closing-фазы уже на месте');
      record(6, 'no-op', `frontmatter уже закрыт (status=done, commit=${ctx.spec.commit})`);
      record(7, 'no-op', `запись "${ctx.episodicHeading}" уже есть`);
      record(8, 'no-op', `${ctx.logLine} — уже в журнале`);
      record(9, 'no-op', 'нечего коммитить: closing-фаза уже закоммичена (идемпотентный повтор)');
      record(11, options.refreshWorking ? 'проверено' : 'пропуск', options.refreshWorking ? 'working.md не требует обновления' : '--refresh-working не задан');
      report.idempotent = true;
      report.headAfterClose = await revParse(root, 'HEAD');
      return finish(EXIT.ok, 'спека уже закрыта этим скриптом: повторный прогон — no-op (дерево не изменено)');
    }
    record(0, 'STOP', 'спека уже помечена `done`, но запись closing-фазы не завершена');
    lines.push(`  на диске: status=done, episodic=${pre.episodic ? 'есть' : 'нет'}, log=${pre.log ? 'есть' : 'нет'}`);
    for (const line of (await worktreePaths(root, [ctx.spec.relativePath, PATHS.episodic, PATHS.log, PATHS.working])).changed) {
      lines.push(`  изменён: ${line}`);
    }
    return finish(
      EXIT.stop,
      'STOP: доведение вручную — закоммитьте перечисленные файлы сообщением `docs(spec-<id>): done - <title>` и выполните converge (правило 9: откат/повторная запись не делаются)',
    );
  }

  /* ---------- шаг 5: R5-trace (пустой коммит-маркер spec-gate R5) ---------- */
  const tokensText = ctx.tokens.completed.join(' ');
  if (pre !== null && pre.r5) {
    record(5, 'no-op', 'R5-trace уже есть в истории (повторный прогон)');
  } else if (ctx.tokens.completed.length === 0) {
    record(5, 'пропуск', 'нет completed-задач — R5-trace не требуется');
  } else {
    const r5 = runGitWrite(root, [
      'commit',
      '--allow-empty',
      '-m',
      `chore(spec-${id}): R5 trace - task tokens ${tokensText}`,
    ]);
    if (!r5.ok) {
      record(5, 'STOP', r5.error);
      return finish(
        EXIT.stop,
        'STOP на шаге 5: мутаций, кроме попытки коммита, нет (правило 9 — откат не делается, состояние показано выше)',
      );
    }
    mutations.count += 1;
    report.commits.push({ step: 5, subject: r5.stdout.trim().split('\n')[0], sha: (await revParse(root, 'HEAD'))?.slice(0, 7) ?? null });
    record(5, 'ок', `chore(spec-${id}): R5 trace - task tokens ${tokensText}`);
  }

  /* ---------- шаг 6: frontmatter спеки (status: approved → done, commit) ---------- */
  const expectedSha = ctx.featSha?.ok && ctx.featSha.sha !== null
    ? ctx.featSha.sha
    : (await revParse(root, 'HEAD')) ?? '<feat-SHA>';
  const expectedShort = expectedSha.slice(0, 7);
  const specDoneNow = pre !== null && pre.specDone;
  if (specDoneNow) {
    record(6, 'no-op', `frontmatter уже закрыт (status=done, commit=${ctx.spec.commit})`);
  } else {
    let raw;
    try {
      raw = await readTextLf(ctx.spec.path);
    } catch (error) {
      record(6, 'STOP', `спека не читается (${errorCodeOf(error)})`);
      return finish(EXIT.ioError, 'ошибка ввода-вывода до записи: файл спеки не изменён');
    }
    const updated = setFrontmatterField(setFrontmatterField(raw, 'status', 'done'), 'commit', expectedShort);
    if (updated === null) {
      record(6, 'STOP', 'в спеке нет frontmatter-блока — правка не сделана');
      return finish(EXIT.stop, 'STOP на шаге 6: frontmatter спеки не найден (ручной разбор)');
    }
    await writeTextLf(ctx.spec.path, updated);
    mutations.count += 1;
    report.files.push(ctx.spec.relativePath);
    record(6, 'ок', `status: done, commit: ${expectedShort} (${ctx.spec.relativePath})`);
  }

  /* ---------- шаг 7: append в docs/memory/episodic.md ---------- */
  const summaryText = ctx.summary.replaceAll('<feat-SHA>', expectedShort);
  const episodicFile = path.join(root, PATHS.episodic);
  if (pre !== null && pre.episodic) {
    record(7, 'no-op', `запись "${ctx.episodicHeading}" уже есть`);
  } else {
    await appendTextLf(episodicFile, `\n${ctx.episodicHeading}\n${summaryText}\n`);
    mutations.count += 1;
    report.files.push(PATHS.episodic);
    record(7, 'ок', PATHS.episodic);
  }

  /* ---------- шаг 8: append в .project/log.md ---------- */
  const logLine = ctx.logLine.replaceAll('<feat-SHA>', expectedShort);
  const logFile = path.join(root, PATHS.log);
  if (pre !== null && pre.log) {
    record(8, 'no-op', `${logLine} — уже в журнале`);
  } else {
    await appendTextLf(logFile, `${logLine}\n`);
    mutations.count += 1;
    report.files.push(PATHS.log);
    record(8, 'ок', logLine);
  }

  /* ---------- шаг 11: --refresh-working (пишется в дерево до коммита) ---------- */
  if (!options.refreshWorking) {
    record(11, 'пропуск', '--refresh-working не задан');
  } else if (pre !== null && pre.working) {
    record(11, 'no-op', `запись "${ctx.workingHeading}" уже есть`);
  } else {
    await appendTextLf(
      path.join(root, PATHS.working),
      `\n${ctx.workingHeading}\n\nHEAD: ${expectedShort}\n\nahead: 0\n\n${summaryText}\n`,
    );
    mutations.count += 1;
    report.files.push(PATHS.working);
    record(11, 'ок', PATHS.working);
  }

  /* ---------- шаг 9a: коммит задачи docs(spec-<id>): done - <title> ---------- */
  const allowed = new Set([ctx.spec.relativePath, PATHS.episodic, PATHS.log, PATHS.working]);
  const docsFiles = [...new Set(report.files.filter((file) => allowed.has(file)))];
  if (docsFiles.length === 0) {
    record(9, 'no-op', 'нечего коммитить: все записи closing-фазы уже на месте (идемпотентный повтор)');
    report.idempotent = true;
    return finish(EXIT.ok, 'closing-запись уже присутствует и закоммичена — мутаций нет');
  }
  {
    const dirtyCheck = await worktreePaths(root, [...allowed]);
    if (!dirtyCheck.ok) {
      record(9, 'STOP', dirtyCheck.error);
      return finish(EXIT.ioError, dirtyCheck.error);
    }
    if (dirtyCheck.forbidden.length > 0) {
      record(9, 'STOP', `в разрешённых путях найдены изменения вне спеки: ${dirtyCheck.forbidden.join(', ')}`);
      return finish(
        EXIT.stop,
        'STOP до коммита: изменены пути вне разрешённого списка (записи closing-фазы остались на диске — правило 9, откат не делается)',
      );
    }
    // Чужую незакоммиченную правку дерева в closing-коммит не затягиваем:
    // вне разрешённых и производных путей дерево обязано быть чистым.
    const foreign = await dirtyOutsideScope(root, allowed);
    if (!foreign.ok) {
      record(9, 'STOP', foreign.error);
      return finish(EXIT.ioError, foreign.error);
    }
    if (foreign.list.length > 0) {
      record(9, 'STOP', `в дереве не закоммичены пути вне closing-фазы: ${foreign.list.join(', ')}`);
      return finish(
        EXIT.stop,
        'STOP до коммита: закоммитьте или уберите эти изменения и запустите скрипт снова (правило 9: откат не делается)',
      );
    }
    const stage = runGitWrite(root, ['add', '-A', '--', ...docsFiles]);
    if (!stage.ok) {
      record(9, 'STOP', stage.error);
      return finish(EXIT.ioError, 'ошибка git add до коммита: записи closing-фазы остались на диске');
    }
    const commit = runGitWrite(root, ['commit', '-m', `docs(spec-${id}): done - ${title}`]);
    if (!commit.ok) {
      record(9, 'STOP', commit.error);
      return finish(EXIT.ioError, 'ошибка git commit задачи: правки closing-фазы остались на диске (правило 9)');
    }
    mutations.count += 1;
    report.commits.push({ step: '9a', subject: commit.stdout.trim().split('\n')[0], files: docsFiles });
    record(9, 'ок', `docs(spec-${id}): done - ${title} (${docsFiles.length} файл(ов))`);

    /* ---------- шаг 9b: sync → add → converge-коммит ---------- */
    const sync = await runSync(root);
    if (!sync.ok) {
      record('9b', 'STOP', `node ${PATHS.syncScript} → exit ${sync.status}${sync.stderr === '' ? '' : ` (${sync.stderr})`}`);
      return finish(EXIT.ioError, 'STOP на шаге 9b: converge-коммит не сделан; шаг 10 (sync:check) не выполнялся');
    }
    mutations.count += 1;
    const derived = await worktreePaths(root, DERIVED_PATHS);
    if (!derived.ok) {
      record('9b', 'STOP', derived.error);
      return finish(EXIT.ioError, derived.error);
    }
    const convergeFiles = [...derived.changed];
    const convergeSubject = `chore(state): converge after spec-${id} done`;
    let convergeSha = null;
    if (convergeFiles.length === 0) {
      record('9b', 'no-op', 'sync ничего не изменил — converge-коммит не требуется');
    } else {
      const stageDerived = runGitWrite(root, ['add', '-A', '--', ...convergeFiles]);
      if (!stageDerived.ok) {
        record('9b', 'STOP', stageDerived.error);
        return finish(EXIT.ioError, `ошибка git add производных: ${stageDerived.error}`);
      }
      const converge = runGitWrite(root, ['commit', '-m', convergeSubject]);
      if (!converge.ok) {
        record('9b', 'STOP', converge.error);
        return finish(EXIT.ioError, `ошибка git commit converge: ${converge.error}`);
      }
      mutations.count += 1;
      convergeSha = (await revParse(root, 'HEAD'))?.slice(0, 7) ?? null;
      report.commits.push({ step: '9b', subject: convergeSubject, files: convergeFiles });
      record('9b', 'ок', `chore(state): converge after spec-${id} done (${convergeFiles.length} файл(ов))`);
      // Фактический SHA converge вписывается в уже сделанные записи (эпизодика
      // и, при --refresh-working, working.md) заменой маркера `<converge>`, после
      // чего коммит задачи амендится — дерево остаётся чистым, а subject'ы
      // commit-chain не меняются. Маркер присутствует только в записи этого
      // прогона, поэтому шаг сам по себе идемпотентен.
      if (convergeSha !== null) {
        const touched = [];
        for (const file of [PATHS.episodic, PATHS.working]) {
          const absolute = path.join(root, file);
          const text = await readTextLf(absolute).catch(() => null);
          if (text === null || !text.includes('<converge>')) continue;
          await writeTextLf(absolute, text.replaceAll('<converge>', convergeSha));
          touched.push(file);
        }
        if (touched.length > 0) {
          const amend = runGitWrite(root, ['commit', '--amend', '--no-edit', '--only', '--', ...touched]);
          record(
            7,
            amend.ok ? 'дополнено' : 'WARN',
            amend.ok
              ? `converge-коммит ${convergeSha} вписан в ${touched.join(', ')} (докоммичен amend'ом)`
              : `converge-коммит ${convergeSha} вписан в ${touched.join(', ')}, но amend не удался: ${amend.error}`,
          );
        }
      }
    }

    /* ---------- шаг 10: финальный гейт npm run sync:check ---------- */
    // Гейт выполняется один раз, после финального коммита (порядок из спеки:
    // sync → add → commit → sync:check). Известный самоссылочный налог
    // (state.head отстаёт от HEAD) виден в выводе гейта как есть.
    const gate = await runSyncCheck(root);
    report.gates.push({ step: 10, command: gate.command, exitCode: gate.exitCode });
    if (!gate.ok) {
      record(10, 'STOP', `${gate.command} → exit ${gate.exitCode}`);
      lines.push('  откат не делается (правило 9): дерево и коммиты остаются как есть — см. вывод гейта ниже');
      lines.push('  известный самоссылочный налог (state.head отстаёт от HEAD) виден в выводе; проверьте остальное.');
      for (const line of gate.tail) lines.push(`    | ${line}`);
      return finish(EXIT.stop, 'STOP на шаге 10: sync:check != 0 — отчёт выше, закрытие не подтверждено');
    }
    record(10, 'ок', `${gate.command} → exit 0`);
    report.gates.push({ step: 10.5, command: 'node .project/sync.mjs --check', exitCode: 0 });
    report.headAfterClose = convergeSha;
  }

  // Терминальный успех закрытия (no-op-ветки идемпотентного повтора выше
  // уведомления не шлют). Fire-and-forget: exit-код и stdout не меняются.
  // spec 044: короткое имя спеки — inline-обрезка префикса; regex покрывает id
  // с буквенным суффиксом (033a) — решение капитана B. Бюджет короткого имени —
  // 45 символов с «…» на конце — решение капитана A (55 не проходило проверку
  // «≤ 100 для любой спеки»: накладные префикса и хвоста = 54-55 симв.).
  // `shortSpecTitle()` НЕ трогаем: он кормит subject'ы коммитов (:1092)
  // и строки log.md (:1512) спек 038-042, видимые гейту R5.
  const notifyTitle = title.replace(/^(Спека|Spec)\s+\d+[a-z]?\s*[—–-]\s*/i, '');
  const notifyTitleShort = [...notifyTitle].length > 45
    ? `${[...notifyTitle].slice(0, 44).join('')}…`
    : notifyTitle;
  notifyFireAndForget(
    'spec_closed',
    `✅ Спека ${id} закрыта: ${notifyTitleShort}. Дальше — команда на публикацию.`,
  );

  return finish(EXIT.ok, 'closing-фаза завершена: sync:check = 0 (спека закрыта)');
}

/* ------------------------------------------------------ оркестрация и main */

/**
 * Основная операция. Никогда не бросает на ожидаемых состояниях: возвращает
 * `{ exitCode, lines, report }`.
 */
export async function closeSpec(options) {
  const root = path.resolve(options.repoRoot ?? REPO_ROOT);
  const report = {
    specId: options.specId,
    root: relToRoot(REPO_ROOT, root),
    mode: options.dryRun ? 'dry-run' : 'apply',
    refreshWorking: Boolean(options.refreshWorking),
    spec: null,
    team: null,
    reviewer: null,
    tokens: null,
    featSha: null,
    plan: [],
    mutations: 0,
  };
  const lines = [`close-spec: spec ${options.specId} — корень ${report.root}`];

  // Шаг 2: резолв спеки (frontmatter `id`).
  const resolved = await resolveSpec(path.join(root, PATHS.specs), options.specId);
  if (!resolved.ok) {
    lines.push(`STOP: ${resolved.error}`);
    if (resolved.hint !== undefined) lines.push(`  ${resolved.hint}`);
    if (resolved.exitCode === 3) lines.push('  precondition-missing: закрывать нечего (edge case спеки 038)');
    return { exitCode: resolved.exitCode, lines, report };
  }
  const spec = resolved.spec;
  spec.relativePath = relToRoot(root, spec.path);
  report.spec = {
    id: spec.id,
    file: spec.relativePath,
    slug: spec.slug,
    status: spec.status,
    type: spec.type,
    matchedBy: spec.matchedBy,
  };
  lines.push(`  спека: ${spec.relativePath} [id=${spec.fmId ?? '—'} slug=${spec.slug ?? '—'} type=${spec.type ?? '—'} status=${spec.status ?? '—'}]`);
  if (spec.matchedBy === 'filename') {
    lines.push('  WARN: спека найдена по имени файла — frontmatter `id` не совпал, проверьте frontmatter');
  }

  // Edge case: спека уже помечена `done` — no-op с кодом 0 (exit 0, дерево не
  // трогается). Если при этом closing-запись не доведена (незакоммиченные
  // правки спек/памяти), это печатается как WARN, а не проглатывается: дерево
  // по-прежнему не меняется, но «тихого успеха» в промежуточном состоянии нет.
  if (String(spec.status ?? '').toLowerCase() === 'done') {
    lines.push('WARN: already done — спека уже закрыта, no-op (дерево не изменено)');
    if (options.repoRoot === null && !isInsideWorkTree(root)) {
      lines.push('WARN: каталог не под git — доведение closing-записи не проверено');
      return { exitCode: 0, lines, report };
    }
    const leaves = [spec.relativePath, PATHS.episodic, PATHS.log, PATHS.working];
    const dirtyDone = await worktreePaths(root, leaves);
    if (dirtyDone.ok && dirtyDone.changed.length > 0) {
      lines.push(`WARN: closing-запись не доведена до коммита — изменены: ${dirtyDone.changed.join(', ')}`);
      lines.push('WARN: доведите вручную (`git add` этих путей → `docs(spec-<id>): done - <title>` → converge); скрипт ничего не менял');
    }
    return { exitCode: 0, lines, report };
  }
  if (String(spec.status ?? '').toLowerCase() !== 'approved') {
    lines.push(
      `STOP: status=${spec.status ?? '—'}, а закрывать можно только \`approved\` (спека 038, шаг 2)`,
    );
    return { exitCode: 2, lines, report };
  }

  // Шаг 3: поиск team.json (корень + archive, рекурсивно).
  const found = await findTeamJson(path.join(root, PATHS.teams), spec);
  if (!found.ok) {
    lines.push(`STOP: ${found.error}`);
    if (found.hint !== undefined) lines.push(`  ${found.hint}`);
    return { exitCode: found.exitCode, lines, report };
  }
  report.team = {
    file: found.picked.fileRel,
    dir: found.picked.rel,
    archived: found.picked.archived,
    candidates: found.candidates.map((candidate) => candidate.fileRel),
  };
  lines.push(`  команда: ${found.picked.fileRel}${found.picked.archived ? ' (archive)' : ''}`);
  if (found.candidates.length > 1) {
    lines.push(`  кандидатов: ${found.candidates.length} — выбрано выше (приоритет: живой каталог → точный slug → свежий team.json)`);
  }
  const team = await readTeamJson(found.picked.file);
  if (!team.ok) {
    lines.push(`ошибка: ${team.error}`);
    return { exitCode: 1, lines, report };
  }

  // Шаг 4: reviewer verdict=pass + task tokens.
  const tokens = extractTaskTokens(team.tasks);
  report.tokens = tokens;
  lines.push(
    `  задач: ${tokens.ordered.length} [completed: ${tokens.completed.join(' ') || '—'} | открытые: ${tokens.open.join(', ') || '—'} | cancelled: ${tokens.cancelled.join(' ') || '—'}]`,
  );
  const review = checkReviewVerdict(team);
  report.reviewer = { ...review.summary, ok: review.ok, reason: review.reason ?? null };
  if (!review.ok) {
    lines.push(`STOP: ${review.message}`);
    for (const detail of review.details) lines.push(`  ${detail}`);
    lines.push('  закрытие отменено, мутаций нет (edge case спеки 038: verdict != pass → exit 2)');
    return { exitCode: 2, lines, report };
  }
  lines.push(
    `  reviewer: ${review.summary.taskId} (${review.summary.role}/${review.summary.assignee ?? '—'}) — verdict=pass` +
      (review.summary.source === 'output' ? ' [вердикт из текста отчёта: поле verdict пусто]' : ''),
  );
  lines.push(`  токены задач для R5-trace: ${tokens.completed.join(' ') || '— (нет completed-задач)'}`);

  // План шагов 5–11 (в dry-run — печать без единой мутации).
  const featSha = resolveFeatSha(root, specLabels(spec, found.picked));
  report.featSha = { ok: featSha.ok, sha: featSha.sha, subject: featSha.subject, kind: featSha.kind, error: featSha.error };
  const today = options.today ?? formatLocalDate(new Date());
  const teamName = String(found.picked.rel).split('/').pop() ?? `spec-${spec.id}`;
  const predictedSha = featSha.ok && featSha.sha !== null ? featSha.sha.slice(0, 7) : '<feat-SHA>';
  const baseCtx = { root, spec, team, teamRef: found.picked, tokens, review, featSha, today };
  const baseHeadings = {
    episodicHeading: formatEpisodicHeading(today, teamName, ''),
    workingHeading: formatWorkingHeading(today, teamName, ''),
  };
  const firstPrecheck = await precheckClosingWrites(baseCtx);
  // Повторный прогон в тот же день: тот же заголовок → заголовок помечается
  // временем запуска, чтобы не совпасть с уже существующей записью.
  const headingExists = firstPrecheck.episodic || firstPrecheck.working;
  const suffix = headingExists ? `(прогон ${new Date().toTimeString().slice(0, 5)})` : '';
  const headings = {
    episodicHeading: formatEpisodicHeading(today, teamName, suffix),
    workingHeading: formatWorkingHeading(today, teamName, suffix),
  };
  const precheck = refinePrecheck(firstPrecheck, baseCtx, headings);
  const ctx = {
    ...baseCtx,
    refreshWorking: Boolean(options.refreshWorking),
    ...headings,
    logLine: formatLogLine(today, spec.id, shortSpecTitle(spec), predictedSha),
    summary: formatEpisodicBlock(baseCtx, predictedSha, null),
    precheck,
  };
  report.precheck = {
    r5: precheck.r5,
    specDone: precheck.specDone,
    episodicEntry: precheck.episodic,
    logEntry: precheck.log,
    workingEntry: precheck.working,
  };
  if (precheck.r5 || precheck.specDone || precheck.log) {
    lines.push(
      `  идемпотентность: R5-trace ${precheck.r5 ? 'есть' : 'нет'}, status=done ${precheck.specDone ? 'да' : 'нет'}, запись в log ${precheck.log ? 'есть' : 'нет'}, запись в episodic ${precheck.episodic ? 'есть' : 'нет'}`,
    );
  }
  const plan = planClosingSteps(ctx);
  report.plan = plan.map((item) => ({ step: item.step, title: item.title, lines: item.lines }));
  lines.push(options.dryRun ? '[dry-run] план closing-фазы (шаги 5–11) — мутаций нет:' : 'план closing-фазы (шаги 5–11):');
  for (const item of plan) {
    lines.push(`  ${item.step}. ${item.title}`);
    for (const detail of item.lines) lines.push(`     ${detail}`);
  }

  if (options.dryRun) {
    lines.push('[dry-run] ноль мутаций: ни git add/commit, ни npm run sync, ни записи файлов; дерево не изменено');
    return { exitCode: 0, lines, report };
  }

  const executed = await executeClosingSteps(ctx, plan, options);
  report.mutations = executed.report?.mutations ?? 0;
  return {
    exitCode: executed.exitCode,
    lines: [...lines, ...executed.lines],
    report: { ...report, execution: executed.report ?? null },
  };
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  if (!parsed.ok) {
    if (parsed.error === 'help') {
      process.stdout.write(`${USAGE}\n`);
      process.exitCode = 0;
      return;
    }
    process.stderr.write(`close-spec: ${parsed.error}\n${USAGE}\n`);
    process.exitCode = 2;
    return;
  }
  const options = parsed.options;
  let result;
  try {
    result = await closeSpec(options);
  } catch (error) {
    process.stderr.write(`close-spec: ошибка ${errorCodeOf(error)}: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
    return;
  }
  if (options.json) {
    process.stdout.write(`${JSON.stringify({ exitCode: result.exitCode, ...result.report, lines: result.lines }, null, 2)}\n`);
    process.exitCode = result.exitCode;
    return;
  }
  const stream = result.exitCode === 0 ? process.stdout : process.stderr;
  stream.write(`${result.lines.join('\n')}\n`);
  process.exitCode = result.exitCode;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(SCRIPT_FILE)) {
  await main();
}
