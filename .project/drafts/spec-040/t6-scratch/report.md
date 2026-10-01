# spec-enrich — отчёт прогона (apply)

- спека: `drafts/_mas-results/spec-040/t6/900-qc-adhoc.md` (id: 900)
- каталог прогона: `.project/drafts/spec-040/t6-scratch`
- LLM-раннер: `node drafts/_mas-results/spec-040/t6/stub-runner-t6.mjs`
- старт: 2026-10-01T02:05:10.457Z; завершение: 2026-10-01T02:05:10.474Z
- каталог прогона по умолчанию: `.project/drafts/spec-<NNN>-enrich/`

## Фазы прогона

| Фаза | Имя | Исполнитель | Статус | Артефакт |
|---|---|---|---|---|
| 0 | Baseline score | CLI validate-spec.mjs | baseline 87 | — |
| 1 | 15 механических проверок | CLI validate-spec.mjs | 12P/2F/1W | — |
| 2 | Research + enrichment | LLM | — | `phase-2-sources.md` |
| 3 | Fact-check против репозитория | LLM | — | `phase-3-factcheck.md` |
| 4 | Traceability | CLI validate-spec.mjs | hard-fail | — |
| 5 | Семантика | LLM | — | `phase-5-semantics.md` |
| 6 | Adversarial | LLM | — | `phase-6-adversarial.md` |
| 7 | Simulation | LLM | — | `phase-7-simulation.md` |
| 8 | Regeneration test | LLM | — | `phase-8-regeneration.md` |
| 9 | Repair loop | LLM | — | `repair-log.jsonl` |
| 10 | External audit | LLM | — | `phase-10-audit.md` |

## Score (Фаза 0, детерминированное ядро)

- baseline score: **87/100** (порог 70)
- финальный score: **87/100**
- delta: **+0**

| Измерение | weight | baseline weighted | final weighted |
|---|---|---|---|
| Completeness | 30 | 30 | 30 |
| Clarity | 25 | 20 | 20 |
| Testability | 25 | 20 | 20 |
| Consistency | 10 | 7 | 7 |
| Scope | 10 | 10 | 10 |

## Фаза 1 — механические проверки (ядро)

- 15 проверок: 12 PASS / 2 FAIL / 1 WARN
- FAIL `m04` DAG декомпозиции: известные зависимости, без дублей и циклов — задача t3: неизвестная зависимость `t8` (drafts/_mas-results/spec-040/t6/900-qc-adhoc.md:43)
- FAIL `m06` существование путей, упомянутых в спеке — упомянутый путь не существует: `.project/scripts/no-such-qc-script.mjs` (drafts/_mas-results/spec-040/t6/900-qc-adhoc.md:35)
- WARN `m07` placeholder-маркеры (TBD/TODO/<id>/[citation needed]) — placeholder-маркер: \bTODO\b (drafts/_mas-results/spec-040/t6/900-qc-adhoc.md:17)

## Фаза 4 — traceability (ядро)

- декомпозиция: есть
- сироты: критерии 1, цели 0, задачи 0
- hard-fail traceability: true

## Tiered sources (Фаза 2)

Источников нет — фаза не отчиталась (см. WARN ниже).

## Findings (Фазы 6, 7, 8)

Findings нет либо фазы adversarial/simulation/regeneration не отчитались.

## Правки спеки (diff)

Правок не применялось.

## Repair loop (Фаза 9)

Итераций не было (раннер недоступен либо правки не требовались).

## External audit (Фаза 10)

- отдельный LLM-вызов: нет
- вердикт: —

## Лог прогона

- `.project/drafts/spec-040/t6-scratch/run-log.jsonl` — по одной записи на каждый LLM-вызов (0 вызовов);
- поля записи: `phase`, `runner`, `model`, `prompt_hash`, `timestamp`, `status`;
- детерминированные фазы 0, 1, 4 — в `score-before.json` / `score-after.json`.

## WARN

WARN не зафиксировано.

## Вердикт прогона

- exit code: 1
- итог: STOP — hard-fail детерминированных фаз

