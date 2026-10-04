---
id: 076
slug: critical-ui-fixes
type: fix
track: small
status: done
created: 2026-10-04
updated: 2026-10-04
commit: 848704e
embedded_approve: rule 2 (F5.0a — 2026-10-04)
execution: direct
---

## Контекст

Проба `e2e/layout-smoke.spec.ts` (spec 075) зафиксировала **27 нарушений** вёрстки
в **6 корневых причинах** (`.project/drafts/layout-probe-075.json`, 55 комбинаций
= 11 экранов × 5 viewport'ов). Распределение по корням:

| # | file:line | класс | случаев | приоритет |
|---|---|---|---|---|
| 1 | `Paywall.tsx:102` | `escaped-element` — шапка выше кромки (`top` −12…−188) | 8 | **P0 — деньги** |
| 2 | `Paywall.tsx:267` | `cta-out-of-viewport` — `paywall-start-trial` | 3 | **P0 — деньги** |
| 3 | `Paywall.tsx:288` | `cta-out-of-viewport` — `paywall-buy` | 3 | **P0 — деньги** |
| 4 | `Dashboard.tsx:800` | `cta-out-of-viewport` — `dashboard-continue` | 5 | P1 — activation |
| 5 | `ExamResults.tsx:152` | `cta-out-of-viewport` — `back-to-dashboard` | 3 | P2 — UX |
| 6 | `ExamRun.tsx:247` | `touch-target` — `exam-cancel` 360×34 < 44 px | 5 | P3 — WCAG |

**Почему P0.** Paywall — единственный экран, который прямо конвертирует деньги.
`paywall-buy` («Купить за N Stars») и `paywall-start-trial» оставались за сгибом
на высотах 640–915 px: пользователь не мог нажать кнопку покупки, не догадавшись
прокрутить экран, то есть **теряем оплату**. Корень 1 — тот же дефект с другой
стороны: `justifyContent: 'center'` на корневом контейнере выдавливал контент в
**обе** стороны — шапка уходила выше верхней кромки вьюпорта (8 случаев),
одновременно утягивая CTA вниз.

**PRE-CHECK (read-only):**

- `.project/specs/076*.md` → **False** (спеки не было; последняя — `075`);
- 6 корней прочитаны из `.project/drafts/layout-probe-075.json`
  (`totals`: 55 комбинаций, 27 нарушений, 27 known, **0 fresh**) и сверены с
  `_probe075-report.json`;
- `e2e/layout-smoke.spec.ts`: `KNOWN_ISSUES` — **7 записей** (`dashboard-continue`,
  `paywall-buy`, `paywall-start-trial`, `exam-cancel`, `back-to-dashboard`,
  `header-home`, `app-header-center`); ключ реестра — `экран + проверка + testid`;
- BACKUP: `Paywall.tsx`, `Dashboard.tsx`, `ExamResults.tsx`, `ExamRun.tsx` →
  `.project/drafts/backup/2026-10-04-critical-fix/`;
- Механика гейта: нарушение в реестре → `test.fixme(true, reason)` (skipped);
  нарушение вне реестра → красный тест. После фиксов skipped = 0 ожидаемо.

## Цель

Все **6 корневых причин** закрыты, реестр `KNOWN_ISSUES` обнулён, `layout-smoke`
проходит **55 passed / 0 skipped**, существующие гейты зелёные.

**НЕ входит:** axe-core контраст (отдельная spec 078), чек-лист ручной приёмки,
маркетинг, обновление baseline PNG spec 074, правки домена/store/data.

## Что делаем

### F1 — `Paywall.tsx:102` (P0, закрывает корни 1 и переводит 2-3 в футер)

Снять `justifyContent: 'center'` у корневого `ScreenContainer` (spec 063).
Колонка по умолчанию — `flex-start`; отдельный `paddingTop` не нужен, верхний
отступ уже даёт `ScreenContainer` (`--space-4 + --safe-top`), иначе он удвоился бы.

**Замер после F1** (diagnostic probe, те же селекторы и то же предусловие
`rootToTop`, что в `layout-smoke`): `escaped-element` **8 → 0** на всех размерах;
CTA перестали быть «обрезанными» на 412×915 и desktop. Но контент Paywall
(~994 px) выше вьюпорта bottom sheet, поэтому `paywall-buy` остался за сгибом на
360–390 px (`top` 906–936 при 640–720) — чисто потоковым фиксом цель недостижима.

### F2 — `Paywall.tsx:267,288` (P0): действия в fixed-футер

Кнопки `paywall-start-trial` + `paywall-buy` + `paywall-later` вынесены в
fixed-футер по образцу spec 070 (`Question.tsx`, `ExamRun.tsx`): `position: fixed`,
`bottom: 0`, `zIndex: FIXED_FOOTER_Z_INDEX` (50), `paddingBottom` c
`env(safe-area-inset-bottom)`, `borderTop`, плюс распорка `FIXED_FOOTER_SPACER`
после контента (высота футера публикуется в `--fixed-footer-h` через
`useFixedFooterPadding`). Горизонтальные отступы повторяют `ScreenContainer`
(`--space-4 + --safe-left/right`). `data-testid` не менялись.

### F3 — `Dashboard.tsx:800` (P1): CTA в fixed-футер

`dashboard-continue` стоит после всего контента дашборда → в потоке оказывался на
y=1904…2027 (вне вьюпорта на всех 5 размерах). Переведён в fixed-футер тем же
образом; распорка рендерится под тем же гейтом `!mainButtonReady`, что и футер
(spec 072), чтобы дисклеймер и `DailyGoalPicker` доскролливались из-под кнопки.
Дашборд целиком не переписывался — правка локализована кнопкой.

### F4 — `ExamResults.tsx:152` (P2): CTA в fixed-футер

`back-to-dashboard` после разбора по темам → y=795…851, за сгибом на 640–720.
Тот же приём, что F3.

### F5 — `ExamRun.tsx:247` (P3): тач-цель ≥ 44 px

`exam-cancel` («Прервать и выйти») имел 360×34 px: `padding: var(--space-2)` +
`font-size: var(--text-xs)`. Добавлены `minHeight: 44` + flex-центрирование
(текст по центру, футер не раздувается за счёт увеличения padding).

**Лимит:** 2 попытки на фикс. Побочно найденное и устранённое: при переносе
`paywall-later` в футер его padding был уменьшен до `SPACING.sm` — высота падала
до 37 px и создавала **новое** нарушение `touch-target`; padding возвращён к
`SPACING.md` (проверено пробой: `small=0`).

## Результат (2026-10-04)

**Замеры после фиксов** (diagnostic probe по 4 экранам × 6 размеров, включая
390×844 — viewport baseline spec 074):

| экран | CTA вне вьюпорта | escaped-element | тач-цели < 44 | minCtaH |
|---|---|---|---|---|
| dashboard | 0 (было 5) | 0 | 0 | 56 |
| paywall | 0 (было 6 + 8 escaped) | 0 (было 8) | 0 | 56 |
| exam-results | 0 (было 3) | 0 | 0 | 56 |
| exam-run | 0 | 0 | 0 (было 5, 34 px) | **44** |

**Гейты:** `typecheck` 0 · `test:run` 442 passed / 0 · `test:e2e` (заполняется
прогоном ФАЗЫ 4) · `build` 0 · `sync:check` 0.

**ФИКСЫ UNVERIFIED до ручной проверки на телефоне**: проба воспроизводит
геометрию в Chromium с `isTMA() === false`, а не живой Telegram WebView. На
устройстве нужно повторно проверить, что денежный CTA Paywall виден без
прокрутки и нажимается, а нативный MainButton не перекрывает fixed-футер
(в TMA `ScreenContainer` резервирует `--mainbutton-height + --mainbutton-gap`).

## Критерии приёмки

- [ ] `.project/specs/076-critical-ui-fixes.md` существует, frontmatter
      `status: approved`, `type: fix`, `track: small`,
      `embedded_approve: rule 2`.
- [ ] 6 корневых причин закрыты: `Paywall.tsx:102/267/288`,
      `Dashboard.tsx:800`, `ExamResults.tsx:152`, `ExamRun.tsx:247`.
- [ ] `KNOWN_ISSUES` в `e2e/layout-smoke.spec.ts` = `[]`.
- [ ] `npx playwright test e2e/layout-smoke.spec.ts` → **55 passed / 0 skipped**.
- [ ] `data-testid` не изменены; `Paywall.tsx`/`Dashboard.tsx` не переписаны
      целиком (минимальный дифф).
- [ ] Гейты `typecheck`, `test:run`, `test:e2e`, `build` — exit 0.
- [ ] EOL правленых `.ts`/`.md`: `i/lf w/lf`, последний байт `0x0A` (правило 16).
- [ ] Коммиты: `fix(spec-076): …`, `chore(state): converge after spec-076`,
      `chore(state): converge`; `sync:check` = 0.
- [ ] frontmatter `status: done`, `commit <feat-SHA>`; запись в `.project/log.md`.
- [ ] `mas-runs.json`, `.captain-session-id`, `*.tmp.spec.ts` не закоммичены.
- [ ] Push выполнен **один раз** (rule 10, авторизация капитана).

## Проверка (сигналы критериев)

```powershell
npx playwright test e2e/layout-smoke.spec.ts    # 55 passed / 0 skipped
npm run typecheck; npm run test:run; npm run test:e2e; npm run build   # 0
git ls-files --eol src/presentation/screens/Paywall.tsx e2e/layout-smoke.spec.ts  # i/lf w/lf, 0x0A
npm run sync:check                              # 0
```

## Что НЕ трогать

- axe-core контраст (spec 078), чек-лист, маркетинг;
- baseline PNG spec 074 (`e2e/visual-regression.spec.ts-snapshots/**`);
- `domain/**`, `store/**`, `src/data/**`, `tools/**`, `.project/sync.mjs`,
  `.project/ORCH-RULES.md`, `backend/**`;
- `data-testid`; в git не попадают `.project/mas-runs.json`,
  `.project/.captain-session-id`, `e2e/*.tmp.spec.ts`.
