// fetch-stats.mjs — GoatCounter API (site `barsik`) → `.project/state.json` (spec 037, task t1).
//
// Контракт API (spec 037, «## Контекст»):
//   GET https://<site>.goatcounter.com/api/v0/stats/total
//   заголовки: Authorization: Bearer <token>, Accept: application/json,
//              Content-Type: application/json
//   query: start, end (RFC3339; по умолчанию — последние 7 дней)
//   ответ:   { total, total_events, total_utc, stats: [{ day, hourly, daily }] }
//   `total` — число уникальных посетителей за период; pageviews этот ответ НЕ
//   отдаёт (разбивку `stats[].hourly` в pageviews не пересчитываем) → null.
//
// Токен (вне репо): `~/.dsh/goatcounter-token.json` = { "token": "...", "site": "barsik" }
//   Env-fallback (только для CI): GOATCOUNTER_TOKEN, сайт — GOATCOUNTER_SITE.
//   Значение токена НИКОГДА не печатается (ни в stdout, ни в stderr).
//
// Запись в state.json (идемпотентно, меняется только `user_counter`):
//   "user_counter": { "unique_users": <int>, "pageviews": null,
//                     "period": { "start": <RFC3339>, "end": <RFC3339> },
//                     "fetched_at": <ISO>, "source": "goatcounter" }
//   Остальные ключи state.json не трогаются; файл пишется атомарно
//   (temp-файл рядом + rename), поэтому битый JSON/сеть state.json не портят.
//
// Границы периода по умолчанию — календарные сутки UTC: start = 00:00:00Z
// (сегодня − 6 дней), end = 23:59:59Z (сегодня). Повторный прогон в те же сутки
// даёт тот же period (дифф только в fetched_at).
//
// Использование:
//   node .project/scripts/fetch-stats.mjs [--json] [--dry-run] [--days <n>]
//        [--start <RFC3339>] [--end <RFC3339>] [--site <code>]
//        [--token-file <path>] [--state-file <path>]
//        [--api-base <url>] [--attempts <n>] [--timeout <ms>]
//
// Коды выхода:
//   0 — статистика получена (и, если не --dry-run, user_counter записан);
//   1 — нет/неверный токен, 401, 403, 429/5xx после ретраев, сеть, битый JSON,
//       ошибка записи (state.json при этом не портится);
//   2 — ошибка использования (неизвестный флаг, нечисловой/пустой параметр).
//
// Живого API нет (сайт `barsik` может быть ещё не создан, токен-файл может
// отсутствовать) — проверка без реального API: запуск без токена (exit 1) и
// запуск с тестовым токеном + `--api-base http://127.0.0.1:<порт>/api/v0`
// (смоук с локальным fake-сервером/закрытым портом).

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Пути и параметры по умолчанию. */
export const DEFAULT_TOKEN_PATH = path.join(os.homedir(), '.dsh', 'goatcounter-token.json');
export const DEFAULT_STATE_PATH = path.join(ROOT, '.project', 'state.json');
export const DEFAULT_SITE = 'barsik';
export const DEFAULT_DAYS = 7;
export const DEFAULT_ATTEMPTS = 3;
export const DEFAULT_TIMEOUT_MS = 15_000;
/** Верхняя граница Retry-After, которую согласны ждать (мс). */
const MAX_RETRY_AFTER_MS = 10_000;
/** Базовый backoff: 1 с, 2 с, 4 с… */
const BACKOFF_BASE_MS = 1_000;

const USAGE = [
  'usage: node .project/scripts/fetch-stats.mjs [--json] [--dry-run] [--days <n>]',
  '       [--start <RFC3339>] [--end <RFC3339>] [--site <code>]',
  '       [--token-file <path>] [--state-file <path>]',
  '       [--api-base <url>] [--attempts <n>] [--timeout <ms>]',
  '  по умолчанию: сайт barsik, период — последние 7 суток UTC (календарные).',
].join('\n');

const EXIT_OK = 0;
const EXIT_ERROR = 1;
const EXIT_USAGE = 2;

/* ------------------------------------------------------------------ утилиты */

