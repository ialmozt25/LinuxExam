---
id: 065
slug: ux-overhaul
type: feature
track: full
status: done
created: 2026-10-04
updated: 2026-10-04
commit: 2f89eef
embedded_approve: rule 2 (F5.0a — 2026-10-04)
execution: direct
---

## Контекст

UX-аудит `.project/drafts/ux-audit-2026-10-04/recon.md` (recon на HEAD `08e267a`)
зафиксировал четыре дефекта продуктового уровня. Три из них измерены, один —
семантический.

1. **«Повторить сегодня (N)» на свежем профиле.** `pickToday`
   (`src/domain/fsrs.ts:168`) считает «пора сейчас» любым вопросом **без записи**
   в реестре расписания. `ensureReviewsInitialized` (`quizStore.ts:702`)
   до-наполняет реестр при первом монтировании Dashboard, поэтому свежий профиль
   видит `N = 253` — то есть кнопка предлагает «повторить» весь банк вопросов,
   которых пользователь не проходил. Продуктовое намерение: **новые** вопросы
   («изучить») и **просроченные** («повторить») — разные пулы с разными входами.
2. **Три несовместимых набора кнопок и типографики** (recon §4.2–4.4): на одном
   экране `Dashboard` соседствуют CTA `16px + LAYOUT.buttonRadius` и вторичные
   `var(--text-sm) + var(--radius-md)`; один и тот же `var(--accent)` встречается
   с `color: 'white'` (`Dashboard.tsx:611`, `:657`, `Question.tsx:523`) и с
   `color: 'var(--text-primary)'` (`Dashboard.tsx:708`, `Question.tsx:452`,
   `ExamRun.tsx:217`, `ExamSetup.tsx:119`, `ExamResults.tsx:124`, `Paywall`), что
   в светлой теме даёт тёмный текст на синей кнопке.
3. **Шапка реализована дважды** (recon §4.1): общий `AppHeader` в `Question`,
   `Results`, `Paywall`, `Analytics`; самописная кнопка `ArrowLeft size={18}` в
   `ExamSetup`; у `ExamResults` шапки нет.
4. **Пустые состояния отсутствуют**: `Analytics` на пустом профиле показывает
   «Готовность: 0%» и радар из нулей вместо приглашения; `Dashboard` не выделяет
   первую тему для старта; `Results` с нулевым счётом не отличается от провала.

Порядок работы — фазы 2–5, по коммиту на фазу; push — один, в конце, только по
отдельной авторизации капитана (ORCH-RULES правило 10).

## Цель

Закрыть четыре пункта цели капитана: **разделить FSRS-пулы new/due**, ввести
**единые семантические токены** дизайна, **свести шапку к одному `AppHeader`** и
добавить **пустые состояния** на `Analytics`, `Dashboard` и `Results`.

- `pickToday(scheduled, all, now)` возвращает **два списка** —
  `{ newQuestions, dueQuestions }` — вместо одного смешанного. Новый вопрос =
  записи в реестре нет; просроченный = `next <= now`. Алгоритм FSRS
  (`stability`, `nextInterval`, `scheduleReview`) не меняется.
- Пул сессии собирает **явный лимит** `SESSION_LIMIT = 30`: `due` (по убыванию
  просрочки) + `new`, до лимита.
- `Dashboard` выбирает кнопку по состоянию профиля: нет ни одного ответа →
  «Начать обучение»; только новые вопросы → «Продолжить изучение (N)»; есть
  просроченные → «Повторить сегодня (N)» (N = `dueCount`).
- Семантические токены `--btn-*`, `--card-radius`, `--page-gutter`,
  `--heading-1/2`, `--body` добавляются в существующий
  `src/presentation/theme/tokens.css` **без удаления** примитивов.
- `AppHeader` **дополняется пропсами**, а не переписывается; `ExamSetup`
  переходит на него, сохраняя `data-testid="exam-setup-back"`.
- Пустые состояния получают новые `data-testid`: `analytics-empty` (уже
  существовал — расширяется), `analytics-start`, `topic-first-cta`,
  `results-zero`.

