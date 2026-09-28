# Тревоги

Что пошло не так: открытые проблемы, налоги, известные ловушки.

---
## 2026-09-28 | F2.1b partial — index.html drift
Коммит 78adca8: STATE.md:44 и commits[]/log_tail закрыты — 2 из 3 self-reference. Третий — docs/index.html: содержит pre-commit head в содержимом, regex volatile не strip'ает регион. sync:check exit 2 после каждого коммита. Принято как налог (правило 9). Правка — в F2.2b или F2.3.

2026-09-28 | sync.mjs — устаревший путь к памяти
`.project/sync.mjs:898, :1150` ссылаются на `.project/factory/MEMORY-FACTORY.md`. После F1.3 файл переехал в `docs/archive/MEMORY-FACTORY-2026-09-28.md`. Карточка D3 в центре покажет «(нет файла)» до F2.1. Правка пути — вместе с self-reference в F2.1. Взято в работу в F2.1.

2026-09-28 | sync.mjs self-reference
`sync.mjs` self-reference. `state.head` и `commits[]` всегда отстают на 1 от HEAD после verify-шага: pinned head (`STATE.md:44`) лежит вне volatile-маркеров, а любой прогон verify добавляет текущий коммит в `commits[]` — производные уезжают, `sync:check` даёт exit 2. Принято как налог правила 9. Лечение — F2 (volatile-маркеры). Конвергентами не биться. Взято в работу в F2.1.

<!-- meta updated: 2026-09-28T03:22:45Z entries_count: 3 -->
