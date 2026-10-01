#!/usr/bin/env node
/**
 * .project/scripts/notify.mjs — Telegram-уведомления о ходе работ (spec 042, T1).
 *
 * Zero-deps, Node >= 18, ESM, только node:* (node:https, НЕ fetch).
 *
 * Использование:
 *   node .project/scripts/notify.mjs "<текст>" --event <type> [флаги]
 *   npm run notify -- "<текст>" --event <type>
 *   npm run notify:health
 *
 * Гарантии (см. .project/specs/042-telegram-notify.md и design-документ):
 *   - send-режим всегда завершается exit 0 (сбой Telegram не ломает прогон);
 *   - токен НЕ печатается ни в stdout, ни в stderr, ни в лог, ни в state;
 *   - секреты в тексте сообщения вырезаются (redaction → [REDACTED] + WARN);
 *   - --health: 0 (ok) / 1 (invalid_token) / 2 (no_network).
 *
 * Порядок проверок в send-режиме (фиксирован):
 *   circuit_open → skipped (NullNotifier/config) → deduped → rate_limited → send.
 *
 * Runtime-артефакты (не коммитятся):
 *   .project/scripts/notify-state.json (+ .lock) — persistent state;
 *   .project/logs/notify-log.jsonl               — append-only лог (создаётся сам).
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import https from 'node:https';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------- константы --

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = path.resolve(SCRIPT_DIR, '..');

const DEFAULT_STATE_FILE = path.join(SCRIPT_DIR, 'notify-state.json');
const DEFAULT_LOG_FILE = path.join(PROJECT_DIR, 'logs', 'notify-log.jsonl');
const DEFAULT_CONFIG_FILE = path.join(PROJECT_DIR, 'notify-config.json');
const DEFAULT_TOKEN_FILE = path.join(os.homedir(), '.dsh', 'telegram-bot.json');

const API_HOST = 'api.telegram.org';
const HTTP_TIMEOUT_MS = 10_000;
const MAX_ATTEMPTS = 3;
const MAX_MESSAGE_BYTES = 4096;
const BUCKET_BURST = 10;
const BUCKET_INITIAL_TOKENS = 1;
const LOCK_STALE_MS = 30_000;
const LOCK_WAIT_MS = 5_000;
const LOCK_POLL_MS = 100;
const LOCK_STALE_RETRIES = 5;
const BACKOFF_BASE_MS = 250;
const REDACTED = '[REDACTED]';

const MODE_SEND = 'send';
const MODE_DRY = 'dry';
const MODE_HEALTH = 'health';

/**
 * Дефолты конфига. Канонические значения, которые t3 записывает в
 * .project/notify-config.json; t1 читает те же имена с теми же default'ами.
 * Для ОТСУТСТВУЮЩЕГО/битого конфига events = [] (разрешены все) — см. §1.3 шаг 0.
 */
const CONFIG_DEFAULTS = Object.freeze({
  enabled: true,
  events: Object.freeze([]),
  rate_limit_sec: 1,
  dedup_window_sec: 300,
  circuit_breaker_threshold: 5,
  circuit_breaker_cooldown_sec: 60,
});

const SECRET_PATTERNS = Object.freeze([
  { name: 'telegram_token', source: '[0-9]{8,10}:[A-Za-z0-9_-]{35}' },
  { name: 'openai_key', source: 'sk-[A-Za-z0-9]{20,}' },
  { name: 'github_token', source: 'ghp_[A-Za-z0-9]{36}' },
  { name: 'aws_access_key', source: 'AKIA[0-9A-Z]{16}' },
]);

const USAGE = `notify.mjs — Telegram-уведомления о ходе работ (spec 042)

Использование:
  node .project/scripts/notify.mjs "<текст>" --event <type> [флаги]
  npm run notify -- "<текст>" --event <type>
  npm run notify:health

Флаги:
  --event <type>               тип события (обязателен в send/dry-run)
  --dry-run                    показать, что было бы отправлено (без state/log)
  --health                     проверить токен/сеть (getMe)
  --token-file <path>          переопределить ~/.dsh/telegram-bot.json
  --state-file <path>          переопределить .project/scripts/notify-state.json
  --dedup-window-override <s>  окно дедупликации, сек (>= 0)
  --rate-override <s>          секунд на 1 токен bucket (> 0)
  --cooldown-override <s>      длительность cooldown circuit breaker, сек (>= 0)
  --simulate-network-error     принудительный сетевой сбой
  -h, --help                   эта справка

Exit-коды: send/dry-run — 0 всегда; --health — 0 ok / 1 invalid_token / 2 no_network.
`;

