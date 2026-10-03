# app-map — карта приложения LinuxExam для E2E-покрытия

Дата: 2026-10-03 · База: HEAD `1ed8515` (после push spec 050 — `8838183`, ahead 0)
Источник: чтение `src/**` (4 экрана, store, domain, data, platform, hooks, components), банк вопросов, существующие `e2e/*.spec.ts`.
Статус: **STOP-1 — ждёт approve капитана. Тесты не написаны.**

## 0. Preflight (Фаза 0)

| Пункт | Результат |
|---|---|
| 0.1 `playwright.config.ts` | `webServer` **уже есть** → правка НЕ нужна. Действующий блок: `command: npm run dev -- --host 127.0.0.1 --port 5173`, `url: https://localhost:5173`, `reuseExistingServer: true`, `ignoreHTTPSErrors: true`. HTTP-вариант из задания применять нельзя: `vite.config.ts` форсит `server.https = true` (mkcert), `baseURL` тоже `https://localhost:5173`. |
| 0.2 точка входа | `src/main.tsx` (bootstrap + migrateThemeStorage + applyThemeChoice) → `src/App.tsx` (роутер экранов). `src/*.tsx` на верхнем уровне — только эти два файла, компоненты живут в `src/presentation/**`. |
| 0.3 `data-testid` | **0 совпадений** в `src/**/*.tsx`. Существующие спеки держатся на ролях/`aria-label`/тексте. План атрибутов — §4. |
| 0.4 порт 5173 | свободен (проверено `netstat -ano`). |

Доп. факторы среды, влияющие на прогон:
- **Бикон аналитики** `//gc.zgo.at/count.js` в `index.html:59` задерживает `load` → `page.goto` таймаутит. В `quiz-flow.spec.ts` уже есть `test.beforeEach: page.route(/gc\.zgo\.at/, route => route.abort())`. В фикстурах новых спеков этот abort обязателен (`e2e/fixtures.ts`).
- Загрузка банка асинхронная (`isLoading` → «Загрузка…»), поэтому тесты обязаны ждать появления дашборда, а не проверять `isVisible()` без ожидания.
- `import.meta.env.DEV` бейдж: в браузере «Web mode», в Telegram «TG: {first_name}».

## 1. Экраны и потоки

Роутер (`App.tsx:52-61`) знает **три** экрана: `dashboard` | `question` | `results` (`Screen` в `quizStore.ts:18`). Paywall — **не роут**, а ранний return внутри `Question.tsx:175-177` при `isPaywallVisible && !isReview`.

| Экран | Компонент | Как попасть | Есть onboarding? |
|---|---|---|---|
| Старт / выбор темы | `presentation/screens/Dashboard.tsx` (540) | дефолт `currentScreen='dashboard'` | **нет** (экрана онбординга в приложении не существует) |
| Вопрос (+ прогресс) | `presentation/screens/Question.tsx` (532) | `Продолжить`, старт темы, resume, экзамен | — |
| Фидбэк | часть `Question.tsx` (explanation-блок, `AnimatePresence`) | после ответа, кроме экзамена | — |
| Paywall | `presentation/screens/Paywall.tsx` (151) | `isPaywallVisible && !isReview` | — |
| Результат / restart / continue | `presentation/screens/Results.tsx` (421) | `Завершить`, авто-финиш экзамена | — |

Потоки (streams) — ровно один активен за раз (`Question.tsx:75-76`):
`exam` > `review` (тема или «Повторить ошибки») > `regular`. У каждого свой массив ответов, они не смешиваются.

## 2. Интерактивные элементы: экран → элемент → action → эффект

### Dashboard

