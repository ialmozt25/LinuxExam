# LinuxExam — Текущее состояние

## Что делаем сейчас
M1 закрыт (handoff-тест PASS). Следующий шаг — M2: QC Auditor.

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
- [x] Всё запушено на origin/main (HEAD = 9a9c8ea)
- [x] M1: пресет linuxexam-content-writer создан
- [x] M1: Agent Contract orchestrator_to_writer.yaml создан
- [x] M1: handoff-тест — PASS (2 вопроса, evidence list, gates ok)
- [x] docs/knowledge/PROJECT-GOALS.md создан

## Блокеры
| # | Блокер | Критичность | Ответственный |
|---|---|---|---|
| 1 | StubPaymentProvider всегда успех | Критическая | — |
| 2 | Telegram Stars не реализованы | Критическая | — |
| 3 | Paywall dead-end (нет выхода) | Высокая | — |

## Следующие шаги
1. M1: создать пресет `linuxexam-content-writer`
2. M1: создать Agent Contract `orchestrator_to_writer.yaml`
3. M1: проверить handoff orchestrator → writer