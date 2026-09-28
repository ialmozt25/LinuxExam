# Журнал событий

Одна запись на событие: дата, фаза или спека, что сделано, номера коммитов.

---

## 2026-09-28 | F2 закрыта
F2 (центр) закрыта 5/5. YAML-шапка парсится, 4 блока в дашборде (память/тренды/решения/тревоги), pre-commit hook, sync:check exit 0 без конвергента с F2.2.

## 2026-09-28 | F1 закрыта
F1 (память) закрыта 5/5. Тетради: episodic, semantic, procedural, working, alerts. trends.jsonl, check-episodic.mjs. MEMORY-FACTORY.md и session-log.md в архив. Числа верифицированы (ahead 9→11). Открытый долг: sync.mjs:898/:1150 — устаревший путь, правка в F2.1.

2026-09-28 | F0.1 финал: фиксация налога правила 9
Закоммичены `.project/state.json` + `docs/index.html` как финальный snapshot F0.1 (`96303a2`), затем запись правила 5 в `.project/log.md` (`4fc2ce1`). Диагноз: self-reference `state.head` — структурный, правка `sync.mjs` отложена в F2, третий converge не делался. Дерево tracked чистое, остались только 4 согласованных untracked пути.

2026-09-28 | F0.1 log record (правило 5)
Запись в `.project/log.md`: F0.1 закрыт, налог правила 9 отмечен явно (`ef9ed33`).

2026-09-28 | F0.1 налог правила 9 (одна запись на весь налог)
`sync:check` после `4489de6` дал exit 2 (`.project/STATE.md`, `docs/index.html` — самоссылочный pinned head, `STATE.md:44` вне volatile-маркеров). Три SHA налога: `2ff1306` — первый конвергентный коммит; `b0c9c5f` — конвергентный коммит после записи в log.md (`sync:check` = exit 0); `96303a2` — финальный snapshot, exit 2 принят как постоянный налог. Не дефект исполнителя — постоянная стоимость самоссылочного state.

2026-09-28 | F0.1: план в репо, хвосты закрыты, untracked разобран
Коммит `4489de6` (73 файла, +10 730/−39): `docs/FACTORY-PLAN.md` v2.2 в репо; 12 отчётов `.project/agents/` и 46 черновиков `.project/drafts/` взяты под git; `docs/HANDOFF.md` и `docs/HANDOFF-2026-09-23.md` перенесены в `docs/archive/` через `git mv` (R099/R100, история сохранена), reference-ссылки обновлены в 8 файлах; `docs/dashboard/state.json` не тронут — разбор в F2; оставлены untracked: `.agent-teams/`, `drafts/_mas-results/`, `.backup-tld-20260928-080821/`, `filelists-BaseOS.xml.gz`.

2026-09-28 | Спеки 014 и 010 закрыты формально
Коммит `3a6266a`: spec 014 (`subagent-push-lockdown`) → `done` — правило 11 реализовано коммитом `61787a0`, спека добавлена `49fec29`; spec 010 (`jsdom-smoke-center`) → `rejected` — отменена по факту, подменена контент-батчами 5A/5B/5C, артефакт `docs/__tests__/center-smoke.test.mjs` не создан. Перед этим `5a806d1` — запись авторизованного push 5C (правила 10/11), `2dd251e` — converge после неё.

## 2026-09-28 | F3 закрыта
F3 (настоящий MAS) закрыта. Состав 5/5: F3.1 (recon AgentTeams, dsh-agent-teams 0.1.20 на 3080); F3.0b (спека 022 — блок 6 «Пульс агентов» в sync.mjs, 9718583); F3.2 (live-команда linuxexam-f3-smoke, writer tier-router/smart + qc deepseek-official/deepseek-v4-pro, verdict PASS, c799031 + 71eec57); F3.2b (команда оставлена живой); F3.3 (закрытие). Коммиты F3 до F3.3: 0164610, 8ec92be, 9718583, 6a36cc0, 3331947, c799031, 71eec57. F3.3 добавит I1 и, при необходимости, I2. Открытые долги — alerts.md.

