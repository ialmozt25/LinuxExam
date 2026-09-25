# DeepSeek Harness — практики

## Записи
- [preset-common-errors](./preset-common-errors.md) — типичные ошибки при создании пресета
- [pwsh-git-pitfalls](./pwsh-git-pitfalls.md) — pwsh try/catch не ловит git, fetch/push exit 128

## Общие принципы DSH
- **Пресет** = директория с `agent.cordis.yml` + `preset.yml` + `skills/`
- **Shipped vs user** — никогда не редактировать shipped; только копировать
- **Host vs preset** — host для shared, preset для per-session
- **Trust boundary** — Creator Mode = shell access, не sandbox
