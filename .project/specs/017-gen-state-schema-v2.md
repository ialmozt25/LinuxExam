---
id: 017
slug: gen-state-schema-v2
status: approved
type: infra
created: 2026-09-28
updated: 2026-09-28
commit: null
---

> **Авторизована к исполнению** (правило 2, `type: infra` — автономия применима;
> правило 6 ограничивает только `type: content`). Time-box — **30 минут** по
> указанию капитана: не уложился → `status: blocked`, отчёт с причиной, работа
> останавливается (без «дожму потихоньку»). Создана по прямому заданию капитана
> после находки в отчёте батча 5A.

## Цель

Сделать `tools/gen-state.mjs` совместимым со схемой `state.json` v2: `npm run state:update`
перестаёт уничтожать v2-ключи, после него остаётся зелёным `sync:check`, а метрики
`goal.added_today` / `goal.avg_daily_7d` снова обновляются — сейчас они не обновляются
и центр (`docs/index.html`) показывает устаревшие значения.

## Проблема (evidence)

- `tools/gen-state.mjs:518-534` собирает **новый корневой объект** фиксированным
  набором ключей схемы v1: `last_update`, `goal`, `topics`, `milestones`, `gates`,
  `issues_open`, `recent_commits`. Поля v2 — `head`, `specs`, `log_tail`, `last_sync`,
  `schema_version`, `commits`, `roles`, `products`, `audits` — **не переносятся из
  прежнего файла и теряются** (`fs.writeFileSync(STATE_PATH, ...)`, `:539`).
- После прогона `sync:check` краснеет: `sync.mjs:1309-1314` требует
  `schema_version >= 2` (получает `1`), `sync.mjs:1322-1325` — чтобы `state.json` и
  производные были закоммичены. Замер: **exit 2**.
- Из-за потери v2-контура `docs/index.html` терял секции «Спеки», «Коммиты», «Роли»,
  «Продукты», «Аудит», а `goal.added_today` / `avg_daily_7d` перестали обновляться
  после миграции на схему v2 — центр показывает `added_today: 0` при 6 добавленных
  вопросах (батч 5A).
- `tools/gen-state.mjs:546-549` дополнительно перезаписывает tracked
  `docs/dashboard/state.json` (byte-for-byte копия) — эффект сохраняется.

## Merge-контракт (источник истины — задание капитана)

| ключи | владелец | правило |
|---|---|---|
| `goal`, `gates` (вкл. `shuffle_bank`), `added_today`, `avg_daily_7d` | **`gen-state.mjs`** | пишет всегда, значения из прогонов/`git log` |
| `head`, `specs`, `log_tail`, `commits`, `roles`, `products`, `audits`, `last_sync` | **`sync.mjs`** | `gen-state.mjs` их **не трогает** — только переносит как есть |
| `schema_version` | общий | `gen-state.mjs` пишет `2`, если поля нет; существующее значение сохраняет |

- **Каждый writer не трогает чужие ключи.** `sync.mjs` в этой задаче не правится
  вовсе (`НЕ делать` в задании); он по-прежнему пересчитывает
  `goal.current_questions` / `progress_percent` из `_topics.json` — то же самое
  значение, что пишет `gen-state.mjs` из того же источника, поэтому расхождения не
  возникает.
- `topics`, `milestones`, `issues_open`, `recent_commits`, `last_update` остаются за
  `gen-state.mjs` (как и было); `topics` у обоих writer'ов выводится из
  `_topics.json` и потому совпадает.

## Критерии приёмки

- [ ] `npm run state:update` → **exit 0**.
- [ ] После него `sync:check` зелёный (при необходимости через `npm run sync`, если
      прогон **законно** изменил метрику, которую читают производные).
- [ ] **Идемпотентность:** второй прогон `state:update` оставляет `state.json`
      побайтово тем же (метки времени не «тикают» впустую) → `sync:check` → exit 0
      без дополнительного `sync`.
- [ ] `added_today` / `avg_daily_7d` обновляются по `git log`.
- [ ] v2-ключи сохранены после прогона: `head`, `specs`, `log_tail`, `last_sync`,
      `schema_version`, `commits`, `roles`, `products`, `audits`.
- [ ] v1-ключи не сломаны: `goal`, `gates` (в т.ч. `shuffle_bank`), `topics`,
      `milestones`, `issues_open`, `recent_commits` на месте и с прежней семантикой.
- [ ] `docs/dashboard/state.json` по-прежнему byte-for-byte копия `state.json`.
- [ ] Гейты: `typecheck`, `test:run`, `build`, `qc`, `sync:check` → exit 0.
- [ ] Строка в `.project/log.md`.
- [ ] **Time-box 30 минут.** Не уложился → `status: blocked` + причина, спека не
      «дожимается» сверх лимита.

## Что НЕ трогать

- `.project/sync.mjs` — **ни одной правки** (задание: `НЕ делать`).
- `.project/contracts/**`, контент банка (`src/data/**`), `package.json`, конфиги сборки.
- `v1`-семантика `goal` / `gates` / `shuffle` — набор и смысл этих ключей сохраняются.
- Историю git (только новые коммиты).
- Прежние значения `gates.*` при недоступности прогона — не выдумывать статусы.

## Превью

До закрытия спеки капитан видит: (1) `diff` `tools/gen-state.mjs`; (2) `state.json`
до/после прогона — список ключей, доказывающий, что v2-ключи целы; (3) exit-коды
`state:update`, `sync:check`, второго `state:update` (идемпотентность) и пяти гейтов;
(4) `added_today` / `avg_daily_7d` до и после.

## Отчёт капитану

1. `state:update` + `sync:check`: exit-коды (после fix).
2. Идемпотентность: побайтовое равенство `state.json` между прогонами.
3. v2-ключи: список сохранённых.
4. `added_today` / `avg_daily_7d`: до → после.
5. Гейты и SHA коммита.
