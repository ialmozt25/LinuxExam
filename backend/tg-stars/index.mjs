/**
 * spec 064 — Telegram Stars (XTR) payment backend for LinuxExam.
 *
 * Runtime: Yandex Cloud Functions, Node.js 18+, ESM, ZERO dependencies
 * (only `node:crypto` and the global `fetch`). Handler contract is the YC one:
 *
 *   export const handler = async (event, context) => ({ statusCode, headers, body })
 *
 * Routing (spec 064, «ФАЗА 2»):
 *   OPTIONS *              → 204 + CORS (preflight; the client is a browser app)
 *   GET     /health        → 200 { ok: true }
 *   POST    /create-invoice→ 200 { invoiceLink }        (Bot API createInvoiceLink)
 *   POST    /webhook       → Telegram update            (header-guarded)
 *   *       other          → 404
 *
 * MVP BOUNDARY (deliberate): the function is STATELESS. It never writes a payment
 * to a database and never grants entitlement — the client sets `isPro` from the
 * `openInvoice` callback. Server-side verification of a payment is spec 066.
 * The webhook exists to answer `pre_checkout_query` (without it Telegram refuses
 * to show the invoice at all) and to log `successful_payment`.
 *
 * Configuration comes from the function environment only:
 *   TG_BOT_TOKEN    — @BotFather credential, required for invoice creation
 *   WEBHOOK_SECRET  — value passed to setWebhook as its secret_token argument
 *   ALLOWED_ORIGIN  — optional CORS origin (default '*')
 *   TG_API_BASE     — optional Bot API base (default 'https://api.telegram.org');
 *                     the substitution point for a Bot API proxy if the direct
 *                     call turns out to be blocked from the cloud.
 */

import { timingSafeEqual } from 'node:crypto';

const DEFAULT_API_BASE = 'https://api.telegram.org';

/**
 * The same three plans the client renders (`src/platform/config.ts`). Amounts are
 * in Stars; the pair "label + amount" is what the Bot API receives as `prices`.
 */
const PLANS = {
  monthly: { amount: 299, label: 'Месяц', title: 'LinuxExam Pro — Месяц' },
  yearly: { amount: 1499, label: 'Год', title: 'LinuxExam Pro — Год' },
  lifetime: { amount: 3999, label: 'Навсегда', title: 'LinuxExam Pro — Навсегда' },
};

const PLAN_DESCRIPTION = 'Все темы, разбор ответов, Exam mode и аналитика прогресса.';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,X-Telegram-Bot-Api-Secret-Token',
    'Access-Control-Max-Age': '86400',
  };
}

function json(statusCode, payload) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders() },
    body: JSON.stringify(payload),
  };
}

function empty(statusCode) {
  return { statusCode, headers: corsHeaders(), body: '' };
}

/** Lower-cased header lookup: API Gateway does not promise a header case. */
function readHeader(headers, name) {
  if (!headers) return undefined;
  const wanted = name.toLowerCase();
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === wanted) {
      const value = headers[key];
      return typeof value === 'string' ? value : undefined;
    }
  }
  return undefined;
}

