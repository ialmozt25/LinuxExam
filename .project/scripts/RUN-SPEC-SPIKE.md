# RUN-SPEC-SPIKE — программируемый путь к `dsh-agent-teams` (spec 033a, задача t0)

PATH: H2

- Дата прогона: 2026-09-30 (локальная машина, Windows, live-сессия DSH на :3080).
- Спека: `.project/specs/033a-mas-autonomy-spike.md` (type infra, approved).
- Задача: проверить H1 (HTTP API), H2 (CLI), H3 (прямая запись `.agent-teams/`), H4 (node-инвокация tool-surface) и указать работающий путь либо STOP.

## Вердикт (кратко)

| # | Гипотеза | Итог | Что именно не работает |
|---|---|---|---|
| H1 | HTTP API DSH (`:3080/api`, `/plugins/...`) | **отклонена** | нет неинтерактивного способа получить session-cookie; и, даже с cookie, среди маршрутов нет создания команды |
| H2 | CLI (`dsh ...`) | **работает** | подкоманды `dsh agent-teams` нет; работают два CLI-пути: one-shot `dsh --profile <p> "<task>"` (headless-раннер + gesture-boundary `/agent-teams`) и stdio JSON-RPC `dsh --profile sdk` |
| H3 | прямая запись `team.json` | **только чтение/данные** | в плагине нет watcher/poller на стороне хоста — живой процесс DSH не замечает внешнюю запись и не действует по ней |
| H4 | импорт lib-модулей плагина из Node | **отклонена** | tool-execute требует живой Cordis `Context` + `Agent`; без boot harness ничего не вызывается |

**Рабочий путь — H2 (CLI-раннтайм с профилем, в который смонтирован плагин)**, с обязательной оговоркой: прямого детерминированного вызова `agent_teams_create` из скрипта **не существует ни по одной из четырёх гипотез**; во всех работающих вариантах в контуре есть LLM (модель-капитан вызывает инструменты). Структурированный результат прогона берётся не из HTTP, а **с диска** (`.agent-teams/<teamId>/team.json` + `inbox/*.jsonl`) — это H3 в роли read-канала.

## 0. Зафиксированное окружение

```
PWD=C:\Users\Alexey Udotov\LinuxExam
NODE=v24.13.0   NPM=11.6.2
Get-Command dsh -> C:\Users\Alexey Udotov\AppData\Roaming\npm\dsh.ps1
npm ls -g --depth=0 -> @deepseek-ai/dsh@0.1.5-rc.2, dsh-fix@0.2.0, mcp-redhat-manpage@0.2.3
DSH_HOME=C:\Users\Alexey Udotov\.dsh
DSH_SESSION_ID=bfae06a0-ec79-4b30-b405-9d28aa4f9712
DSH_WEB_URL=http://127.0.0.1:3080        (токена в окружении нет)
~/.dsh/profiles -> headless, web            (после H2-проб `dsh --profile sdk …` там же
                                             авто-создался sdk; удалён в конце спайка — см. риск 8)
плагин: C:\Users\Alexey Udotov\.dsh\profiles\web\node_modules\@nanmicoder\dsh-agent-teams@0.1.20
```

---

## 1. H1 — HTTP API DSH

### Команды

```powershell
curl.exe -s -i --max-time 8 http://127.0.0.1:3080/
curl.exe -s -i --max-time 8 http://127.0.0.1:3080/api
curl.exe -s -i --max-time 8 -X POST -H 'Content-Type: application/json' --data '{}' http://127.0.0.1:3080/api
curl.exe -s -i --max-time 8 http://127.0.0.1:3080/plugins/dsh-agent-teams/state
curl.exe -s -i --max-time 8 "http://127.0.0.1:3080/?token=bogus"
curl.exe -s -o NUL -w "status=%{http_code}" --max-time 8 -H "Origin: http://evil.example" http://127.0.0.1:3080/api
Get-ChildItem env: | Where-Object { $_.Name -like 'DSH*' -or $_.Name -match 'TOKEN|API|URL|PORT|WEB' }
Get-ChildItem 'C:\Users\Alexey Udotov\.dsh\logs' -Recurse -File | Select-String -Pattern 'token='
```

### Сырой вывод (сокращён)

