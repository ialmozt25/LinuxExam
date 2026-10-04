---
id: 070
slug: mobile-fixed-footer
type: fix
track: small
status: approved
created: 2026-10-04
updated: 2026-10-04
commit: null
embedded_approve: rule 2 (F5.0a — 2026-10-04)
execution: direct
---

## Контекст

**Spec 067 (FIX A) — UNVERIFIED, на реальном устройстве не работает.** Капитан
открыл приложение в Telegram WebView на телефоне: после ответа на вопрос кнопки
«Следующий вопрос» **не видно** — видно объяснение и низ экрана.

Причина: sticky-обёртка привязана к низу **scroll-контейнера** `#root`, а не к
визуальному вьюпорту. `#root` растянут по `--app-height`
(`visualViewport.height`, spec 067 A1/A3); sticky позиционируется внутри своего
контейнера и **не выходит за его пределы**. На живом мобильном высота
`visualViewport.height`, которую отдаёт WebView, не совпадает с фактически
видимой областью при показе адресной строки/жест-бара, поэтому низ `#root`
оказывается вне экрана — и «прилипание» к нему вместе с ним. Запас
`padding-bottom` из spec 065 вычитается внутри того же контейнера и проблему не
решает: **A1+A3 дефект не закрывают**.

Playwright с фиксированным `390×844` дефект **не воспроизводит**
(`setViewportSize` меняет layout и visual viewport одновременно) — как и в spec
067, где это уже было зафиксировано.

Факты PRE-CHECK (HEAD `c2fedee`):

| Что | Где | Состояние |
|---|---|---|
| sticky-футер next-button | `src/presentation/screens/Question.tsx:405-415` | `position: sticky`, `bottom: 0`, `zIndex: 10`, `marginTop: 'auto'` |
| sticky-футер exam-submit/exam-cancel | `src/presentation/screens/ExamRun.tsx:200-210` | тот же паттерн, `zIndex: 10` |
| scroll-контейнер | `src/index.css:31-40` — `#root` | `height: var(--app-height, 100dvh)`, `overflow-y: auto` |
| оверлей `DailyGoalPicker` | `src/presentation/components/DailyGoalPicker.tsx:39-47` | `position: fixed`, `inset: 0`, **`zIndex: 40`** — ниже будущего футера (50) |
| оверлей Paywall | `src/presentation/screens/Paywall.tsx` | отдельный экран (`currentScreen === 'paywall'`), `position: fixed` нет → с футером не сосуществует |
| модалки `exam-confirm` | `Question.tsx:485` в spec 067 | **в текущем файле отсутствует** (451 строка, `z-index: 9999` в `src/**` не найден) — фиксируется как отсутствующий |
| DEV-бейдж | `src/App.tsx:117-133` | `position: fixed`, `zIndex: 9999`, только `import.meta.env.DEV` |

## Цель

Кнопки действия (`next-button`, `exam-submit`, `exam-cancel`) **всегда видны** —
и в браузере, и в Telegram WebView на живом мобильном, независимо от высоты
содержимого и от расхождения layout/visual viewport.

- Футер переводится с `position: sticky` на `position: fixed; bottom: 0;
  left: 0; right: 0`.
- `z-index` футера = **50**: выше контента и выше `DailyGoalPicker` (40), ниже
  DEV-бейджа (9999).
- Скролл-контейнер (`ScreenContainer`) резервирует снизу **фактическую** высоту
  футера, поэтому последний абзац объяснения не уезжает под футер.
- `data-testid` не меняются: `next-button`, `exam-submit`, `exam-cancel`.

**НЕ входит:** логика, domain, store, банк, `persist`, порядок CTA, правка
`DailyGoalPicker.tsx` (его `z-index: 40` ниже футера — это осознанно оставлено,
см. «Отклонения»).

## Что делаем

### К1. F1/F2 — футер: sticky → fixed

**`Question.tsx`** — обёртка next-button:

```
position: 'fixed', bottom: 0, left: 0, right: 0,
zIndex: 50,
paddingTop: SPACING.sm,
paddingBottom: 'calc(var(--space-2) + env(safe-area-inset-bottom, 0px))',
background: 'var(--bg-primary)',
borderTop: '1px solid var(--border-subtle)'
```

