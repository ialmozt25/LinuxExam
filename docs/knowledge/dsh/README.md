# DeepSeek Harness — практики

## Записи
- [preset-common-errors](./preset-common-errors.md) — типичные ошибки при создании пресета
- [pwsh-git-pitfalls](./pwsh-git-pitfalls.md) — pwsh try/catch не ловит git, fetch/push exit 128
- [append-content-pitfalls](./append-content-pitfalls.md) — Add-Content не добавляет \n перед содержимым, надёжный шаблон для DECISIONS

## Общие принципы DSH
- **Пресет** = директория с `agent.cordis.yml` + `preset.yml` + `skills/`
- **Shipped vs user** — никогда не редактировать shipped; только копировать
- **Host vs preset** — host для shared, preset для per-session
- **Trust boundary** — Creator Mode = shell access, не sandbox
- [pwsh-cyrillic-escaped-parens](./pwsh-cyrillic-escaped-parens.md) — pwsh + Cyrillic + экранированные скобки в regex → parse error
- [presets/linuxexam-qc-auditor](./presets/linuxexam-qc-auditor/) — reference copy of QC Auditor preset (agent.cordis.yml + preset.yml + 4 skills)