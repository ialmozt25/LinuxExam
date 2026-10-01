// run-spec.mjs — запуск MAS-прогона по спеке через CLI-путь к dsh-agent-teams
// (spec 033a, задача t1; артефакт t0 — .project/scripts/RUN-SPEC-SPIKE.md).
//
// ПУТЬ (вердикт t0, строка `PATH: H2` в RUN-SPEC-SPIKE.md):
//   CLI-раннтайм DSH. `dsh agent-teams …` не существует, поэтому используется
//   one-shot headless-поверхность: `dsh --profile <p> "/agent-teams <цель>"`.
//   Ведущий `/agent-teams` активирует протокол капитана через gesture boundary
//   (README плагина:122-125 — «Surfaces without command adjudication (for example
//   the headless CLI) get the same deterministic activation»). Второй CLI-вход из
//   отчёта — stdio JSON-RPC `dsh --profile sdk` (вариант C) — этим скриптом не
//   используется: он даёт поток событий вместо финального ответа и не имеет
//   per-prompt результата.
//
// PRECONDITION (отчёт t0, §5 «Выбранный путь и precondition»):
//   - запущенный DSH НЕ нужен, HTTP-сервер не поднимается;
//   - токен/cookie НЕ нужен (путь H1 — HTTP API — отклонён);
//   - нужен профиль, из чьего node_modules резолвится @nanmicoder/dsh-agent-teams:
//     в t0 зафиксировано `headless → MODULE_NOT_FOUND`, `web → OK`. Разовая
//     настройка (вне репозитория):
//       dsh --profile mas --from-default-profile headless
//       dsh plugin --profile mas add @nanmicoder/dsh-agent-teams
//   - нужен LLM-роут профиля (headless-шаблон несёт dsh-tier-router) —
//     иначе прогон падает до создания команды;
//   - cwd = workspace: состояние команды лежит в `<workspace>/.agent-teams/<teamId>/`;
//     читается с диска (путь H3 = только read-канал: watcher'а у плагина нет,
//     живой процесс DSH внешнюю запись не замечает).
//
// Использование:
//   node .project/scripts/run-spec.mjs <spec-id> [--dry-run|--live] [--json]
//        [--profile <name>] [--workspace <dir>] [--timeout-ms <ms>]
//   npm run spec:run -- 033a --dry-run
//   node .project/scripts/run-spec.mjs 013 --live --workspace %TEMP%\\ws
//
// Коды выхода (по образцу archive-team.mjs):
//   0 — успех: dry-run-отчёт либо реальный прогон со status=ok;
//   1 — провал реального прогона или неожиданная ошибка ввода-вывода (в т.ч.
//       отсутствует handoff-шаблон templates/mas/*);
//   2 — ошибка использования/ввода (нет spec-id, неизвестный флаг, спека не найдена);
//   3 — не выполнено precondition пути H2 (нет dsh CLI / нет профиля / плагин не
//       резолвится): реальный прогон не стартует, запись в историю пишется.
//
// ШАБЛОНЫ (spec 033a, п. «Что делаем 3»): перед запуском реального прогона
// templates/mas/TASK.md и templates/mas/SESSION.md копируются в каталог команды
// `<workspace>/.agent-teams/<teamId>/` (пути — от корня репозитория, копирование
// идемпотентно, отсутствие шаблона — понятная ошибка с точным путём). В --dry-run
// копирование не выполняется: печатается только план.
//
// СПЕКА (spec 035, fix spec-resolution): каталог спек жёстко привязан к корню репо
// (`SPECS_DIR`), а cwd вложенного агента = `--workspace`, поэтому перед реальным
// прогоном файл спеки материализуется в `<workspace>/.project/specs/<file>.md`
// (вариант A). В /agent-teams-промпт идёт `.project/specs/<file>.md` — путь,
// который существует относительно cwd вложенного агента. При workspace = корень
// репо целевой путь совпадает с исходным: копирование пропускается, текст промпта
// прежний. В --dry-run копирование не выполняется (печатается только план).
//
// `--live` — алиас не-dry-run (явный реальный прогон); одиночный `--dry-run`
// по-прежнему даёт dry-run.

import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fsp from 'node:fs/promises';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Корень репозитория (скрипт лежит в `<repo>/.project/scripts/`). */
export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Каталог спек. */
export const SPECS_DIR = path.join(REPO_ROOT, '.project', 'specs');

/**
 * Каталог спеки внутри workspace (относительно `<workspace>`) — ровно тот путь,
 * который подставляется в /agent-teams-промпт и существует относительно cwd
 * вложенного агента (spec 035, вариант A).
 */
export const WORKSPACE_SPECS_DIR = path.join('.project', 'specs');

/** Канонический путь истории прогонов (выбран капитаном для spec 033a). */
export const HISTORY_PATH = path.join(REPO_ROOT, '.project', 'mas-runs.json');

/** Каталог handoff-шаблонов MAS (отдельно от templates/factory — spec 033a). */
export const TEMPLATES_DIR = path.join(REPO_ROOT, 'templates', 'mas');

/** Шаблоны, копируемые в каталог команды; порядок фиксирован для отчёта. */
export const TEMPLATE_FILES = ['TASK.md', 'SESSION.md'];

/** Имя каталога состояния команды внутри workspace (совпадает с config плагина). */
export const STATE_DIR_NAME = '.agent-teams';

/** Пакет плагина, который обязан резолвиться из профиля (precondition H2). */
export const PLUGIN_PACKAGE = '@nanmicoder/dsh-agent-teams';

/** Ведущий маркер активации протокола капитана на headless-поверхности. */
export const ACTIVATION_PREFIX = '/agent-teams';

/* --------------------------------------- Telegram-уведомления (spec 042/T2) */

/** Ядро уведомлений (spec 042/T1). */
const NOTIFY_SCRIPT = path.join(REPO_ROOT, '.project', 'scripts', 'notify.mjs');

