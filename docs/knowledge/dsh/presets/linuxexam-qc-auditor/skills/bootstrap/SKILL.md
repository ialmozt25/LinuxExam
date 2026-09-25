---
name: bootstrap
description: Протокол чтения состояния проекта при старте сессии
version: 1.0.0
---

# Bootstrap Protocol

## Когда использовать
В начале каждой сессии, перед любой работой.

## Шаги
1. Прочитать `.project/SPEC.md` — что строим и зачем.
2. Прочитать `.project/STATE.md` — где мы сейчас, что сделано, что блокирует.
3. Прочитать `.project/DECISIONS.md` — что уже решено (не перерешать).
4. Прочитать `.project/PLAN.md` — что в текущем milestone.

## После работы
1. Обновить `.project/STATE.md` — что сделано, что осталось.
2. Добавить запись в `.project/DECISIONS.md` для каждого значимого выбора.
3. Написать отчёт в `.project/agents/orchestrator-report.md`.

## Формат отчёта
```markdown
## YYYY-MM-DD · Orchestrator
### Goal
{Что пытались сделать}
### Completed
{Что сделано}
### Blockers
{Что мешает}
### Next Steps
{Что дальше}
```
