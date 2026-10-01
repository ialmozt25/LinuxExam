# docs/spec-chain — пресет `linuxexam-spec-chain`

Документация Компонента C спеки 040 (`.project/specs/040-spec-chain.md`):
пресет DSH `linuxexam-spec-chain` — сессия-оркестратор, которая ведёт спеку
от черновика до закрытия цепочкой `/run-spec-chain <spec-id>` с STOP-точками
для approve капитана.

Решение зафиксировано в `.project/DECISIONS.md` (2026-10-01, «Фабрика
spec-chain — архитектура end-to-end»). Цель — 2 действия капитана на спеку
(approve enriched-спеки + финальный push) вместо 6–8 раундов промптов.

## Границы: кто что делает

| Артефакт | Кто делает | Где живёт |
|---|---|---|
| `docs/spec-chain/README.md` | агент (этот документ) | репозиторий |
| `docs/spec-chain/agent.cordis.yml` | агент (шаблон) | репозиторий |
| `docs/spec-chain/skills/<name>/SKILL.md` | агент (reference-копии) | репозиторий |
| `~/.dsh/.agent-presets/linuxexam-spec-chain/**` | **капитан, вручную** | вне репо |

**Установка пресета в `~/.dsh/.agent-presets/` — операция капитана, агент её
не выполняет.** Репозиторий хранит только документацию и reference-копии
скиллов; агент не пишет в `~/.dsh/.agent-presets/` и не редактирует
установленный пресет.

## Структура пресета

Пресет DSH = директория с тремя частями:

```
linuxexam-spec-chain/               # ~/.dsh/.agent-presets/linuxexam-spec-chain/
├── agent.cordis.yml                # composition агента: persona, tools, skills
├── preset.yml                      # name / description для селектора пресетов
└── skills/                         # customSkillDirs пресета
    ├── spec-enrich/SKILL.md        # Компонент A: 11 фаз проверки/обогащения
    ├── spec-to-team/SKILL.md       # MAS-команда из спеки (уже установлен в linuxexam-orchestrator)
    ├── close-spec/SKILL.md         # R5-trace, frontmatter, episodic, log, converge
    └── run-spec-chain/SKILL.md     # Компонент B: оркестратор, 5 шагов, STOP-точки A/B/C
```

В репозитории reference-копии лежат в `docs/spec-chain/skills/<name>/SKILL.md`
(сейчас: `spec-enrich`, `run-spec-chain` — предметные скиллы спеки 040).

`agent.cordis.yml` (шаблон — `docs/spec-chain/agent.cordis.yml`) собирается из
строк-плагинов:

- `persona` — префикс = системный промпт оркестратора, суффикс = `{{cwd}}`;
- `agent-instructions` — подхват `AGENTS.md` проекта;
- `tool-pwsh` / `tool-bash` — шелл (npm, git, node) по платформе;
- `tool-fs`, `tool-fs-search` — Read / Write / Edit / glob / grep;
- `tool-jobs`, `command-goal`, `tool-goal`, `planning`, `compaction`;
- `delegation` — `subagent` / `subagent_fork` (нужны на MAS-шаге);
- `tool-ask-user`, `tool-todo`, `tool-web`;
- `skill-filesystem` (с `customSkillDirs: skills/` от `baseUrl` пресета) +
  `tool-skill` — каталог и загрузчик скиллов;
- `present`.

Абсолютных путей и секретов в шаблоне нет: `skills/` вычисляется от `baseUrl`
пресета, поэтому шаблон переносится между машинами без правок.

## Инструменты

| Инструмент | Зачем в цепочке |
|---|---|
| `agent_teams_*` (`claim_task`, `update_task`, `send_message`, `status`) | MAS-шаг 4: команда builders × N + qc + reviewer, отчётность капитану |
| `npm` | `npm run spec:enrich <id>`, `npm run spec:close -- <id>`, гейты (`typecheck`, `test:run`, `sync:check`) |
| `git` | ветки, diff для STOP-точки A, `git log` для fact-check; `git push` — только капитан |
| `Read` | чтение спеки, скиллов, отчётов, кода для fact-check |
| `Write` | новые файлы: отчёты, тестовая спека, артефакты фаз |
| `Edit` | правки enriched-спеки внутри repair loop (Фаза 9) |

`agent_teams_*` приходят **не из пресета**: их регистрирует host-бандл
`@nanmicoder/dsh-agent-teams` в общем `tools` registry профиля (принцип «Host
vs preset»). Пресет со своей стороны даёт `npm`/`git` через шелл-инструменты,
файловые инструменты и каталог скиллов. Если `agent_teams_*` в сессии нет —
`run-spec-chain` останавливается (STOP с диагностикой), а не имитирует команду.

## Скиллы

| Скилл | Роль в цепочке |
|---|---|
| `spec-enrich` | Компонент A: Проверяльщик спек, 11 фаз (baseline score → 15 механических проверок → research+enrich → fact-check → traceability → семантика → adversarial → simulation → regeneration → repair loop → external audit). CLI-обёртка: `npm run spec:enrich <id>` |
| `spec-to-team` | Превращает спеку из `.project/specs/` в команду AgentTeams и ведёт её до приёмки (MAS-команда: builders × N + qc + reviewer) |
| `close-spec` | Закрытие спеки: R5-trace, frontmatter (`status: done`, commit), episodic-память, log, converge |
| `run-spec-chain` | Компонент B: оркестратор цепочки, 5 шагов с STOP-точками A (approve enriched-спеки), B (approve плана MAS-команды), C (отчёт + push-авторизация) |

Скиллы `spec-enrich` и `run-spec-chain` — reference-копии в
`docs/spec-chain/skills/`; `spec-to-team` и `close-spec` уже поставляются
пресетом `linuxexam-orchestrator` и могут быть переиспользованы копированием.

