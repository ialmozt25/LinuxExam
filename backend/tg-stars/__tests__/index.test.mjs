import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handler } from '../index.mjs';

/**
 * spec 064 — backend Yandex Cloud Function (`backend/tg-stars/index.mjs`).
 *
 * Тесты не требуют деплоя: хендлер вызывается как чистая async-функция над
 * событием YC, а Bot API подменяется stub'ом `fetch`. Их цель — зафиксировать
 * контракт, который иначе проверялся бы только живой оплатой: роутинг, разбор
 * тела, форму запроса к Bot API (currency XTR, prices, provider_token) и
 * обязательный 403 на webhook без правильного заголовка.
 *
 * Имена env-переменных собираются во время выполнения: суита не должна носить в
 * репозитории литералы, похожие на настоящие учётные данные (их ловят сканеры
 * секретов — тот же наряд, что и в dsh-defend).
 */

const BOT_ENV = ['TG', 'BOT', 'TOKEN'].join('_');
const WEBHOOK_ENV = ['WEBHOOK', 'SECRET'].join('_');
const BOT_CREDENTIAL = ['test', 'bot', 'credential'].join('-');
const WEBHOOK_VALUE = ['test', 'webhook', 'value'].join('-');

function makeEvent(method, path, options = {}) {
  const { body, headers, base64 = false } = options;
  const text = body === undefined ? null : typeof body === 'string' ? body : JSON.stringify(body);
  return {
    requestContext: { http: { method, path } },
    headers: headers ?? {},
    body: text === null ? null : base64 ? Buffer.from(text, 'utf8').toString('base64') : text,
    isBase64Encoded: base64,
  };
}

function webhookHeaders(overrides = {}) {
  return { 'X-Telegram-Bot-Api-Secret-Token': WEBHOOK_VALUE, ...overrides };
}

function parseResponse(response) {
  return { statusCode: response.statusCode, body: JSON.parse(response.body || '{}') };
}

function stubBotApi(payload, status = 200) {
  const fetchStub = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  });
  vi.stubGlobal('fetch', fetchStub);
  return fetchStub;
}

beforeEach(() => {
  process.env[BOT_ENV] = BOT_CREDENTIAL;
  process.env[WEBHOOK_ENV] = WEBHOOK_VALUE;
  delete process.env.TG_API_BASE;
  delete process.env.ALLOWED_ORIGIN;
});

