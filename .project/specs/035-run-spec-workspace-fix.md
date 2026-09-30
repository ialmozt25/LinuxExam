---
id: 035
slug: run-spec-workspace-fix
type: infra
status: done
commit: 7f07643
---

# Спека 035 — run-spec.mjs: spec-resolution в любом workspace + cleanup

Источник фактов: spec 034 (done, 6b06d73) — run-spec.mjs работает в H2-режиме, но требует --workspace = корень репо (иначе вложенный агент не находит spec в изолированном workspace). Этот документ описывает fix spec-resolution + cleanup RUN-SPEC-LIVE.md. Реализация — после approve.

## Контекст

`run-spec.mjs` (spec 033a) реализует H2-путь: `dsh --profile mas "/agent-teams <цель>"`. Вложенный агент получает `cwd` = `--workspace`. При `--workspace <temp>` spec-файл лежит в `<repo>/.project/specs/`, агент ищет в `<temp>/specs/` → **не находит** → `agent_teams_create` не вызывается → `collect: failed`. Обходной путь: `--workspace .` (корень репо). Но: ломает изоляцию.

Код-факты (RECON, проверено 2026-09-30 на базе `3c05061`):

- `run-spec.mjs:60` — `export const SPECS_DIR = path.join(REPO_ROOT, '.project', 'specs');` — каталог спек жёстко берётся от корня репозитория и от `--workspace` не зависит.
- `run-spec.mjs:78` — `export const ACTIVATION_PREFIX = '/agent-teams';`
- `run-spec.mjs:315` — `buildTaskText()` подставляет в промпт **относительный** путь: `Спека: ${spec.relativePath}. Ожидаемое имя команды: ${teamId}.` — то есть путь резолвится от `cwd` вложенного агента (= `--workspace`).
- `run-spec.mjs:84` — `DEFAULTS.workspace = REPO_ROOT` — без флага workspace уже корень репо; дефект воспроизводится только при явном `--workspace <temp>`.

## Источники

- spec 034 (done, `6b06d73`) — живой smoke, `RUN-SPEC-LIVE.md`.
- `run-spec.mjs` (spec 033a).
- `git show 6b06d73:.project/scripts/RUN-SPEC-LIVE.md` — оригинальный STOP-нарратив (260 строк).

## Цель

1. Fix spec-resolution: `run-spec.mjs <spec-id> [--workspace <dir>]` работает из любой директории.
2. Cleanup `RUN-SPEC-LIVE.md`: восстановить оригинальный STOP-нарратив в отдельный файл.
3. Добавить `--live` как алиас не-dry-run.

## Что делаем

1. **Fix spec-resolution:** выбор варианта (A — копирование spec в `<workspace>/specs/`; B — absolute path в `/agent-teams`-промпте; C — workspace по умолчанию = корень репо) — **на реализации t1** по RECON R2. Если ни один не подходит — минимальный по коду.
2. **Cleanup `RUN-SPEC-LIVE.md`:** оригинал (`git show 6b06d73:...`) → `.project/scripts/RUN-SPEC-SPIKE-STOP.md` (260 строк); текущий success (30 строк) остаётся `RUN-SPEC-LIVE.md`.
3. **`--live`:** алиас не-`--dry-run`.

## Декомпозиция

1. `id: t1` · `subject: fix run-spec.mjs — spec-resolution в изолированном workspace (A/B/C по RECON R2) + --live как алиас` · `assignee: builder` · `dependencies: []`
2. `id: t2` · `subject: восстановить оригинальный STOP-нарратив RUN-SPEC-LIVE в новый RUN-SPEC-SPIKE-STOP.md; текущий success остаётся в RUN-SPEC-LIVE.md` · `assignee: builder` · `dependencies: []`
3. `id: t3` · `subject: reviewer — integration: run-spec.mjs <spec-id> из /tmp (без --workspace) → exit 0; оба файла на месте; verdict=pass` · `assignee: reviewer` · `dependencies: [t1, t2]`

Оговорки:

- **Write-скоупы:** t1 — `.project/scripts/run-spec.mjs`; t2 — `.project/scripts/RUN-SPEC-SPIKE-STOP.md` (создание) + `.project/scripts/RUN-SPEC-LIVE.md` (не менять — success уже там). Не пересекаются.
- Правки — в `.project/scripts/`.
- Approve капитана обязателен.

## Edge Cases и стратегия проверки

- **Fix (t1):** выбор A/B/C — на усмотрение builder'а по RECON R2. Если ни один не подходит — минимальный fix (только cwd вложенного агента).
- **Cleanup (t2):** `git show 6b06d73:...` — read-only, дословно. EOL — LF.
- **Integration-тест (t3):** из **другой** директории (`/tmp`), чтобы проверить fix.
- **Регрессия:** если `RUN-SPEC-LIVE.md` при t2 тоже меняется — явно указать в отчёте.

## Критерии приёмки

1. `node .project/scripts/run-spec.mjs 013` (без `--workspace`, из `/tmp`; на Windows — любой каталог вне репозитория, например `%TEMP%`) → exit 0; team.json создан.
2. `RUN-SPEC-SPIKE-STOP.md` содержит оригинальный STOP-нарратив (260 строк); `RUN-SPEC-LIVE.md` — success (30 строк).
3. `--live` работает как алиас.
4. Reviewer verdict = pass.

## Что НЕ трогать

- `src/**`, `tools/**`, `.project/factory/**`, `docs/archive/**`, `templates/factory/**`, спеки 028–034.
