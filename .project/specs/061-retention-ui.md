---
id: 061
slug: retention-ui
status: done
type: feature
track: full
created: 2026-10-03
updated: 2026-10-03
commit: 94dcf99
embedded_approve: rule 2 (F5.0a — 2026-10-03)
execution: direct
---

## Контекст

Retention-механика уже посчитана в сторе, но не показана пользователю. Аудит
механики (`.project/drafts/app-mechanics-audit.md` §3, находка 19) фиксирует:
`StreakBadge` (`src/presentation/components/StreakBadge.tsx`) и `XpBar`
(`src/presentation/components/XpBar.tsx`) **импортируются только собственными
тестами** (`StreakBadge.test.tsx:3`, `XpBar.test.tsx:3`) — в продовых экранах
0 совпадений. То есть серия (streak) и опыт (totalXp) существуют в `quizStore`,
но на Dashboard видны лишь как две цифры в статус-полосе
(`Dashboard.tsx:103-133`), а **дневная цель отсутствует полностью**: в сторе нет
ни `dailyGoalXp`, ни `todayXp`.

Наблюдения из research (Duolingo, публичные материалы о streak/daily-goal):

- **streak без видимого UI не работает**: серия — социальное обязательство, и
  она мотивирует ровно в той мере, в какой видна в момент открытия продукта;
  скрытая цифра в статус-полосе этого не даёт;
- **daily goal с визуальным якорем на 85 %** повышает completion: цель должна
  иметь видимую засечку «почти получилось», иначе порог 100 % воспринимается как
  недостижимый и не тянет возврат.

Спека ставит UI на уже существующие данные стора и добавляет ровно одно новое
персистентное измерение — дневную цель и накопленный за сегодня XP.

## Цель

Retention-зона на Dashboard: **streak badge + XP bar + daily goal picker**.
Streak и опыт читаются из уже персистируемых полей стора; дневная цель
добавляется как `dailyGoalXp` + `todayXp` (миграция `persist.version: 5 → 6`) и
предлагается пользователю один раз — сразу после онбординга.

**НЕ входит:** Telegram reminders (spec 062), монетизация (063/064), Paywall.

## Что НЕ трогать

- `src/data/**` (банк 253), `tools/**`, `.project/sync.mjs`, `.project/ORCH-RULES.md`,
  `playwright.config.ts`, `tailwind.config.*`, зависимости `package.json`;
- domain-модули `src/domain/fsrs.ts`, `src/domain/exam.ts`, `src/domain/analytics.ts`,
  `src/domain/onboarding.ts`, `src/store/onboarding.ts`;
- существующие кнопки Dashboard `exam-mode`, `analytics-mode`, `review-today` (и
  все прочие: `start-exam`, `dashboard-continue`, `review-wrong`, `theme-toggle`) —
  retention-зона **добавляется рядом**, вёрстка кнопок не переписывается;
- порядок существующих 19 полей `partialize` — новые поля идут строго в конец;
- session-only поля (`activeTopic`, `reviewKind`, `examLastResult`, `examSession`)
  в `partialize` не переносятся.

## Что делаем

### К1. `src/domain/goal.ts` — чистые функции (ноль импортов zustand/react)

- `DAILY_GOAL_OPTIONS: readonly number[]` = `[10, 20, 50]` — три варианта
  (light / normal / intense).
- `computeDailyProgress(todayXp, goalXp)` → `{ todayXp, goalXp, ratio, met }`.
  `ratio` — доля 0…1 (при `goalXp <= 0` → `0`, без NaN и деления на ноль),
  `met` — `todayXp >= goalXp`.
- `streakMessage(streak): string` — **непустая строка для любого** `streak ∈ [0, ∞)`:
  `0 → «Начните серию!»`, `1 → «День 1 — хорошее начало»`, `5 → «5 дней подряд»`,
  `30 → «Месяц!»`, `100 → «Легенда»`. Отрицательное значение трактуется как 0.
