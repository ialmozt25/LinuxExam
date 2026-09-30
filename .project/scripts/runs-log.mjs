// runs-log.mjs — метрики MAS-прогона: идемпотентная дозапись в историю (spec 034, B.4 / task t4).
//
// Что делает (zero новых зависимостей, Node ESM):
//   1) читает `.agent-teams/<teamId>/team.json` (teamId по умолчанию — самый свежий
//      каталог в `.agent-teams/`, включая `archive/`, по `createdAt` с фолбэком на mtime);
//   2) строит запись прогона для истории `.project/mas-runs.json`;
//   3) идемпотентно дописывает РОВНО ОДНУ запись — атомарно (tmp + rename), как
//      `run-spec.mjs:649-652`; повторный вызов на том же teamId — no-op
//      (файл побайтово не меняется) + WARN + exit 0.
//
// Схема записи истории (контракт spec 034, зафиксирован оркестратором):
//   Базовая часть (её пишет run-spec.mjs): `spec`, `startedAt`, `finishedAt`, `status`, `report`.
//   Расширение (его пишет runs-log.mjs) — четыре ОПЦИОНАЛЬНЫХ поля записи:
//     * `teamId`     — string|null; имя каталога команды `.agent-teams/<teamId>/`;
//     * `durationMs` — целое ≥ 0 | null; finishedAt − startedAt в миллисекундах;
//     * `tokens`     — `{input, output, total}` (неотрицательные целые) | null;
//     * `verdict`    — string|null; вердикт ревью-прогона.
//   Отсутствие поля = «неизвестно». Читатели (`sync.mjs` — блок «Последний MAS-прогон»,
//   `report-run.mjs`) обязаны определять наличие полей ПО ФАКТУ, а не по `version`.
//
//   ПОЧЕМУ `version` НЕ МЕНЯЕТСЯ: писатель `run-spec.mjs:647` при каждой дозаписи жёстко
//   ставит `doc.version = 1`, поэтому `version` не может служить маркером схемы — старую
//   запись от новой по нему не отличить ни при каком значении. Этот скрипт зеркалит
//   поведение писателя (тоже ставит 1): иначе две записи в одной истории имели бы разные
//   `version`, что противоречило бы контракту «version не меняется».
//
// Откуда берётся каждое поле (какой ключ team.json) — нет источника → null:
//   * teamId     ← имя каталога команды (не содержимое файла), напр. `spec-034-mas-autonomy-b`;
//   * spec       ← первый `.project/specs/<slug>.md` в `description`, `subject` или
//                  `objective` задач; id = `^(\d{3}[a-z]?)` из slug; фолбэк — `^spec-(\d{3}[a-z]?)`
//                  из teamId; иначе null;
//   * startedAt  ← `team.json.startedAt` (ISO-строка или epoch-ms), фолбэк — `team.json.createdAt`
//                  (epoch-ms); нет источника → null;
//   * finishedAt ← `team.json.finishedAt`; если ключа нет, но ВСЕ задачи терминальны
//                  (completed/failed/cancelled) — максимум `tasks[].updatedAt`; иначе null;
//   * durationMs ← `finishedAt − startedAt` (мс) и только если оба известны и finishedAt ≥
//                  startedAt; иначе null (ничего не «досчитывается» произвольно);
//   * status     ← `team.json.phase`, иначе `halted === true` → "halted", иначе все задачи
//                  терминальны → "completed", иначе → "in-progress"; нет задач → "unknown";
//   * verdict    ← 1) поле `verdict` последней ревью-задачи (`kind === "review"` либо
//                  role/assignee/subject про ревью), если оно непустое; 2) статус последней
//                  completed ревью-задачи → "completed"; 3) "failed", если есть failed-задача;
//                  4) "completed", если все задачи терминальны; иначе null.
//                  Алгоритм 1:1 повторяет `pickVerdict` из `report-run.mjs` (согласовано с t2),
//                  чтобы запись истории и блок «Последний MAS-прогон» показывали один вердикт;
//   * tokens     ← `team.json.tokens` → `team.json.usage` → `<teamDir>/report.json`
//                  (`.tokens` / `.usage`); принимаются ключи `input|input_tokens|inputTokens`,
//                  `output|output_tokens|outputTokens`, `total|total_tokens|totalTokens`;
//                  `total` выводится как `input + output`, только если он не задан явно.
//                  Все три значения обязаны быть неотрицательными целыми — иначе (в т.ч.
//                  если чего-то не хватает) поле равно null. ФАКТ, проверенный при реализации:
//                  ни в одном `.agent-teams/**/team.json` этих ключей сейчас нет, поэтому
//                  `tokens = null` — это «источника нет», а не выдуманное значение;
//   * tasks      ← сводка задач по статусам (аддитивное поле вне четырёх полей контракта:
//                  `sync.mjs` читает `record.tasks` для строки «задачи:» блока центра и для
//                  ЖИВОЙ неархивной команды иначе показывает «—»);
//   * report     ← провенанс: tool, путь к team.json, sha256 team.json, источники полей.
//
// Валидация и запись:
//   * перед записью история читается и проверяется — нужен объект с массивом `runs`;
//     невалидный файл (битый JSON, не объект, нет массива runs) → запись ОТМЕНЯЕТСЯ,
//     файл не меняется, exit 1;
//   * запись атомарная: `<history>.tmp-<pid>` → `rename` (как `run-spec.mjs`);
//   * отсутствующий файл истории создаётся (`mkdir -p` + запись);
//   * идемпотентность: ключ `teamId`; при его отсутствии — `spec|startedAt`.
//
// Режимы:
//   * `--dry-run` — считает запись и печатает план, НИЧЕГО не пишет (exit 0);
//   * `--json`    — только формат вывода (машиночитаемо); запись выполняется как обычно.
//     Чтобы «только посмотреть» — добавьте `--dry-run`.
//
// Использование:
//   node .project/scripts/runs-log.mjs [teamId] [--history <path>] [--dry-run] [--json]
//        [--teams-root <dir>]
//
// Коды выхода:
//   0 — запись добавлена; либо штатный no-op (идемпотентный повтор, нет каталога команд,
//       нет team.json, dry-run);
//   1 — ошибка ввода-вывода или формата истории (запись отменена, файл не изменён);
//   2 — ошибка использования (неизвестный флаг, нет значения, недопустимый teamId).

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
// Путь внутри репозитория. Хелпер ВАРИАДИЧЕСКИЙ: `rel('.project', 'mas-runs.json')`
// должен давать `<ROOT>/.project/mas-runs.json`. При унарной версии второй аргумент
// молча отбрасывался и `DEFAULT_HISTORY_PATH` указывал на каталог `<ROOT>/.project`
// (дефект t7: `npm run runs:log` без `--history` падал с EISDIR).
const rel = (...segments) => path.join(ROOT, ...segments);

