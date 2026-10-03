---
id: 064
slug: telegram-stars
type: feature
track: full
status: approved
created: 2026-10-04
updated: 2026-10-04
commit: null
embedded_approve: rule 2 (F5.0a — 2026-10-04)
execution: direct
---

## Контекст

Кнопка покупки на экране `Paywall` — **осознанная заглушка** spec 063: клик
показывает «Оплата появится в spec 064 — сейчас подписку оформить нельзя»
(`src/presentation/screens/Paywall.tsx:47`), платёжный flow не открывается,
`isPro` остаётся `false`. Платформенный слой уже размечен под замену:
`src/platform/payment_provider.ts` держит интерфейс `PaymentProvider` и
singleton-заглушку `defaultPaymentProvider` (id `stub`, 490 ₽, фейковые 500 мс),
а store уже умеет выдавать Pro — `unlockPro()` (`src/store/quizStore.ts:571`)
ставит `isPro: true` + `isPaywallVisible: false`, и `isPro` персистится
(`partialize`, `src/store/quizStore.ts:898`).

Функционально продукт готов (253 вопроса, Exam, FSRS-lite, Analytics, онбординг,
retention, контентный paywall). Не хватает **оплаты**. Telegram Mini App продаёт
цифровые товары только за **Telegram Stars (XTR)** — это требование платформы, а
не выбор: карточные провайдеры (YooKassa и подобные) в Mini App для цифровых
товаров запрещены правилами Telegram. Поэтому провайдер — Stars, а транспорт —
invoicе-ссылка, которую открывает клиент Telegram.

Бэкенд — **Yandex Cloud Functions** (Cloudflare Workers отпадает: домен
`*.workers.dev` недоступен в РФ). Функция нужна ровно для двух вещей: получить
`invoiceLink` у Bot API (токен бота не может жить в клиенте) и принять webhook
Telegram. **Серверной верификации платежа в этой спеке нет** — она вынесена в
spec 066; здесь backend stateless и ничего не пишет в БД.

## Цель

Пользователь выбирает тариф, платит Stars и получает `isPro: true` в persist.

- **MVP-граница:** `isPro` ставит **клиент** по callback `openInvoice` со
  статусом `paid`; backend только создаёт инвойс (`create-invoice`),
  подтверждает `pre_checkout_query` и логирует `successful_payment`.
- **Контракт тарифов:** `monthly = 299`, `yearly = 1499`, `lifetime = 3999`
  Stars — один источник (`src/platform/config.ts`), тот же список уходит в
  Bot API как `prices[].amount`.
- **`data-testid`-контракт сохраняется:** `paywall`, `paywall-buy`,
  `paywall-later`, `paywall-start-trial`, `paywall-purchase-notice` не
  переименовываются; новые тарифы получают `plan-monthly` / `plan-yearly` /
  `plan-lifetime`.
- **`unlockPro()` не дублируется** — новый flow вызывает существующий экшен
  store, `quizStore.ts` не правится.

**НЕ входит:** recurring/подписка с автосписанием, refunds и возвраты,
серверная верификация платежа (spec 066), учёт платежей в БД, промокоды,
ценовые эксперименты, оплата вне Telegram (браузерная веб-версия).

## Что делаем

### 1. Backend — Yandex Cloud Function (`backend/tg-stars/index.mjs`)

Node.js 18+, ESM, **zero-deps** (только `node:crypto` и глобальный `fetch`).
Формат — YC Functions: `export const handler = async (event, context) => ({ statusCode, headers, body })`,
роутинг по `event.requestContext.http.method` + `.path`.

| метод + путь | поведение |
|---|---|
| `OPTIONS *` | 204 + CORS-заголовки (preflight) |
| `GET /health` | 200 `{ ok: true }` |
| `POST /create-invoice` | body `{ plan }` → 200 `{ invoiceLink }`; неизвестный план → 400; нет `TG_BOT_TOKEN` → 500; ошибка Bot API → 502 |
| `POST /webhook` | заголовок `X-Telegram-Bot-Api-Secret-Token` ≠ `WEBHOOK_SECRET` → 403; `pre_checkout_query` → `answerPreCheckoutQuery(ok: true)` → 200; `successful_payment` → 200 + структурный лог; прочие апдейты → 200 |
| иной путь | 404 |

- `createInvoiceLink` Bot API: `POST /bot<TOKEN>/createInvoiceLink` с
  `{ title, description, payload, currency: 'XTR', prices: [{ label, amount }], provider_token: '' }`.
