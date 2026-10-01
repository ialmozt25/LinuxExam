---
id: 040
slug: spec-chain
type: infra
status: done
commit: c5d86b4
---

# Спека 040 — spec-chain: фабрика end-to-end

Три компонента: Проверяльщик спек (11 фаз), Оркестратор цепочки
(run-spec-chain), документация пресета linuxexam-spec-chain. Цель —
сократить раунды на спеку с 6–8 до 2 (написать + проверить).

## Контекст

За 2026-09-30 — 2026-10-01 закрыто 4 спеки (036–039). Каждая — 6–8 раундов
обмена промптами. 1–3 дефекта на промпт находил агент, не автор. Причина —
7 проходов одного типа мышления. Решение зафиксировано в DECISIONS.md
(2026-10-01, «Фабрика spec-chain — архитектура end-to-end»).

## Источники

Tier 1 (peer-reviewed, стандарты, официальная документация):
- TRLC (BMW): требования как код; статический анализ в CI.
- EARS (Rolls-Royce): 5 канонических шаблонов требований.
- INCOSE GfWR: 42 правила качества требований.
- ARTEMIS (Stanford/NASA ICSE 2026): LLM → формальная логика.
  [citation needed — URL добавить при первом прогоне spec-enrich]
- Fidelity Probes (AWS): LLM-вопросы + ground-truth из кода.
  [citation needed — URL добавить при первом прогоне spec-enrich]
- TTool-AI (Télécom Paris ERTS 2026): dual feedback loop.
- Mitase: связь «намерение репозитория ↔ реализация».

Tier 2 (авторитетные практики):
- OpenSpec Adversarial Multi-Agent: 5 критиков; GO/REVISE/STOP.
- Speclint: 5 измерений, score 0–100, порог 70.
- QVscribe: EARS+INCOSE; время ревью −50%.
- ADVOCATUS (2026-04): separate adversarial agent; steel-manned objections.
- Spec Kit Agents: phase-level context-grounding против реального репо.
- VeriAct: repair loop planning → execution → verification → feedback.

## Цель

Одна команда `/run-spec-chain <spec-id>` доводит спеку от черновика до
закрытия. Капитан участвует дважды: (1) approve enriched-спеки;
(2) финальный push. Остальное — автономно.

## Что делаем

### Компонент A — Проверяльщик спек (spec-enrich)

11 фаз:
- Фаза 0 — baseline score 0–100 (Completeness 30%, Clarity 25%,
  Testability 25%, Consistency 10%, Scope 10%).
