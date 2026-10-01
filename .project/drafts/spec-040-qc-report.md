# spec 040 / t6 — отчёт qc (ratification by re-execution)

**Задача:** t6 — qc: независимая перепроверка компонентов A/B/C spec 040
**Режим:** ratification by re-execution — все компоненты перезапущены qc-агентом
собственными инструментами; evidence исполнителей t1–t5 не переиспользовался
**Дата:** 2026-10-01
**Вердикт задания:** `fail` — см. находку **F1 (hard-fail)**

Один блокер: гейт `npm run sync:check` красный, причём **и на чистом клоне HEAD**
(то есть не из-за правок spec 040), а критерий приёмки 12 spec 040 требует
`exit 0`. Пока гейт красный, Шаг 5 цепочки (`spec:close`) обязан встать в STOP,
а приёмка спеки не может быть закрыта. Остальные проверки пройдены.

---

## 1. Что именно перепроверялось и чем

| Компонент | Артефакт | Как проверял qc |
|---|---|---|
| A (ядро) | `.project/scripts/validate-spec.mjs` | 3 собственных фикстура с известными дефектами + spec 040 |
| A (CLI 11 фаз) | `.project/scripts/enrich-spec.mjs` + `npm run spec:enrich` | `--dry-run`, полный apply-прогон со **своим** стенд-ин раннером, прогон без раннера |
| A (skill) | `docs/spec-chain/skills/spec-enrich/SKILL.md` | подсчёт `^### Фаза ` = 11 |
| B (skill) | `docs/spec-chain/skills/run-spec-chain/SKILL.md` | подсчёт `^### Шаг ` = 5, три STOP-точки, dry-run-проход по всем 5 шагам |
| C (документация) | `docs/spec-chain/README.md`, `agent.cordis.yml` | наличие, 11 шагов установки, полнота ссылок |
| Гейты | `npm run test:run`, `npm run sync:check` | личный прогон qc |

Все свои артефакты qc создал сам в `drafts/_mas-results/spec-040/t6/`:
стенд-ин раннер, три фикстура, JSON до/после, лог прогона, копии входов.
Артефакты `t4-cli` (`drafts/_mas-results/spec-040/t4-cli/**`) не читались и
не использовались; фикстуры t4 (`996`–`999`) не переиспользованы.

---

## 2. Результаты по критериям приёмки задания

| # | Критерий | Статус | Доказательство |
|---|---|---|---|
| 1 | Свой прогон фаз 0/1/4 на своей ad-hoc спеке с 3 дефектами; все 3 найдены с id/строкой | **PASS** | фикстур `900-qc-adhoc.md`: m07 @17, m06 @35, m04 @43 — все три с id и строкой |
| 2 | Ad-hoc спека создана самим qc в `drafts/_mas-results/spec-040/t6/` | **PASS** | файлы `900-qc-adhoc.md`, `901-qc-clean.md`, `902-qc-delta.md` + `.original.md` |
| 3 | `npm run spec:enrich` — score до/после, delta > 0, intent сохранён | **PASS** | фикстур `902`: 83 → 89 (delta **+6**); секции Цель/Критерии/Декомпозиция/«Что НЕ трогать» побайтово идентичны; изменены ровно 2 строки |
| 4 | 11 фаз, у Фазы 10 отдельная запись LLM-вызова, отличная от Фазы 6 | **PASS** | `run-log-902.jsonl`: 8 записей (2,3,5,6,7,8,9,10); `prompt_hash` Фазы 10 ≠ Фазы 6 |
| 5 | SKILL.md: 11 «### Фаза » и 5 «### Шаг » + три STOP-точки | **PASS** | 11 и 5; STOP A/B/C в шагах 2/3/5 и в сводной таблице |
| 6 | Dry-run run-spec-chain по SKILL.md без изменений репозитория | **PASS** | пройдены все 5 шагов read-only; `git status` до/после идентичен; SHA256 десяти ключевых файлов неизменны |
| 7 | `test:run` 28 файлов / 198 тестов exit 0; `sync:check` exit 0 | **FAIL** | `test:run`: 28/198, exit 0 ✅; `sync:check`: **exit 2 (SYNC DRIFT)** ❌ — находка **F1** |
| 8 | Нет правок вне inScope | **PASS** | `git status --porcelain` не содержит изменений в `src/**`, `tools/**`, `.project/specs/**`, `.project/sync.mjs`, `close-spec.mjs`, `run-spec.mjs`, `check-consistency.mjs` |
| 9 | Отчёт с severity/путём/requiredFix и итоговым verdict | **PASS** | этот файл, раздел 5 |

