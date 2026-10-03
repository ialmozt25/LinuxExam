---
id: 053
slug: risk-scoring-migrate-fix
status: approved
type: infra
track: fast
created: 2026-10-03
updated: 2026-10-03
commit: null
embedded_approve: rule 13 (правка .project/scripts/**)
---

## Контекст

inferActions() в `.project/scripts/run-spec.mjs` матчит кириллический корень
`миграц` в subject задач декомпозиции. Слово «миграция» в тексте задачи (обычно
это миграция persist-схемы Zustand, а не git- или DB-операция) даёт action
`migrate` с весом 60 по ACTION_RISK — при шкале, где `rm: 70`, `git push: 80`,
`rm -rf: 95`. `riskScoreOf()` берёт максимум по actions, поэтому одна правка
одного `.ts`-файла поднимала maxRiskScore плана до 60 ≥ AUTO_THRESHOLD (50) и
давала ложный STOP B — auto-approve не срабатывал.

Обнаружено на dry-run spec 052 (задача t2 «persist v3 → v4, … миграция
v3→v4»): `max-risk 60 (auto-review)`, STOP B вместо auto. Паттерн нарушал
собственную декларацию в комментарии над ACTION_PATTERNS: паттерны намеренно
«командные» (`git push`, `rm -rf`), а не словарные, потому что фраза-ограничение
в тексте задачи не должна поднимать риск.

## Цель

Убрать `миграц` из regex `inferActions()`. Командные формы (`npm run migrate`,
`migrate`) продолжают матчиться. Риск не меняется: ACTION_RISK и пороги
AUTO_THRESHOLD/HUMAN_THRESHOLD не тронуты.

## Изменение

Было (строка 169):

```
  { action: 'migrate', re: /\bmigrat|\bmigration|миграц/i },
```

Стало (строка 170, плюс комментарий строкой выше):

```
  // кириллица исключена намеренно — паттерн командный, не словарный
  { action: 'migrate', re: /\bmigrat|\bmigration/i },
```

## Проверка

```
Select-String .project/scripts/run-spec.mjs -Pattern 'миграц'          # 0 совпадений
Select-String .project/scripts/run-spec.mjs -Pattern 'migrat'          # ≥1 (ACTION_RISK + regex)
node .project/scripts/run-spec.mjs 052 --dry-run                       # max-risk 30 (auto)
node -e "import('./.project/scripts/run-spec.mjs').then(m=>{ \
  console.log(JSON.stringify(m.inferActions('npm run migrate','t1'))); \
  console.log(JSON.stringify(m.inferActions('миграция v3->v4','t2')));})"
# positive: ["migrate"]   — командная форма сохранена
# negative: ["read"]      — кириллица больше не даёт migrate
```

EOL (правило 16): LF, без BOM, trailing LF — проверить байтовым счётчиком CR
(`CR=0`, `lastByte=10`).

## Edge Cases

- Явное поле `actions:` в задаче всегда приоритетнее инференса — не затронуто.
- `ACTION_RISK.migrate = 60` сохранён: настоящая командная миграция по-прежнему
  требует auto-review (50…79), а не auto.
- Английские формы в тексте задачи (`migrate`, `migration`) продолжают давать
  вес 60 — намеренно: это командный маркер.
- Прочие кириллические паттерны (`правк[аиу]`, `обнов(ить|ление)`, `чтение`,
  `инспек`) не тронуты — их ложные срабатывания не наблюдались.

## Границы

- Правка только `.project/scripts/run-spec.mjs` (зона правила 13).
- `src/data/**`, `tools/**`, `.project/sync.mjs`, `ORCH-RULES.md`, spec 052 —
  не тронуты.
- Push не выполняется (правило 10/11 — отдельная авторизация капитана).
