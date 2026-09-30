# RUN-SPEC-LIVE — Step 0 (A) спеки 034: профиль `mas` + живой smoke `run-spec.mjs`

- Спека: `.project/specs/034-mas-autonomy-b.md` (approved), пункт «Что делаем 1» (Step 0 / A), критерий приёмки 1, Edge Case «Step 0 (A)».
- Задача: t5 (в терминах спеки — `t0`), assignee `builder-commit`; attempt 1 `cabfb6b4-42e6-4baa-8d99-b4a9d4315cdc`, attempt 2 `28b5901a-fdf9-4f56-9cfb-9506fb568035` (переоткрыта капитаном с авторизацией доустановки провайдера в профиль `mas`).
- Окружение: `node v24.13.0`, `pnpm 12.4.1`, `dsh 0.1.5-rc.2`, `DSH_HOME=C:\Users\Alexey Udotov\.dsh`, ОС Windows.
- **Итог: STOP** (санкционированный исход, критерий приёмки 1 спеки в части «живой прогон → exit 0» НЕ выполнен). Хронология: attempt 1 — `NO_ADAPTER: no adapter registered for provider "tier-router"`; после авторизованной установки `dsh-tier-router` адаптер появился, но следующий и единственный барьер — **отсутствующий API-ключ DeepSeek** (`ROUTE_FAILED ... llm-deepseek: no API key`). Установками это не лечится (см. §1.4–1.5, §5).

---

## 0. Краткий итог

| фаза | результат |
| --- | --- |
| RECON (settings / diff профилей / код run-spec / провайдеры / хранилище ключей) | выполнен, §1 |
| профиль `mas` + плагин agent-teams | создан/установлен, §2.1 |
| установка #1 `dsh-tier-router` (авторизована капитаном) | exit 0, монтирование подтверждено, §2.2–2.3 |
| preflight (dry-run) | все проверки ok, `precondition-missing` исчез, §3 |
| живой smoke attempt 1 | exit **1** (NO_ADAPTER), §4.1 |
| живой smoke attempt 2 (после установки) | exit **1** (ROUTE_FAILED / no API key), §4.2 |
| изоляция, EOL, гейты | соблюдены, §6–7 |

---

## 1. RECON (до установок)

### 1.1 `~/.dsh/settings.yaml` — дословные строки

```
  4: agent-default-model:
  5:   provider: tier-router
  6:   model: smart
  7:   reasoningEffort: high
...
 26: tier-router:
 27:   visionMode: replace
 28:   easyProvider: deepseek-official
 29:   easyModel: deepseek-v4-flash
 30:   normalProvider: deepseek-official
 31:   normalModel: deepseek-flash
 32:   hardProvider: deepseek-official
 33:   hardModel: deepseek-v4-pro
 34:   fallbackProvider: deepseek-official
 35:   fallbackModel: deepseek-v4-flash
```

Вывод RECON: модель агента по умолчанию идёт через провайдера `tier-router`, а сам `tier-router` маршрутизирует в `deepseek-official`. Значит профилю нужны (а) плагин `dsh-tier-router` и (б) рабочий доступ к `deepseek-official`.

### 1.2 Профили `headless` vs `mas` — diff (подтверждено своими глазами)

`~/.dsh/profiles/headless/package.json`:

```json
{ "name": "dsh-profile-headless", "private": true,
  "dependencies": { "dsh-tier-router": "^0.2.2" },
  "dsh": { "profile": { "bundles": ["@deepseek-ai/dsh-base", "@deepseek-ai/dsh-headless", "dsh-tier-router"], "patchReload": "startup" } } }
```

