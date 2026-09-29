// archive-team.mjs — архивация каталога MAS-команды ВНЕ плагина (spec 032, task t2).
//
// Зачем: `agent_teams_delete()` в spec-030 и spec-031 два прогона подряд падал с
// EPERM на последнем шаге `archiveTeamDir()` — `rename(.agent-teams/<teamId> ->
// .agent-teams/archive/<teamId>)`. Плагин повторяет rename 3 раза по 50 мс
// (`@nanmicoder/dsh-agent-teams/lib/state.js:508-510, :802-816`), и если файл
// внутри каталога открыт без FILE_SHARE_DELETE (живая сессия/подпроцесс, скан
// антивируса, индексатор), EPERM держится дольше — ошибка выходит наружу, а
// evidence остаётся в `.agent-teams/<teamId>` (docs/memory/alerts.md, 2026-09-29).
//
// Этот хелпер делает тот же шаг семантически: `<root>/<teamId>` ->
// `<root>/archive/<teamId>`, но с окном ожидания (retry/backoff), понятной
// ошибкой и идемпотентностью.
//
// Использование (root по умолчанию — `<repo>/.agent-teams`):
//   node .project/scripts/archive-team.mjs <teamId>
//   node .project/scripts/archive-team.mjs <teamId> --root <dir>
//   node .project/scripts/archive-team.mjs <teamId> --check      # только статус
//   node .project/scripts/archive-team.mjs <teamId> --dry-run    # без изменений
//   node .project/scripts/archive-team.mjs <teamId> --timeout-ms 120000
//
// Коды выхода:
//   0 — архивировано, либо no-op (уже в archive/, либо нет исходного каталога);
//   1 — неожиданная ошибка ввода-вывода (в т.ч. JSON не разобран);
//   2 — ошибка использования/ввода (плохой флаг, нет id, конфликт имён);
//   3 — каталог удерживается: EPERM/EACCES/EBUSY/ENOTEMPTY держатся дольше окна.
//
// ВАЖНО: удержание — это не баг самого каталога. Каталог архивируем вне живой
// сессии DSH: `agent_teams_delete()` вызывается в конце команды, когда подпроцессы
// членов ещё не завершились. Ошибка exit 3 печатает диагностику (какие файлы не
// открываются эксклюзивно) и остаётся идемпотентной — повторный запуск безопасен.

import fsp from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

/** Имя каталога архива внутри root — совпадает с плагином (`archiveTeamDir`). */
export const ARCHIVE_DIR_NAME = 'archive';

/** Префикс отложенной предыдущей генерации архива — совпадает с плагином. */
export const PREVIOUS_PREFIX = '.';

/** Коды ошибок rename, которые на Windows означают «цель/источник удерживается». */
export const RETRYABLE_CODES = new Set(['EPERM', 'EACCES', 'EBUSY', 'ENOTEMPTY', 'EEXIST']);

const USAGE =
  'usage: node .project/scripts/archive-team.mjs <teamId> [--root <dir>] [--check] [--dry-run]\n' +
  '       [--timeout-ms <ms>] [--initial-delay-ms <ms>] [--max-delay-ms <ms>] [--json]';

const DEFAULTS = {
  root: null,
  check: false,
  dryRun: false,
  json: false,
  timeoutMs: 60_000,
  initialDelayMs: 100,
  maxDelayMs: 2_000,
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Разбор argv. Возвращает `{ ok: true, options }` или `{ ok: false, error }`. */
export function parseArgs(argv) {
  const options = { ...DEFAULTS };
  let teamId;
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
      if (teamId !== undefined) return { ok: false, error: `лишний аргумент: ${arg}` };
      teamId = arg;
      continue;
    }
    switch (flag) {
      case '--root':
        options.root = takeValue();
        break;
      case '--check':
        options.check = true;
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--json':
        options.json = true;
        break;
      case '--timeout-ms':
      case '--initial-delay-ms':
      case '--max-delay-ms': {
        const raw = takeValue();
        const value = Number(raw);
        if (raw === undefined || !Number.isFinite(value) || value < 0) {
          return { ok: false, error: `флаг ${flag} требует неотрицательное число` };
        }
        if (flag === '--timeout-ms') options.timeoutMs = value;
        if (flag === '--initial-delay-ms') options.initialDelayMs = value;
        if (flag === '--max-delay-ms') options.maxDelayMs = value;
        break;
      }
      default:
        return { ok: false, error: `неизвестный флаг: ${flag}` };
    }
  }
  if (options.check && options.dryRun) {
    return { ok: false, error: '--check и --dry-run взаимоисключающи' };
  }
  if (!teamId) return { ok: false, error: 'не задан teamId' };
  if (!/^[A-Za-z0-9._-]+$/.test(teamId) || teamId === '.' || teamId === '..') {
    return { ok: false, error: `недопустимый teamId: ${teamId}` };
  }
  if (teamId === ARCHIVE_DIR_NAME) {
    return { ok: false, error: `teamId "${ARCHIVE_DIR_NAME}" — это сам каталог архива` };
  }
  options.teamId = teamId;
  return { ok: true, options };
}

