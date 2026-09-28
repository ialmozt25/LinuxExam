# CONTRACTS.md — формальные контракты между ролями

**M6.0 Phase 1 · дата: 2026-09-27 · автор: Orchestrator · статус: дизайн, НЕ внедрено**

Три контракта **существуют** в `.project/contracts/` `[ЕСТЬ]`. Три контракта
**спроектированы здесь** `[ПЛАН]` и в Фазе 1 не создаются: правило фазы — «не создавать
новые роли (пресеты, контракты-файлы) — только описание». В `.project/contracts/` ничего
не менялось.

- База: HEAD `84ce2cc`. Обоснования — `RESEARCH.md`, слои и роли — `ARCHITECTURE.md`.

---

## 0. Общий конверт сообщения

Все шесть контрактов используют один конверт. Он **выведен из трёх существующих**
файлов, а не придуман: во всех трёх повторяются `name`, `version`, `from_role`,
`to_role`, `description`, `input`, `output`, `failure_modes`.

```yaml
---
name: <from>_to_<to>            # snake_case, совпадает с именем файла
version: 1.0.0                  # semver; ломающее изменение → major
from_role: orchestrator         # роль-отправитель
to_role: content-writer         # роль-получатель
description: |
  Зачем существует этот контракт. Получатель обязан прочитать до начала работы.

# --- ГРАНИЦА ОТВЕТСТВЕННОСТИ (есть только в двух из трёх текущих контрактов;
#     в Фазе 2 добавить во все три — это главный дефект текущего набора, см. §5)
responsibilities:
  sender_may: []                # что отправитель имеет право делать
  sender_may_not: []            # что отправитель НЕ имеет права делать
  receiver_may: []
  receiver_may_not: []

input: {}                       # поля, обязательные к передаче
output: {}                      # поля, обязательные к возврату
failure_modes: []               # условия отказа, каждое — одно предложение
---

# Опциональные секции
# goal_invariant: {...}         # инвариант задачи; отсутствие → FAILED
# topic_validation: {...}       # если контракт касается тем банка
```

**Инварианты конверта (проверяются оркестратором):**

1. `name` совпадает с именем файла без `.yaml`.
2. `version` поднимается при любом изменении `input`/`output`/`failure_modes`.
3. `failure_modes` не пуст: контракт без режимов отказа бесполезен.
4. `goal_invariant` присутствует и непустой; иначе получатель обязан вернуть `FAILED`.
5. Получатель **не** расширяет `input` самовольно: неизвестное поле — ошибка, не «бонус».

---

## 1. `orchestrator_to_writer` `[ЕСТЬ]`

Файл: `.project/contracts/orchestrator_to_writer.yaml` (29 строк, v1.0.0).

### Схема

```yaml
input:
  topic: string                 # ОБЯЗАН быть в каноне src/data/topics.ts (14 тем)
  subtopic: string
  batch_size: integer           # 1..20
  constraints: list
  goal_invariant:
    intent: string
    constraints: list
    evaluative_criteria: list

output:
  questions: list               # объекты в формате банка {{PRODUCT}}
  evidence: list                # man-страницы, прогоны дистракторов, cosine, qc
  status: enum                  # DONE | PARTIAL | FAILED
  goal_invariant_check: boolean
  notes: string
```

### Пример

```yaml
topic: local_storage
subtopic: "LVM: снимок логического тома"
batch_size: 6
constraints:
  - "4 опции, ровно 1 верная"
  - "ratio проверить checkRatio(options,'chars'), порог по классу"
  - "explanation ≤ 3 строк"
  - "avoid-list: ls_002, ls_005, ls_007"
goal_invariant:
  intent: "Добавить в банк N валидных MCQ по теме, не снижая качество"
  constraints: ["не дублировать существующие команды как верные ответы"]
  evaluative_criteria: ["qc Fails 0", "cos против банка ≤ 0.85"]
```

### Границы ответственности

- **Orchestrator MAY:** выбирать тему из канона, задавать batch_size ≤ 20, ставить
  avoid-list, требовать evidence.
- **Orchestrator MAY NOT:** править кандидатов после генерации, менять содержимое банка
  без approve, передавать тему вне канона.
- **Writer MAY:** выбирать команды и дистракторы внутри темы, писать explanation.
- **Writer MAY NOT:** коммитить, трогать `src/data/**` напрямую, править гейты,
  возвращать вопросы без evidence.

