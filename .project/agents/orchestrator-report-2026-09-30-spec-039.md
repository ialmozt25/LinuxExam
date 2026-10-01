# Orchestrator report — spec 039 `bank-audit-036-fixes`

## 2026-09-30 · Orchestrator

### Goal

Исполнить спеку 039 (type: **content**, `approved`) — привести банк в соответствие objectives
RHCSA EX200 (RHEL 10) по результатам аудита spec 036: переписать 10 вопросов, закрыть `fm_011`
(решение капитана п.2), добавить 4 вопроса (2 IPv6 — объектив 8.1; 2 sudo/wheel — объектив 9.4),
синхронизировать `_order.json` и `_topics.json`; банк 225 → 229. Прогон через `/spec-to-team 039`
(AgentTeams) до приёмки: все гейты зелёные + qc verdict=pass + reviewer verdict=pass.

### Предусловия (snapshot ДО старта, HEAD `0abd6582`)

| Проверка | Результат |
|---|---|
| Спека `.project/specs/039-bank-audit-036-fixes.md` существует | ✓ |
| Frontmatter `status: approved` | ✓ |
| `npm run typecheck` | **0** |
| `npm run test:run` | **0** (28 файлов / 198 тестов) |
| `npm run sync:check` | **0** |
| `npm run qc` | **0** (Total 225, Fails 0, **Warns 22**) |
| `npm run shuffle-bank:check` | **0** (`BANK 225 = 66/51/47/61`) |
| `npm run order:check` | **0** (225 ids) |
| `git status` | чисто, кроме известных untracked (`.agent-teams/`, `drafts/_mas-results/`) |
| `agent_teams_status` — активной команды нет | ✓ (сообщения `TEAM-ALREADY-ACTIVE` не потребовалось) |

Edge cases спеки проверены капитаном **до** старта сканом банка: упоминаний `IPv6/inet6` в
`networking.json` — 0, `sudo/wheel` в `users_groups.json` — 0 ⇒ объём add = 2 + 2 = 4, как в спеке.
Тот же скан дал карту «id → поле» для всех 10 «требует правок» (все запрещённые токены локальны:
`Rocky 9` — 5 вхождений в 3 вопросах, `RHEL 9` — 2, `.el9` — 10 (2 вопроса), `mlocate` — 2 (1 вопрос),
модульные потоки — `ms_004`).

### Completed

**team_id:** `spec-039-bank-audit-036-fixes` (архивирован → `.agent-teams/archive/spec-039-bank-audit-036-fixes/`)

**Состав (5):** `writer-software` + `writer-network` + `writer-accounts`
(`deepseek-official/deepseek-v4-flash`, effort high), `qc` + `reviewer`
(`deepseek-official/deepseek-v4-pro`, effort high). Ростер расширен до трёх writer'ов по правилу
владения AgentTeams (член не может владеть двумя незавершёнными задачами), t1–t3 пишут в
непересекающиеся файлы; t4 (интеграция манифестов) отдана `writer-software` — к её готовности он
свободен, `t4 deps [t1,t2,t3]` это гарантирует.

**DAG и verdict:**

| id | kind | subject | assignee | deps | status | verdict |
|---|---|---|---|---|---|---|
| t1 | work | rewrite manage_software (`ms_004`, `msw_011`, `msw_014`) | writer-software | — | completed | pass |
| t2 | work | rewrite networking (`net_001..003`) + `ntw_017`/`ntw_018` (IPv6, 8.1) | writer-network | — | completed | pass |
| t3 | work | rewrite `fm_008`/`fm_011`/`ug_002`/`ug_007`/`fs_004` + `ug_019`/`ug_020` (9.4) | writer-accounts | — | completed | pass |
| t4 | work | интеграция: `_order.json` +4 (append), `_topics.json`, shuffle, полные гейты | writer-software | t1,t2,t3 | completed | pass* |
| t5 | work | qc — независимая проверка t1–t4 (ratification by re-execution) | qc | t4 | completed | **pass** (3 low) |
| t6 | work | reviewer — финальное ревью раунда 1 | reviewer | t5 | **failed** | **needs_revision** (1 must-fix) |
| t7 | repair | repair `r6-f1`: удалить ложную клаузу в explanation `ntw_017` | writer-network | — | completed | pass |
| t8 | verification | независимая проверка repair t7 (r6-f1 закрыт, регрессий нет) | qc | t7 | completed | pass |
| t9 | review | финальное ревью раунда 2 (reviewedTaskId = t7) | reviewer | t8 | completed | **pass** |