/** RFC3339 без миллисекунд: `2026-09-29T00:00:00Z`. */
export function toRfc3339(date) {
  return new Date(date).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/** Границы последних `days` календарных суток UTC (end — конец сегодняшних). */
export function defaultPeriod(days, now = new Date()) {
  const dayMs = 86_400_000;
  const todayStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return {
    start: new Date(todayStart - (days - 1) * dayMs),
    end: new Date(todayStart + dayMs - 1_000),
  };
}

/** Валиден ли RFC3339-момент (то, что принимает API). */
export function isRfc3339(value) {
  if (typeof value !== 'string' || value.trim() === '') return false;
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(value.trim()) && Number.isFinite(Date.parse(value));
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/* -------------------------------------------------------------- разбор argv */

/** Разбор argv → `{ ok: true, options }` либо `{ ok: false, error }`. */
export function parseArgs(argv) {
  const options = {
    json: false,
    dryRun: false,
    days: DEFAULT_DAYS,
    start: null,
    end: null,
    site: null,
    tokenFile: null,
    statePath: null,
    apiBase: null,
    attempts: DEFAULT_ATTEMPTS,
    timeoutMs: DEFAULT_TIMEOUT_MS,
  };
  const positiveInt = (name, value, max) => {
    if (!/^\d+$/.test(String(value))) return `${name} требует целое число, получено: ${value}`;
    const n = Number(value);
    if (n < 1 || n > max) return `${name} вне диапазона 1..${max}, получено: ${value}`;
    return null;
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const [flag, inline] = arg.startsWith('--') ? arg.split('=', 2) : [arg, undefined];
    if (flag === '--help' || arg === '-h') return { ok: false, error: 'help' };
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
      case '--days': {
        const value = takeValue();
        const problem = value === undefined ? 'флаг --days требует значение' : positiveInt('--days', value, 365);
        if (problem) return { ok: false, error: problem };
        options.days = Number(value);
        break;
      }
      case '--start':
      case '--end': {
        const value = takeValue();
        if (value === undefined) return { ok: false, error: `флаг ${flag} требует значение` };
        if (!isRfc3339(value)) return { ok: false, error: `${flag}: ожидается RFC3339 (например 2026-09-23T00:00:00Z), получено: ${value}` };
        if (flag === '--start') options.start = value;
        else options.end = value;
        break;
      }
      case '--site': {
        const value = takeValue();
        if (value === undefined || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value)) {
          return { ok: false, error: `--site требует код сайта (например barsik), получено: ${value}` };
        }
        options.site = value;
        break;
      }
      case '--token-file': {
        const value = takeValue();
        if (value === undefined || value.trim() === '') return { ok: false, error: 'флаг --token-file требует путь' };
        options.tokenFile = value;
        break;
      }
      case '--state-file': {
        const value = takeValue();
        if (value === undefined || value.trim() === '') return { ok: false, error: 'флаг --state-file требует путь' };
        options.statePath = value;
        break;
      }
      case '--api-base': {
        const value = takeValue();
        if (value === undefined || value.trim() === '') return { ok: false, error: 'флаг --api-base требует URL' };
        options.apiBase = value.replace(/\/+$/, '');
        break;
      }
      case '--attempts': {
        const value = takeValue();
        const problem = value === undefined ? 'флаг --attempts требует значение' : positiveInt('--attempts', value, 5);
        if (problem) return { ok: false, error: problem };
        options.attempts = Number(value);
        break;
      }
      case '--timeout': {
        const value = takeValue();
        const problem = value === undefined ? 'флаг --timeout требует значение' : positiveInt('--timeout', value, 120_000);
        if (problem) return { ok: false, error: problem };
        options.timeoutMs = Number(value);
        break;
      }
      default:
        return { ok: false, error: `неизвестный флаг: ${arg}` };
    }
  }
  if (options.start !== null && options.end !== null && Date.parse(options.start) > Date.parse(options.end)) {
    return { ok: false, error: `--start (${options.start}) позже --end (${options.end})` };
  }
  return { ok: true, options };
}

/* ------------------------------------------------------------------- токен */

/**
 * Токен и сайт.
 * Возвращает `{ ok: true, auth, site, source, tokenFile }` либо
 * `{ ok: false, message }` (сообщение БЕЗ значения токена).
 */
