---
id: 068
slug: remove-legacy-exam
type: fix
track: full
status: approved
created: 2026-10-04
updated: 2026-10-04
commit: null
embedded_approve: rule 2 (F5.0a — 2026-10-04)
execution: direct
---

## Контекст

В приложении **два экзаменационных режима**, и после spec 054 второй остался
нетронутым намеренно:

1. **Новый Exam mode (spec 054, Pro-only по spec 063)** — три экрана
   `ExamSetup → ExamRun → ExamResults`, пресеты 30/60/90, порог 70 %, разбор по
   темам. Состояние — `examSession` (session-only), экшены —
   `startExamSession / submitExamAnswer / nextExamQuestion / finishExamSession /
   cancelExamSession`. Вход — кнопка `exam-mode` на Dashboard.
2. **Исторический инлайн-экзамен** — 20 вопросов / 30 минут, живёт **внутри**
   обычного экрана вопросов через флаг `examActive`; итог — сводка
   `exam-summary` внутри экрана `Results` (`currentScreen === 'results'`).
   Вход — вторая кнопка на Dashboard (`start-exam`).

Два режима конкурируют за один и тот же ответ пользователя «Режим экзамена»:
на Dashboard стоят две разные кнопки, одна из них (20/30) не имеет ни пресетов,
ни разбора по темам, ни порога сдачи.

**Решение капитана (вариант A):** старый инлайн-экзамен удаляется **полностью**.
Новый остаётся **единственным** и **Pro-only** (spec 063). Free-юзер сохраняет:
3 темы + обычный квиз + FSRS-повторение + streak + trial 7 дней.

## PRE-CHECK (read-only, факты)

`Test-Path .project/specs/068-remove-legacy-exam.md` → **False** (спека новая).
`git rev-parse origin/main` → `848911f05a70c34b7015fc89da2903e7172b4da6`.
`git rev-list --left-right --count origin/main...HEAD` → `0  8` (origin/main
актуален, локально ahead 8).

### Legacy-точки (file:line)

| Слой | Точка | Строки |
|---|---|---|
| store | `examActive` (поле + дефолт) | `quizStore.ts:148, 337` |
| store | `examLastResult` (поле + дефолт) | `quizStore.ts:149-154, 338` |
| store | `examStartedAt / examDurationMs` | `quizStore.ts:155-156, 339-340` |
| store | `examQuestionIds / examAnswers` | `quizStore.ts:157-158, 341-342` |
| store | `startExam` (объявление + реализация) | `quizStore.ts:234, 744-760` |
| store | `answerExam` (объявление + реализация) | `quizStore.ts:235, 763-782` |
| store | `finishExam` (объявление + реализация) | `quizStore.ts:236, 784-799` |
| store | `cancelExam` (объявление + реализация) | `quizStore.ts:237, 801-812` |
| store | ветки `examActive` в `nextQuestion` / `previousQuestion` | `quizStore.ts:508, 524-525, 538, 546-548` |
| store | сброс полей в `startTopicQuiz` / `startRegularQuiz` / `resetProgress` | `quizStore.ts:399, 418-419, 573-578` |
| store | выравнивание `examAnswers` к банку | `quizStore.ts:377, 382` |
| store | `partialize` (5 legacy-полей) | `quizStore.ts:944-948` |
| store | комментарии про «исторический» режим | `quizStore.ts:146-147, 160-162, 816` |
| screen | `Question.tsx`: селекторы и ветки `examActive` | `Question.tsx:33-38, 56, 75-76, 86, 91, 212, 219, 229-232, 295, 300, 377` |
| screen | `Question.tsx`: модалка выхода из экзамена | `Question.tsx:475-559` (`exam-confirm`, `exam-stay`, `exam-leave`) |
| screen | `Dashboard.tsx`: баннер идущего экзамена | `Dashboard.tsx:130, 747-793` (`exam-banner`, `exam-timer`, `exam-continue`) |
| screen | `Dashboard.tsx`: кнопка «Режим экзамена (20 вопросов, 30 минут)» | `Dashboard.tsx:132, 844-865` (`start-exam`) |
| screen | `Dashboard.tsx`: гейт `!examActive` у `dashboard-continue` | `Dashboard.tsx:871` |
| screen | `Results.tsx`: ветка-сводка экзамена | `Results.tsx:23-25, 117-227` (`exam-summary`, `exam-score`, `exam-accuracy`, `exam-time`, `exam-restart`, `exam-exit`) |
| hook | `useExamTimer` — целиком legacy | `src/hooks/useExamTimer.ts:1-42` |