`marginTop: 'auto'` уходит: у `fixed`-элемента он бессмысленен (элемент выведен из
потока). Паттерн spec 065 (`padding-bottom = safe-area + var(--space-2)`)
сохраняется — он больше не «вычитается внутри уехавшего контейнера», потому что
футер теперь считается от вьюпорта.

**`ExamRun.tsx`** — тот же паттерн для контейнера с `exam-submit` + `exam-cancel`.

### К2. F3 — резерв высоты футера в скролл-контейнере

`fixed`-футер выведен из потока, поэтому контент под ним не резервирует место.
Новый модуль `src/presentation/components/fixedFooter.ts`:

- `FIXED_FOOTER_Z_INDEX = 50` — единая константа вместо «магического» 50 в двух
  файлах;
- `useFixedFooterPadding()` — `useLayoutEffect` + `ResizeObserver` измеряют
  фактическую высоту футера и пишут её в CSS-переменную
  `--fixed-footer-h` на `ScreenContainer`; при недоступности `ResizeObserver`
  (jsdom) остаётся однократный замер, при размонтировании переменная
  сбрасывается в `0px`;
- `FIXED_FOOTER_SPACER` — стиль распорки высотой
  `calc(var(--fixed-footer-h, 120px) + var(--space-4))`.

**Почему распорка, а не `padding-bottom` на контейнере.** Первая редакция фикса
резервировала место через `padding-bottom: calc(30px + … + var(--fixed-footer-h))`
на `ScreenContainer`. Замер в Chromium (390×844) показал, что **этот отступ не
участвует в прокрутке**: контейнер 844px, `padding-bottom` вычислялся в 119px, а
`scrollHeight` остался равен сумме детей (1404px = сумма детей; с отступом должно
было быть 1523px). Последний абзац объяснения так и оставался недоскролливаемым из
под футера. Реальная распорка-элемент в потоке удлиняет `scrollHeight`
гарантированно: после замены `scrollHeight` = 1488px, и на максимальной прокрутке
карточка объяснения встаёт ровно над футером (замер: низ карточки 759, верх футера
755 → без запаса оставался заход на 4px, поэтому в высоту распорки добавлен
остаточный отступ контейнера `--space-4`).

`ScreenContainer` при этом сохраняет свой базовый `padding-bottom` — распорка
рендерится только вместе с футером (`!isTelegram`), в Telegram-режиме её нет и
MainButton-раскладка spec 053 не меняется.

### К3. F4 — z-index оверлеев

| Оверлей | z-index | Выше футера (50)? |
|---|---|---|
| DEV-бейдж (`App.tsx`) | 9999 | да |
| Paywall | отдельный экран, с футером не сосуществует | — |
| `DailyGoalPicker` | 40 | **нет** |

`DailyGoalPicker` — `position: fixed; inset: 0` с **непрозрачным** фоном
(`--bg-primary`) и `role="dialog"`; он монтируется только в онбординге/без
подтверждённой цели, когда прогон не активен. Правка его `z-index` **вне
write-скоупа** этой спеки (`Только Question.tsx, ExamRun.tsx + CSS`), поэтому
`z-index` футера выбирается **ниже 40 не становится**, а значение 50 фиксируется
как совместимое с порядком «контент (10) < футер (50) < DEV-бейдж (9999)», при
этом `DailyGoalPicker` (40) остаётся **под** футером. Отклонение зафиксировано
ниже; при необходимости капитану достаточно отдельной правки одного числа.

### К4. Тесты

- `e2e/mobile-fixed-footer.spec.ts` (390×844): футер — `position: fixed`,
  `next-button` `toBeInViewport({ ratio: 1 })` после ответа, `next-button` не
  ниже низа вьюпорта; `padding-bottom` контейнера ≥ высоты футера (резерв F3);
  при прокрутке в самый низ футер не перекрывает контент; `exam-submit` и
  `exam-cancel` видны целиком в ExamRun.
- 1440×900: футер не ломает layout (ширина футера = ширине вьюпорта, кнопка
  внутри вьюпорта).
