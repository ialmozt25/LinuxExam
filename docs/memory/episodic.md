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

## 2026-09-28 | C1 закрыта
C1 (дизайн нового центра) закрыта 1/1. Spec 029-center-redesign approved: три уровня (Пульс / Дела / Справочник), 10 DELETE, 3 COLLAPSE, 3 HUMANIZE, 3 KEEP. 18 секций раскрыты, 4 дубликата зафиксированы, 7 багов sync.mjs (критический — wall-clock «свежий draft») — в C2. Коммиты C1: ac08fc7 + C1-close. C-PLAN v1.1: старт C2.

## 2026-09-29 | spec-030-rhcsa-objectives-diff
Прогон AgentTeams (team `spec-030`, роли writer + qc, 3 задачи): t1 — список устаревших id по банку 224 вопроса / 14 тем → 2 id (`fp_002` — удалённый objective set-GID; `sec_007` — устаревшее `firewall` вместо `firewalld`); t2 — приоритизированный план: delete 1 / rewrite 1 / add 2 (Flatpak в `manage_software`); t3 — независимое adversarial QC-ревью, verdict PASS. Верифицированные нули (правок не требуют): containers, MBR, SELinux-нарушения, superuser→privileged, RHN→CDN, at+cron→timer units, boolean, vfat/xfs, multiuser.
Файлы: репозиторий не изменялся (`src/data/**` — read-only); evidence — `.agent-teams/spec-030`. Гейты до старта прогона: typecheck 0, test:run 0, sync:check 0.
Дальше: approve капитана — правки банка (delete `fp_002`, rewrite `sec_007`, add 2 вопроса Flatpak) и интеграция id-списка/плана в спеку 030. Расхождения со спекой: set-GID фактически в `file_permissions` (спека приписывала `file_systems`), устаревшая лексика — в `security`/`sec_007` (спека приписывала `networking`).

## 2026-09-29 | spec-031-rhcsa-bank-fixes
Прогон AgentTeams (team `spec-031-rhcsa-bank-fixes`, роли writer + qc, 7 задач) исполнен по спеке 031 (approved, HEAD `194db93`): t1 — delete `fp_002` (`file_permissions` 20→19; objective set-GID удалён из RHCSA RHEL 10); t2 — rewrite `sec_007` (`firewall` → `firewalld` в двух вариантах ответа, `_meta.verified_rhel="10"`, `verified_at="2026-09-29T00:00:00Z"`, ключ `flags` удалён); t3 — add `msw_015`/`msw_016` (Flatpak: `Configure access to Flatpak repositories`, `Install and remove Flatpak software packages`; схема 8 полей без `_meta`, `objective_domain="6"`, canonical `targetOrder(q,0)`; cosine на кандидатах `rejected 0/2`, haladyna auto 5/5); t4 — `_order.json` одной транзакцией (224→225, `fp_002` вырезан, хвост `msw_015`,`msw_016`, позиции остальных 223 id сохранены); t5 — `_topics.json` sync (total 225, `manage_software` 16, `file_permissions` 19); t6 — P14 doc: §«Соответствие банка» spec 030 приведена к факту (8 статусов тем, 2 id закрыты, Flatpak-пробел закрыт; префикс/суффикс побайтово идентичны HEAD).
Файлы: `src/data/questions/{file_permissions,security,manage_software,_order,_topics}.json` + `.project/specs/030-rhcsa-objectives-diff.md` (88 insertions / 56 deletions, 6 файлов). Гейты (перезапущены и QC, и капитаном): `shuffle-bank:check` 0 (`manage_software` [5,2,2,7], BANK 225 [66,51,47,61]), `test:run` 0 (27 файлов / 177 тестов), `qc` 0 (`Total 225, Fails 0, Warns 22` = baseline), `manifest` 0 (`OK: 225 questions, 14 topics`), `typecheck` 0, `build` 0, `consistency:check` 0. QC (t7, ratification by re-execution) — **verdict PASS**; неблокирующие findings: QC-1 (medium — `e2e/quiz-flow.spec.ts` сидирует удалённый `fp_002`, вне scope spec 031) и QC-2 (low — `sync:check` ожидаемо красный до интеграционного `npm run sync`).
Дальше: approve капитана (правило 6, type=content — коммитов в прогоне нет), затем интеграционный шаг `npm run sync` → коммит задачи → `chore(state): converge` → `sync:check` = 0; отдельным follow-up — правка фикстур `e2e/quiz-flow.spec.ts`. Evidence — `.agent-teams/spec-031-rhcsa-bank-fixes`.