### `examLastResult` — решение: **удалить**

Использование: `Results.tsx:23, 117`, `quizStore.ts` (запись в `finishExam`),
ноль ссылок в `ExamResults.tsx`/`ExamRun.tsx`/`ExamSetup.tsx`. Новый режим
хранит итог в `examSession` и считает его через `getExamResult()`. Значит
`examLastResult` — **только старый** путь; вместе с ним удаляется и legacy-ветка
сводки в `Results.tsx` (см. «Отклонение О1»).

### `useExamTimer` — решение: **удалить**

Потребители: `Question.tsx:10, 48` и `Dashboard.tsx:13, 210` — оба legacy.
`ExamRun.tsx` считает таймер сам (`ExamRun.tsx:32-52`, `formatRemaining` из
`domain/exam.ts`), поэтому хук не shared и уходит целиком.

### Legacy-файлы

Отдельных файлов legacy-экранов **нет**: старая логика вшита в `Question.tsx`,
`Dashboard.tsx`, `Results.tsx` и `quizStore.ts`. `ExamInline.tsx` / `Quiz.tsx`
в репозитории отсутствуют. Удаляются целиком только
`src/hooks/useExamTimer.ts` и `src/store/__tests__/reset-progress.test.ts`
(см. «Что делаем», У5/К3).

### E2E-зависимости старого экзамена (file:line → что проверяет)

| Файл:строка | Что проверяет | Судьба |
|---|---|---|
| `e2e/dashboard.spec.ts:72` | текст кнопки «Режим экзамена (20 вопросов, 30 минут)» | переписать на `exam-mode` (У4.1) |
| `e2e/dashboard.spec.ts:119` | dashboard готов после `header-home` (якорь — `start-exam`) | якорь → `dashboard-continue` |
| `e2e/results.spec.ts:95` | «К темам» вернул на Dashboard (якорь — `start-exam`) | якорь → `dashboard-continue` |
| `e2e/paywall.spec.ts:152-186` | экзамен 20 вопросов не упирается в paywall, обратной связи нет | переписать на новый прогон (У4.2) |
| `e2e/quiz-flow.spec.ts:539-586` | завершённый экзамен рисует свою сводку (2/2, 100 %), а не поток regular | переписать на новый прогон (У4.3) |
| `e2e/persist.spec.ts:195-223` | reload во время экзамена сохраняет прогон (`exam-banner`/`exam-continue`) | удалить с обоснованием (У4.4) |
| `e2e/persist.spec.ts:225-279` | истёкший экзамен сам финализируется, сводка session-only | удалить с обоснованием (У4.4) |
| `e2e/persist.spec.ts:111-162` | контракт `partialize` (в т.ч. 5 legacy-полей) | обновить список ключей |
| `e2e/fixtures.ts:152-156, 195-199, 261-265, 577-580, 625-633` | сид и `TESTID` legacy-полей | удалить legacy-часть |

`e2e/browser-mode.spec.ts:79`, `e2e/question-flow.spec.ts:206`,
`e2e/dashboard.spec.ts:119` используют `start-exam` только как якорь «мы на
Dashboard» — заменяются на `dashboard-continue` без потери смысла.

### BACKUP

`Question.tsx`, `Results.tsx`, `Dashboard.tsx`, `quizStore.ts`,
`useExamTimer.ts`, затронутые unit-тесты, затронутые e2e-спеки и `fixtures.ts`
скопированы в
`.project/drafts/backup/2026-10-04-remove-legacy-exam/` (19 файлов, дерево
путей сохранено).

## Цель

На Dashboard и в приложении остаётся **один** экзаменационный режим — spec 054
(Pro-only). Старый инлайн-экзамен удалён на всех слоях: store, экраны, хук,
тесты. Обычный квиз, темы, FSRS, streak, trial и новый экзамен не затронуты.