// -------------------------------------------------------------- глобальное --

let ACTIVE_MODE = MODE_SEND;
let ACTIVE_LOCK = null;

// ------------------------------------------------------------------ утилиты --

function warn(msg) {
  try {
    process.stderr.write(`WARN notify: ${msg}\n`);
  } catch {
    /* stderr недоступен — игнорируем */
  }
}

function rel(p) {
  try {
    return path.relative(process.cwd(), p) || p;
  } catch {
    return p;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}

function sleepSync(ms) {
  try {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, Math.max(1, ms));
  } catch {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      /* busy-wait как fallback */
    }
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function localDate(ms) {
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function sha256hex16(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex').slice(0, 16);
}

function escapeHtml(text) {
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function truncateBytes(text, maxBytes) {
  const raw = String(text);
  if (Buffer.byteLength(raw, 'utf8') <= maxBytes) return raw;
  let out = '';
  let used = 0;
  for (const ch of raw) {
    const size = Buffer.byteLength(ch, 'utf8');
    if (used + size > maxBytes) break;
    out += ch;
    used += size;
  }
  return out;
}

/** Тихая redaction: возвращает текст и список сработавших паттернов (без вывода). */
function applyRedactions(text) {
  let out = String(text);
  const hits = [];
  for (const pattern of SECRET_PATTERNS) {
    if (new RegExp(pattern.source).test(out)) {
      hits.push(pattern.name);
      out = out.replace(new RegExp(pattern.source, 'g'), REDACTED);
    }
  }
  return { text: out, hits };
}

/** Redaction с WARN в stderr. WARN НЕ содержит сам секрет. */
function redactSecrets(text) {
  const { text: out, hits } = applyRedactions(text);
  if (hits.length > 0) {
    warn(`секреты в тексте вырезаны (${hits.join(', ')}) → ${REDACTED}`);
  }
  return out;
}

/** Безопасное текстовое представление ошибки: без URL/токена (тихая redaction). */
function safeErrorText(err) {
  const code = err && err.code ? String(err.code) : '';
  const raw = err && err.message ? String(err.message) : 'unknown_error';
  const cleaned = applyRedactions(raw).text.replace(/[\r\n]+/g, ' ');
  return (code ? `${code}: ${cleaned}` : cleaned).slice(0, 200);
}

// ------------------------------------------------------- разбор аргументов --

const VALUE_FLAGS = new Set([
  '--event',
  '--token-file',
  '--state-file',
  '--dedup-window-override',
  '--rate-override',
  '--cooldown-override',
]);

function parseNumberFlag(raw, name, { min, strict }) {
  const text = String(raw).trim();
  if (text === '') return { error: `${name}: ожидается число` };
  const value = Number(text);
  if (!Number.isFinite(value)) return { error: `${name}: "${raw}" не число` };
  const ok = strict ? value > min : value >= min;
  if (!ok) return { error: `${name}: значение должно быть ${strict ? '>' : '>='} ${min}` };
  return { value };
}

function parseArgs(argv) {
  const args = {
    message: null,
    event: null,
    dryRun: false,
    health: false,
    simulateNetworkError: false,
    help: false,
    tokenFile: null,
    stateFile: null,
    dedupWindowOverride: null,
    rateOverride: null,
    cooldownOverride: null,
  };
  const positionals = [];

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--dry-run' || token === '--health' || token === '--simulate-network-error' || token === '-h' || token === '--help') {
      if (token === '--dry-run') args.dryRun = true;
      else if (token === '--health') args.health = true;
      else if (token === '--simulate-network-error') args.simulateNetworkError = true;
      else args.help = true;
      continue;
    }
    if (VALUE_FLAGS.has(token)) {
      const value = argv[i + 1];
      if (value === undefined) return { error: `флаг ${token} требует значение` };
      i += 1;
      if (token === '--event') {
        args.event = String(value);
      } else if (token === '--token-file') {
        args.tokenFile = path.resolve(process.cwd(), String(value));
      } else if (token === '--state-file') {
        args.stateFile = path.resolve(process.cwd(), String(value));
      } else if (token === '--dedup-window-override') {
        const parsed = parseNumberFlag(value, '--dedup-window-override', { min: 0, strict: false });
        if (parsed.error) return { error: parsed.error };
        args.dedupWindowOverride = parsed.value;
      } else if (token === '--rate-override') {
        const parsed = parseNumberFlag(value, '--rate-override', { min: 0, strict: true });
        if (parsed.error) return { error: parsed.error };
        args.rateOverride = parsed.value;
      } else if (token === '--cooldown-override') {
        const parsed = parseNumberFlag(value, '--cooldown-override', { min: 0, strict: false });
        if (parsed.error) return { error: parsed.error };
        args.cooldownOverride = parsed.value;
      }
      continue;
    }
    if (token.startsWith('-') && token.length > 1) return { error: `неизвестный флаг ${token}` };
    positionals.push(token);
  }

  if (positionals.length > 1) return { error: 'лишний позиционный аргумент (текст сообщения — один аргумент)' };
  args.message = positionals.length === 1 ? positionals[0] : null;

  if (!args.help && !args.health && !args.event) {
    return { error: 'флаг --event обязателен (send и --dry-run режимы)' };
  }
  if (!args.help && !args.health && !args.dryRun && args.message === null) {
    return { error: 'текст сообщения обязателен (send-режим)' };
  }
  return { args };
}

// ------------------------------------------------------------------ конфиг --

function normalizeConfig(raw) {
  const config = {
    enabled: CONFIG_DEFAULTS.enabled,
    events: [],
    rate_limit_sec: CONFIG_DEFAULTS.rate_limit_sec,
    dedup_window_sec: CONFIG_DEFAULTS.dedup_window_sec,
    circuit_breaker_threshold: CONFIG_DEFAULTS.circuit_breaker_threshold,
    circuit_breaker_cooldown_sec: CONFIG_DEFAULTS.circuit_breaker_cooldown_sec,
  };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return config;
  if (typeof raw.enabled === 'boolean') config.enabled = raw.enabled;
  if (Array.isArray(raw.events)) config.events = raw.events.filter((e) => typeof e === 'string');
  if (Number.isFinite(raw.rate_limit_sec) && raw.rate_limit_sec > 0) config.rate_limit_sec = Number(raw.rate_limit_sec);
  if (Number.isFinite(raw.dedup_window_sec) && raw.dedup_window_sec >= 0) config.dedup_window_sec = Number(raw.dedup_window_sec);
  if (Number.isFinite(raw.circuit_breaker_threshold) && raw.circuit_breaker_threshold >= 1) {
    config.circuit_breaker_threshold = Math.floor(raw.circuit_breaker_threshold);
  }
  if (Number.isFinite(raw.circuit_breaker_cooldown_sec) && raw.circuit_breaker_cooldown_sec >= 0) {
    config.circuit_breaker_cooldown_sec = Number(raw.circuit_breaker_cooldown_sec);
  }
  return config;
}

function loadConfig(configPath) {
  try {
    const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    return normalizeConfig(parsed);
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      warn(`конфиг ${rel(configPath)} не найден — дефолты (events: все)`);
    } else {
      warn(`конфиг ${rel(configPath)} повреждён (${(err && err.code) || 'invalid JSON'}) — дефолты`);
    }
    return normalizeConfig(null);
  }
}

