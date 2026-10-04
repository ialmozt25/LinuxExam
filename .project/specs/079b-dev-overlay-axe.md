---
id: 079b
slug: dev-overlay-axe
type: infra
track: small
status: done
created: 2026-10-04
updated: 2026-10-04
commit: 3f89f2b
---

## Контекст

`npm run check` (spec 077) держит `COLOR-001` — контраст обычного текста не ниже
4.5:1 (WCAG 2.2 AA 1.4.3) — критичным критерием: его fail даёт `exit 1`.
После spec 079 (`--accent` → `--color-accent-strong`) осталось **13 узлов**
`color-contrast` на 19 экранах, и все 13 — DEV-оверлей:

```
src/App.tsx:116-133  {import.meta.env.DEV && <div style={{
  fontSize: 10, color: '#666', background: 'rgba(0,0,0,0.3)' …}>}
```

Причина ровно одна и она уже названа в spec 078/079: **axe-контур смотрел не на
тот стенд**. Visual-regression (spec 078) снимается с preview-сборки
(`stand-prod`, :4173) и DEV-оверлея не содержит, а `accessibility.spec.ts`
остался на dev-стенде (`stand-dev`, :5173), где оверлей рендерится. Итог —
`a11y-baseline.json` описывал виджет, которого в production не существует, а
`COLOR-001` был «красным» на артефакте стенда, а не на дефекте продукта.

`e2e/screens.ts` — общий рецепт экранов для обоих спеков (комментарий модуля:
«один источник состояний на два спека … иначе отчёт a11y описывает не то, что
зафиксировано на скриншоте»). То есть спеки уже обязаны смотреть на один и тот
же DOM — на dev-стенде они его как раз и не смотрели.

## Решение

**Вариант A (предпочтительный, принят): `accessibility.spec.ts` → `stand-prod`.**

`playwright.config.ts`:

```ts
{ name: 'stand-prod', testMatch: /(visual-regression|accessibility)\.spec\.ts/,
  use: { baseURL: PREVIEW_URL } },
{ name: 'stand-dev',  testIgnore: /(visual-regression|accessibility)\.spec\.ts/,
  use: { baseURL: DEV_URL } },
```

- axe-контур и visual-контур начинают наблюдать **одну и ту же
  production-сборку** — то, что `e2e/screens.ts` и обещал;
- `COLOR-001` уходит в 0 узлов **без исключений по селектору**: ничего не
  срывается «под ковёр», стенд просто перестаёт быть источником артефакта;
- 3 теста, которым нужен DEV-бейдж (`browser-mode.spec.ts`,
  `tma-mode.spec.ts`), остаются на dev-стенде — их `testIgnore` не трогает.

**Вариант B (fallback, отклонён):** `AxeBuilder.exclude('[data-testid="dev-badge"]')`.
Отклонён по двум причинам: (1) у оверлея нет `data-testid` — его пришлось бы
добавить в `src/App.tsx`, то есть правка выходит за разрешённые файлы;
(2) исключение по селектору скрывает будущие реальные нарушения, если селектор
когда-нибудь совпадёт с продуктовым узлом.

Baseline сгенерирован заново с prod-стенда (`A11Y_UPDATE=1`, затем чистый
прогон сравнения): `screens: 19`, `total nodes: 0`, `byRule: {}`.

## Критерии приёмки

- [ ] `npm run check` → `COLOR-001` **pass** (0 узлов, было 13).
- [ ] `.project/drafts/a11y-baseline.json`: 19 экранов, 0 узлов во всех правилах.
- [ ] `npx playwright test e2e/accessibility.spec.ts` → 19 passed на `stand-prod`.
- [ ] `npm run test:e2e` → 213 passed (baseline не сдвинулся).
- [ ] Гейты = baseline: typecheck 0 / test:run 442 / build 0.
- [ ] `npm run sync:check` = 0.

## Ограничения

- Не трогать: `domain/**`, `store/**`, `src/data/**`, `tools/**`, `sync.mjs`,
  `ORCH-RULES.md`, `backend/**`; из `e2e/**` разрешён только
  `accessibility.spec.ts` (шапка-документация) + `playwright.config.ts`.
- `src/App.tsx` (сам DEV-оверлей) **не меняется** — он легитимен в dev-сборке,
  и трёх спеков, которые его проверяют, это не касается.
- Пороги axe (`TAGS`, `BLOCKING_IMPACTS`) не меняются: контур приёмки остаётся
  «baseline + сравнение новых critical/serious», а не «ноль violations».
- Прочие fail чек-листа (`TYPO-001/002`, `SPACE-001/002`) — вне цели спеки.