| Элемент (селектор) | Условие показа | Action | Эффект |
|---|---|---|---|
| h1 «LinuxExam», подзаголовок «Подготовка к RHCSA за 15 минут в день» | всегда | — | ориентир, что дашборд отрисован |
| `#status-strip`: огонь + `{streak}`, «Уровень {n}», `role=progressbar[aria-label="Прогресс уровня"]` | всегда | — | streak/XP из store (`totalXp/100 + 1`, `totalXp % 100`) |
| Кнопка темы (aria-label `Начать тему: {title}`) ×14 | `status: 'available'` (сейчас все 14) | `startTopicQuiz(key)` | `reviewQuestionIds` = перемешанные id темы, `currentScreen='question'`, `activeTopic=key`, `examActive=false` |
| Строка темы (div, бейдж «Скоро») | `status: 'planned'` (сейчас таких нет) | — | не интерактивна |
| «Повторить ошибки» + `{N} вопр.` | `wrongQuestionIds.length > 0` | `startReviewQuiz(wrongQuestionIds)` | review-стрим, `activeTopic=null` |
| `role=progressbar[aria-label="Прогресс теста"]`, текст «{answered} из 253» | всегда | — | `answered = answers.length` |
| Баннер «Тест не завершён» / «Вопрос {i} из 253» / «Продолжить» | `isQuizInProgress && !reviewQuestionIds && !examActive` | `resumeQuiz()` | `currentScreen='question'` |
| Баннер «Экзамен идёт» / «{MM:SS} осталось» / «Продолжить» | `examActive` | `navigateTo('question')` | возврат в экзамен |
| «Режим экзамена (20 вопросов, 30 минут)» | `!examActive` | `startExam(20, 1800000)` | `examActive=true`, 20 случайных id, `currentScreen='question'` |
| «Продолжить» (нижняя, крупная) | `!examActive && !isTelegram` | если есть `reviewQuestionIds` → `startRegularQuiz()`, затем `navigateTo('question')` | обычный поток |
| Telegram MainButton «Продолжить» | `isTMA()` | `navigateTo('question')` | **вне Telegram отсутствует** (хук — no-op) |
| Дисклеймер `[data-disclaimer="legal"]` | всегда | — | текст про неаффилированность |

### Question

| Элемент | Условие | Action | Эффект |
|---|---|---|---|
| Header «Назад» (aria-label `Назад`) | `currentIndex > 0 && !examActive` | `previousQuestion()` | индекс −1 (в экзамене кнопки нет) |
| Header «На главную» (aria-label `На главную`) | всегда | экзамен → модалка подтверждения; иначе `navigateTo('dashboard')` | — |
| Header center | всегда | — | `{i+1} / {total}`; в экзамене `{i+1} / 20  ·  {MM:SS}` |
| Прогресс-линия | всегда | — | `(currentIndex+1)/total` |
| h2 `{question}` | всегда | — | текст вопроса |
| 4 варианта (aria-label `Ответ {A..D}: {text}`) | всегда | `answerFn(id, originalIndex)` | запись в активный стрим; `wrongQuestionIds` add/remove; `recordQuestionStat`; `recordActivity` (streak/XP); в экзамене — без подсветки |
| Фидбэк-блок «Верно»/«Неверно» + explanation | `hasAnswered && !examActive` | — | авто-скролл к объяснению (350 мс) |
| Кнопка «Следующий вопрос» / «Завершить» / «Завершить экзамен» | `!isTelegram`, `disabled` до ответа | `nextQuestion()` / `navigateTo('results')` / `finishExam()` | — |
| Модалка «Выйти из экзамена?» + «Остаться» / «Выйти» | home в экзамене | закрыть / `cancelExam()` | «Выйти» → дашборд, экзамен сброшен |
| «Вопросы не загружены» + «К темам» | `currentQuestion == null` | `navigateTo('dashboard')` | edge-case |
| Paywall (вместо экрана) | `isPaywallVisible && !isReview` | — | см. ниже |

### Paywall

| Элемент | Условие | Action | Эффект |
|---|---|---|---|
| Header home | всегда | `hidePaywall()` + `navigateTo('dashboard')` | — |
| h2 «Бесплатные вопросы закончились» + «Вы ответили на 5 вопросов. Откройте все 253 вопроса…» + 3 буллета | всегда | — | — |
| «Купить за 490 ₽» (label stub-провайдера) | `disabled` пока `loading` | `purchase()` (stub: 500 мс, `success:true`) | `unlockPro()` → `isPro=true`, `isPaywallVisible=false`, `navigateTo('dashboard')`; при ошибке — текст ошибки |
| «Позже» | `disabled` пока `loading` | `hidePaywall()` + `navigateTo('dashboard')` | `isPro` не меняется |

### Results