\* t4 — `pass` с задокументированной оговоркой: шаг «`haladyna all --auto-only` → exit 0» недостижим
(см. «Оговорки»). Итог: 9 задач, 8 completed / 1 failed (t6 — сам вердикт `needs_revision`),
durationMs **2273617 ≈ 37 мин 53 с**, `.project/mas-runs.json` 16 → 17 записей, `verdict: pass`.

**Что сделано.** Банк **225 → 229** (networking 16→18, users_groups 18→20; остальные 12 тем не тронуты).
15 затронутых id:

- `ms_004` — модульные потоки убраны, RHEL 10 post-modular, верный ответ `dnf install postgresql16`
  (улика: Red Hat Developer 2025-03-11); `msw_011`/`msw_014` — `.el9` → `.el10` в условии и всех
  опциях, ложное «`dnf install` падает без репозиториев» переформулировано;
- `net_001` — разбор переписан на реальные дистракторы (несуществующего `ip addr add` нет);
  `net_002`/`net_003` — метка «Rocky 9» убрана из вопроса и разбора;
- `fm_008` — `mlocate` → `plocate`, база `/var/lib/plocate/plocate.db`, дистрактор `plocate -r`;
  `fm_011` — дистрактор `-cf … --bzip2` → `tar -cJf backup.tar.bz2 /home` (набор `-czf`/`-cf`/`-cJf`/`-cjf`,
  ровно 1 верный `-cjf`, разбор явно говорит «J — xz, не bzip2»);
- `ug_002`/`ug_007` — эмпирика Rocky 9.8 убрана, `_meta.human_review` удалён, `verified_rhel` 9.8 → 10;
  `fs_004` — «Типа smbfs в RHEL 9 нет» → версионно-нейтрально «в RHEL 10», вопрос сохранён;
- `ntw_017`/`ntw_018` — IPv6 (объектив 8.1, `objective_domain` «8»); `ug_019`/`ug_020` — sudo/wheel
  (объектив 9.4, `objective_domain` «9»); у всех 4 — 4 опции / ровно 1 correct / `_meta` по брифингу.

`_order.json` 225 → 229 (чистый append +4, `git diff` — один хунк), `_topics.json` — total 229 /
networking 18 / users_groups 20 (дифф ровно 3 числа). `correctIndex` у всех 11 переписанных не
менялся; stale-токены `.el9` / `mlocate` / `Rocky 9` / модульные потоки / `dnf module enable` по
5 темам = 0. Правка раунда 2 (t7) — ровно одна подстрока в explanation `ntw_017`.

**Файлы:** `src/data/questions/{manage_software,networking,file_management,file_systems,users_groups,_order,_topics}.json`.
Артефакты прогона (untracked): `.project/drafts/spec-039-{brief.md,cosine-neighbors.mjs,t1-report.md,t2-report.md,t3-report.md,t4-report.md,t4-haladyna-batch.json,qc-report.md,review-report.md,r1-report.md,v2-report.md,review2-report.md}`.
Память: `docs/memory/episodic.md`, `docs/memory/working.md`; решение — `.project/DECISIONS.md`; этот отчёт.
`tools/**`, `.project/sync.mjs`, `.project/scripts/**`, 9 других тем — **не тронуты**.

**Капитанские инструменты прогона (созданы до старта команды):**

1. `.project/drafts/spec-039-brief.md` — контракт прогона (схема вопроса, конвенции `_meta`, карта
   «id → поле», гейты, baseline, запреты, формат отчёта). Взят потому, что `plan.create` > 8 KB
   ломается: подробности вынесены в файл, описания задач в payload — короткие ссылки.
