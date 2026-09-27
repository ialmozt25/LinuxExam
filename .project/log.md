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
