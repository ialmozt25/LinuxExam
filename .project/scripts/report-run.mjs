// report-run.mjs — авто-отчёт MAS-прогона (spec 034, B.2 / task t2).
//
// Что делает (zero новых зависимостей, Node ESM):
//   1) читает `.agent-teams/<teamId>/team.json`; teamId по умолчанию — самый
//      свежий каталог в `.agent-teams/`, включая `archive/` (по `createdAt`
//      записи, с фолбэком на mtime файла);
//   2) строит выжимку прогона: teamId, spec, verdict, durationMs, сводку задач
//      по статусам и статусы ревью-задач;
//   3) печатает выжимку человеку (по умолчанию) или машиночитаемо (`--json`);
//   4) дописывает запись правила 12 (`ORCH-RULES.md`) в `docs/memory/episodic.md`.
//
// Режимы и запись:
//   * `--json`    — READ-ONLY: печатает JSON, в память НЕ пишет. Поэтому
//     `node .project/scripts/report-run.mjs --json` безопасен для гейтов/ревью.
//   * `--dry-run` — печатает выжимку и текст записи, файлы не меняет.
//   * по умолчанию — печатает выжимку и дописывает запись правила 12.
//     Идемпотентность: запись ищется по заголовку `## <дата> | <teamId>`;
//     повторный вызов на том же teamId — no-op. Реальную запись в память
//     делает владелец памяти (single-writer): в прогоне spec 034 её выполняет
//     лид на интеграции, исполнитель проверяет только на копии (`--episodic`).
//
// Контракт чтения записи истории (spec 034, зафиксирован оркестратором):
//   `teamId`, `durationMs`, `tokens`, `verdict` — ОПЦИОНАЛЬНЫЕ поля; отсутствие
//   трактуется как «неизвестно» (в центре это «—»), падения быть не должно.
//   Поле `version` не является маркером схемы: писатель (`run-spec.mjs`) ставит
//   version 1 всегда, наличие полей из него не выводится.
//
// Использование:
//   node .project/scripts/report-run.mjs [teamId] [--json] [--dry-run]
//        [--episodic <path>] [--teams-root <dir>]
//
// Коды выхода:
//   0 — отчёт построен; либо штатный no-op (нет team.json / пустой каталог команд);
//   1 — ошибка ввода-вывода (файл не читается или не пишется);
//   2 — ошибка использования (неизвестный флаг, недопустимый teamId, нет значения).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const rel = (p) => path.join(ROOT, p);

/** Каталог состояния команд (совпадает с `run-spec.mjs` и `sync.mjs`). */
export const DEFAULT_TEAMS_ROOT = rel('.agent-teams');
/** Каталог архива команд внутри teamsRoot (совпадает с плагином). */
export const ARCHIVE_DIR_NAME = 'archive';
/** Путь записи правила 12 по умолчанию. */
export const DEFAULT_EPISODIC_PATH = rel('docs/memory/episodic.md');

const USAGE =
  'usage: node .project/scripts/report-run.mjs [teamId] [--json] [--dry-run]\n' +
  '       [--episodic <path>] [--teams-root <dir>]\n' +
  '       teamId по умолчанию — самый свежий каталог в .agent-teams/ (включая archive/).';

/** Статусы задач, после которых задача больше не меняется. */
const TERMINAL_TASK_STATUSES = new Set(['completed', 'failed', 'cancelled']);