---

## 3. Полные прогоны (сырой вывод)

### 3.1. Фикстур 900 — независимый прогон ядра, 3 дефекта

```
$ node .project/scripts/validate-spec.mjs drafts/_mas-results/spec-040/t6/900-qc-adhoc.md
exit=1            (hard-fail: DAG-проверка m04)
BASELINE SCORE: 87/100
[FAIL] m04 .../900-qc-adhoc.md:43 - задача t3: неизвестная зависимость `t8`
[FAIL] m06 .../900-qc-adhoc.md:35 - упомянутый путь не существует: `.project/scripts/no-such-qc-script.mjs`
[WARN] m07 .../900-qc-adhoc.md:17 - placeholder-маркер: \bTODO\b
[WARN] m07 .../900-qc-adhoc.md:29 - placeholder-маркер: \bTODO\b   (тот же дефект в «Цели»)
[WARN] m07 .../900-qc-adhoc.md:60 - placeholder-маркер: \bTODO\b   (упоминание дефекта в критерии)
```

Все три внесённых дефекта найдены своими id и номерами строк (m04 @43,
m06 @35, m07 @17). Дополнительно наблюдается связный эффект: заглушка TODO,
описанная в «Цели» (стр. 29) и в критерии приёмки (стр. 60), даёт ещё два
WARN m07 — это ожидаемое поведение (правило читает текст, а не намерение),
не постороннее срабатывание.

### 3.2. Фикстур 901 — hard-fail останавливает цепочку (Шаг 1, режим отказа)

```
$ npm run spec:enrich -- drafts/.../901-qc-clean.md --llm-cmd "node .../stub-runner-t6.mjs"
Фаза 0 — Baseline score: 89/100 (порог 70)
Фаза 4 — Traceability: сироты 0; hard-fail false
STOP: hard-fail детерминированных фаз (Фаза 4 / frontmatter). Правки не применяются.
$ echo $?  → 1
```

Правки не применены, LLM-фазы не запускались — режим отказа SKILL.md
соблюдён.

### 3.3. Фикстур 902 — apply-прогон, score delta и сохранение intent

```
$ npm run spec:enrich -- drafts/.../902-qc-delta.md --llm-cmd "node .../stub-runner-t6.mjs"
Фаза 0 — Baseline score: 83/100 (порог 70)
Фаза 1 — 15 механических проверок: 13 PASS / 1 FAIL / 1 WARN
Фаза 4 — Traceability: сироты 0; hard-fail false
  Фаза 2 — Research + enrichment: ok (model: stub-t6/deterministic)
  Фаза 3 — Fact-check против репозитория: ok (model: stub-t6/deterministic)
  Фаза 5 — Семантика: ok (model: stub-t6/deterministic)
  Фаза 6 — Adversarial: ok (model: stub-t6/deterministic)
  Фаза 7 — Simulation: ok (model: stub-t6/deterministic)
  Фаза 8 — Regeneration test: ok (model: stub-t6/deterministic)
  Фаза 9 — Repair loop: ok (model: stub-t6/deterministic)
  Фаза 10 — External audit: ok (model: stub-t6/deterministic)
Score: 83 → 89 (delta +6)
LLM-вызовов в логе: 8
Правок применено: 2
Итог: прогон завершён
```

Независимая сверка intent (qc, не из отчёта CLI) по `.original.md` vs `.enriched.md`:

```
intent section "Цель"            identical = true
intent section "Критерии приёмки" identical = true
intent section "Декомпозиция"    identical = true
intent section "Что НЕ трогать"  identical = true
изменённых строк всего: 2
  - Прогнать конвейер обогащения на фикстуре, если по возможности.
  + Прогнать конвейер обогащения на фикстуре, .
  - Сверить результат с логом `.project/scripts/no-such-qc-script.mjs`.
  + Сверить результат с логом `.project/SPEC.md`.
```

Дефекты устранены (vague term → Clarity, placeholder → m07, битый путь → m06),
intent не затронут, delta > 0.

### 3.4. Прогон без LLM-раннера — деградация вместо падения

```
$ npm run spec:enrich -- <фикстур> --llm-cmd "node -e process.exit(1)"
  Фаза 2 … Фаза 10: WARN [llm: unavailable — раннер завершился с кодом 1: без сообщения]
Score: 83 → 83 (delta +0)
Итог: прогон завершён с WARN: LLM-раннер недоступен, LLM-фазы пропущены
exit=0
```