**НЕ входит:** новый Exam mode (spec 054/063), paywall-логика, банк вопросов,
`persist.version` и миграции, `src/data/**`.

## Что делаем

### У1. `src/store/quizStore.ts`

- Удаляются поля: `examActive`, `examLastResult`, `examStartedAt`,
  `examDurationMs`, `examQuestionIds`, `examAnswers`.
- Удаляются экшены: `startExam`, `answerExam`, `finishExam`, `cancelExam`
  (объявления в `QuizState` и реализации).
- Удаляются legacy-ветки в `nextQuestion` (`examActive` в выборе пула и в
  paywall-гейте), в `previousQuestion` (запрет «назад»), и все сбросы legacy-полей
  в `startRegularQuiz` / `startTopicQuiz` / `resetProgress` /
  `normalizeAnswersAgainstBank` / `partialize`.
- Комментарии «исторический инлайн-экзамен … не задет» переписываются: источник
  правды теперь только `examSession`.
- `persist.version` **не меняется** (7): удаляются session-only и persisted
  legacy-поля без миграции — Zustand толерантен к лишним полям старого persisted
  снапшота (они игнорируются, а `partialize` их просто больше не пишет).

### У2. `src/presentation/screens/Question.tsx`

- Удаляются: импорт и вызов `useExamTimer`, селекторы
  `examActive/examQuestionIds/examAnswers/answerExam/finishExam/cancelExam`,
  ветки `examActive` в `activeQuestions`, `activeAnswers`, `answerFn`,
  `isLastExamQuestion`, `hasHistory`, `handleOption`, `handleHomeClick`, в
  стилях опций и в блоке объяснения, таймер в `AppHeader.center`.
- Удаляется модалка подтверждения выхода (`exam-confirm` / `exam-stay` /
  `exam-leave`, `showConfirm`) — её единственный вход был `examActive`.
- **Обычный квиз не трогается:** `answerQuestion`, `next-button`, `option-N`,
  `header-back`, прогресс-бар, авто-скролл объяснения, Telegram-хуки.

### У3. `src/presentation/screens/Dashboard.tsx`

- Удаляются: баннер идущего экзамена (`exam-banner`, `exam-timer`,
  `exam-continue`), кнопка `start-exam`, селекторы `examActive` / `startExam`,
  `useExamTimer`, гейт `!examActive`.
- Остаётся кнопка `exam-mode` → `ExamSetup` (новый Pro-only режим) без двойного
  `onClick` и без legacy-условий.

### У4. `src/presentation/screens/Results.tsx` (отклонение О1)

- Удаляется ветка-сводка экзамена (`examLastResult`, `startExam`, `cancelExam`,
  `exam-summary` и его testid-контракт). Обоснование: ветка недостижима без
  legacy-экзамена, а сам новый итог рисует `ExamResults.tsx`; оставить её — значит
  оставить мёртвый код и импорт удалённых экшены store.
- Остальная логика Results (review/regular потоки, темы, «Ещё 30», «Повторить
  ошибки») не меняется.

### У5. Файлы

- Удаляется `src/hooks/useExamTimer.ts` (100 % legacy).
- Удаляется `src/store/__tests__/reset-progress.test.ts` (все три кейса — про
  legacy-поля); регрессия «resetProgress чистит regular/review и хранит
  streak/XP» переносится в `streams-isolation.test.ts` (К3).

### У6. E2E — переписать, а не удалять

- `dashboard.spec.ts:72` → кнопка `exam-mode` с текстом
  «Exam mode — 30/60/90 вопросов с разбором».
- `dashboard.spec.ts:119`, `results.spec.ts:95`, `browser-mode.spec.ts:79`,
  `question-flow.spec.ts:206` → якорь Dashboard меняется на `dashboard-continue`.
- `paywall.spec.ts:152-186` → прогон нового exam: `exam-mode` → `exam-start` →
  6+ вопросов через `exam-option-0`/`exam-submit`, paywall не появляется,
  обратной связи нет. Смысл кейса сохранён.