```
=== GET / ===
HTTP/1.1 401 Unauthorized
cache-control: no-store
content-type: text/plain; charset=utf-8

dsh web authentication required; reopen the URL printed by dsh web.

=== GET /api ===            -> HTTP/1.1 401 Unauthorized   body: unauthorized
=== POST /api {} ===        -> HTTP/1.1 401 Unauthorized   body: unauthorized
=== GET /plugins/dsh-agent-teams/state ===
HTTP/1.1 401 Unauthorized
content-type: application/json; charset=utf-8
{"error":"unauthorized"}
=== GET /plugins/dsh-agent-teams/assets === -> 401
=== GET /?token=bogus ===   -> HTTP/1.1 401 Unauthorized
=== GET /api с Origin: http://evil.example === -> status=403

=== DSH_* env ===
DSH_HOME=C:\Users\Alexey Udotov\.dsh
DSH_SESSION_ID=bfae06a0-ec79-4b30-b405-9d28aa4f9712
DSH_SHELL=1
DSH_WEB_URL=http://127.0.0.1:3080
=== logs: token= -> (ничего; в ~/.dsh/logs только auto-approval.log)
```

### Документирован ли API и как получить токен

Да, документирован — прямо в поставке DSH (не только в репозитории):

- `@deepseek-ai/dsh-client-connection/README.md`, §«Browser authentication and request trust»:
  «Each process mints a random launch token. `dsh-web-app` prints and opens the ordinary root URL with `?token=...`; `frontend-static` delegates root and index requests to `ctx.connection.authorizeIndex`, which accepts that token only on `GET /`, writes an authority-bound signed cookie, and redirects to clean `/`… **The HTTP carrier accepts no query token outside the root exchange and no Authorization-header token.**»
- Там же: cookie подписана секретом `client-connection/browser-session` из `ctx.credentials`; локальный провайдер хранит его в `$DSH_HOME/.credentials.yaml` (в файле действительно есть запись `client-connection/browser-session` → `payload.secret`; значение не приводится).
- Там же: failed Host/Origin check → 403, trusted-but-unauthenticated → 401. Наблюдаемое 403 при подменённом `Origin` и 401 без cookie это подтверждают.
- `/api` — это Typert Gateway Remote RPC (POST) + WebSocket `/api/remote.mux` (`dsh-api-gateway/README.md`), а не REST для команд.

Токен добыть вне интерактивной сессии нельзя: он генерируется на процесс, печатается в stdout `dsh web` при запуске, не попадает в окружение (в `DSH_*` только HOME/SESSION_ID/SHELL/WEB_URL), не пишется в `~/.dsh/logs`. Теоретически cookie можно подделать, зная секрет из `.credentials.yaml` (`v1.<base64url(body)>.<base64url(hmac-sha256)>`, имя `dsh-auth-<sha256(authority)>`), но это обход security-фенса; эмпирически это не проверялось и **не рекомендуется**.

### Вывод по H1 — не работает

1. Блокер аутентификации: единый browser-session cookie, получаемый только через `GET /?token=…` с per-process токеном из stdout `dsh web`.
2. Блокер функциональности: карта маршрутов не содержит создания команды. Плагин регистрирует `/plugins/dsh-agent-teams/{state,halt,plan,assets}` (`lib/index.js:162-432`), все — через `authenticatedWebRoutes()` (`lib/web-routes.js:61-86`, тот же `connection.requestRejection` → 401). `/plan` умеет `approve|continue|discard|update_member|update_task|add_task|remove_task`, но требует `sessionId` уже привязанного капитана (`ctx.agents.get(sessionId)`) и **уже существующей** staged-команды — то есть это редактор плана, а не точка входа.

---

## 2. H2 — CLI

### Команды

```powershell
Get-Command dsh
dsh --help
dsh agent-teams --help
npx --no-install dsh --version
Get-ChildItem 'C:\Users\Alexey Udotov\.dsh\profiles'
dsh plugin --profile headless --help
dsh --profile headless --dump-config
dsh --profile web --dump-config --patch "<...\@deepseek-ai\dsh\node_modules\@deepseek-ai\dsh-headless\cordis.patch.yml>"
dsh --profile sdk --help
node -e "require.resolve('@nanmicoder/dsh-agent-teams',{paths:['<profile dir>']})"
```

### Сырой вывод (сокращён)