// ------------------------------------------------------------------- токен --

/** Читает ~/.dsh/telegram-bot.json. Содержимое файла НИКОГДА не логируется. */
function loadCredentials(tokenPath) {
  try {
    const parsed = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
    const token = parsed && typeof parsed.token === 'string' ? parsed.token.trim() : '';
    const chatId =
      parsed && parsed.chat_id !== undefined && parsed.chat_id !== null ? String(parsed.chat_id).trim() : '';
    return { token, chatId, hasToken: token !== '', ok: token !== '' && chatId !== '', reason: '' };
  } catch (err) {
    const reason = (err && err.code) || 'invalid_token_file';
    return { token: '', chatId: '', hasToken: false, ok: false, reason };
  }
}

// -------------------------------------------------------------------- lock --

function acquireStateLock(lockPath) {
  try {
    fs.mkdirSync(path.dirname(lockPath), { recursive: true });
  } catch {
    /* каталог создать не удалось — попытки ниже сами разберутся */
  }
  const deadline = Date.now() + LOCK_WAIT_MS;
  let staleDeletes = 0;

  for (;;) {
    try {
      const fd = fs.openSync(lockPath, 'wx');
      try {
        fs.writeSync(fd, JSON.stringify({ pid: process.pid, ts: Date.now() }));
      } finally {
        fs.closeSync(fd);
      }
      ACTIVE_LOCK = lockPath;
      return true;
    } catch (err) {
      if (!err || err.code !== 'EEXIST') {
        warn(`lock ${rel(lockPath)} не создан (${(err && err.code) || 'error'}) — продолжаю без lock`);
        return false;
      }
    }

    let stale = false;
    try {
      const info = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
      const ts = Number(info && info.ts);
      stale = !Number.isFinite(ts) || Date.now() - ts > LOCK_STALE_MS;
    } catch {
      stale = true; // нечитаемый lock считаем протухшим
    }

    if (stale) {
      if (staleDeletes >= LOCK_STALE_RETRIES) {
        warn(`lock ${rel(lockPath)} не удаляется — продолжаю без lock`);
        return false;
      }
      staleDeletes += 1;
      try {
        fs.unlinkSync(lockPath);
      } catch {
        /* гонка: кто-то удалил раньше — не страшно */
      }
      continue;
    }

    if (Date.now() >= deadline) {
      warn(`lock ${rel(lockPath)} занят > ${LOCK_WAIT_MS} мс — продолжаю без lock`);
      return false;
    }
    sleepSync(LOCK_POLL_MS);
  }
}

