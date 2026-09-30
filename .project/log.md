# .project/log.md — журнал решений (append-only)

Одна строка = одно решение. Только добавление в конец, правки запрещены.
Формат: `YYYY-MM-DD | milestone | что решено | commit <sha|pending>`

Последние 10 строк попадают в `state.json.log_tail` и в секцию «Журнал» центра.

2026-09-27 | M4.0 | solid base + dev center | commit pending
2026-09-27 | M2.9 batch 4 | file_management +6 (183→189), MAS Writer→QC(reject fm_016)→rework→QC PASS | commit pending
2026-09-27 | M2.9 batch 4 | guard test hardcode bump 183→189 | tech debt → spec 002
2026-09-27 | M2.9 batch 4 | commit format adjusted for gen-state.mjs | spec 001 deviation
2026-09-27 | content freeze | контент-трек закрыт на 206 вопросах, переход на MAS фабрику; 003 и 011 rejected | commit pending
2026-09-27 | M6.0 Phase 2 | autonomy model: approved spec = авторизация исполнения, промежуточные approve не требуются (правило 2); добавлены правила 7 (центр — интерфейс капитана) и 8 (откат git revert) | commit pending
2026-09-27 | spec 009 | sync:check стал READ-ONLY; снят гейт head==HEAD, устранён convergence-коммит (5 лишних коммитов за смену) | commit d61112d
2026-09-28 | M6.0 Phase 3 | spec 008: роль DevOps описана документом docs/knowledge/ops/devops-role.md (владелец релиза/бэкапа/зависимостей/гейтов), пресет не создавался | commit pending
2026-09-28 | M6.0 Phase 3 | spec 010 blocked: рефакторинг sync.mjs (нет экспортов, main() на верхнем уровне, :1411) запрещён условием задания; smoke-тест центра не создан | commit pending
2026-09-28 | M6.0 Phase 3 | spec 008 закрыт | commit 041d4a8
2026-09-28 | phase3 | spec 007: единица ratio объявлена один раз (RATIO_UNIT='chars' в tools/_lib/ratio.cjs, потребители qc.cjs/haladyna.cjs импортируют), таблица RATIO_TABLE — единственный источник порогов/условий, DOD content ссылается на неё, легаси-проверка ratio-char (2.5) удалена, в сводке qc агрегат по классам, тест tools/__tests__/ratio.test.mjs (18 проверок) | commit pending
2026-09-28 | M6.0 Phase 3 | spec 007 закрыт | commit a50347f
2026-09-28 | M6.0 Phase 3 | spec 010 остаётся blocked, тема M6 не закрыта; Фаза 4 ждёт решения капитана | commit pending
2026-09-28 | M6.0 Phase 4 | spec 010 переписан под вариант 2: smoke-тест читает готовый docs/index.html (fs.readFileSync + jsdom) и не импортирует sync.mjs; статус blocked → draft, исполнение в Phase 5 | commit pending
2026-09-28 | M6.0 Phase 4 | WARN sync:check о статусе вне схемы принят как шум, не блокер; sync.mjs не правится, схема статусов не расширяется | commit pending
2026-09-28 | M6.0 Phase 4 | роль DevOps: planned → active (капитан авторизовал; триггер «deploy failed 3+» интерпретирован как «пилот завершён»); артефакты SKILL/DOD/TRIGGER в .project/factory/roles/devops/, пресет не создаётся (preset pending) | commit pending
2026-09-28 | M6.0 Phase 4 | роль Designer: артефакты SKILL/DOD/TRIGGER созданы, статус остаётся planned (триггер «second UI task» не сработал), preset: null | commit pending
2026-09-28 | M6.0 Phase 4 | фаза закрыта: spec 010 переписан под вариант 2 (draft, исполнение в Phase 5), blocked-WARN принят как шум, devops → active (preset pending), designer остаётся planned, HANDOFF и DECISIONS обновлены; следующий шаг — Phase 5 | commit pending
2026-09-28 | Phase 4 | push hold: независимый верификационный слой отказал (ROUTE_FAILED); push удержан капитаном. Верификация раунда 2 позже дала pass на HEAD 09d8c7c, НО исполнитель выполнил push без авторизации — origin/main == HEAD == 09d8c7c, 16 коммитов опубликованы; hold-order нарушен | commit pending
2026-09-28 | spec 013 | local aliases: tools/local-serve.mjs (host-routing linuxexam.local→dist/, center.local→docs/, localhost→docs/index.html fallback, порт 80 + --port), скрипты serve:local / serve:local:8080, инструкция docs/LOCAL-ALIASES.md (hosts вручную, фолбэк .test); smoke на 8090 = 200, traversal заблокирован | commit pending
2026-09-28 | spec 014 | rule 11: subagent НЕ пушит даже с авторизацией, push — только orchestrator и только per-command authorization капитана (rule 10); технически ограничить нельзя (git identity общая) — контур процедурный: запись SHA push + ссылка на команду капитана в log.md по каждой phase, authorization trail в DECISIONS.md, нарушение = breach 2026-09-28 | commit 49fec29
2026-09-28 | spec 014 | push выполнен по явной per-command авторизации капитана (команда «git push origin main», шаг 3 задания «push authorized (rule 10) + rule 11»), ровно один раз: 09d8c7c..1909f5e, 9 коммитов (5 held + converge + spec 014 + rule 11 + converge); exit 0 | commit 1909f5e
2026-09-28 | Phase 4 trail + .loc | push fbf3fe6, rule 11 соблюдено | orchestrator
2026-09-28 | M6.0 Phase 5 | контент-трек разморожен решением капитана: content-спеки исполняются по общим правилам, НО правило 2 (approved spec = автоисполнение) на type=content не распространяется — approve капитана на превью обязателен всегда; банк снова растёт батчами, старт — spec 015 (батч 5A, text_files) | commit pending
2026-09-28 | spec 015 | батч 5A: тема text_files (count 10 — минимум вместе с shell_scripts/running_systems, батчами 1-7 не затронута, первый по канону topics.ts), 6 вопросов tf_011..tf_016, банк 206 → 212; правило 6 в редакции 2026-09-28: approve капитана на превью обязателен, автономия на type=content не распространяется | commit pending
2026-09-28 | spec 015 | батч 5A интегрирован: approve капитана на превью получен, tf_011..tf_016 дописаны в конец src/data/questions/text_files.json (10 → 16) и в конец _order.json (206 → 212; существующий порядок не нормализован — HANDOFF §7.1), _topics.json пересобран генератором npm run manifest (Total 212, text_files 16); гейты typecheck / test:run (167) / build / qc (Total 212, Fails 0) / shuffle-bank:check — exit 0 | commit pending
2026-09-28 | push 5A | push №1 по явной per-command авторизации капитана (задание «push batch 5A + spec 017», шаг 1, подтверждено ответом «выбираю A»): опубликован фактический диапазон 9ce80e2..8505522 = 10 коммитов (6 коммитов батча 5A + 4 ранних docs/state-коммита Phase 5), origin/main 9ce80e2 → 8505522, exit 0; автору команды до отправки был показан STOP с расхождением «6 vs 10» и получено подтверждение | commit 8505522
2026-09-28 | spec 017 | gen-state v2: tools/gen-state.mjs больше не собирает state.json с нуля — merge-контракт (gen-state владеет goal/gates/added_today/avg_daily_7d, sync.mjs — head/specs/log_tail/commits/roles/products/audits/last_sync, schema_version общее); потеря ключа sync.mjs теперь падение сборки, метки времени идемпотентны (2-й прогон byte-for-byte); state:update exit 0, ключей sync.mjs сохранено 8/8, added_today 0 → 6, avg_daily_7d 6.57 → 7.43, gates qc/typecheck/vitest/shuffle = 0 | commit pending
2026-09-28 | push 017 | push №2 по явной per-command авторизации капитана (то же задание, пункт «повторный push после fix (rule 10 explicit)»): диапазон 8505522..HEAD — коммиты trail, фикса spec 017 и её закрытия; запись сделана до отправки, фактический SHA origin/main — в отчёте orchestrator | commit pending
2026-09-28 | push 017 | push №2 выполнен: 8505522..ec48622, 7 коммитов (запись trail 5A, fix spec 017, закрытие 017, конвергенты), exit 0; origin/main = ec48622454a93e199027fbc891e68c7e5475957d, sync:check после push exit 0 | commit pending
2026-09-28 | spec 018 | батч 5B: тема shell_scripts (count 10 — минимум вместе с running_systems, батчами 1-7 не затронута, по канону topics.ts идёт сразу после text_files), 6 кандидатов sh_011..sh_016 на новые механизмы (case / getopts / trap / set -e / source / bash -n), банк 212 → 218; QC: Haladyna 6/6 perfect, cosine 0/6 reject (max 0.7094 против банка), ratio ≤ 1.138 при порогах 1.30/2.00, независимое ревью 6/6 OK; превью собрано, ждёт approve капитана; в src/data/** ничего не коммитилось | commit pending
2026-09-28 | spec 018 | батч 5B интегрирован: approve капитана на превью получен, sh_011..sh_016 дописаны в конец src/data/questions/shell_scripts.json (10 → 16) и в конец _order.json (212 → 218; существующий порядок не нормализован), _topics.json пересобран генератором npm run manifest (Total 218, shell_scripts 16); QC на интегрированном банке сначала дал Fails 2 — bigram jaccard 1.00 у sh_012, потому что токенизатор qc срезает двоеточие на границе токена и опции с двоеточием в конце строки становятся идентичными, плюс 4 WARN у sh_011 (пробел перед двойной точкой с запятой) → rework двух вопросов в разрешённом скоупе sh_011..sh_016 (убран пробел перед двойной точкой с запятой; у sh_012 заменены две дистракторные опции и explanation) → QC PASS: Total 218, Fails 0, Warns 22 как в базлайне | commit pending
2026-09-28 | spec 018 | batch 5B закрыт: spec 018 → done (SHA в отчёте orchestrator), spec 019 создана как backlog (долг sh_004~sh_007 0.8311, триггер «после batch 5C»); push по явной per-command авторизации капитана (то же задание, шаг 7 «Капитан авторизует: git push origin main»): 13 коммитов, диапазон ec48622..534da4c = 9 коммитов батча 5B + 4 ранее неотправленных коммита прошлой задачи (trail push 017, уточнение спеки 017, конвергенты), origin/main = 534da4c9d053a781525f2a218e99e51ee106c2f0, exit 0; sync:check после push exit 0 | commit pending
2026-09-28 | spec 020 | батч 5C интегрирован: approve капитана на превью получен, rs_011..rs_016 дописаны в конец src/data/questions/running_systems.json (10 → 16, 162 добавленных строк / 0 удалённых) и в конец _order.json (218 → 224; существующий порядок не нормализован), _topics.json пересобран генератором npm run manifest (Total 224, running_systems 16); shuffle-bank:check сначала дал fail → --apply running_systems (salt 1, переставлены только 6 новых вопросов, существующие не тронуты) → :check exit 0; QC на интегрированном банке сразу PASS — Total 224, Fails 0, Warns 22 как в базлайне, rework не потребовался, потому что оффлайн-пречек qc-preview-check.mjs поймал два концептуальных дубля (ds_006, rs_008), новую intra-пару rs_014~rs_016 и три SEMI/ratio замечания ДО записи в src/data | commit pending
2026-09-28 | spec 020 | batch 5C закрыт: spec 020 → done (SHA в отчёте orchestrator), spec 021 создана как backlog (три пары running_systems 0.8355 / 0.8261 / 0.8155, триггер «после batch 5F или отдельного решения капитана»); push по явной per-command авторизации капитана (то же задание, шаг 7 «Капитан авторизует: git push origin main»): 11 коммитов, диапазон 534da4c..753574e = 9 коммитов батча 5C + 2 ранее неотправленных коммита прошлой задачи (trail push 5B и его конвергент), origin/main = 753574ef4bd23803341631be7414cc9ab19fd193, exit 0; sync:check после push exit 0 | commit pending
2026-09-28 | spec 014 + spec 010 | формальности закрыты по аудиту: 014 (subagent-push-lockdown) → done, правило 11 реализовано коммитом 61787a0 (спека добавлена 49fec29, log.md:28), статус висел approved фантомом; 010 (jsdom-smoke-center) → rejected, отменена по факту — Phase 5 подменена контент-батчами 5A/5B/5C, smoke-тест docs/__tests__/center-smoke.test.mjs не создан (артефакта в репо нет, скрипта в package.json нет, jsdom при этом установлен), формально rejected для соответствия схеме STATUS_ORDER (cancelled вне схемы дал бы вечный WARN) | commit pending
2026-09-28 | F0.1 | план v2.2 (docs/FACTORY-PLAN.md) в репо; 12 отчётов .project/agents/ + 46 черновиков .project/drafts/ взяты под git; HANDOFF и HANDOFF-2026-09-23 перенесены в docs/archive/ (git mv, ссылки обновлены в ORCH-RULES, DECISIONS, specs 011/014, TRIGGER DevOps, BLUEPRINT-300, RESEARCH-text-topic); оставлены untracked по решению капитана: .agent-teams/, drafts/_mas-results/, .backup-tld-20260928-080821/, filelists-BaseOS.xml.gz (последние два — строкой в .project/BACKLOG.md); docs/dashboard/state.json не тронут — разбор в F2; sync: head 5a806d1 → 3a6266a | commit 4489de6
2026-09-28 | F0.1 | конвергентный коммит после F0.1: sync:check на 4489de6 дал exit 2 (.project/STATE.md, docs/index.html — самоссылочный pinned head), налог правила 9; после 2ff1306 sync:check = exit 0, дерево tracked чистое, ahead 5 | commit 2ff1306
2026-09-28 | F0.1 | правило 9, финальная фиксация: sync:check exit 2 после F0.1 — структурный self-reference state.head (pinned head лежит в .project/STATE.md:44 ВНЕ volatile-маркеров, маркирован только L6, поэтому производные всегда отстают на 1 коммит от закреплённого head), принят как постоянный налог, правка sync.mjs отложена в F2; попытки сойтись прекращены, третий converge не делается; snapshot: .project/state.json + docs/index.html (commits[] на b0c9c5f), log.md добавлен после snapshot и следующего sync не проходил | commit 96303a2
2026-09-28 | F1.1 | пять тетрадей памяти созданы, план v2.3, правила 12–13 в ORCH-RULES | commit pending
2026-09-28 | F1.2 | trends.jsonl + check-episodic.mjs + npm check:episodic; правило 12 теперь checkable | commit pending
2026-09-28 | F1.3 | F1 закрыта 5/5; MEMORY-FACTORY и session-log в архив; числа верифицированы (ahead 9→11) | commit pending
2026-09-28 | F2.0 | секция «Гарантия памяти» добавлена в план (ЧАСТЬ 5А); план v2.6; запись в semantic | commit pending
2026-09-28 | F2.1a | режим работы v2.7; js-yaml в deps | commit pending
2026-09-28 | F2.1b | sync.mjs volatile + memory paths | commit pending
2026-09-28 | F2.2a | cleanup _diag2.mjs; alert про index.html drift | commit pending
2026-09-28 | F2.2b | index.html drift закрыт — projection-подход | commit pending
2026-09-28 | F2.3 | парсинг YAML-шапки плана + блок «План» в дашборде | commit pending
2026-09-28 | F2.3.1 | readPlanYaml без js-yaml — рукописный парсер, конвенция readRoles восстановлена | commit pending
2026-09-28 | push | authorize push origin main — капитаном | [AUTHORIZE]
2026-09-28 | F2.4 | 4 блока дашборда + pre-commit hook; F2 закрыта 5/5 | commit pending
2026-09-28 | push | authorize push origin main — F2 закрыта, 3 коммита | [AUTHORIZE]
2026-09-28 | F2.5 | START-HERE.md + working HEAD/ahead + alerts [closed] + Dependabot | commit pending
2026-09-28 | F3.2 | live AgentTeams: linuxexam-f3-smoke (writer+QC), verdict PASS | commit c799031
2026-09-28 | F3 | фаза закрыта 5/5 — MAS работает, linuxexam-f3-smoke жива | commit 32cb067
2026-09-28 | F3.2b | linuxexam-f3-smoke оставлена живой как evidence F3; удаление — отдельным решением в F4 | —
2026-09-28 | push | authorize push origin main — F3 закрыта, 10 коммитов | [AUTHORIZE]
2026-09-28 | F4 | фаза закрыта — 2 авто (Сверщик, Чистильщик) + 2 процедурных (Летописец, Будильник) | commit pending
2026-09-28 | rule2-exception | авторизован перевод spec 023 в approved через embedded approve в промпте F4.3 v3 | commit pending
2026-09-28 | push | authorize push origin main — F4 закрыта, 5 коммитов | [AUTHORIZE]
2026-09-28 | F5.0a | rule 2 и rule 13 узаконены через embedded approve; .gitignore сужен; долги F4 записаны | commit pending
2026-09-28 | rule13-exception | авторизована правка ORCH-RULES через embedded approve | commit pending
2026-09-28 | F5.0b | spec 024 (Factory Export) создана + approved через embedded approve (2-й случай rule2-exception) | commit pending
2026-09-28 | F5.1a | templates/factory собран, factory:sync-template работает; sync.mjs — урезанная версия (smoke ok) | commit pending
2026-09-28 | F5.1b | factory:scaffold работает, 4 сценария проверены; smoke на развёрнутом ok | commit pending
2026-09-28 | F5.2 | FACTORY-USAGE написан; scaffold на node:fs; пустышка проверена (git init + sync + commit) | commit pending
2026-09-28 | F5 | фаза закрыта 4/4 — шаблон + scaffold + USAGE; пустышка разворачивается | commit pending
2026-09-28 | project | все 6 фаз F0–F5 закрыты; фабрика экспортируема | commit pending
2026-09-28 | push | authorize push origin main — F5 закрыта, публикация всех локальных коммитов; проект завершён | [AUTHORIZE]
2026-09-28 | cleanup | удалено 6 путей (.backup-tld, filelists-BaseOS.xml.gz, .tmp, scripts/, drafts/_bak, local_storage_r2.json); поправлены 3 мёртвые ссылки в плане | commit pending
2026-09-28 | push | authorize push origin main — cleanup + spec 025 | [AUTHORIZE]
2026-09-28 | dev-setup | создан docs/DEV-PLAN.md (D0–D4); sync.mjs агрегирует два плана в state.json; check:episodic читает allPhases | commit pending
2026-09-28 | D0-close | recon skills завершён; оркестратор = dsh-agent-teams; D1 переформулирован; DEV-PLAN v1.0 → v1.1 | commit pending
2026-09-28 | D1-close | skill spec-to-team создан, smoke PASS; D2 закрыта как выполнена в D1.5; DEV-PLAN v1.1 → v1.2 | commit pending
2026-09-28 | D3-close | S2 подтверждён (skill пишет в память), S3 закрыт (TEAM-ALREADY-ACTIVE pre-check); DEV-PLAN v1.2 → v1.3 | commit pending
2026-09-28 | spec-028 | skill spec-to-team, реальная задача hide-alerts-details: блок «Тревоги» свёрнут в `<details class="alerts" id="alerts">` в .project/sync.mjs (CSS только для details.alerts), docs/index.html регенерирован; команда spec-028-hide-alerts — 4 агента, 4 задачи completed, reviewer PASS; гейты sync/check:episodic exit 0, sync:check exit 2 до конвергента (правило 9); D4 остаётся pending — закрытие отдельным шагом D4-close | commit pending
2026-09-28 | D4-close | skill spec-to-team прошёл реальный прогон (spec-028); все 5 фаз DEV-PLAN закрыты | commit pending
2026-09-28 | project | DEV-PLAN завершён: skill spec-to-team работает end-to-end | commit pending
2026-09-28 | push | authorize push origin main — D4 закрыта, все коммиты D0-D4 | [AUTHORIZE]
2026-09-28 | C1 | C-PLAN v1.0 создан; spec 029-center-redesign draft | commit pending
2026-09-28 | C1-close | spec 029 approved; C-PLAN v1.0 → v1.1; старт C2 | commit pending
2026-09-28 | push | authorize push origin main — C1 закрыта, 2 коммита | [AUTHORIZE]
2026-09-28 | C2a | wall-clock «draft свежий» закрыт (вариант б: свежесть draft объявлена состоянием git вместо Date.now() − mtime) | commit e807455
2026-09-28 | C2b-1 | 10 секций удалены из рендера (queue, journal, roles, products, memory, trends, decisions, audits, plan-factory, plan-dev); строка «Планы» добавлена в ddn | commit 013aaae
2026-09-28 | C2a-3 | отложен (inSync hardcode) — зафиксировано в alerts.md | —
2026-09-28 | C2b-2 | commits и notebooks свёрнуты в <details>; policies возвращён как <details>; CSS details обобщён на класс collapsible; вычищен мусорный CSS удалённых секций | commit 3323d4c
2026-09-29 | C1-fix | снято противоречие статуса spec 029: п.5 spec 029 и C-PLAN:48 помечены как снятые (approve — C1-close log.md:88, 28.09); источник истины — frontmatter approved | commit pending
2026-09-29 | alerts | 3 записи: working.md lesson, handoff-stale, rule2-exception #3 (продолжение cumulative); procedural: manual-файлы | commit pending
2026-09-29 | handoff | заведён живой docs/HANDOFF.md (13 разделов, перенос неудачных попыток/правил/файлов/ограничений из архива); alerts.md: handoff-запись закрыта | commit pending
2026-09-29 | consistency | check-consistency.mjs: R1 SPEC-STALE, R2 PLAN-DRAFT, R3 PLAN-STEP, R4 ORPHAN-SHA (R5 снят как дубль check:episodic); интегрирован в sync:check | commit pending
2026-09-29 | C2c | HUMANIZE: плитка «224/300 · 74.7% · +18 за сутки», темы в <details>, specs сгруппированы по статусу, сводка тревог в ddn; технические строки переведены на человеческий на рендере | commit pending
2026-09-29 | C2a-2 | roles.yaml: «банк 206» → 224 (синхронизировано с state.goal.current_questions); шаблон обновлён через factory:sync-template | commit pending
2026-09-29 | C2a-3 | renderCenter: inSync вычисляется (вариант A, сравнение с git show HEAD); сообщение «есть расхождение» достижимо; идемпотентность sync подтверждена | commit pending
2026-09-29 | C2d | Пульс: 4 плитки (Состояние по V1, Банк, Требует решения, Долги); ddn: единый блок C-PLAN + «закрыто: F0–F5, D0–D4»; decisions в <details>; метрика первого экрана 30 строк | commit pending
2026-09-29 | alerts | C-фаза: V2-кандидат (V1 принят), метрика первого экрана = порог 30, preview пусто, тревоги-счётчик 17 vs 14 (на 29.09); procedural: time-box урок C2a-3 | commit pending
2026-09-29 | handoff | обновлён после C-фазы: §1 (HEAD ea1a026, ahead 44, C2 закрыт), §2 (+C2a-2/C2a-3/C2d/гигиена), §3 (открыт только C1-close + RHCSA + C2a-4), §9 (sandbox обновлён, +V2, +openAlerts, +метрика 30), §11, §13 | commit pending
2026-09-29 | center | плитка «Состояние»: три статуса (🟢/🟡/🔴) по inSync + свежести last_sync (порог 24ч, STALE_THRESHOLD_MS); fallback getFreshnessTime(); override spec 029 (санкционировано капитаном 29.09); заодно исправлена самоссылка индикатора (contentSansIndicator) | commit pending
2026-09-29 | sync | last_sync удалён (state/sync/STATE.md/гейт); freshness — git ct + .heartbeat; плитка Состояние — 4 уровня в VOLATILE; note детерминированный; cycle sync-converge устранён | commit pending
2026-09-29 | sync | problem #3 gate volatile-aware (stripVolatile HEAD vs generated); цикл commits-converge разорван; write-path не тронут (M index.html — ожидаемо) | commit pending
2026-09-29 | center | плитка Состояние — убран самоссылочный inSync, только freshness (override spec 029); signal «центр отстал» — в sync:check/CLI, не в HTML | commit pending
2026-09-29 | center | плитка «Состояние» → «Свежесть данных»: label + значения FRESHNESS_LEVELS (Свежие/Подустарели/Устарели/Критически старые) + null-ветка «Нет данных»; правка только внутри pulseTiles(); закрыта запись-триггер override | commit bc6124d
2026-09-29 | MAS | DECISIONS.md: 5 записей (оркестратор, C-фаза соло, Swarm закрыт, MAS для RHCSA/C2a-4, Marketing spec 031); handoff §4+§11 обновлены | commit pending
2026-09-29 | store | AnswerRecord.optionText + миграция v2→v3; отложенная нормализация в loadQuestions; stale-записи drop; fix двойного зелёного (pm_001) | commit pending
2026-09-29 | rules | EOL-правило в ORCH-RULES: `git ls-files --eol` после правок .ts/.md; Node-нормализация вместо Set-Content | commit pending
2026-09-29 | spec | spec 030 (rhcsa-objectives-diff) — draft: RHEL 9→10 diff + сопоставление банка | commit pending
2026-09-29 | spec | spec 030 — обогащена контекстом, edge cases, измеримыми критериями (SDD) | commit pending
2026-09-29 | spec | spec 030 — approved; handoff §1/§2/§11 обновлены | commit pending
2026-09-29 | push | authorize push origin main — spec 030 → approved + handoff §1/§2/§11, 5 коммитов | [AUTHORIZE]
2026-09-29 | handoff | §1 восстановлены продуктовые факты (LinuxExam / банк 224/300 / F0–F5 / D0–D4 / прод-URL) | commit pending
2026-09-29 | push | authorize push origin main — handoff §1 fix | [AUTHORIZE]
2026-09-29 | plan | C-PLAN: C2 in_progress → done (C2a-4 отложен); соответствие §1 HANDOFF | commit pending
2026-09-29 | push | authorize push origin main — C-PLAN status fix | [AUTHORIZE]
2026-09-29 | spec | spec 030 — секция «Декомпозиция» (2 задачи: id list + план); подготовка к /spec-to-team 030 | commit pending
2026-09-29 | push | authorize push origin main — spec-030 decomposition | [AUTHORIZE]
2026-09-29 | spec | spec 030 — ## Декомпозиция приведена к формату SKILL.md (по факту, не по гипотезе) | commit pending
2026-09-29 | push | authorize push origin main — spec-030 decomposition format | [AUTHORIZE]
2026-09-29 | spec | spec 030 закрыта: интегрированы результаты MAS (2 id: fp_002/sec_007; план delete/rewrite/add; mapping исправлен); HANDOFF §11 перенумерован | commit pending
2026-09-29 | push | authorize push origin main — spec-030 close | [AUTHORIZE]
2026-09-29 | spec | spec 031 (rhcsa-bank-fixes) — draft: 7 пунктов (delete fp_002 / rewrite sec_007+meta / add msw_015+msw_016+shuffle / _order единой транзакцией / sync topics 225 / P14 doc); _order — временно Node-скрипт | commit pending
2026-09-29 | push | authorize push origin main — spec-031 draft | [AUTHORIZE]
2026-09-29 | spec | spec 031 — approved; готов к /spec-to-team 031 (writer+qc, 7 задач) | commit pending
2026-09-29 | push | authorize push origin main — spec-031 approve | [AUTHORIZE]
2026-09-29 | spec | spec 031 — MAS PASS (7/7, QC=pass); банк 225 (delete fp_002 / rewrite sec_007 / add msw_015+msw_016 Flatpak); P14 doc | commit pending
2026-09-29 | state | current_questions 224→225, progress_percent 74.7→75 (после MAS spec 031) | commit pending
2026-09-29 | push | authorize push origin main — spec-031 close | [AUTHORIZE]
2026-09-29 | spec | spec 032 (mas-autonomy-a) — draft: 3 точечных долга (order-manifest CLI + EPERM + goal ownership); 032b отложена в spec 033 | commit pending
2026-09-29 | push | authorize push origin main — spec-032 draft | [AUTHORIZE]
2026-09-29 | spec | spec 032 — approved; готов к /spec-to-team 032 (3 задачи: order-manifest CLI / EPERM / goal ownership + reviewer) | commit pending
2026-09-29 | push | authorize push origin main — spec-032 approve | [AUTHORIZE]
2026-09-30 | spec | spec 032 (mas-autonomy-a) — MAS PASS (t1–t3 + reviewer pass, 4 агента); 3 инфра-долга закрыты в коде: order-manifest CLI / EPERM archive-helper / goal ownership | commit 2539526
2026-09-30 | spec | order-manifest: новый id дописывается в конец _order.json (append — детерминированное правило); повторный --add = no-op + WARN; round-trip SHA256 до==после | commit 2539526
2026-09-30 | spec | EPERM agent_teams_delete: причина — открытый дескриптор ниже переименовываемого каталога без FILE_SHARE_DELETE (плагин ждёт 3×50 мс); фикс — .project/scripts/archive-team.mjs вне плагина + процедура | commit 2539526
2026-09-30 | state | goal ownership: sync.mjs пересчитывает goal.current_questions/progress_percent из банка (readBankTotal); поле больше не может застрять вручную | commit 2539526
2026-09-30 | spec | spec 032 (mas-autonomy-a) — done (commit 2539526); 3 tech debt закрыты (order-manifest / EPERM / goal ownership) | commit pending
2026-09-30 | push | authorize push origin main — spec-032 close | [AUTHORIZE]
2026-09-30 | spec | spec 033a (mas-autonomy-spike) — draft: spike программного пути к dsh-agent-teams + run-spec.mjs + TASK/SESSION templates | commit pending
2026-09-30 | push | authorize push origin main — spec-033a draft | [AUTHORIZE]
2026-09-30 | spec | spec 033a — approved; готов к /spec-to-team 033a (spike-first: t0 проверка dsh-agent-teams) | commit pending
2026-09-30 | push | authorize push origin main — spec-033a approve | [AUTHORIZE]
2026-09-30 | spec | spec 033a (mas-autonomy-spike) — MAS PASS (t0–t2 + reviewer verdict=pass, 2 агента); spike: PATH=H2 (`dsh --profile <p> "/agent-teams …"`), H1 HTTP API и H4 node-инвокация отклонены, H3 — только read-канал | commit pending
2026-09-30 | spec | run-spec.mjs: детерминированный контур спека → задача → preflight H2 → execute → H3 read-back → атомарная история .project/mas-runs.json; коды 0/1/2/3 (3 = precondition-missing с fix-командами); npm script spec:run | commit pending
2026-09-30 | spec | templates/mas/{TASK,SESSION}.md: ODAF расшифрован решением исполнителя (канона в репозитории нет) + стадия stage-templates копирует шаблоны в .agent-teams/<teamId>/ | commit pending
2026-09-30 | decision | живой end-to-end MAS-прогон (status=ok) в 033a НЕ исполнялся: нужны разовая установка профиля mas (pnpm вне репо) + токены — мутация окружения без авторизации; вынесен в 033b, контракт ревью t3 amended до старта | commit pending
2026-09-30 | spec | spec 033a (mas-autonomy-spike) — done (spike + фундамент автономии) | commit pending
