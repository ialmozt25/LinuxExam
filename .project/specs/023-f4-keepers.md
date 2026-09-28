---
id: 023
slug: f4-keepers
title: "F4 — Agents-keepers"
status: draft
type: infra
created: 2026-09-28
updated: 2026-09-28
commit: null
---

> **Спека фазы F4** («Агенты-хранители»), создана шагом **F4.1**. Опирается на
> recon **F4.0**: нативный `@deepseek-ai/dsh-schedule@0.1.5-rc.2` (только
> `after` / `at` / `every`, интервал ≥ 300 с), отсутствие внешнего драйвера
> (Task Scheduler отказан капитаном), событийный характер AgentTeams
> (`idle`-фронты и мутации графа), `dsh-taskwatch@1.0.2` как read-only монитор.
> Progress фазы считается **по хранителям** (4), а не по процессным шагам
> F4.0–F4.3: после F4.1 остаётся `0/4`, переход `4/4` — после F4.2.

## Цель

Четыре хранителя — **Сверщик, Летописец, Будильник, Чистильщик** — периодически
и по событиям следят за памятью и тревогами фабрики. Хранители **НЕ правят**
память и документы: они находят расхождения, просрочки и шум и **предлагают**
правку в `alerts.md`; решение и запись остаются за капитаном и оркестратором
(ЧАСТЬ 5А плана: владелец памяти — оркестратор).

## Состав

| роль | механизм | триггер | действие |
|---|---|---|---|
| Сверщик | headless + Task Scheduler (user-level) | 5 раз в день: 09:00, 12:00, 15:00, 18:00, 21:00 (skip без новых коммитов) | сверка → `alerts.md` `[f4-checker]` |
| Летописец | ручной вызов оркестратора | закрытие фазы | проверка записи в `episodic.md` (правило 12) |
| Будильник | ручной вызов оркестратора | старт сессии | сведение просрочек из `alerts.md` + `working.md` |
| Чистильщик | headless + Task Scheduler (user-level) | WED и SUN 09:00 | свёртка → `alerts.md` `[f4-cleaner]` |
| dsh-taskwatch | read-only, встроенный | постоянно | монитор сессий и фоновых задач (упоминание; интеграция — F4.2+) |
| Watchdog | Task Scheduler (user-level) | ежедневно 22:00 | проверка метки `[f4-checker]` в `alerts.md` |

**Механизм запуска.** Хранители — **headless-агенты** (`dsh --profile headless`):
одноразовый агент получает промпт, работает в репозитории и выходит; он
**не является членом команды AgentTeams** и не зависит от состояния основной
сессии DSH. Скрипты — `.project/scripts/keepers/{checker,cleaner,watchdog}.ps1`,
общий запуск — `run-headless.mjs`. Таймеры и события — **вне** DSH: триггер
даёт Windows Task Scheduler.

## Ограничения

- Хранители работают через `dsh --profile headless`, независимо от состояния
  основной сессии DSH. Task Scheduler — **user-level**: срабатывает только при
  активной пользовательской сессии, при разлогине прогон пропускается
  (`/ru SYSTEM` невозможен — нет админ-прав).
- API-ключ модели пробрасывается из **user-scope** окружения в дочерний
  процесс (`[Environment]::GetEnvironmentVariable('DEEPSEEK_API_KEY','User')`):
  дочерний процесс его не наследует.
- **Headless требует патча профиля**: `dsh-tier-router` добавлен в
  `dsh.profile.bundles` профиля `headless`, но пакет пришлось связать с
  профилем junction'ом (`headless/node_modules/dsh-tier-router → web/...`),
  иначе резолвер бандлов его не находит. Долг: закрепить через
  `dsh plugin --profile headless add dsh-tier-router`.
- **Вывод dsh нельзя собирать средствами PowerShell 5.1**: при
  `$ErrorActionPreference = "Stop"` нативный stderr завершает скрипт, а dsh
  пишет туда reasoning и вердикт `sync:check`. Поэтому вывод собирает `cmd`
  (`>> log 2>&1`), а промпт передаётся файлом без BOM.
- **Внутри headless-прогона sandbox блокирует `spawnSync` с piped stdio**
  (`sync:FAIL — spawnSync git EPERM`), поэтому `npm run sync:check` внутри
  headless-агента **не работает**. Гейт оставлен за оркестратором; Сверщик
  `sync:check` не вызывает.
- **`state.head` отстаёт от `git HEAD` на 1 коммит после amend** — это
  самоссылка из spec 009, не дефект. Сверщик проверяет только отставание
  **больше 1** коммита.
- **Task Scheduler — user-level**: срабатывает только при логине пользователя;
  при разлогине прогон пропускается (принятое ограничение).
- **API-ключ пробрасывается из user-scope** в дочерний процесс скриптом.
- **SHA-skip у Сверщика:** если `git HEAD` не менялся с прошлого удачного
  прогона (метка `.project/scripts/keepers/.last-checked`), headless **не
  вызывается** — только строка `No new commits since … — skip` в лог.
  Экономия: 5 попыток в день при неизменном HEAD = 4 из 5 прогонов бесплатны
  (замер F4.2a-iv: 56 с → 0.7 с).
- **Stop-On-Battery снят** для всех трёх задач (`DisallowStartIfOnBatteries =
  False`, `StopIfGoingOnBatteries = False`) — иначе на ноутбуке прогоны молча
  пропускаются.