```
=== dsh --help ===
Usage: dsh [options] [command] [args...]
Options: -V, --version | --profile <name> | --from-default-profile <name> | --patch <path> | --dump-config | --dump-default-config
Commands:
  web [options] [args...]        boot the web profile (alias of --profile web)
  plugin [options] [args...]     manage a profile's plugins (forwards to pnpm)
Examples:
  dsh --profile web                          boot the web profile
  dsh --profile headless "run the tests"     answer one task, print the result, and exit

=== dsh agent-teams --help ===   -> тот же корневой help (подкоманды agent-teams нет)

=== npx --no-install dsh --version ===   -> 0.1.5-rc.2

=== dsh plugin --profile headless --help ==="
Package manager  Usage: pnpm [OPTIONS] <COMMAND>   (Commands: add, install, update, …)

=== dsh --profile web --dump-config --patch "<dsh-headless\cordis.patch.yml>" ===  exit=0
# == @nanmicoder/dsh-agent-teams
- id: agent-teams
  name: '@nanmicoder/dsh-agent-teams'
    stateDir: .agent-teams
# == <...>\@deepseek-ai\dsh-headless\cordis.patch.yml
- id: headless-startup
  name: '@deepseek-ai/dsh-headless/startup'
- id: headless-runner
  name: '@deepseek-ai/dsh-headless'

=== dsh --profile headless --dump-config === (фрагмент) exit=0
- id: tools / system-prompt / agent / agent-loop / subagent / subagent-spawn-in-process /
      subagent-fork-in-process / skill / llm / llm-deepseek …   (все inject плагина: tools, llm, subagents, systemPrompt, agents)

=== dsh --profile sdk --help ===
Usage: dsh --profile sdk [options]
Serve DeepSeek Harness SDK clients over stdio JSON-RPC.

=== резолв плагина из каталога профиля ===
headless -> NOT RESOLVABLE: MODULE_NOT_FOUND
web      -> C:\Users\Alexey Udotov\.dsh\profiles\web\node_modules\@nanmicoder\dsh-agent-teams\lib\index.js
```

Дополнительно из поставки:

- Шаблоны профилей (`dsh-app-boot/lib/index.js:328`): `acp`, `web`, `headless`, `sdk`, `sdk-minimal` — «auto-initialized on first use», то есть `dsh --profile sdk` доступен без ручной установки профиля.
- `@deepseek-ai/dsh-headless/README.md`: «runs one dsh task from the command line and prints the final answer, then exits — no GUI, no server, no browser… `dsh --profile headless "run the tests"`… exit code tells you the outcome».
- `@deepseek-ai/dsh-sdk-jsonrpc-server/README.md`: stdio JSON-RPC, клиент делает `initialize`, затем `session/prompt`, сервер стримит `session.event`/`session.status`; ограничения — «no per-session close or prompt-cancel method», «no per-prompt result» (клиент сам определяет момент завершения), stdout — только протокол.
- `@nanmicoder/dsh-agent-teams/README.md:122-125`: «Surfaces without command adjudication (**for example the headless CLI**) get the same deterministic activation through a gesture boundary: any genuine user message starting with `/agent-teams` activates the protocol» — то есть headless-поверхность поддержана плагином явно.
- Единственный bin плагина — `dsh-agent-teams-doctor` (`scripts/doctor.mjs`), это диагностика манифестов совместимости; команд управления командой он не даёт.

### Вывод по H2 — работает (как класс пути), но не в буквальной форме `dsh agent-teams create`

`dsh agent-teams …` не существует. Работают два CLI-входа, оба проверены на уровне композиции/резолва (см. §5 — что именно не проверено end-to-end):

1. **one-shot headless-раннер**: `dsh --profile <p> "<task>"`, где `<p>` — профиль, в чьих `node_modules` лежит плагин; текст задачи начинается с `/agent-teams …` (gesture boundary из README плагина).
2. **stdio JSON-RPC SDK**: `dsh --profile <p-sdk>`, клиент — обычный Node-процесс.

---

## 3. H3 — прямая запись `.agent-teams/<teamId>/team.json`

### Команды

```powershell
Select-String -Path "<plugin>\lib\*.js" -Pattern 'chokidar|fs\.watch|watchFile|FSWatcher|watch\('
Select-String -Path "<plugin>\lib\*.js" -Pattern 'setInterval|setTimeout\(|createTimer|poll'
node "$env:TEMP\spec-033a-spike\h3-h4-probe.mjs"      # scratch-root, активная команда не затрагивалась
```