export function resolveToken({ tokenFile, env = process.env, siteOverride = null }) {
  const file = path.resolve(tokenFile);
  if (fs.existsSync(file)) {
    let raw;
    try {
      raw = fs.readFileSync(file, 'utf8');
    } catch (error) {
      return { ok: false, message: `не удалось прочитать токен-файл: ${file}\n  причина: ${String(error && error.message)}` };
    }
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      return { ok: false, message: `токен-файл не является корректным JSON: ${file}\n  причина: ${String(error && error.message)}\n  формат: {"token":"...","site":"barsik"}` };
    }
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ok: false, message: `токен-файл должен содержать объект {"token":"...","site":"barsik"}: ${file}` };
    }
    const value = parsed.token;
    if (typeof value !== 'string' || value.trim() === '') {
      return { ok: false, message: `в токен-файле нет непустого строкового поля "token": ${file}` };
    }
    const site = siteOverride || (typeof parsed.site === 'string' && parsed.site.trim() !== '' ? parsed.site.trim() : DEFAULT_SITE);
    return { ok: true, auth: value, site, source: 'file', tokenFile: file };
  }

  const envValue = typeof env.GOATCOUNTER_TOKEN === 'string' ? env.GOATCOUNTER_TOKEN.trim() : '';
  if (envValue !== '') {
    const site = siteOverride || (typeof env.GOATCOUNTER_SITE === 'string' && env.GOATCOUNTER_SITE.trim() !== '' ? env.GOATCOUNTER_SITE.trim() : DEFAULT_SITE);
    return { ok: true, auth: envValue, site, source: 'env', tokenFile: file };
  }

  return {
    ok: false,
    message: [
      `токен GoatCounter не найден: файла нет — ${file}`,
      '  ожидаемый формат: { "token": "...", "site": "barsik" }',
      '  подсказка: создайте токен в dashboard (Settings → API tokens, права "stats")',
      '             и сохраните файл по указанному пути;',
      '             либо задайте env GOATCOUNTER_TOKEN (только для CI).',
    ].join('\n'),
  };
}

/* -------------------------------------------------------------------- HTTP */

/** Пауза перед попыткой: Retry-After (≤ 10 с) либо экспоненциальный backoff. */
export function retryDelayMs(attempt, retryAfterHeader) {
  const parsed = Number.parseInt(String(retryAfterHeader ?? '').trim(), 10);
  if (Number.isFinite(parsed) && parsed >= 0) return Math.min(parsed * 1_000, MAX_RETRY_AFTER_MS);
  return BACKOFF_BASE_MS * 2 ** (attempt - 1);
}

function describeError(error) {
  if (!error) return 'неизвестная ошибка';
  if (error.name === 'TimeoutError' || error.name === 'AbortError') return 'таймаут запроса';
  const cause = error.cause;
  if (cause) {
    if (Array.isArray(cause.errors) && cause.errors.length > 0) {
      const codes = cause.errors.map((item) => (item && item.code ? item.code : item && item.message)).filter(Boolean);
      if (codes.length > 0) return `fetch failed (${codes.join(', ')})`;
    }
    if (cause.code) return `fetch failed (${cause.code})`;
    if (cause.message) return `fetch failed (${cause.message})`;
  }
  if (error.code) return `${error.message} (${error.code})`;
  return String(error.message ?? error);
}

/**
 * GET stats/total с ретраями на 429/5xx и сетевых сбоях.
 * `{ ok: true, data, status, attempts }` либо `{ ok: false, message, status, attempts }`.
 */