function releaseStateLock() {
  const lockPath = ACTIVE_LOCK;
  ACTIVE_LOCK = null;
  if (!lockPath) return;
  let owned = false;
  try {
    const info = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
    owned = Number(info && info.pid) === process.pid;
  } catch {
    return; // нечитаемый lock не трогаем: протухнет сам
  }
  if (!owned) return;
  try {
    fs.unlinkSync(lockPath);
  } catch {
    /* уже удалён */
  }
}

process.on('exit', () => {
  try {
    releaseStateLock();
  } catch {
    /* на выходе ничего не бросаем */
  }
});

// ------------------------------------------------------------------- state --

function defaultState(now) {
  return {
    version: 1,
    updated_at_ms: now,
    buckets: {},
    circuit: { consecutive_errors: 0, opened_at_ms: 0, cooldown_until_ms: 0 },
    dedup: {},
    sent_today: { date: localDate(now), count: 0 },
  };
}

/** Нормализация: любое расхождение → дефолт соответствующего поля. Никогда не бросает. */
function normalizeState(raw, now) {
  const state = defaultState(now);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return state;

  if (raw.buckets && typeof raw.buckets === 'object' && !Array.isArray(raw.buckets)) {
    for (const [chat, bucket] of Object.entries(raw.buckets)) {
      if (!bucket || typeof bucket !== 'object') continue;
      if (!Number.isFinite(bucket.tokens) || !Number.isFinite(bucket.last_refill_ms)) continue;
      state.buckets[String(chat)] = {
        tokens: clamp(Number(bucket.tokens), 0, BUCKET_BURST),
        last_refill_ms: Math.max(0, Math.floor(Number(bucket.last_refill_ms))),
      };
    }
  }

  const circuit = raw.circuit;
  if (circuit && typeof circuit === 'object' && !Array.isArray(circuit)) {
    const int = (v, fallback) => (Number.isFinite(v) && v >= 0 ? Math.floor(Number(v)) : fallback);
    state.circuit.consecutive_errors = int(circuit.consecutive_errors, 0);
    state.circuit.opened_at_ms = int(circuit.opened_at_ms, 0);
    state.circuit.cooldown_until_ms = int(circuit.cooldown_until_ms, 0);
  }

  if (raw.dedup && typeof raw.dedup === 'object' && !Array.isArray(raw.dedup)) {
    for (const [key, expiry] of Object.entries(raw.dedup)) {
      if (!Number.isFinite(expiry) || Number(expiry) <= now) continue; // prune истёкших
      state.dedup[String(key)] = Math.floor(Number(expiry));
    }
  }

  const sent = raw.sent_today;
  if (
    sent &&
    typeof sent === 'object' &&
    typeof sent.date === 'string' &&
    sent.date === localDate(now) &&
    Number.isFinite(sent.count) &&
    sent.count >= 0
  ) {
    state.sent_today = { date: sent.date, count: Math.floor(Number(sent.count)) };
  }
  return state;
}