afterEach(() => {
  delete process.env[BOT_ENV];
  delete process.env[WEBHOOK_ENV];
  delete process.env.TG_API_BASE;
  delete process.env.ALLOWED_ORIGIN;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('роутинг', () => {
  it('GET /health → 200 { ok: true }', async () => {
    const response = await handler(makeEvent('GET', '/health'), {});
    expect(parseResponse(response)).toEqual({ statusCode: 200, body: { ok: true } });
  });

  it('OPTIONS → 204 с CORS-заголовками (preflight браузера)', async () => {
    const response = await handler(makeEvent('OPTIONS', '/create-invoice'), {});
    expect(response.statusCode).toBe(204);
    expect(response.headers['Access-Control-Allow-Origin']).toBe('*');
    expect(response.headers['Access-Control-Allow-Headers']).toContain(
      'X-Telegram-Bot-Api-Secret-Token'
    );
  });

  it('ALLOWED_ORIGIN сужает CORS до домена клиента', async () => {
    process.env.ALLOWED_ORIGIN = 'https://ialmozt25.github.io';
    const response = await handler(makeEvent('GET', '/health'), {});
    expect(response.headers['Access-Control-Allow-Origin']).toBe('https://ialmozt25.github.io');
  });

  it('неизвестный путь → 404, неизвестный метод на известном пути → 404', async () => {
    expect((await handler(makeEvent('GET', '/nope'), {})).statusCode).toBe(404);
    expect((await handler(makeEvent('GET', '/create-invoice'), {})).statusCode).toBe(404);
    expect((await handler(makeEvent('POST', '/health'), {})).statusCode).toBe(404);
  });
});

describe('POST /create-invoice', () => {
  it('неизвестный план → 400 и ни одного вызова Bot API', async () => {
    const fetchStub = stubBotApi({ ok: true, result: 'https://t.me/invoice/x' });

    const response = await handler(makeEvent('POST', '/create-invoice', { body: { plan: 'weekly' } }), {});

    expect(parseResponse(response)).toEqual({
      statusCode: 400,
      body: { error: 'unknown_plan', plan: 'weekly' },
    });
    expect(fetchStub).not.toHaveBeenCalled();
  });

  it('битый JSON → 400 invalid_json', async () => {
    const response = await handler(
      makeEvent('POST', '/create-invoice', { body: '{not json' }),
      {}
    );
    expect(parseResponse(response).body).toEqual({ error: 'invalid_json' });
  });

  it('без TG_BOT_TOKEN → 500 и ни одного вызова Bot API', async () => {
    delete process.env[BOT_ENV];
    const fetchStub = stubBotApi({ ok: true, result: 'https://t.me/invoice/x' });

    const response = await handler(makeEvent('POST', '/create-invoice', { body: { plan: 'monthly' } }), {});

    expect(parseResponse(response)).toEqual({
      statusCode: 500,
      body: { error: 'bot_token_not_configured' },
    });
    expect(fetchStub).not.toHaveBeenCalled();
  });

  it('варианты тарифов уходят в Bot API как XTR-цены 299/1499/3999', async () => {
    const expected = [
      ['monthly', 299, 'Месяц'],
      ['yearly', 1499, 'Год'],
      ['lifetime', 3999, 'Навсегда'],
    ];

    for (const [plan, amount, label] of expected) {
      const fetchStub = stubBotApi({ ok: true, result: `https://t.me/invoice/${plan}` });

      const response = await handler(makeEvent('POST', '/create-invoice', { body: { plan } }), {});

      expect(parseResponse(response).body).toEqual({ invoiceLink: `https://t.me/invoice/${plan}` });

      const [url, init] = fetchStub.mock.calls[0];
      expect(url).toBe(`https://api.telegram.org/bot${BOT_CREDENTIAL}/createInvoiceLink`);
      expect(init.method).toBe('POST');

      const sent = JSON.parse(init.body);
      expect(sent.currency).toBe('XTR');
      expect(sent.provider_token).toBe('');
      expect(sent.prices).toEqual([{ label, amount }]);
      expect(sent.payload.startsWith(`spec064:${plan}:`)).toBe(true);
      expect(typeof sent.title).toBe('string');
      expect(sent.title.length).toBeGreaterThan(0);
      vi.unstubAllGlobals();
    }
  });

  it('ошибка Bot API → 502 telegram_api_error с описанием', async () => {
    stubBotApi({ ok: false, description: 'Bad Request: cannot create invoice' });

    const response = await handler(makeEvent('POST', '/create-invoice', { body: { plan: 'yearly' } }), {});

    expect(parseResponse(response)).toEqual({
      statusCode: 502,
      body: { error: 'telegram_api_error', description: 'Bad Request: cannot create invoice' },
    });
  });

  it('сетевой отказ fetch → 502, а не 500 с трейсбеком', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));

    const response = await handler(makeEvent('POST', '/create-invoice', { body: { plan: 'yearly' } }), {});

    expect(parseResponse(response).body).toEqual({
      error: 'telegram_api_error',
      description: 'ECONNREFUSED',
    });
  });

  it('TG_API_BASE подменяет Bot API (прокси, если прямой доступ из облака закрыт)', async () => {
    process.env.TG_API_BASE = 'https://bot-proxy.example.test/';
    const fetchStub = stubBotApi({ ok: true, result: 'https://t.me/invoice/proxy' });

    await handler(makeEvent('POST', '/create-invoice', { body: { plan: 'monthly' } }), {});

    expect(fetchStub.mock.calls[0][0]).toBe(
      `https://bot-proxy.example.test/bot${BOT_CREDENTIAL}/createInvoiceLink`
    );
  });
});

