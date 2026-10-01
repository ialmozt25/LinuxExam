# run-spec-chain — оркестратор цепочки spec-фабрики

> Reference-скилл пресета `linuxexam-spec-chain` (spec 040, Компонент B).
> Активация: `/run-spec-chain <spec-id>`.
> Роль-исполнитель: капитан-оркестратор. Капитан участвует дважды: (1) approve
> обогащённой спеки; (2) финальный push. Остальное — автономно.
> Файл — reference в репо; рабочая копия появится в
> `~/.dsh/.agent-presets/linuxexam-spec-chain/skills/run-spec-chain/SKILL.md`
> после установки пресета капитаном (операция капитана, вне репо).

## Когда использовать

- Спека лежит в `.project/specs/<id>-<slug>.md` со `status: approved`
  (frontmatter), тип `infra` / `feature` / `content` / `docs`.
- Нужно довести её от черновика до закрытия **одной командой**, без 6–8 раундов
  обмена промптами (spec 040, «Контекст»).
- Прогон идёт в **отдельной сессии DSH**: харнесс не даёт вести две команды
  AgentTeams одновременно (spec 040, Edge Cases).

## Входы

| Вход | Источник |
|---|---|
| `<spec-id>` | аргумент команды, ровно 3 цифры (`040`) |
| спека | `.project/specs/<id>-*.md`, frontmatter `status: approved` |
| контекст фазы | `.project/state.json` → `plan.allPhases` |
| текущий SHA | `git log -1 --format=%H` |
| роли и модели | `~/.dsh/.agent-presets/linuxexam-orchestrator/skills/spec-to-team/roster.yaml` (вне репо); если недоступен — fallback-дефолт ростера из Шага 3 |
| инструменты | `agent_teams_*`, `npm`, `git`, Read / Write / Edit |
| скиллы | `spec-enrich`, `spec-to-team`, `run-spec-chain`; закрытие — CLI `npm run spec:close`, не скилл |

## Предусловия

1. `Test-Path .project/specs/<id>-*.md` → `True`; `status: approved`.
2. `git status` чистый, кроме известных untracked (`.agent-teams/**`).
3. Snapshot гейтов до старта: `npm run typecheck`, `npm run test:run`,
   `npm run sync:check` — записать exit-коды (это baseline, не гейт входа).
4. `agent_teams_status` — сессия не ведёт другую команду (иначе STOP,
   см. «Крайние случаи» → `TEAM-ALREADY-ACTIVE`).
5. Доступен CLI `npm run spec:enrich` (создаётся задачей t4 spec 040).

## Карта цепочки

```
enrich → STOP A (approve спеки) → /spec-to-team → STOP B (approve плана MAS)
       → исполнение MAS → spec:close → STOP C (отчёт + push-авторизация)
       → капитан: git push
```

## Маппинг: пункты Компонента B спеки (1–8) → шаги скилла (1–5)

Пункты из spec 040, Компонент B (дословно):

1. `npm run spec:enrich <id>` — 11 фаз.
2. STOP: показать diff и score delta капитану, ждать «ок».
3. `/spec-to-team <id>` — MAS-команда.
4. STOP: показать план MAS-команды капитану, ждать approve.
5. MAS исполняет (builders × N + qc + reviewer).
6. `npm run spec:close -- <id>` — закрытие.
7. STOP: отчёт + ожидание push-авторизации.
8. Капитан → git push.

| Пункт спеки | Содержание пункта | Шаг скилла |
|---|---|---|
| 1 | `npm run spec:enrich <id>` — 11 фаз | Шаг 1 |
| 2 | STOP: diff + score delta, ждать «ок» | Шаг 2 (STOP-точка A) |
| 3 | `/spec-to-team <id>` — MAS-команда | Шаг 3 |
| 4 | STOP: план MAS-команды, ждать approve | Шаг 3 (STOP-точка B) |
| 5 | MAS исполняет (builders × N + qc + reviewer) | Шаг 4 |
| 6 | `npm run spec:close -- <id>` — закрытие | Шаг 5 |
| 7 | STOP: отчёт + ожидание push-авторизации | Шаг 5 (STOP-точка C) |
| 8 | Капитан → git push | Шаг 5 — терминальная передача капитану, **агентом не исполняется** |

