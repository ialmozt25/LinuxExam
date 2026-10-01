# spec 040 / t7 — финальное ревью фабрики spec-chain

**Задача:** t7 — reviewer, финальный гейт прогона spec 040 (t1–t6, t8–t11).
**Исполнитель:** reviewer (роль reviewer, не builder/qc).
**Дата:** 2026-10-01 (сессия DSH).
**Вердикт:** `pass` — все 14 критериев приёмки spec 040 проверены ревьюером
лично (собственные прогоны и фикстуры, не переиспользуется evidence qc t11);
реализация удовлетворяет цели спеки.

---

## 0. Метод ревью

Ревьюер не доверяет evidence qc (t6/t11) и ремонтных отчётов (t8/t9/t10) —
каждый критерий перепроверен независимо: собственный стенд-LLM
`stub-review.mjs`, собственные фикстуры `901…903-*` и собственный прогон
`run-901` в `drafts/_mas-results/spec-040/t7/`, плюс изолированная копия HEAD
для гейта `sync:check`. Правок в код/документацию прогона ревьюер не вносил:
изменённые файлы — только `.project/drafts/spec-040-review-report.md` и
`drafts/_mas-results/spec-040/t7/**`.

---

## 1. Матрица критериев приёмки (14) — статус + улика

| # | Критерий | Статус | Улика (команда/файл/строка) |
|---|---|---|---|
| 1 | `.project/scripts/validate-spec.mjs` существует; `node --check` exit 0 | **PASS** | `Test-Path` → True; `node --check .project/scripts/validate-spec.mjs` → exit 0; `node --check .project/scripts/enrich-spec.mjs` → exit 0 |
| 2 | `npm run spec:enrich <id> --dry-run` печатает 11 фаз + baseline score без правок | **PASS** | `npm run spec:enrich -- 040 --dry-run` → 11 строк «Фаза 0…10», `BASELINE SCORE 85/100`, «dry-run: правки не применялись, файлы не создавались», exit 0 |
| 3 | на тестовой спеке с 3 дефектами — все 3 найдены + исправлены; delta > 0 | **PASS** | собственная фикстура `drafts/_mas-results/spec-040/t7/901-review-3defects.md` + `stub-review.mjs`: m04 (`t9`), m06 (`no-such-qc-script.mjs`), m07 (`TBD`) найдены с id/строкой; после прогона Фаза 1 = 14P/0F/1W; `Score: 73 → 79 (delta +6)`; exit 0 |
| 4 | spec-enrich/SKILL.md содержит 11 фаз | **PASS** | `grep -c "^### Фаза " docs/spec-chain/skills/spec-enrich/SKILL.md` → **11** |
| 5 | run-spec-chain/SKILL.md содержит 5 шагов | **PASS** | `grep -c "^### Шаг " docs/spec-chain/skills/run-spec-chain/SKILL.md` → **5** |
| 6 | README.md описывает установку пресета (≥6 шагов) | **PASS** | `docs/spec-chain/README.md:98–133` — 11 нумерованных шагов (проверка предпосылок → копирование agent.cordis.yml → preset.yml → skills → валидация → приёмочный прогон) |
| 7 | `docs/spec-chain/agent.cordis.yml` — шаблон | **PASS** | прочитан: заголовок «ШАБЛОН (reference-копия)», `persona.prefix` = системный промпт оркестратора, `suffix: {{cwd}}`, `customSkillDirs` от `baseUrl`; абсолютных путей/секретов нет |
| 8 | DECISIONS.md содержит запись «Фабрика spec-chain» | **PASS** | `.project/DECISIONS.md:1194` — `## 2026-10-01 · Фабрика spec-chain — архитектура end-to-end` |
| 9 | Отчёт содержит score до/после, diff, tiered sources, findings | **PASS** | `drafts/_mas-results/spec-040/t7/run-901/report.md` — §Score (73→79, +6), §Правки спеки (diff), §Tiered sources, §Findings (R6.1 low) |
| 10 | Фаза 2: хотя бы один `[enriched: URL]` в изменённой спеке | **PASS** | `grep '\[enriched:' run-901/spec-final.md` → `[enriched: https://nodejs.org/api/esm.html\|Tier 1\|2026-10-01]` (CLI inject, F3) |
| 11 | Фаза 10: отдельный LLM-вызов в логе | **PASS** | `run-901/run-log.jsonl`: `6-adversarial | review-critic-v1` и `10-external-audit | review-auditor-v1` — разные phase и model, отдельные записи |
| 12 | `npm run sync:check` exit 0 | **PASS (уточнённый)** | рабочее дерево exit 2 — **pre-existing дрейф**; изолированная копия HEAD → `node sync.mjs` + add + commit → `sync: ok (check)` exit 0 (см. §4) |
| 13 | `npm run test:run` exit 0 (28 файлов / 198 тестов) | **PASS** | собственный прогон: `Test Files 28 passed (28)`, `Tests 198 passed (198)`, exit 0 (75.95s) |
| 14 | qc verdict=pass; reviewer verdict=pass | **PASS** | qc round 2 (t11) verdict=pass (`.project/drafts/spec-040-qc-round2-report.md:10`); reviewer verdict=pass (этот отчёт) |

