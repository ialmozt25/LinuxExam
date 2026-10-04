---
id: 074
slug: visual-a11y-testing
type: infra
track: full
status: done
created: 2026-10-04
updated: 2026-10-04
commit: 703e14d
embedded_approve: rule 2 (F5.0a — 2026-10-04)
new_dependency: @axe-core/playwright (authorized)
execution: direct
---

## Контекст

Функциональных e2e-сценариев **111**, но **визуальной регрессии и a11y нет вовсе**.
UI-дефекты класса «кнопка не видна», «бейджи разного цвета», «текст не читается»
ловятся только ручной проверкой: e2e проверяет наличие и поведение узлов, но не то,
как они выглядят и доступны ли они с клавиатуры/скринридера.

История подтверждает цену пропуска: spec 067/070/071 (футер `next-button` вне
вьюпорта на мобильном) и UX-фикс от 2026-10-04 (выход из Analytics) найдены глазами,
а не тестами. Расхождение цветов одного и того же состояния (success/danger в
light/dark) нашёл только `color-regression.spec.ts` — рукописная проверка одного
контраста; системного покрытия нет.

Инструменты уже доступны и не требуют новых подходов:
`@playwright/test@1.63.0` имеет встроенный `toHaveScreenshot()` с масками и
порогом (`maxDiffPixelRatio`, `threshold`, `animations: 'disabled'`), а
`axe-core` — отраслевой стандарт автоматической проверки доступности (WCAG 2.1 A/AA).

**PRE-CHECK (read-only):**

- `.project/specs/074*.md` → **False** (спеки не было);
- `@axe-core/playwright` в `package.json` → **нет**; в `node_modules` до начала работ
  лежал только транзитивный `axe-core` (через `jest-axe`), адаптера для Playwright не
  было;
- `@playwright/test` = **1.63.0** (≥ 1.45) → `page.clock` доступен, fallback
  (`setFixedTime` не нужен) не применяется;
- `Screen` (union в `src/store/quizStore.ts:36-47`) → **11 значений**;
  файлы экранов: `src/presentation/screens/*.tsx` → **11** (совпадение 1:1);
- `e2e/fixtures.ts` — сиды: `seedState`, `seedOnboarding`, `seedRetention`,
  `seedNoAccess`, `seedTopicRun`, `seedDueProfile`, `seedExhaustedProfile`,
  `seedHistoryProfile`, `seedStateOnce`, `bankReviewRecords`; хелперы навигации:
  `gotoApp`, `waitForDashboard`, `waitForQuestion`, `openSeededRun`,
  `resumeSeededRun`, `blockAnalytics`, `TESTID`;
- BACKUP: `playwright.config.ts` + `e2e/` (21 файл) →
  `.project/drafts/backup/2026-10-04-visual-testing/`.

## Цель

1. **Visual regression:** baseline PNG для экранов × 2 viewport'а, прогон без
   `--update` зелёный (baseline стабилен).
2. **Accessibility:** axe-core (WCAG 2.1 AA) на тех же экранах, violations
   зафиксированы в baseline и сравниваются между прогонами.
3. **Design-audit:** отчёт со списком UI/a11y-проблем с `file:line`, top-5 —
   капитану.

**НЕ входит:** фиксы UI-проблем (только детекция + отчёт), визуальные тесты
анимаций/транзишенов, кросс-браузерные проекты (chromium only, как и весь e2e),
light/dark как отдельные baseline'ы (тема фиксируется), CI-настройка снапшотов под
Linux (фиксируется в отчёте как ограничение).

## Что делаем

### 1. Спека и зависимости

- `.project/specs/074-visual-a11y-testing.md` (этот файл), `status: approved` по
  embedded approve капитана (правило 2, F5.0a).
- `@axe-core/playwright` — **единственная** новая зависимость (devDependency,
  авторизована капитаном в задании).

### 2. `playwright.config.ts`

Блок `expect.toHaveScreenshot`: `maxDiffPixelRatio: 0.01`, `threshold: 0.2`,
`animations: 'disabled'`.

### 3. Freeze time

`e2e/fixtures.ts` → экспортируемый хелпер `freezeClock(page)` на
`page.clock.setFixedTime(new Date('2026-10-04T12:00:00Z'))`.

**Отклонение от буквы задания (обосновано):** clock ставится **не** глобальной
авто-фикстурой, а хелпером, который вызывают оба новых спека. Глобальный clock
заморозил бы `Date.now()` во **всех 111** существующих сценариях, включая таймер
экзамена (`ExamRun.tsx` считает `elapsed = Date.now() - startedAt`): при
фиксированном времени `elapsed` навсегда равен нулю, и сценарии истечения таймера
стали бы ложными. Задание требует «freeze time в `e2e/fixtures.ts`» — хелпер живёт
там; существующие сценарии не затронуты.