- `payload` инвойса — `spec064:<plan>:<unix-ms>`, чтобы по webhook было видно
  тариф (без записи в БД).
- Секреты — **только env**: `TG_BOT_TOKEN`, `WEBHOOK_SECRET`; опционально
  `ALLOWED_ORIGIN` (по умолчанию `*`) и `TG_API_BASE` (по умолчанию
  `https://api.telegram.org` — точка подмены на прокси Bot API, если прямой
  доступ из облака окажется закрыт).
- Сравнение секрета — `crypto.timingSafeEqual` (не `===`).
- Логирование — `console.log(JSON.stringify(...))` одной строкой на событие:
  платёж виден в логах функции, БД нет.

### 2. Frontend

- `src/platform/config.ts` (новый): `API_GATEWAY_URL` из
  `import.meta.env.VITE_API_GATEWAY_URL` (пустая строка, если не задан) +
  `PAYMENT_PLANS` (`monthly`/`yearly`/`lifetime` со `stars` и русской подписью)
  + `DEFAULT_PLAN_ID = 'monthly'` + type guard `isPaymentPlanId`.
- `src/platform/payment_provider.ts`: `createInvoiceLink(planId, baseUrl?)
  → Promise<string>` (валидирует план, требует настроенный backend, иначе
  `throw new Error('Payment backend not configured')`), `openInvoice(url) →
  Promise<'paid' | 'cancelled' | 'failed' | 'pending'>` и
  `isInvoiceSupported()`. Заглушка `StubPaymentProvider` заменяется на
  `TelegramStarsPaymentProvider` — интерфейс `PaymentProvider`
  (`src/platform/payment_provider.ts:6`) сохраняется, `defaultPaymentProvider`
  остаётся экспортом.
- `src/presentation/screens/Paywall.tsx`: над `paywall-buy` — группа radio
  (`plan-<id>`, `data-testid` на самом `input`), выбранный тариф меняет подпись
  кнопки; `paywall-buy` → `createInvoiceLink(selectedPlan)` → `openInvoice(url)`.
  На время запроса/инвойса кнопка `disabled` (`isProcessing`). Успех →
  `unlockPro()` + `navigateTo('dashboard')`; `cancelled`/`failed`/`pending` →
  сообщение «Оплата не завершена», экран остаётся paywall; исключение →
  «Не удалось начать оплату. Попробуйте позже.».
- Форма сообщения: **inline-notice с `role="status"`** (`data-testid="paywall-purchase-notice"`
  сохранён), а не отдельный toast-компонент: тостовой подсистемы в проекте нет
  (`grep toast` по `src/` — 0 совпадений), а заводить её — правка presentation
  вне скоупа этой спеки.

### 3. Инструкция деплоя (`docs/SETUP-PAYMENTS.md`)

Bot token → Cloud Function (Node.js 18) → env функции → API Gateway →
`setWebhook` с `secret_token` → `VITE_API_GATEWAY_URL` в `.env.production` →
`GET /health` → реальная оплата.

### 4. Тесты

- `backend/tg-stars/__tests__/index.test.mjs` — роутинг, валидация плана,
  тело запроса к Bot API (`currency: 'XTR'`, `prices[].amount`), 403 на чужой
  секрет, `answerPreCheckoutQuery`, CORS на preflight, 404.
- `src/platform/__tests__/payment_provider.test.ts` — план-гард, «backend не
  настроен», склейка `${base}/create-invoice` и разбор `invoiceLink`,
  ошибки HTTP/формы, нормализация статусов `openInvoice`, отсутствие Telegram API.
- `src/presentation/screens/__tests__/Paywall.purchase.test.tsx` — три тарифа,
  выбор тарифа, `paid` → `isPro: true` + переход на dashboard,
  `cancelled` → сообщение и `isPro: false`, исключение → сообщение.
- `e2e/paywall.spec.ts` — прежний тест «заглушка spec 064» заменяется на
  «бэкенд не настроен → Pro не выдаётся», добавляется проверка трёх
  `plan-*` и смены подписи кнопки. `e2e/fixtures.ts` получает новые TESTID.

## Критерии приёмки

- [ ] `backend/tg-stars/index.mjs` экспортирует `export const handler` в формате
      YC Functions; роутинг по `event.requestContext.http.{method,path}`.
- [ ] `GET /health` → 200 `{ ok: true }`.
- [ ] `POST /create-invoice` с валидным планом возвращает `invoiceLink` из Bot API;
      неизвестный план → 400, отсутствие `TG_BOT_TOKEN` → 500, ошибка Bot API → 502.
