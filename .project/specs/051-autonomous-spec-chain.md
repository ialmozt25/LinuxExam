---
id: 051
slug: autonomous-spec-chain
status: approved
type: infra
track: fast
created: 2026-10-03
updated: 2026-10-03
commit: pending
embedded_approve: rule 2 + rule 17 (явная формулировка капитана 2026-10-03 «spec 051 — Autonomous Spec Chain (минимальный)», прямая реализация агентом, без MAS); rule 6 не применяется — type: infra
commit_format: "feat(spec-051): autonomous spec chain (risk scoring + auto-approve A/B/D + budget + research)"
---

# Spec 051 — Autonomous Spec Chain (минимальный)

> **M6.2 — автономная цепочка спеки: STOP-точки A/B/D снимаются техническими
> pass-условиями, push остаётся единственным ручным шагом.** Спека создана прямым
> заданием капитана 2026-10-03, трек — **Fast** (правило 17): `enrich` для самой 051
> не запускается, требования заданы капитаном полностью, реализация — **прямая, без
> MAS-команды** (bootstrap-режим).
>
> Область — strictly minimal: четыре компонента (risk scoring, auto-approve A/B/D,
> budget cap, research-фаза). Заведомо **вне** области: hash-chain audit, external
> watchdog, consensus-модели, graduated halt modes.

## Цель

1. Снять STOP-точки A, B и D при выполнении технических pass-условий: риск задачи ниже порога, enrich прошёл с score ≥ 85 и нулём hard-fail, QC = pass с cosine < 0.80 и Haladyna 5/5.
2. Оставить push единственным ручным шагом цепочки — автоматизация push запрещена (правила 10/11), STOP C сохраняется полностью.
3. Сделать решение о риске измеримым: каждая задача плана получает `risk_score` по преобладающему action, а `max_risk_score` попадает в план (вход STOP-точки B).
4. Ограничить стоимость прогона: soft/hard-капы в USD с warn на 50%, downgrade pro→flash на 80% и kill на 100% с записью в `alerts.md`.
5. Дать цепочке research-фазу до enrich: план вопросов → поиск → рефлексия → синтез в `.project/drafts/spec-<id>-research.md`, с честным деградированием без сети.

## Что делаем

### 1. Risk scoring (`run-spec.mjs`)

Таблица действий и весов (rule of thumb: чтение дёшево, необратимые операции дороги):

| action | score | почему |
|---|---|---|
| `read` | 5 | обратимо, без побочных эффектов |
| `git status` | 5 | read-only |
| `npm test` | 20 | обратимо, но запускает код |
| `git commit` | 25 | локальная история, откат через revert |
| `edit` | 30 | правка файлов в рабочем дереве |
| `migrate` | 60 | правка данных/схемы, откат не всегда возможен |
| `rm` | 70 | удаление файлов |
| `git push` | 80 | публикация, откат необратим (правила 10/11) |
| `rm -rf` | 95 | необратимое удаление |

Пороги: `AUTO_THRESHOLD = 50` (ниже — auto), `HUMAN_THRESHOLD = 80` (80 и выше — STOP
к человеку), между ними — auto-review. Risk задачи = максимум по её actions
(консервативно: риск определяет худшее действие, а не среднее). Извлечение tasks —
секция `## Декомпозиция` спеки (`id` / `subject` / `assignee` / `dependencies`),
actions — явное поле `actions:` в задаче либо инференс по ключевым словам
(`edit`/`mysql|migrate`/`rm -rf`/`rm`/`push`/`commit`/`test`/`read`).
`plan.maxRiskScore` и `plan.riskDecision` попадают в отчёт `run-spec`.

### 2. Auto-approve STOP A / B / D

| Точка | Файл | Условие auto | Иначе |
|---|---|---|---|
| A (approve обогащённой спеки) | `.project/scripts/enrich-spec.mjs`, после Фазы 10 | `exitCode = 0` ∧ score ≥ 85 (в % от weightSum) ∧ hard-fail findings = 0 | STOP, ожидание капитана (как было) |
| B (approve плана MAS) | `docs/spec-chain/skills/run-spec-chain/SKILL.md`, Шаг 3 перед `agent_teams_create` | DAG валиден ∧ `max_risk_score < 50` | STOP, ожидание капитана |
| D (approve превью вопросов, `type: content`) | тот же SKILL.md, Шаг 4a перед записью в `src/data/**` | QC = pass ∧ cosine < 0.80 ∧ Haladyna AUTO 5/5 | STOP, ожидание капитана |

Вариант QC — **A (один QC, pro)**: consensus-модели (вариант B) прямо запрещены
областью спеки. Каждый auto-approve печатает строку лога вида
`auto-approve STOP A | score:N | hard-fail:0` и оставляет запись в
`.project/DECISIONS.md`:
`YYYY-MM-DD | auto-decision | <STOP> | spec-<id> | reason:<условия>`.

### 3. Budget cap (`run-spec.mjs`)

Флаги: `--max-cost-usd N` (hard, default 5.00), `--soft-cap-usd N` (default 2.50),
`--cost-source <path>` (default `.project/mas-runs.json`, поле `tokens.total`
последнего прогона). Поведение от **hard**-капа: ≥ 50% или ≥ soft-капа → warn;
≥ 80% → downgrade `pro → flash` + warn; ≥ 100% → kill (`exit 3`) + запись в
`docs/memory/alerts.md`. Evidence — `.project/drafts/spec-<id>-budget.json`
(`spent` / `remaining` / `status`). Fallback: `tokens = null` (сегодня это
**все 18** записей `mas-runs.json`) → оценка по числу LLM-вызовов × 500 токенов с
пометкой `estimated: true` и WARN. Курс — константа `USD_PER_1K_TOKENS`.