### Дефект, который надо закрыть `[ПЛАН]`

В текущем файле **нет `responsibilities`** — границы есть только в `failure_modes`. Из-за
этого запрет «Writer не коммитит» держится на дисциплине, а не на контракте. В Фазе 2
все три существующих контракта получают явный блок `responsibilities`.

---

## 2. `writer_to_qc` `[ЕСТЬ]`

Файл: `.project/contracts/writer_to_qc.yaml` (57 строк, v1.0.0). **Самый зрелый** из трёх:
у него есть встроенный `topic_validation` и явная формулировка независимости.

### Схема

```yaml
input:
  batch_id: string
  topic: string
  subtopic: string
  batch_size: integer
  questions: list
  evidence:
    man_pages: list of strings
    distractor_runs: list of objects
    cosine_result: object
    qc_result: object
  goal_invariant: string

output:
  verdict: PASS | FAIL
  issues: list                  # {question_id, severity, pass, description}
  evidence_verified:            # QC перезапускает сам!
    qc_rerun: list of strings
    man_recheck: list of strings
  goal_invariant_check: boolean
  notes: string

topic_validation:
  required: true
  source: src/data/topics.ts
  on_mismatch: ask_captain_for_valid_topic
```

**Severity:** `CRITICAL` | `SUBSTANTIAL` | `MINOR`.
**Проходы (pass):** `fact-check` | `objective` | `language` | `beginner-view` | `skeptic-view`.
Hard blockers — только `fact-check` и `objective`; остальные advisory.

### Границы ответственности

- **Writer MAY NOT:** подменять evidence оценками, передавать батч без `man_pages`,
  «чинить» вопрос после передачи.
- **QC MAY:** перезапускать любые гейты, возвращать любое число issues,
  запрашивать повторную передачу.
- **QC MAY NOT:** править контент, принимать финальное решение, выдавать `PASS` при
  `goal_invariant_check: false`.

### Ключевой принцип (внешне обоснован — RESEARCH §3.1)

«QC НЕ доверяет evidence Writer'а — перезапускает проверки сам» — это **ratification
by re-execution**, прямой ответ на проблему LLM-as-judge: судья, который читает
самооценку подсудимого, не является независимым гейтом.

---

## 3. `qc_to_orchestrator` `[ЕСТЬ]`

Файл: `.project/contracts/qc_to_orchestrator.yaml` (39 строк, v1.0.0).

### Схема

```yaml
input:
  batch_id: string              # ОБЯЗАН совпасть с writer_to_qc
  verdict: PASS | FAIL
  issues: list
  evidence_verified: {qc_rerun: list, man_recheck: list}
  goal_invariant_check: boolean
  notes: string

output:
  decision: accept | reject | rework
  next_action: string
  rework_targets: list of question_ids   # не пуст при decision=rework
  message: string
```

### Границы ответственности

- **QC MAY NOT:** возвращать `accept`/`rework` — только `PASS`/`FAIL`. Решение принимает
  Orchestrator.
- **Orchestrator MAY:** принять вопреки `FAIL` (с обоснованием), расширить rework-скоуп.
- **Orchestrator MAY NOT:** коммитить без approve капитана, принимать `PASS` при
  непустом hard blocker.

**Историческое подтверждение правила:** в M2.8 QC дал FAIL с одним CRITICAL, Orchestrator
расширил rework с 3 до 6 вопросов — контракт это допускает, потому что решение за
Orchestrator'ом, а не за QC.

---

## 4. Новые контракты `[ПЛАН]` — проектируются, не внедряются

### 4.1 `orchestrator_to_devops`

Назначение: передать DevOps-роли инфраструктурную задачу (деплой, бэкап, зависимости,
гигиена гейтов). Существует только как дизайн — роль не создана (ARCHITECTURE §2.2).

