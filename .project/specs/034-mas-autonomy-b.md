---
id: 034
slug: mas-autonomy-b
type: infra
status: done
commit: 6b06d73
---

# Спека 034 — MAS-autonomy (B): spec-gate + авто-отчёт + committer + метрики + живой smoke

Источник фактов: spec 033a (done, f43b060) — PATH: H2 (dsh CLI one-shot), run-spec.mjs, mas-runs.json, templates/mas/. Этот документ описывает 4 оставшихся компонента автономии + Step 0 (профиль mas + живой smoke). Реализация — после approve. Именование: spec 034 (не 033b), чтобы избежать collision с 033a в SPEC.md.

## Контекст

Spec 033a дала фундамент: `run-spec.mjs` (детерминированный контур), `templates/mas/`, `mas-runs.json`, PATH H2. Остались 4 компонента, замыкающих цикл: spec-gate, авто-отчёт, атомарный коммиттер, метрики. Плюс — Step 0 (одноразовая установка профиля `mas` для живой проверки).

PATH H2 (033a): программируемого вызова `agent_teams_create` из скрипта не существует; работающий путь — one-shot CLI-раннтайм с профилем, в который смонтирован `@nanmicoder/dsh-agent-teams`. Результат прогона читается с диска (`.agent-teams/<teamId>/team.json` + `inbox/*.jsonl`). Из этого следует, что все 4 компонента B строятся вокруг `dsh --profile <p>` и диска, а не вокруг HTTP API.

## Источники

- spec 033a (done, `f43b060`) — `RUN-SPEC-SPIKE.md`, `run-spec.mjs`, `mas-runs.json`.
- spec 032 (done, `2539526`) — контекст (`order-manifest`, `archive-team.mjs`).
- `docs/HANDOFF.md` §4.
- alerts (f4-cleaner, Dependabot).

## Цель

Замкнуть цикл «спека → фабрика → результат + отчёт → память»:

1. **Step 0 (A):** установить профиль `mas` + живой smoke `run-spec.mjs`.
2. **B.1:** spec-gate (R5 в `check-consistency.mjs`).
3. **B.2:** авто-отчёт (`report-run.mjs`).
4. **B.3:** атомарный коммиттер (`committer.mjs`).
5. **B.4:** метрики (`mas-runs.json` + `npm run runs:log`).

## Что делаем

1. **Step 0 (A):** `dsh --profile mas --from-default-profile headless` + `dsh plugin --profile mas add @nanmicoder/dsh-agent-teams` (pnpm/сеть, **вне репо**). Затем — smoke `node .project/scripts/run-spec.mjs <spec-id>` (живой режим: без `--dry-run`) на тестовой спеке. Precondition-missing (exit 3) должен исчезнуть.
2. **B.1 spec-gate:** R5 в `.project/scripts/check-consistency.mjs` — для каждой completed-задачи спеки проверка «есть коммит с `spec-NNN` + `tN` в subject». Whitelist для cancelled. Интеграция в `sync:check`.
3. **B.2 авто-отчёт:** `.project/scripts/report-run.mjs` — парсинг `team.json` → выжимка (verdict, duration, tasks summary) → вставка в `docs/index.html` (блок «Последний MAS-прогон» через sync) + запись в `episodic.md` (rule 12).
4. **B.3 committer:** `.project/scripts/committer.mjs` — атомарный `git add` явными путями + `git commit` с проверкой staged-set ⊆ allowed. `--dry-run`.
5. **B.4 метрики:** расширение `.project/mas-runs.json` (поле `durationMs`, `tokens`, `verdict`); npm `runs:log` — идемпотентный append.

## Декомпозиция

1. `id: t0` · `subject: Step 0 (A) — установка профиля mas + живой smoke run-spec.mjs; preconditions H2 закрыты; отчёт в .project/scripts/RUN-SPEC-LIVE.md; при недоступности pnpm/сети — STOP, остальные задачи продолжают` · `assignee: builder` · `dependencies: []`
2. `id: t1` · `subject: spec-gate R5 в check-consistency.mjs — completed-задача спеки ↔ коммит (subject содержит spec-NNN + tN); whitelist cancelled; интеграция в sync:check` · `assignee: builder` · `dependencies: []`
3. `id: t2` · `subject: .project/scripts/report-run.mjs — team.json → выжимка (verdict/duration/tasks) → docs/index.html (блок «Последний MAS-прогон») + episodic.md (rule 12)` · `assignee: builder` · `dependencies: []`
4. `id: t3` · `subject: .project/scripts/committer.mjs — атомарный git add/commit; --dry-run; проверка staged-set ⊆ allowed` · `assignee: builder` · `dependencies: []`
5. `id: t4` · `subject: mas-runs.json — расширение (durationMs, tokens, verdict) + npm runs:log (идемпотентный append)` · `assignee: builder` · `dependencies: [t1]`
6. `id: t5` · `subject: reviewer — независимое ревью t0–t4; verdict=pass; integration: run-spec → team → report-run → mas-runs → sync:check` · `assignee: reviewer` · `dependencies: [t0, t1, t2, t3, t4]`