### 4. `e2e/visual-regression.spec.ts`

- Viewport'ы: **390×844** (mobile) и **1440×900** (desktop) — только два.
- Экраны: все 8 «рабочих» из `Screen` (`dashboard`, `question`, `results`,
  `exam-setup`, `exam-run`, `exam-results`, `analytics`, `paywall`) — оба
  viewport'а; 3 онбординг-экрана (`onboarding-goal`, `onboarding-demo`,
  `onboarding-result`) — только mobile (целевая аудитория Mini App).
  Итого **19** baseline PNG.
- Для каждого: сид существующими fixtures → `await document.fonts.ready` →
  маски динамики (`exam-timer`, `streak-count`, `daily-goal`, `todayXp`, любые
  `[data-testid*="timer"]`) → `toHaveScreenshot('<screen>-<vp>.png')`.
- Тема и `colorScheme` фиксируются (`light`), иначе снапшот зависел бы от
  системной схемы машины.

### 5. `e2e/accessibility.spec.ts`

- `AxeBuilder` с тегами `['wcag2a', 'wcag2aa', 'wcag21aa']`.
- Первый прогон: violations пишутся в `.project/drafts/a11y-baseline.json`
  (тест **не падает**).
- Последующие: сравнение с baseline; падение **только** на новых
  `critical`/`serious` (известные — в отчёт, не в падение).
- Сводка по каждому экрану → `.project/drafts/a11y-report.json`.

### 6. Baselines

- Прогон 1: `npx playwright test visual-regression.spec.ts --update-snapshots`.
- Прогон 2 (обязателен): без `--update` → baseline должен быть зелёным.
- Нестабильный baseline не коммитится: правка масок/ожиданий до зелёного.
- Платформенный суффикс Playwright (`-win32`/`-linux`): на MVP коммитится
  **разработческий** baseline (Windows); Linux-снапшоты — отдельная задача CI.

### 7. Design-audit

`.project/drafts/design-audit-2026-10-04.md`: читаемость (color-contrast,
aria-label, top-10, `file:line`, severity), консистентность (одна роль — разные
цвета/размеры), layout (overflow/обрезанный текст/элементы вне viewport),
приоритеты Critical/High/Medium/Low, top-5 капитану.

## Результат (2026-10-04)

**Инфраструктура (коммит `703e14d`):**

- 19 baseline PNG (`e2e/visual-regression.spec.ts-snapshots/`, 386 КБ суммарно,
  от 11 КБ до 49 КБ на файл; платформенный суффикс `-win32`) — 8 рабочих экранов ×
  2 viewport'а + 3 онбординг-экрана × mobile;
- **прогон 1** `--update-snapshots`: 19 passed (45.3 с) → baseline создан;
- **прогон 2** без `--update`: **19 passed, exit 0** (39.2 с) → baseline стабилен,
  правка масок/задержек не потребовалась;
- `e2e/accessibility.spec.ts`: 19 состояний, axe-core 4.13.0, теги
  `wcag2a`,`wcag2aa`,`wcag21aa`; **15 нарушений, все `color-contrast` уровня
  `serious`** (critical 0), распределены по 15 состояниям из 19; `question-*` и
  `results-*` — чисто;
- первый прогон создал `.project/drafts/a11y-baseline.json` (не падая),
  повторный в режиме `compare` — **19 passed, exit 0** (`newBlocking = 0`);
- e2e-набор: **111 → 149** (`+19` visual, `+19` a11y); unit — **442 passed**;
  `typecheck` / `build` / `test:e2e` — exit 0;
- design-audit: `.project/drafts/design-audit-2026-10-04.md`, top-5 — в отчёте
  капитану.

**Отклонения от буквы задания (все обоснованы, ничего не скрыто):**

1. `freezeClock` — **хелпер в `e2e/fixtures.ts`**, а не глобальная авто-фикстура:
   замороженный `Date.now` во всех 111 существующих сценариях обнулил бы
   `elapsed` таймера экзамена и сделал бы ложными проверки его истечения.
2. Добавлен третий файл — `e2e/screens.ts` (рецепты состояний экранов): visual и
   a11y обязаны снимать ОДНО состояние, дублирование 200 строк в двух спеках
   разошлось бы при первой же правке.
3. `playwright.config.ts`: к прежнему содержимому добавлен только блок
   `expect.toHaveScreenshot`; заодно нормализован финальный перевод строки
   (правило 16 — файл заканчивался байтом `;`, а не `0x0A`).
