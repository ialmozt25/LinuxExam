---
id: 060
slug: onboarding
status: approved
type: feature
track: full
created: 2026-10-03
updated: 2026-10-03
commit: null
embedded_approve: rule 2 (F5.0a — 2026-10-03)
execution: direct
---

## Контекст

Онбординга нет: пользователь открывает приложение и сразу попадает на Dashboard
(`App.tsx:65`, начальный `currentScreen: 'dashboard'` — `quizStore.ts:265`). Он
видит статус-полосу, прогресс 0/253, 14 тем и пять кнопок потоков, но не получает
**ни одного ответа на вопрос «что это даёт мне»** до того, как обязан что-то
выбрать. Аудит §4.2 фиксирует это как «Onboarding — **отсутствует**: ни файла, ни
Screen-значения, ни ветви `App.tsx`».

Принцип Duolingo: **ценность за 60 секунд до обязательств**. Пользователь должен
сначала сформулировать цель, затем сразу ответить на 3 живых вопроса банка и
увидеть результат — и только потом попасть на Dashboard, где уже есть мотивация
продолжать. Никакой регистрации, никакого пейволла в этом потоке.

## Цель

3 экрана активации — **цель → демо-квиз → результат** — с детерминированной
подборкой вопросов, персистентным фактом прохождения и гейтом, который **не
показывает онбординг существующим пользователям**. Новые экраны подключены к
существующему тернарному роутеру `App.tsx`.

**НЕ входит:** монетизация (фаза 063), streaks/геймификация (spec 061),
уведомления (spec 062). Dashboard в этом прогоне не меняется.

## Что делаем

### К1. `src/domain/onboarding.ts` — чистые функции

Ноль импортов zustand/react (правило слоя domain).

- `ONBOARDING_GOALS: readonly OnboardingGoal[]` — ровно **3** цели с
  уникальными `id`: `'rhcsa'`, `'refresh'`, `'interview'`; у каждой `label` и
  `description`.
- `pickDemoQuestions(bank: readonly Question[], seed: string, n = 3): Question[]`
  — **детерминированно, без `Math.random`**: seed-строка (`goalId`) хэшируется в
  число, далее mulberry32 + Fisher–Yates по копии банка, срез до `n`. Тот же
  `seed` на том же банке → те же qid. `bank.length < n` → возвращается весь банк
  (в исходном порядке); пустой банк → `[]`.
- `computeDemoResult(answers: readonly { isCorrect: boolean }[]): DemoResult` —
  `{ correct, total, message }`; `total = answers.length`, границы **0/3 … 3/3**
  покрыты персональными сообщениями, пустой массив → `correct 0, total 0` и
  fallback-сообщение (без NaN и деления на ноль).

### К2. Store (`src/store/quizStore.ts`)

- `Screen` union: **+ 3 значения** `'onboarding-goal' | 'onboarding-demo' |
  'onboarding-result'` → **11 значений**.
- `persist.version`: **4 → 5**. Миграция **v4→v5** добавляет
  `onboardingGoal: null` и `hasCompletedOnboarding: false`. **Дефолт `false`
  обязателен** — существующий пользователь после обновления не должен увидеть
  онбординг (второй барьер — условие «`questionStats` пуст», см. ниже).
- `partialize`: **+ `onboardingGoal`, `hasCompletedOnboarding` в конец списка**;
  порядок существующих 17 полей не меняется, session-only поля в persist не
  переносятся.
- Экшены: `setOnboardingGoal(goalId)`, `completeOnboarding()`,
  `resetOnboarding()` (для тестов; в UI не вызывается).
- Селектор `useNeedsOnboarding()` — **вне стора**, отдельным хуком:
  `!state.hasCompletedOnboarding && Object.keys(state.questionStats).length === 0`.
  Условие «`questionStats` пуст» — **критично**: у существующего пользователя
  статистика непуста, поэтому он онбординг не увидит даже при `version < 5`.

### К3. Экраны (`src/presentation/screens/`)

Все три — на `ScreenContainer`, как остальные экраны.

- `OnboardingGoal.tsx` (`data-testid="onboarding-goal"`) — 3 карточки целей;
  клик → `setOnboardingGoal(id)` → `'onboarding-demo'`.
- `OnboardingDemo.tsx` (`data-testid="onboarding-demo"`) — 3 вопроса через
  `pickDemoQuestions`; **один вопрос за раз**, **без фидбека** между вопросами;
  ответы пишутся **только в локальное состояние** (session-only, в `questionStats`
  не попадают и никуда не персистятся). Пустой банк → сразу
  `'onboarding-result'` с fallback-сообщением. Финал → `'onboarding-result'`.
- `OnboardingResult.tsx` (`data-testid="onboarding-result"`) —
  `computeDemoResult` → текст результата + кнопка «Начать» →
  `completeOnboarding()` + `'dashboard'`.

### К4. `src/App.tsx`

