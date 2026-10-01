# spec-enrich — отчёт прогона (apply)

- спека: `drafts/_mas-results/spec-040/t6/902-qc-delta.md` (id: 902)
- каталог прогона: `.project/drafts/spec-040/t6-run-nollm`
- LLM-раннер: `node -e process.exit(1)`
- старт: 2026-10-01T02:12:56.345Z; завершение: 2026-10-01T02:13:00.022Z
- каталог прогона по умолчанию: `.project/drafts/spec-<NNN>-enrich/`

## Фазы прогона

| Фаза | Имя | Исполнитель | Статус | Артефакт |
|---|---|---|---|---|
| 0 | Baseline score | CLI validate-spec.mjs | baseline 83 | — |
| 1 | 15 механических проверок | CLI validate-spec.mjs | 13P/1F/1W | — |
| 2 | Research + enrichment | LLM | skipped | `phase-2-sources.md` |
| 3 | Fact-check против репозитория | LLM | skipped | `phase-3-factcheck.md` |
| 4 | Traceability | CLI validate-spec.mjs | ok | — |
| 5 | Семантика | LLM | skipped | `phase-5-semantics.md` |
| 6 | Adversarial | LLM | skipped | `phase-6-adversarial.md` |
| 7 | Simulation | LLM | skipped | `phase-7-simulation.md` |
| 8 | Regeneration test | LLM | skipped | `phase-8-regeneration.md` |
| 9 | Repair loop | LLM | skipped | `repair-log.jsonl` |
| 10 | External audit | LLM | skipped | `phase-10-audit.md` |

## Score (Фаза 0, детерминированное ядро)

- baseline score: **83/100** (порог 70)
- финальный score: **83/100**
- delta: **+0**

| Измерение | weight | baseline weighted | final weighted |
|---|---|---|---|
| Completeness | 30 | 30 | 30 |
| Clarity | 25 | 11 | 11 |
| Testability | 25 | 22 | 22 |
| Consistency | 10 | 10 | 10 |
| Scope | 10 | 10 | 10 |

## Фаза 1 — механические проверки (ядро)

- 15 проверок: 13 PASS / 1 FAIL / 1 WARN
- FAIL `m06` существование путей, упомянутых в спеке — упомянутый путь не существует: `.project/scripts/no-such-qc-script.mjs` (drafts/_mas-results/spec-040/t6/902-qc-delta.md:38)
- WARN `m07` placeholder-маркеры (TBD/TODO/<id>/[citation needed]) — placeholder-маркер: <\s*(?:id|spec-id|url|path|name|value)\s*> (drafts/_mas-results/spec-040/t6/902-qc-delta.md:18)

## Фаза 4 — traceability (ядро)

- декомпозиция: есть
- сироты: критерии 0, цели 0, задачи 0
- hard-fail traceability: false

## Tiered sources (Фаза 2)

Источников нет — фаза не отчиталась (см. WARN ниже).

## Findings (Фазы 6, 7, 8)

Findings нет либо фазы adversarial/simulation/regeneration не отчитались.

## Правки спеки (diff)

Правок не применялось.

## Repair loop (Фаза 9)

| итерация | решение | score до | score после | правок |
|---|---|---|---|---|
| 1 | runner-unavailable | 83 | 83 | 0 |

## External audit (Фаза 10)

- отдельный LLM-вызов: нет
- вердикт: —

## Лог прогона

- `.project/drafts/spec-040/t6-run-nollm/run-log.jsonl` — по одной записи на каждый LLM-вызов (8 вызовов);
- поля записи: `phase`, `runner`, `model`, `prompt_hash`, `timestamp`, `status`;
- детерминированные фазы 0, 1, 4 — в `score-before.json` / `score-after.json`.

## WARN

- [llm: unavailable — раннер завершился с кодом 1: без сообщения] (Фаза 2, промпт-пак: `.project/drafts/spec-040/t6-run-nollm/prompts/phase-2-research.prompt.md`)
- [llm: unavailable — раннер завершился с кодом 1: без сообщения] (Фаза 3, промпт-пак: `.project/drafts/spec-040/t6-run-nollm/prompts/phase-3-factcheck.prompt.md`)
- [llm: unavailable — раннер завершился с кодом 1: без сообщения] (Фаза 5, промпт-пак: `.project/drafts/spec-040/t6-run-nollm/prompts/phase-5-semantics.prompt.md`)
- [llm: unavailable — раннер завершился с кодом 1: без сообщения] (Фаза 6, промпт-пак: `.project/drafts/spec-040/t6-run-nollm/prompts/phase-6-adversarial.prompt.md`)
- [llm: unavailable — раннер завершился с кодом 1: без сообщения] (Фаза 7, промпт-пак: `.project/drafts/spec-040/t6-run-nollm/prompts/phase-7-simulation.prompt.md`)
- [llm: unavailable — раннер завершился с кодом 1: без сообщения] (Фаза 8, промпт-пак: `.project/drafts/spec-040/t6-run-nollm/prompts/phase-8-regeneration.prompt.md`)
- [llm: unavailable — раннер завершился с кодом 1: без сообщения] (Фаза 9, итерация 1, промпт-пак: `.project/drafts/spec-040/t6-run-nollm/prompts/phase-9-repair.iter1.prompt.md`)
- [llm: unavailable — раннер завершился с кодом 1: без сообщения] (Фаза 10, промпт-пак: `.project/drafts/spec-040/t6-run-nollm/prompts/phase-10-external-audit.prompt.md`)

## Вердикт прогона

- exit code: 0
- итог: прогон завершён с WARN: LLM-раннер недоступен, LLM-фазы пропущены (см. run-log.jsonl)

