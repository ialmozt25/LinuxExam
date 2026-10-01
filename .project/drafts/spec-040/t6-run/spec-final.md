---
id: 901
slug: qc-clean
type: infra
status: draft
commit: null
---

# Спека 901 — qc ad-hoc: конвейер обогащения (3 дефекта)

## Контекст

Этот фикстур создан qc-агентом (задача t6 spec 040) для независимой
перепроверки конвейера обогащения `npm run spec:enrich`. От собрата 900 он
отличается тем, что критерии приёмки покрыты задачами декомпозиции — Фаза 4
не даёт hard-fail, поэтому прогон доходит до LLM-фаз.

Фикстур умышленно содержит ровно три дефекта: заглушка `<id>`, ссылка на
несуществующий документ и зависимость от несуществующей задачи. Все три
находятся детерминированным ядром; цель — доказать, что repair loop (Фаза 9)
их снимает, score растёт, а intent спеки не меняется.

## Источники

- INCOSE GfWR — правила качества требований.
- EARS (Rolls-Royce) — канонические шаблоны требований.

## Цель

Доказать, что ядро находит дефекты фикстура и печатает id проверки вместе с
номером строки, а конвейер обогащения доводит фикстур до чистого состояния.

## Что делаем

- Прогнать детерминированное ядро на фикстуре.
- Прогнать конвейер обогащения на фикстуре.
- Сверить результат с логом `.project/SPEC.md`
  (ДЕФЕКТ 2: битый путь).

## Декомпозиция

1. id: t1, subject: `.project/scripts/fixture-one.mjs` — основной скрипт
   фикстуры; assignee: builder, dependencies: []
2. id: t2, subject: `.project/scripts/fixture-two.mjs` — сборка отчёта
   фикстуры; assignee: builder, dependencies: [t1]
3. id: t3, subject: `.project/scripts/fixture-three.mjs` — публикация отчёта
   фикстуры; assignee: builder, dependencies: [t1]

Оговорки:
- Write-скоупы:
  t1 → .project/scripts/fixture-one.mjs
  t2 → .project/scripts/fixture-two.mjs
  t3 → .project/scripts/fixture-three.mjs
- Approve капитана обязателен.

## Edge Cases

- **Пустой вход**: фикстур без дефектов → ядро даёт exit 0.
- **Раннер недоступен**: фаза 2 пишет WARN и не уменьшает score.

## Критерии приёмки

1. `.project/scripts/fixture-one.mjs` — существует; `node --check` → exit 0.
2. `.project/scripts/fixture-two.mjs` — собирает отчёт; `node --check` → exit 0.
3. `.project/scripts/fixture-three.mjs` — публикует отчёт; `node --check` → exit 0.

## Что НЕ трогать

- src/**, tools/**.
