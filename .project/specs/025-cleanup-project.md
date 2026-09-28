---
id: 025
slug: cleanup-project
title: "Cleanup — удаление мусора после F5"
status: approved
type: infra
created: 2026-09-28
updated: 2026-09-28
commit: null
---

> **Разовая задача обслуживания** после закрытия проекта (план v2.22, все 6 фаз
> `done`). Это **не фаза плана**: milestone в `log.md` — `cleanup`, не `F6`.
> Перевод `draft → approved` выполнен оркестратором по **rule2-exception**
> (embedded approve в промпте Cleanup-1). Поле `commit:` — `null` (self-reference
> spec 009). Опорный recon — Cleanup-0 (READ-ONLY, без коммита).

## Цель

Очистить рабочее дерево после закрытия проекта: убрать мусорные остатки
(untracked-копии, битый артефакт, пустые папки, orphan-черновик) и поправить
три мёртвые ссылки в плане. Функциональных изменений нет.

## Удалить

- `.backup-tld-20260928-080821/` — копия tracked-файлов (`docs/LOCAL-ALIASES.md`,
  `tools/local-serve.mjs`), оригиналы и правка живут в git.
- `filelists-BaseOS.xml.gz` — битый артефакт, происхождение не установлено
  (помечен «открыт» в `docs/archive/MEMORY-FACTORY-2026-09-28.md:53`).
- `.tmp/` — пустая папка.
- `scripts/` (корень) — пустая папка.
- `drafts/_bak/` — пустая папка.
- `drafts/_mas-results/local_storage_r2.json` — orphan, superseded
  (см. `.project/drafts/cleanup-2026-09-26.txt:24`).

## НЕ удалять

- `.agent-teams/**` — живые команды F3 (`linuxexam-f3-smoke`, `linuxexam-m6-phase4`).
- `drafts/_mas-results/f3.2-writer.md` — evidence F3.2.
- `docs/dashboard/**` — читатель есть: `docs/dashboard/dashboard.js:51`
  (`fetch("./state.json")`) + тесты `humanize.test.mjs`.
- `docs/memory/**`, `.project/log.md`, `.project/DECISIONS.md`.
- `templates/factory/**` — шаблон F5.
- спеки 001–024 — память проекта.
- задачи Task Scheduler (`DSH-Checker`/`Cleaner`/`Watchdog`).

## Правки плана (косметика, ЧАСТЬ 11)

- Удалить ссылку на `docs/state.json` (стр. 58) — такого пути нет.
- Снять задачу про `docs/dashboard/state.json` (стр. 311) — читатель есть.
- Привести `docs/HANDOFF.md` к факту (стр. 307) — файл лежит в `docs/archive/HANDOFF.md`.

## Критерии приёмки

1. Удалены 6 путей (все `Test-Path` → False), защищённые не тронуты.
2. `docs/FACTORY-PLAN.md` — три правки, версия v2.23.
3. `npm run sync` → exit 0; `sync:check` → exit 0.
4. `.project/STATE.md`, `.project/SPEC.md` показывают spec 025 `approved`.
5. `git status` — только ожидаемые modified/untracked.