/**
 * Fire-and-forget Telegram-уведомление (spec 042/T2). Никогда не бросает, не
 * блокирует родителя, ничего не пишет в stdout парсеров и не влияет на
 * exit-код: дочерний процесс detached + unref, его вывод не читается
 * (`stdio: 'ignore'`). Сбой Telegram не ломает прогон.
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

const DEFAULTS = {
  dryRun: false,
  json: false,
  profile: 'mas',
  workspace: REPO_ROOT,
  timeoutMs: 30 * 60 * 1000,
  specId: null,
};

const USAGE = [
  'usage: node .project/scripts/run-spec.mjs <spec-id> [--dry-run|--live] [--json]',
  '       [--profile <name>] [--workspace <dir>] [--timeout-ms <ms>]',
  '',
  'MAS-прогон по спеке через CLI-путь к dsh-agent-teams (spec 033a, вердикт t0: PATH: H2).',
  '',
  'Аргументы:',
  '  <spec-id>            идентификатор спеки в .project/specs (например 033a)',
  '',
  'Флаги:',
  '  --dry-run            только отчёт: команда не запускается, шаблоны не копируются,',
  '                       .project/mas-runs.json не пишется',
  '  --live               алиас не-dry-run: явный реальный прогон (обратное к --dry-run)',
  '  --json               печатать отчёт в виде JSON',
  '  --profile <name>     DSH-профиль с плагином agent-teams (по умолчанию mas)',
  '  --workspace <dir>    рабочая директория прогона (по умолчанию корень репозитория)',
  '  --timeout-ms <ms>    предел ожидания реального прогона (по умолчанию 1800000)',
  '  -h, --help           эта справка',
  '',
  'Перед реальным прогоном templates/mas/{TASK,SESSION}.md копируются в',
  '<workspace>/.agent-teams/<teamId>/, а файл спеки — в <workspace>/.project/specs/.',
].join('\n');

// ---------------------------------------------------------------------------
// Разбор аргументов
// ---------------------------------------------------------------------------

/**
 * Разбор argv. Возвращает `{ ok: true, options }` либо `{ ok: false, error, exitCode }`.
 * @param {string[]} argv - аргументы без `node` и имени скрипта.
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
    if (arg === '-h' || flag === '--help') return { ok: false, error: 'help', exitCode: 0 };
    if (!arg.startsWith('--')) {
      if (options.specId !== null) {
        return { ok: false, error: `лишний аргумент: ${arg}`, exitCode: 2 };
      }
      options.specId = arg;
      continue;
    }
    switch (flag) {
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--live':
        // Алиас не-dry-run (spec 035): явный реальный прогон.
        options.dryRun = false;
        break;
      case '--json':
        options.json = true;
        break;
      case '--profile':
      case '--workspace': {
        const raw = takeValue();
        if (raw === undefined || raw.trim() === '') {
          return { ok: false, error: `флаг ${flag} требует значение`, exitCode: 2 };
        }
        if (flag === '--profile') options.profile = raw.trim();
        else options.workspace = path.resolve(raw.trim());
        break;
      }
      case '--timeout-ms': {
        const raw = takeValue();
        const value = Number(raw);
        if (raw === undefined || !Number.isFinite(value) || value <= 0) {
          return { ok: false, error: 'флаг --timeout-ms требует положительное число', exitCode: 2 };
        }
        options.timeoutMs = value;
        break;
      }
      default:
        return { ok: false, error: `неизвестный флаг: ${flag}`, exitCode: 2 };
    }
  }
  if (options.specId === null || options.specId.trim() === '') {
    return { ok: false, error: 'не задан spec-id', exitCode: 2 };
  }
  options.specId = options.specId.trim();
  return { ok: true, options };
}

// ---------------------------------------------------------------------------
// Спека
// ---------------------------------------------------------------------------

/**
 * Найти файл спеки по идентификатору. Точное `<id>.md` выигрывает у префиксного
 * совпадения; несколько префиксных совпадений — ошибка ввода (неоднозначность).
 * @param {string} specsDir - каталог спек.
 * @param {string} specIdRaw - `<id>` (можно с `.md`).
 */
export async function resolveSpec(specsDir, specIdRaw) {
  const id = specIdRaw.replace(/\.md$/i, '').trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(id)) {
    return { ok: false, error: `недопустимый spec-id: ${specIdRaw}`, exitCode: 2 };
  }
  let entries;
  try {
    entries = await fsp.readdir(specsDir, { withFileTypes: true });
  } catch (error) {
    return { ok: false, error: `каталог спек недоступен: ${specsDir} (${errorCodeOf(error)})`, exitCode: 1 };
  }
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.md'))
    .map((entry) => entry.name)
    .filter((name) => name.toLowerCase() !== 'readme.md');
  const exact = files.find((name) => name === `${id}.md`);
  let picked = exact;
  if (picked === undefined) {
    const prefixed = files.filter((name) => name.startsWith(`${id}-`));
    if (prefixed.length === 0) {
      return {
        ok: false,
        error: `спека "${id}" не найдена в ${specsDir}`,
        hint: `доступны: ${files.map((name) => name.replace(/\.md$/, '')).join(', ')}`,
        exitCode: 2,
      };
    }
    if (prefixed.length > 1) {
      return {
        ok: false,
        error: `spec-id "${id}" неоднозначен: ${prefixed.join(', ')}`,
        hint: 'укажите более длинный идентификатор',
        exitCode: 2,
      };
    }
    picked = prefixed[0];
  }
  const specPath = path.join(specsDir, picked);
  let raw;
  try {
    raw = await fsp.readFile(specPath, 'utf8');
  } catch (error) {
    return { ok: false, error: `спека не читается: ${picked} (${errorCodeOf(error)})`, exitCode: 1 };
  }
  const parsed = parseSpec(raw);
  return {
    ok: true,
    spec: {
      specId: id,
      file: picked,
      slug: parsed.slug,
      fmId: parsed.fmId,
      type: parsed.type,
      status: parsed.status,
      title: parsed.title,
      goals: parsed.goals,
      path: specPath,
      relativePath: path.relative(REPO_ROOT, specPath).split(path.sep).join('/'),
      bytes: Buffer.byteLength(raw, 'utf8'),
    },
  };
}

/**
 * Материализовать файл спеки внутри workspace (spec 035, вариант A): вложенный
 * агент запускается с `cwd = --workspace`, поэтому относительный путь спеки должен
 * существовать именно там. Копия идемпотентна (перезапись байтами исходника);
 * если целевой путь совпадает с исходным (workspace = корень репо) — записи нет.
 * @param {string} workspace - рабочая директория прогона.
 * @param {{file: string, path: string, relativePath: string, bytes: number}} spec
 * @returns {Promise<{ok: boolean, path: string, relativePath: string, copied: boolean, bytes: number|null, error: string|null}>}
 */