### 4. Research-фаза (`.project/scripts/research-spec.mjs`)

Вход: `<spec-id>` (путь или id). Фазы: **plan** (3–5 вопросов из спеки) → **search**
(Tavily, если есть `TAVILY_API_KEY`, иначе — только репозиторий) → **reflect**
(дедуп, ранжирование, противоречия) → **synthesize**. Выход:
`.project/drafts/spec-<id>-research.md` с секциями **Best practices (с URL)** /
**Risks** / **Recommendations** и строка решения «подход X, потому что Y» в
`.project/DECISIONS.md`. Интеграция — Шаг 0.5 SKILL.md (до enrich). Нет сети /
нет ключа / 403 → WARN `[research: skipped — no network]`, repo-only research,
прогон продолжается (exit 0).

## Критерии приёмки

1. `run-spec.mjs` содержит `ACTION_RISK`, `AUTO_THRESHOLD = 50`, `HUMAN_THRESHOLD = 80`; каждая задача `plan.tasks[]` имеет `risk_score`, а план — `maxRiskScore` и `riskDecision`.
2. `enrich-spec.mjs` после Фазы 10 печатает `auto-approve STOP A | score:N | hard-fail:0` при выполнении условий и `STOP A: STOP` иначе; auto-случай пишет строку `auto-decision` в `.project/DECISIONS.md`.
3. SKILL.md Шаг 3 (STOP B) и Шаг 4a (STOP D) содержат явные auto-условия, лог-строку и запись в `DECISIONS.md`; таблица STOP-точек и «Что не делать» обновлены; push в auto-режиме не выполняется.
4. `run-spec.mjs` принимает `--max-cost-usd`, `--soft-cap-usd`, `--cost-source`; при 100% пишет `alerts.md` и завершается `exit 3` со `status: budget-exceeded`; fallback при `tokens: null` помечается `estimated: true` и печатает WARN.
5. `.project/scripts/research-spec.mjs` существует, реализует 4 фазы, пишет `.project/drafts/spec-<id>-research.md` и строку решения; без сети даёт WARN `[research: skipped — no network]` и `exit 0`.
6. Шаг 0.5 (research до enrich) присутствует в SKILL.md с условием продолжения и режимом отказа.
7. Гейты зелёные: `npm run typecheck`, `npm run test:run`, `npm run sync:check` — все `exit 0`.
8. EOL новых и правленых файлов — LF: `git ls-files --eol` даёт `i/lf w/lf`, CR = 0, финальный байт `10`.
9. Push не автоматизирован: в коде и SKILL.md нет вызова `git push`; STOP C сохранён.

## Что НЕ трогать

- `src/data/**`, банк вопросов, `tools/**` — вне области спеки.
- `.project/sync.mjs`, `.project/contracts/**`, `.project/ORCH-RULES.md` — правок нет.
- `src/**`, `e2e/**` — правок нет.
- Push не автоматизируется и не выполняется агентом (правила 10/11).
- Не включать: hash-chain audit, external watchdog, consensus-модели, graduated halt modes.
- `git commit --amend` / rebase запрещены (правило 8).
- Записи прошлых решений в `.project/DECISIONS.md` не переписываются — только append.

## Проверка

```
npm run typecheck                                   # exit 0
npm run test:run                                    # exit 0
node .project/scripts/run-spec.mjs 051 --dry-run     # план с risk_score/max_risk_score
node .project/scripts/research-spec.mjs 051          # research-артефакт либо WARN no network
node .project/scripts/enrich-spec.mjs 051 --dry-run  # exit 0, STOP A-вердикт в отчёте
git ls-files --eol .project/scripts/research-spec.mjs .project/specs/051-autonomous-spec-chain.md
npm run sync                                        # производные обновлены
npm run sync:check                                  # exit 0
```

## Декомпозиция

Прямая реализация агентом (bootstrap, без MAS-команды) — задачи соответствуют
компонентам спеки:

1. `id: t1` `subject: spec 051 — autonomous spec chain: постановка, критерии, границы` `assignee: captain-orchestrator` `dependencies: []` `actions: edit, read`
2. `id: t2` `subject: run-spec.mjs — risk scoring (ACTION_RISK, пороги 50/80, risk_score/max_risk_score в плане)` `assignee: builder` `dependencies: [t1]` `actions: edit, npm test`
3. `id: t3` `subject: run-spec.mjs — budget cap (--max-cost-usd/--soft-cap-usd/--cost-source, evidence, kill exit 3 + alerts.md)` `assignee: builder` `dependencies: [t2]` `actions: edit, npm test`
4. `id: t4` `subject: enrich-spec.mjs — auto-approve STOP A (score>=85 ∧ hard-fail=0) + строка auto-decision в DECISIONS.md` `assignee: builder` `dependencies: [t1]` `actions: edit, read`
5. `id: t5` `subject: run-spec-chain/SKILL.md — auto-approve STOP B/D, Шаг 0.5 research, таблица STOP-точек` `assignee: builder` `dependencies: [t2, t3]` `actions: edit, read`
6. `id: t6` `subject: research-spec.mjs — 4 фазы (plan/search/reflect/synthesize), artifact + решение, fallback без сети` `assignee: builder` `dependencies: [t1]` `actions: edit, read`

Write-скоупы (без пересечений по писателю):

- t1 → `.project/specs/051-autonomous-spec-chain.md`
- t2, t3 → `.project/scripts/run-spec.mjs`
- t4 → `.project/scripts/enrich-spec.mjs`
- t5 → `docs/spec-chain/skills/run-spec-chain/SKILL.md`
- t6 → `.project/scripts/research-spec.mjs`, `package.json`