/**
 * Канонический абсолютный путь. Нужен, потому что Windows отдаёт каталог в
 * 8.3-форме (`C:\Users\ALEXEY~1\AppData\...`), а `process.cwd()` — в длинной;
 * сравнение строк без канонизации даёт ложные «пути не совпадают».
 */
async function canonical(target) {
  const absolute = path.resolve(target);
  try {
    return await fsp.realpath(absolute);
  } catch {
    return absolute;
  }
}

async function statOrNull(target) {
  try {
    return await fsp.stat(target);
  } catch (error) {
    if (error && error.code === 'ENOENT') return null;
    throw error;
  }
}

/**
 * Ошибка, которую стоит повторить: транзиентная блокировка rename на Windows.
 * `causeCode` вытаскивается из AggregateError (`error.code` у него нет).
 */
export function retryableCodeOf(error) {
  const code = error && typeof error === 'object' ? error.code : undefined;
  if (typeof code === 'string' && RETRYABLE_CODES.has(code)) return code;
  if (error instanceof AggregateError) {
    for (const inner of error.errors) {
      const innerCode = retryableCodeOf(inner);
      if (innerCode) return innerCode;
    }
  }
  return null;
}

function errorCodeOf(error) {
  if (error instanceof AggregateError) {
    return error.errors.map((inner) => errorCodeOf(inner)).filter(Boolean).join('+') || 'AGGREGATE';
  }
  const code = error && typeof error === 'object' ? error.code : undefined;
  return typeof code === 'string' ? code : 'UNKNOWN';
}

/**
 * `rename` с окном ожидания и экспоненциальным backoff.
 * Возвращает `{ ok, attempts, elapsedMs, code }`; не бросает на транзиентной блокировке.
 */
export async function renameWithBackoff(from, to, options = {}) {
  const timeoutMs = options.timeoutMs ?? DEFAULTS.timeoutMs;
  const initialDelayMs = options.initialDelayMs ?? DEFAULTS.initialDelayMs;
  const maxDelayMs = options.maxDelayMs ?? DEFAULTS.maxDelayMs;
  const startedAt = Date.now();
  let delay = initialDelayMs;
  let attempts = 0;
  let lastCode = 'UNKNOWN';
  for (;;) {
    attempts += 1;
    try {
      await fsp.rename(from, to);
      return { ok: true, attempts, elapsedMs: Date.now() - startedAt, code: null };
    } catch (error) {
      const code = retryableCodeOf(error);
      if (code === null) throw error;
      lastCode = code;
      if (Date.now() - startedAt + delay > timeoutMs) {
        return { ok: false, attempts, elapsedMs: Date.now() - startedAt, code: lastCode };
      }
      await sleep(delay);
      delay = Math.min(maxDelayMs, Math.max(1, delay * 2));
    }
  }
}

/** Рекурсивный обход каталога: список файлов (без символических ссылок). */
async function listFiles(dir, acc = []) {
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const target = path.join(dir, entry.name);
    if (entry.isDirectory()) await listFiles(target, acc);
    else acc.push(target);
  }
  return acc;
}

/**
 * Кандидаты в носители дескриптора — «живые» файлы внутри переименовываемого
 * каталога. Перечислить дескрипторы процесса без нативных вызовов (handle.exe /
 * NtQuerySystemInformation) нельзя, поэтому печатается список того, что вообще
 * может удерживаться: `team.json` (переписывается плагином) и лог-файлы ящиков.
 */
