---
id: 051
slug: autonomous-spec-chain
status: approved
type: infra
track: fast
created: 2026-10-03
updated: 2026-10-03
commit: 2484748
embedded_approve: rule 2 + rule 17 (явная формулировка капитана 2026-10-03 «spec 051 — Autonomous Spec Chain (минимальный)», прямая реализация агентом, без MAS); rule 6 не применяется — type: infra
commit_format: "feat(spec-051): autonomous spec chain (risk scoring + auto-approve A/B/D + budget + research)"
---

# Spec 051 — Autonomous Spec Chain (минимальный)

> **M6.2 — автономная цепочка спеки: STOP-точки A/B/D снимаются техническими
> pass-условиями, push остаётся единственным ручным шагом.** Спека создана прямым
> заданием капитана 2026-10-03, трек — **Fast** (правило 17): enrich для самой 051
> не запускается, требования заданы капитаном полностью, реализация — **прямая, без
> MAS-команды** (bootstrap-режим).
>
> Область — strictly minimal: четыре компонента (risk scoring, auto-approve A/B/D,
> budget cap, research-фаза). Заведомо **вне** области: hash-chain audit, external
> watchdog, consensus-модели, graduated halt modes.

## Контекст

Цепочка `run-spec-chain` (spec 040) доводит спеку от черновика до закрытия, но
останавливается на капитане четыре раза: STOP A (approve обогащённой спеки), STOP B
(approve плана MAS), STOP D (approve превью вопросов для `type: content`) и STOP C
(отчёт + push-авторизация). Эти точки защищают от дорогих ошибок, однако три из них
имеют **технические** условия приёмки, которые уже вычисляются скриптами цепочки:
score и hard-fail прогона `spec:enrich`, валидность DAG и риск задач плана, метрики
QC-превью (cosine, Haladyna).