### 3.5. Покрытие SKILL.md и dry-run Оркестратора

```
spec-enrich  ^### Фаза  : 11   (120,135,152,192,235,251,283,324,357,392,434)
run-spec-chain ^### Шаг : 5    (89,120,150,187,220)
STOP-точки: A (Шаг 2) / B (Шаг 3, до agent_teams_create) / C (Шаг 5); таймаут 30 мин
```

Dry-run-проход qc по всем 5 шагам (read-only):

| Шаг | Что проверено | Результат |
|---|---|---|
| Предусловия | `Test-Path .project/specs/040-spec-chain.md` = True; `status: approved` | ✅ |
| 1 (enrich) | CLI `spec:enrich` доступен; на фикстуре прогнан apply → 11 фаз, delta +6 | ✅ |
| 2 (STOP A) | шаблон сводки и условие продолжения описаны | ✅ (ожидание «ок» — вне теста) |
| 3 (план MAS) | 7 задач, зависимости t4←[t1,t2], t6←[t1..t5], t7←[t6]; роли builder×5/qc/reviewer; write-скоупы не пересекаются | ⚠ `roster.yaml` отсутствует — F4 |
| 4 (MAS) | наблюдаем фактическое состояние: t1–t5 completed, t6 in_progress, t7 pending | ✅ |
| 5 (close + STOP C) | `npm run spec:close -- 040 --dry-run` | ⚠ STOP: reviewer-задача не найдена — F5 |

`git status --porcelain` до и после всего dry-run-прохода идентичен; SHA256
`.project/specs/040-spec-chain.md`, `.project/state.json`, `docs/index.html`,
`.project/scripts/*.mjs`, `package.json`, `docs/spec-chain/**` не изменились.

### 3.6. Гейты (личный прогон qc)

```
$ npm run test:run
 Test Files  28 passed (28)
      Tests  198 passed (198)
 exit=0

$ npm run sync:check
SYNC DRIFT: state.json и производные разошлись
  - docs\index.html отстал от state.json — нужен npm run sync
  - state.json/производные изменены и не закоммичены — sync → git add → commit
 sync exit=2
```

Контрмеры для F1, выполненные qc:

```
# 1) на чистом клоне HEAD (без правок spec 040)
$ git clone --quiet --no-hardlinks . $TEMP/t6-head-clone && cd $TEMP/t6-head-clone
$ node .project/sync.mjs --check
SYNC DRIFT: state.json и производные разошлись
  - docs\index.html отстал от state.json — нужен npm run sync
  - state.json/производные изменены и не закоммичены
exit=2                      # ← дрейф существует в самом HEAD

# 2) помогает ли npm run sync
$ node .project/sync.mjs
state.json: обновлён; sha256 docs/index.html: 46de17e0cccbad84
$ git status --porcelain
 M .project/state.json
 M docs/index.html          # ← синк меняет уже закоммиченные файлы
$ node .project/sync.mjs --check
SYNC DRIFT: state.json/производные изменены и не закоммичены
exit=2                      # ← проверка остаётся красной и после синка
```

Причина видна в диффе: `.project/state.json` хранит `mtime` файлов спек
(каждый из 14 топиков — своя запись); при checkout клона mtime меняются
(1790574… → 1790820…), `docs/index.html` пересобирается с другими числами, и
принятие решения «изменено» в `--check` опирается на проекцию, которая эти
mtime не вырезает (`VOLATILE` покрывает самоссылочные участки, но не mtime).

---

## 4. Что подтверждено положительно (не только дефекты)

- Фазы 0/1/4 ядра находят все внесённые дефекты с корректными id и строками.
- Hard-fail действительно останавливает конвейер до LLM-фаз (dry-run и apply).
- 11 фаз прогоняются все; лог содержит отдельные записи на каждый LLM-вызов.
- `exit 0` + WARN при недоступном раннере — заявленная деградация, не падение.
- Intent-guard Фазы 10 работает: правка секции «Критерии приёмки» была
  обнаружена и откатана с `hard-fail` (наблюдалось на промежуточной итерации).
- Reference-скиллы покрыты: 11 фаз, 5 шагов, три STOP-точки, маппинг 8 пунктов
  Компонента B → 5 шагов (8/8), push закреплён за капитаном.
- Гейт `test:run` зелёный: 28 файлов / 198 тестов.

---

## 5. Находки