- Фаза 1 — 15 механических проверок (frontmatter, DAG, пути, id, SHA,
  placeholder'ы, self-reference, write-scope overlap).
- Фаза 2 — research + enrichment (веб-поиск, 5–10 Tier 1–2 источников,
  добавление edge cases с пометкой [enriched: URL|tier|дата]).
- Фаза 3 — fact-check против репо (grep, Test-Path, git log).
- Фаза 4 — traceability (Цель → Критерий → Задача; сироты → hard-fail).
- Фаза 5 — семантика (противоречия, дубликаты, stale cross-refs,
  vague terms, незакрытые вопросы).
- Фаза 6 — adversarial (отдельный LLM-критик; severity + confidence).
- Фаза 7 — simulation (проход спеки как агент-исполнитель).
- Фаза 8 — regeneration test (свежий LLM воспроизводит план по спеке).
- Фаза 9 — repair loop (max 3 итерации, rollback при падении score).
- Фаза 10 — external audit (проверка сохранения intent; защита от
  specification gaming).

### Компонент B — Оркестратор цепочки (run-spec-chain)

Skill `/run-spec-chain <spec-id>`:
1. `npm run spec:enrich <id>` — 11 фаз.
2. STOP: показать diff и score delta капитану, ждать «ок».
3. `/spec-to-team <id>` — MAS-команда.
4. STOP: показать план MAS-команды капитану, ждать approve.
5. MAS исполняет (builders × N + qc + reviewer).
6. `npm run spec:close -- <id>` — закрытие.
7. STOP: отчёт + ожидание push-авторизации.
8. Капитан → git push.

### Компонент C — Пресет linuxexam-spec-chain (документация)

Документация в `docs/spec-chain/README.md`:
- Структура пресета: `agent.cordis.yml` + `skills/`.
- Список инструментов: agent_teams_*, npm, git, Read, Write, Edit.
- Список скиллов: spec-enrich, spec-to-team, close-spec, run-spec-chain.
- Пошаговая инструкция ручной установки в `~/.dsh/.agent-presets/`.
- Системный промпт: «Ты — оркестратор цепочки. Твоя задача — исполнять
  run-spec-chain с STOP-точками для approve капитана».

Скиллы (spec-enrich, run-spec-chain) в репо хранятся как reference
в `docs/spec-chain/skills/<name>/SKILL.md`. Капитан копирует их в
`~/.dsh/.agent-presets/linuxexam-spec-chain/skills/` при установке
пресета (Шаг 5 после push spec 040).

Пресет — **операция капитана** (вне репо). Агент создаёт только
документацию и reference-копии скиллов в репо.

## Декомпозиция

1. id: t1, subject: .project/scripts/validate-spec.mjs — Фазы 0, 1, 4
   (baseline score, 15 механических проверок, traceability); Node ESM,
   zero-deps, ~500 строк; assignee: builder, dependencies: []
2. id: t2, subject: docs/spec-chain/skills/spec-enrich/SKILL.md —
   Фазы 2, 3, 5–10 (research+enrich, fact-check, semantics, adversarial,
   simulation, regeneration, repair loop, external audit); заголовки
   строго в формате «### Фаза N — <Name>»; ~400 строк;
   assignee: builder, dependencies: []
3. id: t3, subject: docs/spec-chain/skills/run-spec-chain/SKILL.md —
   оркестратор: 5 шагов с STOP-точками; заголовки в формате
   «### Шаг N — <Name>»; ~200 строк; assignee: builder,
   dependencies: []
4. id: t4, subject: .project/scripts/enrich-spec.mjs — CLI обёртка для
   spec-enrich (запуск skill'а через CLI) + package.json (1 строка
   «spec:enrich»); assignee: builder, dependencies: [t1, t2]
5. id: t5, subject: docs/spec-chain/README.md + docs/spec-chain/
   agent.cordis.yml — шаблон пресета, ≥6 шагов установки для капитана
   (включая копирование skills/ в ~/.dsh/.agent-presets/linuxexam-
   spec-chain/); assignee: builder, dependencies: []
6. id: t6, subject: qc — ratification by re-execution: запуск
   spec-enrich на тестовой спеке (3 дефекта ad-hoc) → проверка, что
   11 фаз работают, score delta > 0, intent сохранён; dry-run
   run-spec-chain без изменения репо; assignee: qc,
   dependencies: [t1, t2, t3, t4, t5]
7. id: t7, subject: reviewer — финальное ревью t1–t6; verdict=pass;
   assignee: reviewer, dependencies: [t6]

Оговорки:
- Write-скоупы:
  t1 → .project/scripts/validate-spec.mjs
  t2 → docs/spec-chain/skills/spec-enrich/SKILL.md
  t3 → docs/spec-chain/skills/run-spec-chain/SKILL.md
  t4 → .project/scripts/enrich-spec.mjs + package.json
  t5 → docs/spec-chain/README.md + docs/spec-chain/agent.cordis.yml
  t6, t7 → read-only (отчёты)
- t1, t2, t3, t5 параллельны. t4 после t1+t2. t6 после всех. t7 после t6.
- Approve капитана обязателен (type: infra).
- Установка пресета linuxexam-spec-chain в ~/.dsh/.agent-presets/ —
  операция капитана после push spec 040.

## Edge Cases

- **Research без сети**: Фаза 2 пропускается с WARN, пометка
  [research: skipped — no network]. Score не уменьшается.
- **Источник противоречит спеке**: не разрешать, вынести в
  «Открытые вопросы».
- **Spec gaming**: external audit находит изменение intent → hard-fail,
  rollback правок Фазы 9.
- **Oscillation repair loop**: max 3 итерации; score не растёт → STOP.
- **Спека уже идеальна**: 0 hard-fail + 0 high-finding → STOP, «clean».
- **run-spec-chain без spec-enrich**: STOP с сообщением «enrich
  не выполнен».
- **run-spec-chain с активной MAS-командой**: STOP (TEAM-ALREADY-ACTIVE).
- **Капитан не отвечает на STOP-точку**: таймаут 30 мин, отчёт, не
  продолжать.
- **Инструменты agent_teams_* недоступны в сессии**: STOP с диагностикой.

## Критерии приёмки

1. `.project/scripts/validate-spec.mjs` существует; `node --check` exit 0.
2. `npm run spec:enrich <spec-id> --dry-run` печатает 11 фаз и baseline
   score без правок.
3. `npm run spec:enrich <spec-id>` на тестовой спеке с 3 дефектами —
   все 3 найдены + исправлены; score delta > 0.
4. `docs/spec-chain/skills/spec-enrich/SKILL.md` содержит 11 фаз:
   `grep -c "^### Фаза " docs/spec-chain/skills/spec-enrich/SKILL.md` → 11.
5. `docs/spec-chain/skills/run-spec-chain/SKILL.md` содержит 5 шагов:
   `grep -c "^### Шаг " docs/spec-chain/skills/run-spec-chain/SKILL.md` → 5.
6. `docs/spec-chain/README.md` описывает установку пресета (≥6 шагов).
7. `docs/spec-chain/agent.cordis.yml` — шаблон.
8. `.project/DECISIONS.md` содержит запись «Фабрика spec-chain».
9. Отчёт содержит score до/после, diff, tiered sources, findings.
10. Фаза 2 выполняется: хотя бы один [enriched: URL] в изменённой спеке.
11. Фаза 10 выполняется: отдельный LLM-вызов в логе.
12. `npm run sync:check` exit 0.
13. `npm run test:run` exit 0 (baseline 28 файлов / 198 тестов).
14. qc verdict=pass; reviewer verdict=pass.

## Что НЕ трогать

- src/** (банк).
- tools/**.
- .project/sync.mjs, check-consistency.mjs, close-spec.mjs, run-spec.mjs.
- Спеки 028–039.
- docs/C-PLAN.md, docs/FACTORY-PLAN.md, docs/DEV-PLAN.md,
  docs/C0-CENTER-AUDIT.md, docs/archive/**.
- ~/.dsh/.agent-presets/ — не трогать (документация только).