Пока такого условия нет, капитан остаётся в цикле ожидания на каждой спеке, даже
когда прогон безупречен по техническим признакам; при этом push и так требует
отдельной авторизации (правила 10/11), поэтому человеческая проверка содержимого не
исчезает. Прецеденты: spec 040 (пять шагов и четыре STOP-точки), spec 046 (STOP D
для `type: content`), spec 047 (треки Small/Fast/Full), spec 049 (guard'ы сессии).

**Что меняется.** Для STOP A/B/D вводится измеримое условие auto: при его выполнении
точка снимается автоматически с записью в `.project/DECISIONS.md`, при невыполнении
работает прежний ручной режим с таймаутом 30 минут. STOP C и push не автоматизируются
никогда — это единственный ручной шаг цепочки.

## Цель

1. Снять STOP-точки A, B и D при выполнении технических pass-условий: риск задачи ниже порога, enrich прошёл с score ≥ 85% и нулём hard-fail, QC = pass с cosine < 0.80 и Haladyna 5/5.
2. Оставить push единственным ручным шагом цепочки — автоматизация push запрещена (правила 10/11), STOP C сохраняется полностью.
3. Сделать решение о риске измеримым: каждая задача плана получает risk_score по преобладающему action, а maxRiskScore попадает в план (вход STOP-точки B).
4. Ограничить стоимость прогона: soft/hard-капы в USD с warn на 50%, downgrade pro→flash на 80% и kill на 100% с записью в `docs/memory/alerts.md`.
5. Дать цепочке research-фазу до enrich: план вопросов → поиск → рефлексия → синтез в артефакт `.project/drafts/`, с честным деградированием без сети.

## Что делаем

### Компонент 1 — Risk scoring (`.project/scripts/run-spec.mjs`)

Таблица действий и весов (чтение дёшево, необратимые операции дороги):

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

Пороги: AUTO_THRESHOLD = 50 (ниже — auto), HUMAN_THRESHOLD = 80 (80 и выше — STOP к
человеку), между ними — auto-review. Risk задачи — максимум по её actions
(консервативно: риск определяет худшее действие, а не среднее). Задачи берутся из
секции «## Декомпозиция» спеки (id, subject, assignee, dependencies); actions — явное
поле actions в задаче либо инференс по «командным» паттернам (git push, rm -rf,
git commit, npm run test, edit, read). DAG валидируется (существование зависимостей,
отсутствие циклов), и в план попадают поля maxRiskScore, riskDecision, dag и stopB —
вход условия STOP B на Шаге 3 скилла.

### Компонент 2 — Auto-approve STOP A / B / D

| Точка | Файл | Условие auto | Иначе |
|---|---|---|---|
| A (approve обогащённой спеки) | `.project/scripts/enrich-spec.mjs`, после Фазы 10 | exit 0 и score ≥ 85% от weightSum и hard-fail findings = 0 | STOP, ожидание капитана |
| B (approve плана MAS) | `docs/spec-chain/skills/run-spec-chain/SKILL.md`, Шаг 3 перед `agent_teams_create` | DAG валиден и maxRiskScore < 50 | STOP, ожидание капитана |
| D (approve превью, `type: content`) | там же, Шаг 4a перед записью в банк | QC = pass и cosine < 0.80 и Haladyna AUTO 5/5 | STOP, ожидание капитана |

Вариант QC — **A (один QC, pro)**: consensus-модели (QC pro и QC flash) прямо
запрещены областью спеки. Каждый auto-approve печатает лог-строку:

```
auto-approve STOP A | score:N | hard-fail:0
auto-approve STOP B | DAG valid | max-risk:N
auto-approve STOP D | QC:pass | cosine:N
```

и оставляет запись в `.project/DECISIONS.md` (append-only, правило 8):

```
YYYY-MM-DD | auto-decision | STOP A | spec-NNN | reason:<условия>
```

### Компонент 3 — Budget cap (`.project/scripts/run-spec.mjs`)

Флаги: --max-cost-usd N (hard, default 5.00), --soft-cap-usd N (default 2.50),
--cost-source PATH (default `.project/mas-runs.json`, поле tokens.total последнего
прогона). Поведение считается от hard-капа: 50% (или достигнутый soft-кап) — warn;
80% — downgrade pro → flash с warn; 100% — kill (`exit 3`) и запись в
`docs/memory/alerts.md`. Evidence — файл .project/drafts/spec-NNN-budget.json
(поля spent, remaining, status). Fallback: tokens = null → оценка по числу LLM-вызовов
× 500 токенов с пометкой estimated: true и WARN. Курс — константа USD_PER_1K_TOKENS.

### Компонент 4 — Research-фаза (`.project/scripts/research-spec.mjs`)

Вход: spec-id или путь. Фазы: plan (3–5 вопросов из цели и критериев спеки) → search
(веб-поиск при наличии TAVILY_API_KEY, иначе только репозиторий) → reflect (дедуп по
URL, ранжирование, противоречия и пробелы) → synthesize. Выход: артефакт
.project/drafts/spec-NNN-research.md с секциями «Best practices (с URL)», «Risks»,
«Recommendations» и строка research-решения «подход X, потому что Y» в
`.project/DECISIONS.md`. Интеграция — Шаг 0.5 SKILL.md (до enrich). Нет сети, нет
ключа или 403 → WARN `[research: skipped — no network]`, research только по
репозиторию, прогон продолжается с `exit 0`.

## Критерии приёмки

1. `.project/scripts/run-spec.mjs` содержит ACTION_RISK, AUTO_THRESHOLD = 50 и HUMAN_THRESHOLD = 80; каждая задача плана получает risk_score (максимум по actions), план — maxRiskScore и riskDecision; проверка: `node .project/scripts/run-spec.mjs 051 --dry-run` печатает блок «риск-скоринг» со списком задач и STOP B-вердиктом.
2. `.project/scripts/enrich-spec.mjs` после Фазы 10 печатает лог-строку `auto-approve STOP A | score:N | hard-fail:0` при score ≥ 85% от weightSum и нуле hard-fail, иначе STOP; в auto-случае дописывает строку auto-decision в `.project/DECISIONS.md`.
3. `docs/spec-chain/skills/run-spec-chain/SKILL.md` содержит авто-условия STOP B (валидный DAG и maxRiskScore < 50) и STOP D (QC pass, cosine < 0.80, Haladyna 5/5) с лог-строками auto-approve и записью auto-decision в `.project/DECISIONS.md`.
4. `.project/scripts/run-spec.mjs` принимает флаги `--max-cost-usd`, `--soft-cap-usd` и `--cost-source`; при 100% hard-капа пишет `docs/memory/alerts.md` и завершается `exit 3` со status budget-exceeded; fallback при tokens = null помечается estimated: true и печатает WARN.
5. `.project/scripts/research-spec.mjs` реализует 4 фазы, создаёт артефакт .project/drafts/spec-NNN-research.md и строку research-решения в `.project/DECISIONS.md`; запуск `node .project/scripts/research-spec.mjs 051` даёт `exit 0` и три секции артефакта.
6. `docs/spec-chain/skills/run-spec-chain/SKILL.md` содержит Шаг 0.5 (research до enrich) с условием продолжения и режимом отказа; проверка: `Select-String -Path docs/spec-chain/skills/run-spec-chain/SKILL.md -SimpleMatch "Шаг 0.5"` даёт непустой вывод.
7. Гейты прогона зелёные: `npm run typecheck`, `npm run test:run` и `npm run sync:check` дают `exit 0`.
8. EOL-гейт: файлы `.project/scripts/research-spec.mjs` и `.project/specs/051-autonomous-spec-chain.md` дают i/lf w/lf, CR = 0, финальный байт 10; проверка: `git ls-files --eol .project/scripts/research-spec.mjs`.
9. Push не автоматизирован: STOP C сохранён, а в `.project/scripts/run-spec.mjs` строка git push встречается только как ключ ACTION_RISK (вес 80), не как вызов; проверка: `Select-String -Path .project/scripts/run-spec.mjs -SimpleMatch "git push"` показывает только запись таблицы весов.

## Что НЕ трогать

- `src/data/**`, банк вопросов, `tools/**` — вне области спеки.
- `.project/sync.mjs`, `.project/contracts/**`, `.project/ORCH-RULES.md` — правок нет.
- `src/**`, `e2e/**` — правок нет.
- Push не автоматизируется и не выполняется агентом (правила 10/11).
- Не включать: hash-chain audit, external watchdog, consensus-модели, graduated halt modes.
- `git commit --amend` и rebase запрещены (правило 8).
- Записи прошлых решений в `.project/DECISIONS.md` не переписываются — только append.

## Edge Cases

- **Score ровно на пороге.** Score = 85% считается auto (условие включительное), 84% — STOP A ручной; при weightSum ≠ 100 сравнение идёт по проценту, а не по абсолютной сумме.
- **hard-fail при высоком score.** Score 95% и хотя бы один hard-fail finding → STOP A ручной; правки Фазы 9 в этом случае уже откатаны, закрытие не начинается.
- **tokens = null в источнике.** Сегодня так у всех 18 записей `.project/mas-runs.json`: бюджет считается по оценке (число LLM-вызовов × 500 токенов), помечается estimated: true и печатает WARN, прогон не падает.
- **Источник стоимости отсутствует или битый JSON.** readCostSource возвращает estimated: true с причиной; kill-условие не может сработать от нулевой оценки, поэтому предупреждение остаётся единственным сигналом.
- **exit 3 имеет два смысла.** precondition-missing (нет dsh, профиля или плагина) и budget-exceeded (kill по капу) различаются полем result.status и записью в alerts.md; разбор — по статусу, а не по коду.
- **Задача с git push в actions.** Вес 80 равен HUMAN_THRESHOLD → STOP B ручной даже при валидном DAG; это осознанный предохранитель, обхода нет.
- **Невалидный DAG.** Цикл или зависимость на несуществующий id → stopB.auto = false, STOP B ручной; план при этом печатается полностью для разбора.
- **Веб недоступен (нет TAVILY_API_KEY, 403, таймаут).** WARN `[research: skipped — no network]`, research выполняется по репозиторию, `exit 0`; это не STOP и не повод останавливать цепочку.
- **Auto-approve сработал ошибочно.** Откат — `git revert` feat-коммита spec 051 одним коммитом плюс запись в `docs/memory/alerts.md` и разбор до повторной попытки (правило 8: история не переписывается).
- **Попытка снять STOP C.** Не поддерживается: push выполняет только капитан по per-command авторизации, в SKILL.md явно записано «STOP C не автоматизируется».

## Проверка

```
npm run typecheck
npm run test:run
node .project/scripts/run-spec.mjs 051 --dry-run
node .project/scripts/research-spec.mjs 051
node .project/scripts/enrich-spec.mjs 051 --dry-run
git ls-files --eol .project/scripts/research-spec.mjs .project/specs/051-autonomous-spec-chain.md
npm run sync
npm run sync:check
```

## Декомпозиция

Прямая реализация агентом (bootstrap, без MAS-команды); задачи соответствуют
компонентам спеки, риск каждой задачи — ниже AUTO_THRESHOLD 50.

1. `id: t1` `subject: .project/scripts/run-spec.mjs — риск-скоринг задач плана (ACTION_RISK, пороги 50/80, risk_score/maxRiskScore, DAG) и бюджет прогона (--max-cost-usd, --soft-cap-usd, --cost-source, kill exit 3, alerts.md)` `assignee: builder` `dependencies: []` `actions: edit, npm test`
2. `id: t2` `subject: .project/scripts/enrich-spec.mjs — auto-approve STOP A (score >= 85% ∧ hard-fail 0) и строка auto-decision в .project/DECISIONS.md` `assignee: builder` `dependencies: [t1]` `actions: edit, read`
3. `id: t3` `subject: docs/spec-chain/skills/run-spec-chain/SKILL.md — auto-approve STOP B/D, Шаг 0.5 (research до enrich), сводная таблица STOP-точек; STOP C не автоматизируется` `assignee: builder` `dependencies: [t1]` `actions: edit, read`
4. `id: t4` `subject: .project/scripts/research-spec.mjs (новый) — 4 фазы research, артефакт .project/drafts/, fallback без сети; script research:spec в package.json` `assignee: builder` `dependencies: [t1]` `actions: edit, read`

Write-скоупы (без пересечений по писателю):

- t1 → `.project/scripts/run-spec.mjs`
- t2 → `.project/scripts/enrich-spec.mjs`, `.project/DECISIONS.md`
- t3 → `docs/spec-chain/skills/run-spec-chain/SKILL.md`
- t4 → `.project/scripts/research-spec.mjs`, `package.json`
