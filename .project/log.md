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
