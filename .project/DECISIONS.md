# LinuxExam — Журнал решений

## 2026-09-25 · Создание файлового состояния
- **Decision:** Создать `.project/` с файловым состоянием (STATE, SPEC, DECISIONS, PLAN).
- **Why:** Решает проблему потери контекста между сессиями.
- **Alternatives:** Внешняя БД, Notion, GitHub Issues.
- **Decided-by:** Капитан + Orchestrator.

## 2026-09-25 · Пресет `linuxexam-orchestrator`
- **Decision:** Создать первый DSH-пресет для роли Orchestrator.
- **Why:** Обеспечивает повторяемость и управляемость запуска агента.
- **Alternatives:** Каждый раз писать промпт вручную.
- **Decided-by:** Капитан + Orchestrator.

## 2026-09-25 · Event sourcing вместо прямых записей
- **Decision:** `STATE.md` и `METRICS.json` генерируются из `events.jsonl`.
- **Why:** Устраняет race conditions при конкурентной записи.
- **Alternatives:** Advisory lock, optimistic concurrency.
- **Decided-by:** Orchestrator.

## 2026-09-25 · Event sourcing отложен до M3
- **Decision:** Запись "STATE.md и METRICS.json генерируются из events.jsonl" от 2026-09-25 остаётся в силе как цель, но реализация отложена до M3 (дашборд).
- **Why:** M0 закрывается на статических MD-файлах; event sourcing — преждевременная сложность, нужен только когда дашборд начнёт читать данные.
- **Alternatives:** Реализовать сейчас (отклонено — усложнит закрытие M0), откатить запись (отклонено — цель остаётся верной).
- **Decided-by:** Капитан + Orchestrator.

## 2026-09-25 · Постоянные агенты отложены до M3–M4
- **Decision:** Зафиксировать как отложенное решение идею continuable-агентов с cron, recovery и peer-коммуникацией. Детали — в PLAN.md, секция "Отложенные решения".
- **Why:** Преждевременно до M3; нужен источник данных (STATE) и реальная ops-нагрузка (бэкапы), чтобы watchdog был полезен.
- **Alternatives:** Внедрить сейчас (отклонено — coordination overhead без пользы).
- **Decided-by:** Капитан + Orchestrator.