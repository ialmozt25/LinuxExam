---
id: 079
slug: contrast-fix
type: fix
track: small
status: approved
created: 2026-10-04
updated: 2026-10-04
commit: pending
embedded_approve: rule 2 (F5.0a — 2026-10-04)
execution: direct
---

## Контекст

`npm run check` (spec 077) держит два критичных критерия контраста. На прогоне
2026-10-04: **23 pass / 6 fail**, `COLOR-001` = 33 узла axe на 19 экранах,
`COLOR-003` = 20 узлов на 10 экранах, exit 1. Проверяльщик спек фиксирует источник
как `.project/drafts/a11y-baseline.json` (axe-core, WCAG 2.1 A/AA, порог 4.5:1
для обычного текста).

Спека закрывает **4 пользовательских сценария** (7 DOM-узлов × 2 вьюпорта), которые
капитаном названы как цель:

| # | элемент | было | где |
|---|---|---|---|
| F1 | accent-button (белый на акценте) | 3.12 | `exam-submit`, `back-to-dashboard`, `exam-start`, `paywall-start-trial` |
| F2 | `paywall-badge-free` | 2.59 | Dashboard, бейдж темы на `--bg-elevated` |
| F3 | `review-wrong` (счётчик «N вопр.») | 3.96 | Dashboard, подложка `rgba(244,67,54,0.1)` |
| F4 | `topic-first-cta` («начните с этой») | 4.14 | Dashboard, бейдж на `--bg-elevated` |

Вне scope (не является целью спеки): 6 узлов `2.52` — отладочный DEV-оверлей
(`#666` на `rgba(0,0,0,0.3)`), он не существует в production-сборке
(подтверждено spec 078); 13 узлов — тот же синий акцент, что и F1/F2, на
экранах `question`, `results`, `onboarding-*`, и он закрывается тем же токеном.

## Решение

### F1 — акцентный синий (одна точка, 5 экранов)

`--accent` был `var(--tg-theme-button-color, #2196F3)`. Белый текст на `#2196F3` —
3.12:1. Вводится новый примитив **`--color-accent-strong: #1565C0`**, на который
переводится фолбэк `--accent`.

| пара | было | стало |
|---|---|---|
| белый текст на заливке | 3.12 | **5.75** |
| синий как ТЕКСТ на белом (`«N вопр.»`, `paywall-badge-pro`) | 3.12 | **5.75** |
| синий как ТЕКСТ на `--bg-elevated` #EAEAEA (`paywall-badge-free`) | 2.59 | **4.78** |
| синий как ТЕКСТ на `--bg-primary` #F5F5F5 | 2.87 | **5.27** |

Причина, по которой меняется именно ТОКЕН, а не 5 файлов: `--accent` в одном
экране одновременно является заливкой кнопки (нужен тёмный) и цветом текста на
светлой поверхности (тоже нужен тёмный). Правка одной строки чинит все пары
сразу и не даёт элементам разъехаться в будущем — ровно то, ради чего в spec 065
заведены компонентные роли.

Явные заливки `var(--color-accent-strong)` проставлены в 5 файлах (требование
задания «применить фон = --color-accent-strong»): `ExamRun.tsx` (`exam-submit`),
`ExamResults.tsx` (`back-to-dashboard`), `ExamSetup.tsx` (`exam-start`),
`Paywall.tsx` (`paywall-start-trial`), `Dashboard.tsx` (бейдж и счётчик).
Текст остаётся `--btn-primary-text` = `--color-white`.

### F2/F3/F4 — точечные тёмные роли в tokens.css

`--success`/`--danger` **НЕ меняются**: их значения жёстко проверяются в e2e
(`color-regression.spec.ts:8-9`, `quiz-flow.spec.ts:393-396`), а изменение размера
шрифта `12px → 14px` порог не снимает — по WCAG/axe 14px/600 остаётся «обычным
текстом» (крупный — от 18pt, либо от 14pt при bold), то есть 4.5:1 всё равно нужен.
Тёмные оттенки заведены у владельца палитры (tokens.css), а не в TSX: критерий
`COLOR-004` запрещает hex в `src/presentation/**` вне tokens.css.

- **F2** `paywall-badge-free`: маска → `var(--color-accent-strong)` (2.59 → 4.78).
- **F3** `review-wrong`: `var(--text-xs)` → `var(--text-sm)` + `fontWeight: 600`
  (как требует задание) и цвет → `var(--color-danger-strong)` (3.97 → 5.28 на
  подложке, 5.43 на светлой плашке).
- **F4** `topic-first-cta`: цвет → `var(--color-success-strong)` (4.15 → 5.35).

### F5 (побочный, найден прогонами axe) — тёмный текст на акцентной заливке

Смена значения `--accent` обнажила вторую семью дефектов: четыре поверхности
красили текст ролью `--text-primary` (в светлой теме — тёмный) поверх акцентной
заливки. Правка в 3 строках делает текст белым — как у всех остальных акцентных
кнопок приложения (единый паттерн `btn-primary`):

| место | было | стало |
|---|---|---|
| `Dashboard.tsx` `PRIMARY_CTA` (`review-today`, `start-learning`) | 2.88 | **5.75** |
| `Dashboard.tsx` `dashboard-continue` | 2.88 | **5.75** |
| `Question.tsx` `next-button` (enabled) | 2.88 | **5.75** |
| `OnboardingDemo.tsx` `onboarding-demo-next` (enabled) | 2.88 | **5.75** |

Disabled-ветки этих кнопок (фон `--bg-surface`) получают тёмный
`--text-secondary`: белый на белом дал бы 1.03:1.

## Приёмка

1. `npm run check`: `COLOR-003` → 0 продуктовых узлов (было 20); `COLOR-001` →
   13 узлов (было 33), все 13 — DEV-оверлей (см. «Ограничения»).
2. `e2e/regression-079.spec.ts` (новый): 5 ассертов axe ≥ 4.5 на целях спеки.
3. Регенерация 19 baseline PNG (`--update-snapshots=all`) + прогон 2 → 19 passed.
4. Гейты = baseline: typecheck 0 / test:run 442 / test:e2e 208+5 / build 0.
5. `sync:check` = 0; push — STOP, выполняет капитан.

## Ограничения

- Не трогать: `domain/**`, `store/**`, `src/data/**`, `tools/**`, `sync.mjs`,
  `ORCH-RULES.md`, `backend/**`, `playwright.config.ts`, существующие `e2e/*.spec.ts`.
- Минимальные правки: компоненты не переписываются, меняются только цвета/размеры.
- **`COLOR-001` остаётся fail по 13 узлам DEV-оверлея.** Это не продуктовый
  дефект: оверлей рендерится только при `import.meta.env.DEV`
  (`src/App.tsx:116-133`) и уже классифицирован как ложный critical в spec 078.
  Visual-стенд смотрит на preview-сборку (оверлея нет), axe-стенд — на `stand-dev`
  (`npm run dev`), поэтому в `a11y-baseline.json` он есть. Для pass нужно либо
  снимать axe с preview-сборки, либо принять оверлей исключением — обе правки
  шире этой спеки (меняют стенд/чек-лист) и требуют решения капитана.
- Остальные 4 fail (`TYPO-001/002`, `SPACE-001/002`) — вне цели спеки, их счёт
  не изменился (2 / 1 / 2 / 5).
