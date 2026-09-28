---
id: 024
slug: factory-export
title: "F5 — Factory Export (templates/factory + scaffold)"
status: approved
type: infra
created: 2026-09-28
updated: 2026-09-28
commit: null
---

> **Спека фазы F5** («Экспорт фабрики»), создана шагом **F5.0b** и переведена
> в `approved` по **rule2-exception** (embedded approve в промпте F5.0b; второй
> случай после spec 023 в F4.3). Реализация — F5.1 (скрипты) и F5.2 (приёмка),
> закрытие — F5.3. Поле `commit:` остаётся `null` — самоссылка spec 009.

## Цель

Экспортировать фабрику (правила, память, дашборд, гейты) в переиспользуемый
шаблон `templates/factory/`, разворачиваемый в новом репо одной командой.

## Состав templates/factory/ (что входит)

- `.project/ORCH-RULES.md`
- `.project/factory/{DOD.md, roles.yaml}`
  (**STOP — НЕ шаблон**: это флаг-файл, создаётся по требованию)
- `.project/scripts/keepers/` — шаблоны скриптов, **БЕЗ** `.last-checked`,
  **БЕЗ** `*.log`
- `.githooks/pre-commit`
- `.project/scripts/check-episodic.mjs` (копия `tools/check-episodic.mjs` из
  источника; фабричный инструмент, не продуктовый)
- docs/memory/{episodic,semantic,procedural,working,alerts}.md — пустые,
  с meta-заголовком (`updated`, `entries_count: 0`)
- `docs/memory/trends.jsonl` — пустой
- `docs/FACTORY-PLAN.md` — шаблон: плейсхолдеры `{{PRODUCT}}`, `{{FACTORY}}`,
  `{{DATE}}`, `{{CAPTAIN_TZ}}`; фазы F0–F5 все `pending`; changelog пустой
  (только строка «v1.0 — initial»)
- `docs/START-HERE.md` — шаблон с плейсхолдером `{{PRODUCT}}`
- `.project/sync.mjs` — **урезанная версия (~300–500 строк)**.
  Продуктово-нейтральные секции: шапка, фазы, память, тренды, решения,
  тревоги, коммиты. **БЕЗ**: блока 6, банка, тем, аудитов, продуктов, спек.
  Функции `readAgentTeams` и `renderAgentBlock` **УДАЛЕНЫ** (не закомментированы).
  Обновляется вручную.
- `.project/state.json` — минимальный:
  `{plan: {version: "1.0", phases: [F0..F5 pending], product: "{{PRODUCT}}"}}`
- `docs/FACTORY-USAGE.md` — инструкция для пользователя шаблона
- `package.json` — минимальный: `scripts.sync`, `scripts.check:episodic`,
  devDeps для `sync.mjs` (`fs-extra`, **без** `js-yaml`)
- `README.md` — шаблон

## Состав (что НЕ входит)

- `src/`, `e2e/`, `tools/` — **кроме** `check-episodic.mjs` (он копируется)
- `docs/index.html` (генерируется `sync`)
- `.agent-teams/**` (runtime AgentTeams)
- `drafts/`, отчёты, аудиты, snapshots
- `.git/`, `node_modules/`
- specs 001–024 (продуктовые — свой список в новом продукте)
- `docs/archive/**`
- changelog плана (записи F0–F5 не переносятся)
- `.project/log.md`, `DECISIONS.md` (продуктовая история)

## Скрипты (F5.1, вне этой спеки)

- `npm run factory:scaffold -- <target-dir> [--product=...] [--factory=...]`
  Разворачивает `templates/factory/` в целевой каталог. Кросс-платформенно
  через `fs-extra.copySync` (Node, не shell `cp`). Поведение:
  - target-dir не существует — создать (`mkdir -p`);
  - существует и не пуст — **СТОП** с явной ошибкой, если не передан `--force`;
  - заменяет плейсхолдеры: `{{PRODUCT}}`, `{{FACTORY}}`, `{{DATE}}`,
    `{{CAPTAIN_TZ}}`.
- `npm run factory:sync-template` — пересобирает `templates/factory/` из
  источника (`.project/` + `docs/memory/` + `docs/FACTORY-PLAN.md`), очищает
  changelog, заменяет специфичное на плейсхолдеры.

## Критерии приёмки

1. `templates/factory/` содержит файлы из «Входит», НЕ содержит из «НЕ входит».
2. `factory:scaffold` разворачивает шаблон в: **(a)** несуществующий каталог —
   создаёт и наполняет; **(b)** пустой существующий — наполняет; **(c)** непустой
   без `--force` — СТОП с ошибкой; **(d)** непустой с `--force` — наполняет поверх.
3. В развёрнутом репо нет упоминаний `LinuxExam` (PowerShell:
   `Select-String -Path . -Pattern "LinuxExam" -Recurse | Measure-Object` → 0
   совпадений; WSL/Git Bash — `grep -r`).
4. Плейсхолдеры `{{PRODUCT}}`, `{{FACTORY}}`, `{{DATE}}`, `{{CAPTAIN_TZ}}`
   заменены значениями из `--args` или дефолтами. `{{DATE}}` — текущая дата ISO.
5. В развёрнутом репо: `npm run sync` → exit 0; `npm run check:episodic` → exit 0
   (нет `done`-фаз); `npm run sync:check` → exit 0. **Smoke-тест:** `npm run sync`
   в шаблоне → exit 0; `sync:check` → exit 0 (урезанный `sync.mjs` генерирует
   HTML без ошибок на пустом `state.json`).
6. `docs/FACTORY-USAGE.md` описывает: что такое шаблон, как развернуть, как
   обновлять, что делать после развёртывания.

## Что НЕ трогать

- `.project/specs/001-023`
- `src/`, `e2e/`, `tools/`, `docs/index.html`
- `.agent-teams/**`
- spec 023 (`approved`)
- `.project/sync.mjs` исходного репо (правка — только в копии
  `templates/factory/.project/sync.mjs` в F5.1)

## Превью

Для infra-спеки — diff `templates/factory/` (структура каталога) + вывод
`factory:scaffold` на temp-каталоге + размер scaffold (файлов/КБ).
Заполняется в F5.1/F5.2.

## Зафиксированные решения

- **Не отдельный репо / npm-пакет** — over-engineering для одного продукта
  (обоснование в плане, ЧАСТЬ 4, блок F5).
- **Кросс-платформенность:** `fs-extra.copySync`.
- **Плейсхолдеры:** `{{PRODUCT}}`, `{{FACTORY}}`, `{{DATE}}`, `{{CAPTAIN_TZ}}`.
- **Changelog плана в шаблоне — пустой** (только «v1.0 — initial»).
- **STOP — не шаблон, а флаг** (создаётся по требованию).
- **F5.1 уточняет список плейсхолдеров** при реализации.
- **`sync.mjs` в шаблоне — урезанная версия.** Продуктовые секции не переносятся.
  Smoke-тест обязателен перед коммитом.
