---
id: 063
slug: paywall-content
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

Экран `Paywall` существует и уже стоит в роутере (`src/App.tsx:97`, spec 059), но
содержит **только** гейт бесплатных вопросов: заголовок «Бесплатные вопросы
закончились», список трёх выгод и кнопку покупки-заглушки
(`defaultPaymentProvider`, `src/platform/payment_provider.ts`). Продуктовой логики
Free/Paid в нём нет: **все 14 тем одинаково доступны** — `startTopicQuiz(topic)`
вызывается из `Dashboard.tsx:505` без единой проверки, а `canAccessQuestion`
(`src/store/quizStore.ts:556`) знает только про `FREE_QUESTION_LIMIT = 5` и `isPro`.

Продукт функционально готов: 253 вопроса по 14 темам, Exam mode (spec 054),
FSRS-lite (spec 052), Analytics (spec 058), онбординг (spec 060), retention-зона
(spec 061). Монетизация — следующий шаг, и первым в неё входит **контентный
paywall**: что бесплатно, что платно и как выглядит вход в платный контент.

Реальная оплата в эту спеку **не входит** — она вынесена в spec 064. Здесь
кнопка покупки остаётся заглушкой.

## Цель

Ввести контентный paywall: **3 темы Free / 11 тем Paid**, **7-дневный trial** и
**условие показа Paywall** при клике на платную тему.

- 3 бесплатные темы определяются чистой функцией (`src/domain/paywall.ts`), а не
  разметкой экрана;
- trial — новое персистентное поле `trialStartedAt` (миграция
  `persist.version: 6 → 7`); существующие пользователи получают 7 дней trial,
  чтобы обновление не отобрало у них доступ;
- доступ к теме решает `canAccessTopic(slug, {isPro, trialStartedAt}, now)`;
- Paywall остаётся **самостоятельным экраном** (не переписывается), а его
  `data-testid`-контракт (`paywall`, `paywall-buy`, `paywall-later`) сохраняется.

**НЕ входит:** реальная оплата и любая интеграция платёжного провайдера (spec 064),
изменение `FREE_QUESTION_LIMIT` и гейта бесплатных вопросов, Telegram-платежи,
подписки/чеки.

## Что НЕ трогать

- `src/data/**` (банк 253), `tools/**`, `.project/sync.mjs`, `.project/ORCH-RULES.md`,
  `playwright.config.ts`, `tailwind.config.*`, зависимости `package.json`;
- domain-модули `src/domain/{fsrs,exam,analytics,onboarding,goal}.ts`,
  `src/store/{onboarding,dailyGoal}.ts`;
- `isPro` default (`false`) — не меняется;
- порядок существующих 21 поля `partialize` — `trialStartedAt` идёт строго в конец;
- session-only поля (`activeTopic`, `reviewKind`, `examLastResult`, `examSession`,
  `currentScreen`, `isPaywallVisible`, `questions`, `isLoading`) в `partialize` не
  переносятся;
- гейт бесплатных вопросов (`canAccessQuestion` / `FREE_QUESTION_LIMIT` / ветка
  paywall в `nextQuestion`) — он остаётся как есть, spec 063 добавляет **второй**,
  контентный слой;
- открытие Free-тем — поведение не меняется.

## Что делаем

### К1. `src/domain/paywall.ts` — чистые функции

```ts
export const FREE_TOPICS: readonly string[] = [
  'essential_tools', 'file_permissions', 'users_groups',
];
export const TRIAL_DAYS = 7;
export const TRIAL_MS = TRIAL_DAYS * 24 * 3600 * 1000;

export function isFreeTopic(slug: string): boolean;
export function isTrialActive(trialStartedAt: number | null, now: number): boolean;
export function canAccessTopic(
  slug: string,
  state: { isPro: boolean; trialStartedAt: number | null },
  now: number,
): boolean;
```

- `isTrialActive` — `true` ровно когда `trialStartedAt != null` **и**
  `now - trialStartedAt < TRIAL_MS`. Будущий `trialStartedAt` (часы сбиты) даёт
  отрицательную разницу и потому `true` — трактуем как активный trial.
- `canAccessTopic` = `isPro || isTrialActive(...) || isFreeTopic(slug)`.
- Ноль импортов `zustand`/`react`; `now` — **аргумент**, не `Date.now()` внутри
  (домен остаётся чистым и детерминированным).

### К2. Store (`src/store/quizStore.ts`)

- `persist.version: 6 → 7`.
- Миграция `v6 → v7`:
  - `hasCompletedOnboarding === true && isPro === false && trialStartedAt`
    отсутствует → `trialStartedAt = Date.now()` (существующий пользователь
    сохраняет доступ ещё на 7 дней);
  - иначе → `trialStartedAt = null` (свежий профиль trial сам не начинает:
    он начинается кнопкой «Попробовать 7 дней бесплатно»).
  - `isPro` не трогается.
