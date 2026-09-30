# Orchestrator report — spec 038 `close-spec-automation`

## 2026-09-30 · Orchestrator

### Goal

Исполнить спеку 038 (type: infra, `approved`) — CLI-скрипт `.project/scripts/close-spec.mjs`,
закрывающий спеку одной командой (R5-trace, frontmatter, memory, commit-chain, `sync:check` = 0),
через прогон AgentTeams по правилу `/spec-to-team 038` и довести до приёмки.

### Предусловия (snapshot ДО старта, HEAD `b3f9b25`)

| Проверка | Результат |
|---|---|
| Спека `.project/specs/038-*.md` существует | ✓ |
| Frontmatter `status: approved` | ✓ |
| `npm run typecheck` | **0** |
| `npm run test:run` | **0** (28 файлов / 198 тестов) |
| `npm run sync:check` | **0** |
| `git status` чистый | ✓ (только известные untracked: `.agent-teams/`, `drafts/_mas-results/`) |
| `agent_teams_status` — активной команды нет | ✓ |

### Completed

**team_id:** `spec-038-close-spec-automation` (архивирован → `.agent-teams/archive/spec-038-close-spec-automation/`)

**Состав (3):** `builder` + `builder2` (`deepseek-official/deepseek-v4-flash`, effort high),
`reviewer` (`deepseek-official/deepseek-v4-pro`, effort high). Спека даёт свою `## Декомпозицию`,
поэтому ростер взят из неё (architect/tester работы не имеют).

**DAG и verdict:**

| id | kind | assignee | deps | status | verdict |
|---|---|---|---|---|---|
| t1 | work | builder | — | completed | — |
| t2 | implementation | builder2 | t1 | completed | — |
| t3 | review (round 1) | reviewer | t1, t2 | completed | **pass** |

Валидация DAG до `create`: все `dependencies` ссылаются на существующие id, циклов нет; t1/t2
пишут один файл, но связаны последовательной зависимостью — пересечения write-скоупов во времени нет.

**Что сделано.** `.project/scripts/close-spec.mjs` — **новый, 1553 строки, 75 777 Б, Node ESM,
zero-deps (только `node:*`), 0 CRLF** (правило 16). Шаги 1–4 (t1): CLI (`<spec-id>`, `--dry-run`,
`--refresh-working`, `--help`), резолв `.project/specs/<id>-<slug>.md` по frontmatter, рекурсивный
поиск `team.json` в `.agent-teams` (корень + `archive/**`), проверка `verdict=pass` у reviewer-задачи,
извлечение токенов R5 = id completed-задач (natural order, `cancelled` исключены — как требует
R5-гейт в `check-consistency.mjs`), скелет `--dry-run`. Шаги 5–11 (t2): R5-trace (`--allow-empty`) →
точечная правка frontmatter (`status: done`, `commit: <feat-SHA>`) → append в
`docs/memory/episodic.md` (блок «(закрытие)», шаблон 036/037) и `.project/log.md` →
`docs(spec-<id>): done - <title>` → `npm run sync` → `chore(state): converge after spec-<id> done` →
`sync:check` → `--refresh-working`. `package.json`: **+1 строка** `"spec:close"` (зависимости и lock
не тронуты). Идемпотентность: повторный прогон = 0 мутаций; `sync:check != 0` → exit 2 без отката
(правило 9); чужая незакоммиченная правка → STOP до коммита.

**Файлы (changedPaths):** `.project/scripts/close-spec.mjs` (новый, untracked), `package.json` (+1/−0),
`docs/memory/episodic.md`, `docs/memory/working.md`, `.project/DECISIONS.md`, этот отчёт.
`src/**`, `tools/**`, `.project/sync.mjs`, `.project/scripts/check-consistency.mjs`,
`.project/scripts/run-spec.mjs`, спеки 028–037 — **не тронуты**.

**Гейты (перепроверены лидом лично, сырые exit-коды):**

| Гейт | Результат |
|---|---|
| `npm run typecheck` | **0** |
| `npm run test:run` | **0** (28 файлов / 198 тестов — идентично baseline) |
| `npm run sync:check` (в т.ч. `consistency:check`) | **0** (после архивации команды) |
| `npm run check:episodic` | **0** |
| `node --check .project/scripts/close-spec.mjs` | **0** |
| `git worktree list` | чисто (временные worktree удалены) |

**Критерии приёмки спеки 038 — воспроизведены лидом независимо от отчёта ревьюера:**