Покрытие: все 8 пунктов, у каждого ровно один шаг-владелец. Пять логических
шагов вмещают три STOP-точки (A, B, C) и терминальный пункт 8, закреплённый за
капитаном.

## Общие правила STOP-точек (A / B / C)

- **Таймаут ожидания — 30 мин** (spec 040, Edge Cases). Молчание капитана
  таймаутом **не** считается согласием: по истечении — отчёт и остановка без
  продолжения цепочки.
- Перед STOP печатается сводка (см. таблицу STOP-точек), после — ожидание
  явного ответа. Ответ «revision» / «нет» → правки и повторная STOP-точка,
  не переход дальше.
- Агент не аппрувит за капитана и никогда не выполняет `git push`
  (правила 10/11 — только per-command авторизация).

### Шаг 1 — Enrich спеки (11 фаз)

**Вход.** `<spec-id>`; спека `approved`; доступен `npm run spec:enrich`;
записан baseline-отчёт (Предусловия, п. 3).

**Команда / действие.** Скилл `spec-enrich`, Фазы 0–10:

```
npm run spec:enrich <id> --dry-run   # опционально: печать 11 фаз + baseline score, ноль правок
npm run spec:enrich <id>             # apply: правки спеки + отчёт (score до/после, diff, findings)
```

Правки Фазы 9 делаются только в файле спеки `.project/specs/<id>-*.md`; код,
тесты и `package.json` на этом шаге не трогаются.

**Ожидаемый результат.** Пройдены 11 фаз; собраны: score до/после, `diff`
правок спеки, findings со severity и confidence, tiered sources (Tier 1–2),
traceability Цель → Критерий → Задача. Изменённая спека содержит хотя бы один
маркер `[enriched: URL|tier|дата]`.

**Условие продолжения.** `spec:enrich` завершился с `exit 0`, и либо score
delta > 0, либо вердикт «clean» (0 hard-fail + 0 high-finding → правки не
требуются). Отчёт и diff сформированы для показа капитану на Шаге 2.

**Режим отказа (STOP).** Hard-fail (сироты traceability, spec gaming,
изменение intent) → STOP, rollback правок Фазы 9, отчёт капитану; Шаг 2 не
начинать. Repair loop не сошёлся за 3 итерации (score не растёт) → STOP без
продолжения. `exit != 0` либо CLI `spec:enrich` не найден (`npm` сообщает
missing script) → STOP с диагностикой; альтернативный путь — выполнить скилл
`spec-enrich` вручную, но без отчёта и score delta цепочка не продолжается.

### Шаг 2 — STOP-точка A: approve обогащённой спеки

**Вход.** Отчёт Шага 1: `diff` правок спеки, score до/после, findings,
tiered sources, список правок Фазы 9.

**Команда / действие.** Сводка капитану (без мутаций) и ожидание явного «ок».

Перед сводкой — уведомление о STOP-точке (fire-and-forget, сбой Telegram не
мешает цепочке):

```
npm run notify -- "⏳ Спека <id>: STOP A — обогащённая спека готова. Жду твоё решение." --event stop_point
```

Сводка:

```
## STOP A — обогащённая спека <id>
score: <до> → <после>  (delta <+N>)
findings: hard-fail <n> | high <n> | medium <n> | low <n>
правки Фазы 9: <n> (см. diff ниже)
tiered sources: Tier 1 <n>, Tier 2 <n>
открытые вопросы: <n>
ЖДУ: «ок» / «revision: <что поменять>»   (таймаут 30 мин)
```

**Ожидаемый результат.** Получен явный approve капитана («ок» / «approve»)
либо конкретный список правок. Спека с approve фиксируется как baseline
исполнения (сохранить SHA-подобный отпечаток: дату, score, число правок —
для отчёта Шага 5).