### F1 — `sync:check` красный на чистом HEAD (severity: **hard-fail**)

- **Файл:** `.project/sync.mjs` (`--check`, бл. 2285–2325), `.project/state.json`,
  `docs/index.html`
- **Проблема:** `npm run sync:check` → `exit 2` «SYNC DRIFT» и в рабочем дереве,
  и на свежем клоне HEAD. `npm run sync` меняет уже закоммиченные
  `state.json`/`docs/index.html` (mtime-поля), после чего проверка всё равно
  красная («не закоммичены»). Проверка не стабильна между окружениями: свежий
  checkout даёт другие mtime → другой `state.json` → другой `index.html`.
- **Влияние:** критерий приёмки 12 spec 040 (`npm run sync:check` exit 0) не
  выполняется; Шаг 5 `run-spec-chain` обязан встать в STOP; закрытие спеки
  невозможно. Приёмка spec 040 блокируется независимо от качества t1–t5.
- **Не регрессия t1–t5:** воспроизводится на чистом клоне коммита `09448a5`.
- **requiredFix:** решить, что является источником истины для решения
  «изменено»: исключить `mtime`-проекцию из сравнения с HEAD (и из данных,
  попадающих в `docs/index.html`), либо перевести `mtime` в необязательные
  метаданные, не влияющие на гейт. После фикса — `npm run sync` + коммит
  `state.json`/`docs/index.html` (операция капитана/оркестратора, вне inScope t6).

### F2 — правки критериев приёмки применены, но откатываются Фазой 10 (severity: **high**)

- **Файл:** `.project/scripts/enrich-spec.mjs` (б. 785 — правило в промпте
  Фазы 9; б. 851–878 — Фаза 10), `docs/spec-chain/skills/spec-enrich/SKILL.md`
- **Проблема:** в промежуточном прогоне стенд-ин выдал правку критерия
  приёмки (устранение m11 — «критерий без verify-команды»). CLI применил её,
  score вырос, затем Фаза 10 вернула `INTENT-CHANGED`, правки откатились и
  прогон завершился `hard-fail`/`exit 1`. Правило «правки Цели и Критериев
  приёмки запрещены» существует **только текстом в промпте** Фазы 9 (б. 785);
  в коде нет ни валидации правок перед применением, ни allowlist секций.
- **Влияние:** дефекты класса «критерий приёмки без verify-команды» (m11/m13) и
  правки секции «Критерии приёмки» в принципе не исправимы этим конвейером:
  Фаза 9 их либо не делает, либо получает откат и hard-fail. Это ровно тот
  сценарий, который spec 040 называет целевым («3 дефекта найдены и
  исправлены»), а DECISIONS ждёт `score delta > 0`.
- **requiredFix:** либо явно вывести критерии приёмки из области repair loop
  (тогда дефекты m11/m13 чинятся отдельной задачей/ручным шагом и это
  зафиксировано в SKILL.md), либо добавить в CLI структурную защиту intent
  (запрет `find` внутри секций «Цель»/«Критерии приёмки» до применения правки)
  и трактовать такие правки как `skipped`, без hard-fail всего прогона.

### F3 — CLI не проставляет маркер `[enriched: URL|tier|дата]` (severity: **medium**)

- **Файл:** `.project/scripts/enrich-spec.mjs`,
  `docs/spec-chain/skills/run-spec-chain/SKILL.md` (Шаг 1, «Ожидаемый результат»)
- **Проблема:** SKILL.md требует, чтобы изменённая спека содержала «хотя бы один
  маркер `[enriched: URL|tier|дата]`». CLI собирает tiered sources в артефакт
  `phase-2-sources.md` (таблица URL/Tier/Дата — есть, Tier 1 ×2), но в саму
  спеку маркер не вставляет; в enriched-фикстуре `grep '\[enriched'` пусто.
- **Влияние:** критерий приёмки 10 spec 040 достигается только «дисциплиной»
  LLM-раннера (Phase 2 должна сама положить маркер в `edits`), то есть не
  гарантирован конвейером. На моём прогоне — не выполнен.
- **Оговорка:** стенд-ин раннер не является реальной LLM; проверяется именно
  отсутствие гарантии на стороне CLI, а не поведение конкретной модели.
- **requiredFix:** добавить в Фазу 2 контрактную проверку: если в ответе
  раннера есть `sources`, но ни один edit не вставляет `[enriched:`, то CLI
  сам формирует такую пометку (или помечает прогон WARN).

