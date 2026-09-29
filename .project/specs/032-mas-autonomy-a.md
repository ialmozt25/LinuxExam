---
id: 032
slug: mas-autonomy-a
type: infra
status: approved
commit: null
---

# Спека 032 — MAS-autonomy (A): три точечных долга

Источник фактов: alerts (EPERM, goal ownership, _order.json tech debt), procedural.md:28, опыт прогонов spec-030/031. Этот документ описывает план правок; реализация — после approve. 032b (run-spec.mjs, TASK.md, spec-gate, авто-отчёт, committer, метрики) — отдельная спека 033 (создаётся после закрытия 032).

## Контекст

Цель — работа по схеме «спека → фабрика → результат + отчёт → память» **без ручного переноса промптов капитаном**. Перед большой инфрой (032b) — закрыть 3 точечных долга, накопившихся в spec-030/031.

## Источники

- alerts: `tech debt` записи (EPERM, `goal` ownership, `_order.json`).
- `docs/memory/procedural.md:28` — шаг `_order.json` без инструмента.
- Опыт spec-030/031 (2 прогона MAS).

## Цель

Закрыть 3 инфра-долга: `_order.json` CLI, EPERM `agent_teams_delete`, `goal` ownership.

## Что делаем

1. **`tools/order-manifest.mjs`** — CLI: `--add <id>`, `--remove <id>`, `--check` + npm-скрипт `order:add`/`order:remove`/`order:check`. Закрывает tech debt `_order.json`.
2. **EPERM `agent_teams_delete`** — диагностика + фикс или документированный workaround.
3. **`goal` ownership** — передать `current_questions`/`progress_percent` владельцу (`gen-state.mjs`) или расширить scope `sync.mjs` явно.

## Декомпозиция

Формат — по SKILL.md (`spec-to-team`, шаг 3): нумерованный список `id, subject, assignee, dependencies`.

1. `id: t1` · `subject: tools/order-manifest.mjs — CLI (--add/--remove/--check) + npm-скрипты; закрыть tech debt _order.json; сделать порядок правки детерминированным` · `assignee: builder` · `dependencies: []`
2. `id: t2` · `subject: EPERM agent_teams_delete — диагностика причины (дескрипторы каталогов?) + фикс или документированный workaround; на deliverable не влияет, но 2 прогона подряд` · `assignee: builder` · `dependencies: []`
3. `id: t3` · `subject: goal ownership — передать current_questions/progress_percent владельцу (gen-state.mjs), либо расширить scope sync.mjs явно; сейчас sync переносит поле как есть, не пересчитывает` · `assignee: builder` · `dependencies: []`
4. `id: t4` · `subject: reviewer — независимое ревью t1–t3; verdict=pass; проверить, что tech debt закрыты` · `assignee: reviewer` · `dependencies: [t1, t2, t3]`

Оговорки:

- Правки — в `tools/`, `.project/sync.mjs`, `package.json`, `.project/scripts/`.
- Approve капитана обязателен.
- 032b (6 компонентов автономии) — отдельная спека 033.

## Edge Cases и стратегия проверки

- **`order-manifest.mjs`**: должен быть **идемпотентным** (`--add` существующего id → no-op + warning). `--check` → exit 0/1.
- **EPERM**: если фикс не найден — задокументировать workaround (ручное `git mv` вне плагина).
- **`goal` ownership**: вариант A (передать `gen-state.mjs`) vs вариант B (расширить scope `sync.mjs`). Выбор — на этапе реализации.
- **Reviewer (t4)**: проверить, что tech debt действительно закрыты (не только написаны).

## Критерии приёмки

1. `tools/order-manifest.mjs` + npm-скрипты работают: `npm run order:check` → 0; `npm run order:add fp_099` → id добавлен; `npm run order:remove fp_099` → вырезан.
2. EPERM `agent_teams_delete`: либо fix (rename проходит), либо документированный workaround в `procedural.md`.
3. `goal.current_questions` синхронизирован с `_topics.json` **автоматически** (без ручной правки); `sync:check` остаётся 0.
4. Reviewer verdict = pass.

## Что НЕ трогать

- `src/**` (продукт).
- Спеки 028/029/030/031.
- `docs/HANDOFF.md`, `docs/C-PLAN.md`, `docs/FACTORY-PLAN.md`, `docs/DEV-PLAN.md`, `docs/C0-CENTER-AUDIT.md`.
- `.project/factory/**`, `docs/dashboard/**`, `templates/**`, `docs/archive/**`.
- `e2e/**` (QC-1 fix — отдельно).
