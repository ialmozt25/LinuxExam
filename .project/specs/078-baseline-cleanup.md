---
id: 078
slug: baseline-cleanup
type: infra
track: small
status: done
created: 2026-10-04
updated: 2026-10-04
commit: 99962da
embedded_approve: rule 2 (F5.0a — 2026-10-04)
execution: direct
---

## Контекст

RECON по spec 077 (продолжение визуального аудита) нашёл источник `#ff00ff` в baseline PNG
и показал, что **два critical-наблюдения аудита ложные**. Ни одно из них не является
дефектом приложения:

**1. Маска Playwright.** `#ff00ff` — это заливка масок `mask` у `toHaveScreenshot`,
по умолчанию `options.maskColor || "#F0F"`
(`node_modules/playwright-core/lib/coreBundle.js:21805`, метод `_maskElements`).
Маски ставятся контрактом `DYNAMIC_MASK_SELECTORS` (`e2e/fixtures.ts:171-177`):
`exam-timer`, `streak-badge`, `xp-bar`, `retention-goal-line`, `[data-testid*="timer"]`;
применяются в `e2e/visual-regression.spec.ts:29` через `dynamicMasks(page)`.
Геометрия подтверждена пиксельно и сверена с исходниками:

| PNG | прямоугольник | элемент | источник |
|---|---|---|---|
| `dashboard-desktop` | 80×80, x16–95, y191–270 | `streak-badge` | `StreakBadge.tsx:7` (`BADGE_SIZE = 80`) |
| `dashboard-desktop` | 1316×30, x108–1423, y216–245 | `xp-bar` | `Dashboard.tsx:334-346` (`gap: var(--space-3)` = 12 px → дыра x96–107; `alignItems: center` → 191+(80−30)/2 = 216) |
| `dashboard-desktop` | 1408×21, x16–1423, y279–299 | `retention-goal-line` | `Dashboard.tsx:347-356` (`marginTop: var(--space-2)` → 191+80+8 = 279; ширина 1440−2×16 = 1408) |
| `exam-run-desktop` / `-mobile` | 53×21, x1371–1423 / x321–373, y16–36 | `exam-timer` | `ExamRun.tsx:128-138` (правый конец `justify-content: space-between`) |

Всего мадженты: **99 572 px в 4 из 19 снимков** (`dashboard-desktop` 75 448,
`dashboard-mobile` 21 898, `exam-run-desktop`/`-mobile` по 1 113); в остальных 15 — 0 px.
В `src/**` строк `ff00ff`/`magenta` нет.

**2. DEV-оверлей.** Серый бейдж 55×23 px в левом нижнем углу **всех 19** снимков
(x=4–59; y=873 desktop / y=817 mobile) — это отладочный оверлей приложения
`src/App.tsx:116-133` под `import.meta.env.DEV` (текст `Web mode` / `TG: <имя>`).
Он попадает в baseline потому, что `playwright.config.ts` поднимает стенд командой
`npm run dev`, а dev-сервер всегда отдаёт DEV-сборку.

Итог: baseline содержит два класса шума, не относящихся к продукту — маска Playwright
и dev-only оверлей. Ложные critical ушли в `visual-audit-2026-10-04.md`, `docs/memory/episodic.md`
и Top-5 отчёта spec 077.

## Цель

Чистый baseline: снимки не должны содержать ни мадженты, ни DEV-оверлея, а визуальный
аудит не должен считать их дефектами.

## Изменения

| файл | что |
|---|---|
| `playwright.config.ts` | **1)** `expect.toHaveScreenshot.maskColor: '#f5f5f5'` (нейтральный фон страницы вместо дефолтного `#F0F`); **2)** `webServer` переведён с `npm run dev` на `npm run build && npm run preview` — снимки снимаются с production-сборки, где `import.meta.env.DEV === false`. Порт/схема приведены к preview: `http://127.0.0.1:5173` (`vite preview` не использует mkcert — HTTPS остаётся только у dev-сервера) |
| `e2e/visual-regression.spec.ts-snapshots/*.png` | перегенерация **всех 19** baseline (у всех 19 меняется низ левого угла — уходит DEV-оверлей) |
| `.project/drafts/visual-audit-2026-10-04.md` | аннотация: 2 ложных critical помечены `[corrected 2026-10-04: это маска Playwright maskColor, не bug]`, Top-5 пп. 1–2 переписаны, добавлен раздел «Correction 2026-10-04» |

`e2e/*.spec.ts` и `src/**` **не меняются**: маски и их селекторы остаются как есть,
меняется только цвет заливки и сборка стенда.

## Критерии приёмки