## 2026-09-28 | F4 закрыта
F4 (агенты-хранители) закрыта. Состав: **2 автоматических** — Сверщик (`DSH-Checker`, headless + Task Scheduler 5×/день 09–21 с SHA-skip) и Чистильщик (`DSH-Cleaner`, WED+SUN 09:00); **2 процедурных** — Летописец (проверка `episodic` при закрытии фазы) и Будильник (сводка просрочек при старте сессии), выполняются оркестратором. Watchdog — ежедневно 22:00, следит за активностью Сверщика.
Коммиты F4: `7026310`, `05895a9`, `8bd3288`, `aa5d577` и F4.3 (pending). F4.0 recon (без коммита) · F4.1 · F4.2a-i..iv.
Автоматизация через `dsh --profile headless` (патч профиля headless + junction `dsh-tier-router`). `dsh-cron` и `dsh-sop-agent-teams` отклонены — требуют живой DSH.
Открытые долги — см. `alerts.md`.

## 2026-09-28 | F5 закрыта
F5 (экспорт фабрики) закрыта 4/4 — spec 024, `templates/factory`, `factory:scaffold` + `FACTORY-USAGE`, проверка пустышки.
Состав:
- **F5.0a** — правила 2/13 узаконены; `.gitignore` сужен; долги F4 в alerts (`50f97d5`).
- **F5.0b** — spec 024 (Factory Export, approved) (`86556b5`).
- **F5.1a** — `templates/factory/` собран (33 файла); `sync.mjs` шаблона — урезанная версия (398 строк); `factory:sync-template` (`dfc85c7`).
- **F5.1b** — `factory:scaffold` на `node:fs.cpSync`; 4 сценария; smoke развёрнутого шаблона (`923b427`).
- **F5.2** — `docs/FACTORY-USAGE.md` (114 строк); полный цикл на пустышке (scaffold → install → git init → hook → commit); все 8 плейсхолдеров заменены (`a52b531`).
- **F5.3** — закрытие (этот шаг).

Коммиты F5: `50f97d5`, `86556b5`, `dfc85c7`, `923b427`, `a52b531` и F5.3 (pending).
Проект завершён: **все 6 фаз F0–F5 закрыты.**
Открытые долги — см. `alerts.md`.

## 2026-09-28 | D0 закрыта
D0 (разведка skills и выбор инструмента) закрыта 1/1. Инвентарь: в `~/.agents/skills` — `mas-run` (8 627 B) и `dsh-fix-duplicate-loader-id`; `bootstrap` в `~/.agents` **нет** — он живёт в пресетах (`~/.dsh/.agent-presets/linuxexam-*/skills/`). Механизм установлен документально: провайдер `@deepseek-ai/dsh-skill-filesystem`, 5 корней (проектные `.dsh/skills` и `.agents/skills`, custom `customSkillDirs` пресета, `~/.dsh/skills`, `~/.agents/skills`), bundle `<name>/SKILL.md` или плоский `<name>.md`, nested `**/SKILL.md` намеренно не индексируется. Оркестратор выбран: **`dsh-agent-teams` 0.1.20** — единственный работающий (14 tools, `agent_teams_create`/`status`/`delete`); `dsh-swarm-orchestrator` 0.6.30 FAILED (spawn) и не трогался; `dsh-meta/dag/expert-orchestrator` не установлены, их peer-диапазоны формально не покрывают хост 0.1.5-rc.2. D1 переформулирован: написание skill `spec-to-team`. Recon — read-only, без коммита.

## 2026-09-28 | D1 и D2 закрыты
D1 (написание skill spec-to-team) закрыта 1/1. Создано: preset
linuxexam-orchestrator/skills/spec-to-team/{SKILL.md 6439 B,
roster.yaml 1163 B}. Smoke D1.5: команда spec-026-smoke (4 агента:
architect/builder/tester/reviewer, pro/flash/flash/pro, effort high),
4 задачи completed за 40 с, verdict PASS. Skill активируется через
/spec-to-team без рестарта DSH (chokidar).
D2 (мост чат → DSH) закрыта как выполненная в D1.5.
Evidence: .agent-teams/spec-026-smoke (оставлена, как F3.2).