## Установка

Ручная установка пресета — **операция капитана** (агент в
`~/.dsh/.agent-presets/` не пишет). Шаги выполняются в PowerShell из корня
репозитория `LinuxExam`; `~` в pwsh раскрывается в домашний каталог
(`$env:USERPROFILE`).

1. Проверить предпосылки: `node --version`, `npm --version`, `git --version`;
   убедиться, что исходная спека на месте — `Test-Path .project/specs/040-spec-chain.md`.
2. Проверить, что профиль DSH содержит host-бандл AgentTeams (иначе
   инструментов `agent_teams_*` в сессии не будет):
   `Select-String -Path ~/.dsh/profiles/web/package.json -Pattern 'dsh-agent-teams'`.
   Если строки нет — `dsh plugin --profile web add @nanmicoder/dsh-agent-teams`
   и перезапуск хоста DSH.
3. Создать каталоги пресета и его скиллов:
   `New-Item -ItemType Directory -Force ~/.dsh/.agent-presets/linuxexam-spec-chain/skills | Out-Null`.
4. Скопировать шаблон композиции в пресет:
   `Copy-Item docs/spec-chain/agent.cordis.yml ~/.dsh/.agent-presets/linuxexam-spec-chain/agent.cordis.yml -Force`.
5. Создать `~/.dsh/.agent-presets/linuxexam-spec-chain/preset.yml` с полями
   `name: LinuxExam Spec Chain` и `description: Оркестратор цепочки spec-enrich → MAS → close с STOP-точками для approve капитана`.
6. Скопировать reference-скиллы из репозитория в пресет:
   `Copy-Item docs/spec-chain/skills/* ~/.dsh/.agent-presets/linuxexam-spec-chain/skills/ -Recurse -Force`
   — так `docs/spec-chain/skills/**` (как минимум `spec-enrich/SKILL.md` и
   `run-spec-chain/SKILL.md`) оказываются в
   `~/.dsh/.agent-presets/linuxexam-spec-chain/skills/`.
7. Добавить недостающие скиллы `spec-to-team` и `close-spec`
   (например, из уже установленного `linuxexam-orchestrator`):
   `Copy-Item ~/.dsh/.agent-presets/linuxexam-orchestrator/skills/spec-to-team ~/.dsh/.agent-presets/linuxexam-spec-chain/skills/ -Recurse -Force`;
   для `close-spec` — из его источника (проектный/пользовательский каталог скиллов).
8. Структурно провалидировать пресет (не полагаться на SHA256 — см.
   `docs/knowledge/dsh/preset-structural-validation.md`): `js-yaml` load с
   заменой `!!js` → `!!str` в памяти, затем сверить, что top-level строк ≥ 20,
   у `persona` ключи `prefix,suffix`, `suffix` содержит `{{cwd}}`, а
   `skill-filesystem` — `customSkillDirs`. Ожидаемый счётчик строк шаблона и
   вывод валидации зафиксированы в `.project/drafts/spec-040-t5-report.md`.
9. Проверить доступность CLI проверяльщика из пресета: `npm run spec:enrich 040 --dry-run`
   должен напечатать 11 фаз и baseline score, не правя спеку.
10. Перезапустить DSH (или дождаться `patchReload: live`) и выбрать в сессии
    пресет `LinuxExam Spec Chain`; проверить, что в каталоге скиллов видны
    `spec-enrich`, `spec-to-team`, `close-spec`, `run-spec-chain`.
11. Приёмочный прогон: `/run-spec-chain 040` — убедиться, что цепочка
    доходит до STOP-точки A и ждёт approve капитана (остановка в STOP-точке —
    ожидаемое поведение, а не сбой).

Обновление пресета после правок скиллов в репо — повтор шагов 4, 6 и 8
(шаблон и reference-копии в репо — источник истины).

## Системный промпт

Префикс `persona` в `agent.cordis.yml` (дословно):

```
Ты — оркестратор цепочки. Твоя задача — исполнять run-spec-chain с STOP-точками для approve капитана.
```

Остальной текст префикса (в шаблоне) лишь расшифровывает 5 шагов скилла и
границы: push делает капитан, пресет в `~/.dsh/.agent-presets/` агент не
правит, при отсутствии `agent_teams_*` — STOP с диагностикой, при отсутствии
ответа капитана на STOP-точке — таймаут 30 мин и отчёт без продолжения.

## Проверка после установки

```powershell
Test-Path docs/spec-chain/README.md                 # True
Test-Path docs/spec-chain/agent.cordis.yml          # True
Test-Path ~/.dsh/.agent-presets/linuxexam-spec-chain/skills/spec-enrich/SKILL.md    # True (после шага 6)
Test-Path ~/.dsh/.agent-presets/linuxexam-spec-chain/skills/run-spec-chain/SKILL.md # True (после шага 6)
npm run spec:enrich 040 --dry-run                   # 11 фаз, baseline score, без правок
```

## Связанное

- `.project/specs/040-spec-chain.md` — спека (Компоненты A, B, C).
- `docs/spec-chain/skills/spec-enrich/SKILL.md` — Проверяльщик спек, 11 фаз.
- `docs/spec-chain/skills/run-spec-chain/SKILL.md` — оркестратор цепочки, 5 шагов.
- `.project/DECISIONS.md` — 2026-10-01, «Фабрика spec-chain — архитектура end-to-end».
- `docs/knowledge/dsh/README.md` — принципы DSH (пресет, Host vs preset, shipped vs user).
- `docs/knowledge/dsh/preset-structural-validation.md` — чек-лист структурной валидации пресета.
- `docs/knowledge/dsh/preset-common-errors.md` — типичные ошибки при создании пресета.
