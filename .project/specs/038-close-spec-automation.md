---
id: 038
slug: close-spec-automation
type: infra
status: approved
commit: null
---

# Спека 038 — close-spec.mjs: автоматизация closing-фазы

Источник фактов: spec 036 и 037 (2026-09-30) — closing-фаза (R5-trace,
frontmatter, episodic, log, sync, converge) выполнялась вручную; три STOP-отчёта
по причине дефектов ручных промптов. Этот документ описывает CLI-скрипт,
закрывающий спеку одной командой.

## Контекст

После прогона MAS каждая spec проходит closing-фазу из 8–10 шагов
(R5-trace, правка frontmatter, append в episodic.md, append в log.md,
sync → add → commit × 2, sync:check). Шаги детерминированы и дублируются
из спеки в спеку; ручное исполнение даёт 3–5 ошибок на спеку.

## Цель

Одна команда `node .project/scripts/close-spec.mjs <spec-id>` закрывает
спеку: R5-trace, frontmatter, memory, commit-chain, sync:check = 0.

## Что делаем

1. CLI-скрипт `.project/scripts/close-spec.mjs` (Node ESM, zero-deps).
2. Резолв spec: `.project/specs/<id>-<slug>.md` (frontmatter `id: <id>`,
   `status: approved`).
3. Поиск `team.json` в `.agent-teams/**/spec-<id>*/` (корень + archive).
4. Проверка `verdict=pass` у reviewer-задачи; извлечение task tokens.
5. R5-trace: `git commit --allow-empty -m "chore(spec-<id>): R5 trace - task tokens <tokens>"`.
6. Правка frontmatter spec: `status: approved → done`, `commit: <feat-SHA>`.
7. Append в `docs/memory/episodic.md` (шаблон из spec 036).
8. Append в `.project/log.md`.
9. Commit-chain (2 коммита + 2 converge):
   - docs(spec-<id>): done - <title>
   - chore(state): converge after spec-<id> done
10. Финальный `npm run sync:check` — exit 0 = success.
11. Флаг `--refresh-working` — обновляет docs/memory/working.md.
12. Флаг `--dry-run` — печатает шаги, не коммитит.
13. npm-скрипт `"spec:close": "node .project/scripts/close-spec.mjs"`.

## Декомпозиция

1. id: t1, subject: close-spec.mjs — resolver, team.json finder, verdict
   check, tokens extraction, dry-run; assignee: builder, dependencies: []
2. id: t2, subject: close-spec.mjs — commit-chain (R5-trace, frontmatter,
   episodic, log, 2 commits + converge, sync:check), --refresh-working;
   assignee: builder, dependencies: [t1]
3. id: t3, subject: reviewer — dry-run на spec 036 (done, ожидание:
   refuses), dry-run на текущем дереве (hash производных до/после
   не меняется — проверка через git diff --stat = пусто), node --check,
   --dry-run не создаёт новых коммитов (git rev-parse HEAD до==после);
   verdict=pass; assignee: reviewer, dependencies: [t1, t2]

Оговорки:
- Правки — .project/scripts/close-spec.mjs + package.json (1 npm-скрипт)
  + spec 038.
- src/**, tools/**, .project/sync.mjs — не трогать.
- approve капитана обязателен (type: infra, но с правками package.json).

## Edge Cases

- spec уже done → exit 0, no-op + WARN "already done".
- team.json отсутствует → exit 3, precondition-missing.
- verdict != pass → exit 2, STOP.
- sync:check != 0 в шаге 10 → exit 2, отчёт, без отката (правило 9).
- Отсутствует pre-commit hook → не блокирует (наблюдение spec 034).
- `--dry-run` не должен делать git commit, npm run sync, git add.
- EOL (правило 16): все правки через Node fs с явным \n.

## Критерии приёмки

1. `node .project/scripts/close-spec.mjs 999 --dry-run` на несуществующей
   спеке → exit 3, отчёт.
2. `node .project/scripts/close-spec.mjs 036 --dry-run` (spec 036 done) →
   exit 0, WARN "already done", никаких изменений в дереве.
3. `--dry-run` на фейковой approved-спеке в worktree
   (`git worktree add %TEMP%\close-spec-test HEAD`) → печатает шаги,
   ни одного коммита, `git diff --stat` = пусто. worktree удаляется
   (`git worktree remove`). Reviewer фиксирует результат отдельно от
   основного дерева.
4. `node --check .project/scripts/close-spec.mjs` → exit 0.
5. `npm run spec:close -- --help` → usage.
6. Reviewer verdict = pass.

## Что НЕ трогать

- src/**, tools/**, .project/sync.mjs, check-consistency.mjs,
  .project/scripts/run-spec.mjs.
- Спеки 028–037.