- [ ] Тело запроса к Bot API: `currency: 'XTR'`, `prices: [{ label, amount }]`
      с `amount` 299/1499/3999, `provider_token: ''`, `payload` содержит тариф.
- [ ] `POST /webhook` с чужим/отсутствующим `X-Telegram-Bot-Api-Secret-Token` → 403.
- [ ] `pre_checkout_query` → вызов `answerPreCheckoutQuery` с `ok: true` и 200.
- [ ] `successful_payment` → 200 + строка структурного лога; ни одного вызова БД.
- [ ] `OPTIONS` → 204 с CORS-заголовком; неизвестный путь → 404.
- [ ] Секреты не попадают в репозиторий: `.env`/токенов в диффе нет,
      `.gitignore` расширен на `backend/**/node_modules/` и `backend/**/.env`.
- [ ] `src/platform/config.ts` отдаёт `API_GATEWAY_URL` (пустая строка без env)
      и `PAYMENT_PLANS` с тарифами 299/1499/3999.
- [ ] `createInvoiceLink` без настроенного backend бросает
      `Payment backend not configured`, с настроенным — POST `${base}/create-invoice`
      с телом `{ plan }` и возвращает `invoiceLink`.
- [ ] `Paywall` рендерит `plan-monthly`, `plan-yearly`, `plan-lifetime`; по
      умолчанию выбран `monthly`; подпись `paywall-buy` отражает выбранный тариф.
- [ ] `paid` → `unlockPro()` (тот же экшен store, без дублирования) + экран
      dashboard; `isPro` персистится штатным `partialize` без правок store.
- [ ] `cancelled`/`failed`/`pending` → сообщение «Оплата не завершена»,
      экран paywall, `isPro: false`.
- [ ] Во время открытия инвойса `paywall-buy` задизейблен.
- [ ] `data-testid` `paywall`, `paywall-buy`, `paywall-later`,
      `paywall-start-trial`, `paywall-purchase-notice` сохранены.
- [ ] `docs/SETUP-PAYMENTS.md` описывает все шаги деплоя и проверку `/health`.
- [ ] Гейты: `npm run typecheck`, `npm run test:run`, `npm run test:e2e`,
      `npm run build`, `npm run sync:check` — exit 0.
- [ ] EOL правленых файлов: LF, последний байт `0x0A` (правило 16).

## Проверка (сигналы критериев)

```powershell
npm run typecheck          # exit 0
npm run test:run           # baseline 382 → больше, 0 fail (backend + platform + Paywall)
npm run test:e2e           # baseline 81 → больше, 0 fail
npm run build              # exit 0
npm run sync:check         # exit 0
node --check backend/tg-stars/index.mjs   # синтаксис ESM
```

Живая проверка Bot API из облака (`getMe` из задеплоенной функции) в этой спеке
**не выполняется** — она требует доступа к Yandex Cloud; шаг вынесен в
`docs/SETUP-PAYMENTS.md` §6 как обязательный перед включением
`VITE_API_GATEWAY_URL`. Пока он не пройден, `API_GATEWAY_URL` остаётся пустым,
кнопка покупки показывает сообщение об ошибке и `isPro` не выдаётся — то есть
непроверенный бэкенд не может «тихо» открыть Pro.

## Что НЕ трогать

- `src/data/**` (банк 253), `tools/**`, `.project/sync.mjs`,
  `.project/ORCH-RULES.md`, `playwright.config.ts`, `tailwind.config.*`,
  `package.json` (новых зависимостей нет);
- `src/domain/{fsrs,exam,analytics,onboarding,goal,paywall}.ts`,
  `src/store/{onboarding,dailyGoal,paywall}.ts`;
- `src/store/quizStore.ts` — `unlockPro()` вызывается как есть, `partialize`
  и версия persist не меняются;
- секреты: `.env`, токен бота, `WEBHOOK_SECRET` не коммитятся;
- `isPro` default (`false`) и гейт бесплатных вопросов `FREE_QUESTION_LIMIT`.

## Открытые вопросы

- Прямой доступ к `api.telegram.org` из Yandex Cloud Functions не подтверждён
  в этой сессии (нет `yc` CLI и доступа к облаку). Если окажется закрыт —
  предусмотрена точка подмены `TG_API_BASE` (прокси Bot API, вариант Amvera);
  решение за капитаном. Подробности — в отчёте оркестратора и
  `docs/SETUP-PAYMENTS.md` §6.
