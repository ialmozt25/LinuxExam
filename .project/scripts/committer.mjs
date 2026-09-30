// committer.mjs - атомарный коммит по явному списку разрешённых путей
// (spec 034 "mas-autonomy-b", пункт "Что делаем 4" (B.3), задача t3).
//
// ЗАЧЕМ. Контур автономии (run-spec.mjs -> report-run.mjs -> sync.mjs) пишет
// артефакты в рабочее дерево, поэтому коммит прогона должен быть атомарным:
// либо ровно один коммит с ожидаемым набором путей, либо ничего. `git add -A`
// и `git add .` здесь НЕ используются: в индекс попадают только явно
// перечисленные пути, а фактическое содержимое индекса сверяется с
// allowed-множеством ДО коммита (spec 034, Edge Case "Committer (t3)").
//
// ИСПОЛЬЗОВАНИЕ
//   node .project/scripts/committer.mjs --message "<subject>" --allowed <path> [<path>...]
//        [--allowed <path>...] [--dry-run] [--json] [--cwd <dir>] [--no-verify]
//
// КОДЫ ВЫХОДА
//   0 - коммит создан; либо честный no-op (нечего коммитить); либо dry-run,
//       в котором коммит прошёл бы границы;
//   1 - ошибка окружения/выполнения git (не git-репозиторий, git add/commit
//       упал, путь игнорируется .gitignore, состав коммита не совпал);
//   2 - ошибка использования (нет --message / --allowed, неизвестный флаг,
//       путь вне репозитория, --allowed на корень репозитория);
//   3 - нарушение staged-set <= allowed: коммит НЕ выполняется, чужой индекс
//       не чистится и не перезаписывается (git reset/restore не вызываются).
//
// ГРАНИЦЫ (проверка вложенности). Staged-путь считается разрешённым, если он
// совпадает с allowed-путём (exact) либо лежит внутри allowed-каталога
// (nested). Сравнение - в форме NFC, через прямой слэш, без завершающих
// CR/LF и обрамляющих кавычек; на win32/darwin - регистронезависимо (там ФС по
// умолчанию регистронезависима), на прочих платформах - регистрозависимо.
// В отчёте для каждого staged-пути печатается, какой allowed-элемент его
// покрыл, поэтому ослабление до каталога всегда видно.
//
// PRE-COMMIT HOOK (spec 034, Edge Case "Committer (t3)"). Коммит выполняется
// БЕЗ --no-verify по умолчанию: хуки репозитория не обходятся. Гейт
// `sync:check` (внутри `npm run sync` / `consistency:check`) может быть красным
// по причинам, не относящимся к коммиту: живая AgentTeams-команда пишет
// не-volatile секцию "Пульс агентов" в docs/index.html - это известный шум
// SYNC DRIFT. Если хук роняет коммит из-за такого шума, --no-verify
// используется осознанно. Наличие хука печатается в отчёте (путь и факт
// существования). ФАКТ по репозиторию LinuxExam на момент t3 (spec 034):
// `.git/hooks/pre-commit` ОТСУТСТВУЕТ (проверено `Test-Path .git/hooks/pre-commit`
// и `git rev-parse --git-path hooks/pre-commit`), поэтому сейчас хуки не
// срабатывают вообще; хук-ветка остаётся на случай, если его добавят.
//
// Zero новых зависимостей: только Node ESM (node:child_process, node:fs,
// node:path, node:url) и git через spawnSync.

