---
id: 059
slug: cleanup-blockers
status: approved
type: infra
track: small
created: 2026-10-03
updated: 2026-10-03
commit: null
embedded_approve: rule 2 (F5.0a — 2026-10-03)
---

## Контекст

Аудит механики приложения (`app-mechanics-audit.md`) выявил в §1, §7 и §8 три
блокера, которые разъехались с реальным кодом и мешают следующим фазам
(060–064):

- **§7.3 / §8 п.6 — `Paywall.tsx` вне роутера.** Screen union в сторе знает 7
  значений, файлов экранов — 8. `Paywall` монтируется ранним возвратом из
  `Question.tsx` (при `isPaywallVisible && !isReview`) и не имеет ни своего
  Screen-значения, ни ветви в `App.tsx`. Из-за этого экран нельзя ни
  диагностировать напрямую, ни переиспользовать.
- **§7.2 — 4 мёртвых экшена стора.** `getQuestionsByTopic`, `getCurrentQuestion`,
  `getActiveQuestions`, `getExamProgress` объявлены и реализованы, но в
  `src/**` (вне объявления) и в `e2e/**` не вызываются вовсе. `getExamProgress`
  дополнительно держится только тестом.
- **§1 — 6 «расходящихся» дублей** (DUP3–DUP8): одинаковая логика в двух местах,
  при этом тела/сигнатуры/форматы расходятся, то есть копии уже разъехались.

Разгрузка перед фазами 060–064: убрать мёртвое, подключить сироту-экран,
зафиксировать оставшиеся дубли явным решением. **Не рефакторинг.**

## Цель

Устранить именно эти три проблемы из audit §1/§7: (а) `Paywall` получает
Screen-значение и ветвь рендера в `App.tsx`; (б) 4 мёртвых экшена удалены;
(в) 6 расходящихся дублей либо сведены, либо явно отложены записью в
`docs/memory/alerts.md` с причиной. Поведение пользователя при этом не меняется.

## Что делаем

### К1. Paywall в роутер

- Screen union в `src/store/quizStore.ts` расширяется значением `'paywall'`.
- `src/App.tsx`: `lazy(() => import('@/presentation/screens/Paywall'))` и ветвь
  рендера по образцу существующих экранов — цепочка тернарников, не `switch`.
- Внутренности `src/presentation/screens/Paywall.tsx` не меняются;
  `data-testid="paywall"` уже присутствует на `ScreenContainer` (строка 51) и
  остаётся как есть.
- Кнопку на Dashboard **не добавляем** — точка входа в пейволл остаётся
  прежней (`nextQuestion` поднимает `isPaywallVisible`, `Question.tsx` рендерит
  `<Paywall />`).
- Новых e2e не создаём. Ручная проверка: временно выставить
  `currentScreen='paywall'` в persisted localStorage → reload → убедиться, что
  экран рендерится без ошибок → вернуть значение обратно. Вывод записывается в
  отчёт.

### К2. Мёртвые экшены (4, audit §7.2)

- `getQuestionsByTopic`, `getCurrentQuestion`, `getActiveQuestions`,
  `getExamProgress` удаляются из интерфейса `QuizState` и из тела стора.
- Потребителей нет ни в `src/**`, ни в `e2e/**` (проверено word-boundary
  grep'ом); `getExamProgress` используется только тестом
  `src/store/__tests__/exam-session.test.ts:134,184` — обе проверки удаляются
  вместе с экшеном.
- Экспорты, ссылающиеся только на удалённые экшены, удаляются следом
  (импорт `filterByTopic`/`getCurrentQuestion` из `@/domain/selectors`). Файл
  `src/domain/selectors.ts` при этом **не удаляется и не правится**: его
  функции — валидные доменные селекторы, а правило «`src/domain/**` — только
  устранение дублей, новых функций не добавлять» не даёт мандата на удаление
  модуля (вне списка дублей и мёртвых экшенов).
- Тесты не сломаны: 279 остаётся 279 — удаляются два `expect` внутри
  существующих `it(...)`, а не сами тесты.

### К3. Расходящиеся дубли (6, audit §1)

Для каждого: канонической считается версия, работающая в проде; дубль удаляется
или сводится к хелперу. Если дубль требует правок в 3+ файлах (или сведение
меняет видимое поведение) — **оставляем как есть** и фиксируем в
`docs/memory/alerts.md` с причиной.

Кандидаты (нумерация audit §1): DUP3 (`shuffleOptions` vs `seededIndices`),
DUP4 (Fisher–Yates + `Math.random` в `startTopicQuiz` vs `startExam`), DUP5
(формула accuracy `quizService.ts:69` vs `Results.tsx:50`), DUP6 (процент
прогресса `quizService.ts:70` vs `Dashboard.tsx:84` / `Question.tsx:206`), DUP7
(источник total: `getBankTotal()` vs `questions.length`), DUP8 (формат времени
`MM:SS` vs `HH:MM:SS`).

Рядом лежащий код не рефакторится. `src/domain/**` правится только для
устранения дублей; новых функций в домене не добавляется.

## Критерии приёмки

1. `'paywall'` входит в `Screen` (`quizStore.ts`); `App.tsx` содержит
   lazy-импорт `Paywall` и ветвь рендера по `'paywall'`; тернарники сохранены.
2. `Paywall.tsx` функционально не изменён (внутренности те же), `testid`
   `paywall` присутствует.
3. В `src/store/quizStore.ts` нет объявлений и реализаций
   `getQuestionsByTopic` / `getCurrentQuestion` / `getActiveQuestions` /
   `getExamProgress`; grep по `src/**` + `e2e/**` даёт 0 потребителей.
4. `exam-session.test.ts` содержит объявления `it(...)` без удалённых проверок, и в
   нём нет обращений к `getExamProgress`; число unit-тестов остаётся 279
   (удаляются два `expect` внутри существующих тестов, а не сами тесты).
5. Каждый из 6 дублей §1 либо сведён, либо отложен записью в
   `docs/memory/alerts.md` с причиной; в отчёте по каждому — решение.
6. `npm run typecheck`, `npm run test:run`, `npm run test:e2e`, `npm run build`
   — все exit 0.
7. EOL правленых `.ts`/`.tsx`: `i/lf w/lf`, последний байт `0x0A`; `sync:check`
   = exit 0.

## Что НЕ трогать

- `src/data/**`, `tools/**`, `.project/sync.mjs`, `.project/ORCH-RULES.md`,
  `playwright.config.ts`, `tailwind.config.*`, `package.json`, существующие e2e.
- Новые экшены/поля стора не добавляются; Paywall содержимым не наполняется.
- Dashboard: кнопки пейволла нет.
- `src/domain/**` — только устранение дублей, без новых функций.
- `.project/mas-runs.json`, `.project/.captain-session-id` — не коммитить.

## Превью

Дифф затрагивает: `src/store/quizStore.ts` (Screen union − 4 экшена),
`src/App.tsx` (+1 lazy-импорт, +1 ветвь), тест `exam-session.test.ts`
(−2 проверки), `docs/memory/alerts.md` (запись по отложенным дублям).
`src/presentation/screens/Paywall.tsx` — без изменений (testid уже есть).
