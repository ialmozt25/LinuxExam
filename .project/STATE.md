# LinuxExam — Текущее состояние

## Что делаем сейчас
Этап 0 закрыт. Готовы к M1 (второй агент — Content Writer).

## Что сделано
- [x] 160 вопросов сгенерированы
- [x] QC/Haladyna/Cosine настроены
- [x] Guard-тесты проходят
- [x] Файловое состояние `.project/`
- [x] Пресет `linuxexam-orchestrator`
- [x] Skill `bootstrap`
- [x] Пресет проверен: агент читает `.project/` при старте

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