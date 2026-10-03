import { API_GATEWAY_URL, DEFAULT_PLAN_ID, isPaymentPlanId, type PaymentPlanId } from './config';

/**
 * Payment platform layer (spec 064).
 *
 * The real provider is Telegram Stars (XTR) — the only way a Mini App may sell a
 * digital product. The flow is two steps, in this order:
 *
 *   1. `createInvoiceLink(planId)` — the browser asks OUR backend (Yandex Cloud
 *      Function) for an invoice link. The Bot credential lives only there.
 *   2. `openInvoice(url)` — Telegram's own invoice window opens inside the
 *      client, and the client reports back the resulting status.
 *
 * MVP BOUNDARY: the status that comes back from `openInvoice` is what grants Pro
 * (`unlockPro()` in the store). Nothing here verifies the payment server-side —
 * that is spec 066. The backend is stateless by design.
 *
 * SDK NOTE (checked against the installed packages, not guessed):
 * `@telegram-apps/sdk` v3.11.8 DOES export `openInvoice` (an alias of
 * `invoice.open`, promise-based, `openInvoice(url, 'url')`). It is deliberately
 * NOT used here: the app loads that SDK only inside Telegram (`src/main.tsx:51`
 * gates on `window.Telegram?.WebApp` to keep ~18 kB gzip out of the browser
 * bundle), and the raw WebApp bridge method it wraps is the same one, with the
 * callback shape this flow needs. So: raw bridge, no new chunk, no SDK init
 * ordering to get wrong.
 */

export interface PurchaseResult {
  success: boolean;
  error?: string;
}

export interface PaymentProvider {
  readonly id: 'yookassa' | 'telegram_stars' | 'stub';
  readonly label: string;
  readonly price: string;
  isAvailable(): boolean;
  purchase(): Promise<PurchaseResult>;
}

/** Statuses Telegram reports through the `openInvoice` callback. */
export type InvoiceStatus = 'paid' | 'cancelled' | 'failed' | 'pending';

/** The only surface of `window.Telegram.WebApp` this module touches. */
interface TelegramInvoiceBridge {
  openInvoice(url: string, callback: (status: string) => void): void;
}

function readInvoiceBridge(): TelegramInvoiceBridge | undefined {
  if (typeof window === 'undefined') return undefined;
  const webApp = (window as unknown as { Telegram?: { WebApp?: Partial<TelegramInvoiceBridge> } })
    .Telegram?.WebApp;
  if (!webApp || typeof webApp.openInvoice !== 'function') return undefined;
  return webApp as TelegramInvoiceBridge;
}

/** `true` when the invoice window can be opened at all (inside the Telegram client). */
export function isInvoiceSupported(): boolean {
  return readInvoiceBridge() !== undefined;
}

function normalizeInvoiceStatus(value: unknown): InvoiceStatus {
  return value === 'paid' || value === 'cancelled' || value === 'failed' || value === 'pending'
    ? value
    : 'failed';
}

/**
 * Opens Telegram's invoice window and resolves with the payment status.
 *
 * The bridge is callback-based (`openInvoice(url, cb)`), so it is wrapped into a
 * promise. The callback is settled at most once: a misbehaving bridge that calls
 * back twice must not resolve twice, and a synchronous throw must reject instead
 * of hanging the paywall on `isProcessing`.
 */
export function openInvoice(url: string): Promise<InvoiceStatus> {
  return new Promise<InvoiceStatus>((resolve, reject) => {
    const bridge = readInvoiceBridge();
    if (!bridge) {
      reject(new Error('Telegram invoice API is not available'));
      return;
    }

    let settled = false;
    const settle = (status: string) => {
      if (settled) return;
      settled = true;
      resolve(normalizeInvoiceStatus(status));
    };

    try {
      bridge.openInvoice(url, settle);
    } catch (error) {
      if (!settled) {
        settled = true;
        reject(error instanceof Error ? error : new Error('Invoice opening failed'));
      }
    }
  });
}

/**
 * Asks the backend for a Stars invoice link.
 *
 * `baseUrl` is a parameter (default: the configured gateway) so the request
 * shape stays testable without mutating build-time env values. Validation order
 * is deliberate: the plan is checked first, because an unknown plan is a
 * programming error that must not be masked by a missing deployment URL.
 */
export async function createInvoiceLink(
  planId: PaymentPlanId,
  baseUrl: string = API_GATEWAY_URL
): Promise<string> {
  if (!isPaymentPlanId(planId)) {
    throw new Error(`Unknown payment plan: ${String(planId)}`);
  }
  if (baseUrl === '') {
    throw new Error('Payment backend not configured');
  }

  const response = await fetch(`${baseUrl}/create-invoice`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plan: planId }),
  });

  if (!response.ok) {
    throw new Error(`Payment backend error: HTTP ${response.status}`);
  }

  const data: unknown = await response.json().catch(() => null);
  const invoiceLink =
    data !== null && typeof data === 'object' && typeof (data as { invoiceLink?: unknown }).invoiceLink === 'string'
      ? (data as { invoiceLink: string }).invoiceLink
      : '';

  if (invoiceLink === '') {
    throw new Error('Payment backend returned no invoice link');
  }
  return invoiceLink;
}

/**
 * Telegram Stars provider behind the original `PaymentProvider` interface.
 *
 * Kept (and made honest) instead of the old 500 ms stub: the interface is part of
 * the platform contract, and `purchase()` is a thin composition of exactly the
 * two steps the paywall performs for the default plan.
 */
class TelegramStarsPaymentProvider implements PaymentProvider {
  readonly id = 'telegram_stars' as const;

  readonly label = 'Оплатить Stars';

  readonly price = '299 Stars/мес';

  isAvailable(): boolean {
    return API_GATEWAY_URL !== '' && isInvoiceSupported();
  }

  async purchase(): Promise<PurchaseResult> {
    try {
      const url = await createInvoiceLink(DEFAULT_PLAN_ID);
      const status = await openInvoice(url);
      return status === 'paid' ? { success: true } : { success: false, error: status };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'unknown error' };
    }
  }
}

// Singleton - do NOT instantiate inside React components
export const defaultPaymentProvider: PaymentProvider = new TelegramStarsPaymentProvider();