- [ ] `playwright.config.ts` содержит `maskColor: '#f5f5f5'` и `webServer.command`,
      начинающийся с `npm run build && npm run preview`;
- [ ] прогон 1: `npx playwright test e2e/visual-regression.spec.ts --update-snapshots`
      → **19 passed**;
- [ ] прогон 2: `npx playwright test e2e/visual-regression.spec.ts` → **19 passed**
      (baseline стабилен на production-сборке);
- [ ] скан 19 PNG: `#ff00ff` = **0 px** в каждом; в областях масок присутствует `#f5f5f5`;
- [ ] DEV-оверлей исчез: в прямоугольнике x4–59, y873–895 (desktop) / y817–839 (mobile)
      нет серого блока (проверка пиксельно);
- [ ] `visual-audit-2026-10-04.md` содержит пометки `[corrected 2026-10-04: ...]` на
      строках 21, 28, 45, 52 и исправленный Top-5; существующий текст не удалён;
- [ ] гейты ПОСЛЕ = baseline: `typecheck` 0, `test:run` **442**, `test:e2e` **208**, `build` 0;
- [ ] `npm run sync:check` = 0; `mas-runs.json`, `layout-probe-075.json`, `a11y-report.json`,
      `*.tmp.spec.ts` — **не закоммичены**.

## Что НЕ трогать

- `src/**`, `e2e/*.spec.ts`, `backend/**`, `domain/**`, `store/**`, `tools/**`;
- `.project/sync.mjs`, `.project/ORCH-RULES.md`, `.project/scripts/**`;
- `playwright.config.ts` — только две правки (maskColor + webServer); логика тестов не меняется;
- baseline PNG — только перегенерация на месте (никаких удалений/добавлений файлов);
- `visual-audit-2026-10-04.md` — только аннотация (существующие строки сохраняются);
- `mas-runs.json` (изменён предыдущим прогоном) — **не коммитить**;
- новые зависимости не добавлять; `git add` — только явными путями.

## Превью

1. Diff `playwright.config.ts`: 2 правки (maskColor, webServer + схема/порт стенда).
2. Прогон 1 + прогон 2 по 19 passed.
3. Пиксельный скан 19 PNG: `#ff00ff` = 0, `#f5f5f5` в областях масок > 0, DEV-угол пуст.
4. Diff `visual-audit-2026-10-04.md`: только добавленные пометки и раздел Correction.
5. Гейты: `typecheck` 0 / `test:run` 442 / `test:e2e` 208 / `build` 0 / `sync:check` 0.
6. Отклонения — отдельным разделом отчёта.

## Отклонения (отчёт прогона, 2026-10-04)

### 0. Два конфликта внутри спеки — оба пришлось разрешить по существу

**(а) `maskColor` в конфиге инертен.** Спека предписывала убрать маджету опцией
`expect.toHaveScreenshot.maskColor` в `playwright.config.ts`, а `e2e/*.spec.ts`
объявляла «не трогать». Playwright вырезает `mask` и `maskColor` из
конфигурационных опций перед использованием: `NonConfigProperties` =
`["clip","fullPage","mask","maskColor","omitBackground","signal"]`,
`node_modules/playwright/lib/matchers/expect.js` (проверено на живом
`playwright@1.63.0`). Поддерживаемая точка одна — место вызова. Проверено
экспериментом: прогон A (`--update-snapshots=all` при одном конфиг-`maskColor`)
дал ровно **99 572 px мадженты в тех же 4 файлах**, то есть конфиг не влияет
ни на пиксель. Критерий приёмки №4 (`#ff00ff` = 0) без места вызова недостижим.

**(б) production-стенд ломает 3 E2E-теста, которые проверяют DEV-бейдж.**
Перевод единственного стенда на `npm run preview` сделал `import.meta.env.DEV`
ложным, и DEV-бейдж (`src/App.tsx:116-133`) перестал рендериться. Три теста
берут его как наблюдаемый признак «приложение видит Telegram» и упали
(`element(s) not found`): `e2e/browser-mode.spec.ts:26` (`Web mode`),
`e2e/tma-mode.spec.ts:229` (`TG: Test`), `e2e/tma-mode.spec.ts:284` (`/^TG: /`).
Первый замер гейтов дал **205 passed / 3 failed, exit 1** — при критерии №7
(`test:e2e` = 208). Спека этих тестов не упоминает.

### Что сделано вместо буквы спеки