| # | Критерий | Результат |
|---|---|---|
| 1 | `… 999 --dry-run` → exit 3 + отчёт | **exit 3** ✓ |
| 2 | `… 036 --dry-run` (spec 036 done) → exit 0, WARN «already done», дерево не изменено | **exit 0** + WARN, дерево не изменено ✓ |
| 3 | `--dry-run` на approved-спеке в worktree: шаги напечатаны, коммитов нет, `git diff --stat` пусто | ✓ (HEAD до == после) |
| 4 | `node --check` → exit 0 | **exit 0** ✓ |
| 5 | `npm run spec:close -- --help` → usage | **exit 0**, usage ✓ |
| 6 | Reviewer verdict = pass | **pass** ✓ |

### Blockers

Нет блокеров. Открытые пункты требуют решения капитана (см. Next Steps), но исполнение не заблокировано.

### Находки лида (сверх отчёта ревьюера)

1. **Исправлена ошибка диагностики в LOW-finding ревьюера №2.** Ревьюер назвал `sync:check = 2`
   «предсуществующим дрейфом HEAD `b3f9b25`» и подтвердил прогоном в чистом `git worktree`. Проверка
   была **confounded**: `.agent-teams/` не в индексе (untracked) — в свежем worktree его нет вовсе, а
   закоммиченный `docs/index.html` сгенерирован **с** ним; отсутствие каталога даёт тот же симптом по
   другой причине. Изоляция тремя контролируемыми кейсами в чистых worktree на `b3f9b25`:

   | Кейс | `node .project/sync.mjs --check` |
   |---|---|
   | A: `archive/` + `retired-members.json` (среда предусловия) | **exit 0** |
   | B: A + live-команда `spec-038-…` | **exit 2** |
   | C: A + `close-spec.mjs` + изменённый `package.json`, **без** live-команды | **exit 0** |

   Настоящая причина — известный эффект секции «Пульс агентов» (рендер live `.agent-teams/*/team.json`,
   spec 022/034), **не** дрейф HEAD. Подтверждено предсказанием и проверкой: после `agent_teams_delete()`
   `sync:check` вернулся в **exit 0** без converge-коммита. Урок: «воспроизводится в чистом worktree» —
   не доказательство предсуществования, если проверяемый вход **untracked**.

2. **Отклонение от буквы спеки (LOW, не FAIL):** добавлены два аддитивных флага `--json` и
   `--repo-root`. Ревьюер проверил аддитивность: критерии 1–5 не ломаются, гейт `verdict=pass` не
   обходится ни в `--json`, ни в `--repo-root` (`verdict != pass` → exit 2 в обоих режимах).
   `--repo-root` объективно нужен для критерия 3: `close-spec.mjs` — untracked-файл, в свежем
   `git worktree` его нет.

3. **Ростер:** `builder + builder2 + reviewer` вместо литерального `assignee: builder` для t1 и t2 —
   AgentTeams запрещает члену владеть двумя незавершёнными задачами; t1/t2 пишут один файл и связаны
   последовательной зависимостью.

4. **Ручной apply на спеке 038 не запускался** в основном дереве: `close-spec.mjs 038 --dry-run` даёт
   exit 2, пока reviewer-задача не `completed` с `verdict=pass` (то есть во время самого прогона), а
   apply закрыл бы спеку до вердикта ревью. Сквозной apply проверен в одноразовой fixture-репе
   `%TEMP%` (3 коммита, frontmatter, episodic/log/working, converge, `sync:check` = 0, идемпотентный
   повтор, красный гейт → exit 2 без отката).

### Next Steps

1. **Approve капитана** на результат прогона.
2. **Закрыть spec 038 одной командой** (догфудинг скрипта): сначала `npm run spec:close -- 038 --dry-run`,
   затем apply — `npm run spec:close -- 038` (поставит `status: done`, `commit: <feat-SHA>`, R5-trace,
   память, commit-chain и `sync:check` = 0).
3. **Решить судьбу отклонения** «`--json` / `--repo-root`»: принять как расширение CLI (тогда обновить
   шаги 1 и 11–13 спеки 038) либо потребовать удаления.
4. **Push** — отдельная авторизация (правило 10/11); прогон не коммитил и не пушил.
5. **Follow-up (вне скоупа 038):** секция «Пульс агентов» в `docs/index.html` рендерит live
   `.agent-teams/*/team.json` вне VOLATILE-маркеров → побайтовый `--check` дрожит от смены статусов
   задач (pre-existing, spec 022; кандидат в отдельную спеку — уже отмечен в записи spec 037, N3).

### Evidence

`.agent-teams/archive/spec-038-close-spec-automation/team.json` (3 задачи, t3 `verdict=pass`);
записи в `docs/memory/episodic.md` (`## 2026-09-30 | spec-038-close-spec-automation`, rule 12) и
`docs/memory/working.md`; решение — `.project/DECISIONS.md`, раздел «spec 038».
