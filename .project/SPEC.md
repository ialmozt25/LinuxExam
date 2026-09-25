# LinuxExam — Спецификация

## Что это
Веб-тренажёр для подготовки к RHCSA EX200 (Red Hat Certified System Administrator).

## Аудитория
Начинающие и средние Linux-администраторы.

## Формат
MCQ, 4 опции, 1 правильная, UI на русском.

## Цель
Банк 300+ вопросов, монетизация через Telegram-бота @linux_exam_bot.

## Текущее состояние (2026-09-25)
- Банк: 160 вопросов, 14 topics (все available)
- HEAD: `ba6f7cd`
- QC: Fails=0, Warns=15
- Cosine: MATCH, max 0.9020
- Тесты: 137 passed / 0 failed
- Guard-тесты: 9/9 pass
- TS: 0 ошибок

## Блокер
Монетизация не реализована. `StubPaymentProvider` всегда возвращает успех → paywall обходится. Telegram Stars не интегрированы.