export async function materializeSpec(workspace, spec) {
  const target = path.join(workspace, WORKSPACE_SPECS_DIR, spec.file);
  const relativePath = path.relative(workspace, target).split(path.sep).join('/');
  if (path.resolve(target) === path.resolve(spec.path)) {
    return { ok: true, path: target, relativePath, copied: false, bytes: spec.bytes, error: null };
  }
  try {
    const bytes = await fsp.readFile(spec.path);
    await fsp.mkdir(path.dirname(target), { recursive: true });
    await fsp.writeFile(target, bytes);
    const written = await fsp.readFile(target);
    if (!written.equals(bytes)) {
      return {
        ok: false,
        path: target,
        relativePath,
        copied: false,
        bytes: bytes.length,
        error: `копия спеки ${target} не совпала с исходником побайтово`,
      };
    }
    return { ok: true, path: target, relativePath, copied: true, bytes: bytes.length, error: null };
  } catch (error) {
    return {
      ok: false,
      path: target,
      relativePath,
      copied: false,
      bytes: null,
      error: `спека не материализована в workspace: ${target} (${errorCodeOf(error)})`,
    };
  }
}

/**
 * Разбор markdown-спеки: front-matter, заголовок первого уровня, список целей из
 * секции «## Цель». Зависимостей нет, парсер намеренно минимальный.
 * @param {string} raw - содержимое файла.
 */
export function parseSpec(raw) {
  const lines = raw.split(/\r?\n/);
  const fm = {};
  if (lines[0] !== undefined && lines[0].trim() === '---') {
    for (let index = 1; index < lines.length; index += 1) {
      const line = lines[index];
      if (line.trim() === '---') break;
      const match = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
      if (match !== null) fm[match[1]] = match[2].trim();
    }
  }
  let title = '';
  for (const line of lines) {
    if (line.startsWith('# ')) {
      title = line.slice(2).trim();
      break;
    }
  }
  const goals = [];
  let inGoals = false;
  for (const line of lines) {
    if (/^##\s+/.test(line)) {
      inGoals = /^##\s+Цель\b/.test(line);
      continue;
    }
    if (!inGoals) continue;
    const match = /^\s*(?:\d+\.|[-*])\s+(.*)$/.exec(line);
    if (match !== null && match[1].trim() !== '') goals.push(match[1].trim());
  }
  return {
    fmId: fm['id'] ?? null,
    slug: fm['slug'] ?? null,
    type: fm['type'] ?? null,
    status: fm['status'] ?? null,
    title,
    goals,
  };
}

/**
 * Идентификатор каталога команды: `spec-<basename файла>` (например
 * `spec-033a-mas-autonomy-spike` — та же конвенция, что у уже существующих
 * команд в `.agent-teams/`). Это лишь подсказка: имя команды выбирает
 * модель-капитан, поэтому сбор результата умеет искать команду по диску
 * (см. collectTeam).
 * @param {{specId: string, slug: string|null, file: string}} spec
 */
export function teamIdFor(spec) {
  const base = spec.file.replace(/\.md$/i, '').replace(/[^A-Za-z0-9._-]+/g, '-');
  return sanitizeKey(`spec-${base}`);
}

/** Ключ каталога в конвенции плагина (`sanitizeKey` из lib/state.js). */
export function sanitizeKey(name) {
  return String(name).trim().replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^[.-]+|[.-]+$/g, '') || 'team';
}

/**
 * Текст задачи для one-shot прогона: ведущий `/agent-teams` + цель из спеки.
 * Детерминирован (никаких вызовов модели здесь) и ограничен по длине.
 * `spec.relativePath` — путь спеки, существующий относительно cwd вложенного
 * агента (= `--workspace`), см. materializeSpec (spec 035).
 * @param {{specId: string, slug: string|null, title: string, goals: string[], relativePath: string}} spec
 * @param {string} teamId - ожидаемое имя команды.
 */