function loadState(statePath) {
  try {
    const parsed = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    return normalizeState(parsed, Date.now());
  } catch (err) {
    if (!err || err.code !== 'ENOENT') {
      warn(`state ${rel(statePath)} повреждён (${(err && err.code) || 'invalid JSON'}) — дефолты`);
    }
    return defaultState(Date.now());
  }
}

/** Атомарная запись: tmp + rename. Ошибки — только WARN, никогда не падает. */
function saveState(statePath, state) {
  try {
    state.version = 1;
    state.updated_at_ms = Date.now();
    fs.mkdirSync(path.dirname(statePath), { recursive: true });
    const tmpPath = `${statePath}.tmp.${process.pid}`;
    fs.writeFileSync(tmpPath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
    fs.renameSync(tmpPath, statePath);
    return true;
  } catch (err) {
    warn(`state ${rel(statePath)} не записан (${(err && err.code) || 'error'})`);
    return false;
  }
}

function getBucket(state, chatId, now, rateSec) {
  const key = String(chatId);
  let bucket = state.buckets[key];
  if (!bucket || !Number.isFinite(bucket.tokens) || !Number.isFinite(bucket.last_refill_ms)) {
    // Новый чат: старт = 1 токен (критерий 4), а не burst.
    bucket = { tokens: BUCKET_INITIAL_TOKENS, last_refill_ms: now };
    state.buckets[key] = bucket;
    return bucket;
  }
  const elapsedSec = Math.max(0, now - bucket.last_refill_ms) / 1000;
  bucket.tokens = clamp(bucket.tokens + elapsedSec / rateSec, 0, BUCKET_BURST);
  bucket.last_refill_ms = now;
  return bucket;
}

function pruneDedup(state, now) {
  for (const key of Object.keys(state.dedup)) {
    if (!Number.isFinite(state.dedup[key]) || state.dedup[key] <= now) delete state.dedup[key];
  }
}

function bumpSentToday(state, now) {
  const today = localDate(now);
  if (!state.sent_today || state.sent_today.date !== today) {
    state.sent_today = { date: today, count: 0 };
  }
  state.sent_today.count += 1;
}

// --------------------------------------------------------------------- лог --

function appendLog(entry) {
  try {
    fs.mkdirSync(path.dirname(DEFAULT_LOG_FILE), { recursive: true });
    fs.appendFileSync(DEFAULT_LOG_FILE, `${JSON.stringify(entry)}\n`, 'utf8');
  } catch (err) {
    warn(`лог ${rel(DEFAULT_LOG_FILE)} не записан (${(err && err.code) || 'error'})`);
  }
}

function logEntry({ event, status, message, messageHash, chatId, durationMs, attempts, detail }) {
  const entry = { ts: new Date().toISOString(), event: String(event), status: String(status) };
  if (message) entry.message = message;
  if (messageHash) entry.message_hash = messageHash;
  if (chatId) entry.chat_id = String(chatId);
  entry.duration_ms = Number.isFinite(durationMs) ? Math.max(0, Math.floor(durationMs)) : 0;
  entry.attempts = Number.isFinite(attempts) ? Math.max(0, Math.floor(attempts)) : 0;
  if (detail) entry.detail = applyRedactions(String(detail)).text;
  appendLog(entry);
}

// ------------------------------------------------------------------- HTTPS --

function preflight() {
  return typeof https.request === 'function';
}

/**
 * Один HTTPS-запрос к api.telegram.org. transport-ошибки → reject(err) с err.code;
 * прикладной ответ (в т.ч. не-JSON) → resolve({statusCode, headers, json}).
 * URL/токен в ошибки не попадают.
 */
function httpsCall({ method, requestPath, body, timeoutMs }) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? null : Buffer.from(JSON.stringify(body), 'utf8');
    let settled = false;
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      fn(value);
    };

    const req = https.request(
      {
        hostname: API_HOST,
        port: 443,
        path: requestPath,
        method,
        agent: false,
        headers: payload
          ? { 'content-type': 'application/json', 'content-length': String(payload.length) }
          : {},
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          let json = null;
          try {
            json = JSON.parse(raw);
          } catch {
            json = null;
          }
          finish(resolve, { statusCode: res.statusCode || 0, headers: res.headers || {}, json, raw });
        });
        res.on('error', (err) => finish(reject, err));
      },
    );

    req.on('error', (err) => finish(reject, err));
    req.setTimeout(timeoutMs, () => {
      const err = new Error('timeout');
      err.code = 'ETIMEDOUT';
      req.destroy(err);
    });

    if (payload) req.write(payload);
    req.end();
  });
}

