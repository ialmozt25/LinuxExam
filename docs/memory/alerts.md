# Тревоги

Что пошло не так: открытые проблемы, налоги, известные ловушки.

---
## 2026-09-28 | Dependabot — 52 уязвимости
GitHub: 1 critical, 23 high, 24 moderate, 4 low на default branch. Не следствие push. Кандидат в F4 или отдельную спеку. Действий пока нет.

## 2026-09-28 | F2.3 — стоп-условие 60 строк не сработало
Агент применил 133 строки вместо 60 в sync.mjs (F2.3), обосновал целостностью. Принято капитаном. Прецедент: впредь при превышении стоп-условия — СТОП и отчёт, не дожимать. [closed — принято капитаном, F2.3.1]

## 2026-09-28 | F2.1b partial — index.html drift
Коммит 78adca8: STATE.md:44 и commits[]/log_tail закрыты — 2 из 3 self-reference. Третий — docs/index.html: содержит pre-commit head в содержимом, regex volatile не strip'ает регион. sync:check exit 2 после каждого коммита. Принято как налог (правило 9). Правка — в F2.2b или F2.3. [closed F2.2b — variant A]

2026-09-28 | sync.mjs — устаревший путь к памяти
`.project/sync.mjs:898, :1150` ссылаются на `.project/factory/MEMORY-FACTORY.md`. После F1.3 файл переехал в `docs/archive/MEMORY-FACTORY-2026-09-28.md`. Карточка D3 в центре покажет «(нет файла)» до F2.1. Правка пути — вместе с self-reference в F2.1. Взято в работу в F2.1. [closed F2.1b]

2026-09-28 | sync.mjs self-reference
`sync.mjs` self-reference. `state.head` и `commits[]` всегда отстают на 1 от HEAD после verify-шага: pinned head (`STATE.md:44`) лежит вне volatile-маркеров, а любой прогон verify добавляет текущий коммит в `commits[]` — производные уезжают, `sync:check` даёт exit 2. Принято как налог правила 9. Лечение — F2 (volatile-маркеры). Конвергентами не биться. Взято в работу в F2.1. [closed F2.1b/F2.2b — volatile]

<!-- meta updated: 2026-09-28T04:10:42Z entries_count: 5 -->
