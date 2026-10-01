---
id: 900
slug: qc-adhoc
type: infra
status: draft
commit: null
---

# Спека 900 — qc ad-hoc фикстур t6 (3 дефекта)

## Контекст

Этот фикстур создан qc-агентом (задача t6 spec 040) для независимой
перепроверки фабрики spec-chain: детерминированного ядра
`.project/scripts/validate-spec.mjs` и CLI `npm run spec:enrich`.

Фикстур умышленно содержит ровно три дефекта: незакрытая заглушка TODO,
ссылка на несуществующий скрипт и зависимость от несуществующей задачи.
Цель — доказать, что фазы 0/1/4 находят все три дефекта и что конвейер
обогащения умеет их починить, не затронув intent спеки.

## Источники

- INCOSE GfWR — правила качества требований.

## Цель

Доказать, что фабрика spec-chain находит дефекты черновика и доводит его до
чистого состояния без изменения намерения спеки. (ДЕФЕКТ 1: TODO дописать.)

## Что делаем

- Прогнать детерминированное ядро на фикстуре.
- Прогнать CLI обогащения на фикстуре.
- Сверить результат с логом `.project/scripts/no-such-qc-script.mjs` (ДЕФЕКТ 2).

## Декомпозиция

1. id: t1, subject: `.project/scripts/fixture-one.mjs` — основной скрипт
   фикстуры; assignee: builder, dependencies: []
2. id: t2, subject: `.project/scripts/fixture-two.mjs` — сборка отчёта
   фикстуры; assignee: builder, dependencies: [t1]
3. id: t3, subject: `.project/scripts/fixture-three.mjs` — публикация отчёта
   фикстуры; assignee: builder, dependencies: [t8]

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

1. Ядро находит все три дефекта: m07 (строка с TODO), m06 (битый путь) и
   m04 (неизвестная зависимость t8) — печатает id проверки и номер строки,
   exit != 0.
2. Итоговый baseline score фикстура = 100/100.
3. Пары find/replace из фаз 2, 3, 5, 9 применяются ровно по одному разу;
   проверка — `node .project/scripts/validate-spec.mjs` на спеке, exit 0.

## Что НЕ трогать

- src/**, tools/**.
