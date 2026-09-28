# START HERE

Точка входа для нового чата. Прочитай это — и ты в контексте за 2 минуты.

## Проект
LinuxExam / MAS Factory. Фабрика ИТ-продуктов с памятью. Продукт — тренажёр RHCSA.

## Что делать в первые 5 минут
1. Прочитай `docs/FACTORY-PLAN.md` — план, фазы, текущий шаг.
2. Прочитай `docs/memory/working.md` — HEAD, ahead, что делаем.
3. Прочитай `docs/memory/alerts.md` — открытые тревоги (без метки `[closed]`).
4. Выполни: `git log -5 --oneline`, `git status --porcelain`, `git rev-list --left-right --count origin/main...HEAD`.
5. Прочитай `.project/ORCH-RULES.md` — правила 1–13.

## Ключевые правила
- 5: каждое решение — строка в `.project/log.md`.
- 9: не биться конвергентами — налог принимаем.
- 10/11: push только по авторизации капитана.
- 12: закрытие фазы = запись в `episodic.md`.
- 14: план — единственный источник правды.

## Память
`docs/memory/`: episodic (события), semantic (факты), procedural (как), working (сейчас), alerts (тревоги).

## Долги
См. `alerts.md` (записи без `[closed]`). Актуальное: Dependabot 52.