import { spawnSync } from 'node:child_process';
import { existsSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Коды выхода (контракт t3). */
export const EXIT_OK = 0;
/** Ошибка окружения или выполнения git. */
export const EXIT_ENV = 1;
/** Ошибка использования (аргументы). */
export const EXIT_USAGE = 2;
/** Нарушение staged-set <= allowed: коммит не выполняется. */
export const EXIT_BOUNDS = 3;

/** Глобальные опции git для read-only вызовов: без блокировок и без экранирования путей. */
const READ_GLOBALS = ['--no-optional-locks', '-c', 'core.quotePath=false'];
/** Глобальные опции git для пишущих вызовов (add/commit). */
const WRITE_GLOBALS = ['-c', 'core.quotePath=false'];

export const USAGE = [
  'usage: node .project/scripts/committer.mjs --message "<subject>" --allowed <path> [<path>...]',
  '       [--allowed <path>...] [--dry-run] [--json] [--cwd <dir>] [--no-verify]',
  '',
  'Атомарный коммит: git add только по явным путям, затем git commit.',
  'Перед коммитом фактическое содержимое индекса сверяется с allowed-множеством;',
  'при нарушении коммит не выполняется (exit 3).',
  '',
  'Аргументы:',
  '  --message "<subject>"   subject коммита (одна строка, обязателен)',
  '  --allowed <path>...     разрешённый путь; флаг повторяем, после флага можно',
  '                          перечислить несколько значений',
  '',
  'Флаги:',
  '  --dry-run               preview: subject, allowed-set, staged-set, результат',
  '                          проверки вложенности; индекс и история НЕ меняются;',
  '                          код выхода - прогноз реального прогона (0 или 3)',
  '  --json                  печатать отчёт в виде JSON',
  '  --cwd <dir>             каталог, внутри которого ищется git-репозиторий',
  '                          (по умолчанию - текущий каталог)',
  '  --no-verify             не запускать git-хуки (по умолчанию хуки не обходятся)',
  '  -h, --help              эта справка',
  '',
  'Коды выхода:',
  '  0 - успех, честный no-op (нечего коммитить) или чистый dry-run;',
  '  1 - ошибка окружения/выполнения git;',
  '  2 - ошибка использования;',
  '  3 - нарушение staged-set <= allowed (коммит не выполняется).',
  '',
  'Никогда не используется: git add -A, git add ., git add -u.',
].join('\n');

// ---------------------------------------------------------------------------
// Нормализация путей
// ---------------------------------------------------------------------------

/**
 * Снять BOM, завершающие CR/LF, пробелы и обрамляющие кавычки со значения,
 * пришедшего из argv (оболочка Windows/PowerShell часто добавляет лишнее).
 * @param {string} raw - значение из argv.
 */
export function cleanUserValue(raw) {
  let value = String(raw);
  if (value.charCodeAt(0) === 0xfeff) value = value.slice(1);
  value = value.replace(/[\r\n]+$/g, '').trim();
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
  else if (value.length >= 2 && value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
  return value;
}

/** Обратные слэши -> прямые слэши (единая форма для git и для сравнения). */
export function toPosixPath(value) {
  return String(value).replace(/\\/g, '/');
}

/**
 * Ключ сравнения пути: NFC, на регистронезависимых платформах - в нижнем
 * регистре. Используется ТОЛЬКО для сравнения; исходный путь для `git add`
 * не перекодируется (чтобы не разойтись с байтами файловой системы).
 * @param {string} relPosix - путь в POSIX-форме относительно корня репозитория.
 */
export function normalizePathKey(relPosix) {
  const nfc = toPosixPath(relPosix).normalize('NFC');
  return process.platform === 'win32' || process.platform === 'darwin' ? nfc.toLowerCase() : nfc;
}

/**
 * Каноническая форма существующего пути (на Windows - длинное имя вместо 8.3,
 * истинный регистр; git же возвращает свой вариант записи корня, например
 * `C:\Users\Alexey Udotov\...` там, где окружение дало `C:\Users\ALEXEY~1\...`).
 * Без канонизации сравнение относительных путей ложно объявляет путь "вне
 * репозитория". Если путь не существует - возвращается `path.resolve`.
 * @param {string} value
 */
export function canonicalizePath(value) {
  try {
    return realpathSync.native(value);
  } catch {
    return path.resolve(value);
  }
}

/**
 * Каноническая форма целевого пути, который может ещё не существовать (удалённый
 * файл, будущий артефакт): канонизируется самый глубокий существующий предок,
 * остаток приклеивается обратно.
 * @param {string} absPath - абсолютный путь в native-форме.
 */
export function canonicalizeTarget(absPath) {
  const rest = [];
  let current = path.resolve(absPath);
  for (;;) {
    try {
      const base = realpathSync.native(current);
      return rest.length === 0 ? base : path.join(base, ...[...rest].reverse());
    } catch {
      const parent = path.dirname(current);
      if (parent === current) return path.resolve(absPath);
      rest.push(path.basename(current));
      current = parent;
    }
  }
}

/**
 * Превратить пользовательский --allowed в запись для проверки границ.
 * @param {string} raw - как передано в CLI.
 * @param {string} repoRoot - корень репозитория (абсолютный, native).
 * @param {string} cwd - каталог вызова (для относительных путей).
 * @returns {{ok: true, entry: object}|{ok: false, error: string}}
 */
export function resolveAllowedEntry(raw, repoRoot, cwd) {
  const cleaned = cleanUserValue(raw);
  if (cleaned === '') return { ok: false, error: `пустой allowed-путь: ${JSON.stringify(raw)}` };
  const abs = canonicalizeTarget(path.resolve(cwd, toPosixPath(cleaned)));
  const relNative = path.relative(repoRoot, abs);
  if (relNative !== '' && (path.isAbsolute(relNative) || relNative === '..' || relNative.startsWith(`..${path.sep}`))) {
    return { ok: false, error: `allowed-путь вне репозитория: "${cleaned}" (${abs}, repo ${repoRoot})` };
  }
  if (relNative === '') {
    return { ok: true, entry: { raw: cleaned, rel: '.', key: '.', abs, wholeRepo: true } };
  }
  const rel = toPosixPath(relNative);
  return { ok: true, entry: { raw: cleaned, rel, key: normalizePathKey(rel), abs, wholeRepo: false } };
}

/**
 * Покрывает ли allowed-запись staged-путь: точное совпадение либо вложенность
 * в allowed-каталог.
 * @param {{key: string}} entry
 * @param {string} stagedKey - ключ staged-пути.
 */
export function covers(entry, stagedKey) {
  if (entry.key === stagedKey) return true;
  const prefix = entry.key.endsWith('/') ? entry.key : `${entry.key}/`;
  return stagedKey.startsWith(prefix);
}

/**
 * Проверка вложенности: staged-set <= allowed-set. Для каждого staged-пути
 * возвращается покрывающий allowed-элемент (или он попадает в violations).
 * @param {string[]} stagedPaths - пути из индекса (или прогноз для dry-run).
 * @param {object[]} allowedEntries - записи из resolveAllowedEntry.
 */
export function classifyPaths(stagedPaths, allowedEntries) {
  const matched = [];
  const violations = [];
  for (const staged of stagedPaths) {
    const key = normalizePathKey(staged);
    const hit = allowedEntries.find((entry) => covers(entry, key));
    if (hit === undefined) {
      violations.push({ path: toPosixPath(staged), key });
      continue;
    }
    matched.push({
      path: toPosixPath(staged),
      by: hit.rel,
      kind: hit.key === key ? 'exact' : 'nested',
    });
  }
  return { ok: violations.length === 0, matched, violations };
}

// ---------------------------------------------------------------------------
// Разбор аргументов
// ---------------------------------------------------------------------------

/**
 * Разбор argv. Возвращает `{ok: true, options}` либо `{ok: false, error, exitCode}`.
 * @param {string[]} argv - аргументы без `node` и имени скрипта.
 */
export function parseArgs(argv) {
  const options = {
    message: null,
    allowedRaw: [],
    dryRun: false,
    json: false,
    noVerify: false,
    cwd: process.cwd(),
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--') {
      for (let rest = index + 1; rest < argv.length; rest += 1) options.allowedRaw.push(argv[rest]);
      break;
    }
    if (!arg.startsWith('--')) {
      if (arg === '-h') return { ok: false, error: 'help', exitCode: EXIT_OK };
      return { ok: false, error: `лишний аргумент: ${arg}`, exitCode: EXIT_USAGE };
    }
    const eq = arg.indexOf('=');
    const flag = eq === -1 ? arg : arg.slice(0, eq);
    const inline = eq === -1 ? undefined : arg.slice(eq + 1);
    switch (flag) {
      case '--help':
        return { ok: false, error: 'help', exitCode: EXIT_OK };
      case '--message': {
        const raw = inline !== undefined ? inline : argv[(index += 1)];
        if (raw === undefined) return { ok: false, error: 'флаг --message требует значение', exitCode: EXIT_USAGE };
        options.message = cleanUserValue(raw);
        break;
      }
      case '--allowed': {
        if (inline !== undefined) options.allowedRaw.push(inline);
        while (index + 1 < argv.length && !argv[index + 1].startsWith('--')) {
          index += 1;
          options.allowedRaw.push(argv[index]);
        }
        break;
      }
      case '--cwd': {
        const raw = inline !== undefined ? inline : argv[(index += 1)];
        if (raw === undefined) return { ok: false, error: 'флаг --cwd требует значение', exitCode: EXIT_USAGE };
        const value = cleanUserValue(raw);
        if (value === '') return { ok: false, error: 'флаг --cwd требует непустое значение', exitCode: EXIT_USAGE };
        options.cwd = path.resolve(value);
        break;
      }
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--json':
        options.json = true;
        break;
      case '--no-verify':
        options.noVerify = true;
        break;
      default:
        return { ok: false, error: `неизвестный флаг: ${flag}`, exitCode: EXIT_USAGE };
    }
  }
  if (options.message === null || options.message === '') {
    return { ok: false, error: 'не задан --message (subject коммита)', exitCode: EXIT_USAGE };
  }
  if (/[\r\n]/.test(options.message)) {
    return { ok: false, error: 'subject коммита должен быть одной строкой (--message)', exitCode: EXIT_USAGE };
  }
  if (options.allowedRaw.length === 0) {
    return { ok: false, error: 'не задан ни один --allowed <path>', exitCode: EXIT_USAGE };
  }
  if (!existsSync(options.cwd)) {
    return { ok: false, error: `каталог --cwd не найден: ${options.cwd}`, exitCode: EXIT_USAGE };
  }
  return { ok: true, options };
}

// ---------------------------------------------------------------------------
// git
// ---------------------------------------------------------------------------

/** Разбор NUL-разделённого вывода git. */
export function parseZeroSeparated(text) {
  return String(text).split('\0').filter((item) => item !== '');
}

/** Первая непустая строка (для сообщений об ошибках git). */
function firstLine(text) {
  const lines = String(text).split(/\r?\n/).filter((line) => line.trim() !== '');
  return lines.length === 0 ? '' : lines[0].trim();
}

/** Хвост текста ограниченной длины. */
function tailText(text, limit = 2000) {
  const value = String(text);
  return value.length <= limit ? value : `...${value.slice(value.length - limit)}`;
}

/** Синхронный вызов git без наследования stdio. */
export function makeGit() {
  const run = (args, { cwd, globals = READ_GLOBALS, timeoutMs = 120_000 } = {}) => {
    const probe = spawnSync('git', [...globals, ...args], {
      cwd,
      encoding: 'utf8',
      windowsHide: true,
      maxBuffer: 32 * 1024 * 1024,
      timeout: timeoutMs,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const spawnError = probe.error === undefined ? null : `${probe.error.code ?? 'ERROR'}: ${probe.error.message}`;
    return {
      status: probe.status,
      stdout: probe.stdout ?? '',
      stderr: probe.stderr ?? '',
      spawnError,
      failed: spawnError !== null || probe.status === null,
    };
  };
  return { run };
}

/** SHA HEAD или null, если коммитов ещё нет. */
export function headSha(git, repoRoot) {
  const probe = git.run(['rev-parse', 'HEAD'], { cwd: repoRoot });
  return probe.status === 0 && !probe.failed ? firstLine(probe.stdout) : null;
}

/** Количество коммитов HEAD или null, если коммитов ещё нет. */
export function commitCount(git, repoRoot) {
  const probe = git.run(['rev-list', '--count', 'HEAD'], { cwd: repoRoot });
  if (probe.failed || probe.status !== 0) return null;
  const value = Number(firstLine(probe.stdout));
  return Number.isFinite(value) ? value : null;
}

/** Содержимое индекса (staged-set): `git diff --cached --name-only -z`. */
export function readIndex(git, repoRoot) {
  const probe = git.run(['diff', '--cached', '--name-only', '-z'], { cwd: repoRoot });
  if (probe.failed || probe.status !== 0) {
    return { ok: false, error: `git diff --cached не выполнился (exit=${probe.status}): ${firstLine(probe.stderr)}`, paths: [] };
  }
  return { ok: true, error: null, paths: parseZeroSeparated(probe.stdout) };
}

/** Отслеживаемые файлы под указанными путями: `git ls-files -z -- <paths>`. */
export function readTracked(git, repoRoot, relPaths) {
  const probe = git.run(['ls-files', '-z', '--', ...relPaths], { cwd: repoRoot });
  if (probe.failed || probe.status !== 0) return [];
  return parseZeroSeparated(probe.stdout);
}

/** Пути, попадающие под .gitignore: `git check-ignore -z -- <paths>`. */
export function readIgnored(git, repoRoot, relPaths) {
  const probe = git.run(['check-ignore', '-z', '--', ...relPaths], { cwd: repoRoot });
  if (probe.status === 1 && !probe.failed) return [];
  if (probe.failed || probe.status !== 0) return [];
  return parseZeroSeparated(probe.stdout);
}

/**
 * Кандидаты на `git add` (read-only): `git status --porcelain -z -- <paths>`.
 * При переименовании возвращаются оба имени (старое и новое) - оба должны быть
 * разрешены, иначе границы не пройдут.
 */
export function readCandidates(git, repoRoot, relPaths) {
  const probe = git.run(['status', '--porcelain', '-z', '--', ...relPaths], { cwd: repoRoot });
  if (probe.failed || probe.status !== 0) {
    return { ok: false, error: `git status не выполнился (exit=${probe.status}): ${firstLine(probe.stderr)}`, paths: [] };
  }
  const paths = [];
  for (const field of parseZeroSeparated(probe.stdout)) {
    if (field.length <= 3) continue;
    const candidate = toPosixPath(field.slice(3));
    if (candidate !== '' && !paths.includes(candidate)) paths.push(candidate);
  }
  return { ok: true, error: null, paths };
}

/** Путь pre-commit hook (существует он или нет). */
export function hookPathOf(git, repoRoot) {
  const probe = git.run(['rev-parse', '--git-path', 'hooks/pre-commit'], { cwd: repoRoot });
  if (probe.failed || probe.status !== 0) return null;
  const raw = firstLine(probe.stdout);
  return raw === '' ? null : path.resolve(repoRoot, raw);
}

/** Файлы конкретного коммита (для post-commit проверки). */
export function readCommitFiles(git, repoRoot, sha) {
  if (sha === null) return [];
  const probe = git.run(['diff-tree', '--root', '--no-commit-id', '--name-only', '-r', '-z', sha], { cwd: repoRoot });
  if (probe.failed || probe.status !== 0) return [];
  return parseZeroSeparated(probe.stdout);
}

/** Subject коммита (одна строка). */
export function readCommitSubject(git, repoRoot, sha) {
  if (sha === null) return null;
  const probe = git.run(['log', '-1', '--format=%s', sha], { cwd: repoRoot });
  if (probe.failed || probe.status !== 0) return null;
  return probe.stdout.replace(/\r?\n$/, '');
}

// ---------------------------------------------------------------------------
// Основной сценарий
// ---------------------------------------------------------------------------

/**
 * Полный сценарий. Никогда не бросает на ожидаемых состояниях: возвращает
 * `{exitCode, report}` для печати и для тестов.
 * @param {object} options - разобранные опции (`parseArgs().options`).
 */
export function runCommitter(options) {
  const report = {
    tool: 'committer',
    version: 1,
    spec: '034',
    task: 't3',
    mode: options.dryRun ? 'dry-run' : 'run',
    cwd: options.cwd,
    repoRoot: null,
    subject: options.message,
    noVerify: options.noVerify === true,
    allowed: [],
    skipped: [],
    indexBefore: [],
    candidates: [],
    indexAfterAdd: [],
    boundsBeforeAdd: null,
    bounds: null,
    predicted: null,
    commit: null,
    hook: null,
    noop: false,
    warnings: [],
    result: { status: 'unknown', reason: '' },
    startedAt: new Date().toISOString(),
    finishedAt: null,
  };

  const finish = (exitCode, status, reason) => {
    report.result = { status, reason };
    report.finishedAt = new Date().toISOString();
    return { exitCode, report };
  };
  const fatal = (exitCode, error) => {
    report.warnings.push(error);
    return finish(exitCode, exitCode === EXIT_USAGE ? 'usage-error' : 'env-error', error);
  };

  const git = makeGit();
  const rootProbe = git.run(['rev-parse', '--show-toplevel'], { cwd: options.cwd });
  if (rootProbe.failed || rootProbe.status !== 0) {
    const detail = rootProbe.spawnError !== null ? rootProbe.spawnError : firstLine(rootProbe.stderr);
    return fatal(EXIT_ENV, `не удалось определить корень git-репозитория для ${options.cwd}: ${detail}`);
  }
  const repoRoot = canonicalizePath(firstLine(rootProbe.stdout));
  const cwdCanonical = canonicalizePath(options.cwd);
  report.cwd = cwdCanonical;
  report.repoRoot = repoRoot;

  // --- allowed-множество ---------------------------------------------------
  const entries = [];
  const seen = new Set();
  for (const raw of options.allowedRaw) {
    const resolved = resolveAllowedEntry(raw, repoRoot, cwdCanonical);
    if (!resolved.ok) return fatal(EXIT_USAGE, resolved.error);
    const entry = resolved.entry;
    if (entry.wholeRepo) {
      return fatal(
        EXIT_USAGE,
        `allowed-путь "${entry.raw}" указывает на корень репозитория: git add . запрещён - перечислите явные пути`,
      );
    }
    if (seen.has(entry.key)) continue;
    seen.add(entry.key);
    entries.push(entry);
    report.allowed.push({ raw: entry.raw, rel: entry.rel });
  }

  // --- хук -----------------------------------------------------------------
  const hookPath = hookPathOf(git, repoRoot);
  report.hook = { path: hookPath, exists: hookPath !== null && existsSync(hookPath) };

  // --- индекс до -----------------------------------------------------------
  const indexBefore = readIndex(git, repoRoot);
  if (!indexBefore.ok) return fatal(EXIT_ENV, indexBefore.error);
  report.indexBefore = indexBefore.paths;
  report.boundsBeforeAdd = classifyPaths(indexBefore.paths, entries);

  const beforeHead = headSha(git, repoRoot);
  const beforeCount = commitCount(git, repoRoot);
  report.before = { head: beforeHead, count: beforeCount };

  // --- какие allowed-пути реально можно добавить ---------------------------
  const addableRel = entries.map((entry) => entry.rel);
  const tracked = new Set(readTracked(git, repoRoot, addableRel).map(normalizePathKey));
  const addable = [];
  for (const entry of entries) {
    if (existsSync(entry.abs) || tracked.has(entry.key)) addable.push(entry);
    else report.skipped.push({ raw: entry.raw, rel: entry.rel, reason: 'нет файла и нет в индексе' });
  }
  if (report.skipped.length > 0) {
    report.warnings.push(
      `пропущены пути, которых нет ни на диске, ни в индексе: ${report.skipped.map((item) => item.rel).join(', ')}`,
    );
  }

  const blockedIgnored = readIgnored(git, repoRoot, addable.map((entry) => entry.rel))
    .filter((item) => !tracked.has(normalizePathKey(item)));
  if (blockedIgnored.length > 0) {
    return fatal(
      EXIT_ENV,
      `пути игнорируются .gitignore и не отслеживаются, git add по ним не выполнится: ${blockedIgnored.map(toPosixPath).join(', ')}`,
    );
  }

  // --- dry-run: только preview, индекс и история не меняются ---------------
  if (options.dryRun) {
    const candidates = readCandidates(git, repoRoot, addable.map((entry) => entry.rel));
    if (!candidates.ok) return fatal(EXIT_ENV, candidates.error);
    report.candidates = candidates.paths;
    const predicted = [...indexBefore.paths];
    for (const candidate of candidates.paths) {
      if (!predicted.includes(candidate)) predicted.push(candidate);
    }
    report.predicted = classifyPaths(predicted, entries);
    if (report.boundsBeforeAdd.violations.length > 0 || report.predicted.violations.length > 0) {
      return finish(
        EXIT_BOUNDS,
        'dry-run-bounds-violation',
        'прогноз: staged-set не входит в allowed - реальный прогон завершился бы кодом 3; индекс и история не изменялись',
      );
    }
    if (predicted.length === 0) {
      report.noop = true;
      return finish(EXIT_OK, 'dry-run-noop', 'прогноз: нечего коммитить; индекс и история не изменялись');
    }
    return finish(EXIT_OK, 'dry-run-ok', 'прогноз: коммит прошёл бы границы; индекс и история не изменялись');
  }

  // --- run: границы ДО коммита --------------------------------------------
  if (report.boundsBeforeAdd.violations.length > 0) {
    return finish(
      EXIT_BOUNDS,
      'bounds-violation',
      'в индексе уже есть пути вне allowed: git add не выполнялся, индекс не изменён, коммит не создан',
    );
  }

  if (addable.length > 0) {
    const addProbe = git.run(['add', '--', ...addable.map((entry) => entry.rel)], { cwd: repoRoot, globals: WRITE_GLOBALS });
    if (addProbe.failed || addProbe.status !== 0) {
      const detail = addProbe.spawnError !== null ? addProbe.spawnError : firstLine(addProbe.stderr);
      return fatal(EXIT_ENV, `git add не выполнился (exit=${addProbe.status}): ${detail}`);
    }
  }

  const indexAfterAdd = readIndex(git, repoRoot);
  if (!indexAfterAdd.ok) return fatal(EXIT_ENV, indexAfterAdd.error);
  report.indexAfterAdd = indexAfterAdd.paths;
  report.bounds = classifyPaths(indexAfterAdd.paths, entries);
  if (report.bounds.violations.length > 0) {
    return finish(
      EXIT_BOUNDS,
      'bounds-violation',
      'staged-set не входит в allowed: коммит НЕ выполнен, чужой индекс не чистился и не перезаписывался',
    );
  }
  if (indexAfterAdd.paths.length === 0) {
    report.noop = true;
    return finish(EXIT_OK, 'noop', 'нечего коммитить: индекс пуст (изменений относительно HEAD нет), коммит не создавался');
  }

  // --- коммит --------------------------------------------------------------
  const commitArgs = ['commit', `--message=${options.message}`];
  if (options.noVerify) commitArgs.push('--no-verify');
  const commitProbe = git.run(commitArgs, { cwd: repoRoot, globals: WRITE_GLOBALS, timeoutMs: 10 * 60 * 1000 });
  if (commitProbe.failed || commitProbe.status !== 0) {
    report.commit = {
      created: false,
      exitCode: commitProbe.status,
      stdoutTail: tailText(commitProbe.stdout),
      stderrTail: tailText(commitProbe.stderr),
    };
    const detail = firstLine(commitProbe.stderr) || firstLine(commitProbe.stdout) || commitProbe.spawnError || 'нет вывода';
    return finish(EXIT_ENV, 'commit-failed', `git commit не выполнился (exit=${commitProbe.status}): ${detail}; индекс не чистился`);
  }

  const afterHead = headSha(git, repoRoot);
  const afterCount = commitCount(git, repoRoot);
  const files = readCommitFiles(git, repoRoot, afterHead);
  const subject = readCommitSubject(git, repoRoot, afterHead);
  const committedBounds = classifyPaths(files, entries);
  report.commit = {
    created: true,
    head: afterHead,
    count: afterCount,
    countBefore: beforeCount,
    subject,
    subjectMatched: subject === options.message,
    files,
    bounds: committedBounds,
  };
  if (!report.commit.subjectMatched || committedBounds.violations.length > 0) {
    return finish(
      EXIT_ENV,
      'commit-mismatch',
      'коммит создан, но состав или subject отличается от ожидаемого - требуется ручная проверка',
    );
  }
  return finish(
    EXIT_OK,
    'committed',
    `коммит ${(afterHead ?? '').slice(0, 12)}: ${files.length} путей, subject совпал побайтово`,
  );
}

// ---------------------------------------------------------------------------
// Печать
// ---------------------------------------------------------------------------

/** Метка вида совпадения для отчёта. */
function kindLabel(kind) {
  if (kind === 'exact') return 'точное совпадение';
  if (kind === 'nested') return 'внутри allowed-каталога';
  return kind;
}

/** Секция проверки вложенности. */
function renderBounds(label, bounds, lines) {
  if (bounds === null) return;
  lines.push(`${label}: ${bounds.ok ? 'OK - staged-set входит в allowed' : `НАРУШЕНИЕ - путей вне allowed: ${bounds.violations.length}`}`);
  for (const item of bounds.matched) lines.push(`  [ok]   ${item.path} <- ${item.by} (${kindLabel(item.kind)})`);
  for (const item of bounds.violations) lines.push(`  [FAIL] ${item.path} - не покрыт ни одним --allowed`);
}

/** Текстовый отчёт для человека. */
export function renderReport(report) {
  if (report.result.status === 'usage-error') {
    return [
      'committer - ошибка использования',
      `  ${report.result.reason}`,
      '',
      'справка: node .project/scripts/committer.mjs --help',
    ].join('\n');
  }
  const lines = [];
  lines.push('committer - атомарный коммит по явному списку путей (spec 034, B.3 / t3)');
  lines.push(`режим: ${report.mode}`);
  lines.push(`cwd: ${report.cwd}`);
  lines.push(`repo: ${report.repoRoot ?? '-'}`);
  lines.push(`subject: ${report.subject}`);
  lines.push('');
  lines.push(`allowed (${report.allowed.length}):`);
  for (const entry of report.allowed) {
    lines.push(`  - ${entry.rel}${entry.rel === entry.raw ? '' : ` (из "${entry.raw}")`}`);
  }
  if (report.skipped.length > 0) {
    lines.push('пропущено:');
    for (const item of report.skipped) lines.push(`  - ${item.rel}: ${item.reason}`);
  }
  lines.push('');
  lines.push(`индекс до (git diff --cached --name-only): ${report.indexBefore.length === 0 ? 'пусто' : `${report.indexBefore.length} путей`}`);
  for (const item of report.indexBefore) lines.push(`  - ${item}`);
  if (report.hook !== null) {
    lines.push('');
    lines.push(`pre-commit hook: ${report.hook.exists ? report.hook.path : `отсутствует (${report.hook.path ?? 'путь не определён'})`}`);
    if (report.hook.exists && !report.noVerify) {
      lines.push('  внимание: хук выполняется; гейт sync:check может быть красным по причинам,');
      lines.push('  не относящимся к коммиту (SYNC DRIFT: живая AgentTeams-команда пишет');
      lines.push('  не-volatile секцию "Пульс агентов" в docs/index.html). Тогда - --no-verify осознанно.');
    }
  }
  lines.push('');
  renderBounds('границы ДО коммита (индекс до add)', report.boundsBeforeAdd, lines);
  if (report.mode === 'dry-run') {
    lines.push('');
    lines.push(`кандидаты git add (git status --porcelain по allowed): ${report.candidates.length === 0 ? 'нет' : ''}`);
    for (const item of report.candidates) lines.push(`  - ${item}`);
    lines.push('');
    renderBounds('границы ПОСЛЕ прогноза add (индекс до + кандидаты)', report.predicted, lines);
    lines.push('');
    lines.push('dry-run: индекс и история НЕ изменялись (git add и git commit не вызывались)');
  } else {
    if (report.indexAfterAdd.length > 0) {
      lines.push('');
      lines.push(`индекс после add: ${report.indexAfterAdd.length} путей`);
      for (const item of report.indexAfterAdd) lines.push(`  - ${item}`);
    }
    lines.push('');
    renderBounds('границы ПЕРЕД коммитом (фактический индекс)', report.bounds, lines);
  }
  if (report.commit !== null) {
    lines.push('');
    if (report.commit.created) {
      lines.push(`коммит: создан ${report.commit.head}`);
      lines.push(`  коммитов до/после: ${report.commit.countBefore ?? 0} -> ${report.commit.count ?? '?'}`);
      lines.push(`  subject в коммите: ${report.commit.subject}`);
      lines.push(`  subject совпал: ${report.commit.subjectMatched}`);
      lines.push(`  путей в коммите: ${report.commit.files.length}`);
      for (const item of report.commit.files) lines.push(`  - ${item}`);
      renderBounds('  границы состава коммита', report.commit.bounds, lines);
    } else {
      lines.push(`коммит: НЕ создан (exit=${report.commit.exitCode})`);
      if (report.commit.stderrTail !== '') lines.push(`  stderr: ${firstLine(report.commit.stderrTail)}`);
      if (report.commit.stdoutTail !== '') lines.push(`  stdout: ${firstLine(report.commit.stdoutTail)}`);
    }
  }
  for (const warning of report.warnings) {
    lines.push('');
    lines.push(`предупреждение: ${warning}`);
  }
  lines.push('');
  lines.push(`результат: ${report.result.status} - ${report.result.reason}`);
  return lines.join('\n');
}

function main() {
  const parsed = parseArgs(process.argv.slice(2));
  if (!parsed.ok) {
    if (parsed.error === 'help') {
      process.stdout.write(`${USAGE}\n`);
      process.exitCode = EXIT_OK;
    } else {
      process.stderr.write(`${parsed.error}\n\n${USAGE}\n`);
      process.exitCode = parsed.exitCode;
    }
    return;
  }
  let outcome;
  try {
    outcome = runCommitter(parsed.options);
  } catch (error) {
    process.stderr.write(`ошибка: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = EXIT_ENV;
    return;
  }
  const stream = outcome.exitCode === EXIT_OK ? process.stdout : process.stderr;
  stream.write(parsed.options.json ? `${JSON.stringify(outcome.report, null, 2)}\n` : `${renderReport(outcome.report)}\n`);
  process.exitCode = outcome.exitCode;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main();
}