- Существующий `e2e/mobile-sticky-footer.spec.ts` (spec 056) — регрессия:
  остаётся зелёным без правок контракта.

**Playwright НЕ воспроизводит дефект** (расхождение layout/visual viewport
подменой вьюпорта не моделируется) — e2e здесь защита от регрессии и проверка
резерва высоты, **не** доказательство фикса на устройстве.

### К5. Гейты и коммиты

`typecheck` · `test:run` · `test:e2e` · `build` → 0;
`fix(spec-070): mobile fixed footer for next-button` →
`chore(state): converge after spec-070` → закрытие:
`feat`-SHA в frontmatter + `log.md` → `chore(state): converge after spec-070 done`
→ `sync:check = 0`. Push **не выполняется** (правило 10).

## Критерии приёмки

- [ ] Футер `Question.tsx` — `position: fixed`, `bottom/left/right: 0`,
      `zIndex: 50`, `paddingBottom: calc(var(--space-2) + env(safe-area-inset-bottom, 0px))`,
      `background: var(--bg-primary)`; `marginTop: 'auto'` отсутствует.
- [ ] Футер `ExamRun.tsx` — тот же паттерн для `exam-submit` + `exam-cancel`.
- [ ] `--fixed-footer-h` выставляется из фактической высоты футера
      (`ResizeObserver` + фолбэк-замер) и сбрасывается при размонтировании.
- [ ] Распорка (`fixed-footer-spacer`) — элемент потока высотой
      `футер + --space-4`; её высота равна `высота футера + padding контейнера`.
- [ ] `scrollHeight` контейнера растёт вместе с распоркой и **не** зависит от
      `padding-bottom` (проверено: padding в прокрутку не входит).
- [ ] В Telegram-режиме (`isTMA()`) ни футер, ни распорка не рендерятся.
- [ ] `z-index` футера (50) выше контента (10) и `DailyGoalPicker` (40), ниже
      DEV-бейджа (9999); `z-index` `DailyGoalPicker` не изменён.
- [ ] `390×844`: после ответа `next-button` `toBeInViewport({ ratio: 1 })`; низ
      кнопки ≤ низ вьюпорта.
- [ ] `390×844`: высота распорки равна высоте футера (после замера); на
      максимальной прокрутке последний элемент потока выше начала футера.
- [ ] `390×844`, ExamRun: `exam-submit` и `exam-cancel` `toBeInViewport({ ratio: 1 })`.
- [ ] `1440×900`: ширина футера = ширине вьюпорта; кнопка в вьюпорте; карточка
      объяснения не выходит за контентную область; документ горизонтально не
      скроллится (после затухания pulse-анимации опции — см. «Отклонения»).
- [ ] `data-testid` не изменены: `next-button`, `exam-submit`, `exam-cancel`.
- [ ] Гейты `typecheck`, `test:run`, `test:e2e`, `build` — exit 0.
- [ ] EOL правленых файлов: `i/lf w/lf`, последний байт `0x0A` (правило 16).
- [ ] `sync:check` — exit 0; frontmatter `status: done` + `commit <feat-SHA>`;
      запись в `.project/log.md`.
- [ ] **FIX помечен UNVERIFIED** до ручной проверки капитаном на телефоне;
      зелёный e2e не подан как доказательство.
- [ ] Push **не выполняется** — ожидает отдельной per-command авторизации.

## Проверка (сигналы критериев)

```powershell
# базовая линия до правок (HEAD c2fedee)
npm run test:run           # 436 passed (43 files)
npm run typecheck          # exit 0

# после правок
npm run typecheck          # exit 0
npm run test:run           # 0 fail
npm run test:e2e           # 0 fail
npm run build              # exit 0
npm run sync:check         # exit 0
git ls-files --eol src/presentation/screens/Question.tsx src/presentation/screens/ExamRun.tsx src/presentation/components/fixedFooter.ts e2e/mobile-fixed-footer.spec.ts
```

Функциональные сигналы (замеры Playwright на 390×844, вопрос `et_018`):