**Условие продолжения.** Только явное «ок» → Шаг 3. Ответ «revision» → правки
(Фаза 9), повторный показ diff и повторная STOP-точка A.

**Режим отказа (STOP).** Таймаут 30 мин без ответа → отчёт капитану и
остановка, Шаг 3 не начинать. Hard-fail, не снятый правками → STOP без
продолжения. Enrich не выполнен (нет отчёта/score) → STOP с сообщением
«enrich не выполнен». Агент не подменяет approve собственным решением.

### Шаг 3 — /spec-to-team: план MAS + STOP-точка B

**Вход.** Approve Шага 2; спека `approved`; ростер ролей и моделей (см. блок
ниже); snapshot гейтов.

**Источник ролей и моделей (устранение F4).** Ростер читается по фактическому
пути пресета-владельца скилла `spec-to-team` — он лежит **вне репозитория**:

```
Test-Path ~/.dsh/.agent-presets/linuxexam-orchestrator/skills/spec-to-team/roster.yaml
# → True: файл существует в этом окружении (35 строк, provider deepseek-official)
```

Если путь недоступен (пресет не установлен, другая машина), используется
самодостаточный **fallback-дефолт** ниже; импровизация в выборе моделей
запрещена — план на STOP-точке B обязан содержать роли и модели из одного из
двух источников:

| Роль | provider | model | reasoning_effort |
|---|---|---|---|
| architect | deepseek-official | deepseek-v4-pro | high |
| builder | deepseek-official | deepseek-v4-flash | high |
| tester | deepseek-official | deepseek-v4-flash | high |
| reviewer | deepseek-official | deepseek-v4-pro | high |
| writer (content) | deepseek-official | deepseek-v4-flash | high |
| qc (content) | deepseek-official | deepseek-v4-pro | high |

Допустимые уровни `reasoning_effort` — `off` / `low` / `high` / `max`
(`medium` для pro не поддерживается). Состав ролей по `type` спеки:
infra/feature → architect, builder, tester, reviewer; content → writer, qc;
docs → writer, reviewer; мелкая правка (1 файл) → builder + reviewer. Любая
иная комбинация ролей или моделей — только с approve капитана на STOP-точке B.

**Команда / действие.** Порядок разделён, чтобы STOP B стоял **до** старта
исполнения (пункт 3 спеки ≠ разрешение запускать без approve пункта 4):

1. Фазы 1–4 скилла `spec-to-team`: прочитать спеку (Цель, Что делаем,
   Критерии, Что НЕ трогать, type), выбрать роли по ростеру из блока выше
   (фактический путь пресета или fallback-дефолт; состав по типу:
   infra/feature → architect, builder, tester, reviewer; content → writer, qc;
   docs → writer, reviewer), разложить задачи (при наличии `## Декомпозиция` —
   по ней), провалидировать DAG: зависимости на существующие id, нет циклов,
   write-скоупы не пересекаются.
2. `agent_teams_status` — проверка, что сессия не ведёт другую команду.
3. **STOP B**: перед показом плана уведомить капитана —
   `npm run notify -- "⏳ Спека <id>: STOP B — план прогона готов. Жду твоё согласие." --event stop_point` —
   затем показать капитану план MAS — `team_id`-кандидат, роли/модели,
   список задач с assignee, dependencies, write-скоупами, kinds и evidence.
   Ждать явный approve.
4. После approve — `agent_teams_create` (фаза 5 скилла `spec-to-team`).

**Ожидаемый результат.** Явный approve плана; команда создана, получен
`team_id`, задачи выданы членам, зависимости разблокированы планировщиком.
Наружу отдан план из таблицы (роль → задача → зависимости → write-скоуп).

**Условие продолжения.** Approve плана получен, `agent_teams_create` вернул
успех, `agent_teams_status` показывает задачи в `dispatched`/`in_progress` →
Шаг 4.