## 2026-09-30 | spec-032-mas-autonomy-a
Прогон AgentTeams по спеке 032 (type: infra, approved) — 4 агента (builder×3 flash + reviewer pro, effort high), DAG t1–t3 параллельно (непересекающиеся скоупы записи) → t4 независимое ревью; verdict reviewer = **PASS**, все 3 долга закрыты по существу («код + повторный прогон», не по отчётам исполнителей).
Что сделано: **t1** — `tools/order-manifest.mjs`, единственный CLI-писатель `src/data/questions/_order.json` (`--add`/`--remove`/`--check`) + `npm run order:add`/`order:remove`/`order:check`; добавление детерминировано (append, правило в шапке файла), повторный `--add` → no-op + WARN, `--check` read-only, round-trip SHA256 `_order.json` до==после, 21 тест. **t2** — причина EPERM `agent_teams_delete` воспроизведена в `%TEMP%` (rename каталога при открытом дескрипторе ниже пути без `FILE_SHARE_DELETE`; плагин ждёт 3×50 мс и сдаётся раньше освобождения) и закрыта хелпером `.project/scripts/archive-team.mjs` (backoff-окно, idempotent, exit 3 = дескриптор держится) + процедура в `procedural.md`. **t3** — `.project/sync.mjs` пересчитывает `goal.current_questions`/`progress_percent` из банка на каждом прогоне (`readBankTotal()`, вариант B), устаревшее значение поля приоритета не имеет; negative test 224/74.7 → 225/75.
Файлы: `tools/order-manifest.mjs`, `tools/__tests__/order-manifest.test.mjs`, `.project/scripts/archive-team.mjs`, `.project/sync.mjs`, `tools/gen-state.mjs` (комментарий контракта владения), `package.json`, `docs/memory/procedural.md`, `docs/memory/alerts.md` (3 долга закрыты) + производные `npm run sync`.
Гейты: `typecheck` 0, `test:run` 0 (28 файлов / 198 тестов), `qc` 0 (225 / Fails 0 / Warns 22 — baseline), `manifest` 0, `consistency:check` 0, `sync:check` 0 после converge-коммита. Коммиты прогона — см. `git log` (SHA пишется после коммита).
Evidence: `.agent-teams/spec-032-mas-autonomy-a`.