async function lockedCandidates(source) {
  let files;
  try {
    files = await listFiles(source);
  } catch {
    return [];
  }
  const suspects = [];
  for (const file of files) {
    if (!/team\.json$|\.jsonl$|\.tmp$|\.log$/.test(file)) continue;
    suspects.push(path.relative(source, file));
  }
  return suspects.slice(0, 12);
}

/** Проверка, что `team.json` на месте и разбирается как JSON (если он вообще есть). */
async function inspectTeamJson(target) {
  const file = path.join(target, 'team.json');
  const stat = await statOrNull(file);
  if (stat === null) return { present: false, valid: null, error: null };
  try {
    JSON.parse(await fsp.readFile(file, 'utf8'));
    return { present: true, valid: true, error: null };
  } catch (error) {
    return { present: true, valid: false, error: String(error && error.message) };
  }
}

/** Отложенные «предыдущие» генерации архива, оставшиеся от прошлых попыток. */
async function findLeftovers(archiveRoot, teamId) {
  let entries;
  try {
    entries = await fsp.readdir(archiveRoot, { withFileTypes: true });
  } catch (error) {
    if (error && error.code === 'ENOENT') return [];
    throw error;
  }
  const prefix = `${PREVIOUS_PREFIX}${teamId}.previous-`;
  return entries.filter((entry) => entry.name.startsWith(prefix)).map((entry) => entry.name);
}

function usageError(message, exitCode = 2) {
  return { exitCode, lines: [message, USAGE] };
}

/**
 * Основная операция. Никогда не бросает на ожидаемых состояниях: возвращает
 * `{ exitCode, lines, report }` для печати и для тестов.
 */
