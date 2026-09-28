# Factory Usage

Заполняется (F5.2).

## Что уже известно

- `npm run sync` собирает производные (`.project/STATE.md`, `.project/SPEC.md`,
  `docs/index.html`) из `.project/state.json` + `docs/FACTORY-PLAN.md` +
  `docs/memory/*`; `npm run sync:check` — READ-ONLY проверка совпадения.
- `npm run check:episodic` — проверка правила 12 (для каждой фазы `done` должна
  быть запись в `docs/memory/episodic.md`).
- Производные в шаблоне не хранятся (см. `.gitignore`) — они генерируются.