- `messageColor(streak): 'green' | 'orange' | 'red'` — цветовая классификация
  длины серии: `0 → 'red'` (broken), `1..6 → 'green'` (active), `≥7 → 'orange'`
  (warning). Компонент «сдвигает» вход по сегодняшней активности
  (`streakStateByActivity` → active даёт `0` = green, warning даёт `1` = orange,
  broken даёт `0` = red), поэтому цвет остаётся чистым доменом, а состояние —
  в UI. `streakStateByActivity(todayXp, lastActiveDate, today)` возвращает
  `'active' | 'warning' | 'broken'`; `shiftIsoDate(isoDate, days)` — сдвиг
  ISO-даты (`YYYY-MM-DD`) для вычисления «вчера».

### К2. Store (`src/store/quizStore.ts`)

- `persist.version: 5 → 6`.
- Миграция `v5 → v6`: `+ dailyGoalXp: number = 20`, `+ todayXp: number = 0`.
- `partialize`: `+ dailyGoalXp`, `+ todayXp` **в конец** (после `onboardingGoal`,
  `hasCompletedOnboarding`) → 21 поле.
- Экшены:
  - `setDailyGoal(xp: number): void`;
  - `recordActivity()` — расширяется: при первой активности за день, помимо
    `streak`/`lastActiveDate`/`totalXp`, увеличивает `todayXp` на те же `+10`
    (повторный вызов в тот же день — no-op, как и было);
  - `resetTodayXpIfNewDay(): void` — вызывается при гидратации: если
    `lastActiveDate` отсутствует или не равен сегодняшней дате → `todayXp = 0`.
    Идемпотентен.
- Селектор `useDailyGoalProgress()` — **вне стора** (по прецеденту
  `useNeedsOnboarding` из spec 060), в `src/store/dailyGoal.ts`: возвращает
  результат `computeDailyProgress` + выбранную цель.

### К3. `src/presentation/components/StreakBadge.tsx`

Компонент существует (31 строка, `Flame` + число) и в продовых экранах не
рендерится — расширяется до retention-вида, тестовый контракт (`role="status"`,
`aria-label="Серия N дней"`, число отдельным текстовым узлом) сохраняется.

- Визуал: `🔥` + число дней + `streakMessage()`; размер ≈ 80×80, крупное число.
- `data-testid="streak-badge"`.
- Тап → `currentScreen = 'analytics'`.
- Состояния (по `streak` + `lastActiveDate` относительно сегодня):
  - **active** — `todayXp > 0` (сегодня пользователь уже занимался);
  - **warning** — `todayXp = 0`, `lastActiveDate = вчера`;
  - **broken** — `lastActiveDate < вчера` (или `null` при `streak = 0`).
- Цвет состояния берётся из `messageColor()`/состояния: active → `--success`,
  warning → `--warning`, broken → `--danger`.

### К4. `src/presentation/components/XpBar.tsx`

Компонент существует (49 строк) и тоже не рендерится в продовых экранах —
переводится на дневную цель.

- Прогресс-бар `todayXp / dailyGoalXp`, текст «15 / 20 XP»
  (`data-testid="xp-bar-daily-label"`).
- Визуальная засечка на 85 % шкалы (research: Duolingo) — отдельный элемент
  `data-testid="xp-bar-mark"`, который становится «активным» (зелёный), когда
  `ratio >= 0.85`.
- `data-testid="xp-bar"` + `data-xp-color` / `data-mark-active` для ассертов.
- Цвет заполнения: `<50 %` — серый (`--text-secondary`), `50–84 %` — акцентный
  (`--accent`), `≥85 %` — зелёный (`--success`).
- Подпись уровня из бара убрана: она дублировала статус-полосу Dashboard
  (`#status-strip`) и ломала строгий `getByText('Уровень 1')` в существующем
  `persist.spec.ts`. Старый `XpBar.test.tsx` (уровень + `role="progressbar"`)
  заменён на дневной контракт — см. отклонение 2.

### К5. Dashboard (`src/presentation/screens/Dashboard.tsx`)

- Верхняя зона: `StreakBadge` + `XpBar` рядом (flex).
- Строка ниже: «Цель: 15 / 20 XP».
- `data-testid="dashboard-retention"`.
- Существующие кнопки и блоки не трогаются (только добавление зоны).

### К6. Daily goal picker

- Условие показа: `hasCompletedOnboarding && dailyGoalXp === null` — то есть при
  первом входе после онбординга, когда цель ещё не выбрана.