`~/.dsh/profiles/mas/package.json` (до установки #1):

```json
{ "name": "dsh-profile-mas", "private": true,
  "dependencies": { "@nanmicoder/dsh-agent-teams": "^0.1.21" },
  "dsh": { "profile": { "bundles": ["@deepseek-ai/dsh-base", "@deepseek-ai/dsh-headless", "@nanmicoder/dsh-agent-teams"], "patchReload": "startup" } } }
```

- `node_modules` headless: `dsh-tier-router` (версия `0.2.2`); у `mas` до установки: `.bin, .pnpm, @nanmicoder, .modules.yaml, .pnpm-workspace-state-v1.json` — `dsh-tier-router` отсутствовал.
- `dsh plugin --profile mas list` до установки: 1 пакет — `@nanmicoder/dsh-agent-teams@0.1.21`, exit 0.
- **Почему так** (подтверждено справкой самой CLI, `dsh --help`): `--from-default-profile <name>` — «initialize a new custom profile from a **shipped** profile template», то есть копируется встроенный шаблон профиля, а не рабочий каталог `~/.dsh/profiles/headless`. Поэтому добавленный пользователем `dsh-tier-router` в `mas` не попал.

### 1.3 `run-spec.mjs`: гейта по статусу спеки НЕТ (проверка кодом)

`grep 'approved|status|draft' .project/scripts/run-spec.mjs` — совпадений по `approved`/`draft` нет вообще; статус только читается и печатается:

- `.project/scripts/run-spec.mjs:285` — `status: fm['status'] ?? null` (парсер front-matter, без валидации);
- `.project/scripts/run-spec.mjs:698` — `detail: ... (${spec.bytes} Б, type=${spec.type ?? '—'}, status=${spec.status ?? '—'})` (только в отчёт).

Эмпирика сходится: спека `013` (`type=docs`, `status=done`) прошла `resolve-spec` → `preflight` → `plan` → `execute` в обоих attempt'ах. Использовать approved-спеки 034 (рекурсия) запрещено; `013` — безопасная fixture.

### 1.4 Откуда берутся провайдеры (без установок)

- `node .../dsh/lib/bin.js --profile mas --dump-config` **до** установки: секции `tier-router` нет; при этом уже смонтированы `- id: llm-deepseek name: '@deepseek-ai/dsh-llm-deepseek'`, `@deepseek-ai/dsh-llm`, `@deepseek-ai/dsh-llm-retry`, `@deepseek-ai/dsh-llm-pi-ai`, `- id: credentials name: '@deepseek-ai/dsh-credentials-local'`.
- Провайдер `deepseek-official` регистрируется пакетом `@deepseek-ai/dsh-llm-deepseek` (grep по установленному дистрибутиву: `dsh-llm-deepseek/lib/index.js`), который **уже** в базовых бандлах профиля `mas`. ⇒ **отдельный пакет для `deepseek-official` ставить не нужно** — как зависимости профиля его нет и в `headless`.

### 1.5 Хранилище ключей (значения секретов не читались и не печатались)

- `@deepseek-ai/dsh-credentials-local`: `const CREDENTIALS_FILENAME = ".credentials.yaml"`, путь — `<harness home>/.credentials.yaml`; плагин смонтирован во всех трёх профилях (`mas`, `web`, `headless`) как `- id: credentials`.
- `C:\Users\Alexey Udotov\.dsh\.credentials.yaml` (161 Б, 7 строк, единственный `.credentials*` вне `node_modules`): одна запись `client-connection/browser-session` (`kind: grant`). Совпадений по подстроке `deepseek` — **0**. То есть **API-ключ DeepSeek через сервис credentials НЕ сохранён**.
- Переменных окружения с ключом нет: из `*DEEPSEEK*|*DSH*` присутствуют только `DSH_HOME, DSH_SESSION_ID, DSH_SHELL, DSH_WEB_URL`; `$env:DEEPSEEK_API_KEY` — отсутствует.
- `@deepseek-ai/dsh-llm-deepseek/lib/index.js:1838` — единственное вхождение `DEEPSEEK_API_KEY` (env-фолбэк провайдера).

---

## 2. Профиль `mas` и установка провайдера

### 2.1 Базовые шаги (attempt 1, сохраняются)

```powershell
dsh --version                                     # 0.1.5-rc.2, exit 0
dsh --profile mas --from-default-profile headless # exit 1: "error: a task is required, for example: dsh --profile headless \"run the tests\""
dsh plugin --profile mas add @nanmicoder/dsh-agent-teams
```

- Каталог профиля (вне репозитория) создан несмотря на exit 1: `C:\Users\Alexey Udotov\.dsh\profiles\mas` (`cordis.yml` 223 Б, `cordis.patch.yml` 217 Б, `pnpm-workspace.yaml` 61 Б, `package.json`, `.dsh-module-fallback/`).
- Плагин agent-teams: exit **0**, `+ @nanmicoder/dsh-agent-teams ^0.1.21`, `Done in 5s using pnpm v12.4.1`; резолв — `...\profiles\mas\node_modules\@nanmicoder\dsh-agent-teams\lib\index.js` (28138 Б).

### 2.2 Установка #1 (авторизована капитаном): `dsh-tier-router`

```powershell
dsh plugin --profile mas add dsh-tier-router
```

Вывод (ключевое, дословно), **exit=0**:

```
✓ Lockfile passes supply-chain policies (verified 25m ago)
Progress: resolved 5, reused 2, downloaded 3, added 0
Packages: +5
Progress: resolved 5, reused 2, downloaded 3, added 5, done
[WARN] Issues with peer dependencies found. Run "pnpm peers check" to list them.

dependencies:
+ dsh-tier-router ^0.6.0

Done in 2.2s using pnpm v12.4.1
```

Честная оговорка: имя пакета взято из RECON (`dsh-tier-router` — так он назван в `headless/package.json`, в bundles и в секции `tier-router:` settings.yaml), а версия — **0.6.0** (последняя совместимая), тогда как в `headless` стоит `^0.2.2`. Команда выполнена дословно в формулировке капитана (без версии), поэтому в `mas` встала более новая версия; если понадобится паритет — `dsh plugin --profile mas add dsh-tier-router@0.2.2`.

### 2.3 Проверка монтирования после установки

- `~/.dsh/profiles/mas/package.json`: `dependencies = { "@nanmicoder/dsh-agent-teams": "^0.1.21", "dsh-tier-router": "^0.6.0" }`, `bundles = ["@deepseek-ai/dsh-base", "@deepseek-ai/dsh-headless", "@nanmicoder/dsh-agent-teams", "dsh-tier-router"]`.
- `mas/node_modules`: `.bin, .pnpm, @deepseek-ai, @nanmicoder, @standard-schema, dsh-tier-router, .modules.yaml, .pnpm-workspace-state-v1.json`; версия локального пакета — `0.6.0`.
- `dsh plugin --profile mas list` (exit 0): 2 packages — `@nanmicoder/dsh-agent-teams@0.1.21`, `dsh-tier-router@0.6.0`.
- `dsh --profile mas --dump-config` (exit 0) теперь содержит:

```
# == dsh-tier-router
- id: tier-router
name: dsh-tier-router
```

### 2.4 Бюджет установок

Использовано **1 из 3**. Вторая установка (`deepseek-official`) **не выполнялась и не нужна**: RECON (§1.4) доказал, что адаптер `deepseek-official` уже смонтирован через `@deepseek-ai/dsh-llm-deepseek` из базовых бандлов; имя пакета-провайдера как зависимости профиля не фигурирует, а придумывать имена запрещено. Следующий барьер — не пакет, а секрет (§4.2, §5), поэтому оставшиеся 2 установки проблему не решают.

---

## 3. Preflight (dry-run)

```powershell
node .project/scripts/run-spec.mjs 013 --workspace %TEMP%\mas-live-034\ws --dry-run --json
```

**exit=0**, `status=dry-run`, `teamIdHint=spec-013-local-aliases`; JSON сохранён в `%TEMP%\mas-live-034\dryrun.json`.

| проверка preflight | результат |
| --- | --- |
| `dsh CLI` | `[ok] node ...\dsh\lib\bin.js --version → 0.1.5-rc.2` |
| `профиль mas` | `[ok] C:\Users\Alexey Udotov\.dsh\profiles\mas` |
| `плагин @nanmicoder/dsh-agent-teams` | `[ok] ...\profiles\mas\node_modules\@nanmicoder\dsh-agent-teams\lib\index.js` |
| `workspace` | `[ok] %TEMP%\mas-live-034\ws` |
| `каталог состояния .agent-teams` | `[info]` (создаётся при прогоне) |
| `шаблоны templates/mas` | `[ok] templates/mas/TASK.md, SESSION.md` |

`precondition-missing` (exit 3 в 033a) **исчез**. История не писалась: записей до == после (4 == 4), `history` в отчёте отсутствует; шаблоны не копировались, команда не запускалась.

---

## 4. Живой smoke (без `--dry-run`)

Обе попытки — одна и та же команда, тот же workspace:

```powershell
node .project/scripts/run-spec.mjs 013 --workspace %TEMP%\mas-live-034\ws --timeout-ms 600000
```

Общие успешные стадии (одинаковы в обе попытки): `resolve-spec` ok (`.project/specs/013-local-aliases.md`, 8701 Б, type=docs, status=done) → `preflight` ok → `plan` ok (`--profile mas`, активация `/agent-teams ... spec-013-local-aliases`) → `stage-templates` ok (`TASK.md` 6842 Б sha256 `9e7da0767267e2ff`, `SESSION.md` 4993 Б sha256 `20507558fb5a5381`, оба байт-в-байт, финальный байт 10). Таймаут 600000 мс ни разу не достигнут.

### 4.1 attempt 1 (до установки #1) — адаптер отсутствует

- `execute` failed: `exit=1`, **4372 мс**; `collect` failed: `team.json` не найден.
- stderr вложенного `dsh` дословно:

```
dsh: NO_ADAPTER: no adapter registered for provider "tier-router"
```

- `history`: записей стало 5.

### 4.2 attempt 2 (после установки #1) — `NO_ADAPTER` устранён, но нет API-ключа

- Старт `2026-09-30T11:42:28`, `execute` failed: `exit=1`, **4054 мс**; `collect` failed: `team.json` не найден.
- stderr вложенного `dsh` дословно:

```
dsh: ROUTE_FAILED: tier-router: every route failed (deepseek-official/deepseek-flash, deepseek-official/deepseek-v4-pro, deepseek-official/deepseek-v4-flash): Error: route deepseek-official/deepseek-v4-flash failed before any output: llm-deepseek: no API key for provider route "deepseek-official"; store DEEPSEEK_API_KEY through the credentials service (the web Models page writes it), or export DEEPSEEK_API_KEY in the launching environment
```

- `history`: записей стало 6.
- Что это доказывает: установка #1 сработала (ошибка сместилась с «нет адаптера tier-router» на «нет ключа у deepseek-official»), а единственный оставшийся барьер — секрет.

### 4.3 Артефакты, teamId, отсутствие evidence `team.json`

- workspace: `C:\Users\ALEXEY~1\AppData\Local\Temp\mas-live-034\ws`;
- teamId (подсказка из `plan`): `spec-013-local-aliases`; ожидаемый каталог команды: `<ws>\.agent-teams\spec-013-local-aliases\`;
- там лежат только копии шаблонов: `TASK.md` (6842 Б), `SESSION.md` (4993 Б) — оставлены как evidence работы `stageTemplates`;
- **`team.json` отсутствует** (`exists=False` в обе попытки): вложенный `dsh` падает до `agent_teams_create`, поэтому ни пути, ни sha256 `<ws>/.agent-teams/<teamId>/team.json` для критерия приёмки не существует. Это объективная причина, а не пропуск проверки.

---

## 5. STOP: что нужно для разблокировки

**Блокер:** у профиля `mas` нет доступа к API-ключу DeepSeek. Проверено фактами: в окружении нет `DEEPSEEK_API_KEY` (есть только `DSH_*`), в сервисе credentials (`$DSH_HOME/.credentials.yaml`) лежит единственная запись `client-connection/browser-session`, упоминаний `deepseek` — 0. Адаптеры смонтированы (`dsh-tier-router` + `@deepseek-ai/dsh-llm-deepseek`), не хватает именно секрета, поэтому **установками не решается** (бюджет 1 из 3; остаток не тратился).

**Fix (нужен человек/лид — я не трогал значения секретов и не подставлял их в окружение, это вне выданной авторизации):**

```powershell
# вариант A (рекомендация самой dsh): ключ в окружении запуска
$env:DEEPSEEK_API_KEY = "<ваш ключ DeepSeek>"
node .project/scripts/run-spec.mjs 013 --workspace %TEMP%\mas-live-034\ws --timeout-ms 600000

# вариант B: сохранить ключ через сервис credentials (страница Models в web-UI DSH)
#   тогда запись попадёт в $DSH_HOME/.credentials.yaml и будет доступна любому профилю, включая mas
node .project/scripts/run-spec.mjs 013 --workspace %TEMP%\mas-live-034\ws --timeout-ms 600000
```

Не рекомендуется: прописывать ключ открытым текстом в `cordis.patch.yml`/`settings.yaml` профиля — секрет вне credential-сервиса.

Ожидаемый артефакт успеха: `<ws>\.agent-teams\spec-013-local-aliases\team.json`, `status=ok`, exit=0. Попытка `dsh` занимает ~4 с, проверка дешёвая (LLM-токены начнут расходоваться только после прохождения маршрута).

**Остаточный риск при разблокировке:** автоактивация капитана на headless-поверхности (gesture boundary, README плагина:122-125) живьём ещё не проверялась; если `dsh` завершится exit=0 без создания команды, `run-spec` вернёт «прогон завершился, но команда на диске не найдена» (exit=1) — это будет следующий шаг разбора (stdoutTail ответа `dsh`).

---

## 6. Изоляция, изменения, EOL и байт-чек

- Прогоны шли только в `%TEMP%\mas-live-034\ws`; следы — `<ws>\.agent-teams\spec-013-local-aliases\{TASK.md,SESSION.md}`; реальная вложенная команда не создавалась.
- `.agent-teams/` рабочего репозитория: набор имён **до == после** — `archive, linuxexam-f3-smoke, linuxexam-m6-phase4, spec-026-smoke, spec-027-memory-test, spec-028-hide-alerts, spec-030, spec-031-rhcsa-bank-fixes, spec-034-mas-autonomy-b, retired-members.json` (секция «Пульс агентов» новую живую команду не получила).
- От этой задачи в репозитории: `.project/scripts/RUN-SPEC-LIVE.md` (новый) и `.project/mas-runs.json` (дозаписи сделал сам `run-spec.mjs`; было 4 → стало 6, по одной на attempt).
- Целостность истории: копия до прогонов (t4) `%TEMP%\runslog-t4\c-dryrun.json` sha256 `0EFC8C9519905EADEDB04CADBDA39CBD3239F72DC794D1B92558A4D3DB45446A` (4 записи, 21869 Б); после attempt 1 — 5 записей, первые 4 deep-equal, первый различающийся байт `21862` (только разделитель массива), `version=1`.
- `git status --porcelain -- .project/scripts/run-spec.mjs` — пусто; флаг `--live` не добавлялся.
- EOL/байт-чек этого файла (rule 16, до коммита): байт `0x0D` (CR) — **0**, `0x0A` (LF) — 260, последний байт — **10 (LF)**; размер файла — по гейту выше (≥ 800 Б, фактически ~22.8 КБ). `git ls-files --eol` файл пока не видит (untracked) — трекнутую проверку `i/lf w/lf` сделает лид после коммита.
- `git status --short` на момент завершения задачи: от t5 — `M .project/mas-runs.json` и `?? .project/scripts/RUN-SPEC-LIVE.md`; остальные строки (`M .project/SPEC.md`, `M .project/STATE.md`, `M .project/state.json`, `M .project/scripts/check-consistency.mjs`, `M .project/sync.mjs`, `M docs/index.html`, `M package.json`, `?? .agent-teams/`, `?? .project/scripts/committer.mjs`, `?? .project/scripts/report-run.mjs`, `?? .project/scripts/runs-log.mjs`, `?? drafts/_mas-results/`) — правки соседей по их inScope.

## 7. Гейты после прогонов

| гейт | результат |
| --- | --- |
| контрактная проверка отчёта (`Test-Path` + размер ≥ 800 Б) | exit 0 |
| `npm run typecheck` | exit 0 |
| `npm run test:run` | exit 0 (28 файлов / 198 тестов) |

## 8. Честные оговорки

1. Живой прогон **не удался** ни в одной попытке: attempt 1 — `NO_ADAPTER` (нет пакета `dsh-tier-router`), attempt 2 — `ROUTE_FAILED` (нет API-ключа). Критерий приёмки 1 спеки 034 в части «живой прогон → exit 0» **не выполнен**; в `acceptanceResults` он помечен `failed`. STOP не маскируется под успех.
2. Причина установки #1 подтверждена дословно: `--from-default-profile <name>` берёт **встроенный шаблон** профиля, поэтому пользовательский `dsh-tier-router` из рабочего `headless` в `mas` не скопировался.
3. `dsh-tier-router` встал версией `0.6.0` (в `headless` — `^0.2.2`); команда выполнялась дословно без указания версии.
4. Значения секретов не читались, не печатались и не копировались; в отчёте и в `mas-runs.json` их нет. Одна из диагностических команд была отклонена встроенным guard'ом на secret-паттерны — после этого проверки велись только на уровне имён/номеров строк.
5. Профили `headless`/`web`, `settings.yaml` и глобальные настройки не изменялись; установки — только в профиль `mas` (вне репозитория).
6. Живые прогоны шли на спеке `013` (`done`); спека `034` в живом прогоне не использовалась (рекурсия).
