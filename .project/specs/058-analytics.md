---
id: 058
slug: analytics
status: approved
type: feature
track: full
created: 2026-10-03
updated: 2026-10-03
commit: null
embedded_approve: rule 2 (F5.0a — задание капитана 2026-10-03, прямой путь, прецедент 054)
execution: direct
---

## Контекст

LinuxExam — квиз на 253 вопроса по 14 темам. Прогресс уже собирается:
`questionStats` (попытки/верные/`lastAt` на qid), `scheduledReviews` (FSRS-lite,
spec 052), `examLastResult` (итог экзамена, session-only). Пользователь видит
счётчики (Dashboard, Results) и разбор по темам после экзамена, но **не видит
картину целиком**: какие темы проседают, сколько банка реально пройдено и есть
ли движение за неделю. Экран Results показывает разбор ОДНОГО прогона, Dashboard —
номера, а не качество.

Нужен «персональный тренер»: один экран с radar по 14 темам, готовностью в
процентах и списком слабых зон. Всё считается локально, без бэкенда и без новых
зависимостей: данные уже лежат в persist-состоянии (`questionStats`), банк — в
`src/data/**`.

## Цель

3 чистые функции (готовность темы, готовность по банку, слабые темы) + тренд за
7 дней + 1 экран (radar, «Готовность: N%», до 3 слабых тем, тренд) + кнопка на
Dashboard + e2e. Пустой store даёт «Пройдите хотя бы одну сессию» и readiness 0
(не NaN); radar при 13 из 14 тем = 0 рендерится.

## Что делаем

### Компонент 1 — `src/domain/analytics.ts` (чистые функции)

Ноль импортов zustand/react; `now` — аргументом (детерминизм). Входные данные —
структурный тип, совместимый с `QuestionStat` из стора (лишнее поле `lastAt`
допустимо):

```ts
export interface TopicStat { attempts: number; correct: number; lastAt?: string }
export type StatsByQuestion = Record<string, TopicStat>;
```

- `topicReadiness(stats, bank, slug) → number` (0..1, никогда не NaN):
  `accuracy × coverage`, где `accuracy = Σcorrect / Σattempts` по ответам на
  вопросы этой темы, `coverage = answered / total` (answered — вопросы темы с
  `attempts > 0`, total — размер темы в банке). Пустая тема (нет вопросов в
  банке) → 0, без деления на ноль; `attempts = 0` → accuracy 0, но coverage
  считается отдельно, итог 0.
- `overallReadiness(stats, bank) → number` (0..1): взвешенное по `bank.length`
  среднее `topicReadiness` по всем темам банка; пустой банк → 0.
- `weakTopics(stats, bank, topN = 3) → Array<{slug, label, score}>`: по темам,
  присутствующим в банке, сортировка по `score` по возрастанию, затем по
  `slug` (детерминизм при равенстве), срез до `topN`; `label` — заголовок из
  реестра `TOPICS` (`src/data/topics.ts`), при отсутствии записи — сам `slug`.
- `recentTrend(stats, now, days = 7) → {answered, correct, deltaPct}`: окно
  `[now − days·86400000, now]` по `lastAt`; окно делится на две половины —
  свежая (последние `days/2` суток) и предыдущая; `answered`/`correct` — по
  свежей половине; `deltaPct` — процентное изменение accuracy свежей половины
  относительно предыдущей (`null`, если предыдущая половина пуста: сравнивать
  не с чем — «нет базы», а не «0 %»). Невалидный/отсутствующий `lastAt`
  игнорируется.

### Компонент 2 — `src/store/analytics.ts` (селектор вне persist)

- `useAnalytics()` — функция-хук ВНЕ `persist`-конфига: берёт `questions` и
  `questionStats` стора обычными селекторами и считает агрегат через домен;
  НИЧЕГО не добавляется в `partialize` и в persist-состояние.
- `now` берётся в компоненте (`Date.now()`) и передаётся в домен: хук не
  кэширует «текущее время» внутри стора (иначе состояние снова стало бы
  self-referential и попало бы в persist).

### Компонент 3 — экран

- `src/store/quizStore.ts`: `export type Screen = … | 'analytics'` (расширение
  union, поведение прочих экранов не меняется).
- `src/App.tsx`: `const Analytics = lazy(() => import('@/presentation/screens/Analytics'))`
  + ветка `currentScreen === 'analytics'`. После правки `Screen` **все** места
  маршрутизации проверяются: сегодня это цепочка тернарников в `App.tsx`
  (`switch (currentScreen)` в проекте нет) — верификация `Select-String`.
- `src/presentation/screens/Analytics.tsx` (`data-testid="analytics"`):
  - SVG radar: число осей = `TOPICS.length` (14), НЕ хардкод; при 0 у темы ось
    схлопывается в центр, экран не падает при 13 из 14 нулевых; без библиотек
    (recharts/chart.js/d3 запрещены), только inline SVG.
  - `data-testid="analytics-readiness"` — крупно «Готовность: N%»
    (`Math.round(overall * 100)`).
  - `data-testid="analytics-weak"` — до 3 слабых тем (`label` + `score` в %).
  - Тренд за 7 дней: `data-testid="analytics-trend"` — `answered`/`correct` и
    `deltaPct` (при `null` — «нет базы для сравнения», без «NaN»).
  - Пустой store (нет ни одного ответа) — `data-testid="analytics-empty"` с
    текстом «Пройдите хотя бы одну сессию», readiness = 0%.
  - Стили — только существующие токены (`var(--text-primary)`, `SPACING`,
    `ScreenContainer`), как в `ExamResults.tsx`.
