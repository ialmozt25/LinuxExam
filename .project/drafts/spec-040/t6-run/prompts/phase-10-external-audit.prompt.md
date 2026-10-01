# spec-enrich · LLM-фаза 10 — External audit

PHASE_KEY: 10-external-audit
SPEC_PATH: drafts/_mas-results/spec-040/t6/901-qc-clean.md
SPEC_ID: 901
RUNNER: dsh --profile headless (переопределяется флагом --llm-cmd)

## Инструкция фазы (источник: docs/spec-chain/skills/spec-enrich/SKILL.md)

**Исполнитель:** **ОТДЕЛЬНЫЙ LLM-вызов**, изолированный от Фазы 6:
другой runner/model ИЛИ другой промпт со свежим контекстом и без findings
Фазы 6. Тот же проход, что Фаза 6, запрещён — это и есть защита от
specification gaming. Вызов обязательно логируется отдельной записью:

```json
{"phase":"10-external-audit","runner":"dsh --profile headless","model":"<auditor-model>","prompt_hash":"sha256:<hex>","timestamp":"<ISO-8601>","status":"ok"}
```

**Входы:** оригинал спеки (версия до Фазы 2 из git или `<run-dir>`);
итоговая спека; полный diff; findings Фаз 5–8; `repair-log.jsonl`;
критерии приёмки; «Что НЕ трогать».
**Шаги:**

1. Выделить из оригинала неизменяемое ядро: Цель, Критерии приёмки,
   write-скоупы, «Что НЕ трогать», список задач декомпозиции.
2. Сравнить с итоговой версией по каждому элементу и классифицировать:
   `preserved` | `strengthened` | `weakened` | `changed` | `removed`.
3. Проверить признаки gaming: ослаблены критерии, удалены требования,
   расширены/сужены скоупы, добавлены самоподтверждающие проверки,
   формулировки переписаны так, чтобы «пройти» мех-
   проверки без изменения смысла.
4. Проверить трассируемость: каждая правка Фазы 9 должна ссылаться на
   finding Фазы 5–8; правки без источника — нарушение.
5. Вынести вердикт: `INTENT-PRESERVED` или `INTENT-CHANGED`
   (перечислить каждый изменённый элемент).

**Выход:** `<run-dir>/phase-10-audit.md` (intent diff по элементам,
признаки gaming, трассируемость, вердикт), отдельная запись в
`run-log.jsonl`.
**Критерий завершения:** проверены все 4 шага; вердикт вынесен; в логе есть
запись `phase: "10-external-audit"` с `runner`/`model`/`prompt_hash`/
`timestamp`/`status`, отличная от записи Фазы 6; вердикт внесён в
`report.md`.
**Режим отказа:** `INTENT-CHANGED` → **hard-fail** + rollback ВСЕХ правок
Фазы 9 (восстановление снимков, возврат к версии до Фазы 9) + **STOP** с
отчётом капитану; в логе нет отдельного вызова Фазы 10 → прогон
недействителен (**hard-fail**), даже если score высокий; LLM-раннер
недоступен → **WARN** `[llm: unavailable — <reason>]` + прогон помечается
неполным; аудит выполнен тем же проходом, что Фаза 6 → результат
аннулируется и помечается нарушением изоляции.

## Контракт ответа

Ответ — ровно один JSON-объект в stdout (без markdown-обёртки):
{
  "phase": "<PHASE_KEY>",
  "status": "ok" | "warn" | "skipped" | "error",
  "model": "<идентификатор модели раннера>",
  "summary": "<одна строка>",
  "sources":      [{"url","tier","date","claim"}],                                  // Фаза 2
  "findings":     [{"id","severity","confidence","location","evidence","requiredFix"}], // Фазы 6, 7, 8
  "edits":        [{"find":"<точная подстрока спеки>","replace":"<новый текст>","reason":"..."}], // только Фазы 2, 3, 5, 9
  "coverage":     0.0,                                                              // Фаза 8
  "verdict":      "INTENT-PRESERVED" | "INTENT-CHANGED"                             // Фаза 10
}
Правки спеки запрещены (фаза read-only): поле "edits" верни пустым.

## Контекст прогона

Вход изолирован от Фазы 6: findings adversarial этой сессии в промпт НЕ передаются.
Оригинал спеки (до правок):

<<<ORIGINAL
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
- Сверить результат с логом `.project/scripts/no-such-qc-script.mjs`
  (ДЕФЕКТ 2: битый путь).

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

1. `.project/scripts/fixture-one.mjs` — существует; `node --check` → exit 0.
2. `.project/scripts/fixture-two.mjs` — собирает отчёт; `node --check` → exit 0.
3. `.project/scripts/fixture-three.mjs` — публикует отчёт; `node --check` → exit 0.

## Что НЕ трогать

- src/**, tools/**.

ORIGINAL>>>

Проверь сохранение intent (Цель, Критерии приёмки, write-скоупы, «Что НЕ трогать») и верни verdict INTENT-PRESERVED либо INTENT-CHANGED.

## Текст спеки

<<<SPEC
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

SPEC>>>
