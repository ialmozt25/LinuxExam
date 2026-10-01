# Orchestrator report — spec 040 `spec-chain`

## 2026-10-01 · Orchestrator

### Goal

Исполнить спеку 040 (type: **infra**, `approved`) — построить фабрику spec-chain из трёх компонентов:
**A** Проверяльщик спек (11 фаз: детерминированное ядро Фаз 0/1/4 + reference-скилл Фаз 2/3/5–10 + CLI
`npm run spec:enrich`), **B** Оркестратор цепочки (`run-spec-chain`, 5 шагов с STOP-точками),
**C** документация пресета `linuxexam-spec-chain` (`README.md` + шаблон `agent.cordis.yml`).
Прогон через `/spec-to-team 040` (AgentTeams) до приёмки: все гейты зелёные + qc verdict=pass +
reviewer verdict=pass. Пресет в `~/.dsh/.agent-presets/` — операция капитана, вне репо.

### Предусловия (snapshot ДО старта, HEAD `09448a57`, ahead 4)

| Проверка | Результат |
|---|---|
| Спека `.project/specs/040-spec-chain.md`, `status: approved` | ✓ |
| `npm run typecheck` | **0** |
| `npm run test:run` | **0** (28 файлов / 198 тестов) |
| `npm run sync:check` | **0** |
| `agent_teams_status` — активной команды нет | ✓ (`TEAM-ALREADY-ACTIVE` не потребовалось) |
| `git status` | чисто, кроме известных untracked (`.agent-teams/`, `drafts/_mas-results/`) |

Разведка лида перед контрактами: `dsh --profile headless` существует (`$DSH_HOME/profiles/headless`) ⇒
LLM-раннер для Фаз 2/3/5–10 реализуем через `--llm-cmd`; ключей LLM в env нет; каталог `dsh --profile
headless` пригоден как дефолт, стенд-ин — как override. Write-скоупы всех задач разведены заранее;
ad-hoc артефакты — только в untracked `drafts/_mas-results/spec-040/**`.

### Completed

**team_id:** `spec-040-spec-chain` (архивирован → `.agent-teams/archive/spec-040-spec-chain/`)

**Состав (6):** `builder-validate`, `builder-enrich`, `builder-orchestrator`, `builder-docs`
(`deepseek-official/deepseek-v4-flash`, effort high), `qc`, `reviewer`
(`deepseek-official/deepseek-v4-pro`, effort high). Четыре builder'а — по правилу владения AgentTeams
(член не может владеть двумя незавершёнными задачами) при четырёх параллельных t1–t4.

**DAG и verdict:**

| id | kind | subject | assignee | deps | status | verdict |
|---|---|---|---|---|---|---|
| t1 | implementation | `.project/scripts/validate-spec.mjs` — Фазы 0/1/4 (15 проверок m01–m15) | builder-validate | — | completed | pass |
| t2 | implementation | `docs/spec-chain/skills/spec-enrich/SKILL.md` — 11 фаз | builder-enrich | — | completed | pass |
| t3 | implementation | `docs/spec-chain/skills/run-spec-chain/SKILL.md` — 5 шагов, STOP A/B/C | builder-orchestrator | — | completed | pass |
| t4 | implementation | `docs/spec-chain/README.md` + `agent.cordis.yml` (Компонент C, в спеке — t5) | builder-docs | — | completed | pass |
| t5 | implementation | `.project/scripts/enrich-spec.mjs` + `package.json` (CLI, в спеке — t4) | builder-enrich | t1,t2 | completed | pass |
| t6 | verification | верификация раунда 1 (ratification by re-execution) | builder-validate* | t1..t5 | **failed** | **needs_revision** (8 находок) |
| t8 | repair | F2/F3/F6/F8 — intent-guard, гарантия маркера, классы score, exit-коды | builder-enrich | — | completed | pass |
| t9 | repair | F7 — m02 больше не hard-fail (политика по `severity`) | builder-validate | — | completed | pass |
| t10 | repair | F4 — достижимый источник ролей в Шаге 3 (`roster.yaml`/fallback) | builder-orchestrator | — | completed | pass |
| t11 | verification | верификация раунда 2 (F2/F3/F4/F6/F7/F8 + уточнённый sync:check) | **qc** | t8,t9,t10 | completed | **pass** |
| t7 | review | финальное ревью (14/14 критериев спеки), `reviewedTaskId = t5` | reviewer | t11 | completed | **pass** |

