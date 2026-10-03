import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  API_GATEWAY_URL,
  DEFAULT_PLAN_ID,
  PAYMENT_PLANS,
  findPaymentPlan,
  isPaymentPlanId,
} from '@/platform/config';
import {
  createInvoiceLink,
  defaultPaymentProvider,
  isInvoiceSupported,
  openInvoice,
} from '@/platform/payment_provider';

/**
 * spec 064 — платформенный слой оплаты.
 *
 * `createInvoiceLink` принимает `baseUrl` параметром именно ради этих тестов:
 * `API_GATEWAY_URL` читается из build-time env на импорте модуля, поэтому
 * «настроенный backend» проверяется явным аргументом, а «ненастроенный» —
 * пустой строкой (что и есть состояние тестовой сборки).
 */

const PLAN = PAYMENT_PLANS[0];
const BASE = 'https://payments.example.test';

interface TelegramStubConfig {
  /** Значение, которое мост отдаёт в callback. */
  status: string;
  /** Синхронный throw вместо callback. */
  throwInstead?: boolean;
  /** Вызвать callback дважды (защита от двойного settle). */
  twice?: boolean;
}

function installTelegramStub(config: TelegramStubConfig): string[] {
  const opened: string[] = [];
  (window as unknown as { Telegram?: unknown }).Telegram = {
    WebApp: {
      openInvoice(url: string, callback: (status: string) => void) {
        opened.push(url);
        if (config.throwInstead) throw new Error('bridge exploded');
        callback(config.status);
        if (config.twice) callback('failed');
      },
    },
  };
  return opened;
}

function removeTelegramStub(): void {
  delete (window as unknown as { Telegram?: unknown }).Telegram;
}

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

afterEach(() => {
  removeTelegramStub();
  vi.unstubAllGlobals();
});

describe('config: тарифы', () => {
  it('отдаёт три тарифа 299/1499/3999 Stars (тот же контракт, что у backend)', () => {
    expect(PAYMENT_PLANS.map((plan) => [plan.id, plan.stars])).toEqual([
      ['monthly', 299],
      ['yearly', 1499],
      ['lifetime', 3999],
    ]);
    expect(DEFAULT_PLAN_ID).toBe('monthly');
  });

  it('без VITE_API_GATEWAY_URL в окружении сборки URL пуст, а не строка "undefined"', () => {
    expect(typeof API_GATEWAY_URL).toBe('string');
    expect(API_GATEWAY_URL === '' || API_GATEWAY_URL.startsWith('http')).toBe(true);
  });

  it('guard и поиск тарифа не пропускают чужой id', () => {
    expect(isPaymentPlanId('yearly')).toBe(true);
    expect(isPaymentPlanId('weekly')).toBe(false);
    expect(findPaymentPlan('lifetime')?.stars).toBe(3999);
    expect(findPaymentPlan('weekly')).toBeUndefined();
  });
});

describe('createInvoiceLink', () => {
  it('бросает на неизвестном тарифе ДО обращения к сети', async () => {
    const fetchStub = vi.fn();
    vi.stubGlobal('fetch', fetchStub);

    await expect(createInvoiceLink('weekly' as never, BASE)).rejects.toThrow(
      /Unknown payment plan/
    );
    expect(fetchStub).not.toHaveBeenCalled();
  });

  it('бросает "Payment backend not configured", когда gateway не задан', async () => {
    const fetchStub = vi.fn();
    vi.stubGlobal('fetch', fetchStub);

    await expect(createInvoiceLink(PLAN.id, '')).rejects.toThrow(
      /Payment backend not configured/
    );
    expect(fetchStub).not.toHaveBeenCalled();
  });

  it('POST-ит план на ${base}/create-invoice и возвращает invoiceLink', async () => {
    const fetchStub = vi.fn().mockResolvedValue(jsonResponse({ invoiceLink: 'https://t.me/invoice/abc' }));
    vi.stubGlobal('fetch', fetchStub);

    await expect(createInvoiceLink('yearly', BASE)).resolves.toBe('https://t.me/invoice/abc');

    expect(fetchStub).toHaveBeenCalledTimes(1);
    const [url, init] = fetchStub.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE}/create-invoice`);
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ plan: 'yearly' }));
  });

  it('падает на HTTP-ошибке backend\'а', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ error: 'boom' }, 502)));
    await expect(createInvoiceLink(PLAN.id, BASE)).rejects.toThrow(/HTTP 502/);
  });

  it('падает, когда в ответе нет строкового invoiceLink', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ invoiceLink: 42 })));
    await expect(createInvoiceLink(PLAN.id, BASE)).rejects.toThrow(/no invoice link/);
  });
});

describe('openInvoice', () => {
  it('вне Telegram окно инвойса недоступно', async () => {
    expect(isInvoiceSupported()).toBe(false);
    await expect(openInvoice('https://t.me/invoice/abc')).rejects.toThrow(/not available/);
  });

  it('возвращает paid и передаёт ссылку мосту ровно один раз', async () => {
    const opened = installTelegramStub({ status: 'paid' });
    expect(isInvoiceSupported()).toBe(true);

    await expect(openInvoice('https://t.me/invoice/abc')).resolves.toBe('paid');
    expect(opened).toEqual(['https://t.me/invoice/abc']);
  });

  it('пробрасывает cancelled как есть', async () => {
    installTelegramStub({ status: 'cancelled' });
    await expect(openInvoice('https://t.me/invoice/abc')).resolves.toBe('cancelled');
  });

  it('неизвестный статус трактуется как failed, а не как успех', async () => {
    installTelegramStub({ status: 'weird-status' });
    await expect(openInvoice('https://t.me/invoice/abc')).resolves.toBe('failed');
  });

  it('синхронный throw моста превращается в reject, а не в вечное ожидание', async () => {
    installTelegramStub({ status: 'paid', throwInstead: true });
    await expect(openInvoice('https://t.me/invoice/abc')).rejects.toThrow(/bridge exploded/);
  });

  it('второй callback не переопределяет результат', async () => {
    installTelegramStub({ status: 'paid', twice: true });
    await expect(openInvoice('https://t.me/invoice/abc')).resolves.toBe('paid');
  });
});

describe('defaultPaymentProvider', () => {
  it('без настроенного backend недоступен и не врёт об успехе', async () => {
    installTelegramStub({ status: 'paid' });
    expect(defaultPaymentProvider.id).toBe('telegram_stars');

    if (API_GATEWAY_URL === '') {
      expect(defaultPaymentProvider.isAvailable()).toBe(false);
      await expect(defaultPaymentProvider.purchase()).resolves.toEqual({
        success: false,
        error: 'Payment backend not configured',
      });
    } else {
      // В сборке с настроенным gateway доступность зависит от окружения — сама
      // доступность моста уже проверена выше.
      expect(defaultPaymentProvider.isAvailable()).toBe(true);
    }
  });
});
