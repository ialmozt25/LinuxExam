# LinuxExam

## Разработка

Активация git-хуков (один раз на клон) — включает pre-commit hook `.githooks/pre-commit`,
который прогоняет `node .project/sync.mjs --check` и подсказывает «sync:check drift —
запусти npm run sync» (коммит не блокируется):

```sh
git config core.hooksPath .githooks
```
