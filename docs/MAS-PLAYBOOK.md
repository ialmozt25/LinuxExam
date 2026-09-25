# MAS Playbook — 6-role audit

Практическое руководство по многоагентному аудиту банка вопросов LinuxExam:
когда его запускать, как устроены роли, что считается приёмкой и какие грабли
уже собраны. Команда-обёртка — skill `/mas-run`
(`~/.agents/skills/mas-run/SKILL.md`), этот файл — источник правды по критерию.

## §1. Когда использовать

- После генерации нового батча вопросов (новый topic или крупная пачка правок).
- После крупных правок существующего батча: смена ключей, дистракторов, стемов
  на нескольких вопросах подряд.
- Когда нужна внешняя проверка на «второй правильный ответ» и на устаревшие
  команды, которую не дают детерминированные инструменты.

**НЕ использовать:**

- Для точечных fix одного вопроса — достаточно `node tools/qc.cjs` и
  `node tools/haladyna.cjs --auto-only all`.
- Для проверки распределения позиций — есть `tools/shuffle-bank.mjs --check`.

## §2. Архитектура

- 6 ролей, каждая — изолированная сессия через AgentTeams
  (`agent_teams_create` → `agent_teams_status` → `agent_teams_delete`).
- Капитан (текущая сессия) собирает BATCH_JSON, раздаёт его ролям в
  `plan.tasks[].description` и агрегирует голоса.

| роль | provider/model |
|---|---|
| sysadmin_10y | deepseek-official / deepseek-v4-flash |
| rhcsa_instructor | deepseek-official / deepseek-v4-pro |
| ex200_examiner | deepseek-official / deepseek-v4-pro |
| beginner | deepseek-official / deepseek-v4-flash |
| skeptic | tier-router / smart |
| ru_editor | deepseek-official / deepseek-v4-flash |

Платформа: Rocky 9.8, dnf 4.14 (dnf4). Проверки — на живом Rocky (WSL),
не «по памяти»; RHEL 10/dnf5 ведёт себя иначе (см. §8 и §7).

## §3. Роли и их статус

| роль | статус | фокус |
|---|---|---|
| sysadmin_10y | **HARD** | практика: верна ли команда-ключ, не устарела ли для Rocky 9.8, реалистичны ли дистракторы |
| ex200_examiner | **HARD** | >1 правильного ответа, prefix matching argparse, алиасы, регистрозависимые ключи |
| rhcsa_instructor | ADVISORY | соответствие официальным RHCSA objectives |
| beginner | ADVISORY | понятность с нуля, угадывание ответа по форме/позиции |
| skeptic | ADVISORY | где зацепится RH-инженер, точность explanation, минор-зависимость |
| ru_editor | **GATE** | только язык: опечатки, грамматика, канцелярит, двусмысленности |

## §4. Acceptance-критерий

```
accepted = (hard_blockers == 0)
           AND (ex200_examiner.verdict == PASS)
           AND (ru_editor.verdict == PASS)
```

- **Hard blocker** — blocker/minor, поднятый только `sysadmin_10y` или
  `ex200_examiner`. Это единственные роли, чей `severity: blocker` блокирует
  приёмку.
- **Minor от любой роли** — в бэклог, не блокирует.
- **`ru_editor` — отдельный gate:** PASS или NEEDS_FIX по языку, без требования
  «минимум 1 issue». NEEDS_FIX от ru_editor блокирует приёмку (но это языковой
  gate, а не дефект содержания).
- `rhcsa_instructor`, `beginner`, `skeptic` **не блокируют** приёмку даже при
  NEEDS_FIX: их замечания уходят в бэклог следующими правками.

## §5. Формат промпта роли

- **HARD (sysadmin_10y, ex200_examiner):** «найти блокеры; если блокеров нет —
  verdict PASS, `issues: []` допустим». Запрещено требовать искусственных
  замечаний.
- **ADVISORY (rhcsa_instructor, beginner, skeptic):** «найти замечания, но
  `issues: []` допустим, если батч чистый; замечания — severity `minor`».
- **ru_editor:** «PASS при чистом языке; иначе NEEDS_FIX; только языковые
  замечания».
- **УБРАТЬ** из промптов beginner и skeptic строку «Минимум 1 issue» — она
  заставляла роли выдумывать замечания и делала приёмку недостижимой.

## §6. Процедура (10 шагов)

1. `cd "C:\Users\Alexey Udotov\LinuxExam"` — обязательно (harness может
   стартовать из OneDrive).