- `src/presentation/screens/Dashboard.tsx` — кнопка
  `data-testid="analytics-mode"` («Аналитика»), клик → `navigateTo('analytics')`.

### Компонент 4 — Тесты

- `src/domain/__tests__/analytics.test.ts`: пустой stats; одна тема; все 14 тем;
  деление на ноль (банк без вопросов темы, `attempts = 0`); NaN-защита
  (нечисловые/отрицательные входы не дают NaN); детерминизм `weakTopics` при
  равных score; `recentTrend` с пустой предыдущей половиной → `deltaPct = null`.
- `e2e/analytics.spec.ts` (сид через `e2e/fixtures.ts`, `seedState`):
  1. пустой store → `analytics-empty` виден, readiness 0%;
  2. частично заполненный store (`questionStats` по реальным qid из банка через
     фикстуры) → readiness > 0% и совпадает с ожидаемым числом, `analytics-weak`
     непуст.
  Тест проверяет ЗНАЧЕНИЯ (текст), а не геометрию SVG (`getBBox()` в jsdom = 0);
  существующие 66 e2e не ломаются.

### Компонент 5 — гигиена

- EOL по правилу 16; `npm run sync` → явные `git add` → коммиты (057 и 058
  отдельными коммитами).

## Критерии приёмки

1. `src/domain/analytics.ts` — только чистые функции, ноль импортов zustand/react,
   `now` аргументом; `topicReadiness`/`overallReadiness` возвращают 0..1 и не NaN.
2. `useAnalytics()` живёт вне persist: `partialize` не расширен, агрегат в
   persist-состоянии отсутствует (проверяется diff'ом `quizStore.ts`).
3. Экран Analytics рендерит radar с `TOPICS.length` осями, «Готовность: N%»,
   до 3 слабых тем и тренд; пустой store → «Пройдите хотя бы одну сессию» и 0 %.
4. Кнопка `analytics-mode` на Dashboard переводит на экран; `case`/ветка в
   `App.tsx` присутствует, все места маршрутизации обновлены.
5. `src/domain/__tests__/analytics.test.ts` покрывает границы (пустой stats, одна
   тема, все 14, деление на ноль, NaN-защита).
6. `e2e/analytics.spec.ts` — 2 сценария (пустой и частично заполненный store),
   без ассертов на геометрию SVG.
7. Гейты exit 0: `typecheck`, `test:run`, `test:e2e`, `build`.

## Что НЕ трогать

`src/data/**` (банк 253), `tools/**`, `.project/sync.mjs`, `.project/ORCH-RULES.md`,
`playwright.config.ts`, `tailwind.config.*`, `package.json`, persist-конфиг
(кроме ничего — он не меняется), история git. Новые зависимости не добавляются.

## Проверка

npm run typecheck; npm run test:run; npm run test:e2e; npm run build

## Edge Cases

- **Пустой store.** `questionStats = {}` → readiness 0 %, `weakTopics` считает
  покрытие 0 по всем темам (список непуст по темам, но экран показывает пустое
  состояние); NaN не появляется.
- **Банк ещё не загружен** (`questions = []`, `isLoading`) → `overallReadiness = 0`
  (деление на ноль защищено), экран не падает.
- **Тема без вопросов в банке** (слаг в stats, но не в банке) → `topicReadiness = 0`,
  в radar ось не появляется (оси = `TOPICS.length`).
- **13 из 14 тем нулевые** → radar рендерится: 14 осей, 13 точек в центре.
- **`deltaPct` при пустой предыдущей половине** → `null` и текст «нет базы для
  сравнения»; «NaN» в UI не появляется (проверяется e2e-ассертом).
- **Экзамен без ответов** (`examLastResult = null`) → тренд = 0/0, экран не
  падает; `examLastResult` session-only и на аналитику не опирается.
- **`lastAt` в будущем/невалидный ISO** → запись игнорируется окном тренда.

## Открытые вопросы

1. Место `useAnalytics()` — задание не называет файл; выбран отдельный
   `src/store/analytics.ts` (прецедент spec 054: новые файлы рядом с доменом, а
   не раздувание `quizStore.ts`), чтобы правка стора свелась к одной строке union
   `Screen`. Альтернатива — экспорт из `quizStore.ts`; решение капитана при
   необходимости.

## Декомпозиция

1. `id: t1` `subject: src/domain/analytics.ts — topicReadiness/overallReadiness/weakTopics/recentTrend (чистые функции, now аргументом)` `assignee: builder` `dependencies: []`
2. `id: t2` `subject: src/domain/__tests__/analytics.test.ts — границы: пустой stats, одна тема, все 14, деление на ноль, NaN-защита, deltaPct null` `assignee: builder` `dependencies: [t1]`
3. `id: t3` `subject: src/store/quizStore.ts (Screen + 'analytics') + src/store/analytics.ts (useAnalytics вне persist) + src/App.tsx (lazy + ветка)` `assignee: builder` `dependencies: [t1]`
4. `id: t4` `subject: src/presentation/screens/Analytics.tsx (radar по TOPICS.length, readiness, weak topics, тренд, пустое состояние)` `assignee: builder` `dependencies: [t3]`
5. `id: t5` `subject: src/presentation/screens/Dashboard.tsx — кнопка analytics-mode` `assignee: builder` `dependencies: [t3]`
6. `id: t6` `subject: e2e/analytics.spec.ts — пустой и частично заполненный store (значения, не геометрия)` `assignee: builder` `dependencies: [t4, t5]`