| Элемент | Условие | Action | Эффект |
|---|---|---|---|
| Header home | всегда | `navigateTo('dashboard')` | — |
| h1 `Результаты` / `Результаты повторения` / `Тема: {title}` | review по `reviewQuestionIds` | — | заголовок зависит от `activeTopic` |
| Карточка счёта `{correct} / {answered}`, «Правильных из N …», «Всего в базе: 253 …», `{accuracy}%` | `hasAnyAnswers` | — | цвет % по порогам 70/40 |
| «Вы ещё не ответили ни на один вопрос» | `answered == 0` | — | пустое состояние |
| «Повторить ошибки (N)» | `!isReview && wrongQuestionIds > 0` | `startReviewQuiz(...)` | review-стрим |
| Секция «По темам»: 14 строк `{correct}/{total}` + `{percent}%` | всегда | — | счёт против **активного** стрима |
| «Пройти заново» | `!isReview` | `resetProgress()` + `navigateTo('question')` | обнуляет прогресс, **сохраняет** streak/XP |
| «К темам» | всегда | `navigateTo('dashboard')` | — |
| «Поделиться результатом» | `isTelegram && correct>0 && answered>0` | `shareResult(...)` | вне Telegram отсутствует |
| **Ветка экзамена**: h1 «Экзамен завершён», `{c}/{a}`, «Правильных ответов», `{acc}%`, «Время: M:SS» | `examLastResult !== null` | — | вытесняет всю обычную разметку |
| «Пройти заново» (экзамен) | экзамен завершён | `startExam(20, 1800000)` | новый экзамен |
| «Выйти» (экзамен) | экзамен завершён | `cancelExam()` | дашборд, `examLastResult=null` |

## 3. Логика (domain / store / data)

| Область | Правило | Где |
|---|---|---|
| Правильность | `question.options[selectedIndex].correct`; `selectedIndex` — индекс в **исходном** массиве, `optionText` — стабильная идентичность | `quizStore.ts:270-303, 429-466, 491-510` |
| Shuffle вариантов | FNV-1a(`id`) → mulberry32 Fisher-Yates; порядок детерминирован по id (без мигания) | `domain/quizService.ts:25-61`, `Question.tsx:24-27,69-72` |
| Shuffle пулов | тема и экзамен перемешиваются `Math.random` (порядок между прогонами разный) | `quizStore.ts:229-232, 471-476` |
| Счёт | `accuracy = round(correct/answered*100)`, `completion = round(answered/total*100)`; на дашборде прогресс = `answered/253` | `domain/quizService.ts:63-72`, `Dashboard.tsx:64` |
| Free-gate | `FREE_QUESTION_LIMIT = 5`; `canAccessQuestion(i) = i < 5 \|\| isPro`; paywall поднимается только для regular-потока при `nextIndex >= 5 && !isPro` | `quizStore.ts:16, 339-342, 388-390` |
| Persist | ключ `rhcsa_progress`, `version: 3`, `partialize`: answers, currentIndex, isPro, streak, lastActiveDate, totalXp, wrongQuestionIds, questionStats, reviewQuestionIds, reviewAnswers, isQuizInProgress, exam*; **НЕ персистятся**: `examLastResult`, `activeTopic`, `currentScreen`, `isPaywallVisible`, `isLoading` | `quizStore.ts:542-583` |
| Миграция | `migrate(v<2)` дефолты; v2→v3 — отложенная нормализация ответов по банку (`optionText`, иначе позиционная сверка) | `quizStore.ts:123-145, 196-204, 568-582` |
| Streak/XP | `recordActivity()`: +10 XP за **первый ответ в календарный день**, streak +1 если вчера, иначе 1 | `quizStore.ts:245-255` |
| Экзамен | 20 вопросов, 30 мин, без back, без фидбэка; таймер от `examStartedAt` (wall-clock), авто-`finishExam()` при 0; `examLastResult` — только в сессии | `quizStore.ts:469-540`, `hooks/useExamTimer.ts` |
| Данные | 253 вопроса, 14 тем (13–25 на тему), у каждого ровно **4** опции и **одно** верное, у всех есть explanation, дублей id нет | `src/data/questions/*.json`, `_topics.json` |
| Сироты | `StreakBadge.tsx`, `XpBar.tsx` не рендерятся ни одним экраном (только свои vitest) — UI-покрытие им не нужно | grep по `src/**` |
| Устаревший комментарий | `Paywall.tsx:11` говорит про «index 2», фактический лимит = 5; `Question.tsx:16` в контракте `Topic` перечислены лишь 3 темы из 14 | — |

## 4. План `data-testid` (для Фазы 2.1; сейчас НЕ добавлялись)

В `src/**` нет ни одного testid. Предлагаемый минимальный набор (**только атрибуты**, без изменения разметки/логики):