- `partialize`: `trialStartedAt: number | null` — **последним**, после `todayXp`.
- Экшены: `startTrial(): void` — ставит `trialStartedAt = Date.now()`, если ещё
  `null`; повторный вызов — no-op (идемпотентно, trial не продлевается).

### К3. Селектор `useCanAccessTopic` (`src/store/paywall.ts`, вне стора)

По прецеденту `src/store/dailyGoal.ts` (spec 061) и `src/store/onboarding.ts`
(spec 060): подписка на примитивы `isPro` + `trialStartedAt`, решение — через
`canAccessTopic` из домена. Своих полей в localStorage не заводит.

### К4. `src/presentation/screens/Paywall.tsx` — доработка, не переписывание

- Сохраняются: `data-testid="paywall"`, `AppHeader`, существующие кнопки
  `paywall-buy` и `paywall-later`.
- Секция «Бесплатно: 3 темы» — список Free-тем (заголовки из `src/data/topics.ts`).
- Секция «Pro: 11 тем + Exam + Analytics» — список Paid-тем.
- Новая кнопка `data-testid="paywall-start-trial"` («Попробовать 7 дней
  бесплатно») → `startTrial()` + `navigateTo('dashboard')`.
- `paywall-buy` («Купить — 299 Stars/мес») → **заглушка**: сообщение «Скоро в spec
  064», платёжный flow не открывается (`provider.purchase()` не вызывается).
- `paywall-later` («Не сейчас») → `hidePaywall()` + `navigateTo('dashboard')`.

### К5. Точка показа Paywall (`src/presentation/screens/Dashboard.tsx`)

- Обработчик клика по теме: перед `startTopicQuiz(topic.key)` — проверка
  `useCanAccessTopic(topic.key)`.
- `true` → существующий переход в quiz (Free-темы не затронуты).
- `false` → `isPaywallVisible = true` + `currentScreen = 'paywall'`.
- Тема с `status !== 'available'` («Скоро») остаётся неинтерактивной.

### К6. Бейджи Free/Pro на темах (в scope этой спеки)

- Бейдж по доступу: `data-testid="topic-badge-free"` для Free-темы,
  `data-testid="topic-badge-pro"` для Paid-темы, к которой у пользователя нет
  доступа (то есть Pro-бейдж = «это платно»).
- Существующий счётчик «N вопр.» и «Скоро» сохраняются.

## Acceptance

- [ ] `src/domain/paywall.ts` существует, экспортирует `FREE_TOPICS` (ровно 3
      слага из `src/data/topics.ts`), `TRIAL_DAYS = 7`, `TRIAL_MS`, `isFreeTopic`,
      `isTrialActive`, `canAccessTopic`; ноль импортов `zustand`/`react`.
- [ ] `persist.version === 7`; миграция `v6→v7` даёт trial существующему
      пользователю (`hasCompletedOnboarding && !isPro`) и `null` — свежему;
      `isPro` не меняется.
- [ ] `partialize` содержит `trialStartedAt` последним полем; порядок предыдущих
      21 поля не изменён.
- [ ] `startTrial()` идемпотентен; `useCanAccessTopic` живёт вне стора.
- [ ] Paywall показывает обе секции, кнопки `paywall-buy` / `paywall-later` на
      месте, добавлена `paywall-start-trial`.
- [ ] Клик по Paid-теме без доступа открывает Paywall; Free-тема открывает quiz;
      тема со статусом «Скоро» остаётся неинтерактивной.
- [ ] Unit-тесты `src/domain/__tests__/paywall.test.ts` и
      `src/store/__tests__/paywall-migration.test.ts` зелёные.
- [ ] E2E `e2e/paywall.spec.ts` покрывает: Free-тема без Paywall, Paid-тема с
      Paywall, `paywall-start-trial` → Dashboard + Paid-тема открывается,
      `paywall-later` → Dashboard без trial.
- [ ] `npm run typecheck`, `npm run test:run`, `npm run test:e2e`, `npm run build`
      — все exit 0.

## Проверка

```
npm run typecheck
npm run test:run
npm run test:e2e
npm run build
npm run sync:check
```

## Риски

- **E2E-фикстуры.** `emptyPersistedState()` сеет `isPro: true`; у «свежего»
  профиля (`freshProfile()`) `isPro: false`, но `hasCompletedOnboarding: true` —
  по миграции такой профиль получил бы trial и **не увидел бы** контентный
  Paywall. Сид обновляется явно активным `trialStartedAt` (обычный профиль с
  пройденным онбордингом), а спеки самого paywall переопределяют его `null`.
- **Гейт бесплатных вопросов не дублируется.** Контентный paywall срабатывает на
  клике по теме; review/topic/exam-прогоны по-прежнему не платятся — иначе
  ломается spec 052/054 и регрессия B1.
- **Продление trial.** `startTrial` не сдвигает уже стоящую дату, поэтому
  «Попробовать 7 дней» нельзя нажать дважды ради бесконечного доступа.