**НЕ входит:** банк вопросов (`src/data/**`), монетизация (paywall/trial/Stars),
backend, изменения алгоритма FSRS, `persist.version`.

## Что делаем

### К2 — FSRS semantic split

**К2.1 `src/domain/fsrs.ts`**

- `pickToday(scheduled, all, now)` → `{ newQuestions: string[]; dueQuestions: string[] }`.
  `new` — записи в реестре нет; `due` — `next <= now`; qid вне банка не попадают
  ни в один список; пустой банк → `{ newQuestions: [], dueQuestions: [] }`.
  Битые записи (`isUsableRecord === false`) считаются новыми, как и раньше.
- `sortByOverdue(scheduled, ids, now): string[]` — по убыванию `now - next`;
  id без записи не участвуют.
- `export const SESSION_LIMIT = 30`.

**К2.2 `src/store/quizStore.ts`**

- `getSessionCounts(): { newCount; dueCount }` — на месте `getTodayReviewIds()`.
- `getSessionIds(limit = SESSION_LIMIT): string[]` — `due` (отсортированы через
  `sortByOverdue`) + `new`, до лимита.
- Вызовы прежнего `getTodayReviewIds()` по коду обновлены; мёртвых вызовов нет.

**К2.3 `src/presentation/screens/Dashboard.tsx` — логика кнопки**

Порядок ветвлений (первое совпадение выигрывает):

| условие | кнопка | testid |
|---|---|---|
| `questionStats` пуст | «Начать обучение» → scroll к списку тем | `start-learning` |
| `dueCount > 0` | «Повторить сегодня (N)», N = `dueCount` | `review-today` (**сохранить**) |
| `newCount > 0 && dueCount = 0` | «Продолжить изучение (N)» | `continue-learning` |
| оба нуля | ничего не рендерится | — |

Когда `dueCount > 0` **и** `newCount > 0` — рендерятся обе кнопки, «Повторить»
сверху.

**К2.4 `src/presentation/screens/Results.tsx`**

- Если остаток `due > 0` — кнопка «Ещё 30» (`data-testid="review-next-batch"`),
  клик запускает `getSessionIds()`.
- `TODO` в `Results.tsx:438` не трогается.

**К2.5 Тесты**

- `src/domain/__tests__/fsrs.test.ts`: `pickToday` — all-new / all-due / mixed /
  empty (обновление существующих 22 тестов под новый контракт);
  `sortByOverdue` — порядок.
- `src/store/__tests__/streams-isolation.test.ts` + `persist-migration.test.ts`:
  `getSessionCounts`, `getSessionIds` с лимитом.
- `e2e/fixtures.ts` — разрешено менять (сиды new/due, новые `TESTID`).
- `e2e/fsrs.spec.ts` — обновляется под новый контракт; новые сценарии: fresh →
  «Начать обучение» (не «Повторить»); due-профиль → «Повторить (N)» → «Ещё 30».
- `e2e/{retention,mobile-sticky-footer,paywall}.spec.ts` — обновляются, если
  ожидают `review-today` на свежем профиле.

### К3 — design tokens

**К3.1** В `src/presentation/theme/tokens.css` (существующий; `main.tsx:1` уже
импортирует) добавить семантические токены, не удаляя существующие:

- Buttons: `--btn-primary-bg`, `--btn-primary-text` (white),
  `--btn-primary-radius`, `--btn-secondary-bg`, `--btn-secondary-text`,
  `--btn-secondary-radius`, `--btn-ghost-text`.
- Cards: `--card-radius`, `--card-padding`, `--page-gutter`.
- Typography: `--heading-1`, `--heading-2`, `--body` (line-height 1.55).

**К3.2** Применить к `<button>` с `background: var(--accent)`: текст
`color: 'white'` и `color: 'var(--text-primary)'` → `var(--btn-primary-text)`.
Текст и иконки вне кнопок не трогаются.

**К3.3** Радиусы: `LAYOUT.buttonRadius`, `var(--radius-md)`, `'12px'`,
`var(--radius-sm)` у кнопок → `--btn-primary-radius` / `--btn-secondary-radius`;
`'12px'` у вариантов ответа (`Question`, `ExamRun`) → `--card-radius`.

