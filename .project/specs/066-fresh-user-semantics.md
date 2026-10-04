---
id: 066
slug: fresh-user-semantics
type: fix
track: full
status: done
created: 2026-10-04
updated: 2026-10-04
commit: 1dbd74a
embedded_approve: rule 2 (F5.0a — 2026-10-04)
execution: direct
---

## Контекст

Отклонение №4 спеки 065 (`.project/specs/065-ux-overhaul.md`, «Открытые вопросы»):
на **свежем профиле** (`questionStats` пуст) Dashboard показывает одновременно
приглашение «Начать обучение» и блок повторения — «Повторить сегодня (30)» плюс
строку «Осталось повторить: 223». Семантически это неверно: пользователь не
проходил ни одного вопроса, повторять ему нечего.

Причина — не порядок условий, а **отсутствие взаимоисключения** блоков. В
`Dashboard.tsx` ветки рендерятся независимо:

| ветка | условие | роль |
|---|---|---|
| `start-learning` | `hasNoHistory` (`questionStats` пуст) | приглашение новичка |
| `review-today` | `dueCount > 0` | повторение |
| `review-today-remainder` | `hasPending && dueCount > 0` | остаток пула |
| `continue-learning` | `newCount > 0 && dueCount === 0` | продолжение изучения |

`hasNoHistory` **проверяется раньше** `dueCount` (он вычисляется на строках
153-157, ветки — на 378-419), но ни одну из следующих ветвей не отключает.

Почему `dueCount` на свежем профиле равен 30:

1. `ensureReviewsInitialized(bankIds)` (`Dashboard.tsx:168-170`) при
   монтировании вызывает `ensureRecords` (`src/domain/fsrs.ts:237`), который
   проставляет **всему банку** `next = now`;
2. `pickToday` (`src/domain/fsrs.ts:186`) относит к `due` всё, у чего
   `next <= now`, то есть весь банк;
3. `getSessionIds()` обрезает пул до `SESSION_LIMIT = 30` → «Повторить (30)»,
   а `getSessionCounts().dueCount = 253` → «Осталось повторить: 223».

## Цель

Свежий профиль видит **только** «Начать обучение» — без «Повторить» и без
остатка пула. Пользователь с историей (`questionStats` непуст) сохраняет
сегодняшнее поведение без изменений.

- Ветки CTA становятся взаимоисключающими: при `hasNoHistory` рендерится ровно
  блок «Начать обучение», остальные три — только при непустой статистике.
- **Правка только в `Dashboard.tsx`** (V1). Ни `fsrs.ts`, ни `quizStore.ts`
  править не требуется — см. «Решение по V1/V2».
- `hasNoHistory` остаётся единственным признаком «свежести»: он уже опирается на
  персистируемую статистику и переживает reload.

**Решение по V1/V2 (ФАЗА 2 задания).** Достаточно **V1**: проблема локализована в
разметке Dashboard, а порядок вычисления `hasNoHistory` уже правильный —
не хватало лишь взаимного исключения веток. **V2 не применяется.** Обоснование
отказа от V2 (не «не нужен вообще», а «хуже этой правки»):

- V2 требует изменить контракт «нет записи = пора сейчас», на котором стоит
  FSRS-lite (spec 052) и весь пул `new` спеки 065. Это не адресная правка, а
  смена семантики domain-слоя;
- V2 **не решает задачу сам по себе**: CTA по-прежнему выбирается по
  `questionStats`, а он у свежего профиля пуст независимо от реестра;
- V2 сохраняет записи только для `answered` qid, то есть **изменяет**
  `scheduledReviews` для уже существующих профилей — а это ближе к миграции
  persist, чем допускает задание (миграция → STOP и отдельная спека);
- V1 даёт меньший дифф, ноль изменений в domain/store и не трогает
  `persist.version`.

**Почему V1 корректен для «after 1 answer».** Все три потока ответов пишут
статистику через `recordQuestionStat` (`quizStore.ts:458`), который вызывается
из `answerQuestion` (`:489`), `answerReview` (`:674`), `answerExam` (`:781`) и
`answerAndReschedule` (`:858`). Первый же ответ делает `questionStats` непустой —
значит признак «свежести» снимается сам, и ветки повторения снова доступны.

**НЕ входит:** `persist.version` и любая миграция persist, алгоритм FSRS
(`stability`, `nextInterval`, `scheduleReview`), `pickToday`, `answerReview`,
`ensureReviewsInitialized`, `ensureRecords`, состав банка.

## Что делаем

### К1. `src/presentation/screens/Dashboard.tsx` — взаимоисключение веток

Блок CTA переписывается на одну пару `hasNoHistory ? … : <>…</>`: при
`hasNoHistory` рендерится только `start-learning`, иначе — `review-today`,
`continue-learning` и строка остатка под прежними условиями.

- `start-learning` остаётся первым (приглашение вместо повторения) и сохраняет
  поведение клика: скролл к списку тем, без запуска прогона.
- Порядок внутри ветки «не свежий» не меняется: `review-today` → затем
  `continue-learning` (со своим условием `dueCount === 0`) → затем остаток.
- Условия `dueCount`/`newCount`/`hasPending`, их вычисление и сами блоки не
  переписываются — меняется только вложенность.

Адресная правка: ни `pickToday`, ни `answerReview`, ни
`ensureReviewsInitialized` не трогаются; `fsrs.ts` и `quizStore.ts` остаются
байт-в-байт прежними.

