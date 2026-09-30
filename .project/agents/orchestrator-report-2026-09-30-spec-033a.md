# Orchestrator report — spec 033a (mas-autonomy-spike)

## 2026-09-30 · Orchestrator

### Goal

Исполнить спеку `.project/specs/033a-mas-autonomy-spike.md` (type: infra, status: approved)
прогоном skill `spec-to-team`: определить программируемый путь к `dsh-agent-teams`
(spike), по его результату собрать фундамент автономного цикла — `run-spec.mjs` +
npm-скрипт `spec:run`, handoff-шаблоны `templates/mas/{TASK,SESSION}.md` — и провести
финальную приёмку (гейты + интеграция + память).

### Completed

**Snapshot гейтов ДО старта:** `typecheck` 0 · `test:run` 0 (28 файлов / 198 тестов) ·
`sync:check` 0 (HEAD `bfb7ca2`) · `git status` — только известные untracked
(`.agent-teams/`, `drafts/_mas-results/`) · активной команды AgentTeams нет
(предусловие «одна команда на сессию» выполнено).

**Команда:** `spec-033a-mas-autonomy-spike`, 2 участника (builder —
`deepseek-official/deepseek-v4-flash` effort high; reviewer —
`deepseek-official/deepseek-v4-pro` effort high). DAG — по декомпозиции спеки,
последовательный (t1 зависит от вердикта t0, t2 — от t1, ревью — от t2):

| Задача | Исполнитель | Результат |
|---|---|---|
| t0 spike: программный путь к `dsh-agent-teams` | builder | completed, `PATH: H2` |
| t1 `.project/scripts/run-spec.mjs` + npm `spec:run` | builder | completed |
| t2 `templates/mas/TASK.md` + `SESSION.md` (ODAF) + копирование | builder | completed |
| t3 независимое ревью (kind=review, reviewedTaskId = t1, round 1) | reviewer | **completed, verdict = pass** |

**Что сделано:**

1. **t0 — spike, отчёт `.project/scripts/RUN-SPEC-SPIKE.md` (325 строк), вердикт
   `PATH: H2`.** Программируемого (детерминированного) вызова `agent_teams_create`
   из скрипта нет ни по одной гипотезе. H1 (HTTP API `:3080`) отклонён: `/`, `/api`,
   `/api/remote.mux`, `/plugins/dsh-agent-teams/*` → 401; аутентификация — browser-session
   cookie, который минтится только `GET /?token=<launch token>` (токен per-process
   печатает `dsh web`; в `DSH_*`/`~/.dsh/logs` его нет), а маршрута создания команды в
   API нет вовсе (`/plan` — редактор уже staged-плана живого капитана). H4 (импорт
   lib-модулей плагина из Node) отклонён: `registerAgentTeamsTools({}, …)` → TypeError,
   `execute(args, exec)` требует живой Cordis `Context` + `Agent`. H3 (прямая запись
   `.agent-teams/<teamId>/team.json`) — только **read**-канал: в плагине нет
   `chokidar`/`fs.watch`/`watchFile`, живой процесс внешнюю запись не замечает.
   H2 (CLI) — рабочий путь: one-shot `dsh --profile <p> "/agent-teams <цель>"`
   (headless-раннер; gesture-boundary плагина), резерв — stdio JSON-RPC
   `dsh --profile sdk`. Отчёт несёт precondition (профиль с плагином + LLM-роут;
   сервер и токен не нужны), 8 рисков и три fallback-плана для 033b (A/B/C).