## 2026-09-30 | spec-033a-mas-autonomy-spike
Прогон AgentTeams по спеке 033a (type: infra, approved) — 2 агента (builder flash + reviewer pro, effort high), DAG последовательный: t0 spike → t1 `run-spec.mjs` → t2 `templates/mas` → t3 независимое ревью (`kind=review`, `reviewedTaskId` = задача t1, round 1); verdict reviewer = **PASS** (ratification by re-execution: все 7 критериев подтверждены собственными прогонами ревьюера, не evidence исполнителя).
Что сделано: **t0** — отчёт `.project/scripts/RUN-SPEC-SPIKE.md` (325 строк), вердикт `PATH: H2`. H1 (HTTP API `:3080`) отклонён: `/`, `/api`, `/api/remote.mux`, `/plugins/dsh-agent-teams/*` → 401, browser-session cookie минтится только `GET /?token=<launch token>` (токен per-process печатает `dsh web`, в env и `~/.dsh/logs` его нет), маршрута создания команды в API нет. H4 (импорт lib-плагина из Node) отклонён: `registerAgentTeamsTools({}, …)` → TypeError, нужен живой Cordis `Context` + `Agent`. H3 (прямая запись `team.json`) — только read-канал: в плагине нет `chokidar`/`fs.watch`/`watchFile`, живой процесс DSH внешнюю запись не замечает. H2 — рабочий путь: one-shot `dsh --profile <p> "/agent-teams <цель>"` (headless; gesture-boundary плагина) + вариант C (stdio JSON-RPC `dsh --profile sdk`). Честная оговорка спайка: детерминированного вызова `agent_teams_create` нет ни по одной гипотезе — во всех рабочих вариантах в контуре LLM. **t1** — `.project/scripts/run-spec.mjs` (999 строк, Node ESM, zero новых зависимостей) + `npm run spec:run`: спека → детерминированная задача → preflight H2 (dsh CLI / каталог профиля / резолв `@nanmicoder/dsh-agent-teams` / workspace / каталог состояния) → spawn one-shot → сбор отчёта с диска (`team.json` + `inbox/*.jsonl`) → атомарная дозапись `{spec,startedAt,finishedAt,status,report}` в `.project/mas-runs.json`; коды 0/1/2/3, где 3 = precondition-missing с точными fix-командами; dry-run не запускает команду и не пишет историю. **t2** — `templates/mas/TASK.md` (108 строк) + `templates/mas/SESSION.md` (79 строк); ODAF расшифрован решением исполнителя (O=Objective, D=Deliverables, A=Acceptance, F=Forbidden + E=Evidence как обязательный раздел вне акронима) — канона ODAF в репозитории нет, это зафиксировано в шапке шаблона; стадия stage-templates копирует оба шаблона в `.agent-teams/<teamId>/` (sha256 + побайтовая проверка, идемпотентно, при отсутствии шаблона — exit 1 до запуска прогона).
Ограничение прогона (решение капитана, до старта ревью контракт t3 был amended): живой end-to-end MAS-прогон (`status=ok`) **не исполнялся** — требует разовой установки профиля `mas` (`dsh --profile mas --from-default-profile headless` + `dsh plugin --profile mas add @nanmicoder/dsh-agent-teams` = pnpm-установка вне репозитория, сеть) и расхода LLM-токенов, то есть мутации окружения без явной авторизации (AGENTS.md: «не устанавливать зависимости без явного запроса»). Интеграционный тест переведён в детерминированную форму (dry-run + fixture-прогон `013` → exit 3 + валидная запись истории); живой прогон — follow-up для 033b под авторизацию капитана. Неблокирующее наблюдение ревьюера для 033b: `stageTemplates` выполняется до гейта preflight (run-spec.mjs:742 против :773), поэтому реальный прогон без профиля оставляет копии шаблонов в `.agent-teams/<teamId>/` (команда при этом не создаётся) — рассмотреть гейт staging на `pre.ok`.
Файлы: `.project/scripts/run-spec.mjs`, `.project/scripts/RUN-SPEC-SPIKE.md`, `.project/mas-runs.json`, `templates/mas/TASK.md`, `templates/mas/SESSION.md`, `package.json` (+`spec:run`). Гейты: `typecheck` 0, `build` 0, `test:run` 0 (28 файлов / 198 тестов), `consistency:check` 0, `sync:check` 0 после converge-коммита. Коммиты прогона — см. `git log` (SHA пишется после коммита). Evidence: `.agent-teams/spec-033a-mas-autonomy-spike`.