function backoffMs(attempt) {
  return BACKOFF_BASE_MS * attempt + Math.floor(Math.random() * 100);
}

// ------------------------------------------------------------- отправка TG --

/**
 * sendMessage с retry по спеке: 429 → retry_after + retry; 5xx и сетевой сбой →
 * backoff + jitter (до 3 попыток); 401/403 → без retry; прочие 4xx → без retry.
 * Возвращает { status, attempts, durationMs, detail, retryAfter? }.
 */
async function sendTelegram({ token, chatId, text, simulateNetworkError }) {
  const startedAt = Date.now();
  let attempts = 0;
  let lastStatus = 'error';
  let lastDetail = 'unknown';

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    attempts = attempt;

    if (simulateNetworkError) {
      lastStatus = 'no_network';
      lastDetail = 'simulated_network_error';
      if (attempt < MAX_ATTEMPTS) {
        await sleep(backoffMs(attempt));
        continue;
      }
      break;
    }

    let response;
    try {
      response = await httpsCall({
        method: 'POST',
        requestPath: `/bot${token}/sendMessage`,
        body: { chat_id: chatId, text, parse_mode: 'HTML' },
        timeoutMs: HTTP_TIMEOUT_MS,
      });
    } catch (err) {
      lastStatus = 'no_network';
      lastDetail = safeErrorText(err);
      if (attempt < MAX_ATTEMPTS) {
        await sleep(backoffMs(attempt));
        continue;
      }
      break;
    }

    const json = response.json;
    const bodyErrorCode = json && json.ok === false && Number.isFinite(json.error_code) ? Number(json.error_code) : 0;
    const code = response.statusCode === 200 && json && json.ok === false ? bodyErrorCode || 400 : response.statusCode;

    if (code === 200 && json && json.ok === true) {
      return { status: 'sent', attempts, durationMs: Date.now() - startedAt, detail: 'ok' };
    }

    if (code === 401 || code === 403) {
      return { status: 'error', attempts, durationMs: Date.now() - startedAt, detail: 'invalid_token' };
    }

    if (code === 429) {
      const headerRetry = Number(response.headers['retry-after']);
      const bodyRetry = json && json.parameters ? Number(json.parameters.retry_after) : NaN;
      const retryAfter = Number.isFinite(bodyRetry) && bodyRetry > 0 ? bodyRetry : Number.isFinite(headerRetry) && headerRetry > 0 ? headerRetry : 1;
      lastStatus = 'error';
      lastDetail = `http_429 retry_after=${retryAfter}`;
      if (attempt < MAX_ATTEMPTS) {
        await sleep(Math.min(retryAfter, 5) * 1000);
        continue;
      }
      break;
    }

    if (code >= 500) {
      lastStatus = 'error';
      lastDetail = `http_${code}`;
      if (attempt < MAX_ATTEMPTS) {
        await sleep(backoffMs(attempt));
        continue;
      }
      break;
    }

    // Прочие 4xx / неожиданный ответ — без retry.
    lastStatus = 'error';
    lastDetail = code === 200 ? 'http_200_unparsable' : `http_${code}`;
    break;
  }

  return { status: lastStatus, attempts, durationMs: Date.now() - startedAt, detail: lastDetail };
}

// ------------------------------------------------------------------ режимы --

function runDryRun(args) {
  // Ничего не читает и не пишет (ни state, ни log), ничего не шлёт.
  const safeText = redactSecrets(truncateBytes(escapeHtml(args.message ?? ''), MAX_MESSAGE_BYTES));
  process.stdout.write(`DRY-RUN event=${args.event} message=${safeText}\n`);
  return 0;
}