## 2026-09-28 | spec-027-memory-test
Прогон skill `spec-to-team` по тестовой спеке 027 (type: infra) — проверка S2: запись в память после завершения прогона (правило 12, шаг 8 + evidence 8b). Команда `spec-027-memory-test`: 4 агента (architect/builder/tester/reviewer — pro/flash/flash/pro, effort high), 4 задачи completed по цепочке t1 design → t2 implement → t3 test → t4 review, verdict reviewer = PASS.
Правок в репо прогон не внёс: целевой `.project/scripts/factory-sync-template.mjs` не изменён (blob 55c80283 = HEAD), поэтому эта запись — единственное содержимое, добавленное прогоном.
Evidence: `.agent-teams/spec-027-memory-test` (оставлена как evidence).

## 2026-09-28 | D3 закрыта
D3 (память и контекст) закрыта 1/1. Два дефекта выявлены и устранены:
(1) S2 — skill не писал в episodic; усилен SKILL.md (шаг 8 безусловный,
8b — evidence-check `M docs/memory/episodic.md`). (2) S3 — agent_teams_create
работает один раз на сессию капитана; добавлен п.5 предусловий
(TEAM-ALREADY-ACTIVE). Проверено прогоном spec-027-memory-test в новой
DSH-сессии: 4 агента, 4 задачи completed, reviewer PASS, запись в
episodic появилась, шаг 8b прошёл с первой попытки.
Коммиты D3: 6fe81fd, dcca5e4.
Evidence: .agent-teams/spec-027-memory-test (оставлена).

## 2026-09-28 | spec-028-hide-alerts
Прогон skill `spec-to-team` по спеке 028 (type: infra, approved) — первая **реальная** задача skill'а после smoke-серий. Команда `spec-028-hide-alerts`: 4 агента (architect/builder/tester/reviewer — pro/flash/flash/pro, effort high), 4 задачи completed по цепочке t1 design → t2 implement → t3 test → t4 review, verdict reviewer = PASS.
Что сделано: `.project/sync.mjs` — секция «Тревоги» (`renderCenter`) свёрнута в `<details class="alerts" id="alerts">` + `<summary>Тревоги · записей: N</summary>`; `id="alerts"` и класс `.alerts` сохранены, CSS добавлен точечно (`details.alerts`); производный `docs/index.html` регенерирован `npm run sync`; 15 записей alerts не потеряны.
Гейты: `npm run sync` exit 0 (идемпотентно), `check:episodic` exit 0 (OK F0–F5, D0–D3); `sync:check` → exit 2 «изменены и не закоммичены» — корректный предкоммитный результат (правило 9, converge отдельным коммитом).
Evidence: `.agent-teams/spec-028-hide-alerts` (оставлена как evidence). D4 остаётся `pending`: это прогон-тест, закрытие фазы — отдельный шаг D4-close.

## 2026-09-28 | D4 закрыта
D4 (финальный тест и доработка) закрыта 1/1. Реальный прогон skill
spec-to-team на спеке 028-hide-alerts-details (type: infra). 4 агента
(architect/builder/tester/reviewer), 4 задачи completed за ~40 с,
reviewer verdict = PASS. Skill реально изменил .project/sync.mjs:
section.alerts → details.alerts + summary.
Коммиты D4: d453e5b (задача), cdc15dd (converge).
Evidence: .agent-teams/spec-028-hide-alerts.
**Все фазы DEV-PLAN закрыты (D0–D4).**

## 2026-09-28 | C0 закрыта
C0 (recon текущего центра) закрыта 1/1. Отчёт: docs/C0-CENTER-AUDIT.md (332 строки, коммит 0074d35). 18 секций: 3 KEEP, 3 HUMANIZE, 3 COLLAPSE, 10 DELETE. 4 дубликата (log.md показан дважды; план — двумя блоками). 7 багов sync.mjs (критический — wall-clock «свежий draft» без VOLATILE). Жаргон — в alerts.md и log.md. Инициатива C — отдельный трек; C1 (дизайн) начат сразу за C0, запись о C0 отложена и закрыта долгом памяти при C1.

<!-- meta updated: 2026-09-28T21:46:00Z entries_count: 16 -->
