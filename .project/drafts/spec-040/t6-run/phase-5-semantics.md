# Фаза 5 — Семантика

- фаза: `5-semantics`
- статус: `ok`
- runner: `node drafts/_mas-results/spec-040/t6/stub-runner-t6.mjs`
- model: `stub-t6/deterministic`
- prompt_hash: `sha256:2e21120b0ef09cad168e9de8e5acd2ce389f3adb92bd394860b746127bc341f6`
- timestamp: 2026-10-01T02:06:55.856Z
- prompt: `.project/drafts/spec-040/t6-run/prompts/phase-5-semantics.prompt.md`

Итог: Семантика: задача t3 зависит от несуществующей задачи t8.

## Findings

| id | severity | confidence | location | evidence | requiredFix |
|---|---|---|---|---|---|
| F5.1 | hard-fail | 1 | Декомпозиция, t3 | dependencies: [t8] — задачи t8 в декомпозиции нет | Заменить t8 на существующую зависимость |

## Предложенные правки

- `— публикация отчёта
   фикстуры; assignee: builder, dependencies: [t8]` → `— публикация отчёта
   фикстуры; assignee: builder, dependencies: [t1]` — Фаза 5: неизвестная зависимость t8 заменена на t1 (m04)