\* t6 исполнил участник роли `builder` (автораздача scheduler'а), а критерий приёмки 14 требует
`qc verdict=pass` — отклонение закрыто раундом 2 (t11 с явным assignee `qc`).
Итог: 11 задач — 10 completed / 1 failed (t6 — сам вердикт `needs_revision`).

**Что сделано.**

- **Компонент A.** `.project/scripts/validate-spec.mjs` — Node ESM, zero-deps, read-only: Фаза 0
  (baseline score 0–100, веса 30/25/25/10/10, порог 70), Фаза 1 (ровно 15 механических проверок
  m01–m15 с полем `severity`), Фаза 4 (traceability «Цель → Критерий → Задача», hard-fail на сиротах);
  `--json`/`--out`/`--help`. `docs/spec-chain/skills/spec-enrich/SKILL.md` — все 11 фаз заголовками
  `### Фаза N — <Name>` (Фазы 0/1/4 делегируют ядру). `.project/scripts/enrich-spec.mjs` — 11 фаз:
  детерминированное ядро + LLM-фазы через `--llm-cmd`, `--dry-run`, `--out`, лог `run-log.jsonl`
  (отдельная запись Фазы 10 со своей моделью и промптом без findings Фазы 6), repair loop max 3
  итерации с rollback и STOP при oscillation, intent-guard защищённых секций, WARN-деградация без
  раннера. `package.json` — ровно +1 строка `"spec:enrich"`.
- **Компонент B.** `docs/spec-chain/skills/run-spec-chain/SKILL.md` — ровно 5 шагов, каждый с блоками
  Вход/Команда/Результат/Условие/Режим отказа; STOP A (approve enriched-спеки), STOP B (approve плана
  MAS **до** `agent_teams_create`), STOP C (отчёт + ожидание push-авторизации, таймаут 30 мин);
  таблица маппинга 8 пунктов Компонента B → 5 шагов; push — только капитан (правила 10/11).
- **Компонент C.** `docs/spec-chain/README.md` — структура пресета, инструменты, 4 скилла, системный
  промпт, 11 шагов ручной установки (включая копирование `skills/` в
  `~/.dsh/.agent-presets/linuxexam-spec-chain/skills/`); `agent.cordis.yml` — шаблон, js-yaml VALID,
  0 секретов, 0 абсолютных путей. Пресет НЕ устанавливался (Test-Path False).

### Адъюдикация находок qc-раунда 1 (8)

| id | sev | решение |
|---|---|---|
| **F1** | hard-fail (заявлен) | **pre-existing, вне скоупа 040.** Проверено лидом независимо: на чистом клоне HEAD `09448a5` `sync:check` = exit 2, после `sync → add → commit` = exit 0. Причина — производные не воспроизводимы: `mtime` файлов в `.project/state.json`, относительное время («16 ч → 17 ч») и untracked-секция `.agent-teams/*/team.json` в `docs/index.html`. Правка лежит в `.project/sync.mjs` (запрещён спекой 040) ⇒ задача не создавалась; критерий 12 уточнён до проверяемой формы (converge-цепочка, изолированная копия). Кандидат в отдельную спеку. |
| **F2** | high | ремонт t8: структурный intent-guard (`splitIntentEdits`/`intentRanges`) — правки внутри «Цель»/«Критерии приёмки» не применяются (skip + WARN), hard-fail Фазы 10 при ином изменении intent сохранён и перепроверен. |
| **F3** | medium | ремонт t8: `ensureEnrichedMarker` — CLI сам гарантирует `[enriched: URL\|tier\|дата]` либо помечает Фазу 2 warn с причиной в логе. |
| **F4** | medium | ремонт t10: Шаг 3 ссылается на фактический путь `roster.yaml` пресета (Test-Path True) + самодостаточный fallback-дефолт 6 ролей. |
| **F5** | medium | **закрыт капитаном** через `edit_plan`: t7 назначен участнику роли `reviewer`; `spec:close -- 040 --dry-run` больше не падает на «reviewer-задача не найдена». |
| **F6** | medium | ремонт t8 (документация): в SKILL.md Фазы 0 перечислены классы дефектов, не влияющие на baseline score (m04/m06/m07/m08/m09/m10), и сказано, что `delta > 0` мерится по измеримым измерениям. Метрика DECISIONS «score delta ≥ +20» — **за капитаном** (на реальных спеках недостижима: baseline spec 040 = 85 при пороге 70; рубрика задана спекой). |
| **F7** | low | ремонт t9: exit-политика переведена на `severity`; m02 (id/slug ≠ имя файла) — диагностика, hard-fail остался у m01 (нечитаемый frontmatter) и сирот Фазы 4. |
| **F8** | low | ремонт t8: таблица exit-кодов сведена в SKILL.md и `--help`; ошибки окружения переведены с exit 1 на exit 2. |

Accepted-low (не блокирует, зафиксировано честно): human-примечание `validate-spec.mjs` печатает
«m01/m02» как hard-fail, фактически hard-fail даёт только m01 (косметика; файл не правился после
ревью, чтобы не расходиться с проверенной ревизией).

### Гейты (перепроверены лидом лично после завершения)

| Гейт | Результат |
|---|---|
| `npm run typecheck` | **0** |
| `npm run test:run` | **0** (28 файлов / 198 тестов — идентично baseline) |
| `node --check` `validate-spec.mjs` / `enrich-spec.mjs` | **0** / **0** |
| `validate-spec.mjs .project/specs/040-spec-chain.md` | **0** (BASELINE 85/100, PASS 13 / FAIL 1 / WARN 1, сирот 0) |
| Подсчёты | 11 «### Фаза » · 5 «### Шаг » · 11 нумерованных шагов README · `agent.cordis.yml` True |
| `.project/DECISIONS.md` «Фабрика spec-chain» | True (стр. 1194) |
| `npm run sync:check` | **2** в рабочем дереве — ожидаемое предзакрытийное состояние (правило 3/spec 009: производные обязаны быть закоммичены) + pre-existing mtime/время/untracked-`.agent-teams` дрейф; **0** после `sync → add → commit` |

### Отклонения и уроки

1. **Роль верификатора.** Раунд 1 исполнил участник роли `builder` (scheduler раздаёт готовые задачи
   любому idle-члену, роль в этом не участвует). Критерий 14 требует `qc verdict=pass` ⇒ раунд 2
   создан с явным assignee `qc`, а t7 — с явным assignee `reviewer`. Урок: для quality-задач assignee
   задавать **при создании**, иначе роль не гарантирована.
2. **Контракт, который делает honest completion невозможным.** Acceptance t6 требовал прогнать CLI
   без `--out`, чей дефолтный каталог вывода лежит вне inScope верификатора, при одновременном
   запрете писать вне inScope. Исправлено `agent_teams_amend_task` (явный `--out` + требование
   классифицировать «реальный раннер vs структурно») — до старта раунда 2.
3. **Метрика DECISIONS «score delta ≥ +20»** на реальных спеках недостижима (spec 040 уже 85/100);
   `delta > 0` демонстрируется на ad-hoc спеке с дефектами (у qc +6, у ревьюера +6). Требует решения
   капитана: либо переформулировать метрику, либо включать штраф за mechanical FAIL в рубрику
   (последнее — изменение рубрики спеки, т.е. новая спека).
4. **Реальный LLM-раннер не поднимался.** LLM-фазы прогнаны детерминированным стендом через
   `--llm-cmd` (вложенную агентскую сессию в рабочем дереве исполнители сознательно не запускали).
   Подтверждён протокол 11 фаз, контракт ответа раннера, логирование, rollback, exit-коды; качество
   модели и реальный research — нет. Для боевого прогона нужен раннер-адаптер (`dsh --profile
   headless` ⇒ JSON с `edits/findings/verdict`).
5. **Спека ↔ декомпозиция:** критерий 4 требовал 11 заголовков `### Фаза ` в файле, которому
   декомпозиция отдавала 8 фаз, а критерий 5 — ровно 5 заголовков `### Шаг ` при 8 пунктах
   Компонента B. Разрешено в контрактах: SKILL.md документирует все 11 фаз (0/1/4 делегируют ядру), а
   5 шагов покрывают 8 пунктов таблицей маппинга. Обе трактовки зафиксированы в отчётах задач.
6. `F7`-нюанс для истории: в §3.1 отчёта qc hard-fail фикстура 900 был помечен как «DAG-проверка m04»,
   фактически его давал **m02** (slug ≠ имя файла); m04 и в исходном коде был диагностикой.

### Next Steps (за капитаном)

1. **Approve** результата прогона (type: infra).
2. **Закрытие:** `npm run spec:close -- 040 --dry-run`, затем apply —
   `npm run spec:close -- 040` (frontmatter `done` + R5-trace + память + commit-chain + converge +
   `sync:check` = 0). Предпосылки проверены: F5 закрыт, `close-spec` находит `t7` (reviewer) и `t11`
   (qc) как кандидатов с вердиктом `pass`.
3. **Коммит артефактов прогона** (в закрытии): `package.json`, `.project/scripts/{validate-spec,enrich-spec}.mjs`,
   `docs/spec-chain/**`, `.project/drafts/spec-040-*-report.md`, память.
4. **Push** — отдельная per-command авторизация (правила 10/11).
5. **Опциональные follow-up:** (a) спека на `.project/sync.mjs` — исключить `mtime`/относительное время
   из проекции `--check` и лишить untracked-`.agent-teams` влияния на коммитнутый `docs/index.html`;
   (b) уточнить метрику «score delta» в DECISIONS; (c) косметика `validate-spec.mjs` («m01/m02» →
   «m01»); (d) раннер-адаптер для боевого `run-spec-chain`; (e) при желании — жёсткий DAG-гейт
   (`severity: 'hard-fail'` для m04, одна строка).
6. **Установка пресета** `linuxexam-spec-chain` в `~/.dsh/.agent-presets/` — шаги 1–11 из
   `docs/spec-chain/README.md` (вне репо).

### Blockers

Нет. Прогон завершён; единственный «красный» гейт (`sync:check` = 2) классифицирован как
предзакрытийное состояние + pre-existing дефект невоспроизводимых производных, вне скоупа spec 040.

### Evidence

`.agent-teams/archive/spec-040-spec-chain/`; отчёты — `.project/drafts/spec-040-{t1,t2,t3,t4,t5,repair-a,repair-b,repair-c,qc,qc-round2,review}-report.md`;
ad-hoc фикстуры, стенд-ин раннеры и прогоны — untracked `drafts/_mas-results/spec-040/{t4-cli,t6,t7,t8,t9,t10,t11}/`;
проверка F1 — клоны в `%TEMP%/le040-clean2` и `%TEMP%/t6-head-clone` (вне репо). Коммитов и push прогон
не делал.