### К2. Тесты

**E2E (fresh user, `questionStats` пуст)** — `e2e/fsrs.spec.ts`:

- `start-learning` виден и содержит «Начать обучение»;
- `review-today` в DOM **отсутствует** (`toHaveCount(0)`);
- `review-today-remainder` в DOM **отсутствует**;
- `continue-learning` отсутствует.

**E2E (после первого ответа, `dueCount >= 1`)** — новый сценарий:

- ответ в обычном потоке (одна карточка) → возврат на Dashboard →
  `questionStats` непуст → `review-today` виден, N ≥ 1, `start-learning`
  отсутствует.

**Компонентные тесты** — `src/presentation/screens/__tests__/Dashboard.cta.test.tsx`:
первый кейс («профиль без единого ответа») меняет ожидание с «приглашение и
сессия повторения на 30» на «приглашение и НИ ОДНОЙ ветки повторения».

**Существующие e2e не ломать** — правятся только те, что фиксировали дефект:

- `e2e/fsrs.spec.ts:85` (`reviewToday` виден на свежем профиле) — приводится к
  новому контракту;
- `e2e/fsrs.spec.ts:171-186` (сценарий «ответы в прогоне уменьшают остаток»)
  начинается со свежего профиля и клика по `review-today` — переводится на
  профиль с историей (иначе кнопки повторения на свежем профиле больше нет);
- `e2e/fsrs.spec.ts:148-165` («реестр расписания пишется только review-прогоном»)
  — та же причина, тот же перевод.

### К3. Гейты

`typecheck` · `test:run` · `test:e2e` · `build` → exit 0.

### К4. Коммит

`fix(spec-066): fresh-user sees 'Start learning' not 'Review'` → затем
`chore(state): converge after spec-066` → `sync:check = 0`.

## Критерии приёмки

- [ ] На свежем профиле (`questionStats` пуст) Dashboard показывает
      `start-learning` «Начать обучение» и **не содержит** `review-today`,
      `review-today-remainder`, `continue-learning`.
- [ ] Клик по `start-learning` скроллит к списку тем и **не** запускает прогон
      (поведение spec 065 сохранено).
- [ ] После первого ответа (`questionStats` непуст) Dashboard показывает
      `review-today` с N ≥ 1 и не показывает `start-learning`.
- [ ] Ветки CTA взаимоисключающие: `start-learning` и `review-today` никогда не
      видны одновременно.
- [ ] `hasNoHistory` по-прежнему вычисляется **до** `dueCount` и остаётся
      единственным признаком «свежести».
- [ ] `src/domain/fsrs.ts` и `src/store/quizStore.ts` не изменены
      (`git diff` по ним пуст).
- [ ] `persist.version` не менялся; миграций нет.
- [ ] Алгоритм FSRS не изменён; `pickToday` / `answerReview` /
      `ensureReviewsInitialized` не переписаны.
- [ ] Сохранены `data-testid`: `start-learning`, `review-today`,
      `review-today-remainder`, `continue-learning`, `dashboard-topics`,
      `dashboard-continue`, `exam-mode`, `analytics-mode`, `streak-badge`.
- [ ] Гейты: `typecheck`, `test:run`, `test:e2e`, `build` — exit 0.
- [ ] `sync:check` — exit 0; frontmatter `status: done` + `commit <feat-SHA>`;
      запись в `.project/log.md`.
- [ ] EOL правленых `.ts`: `i/lf w/lf`, последний байт `0x0A` (правило 16).
- [ ] Push **не выполняется** — ожидает отдельной авторизации капитана.

## Проверка (сигналы критериев)

```powershell
# базовая линия до правок (HEAD 3cc22b6)
npm run test:run           # 439 passed
npm run test:e2e           # 95 passed

# после правки
npm run typecheck          # exit 0
npm run test:run           # 0 fail
npm run test:e2e           # 0 fail
npm run build              # exit 0
npm run sync:check         # exit 0
git ls-files --eol src/presentation/screens/Dashboard.tsx   # i/lf w/lf
```

Функциональные сигналы:

- fresh-профиль: `getByTestId('review-today')` → count 0,
  `getByTestId('start-learning')` → видим;
- после одного ответа: `getByTestId('start-learning')` → count 0,
  `getByTestId('review-today')` → видим с N ≥ 1.

## Что НЕ трогать

- `src/data/**` (банк 253), `tools/**`, `.project/sync.mjs`,
  `.project/ORCH-RULES.md`, `package.json`, `backend/**`;
- `src/domain/{exam,analytics,onboarding,goal,paywall}.ts`;
- `src/domain/fsrs.ts`, `src/store/quizStore.ts` — по этому фиксу не правятся;
- `persist.version` и `partialize`;
- `hasNoHistory`-условие и вычисление `dueCount`/`newCount`/`hasPending`;
- существующие `data-testid` (перечень в критериях).

## Превью

Скриншот Dashboard на свежем профиле (390×844 и 1440×900) ПОСЛЕ правки: одна
кнопка «Начать обучение», блока «Повторить сегодня» и строки остатка нет.
Артефакты — `.project/drafts/ux-audit-2026-10-04/fresh-after-spec-066/`;
ДО (дефект) — `before-08e267a/mobile-dashboard.png` (две кнопки).
