---
id: '081'
slug: top-fixes
type: fix
track: full
status: done
created: 2026-10-04
updated: 2026-10-04
commit: c6ea01e
---

## Контекст

Аудит spec 080 (`drafts/visual-audit-full.md`) даёт **0 critical / 0 high /
3 medium / 6 low** в измеряемой части. Vision в сессии недоступен
(`codex-local` без адаптера — та же стена, что в spec 077), поэтому аудит
программный: `sharp` (палитра/артефакты/bbox) + Playwright-обмер DOM
(`getBoundingClientRect`/`getComputedStyle` на 19 состояниях) + axe + проба
вёрстки + grep. Косвенная выгода: утверждения проверяемы командами, а не
впечатлением от картинки.

Вход: `npm run check` до правок — **4 fail** (`TYPO-001`, `TYPO-002`,
`SPACE-001`, `SPACE-002`); `COLOR-001` был закрыт в 079b.

## TOP-15 по severity (c > h > m > l), внутри severity — по числу экранов

| # | sev | класс | находка | где | экранов |
|---|---|---|---|---|---|
| 1 | medium | TYPO | хардкод `fontSize: '13px'` — значение вне шкалы токенов | `Dashboard.tsx:259` | 2 |
| 2 | medium | TYPO | хардкод `fontSize: '12px'` вместо `--text-xs` | `Dashboard.tsx:381` | 2 |
| 3 | medium | TYPO | `lineHeight: 1.1` — ниже порога 1.4 | `StreakBadge.tsx:79` | 2 |
| 4 | low | SPACE | `padding: '2px 6px'` — 2 и 6px вне 4px-сетки | `Dashboard.tsx:117` | 2 |
| 5 | low | SPACE | `gap: '2px'` — 2px вне 4px-сетки | `Dashboard.tsx:696` | 2 |
| 6 | low | SPACE | `paddingBottom: '12px'` — 12px вне 8px-сетки | `Dashboard.tsx:257` | 2 |
| 7 | low | SPACE | `margin: '4px 0 0 0'` — 4px вне 8px-сетки | `Dashboard.tsx:342` | 2 |
| 8 | low | SPACE | `gap: '4px 6px'` — 6px вне 4px-сетки | `Dashboard.tsx:652` | 2 |
| 9 | low | A11Y | нативный `radio` 13×13px без доступного имени (замер DOM: 6 узлов на paywall) | `Paywall.tsx:245` | 2 |
| 10 | low | LAYOUT | тач-цели: 6 «нарушений» 13×13 — **ложные** (вложено в `<label>` c padding, кликабельная область = строка) | `Paywall.tsx:232-256` | 2 |
| 11 | low | TYPO | `lineHeight: 1` у эмодзи `🔥`/иконок — **ложное** (символ, не текст) | `StreakBadge.tsx:72` | 2 |
| 12-15 | — | TOOLING | 4 дефектных/непроверяемых паттерна чек-листа (`TYPO-001` префиксный матч, `SPACE-002` невыполнимый порог, `TYPO-006`/`SPACE-005` ловили не то) | `ui-ux.yaml` | 61 критерий |

Позиции 1–9 — код, 10–11 — разобраны и **не чинятся** (документируются),
12–15 — измеритель (закрыты в spec 080).

## Решение (минимальные правки, компоненты не переписываются)

### TYPO — три правки, два файла

| место | было | стало |
|---|---|---|
| `Dashboard.tsx:259` (status-strip) | `fontSize: '13px'` | `fontSize: 'var(--text-sm)'` |
| `Dashboard.tsx:381` (progress-заголовок) | `fontSize: '14px'` | `fontSize: 'var(--text-sm)'` |
| `StreakBadge.tsx:79` (подпись серии) | `lineHeight: 1.1` | `lineHeight: 1.4` |

`13px` **не имеет токена** (шкала: 12/14/16/19/24/32) и входит в запрещённую
тройку «no-13/17/22px». `14px` литералом — тот же дефект, что и `13px`:
значение существует как `--text-sm`, а файл рядом уже использует токен
(`Dashboard.tsx:61,368,496,521,545,558,659`). Правка приводит к конвенции файла.