## 2026-09-30 | spec-034-mas-autonomy-b
Прогон AgentTeams по спеке 034 (type: infra, approved) — 5 ролей (builder ×4 на `deepseek-official/deepseek-v4-flash`, reviewer на `deepseek-official/deepseek-v4-pro`, effort high), DAG: t1 (spec-gate) ∥ t2 (report-run) ∥ t3 (committer) → t4 (метрики, deps t1) → t5 (Step 0, deps t4); ревью t6 (round 1, verdict **PASS**, 2 LOW-finding) → найденный лидом на интеграции дефект → repair t7 → ревью t8 (round 2, verdict **PASS**, findings нет). Авто-выжимка прогона: 8 задач, completed 7 · failed 1; длительность 5462692 мс; verdict `pass` (ревью-задача t8).
Что сделано: **t1** — R5 SPEC-COMMIT в `.project/scripts/check-consistency.mjs` (+216 строк): для спеки `done` каждая completed-задача из листа `.agent-teams/**/team.json` (рекурсивно, `archive/**` включён; сопоставление `spec-<label>` ↔ frontmatter id, покрыт случай `033a` при `id: 033`) требует ≥1 коммита с `spec-<label>` + `\btN\b` в subject (`git log --all`); whitelist с reason (cancelled + legacy 032/033a — прогоны до появления гейта) и валидатором reason → exit 2; blanket-skip нет; гейт живёт внутри `sync:check` (через существующий `consistency:check`). Невакуумность доказана fixture-прогонами (`--root`): кейс без коммита → `[R5]` + exit 1, с коммитом → 0 findings. **t2** — `.project/scripts/report-run.mjs` (team.json → выжимка: verdict/durationMs/задачи/ревью-задачи, no-op при отсутствии команды, `--json` read-only) + блок «Последний MAS-прогон» в центре; рендер добавлен в `.project/sync.mjs` (+143 строки, 3 аддитивных хунка, check-путь остался READ-ONLY), потому что `docs/index.html` — производный файл и прямая запись стирается `sync` (спека разрешает правку «через sync»). **t3** — `.project/scripts/committer.mjs` (729 строк): `--allowed` явные пути, проверка staged-set ⊆ allowed ДО коммита, `--dry-run`, коды 0/1/2/3; нарушение → exit 3 без коммита и без чистки чужого индекса; реальные коммиты доказаны в одноразовых репо `%TEMP%`. **t4** — `.project/scripts/runs-log.mjs` (742 строки) + `npm run runs:log`: идемпотентная (ключ `teamId`, фолбэк `spec|startedAt`) атомарная дозапись записи прогона в `.project/mas-runs.json`; схема расширена ЧЕТЫРЬМЯ опциональными полями (`teamId`, `durationMs`, `tokens`, `verdict`), `version` сознательно не тронут — `run-spec.mjs:647` (артефакт 033a, не правится) жёстко пишет 1, поэтому version не может быть маркером схемы. **t5 (Step 0) — FAILED/STOP (честный, не замаскирован)**: профиль `mas` создан (`dsh --profile mas --from-default-profile headless`), установлены `@nanmicoder/dsh-agent-teams ^0.1.21` (в рамках Step 0) и — по отдельной авторизации капитана — `dsh-tier-router ^0.6.0`; preflight стал полностью зелёным (исход `precondition-missing` из 033a исчез, dry-run ok), но живой smoke падает на отсутствии ключа: `ROUTE_FAILED … llm-deepseek: no API key for provider route "deepseek-official"` (в credential-сторе `$DSH_HOME/.credentials.yaml` ключа DeepSeek нет; ключ через чат не передаётся — security policy). Решение капитана (вариант B, 2026-09-30): t0 = precondition-missing/follow-up, критерий приёмки 1 спеки 034 **не выполнен**, прогон закрыт как **PARTIAL** (6/7 критериев), Step 0 не переоткрывать. Отчёт Step 0 — `.project/scripts/RUN-SPEC-LIVE.md` (22867 Б: RECON, установка, preflight, дословный stderr обеих попыток, STOP + fix-команды).
Дефект, найденный лидом на интеграции (не поймал ни исполнитель, ни ревью раунда 1 — все доказательства снимались с явным `--history` на копиях): в `runs-log.mjs` хелпер `rel` был УНАРНЫМ (`(p) => path.join(ROOT, p)`), поэтому `rel('.project','mas-runs.json')` отбрасывал второй аргумент и `DEFAULT_HISTORY_PATH` указывал на каталог `.project` → `npm run runs:log -- <teamId>` падал `EISDIR` (exit 1), то есть критерий 5 спеки в буквальной форме не выполнялся. Repair t7 (вариадический `rel`, правка 5 строк) + ревью t8 — **pass**; после этого реальный вызов `npm run runs:log -- spec-034-mas-autonomy-b` дал запись №7 (verdict `pass`, durationMs 5462692; задачи completed 7 · failed 1).
Файлы: `.project/scripts/{check-consistency,report-run,committer,runs-log}.mjs`, `.project/sync.mjs`, `.project/mas-runs.json`, `package.json` (+`runs:log`), `.project/scripts/RUN-SPEC-LIVE.md`, производные `npm run sync` (`docs/index.html`, `.project/{state.json,STATE.md,SPEC.md}`), `docs/memory/episodic.md` (+ rule-12 запись; пишется идемпотентно по заголовку), `docs/memory/working.md`.
Гейты (перепроверены лидом на интеграции): `typecheck` 0, `test:run` 0 (28 файлов / 198 тестов), `consistency:check` 0; `sync:check` — **2 в живом прогоне** (ожидаемо: не-volatile секция «Пульс агентов» считается по `.agent-teams/*/team.json`, `sync.mjs:968-1066` — урок 033a подтверждён кодом) и **0 после архивации команды + converge-коммита**.
Отклонения/трактовки: (а) рендер блока — в `sync.mjs`, а не в `docs/index.html` (иначе drift и красный гейт); (б) `--json` у `report-run.mjs` read-only, чтобы verify-команда не портила out-of-scope `episodic.md`; (в) реальные git-коммиты прогона — за лидом (правило 11 не нарушалось: члены команды не коммитили и не пушили); (г) хук `.githooks/pre-commit` существует (`core.hooksPath=.githooks`) и коммиты НЕ блокирует (любой исход кроме ошибки запуска → exit 0); в отчётах t3 и ревьюера он назван отсутствующим — проверялся только `.git/hooks/` (неблокирующая неточность, LOW). Evidence: `.agent-teams/spec-034-mas-autonomy-b` (после архивации — `.agent-teams/archive/spec-034-mas-autonomy-b`). Коммиты прогона — см. `git log` (SHA пишется после коммита).

