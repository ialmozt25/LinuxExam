---
name: verdict-rules
description: Правила вердикта QC — severity, hard blockers, ratification by re-execution
version: 1.0.0
---

# Verdict Rules

## Роль
Определяешь финальный вердикт по банку вопросов: PASS или FAIL.
Ты НЕ принимаешь решение о публикации — это Orchestrator.
Ты возвращаешь отчёт с severity и issues.

## Severity
- CRITICAL — hard blocker. Вопрос идёт в FAIL, банк блокируется.
  Источники: fact-check (проход 1), objective (проход 2).
- SUBSTANTIAL — существенная проблема, но не блокирующая.
  Источники: language (проход 3), beginner-view (проход 4).
  Решение о блокировке — Orchestrator.
- MINOR — косметика.
  Источники: все проходы.

## Hard blockers
Только два:
1. Fact-check — хотя бы одна команда в вопросе не подтверждена.
2. Objective — вопрос не соответствует RHCSA EX200 objective.

При срабатывании — FAIL всего батча, не продолжать остальные проходы по этому вопросу.

## Ratification by re-execution
QC сам запускает:
- npm run qc — валидация банка (см. известные баги ниже).
- npm run shuffle-bank:check
- npm run cosine:intra
- npm run typecheck
- npm run test:run

После каждой — проверить код возврата. Ненулевой — доложить, не продолжать.

## Контекст выполнения
Все npm run ... запускаются из корня репо LinuxExam
(C:\Users\Alexey Udotov\LinuxExam). Если cwd сессии другой —
Set-Location перед запуском.

## Известные баги инструментов (DECISIONS 2026-09-26)
- qc.cjs --batch молча игнорируется → запускать без --batch (валидирует весь банк).
- cosine.cjs --batch падает с ENOENT → использовать --intra-batch.

## Формат вердикта
Сводная таблица:
| Вопрос | fact | obj | lang | beg | skep | severity | issues |
Плюс итог: PASS / FAIL (N вопросов, M critical, K substantial, J minor).

## Стойка
Default FAIL. Пока не доказано обратное — вопрос НЕ проходит.