Оговорки:

- **t0 независим** от t1–t4. Если t0 STOP (нет сети/pnpm) — t1/t2/t3/t4 всё равно выполняются; t0 отражает в отчёте.
- Правки — в `.project/scripts/`, `.project/mas-runs.json`, `docs/index.html` (через sync), `docs/memory/episodic.md`, `package.json`.
- Approve капитана обязателен.
- **Write-скоупы:** потенциальный overlap между t1 (spec-gate R5 — может потребовать правки `package.json`, если `sync:check` меняется) и t4 (`runs:log` — добавляет npm-скрипт в `package.json`). Чтобы гарантировать непараллельную запись в `package.json`, t4 сделан последовательным: `dependencies: [t1]`. Если t1 не модифицирует `package.json` (R5 — только `check-consistency.mjs`, уже вызывается из `sync:check`) — зависимость безвредна.

## Edge Cases и стратегия проверки

- **Step 0 (A):** если pnpm/сеть недоступны — STOP t0, остальные продолжают. Живой smoke — follow-up.
- **Step 0, флаг живого прогона (факт 033a, проверено при создании draft):** у `run-spec.mjs` **нет** флага `--live`; поддержаны `--dry-run`, `--json`, `--profile`, `--workspace`, `--timeout-ms` (неизвестный флаг → exit 2). «**Живой smoke**» = прогон **без** `--dry-run` (`mode=run`), т.е. `node .project/scripts/run-spec.mjs <spec-id>`. Если капитан хочет буквальный алиас `--live` — он добавляется в t0 как синоним не-dry-run (тривиально, в scope `run-spec.mjs`).
- **Spec-gate (t1):** ложные срабатывания при multi-commit задачах. Правило: **хотя бы один** коммит с `spec-NNN` + `tN`. При этом известно (alerts, 2026-09-30), что параллельный writer может вклиниться между чтением файла и `git add` — gate не должен падать на «чужой» записи в коммите, только на отсутствии своей.
- **Report-run (t2):** `team.json` в состоянии `deliverable` — читать `tasks[].verdict`, `members[].status`. Отсутствие `team.json` (команда ещё идёт) — понятный no-op, не ошибка.
- **Committer (t3):** не ломать pre-commit hook (SYNC DRIFT — известный шум). Проверка staged-set ⊆ allowed **до** коммита, не после.
- **Метрики (t4):** идемпотентный append — повторный прогон на том же teamId → no-op. Расширение схемы `mas-runs.json` — обратно совместимое (старые 4 записи без новых полей остаются валидными; `version` учитывать).
- **Naming 034:** в `.project/SPEC.md` будет **отдельная** строка `| 034 | mas-autonomy-b | infra | ... |`. НЕ пересекается с 033a.
- **`agent_teams_delete` инвалидирует блок «Пульс агентов»** в `docs/index.html` (lesson 033a): если t2/t5 затрагивают центр — converge **после** архивации команды.

## Критерии приёмки

1. **Step 0 (t0, если не STOP):** профиль `mas` установлен; `run-spec.mjs <spec-id>` (живой прогон, без `--dry-run`) → exit 0 (не 3); отчёт `RUN-SPEC-LIVE.md`.
2. **R5 (t1):** `sync:check` включает spec-gate; 0 findings при согласованности; ловит missing-commit.
3. **Report-run (t2):** `docs/index.html` содержит блок «Последний MAS-прогон» (verdict/duration/tasks).
4. **Committer (t3):** `--dry-run` → preview; реальный запуск → атомарный commit.
5. **Метрики (t4):** `npm run runs:log` добавляет запись в `mas-runs.json`; повторный вызов на том же teamId — no-op.
6. Reviewer verdict = pass.

## Что НЕ трогать

- `src/**` (продукт).
- Спеки 028–033a.
- `docs/HANDOFF.md`, `docs/C-PLAN.md`, `docs/FACTORY-PLAN.md`, `docs/DEV-PLAN.md`, `docs/C0-CENTER-AUDIT.md`.
- `.project/factory/**`, `docs/dashboard/**`, `templates/factory/**`, `docs/archive/**`, `e2e/**`.
- MAS-артефакты 033a (`run-spec.mjs`, `RUN-SPEC-SPIKE.md`, `templates/mas/*`) — только интеграция, не правка (исключение — алиас `--live` из Edge Cases, если капитан его запросит).
