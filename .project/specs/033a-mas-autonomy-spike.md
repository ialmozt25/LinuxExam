---
id: 033
slug: mas-autonomy-spike
type: infra
status: approved
commit: null
---

# Спека 033a — MAS-autonomy: spike + фундамент (run-spec.mjs, TASK.md)

Источник фактов: RECON-MAS-AUTONOMY (28.09.2026), spec 032 (done, 2539526), alerts (Dependabot, f4-cleaner observation). Этот документ описывает spike + фундамент автономного цикла; реализация — после approve. Остальные 4 компонента — spec 033b (создаётся после закрытия 033a).

## Контекст

Spec 032 закрыла 3 точечных долга. Ключевой вопрос автономии — **программируемость `dsh-agent-teams`**: возможно ли вызывать `agent_teams_create`/`status` из Node-скрипта (HTTP API? CLI? прямая запись в `.agent-teams/`?). Ответ определяет дизайн `run-spec.mjs` и всех зависимых компонентов (033b).

## Источники

- RECON-MAS-AUTONOMY (28.09.2026) — 6 разрывов; §2 — tool-surface `dsh-agent-teams`.
- spec 032 (done, `2539526`) — `archive-team.mjs`, `order-manifest.mjs` — контекст конвенции.
- `docs/HANDOFF.md` §4.
- `.project/scripts/`, `tools/` — конвенция путей.

## Цель

1. **Spike (t0):** определить программируемый путь к `dsh-agent-teams`.
2. **`run-spec.mjs` (t1):** по результатам spike — скрипт-оркестратор.
3. **`templates/TASK.md` + `templates/SESSION.md` (t2):** handoff-шаблоны.

## Что делаем

1. **Spike (t0):** проверить 4 гипотезы:
   - **H1:** DSH HTTP API (`curl http://127.0.0.1:3080/api/...`) — существует? Есть документация?
   - **H2:** DSH CLI (`dsh agent-teams create ...`) — установлен?
   - **H3:** Прямая запись в `.agent-teams/<teamId>/team.json` — плагин подхватывает?
   - **H4:** через `node -e` вызывать tool-surface? (вряд ли)
   Результат — **отчёт-заключение** в `.project/scripts/RUN-SPEC-SPIKE.md` с указанием работающего пути или STOP.
2. **`run-spec.mjs` (t1):** по результату t0 — CLI + npm-скрипт `spec:run`. Вход: `<spec-id>`. Выход: структурированный отчёт + запись в `mas-runs.json` (или STOP, если t0 не нашёл путь).
3. **`templates/TASK.md` + `templates/SESSION.md` (t2):** ODAF-формат; `run-spec.mjs` копирует их в `.agent-teams/<teamId>/`.

## Декомпозиция

1. `id: t0` · `subject: spike — определить программируемый путь к dsh-agent-teams (HTTP API / CLI / прямая запись в .agent-teams/); отчёт в .project/scripts/RUN-SPEC-SPIKE.md; STOP, если ни один путь не работает` · `assignee: builder` · `dependencies: []`
2. `id: t1` · `subject: .project/scripts/run-spec.mjs + npm spec:run — по пути из t0; вход spec-id, выход отчёт; если t0 = STOP, t1 = STOP` · `assignee: builder` · `dependencies: [t0]`
3. `id: t2` · `subject: templates/TASK.md + templates/SESSION.md — ODAF-формат; интеграция с run-spec.mjs (копирование перед запуском)` · `assignee: builder` · `dependencies: [t1]`
4. `id: t3` · `subject: reviewer — независимое ревью t0–t2; verdict=pass; integration: run-spec → создание команды → отчёт` · `assignee: reviewer` · `dependencies: [t2]`

Оговорки:

- Если t0 = STOP (путь не найден), t1 и t2 **не выполняются**; reviewer оценивает только t0 + план fallback для 033b.
- Правки — в `.project/scripts/`, `templates/`, `package.json`.
- Approve капитана обязателен.
- 033b (spec-gate / авто-отчёт / committer / метрики) — отдельная спека после закрытия 033a.

## Edge Cases и стратегия проверки

- **t0 — главный риск.** Если путь не найден — STOP. Не «обходить» через костыли.
- **H3 (прямая запись):** плагин читает `.agent-teams/<teamId>/team.json` при старте — есть ли watcher? Или только при перезапуске? Проверить.
- **`templates/`:** в этом каталоге уже есть `templates/factory/` (scaffold). **Не смешивать** — создать `templates/mas/TASK.md`, `templates/mas/SESSION.md`.
- **t1 integration:** `run-spec.mjs` вызывается **вне DSH** (CLI). Если он дёргает HTTP API — DSH должен быть запущен. Документировать precondition.
- **t3 (reviewer):** integration-тест — прогнать на тривиальной спеке.

## Критерии приёмки

1. **t0:** отчёт `.project/scripts/RUN-SPEC-SPIKE.md` — есть; указан работающий путь (H1/H2/H3) или STOP.
2. **t1 (если t0 ≠ STOP):** `npm run spec:run <spec-id>` — выполняет команду, возвращает отчёт.
3. **t2:** `templates/mas/TASK.md` + `templates/mas/SESSION.md` — существуют, ODAF-формат.
4. Reviewer verdict = pass.

## Что НЕ трогать

- `src/**` (продукт).
- Спеки 028–032.
- `docs/HANDOFF.md`, `docs/C-PLAN.md`, `docs/FACTORY-PLAN.md`, `docs/DEV-PLAN.md`, `docs/C0-CENTER-AUDIT.md`.
- `.project/factory/**`, `docs/dashboard/**`, `docs/archive/**`, `e2e/**`.
- `tools/` (только чтение), `.project/sync.mjs` (не трогать в 033a).