- lazy-import 3 экранов (как остальные 8).
- Все **11** значений `Screen` покрыты в тернарной цепочке (`switch` не вводится).
- `useEffect` **до** рендера тернарника: если `useNeedsOnboarding()` и
  `currentScreen === 'dashboard'` → `navigateTo('onboarding-goal')`. Второго
  эффекта гидратации не создаётся — используется существующий `useEffect`
  загрузки банка (`App.tsx:53-56`).

### К5. Dashboard

Кнопки онбординга **не добавляются**; файл не меняется.

## Тесты

- `src/domain/__tests__/onboarding.test.ts`: детерминизм `pickDemoQuestions`
  (тот же seed → те же qid), `bank < 3` → весь банк, `computeDemoResult` для
  0/3…3/3 → валидный `{correct,total,message}`, `ONBOARDING_GOALS` — 3 цели с
  уникальными id.
- `src/store/__tests__/onboarding-migration.test.ts`: миграция v4→v5 (старый
  стейт → новые поля с дефолтами; **17 старых полей сохранены**);
  `useNeedsOnboarding` — `false` при `hasCompletedOnboarding: true`, `false` при
  непустых `questionStats`, `true` при пустом состоянии.
- `e2e/onboarding.spec.ts` (viewport **390×844**), 2 сценария: (1) первый запуск —
  онбординг виден → цель → 3 вопроса → результат → Dashboard; (2) второй запуск с
  сидом `hasCompletedOnboarding: true` — онбординг **не** показан.
- `e2e/fixtures.ts` расширяется: `PersistedQuizState` + два онбординг-поля,
  `PERSIST_VERSION` 4 → 5, хелперы `seedOnboarding` / `waitForOnboardingGoal` и
  авто-фикстура, которая подменяет ответ на документ и встраивает в `<head>`
  скрипт-сид: профиль «свежего пользователя» с `hasCompletedOnboarding: true`
  (`isPro: false` — как у состояния стора по умолчанию), если записи ещё нет.
  Инъекция в сам HTML, а не `addInitScript`, потому что несколько существующих
  сценариев сами вызывают `localStorage.clear()` в своих init-скриптах и стирали
  бы любой сид, поставленный хуком. Онбординг-сценарии просят обратное явным
  сидом с `false` — вставка не перетирает существующий ключ.
- `quiz-flow.spec.ts` переключается на `test` из `./fixtures` (иначе авто-фикстура
  к нему не применяется); сам тест не меняется. Ожидания версии persist в
  существующих тестах (`persist-migration.test.ts`, `exam-session.test.ts`,
  `results.spec.ts:120`) обновляются на 5.

## Критерии приёмки

1. `ONBOARDING_GOALS` — 3 цели с уникальными `id`; `pickDemoQuestions`
   детерминирован, без `Math.random`, и при `bank.length < 3` возвращает весь банк.
2. `computeDemoResult` покрывает 0/3…3/3 и возвращает `{correct,total,message}`
   без NaN.
3. `Screen` содержит 11 значений; `App.tsx` покрывает все 11 в тернарной цепочке.
4. `persist.version === 5`; миграция v4→v5 выставляет
   `hasCompletedOnboarding: false` и `onboardingGoal: null`; 17 прежних полей
   `partialize` сохранены в прежнем порядке, новые — в конце.
5. `useNeedsOnboarding()` = `!hasCompletedOnboarding && questionStats` пуст.
6. Демо-квиз не пишет в `questionStats` (session-only) и не требует фидбека.
7. `npm run typecheck`, `npm run test:run`, `npm run test:e2e`, `npm run build`
   — все exit 0; unit: 279 → 308; e2e: 68 → 70. Ожидания версии persist в
   существующих тестах (`persist-migration.test.ts`, `exam-session.test.ts`)
   обновляются на 5.
8. EOL правленых `.ts`/`.tsx`: `i/lf w/lf`, последний байт `0x0A`; `sync:check`
   = exit 0.

## Что НЕ трогать

- `src/data/**` (банк 253), `tools/**`, `.project/sync.mjs`, `ORCH-RULES.md`,
  `playwright.config.ts`, `tailwind.config.*`, `package.json`,
  `src/domain/{fsrs,exam,analytics}.ts`.
- Зависимости не добавляются.
- Session-only поля в persist не переносятся; порядок существующих 17 полей
  `partialize` не меняется.
- Paywall не наполняется (фаза 063). Dashboard не меняется.
- `.project/mas-runs.json`, `.project/.captain-session-id` — не коммитить.

## Превью

Новые файлы: `src/domain/onboarding.ts`, 3 экрана, 3 тест-файла
(2 unit + 1 e2e). Правки: `quizStore.ts` (union, version 5, migrate, partialize,
3 экшена), `App.tsx` (3 lazy + 3 ветви + эффект-гейт),
`e2e/fixtures.ts` (`PersistedQuizState` + 2 поля, `PERSIST_VERSION` 5),
`persist-migration.test.ts` (ожидания версии). Dashboard — без изменений.