/** Constant-time comparison — a plain `===` leaks the shared prefix length. */
function headersMatch(provided, expected) {
  if (typeof provided !== 'string' || typeof expected !== 'string') return false;
  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Request body as text; the platform may hand it over base64-encoded. */
function readBody(event) {
  const raw = event && typeof event.body === 'string' ? event.body : '';
  if (raw === '') return '';
  if (event && event.isBase64Encoded) return Buffer.from(raw, 'base64').toString('utf8');
  return raw;
}

function parseJson(text) {
  if (text === '') return {};
  try {
    const value = JSON.parse(text);
    return value !== null && typeof value === 'object' ? value : {};
  } catch {
    return null;
  }
}

function apiBase() {
  const base = process.env.TG_API_BASE || DEFAULT_API_BASE;
  return base.replace(/\/+$/, '');
}

/** Thin Bot API call: returns `{ ok, result | description }` and never throws. */
async function callBotApi(botToken, method, payload) {
  try {
    const response = await fetch(`${apiBase()}/bot${botToken}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => null);
    if (!data || typeof data !== 'object') {
      return { ok: false, description: `invalid Bot API response (HTTP ${response.status})` };
    }
    return data;
  } catch (error) {
    return { ok: false, description: error instanceof Error ? error.message : 'fetch failed' };
  }
}

async function handleCreateInvoice(event) {
  const body = parseJson(readBody(event));
  if (body === null) return json(400, { error: 'invalid_json' });

  const plan = typeof body.plan === 'string' ? body.plan : '';
  const planConfig = Object.prototype.hasOwnProperty.call(PLANS, plan) ? PLANS[plan] : null;
  if (!planConfig) return json(400, { error: 'unknown_plan', plan });

  const botToken = process.env.TG_BOT_TOKEN;
  if (!botToken) return json(500, { error: 'bot_token_not_configured' });

  const result = await callBotApi(botToken, 'createInvoiceLink', {
    title: planConfig.title,
    description: PLAN_DESCRIPTION,
    // The plan travels inside the invoice payload so the webhook can log it
    // without any storage of its own.
    payload: `spec064:${plan}:${Date.now()}`,
    currency: 'XTR',
    prices: [{ label: planConfig.label, amount: planConfig.amount }],
    // Stars invoices must not carry a provider token (XTR is the provider).
    provider_token: '',
  });

  if (!result || result.ok !== true || typeof result.result !== 'string') {
    return json(502, {
      error: 'telegram_api_error',
      description: result && typeof result.description === 'string' ? result.description : 'unknown',
    });
  }
  return json(200, { invoiceLink: result.result });
}

async function handleWebhook(event) {
  // 1. Authenticate the caller BEFORE reading the update: the URL is public.
  const providedHeader = readHeader(event && event.headers, 'X-Telegram-Bot-Api-Secret-Token');
  if (!headersMatch(providedHeader, process.env.WEBHOOK_SECRET)) {
    return json(403, { error: 'forbidden' });
  }

  const update = parseJson(readBody(event));
  if (update === null) return json(400, { error: 'invalid_json' });

  const botToken = process.env.TG_BOT_TOKEN;
  const query = update.pre_checkout_query;

  // 2. Telegram waits for answerPreCheckoutQuery (max 10 s) — without a positive
  //    answer the user cannot pay at all.
  if (query && typeof query === 'object') {
    if (!botToken) return json(500, { error: 'bot_token_not_configured' });
    const queryId = typeof query.id === 'string' ? query.id : '';
    if (queryId === '') return json(400, { error: 'missing_query_id' });
    const answered = await callBotApi(botToken, 'answerPreCheckoutQuery', {
      pre_checkout_query_id: queryId,
      ok: true,
    });
    console.log(
      JSON.stringify({
        event: 'pre_checkout_query',
        query_id: queryId,
        answered: answered && answered.ok === true,
        payload: typeof query.invoice_payload === 'string' ? query.invoice_payload : null,
      })
    );
    return json(200, { ok: answered && answered.ok === true });
  }

  // 3. successful_payment is logged only — entitlement is the client's job
  //    (spec 064 MVP), and server-side verification is spec 066.
  const payment = update.message && update.message.successful_payment;
  if (payment && typeof payment === 'object') {
    console.log(
      JSON.stringify({
        event: 'successful_payment',
        payload: typeof payment.invoice_payload === 'string' ? payment.invoice_payload : null,
        currency: typeof payment.currency === 'string' ? payment.currency : null,
        total_amount: typeof payment.total_amount === 'number' ? payment.total_amount : null,
        charge_id:
          typeof payment.telegram_payment_charge_id === 'string'
            ? payment.telegram_payment_charge_id
            : null,
        user_id:
          update.message && update.message.from && typeof update.message.from.id === 'number'
            ? update.message.from.id
            : null,
      })
    );
    return json(200, { ok: true });
  }

  // 4. Every other update is acknowledged and ignored: a non-200 makes Telegram
  //    retry the same update forever.
  return json(200, { ok: true });
}

export const handler = async (event, _context) => {
  const http = (event && event.requestContext && event.requestContext.http) || {};
  const method = String(http.method || (event && event.httpMethod) || 'GET').toUpperCase();
  const path = String(http.path || (event && event.path) || '/');

  if (method === 'OPTIONS') return empty(204);
  if (path === '/health' && method === 'GET') return json(200, { ok: true });
  if (path === '/create-invoice' && method === 'POST') return handleCreateInvoice(event);
  if (path === '/webhook' && method === 'POST') return handleWebhook(event);

  return json(404, { error: 'not_found', method, path });
};