**Режим отказа (STOP).** Нет approve или капитан меняет план → пересобрать
план и снова STOP B. `agent_teams_status` видит активную команду → STOP:
`TEAM-ALREADY-ACTIVE: сессия ведёт команду <id>. Требуется новая сессия DSH,
чтобы запустить новый spec-прогон. Харнесс не даёт вести две команды
одновременно.` Чужую команду не завершать (`agent_teams_delete` запрещён) и не
переиспользовать. Инструменты `agent_teams_*` недоступны в сессии → STOP с
диагностикой (имя инструмента, текст ошибки, что нужно: новая сессия DSH /
установленный пресет). `agent_teams_create` упал → одна повторная попытка,
затем STOP с диагностикой. Таймаут 30 мин на STOP B → отчёт и остановка.

### Шаг 4 — Исполнение MAS-команды

**Вход.** Созданная команда (`team_id`), approved план, задачи с зависимостями
и write-скоупами.

**Команда / действие.** Наблюдение и координация (работу делают члены команды,
не оркестратор):

```
agent_teams_status              # каждые 15 с, максимум 50 итераций за окно (12.5 мин)
agent_teams_send_message        # при простое/вопросе — адресно члену команды
```

`wait_agent` members AgentTeams не видит — использовать только
`agent_teams_status`. Разрешено: уточнять задачу члену, эскалировать
блокеры капитану. Запрещено: править файлы за членов команды, reassign,
claim чужих задач, создавать/удалять команду.

**Ожидаемый результат.** Все задачи в терминальном статусе; собраны
`tasks[].output`, `changedPaths`, `acceptanceResults`, `commandsRun`,
`verdict` ревьюера; гейты прогона (`typecheck`, `test:run`, `sync:check`)
и evidence по критериям приёмки спеки.

**Условие продолжения.** Все задачи `completed` (допускаются `cancelled` с
обоснованием) **и** reviewer `verdict=pass` → Шаг 5. Иначе Шаг 5 не начинать.

**Режим отказа (STOP).** Задача `failed` либо reviewer вернул
`needs_revision`/`reject` → STOP: отчёт капитану с findings, закрытие не
запускать (правки — новой задачей или новым прогоном). Инструменты
`agent_teams_*` недоступны → STOP с диагностикой. Два окна поллинга подряд без
изменений статуса → отчёт и STOP (чужую команду не завершать). Всегда
действует запрет push (правила 10/11).

### Шаг 5 — npm run spec:close + STOP-точка C: отчёт и push-авторизация

**Вход.** Прогон MAS завершён с reviewer `verdict=pass`; спека `approved`;
известны `team_id`, токены задач (id completed), файлы и гейты прогона.

**Команда / действие.**

```
npm run spec:close -- <id> --dry-run   # сначала dry-run: план шагов закрытия, ноль мутаций
npm run spec:close -- <id>             # apply: status done + R5-trace + память + commit-chain + sync:check
```

После apply — уведомить капитана о STOP-точке (fire-and-forget):

```
npm run notify -- "ℹ️ Спека <id>: STOP C — отчёт готов. Жду разрешение на публикацию." --event stop_point
```

Затем собрать отчёт и **STOP C**: показать капитану отчёт и список
коммитов, затем ждать push-авторизацию. Push выполняет **только капитан**
(правила 10/11); агент не пушит ни после approve, ни по таймауту.

**Ожидаемый результат.** `status: done` в frontmatter спеки, R5-trace,
запись в `docs/memory/episodic.md` (+ обновлённый `working.md`), commit-chain
(`docs(spec-<id>): done` → converge), `npm run sync:check` → `exit 0`.
Отчёт: `team_id`, задачи, verdict, `changedPaths`, гейты, score delta
Шага 1, список коммитов.

**Условие продолжения.** Отчёт показан капитану. Цепочка завершена после явной
**отдельной** push-авторизации капитана — она не входит в процесс агента и не
является частью этого скилла; терминальный пункт 8 спеки исполняет капитан.

