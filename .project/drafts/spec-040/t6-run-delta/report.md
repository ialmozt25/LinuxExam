# spec-enrich — отчёт прогона (apply)

- спека: `drafts/_mas-results/spec-040/t6/902-qc-delta.md` (id: 902)
- каталог прогона: `.project/drafts/spec-040/t6-run-delta`
- LLM-раннер: `node drafts/_mas-results/spec-040/t6/stub-runner-t6.mjs`
- старт: 2026-10-01T02:10:27.897Z; завершение: 2026-10-01T02:10:37.805Z
- каталог прогона по умолчанию: `.project/drafts/spec-<NNN>-enrich/`

## Фазы прогона

| Фаза | Имя | Исполнитель | Статус | Артефакт |
|---|---|---|---|---|
| 0 | Baseline score | CLI validate-spec.mjs | baseline 83 | — |
| 1 | 15 механических проверок | CLI validate-spec.mjs | 13P/1F/1W | — |
| 2 | Research + enrichment | LLM | ok | `phase-2-sources.md` |
| 3 | Fact-check против репозитория | LLM | ok | `phase-3-factcheck.md` |
| 4 | Traceability | CLI validate-spec.mjs | ok | — |
| 5 | Семантика | LLM | ok | `phase-5-semantics.md` |
| 6 | Adversarial | LLM | ok | `phase-6-adversarial.md` |
| 7 | Simulation | LLM | ok | `phase-7-simulation.md` |
| 8 | Regeneration test | LLM | ok | `phase-8-regeneration.md` |
| 9 | Repair loop | LLM | ok | `repair-log.jsonl` |
| 10 | External audit | LLM | ok | `phase-10-audit.md` |

## Score (Фаза 0, детерминированное ядро)

- baseline score: **83/100** (порог 70)
- финальный score: **89/100**
- delta: **+6**

| Измерение | weight | baseline weighted | final weighted |
|---|---|---|---|
| Completeness | 30 | 30 | 30 |
| Clarity | 25 | 11 | 17 |
| Testability | 25 | 22 | 22 |
| Consistency | 10 | 10 | 10 |
| Scope | 10 | 10 | 10 |

## Фаза 1 — механические проверки (ядро)

- 15 проверок: 14 PASS / 0 FAIL / 1 WARN
- WARN `m07` placeholder-маркеры (TBD/TODO/<id>/[citation needed]) — placeholder-маркер: <\s*(?:id|spec-id|url|path|name|value)\s*> (drafts/_mas-results/spec-040/t6/902-qc-delta.md:18)

## Фаза 4 — traceability (ядро)

- декомпозиция: есть
- сироты: критерии 0, цели 0, задачи 0
- hard-fail traceability: false

## Tiered sources (Фаза 2)

| URL | Tier | Дата | Тезис |
|---|---|---|---|
| https://www.incose.org/products-and-publications/se-body-of-knowledge/ | 1 | 2023-07-01 | GfWR: требования должны быть однозначны и полны — vague terms недопустимы. |
| https://docs.aws.amazon.com/wellarchitected/latest/framework/welcome.html | 1 | 2024-11-01 | Fidelity probes: проверяемость требования подтверждается измеримым признаком. |

## Findings (Фазы 6, 7, 8)

| id | severity | confidence | фаза | location | requiredFix |
|---|---|---|---|---|---|
| F3.2 | high | 1 | 3-factcheck | Что делаем | Заменить ссылку на существующий файл |
| F6.1 | low | 0.5 | 6-adversarial | Источники | Добавить 5–10 Tier 1–2 источников (Фаза 2) |

## Правки спеки (diff)

- фаза `2-research`: `если по возможности.` → `.` — Фаза 3: устранён vague term «по возможности» (Clarity)
- фаза `3-factcheck`: ``.project/scripts/no-such-qc-script.mjs`` → ``.project/SPEC.md`` — Фаза 3: битый путь заменён на существующий (m06)

## Repair loop (Фаза 9)

| итерация | решение | score до | score после | правок |
|---|---|---|---|---|
| 1 | no-edits | 89 | 89 | 0 |

## External audit (Фаза 10)

- отдельный LLM-вызов: да
- вердикт: INTENT-PRESERVED

## Лог прогона

- `.project/drafts/spec-040/t6-run-delta/run-log.jsonl` — по одной записи на каждый LLM-вызов (8 вызовов);
- поля записи: `phase`, `runner`, `model`, `prompt_hash`, `timestamp`, `status`;
- детерминированные фазы 0, 1, 4 — в `score-before.json` / `score-after.json`.

## WARN

WARN не зафиксировано.

## Вердикт прогона

- exit code: 0
- итог: прогон завершён