- Dashboard: `dashboard-continue`, `theme-toggle`, `topic-<key>`, `review-wrong`, `resume-banner`, `resume-button`, `exam-banner`, `exam-timer`, `exam-continue`, `start-exam`, `progress-count`.
- Header (общий): `app-header-center` (в нём счётчик `i / total` и таймер), `header-back`, `header-home`.
- Question: `question-text`, `question-progress`, `option-0..3`, `explanation`, `explanation-verdict`, `next-button`, `question-empty`, `exam-exit-confirm`, `exam-stay`, `exam-leave`.
- Paywall: `paywall`, `paywall-buy`, `paywall-later`.
- Results: `results-score`, `results-accuracy`, `results-empty`, `results-retry`, `results-topics`, `results-review-wrong`, `results-topic-<key>`, `exam-summary`, `exam-score`, `exam-accuracy`, `exam-time`, `exam-restart`, `exam-exit`.

Ключевое обоснование: имя «Продолжить» встречается до 3 раз одновременно (нижняя кнопка + баннер resume + баннер экзамена), «Выйти»/«Пройти заново» — на двух экранах, поэтому role/name-селекторы дают strict-mode violations. Testid снимает неоднозначность без правки логики.

**Открытый вопрос для капитана:** Фаза 0.3 разрешает добавить атрибуты сразу, но Фаза 0 помечена «read-only», а STOP-1 запрещает писать тесты. Предлагаю добавить testid **сразу после approve STOP-1** (одним пакетом вместе с фикстурами), чтобы не менять `src/**` до утверждения карты. Если нужно раньше — скажите, добавлю до approve.

## 5. Gaps: что НЕ покрыто `quiz-flow.spec.ts`

Уже покрыто (переписывать нельзя): полный прогон 5 вопросов до paywall/результатов; клик по теме `file_permissions` + счётчик; 7 тестов темы (inherit/manual/legacy/computed-цвета); первый review-вопрос без «Назад»; review-результаты («Тема: Права доступа», счёт, нет «Пройти заново»); завершённый экзамен через реальный авто-финиш; B1 — свободный проход дальше лимита внутри темы. `color-regression.spec.ts` — success-border в 2 темах.

Не покрыто:
1. **13 из 14 тем** — проверена только `file_permissions`.
2. **Dashboard целиком**: 14 строк тем и их счётчики `{n} вопр.`, «14 из 14 тем», прогресс «{answered} из 253», streak/XP-полоса, дисклеймер, баннер resume, баннер экзамена с таймером, кнопка «Повторить ошибки» на дашборде.
3. **Question-механика**: фидбэк «Верно»/«Неверно» и текст explanation, подсветка правильного варианта, `disabled` вариантов после ответа (нельзя переотвечать), лейблы next-кнопки (3 варианта), «Назад» в обычном потоке, прогресс-линия, пустое состояние «Вопросы не загружены».
4. **Экзамен**: отсутствие фидбэка и подсветки, счётчик `i / 20 · MM:SS`, модалка «Выйти из экзамена?» («Остаться» остаётся, «Выйти» → дашборд и сброс), «Пройти заново» из summary.
5. **Paywall-пути**: «Позже» → дашборд (isPro не меняется), покупка stub → `isPro=true` → дашборд → дальше 6-й вопрос доступен.
6. **Results**: разбивка «По темам», «Пройти заново» (сброс прогресса, сохранение streak/XP), «К темам», «Повторить ошибки» из результатов, пустое состояние «Вы ещё не ответили ни на один вопрос».
7. **Persist/restart**: reload посреди прогона (восстановление экрана/индекса/ответов), баннер resume после reload, нормализация ответов по банку.
8. **Streak/XP**: +10 XP и streak=1 за первый день, видимые в status-strip.
9. **Browser-режим**: DEV-бейдж «Web mode», отсутствие «Поделиться результатом» (Telegram-ветка).

## 6. Сценарии (группы по 3–5; один `test` = один сценарий)

**G1. Dashboard — happy path и статус (4):**
1. старт: h1 «LinuxExam», «Программа RHCSA», «14 из 14 тем», 14 кнопок тем с aria-label; 2. счётчики тем соответствуют `_topics.json` (253 суммарно, 13–25 на тему); 3. прогресс «0 из 253» и пустая полоса на чистом профиле; 4. дисклеймер `[data-disclaimer="legal"]` виден.

**G2. Темы — все 14 (4):** для каждой из 14 тем отдельный тест (сгенерированы из `src/data/topics.ts`, не хардкод): клик → счётчик `1 / {размер темы}` и вопрос отрисован; отдельный тест на то, что старт темы сбрасывает позицию (клик по теме B после темы A даёт `1 / {B}`).