- `dsh-cron` / `dsh-plugin-cron-scheduler` отклонены: требуют живого процесса
  DSH (`fire automatically while the process is up`). Кандидат на возврат,
  если DSH станет 24/7.
- `dsh-schedule` (нативный) — отклонён как основной механизм: session-local,
  доставка требует живой root-сессии, calendar-выражений нет.

## Что НЕ трогать

- `sync.mjs` — блок 6 и прочие секции (F3 закрыта).
- `.agent-teams/**` — состояние команд только читается.
- `docs/FACTORY-PLAN.md` — кроме ЧАСТИ 4 (блок F4) и YAML-шапки/паспорта, изменённых в F4.1.
- `docs/memory/*.md` — кроме `alerts.md`, который хранители наполняют предложениями (правила хранителей).

## Превью

Первый ручной прогон `checker.ps1` (F4.2a-ii, 2026-09-28): **exit 0**, 72.8 с, запись в `docs/memory/alerts.md`:

```markdown
## 2026-09-28 | [f4-checker] результат
Сверка 4 пунктов (задание F4-checker).
1. **Расхождение.** `state.head` = `e7c4026…`, HEAD `git log -1` = `7026310…` (SHA до amend — рабочий лист не тронут).
2. **OK.** Фазы `done` (F0–F3) имеют записи в `episodic.md`; F4 — pending, записи нет (ожидаемо).
3. **OK.** Файлы, упомянутые в ЧАСТИ 4 как созданные, на месте.
4. **НЕ ПРОВЕРЕНО.** `sync:check` → exit 1, `spawnSync git EPERM` (sandbox headless-профиля).
```

DAG-конфигурация Task Scheduler (F4.2a-iii): `DSH-Checker` (daily 09:00),
`DSH-Cleaner` (weekly SUN 09:00), `DSH-Watchdog` (daily 10:00) — все user-level,
`Run As User: Alexey Udotov`, `Logon Mode: Interactive only`, `Status: Ready`.

Прогон третьей задачи (`schtasks /run /tn "DSH-Checker"`, 2026-09-28 17:04:04):
**LastTaskResult = 0** через 71 с; лог — `.project/scripts/keepers/checker.log`,
новая запись в `alerts.md`:

```markdown
## 2026-09-28 | [f4-checker] результат
Сверка 4 пунктов. **все проверки OK.**
1. OK. state.head = 7026310…; git log -1 = 05895a9…. Отставание ровно 1 коммит — допустимо (spec 009, amend).
2. OK. Фазы done (F0–F3) имеют записи в episodic.md; check:episodic → OK F0/F1/F2/F3.
3. OK. Файлы ЧАСТИ 4 на месте (включая .project/scripts/keepers/*).
4. OK. Отставание state.head ровно 1 коммит — в допуске. sync:check не вызывался (sandbox).
```

## Зафиксированные решения

- **F4.2a-iv: расписание пересмотрено на умное (Вариант 2).** Сверщик —
  5 попыток в день (09:00 + повтор каждые 3 ч до 21:00) со SHA-skip;
  Чистильщик — 2×/нед (WED, SUN 09:00); Watchdog — ежедневно 22:00;
  Stop-On-Battery снят у всех трёх.
- **F4.2a-iii: три user-level задачи созданы** — `DSH-Checker` (daily 09:00),
  `DSH-Cleaner` (weekly SUN 09:00), `DSH-Watchdog` (daily 10:00); `Status: Ready`,
  `Logon Mode: Interactive only`, `Run As User: Alexey Udotov`. `/ru SYSTEM`
  невозможен — нет админ-прав; `/rp` требует ручного ввода пароля.
- **F4.2b: `dsh-cron` и `dsh-plugin-cron-scheduler` отклонены** — требуют живой
  процесс DSH; `dsh-cron` (squirrel20) при этом совместим с хостом 0.1.5-rc.2 и
  остаётся кандидатом, если DSH станет 24/7. Важно: одноимённый npm-пакет
  `dsh-cron` — чужой cron-парсер, плагин ставится только из release-тарбалла.
- **F4.2a-i: headless оживлён** через `dsh.profile.bundles` + junction
  `dsh-tier-router`; причина отказа была не в headless, а в глобальном
  `agent-default-model: tier-router` из `settings.yaml` при отсутствии плагина
  в композиции профиля.
- **F4.2a-ii: скрипты хранителей без Task Scheduler** — сначала ручной прогон;
  вывод собирает `cmd`, промпт передаётся файлом без BOM.
- **F4.2a-iii: user-level задачи** — `/ru SYSTEM` невозможен (нет админ-прав),
  пароль `/rp` не автоматизируется.
- **Calendar → interval.** Обоснование: `dsh-schedule` не поддерживает
  calendar-выражения, а внешний драйвер — over-engineering для одного продукта.
- **Будильник — событийный, не таймер.** При неработающем DSH таймер даёт
  ложное чувство контроля: напоминание не доставляется, а сведение просрочек
  нужно ровно в момент, когда работа возобновилась.
- **`dsh-taskwatch` — упоминание, интеграция в F4.2+.** Пакет установлен
  (`1.0.2`, read-only), но в состав четырёх хранителей не входит.
- **Progress F4 = хранители.** Процессные шаги F4.0–F4.3 в progress не считаются.
- **SOP-плагин отказан:** `dsh-sop-agent-teams@0.1.0` требует
  `@deepseek-ai/dsh-client-runtime`, которого в хосте rc.2 нет.