async function runHealth(args) {
  const tokenPath = args.tokenFile || DEFAULT_TOKEN_FILE;
  const startedAt = Date.now();

  if (!preflight()) {
    warn('preflight не пройден: node:https недоступен');
    logEntry({ event: 'health', status: 'no_network', durationMs: 0, attempts: 0, detail: 'preflight_failed' });
    process.stdout.write(`${JSON.stringify({ healthy: false, error: 'no_network' })}\n`);
    return 2;
  }

  if (args.simulateNetworkError) {
    logEntry({ event: 'health', status: 'no_network', durationMs: 0, attempts: 0, detail: 'simulated_network_error' });
    process.stdout.write(`${JSON.stringify({ healthy: false, error: 'no_network' })}\n`);
    return 2;
  }

  const creds = loadCredentials(tokenPath);
  if (!creds.hasToken) {
    warn(`токен не прочитан (${creds.reason}) — health: invalid_token`);
    logEntry({ event: 'health', status: 'invalid_token', durationMs: Date.now() - startedAt, attempts: 0, detail: 'no_token' });
    process.stdout.write(`${JSON.stringify({ healthy: false, error: 'invalid_token' })}\n`);
    return 1;
  }

  try {
    const response = await httpsCall({
      method: 'GET',
      requestPath: `/bot${creds.token}/getMe`,
      timeoutMs: HTTP_TIMEOUT_MS,
    });
    const latencyMs = Date.now() - startedAt;
    const json = response.json;
    if (response.statusCode === 200 && json && json.ok === true) {
      const username = json.result && typeof json.result.username === 'string' ? json.result.username : '';
      logEntry({ event: 'health', status: 'sent', durationMs: latencyMs, attempts: 0, detail: 'health_ok', chatId: creds.chatId });
      process.stdout.write(`${JSON.stringify({ healthy: true, latency_ms: latencyMs, bot_username: username })}\n`);
      return 0;
    }
    warn(`health: токен отклонён (http ${response.statusCode})`);
    logEntry({
      event: 'health',
      status: 'invalid_token',
      durationMs: latencyMs,
      attempts: 0,
      detail: `http_${response.statusCode}`,
    });
    process.stdout.write(`${JSON.stringify({ healthy: false, error: 'invalid_token' })}\n`);
    return 1;
  } catch (err) {
    const detail = safeErrorText(err);
    warn(`health: сеть недоступна (${detail})`);
    logEntry({ event: 'health', status: 'no_network', durationMs: Date.now() - startedAt, attempts: 0, detail });
    process.stdout.write(`${JSON.stringify({ healthy: false, error: 'no_network' })}\n`);
    return 2;
  }
}