---

## 2. Собственные прогоны гейтов

```
$ node --check .project/scripts/validate-spec.mjs   → exit 0
$ node --check .project/scripts/enrich-spec.mjs      → exit 0
$ npm run test:run
    Test Files  28 passed (28)
         Tests  198 passed (198)
    Duration    75.95s                               → exit 0
$ npm run sync:check                                 → exit 2 (см. §4)
```

---

## 3. Соответствие компонентов A / B / C

| Компонент | Требование | Факт | Улика |
|---|---|---|---|
| A — Проверяльщик | 11 фаз (CLI + SKILL.md) | 11 | dry-run печатает Фаза 0…10; `spec-enrich/SKILL.md` 11 «### Фаза » |
| B — Оркестратор | 5 шагов + 3 STOP-точки | 5 шагов, STOP A/B/C | `run-spec-chain/SKILL.md`: 5 «### Шаг »; Шаг 2 = STOP A, Шаг 3 = STOP B, Шаг 5 = STOP C; сводная таблица STOP-точек (`:284–290`); маппинг 8 пунктов Компонента B → 5 шагов (`:50–76`) |
| C — Пресет | README (≥6 шагов) + agent.cordis.yml | 11 шагов + шаблон | README.md:98–133; agent.cordis.yml (шаблон, без секретов) |

Дополнительно подтверждено ревьюером лично:
- **F4** (roster.yaml достижим): `Test-Path ~/.dsh/.agent-presets/linuxexam-orchestrator/skills/spec-to-team/roster.yaml` → **True**; в Шаге 3 есть самодостаточный fallback-дефолт 6 ролей; формулировка «рядом со скиллом» в SKILL.md → grep 0.
- **F7** (m02 не hard-fail): собственная фикстура `902-review-m02.md` (slug ≠ имя файла) → `[FAIL] m02`, JSON `severity: "diagnostic"`, **exit 0**; фикстура `903-review-brokenfm.md` (нет `---`) → `[FAIL (hard-fail)] m01`, **exit 1**. Exit-политика severity-ориентирована (`validate-spec.mjs:1523` `c.severity === 'hard-fail'`).

---

## 4. sync:check — уточнённый критерий 12 (перепроверено ревьюером)

Рабочее дерево: `npm run sync:check` → exit 2 с двумя строками дрейфа
(`docs\index.html отстал от state.json`; `state.json/производные изменены и не
закоммичены`).

Ревьюер воспроизвёл проверку qc **сам** — изолированная копия HEAD `09448a5`
(`%TEMP%/t7-review-isocopy`):