export function buildTaskText(spec, teamId) {
  const goals = spec.goals.slice(0, 6).map((goal) => goal.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const title = spec.title.replace(/\s+/g, ' ').trim();
  const head = title === ''
    ? `Спека ${spec.specId}${spec.slug === null ? '' : ` (${spec.slug})`}.`
    : title.includes(spec.specId)
      ? `${title}.`
      : `Спека ${spec.specId}${spec.slug === null ? '' : ` (${spec.slug})`}: ${title}.`;
  const body = goals.length === 0 ? '' : ` Цели: ${goals.join('; ')}.`;
  const tail = ` Спека: ${spec.relativePath}. Ожидаемое имя команды: ${teamId}.`;
  const text = `${ACTIVATION_PREFIX} ${head}${body}${tail}`;
  return text.length <= 1500 ? text : `${text.slice(0, 1497)}...`;
}

// ---------------------------------------------------------------------------
// DEEPSEEK_API_KEY: источник (fix alert 2026-09-30, process gap)
// ---------------------------------------------------------------------------

/** Имя переменной окружения, которую ждёт дочерний процесс dsh. */
const API_KEY_VAR = 'DEEPSEEK_API_KEY';

/** Область системного окружения для чтения ключа на Windows. */
const API_KEY_SCOPE = 'User';

/** Подсказка «как выставить ключ в текущей сессии» (одна строка, копируется целиком). */
export const API_KEY_EXPORT_HINT = `$env:${API_KEY_VAR} = [Environment]::GetEnvironmentVariable('${API_KEY_VAR}','${API_KEY_SCOPE}')`;

/**
 * Прочитать DEEPSEEK_API_KEY из User-scope (только Windows) через PowerShell.
 * Аргументы передаются массивом — без shell-интерполяции. Любая ошибка или
 * таймаут → `{ key: null }` (проверка preflight сама покажет причину).
 * @returns {{key: string|null}}
 */
export function resolveApiKeyFromSystem() {
  if (process.platform !== 'win32') return { key: null };
  try {
    const res = spawnSync(
      'powershell.exe',
      ['-NoProfile', '-Command', `[Environment]::GetEnvironmentVariable('${API_KEY_VAR}','${API_KEY_SCOPE}')`],
      { encoding: 'utf8', timeout: 5000, windowsHide: true },
    );
    const raw = (res.stdout ?? '').trim();
    if (res.status === 0 && raw !== '') return { key: raw };
  } catch {
    /* fall through: ключ считается отсутствующим */
  }
  return { key: null };
}

/**
 * Нормализовать результат чтения ключа: `{ key, source }`, где
 * `source: 'env' | 'user-scope' | 'missing'`. Побочных эффектов нет — значение
 * уже прочитано (env имеет приоритет над системным окружением).
 * @param {{key: string|null|undefined}} [entry] - результат resolveApiKeyFromSystem().
 * @returns {{key: string|null, source: 'env'|'user-scope'|'missing'}}
 */
export function resolveApiKey(entry) {
  const envKey = process.env[API_KEY_VAR];
  if (typeof envKey === 'string' && envKey.trim() !== '') return { key: envKey.trim(), source: 'env' };
  const raw = typeof entry?.key === 'string' ? entry.key.trim() : '';
  if (raw !== '') return { key: raw, source: 'user-scope' };
  return { key: null, source: 'missing' };
}

// ---------------------------------------------------------------------------
// Precondition пути H2
// ---------------------------------------------------------------------------

/** Домашний каталог DSH (совпадает с env `DSH_HOME`). */
export function dshHome() {
  return process.env.DSH_HOME && process.env.DSH_HOME.trim() !== ''
    ? process.env.DSH_HOME.trim()
    : path.join(os.homedir(), '.dsh');
}

/** Каталог профиля: `$DSH_HOME/profiles/<name>`. */
export function profileDirOf(profile) {
  return path.join(dshHome(), 'profiles', profile);
}

/**
 * Найти исполняемый вход `dsh`: сначала `node <global>/node_modules/@deepseek-ai/dsh/lib/bin.js`
 * (детерминированно и без `.cmd`/shell-обёрток Windows), затем PATH.
 * @returns {{command: string, argvPrefix: string[], label: string}|null}
 */
export function locateDsh() {
  const binRel = path.join('node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js');
  const roots = [];
  if (process.platform === 'win32' && process.env.APPDATA) roots.push(path.join(process.env.APPDATA, 'npm'));
  if (process.env.npm_config_prefix) roots.push(process.env.npm_config_prefix);
  roots.push(path.join(os.homedir(), '.npm-global'));
  roots.push('/usr/local');
  roots.push('/usr');
  for (const root of roots) {
    const bin = path.join(root, binRel);
    if (existsSync(bin)) {
      return { command: process.execPath, argvPrefix: [bin], label: `node ${bin}` };
    }
  }
  const onPath = findOnPath('dsh');
  if (onPath !== null) return { command: onPath, argvPrefix: [], label: onPath };
  return null;
}

/** Поиск файла в PATH (с учётом PATHEXT на Windows). */
export function findOnPath(name) {
  const dirs = (process.env.PATH ?? '').split(path.delimiter).filter((dir) => dir !== '');
  const exts = process.platform === 'win32'
    ? (process.env.PATHEXT ?? '.COM;.EXE;.BAT;.CMD').split(';').filter((ext) => ext !== '')
    : [''];
  for (const dir of dirs) {
    for (const ext of exts) {
      const candidate = path.join(dir, name + ext);
      if (existsSync(candidate)) return candidate;
    }
  }
  return null;
}

/**
 * Проверить precondition пути H2. Ничего не меняет: только чтение каталогов и
 * один прогон `dsh --version` (он не создаёт команд и не поднимает сервер).
 * @param {{profile: string, workspace: string}} input
 * @param {{key: string|null|undefined}} [apiKeyEntry] - уже прочитанное системное
 *   значение (resolveApiKeyFromSystem), чтобы preflight не дёргал PowerShell дважды.
 * @returns {{checks: object[], ok: boolean, dsh: object|null, apiKey: object}}
 */
export function preflight(input, apiKeyEntry) {
  const checks = [];
  const apiKey =
    resolveApiKey(apiKeyEntry);
  const dsh = locateDsh();
  if (dsh === null) {
    checks.push({
      name: 'dsh CLI',
      ok: false,
      detail: 'не найден: ни global npm-каталог, ни PATH',
      fix: 'установить @deepseek-ai/dsh (npm i -g @deepseek-ai/dsh)',
    });
  } else {
    const probe = spawnSync(dsh.command, [...dsh.argvPrefix, '--version'], {
      encoding: 'utf8',
      timeout: 30_000,
      windowsHide: true,
    });
    const version = (probe.stdout ?? '').trim();
    const ok = probe.status === 0 && version !== '';
    checks.push({
      name: 'dsh CLI',
      ok,
      detail: ok
        ? `${dsh.label} --version → ${version}`
        : `запуск ${dsh.label} --version не удался (status=${probe.status}, error=${probe.error?.code ?? 'none'})`,
      fix: 'проверить установку/вызов dsh вручную',
    });
  }

  const profileDir = profileDirOf(input.profile);
  const profileExists = existsSync(profileDir);
  checks.push({
    name: `профиль ${input.profile}`,
    ok: profileExists,
    detail: profileExists ? profileDir : `нет каталога ${profileDir}`,
    fix: `dsh --profile ${input.profile} --from-default-profile headless`,
  });

  let pluginResolved = null;
  let pluginDetail = '';
  if (profileExists) {
    try {
      const require = createRequire(path.join(profileDir, 'package.json'));
      pluginResolved = require.resolve(PLUGIN_PACKAGE);
      pluginDetail = pluginResolved;
    } catch (error) {
      pluginDetail = `${PLUGIN_PACKAGE} не резолвится из профиля (${errorCodeOf(error)})`;
    }
  } else {
    pluginDetail = `профиль отсутствует — резолв ${PLUGIN_PACKAGE} невозможен`;
  }
  checks.push({
    name: `плагин ${PLUGIN_PACKAGE}`,
    ok: pluginResolved !== null,
    detail: pluginDetail,
    fix: `dsh plugin --profile ${input.profile} add ${PLUGIN_PACKAGE}`,
  });

  const workspaceExists = existsSync(input.workspace);
  checks.push({
    name: 'workspace',
    ok: workspaceExists,
    detail: workspaceExists ? input.workspace : `нет каталога ${input.workspace}`,
    fix: 'указать существующий --workspace',
  });

  const stateRoot = path.join(input.workspace, STATE_DIR_NAME);
  checks.push({
    name: `каталог состояния ${STATE_DIR_NAME}`,
    ok: true,
    optional: true,
    detail: existsSync(stateRoot) ? stateRoot : `${stateRoot} (будет создан плагином при прогоне)`,
    fix: null,
  });

  const missingTemplates = TEMPLATE_FILES.filter((name) => !existsSync(path.join(TEMPLATES_DIR, name)));
  checks.push({
    name: 'шаблоны templates/mas',
    ok: missingTemplates.length === 0,
    detail: missingTemplates.length === 0
      ? `${path.relative(REPO_ROOT, TEMPLATES_DIR).split(path.sep).join('/')}/${TEMPLATE_FILES.join(', ')}`
      : `нет файлов: ${missingTemplates.join(', ')} (каталог ${TEMPLATES_DIR})`,
    fix: 'восстановить templates/mas/{TASK,SESSION}.md (spec 033a, «Что делаем 3»)',
  });

  checks.push({
    name: API_KEY_VAR,
    ok: apiKey.source !== 'missing',
    detail:
      apiKey.source === 'env'
        ? 'из env'
        : apiKey.source === 'user-scope'
          ? 'из User-scope (Windows)'
          : `missing — выполнить: ${API_KEY_EXPORT_HINT}`,
    fix: apiKey.source === 'missing' ? API_KEY_EXPORT_HINT : null,
  });

  return { checks, ok: checks.every((check) => check.ok || check.optional === true), dsh, apiKey };
}

// ---------------------------------------------------------------------------
// Handoff-шаблоны (spec 033a, «Что делаем 3»)
// ---------------------------------------------------------------------------

/**
 * Скопировать `templates/mas/{TASK,SESSION}.md` в каталог команды
 * `<workspace>/.agent-teams/<teamId>/`. Идемпотентно: файлы-копии побайтово
 * равны шаблонам (перезапись теми же байтами), отсутствие шаблона — понятная
 * ошибка без частичной записи.
 * @param {string} workspace - рабочая директория прогона.
 * @param {string} teamId - id каталога команды.
 * @returns {Promise<{ok: boolean, dir: string, files: object[], missing: string[], error: string|null}>}
 */
export async function stageTemplates(workspace, teamId) {
  const dir = path.join(workspace, STATE_DIR_NAME, teamId);
  const sources = TEMPLATE_FILES.map((name) => ({ name, source: path.join(TEMPLATES_DIR, name) }));
  const missing = sources.filter((item) => !existsSync(item.source)).map((item) => item.source);
  if (missing.length > 0) {
    return {
      ok: false,
      dir,
      files: [],
      missing,
      error: `шаблон(ы) не найдены: ${missing.join(', ')} — ожидаются в ${TEMPLATES_DIR}`,
    };
  }
  await fsp.mkdir(dir, { recursive: true });
  const files = [];
  for (const item of sources) {
    const bytes = await fsp.readFile(item.source);
    const target = path.join(dir, item.name);
    await fsp.writeFile(target, bytes);
    const written = await fsp.readFile(target);
    const equal = written.equals(bytes);
    files.push({
      name: item.name,
      source: path.relative(REPO_ROOT, item.source).split(path.sep).join('/'),
      target,
      bytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex').slice(0, 16),
      lastByte: written.length === 0 ? null : written[written.length - 1],
      equal,
    });
    if (!equal) {
      return { ok: false, dir, files, missing: [], error: `копия ${target} не совпала с шаблоном побайтово` };
    }
  }
  return { ok: true, dir, files, missing: [], error: null };
}

// ---------------------------------------------------------------------------
// Сбор результата с диска (путь H3 — read-канал)
// ---------------------------------------------------------------------------

/** Прочитать `team.json` команды по подсказанному id. */
export async function readTeamHint(workspace, teamId) {
  const file = path.join(workspace, STATE_DIR_NAME, teamId, 'team.json');
  try {
    const team = JSON.parse(await fsp.readFile(file, 'utf8'));
    return { found: true, via: 'team-id', file, team };
  } catch {
    return { found: false, via: 'team-id', file, team: null };
  }
}

/**
 * Найти команду по диску: подсказанный id, затем самая свежая команда, созданная
 * не раньше `sinceMs` (имя команды выбирает модель, поэтому id — только подсказка).
 * @param {string} workspace
 * @param {string} teamId
 * @param {number} sinceMs - момент старта прогона (мс).
 */
export async function collectTeam(workspace, teamId, sinceMs) {
  const hint = await readTeamHint(workspace, teamId);
  if (hint.found) return { ...hint, inbox: await inboxFiles(workspace, teamId) };
  const root = path.join(workspace, STATE_DIR_NAME);
  let entries;
  try {
    entries = await fsp.readdir(root, { withFileTypes: true });
  } catch {
    return { found: false, via: 'scan', file: null, team: null, inbox: [], scanned: root };
  }
  let newest = null;
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === 'archive' || entry.name.startsWith('.')) continue;
    const file = path.join(root, entry.name, 'team.json');
    let team;
    try {
      team = JSON.parse(await fsp.readFile(file, 'utf8'));
    } catch {
      continue;
    }
    const createdAt = Number.isFinite(team?.createdAt) ? team.createdAt : 0;
    if (createdAt < sinceMs - 5_000) continue;
    if (newest === null || createdAt > newest.createdAt) {
      newest = { found: true, via: 'scan', file, team, createdAt, dirName: entry.name };
    }
  }
  if (newest === null) return { found: false, via: 'scan', file: null, team: null, inbox: [], scanned: root };
  return { ...newest, inbox: await inboxFiles(workspace, newest.dirName) };
}

