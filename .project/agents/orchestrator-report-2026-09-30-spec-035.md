## 2026-09-30 · Orchestrator
### Goal
Spec 035 (`run-spec-workspace-fix`, type=infra, approved): устранить дефект spec-resolution в `.project/scripts/run-spec.mjs` при `--workspace` вне корня репо (nested-агент получал относительный путь спеки и не находил файл → `collect: failed`, exit 1), добавить `--live` как алиас не-dry-run, восстановить оригинальный STOP-нарратив `RUN-SPEC-LIVE.md` в отдельный файл.

### Completed
Прогон AgentTeams `spec-035-run-spec-workspace-fix` — 3 роли (builder + builder2 на `deepseek-official/deepseek-v4-flash`, reviewer на `deepseek-official/deepseek-v4-pro`, effort high), DAG: t1 ∥ t2 → t3.

- **t1** (implementation, builder): `.project/scripts/run-spec.mjs` (+111/−4) — **вариант A**: `materializeSpec()` + `WORKSPACE_SPECS_DIR` материализует файл спеки в `<workspace>/.project/specs/<file>.md` перед реальным прогоном, а в `/agent-teams`-промпт идёт `.project/specs/<file>.md` — путь, существующий относительно cwd вложенного агента (= `--workspace`). При workspace = корень репо копирование пропускается (target == source), taskText не изменён; в `--dry-run` записи нет. `--live` — алиас не-dry-run (`parseArgs` + USAGE + шапка), одиночный `--dry-run` остаётся dry-run. Коды выхода (0/1/2/3), формат отчёта и `package.json` не тронуты.
- **t2** (work, builder2): `.project/scripts/RUN-SPEC-SPIKE-STOP.md` (22867 Б) = дословная копия `6b06d73:.project/scripts/RUN-SPEC-LIVE.md` (`git hash-object` = `f3bb4cdac3e7ede6058fa87827fa94a5a1fcfc63`; 260 строк, LF, без BOM). Текущий `RUN-SPEC-LIVE.md` (30 строк, `a520e7c5…`) не изменён — регрессии нет.
- **t3** (review round 1, reviewer): **verdict = pass**, findings нет — ratification by re-execution: все критерии подтверждены собственными командами ревьюера, включая два живых прогона; дифф проверен самостоятельно (правки только в `run-spec.mjs`).
- Живые доказательства (сырые выводы): (1) из `%TEMP%` без `--workspace` → exit 0, `collect: ok`, `team.json` phase=staged (174940 мс); (2) из каталога вне репо `--live --workspace %TEMP%\rs035-review-c2ws` → exit 0, `collect: ok`, `team.json` в temp-workspace (108595 мс), материализованная спека байт-в-байт = источнику. У builder'а — свой успешный прогон (71279 мс, `…\rs035-t1-97ace1eb`) и один env-failed probe.
- Память: запись `## 2026-09-30 | spec-035-run-spec-workspace-fix` в `docs/memory/episodic.md` + новый блок в `docs/memory/working.md`; evidence — `git status --porcelain` содержит `M docs/memory/episodic.md` и `M docs/memory/working.md`.
- Метрики: `npm run runs:log -- spec-035-run-spec-workspace-fix` → verdict `pass`, durationMs 726314, задач completed 3 (`.project/mas-runs.json`, записей 15).
- Команда архивирована: `agent_teams_delete` → `.agent-teams/archive/spec-035-run-spec-workspace-fix`.

### Гейты
- `npm run typecheck` — 0 (до и после прогона).
- `npm run test:run` — 0 (28 файлов / 198 тестов) до и после.
- `npm run sync:check` — 2 сразу после архивации (ожидаемо: `docs/index.html` отстал — живой прогон дописал `mas-runs.json`; производные не закоммичены) → 0 после `npm run sync` + converge-коммита.

### Blockers
Блокеров прогона нет. Оговорки:

- **Env (LOW).** Harness-процесс не наследует User-переменную `DEEPSEEK_API_KEY`, поэтому живой прогон требует `$env:DEEPSEEK_API_KEY = [Environment]::GetEnvironmentVariable('DEEPSEEK_API_KEY','User')`; без неё — ложный `ROUTE_FAILED … no API key for provider route "deepseek-official"` (воспроизведено builder'ом и прямым `dsh --profile mas "…"` из корня репо). Ревьюер получил это указание сообщением капитана до своих прогонов, поэтому вердикт не искажён.
- **Отклонение от декомпозиции спеки.** Взяты два builder'а вместо одного: AgentTeams запрещает одному члену владеть двумя незавершёнными задачами, а t1 и t2 независимы и параллельны (write-скоупы не пересекаются: `run-spec.mjs` против `RUN-SPEC-SPIKE-STOP.md`).
- **Неблокирующее наблюдение.** `materializeSpec` (как и `stageTemplates`, урок 033a) выполняется до гейта preflight: реальный прогон без профиля оставит копию спеки в `<workspace>/.project/specs/`. Кандидат в follow-up.
- **Side effect.** Живые прогоны штатно дописали `.project/mas-runs.json` (+5 записей: 2 env-failed probe + 3 ok) — это дизайн инструмента, не правка вне скоупа участниками.

### Next Steps
1. Approve капитана → перевод spec 035 в `done`: коммит `docs(spec-035): done …` после проверки отчёта.
2. Push — только по отдельной per-command авторизации (правило 10).
3. Follow-up (LOW): гейт staging (`materializeSpec`/`stageTemplates`) на `pre.ok`; env-оговорка `DEEPSEEK_API_KEY` — в процедуру запуска живых прогонов.