**К3.4** Типографика: H1 → `--heading-1`, H2 → `--heading-2`, body → `--body`.
`Dashboard.tsx:207-218` (`uppercase` + `letterSpacing`) — решение по контексту
(бейдж оставить, заголовок убрать) фиксируется в отчёте.

### К4 — единый AppHeader

**К4.1** `AppHeader.tsx` не переписывается; при нехватке пропсов — дополняется.
`onHome` в текущем коде **уже есть** (`AppHeader.tsx:6`), добавлять не требуется.

**К4.2** Применить `AppHeader` с сохранением testid: `ExamSetup.tsx`
(`exam-setup-back`). `Analytics.tsx`/`ExamResults.tsx` — проверить стиль с
токенами Ф3. `ExamRun.tsx`/`Dashboard.tsx` — не добавлять (свой layout).

**К4.3** Нижние выходы: `Analytics.tsx` — нижняя кнопка удалена (уже сделано в
UX-fix); `ExamResults.tsx` — `back-to-dashboard` сохраняется как fallback.

### К5 — пустые состояния

**К5.1 `Analytics.tsx`** — если `questionStats` пуст: эмодзи 📊, «Начните свой
путь к RHCSA», «Пройдите первый тест, чтобы увидеть прогресс», кнопка «Начать
тренировку» (`analytics-start`) → Dashboard; радар и метрики скрыты;
`analytics-empty` — на корне пустого состояния.

**К5.2 `Dashboard.tsx`** — первая free-тема получает бейдж «начните с этой»
(`topic-first-cta`).

**К5.3 `Results.tsx`** — `score = 0` → «Первый шаг сделан» + «Попробовать снова»
(`results-zero`).

**К5.4 e2e** — fresh → `analytics-empty`, нет «Готовность 0%»; fresh → Dashboard
«Начать обучение»; `0/30` → `results-zero`.

### К6 — коммиты

| фаза | сообщение |
|---|---|
| 2 | `feat(spec-065): fsrs semantic split - new vs due` |
| 3 | `feat(spec-065): design tokens` |
| 4 | `feat(spec-065): unified AppHeader` |
| 5 | `feat(spec-065): empty states` |

### К7 — закрытие

Frontmatter 065 → `status: done`, `commit: <feat-Ф2-SHA>`; строка в
`.project/log.md` (`2026-10-04 | spec-065 | done - ux-overhaul | commit <feat-Ф2-SHA>`);
`npm run sync` → коммит `chore(state): converge after spec-065 done`; `sync:check = 0`.

## Критерии приёмки

- [ ] `pickToday` возвращает `{ newQuestions, dueQuestions }`; new = нет записи,
      due = `next <= now`, qid вне банка не попадают, пустой банк → два пустых
      списка; алгоритм FSRS (`stability`/`nextInterval`/`scheduleReview`) не
      изменён.
- [ ] `sortByOverdue` сортирует по убыванию просрочки; `SESSION_LIMIT = 30`
      экспортирован.
- [ ] `getSessionCounts()` и `getSessionIds(limit = SESSION_LIMIT)` существуют;
      `getSessionIds` отдаёт `due` (по убыванию просрочки) + `new` до лимита;
      вызовов `getTodayReviewIds()` в дереве не осталось.
- [ ] `Dashboard`: вопросов нет → `start-learning` «Начать обучение» (клик
      скроллит к списку тем); `dueCount > 0` → `review-today` с N = `dueCount`;
      только new → `continue-learning`; оба нуля → кнопок нет.
- [ ] `Results`: остаток due > 0 → `review-next-batch` «Ещё 30» запускает
      `getSessionIds()`.
- [ ] `tokens.css` содержит `--btn-primary-bg`, `--btn-primary-text`,
      `--btn-primary-radius`, `--btn-secondary-*`, `--btn-ghost-text`,
      `--card-radius`, `--card-padding`, `--page-gutter`, `--heading-1`,
      `--heading-2`, `--body`; существующие токены сохранены.
- [ ] Ни одна кнопка с `background: var(--accent)` не использует
      `--text-primary` как цвет текста.
