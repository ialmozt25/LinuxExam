---
id: 902
slug: qc-delta
type: infra
status: draft
commit: null
---

# Спека 902 — qc ad-hoc: score delta через дефекты, которые измеряет Фаза 0

## Контекст

Фикстур создан qc-агентом (задача t6 spec 040) для проверки главного обещания
конвейера: `npm run spec:enrich` повышает baseline score, не меняя intent.

Фикстур намеренно содержит ровно три дефекта, которые Фаза 0 реально штрафует,
и ни один из них не лежит в «Цели» или «Критериях приёмки»: незакрытая
заглушка `<spec-id>` в этом абзаце, неточная формулировка в «Что делаем» и битая
ссылка на несуществующий скрипт в «Что делаем» — эталонная проверка m06.

Механическая проверка m04 (DAG) специально оставлена чистой: она даёт hard-fail
и останавливает конвейер до LLM-фаз, что проверяется отдельным фикстуром 901.

## Источники

- INCOSE GfWR — правила качества требований.
- EARS (Rolls-Royce) — канонические шаблоны требований.

## Цель

Доказать, что ядро находит дефекты фикстура и печатает id проверки вместе с
номером строки, а конвейер обогащения доводит фикстур до чистого состояния.

## Что делаем

- Прогнать детерминированное ядро на фикстуре.
- Прогнать конвейер обогащения на фикстуре, если по возможности.
- Сверить результат с логом `.project/scripts/no-such-qc-script.mjs`.

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

1. Ядро фикстура печатает отчёт: `node .project/scripts/validate-spec.mjs`, exit 0.
2. `.project/scripts/fixture-two.mjs` — собирает отчёт; `node --check` → exit 0.
3. `.project/scripts/fixture-three.mjs` — публикует отчёт; `node --check` → exit 0.

## Что НЕ трогать

- src/**, tools/**.
