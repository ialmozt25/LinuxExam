---
id: 052
slug: fsrs-lite
status: done
type: feature
track: full
created: 2026-10-03
updated: 2026-10-03
commit: 31b9940
embedded_approve: rule 2 (F5.0a — approved по заданию капитана 2026-10-03);
  rule 17 — type:feature всегда Full; rule 6 не применяется
---

## Контекст
LinuxExam — квиз: пользователь сам выбирает тему, сам решает что повторять.
Retention падает (80% забывается за неделю), люди бросают. Нужна spaced
repetition (FSRS-lite): Dashboard показывает «сегодня к повторению N вопросов».
Это первый шаг к FSRS-lite: сохраняем расписание повторений в persist-состоянии
и показываем на Dashboard одну кнопку для сегодняшнего прогона. Пользователь
по-прежнему выбирает тему сам; алгоритм только предлагает, что пора повторить.
Отбор идёт по сохранённому расписанию; банк вопросов остаётся в src/data/** без
изменений. Прогон повторения не расходует бесплатный лимит обычного потока.

## Цель
Кнопка «Повторить сегодня (N)» → прогон ровно тех вопросов, которые пора повторить.
N из упрощённого FSRS (базисные интервалы 1/3/7/14/30/60 дней).
Покрытие: `src/domain/fsrs.ts`, `src/store/quizStore.ts`,
`src/presentation/screens/Dashboard.tsx`, `e2e/fsrs.spec.ts` — N вопросов из банка 253
при пустой истории.

## Что делаем

### Компонент 1 — src/domain/fsrs.ts (чистые функции, без store/react)

- `nextInterval(stabilityDays: number, difficultyScore: number, grade: 'Good' | 'Again')`
  возвращает `{ next: number; stabilityDays: number; difficultyScore: number }`.
  `next` — epoch ms и берётся из сетки {1, 3, 7, 14, 30, 60} дней, максимум сетки — 60 дней.
- `scheduleReview(stat: QuestionStat, grade: 'Good' | 'Again') → ReviewRecord`
  возвращает запись расписания `{ next, stability, difficulty }` для одного вопроса.
- `pickToday(scheduled: Record<string, ReviewRecord>, all: Question[], now: number)`
  возвращает `string[]` — qid, у которых нет записи в `scheduled` (считаются
  «пора сейчас») либо `next <= now`; qid вне банка `all` не попадают в результат;
  пустой банк даёт пустой список без деления на ноль.
- `history` — это попытки одного вопроса `questionStats[qid]`
  (поле `attempts`, `correct`, `lastAt`), а не отдельный список ответов;
  `history = questionStats[qid]`, `now` — epoch ms.
- Оценки: индекс шага сетки = f(stability, difficulty, grade);
  `grade: correct → Good, incorrect → Again`; `stability ∈ [0.1,365]`,
  `difficulty ∈ [0,1]` — это нормированная шкала спеки (прокси), а не шкала
  FSRS [1,10]; после пересчёта оба поля clamp-ятся к своим границам.
- Шкалы не путать: поле `difficulty` модели Question — статическая сложность
  вопроса из банка, а `difficultyScore` — оценка расписания. Отображение шкал:
  `difficultyScore = (D_fsrs − 1) / 9` при `D_fsrs ∈ [1,10]`, обратное —
  `D_fsrs = 1 + 9 · difficultyScore`.
- `ReviewRecord = { next: number; stability: number; difficulty: number }` —
  тип записи расписания; поля записи хранят шкалу спеки (`difficulty` —
  `difficultyScore`, `stability` — дни).
- Unit-кейс: `nextInterval` на `grade = Good` даёт ровно 1, 3, 7, 14, 30, 60 дней
  на последовательных повторениях.
- Unit-кейсы `pickToday` с фиксированными expected: `pickToday([], [], now)` → `[]`;
  `pickToday({}, [q1, q2, q3], now)` → `[q1, q2, q3]`;
  `pickToday({ q1: { next: now - 1 } }, [q1], now)` → `[q1]`;
  `pickToday({ q1: { next: now + 1 } }, [q1], now)` → `[]`.

### Компонент 2 — src/store/quizStore.ts (persist v3 → v4)

- `+ scheduledReviews: { [qid]: {next, stability, difficulty} }` — реестр
  расписания в persist-состоянии; версия persist поднимается до 4.
- `scheduledReviews` вносится в `partialize` persist-конфига: расписание
  переживает reload; после перезагрузки запись сохраняется и N не растёт.
- Миграция v3→v4 создаёт пустой `scheduledReviews` и не наполняет реестр:
  банк на момент миграции ещё пуст, загрузка `loadQuestions` идёт позже.
  Наполнение идёт при вычислении: отсутствие записи для qid означает «пора
  сейчас», поэтому первый запуск не даёт 0. Банк передаётся аргументом `all`;
  в миграции банк не нужен.
- `getTodayReview()` возвращает id, где `next <= now` или записи нет.
- Путь записи ответа: review-прогон вызывает `answerReview`, он вызывает
  `scheduleReview` с `grade = correct ? Good : Again` и пишет обновлённую
  запись `{next, stability, difficulty}` в `scheduledReviews`; после ответа
  `next > now`, поэтому вопрос выходит из N.
- Обычный поток (`answerQuestion`) и экзамен (`answerExam`) на `N` не влияют —
  расписание пишет только `answerReview`.
- Из persisted-состояния ничего не удаляется: drop записей идёт только при
  вычислении `getTodayReview`.

### Контракт наполнения `scheduledReviews` (ADV-601)

- objective: отсутствующая запись qid трактуется как «пора сейчас» при вычислении
  (`getTodayReview`/`pickToday(scheduled, all, now)`); банк приходит аргументом `all`,
  в `migrate` банк не нужен.
- acceptance: при пустом `scheduledReviews` и загруженном банке N = число вопросов банка;
  повторный вызов `migrate(stateV4, 3)` записей не создаёт и не дублирует, N не меняется;
  после reload (persist v4) запись `scheduledReviews` сохраняется, N не растёт.
- verify: `npm run test:run` — unit-кейсы «пустая история → N = банк» и «миграция идемпотентна»
  в `src/domain/__tests__/fsrs.test.ts`.
- inScope: `src/store/quizStore.ts`, `src/domain/fsrs.ts`.

### Компонент 3 — src/presentation/screens/Dashboard.tsx

- кнопка review-today (`data-testid="review-today"`), скрыта если N=0;
  клик → прогон N вопросов.
- N — длина `getTodayReview()`; текст кнопки — «Повторить сегодня (N)».
- кнопка «Повторить ошибки» (`data-testid="review-wrong"`) остаётся отдельным
  элементом для `wrongQuestionIds` обычного потока: их количество не входит
  в N и видимость review-today не меняет. Ответы обоих review-прогонов идут
  через `startReviewQuiz` → `answerReview` и пишут `scheduledReviews`.

### Компонент 4 — Тесты

- Unit: src/domain/__tests__/fsrs.test.ts; E2E: e2e/fsrs.spec.ts.
- E2E изолирован: отдельный browser context на кейс либо последовательный
  режим Playwright (test.describe.serial), состояние localStorage засевается
  перед прогоном, чтобы общий Vite-сервер (playwright.config.ts,
  reuseExistingServer) не смешивал прогоны.
- E2E засевает полный реестр по всем 253 qid: две записи `scheduledReviews`
  с `next <= now` и 251 запись с `next` в будущем ⇒ N = 2 (неполный реестр дал бы
  N > 2, потому что отсутствующая запись считается «пора сейчас»).

## Критерии приёмки
1. `src/domain/fsrs.ts` (t1) — только чистые функции (нет импортов store/react).
2. `src/store/quizStore.ts` (t2) — persist v3→v4: старая история сохраняется; миграция идемпотентна.
3. `src/presentation/screens/Dashboard.tsx` (t3) — показывает N или скрывает кнопку (N=0).
4. `src/domain/__tests__/fsrs.test.ts` и `e2e/fsrs.spec.ts` (t1, t4) — после ответа N пересчитывается.
5. `npm run test:run` exit 0 (198 + новые).
6. `e2e/fsrs.spec.ts` — `npm run test:e2e` exit 0.
7. `npm run typecheck` 0; `npm run sync:check` 0 (после коммита Части 1).

## Что НЕ трогать
src/data/** (банк 253), shuffleOptions, существующие 198 тестов (28 файлов),
.project/ORCH-RULES.md, .project/scripts/**, .project/sync.mjs

## Декомпозиция
1. `id: t1` `subject: src/domain/fsrs.ts — чистые функции FSRS-lite (nextInterval, scheduleReview, pickToday) и unit-тесты src/domain/__tests__/fsrs.test.ts` `assignee: builder` `dependencies: []`
2. `id: t2` `subject: src/store/quizStore.ts — persist v3 → v4, scheduledReviews в partialize (расписание переживает reload), миграция v3→v4, getTodayReview` `assignee: builder` `dependencies: [t1]`
3. `id: t3` `subject: src/presentation/screens/Dashboard.tsx — кнопка review-today (data-testid review-today), скрыта при N=0` `assignee: builder` `dependencies: [t2]`
4. `id: t4` `subject: e2e/fsrs.spec.ts — e2e прогон: открыть, пройти N, N обновилось` `assignee: builder` `dependencies: [t3]`
5. `id: t5` `subject: review — приёмка критериев 1–7` `assignee: reviewer` `dependencies: [t1, t2, t3, t4]`

Write-скоупы (без пересечений по писателю):

- t1 → `src/domain/fsrs.ts`, `src/domain/__tests__/fsrs.test.ts`
- t2 → `src/store/quizStore.ts`
- t3 → `src/presentation/screens/Dashboard.tsx`
- t4 → `e2e/fsrs.spec.ts`
- t5 → без правок

## Edge Cases
- Пустая история → N = банк: пустого реестра достаточно, чтобы `pickToday` вернул
  все существующие qid, банк в `migrate` не нужен
- Банк приходит асинхронно: до `loadQuestions` банк пуст → N = 0, после первой
  загрузки банка N = число вопросов
- Все верные много раз → интервалы растут, N → 0
- Много неверных → stability падает, next = завтра
- Битый scheduledReviews: чужой id, в т.ч. qid вопроса, удалённого из банка →
  drop записи при вычислении, persisted-состояние не чистится; N считает только
  существующие вопросы, не падать
- v3 → v4: старая история сохраняется, `scheduledReviews` создаётся пустым
- stability/difficulty после пересчёта вне [0.1,365] / [0,1], а также NaN →
  clamp к ближней границе, запись не выбрасывается (только при валидном next)
  [enriched: https://github.com/open-spaced-repetition/awesome-fsrs/wiki/The-Algorithm|Tier 1|2026-10-03]
- scheduledReviews с невалидным next (null, NaN, строка) → drop записи; миграция
  и getTodayReview не падают, потому что persist не проверяет форму JSON
  [enriched: https://zustand.docs.pmnd.rs/reference/middlewares/persist|Tier 1|2026-10-03]
- просроченный next (next много меньше now) → вопрос входит в N ровно один раз
  и не теряется
  [enriched: https://raw.githubusercontent.com/open-spaced-repetition/fsrs4anki/main/docs/tutorial.md|Tier 1|2026-10-03]
- банк пуст (0 вопросов) → N = 0, кнопка скрыта, деления на ноль нет:
  `pickToday([], [], now)` → `[]`, пустой банк даёт пустой список и не делится на ноль
  [enriched: https://docs.ankiweb.net/deck-options.html#fsrs|Tier 1|2026-10-03]
- повторный прогон миграции v3→v4 на состоянии v4 → no-op; прямой вызов
  `migrate(stateV4, 3)` не дублирует записи, потому что миграция — чистая функция
  и не наполняет `scheduledReviews`
  [enriched: https://zustand.docs.pmnd.rs/reference/middlewares/persist|Tier 1|2026-10-03]
- stability = 365 (верхняя граница) → следующий Good не переводит next за 365 дней
  (максимум сетки — 60 дней, next его не превышает)
- `grade = Good` на последовательных повторениях даёт ровно 1, 3, 7, 14, 30, 60 дней
  (ожидаемые значения зафиксированы unit-кейсом «Компонента 1»)
- Сид малого N (e2e): полный реестр по всем 253 qid — 2 записи с `next <= now`
  и 251 запись с `next` в будущем → N = 2; после ответа на один вопрос N = 1;
  после второго ответа N = 0, кнопка review-today скрыта.
- Две вкладки одной сессии: persist не подписан на `storage` event, поэтому
  `scheduledReviews` одной вкладки не виден другой; каждая вкладка считает N по
  своей копии состояния, при записи выигрывает последняя — расхождение вкладок
  не считается падением, потеря расписания другой вкладки не откатывается
  [enriched: https://developer.mozilla.org/en-US/docs/Web/API/Window/storage_event|Tier 1|2026-10-03]
- e2e-кейсы не делят состояние: Playwright заводит отдельный BrowserContext
  (свой localStorage) на каждый тест, поэтому сид расписания одного кейса не
  протекает в другой даже на общем Vite-сервере
  [enriched: https://playwright.dev/docs/browser-contexts|Tier 1|2026-10-03]

### Контракт записи ответа (ADV-602)

- objective: review-прогон отвечает через `answerReview(qid, selectedIndex)`; он вызывает
  `scheduleReview` с `grade = correct ? Good : Again` и пишет обновлённую запись
  `{next, stability, difficulty}` в `scheduledReviews[qid]`.
- acceptance: после `answerReview` для qid `scheduledReviews[qid].next > now` и N уменьшается
  на 1; `answerQuestion` и `answerExam` расписание не меняют.
- verify: `npm run test:run` — unit-кейс «после answerReview N уменьшилось» и e2e
  `e2e/fsrs.spec.ts` (сид полного реестра: 2 due + 251 в будущем ⇒ N = 2 → 1 → кнопка скрыта).
- inScope: `src/store/quizStore.ts`, `src/presentation/screens/Dashboard.tsx`.

## Источники
Локальные: src/store/quizStore.ts (persist v3), src/domain/** (паттерн чистых
функций), spec 047/051 (frontmatter, автономия).

Внешние (Tier 1–2, дата обращения 2026-10-03):
- FSRS: DSR-модель, difficulty ∈ [1,10], stability = интервал при R = 90%,
  оценки again/hard/good/easy.
  https://github.com/open-spaced-repetition/awesome-fsrs/wiki/The-Algorithm
- Anki Manual, Deck Options → FSRS: desired retention, интервалы короче суток,
  максимум интервала.
  https://docs.ankiweb.net/deck-options.html#fsrs
- FSRS4Anki tutorial: Again = fail, Hard/Good/Easy = pass, пересчёт при
  просрочке.
  https://raw.githubusercontent.com/open-spaced-repetition/fsrs4anki/main/docs/tutorial.md
- ts-fsrs: референсная реализация FSRS на TypeScript, четыре исхода ответа.
  https://raw.githubusercontent.com/open-spaced-repetition/ts-fsrs/main/packages/fsrs/README.md
- Zustand persist: version/migrate, отсутствие runtime-валидации JSON.
  https://zustand.docs.pmnd.rs/reference/middlewares/persist
- Murre & Dros 2015, PLOS ONE: воспроизведение кривой забывания Эббингауса.
  https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0120644
- Smolen, Zhang, Byrne 2016, «The right time to learn: mechanisms and
  optimization of spaced learning», Nature Reviews Neuroscience 17(2):77-88:
  превосходство распределённого повторения над массовым.
  https://arxiv.org/abs/1606.08370 (перепроверка 2026-10-03: HTTP 200, заголовок,
  авторы и журнал подтверждены; дополняет Murre & Dros 2015)
- SSP-MMC: официальная реализация алгоритма из KDD'22 (DHP-модель).
  https://github.com/maimemo/SSP-MMC
- Playwright, Isolation: каждый тест исполняется в своём BrowserContext с
  собственными localStorage/sessionStorage/cookies; контекст создаётся на тест
  по умолчанию.
  https://playwright.dev/docs/browser-contexts
- MDN, Window: storage event: событие изменения localStorage приходит только в
  другие вкладки того же origin, вкладка-инициатор его не получает.
  https://developer.mozilla.org/en-US/docs/Web/API/Window/storage_event

## Открытые вопросы
1. Базисные интервалы против вычисляемого интервала FSRS.
   Тезис спеки (Цель): интервалы 1/3/7/14/30/60 дней.
   Тезис источника: FSRS вычисляет следующий интервал из stability и requested
   retention, I(r,S) = S/FACTOR · (r^(1/DECAY) − 1), а не берёт его из
   фиксированной сетки.
   Источник: tier 1, 2026-10-03:
   https://github.com/open-spaced-repetition/awesome-fsrs/wiki/The-Algorithm
   Почему конфликт: сетка не воспроизводит поведение FSRS; первый интервал Good
   у FSRS может быть около недели, а не 1 день (Anki Manual, FAQ Q6).
   Вариант A: оставить сетку и назвать её «интервалы-ориентиры FSRS-lite», явно
   отказавшись от совместимости с FSRS.
   Вариант B: считать next из stability по формуле FSRS, сетку оставить только
   как fallback без сохранённой stability.
   Пометка: требует approve капитана (правка формулировки Цели).
2. Шкала difficulty.
   Тезис спеки («Что делаем», п. 1): difficulty ∈ [0,1].
   Тезис источника: difficulty в FSRS определена и ограничена на [1,10].
   Источник: tier 1, 2026-10-03:
   https://github.com/open-spaced-repetition/awesome-fsrs/wiki/The-Algorithm
   Почему конфликт: без формулы отображения D_spec = (D_fsrs − 1)/9 результаты
   nextInterval не совпадают с FSRS.
   Вариант A: оставить [0,1] и зафиксировать формулу отображения в fsrs.ts.
   Вариант B: перейти на [1,10] как в FSRS и обновить clamp.
   Пометка: требует approve капитана (затрагивает Критерий приёмки 1 и задачу t1).
3. Число «80% забывается за неделю».
   Тезис спеки (Контекст): 80% забывается за неделю.
   Тезис источника: кривая забывания круто падает в первые сутки, но доля
   забытого зависит от материала и способа измерения; воспроизведение
   Эббингауса охватывает интервалы до 31 дня, а не «80% за неделю».
   Источник: tier 1, 2026-10-03:
   https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0120644
   Почему конфликт: число не подтверждается источником Tier 1 на этом прогоне и
   выглядит иллюстративным.
   Вариант A: заменить на качественную формулировку без числа.
   Вариант B: оставить число как рабочую оценку и пометить его как оценку.
   Пометка: требует approve капитана (правка «Контекста»).
4. UNVERIFIABLE (Фаза 3, 2026-10-03): фактические гейты `npm run test:run`
   (exit 0, «198 + новые») и `npm run sync:check` в песочнице прогона не
   исполняются — vitest/esbuild падает на `spawn EPERM` (errno −4048), sync.mjs —
   на `spawnSync git EPERM`; расширение прав отклонено (нет канала approve).
   Статика на этом прогоне: 25 тест-файлов под src/**, 147 объявлений it/test,
   `.each`-таблиц 0; прежние «28 файлов / 198 тестов» (.project/log.md:227) —
   гейт до spec 048, загрязнённый e2e и drafts (исключены в vitest.config.ts,
   коммит 3aaa494). Нужен прогон гейтов на стенде; «ок по умолчанию» не ставится.
   Перепроверка Фазы 5 (2026-10-03): `npm run typecheck` → exit 0; `npm run test:run`
   → снова `spawn EPERM` (errno −4048), exit 1; статус UNVERIFIABLE сохраняется.
5. Противоречие путей Dashboard (Фаза 5, 2026-10-03).
   Тезис спеки («## Цель», Критерий приёмки 3, write-скоуп t3):
   `src/presentation/Dashboard.tsx`.
   Тезис спеки («Что делаем», Компонент 3; subject t3) и факт репозитория:
   `src/presentation/screens/Dashboard.tsx` (Test-Path → True, исходный путь — False).
   Почему конфликт: один deliverable t3 назван двумя путями; исполнение по
   write-скоупу t3 создаст второй экран, который никто не рендерит.
   Вариант A: заменить путь в Цели, Критерии 3 и write-скоупе t3 на
   `src/presentation/screens/Dashboard.tsx`.
   Вариант B: считать deliverable t3 существующим экраном — write-скоуп t3 всё
   равно правится.
   Пометка: требует approve капитана (правка Цели, Критерия приёмки и
   write-скоупа — вне прав фаз).
6. Число существующих тестов (Фаза 5, 2026-10-03).
   Тезис спеки (Критерий приёмки 5): `npm run test:run` exit 0 («198 + новые»).
   Тезис спеки («Что НЕ трогать», «Открытые вопросы» п. 4): 147 тестов
   (25 файлов, набор после исключения e2e).
   Факт репозитория: 25 тест-файлов, 147 объявлений it/test; 198 — гейт до
   spec 048 (.project/log.md:227).
   Почему конфликт: критерий требует базу 198 при фактических 147 — спека
   противоречит сама себе.
   Вариант A: заменить «198 + новые» на «147 + новые».
   Вариант B: оставить 198 и признать базу исторической.
   Пометка: требует approve капитана (Критерий приёмки 5 защищён от правок фаз).
7. Ссылка «после коммита Части 1» (Критерий приёмки 7).
   Тезис спеки: `npm run sync:check` 0 «после коммита Части 1».
   Факт: понятие «Часть 1» в спеке не определено — декомпозиция состоит из
   задач t1–t5, разделов «Части» нет.
   Почему конфликт: критерий ссылается на несуществующий раздел/id; момент
   запуска гейта не устанавливается.
   Вариант A: заменить на «после коммита задач t1–t3».
   Вариант B: требовать sync:check 0 на финальном коммите спеки.
   Пометка: требует approve капитана (Критерий приёмки 7 защищён).

## Проверка
- npm run typecheck (0); npm run test:run (0); npm run test:e2e (0); npm run sync:check (0)
- В песочнице прогона гейты test:run / test:e2e / sync:check остаются UNVERIFIABLE
  (см. «Открытые вопросы» п. 4); «ок по умолчанию» не ставится, прогон нужен на стенде.
- Критерий 1 — статическая проверка: в `src/domain/fsrs.ts` нет импортов zustand/react.
- Критерий 3 — `data-testid="review-today"` в `src/presentation/screens/Dashboard.tsx`
  плюс e2e-сценарий R4 из `e2e/fsrs.spec.ts`.
- Критерий 4 — положительный путь: сценарий с N > 0, а не только N = 0.
- Фаза 9 не правит «Цель», «Критерии приёмки» и write-скоупы; дефекты
  F3-01, F3-02, SIM-701, SIM-707, SIM-711 останавливают цикл правок и уходят
  капитану как решение (эскалация, а не правка).

## История обогащения спеки
- Фаза 0 — baseline score и пять измерений (Completeness, Clarity, Testability,
  Consistency, Scope).
- Фаза 1 — пятнадцать механических проверок спеки (m01–m15).
- Фаза 2 — research: tiered-источники и маркеры `[enriched: …]` в Edge Cases.
- Фаза 3 — fact-check: сверка утверждений спеки с репозиторием и источниками.
- Фаза 4 — traceability: Цель → Критерий приёмки → задача декомпозиции.
- Фаза 5 — семантика: противоречия, дубликаты, vague terms.
- Фаза 6 — adversarial: находки по исполчимости и границам скоупа.
- Фаза 7 — simulation: прогон задач t1–t5 и edge cases по тексту спеки.
- Фаза 8 — слепая регенерация плана и сравнение с декомпозицией.
- Фаза 9 — repair loop: правки вне защищённых секций «Цель» и «Критерии приёмки».
- Фаза 10 — external audit: вердикт INTENT-PRESERVED либо INTENT-CHANGED.
- Фаза 5 (повторный прогон 2026-10-03): 4 семантические правки вне защищённых
  секций — слиты дубли edge cases «pickToday([], [], now)»/«банк пуст» и
  «stability = 365»/«grade = Good», сняты устаревшие номера строк в ссылках
  «Открытых вопросов» пп. 5–7; «## Цель» и «## Критерии приёмки» побайтово не
  изменены (0 intent-blocked); противоречия ОВ-1…ОВ-3 и ОВ-5…ОВ-7 остаются
  решениями капитана; `npm run typecheck` → exit 0, `npm run test:run` → снова
  `spawn EPERM` (errno −4048), UNVERIFIABLE сохраняется; артефакт
  `.project/drafts/spec-052-enrich/phase-5-semantics.md`.