**Режим отказа (STOP).** `spec:close` вернул `exit 2` (STOP скрипта: status не
`approved`, нет reviewer-`pass`, нет команды) или `exit 3`
(precondition-missing) → закрытие не применять, отчёт и STOP. `sync:check != 0`
после converge → STOP с выводом гейта (правило 9, без отката). Таймаут 30 мин
без ответа капитана → отчёт и остановка; push не выполняется. Маркер
`MEMORY-WRITE-FAILED` (запись в `episodic.md` не подтверждена
`git status --porcelain`) → отчёт и STOP.

## Сводная таблица STOP-точек

| Точка | Где | Что показываем капитану | Ждём | Таймаут | Нет ответа |
|---|---|---|---|---|---|
| A | после enrich, перед `/spec-to-team` (Шаг 2) | diff спеки, score до/после, findings, tiered sources, открытые вопросы | явное «ок» / «revision» | 30 мин | отчёт, остановка без продолжения |
| B | после валидации DAG, **перед** `agent_teams_create` (Шаг 3) | план MAS: роли, модели, задачи, зависимости, write-скоупы, kinds | явный approve | 30 мин | отчёт, остановка без продолжения |
| C | после `spec:close` apply (Шаг 5) | отчёт прогона + список коммитов | per-command push-авторизация | 30 мин | отчёт, остановка; push не выполняется |

## Крайние случаи

| Ситуация | Реакция оркестратора |
|---|---|
| enrich не выполнен (нет отчёта/score delta) | STOP с сообщением «enrich не выполнен»; Шаг 2 не начинать |
| активная MAS-команда в сессии | STOP: `TEAM-ALREADY-ACTIVE: ... требуется новая сессия DSH`; чужую команду не завершать и не переиспользовать |
| инструменты `agent_teams_*` недоступны | STOP с диагностикой: имя инструмента, текст ошибки, что нужно (новая сессия DSH / установленный пресет) |
| ростер недоступен по пути пресета (`Test-Path` → `False`) | не STOP: взять fallback-дефолт ростера из Шага 3 (роли + модели + reasoning_effort) и пометить это в плане на STOP-точке B |
| капитан не отвечает на STOP-точку | таймаут 30 мин → отчёт, остановка, не продолжать |
| research без сети (Фаза 2) | не блокер цепочки: Фаза 2 пропускается с WARN `[research: skipped — no network]`, score не уменьшается |
| спека уже идеальна (0 hard-fail + 0 high-finding) | STOP «clean» на Шаге 1: правки не нужны, решение о продолжении — за капитаном |
| источник противоречит спеке | не разрешать самому: вынести в «Открытые вопросы» и показать в STOP A |
| spec gaming (external audit) | hard-fail → rollback правок Фазы 9, отчёт и STOP |
| прогон MAS частично failed | STOP после Шага 4: отчёт с findings, закрытие не запускать |
| CLI `spec:enrich` отсутствует (npm missing script) | STOP с диагностикой; проверить, что t4 spec 040 применён |
| `spec:close` exit 2 / exit 3 | закрытие не применять, отчёт и STOP |

## Что не делать

- **Не пушить** (правила 10/11 — только per-command авторизация капитана).
- Не аппрувить за капитана: молчание STOP-точки не является согласием.
- Не завершать и не переиспользовать чужую MAS-команду (`agent_teams_delete`
  агенту запрещён); не переиспользовать evidence предыдущего прогона.
- Не править файлы вне `inScope` спеки и не выполнять работу членов команды
  вместо них.
- Не устанавливать пресет/плагины: `~/.dsh/.agent-presets/**` — операция
  капитана; агент создаёт только документацию и reference-копии скиллов в репо.
- Не запускать subagent'ов параллельно с командой AgentTeams.

## Критерий приёмки прогона

- infra / feature: все гейты зелёные + reviewer `verdict=pass` + approve
  капитана.
- content: QC `verdict=pass` + approve капитана.
- Запись в `docs/memory/episodic.md` есть (эвиденс: `git status --porcelain`
  показывает `M docs/memory/episodic.md`).
- Push — отдельная авторизация капитана (правила 10/11); без неё прогон
  считается завершённым на STOP-точке C.