```yaml
---
name: orchestrator_to_devops
version: 1.0.0
from_role: orchestrator
to_role: devops
description: |
  Инфраструктурная задача: релиз, деплой, бэкап/restore, зависимости, гигиена CI.
  DevOps НЕ правит контент и НЕ трогает банк.

responsibilities:
  sender_may:
    - "ставить инфраструктурную задачу со ссылкой на спеку"
    - "требовать прогон гейтов после изменения"
  sender_may_not:
    - "просить DevOps править src/data/**"
    - "просить менять package.json без approve капитана"
  receiver_may:
    - "править .github/workflows/**, docs/ деплой-артефакты"
    - "предлагать обновление зависимостей отдельной спекой"
  receiver_may_not:
    - "коммитить без preview"
    - "трогать persist config, .project/contracts/*"
    - "делать push в прод без approve (правило 4)"

input:
  task_id: string
  spec_id: string               # ссылка на .project/specs/NNN-slug.md
  area: enum                    # release | deploy | backup | dependencies | ci_hygiene
  goal: string
  constraints: list
  goal_invariant:
    intent: string
    constraints: list
    evaluative_criteria: list

output:
  changed_paths: list
  evidence:
    commands_run: list of objects   # {command, exit_code, note}
    restore_drill: object | null    # для area=backup
  rollback_plan: string
  status: enum                  # DONE | PARTIAL | FAILED
  goal_invariant_check: boolean
  notes: string

failure_modes:
  - "area=backup без restore drill — заявлять DONE нельзя"
  - "изменён package.json без approve капитана"
  - "изменён persist config или src/data/**"
  - "нет rollback_plan при изменении деплоя"
  - "push в прод выполнен без approve (правило 4)"
---

# Пример
task_id: m4-nas-backup
spec_id: 012-nas-backup
area: backup
goal: "Ежедневный бэкап банка и .project/ на NAS с проверкой восстановления"
constraints: ["не трогать прод", "restore drill обязателен"]
```

**Открытый вопрос капитану:** нужен ли DevOps как **роль** вообще, или его скоуп
закрывается документом (`spec 008` — «DevOps: документ, не пресет»)? Контракт
спроектирован так, чтобы работать в обоих случаях: если роль не появится, тот же
конверт описывает задачу, исполняемую самим Orchestrator'ом.

### 4.2 `orchestrator_to_designer`

Назначение: UI-задачи (аналог нераскрытых чек-листов M3 в PLAN.md).

```yaml
---
name: orchestrator_to_designer
version: 1.0.0
from_role: orchestrator
to_role: designer
description: |
  UI-задача: токены, структура DOM, доступность, тема. Designer не пишет
  бизнес-логику и не трогает контент банка.

responsibilities:
  sender_may:
    - "ставить UI-спеку с критериями из DOD.md (раздел ui)"
  sender_may_not:
    - "просить Designer изменить quizStore/persist/paywall-логику"
  receiver_may:
    - "править src/presentation/**, docs/dashboard/**, TOKENS.md"
  receiver_may_not:
    - "хардкодить цвета/отступы вне TOKENS.md"
    - "менять persist config"
    - "коммитить без preview-скриншота"

input:
  spec_id: string
  area: enum                    # screen | component | tokens | a11y | theme | center
  goal: string
  target_screens: list
  constraints: list
  goal_invariant:
    intent: string
    constraints: list
    evaluative_criteria: list

output:
  changed_paths: list
  preview: object               # {screenshot: path, url: string}
  evidence:
    jsdom_tests: list of strings
    a11y_result: object         # jest-axe violations
  status: enum
  goal_invariant_check: boolean
  notes: string

failure_modes:
  - "нет preview-скриншота — approve невозможен (DOD ui)"
  - "цвета/отступы вне TOKENS.md"
  - "a11y violations > 0"
  - "текст интерфейса не на русском"
  - "тема dark/light сломана"
  - "изменён persist config"
---

# Пример
spec_id: 013-center-widgets
area: center
goal: "Добавить модуль Blockers в центр разработки"
target_screens: ["docs/index.html"]
constraints: ["без фреймворков", "без кнопок", "только видимость состояния"]
```

**Зависимость:** блокируется спекой `010` (jsdom smoke-тесты центра). Без тестов
на DOM UI-задача не имеет объективного гейта — только «на глаз».

### 4.3 `orchestrator_to_test`

Назначение: регрессия и тесты на инструменты. Самая «инженерная» из трёх.