/** Разбор argv. Возвращает `{ ok: true, options }` либо `{ ok: false, error }`. */
export function parseArgs(argv) {
  const options = { json: false, dryRun: false, episodicPath: null, teamsRoot: null, teamId: undefined };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const [flag, inline] = arg.startsWith('--') ? arg.split('=', 2) : [arg, undefined];
    if (arg === '-h' || flag === '--help') return { ok: false, error: 'help' };
    if (!arg.startsWith('--')) {
      if (options.teamId !== undefined) return { ok: false, error: `лишний аргумент: ${arg}` };
      options.teamId = arg;
      continue;
    }
    const takeValue = () => {
      if (inline !== undefined) return inline;
      index += 1;
      return argv[index];
    };
    switch (flag) {
      case '--json':
        options.json = true;
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--episodic':
      case '--teams-root': {
        const value = takeValue();
        if (value === undefined || value === '') return { ok: false, error: `флаг ${flag} требует значение` };
        if (flag === '--episodic') options.episodicPath = value;
        else options.teamsRoot = value;
        break;
      }
      default:
        return { ok: false, error: `неизвестный флаг: ${flag}` };
    }
  }
  if (options.teamId !== undefined) {
    if (!/^[A-Za-z0-9._-]+$/.test(options.teamId) || options.teamId === '.' || options.teamId === '..') {
      return { ok: false, error: `недопустимый teamId: ${options.teamId}` };
    }
    if (options.teamId === ARCHIVE_DIR_NAME) {
      return { ok: false, error: `teamId "${ARCHIVE_DIR_NAME}" — это сам каталог архива` };
    }
  }
  return { ok: true, options };
}

/* ------------------------------------------------------------ поиск команд */