2. `.project/drafts/spec-039-cosine-neighbors.mjs` — cosine-гейт для **правок на месте**:
   `tools/cosine.cjs <pending.json>` сверяет кандидата со всем банком **включая его самого**, поэтому
   для in-place rewrite (`.el9`→`.el10`) даёт ложный REJECT (cos 1.0 с собственной строкой). Скрипт
   считает максимум по банку с исключением своего id, порог — тот же `DEFAULT_COSINE_THRESHOLD` из
   `tools/cosine-calibration.json` (0.80). Проверен контролем: `tf_001` → `REJECT 0.9020` (известная
   пара из whitelist), `ntw_016` → `ok 0.5996`.

### Гейты (перепроверены лидом лично после завершения прогона, сырые exit-коды)

| гейт | до прогона | после прогона |
|---|---|---|
| `npm run order:check` | 0 (225 ids) | **0** (`OK: _order.json matches 229 ids from 14 topic files`) |
| `npm run manifest` | 0 (225/14) | **0** (`OK: 229 questions, 14 topics`) |
| `npm run shuffle-bank:check` | 0 (`BANK 225 = 66/51/47/61`) | **0** (`BANK 229 = 69/51/48/61`; `--apply` не потребовался и не запускался) |
| `npm run qc` | 0 (225 / Fails 0 / Warns 22) | **0** (229 / Fails 0 / **Warns 22 = baseline**) |
| `npm run test:run` | 0 (28 / 198) | **0** (28 файлов / 198 тестов) |
| `npm run typecheck` | 0 | **0** |
| `node .project/drafts/spec-039-cosine-neighbors.mjs <15 id>` | — | **0** (`checked=15 over_threshold=0`, max 0.7701) |
| `node tools/haladyna.cjs --batch …t4-haladyna-batch.json --auto-only` | — | **0** (Auto-perfect 15/15) |
| `node tools/haladyna.cjs all --auto-only` | 1 (224/225) | **1** (228/229 — только предсуществующий `lsl_009`) |
| `npm run check:episodic` | — | **0** |
| `npm run sync:check` | 0 | **2 — ожидаемое предзакрытийное состояние** (см. ниже) |

**Критерии приёмки спеки 039 (лид, независимо от отчётов членов):**

| # | Критерий | Результат |
|---|---|---|
| 1 | 10 вопросов rewritten, нет «Rocky 9»/«RHEL 9»/`.el9`/`mlocate`/модульных потоков | ✓ (скан по банку + id-level дифф) |
| 2 | `fm_011` — ровно 1 верный вариант | ✓ (`-cjf`) |
| 3 | +4 новых (2 IPv6, 2 sudo/wheel), схема + `objective_domain` | ✓ («8» / «9») |
| 4 | `_topics.json`: total 229, networking 18, users_groups 20 | ✓ |
| 5 | `_order.json`: +4 новых id одной транзакцией | ✓ (append, один хунк) |
| 6 | `npm run shuffle-bank:check` → 0 | ✓ |
| 7 | `npm run manifest` → 0 (229/14) | ✓ |
| 8 | `npm run qc` → 0 (Fails 0, Warns ≤ baseline) | ✓ (22 = baseline) |
| 9 | `npm run test:run` → 0 | ✓ |
| 10 | qc verdict=pass; reviewer verdict=pass | ✓ (t5 pass; t9 pass после repair-раунда) |

**Независимая проверка лида (не доверие отчётам членов):** id-level дифф HEAD ↔ current по 5 темам —
изменены ровно 15 id (10 rewritten + `fm_011` + 4 new), удалений нет, `correctIndex` не менялся,
`_order.json` — один хунк +4, `_topics.json` — 3 числа, SHA `manage_software` `2dd8de56…`, `_order`
`6aed065b…`, `_topics` `9d359c83…` совпали с заявленными членами; все перечисленные гейты
перезапущены капитаном лично.

### Blockers

Блокеров исполнения нет. Три пункта требуют решения/учёта капитаном:

1. **`lsl_009` (`local_storage`) — шаг контракта t4 недостижим, долг предсуществующий.** `haladyna all
   --auto-only` → exit 1 (Auto-perfect 228/229) на **обоих** снимках: HEAD `0abd658` даёт 224/225 и
   exit 1, после прогона — 228/229 и exit 1. Единственный сбой — `lsl_009` (AUTO_FAIL[5], «длина верной
   опции»; рядом `qc` даёт по нему WARN length-hint). `local_storage` — одна из 9 тем, запрещённых
   скоупом 039 (brief §2), write-скоуп t4 — только манифесты, поэтому правка не делалась. Скоуповый
   контроль: `haladyna --batch` по 15 вопросам прогона = 15/15, exit 0. Долг записан в
   `docs/archive/HANDOFF.md:308-311` и принят капитаном как вне-скоуповый (вариант «а»); судьба долга
   (отдельная спека / backlog) — за капитаном.