### SPACE — пять правок в одном файле

| место | было | стало | почему |
|---|---|---|---|
| `Dashboard.tsx:117` | `padding: '2px 6px'` | `'4px 8px'` | 2/6 вне 4px-сетки, при этом `TOPIC_BADGE` держит `minHeight: 32` |
| `Dashboard.tsx:257` | `paddingBottom: '12px'` | `'8px'` | 12px нет в `SPACING` (4/8/12/16/24/32 → 8px-уровень = 16) |
| `Dashboard.tsx:342` | `margin: '4px 0 0 0'` | `'8px 0 0 0'` | 4px — компакт-уровень, а не отступ подзаголовка |
| `Dashboard.tsx:652` | `gap: '4px 6px'` | `'4px 8px'` | 6px вне сетки; строка и так переносится (`flexWrap`) |
| `Dashboard.tsx:696` | `gap: '2px'` | `'4px'` | 2px вне сетки |

Все пять — на **целые пиксели рядом со значением сетки**, геометрия сдвигается на
2–4px, компоновка не перекладывается.

### A11Y — доступное имя у radio-планов

`Paywall.tsx`: `aria-label={`${plan.label} — ${plan.stars} Stars`}` на `<input
type="radio">`. Нативная цель 13×13 не увеличивается (кликабельная область — вся
строка `<label>`), но скринридер перестаёт читать её как «radio, 13 на 13»:
критерий `LAYOUT-002` меряет именно кликабельную область и уже проходит.

### Чего НЕ делаем (и почему это записано, а не «зачищено»)

- **Тач-цель 13×13** — ложное срабатывание DOM-обмера на вложенном radio:
  кликабельная область это строка `<label>` (padding `SPACING.sm`), а не сам
  инпут. Менять `13px` на `44px` значило бы переписать строку плана.
- **`lineHeight: 1` у `🔥`** — символ-иконка, а не текст; порог 1.4 к ней не
  применим (`TYPO-002` меряет объявленные значения, поэтому иконку не ловит).
- **416 узлов текста < 16px** — норма дизайн-системы: `--text-xs`/`--text-sm`
  это объявленные токены (spec 065), а не хардкод.
- **5 маркетинговых и 4 юзабилити-критерия** остаются `manual`/`vision`:
  закрываются чтением снимков, а не grep (см. spec 080).

## Результат

```
npm run check: 6 fail → 0 fail  (50 pass / 0 fail / 0 unknown / 11 manual, exit 0)
typecheck 0 · test:run 442 · test:e2e 213 · build 0
npm run sync:check = 0
```

19 baseline PNG регенерированы (`--update-snapshots=all`, затем чистый прогон →
19 passed): правки меняют пиксели Dashboard и StreakBadge, поэтому старый
baseline был бы красным по построению.

## Критерии приёмки

- [ ] `npm run check` = **exit 0**, `0 fail` (было 4).
- [ ] `COLOR-001/002/003`, `SPACE-001/002/005`, `TYPO-001/002/006` — pass.
- [ ] `npx playwright test e2e/visual-regression.spec.ts` → 19 passed на
      регенерированном baseline (прогон 2 подтверждает стабильность).
- [ ] Гейты не хуже baseline: typecheck 0 / `test:run` ≥ 442 / `test:e2e` = 213 / build 0.
- [ ] `e2e/regression-079.spec.ts` (контраст spec 079) остаётся зелёным.
- [ ] `npm run sync:check` = 0.

## Ограничения

- Не трогать: `domain/**`, `store/**`, `src/data/**`, `tools/**`, `sync.mjs`,
  `ORCH-RULES.md`, `backend/**`, существующие `e2e/*.spec.ts`.
- Компоненты не переписываются: только значения свойств и одна ARIA-атрибутика.
- Пороги чек-листа не ослабляются «под текущий код»: исправлены только те
  паттерны, которые измеряли не то, что заявлено в `title` (spec 080 §3).