/** Каталог состояния команд (совпадает с `run-spec.mjs` и `sync.mjs`). */
export const DEFAULT_TEAMS_ROOT = rel('.agent-teams');
/** История прогонов по умолчанию (совпадает с `run-spec.mjs:HISTORY_PATH`). */
export const DEFAULT_HISTORY_PATH = rel('.project', 'mas-runs.json');
/** Каталог архива команд внутри teamsRoot (совпадает с плагином). */
export const ARCHIVE_DIR_NAME = 'archive';
/**
 * `version` документа истории. НЕ маркер схемы: `run-spec.mjs:647` всегда пишет 1;
 * этот скрипт зеркалит писателя, чтобы история оставалась однородной.
 */
export const HISTORY_VERSION = 1;

const USAGE =
  'usage: node .project/scripts/runs-log.mjs [teamId] [--history <path>] [--dry-run] [--json]\n' +
  '       [--teams-root <dir>]\n' +
  '       teamId по умолчанию — самый свежий каталог в .agent-teams/ (включая archive/);\n' +
  '       история по умолчанию — .project/mas-runs.json; повторный вызов на том же teamId — no-op.';

/** Статусы задач, после которых задача больше не меняется. */
const TERMINAL_TASK_STATUSES = new Set(['completed', 'failed', 'cancelled']);