2. **`sync:check` = 2 — ожидаемое предзакрытийное состояние, не дефект** (изолировано экспериментом:
   память откачена + банк изменён → drift «`STATE.md` отстал»; банк откачен + память и `mas-runs.json`
   изменены → drift только по `docs/index.html`). Входы генератора изменились штатно: банк 225→229
   (`sync.mjs` пересчитывает `goal.current_questions` из `_topics.json`), `npm run runs:log` дописал
   `.project/mas-runs.json`, memory-блок в центре. Цепочка `sync → git add → commit → converge` —
   это и есть `npm run spec:close`; сам прогон `sync` и коммиты не делал (как 036/038).
   Состояние банка в `.project/STATE.md` (225 / 75 %) обновится на закрытии.
3. **Остаточные low-пункты qc:** qc-f2 (двусмысленность «con-name» в разборе `ntw_017`) и qc-f3
   (вопрос `ug_020` про «каталог», верный вариант — путь к файлу) — ревьюер классифицировал как
   `accepted-low` (ложных фактов нет, ответ уникален). Допустимо закрыть их в следующем контент-батче.

### Находки капитана (сверх отчётов членов)

1. **adjudication вместо «не блокирует».** qc дал pass с 3 low; капитан потребовал от ревьюера явный
   вердикт по каждому пункту — и qc-f1 стал **must-fix**, что и вызвало repair-раунд. Это защита
   Goal Invariant: спека 039 существует ради удаления ложных утверждений из банка, поэтому новое
   ложное утверждение (даже low) не могло быть принято молча.
2. **Проверка «правила владения» как ограничения дизайна.** Декомпозиция спеки («один writer на
   t1–t3») неисполнима в AgentTeams без сериализации, поэтому ростер расширен, а не задачи склеены.
3. **Расширение write-скоупа артефактами.** Каждому writer'у добавлен собственный префикс
   `.project/drafts/spec-039-<task>-*` (отчёты/кандидаты) — скоупы не пересекаются, отчёты durable.
4. **`tools/cosine.cjs` не покрывает in-place rewrite** (self-match = 1.0). Это же ограничение
   объясняет, почему предыдущие батчи (addition-only) его не встречали. Кандидат в knowledge-base.

### Next Steps

1. **Approve капитана** на результат прогона (rule 6, `type: content`) — обязателен.
2. **Закрыть spec 039 одной командой:** `npm run spec:close -- 039 --dry-run`, затем
   `npm run spec:close -- 039` (frontmatter `status: done` + `commit: <feat-SHA>`, R5-trace, память,
   commit-chain `docs(spec-039): done …` → `npm run sync` → `chore(state): converge …`, финальный
   `sync:check` = 0; в архиве лежит `team.json` с задачей t9 `verdict=pass`, поэтому гейт закрытия
   выполняется).
3. **Коммит банка и артефактов прогона** — вместе с закрытием (`.project/drafts/spec-039-*`,
   memory, DECISIONS, этот отчёт). Push — только по отдельной per-command авторизации (правила 10/11).
4. **Решения по остаткам:** судьба `lsl_009` (отдельная спека / backlog); закрытие qc-f2/qc-f3
   в следующем контент-батче.

### Evidence

`.agent-teams/archive/spec-039-bank-audit-036-fixes/team.json` (9 задач, t9 `verdict=pass`);
`.project/mas-runs.json` (17 записей, `spec-039-bank-audit-036-fixes`, verdict `pass`, durationMs
2273617); записи rule 12 в `docs/memory/episodic.md` (`## 2026-09-30 | spec-039-bank-audit-036-fixes`)
и `docs/memory/working.md` (верхний блок); решение — `.project/DECISIONS.md`, раздел «spec 039»;
отчёты задач — `.project/drafts/spec-039-{t1,t2,t3,t4,qc,review,r1,v2,review2}*.md/md`.
Push не выполнялся (правила 10/11).