2. `node tools/export-pending.mjs <topic> <date> --force`.
3. Прочитать `drafts/pending-<topic>_<date>.json`, собрать
   `BATCH_JSON = JSON.stringify(questions.map(q => ({id, subtopic, question, options})))`
   (`explanation` не включать — удваивает payload).
4. Проверить baseline: `git log --oneline -1` и `node tools/qc.cjs`
   (ожидание: Fails=0, Warns≤15).
5. `agent_teams_create` с `approval: "automatic"`, 6 members (§2) и 6 tasks;
   фокусы ролей и BATCH_JSON — в `plan.tasks[].description`.
6. Дождаться завершения: поллинг `agent_teams_status` каждые 15 с (до 50
   итераций), `wait_agent` AgentTeams-участников не видит.
7. Собрать голоса (источники по приоритету: `tasks[].output` → `result` →
   `artifacts` → mailbox капитана; парсинг: `JSON.parse` → regex `\{[\s\S]*\}`),
   посчитать `hard_blockers`, `ex200_examiner.verdict`, `ru_editor.verdict` и
   применить критерий §4.
8. Сравнить с предыдущим прогоном: статус прежних реальных блокеров
   `closed | open | downgraded`.
9. `agent_teams_delete()` — безусловно, независимо от cwd. Падение
   зафиксировать, но не блокировать отчёт.
10. Вернуть итоговый JSON (votes, summary{candidates, accepted, hard_blockers},
    blockers, minors, сравнение) без markdown.

## §7. Известные проблемы

- **cwd = OneDrive ломает cleanup:** следующий запуск капитана стартует в
  member-контексте. Fix: `cd` в шаг 1 и `agent_teams_delete()` в шаг 9.
- **`plan.members[].executionPrompt` отвергается схемой** — роли и фокусы
  идти в `plan.tasks[].description`.
- **provider указывать явно** для каждой модели: без него участник наследует
  маршрут капитана.
- **BATCH_JSON > 8 KB ломает `agent_teams_create`** — резать до
  `{id, subtopic, question, options}`.
- **`wait_agent` не видит AgentTeams** (отдельный реестр) → резервный поллинг
  `agent_teams_status` каждые 15 с, максимум 50 итераций.
- **`beginner` и `skeptic` могут выдавать `issues: []` при чистоте** — это
  ожидаемое поведение с 2026-09-28 (требование «минимум 1 issue» снято, см. §5).
- **Cosine после интеграции даёт self-match** (вопрос сравнивается сам с собой
  после вливания в общий банк) — артефакт, не дефект контента.
- **Позиционная раскладка:** `tools/shuffle-bank.mjs --check` может выдать
  per-topic предупреждение (>60% на одной позиции) при здоровом банк-уровне;
  это не hard blocker, но повод пересмотреть тексты опций (хеш меняется →
  перестановка меняется).

## §8. История прогонов

Все прогоны до r5 выполнены 2026-09-25 в одной сессии.
Суффикс rN — номер ревизии, не дата.

| batch_id | PASS | hard blockers | accepted |
|---|---|---|---|
| manage_software_r1 | 1/6 | 5 | false |
| manage_software_r2 | 4/6 | 7 (bias) | false |
| manage_software_r3 | 3/6 | 0 | false (старый критерий) |
| manage_software_r4 | 4/6 | 2 | false |
| manage_software_r5 | 6/6 | 0 | **true** |
| local_storage_r1 | 3/6 | 1 (ls_006) | false |

При новом критерии (§4) r3 был бы accepted.

**Примечание (сверка с логами прогона r3).** В голосовании r3
`ex200_examiner` вернул PASS с `issues: []`, но `ru_editor` вернул NEEDS_FIX
(4 языковых minor: ms_002, ms_003, ms_006, ms_007). Критерий §4 требует
`ru_editor == PASS`, поэтому по логам прогон r3 остаётся **не принятым**;
смена критерия меняет порог для будущих прогонов, а не исход
зафиксированных. Числа в таблице — по спецификации задачи; в логах сессии
для r1 подтверждены блокеры ms_002–ms_005.

**Схема идентификаторов.** `batch_id = <topic>_<label>`; `label` —
аргумент `/mas-run` либо автоинкремент `r<N>` по
`drafts/_mas-results/<topic>_r<N>.json`. Дата в идентификаторе — только по
явному указанию. Результат каждого прогона сохраняется в
`drafts/_mas-results/<batch_id>.json`.