- `quiz-flow.spec.ts:539-586` → завершённый **новый** прогон (30 вопросов через
  `exam-submit`) показывает `exam-results` со счётом из **своих** ответов, а не
  из regular-потока. Смысл («итог считается по ответам экзамена») сохранён.
- `persist.spec.ts:195-279` → **два кейса удаляются**: они проверяли
  возобновление прогона через persisted `examActive` и self-finish через
  `useExamTimer` — механик больше нет. Возобновление нового прогона после reload
  **намеренно не существует** (`examSession` session-only) и уже покрыто
  `exam-session.test.ts` («в persisted-состоянии его нет»).
- `persist.spec.ts:111-162` → список `partialize`-ключей без 5 legacy-полей.
- `e2e/fixtures.ts` → удаляются legacy-поля синд-состояния, legacy `TESTID`
  (`startExam`, `examBanner`, `examTimer`, `examContinue`, `examConfirm`,
  `examStay`, `examLeave`) и legacy-часть `PERSIST_KEYS`.

### К3. Unit-тесты

- `exam-session.test.ts` — удаляется кейс «исторический инлайн-экзамен не
  сломан», из сида убираются legacy-поля.
- `streams-isolation.test.ts` — кейс `answerExam does NOT touch
  wrongQuestionIds` переписывается на `examSession`; из FSRS-кейса убирается
  legacy-прогон; добавляется кейс «resetProgress чистит regular/review, хранит
  streak/XP и не трогает новый прогон».
- `free-gate-review.test.ts` — «exam stream stays ungated» переписывается на
  `nextExamQuestion` (гейт бесплатного лимита не применяется к новому прогону).
- `Results.stream.test.tsx` — кейс «exam summary still wins» удаляется (ветки
  больше нет), из `resetStore` убираются legacy-поля.
- `Question.back.test.tsx` — кейс «exam: never offers a back control»
  переписывается на экран нового прогона: вопросов к `Question.tsx` про экзамен
  больше нет, а у `ExamRun` навигации назад не существует.
- `Dashboard.cta.test.tsx`, `persist-answer-reorder.test.ts`, `topic-quiz.test.ts`,
  `daily-goal.test.ts`, `onboarding-migration.test.ts`, `paywall-migration.test.ts`
  — из сидов убираются legacy-поля; `examAnswers` в проверке нормализации
  выравнивания банка заменяется на `reviewAnswers`-контракт.

## Критерии приёмки

- [ ] `grep` по `src/` и `e2e/` не находит ни одного идентификатора legacy:
      `examActive`, `examQuestionIds`, `examAnswers`, `examStartedAt`,
      `examDurationMs`, `examLastResult`, `answerExam`, `cancelExam`,
      `useExamTimer`, `exam-summary`, `exam-stay`, `exam-continue`,
      `testid="start-exam"`; `\bstartExam\b` без `Session` не встречается.
- [ ] `finishExam` не встречается нигде (включая тесты).
- [ ] `src/hooks/useExamTimer.ts` и `src/store/__tests__/reset-progress.test.ts`
      удалены; `git status` это подтверждает.
- [ ] Сохранены и не изменены: `ExamSetup.tsx`, `ExamRun.tsx`,
      `ExamResults.tsx`, `domain/exam.ts`, `examSession`, `startExamSession`,
      `submitExamAnswer`, `nextExamQuestion`, `finishExamSession`,
      `cancelExamSession`, `exam-confirm` отсутствует (модалка была legacy).
- [ ] Обычный квиз не переписан: `answerQuestion`, `next-button`, `option-N`,
      `header-back` работают, `question-flow.spec.ts` зелёный.
- [ ] Кнопка `exam-mode` на Dashboard осталась единственным входом в экзамен;
      `start-exam` в DOM отсутствует.
- [ ] `persist.version === 7` (не менялся); `partialize` не содержит legacy-полей.
- [ ] E2E: 3+ кейса переписаны, 2 удалены с обоснованием, итоговое число
      проходящих тестов зафиксировано в отчёте; ни один кейс не «позеленел»
      удалением покрытия обычного квиза.
