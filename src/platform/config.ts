/**
 * Payment configuration (spec 064).
 *
 * Two things live here, and they are deliberately separate:
 *
 * 1. `API_GATEWAY_URL` — where the payment backend lives (Yandex Cloud
 *    Functions behind an API Gateway). It comes from the build environment
 *    (`VITE_API_GATEWAY_URL`), never from the code: the same bundle is deployed
 *    to GitHub Pages, and a hard-coded URL would make the empty/unconfigured
 *    case indistinguishable from a real one. With no env value the constant is
 *    an empty string, and `createInvoiceLink` refuses to build a request — the
 *    paywall then shows «Не удалось начать оплату» instead of silently
 *    "succeeding" with no backend.
 *
 * 2. `PAYMENT_PLANS` — the tariff list, the single client-side source of truth.
 *    The backend repeats the same three amounts (`backend/tg-stars/index.mjs`,
 *    `PLANS`); the pair is a contract, so the numbers are asserted by tests on
 *    both sides.
 */

export type PaymentPlanId = 'monthly' | 'yearly' | 'lifetime';

export interface PaymentPlan {
  readonly id: PaymentPlanId;
  readonly stars: number;
  readonly label: string;
}

/**
 * Reads the configured backend origin. The value is typed as `unknown` on
 * purpose: `import.meta.env` values are injected at build time and an empty or
 * malformed variable must degrade to "" rather than to the string "undefined".
 * A trailing slash is trimmed so `${API_GATEWAY_URL}/create-invoice` cannot
 * produce a double slash.
 */
const rawApiGatewayUrl: unknown = import.meta.env.VITE_API_GATEWAY_URL;

export const API_GATEWAY_URL: string =
  typeof rawApiGatewayUrl === 'string' ? rawApiGatewayUrl.replace(/\/+$/, '') : '';

export const PAYMENT_PLANS: readonly PaymentPlan[] = [
  { id: 'monthly', stars: 299, label: 'Месяц' },
  { id: 'yearly', stars: 1499, label: 'Год' },
  { id: 'lifetime', stars: 3999, label: 'Навсегда' },
];

export const DEFAULT_PLAN_ID: PaymentPlanId = 'monthly';

const PLAN_IDS: readonly string[] = PAYMENT_PLANS.map((plan) => plan.id);

/** Runtime guard for a plan id that arrived as a plain string (runtime-check, not a cast). */
export function isPaymentPlanId(value: string): value is PaymentPlanId {
  return PLAN_IDS.includes(value);
}

/** The plan behind an id, or `undefined` for an unknown one. */
export function findPaymentPlan(id: string): PaymentPlan | undefined {
  return PAYMENT_PLANS.find((plan) => plan.id === id);
}