export async function archiveTeam(options) {
  const teamId = options.teamId;
  const root = path.resolve(options.root);
  const source = path.join(root, teamId);
  const archiveRoot = path.join(root, ARCHIVE_DIR_NAME);
  const target = path.join(archiveRoot, teamId);
  const report = { teamId, root, source, target, action: null, attempts: 0, elapsedMs: 0, code: null, suspects: [], leftovers: [] };

  const cwd = await canonical(process.cwd());
  const canonicalSource = await canonical(source);
  if (cwd === canonicalSource || cwd.startsWith(canonicalSource + path.sep)) {
    return usageError(`отказ: рабочий каталог (${cwd}) находится внутри архивируемого каталога`, 2);
  }

  const sourceStat = await statOrNull(source);
  const targetStat = await statOrNull(target);
  report.leftovers = await findLeftovers(archiveRoot, teamId);

  if (sourceStat !== null && !sourceStat.isDirectory()) {
    return usageError(`отказ: ${source} существует и не является каталогом`, 2);
  }

  if (sourceStat === null) {
    if (targetStat === null) {
      report.action = 'absent';
      return { exitCode: 0, lines: [`no-op: каталога ${source} нет и архива ${target} нет — архивировать нечего`], report };
    }
    const teamJson = await inspectTeamJson(target);
    report.action = 'already-archived';
    const lines = [`no-op: команда уже в архиве — ${target}`];
    if (teamJson.present && teamJson.valid === false) lines.push(`warning: team.json в архиве не разбирается как JSON: ${teamJson.error}`);
    if (report.leftovers.length > 0) lines.push(`warning: остались отложенные генерации: ${report.leftovers.join(', ')} (удалить вручную после проверки)`);
    return { exitCode: 0, lines, report };
  }

  if (options.check) {
    report.action = targetStat === null ? 'ready' : 'conflict';
    const lines = [];
    if (targetStat === null) {
      lines.push(`check: ${source} → ${target} — можно архивировать (${report.leftovers.length} отложенных генераций)`);
    } else {
      lines.push(`check: конфликт — уже существует ${target}; предыдущая генерация будет отложена как ${PREVIOUS_PREFIX}${teamId}.previous-<uuid>`);
    }
    return { exitCode: 0, lines, report };
  }

  const sourceTeamJson = await inspectTeamJson(source);
  if (sourceTeamJson.present && sourceTeamJson.valid === false) {
    return { exitCode: 1, lines: [`ошибка: team.json не разбирается как JSON, архивация отменена: ${sourceTeamJson.error}`], report };
  }

  if (options.dryRun) {
    report.action = 'dry-run';
    return {
      exitCode: 0,
      lines: [`dry-run: ${source} → ${target} (rename каталога, изменений нет)`],
      report,
    };
  }

  await fsp.mkdir(archiveRoot, { recursive: true });

  let displaced = null;
  if (targetStat !== null) {
    const previous = path.join(archiveRoot, `${PREVIOUS_PREFIX}${teamId}.previous-${randomUUID()}`);
    const move = await renameWithBackoff(target, previous, options);
    report.attempts += move.attempts;
    report.elapsedMs += move.elapsedMs;
    if (!move.ok) {
      report.action = 'blocked-displace';
      report.code = move.code;
      return {
        exitCode: 3,
        lines: [
          `блокировка: не удалось отложить предыдущую генерацию архива (${move.code})`,
          `  ${target} → ${previous}`,
          `  попыток: ${move.attempts}, прошло: ${move.elapsedMs} мс (окно ${options.timeoutMs} мс)`,
        ],
        report,
      };
    }
    displaced = previous;
  }

  const move = await renameWithBackoff(source, target, options);
  report.attempts += move.attempts;
  report.elapsedMs += move.elapsedMs;

  if (!move.ok) {
    report.action = 'blocked';
    report.code = move.code;
    report.suspects = await lockedCandidates(source);
    const lines = [
      `блокировка: rename не проходит — ${move.code}`,
      `  ${source} → ${target}`,
      `  попыток: ${move.attempts}, прошло: ${move.elapsedMs} мс (окно ${options.timeoutMs} мс)`,
    ];
    if (displaced !== null) {
      const restore = await renameWithBackoff(displaced, target, options);
      report.attempts += restore.attempts;
      if (restore.ok) {
        lines.push(`  предыдущая генерация возвращена на место: ${target}`);
      } else {
        lines.push(`  ВНИМАНИЕ: не удалось вернуть предыдущую генерацию: ${displaced} (${restore.code})`);
      }
    }
    if (report.suspects.length > 0) {
      lines.push(`  вероятные носители дескриптора (живые файлы внутри каталога): ${report.suspects.join(', ')}`);
    }
    lines.push(
      '  причина (Windows): файл ниже переименовываемого каталога открыт без FILE_SHARE_DELETE',
      '    (живой подпроцесс члена команды, скан антивируса, индексатор, открытый редактор).',
      '  что делать: закрыть сессию DSH/подпроцессы и повторить; окно можно увеличить',
      `    (--timeout-ms ${Math.max(options.timeoutMs * 2, 120_000)}). Хелпер идемпотентен: повторный запуск безопасен.`,
    );
    return { exitCode: 3, lines, report };
  }

  const after = await statOrNull(source);
  const movedIn = await statOrNull(target);
  if (after !== null || movedIn === null) {
    return { exitCode: 1, lines: [`ошибка: rename вернул успех, но состояние не совпало: source=${after !== null}, target=${movedIn === null}`], report };
  }

  if (displaced !== null) {
    // Уборка отложенной генерации: не критично, скрытый каталог игнорируется сканером.
    await fsp.rm(displaced, { recursive: true, force: true }).catch(() => undefined);
  }

  report.action = 'archived';
  const lines = [`архивировано: ${source} → ${target} (попыток: ${move.attempts}, ${move.elapsedMs} мс)`];
  if (report.leftovers.length > 0) lines.push(`warning: остались отложенные генерации: ${report.leftovers.join(', ')}`);
  return { exitCode: 0, lines, report };
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  if (!parsed.ok) {
    if (parsed.error === 'help') {
      process.stdout.write(USAGE + '\n');
      process.exitCode = 0;
    } else {
      const failure = usageError(parsed.error);
      process.stderr.write(failure.lines.join('\n') + '\n');
      process.exitCode = failure.exitCode;
    }
    return;
  }
  const options = parsed.options;
  if (options.root === null) {
    options.root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '.agent-teams');
  }
  let result;
  try {
    result = await archiveTeam(options);
  } catch (error) {
    process.stderr.write(`ошибка: ${errorCodeOf(error)}: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
    return;
  }
  if (options.json) {
    process.stdout.write(JSON.stringify({ exitCode: result.exitCode, ...result.report }, null, 2) + '\n');
    process.exitCode = result.exitCode;
    return;
  }
  const stream = result.exitCode === 0 ? process.stdout : process.stderr;
  stream.write(result.lines.join('\n') + '\n');
  process.exitCode = result.exitCode;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  await main();
}