## 2026-09-30 | spec-034-t0-closed
Живой smoke `run-spec.mjs 013 --workspace . --timeout-ms 600000` — exit 0, 105716 ms; team.json создан в .agent-teams/spec-013-local-aliases (staged, 3 члена, 3 задачи); RUN-SPEC-LIVE.md создан. Step 0 закрыт вручную капитаном (DEEPSEEK_API_KEY в env). Spec 034 → done (PASS 7/7). Команда spec-013-local-aliases архивирована. Дальше: spec 035 — fix spec-resolution в run-spec.mjs.

## 2026-09-30 | spec-035-run-spec-workspace-fix
Прогон AgentTeams по спеке 035 (type: infra, approved) — 3 агента (builder + builder2 на `deepseek-official/deepseek-v4-flash`, reviewer на `deepseek-official/deepseek-v4-pro`, effort high), DAG: t1 (fix `run-spec.mjs`) ∥ t2 (восстановление STOP-нарратива) → t3 (review round 1, `kind=review`, `reviewedTaskId`=t1); verdict reviewer = **PASS** (ratification by re-execution: все критерии подтверждены собственными живыми прогонами ревьюера, findings нет).
Что сделано: **t1** — `.project/scripts/run-spec.mjs` (+111/−4), вариант A: новая `materializeSpec()` + `WORKSPACE_SPECS_DIR` материализует файл спеки в `<workspace>/.project/specs/<file>.md` перед реальным прогоном, а в `/agent-teams`-промпт идёт `.project/specs/<file>.md` — путь, существующий относительно cwd вложенного агента (= `--workspace`); дефект spec-resolution (spec 033a/034: nested-агент искал спеку в `<workspace>/…` → «не найдена» → `agent_teams_create` не вызывался → `collect: failed`, exit 1) закрыт. При workspace = корень репо копирование пропускается (target == source), taskText не меняется; в `--dry-run` записи нет. `--live` — алиас не-dry-run (`parseArgs` + USAGE + шапка), одиночный `--dry-run` остаётся dry-run; коды выхода (0/1/2/3), формат отчёта и `package.json` не тронуты. **t2** — `.project/scripts/RUN-SPEC-SPIKE-STOP.md` (22867 Б) = дословная копия оригинала `6b06d73:.project/scripts/RUN-SPEC-LIVE.md` (`git hash-object` = `f3bb4cdac3e7ede6058fa87827fa94a5a1fcfc63`; 260 строк, LF, без BOM); текущий `RUN-SPEC-LIVE.md` (30 строк, success, `a520e7c5…`) не изменён — регрессии нет.
Файлы: `.project/scripts/run-spec.mjs`, `.project/scripts/RUN-SPEC-SPIKE-STOP.md` (новый), `.project/mas-runs.json` (штатный history-append живых прогонов: 2 env-failed probe + 3 ok). Гейты (перепроверены лидом на интеграции): `typecheck` 0, `test:run` 0 (28 файлов / 198 тестов), `sync:check` 0 после архивации команды. Живые доказательства: (1) без `--workspace` из `%TEMP%` → exit 0, `collect: ok`, `team.json` phase=staged (174940 мс); (2) `--live --workspace %TEMP%\rs035-review-c2ws` из каталога вне репо → exit 0, `collect: ok`, `team.json` в temp-workspace (108595 мс), материализованная спека байт-в-байт = источнику. Env-оговорка (LOW, воспроизведена и builder'ом, и ревьюером): `DEEPSEEK_API_KEY` — User-level переменная и не наследуется harness-процессом, поэтому живой прогон требует `$env:DEEPSEEK_API_KEY = [Environment]::GetEnvironmentVariable('DEEPSEEK_API_KEY','User')`; без неё ложный `ROUTE_FAILED … no API key for provider route "deepseek-official"` (прямой `dsh --profile mas "…"` падает так же — это окружение, не фикс). Неблокирующее наблюдение: `materializeSpec` (как и `stageTemplates`, урок 033a) выполняется до гейта preflight, поэтому реальный прогон без профиля оставит копию спеки в `<workspace>/.project/specs/`. Evidence: `.agent-teams/spec-035-run-spec-workspace-fix` (после архивации — `.agent-teams/archive/…`). Коммиты прогона — см. `git log` (SHA пишется после коммита).

<!-- meta updated: 2026-09-30T04:47:17Z entries_count: 24 -->