- [ ] Гейты `typecheck`, `test:run`, `test:e2e`, `build` — exit 0.
- [ ] EOL правленых файлов `i/lf w/lf`, последний байт `0x0A` (правило 16).
- [ ] `sync:check` — exit 0; frontmatter `status: done` + `commit <feat-SHA>`;
      запись в `.project/log.md`
      `2026-10-04 | spec-068 | done - remove-legacy-exam | commit <feat-SHA>`.
- [ ] Push **не выполняется** — ожидает отдельной per-command авторизации
      капитана (правило 10).

## Проверка (сигналы критериев)

```powershell
# базовая линия до правок (HEAD 68d2308)
npm run test:run           # 439 passed (44 файла)
npm run test:e2e           # 103 passed

# после правок
npm run typecheck          # exit 0
npm run test:run           # 0 fail
npm run test:e2e           # 0 fail
npm run build              # exit 0
npm run sync:check         # exit 0
git ls-files --eol src/store/quizStore.ts src/presentation/screens/Question.tsx `
  src/presentation/screens/Dashboard.tsx src/presentation/screens/Results.tsx `
  e2e/fixtures.ts e2e/dashboard.spec.ts e2e/paywall.spec.ts e2e/quiz-flow.spec.ts `
  e2e/persist.spec.ts e2e/results.spec.ts
grep -rn "examActive\|examAnswers\|examLastResult\|useExamTimer" src e2e   # пусто
```

## Что НЕ трогать

- `src/data/**`, `tools/**`, `.project/sync.mjs`, `.project/ORCH-RULES.md`,
  `package.json`, `backend/**`;
- `src/domain/{exam,analytics,onboarding,goal,paywall,fsrs}.ts`,
  `src/store/{onboarding,dailyGoal,paywall}.ts`;
- `ExamSetup.tsx`, `ExamRun.tsx`, `ExamResults.tsx`, `domain/exam.ts`;
- `examSession`, `startExamSession`, `submitExamAnswer`, `nextExamQuestion`,
  `finishExamSession`, `cancelExamSession`;
- обычный квиз (`answerQuestion`, `next-button`, `option-N`, `header-back`);
- `persist.version` и миграции;
- `docs/memory/**` (кроме `log.md`).

## Превью

Демонстрация результата: Dashboard содержит **одну** кнопку
«📝 Exam mode — 30/60/90 вопросов с разбором»; кнопки «Режим экзамена
(20 вопросов, 30 минут)» и баннера «Экзамен идёт» больше нет; экран `Results`
не содержит ветки сводки экзамена. Артефакт для капитана — diff
(`git show --stat`) + список удалённых идентификаторов и e2e-кейсов из отчёта.

## Открытые вопросы и отклонения

- **О1 (расширение объёма).** Задание называет legacy-точками У1–У5
  (`quizStore`, `Question.tsx`, `Dashboard.tsx`, e2e, legacy-файлы), но
  `examLastResult` используется **только** ветвью сводки в `Results.tsx`.
  Удалить поле, не тронув ветку, невозможно (сборка/`typecheck` падают), поэтому
  вместе с полем удаляется и ветка. `Results.tsx` не входит в список «не
  трогать», но и не назван в У1–У5 — фиксируется как осознанное расширение.
- **О2 (`useExamTimer`).** Задание говорит «используется новым ExamRun? Да →
  оставить». Проверено: **нет** (`ExamRun.tsx:32-52` считает таймер сам) →
  хук удаляется.
- **О3 (`examLastResult`).** Задание: «используется новым ExamResults или
  Results? Используется → оставить». Проверено: используется старой ветвью
  `Results.tsx` → удаляется вместе с ней (см. О1).
- **О4 (`exam-confirm`).** `exam-confirm` (`Question.tsx:477`) назван в задании
  «НЕ удалять (z-index 9999)». Но это модалка **выхода из старого экзамена**,
  срабатывавшая только при `examActive`; после У1/У2 её единственный вход
  исчезает. Удаляется как часть legacy-пути; фиксируется как отклонение.
- Если после удаления `test:e2e` даст **меньше** тестов, чем 103 — это ожидаемо
  только за счёт двух удалённых legacy-кейсов `persist.spec.ts`; любое другое
  падение числа тестов — сигнал потери покрытия, а не успех.