### Сырой вывод (сокращён)

```
=== watcher-паттерны ===            No matches found
=== timers/polling ===              только client.js (браузерная половина: ACTIVITY_POLL_MS=1e3,
                                    startActivityPolling) — на стороне хоста поллинга нет

=== node ...\h3-h4-probe.mjs ===
H3A.import: ok — exports: 58 (readTeam/readTeamSync/createTeamDir/writeTeam present: true)
H3A.readTeam(after createTeamDir): {"id":"spike-scratch","name":"Spike Scratch","members":0,"tasks":0}
H3A.readTeamSync(hand-written file): {"id":"spike-scratch","name":"Spike Scratch (hand-written)","accepted":true}
H3A.isTeamTask(minimal task): false
H3A.tree: ["inbox","team.json"]
H4.registerAgentTeamsTools(stub ctx): throws: TypeError: Cannot read properties of undefined (reading 'followup')
```

Скрипт-зонд лежит в scratch-каталоге `%TEMP%\spec-033a-spike\`, state-root — `%TEMP%\spec-033a-spike\.agent-teams`; `.agent-teams/spec-033a-mas-autonomy-spike/**` не читался и не изменялся.

### Вывод по H3 — только data-plane (чтение), не control-plane

- Watcher'а нет: ни `chokidar`, ни `fs.watch`, ни хост-поллинга. Состояние читается **по запросу** — инструментами (`readTeam(stateRoot, teamId)`, напр. `tools.js:649`, `:721`) и HTTP-маршрутом `/state` при опросе из браузера.
- Внешний Node-скрипт **может** читать/писать файл состояния: `lib/state.js` импортируется из обычного Node (58 экспортов), рукописный `team.json` принимается `readTeamSync`, `createTeamDir()` сам создаёт `team.json` + `inbox/`.
- Но живой DSH-процесс по такой записи **ничего не сделает**: не разбудит капитана, не запустит планировщик, не создаст членов. Хуже: мутации плагина идут через in-process очередь `withTeamLock` и атомарную запись `replaceFileAtomicOrDirect` — внешняя запись гоняет с ними, а README плагина прямо говорит: «State is file-backed and serialized within one DSH process; concurrent processes editing the same team are not coordinated».
- Побочная деталь для 033b: `team.json` валидируется не только структурно (`readTeamSync` вернул запись), но и по задаче — `isTeamTask()` требует `id`, `subject`, `status`, `dependencies`, `createdAt`, `updatedAt` (finite numbers), опциональные `output/attemptId/…`; probe-задача вида `{id,subject,status,dependencies,kind}` даёт `false`. То есть рукописный `team.json` должен быть полным, иначе команда «есть», а задач в ней не видно.

---

## 4. H4 — инвокация tool-surface из Node

### Команды / свидетельства

```powershell
node "$env:TEMP\spec-033a-spike\h3-h4-probe.mjs"          # импорт lib/tools.js + stub-ctx вызов
Select-String -Path "<plugin>\lib\tools.js" -Pattern 'ctx\.tools\.register|async execute'
Select-String -Path "<plugin>\lib\index.js" -Pattern 'export const inject'
```

### Сырой вывод (сокращён)

```
H4.import: ok — exports(7): applyQualityFollowUp, haltTeamWork, registerAgentTeamsTools,
                            stagedPlanApprovedContext, stagedPlanDiscardContext,
                            stagedPlanFeedbackContext, steerCaptainReport
H4.registerAgentTeamsTools(stub ctx): throws: TypeError: Cannot read properties of undefined (reading 'followup')

tools.js:  ctx.tools.register(defineTool({ … }))  — 14 инструментов (tools.js:571…2030)
index.js:  export const inject = ['tools', 'llm', 'subagents', 'systemPrompt', 'agents']
tools.js:  async execute(args, exec) { const captain = requireCaptain(exec); const workspace = workspaceOf(captain); … }
tools.js:649  const existing = await readTeam(stateRoot, teamId);   // состояние читается с диска
```

### Вывод по H4 — нереалистично

Импорт модулей технически проходит (ESM резолвится из профиля), но поверхность инструментов — не библиотека: `execute(args, exec)` требует живой `exec` с `Agent`-капитаном (`requireCaptain`, `workspaceOf`), а `registerAgentTeamsTools(ctx, config)` — полноценный Cordis `Context` с сервисами `tools/llm/subagents/systemPrompt/agents`. Без boot harness (то есть без того же CLI-пути из H2) вызывать нечего. «Правильный» вариант H4 — поднять harness в процессе (как это делают `dsh-headless` и `dsh-sdk-app`) — по факту деградирует в H2.

---

## 5. Выбранный путь и precondition

**Путь: H2 — CLI-раннтайм с профилем, в который установлен `@nanmicoder/dsh-agent-teams`.**

### Вариант A (основной): one-shot headless-профиль

```powershell
# разовая настройка вне репозитория (сеть: pnpm-установка)
dsh --profile mas --from-default-profile headless
dsh plugin --profile mas add @nanmicoder/dsh-agent-teams

# прогон (cwd = рабочая директория MAS-прогона)
dsh --profile mas "/agent-teams <цель из спеки>"
```

Шаблон `headless` = `@deepseek-ai/dsh-base` + `@deepseek-ai/dsh-headless`; в base есть всё, что инжектит плагин (`tools`, `llm`, `subagents`, `systemPrompt`, `agents` — подтверждено `--dump-config`), плюс `subagent-spawn-in-process`/`subagent-fork-in-process`, `llm-deepseek`, `skill`, `code-runtime`. HTTP-сервер не поднимается, браузер не открывается, токен не нужен.

### Вариант B (без настройки профиля): web-профиль + headless-патч

```powershell
dsh --profile web --patch "<npm>\@deepseek-ai\dsh\node_modules\@deepseek-ai\dsh-headless\cordis.patch.yml" "<task>"
```

Композиция проверена (`--dump-config`, exit 0; в дереве есть и `agent-teams`, и `headless-runner`). Оговорка: web-набор всё ещё монтирует HTTP-сервер и браузерный плагин, поэтому возможны `EADDRINUSE` на :3080 и открытие окна — вариант только как резервный (порт задавать флагами web-приложения).

### Вариант C (API-grade): stdio JSON-RPC SDK

```powershell
dsh --profile mas-sdk --from-default-profile sdk
dsh plugin --profile mas-sdk add @nanmicoder/dsh-agent-teams
# run-spec.mjs: spawn('dsh', ['--profile','mas-sdk']) и JSON-RPC по stdio
#   initialize -> session/prompt("/agent-teams …") -> поток session.event/session.status -> shutdown
```

Даёт структурированный поток событий вместо «финального ответа одной строкой», но: нет per-prompt результата (момент завершения определяет клиент) и нет отмены. Это лучший кандидат, если 033b нужен программный контроль прогресса.

### Precondition

| Что | Нужно? | Деталь |
|---|---|---|
| Запущенный DSH / GUI :3080 | **нет** | headless/sdk — отдельные процессы, сервер не поднимают |
| Токен / cookie | **нет** | нужен только HTTP-пути (H1), который отклонён |
| Путь к плагину | **да** | плагин обязан резолвиться из `node_modules` профиля: `headless → MODULE_NOT_FOUND`, `web → OK` (проверено `require.resolve`) |
| LLM-роут | **да** | headless-шаблон несёт `dsh-tier-router`; адаптер DeepSeek и `DEEPSEEK_API_KEY`/настройки — как в текущем web-профиле |
| cwd | **да** | `stateDir=.agent-teams` резолвится от workspace сессии: `<workspace>/.agent-teams/<teamId>/` |
| Права | зависит | headless берёт `DSH_PERMISSION_MODE` (по умолчанию `workspace-write`) — запись за пределы workspace потребует широкого режима |
| Время жизни | 1 процесс | члены — in-process subagents; после выхода процесса живёт только файловое состояние (плагин восстанавливает «stranded» работу на рестарте) |

---

## 6. Риски

1. **LLM в контуре.** Единственные работающие пути — «попросить капитана вызвать инструменты». Детерминированного `create` из скрипта нет; модель может не создать команду/план. Митигация: после прогона проверять наличие `.agent-teams/<teamId>/team.json`; его отсутствие считать провалом прогона.
2. **One-shot обрывает долгую команду.** Headless отвечает «one task per invocation, no interactive follow-up» и ждёт квиесценции одного агента; если капитан уходит в ожидание членов, ран может завершиться раньше команды. Это главный технический риск 033b (вариант C с потоком событий и удержанием процесса снижает его).
3. **Прямая запись в `.agent-teams/` не является управлением.** Нет watcher'а; конкурентные записи двух процессов не координируются, а живые мутации плагина используют внутренние локи и атомарную запись. Писать туда можно только когда команду не ведёт живой процесс.
4. **Security-фенс H1.** Cookie можно подделать по секрету из `$DSH_HOME/.credentials.yaml`, но это обход аутентификации; не использовать. Побочно: `--host 0.0.0.0` не поддержан, а статика отдаётся публично.
5. **Изменения вне репозитория.** `dsh plugin add` — это pnpm-установка в `~/.dsh/profiles/<p>` (сеть + запись вне workspace). Должно быть разовым документированным предусловием, а не скрытым шагом `run-spec.mjs`.
6. **Windows-специфика архивации.** `agent_teams_delete()` может падать с EPERM на `rename` (spec 030/031) — уборку прогонов делать через `.project/scripts/archive-team.mjs`, а не полагаться на плагин.
7. **Неопределённость LLM-роута в headless.** Профиль `mas` получит свой `llm`/`tier-router`; если модельный маршрут там не настроен, ран упадёт до создания команды — проверять на смоук-прогоне.
8. **Побочный артефакт спайка.** `dsh --profile sdk --help/--dump-config` автоматически создал `~/.dsh/profiles/sdk` (740 байт скэффолдинга: `cordis.yml`, `package.json`, `pnpm-workspace.yaml`, пустой `node_modules`); после замеров каталог удалён, чтобы вернуть окружение в исходное состояние (создаётся заново при первом использовании).

---

## 7. Fallback-план для 033b

**План A (если LLM-путь принят).** `run-spec.mjs`: (1) читает спеку, генерирует цель и `mas-run-id`; (2) копирует `templates/mas/{TASK,SESSION}.md`; (3) запускает `dsh --profile mas "/agent-teams <цель>"` в foreground (или спавнит `--profile mas-sdk` и говорит по JSON-RPC); (4) по завершении читает `.agent-teams/<teamId>/team.json` + `inbox/*.jsonl` **напрямую с диска** (H3 read-канал, по конвенции `archive-team.mjs`), собирает структурированный отчёт и пишет запись в `mas-runs.json`.

**План B (если LLM-путь отвергнут).** Разделить `run-spec.mjs` на две половины:
- детерминированная подготовка: спека → staging (`TASK.md`/`SESSION.md`, `plan`-payload) в `.agent-teams/<teamId>/`, печать готовой команды запуска;
- детерминированный сбор: чтение `team.json`/`inbox` с диска и формирование отчёта.
Создание и ведение команды остаётся за живой сессией DSH (человек/капитан нажимает запуск) — автономность неполная, но всё остальное автоматизировано и не зависит от LLM-вызова внутри скрипта.

**План C (STOP).** Если капитан решит, что недетерминированный LLM-контур недопустим для `spec:run`, ни один из H1–H4 не даёт программируемого создания команды → `t1/t2` по спеке не выполняются, reviewer оценивает только этот отчёт, а 033b проектируется как «spec → staging + отчёт» без автоматического создания команды.

---

## 8. Что осталось непроверенным (для t1 и независимого ревью)

1. **End-to-end LLM-прогон** `dsh --profile mas "/agent-teams …"` (в спайке не запускался: реальный расход LLM-токенов и создание настоящей команды в workspace). Это дешёвый смоук для t1: цель «создай команду из одного члена и одной задачи», ожидаемый артефакт — новый `.agent-teams/<sanitized-team-name>/team.json`.
2. **`dsh plugin --profile mas add @nanmicoder/dsh-agent-teams`** — сама установка (pnpm/сеть) не выполнялась; проверен только резолв плагина из профиля, где он уже стоит (web).
3. **Совместимость плагина с headless-набором** проверена по композиции (`--dump-config`) и по списку inject-сервисов в base, но не по фактическому boot'у.
4. **JSON-RPC-хендшейк** `dsh --profile sdk` + плагин: протокол и его ограничения описаны в README, но ни один фрейм в спайке не отправлялся.