**G3. Question — фидбэк и навигация (5):** 1. выбор варианта → «Верно»/«Неверно» + explanation; 2. после ответа все 4 варианта `disabled` (переотвечать нельзя); 3. «Следующий вопрос» → `2 / N`, «Назад» возвращает на `1 / N`; 4. на первом вопросе «Назад» отсутствует; 5. на последнем вопросе лейбл «Завершить» → Results.

**G4. Типы вопросов / детерминизм отображения (3):** 1. у каждого вопроса ровно 4 варианта с aria-label `A..D` (проверка на нескольких темах); 2. порядок вариантов не меняется при повторном открытии того же вопроса (без перезагрузки и после неё) — фиксируем только стабильность, **не** конкретную перестановку; 3. explanation непустой и отображается после ответа.

**G5. Free-gate / paywall (4):** 1. на 5-м вопросе regular-потока paywall появляется при попытке идти дальше; 2. «Позже» → дашборд, `isPro` не изменился (повторный вход снова упирается в лимит); 3. покупка stub → дашборд, 6-й вопрос доступен; 4. экзамен не пейволится (экзамен идёт за лимит без paywall). *Тупиковое «INTENDED»-поведение (индекс не растёт, paywall возвращается) отдельно не пинним — см. §7.*

**G6. Повторение ошибок (3):** 1. после неверного ответа на дашборде появляется «Повторить ошибки»; 2. запуск → заголовок «Результаты повторения», нет «Пройти заново»; 3. верный ответ в review убирает вопрос из `wrongQuestionIds` (кнопка исчезает).

**G7. Экзамен (5):** 1. старт (20 вопросов, 30 минут) → счётчик `1 / 20`; 2. ответ в экзамене не даёт фидбэка и не подсвечивает правильность; 3. «Назад» в экзамене отсутствует; 4. home → модалка: «Остаться» остаётся в вопросе, «Выйти» → дашборд и экзамен сброшен; 5. авто-финиш по истёкшему таймеру → summary «Экзамен завершён» со счётом, «Пройти заново» и «Выйти».

**G8. Persist / restart (4):** 1. reload посреди regular-прогона восстанавливает экран, индекс и ответы (фидбэк на месте); 2. reload на дашборде после ответов показывает баннер «Тест не завершён» с «Вопрос {i} из 253»; 3. «Пройти заново» из Results обнуляет прогресс, но сохраняет streak/XP; 4. `partialize`: после reload `examLastResult` не восстанавливается (summary не всплывает), `activeTopic` сбрасывается.

**G9. Результаты — разбивка и переходы (4):** 1. «По темам»: 14 строк, у отвеченной темы `{c}/{total}`, у остальных `0/{total}`; 2. accuracy-цвет по порогам 70/40; 3. «К темам» → дашборд; 4. пустое состояние «Вы ещё не ответили ни на один вопрос» (вход в Results без ответов).

**G10. Streak / XP и режим браузера (3):** 1. первый ответ за день → streak=1 и «Уровень 1», после 10 ответов в тот же день XP не растёт сверх 10 (один день = +10); 2. DEV-бейдж «Web mode» вне Telegram; 3. «Поделиться результатом» в браузерном режиме отсутствует.

Итого: 10 групп, 39 сценариев. Файлы по группам: `e2e/dashboard.spec.ts`, `e2e/topics.spec.ts`, `e2e/question.spec.ts`, `e2e/question-types.spec.ts`, `e2e/paywall.spec.ts`, `e2e/review.spec.ts`, `e2e/exam.spec.ts`, `e2e/persist.spec.ts`, `e2e/results.spec.ts`, `e2e/mode-streak.spec.ts` + `e2e/fixtures.ts`.

## 7. НЕ тестировать (явные исключения)

- **paywall INTENDED-поведение** — замороженный в `Paywall.tsx:9-14` сценарий (индекс не растёт, paywall возвращается на следующем клике) отдельными тестами не пинним: покрываются только видимость, «Позже» и покупка (G5). Если капитан хочет пиннить и его — добавлю 1 тест.
- **shuffle-детерминизм** — конкретная перестановка вариантов/пулов не проверяется (G4 фиксирует только стабильность между рендерами).
- **a11y** — axe/jest-axe остаётся в vitest (`src/**/__tests__/*.a11y.test.tsx`), в E2E не дублируется.
- **Telegram API** — MainButton/BackButton/haptics/shareURL/viewport не тестируются; проверяется только браузерная ветка (отсутствие этих аффектансов).
- Правки `src/**` сверх `data-testid` — не делаются; при обнаружении реального бага приложения — STOP и отчёт (по контракту Фазы 3.3).