```yaml
---
name: orchestrator_to_test
version: 1.0.0
from_role: orchestrator
to_role: tester
description: |
  Тестовая задача: baseline вердиктов гейтов, тесты на tools/**, e2e.
  Tester не правит проверяемый код — он фиксирует наблюдаемое поведение.

responsibilities:
  sender_may:
    - "ставить задачу на фиксацию текущего поведения до его изменения"
  sender_may_not:
    - "просить Tester исправить найденный дефект в том же контракте"
  receiver_may:
    - "создавать тесты, baseline-файлы, фикстуры"
  receiver_may_not:
    - "править проверяемый код (иначе тест защищает собственную правку)"
    - "менять пороги гейтов, чтобы тест прошёл"
    - "коммитить без прогона полного test:run"

input:
  spec_id: string
  target: enum                  # gate_baseline | tool_unit | e2e | regression
  artifacts_to_freeze: list     # что именно фиксируем (напр. ['qc:206'])
  goal: string
  goal_invariant:
    intent: string
    constraints: list
    evaluative_criteria: list

output:
  changed_paths: list
  baseline_file: string | null  # путь к зафиксированному baseline
  evidence:
    commands_run: list of objects
    baseline_reproduced: boolean   # повторный прогон даёт те же вердикты
  status: enum
  goal_invariant_check: boolean
  notes: string

failure_modes:
  - "baseline_reproduced=false — фиксация достоверна лишь для одного прогона"
  - "Tester правил проверяемый код"
  - "порог гейта изменён ради прохождения теста"
  - "baseline фиксирует 'успех' без списка id и вердиктов"
  - "непрогнанный test:run"
---

# Пример — прямой ответ на RESEARCH §6 P1
spec_id: 014-gate-regression
target: gate_baseline
artifacts_to_freeze:
  - "qc на банке 206: Total 206, Fails 0, Warns 22"
  - "shuffle-bank:check: BANK 206 = 59/47/42/58"
  - "вердикт по каждому из 206 id (ok/warn/fail)"
goal: "Зафиксировать baseline, падающий при изменении вердиктов после правки qc.cjs"
```

**Почему этот контракт важнее двух других `[ПЛАН]`:** без него правка `tools/qc.cjs`
(спека `007`) недоказуема — сейчас «Fails 0» после изменения гейта невозможно отличить
от «гейт перестал ловить». Это риск, а не удобство.

---

## 5. Сводка: состояние набора контрактов

| Контракт | Файл | Статус | `responsibilities` | `goal_invariant` | `version` |
|---|---|---|---|---|---|
| `orchestrator_to_writer` | `.project/contracts/` | ЕСТЬ | **нет** | есть | 1.0.0 |
| `writer_to_qc` | `.project/contracts/` | ЕСТЬ | **нет** (частично в description) | есть | 1.0.0 |
| `qc_to_orchestrator` | `.project/contracts/` | ЕСТЬ | **нет** (частично в description) | есть | 1.0.0 |
| `orchestrator_to_devops` | — | ПЛАН | спроектировано | есть | 1.0.0 |
| `orchestrator_to_designer` | — | ПЛАН | спроектировано | есть | 1.0.0 |
| `orchestrator_to_test` | — | ПЛАН | спроектировано | есть | 1.0.0 |

**Сквозные дефекты текущего набора (вход для Фазы 2):**

1. **Нет `responsibilities` ни в одном.** Границы держатся на `failure_modes` и на
   дисциплине. Именно так возник инцидент ночи: субагент выполнил
   `import('.project/sync.mjs')` и перезаписал четыре файла — ни один контракт не
   запрещал этого явно.
2. **Нет версионирования изменений.** `version: 1.0.0` у всех трёх и никогда не
   поднималась; в истории проекта контракты правились (`topic_validation` добавлен
   после M2.6). Без semver нельзя понять, какая версия контракта действовала для
   конкретного батча.
3. **`batch_size`-центричность.** Все три контракта завязаны на контент-батч. Для
   инфраструктурных задач (`009`, `010`) подходящего контракта нет вообще — они идут
   «по спеке», без формальной передачи. Новые три контракта закрывают этот пробел.
4. **`topic_validation` есть только в одном.** В `orchestrator_to_writer` проверка темы
   описана в комментарии, в `writer_to_qc` — как секция. Одно и то же требование
   оформлено двумя способами; в Фазе 2 — единая секция во всех контрактах.

---

## 6. Чего в этой фазе нет

Не создано ни одного файла в `.project/contracts/` — только чтение трёх существующих.
Проектируемые контракты живут в этом документе как YAML-схемы и примеры. Внедрение —
Фаза 2, после approve капитана, отдельным коммитом на контракт.