- [ ] `ExamSetup` использует `AppHeader`; `exam-setup-back` сохранён.
- [ ] Пустые состояния: `analytics-empty` + `analytics-start` (радар и метрики
      скрыты), `topic-first-cta`, `results-zero`.
- [ ] Сохранены `data-testid`: `exam-mode`, `analytics-mode`, `review-today`,
      `next-button`, `exam-submit`, `paywall`, `streak-badge`, `header-back`,
      `back-to-dashboard`, `exam-results-back`, `analytics-back`.
- [ ] `persist.version` не менялся; новых зависимостей нет.
- [ ] Гейты каждой фазы 2–5: `npm run typecheck`, `npm run test:run`,
      `npm run test:e2e`, `npm run build` — exit 0.
- [ ] После Ф5: `npm run sync:check` — exit 0; `status: done` + `commit` в
      frontmatter; запись в `.project/log.md`.
- [ ] EOL правленых `.ts`/`.md`: `i/lf w/lf`, последний байт `0x0A` (правило 16).
- [ ] Push **не выполняется** — ожидает отдельной авторизации капитана
      (правило 10).

## Проверка (сигналы критериев)

```powershell
# базовая линия до правок (HEAD 08e267a)
npm run typecheck          # exit 0
npm run test:run           # 422 passed / 43 files
npm run test:e2e           # 89 passed
npm run build              # exit 0

# после каждой фазы 2-5
npm run typecheck          # exit 0
npm run test:run           # 0 fail
npm run test:e2e           # 0 fail
npm run build              # exit 0

# после Ф5 и после Ф7
npm run sync:check         # exit 0
git ls-files --eol <changed paths>   # i/lf w/lf
```

Функциональные сигналы:

- `pickToday({}, bank, now)` → `newQuestions.length === bank.length`,
  `dueQuestions.length === 0`;
- `getSessionIds(30)` → не больше 30 id, `due` впереди `new`;
- fresh-профиль: кнопки `review-today` в DOM **нет**, есть `start-learning`;
- `Analytics` на пустом профиле: `analytics-empty` есть, текст «Готовность: 0%»
  отсутствует.

## Что НЕ трогать

- `src/data/**` (банк 253), `tools/**`, `.project/sync.mjs`,
  `.project/ORCH-RULES.md`, `playwright.config.ts`, `tailwind.config.*`,
  `package.json`, `backend/**`;
- `src/domain/{exam,analytics,onboarding,goal,paywall}.ts`,
  `src/store/{onboarding,dailyGoal,paywall}.ts`;
- `docs/memory/**` (кроме `log.md`);
- алгоритм FSRS (`stability`, `nextInterval`, `scheduleReview`) и
  `persist.version`;
- существующие `data-testid`: `exam-mode`, `analytics-mode`, `review-today`,
  `next-button`, `exam-submit`, `paywall`, `streak-badge`, `header-back`,
  `back-to-dashboard`, `exam-results-back`, `analytics-back`, `streak-badge`;
- `TODO` в `Results.tsx:438`;
- `e2e/ux-screenshots.tmp.spec.ts` — временная recon-спека, в коммит не входит.

## Превью

Скриншоты всех 9 экранов (390×844 и 1440×900) в состоянии ПОСЛЕ правок —
`.project/drafts/ux-audit-2026-10-04/after/`; ДО — PNG из recon в
`.project/drafts/ux-audit-2026-10-04/`. Порядок приёмки: Dashboard (кнопка
обучения), Analytics (пустое состояние), Results (нулевой счёт), ExamSetup
(единая шапка).

## Открытые вопросы

- Ветка `newCount > 0 && dueCount = 0` («Продолжить изучение») недостижима
  устойчиво в рантайме: `ensureReviewsInitialized` до-наполняет реестр для всего
  банка при монтировании Dashboard, а «нет записи» = «пора сейчас» — то есть
  вопрос без записи сразу попадает в `due`, а не в `new`. Ветка реализуется и
  покрывается компонентным тестом с подстановкой счётчиков; наблюдение
  фиксируется в отчёте оркестратора как известное ограничение FSRS-lite, а не
  как сделанный вид. Расширение семантики «новый вопрос» — отдельная спека.
