# LinuxExam — Текущее состояние

## Что делаем сейчас
M3 «Центр Управления» закрыт: M3.1–M3.6 доставлены и запушены (sync 2026-09-26). Дашборд читает `.project/state.json` через автокопию в `docs/dashboard/`. Открыт M3.7 «Переиспользование» (planned). Следующие шаги — кандидаты ниже.

## Что сделано
- [x] 160 вопросов сгенерированы
- [x] QC/Haladyna/Cosine настроены
- [x] Guard-тесты проходят
- [x] Файловое состояние `.project/`
- [x] Пресет `linuxexam-orchestrator`
- [x] Skill `bootstrap`
- [x] Пресет проверен: агент читает `.project/` при старте
- [x] База знаний docs/knowledge/ создана (M0.5)
- [x] Разграничены журналы решений (docs/ENGINEERING-DECISIONS.md)
- [x] M0.7 (мост) и M3/M3.5 (Центр разработки) зафиксированы в PLAN.md
- [x] Всё запушено на origin/main (sync 2026-09-26)
- [x] M1: пресет linuxexam-content-writer создан
- [x] M1: Agent Contract orchestrator_to_writer.yaml создан
- [x] M1: handoff-тест — PASS (2 вопроса, evidence list, gates ok)
- [x] docs/knowledge/PROJECT-GOALS.md создан
- [x] M1.5: skill content-pipeline создан (7 этапов)
- [x] M1.5: persona Writer обновлена (4 skills в автозагрузке)
- [x] M1.5: проверено в пресете Content Writer (4/4 skills)
- [x] M2: пресет `linuxexam-qc-auditor` + 4 skills (M2.2)
- [x] M2: 3 контракта MAS — orchestrator_to_writer, writer_to_qc, qc_to_orchestrator (M2.3/M2.4)
- [x] M2: цикл Writer → QC → Orchestrator замкнут на тестовом батче (M2.6, decision=rework)
- [x] M2: milestone закрыт в `.project/` (M2.7, commit 32d9d5e)
- [x] M2.8: первая реальная генерация через MAS (6 вопросов users_groups, банк 160 → 166, commit d73c016)
- [x] M3.1: `.project/state.json` — файловое состояние для дашборда
- [x] M3.2: `tools/gen-state.mjs` — сборщик данных (qc/typecheck/vitest/shuffle)
- [x] M3.3: `docs/dashboard/dashboard.css` — дизайн-токены (dark-first)
- [x] M3.4: `docs/dashboard/dashboard.html` + `dashboard.js` — рендер 4 модулей
- [x] M3.5: auto-sync `state.json` → `docs/dashboard/` (в gen-state.mjs)
- [x] M3.6: закрытие M3 — STATE, DECISIONS, sync
- [x] M3: milestone закрыт (M3.6, sync 2026-09-26)

## Блокеры
| # | Блокер | Критичность | Ответственный |
|---|---|---|---|
| 1 | StubPaymentProvider всегда успех | Критическая | — |
| 2 | Telegram Stars не реализованы | Критическая | — |
| 3 | Paywall dead-end (нет выхода) | Высокая | — |

## Следующие шаги
1. Кандидат: M3.7 — «Центр разработки — переиспользование» (planned)
2. Кандидат: M2.9 — массовая генерация вопросов через MAS
3. Кандидат: M5 — монетизация (Cloudflare Worker, Telegram Stars)
<!-- M2.8-prep completed -->