/** Каталоги команд: `<root>/*` плюс `<root>/archive/*` (как их видит `run-spec`/плагин). */
export function listTeamDirs(root) {
  const out = [];
  const collect = (base, archived) => {
    let entries;
    try {
      entries = fs.readdirSync(base, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      out.push({ teamId: entry.name, dir: path.join(base, entry.name), archived });
    }
  };
  collect(root, false);
  collect(path.join(root, ARCHIVE_DIR_NAME), true);
  return out;
}

/** `team.json` каталога: `{ json }` либо `{ error }` (нет файла / битый JSON). */
export function readTeamJson(dir) {
  const file = path.join(dir, 'team.json');
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch (error) {
    return { error: error && error.code === 'ENOENT' ? 'нет team.json' : `не читается: ${String(error && error.message)}` };
  }
  try {
    return { json: JSON.parse(raw) };
  } catch (error) {
    return { error: `битый JSON: ${String(error && error.message)}` };
  }
}

/** Метка времени записи: `createdAt` (epoch ms или ISO-строка), фолбэк — mtime team.json. */
export function teamTimestamp(json, dir) {
  const own = toMs(json && json.createdAt);
  if (own !== null) return own;
  try {
    return fs.statSync(path.join(dir, 'team.json')).mtimeMs;
  } catch {
    return null;
  }
}

/** Самый свежий каталог команды; нечитаемые team.json пропускаются. */
export function pickNewestTeam(root) {
  let best = null;
  for (const candidate of listTeamDirs(root)) {
    const read = readTeamJson(candidate.dir);
    if (read.json === undefined) continue;
    const stamp = teamTimestamp(read.json, candidate.dir);
    if (stamp === null) continue;
    if (best === null || stamp > best.stamp) best = { ...candidate, stamp, json: read.json };
  }
  return best;
}

/* --------------------------------------------------------------- выжимка */

/** epoch-ms из number (epoch ms) или ISO-строки; иначе null («неизвестно»). */
function toMs(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

const asRecord = (v) => (v !== null && typeof v === 'object' && !Array.isArray(v) ? v : null);

/** Ревью-задача: явный kind либо роль/тема задачи. */
export function isReviewTask(task) {
  const t = asRecord(task) || {};
  if (String(t.kind || '') === 'review') return true;
  if (/review|ревью|верификац/i.test(String(t.assignee || ''))) return true;
  return /ревью|review\b|verdict\s*=/i.test(String(t.subject || ''));
}

/** Спека прогона: путь `.project/specs/<slug>.md` из описаний, фолбэк — teamId. */
export function extractSpec(json, teamId) {
  const texts = [];
  if (typeof json.description === 'string') texts.push(json.description);
  for (const task of Array.isArray(json.tasks) ? json.tasks : []) {
    const t = asRecord(task) || {};
    for (const key of ['subject', 'description', 'objective']) {
      if (typeof t[key] === 'string') texts.push(t[key]);
    }
  }
  for (const text of texts) {
    const m = /\.project\/specs\/([A-Za-z0-9._-]+)\.md/.exec(text);
    if (!m) continue;
    const slug = m[1];
    const idm = /^(\d{3}[a-z]?)/.exec(slug);
    const specPath = `.project/specs/${slug}.md`;
    return {
      id: idm ? idm[1] : null,
      slug,
      path: specPath,
      from: 'team.json (описания задач)',
      fileExists: fs.existsSync(rel(specPath)),
    };
  }
  const m2 = /^spec-(\d{3}[a-z]?)/.exec(teamId);
  if (m2) return { id: m2[1], slug: null, path: null, from: 'teamId', fileExists: false };
  return null;
}

/** Вердикт: явный `verdict` ревью-задачи → статус ревью-задачи → статус прогона. */
export function pickVerdict(tasks, reviewTasks) {
  const explicit = reviewTasks.filter((r) => typeof r.verdict === 'string' && r.verdict.trim() !== '');
  if (explicit.length > 0) {
    const last = explicit[explicit.length - 1];
    return { value: last.verdict.trim(), source: `ревью-задача ${last.id} (поле verdict)` };
  }
  const completed = reviewTasks.filter((r) => r.status === 'completed');
  if (completed.length > 0) {
    const last = completed[completed.length - 1];
    return { value: 'completed', source: `статус ревью-задачи ${last.id} (вердикт не записан)` };
  }
  if (reviewTasks.length > 0) {
    const last = reviewTasks[reviewTasks.length - 1];
    return { value: null, source: `ревью не завершено: ${last.id} ${last.status}` };
  }
  if (tasks.some((t) => t.status === 'failed')) return { value: 'failed', source: 'есть failed-задачи' };
  if (tasks.length > 0 && tasks.every((t) => TERMINAL_TASK_STATUSES.has(t.status))) {
    return { value: 'completed', source: 'все задачи завершены (ревью-задачи нет)' };
  }
  return { value: null, source: 'вердикта нет (прогон не завершён)' };
}

/** Сводка прогона по `team.json` — источник истины для авто-отчёта. */
export function buildSummary(teamId, meta, json) {
  const tasks = (Array.isArray(json.tasks) ? json.tasks : []).map((task) => {
    const t = asRecord(task) || {};
    return {
      id: typeof t.id === 'string' || typeof t.id === 'number' ? String(t.id) : '?',
      status: typeof t.status === 'string' ? t.status : 'unknown',
      kind: typeof t.kind === 'string' ? t.kind : null,
      assignee: typeof t.assignee === 'string' ? t.assignee : null,
      verdict: typeof t.verdict === 'string' && t.verdict.trim() !== '' ? t.verdict.trim() : null,
      updatedAt: toMs(t.updatedAt),
    };
  });
  const members = (Array.isArray(json.members) ? json.members : []).map((member) => {
    const m = asRecord(member) || {};
    return { id: m.id ?? null, name: m.name ?? null, role: m.role ?? null, status: typeof m.status === 'string' ? m.status : 'unknown' };
  });

  const byStatus = {};
  for (const task of tasks) byStatus[task.status] = (byStatus[task.status] || 0) + 1;
  const membersByStatus = {};
  for (const member of members) membersByStatus[member.status] = (membersByStatus[member.status] || 0) + 1;

  const reviewTasks = tasks.filter(isReviewTask);

  const startedAt = toMs(json.startedAt) ?? toMs(json.createdAt);
  let finishedAt = toMs(json.finishedAt);
  let durationSource = null;
  if (startedAt !== null && finishedAt !== null) {
    durationSource = json.startedAt !== undefined && json.startedAt !== null ? 'startedAt↔finishedAt' : 'createdAt↔finishedAt';
  } else {
    const allTerminal = tasks.length > 0 && tasks.every((t) => TERMINAL_TASK_STATUSES.has(t.status));
    const maxUpdated = tasks.reduce((acc, t) => (t.updatedAt !== null && t.updatedAt > acc ? t.updatedAt : acc), -Infinity);
    if (allTerminal && Number.isFinite(maxUpdated)) {
      finishedAt = maxUpdated;
      durationSource = 'createdAt↔последнее обновление задач';
    }
  }
  const durationMs = startedAt !== null && finishedAt !== null && finishedAt >= startedAt ? finishedAt - startedAt : null;
  if (durationMs === null) durationSource = null;

  const verdict = pickVerdict(tasks, reviewTasks);

  return {
    teamId,
    archived: Boolean(meta && meta.archived),
    teamDir: meta && meta.dir ? path.relative(ROOT, meta.dir).split(path.sep).join('/') : null,
    spec: extractSpec(json, teamId),
    verdict: verdict.value,
    verdictSource: verdict.source,
    durationMs,
    durationSource,
    phase: typeof json.phase === 'string' && json.phase !== '' ? json.phase : null,
    createdAt: toMs(json.createdAt),
    startedAt: toMs(json.startedAt),
    finishedAt: toMs(json.finishedAt),
    tasks: { total: tasks.length, byStatus, finished: tasks.every((t) => TERMINAL_TASK_STATUSES.has(t.status)) },
    review: reviewTasks.map((t) => ({ id: t.id, status: t.status, verdict: t.verdict, assignee: t.assignee, kind: t.kind })),
    members: { total: members.length, byStatus: membersByStatus },
  };
}

/* --------------------------------------------------------------- печать */

const DURATION_UNITS = [
  [3_600_000, 'ч'],
  [60_000, 'мин'],
  [1_000, 'с'],
];

/** Человекочитаемая длительность; null → «—» (неизвестно). */
export function formatDuration(ms) {
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms < 0) return '—';
  if (ms < 1_000) return `${ms} мс`;
  const parts = [];
  let rest = ms;
  for (const [size, unit] of DURATION_UNITS) {
    const value = Math.floor(rest / size);
    if (value > 0 || parts.length > 0) {
      parts.push(`${value} ${unit}`);
      rest -= value * size;
    }
    if (parts.length === 2) break;
  }
  return parts.join(' ');
}

const statusesText = (byStatus) => {
  const keys = Object.keys(byStatus);
  if (keys.length === 0) return '—';
  return keys.map((k) => `${k} ${byStatus[k]}`).join(' · ');
};

/** Короткая метка спеки: `034 (mas-autonomy-b)`; нет данных → «—». */
export function specLabel(spec) {
  if (!spec) return '—';
  const short = spec.slug ? spec.slug.replace(/^(\d{3}[a-z]?)-/, '') : null;
  return `${spec.id ?? '?'}${short ? ` (${short})` : ''}`;
}

/** Выжимка для человека (русский текст, без ANSI). */
export function formatSummary(summary, episodicInfo) {
  const spec = summary.spec;
  const specText = spec
    ? `${specLabel(spec)}${spec.path ? ` — ${spec.path}${spec.fileExists ? '' : ' (файла нет)'}` : ' — из teamId'}` +
      ` [источник: ${spec.from}]`
    : '—';
  const lines = [
    `MAS-прогон: ${summary.teamId}${summary.archived ? ' (в archive/)' : ''}`,
    `  spec:          ${specText}`,
    `  verdict:       ${summary.verdict === null ? '—' : summary.verdict} (${summary.verdictSource})`,
    `  durationMs:    ${summary.durationMs === null ? '— (неизвестно: прогон не завершён)' : `${summary.durationMs} (${formatDuration(summary.durationMs)})`}` +
      `${summary.durationSource === null ? '' : ` [${summary.durationSource}]`}`,
    `  задачи:        ${summary.tasks.total} · ${statusesText(summary.tasks.byStatus)}${summary.tasks.finished ? '' : ' · прогон идёт'}`,
    `  ревью-задачи:  ${summary.review.length === 0 ? '—' : summary.review.map((r) => `${r.id} ${r.status}${r.verdict ? ` (${r.verdict})` : ''}${r.assignee ? ` [${r.assignee}]` : ''}`).join(' · ')}`,
    `  участники:     ${summary.members.total} · ${statusesText(summary.members.byStatus)}`,
    `  каталог:       ${summary.teamDir ?? '—'}`,
    `  episodic:      ${episodicInfo ? `${episodicInfo.path} — ${episodicInfo.reason}` : '—'}`,
  ];
  return lines.join('\n');
}

/* ------------------------------------------------------- правило 12 (память) */

/** Текст записи правила 12 для прогона. */
export function renderEpisodicEntry(summary, dateIso) {
  const spec = summary.spec ? specLabel(summary.spec) : '—';
  const review = summary.review.length === 0
    ? '—'
    : summary.review.map((r) => `${r.id} ${r.status}${r.verdict ? ` (${r.verdict})` : ''}`).join(' · ');
  const duration = summary.durationMs === null ? '—' : `${formatDuration(summary.durationMs)} (${summary.durationMs} мс)`;
  return [
    `## ${dateIso} | ${summary.teamId}`,
    `Авто-отчёт MAS-прогона (\`.project/scripts/report-run.mjs\`). Спека ${spec}. Задачи: ${summary.tasks.total} — ${statusesText(summary.tasks.byStatus)}.`,
    `Ревью: ${review}. Вердикт: ${summary.verdict === null ? '—' : summary.verdict} (${summary.verdictSource}). Длительность: ${duration}.`,
    `Evidence: \`.agent-teams/${summary.archived ? `${ARCHIVE_DIR_NAME}/` : ''}${summary.teamId}\`.`,
    '',
  ].join('\n');
}

/** Заголовок записи этого прогона уже есть в журнале? (идемпотентность) */
export function hasEpisodicEntry(journal, teamId) {
  const escaped = String(teamId).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^##\\s+\\S+\\s*\\|\\s*${escaped}\\s*$`, 'm').test(String(journal));
}

/**
 * Вставка записи в журнал.
 *
 * Записи в тетрадях идут по возрастанию даты, а последней строкой файла стоит
 * служебный `<!-- meta updated: … entries_count: … -->` (его ведёт хранитель и
 * читает `sync.mjs:838`). Поэтому запись вставляется ПЕРЕД trailing meta, а не
 * после — иначе meta перестала бы быть последней строкой файла (ср. alerts.md,
 * где все записи стоят выше meta). Перевод строки подстраивается под файл.
 *
 * Операция — read-modify-write: расчёт на single-writer (владелец памяти), как и
 * требует правило 12. `append`-совместимость: если meta нет, запись идёт в конец.
 */
export function insertEpisodicEntry(journal, entryText) {
  const text = String(journal);
  const eol = /\r\n/.test(text) ? '\r\n' : '\n';
  const block = `${String(entryText).replace(/\r?\n/g, eol)}${eol}`;
  const metaRe = /^<!--\s*meta updated:[^\n]*-->\s*$/gm;
  let lastMeta = null;
  for (let m = metaRe.exec(text); m !== null; m = metaRe.exec(text)) lastMeta = m;
  if (lastMeta === null) {
    const sep = text === '' || text.endsWith(`${eol}${eol}`) ? '' : text.endsWith(eol) ? eol : eol + eol;
    return `${text}${sep}${block}`;
  }
  const before = text.slice(0, lastMeta.index);
  const after = text.slice(lastMeta.index);
  const sep = before.endsWith(`${eol}${eol}`) ? '' : before.endsWith(eol) ? eol : eol + eol;
  return `${before}${sep}${block}${after}`;
}

/* ------------------------------------------------------------------- main */

function usageError(message) {
  return { exitCode: 2, lines: [message, USAGE] };
}

/** Основная операция: никогда не бросает на ожидаемых состояниях. */
export function buildReport(options) {
  const teamsRoot = path.resolve(options.teamsRoot);
  const episodicPath = path.resolve(options.episodicPath);
  const jsonMode = options.json;
  const episodicInfo = { path: path.relative(ROOT, episodicPath).split(path.sep).join('/'), written: false, reason: '' };

  if (!fs.existsSync(teamsRoot)) {
    return {
      exitCode: 0,
      lines: [`no-op: каталога команд нет — ${teamsRoot}. Прогонов MAS ещё не было; файлы не изменены.`],
      report: { ok: true, noop: 'teams-root-absent', teamsRoot, episodic: episodicInfo },
      entry: null,
    };
  }

  let found;
  if (options.teamId === undefined) {
    const newest = pickNewestTeam(teamsRoot);
    if (newest === null) {
      return {
        exitCode: 0,
        lines: [`no-op: в ${teamsRoot} нет ни одного каталога с читаемым team.json (включая archive/); файлы не изменены.`],
        report: { ok: true, noop: 'no-team-json', teamsRoot, episodic: episodicInfo },
        entry: null,
      };
    }
    found = newest;
  } else {
    const direct = { teamId: options.teamId, dir: path.join(teamsRoot, options.teamId), archived: false };
    const archived = { teamId: options.teamId, dir: path.join(teamsRoot, ARCHIVE_DIR_NAME, options.teamId), archived: true };
    const inLive = fs.existsSync(path.join(direct.dir, 'team.json'));
    const inArchive = fs.existsSync(path.join(archived.dir, 'team.json'));
    const chosen = inLive ? direct : inArchive ? archived : null;
    if (chosen === null) {
      return {
        exitCode: 0,
        lines: [
          `no-op: нет team.json для команды ${options.teamId} —`,
          `  ни ${direct.dir}`,
          `  ни ${archived.dir}. Команда ещё идёт или id указан неверно; файлы не изменены.`,
        ],
        report: { ok: true, noop: 'team-json-absent', teamId: options.teamId, teamsRoot, episodic: episodicInfo },
        entry: null,
      };
    }
    const read = readTeamJson(chosen.dir);
    if (read.json === undefined) {
      return { exitCode: 1, lines: [`ошибка: ${read.error} — ${path.join(chosen.dir, 'team.json')}`], report: null, entry: null };
    }
    found = { ...chosen, json: read.json };
  }

  const summary = buildSummary(found.teamId, found, found.json);
  const dateIso = new Date().toISOString().slice(0, 10);
  const entry = renderEpisodicEntry(summary, dateIso);

  if (jsonMode) {
    episodicInfo.reason = 'не пишется: режим --json (read-only)';
  } else if (options.dryRun) {
    episodicInfo.reason = 'не пишется: режим --dry-run';
  } else if (!fs.existsSync(episodicPath)) {
    episodicInfo.reason = `ошибка: файла нет — ${episodicPath}`;
    return {
      exitCode: 1,
      lines: [`ошибка: журнал памяти не найден — ${episodicPath}`],
      report: { ok: false, ...summary, episodic: episodicInfo },
      entry,
    };
  } else {
    const journal = fs.readFileSync(episodicPath, 'utf8');
    if (hasEpisodicEntry(journal, summary.teamId)) {
      episodicInfo.reason = 'не пишется: запись этого прогона уже есть (идемпотентно)';
    } else {
      fs.writeFileSync(episodicPath, insertEpisodicEntry(journal, entry), 'utf8');
      episodicInfo.written = true;
      episodicInfo.reason = 'запись правила 12 добавлена (перед trailing meta-комментарием)';
    }
  }

  const report = {
    ok: true,
    noop: null,
    ...summary,
    episodic: episodicInfo,
  };
  const lines = [formatSummary(summary, episodicInfo)];
  if (!summary.tasks.finished) {
    lines.push('  внимание:      прогон ещё идёт (есть незавершённые задачи) — выжимка промежуточная');
  }
  if (episodicInfo.written) lines.push(`  запись:        ${entry}`);
  return { exitCode: 0, lines, report, entry };
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  if (!parsed.ok) {
    if (parsed.error === 'help') {
      process.stdout.write(`${USAGE}\n`);
      process.exitCode = 0;
      return;
    }
    const failure = usageError(parsed.error);
    process.stderr.write(`${failure.lines.join('\n')}\n`);
    process.exitCode = failure.exitCode;
    return;
  }
  const options = parsed.options;
  if (options.teamsRoot === null) options.teamsRoot = DEFAULT_TEAMS_ROOT;
  if (options.episodicPath === null) options.episodicPath = DEFAULT_EPISODIC_PATH;

  let result;
  try {
    result = buildReport(options);
  } catch (error) {
    process.stderr.write(`ошибка: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
    return;
  }
  if (options.json) {
    process.stdout.write(`${JSON.stringify({ exitCode: result.exitCode, ...(result.report ?? {}) }, null, 2)}\n`);
  } else {
    (result.exitCode === 0 ? process.stdout : process.stderr).write(`${result.lines.join('\n')}\n`);
  }
  process.exitCode = result.exitCode;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  await main();
}