| № | Отклонение | Почему |
|---|---|---|
| 1 | `maskColor: '#f5f5f5'` добавлен **в месте вызова**: `e2e/visual-regression.spec.ts`, `shoot()` → `toHaveScreenshot(file, { mask: dynamicMasks(page), maskColor: '#f5f5f5' })` | Рабочая точка одна; критерий №4 иначе недостижим |
| 2 | Строка `maskColor` в `playwright.config.ts` **оставлена** (критерий №1) с комментарием об инертности | Критерий №1 называет этот файл; комментарий не даёт следующему читателю поверить в мёртвую строку |
| 3 | Стенд — **два проекта**, а не «перевод dev → preview»: `stand-prod` (только `visual-regression.spec.ts`, `vite preview` на 4173) + `stand-dev` (все остальные спеки, `vite dev` на 5173), `webServer` — массив из двух серверов | Единственный вариант, при котором сразу выполняются Цель (снимки с production-сборки), критерий №7 (208) и запрет трогать `e2e/*.spec.ts`. Отключить 3 теста или удалить их ассерты — потеря покрытия, а не решение |
| 4 | `snapshotPathTemplate` зафиксирован явно: `{testDir}/{testFilePath}-snapshots/{arg}{-snapshotSuffix}{ext}` | При заданных `projects` шаблон по умолчанию вставляет `{-projectName}` в имя файла — появились бы 19 **новых** файлов вместо перегенерации на месте (запрещено «Что НЕ трогать») |
| 5 | Перегенерация — `--update-snapshots=all` (не `--update-snapshots`) | Без значения это режим `changed`: запись только при падении сравнения, а единственное реальное расхождение (DEV-бейдж) — 0.099% при `maxDiffPixelRatio: 0.01`, то есть файлы не перезаписались бы |
| 6 | Схема стенда — **HTTPS**, а не литеральное `http://127.0.0.1:5173` из таблицы «Изменения»; production-стенд на порту **4173**; `baseURL` — `127.0.0.1` вместо `localhost`; `webServer.timeout: 180_000` | `vite preview` наследует `server.https` из `vite.config.ts` (mkcert) — посылка «vite preview не использует mkcert» неверна; 5173 остаётся за dev-стендом; `timeout` нужен, потому что команда включает сборку |
| 7 | Дополнительно зафиксирована **незакоммиченная** запись spec-077 в `docs/memory/episodic.md` | Закрытие spec 077 оставило файл грязным; запись не переписывалась (append-only), корректирующее утверждение несёт запись spec-078 |

Маски, их селекторы (`DYNAMIC_MASK_SELECTORS`) и геометрия не менялись — заменена
только заливка. Логика тестов не менялась: правок в `e2e/*.spec.ts` нет ни одной,
кроме добавленной опции цвета в `shoot()`.

### Гейты

| Гейт | ДО (spec 077) | ПОСЛЕ | Итог |
|---|---|---|---|
| `npm run typecheck` | 0 | 0 | = baseline |
| `npm run test:run` | 442 | **442** | = baseline |
| `npm run test:e2e` | 208 | **208** | = baseline (см. отклонение 3) |
| `npm run build` | 0 | 0 | = baseline |
| `npm run sync:check` | 0 | 0 | = baseline (после converge) |

Промежуточный красный гейт зафиксирован честно: 205/208 при одном production-стенде
(3 падения DEV-бейджа), 208/208 — после разделения стендов.

### Пиксельное evidence (19 PNG, сканер `.project/drafts/_spec078-png-scan.mjs`)

| Скан | `#ff00ff` | Файлы с маджентой | DEV-угол (x4–59) |
|---|---|---|---|
| ДО (baseline spec 074) | 99 572 px | 4 из 19 | `#ababab`-бейдж, 1044 px/файл |
| Прогон A (production-стенд, конфиг-`maskColor`) | 99 572 px | 4 из 19 | пусто (`#f5f5f5` / цвета UI) |
| Прогон B (+ `maskColor` в месте вызова) | **0 px** | **0 из 19** | пусто |

В областях масок (`streak-badge`, `xp-bar`, `retention-goal-line`, `exam-timer`)
после прогона B — `#f5f5f5`. Перегенерированы все 19 baseline; прогон B переписал
ровно те 4, где была маджента. Перегенерация «на месте»: файлов в
`e2e/visual-regression.spec.ts-snapshots/` по-прежнему 19.

### Артефакты прогона (untracked, в коммит не входят)

`_spec078-runA-update-all.txt`, `_spec078-runB-update-all.txt`,
`_spec078-runC-verify.txt`, `_spec078-runD-two-stands.txt`,
`_spec078-runE-full-e2e.txt`, `_spec078-gates-after.txt`,
`_spec078-scan-{before,runA,runB}.txt`, `_spec078-png-scan.mjs` — все в
`.project/drafts/`.