export async function fetchTotal({ url, auth, attempts, timeoutMs, sleepFn = sleep, fetchFn = fetch, log = () => {} }) {
  let last = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    let response;
    try {
      response = await fetchFn(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${auth}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      last = { kind: 'network', status: null, message: `сеть недоступна: ${describeError(error)}` };
      if (attempt < attempts) {
        const delay = retryDelayMs(attempt, null);
        log(`попытка ${attempt}/${attempts}: ${last.message} — повтор через ${delay} мс`);
        await sleepFn(delay);
        continue;
      }
      return { ok: false, message: `${last.message} — исчерпаны попытки (${attempts})`, status: null, attempts: attempt };
    }

    const status = response.status;
    if (status === 401) {
      return { ok: false, message: 'HTTP 401 — токен отсутствует, истёк или неверен (проверьте ~/.dsh/goatcounter-token.json)', status, attempts: attempt };
    }
    if (status === 403) {
      return { ok: false, message: 'HTTP 403 — у токена нет прав "stats" (пересоздайте токен в GoatCounter с правом stats)', status, attempts: attempt };
    }
    if (status === 429 || status >= 500) {
      last = { kind: 'http', status, message: `HTTP ${status} — сервис ограничил запрос или недоступен` };
      if (attempt < attempts) {
        const delay = retryDelayMs(attempt, response.headers.get('retry-after'));
        log(`попытка ${attempt}/${attempts}: ${last.message} — повтор через ${delay} мс`);
        await sleepFn(delay);
        continue;
      }
      return { ok: false, message: `${last.message} — исчерпаны попытки (${attempts})`, status, attempts: attempt };
    }
    if (!response.ok) {
      return { ok: false, message: `HTTP ${status} — неожиданный ответ API`, status, attempts: attempt };
    }

    let text;
    try {
      text = await response.text();
    } catch (error) {
      return { ok: false, message: `не удалось прочитать тело ответа: ${describeError(error)}`, status, attempts: attempt };
    }
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return { ok: false, message: `ответ API не является корректным JSON (HTTP ${status})`, status, attempts: attempt };
    }
    if (data === null || typeof data !== 'object' || Array.isArray(data)) {
      return { ok: false, message: 'неожиданная структура ответа API: ожидался объект { total, total_events, total_utc, stats[] }', status, attempts: attempt };
    }
    if (typeof data.total !== 'number' || !Number.isFinite(data.total)) {
      return { ok: false, message: 'в ответе API нет числового поля "total" (уникальные посетители)', status, attempts: attempt };
    }
    return { ok: true, data, status, attempts: attempt };
  }
  return { ok: false, message: `${last ? last.message : 'запрос не выполнен'} — исчерпаны попытки (${attempts})`, status: last ? last.status : null, attempts };
}

/* --------------------------------------------------------------- state.json */

/** Запись user_counter из ответа API (структура — spec 037). */
export function buildUserCounter(data, period, fetchedAt) {
  return {
    unique_users: data.total,
    pageviews: null,
    period: { start: toRfc3339(period.start), end: toRfc3339(period.end) },
    fetched_at: fetchedAt,
    source: 'goatcounter',
  };
}

/**
 * Идемпотентный read-modify-write: меняется только ключ `user_counter`,
 * файл пишется атомарно (temp рядом + rename). Остальные ключи не трогаются.
 * `{ ok: true, written: true, path }` либо `{ ok: false, message }` (файл не изменён).
 */
export function writeUserCounter({ statePath, record, eol = null }) {
  const file = path.resolve(statePath);
  let state = {};
  let originalText = null;
  if (fs.existsSync(file)) {
    try {
      originalText = fs.readFileSync(file, 'utf8');
    } catch (error) {
      return { ok: false, message: `не удалось прочитать ${file}: ${String(error && error.message)}` };
    }
    let parsed;
    try {
      parsed = JSON.parse(originalText);
    } catch (error) {
      return { ok: false, message: `${file} — битый JSON: ${String(error && error.message)} (файл не изменён)` };
    }
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ok: false, message: `${file} должен содержать JSON-объект (файл не изменён)` };
    }
    state = parsed;
  }
  state.user_counter = record;

  const newline = eol ?? (originalText !== null && originalText.includes('\r\n') ? '\r\n' : '\n');
  const text = `${JSON.stringify(state, null, 2)}${newline}`;
  const temp = path.join(path.dirname(file), `.${path.basename(file)}.tmp-${process.pid}-${Date.now()}`);
  try {
    fs.writeFileSync(temp, text, 'utf8');
    fs.renameSync(temp, file);
  } catch (error) {
    try {
      if (fs.existsSync(temp)) fs.unlinkSync(temp);
    } catch {
      /* уборка temp — best effort */
    }
    return { ok: false, message: `не удалось записать ${file}: ${String(error && error.message)} (файл не изменён)` };
  }
  return { ok: true, written: true, path: file };
}

