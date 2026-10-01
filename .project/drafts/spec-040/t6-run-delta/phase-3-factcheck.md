# Фаза 3 — Fact-check против репозитория

- фаза: `3-factcheck`
- статус: `ok`
- runner: `node drafts/_mas-results/spec-040/t6/stub-runner-t6.mjs`
- model: `stub-t6/deterministic`
- prompt_hash: `sha256:0322a9961de031efffe85ad7dc2552538bc3f39a0dd5f32155a06b86e24dbd5e`
- timestamp: 2026-10-01T02:10:29.106Z
- prompt: `.project/drafts/spec-040/t6-run-delta/prompts/phase-3-factcheck.prompt.md`

Итог: Факт-чек: внешние ссылки, пути и формулировки проверены против репозитория.

## Findings

| id | severity | confidence | location | evidence | requiredFix |
|---|---|---|---|---|---|
| F3.2 | high | 1 | Что делаем | Пути `.project/scripts/no-such-qc-script.mjs` в репозитории нет | Заменить ссылку на существующий файл |

## Предложенные правки

- ``.project/scripts/no-such-qc-script.mjs`` → ``.project/SPEC.md`` — Фаза 3: битый путь заменён на существующий (m06)