/** Список файлов входящих сообщений команды (`inbox/*.jsonl`). */
async function inboxFiles(workspace, teamId) {
  const dir = path.join(workspace, STATE_DIR_NAME, teamId, 'inbox');
  try {
    const names = await fsp.readdir(dir);
    return names.filter((name) => name.endsWith('.jsonl')).sort();
  } catch {
    return [];
  }
}

/** Краткая сводка состояния команды для отчёта. */
export function summarizeTeam(team) {
  const members = Array.isArray(team?.members) ? team.members : [];
  const tasks = Array.isArray(team?.tasks) ? team.tasks : [];
  return {
    id: team?.id ?? null,
    name: team?.name ?? null,
    phase: team?.phase ?? null,
    halted: team?.halted === true,
    members: members.map((member) => ({ name: member?.name ?? '', role: member?.role ?? null, status: member?.status ?? null })),
    tasks: tasks.map((task) => ({
      id: task?.id ?? '',
      subject: task?.subject ?? '',
      status: task?.status ?? null,
      assignee: task?.assignee ?? null,
      dependencies: Array.isArray(task?.dependencies) ? task.dependencies : [],
    })),
  };
}

// ---------------------------------------------------------------------------
// История прогонов
// ---------------------------------------------------------------------------

/**
 * Прочитать историю. Отсутствующий файл — пустая история; нечитаемый/битый файл —
 * ошибка (молча перезаписывать историю запрещено).
 * @param {string} historyPath
 */
