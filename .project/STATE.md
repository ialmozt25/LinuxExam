# LinuxExam — Текущее состояние

## Что делаем сейчас
M2.8 закрыт: первая реальная генерация через MAS (6 вопросов users_groups, банк 160 → 166, commit d73c016). Следующий шаг — M2.9 или M3.

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

## Блокеры
| # | Блокер | Критичность | Ответственный |
|---|---|---|---|
| 1 | StubPaymentProvider всегда успех | Критическая | — |
| 2 | Telegram Stars не реализованы | Критическая | — |
| 3 | Paywall dead-end (нет выхода) | Высокая | — |

## Следующие шаги
1. M2.8: первая реальная генерация через полный MAS-цикл (Writer → QC → Orchestrator)
2. M2.8: отработать rework_targets=[um-001, um-002] из M2.6 (дубликат ug_006, дистрактор groupmod -U)
3. M2.8: Orchestrator валидирует topic по src/data/topics.ts перед выдачей задачи Writer'у
<!-- M2.8-prep completed -->