/* ------------------------------------------------------------------- argv */

/** Разбор argv. Возвращает `{ ok: true, options }` либо `{ ok: false, error }`. */
export function parseArgs(argv) {
  const options = {
    teamId: undefined,
    historyPath: null,
    teamsRoot: null,
    dryRun: false,
    json: false,
  };
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
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--json':
        options.json = true;
        break;
      case '--history':
      case '--teams-root': {
        const value = takeValue();
        if (value === undefined || value === '') return { ok: false, error: `флаг ${flag} требует значение` };
        if (flag === '--history') options.historyPath = value;
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

/* -------------------------------------------------------------- утилиты */

const asRecord = (v) => (v !== null && typeof v === 'object' && !Array.isArray(v) ? v : null);

/** epoch-ms из number (epoch ms) или ISO-строки; иначе null («неизвестно»). */
export function toMs(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/** ISO-строка из epoch-ms; null → null (поле «неизвестно»). */
const toIso = (ms) => (ms === null ? null : new Date(ms).toISOString());

/** Путь для печати: относительно корня репозитория, если он внутри корня. */
function displayPath(absolute) {
  const relative = path.relative(ROOT, absolute);
  if (relative === '') return '.';
  if (!relative.startsWith('..') && !path.isAbsolute(relative)) return relative.split(path.sep).join('/');
  return absolute;
}

/** sha256 текста (hex) — для провенанса записи (какой именно team.json прочитан). */
export function sha256Text(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

/* ---------------------------------------------------------- поиск команд */

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

/** `team.json` каталога: `{ json, raw }` либо `{ error }` (нет файла / битый JSON). */
export function readTeamJson(dir) {
  const file = path.join(dir, 'team.json');
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch (error) {
    const code = error && error.code;
    return { error: code === 'ENOENT' ? 'нет team.json' : `не читается: ${String(error && error.message)}` };
  }
  try {
    return { json: JSON.parse(raw), raw, file };
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
    if (best === null || stamp > best.stamp) best = { ...candidate, stamp, json: read.json, raw: read.raw, file: read.file };
  }
  return best;
}

/* --------------------------------------------------------------- выжимка */

/** Ревью-задача: явный kind либо роль/assignee/тема задачи. */
export function isReviewTask(task) {
  const t = asRecord(task) || {};
  if (String(t.kind || '') === 'review') return true;
  if (/review|ревью|верификац/i.test(String(t.assignee || ''))) return true;
  return /ревью|review\b|verdict\s*=/i.test(String(t.subject || ''));
}

/** Спека прогона: путь `.project/specs/<slug>.md` из описаний, фолбэк — teamId. */
export function extractSpecId(json, teamId) {
  const texts = [];
  if (typeof json.description === 'string') texts.push(json.description);
  for (const task of Array.isArray(json.tasks) ? json.tasks : []) {
    const t = asRecord(task) || {};
    for (const key of ['subject', 'description', 'objective']) {
      if (typeof t[key] === 'string') texts.push(t[key]);
    }
  }
  for (const text of texts) {
    const found = /\.project\/specs\/([A-Za-z0-9._-]+)\.md/.exec(text);
    if (!found) continue;
    const idm = /^(\d{3}[a-z]?)/.exec(found[1]);
    return { id: idm ? idm[1] : null, slug: found[1], from: 'team.json (описания задач)' };
  }
  const fallback = /^spec-(\d{3}[a-z]?)/.exec(String(teamId || ''));
  if (fallback) return { id: fallback[1], slug: null, from: 'teamId' };
  return { id: null, slug: null, from: null };
}

/**
 * Вердикт: явный `verdict` ревью-задачи → статус ревью-задачи → статус прогона.
 * Алгоритм 1:1 повторяет `report-run.mjs:pickVerdict` (согласовано внутри spec 034).
 */
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

/** Неотрицательное целое или null. */
const asCount = (value) => (Number.isSafeInteger(value) && value >= 0 ? value : null);

/** Нормализация токенов: `{input, output, total}` (все три — целые ≥ 0) либо null. */
export function normalizeTokens(raw) {
  const t = asRecord(raw);
  if (t === null) return null;
  const input = asCount(t.input ?? t.input_tokens ?? t.inputTokens);
  const output = asCount(t.output ?? t.output_tokens ?? t.outputTokens);
  let total = asCount(t.total ?? t.total_tokens ?? t.totalTokens);
  if (total === null && input !== null && output !== null) total = input + output;
  if (input === null || output === null || total === null) return null;
  return { input, output, total };
}

/**
 * Токены прогона: только из реально существующего источника, иначе null.
 * Источники: `team.json.tokens` → `team.json.usage` → `<teamDir>/report.json` (tokens/usage).
 */
export function readTokens(teamDir, json) {
  const candidates = [
    ['team.json.tokens', json && json.tokens],
    ['team.json.usage', json && json.usage],
  ];
  let reportJson = null;
  const reportFile = path.join(teamDir, 'report.json');
  if (fs.existsSync(reportFile)) {
    try {
      reportJson = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
    } catch {
      reportJson = null;
    }
  }
  if (reportJson !== null) {
    candidates.push(['report.json.tokens', reportJson.tokens], ['report.json.usage', reportJson.usage]);
  }
  for (const [source, raw] of candidates) {
    const value = normalizeTokens(raw);
    if (value !== null) return { value, source };
  }
  return { value: null, source: null };
}

/** Сводка задач по статусам (аддитивное поле `tasks` для блока «Последний MAS-прогон»). */
export function taskCounts(json) {
  const tasks = Array.isArray(json.tasks) ? json.tasks : [];
  const counts = {};
  for (const task of tasks) {
    const t = asRecord(task) || {};
    const status = typeof t.status === 'string' && t.status !== '' ? t.status : 'unknown';
    counts[status] = (counts[status] || 0) + 1;
  }
  return counts;
}

/** Статус прогона: `phase` → halted → все задачи терминальны → in-progress → unknown. */
export function runStatus(json, tasks) {
  if (typeof json.phase === 'string' && json.phase.trim() !== '') return json.phase.trim();
  if (json.halted === true) return 'halted';
  if (tasks.length === 0) return 'unknown';
  return tasks.every((t) => TERMINAL_TASK_STATUSES.has(t.status)) ? 'completed' : 'in-progress';
}

/**
 * Запись прогона для истории. Ни одно значение не выдумано: у каждого поля либо
 * реальный источник в `team.json`, либо null («неизвестно»).
 * @param {string} teamId
 * @param {{dir: string, archived: boolean, json: object, raw: string}} found
 */
export function buildRunRecord(teamId, found) {
  const json = found.json;
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
  const reviewTasks = tasks.filter(isReviewTask);

  const spec = extractSpecId(json, teamId);
  const startedMs = toMs(json.startedAt) ?? toMs(json.createdAt);
  let finishedMs = toMs(json.finishedAt);
  let durationSource = null;
  if (startedMs !== null && finishedMs !== null) {
    durationSource = json.startedAt !== undefined && json.startedAt !== null ? 'startedAt↔finishedAt' : 'createdAt↔finishedAt';
  } else {
    const allTerminal = tasks.length > 0 && tasks.every((t) => TERMINAL_TASK_STATUSES.has(t.status));
    const maxUpdated = tasks.reduce((acc, t) => (t.updatedAt !== null && t.updatedAt > acc ? t.updatedAt : acc), -Infinity);
    if (allTerminal && Number.isFinite(maxUpdated)) {
      finishedMs = maxUpdated;
      durationSource = 'createdAt↔последнее обновление задач';
    }
  }
  const durationMs = startedMs !== null && finishedMs !== null && finishedMs >= startedMs ? finishedMs - startedMs : null;
  if (durationMs === null) durationSource = null;

  const verdict = pickVerdict(tasks, reviewTasks);
  const tokens = readTokens(found.dir, json);

  const counts = taskCounts(json);
  const record = {
    spec: spec.id,
    teamId,
    startedAt: toIso(startedMs),
    finishedAt: toIso(finishedMs),
    status: runStatus(json, tasks),
    durationMs,
    tokens: tokens.value,
    verdict: verdict.value,
    tasks: Object.keys(counts).length > 0 ? counts : null,
    report: {
      tool: 'runs-log',
      historyVersion: HISTORY_VERSION,
      teamFile: displayPath(path.join(found.dir, 'team.json')),
      teamFileSha256: sha256Text(found.raw),
      archived: Boolean(found.archived),
      specSource: spec.from,
      specSlug: spec.slug,
      durationSource,
      verdictSource: verdict.source,
      tokensSource: tokens.source,
      schemaFields: ['teamId', 'durationMs', 'tokens', 'verdict'],
    },
  };
  const meta = {
    spec,
    durationSource,
    verdictSource: verdict.source,
    tokensSource: tokens.source,
    counts,
    finished: tasks.length > 0 && tasks.every((t) => TERMINAL_TASK_STATUSES.has(t.status)),
  };
  return { record, meta };
}

/* ------------------------------------------------------------- история */

/**
 * Прочитать историю. Отсутствующий файл — пустая история; нечитаемый/битый файл —
 * ошибка (молча ломать историю запрещено). Формат: объект с массивом `runs`.
 */
export function readHistory(historyPath) {
  let raw;
  try {
    raw = fs.readFileSync(historyPath, 'utf8');
  } catch (error) {
    const code = error && error.code;
    if (code === 'ENOENT') return { doc: { version: HISTORY_VERSION, runs: [] }, exists: false, raw: null };
    throw new Error(`история не читается: ${displayPath(historyPath)} (${code ?? 'unknown'})`);
  }
  let doc;
  try {
    doc = JSON.parse(raw);
  } catch {
    throw new Error(`история ${displayPath(historyPath)} не разбирается как JSON`);
  }
  if (doc === null || typeof doc !== 'object' || Array.isArray(doc) || !Array.isArray(doc.runs)) {
    throw new Error(`история ${displayPath(historyPath)} имеет неожидаемый формат (нужен объект с массивом runs)`);
  }
  return { doc, exists: true, raw };
}

/** Ключ идемпотентности записи: `teamId`, при его отсутствии — `spec|startedAt`. */
export function runKey(record) {
  const teamId = record && typeof record.teamId === 'string' ? record.teamId.trim() : '';
  if (teamId !== '') return `teamId:${teamId}`;
  const spec = record && typeof record.spec === 'string' ? record.spec : '';
  const startedAt = record && typeof record.startedAt === 'string' ? record.startedAt : '';
  return `${spec}|${startedAt}`;
}

/** Индекс существующей записи с тем же ключом или -1. */
export function findExistingIndex(runs, key) {
  for (let index = 0; index < runs.length; index += 1) {
    const record = asRecord(runs[index]);
    if (record === null) continue;
    if (runKey(record) === key) return index;
  }
  return -1;
}

/* ------------------------------------------------------------ операция */

/**
 * Основная операция: никогда не бросает на ожидаемых состояниях.
 * Возвращает `{ exitCode, lines, warn, report }`.
 */
export function buildRunLog(options) {
  const teamsRoot = path.resolve(options.teamsRoot === null || options.teamsRoot === undefined ? DEFAULT_TEAMS_ROOT : options.teamsRoot);
  const historyPath = path.resolve(options.historyPath === null || options.historyPath === undefined ? DEFAULT_HISTORY_PATH : options.historyPath);
  const historyLabel = displayPath(historyPath);
  const base = {
    tool: 'runs-log',
    ok: true,
    noop: null,
    teamsRoot: displayPath(teamsRoot),
    historyPath: historyLabel,
    dryRun: Boolean(options.dryRun),
    jsonMode: Boolean(options.json),
    written: false,
    appended: false,
    totalBefore: null,
    totalAfter: null,
    idempotencyKey: null,
    record: null,
    warn: null,
  };

  // 1) каталог команд
  if (!fs.existsSync(teamsRoot)) {
    const text = `no-op: каталога команд нет — ${displayPath(teamsRoot)}. Прогонов MAS ещё не было; файлы не изменены.`;
    return { exitCode: 0, lines: [text], warn: null, report: { ...base, noop: 'teams-root-absent' } };
  }

  // 2) сама команда
  let found;
  if (options.teamId === undefined) {
    const newest = pickNewestTeam(teamsRoot);
    if (newest === null) {
      const text = `no-op: в ${displayPath(teamsRoot)} нет ни одного каталога с читаемым team.json (включая archive/); файлы не изменены.`;
      return { exitCode: 0, lines: [text], warn: null, report: { ...base, noop: 'no-team-json' } };
    }
    found = newest;
  } else {
    const direct = { teamId: options.teamId, dir: path.join(teamsRoot, options.teamId), archived: false };
    const archived = { teamId: options.teamId, dir: path.join(teamsRoot, ARCHIVE_DIR_NAME, options.teamId), archived: true };
    const inLive = fs.existsSync(path.join(direct.dir, 'team.json'));
    const inArchive = fs.existsSync(path.join(archived.dir, 'team.json'));
    const chosen = inLive ? direct : inArchive ? archived : null;
    if (chosen === null) {
      const lines = [
        `no-op: нет team.json для команды ${options.teamId} —`,
        `  ни ${displayPath(direct.dir)}`,
        `  ни ${displayPath(archived.dir)}. Команда ещё идёт или id указан неверно; файлы не изменены.`,
      ];
      return { exitCode: 0, lines, warn: null, report: { ...base, noop: 'team-json-absent', teamId: options.teamId } };
    }
    const read = readTeamJson(chosen.dir);
    if (read.json === undefined) {
      return {
        exitCode: 1,
        lines: [`ошибка: ${read.error} — ${displayPath(path.join(chosen.dir, 'team.json'))}; файлы не изменены.`],
        warn: null,
        report: { ...base, ok: false, teamId: options.teamId, error: read.error },
      };
    }
    found = { ...chosen, json: read.json, raw: read.raw, file: read.file };
  }

  // 3) запись прогона
  const { record, meta } = buildRunRecord(found.teamId, found);
  const key = runKey(record);
  const report = {
    ...base,
    teamId: found.teamId,
    archived: Boolean(found.archived),
    teamFile: displayPath(path.join(found.dir, 'team.json')),
    idempotencyKey: key,
    record,
  };

  // 4) история: чтение + валидация (невалидный файл → запись отменяется)
  let history;
  try {
    history = readHistory(historyPath);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return {
      exitCode: 1,
      lines: [`ошибка: ${reason} — запись отменена, файл не изменён.`],
      warn: null,
      report: { ...report, ok: false, error: reason },
    };
  }
  const runs = history.doc.runs;
  report.totalBefore = runs.length;
  report.historyExists = history.exists;

  const existingIndex = findExistingIndex(runs, key);

  // 5) идемпотентный no-op
  if (existingIndex >= 0) {
    const warn =
      `WARN: запись прогона уже есть в истории — ${historyLabel} (индекс ${existingIndex}, ключ ${key}). ` +
      'no-op: файл побайтово не изменён.';
    const lines = [
      `runs:log — команда ${found.teamId}`,
      `  история:      ${historyLabel} (записей ${runs.length})`,
      `  ключ:         ${key}`,
      '  результат:    no-op (идемпотентный повтор, запись уже есть) — файл не изменён',
    ];
    return { exitCode: 0, lines, warn, report: { ...report, noop: 'already-logged', totalAfter: runs.length, warn } };
  }

  // 6) dry-run — ничего не пишем
  if (options.dryRun) {
    const lines = [
      `runs:log — команда ${found.teamId} (dry-run)`,
      ...formatRecordLines(record, meta, found),
      `  история:      ${historyLabel} (записей до: ${runs.length})`,
      '  результат:    dry-run — запись не добавлена, файл не изменён',
    ];
    return { exitCode: 0, lines, warn: null, report: { ...report, noop: 'dry-run', totalAfter: runs.length } };
  }

  // 7) атомарная дозапись (tmp + rename), как в run-spec.mjs
  history.doc.version = HISTORY_VERSION;
  history.doc.runs.push(record);
  const text = `${JSON.stringify(history.doc, null, 2)}\n`;
  const temporary = `${historyPath}.tmp-${process.pid}`;
  try {
    fs.mkdirSync(path.dirname(historyPath), { recursive: true });
    fs.writeFileSync(temporary, text, 'utf8');
    fs.renameSync(temporary, historyPath);
  } catch (error) {
    try {
      fs.unlinkSync(temporary);
    } catch {
      /* временного файла нет — нечего убирать */
    }
    const reason = error instanceof Error ? error.message : String(error);
    return {
      exitCode: 1,
      lines: [`ошибка записи истории: ${reason} — файл не изменён.`],
      warn: null,
      report: { ...report, ok: false, error: reason, totalAfter: runs.length - 1 },
    };
  }

  const lines = [
    `runs:log — команда ${found.teamId}`,
    ...formatRecordLines(record, meta, found),
    `  история:      ${historyLabel} (записей до: ${report.totalBefore})`,
    `  результат:    дозаписана 1 запись → всего ${history.doc.runs.length}`,
  ];
  return {
    exitCode: 0,
    lines,
    warn: null,
    report: { ...report, appended: true, written: true, totalAfter: history.doc.runs.length },
  };
}

/** Человекочитаемые строки записи прогона. */
function formatRecordLines(record, meta, found) {
  const specText = record.spec === null
    ? '— (не удалось определить из team.json)'
    : `${record.spec}${meta.spec.slug ? ` (.project/specs/${meta.spec.slug}.md)` : ''}`;
  return [
    `  спека:        ${specText}`,
    `  team.json:    ${displayPath(path.join(found.dir, 'team.json'))}${found.archived ? ' (archive)' : ''}`,
    `  статус:       ${record.status}`,
    `  startedAt:    ${record.startedAt ?? '— (нет startedAt/createdAt)'}`,
    `  finishedAt:   ${record.finishedAt ?? '— (прогон не завершён)'}`,
    `  durationMs:   ${record.durationMs === null ? '— (неизвестно)' : `${record.durationMs} (${formatDuration(record.durationMs)})`}${meta.durationSource ? ` [${meta.durationSource}]` : ''}`,
    `  verdict:      ${record.verdict === null ? '—' : record.verdict} [${meta.verdictSource}]`,
    `  tokens:       ${record.tokens === null ? '— (источника нет)' : `input ${record.tokens.input} · output ${record.tokens.output} · total ${record.tokens.total}`}${meta.tokensSource ? ` [${meta.tokensSource}]` : ''}`,
    `  задачи:       ${Object.keys(meta.counts).length === 0 ? '—' : Object.keys(meta.counts).sort().map((k) => `${k} ${meta.counts[k]}`).join(' · ')}`,
  ];
}

const DURATION_UNITS = [
  [3_600_000, 'ч'],
  [60_000, 'мин'],
  [1_000, 'с'],
];

/** Человекочитаемая длительность; null → «—». */
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

/* ------------------------------------------------------------------ main */

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  if (!parsed.ok) {
    if (parsed.error === 'help') {
      process.stdout.write(`${USAGE}\n`);
      process.exitCode = 0;
      return;
    }
    process.stderr.write(`ошибка: ${parsed.error}\n${USAGE}\n`);
    process.exitCode = 2;
    return;
  }
  const options = parsed.options;
  if (options.historyPath === null) options.historyPath = DEFAULT_HISTORY_PATH;
  if (options.teamsRoot === null) options.teamsRoot = DEFAULT_TEAMS_ROOT;

  let result;
  try {
    result = buildRunLog(options);
  } catch (error) {
    process.stderr.write(`ошибка: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
    return;
  }
  if (options.json) {
    process.stdout.write(`${JSON.stringify({ exitCode: result.exitCode, ...result.report }, null, 2)}\n`);
  } else {
    (result.exitCode === 0 ? process.stdout : process.stderr).write(`${result.lines.join('\n')}\n`);
  }
  if (result.warn !== null) process.stderr.write(`${result.warn}\n`);
  process.exitCode = result.exitCode;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  await main();
}