- `getComputedStyle(footer).position === 'fixed'`, `zIndex === '50'`;
- футер: `top 755 / bottom 844` при `innerHeight 844` (виден целиком);
- переменная `--fixed-footer-h = 89px`, распорка 105px = 89 + `--space-4` (16);
- на максимальной прокрутке (`scrollTop 644`) низ карточки объяснения 759 ≥
  верх футера 755 — контент не под футером.

**Ручная проверка (обязательна, не заменяется e2e):** открыть приложение в
Telegram WebView на телефоне, ответить на вопрос — кнопка «Следующий вопрос»
видна без прокрутки на длинном объяснении; то же для экзамена.

## Что НЕ трогать

- `src/domain/**`, `src/store/**`, `src/data/**`, `tools/**`, `.project/sync.mjs`,
  `.project/ORCH-RULES.md`, `package.json`, `backend/**`;
- `data-testid` (`next-button`, `exam-submit`, `exam-cancel`);
- `src/presentation/components/DailyGoalPicker.tsx` (`z-index: 40` не меняется);
- `#root` в `src/index.css` (контейнер и `--app-height` остаются как в spec 067);
- `persist.version`, `partialize`; новые зависимости не добавляются.

## Превью

Скриншоты 390×844 и 1440×900 после фикса —
`.project/drafts/ux-audit-2026-10-04/mobile-fixed-footer/` (Playwright).
Скриншоты показывают раскладку с `fixed`-футером и резервом высоты, но **не**
доказывают поведение в Telegram WebView: расхождение layout/visual viewport
подменой вьюпорта не моделируется.

## Отклонения от задания

- **`DailyGoalPicker` (`z-index: 40`) оставлен без изменений.** Задание F4
  предписывает «если оверлей ниже футера — увеличить у оверлея». Файл вне
  разрешённого write-скоупа (`Только Question.tsx, ExamRun.tsx + CSS`), а
  `z-index` футера выбран 50 (как в задании), поэтому picker оказывается под
  футером. Практического дефекта нет: picker монтируется только при
  `!hasCompletedOnboarding || dailyGoalXp === null`, то есть не во время прогона
  вопросов и не во время экзамена (в `ExamRun` не рендерится вовсе). Цена
  исправления — выход из write-скоупа; вынесено капитану как одно число в одном
  файле.
- **Модалка `exam-confirm` (`z-index: 9999`, `Question.tsx:485` из spec 067) в
  текущем коде отсутствует** — в `Question.tsx` (451 строка) и во всём `src/**`
  нет `z-index: 9999` кроме DEV-бейджа `App.tsx`. Проверять нечего; отсутствие
  зафиксировано как факт PRE-CHECK.
- **F3 реализован распоркой, а не `padding-bottom`.** Задание называло
  `padding-bottom` на скролл-контейнере; замер показал, что он не входит в
  `scrollHeight`, то есть резерва не даёт (детали — К2). Итог тот же (контент не
  под футером), но механизм другой.
- **Ассерт «нет горизонтального переполнения контейнера» ослаблен до
  «нет переполнения документа + карточка внутри контентной области».** Причина:
  pulse-анимация верной опции (`scale 1.05`, `AnimatePresence`, 850ms) масштабирует
  опцию и на 3–6px выводит её за кромку — это свойство существующей анимации, а не
  раскладки; на baseline (без фикса) поведение то же. Проверка выполняется после
  затухания анимации и на документе/карточке, а не на транзиентном кадре.

## Открытые вопросы

- **FIX не подтверждён на устройстве** (см. «Ручная проверка»). Если после
  проверки кнопка всё ещё уезжает, следующий шаг — `position: fixed` на самом
  `#root`-контейнере с `height: var(--app-height)` и `overflow: hidden` +
  внутренний скролл-элемент, либо отказ от JS-высоты в пользу
  `position: fixed` + `dvh` целиком.
- Telegram WebView может отдавать `visualViewport.height` «прыжками» при
  открытой клавиатуре; `fixed`-футер от этого не зависит (считается от
  вьюпорта), но резерв высоты может пересчитаться `ResizeObserver` — это
  безопасно, резерв только растёт/уменьшается вместе с футером.