export async function readHistory(historyPath) {
  let raw;
  try {
    raw = await fsp.readFile(historyPath, 'utf8');
  } catch (error) {
    if (errorCodeOf(error) === 'ENOENT') return { version: 1, runs: [] };
    throw new Error(`история не читается: ${historyPath} (${errorCodeOf(error)})`);
  }
  let doc;
  try {
    doc = JSON.parse(raw);
  } catch {
    throw new Error(`история ${historyPath} не разбирается как JSON — запись отменена, файл не изменён`);
  }
  if (doc === null || typeof doc !== 'object' || !Array.isArray(doc.runs)) {
    throw new Error(`история ${historyPath} имеет неожидаемый формат (нужен объект с массивом runs) — запись отменена`);
  }
  return { version: Number.isSafeInteger(doc.version) ? doc.version : 1, runs: doc.runs };
}

/**
 * Добавить одну запись прогона. Запись атомарная (tmp + rename), предыдущие
 * записи сохраняются — повторный прогон файл не ломает.
 * @param {string} historyPath
 * @param {object} record - `{ spec, startedAt, finishedAt, status, report }`.
 */
export async function appendRunRecord(historyPath, record) {
  const doc = await readHistory(historyPath);
  doc.version = 1;
  doc.runs.push(record);
  const temporary = `${historyPath}.tmp-${process.pid}`;
  await fsp.mkdir(path.dirname(historyPath), { recursive: true });
  await fsp.writeFile(temporary, `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
  await fsp.rename(temporary, historyPath);
  return { path: historyPath, total: doc.runs.length };
}

// ---------------------------------------------------------------------------
// Прогон
// ---------------------------------------------------------------------------

/**
 * Полный сценарий. Никогда не бросает на ожидаемых состояниях: возвращает
 * `{ exitCode, report }` для печати и для тестов.
 * @param {object} options - разобранные опции (`parseArgs().options`).
 */
export async function runSpec(options) {
  const startedAtMs = Date.now();
  const report = {
    tool: 'run-spec',
    spec: options.specId,
    path: 'H2',
    pathDetail: `CLI one-shot: dsh --profile <p> "${ACTIVATION_PREFIX} <цель>"`,
    mode: options.dryRun ? 'dry-run' : 'run',
    profile: options.profile,
    workspace: options.workspace,
    startedAt: new Date(startedAtMs).toISOString(),
    finishedAt: null,
    steps: [],
    precondition: [],
    plan: null,
    result: { status: 'failed', reason: null },
    history: null,
  };

  const resolved = await resolveSpec(SPECS_DIR, options.specId);
  if (!resolved.ok) {
    report.steps.push({ name: 'resolve-spec', status: 'failed', detail: resolved.error });
    report.result = { status: 'usage-error', reason: resolved.error, hint: resolved.hint ?? null };
    report.finishedAt = new Date().toISOString();
    return { exitCode: resolved.exitCode, report };
  }
  const spec = resolved.spec;
  report.spec = spec.specId;
  report.specFile = spec.relativePath;
  report.specTitle = spec.title;
  report.steps.push({
    name: 'resolve-spec',
    status: 'ok',
    detail: `${spec.relativePath} (${spec.bytes} Б, type=${spec.type ?? '—'}, status=${spec.status ?? '—'})`,
  });

  const teamId = teamIdFor(spec);
  // spec 035 (вариант A): cwd вложенного агента = workspace, поэтому спека
  // материализуется внутрь workspace, а в промпт идёт путь, существующий там.
  const workspaceSpecPath = path.join(options.workspace, WORKSPACE_SPECS_DIR, spec.file);
  const specPromptPath = path.relative(options.workspace, workspaceSpecPath).split(path.sep).join('/');
  const taskText = buildTaskText({ ...spec, relativePath: specPromptPath }, teamId);
  const apiKeyEntry = resolveApiKeyFromSystem();
  const pre =
    preflight({ profile: options.profile, workspace: options.workspace }, apiKeyEntry);
  report.precondition = pre.checks;
  report.steps.push({
    name: 'preflight',
    status: pre.ok ? 'ok' : 'failed',
    detail: pre.ok
      ? 'precondition пути H2 выполнено'
      : `не выполнено: ${pre.checks.filter((check) => !check.ok && check.optional !== true).map((check) => check.name).join(', ')}`,
  });

  const command = pre.dsh === null ? null : { command: pre.dsh.command, argv: [...pre.dsh.argvPrefix, '--profile', options.profile, taskText] };
  report.plan = {
    teamIdHint: teamId,
    stateDir: path.join(options.workspace, STATE_DIR_NAME, teamId),
    specPathInWorkspace: workspaceSpecPath,
    specPromptPath,
    taskText,
    command,
    cwd: options.workspace,
    timeoutMs: options.timeoutMs,
  };
  report.steps.push({ name: 'plan', status: 'ok', detail: command === null ? 'команда не построена: dsh не найден' : renderCommand(command) });

  /** Дозаписать запись прогона в историю (единственная запись этого скрипта). */
  const recordHistory = async () => {
    try {
      const history = await appendRunRecord(HISTORY_PATH, toRecord(report, options));
      report.history = history;
      report.steps.push({ name: 'history', status: 'recorded', detail: `${HISTORY_PATH} (записей: ${history.total})` });
    } catch (error) {
      report.steps.push({ name: 'history', status: 'failed', detail: String(error.message) });
    }
  };

  if (options.dryRun) {
    report.steps.push({
      name: 'materialize-spec',
      status: 'skipped',
      detail: `dry-run: спека не копируется; план: ${spec.relativePath} → ${workspaceSpecPath} (путь в промпте: ${specPromptPath})`,
    });
  } else {
    const materialized = await materializeSpec(options.workspace, spec);
    report.specMaterialized = {
      source: spec.relativePath,
      target: materialized.path,
      relativePath: materialized.relativePath,
      copied: materialized.copied,
      bytes: materialized.bytes,
    };
    report.steps.push({
      name: 'materialize-spec',
      status: materialized.ok ? 'ok' : 'failed',
      detail: materialized.ok
        ? materialized.copied
          ? `${spec.relativePath} → ${materialized.path} (${materialized.bytes} Б, путь в промпте: ${materialized.relativePath})`
          : `workspace = корень репо: копирование не нужно, спека уже на месте (${materialized.relativePath})`
        : materialized.error,
    });
    if (!materialized.ok) {
      report.result = { status: 'failed', reason: materialized.error };
      report.finishedAt = new Date().toISOString();
      await recordHistory();
      return { exitCode: 1, report };
    }
  }

  if (options.dryRun) {
    report.steps.push({
      name: 'stage-templates',
      status: 'skipped',
      detail: `dry-run: копирование не выполняется; план: ${TEMPLATE_FILES.map((name) => `${relativePosix(path.join(TEMPLATES_DIR, name))} → ${path.join(report.plan.stateDir, name)}`).join('; ')}`,
    });
  } else {
    const staged = await stageTemplates(options.workspace, teamId);
    report.templates = {
      dir: staged.dir,
      source: relativePosix(TEMPLATES_DIR),
      files: staged.files.map((file) => ({
        name: file.name,
        source: file.source,
        target: file.target,
        bytes: file.bytes,
        sha256: file.sha256,
        lastByte: file.lastByte,
        equal: file.equal,
      })),
    };
    report.steps.push({
      name: 'stage-templates',
      status: staged.ok ? 'ok' : 'failed',
      detail: staged.ok
        ? staged.files
          .map((file) => `${file.source} → ${file.target} (${file.bytes} Б, sha256:${file.sha256}, байт-в-байт: ${file.equal})`)
          .join('; ')
        : staged.error,
    });
    if (!staged.ok) {
      report.result = { status: 'failed', reason: staged.error };
      report.finishedAt = new Date().toISOString();
      await recordHistory();
      return { exitCode: 1, report };
    }
  }

  if (!pre.ok) {
    report.steps.push({
      name: 'execute',
      status: options.dryRun ? 'skipped' : 'failed',
      detail: options.dryRun
        ? 'dry-run: precondition не выполнено, команда не запускалась'
        : 'реальный прогон не стартовал: precondition не выполнено',
    });
    report.steps.push({ name: 'collect', status: 'skipped', detail: options.dryRun ? 'dry-run' : 'прогон не стартовал' });
    if (options.dryRun) {
      report.steps.push({ name: 'history', status: 'skipped', detail: 'dry-run: .project/mas-runs.json не изменяется' });
      report.result = {
        status: 'dry-run',
        reason: 'side effects не выполнялись: команда не создана, .project/mas-runs.json не изменён',
        preconditionMissing: pre.checks.filter((check) => !check.ok && check.optional !== true).map((check) => check.name),
      };
      report.finishedAt = new Date().toISOString();
      return { exitCode: 0, report };
    }
    report.result = {
      status: 'precondition-missing',
      reason: `путь H2 недоступен: ${pre.checks.filter((check) => !check.ok && check.optional !== true).map((check) => `${check.name} (${check.fix})`).join('; ')}`,
    };
    report.finishedAt = new Date().toISOString();
    await recordHistory();
    return { exitCode: 3, report };
  }

  if (options.dryRun) {
    report.steps.push({ name: 'execute', status: 'skipped', detail: `dry-run: команда не запускалась (${renderCommand(command)})` });
    report.steps.push({ name: 'collect', status: 'skipped', detail: 'dry-run' });
    report.steps.push({ name: 'history', status: 'skipped', detail: 'dry-run: .project/mas-runs.json не изменяется' });
    report.result = {
      status: 'dry-run',
      reason: 'side effects не выполнялись: команда не создана, .project/mas-runs.json не изменён',
    };
    report.finishedAt = new Date().toISOString();
    return { exitCode: 0, report };
  }

  // Реальный старт прогона (dry-run и ранние failure-возвраты сюда не доходят).
  notifyFireAndForget('mas_started', `⏳ Спека ${options.specId}: прогон команды запущен. Делать ничего не нужно.`);

  const execution = executeRun(command, options, pre.apiKey);
  report.steps.push({ name: 'execute', status: execution.ok ? 'ok' : 'failed', detail: execution.detail });
  report.execution = execution.evidence;

  const collected = await collectTeam(options.workspace, teamId, startedAtMs);
  if (collected.found) {
    report.steps.push({ name: 'collect', status: 'ok', detail: `${collected.via}: ${collected.file}` });
    report.team = { source: collected.via, file: collected.file, inbox: collected.inbox, state: summarizeTeam(collected.team) };
  } else {
    report.steps.push({
      name: 'collect',
      status: 'failed',
      detail: `team.json не найден (проверены ${report.plan.stateDir} и свежие команды в ${path.join(options.workspace, STATE_DIR_NAME)})`,
    });
  }

  const ok = execution.ok && collected.found;
  report.result = {
    status: ok ? 'ok' : 'failed',
    reason: ok
      ? 'команда создана, состояние прочитано с диска'
      : execution.ok
        ? 'прогон завершился, но команда на диске не найдена (модель не вызвала agent_teams_create)'
        : `прогон завершился неуспешно: ${execution.detail}`,
  };
  report.finishedAt = new Date().toISOString();
  await recordHistory();
  // Терминальная точка после старта (единственная): mas_started уже отправлен.
  notifyFireAndForget(
    'mas_finished',
    report.result.status === 'ok'
      ? `✅ Спека ${options.specId}: прогон завершён успешно. Дальше — приёмка отчёта.`
      : `⚠️ Спека ${options.specId}: прогон завершён с ошибкой. Нужен разбор.`,
  );

  return { exitCode: ok ? 0 : 1, report };
}

/** Запись истории: ровно поля spec/startedAt/finishedAt/status/report. */
export function toRecord(report, options) {
  return {
    spec: report.spec,
    startedAt: report.startedAt,
    finishedAt: report.finishedAt,
    status: report.result.status,
    report: { ...report, mode: options.dryRun ? 'dry-run' : 'run' },
  };
}

/** Синхронный запуск one-shot прогона с ограничением времени. */
export function executeRun(command, options, apiKey) {
  const key = apiKey ?? { key: null, source: 'missing' };
  const startedAtMs = Date.now();
  // Harness-процесс не наследует User-scope переменные (alert 2026-09-30):
  // если ключ не пришёл из env, он пробрасывается в дочерний процесс явно.
  const childEnv = { ...process.env };
  if (key.source === 'user-scope' && key.key) childEnv[API_KEY_VAR] = key.key;
  const probe = spawnSync(command.command, command.argv, {
    cwd: options.workspace,
    env: childEnv,
    encoding: 'utf8',
    timeout: options.timeoutMs,
    maxBuffer: 32 * 1024 * 1024,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const elapsedMs = Date.now() - startedAtMs;
  const spawnError = probe.error === undefined ? null : probe.error;
  const timedOut = spawnError !== null && spawnError.code === 'ETIMEDOUT';
  const status = probe.status;
  const evidence = {
    exitCode: status,
    signal: probe.signal ?? null,
    elapsedMs,
    timedOut,
    stdoutTail: tail(probe.stdout ?? '', 4_000),
    stderrTail: tail(probe.stderr ?? '', 4_000),
    error: spawnError === null ? null : `${spawnError.code ?? 'ERROR'}: ${spawnError.message}`,
  };
  const ok = !timedOut && spawnError === null && status === 0;
  let detail;
  if (timedOut) detail = `таймаут ${options.timeoutMs} мс — процесс прерван`;
  else if (spawnError !== null) detail = `ошибка запуска: ${evidence.error}`;
  else detail = `exit=${status}, ${elapsedMs} мс`;
  return { ok, exitCode: status, elapsedMs, detail, evidence };
}

/** Последние `limit` символов строки. */
function tail(text, limit) {
  const trimmed = String(text);
  return trimmed.length <= limit ? trimmed : `…${trimmed.slice(trimmed.length - limit)}`;
}

/** Путь относительно корня репозитория в POSIX-виде. */
function relativePosix(target) {
  return path.relative(REPO_ROOT, target).split(path.sep).join('/');
}

/** Печать команды в виде, пригодном для копирования. */
export function renderCommand(command) {
  const quote = (value) => (/[\s"]/.test(value) ? `"${value.replace(/"/g, '\\"')}"` : value);
  return [quote(command.command), ...command.argv.map(quote)].join(' ');
}

