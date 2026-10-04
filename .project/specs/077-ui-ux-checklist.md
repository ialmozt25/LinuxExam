---
id: 077
slug: ui-ux-checklist
type: infra
track: small
status: done
created: 2026-10-04
updated: 2026-10-04
commit: b461b14
embedded_approve: rule 2 (F5.0a — 2026-10-04)
execution: direct
---

## Контекст

Критерии UI/UX размазаны по трём прогонам сразу: `e2e/layout-smoke.spec.ts`
(spec 075 — overflow, CTA во вьюпорте, тач-цели), `e2e/visual-regression.spec.ts`
(spec 074 — 19 baseline PNG) и `.project/drafts/a11y-baseline.json`
(spec 074 — axe-core по 19 экранам). У каждой проверки свой вход, свой формат
и своя точка запуска:

| источник | что покрывает | формат |
|---|---|---|
| `.project/drafts/layout-probe-075.json` | LAYOUT: overflow, CTA, тач-цели | JSON, 55 комбинаций |
| `.project/drafts/a11y-baseline.json` | COLOR: контраст (axe `color-contrast`) | JSON, 19 экранов |
| `src/presentation/**` | TYPO / SPACE / COPY / STATE: правила кода | исходники |

**Единой точки проверки нет.** Чтобы ответить на вопрос «экран готов?», агент
руками собирает три источника, и не помнит, *какие именно* критерии проверял:
`grep`-правила (нет `100vh`, нет hardcoded hex, spacing кратен 4px) не
зафиксированы нигде — они живут в голове прошлого прогона.

**Агент имеет зрение.** Baseline PNG из spec 074 читаются Read tool'ом, то есть
агент может анализировать скриншоты (иерархия, обрезанный текст, пустые
состояния) — это проверка, недоступная ни `playwright`, ни `axe`. До сих пор
она не была очерчена как шаг: скриншоты снимались, но систематически не
просматривались.

**PRE-CHECK (read-only):**

- `.project/specs/077*.md` → **False** (спеки не было; последняя — `076`);
- `.project/checklists/`, `.project/scripts/check.mjs`,
  `.project/scripts/audit-screens.mjs` → **False** (ни чек-листа, ни скриптов);
- baseline PNG (`e2e/visual-regression.spec.ts-snapshots/*.png`) → **19**;
- источники обязательны и оба на месте: `layout-probe-075.json` → **True**,
  `a11y-baseline.json` → **True**;
- baseline гейтов ДО: `typecheck` 0, `test:run` 0 (**442**), `test:e2e` 0
  (**208**), `build` 0.

## Цель

Одна точка проверки UI/UX: чек-лист **30 критериев** в
`.project/checklists/ui-ux.yaml` + два zero-deps скрипта
(`npm run check` — машинные критерии, `npm run audit:screens` — точка входа
для визуального аудита агентом).

**НЕ входит:** фиксы UI (найденные fail'ы — отдельные спеки), правки
`src/**` и `e2e/**`, обновление baseline PNG, правки `check.mjs` «по результату
прогона» (скрипт отчёта не подгоняет: `status` в YAML ставит прогон, а не
капитан).

## Что делаем

1. `.project/specs/077-ui-ux-checklist.md` — эта спека (frontmatter: `type: infra`,
   `track: small`, `status: approved`, `embedded_approve: rule 2 (F5.0a)`).
2. `.project/checklists/ui-ux.yaml` — 30 критериев шести категорий:
   LAYOUT (8), COLOR (6), TYPO (5), SPACE (4), STATE (4), COPY (3).
   Формат записи: `id`, `title`, `check` (`playwright` | `axe` | `grep` |
   `manual` | `vision`), `threshold`, `status` (`pass` | `fail` | `unknown` |
   `manual`), `source` (WCAG 2.2 / Apple HIG / Nielsen / TMA docs / internal).
3. `.project/scripts/check.mjs` — zero-deps Node ESM: диспатч по `check`
   (JSON пробы, axe-JSON, `grep` по `src/presentation/**`), статусы в YAML
   (запись через temp + rename), отчёт
   `.project/drafts/checklist-report-2026-10-04.md`, exit 1 при fail
   critical/high (`COLOR-001`, `LAYOUT-003`).
4. `.project/scripts/audit-screens.mjs` — zero-deps точка входа: печатает
   агенту инструкцию прочитать 19 PNG Read tool'ом и записать наблюдения
   (severity + категория) в `.project/drafts/visual-audit-2026-10-04.md`.
   Скрипт API не вызывает — читает список PNG и печатает инструкцию, exit 0.
5. `.project/checklists/README.md` — как добавить критерий, почему не удалять
   (`status: obsolete`), время прогона `npm run check` и порядок
   визуального аудита.
6. `.project/drafts/checklist-report-2026-10-04.md` — отчёт первого прогона.
7. `.project/drafts/visual-audit-2026-10-04.md` — визуальный аудит 19 PNG.
8. `package.json` — **+2 строки**: `check`, `audit:screens`.

## Критерии приёмки

- [ ] `.project/specs/077-ui-ux-checklist.md` существует, frontmatter
      `id: 077`, `type: infra`, `track: small`;
- [ ] `.project/checklists/ui-ux.yaml` содержит ровно **30** критериев,
      у каждого заполнены `id`, `title`, `check`, `threshold`, `status`,
      `source`;
- [ ] `npm run check` печатает `N pass / N fail / N unknown / N manual`,
      пишет `checklist-report-2026-10-04.md` с Top-fail и `file:line`,
      exit 1 только при fail `COLOR-001`/`LAYOUT-003`;
- [ ] `npm run audit:screens` exit 0 и печатает инструкцию визуального аудита;
- [ ] `visual-audit-2026-10-04.md` содержит наблюдения по всем читаемым PNG
      (severity + категория), битые PNG помечены, а не игнорируются;
- [ ] гейты ПОСЛЕ = baseline: `typecheck` 0, `test:run` **442**, `test:e2e`
      **208**, `build` 0;
- [ ] ровно **8 новых файлов**, существующий код (`src/**`, `e2e/**`) не
      изменён, `package.json` — +2 строки;
- [ ] EOL правило 16: `git ls-files --eol` на новых путях → `i/lf w/lf`.

## Что НЕ трогать

- `src/**`, `e2e/**` — ни одной правки: спека только детектирует, фиксы —
  отдельные работы;
- baseline PNG `e2e/visual-regression.spec.ts-snapshots/*.png` — только чтение;
  `npm run test:e2e --update-snapshots` запрещён;
- `.project/scripts/**` (кроме двух новых файлов), `domain/**`, `store/**`,
  `sync.mjs`, `ORCH-RULES.md`, `backend/**`;
- `mas-runs.json` (изменён предыдущим прогоном) — **не коммитить**;
- новые зависимости: `check.mjs` и `audit-screens.mjs` — zero-deps.

## Превью

1. Таблица 30 критериев: `id | title | check | threshold | source`.
2. Вывод `npm run check`: `N pass / N fail / N unknown / N manual` + Top-5 fail
   с `file:line`.
3. `visual-audit-2026-10-04.md`: 19 PNG, проблемы по severity, Top-5.
4. Diff `package.json`: ровно +2 строки.