- 3 карточки 10 / 20 / 50 XP → `setDailyGoal(xp)` → скрыть.
- `data-testid="daily-goal-picker"`, карточки — `daily-goal-<xp>`.
- Не показывается, если `dailyGoalXp` уже установлен.
- На первом шаге дефолт `20` (миграция v5→v6) — picker лишь предлагает сменить.

## Критерии приёмки

- `src/domain/goal.ts` — чистые функции из К1, покрытые unit-тестами;
  `streakMessage()` непуста для 0, 1, 5, 30, 100.
- `persist.version = 6`, миграция v5→v6 даёт `dailyGoalXp = 20`, `todayXp = 0`;
  `partialize` содержит 21 поле, новые — в конце, порядок первых 19 не изменён.
- `recordActivity()` даёт `totalXp +10` **и** `todayXp +10`; повтор в тот же день —
  no-op; `resetTodayXpIfNewDay()` обнуляет `todayXp` при смене даты.
- Dashboard рендерит `dashboard-retention` со `streak-badge` и `xp-bar`; строка
  «Цель: N / M XP» видна.
- Picker показывается ровно при `hasCompletedOnboarding && dailyGoalXp === null`,
  выбор карточки пишет цель в стор и скрывает picker.
- Гейты: `npm run typecheck` = 0, `npm run test:run` = 0, `npm run test:e2e` = 0,
  `npm run build` = 0.
- EOL всех правленых `.ts`/`.md`: `i/lf w/lf`, последний байт `0x0A`.

## Превью

Ordering-инвариант скриншота для приёмки: Dashboard, viewport 390×844, три
среза — (1) seed `streak = 1`, `lastActiveDate = вчера`, `todayXp = 0` →
badge в состоянии warning, `XpBar 0/20`; (2) `todayXp = 15` → `XpBar 15/20`,
полоса 75 %, засечка 85 % неактивна; (3) `todayXp = 18` → засечка 85 % активна.
Плюс (4) свежий профиль с завершённым онбордингом → picker с тремя карточками.

## Отклонения от задания (зафиксировано при исполнении)

1. **`dailyGoalXp` типизировано `number | null`** (К2/К6). Задание требует
   одновременно: дефолт миграции `dailyGoalXp: number = 20` **и** условие показа
   picker-а `dailyGoalXp === null`. Оба требования выполнимы только вместе, если
   `null` — легальное состояние «цель ещё не выбрана пользователем»: миграция
   v5→v6 всегда даёт `20` (старые профили picker не видят), а `null` остаётся
   только у профиля, который прошёл онбординг в этой же сессии и цель не
   подтверждал. См. `src/store/quizStore.ts`.
2. **`XpBar` переведён на дневную цель целиком; подпись уровня и старый
   `role="progressbar"` из него убраны.** Причина: добавленная полоса заняла место
   бара уровня, и «Уровень N» оказался в DOM дважды (статус-полоса Dashboard +
   бар), что ломало строгий `getByText('Уровень 1')` в `persist.spec.ts:172`
   (strict mode violation) и читалось как дубль. `XpBar.test.tsx` обновлён
   (уровень → `todayXp/dailyGoalXp`, `data-xp-color`, засечка), а `totalXp`
   остаётся в статус-полосе, как и было до спеки.
3. **`dailyGoalXp === null` читается как `DEFAULT_DAILY_GOAL_XP = 20`** в
   `useDailyGoalProgress()`: без этого бар показывал бы «0 / 0 XP» (дефолт из К6
   «на первом шаге default 20» не был бы виден до подтверждения цели). Дефолт
   вынесен в domain-константу и переиспользуется миграцией v5→v6.
4. **Обновлены ассерты существующих тестов на версию persist** (5 → 6):
   `persist-migration.test.ts` (5 проверок + 2 заголовка), `onboarding-migration.test.ts`
   (1), `exam-session.test.ts` (1). Это тот же приём, что и в spec 060 (тогда
   менялись ассерты 4 → 5): версия — часть контракта `persist`, и её bump обязан
   быть отражён в тестах, иначе они проверяют устаревшую версию.
5. **`StreakBadge` при `streak = 0` больше не рендерит `null`** (К3): состояние
   broken с сообщением «Начните серию!» — смысл retention-зоны в том, чтобы серия
   была видна и на нуле. Тест `«renders nothing when streak is 0»` заменён на
   проверку мотивирующего сообщения.