// ---------------------------------------------------------------------------
// Печать
// ---------------------------------------------------------------------------

/** Текстовый отчёт для человека. */
export function renderReport(report) {
  const lines = [];
  lines.push(`run-spec — MAS-прогон по спеке (путь к dsh-agent-teams из t0: PATH: ${report.path})`);
  lines.push(`путь: ${report.pathDetail}`);
  lines.push(`режим: ${report.mode}`);
  lines.push(`spec: ${report.spec}${report.specFile === undefined ? '' : ` (${report.specFile})`}`);
  if (report.specTitle !== undefined) lines.push(`заголовок: ${report.specTitle}`);
  lines.push(`profile: ${report.profile}`);
  lines.push(`workspace: ${report.workspace}`);
  if (report.plan !== null) {
    lines.push(`team id (подсказка): ${report.plan.teamIdHint}`);
    lines.push(`state dir: ${report.plan.stateDir}`);
  }
  lines.push('');
  lines.push('precondition:');
  for (const check of report.precondition) {
    const mark = check.ok ? 'ok  ' : check.optional === true ? 'info' : 'FAIL';
    lines.push(`  [${mark}] ${check.name}: ${check.detail}`);
    if (!check.ok && check.fix !== null && check.fix !== undefined) lines.push(`         fix: ${check.fix}`);
  }
  lines.push('');
  lines.push('шаги:');
  for (const [index, step] of report.steps.entries()) {
    lines.push(`  ${index + 1}. ${step.name} — ${step.status}: ${step.detail}`);
  }
  if (report.plan !== null && report.plan.command !== null) {
    lines.push('');
    lines.push('команда:');
    lines.push(`  ${renderCommand(report.plan.command)}`);
  }
  if (report.templates !== undefined) {
    lines.push('');
    lines.push(`handoff-шаблоны (${report.templates.source}) → ${report.templates.dir}:`);
    for (const file of report.templates.files) {
      lines.push(`  ${file.name}: ${file.bytes} Б, sha256:${file.sha256}, финальный байт:${file.lastByte}, байт-в-байт: ${file.equal}`);
    }
  }
  if (report.team !== undefined) {
    lines.push('');
    lines.push(`команда на диске (${report.team.source}): ${report.team.state.name ?? '—'} [${report.team.state.id ?? '—'}], phase=${report.team.state.phase ?? '—'}`);
    lines.push(`  членов: ${report.team.state.members.length}, задач: ${report.team.state.tasks.length}, ящиков: ${report.team.inbox.length}`);
  }
  if (report.execution !== undefined) {
    lines.push('');
    lines.push(`прогон: exit=${report.execution.exitCode}, ${report.execution.elapsedMs} мс${report.execution.timedOut ? ', таймаут' : ''}`);
    if (report.execution.stderrTail !== '') lines.push(`  stderr (tail): ${report.execution.stderrTail.split('\n').slice(-6).join('\n    ')}`);
  }
  lines.push('');
  lines.push(`результат: ${report.result.status} — ${report.result.reason}`);
  if (report.result.hint !== undefined && report.result.hint !== null) lines.push(`подсказка: ${report.result.hint}`);
  if (report.history !== null) lines.push(`история: ${report.history.path} (записей: ${report.history.total})`);
  return lines.join('\n');
}

/** Код ошибки из исключения (агрегаты/ENOENT и т.п.). */
function errorCodeOf(error) {
  const code = error !== undefined && error !== null && typeof error === 'object' ? error.code : undefined;
  return typeof code === 'string' ? code : 'UNKNOWN';
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  if (!parsed.ok) {
    if (parsed.error === 'help') {
      process.stdout.write(`${USAGE}\n`);
      process.exitCode = 0;
    } else {
      process.stderr.write(`${parsed.error}\n\n${USAGE}\n`);
      process.exitCode = parsed.exitCode;
    }
    return;
  }
  let outcome;
  try {
    outcome = await runSpec(parsed.options);
  } catch (error) {
    process.stderr.write(`ошибка: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
    return;
  }
  const stream = outcome.exitCode === 0 ? process.stdout : process.stderr;
  stream.write(
    parsed.options.json
      ? `${JSON.stringify(outcome.report, null, 2)}\n`
      : `${renderReport(outcome.report)}\n`,
  );
  process.exitCode = outcome.exitCode;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  await main();
}