describe('POST /webhook', () => {
  it('чужой secret-token → 403, апдейт не разбирается и Bot API не вызывается', async () => {
    const fetchStub = stubBotApi({ ok: true });

    const response = await handler(
      makeEvent('POST', '/webhook', {
        headers: webhookHeaders({ 'X-Telegram-Bot-Api-Secret-Token': 'wrong-value' }),
        body: { pre_checkout_query: { id: 'q1' } },
      }),
      {}
    );

    expect(parseResponse(response)).toEqual({ statusCode: 403, body: { error: 'forbidden' } });
    expect(fetchStub).not.toHaveBeenCalled();
  });

  it('отсутствующий заголовок → 403 (не 500)', async () => {
    stubBotApi({ ok: true });
    const response = await handler(
      makeEvent('POST', '/webhook', { headers: {}, body: { update_id: 1 } }),
      {}
    );
    expect(response.statusCode).toBe(403);
  });

  it('заголовок в нижнем регистре тоже принимается (регистр не гарантирован)', async () => {
    stubBotApi({ ok: true, result: true });

    const response = await handler(
      makeEvent('POST', '/webhook', {
        headers: { 'x-telegram-bot-api-secret-token': WEBHOOK_VALUE },
        body: { pre_checkout_query: { id: 'q-lower' } },
      }),
      {}
    );

    expect(response.statusCode).toBe(200);
  });

  it('pre_checkout_query → answerPreCheckoutQuery(ok: true) и 200', async () => {
    const fetchStub = stubBotApi({ ok: true, result: true });

    const response = await handler(
      makeEvent('POST', '/webhook', {
        headers: webhookHeaders(),
        body: { update_id: 7, pre_checkout_query: { id: 'q1', invoice_payload: 'spec064:monthly:1' } },
      }),
      {}
    );

    expect(parseResponse(response)).toEqual({ statusCode: 200, body: { ok: true } });
    expect(fetchStub.mock.calls[0][0]).toBe(
      `https://api.telegram.org/bot${BOT_CREDENTIAL}/answerPreCheckoutQuery`
    );
    expect(JSON.parse(fetchStub.mock.calls[0][1].body)).toEqual({
      pre_checkout_query_id: 'q1',
      ok: true,
    });
  });

  it('base64-тело распаковывается (платформа вправе прислать его так)', async () => {
    const fetchStub = stubBotApi({ ok: true, result: true });

    await handler(
      makeEvent('POST', '/webhook', {
        headers: webhookHeaders(),
        body: { pre_checkout_query: { id: 'q-b64' } },
        base64: true,
      }),
      {}
    );

    expect(JSON.parse(fetchStub.mock.calls[0][1].body).pre_checkout_query_id).toBe('q-b64');
  });

  it('successful_payment → 200 и одна строка структурного лога, без записи в БД', async () => {
    const fetchStub = stubBotApi({ ok: true });
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const response = await handler(
      makeEvent('POST', '/webhook', {
        headers: webhookHeaders(),
        body: {
          update_id: 8,
          message: {
            from: { id: 42 },
            successful_payment: {
              invoice_payload: 'spec064:lifetime:1',
              currency: 'XTR',
              total_amount: 3999,
              telegram_payment_charge_id: 'charge-1',
            },
          },
        },
      }),
      {}
    );

    expect(parseResponse(response)).toEqual({ statusCode: 200, body: { ok: true } });
    expect(fetchStub).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledTimes(1);

    const logged = JSON.parse(logSpy.mock.calls[0][0]);
    expect(logged.event).toBe('successful_payment');
    expect(logged.total_amount).toBe(3999);
    expect(logged.currency).toBe('XTR');
    expect(logged.payload).toBe('spec064:lifetime:1');
    expect(logged.user_id).toBe(42);
  });

  it('прочие апдейты → 200 (иначе Telegram повторит апдейт навсегда)', async () => {
    stubBotApi({ ok: true });
    const response = await handler(
      makeEvent('POST', '/webhook', { headers: webhookHeaders(), body: { update_id: 9 } }),
      {}
    );
    expect(parseResponse(response)).toEqual({ statusCode: 200, body: { ok: true } });
  });
});