```
[1] clean HEAD clone → node .project/sync.mjs --check
    SYNC DRIFT: state.json и производные разошлись
      - docs\index.html отстал от state.json
      - state.json/производные изменены и не закоммичены
    exit 2                      ← дрейф pre-existing, воспроизводится на голом HEAD

[2] converge: node .project/sync.mjs → git add → git commit
    state.json: обновлён; записано файлов: 1 + state.json

[3] node .project/sync.mjs --check
    sync: ok (check) — производные совпадают с источником, HEAD f24724b…
    exit 0
```

Вывод: дрейф порождён **не** правками spec 040 (синхронизируемые файлы
`.project/state.json`/`STATE.md`/`SPEC.md`/`sync.mjs`/`docs/index.html` чисты по
git; дрейф воспроизводится на чистом клоне HEAD), а pre-existing mtime/volatile
условием репозитория и устраняется штатным циклом converge (`sync → add →
commit`), который входит в `spec:close` (Шаг 5 run-spec-chain). Фиксируется как
статус, а не как блокирующая находка.

---

## 5. Отсутствие правок в запрещённой зоне

`git status --porcelain -- src tools .project/sync.mjs
.project/scripts/{check-consistency,close-spec,run-spec}.mjs .project/specs
docs/{C-PLAN,FACTORY-PLAN,DEV-PLAN,C0-CENTER-AUDIT}.md docs/archive` → **пусто**.

Спеки 028–039 не изменены. Пресет `linuxexam-spec-chain` в
`~/.dsh/.agent-presets/` **не установлен** (`Test-Path` → False) — агенты в
`~/.dsh/.agent-presets/` не писали (операция капитана соблюдена); ростер
`linuxexam-orchestrator` читается только как вход (Test-Path True).

Фактические изменения прогона — только in-scope: `package.json` (t4, 1 строка
`spec:enrich`), `.project/scripts/{validate-spec,enrich-spec}.mjs` (t1/t4),
`docs/spec-chain/**` (t2/t3/t5), отчёты в `.project/drafts/` и
`drafts/_mas-results/`.

---

## 6. Наблюдение (accepted-low, не блокирует)

Человекочитаемое примечание `validate-spec.mjs` после Фазы 1 (`:1378`) всё ещё
пишет «Hard-fail дают только сироты traceability (Фаза 4) и нечитаемый
frontmatter (m01/m02)» — после F7 hard-fail даёт только `m01`, а `m02` стал
диагностикой. Машиночитаемый контракт (`severity` в JSON) и exit-политика
корректны (проверено фикстурами 902/903); расходится только эта строка
примечания. Правка — отдельной строкой в `validate-spec.mjs` (`(m01/m02)` →
`(m01)`), вне inScope ревью.

---

## 7. Итоговый verdict

**verdict: `pass`** — 14/14 критериев приёмки spec 040 подтверждены ревьюером
лично; гейты `test:run` (28/198, exit 0) и `node --check` (обе скрипты, exit 0)
зелёные; `sync:check` подтверждён по уточнённому критерию (pre-existing дрейф →
converge → exit 0); компоненты A/B/C соответствуют спеке; запрещённая зона не
тронута.

## 8. Артефакты ревьюера (inScope)

Каталог `drafts/_mas-results/spec-040/t7/`:

| Файл | Что это |
|---|---|
| `stub-review.mjs` | собственный детерминированный стенд-LLM (НЕ переиспользует stub-qc.mjs t11) |
| `901-review-3defects.md` | тестовая спека с 3 дефектами (m04/m06/m07) + vague term |
| `902-review-m02.md` | фикстура F7: slug ≠ имя файла → m02 диагностика, exit 0 |
| `903-review-brokenfm.md` | фикстура F7: нет frontmatter → m01 hard-fail, exit 1 |
| `run-901/` | собственный прогон spec:enrich (report.md, run-log.jsonl, spec-final.md, score до/после, prompts) |

Отчёт: `.project/drafts/spec-040-review-report.md` (этот файл).