### F4 — `roster.yaml` для `spec-to-team` отсутствует в репозитории (severity: **medium**)

- **Файл:** `docs/spec-chain/skills/run-spec-chain/SKILL.md` (Шаг 3: «`roster.yaml`
  рядом со скиллом `spec-to-team`»), `docs/spec-chain/README.md`
- **Проблема:** `Get-ChildItem -Recurse -Filter roster*.yml` по репозиторию —
  пусто; `spec-to-team/SKILL.md` в `docs/spec-chain/skills/` тоже нет (README
  говорит, что скилл «уже установлен в linuxexam-orchestrator»). Вход Шага 3
  не существует в том месте, на которое указывает скилл.
- **Влияние:** Шаг 3 нельзя выполнить строго по скиллу; выбор ролей/моделей
  останется на импровизации, что расходится с текстом reference-скилла.
- **requiredFix:** либо указать в SKILL.md фактический путь к `roster.yaml`
  (пресет `linuxexam-orchestrator`, вне репо), либо оговорить fallback-дефолт
  ролей для случая, когда `roster.yaml` недоступен.

### F5 — `spec:close` не находит reviewer-задачу в команде spec 040 (severity: **medium**)

- **Файл:** `.agent-teams/spec-040-spec-chain/team.json`, Шаг 5 SKILL.md
- **Проблема:** `npm run spec:close -- 040 --dry-run` → `exit 2`:
  `STOP: reviewer-задача не найдена (нет задачи с assignee роли reviewer/qc)`.
  В `team.json` задача `t7` (kind: `review`) имеет `status: pending` и
  **не назначенный assignee** (в отличие от t1–t6), поэтому маппинг
  `assignee → роль` её не находит.
- **Влияние:** авто-закрытие через `spec:close` невозможно даже после
  `verdict=pass`; шаг 5 цепочки встанет в STOP. Правка — за капитаном
  (`reassign_task` t7 на участника с ролью reviewer).
- **requiredFix:** назначить t7 исполнителю роли reviewer (и включить
  диагностику CLI: «задача есть, но assignee не назначен» вместо «нет задачи»).

### F6 — Фаза 0 не измеряет дефекты, которые правят Фазы 2/3 (severity: **medium**)

- **Файл:** `.project/scripts/validate-spec.mjs` (рубрика Фазы 0), DECISIONS
  (метрика «score delta ≥ +20»)
- **Проблема:** устранение `m04` (DAG), `m06` (битые пути) и `m07`
  (placeholders) **не меняет baseline score**: эти проверки не входят в
  начисление измерений. Фикстур 902 с тремя такими дефектами дал `delta +0`
  (84 → 84 при применённых правках). Delta появляется только когда правится
  текст, влияющий на Clarity/Testability (в 902 — vague term; delta +6).
- **Влияние:** целевые сценарии t4/t6 («3 дефекта найдены и исправлены, delta
  > 0») на дефектах-файлах/путях дают нулевую дельту; метрика DECISIONS
  «≥ +20» этим путём недостижима. Также в spec 040 «Критерии приёмки» п.3
  обещает delta > 0 — на классе m04/m06/m07 это неверно.
- **requiredFix:** либо включить штраф за серьёзность mechanical FAIL
  (например, m04/m06/m07 с весом) в измерение, либо честно зафиксировать в
  SKILL.md/DECISIONS, какие классы дефектов не влияют на score, и мерить
  delta по измеримым измерениям.

### F7 — жёсткая привязка id/slug спеки к имени файла даёт hard-fail (severity: **low**)

- **Файл:** `.project/scripts/validate-spec.mjs` (m02 + `structuralFail`)
- **Проблема:** спека с `id: 900` в файле `900-qc-adhoc.md` при
  `slug: qc-adhoc-t6` получила FAIL m02 (slug ≠ имя файла) и **hard-fail**
  (`exit 1`) — то есть падение цепочки из-за имени файла, а не из-за
  содержания. qc был вынужден переименовать фикстур, чтобы прогнать apply-ветку.
- **Влияние:** любая спека, у которой frontmatter-`id`/`slug` разошлись с
  именем файла, блокирует конвейер жёстко, хотя это дефект оформления.
- **requiredFix:** развести уровни: расхождение id/slug — FAIL-диагностика
  (WARN/FAIL без влияния на exit), hard-fail оставить для нечитаемого
  frontmatter (нет блока `---`, нет `id`).

### F8 — неоднородная политика hard-fail между dry-run и apply (severity: **low**)