4. Linux-снапшоты для CI не сняты (MVP): коммитится разработческий baseline
   (`-win32`). На Linux-раннере `toHaveScreenshot` потребует своего набора —
   отдельная задача; ограничение зафиксировано, а не замаскировано.
5. Пиксельный анализ PNG в сессии недоступен (нет vision-адаптера), поэтому
   layout-часть аудита построена на замерах DOM (`.project/drafts/layout-probe-2026-10-04.json`),
   а не на разглядывании картинок. Для «элемент вне вьюпорта» / «текст шире
   контейнера» это более строгое измерение, чем глаз.
6. Динамика маскируется реальными `data-testid` (`exam-timer`, `streak-badge`,
   `xp-bar`, `retention-goal-line`, `[data-testid*="timer"]`): в задании перечислены
   концептуальные имена (`streak-count`, `daily-goal`, `todayXp`), в коде им
   соответствуют именно эти узлы.

## Критерии приёмки

- [ ] `.project/specs/074-visual-a11y-testing.md` существует, frontmatter
      `status: approved`, `track: full`, `embedded_approve: rule 2`.
- [ ] `@axe-core/playwright` — единственная новая запись в `package.json`;
      других изменений в `dependencies`/`devDependencies` нет.
- [ ] `playwright.config.ts` содержит `expect.toHaveScreenshot` с
      `maxDiffPixelRatio: 0.01`, `threshold: 0.2`, `animations: 'disabled'`.
- [ ] `e2e/visual-regression.spec.ts` покрывает 8 экранов × 2 viewport'а + 3
      онбординг-экрана × mobile = **19** проверок.
- [ ] Прогон 1 с `--update-snapshots` создаёт **19** PNG, прогон 2 без `--update`
      — **exit 0** (baseline стабилен).
- [ ] Динамика замаскирована (`exam-timer`, `streak-count`, `daily-goal`,
      `todayXp`, `[data-testid*="timer"]`); `document.fonts.ready` ожидается.
- [ ] `e2e/accessibility.spec.ts` использует теги `wcag2a`,`wcag2aa`,`wcag21aa`;
      первый прогон пишет `.project/drafts/a11y-baseline.json` и **не падает**;
      повторный — падает только на **новых** critical/serious.
- [ ] `.project/drafts/a11y-report.json` содержит разбивку по каждому экрану.
- [ ] `.project/drafts/design-audit-2026-10-04.md` содержит top-5 проблем с
      `file:line` и severity.
- [ ] **UI не фиксился:** `git diff` не содержит изменений
      `src/presentation/**`, `src/store/**`, `src/domain/**`, `src/platform/**`.
- [ ] `data-testid` не изменены (новые не добавлялись).
- [ ] Гейты `typecheck`, `test:run`, `test:e2e`, `build` — exit 0; e2e-набор
      вырос на 19 visual + a11y-сценарии, существующие 111 — без регрессий.
- [ ] EOL правленых `.ts`/`.md`: `i/lf w/lf`, последний байт `0x0A` (правило 16).
- [ ] Коммиты: `test(spec-074): …` (config + specs + baselines),
      `docs(spec-074): design + a11y audit`, `chore(state): converge after spec-074`;
      `sync:check` = 0.
- [ ] frontmatter `status: done`, `commit <feat-SHA>`; запись в `.project/log.md`.
- [ ] `mas-runs.json`, `.captain-session-id`, `*.tmp.spec.ts` **не** закоммичены.
- [ ] **Push НЕ выполнен** (правило 10: per-command авторизация капитана).

## Проверка (сигналы критериев)

```powershell
npx playwright test e2e/visual-regression.spec.ts --update-snapshots   # 19 PNG
npx playwright test e2e/visual-regression.spec.ts                      # exit 0
npx playwright test e2e/accessibility.spec.ts                          # baseline + report
npm run typecheck; npm run test:run; npm run test:e2e; npm run build   # 0
git ls-files --eol <правленые .ts/.md>                                 # i/lf w/lf, 0x0A
npm run sync:check                                                     # 0
```

## Что НЕ трогать

- `src/data/**`, `tools/**`, `.project/sync.mjs`, `.project/ORCH-RULES.md`,
  `backend/**`, `src/domain/**`, `src/store/**`, `src/presentation/**`,
  `src/platform/**` — ноль правок (детекция, не фикс);
- существующие `e2e/*.spec.ts` (кроме `fixtures.ts` — там только аддитивный
  хелпер `freezeClock` + маски);
- `data-testid` (новые не добавляются, существующие не меняются);
- `vite.config.ts`, `vitest.config.ts`, `tsconfig*.json`;
- в git не попадают: `.project/mas-runs.json`, `.project/.captain-session-id`,
  `e2e/*.tmp.spec.ts`, `.agent-teams/**`.
