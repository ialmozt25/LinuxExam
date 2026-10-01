# spec-enrich · LLM-фаза 9 — Repair loop

PHASE_KEY: 9-repair
SPEC_PATH: drafts/_mas-results/spec-040/t6/902-qc-delta.md
SPEC_ID: 902
RUNNER: dsh --profile headless (переопределяется флагом --llm-cmd)
REPAIR_ITERATION: 1 из 3

## Инструкция фазы (источник: docs/spec-chain/skills/spec-enrich/SKILL.md)

**Исполнитель:** LLM-вызов + арифметика score из CLI
(`phase: "9-repair"`). Максимум **3 итерации**, жёстко.

**Входы:** findings Фаз 5–8 с severity; текущая спека; baseline score;
снимок оригинала (`git show HEAD:<spec>` или копия из `<run-dir>` ДО правок).
**Шаги:**

1. Отсортировать findings по severity; взять минимальный набор правок,
   закрывающий максимум `hard-fail`/`high`.
2. Перед итерацией снять снимок: `<run-dir>/repair-<i>/spec.md` +
   `score-before.json`.
3. Применить правки, перезапустить CLI (`node
   .project/scripts/validate-spec.mjs <spec> --json`), получить `score_i`.
4. Сравнить с `score_{i-1}`:
   - `score_i > score_{i-1}` → итерация принята, снимок
     `<run-dir>/repair-<i>/spec-accepted.md` + `score-after.json`;
   - `score_i < score_{i-1}` → **немедленный rollback** к снимку итерации,
     итерация помечается `reverted`, правка переписывается заново (в счёт
     лимита входит);
   - `score_i == score_{i-1}` при остающихся `hard-fail`/`high` →
     **STOP (oscillation)**: дальнейшие итерации только жгут бюджет.
5. Никогда не править Цель, Критерии приёмки и write-скоупы. Правка,
   меняющая intent, — **hard-fail** + rollback, независимо от роста score.
6. Остановиться досрочно, если 0 `hard-fail` и 0 `high` findings — состояние
   `clean` (спека уже идеальна: STOP без правок).

**Выход:** обновлённая спека, `<run-dir>/repair-log.jsonl` (по строке на
итерацию: `iteration`, `findings_addressed`, `score_before`, `score_after`,
`decision` ∈ `accepted|reverted|stopped`), снимки итераций, финальный
`score.json`, запись в `run-log.jsonl`.
**Критерий завершения:** любое из: (a) 0 `hard-fail` и 0 `high` — `clean`;
(b) 3 итерации исчерпаны; (c) зафиксирован STOP (oscillation). В отчёте —
score до/после, число принятых и откатанных итераций, diff.
**Режим отказа:** падение score → rollback итерации (без исключений);
отсутствие роста score → **STOP (oscillation)** с отчётом капитану;
3 итерации без достижения `clean` → **STOP** с перечнем незакрытых
findings и рекомендацией автору; правка intent → **hard-fail** + rollback
всех правок итерации; CLI недоступен → STOP (нельзя проверять правки без
score).

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
Правки спеки разрешены: каждая правка — литеральная замена `find` → `replace`, `find` обязан встречаться в тексте спеки ровно один раз.

## Контекст прогона

Итерация repair loop: 1 из 3.
Текущий score: 83. Открытые findings:
- findings не переданы (Фазы 6–8 не отчитались)
Применяй минимальный набор правок; правки Цели и Критериев приёмки запрещены — при их необходимости верни edits: [].

## Текст спеки

<<<SPEC
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

SPEC>>>