- **Файл:** `.project/scripts/enrich-spec.mjs` (`printDryRun` → `exit 1`;
  apply-ветка → `STOP`)
- **Проблема:** при hard-fail детерминированных фаз `--dry-run` возвращает
  `exit 1`, а apply-прогон печатает `STOP` и тоже `exit 1`. При этом
  «недоступен LLM» деградирует в WARN с `exit 0`. Границы классов отказов
  нигде не сведены в таблицу.
- **Влияние:** неоднозначность для автоматизации (равный код у «STOP до
  правок» и у «прогон завершён с hard-fail Фазы 10»).
- **requiredFix:** свести таблицу exit-кодов по классам (hard-fail фаз 0/1/4 =
  STOP, hard-fail Фазы 10 = rollback, недоступность LLM = WARN) в SKILL.md
  и в `--help` CLI.

---

## 6. Сводка severity

| id | severity | кратко | блокирует приёмку |
|---|---|---|---|
| F1 | hard-fail | `sync:check` красный на чистом HEAD (mtime-проекция) | да (критерий 12; Шаг 5 STOP) |
| F2 | high | правки критериев приёмки применяются и откатываются Фазой 10; m11 неисправим | не блокирует, но ломает целевой сценарий |
| F3 | medium | CLI не гарантирует `[enriched: URL\|tier\|дата]` в спеке | критерий приёмки 10 — только по счастливой случайности LLM |
| F4 | medium | `roster.yaml` отсутствует по пути из Шага 3 | не блокирует, вход шага недостижим |
| F5 | medium | `spec:close` не видит reviewer-задачу (у t7 нет assignee) | да для Шага 5 (операция капитана) |
| F6 | medium | score delta не реагирует на m04/m06/m07 | метрика DECISIONS недостижима |
| F7 | low | m02 даёт hard-fail за имя файла | обходится переименованием |
| F8 | low | неоднородная политика exit-кодов | нет |

С правками вне inScope t6: F1 и F5 — за капитаном/оркестратором
(`.project/sync.mjs` и назначение t7), F2/F3/F6/F7/F8 — в
`.project/scripts/enrich-spec.mjs` и `.project/scripts/validate-spec.mjs`
(вне inScope qc, отдельной задачей).

---

## 7. Границы проверки (что qc НЕ проверял)

- Реальную LLM: все LLM-фазы прогонялись **своим стенд-ин раннером**. Гарантии
  качества «живого» research/enrich/adversarial/simulation/regeneration/
  external audit не проверялись (нет сетевого раннера в сессии). Проверялась
  оркестрация фаз, контракт ответа, логирование, rollback и exit-коды.
- `npm run typecheck` — не запускал (вне inScope t6; изменение
  `src/**` в рамках spec 040 не заявлено).
- Установку пресета в `~/.dsh/.agent-presets/` — операция капитана, вне репо;
  проверено только наличие документации и reference-скиллов.
- Создание MAS-команды и push — не выполнялись (dry-run).

---

## 8. Артефакты qc (inScope)

Каталог `drafts/_mas-results/spec-040/t6/`:

| Файл | Что это |
|---|---|
| `900-qc-adhoc.md` (+ `.original.md`) | фикстур 1: 3 дефекта, hard-fail ветка; вывод ядра |
| `901-qc-clean.md` (+ `.original.md`) | фикстур 2: Фаза 4 чистая, проверка STOP Шага 1 |
| `902-qc-delta.md`, `.original.md`, `.enriched.md` | фикстур 3: apply-прогон, delta +6, проверка intent |
| `stub-runner-t6.mjs` | мой детерминированный стенд-ин LLM-раннер (10.5 КБ) |
| `validate-before-qc.json`, `validate-901-before.json`, `validate-902-before.json`, `validate-902-after.json` | JSON-отчёты ядра до/после |
| `run-log-902.jsonl` | лог 8 LLM-вызовов прогона 902 |
| `report-902.md` | отчёт CLI по прогону 902 |

Каталоги прогонов CLI (inScope): `.project/drafts/spec-040/t6-run`,
`.project/drafts/spec-040/t6-run-delta`, `.project/drafts/spec-040/t6-run-nollm`
(промпт-паки, артефакты фаз, score до/после, spec-original/spec-final, отчёты).

Временные стенды qc удалены/вне репозитория: `%TEMP%/t6-head-wt` (git worktree),
`%TEMP%/t6-head-clone` (клон HEAD) — использовались только для диагностики F1.