/* -------------------------------------------------------------------- main */

/** Полный прогон без печати: `{ exitCode, report }`. */
export async function run(options, env = process.env, deps = {}) {
  const log = deps.log ?? (() => {});
  const tokenPath = path.resolve(options.tokenFile ?? DEFAULT_TOKEN_PATH);
  const authInfo = resolveToken({ tokenFile: tokenPath, env, siteOverride: options.site });
  if (!authInfo.ok) {
    return { exitCode: EXIT_ERROR, error: authInfo.message, report: { ok: false, error: 'token', tokenPath } };
  }

  const fallback = defaultPeriod(options.days);
  const period = options.start !== null || options.end !== null
    ? { start: options.start ?? fallback.start, end: options.end ?? fallback.end }
    : fallback;

  const apiBase = options.apiBase ?? `https://${authInfo.site}.goatcounter.com/api/v0`;
  const url = `${apiBase}/stats/total?start=${encodeURIComponent(toRfc3339(period.start))}&end=${encodeURIComponent(toRfc3339(period.end))}`;

  const response = await fetchTotal({
    url,
    auth: authInfo.auth,
    attempts: options.attempts,
    timeoutMs: options.timeoutMs,
    log,
    fetchFn: deps.fetchFn ?? fetch,
    sleepFn: deps.sleepFn ?? sleep,
  });
  if (!response.ok) {
    return {
      exitCode: EXIT_ERROR,
      error: response.message,
      report: { ok: false, error: 'api', status: response.status, attempts: response.attempts, url, site: authInfo.site },
    };
  }

  const record = buildUserCounter(response.data, period, new Date().toISOString());
  const report = {
    ok: true,
    site: authInfo.site,
    authSource: authInfo.source,
    api: url,
    attempts: response.attempts,
    total_events: typeof response.data.total_events === 'number' ? response.data.total_events : null,
    total_utc: typeof response.data.total_utc === 'number' ? response.data.total_utc : null,
    statePath: path.resolve(options.statePath ?? DEFAULT_STATE_PATH),
    dryRun: options.dryRun,
    written: false,
    user_counter: record,
  };

  if (options.dryRun) {
    return { exitCode: EXIT_OK, report, record };
  }

  const write = writeUserCounter({ statePath: options.statePath ?? DEFAULT_STATE_PATH, record });
  if (!write.ok) {
    return { exitCode: EXIT_ERROR, error: write.message, report: { ...report, ok: false, error: 'state-write', written: false } };
  }
  report.written = true;
  return { exitCode: EXIT_OK, report, record };
}

function renderHuman(result) {
  if (result.exitCode !== EXIT_OK) return `ошибка: ${result.error}`;
  const r = result.report;
  const c = r.user_counter;
  const lines = [
    `GoatCounter (site ${r.site}): уникальных посетителей ${c.unique_users} за ${c.period.start} … ${c.period.end}`,
  ];
  if (c.unique_users === 0) lines.push('  внимание: 0 посетителей — у нового сайта это нормально (плитка покажет «—»)');
  if (r.dryRun) lines.push(`  --dry-run: ${r.statePath} не изменён`);
  else lines.push(`  state.user_counter записан: ${r.statePath}`);
  return lines.join('\n');
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  if (!parsed.ok) {
    if (parsed.error === 'help') {
      process.stdout.write(`${USAGE}\n`);
      process.exitCode = EXIT_OK;
      return;
    }
    process.stderr.write(`${parsed.error}\n${USAGE}\n`);
    process.exitCode = EXIT_USAGE;
    return;
  }
  let result;
  try {
    result = await run(parsed.options, process.env, {
      log: (message) => process.stderr.write(`  ${message}\n`),
    });
  } catch (error) {
    process.stderr.write(`ошибка: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = EXIT_ERROR;
    return;
  }
  if (parsed.options.json) {
    process.stdout.write(`${JSON.stringify({ exitCode: result.exitCode, ...(result.report ?? {}) }, null, 2)}\n`);
  } else {
    const text = renderHuman(result);
    (result.exitCode === EXIT_OK ? process.stdout : process.stderr).write(`${text}\n`);
  }
  process.exitCode = result.exitCode;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  await main();
}
