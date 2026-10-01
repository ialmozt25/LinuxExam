# spec-enrich · LLM-фаза 6 — Adversarial

PHASE_KEY: 6-adversarial
SPEC_PATH: drafts/_mas-results/spec-040/t6/901-qc-clean.md
SPEC_ID: 901
RUNNER: dsh --profile headless (переопределяется флагом --llm-cmd)

## Инструкция фазы (источник: docs/spec-chain/skills/spec-enrich/SKILL.md)

**Исполнитель:** **LLM-вызов** — отдельный критик
(`phase: "6-adversarial"`). Промпт критика не содержит переписки автора
правок и его самооправданий: критик видит спеку и критерии, не историю
работы. Вызов обязательно логируется:

```json
{"phase":"6-adversarial","runner":"dsh --profile headless","model":"<critic-model>","prompt_hash":"sha256:<hex>","timestamp":"<ISO-8601>","status":"ok"}
```

**Входы:** спека после Фаз 2–5; DECISIONS/DOD как критерии качества;
критерии приёмки; результаты Фаз 1–5 (для запрета повторять уже снятые
претензии).
**Шаги:**

1. Пять независимых атак (steel-manned objections, ADVOCATUS):
   (a) completeness — чего в спеке нет для исполнения; (b) testability —
   что нельзя проверить; (c) ambiguity — что можно понять двумя способами;
   (d) scope-creep / scope-hole — что расширяет или сужает рамки;
   (e) feasibility — что невыполнимо в этом репозитории.
2. Каждый finding: `severity` (hard-fail | high | medium | low),
   `confidence` (0–1), место в спеке, `evidence`, `requiredFix`.
3. Запрещено «на всякий случай» поднимать severity: severity выводится из
   последствия, а не из настроения критика.
4. Findings с `confidence < 0.5` не выбрасываются, но помечаются и в
   repair loop идут после high-severity.

**Выход:** `<run-dir>/phase-6-adversarial.md` (таблица findings: id,
severity, confidence, location, evidence, requiredFix), запись в
`run-log.jsonl`.
**Критерий завершения:** сформулировано ≥5 атак; каждый finding имеет
severity, confidence, evidence и requiredFix; критические находки не
повторяют уже снятые Фазами 2–5; лог содержит вызов с отдельным `model`,
`prompt_hash` и `timestamp`.
**Режим отказа:** hard-fail finding → Фаза 9 (не более 3 итераций) или
**STOP**, если правка требует изменения Цели; LLM-раннер недоступен →
**WARN** `[llm: unavailable — <reason>]`, артефакт фазы не создаётся, прогон
помечается неполным, а `report.md` явно перечисляет пропущенную фазу
(фаза обязательна для закрытия спеки — капитан решает, продолжать ли).

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

Фаза 6 — независимый критик: атакуй спеку, не повторяй уже снятые претензии. Правки не применяй.

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