async function runSend(args) {
  const event = args.event;
  const rawMessage = args.message ?? '';
  // Ключ dedup считается по ИСХОДНОМУ тексту (design §1.7), а поле лога
  // message_hash — по тексту, который реально пишется в лог (§3.1).
  const dedupHash = sha256hex16(rawMessage);
  const statePath = args.stateFile || DEFAULT_STATE_FILE;
  const lockPath = `${statePath}.lock`;
  const config = loadConfig(DEFAULT_CONFIG_FILE);
  const creds = loadCredentials(args.tokenFile || DEFAULT_TOKEN_FILE);
  const timestamp = Date.now();

  const rateSec = args.rateOverride !== null && args.rateOverride !== undefined ? args.rateOverride : config.rate_limit_sec;
  const dedupWindowSec =
    args.dedupWindowOverride !== null && args.dedupWindowOverride !== undefined
      ? args.dedupWindowOverride
      : config.dedup_window_sec;
  const cooldownSec =
    args.cooldownOverride !== null && args.cooldownOverride !== undefined
      ? args.cooldownOverride
      : config.circuit_breaker_cooldown_sec;
  const threshold = config.circuit_breaker_threshold;
  const safeText = redactSecrets(truncateBytes(escapeHtml(rawMessage), MAX_MESSAGE_BYTES));
  const messageHash = sha256hex16(safeText);

  acquireStateLock(lockPath);
  try {
    const state = loadState(statePath);
    pruneDedup(state, timestamp);

    // Шаг 1: circuit_open.
    if (state.circuit.cooldown_until_ms > timestamp) {
      logEntry({
        event,
        status: 'circuit_open',
        message: safeText,
        messageHash,
        chatId: creds.chatId,
        durationMs: 0,
        attempts: 0,
        detail: `circuit open until ${new Date(state.circuit.cooldown_until_ms).toISOString()}`,
      });
      process.stdout.write(`notify ${event} → circuit_open\n`);
      return 0;
    }

    // Шаг 2: NullNotifier / конфиг выключил событие.
    let skipReason = '';
    if (!creds.hasToken) skipReason = `no_token (${creds.reason})`;
    else if (!creds.chatId) skipReason = 'no_chat_id';
    else if (config.enabled === false) skipReason = 'disabled';
    else if (config.events.length > 0 && !config.events.includes(event)) skipReason = `event_not_allowed (${event})`;
    if (skipReason) {
      logEntry({
        event,
        status: 'skipped',
        message: safeText,
        messageHash,
        chatId: creds.chatId,
        durationMs: 0,
        attempts: 0,
        detail: skipReason,
      });
      process.stdout.write(`notify ${event} → skipped\n`);
      return 0;
    }

    // Шаг 3: dedup по (event, hash(исходного message)).
    const dedupKey = `${event}|${dedupHash}`;
    if (Number.isFinite(state.dedup[dedupKey]) && state.dedup[dedupKey] > timestamp) {
      logEntry({
        event,
        status: 'deduped',
        message: safeText,
        messageHash,
        chatId: creds.chatId,
        durationMs: 0,
        attempts: 0,
        detail: `dup ${dedupKey}`,
      });
      process.stdout.write(`notify ${event} → deduped\n`);
      return 0;
    }

    // Шаг 4: token bucket (1 msg/rate_limit_sec, burst 10, старт 1 токен).
    const bucket = getBucket(state, creds.chatId, timestamp, rateSec);
    if (bucket.tokens < 1) {
      logEntry({
        event,
        status: 'rate_limited',
        message: safeText,
        messageHash,
        chatId: creds.chatId,
        durationMs: 0,
        attempts: 0,
        detail: 'rate_limited',
      });
      process.stdout.write(`notify ${event} → rate_limited\n`);
      return 0;
    }

    // Шаг 5: отправка. Токен списывается при фактической попытке.
    if (!preflight()) {
      warn('preflight не пройден: node:https недоступен');
      state.circuit.consecutive_errors += 1;
      if (state.circuit.consecutive_errors >= threshold) {
        state.circuit.opened_at_ms = Date.now();
        state.circuit.cooldown_until_ms = Date.now() + cooldownSec * 1000;
        state.circuit.consecutive_errors = 0;
      }
      saveState(statePath, state);
      logEntry({
        event,
        status: 'error',
        message: safeText,
        messageHash,
        chatId: creds.chatId,
        durationMs: 0,
        attempts: 0,
        detail: 'preflight_failed',
      });
      process.stdout.write(`notify ${event} → error\n`);
      return 0;
    }

    bucket.tokens = Math.max(0, bucket.tokens - 1);
    bucket.last_refill_ms = timestamp;

    const outcome = await sendTelegram({
      token: creds.token,
      chatId: creds.chatId,
      text: safeText,
      simulateNetworkError: args.simulateNetworkError,
    });

    const finishedAt = Date.now();
    if (outcome.status === 'sent') {
      state.circuit.consecutive_errors = 0;
      state.circuit.opened_at_ms = 0;
      state.circuit.cooldown_until_ms = 0;
      state.dedup[dedupKey] = finishedAt + dedupWindowSec * 1000;
      bumpSentToday(state, finishedAt);
    } else {
      state.circuit.consecutive_errors += 1;
      if (state.circuit.consecutive_errors >= threshold) {
        state.circuit.opened_at_ms = finishedAt;
        state.circuit.cooldown_until_ms = finishedAt + cooldownSec * 1000;
        state.circuit.consecutive_errors = 0;
      }
    }
    pruneDedup(state, finishedAt);
    saveState(statePath, state);

    logEntry({
      event,
      status: outcome.status,
      message: safeText,
      messageHash,
      chatId: creds.chatId,
      durationMs: outcome.durationMs,
      attempts: outcome.attempts,
      detail: outcome.detail,
    });
    process.stdout.write(`notify ${event} → ${outcome.status}\n`);
    return 0;
  } finally {
    releaseStateLock();
  }
}

// -------------------------------------------------------------------- main --

async function run() {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed.error) {
    process.stderr.write(`notify: ${parsed.error}\n\n${USAGE}`);
    return 2;
  }
  const args = parsed.args;

  if (args.help) {
    process.stdout.write(USAGE);
    return 0;
  }
  if (args.health) {
    ACTIVE_MODE = MODE_HEALTH;
    return await runHealth(args);
  }
  if (args.dryRun) {
    ACTIVE_MODE = MODE_DRY;
    return runDryRun(args);
  }
  ACTIVE_MODE = MODE_SEND;
  return await runSend(args);
}

try {
  process.exitCode = await run();
} catch (err) {
  // send/dry-run не ломают прогон ни при каких обстоятельствах.
  warn(`внутренняя ошибка: ${safeErrorText(err)}`);
  process.exitCode = ACTIVE_MODE === MODE_HEALTH ? 2 : 0;
}