2. **t1 — `.project/scripts/run-spec.mjs`** (999 строк, Node ESM, zero новых
   зависимостей) + `"spec:run"` в `package.json`: `<spec-id>` → парсинг спеки
   (front-matter + «## Цель») → детерминированная задача `/agent-teams <цель>` →
   preflight H2 (dsh CLI, каталог профиля, резолв `@nanmicoder/dsh-agent-teams` из
   профиля, workspace, каталог состояния) → one-shot spawn (cwd=workspace, timeout) →
   сбор результата с диска (`team.json` + `inbox/*.jsonl`) → атомарная дозапись
   `{spec,startedAt,finishedAt,status,report}` в `.project/mas-runs.json`. Коды выхода
   0/1/2/3, где 3 = `precondition-missing` с точными fix-командами; `--dry-run` не
   запускает команду и не пишет историю. Шапка фиксирует путь H2 и precondition
   (по образцу `.project/scripts/archive-team.mjs`).
3. **t2 — `templates/mas/TASK.md`** (108 строк) и **`templates/mas/SESSION.md`**
   (79 строк); `templates/factory/**` не смешивался. ODAF расшифрован **решением
   исполнителя** (канона в репозитории нет — поиск даёт 3 совпадения, все в спеке
   033a и без расшифровки): O=Objective, D=Deliverables, A=Acceptance, F=Forbidden
   (+ E=Evidence как обязательный раздел вне акронима); расшифровка и её статус
   зафиксированы в шапке шаблона. Стадия `stage-templates` в `run-spec.mjs` копирует
   оба шаблона в `.agent-teams/<teamId>/` (sha256 + побайтовая проверка, идемпотентно;
   при отсутствии шаблона — exit 1 до запуска прогона).
4. **Интеграция (лид):** `episodic.md` (запись spec-033a, `entries_count` 20→21),
   `working.md`, 5 строк в `.project/log.md`, запись в `.project/DECISIONS.md`,
   этот отчёт. `npm run sync` → коммиты → `sync:check` = 0.

**Финальные гейты (после остановки всех писателей):** `typecheck` 0 · `build` 0 ·
`test:run` 0 (28 файлов / 198 тестов) · `consistency:check` 0 · `check:episodic` 0
(все F0–F5, D0–D4) · **`sync:check` 0** (после converge-коммита). Гейты прогонялись
дважды: ревьюером (внутри t3, независимо) и лидом (финальная приёмка).

**Коммиты:** `f43b060` — `feat(spec-033a): run-spec.mjs + npm spec:run + MAS handoff
templates (PATH: H2)` (14 файлов, +2067/−70); `7b0b3a9` — `chore(state): converge after
spec-033a` (правило 9). Push не выполнялся (правила 10/11 — нужна per-command
авторизация капитана).

**Captain-only действие в прогоне:** контракт ревью t3 был **amended до старта**
(`agent_teams_amend_task`). Причина — исходный критерий «интеграционный тест: реальный
прогон → создание команды» невыполним без мутации окружения (`dsh plugin --profile mas
add @nanmicoder/dsh-agent-teams` = pnpm-установка вне репозитория, сеть) и без расхода
LLM-токенов; такой гейт нельзя честно пройти, а «пройти» его имитацией — ровно то, что
протокол запрещает. Acceptance заменён на детерминированную форму (ре-экзекуция улик
спайка, dry-run с проверкой хешей, реальный прогон → exit 3 + запись истории, шаблоны и
побайтовое копирование, независимый перепрогон гейтов) с явным запретом установок и
живого прогона. Детали — `.project/DECISIONS.md`, запись 2026-09-30.

### Blockers

Блокеров нет. Ограничение прогона (зафиксировано как решение, не как дефект):

- **Живой end-to-end MAS-прогон (`status=ok`) не исполнялся** — требует разовой
  установки профиля `mas` (pnpm вне репозитория) и расхода токенов, то есть мутации
  окружения без авторизации. `run-spec.mjs` в этом случае детерминированно выходит
  с кодом 3 и печатает fix-команды. Follow-up для 033b под авторизацию капитана.

Неблокирующие наблюдения (не findings):

- `stageTemplates` выполняется до гейта preflight (`run-spec.mjs:742` против `:773`),
  поэтому реальный прогон с `precondition-missing` оставляет копии шаблонов в
  `.agent-teams/<teamId>/` (команда при этом не создаётся; идемпотентно) — для 033b
  рассмотреть гейт staging на `pre.ok`;
- ODAF — акроним без канона в проекте; текущая расшифровка помечена как решение
  исполнителя и подлежит ревизии при появлении канона.

Отклонения от буквы skill (детали — `.project/DECISIONS.md`, запись 2026-09-30):
декомпозиция спеки вместо полного ростера по типу infra (без architect/tester — им нет
работы в этой спеке, t0–t2 последовательны); лид вместо участника пишет память,
`log.md`, `DECISIONS.md` и отчёт (single-writer, акт интеграции); самоисправление —
frontmatter спеки сначала был переведён в `status: done`, затем откачен к `approved`
(перевод в `done` — за капитаном, конвенция skill шага 8a и spec 032).

### Next Steps

1. **Капитан:** ревизия результата; перевод spec 033a в `status: done`
   (+ `commit: f43b060`) — фронтматтер спеки оркестратор не закрывает; push — отдельная
   per-command авторизация (правило 10).
2. **Spec 033b** (spec-gate / авто-отчёт / committer / метрики) — фундамент готов:
   путь H2 определён, `run-spec.mjs` даёт детерминированный контур
   «спека → задача → preflight → execute → read-back → атомарная история».
   Перед стартом 033b решить: (а) авторизовать разовую настройку профиля `mas` и живой
   смоук-прогон; (б) выбрать вариант пути для долгих прогонов (one-shot headless имеет
   риск обрыва долгой команды — вариант C со stdio JSON-RPC держит процесс и даёт поток
   событий); (в) закрыть наблюдение про порядок `stageTemplates`/preflight.
3. Открытые follow-up (вне 033a): фикстуры `e2e/quiz-flow.spec.ts` сидируют удалённый
   `fp_002` (QC-1 из spec 031).
4. Evidence прогона: `.agent-teams/spec-033a-mas-autonomy-spike` (архивация — хелпером
   `node .project/scripts/archive-team.mjs spec-033a-mas-autonomy-spike`).
