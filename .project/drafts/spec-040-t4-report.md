# spec 040 · t4 (AgentTeams t5) — отчёт: .project/scripts/enrich-spec.mjs + package.json

**Задача:** CLI-обёртка Проверяльщика спек — `npm run spec:enrich`.
Соответствие меток: в спеке 040 эта работа названа «t4», в AgentTeams её id — t5;
отчёт называется как в контракте (`spec-040-t4-report.md`).
**Attempt:** 1 (attempt_id 49b8400e-044d-4930-9ce3-f53baf11d5e4).
**Зависимости:** t1 (`.project/scripts/validate-spec.mjs`, готов) и
t2 (`docs/spec-chain/skills/spec-enrich/SKILL.md`, готов).
**Изменённые пути (inScope):**

- `.project/scripts/enrich-spec.mjs` — 927 строк, Node ESM, zero-deps, без сети;
- `package.json` — ровно одна добавленная строка (`spec:enrich`);
- `drafts/_mas-results/spec-040/t4-cli/` — фикстуры, стенд-ин раннера, каталоги прогонов;
- `.project/drafts/spec-040-t4-report.md` — этот отчёт.

Правок вне inScope нет: `git status --porcelain` показывает только
` M package.json` и untracked-файлы внутри перечисленных путей.

## 1. Архитектура CLI

```
npm run spec:enrich -- <spec> [--dry-run] [--out <dir>] [--json] [--llm-cmd <cmd>] [--max-iterations <n>]
```

| Блок | Реализация |
|---|---|
| Резолв спеки | путь или id (`040`) — та же логика, что в ядре t1 |
| Каталог прогона | `--out <dir>`, по умолчанию `.project/drafts/spec-<NNN>-enrich/` (id из frontmatter, иначе номер из имени файла) |
| Фазы 0, 1, 4 | `node .project/scripts/validate-spec.mjs <spec> --json` — **логика не дублируется**, читаются секции `phase0`, `phase1.checks[]`, `phase4` |
| Фазы 2, 3, 5–10 | внешний LLM-раннер по инструкции `docs/spec-chain/skills/spec-enrich/SKILL.md`; секция фазы вырезается из скилла по заголовку `### Фаза N — <Name>` |
| Промпт-пак | `<run-dir>/prompts/phase-<key>[.iterN].prompt.md` — инструкция фазы + контракт ответа + текст спеки; пишется **всегда**, в том числе при недоступном раннере |
| Лог прогона | `<run-dir>/run-log.jsonl`, одна JSON-строка на LLM-вызов: `phase`, `runner`, `model`, `prompt_hash` (sha256 промпта), `timestamp` (ISO-8601), `status` (`ok`/`warn`/`skipped`/`error`) |
| Правки спеки | только литеральная замена `find` → `replace`; `find` обязан встречаться в тексте ровно один раз, иначе правка не применяется и попадает в «Не применены» |
| Фаза 9 | цикл до 3 итераций (жёсткий лимит, `--max-iterations` не может его превысить): снимок → правка → повторный прогон ядра; падение score → rollback (`repair-<i>/spec-before.md`), отсутствие роста при открытых hard-fail/high → STOP (oscillation) |
| Фаза 10 | отдельный вызов раннера, изолированный от Фазы 6 (findings Фазы 6 в промпт не передаются); `INTENT-CHANGED` → hard-fail + rollback правок Фазы 9 |

Раннер вызывается как `<llm-cmd> <prompt-file>`; результат — один JSON-объект
в stdout (поля `status`, `model`, `summary`, `sources`, `findings`, `edits`,
`coverage`, `verdict`). По умолчанию `--llm-cmd "dsh --profile headless"`.

Exit-коды: `0` — прогон завершён (в т.ч. WARN `[llm: unavailable — ...]`),
`1` — hard-fail (детерминированные фазы либо external audit), `2` — ошибка
использования/чтения.

## 2. Что демонстрируется в этом окружении, а что нет

Честно, потому что qc перезапускает всё сам:

- **Демонстрируется полностью:** вызов детерминированного ядра и разбор его
  JSON; построение промпт-паков из SKILL.md; применение правок; лог LLM-вызовов;
  repair loop с rollback и лимитом 3; отдельный вызов Фазы 10 и hard-fail при
  INTENT-CHANGED; ветка недоступного раннера; STOP при hard-fail ядра;
  `--dry-run`; `--out`; `--help`.
- **Не демонстрируется:** реальный LLM-раннер `dsh --profile headless` в
  сессии **не запускался** — вложенная агентская сессия внутри рабочего дерева
  (с write-инструментами) в тесте небезопасна и не требуется контрактом: задача
  прямо фиксирует, что раннер обязан переопределяться `--llm-cmd`, «чтобы прогон
  был тестируем без вложенной сессии». Все LLM-фазы прогнаны детерминированным
  стендом `stub-llm.mjs` (798 строк JSON-ответов по контракту фаз). Поэтому
  критерий 10 спеки (реальный `[enriched: URL]` от веб-поиска) и качество
  модельных суждений этим прогоном **не подтверждены** — проверен протокол, а не
  интеллект раннера.
- **Частично:** критерий 11 спеки (Фаза 10 — отдельный LLM-вызов в логе)
  подтверждён структурно: отдельная запись `10-external-audit` с собственным
  `model` (`stub-auditor-1`), отличным от модели Фазы 6 (`stub-critic-1`), и
  отдельным промптом без findings Фазы 6.

## 3. Вывод `--dry-run` (спека 040, exit 0)

```
$ npm run spec:enrich -- .project/specs/040-spec-chain.md --dry-run
spec-enrich — dry-run (11 фаз, правки не применяются)
спека: .project/specs/040-spec-chain.md (id: 040)

Фазы:
  Фаза 0 — Baseline score · CLI validate-spec.mjs
  Фаза 1 — 15 механических проверок · CLI validate-spec.mjs
  Фаза 2 — Research + enrichment · LLM (2-research)
  Фаза 3 — Fact-check против репозитория · LLM (3-factcheck)
  Фаза 4 — Traceability · CLI validate-spec.mjs
  Фаза 5 — Семантика · LLM (5-semantics)
  Фаза 6 — Adversarial · LLM (6-adversarial)
  Фаза 7 — Simulation · LLM (7-simulation)
  Фаза 8 — Regeneration test · LLM (8-regeneration)
  Фаза 9 — Repair loop · LLM (9-repair)
  Фаза 10 — External audit · LLM (10-external-audit)

Детерминированное ядро (Фаза 0):
  BASELINE SCORE 85/100 (порог 70)
    Completeness: weight 30% → normalized 94 → weighted 28
    Clarity: weight 25% → normalized 80 → weighted 20
    Testability: weight 25% → normalized 72 → weighted 18
    Consistency: weight 10% → normalized 100 → weighted 10
    Scope: weight 10% → normalized 90 → weighted 9

Фаза 1: 15 проверок — 13 PASS / 1 FAIL / 1 WARN
    WARN m07 placeholder-маркеры (TBD/TODO/<id>/[citation needed]) (<\s*(?:id|spec-id|url|path|name|value)\s*> @.project/specs/040-spec-chain.md:94)
    FAIL m11 критерии приёмки: наличие и проверяемость каждого (критерий 10 не содержит проверяемого признака @.project/specs/040-spec-chain.md:175)

Фаза 4: декомпозиция есть; сироты: критерии 0, цели 0, задачи 0; hard-fail false

LLM-раннер для Фаз 2, 3, 5–10: dsh --profile headless (переопределяется --llm-cmd)
Каталог прогона по умолчанию: .project/drafts/spec-040-enrich

dry-run: правки не применялись, файлы не создавались.
```

Проверено, что dry-run не трогает дерево: `git status --porcelain` до и после
совпадает побайтово, каталог `.project/drafts/spec-040-enrich/` не создан.

## 4. Прогон на ad-hoc спеке с 3 дефектами (score delta > 0)

Фикстура `drafts/_mas-results/spec-040/t4-cli/999-ad-hoc-enrich-test.md`
(нигде, кроме этого каталога, не встречается). Дефекты выбраны так, чтобы
детектироваться, но не давать hard-fail ядра (по факту t1: exit 1 дают только
сироты traceability и нечитаемый frontmatter m01/m02) — иначе конвейер
остановился бы до LLM-фаз.

| # | Дефект в фикстуре | Проверка ядра | Как снят |
|---|---|---|---|
| D1 | заглушка `Порог спеки: TBD.` (стр. 22) | m07 WARN | Фаза 9: `Порог спеки: TBD.` → `Порог спеки: 70 (baseline score).` |
| D2 | несуществующий путь `src/lib/nonexistent-module.ts` (стр. 34) | m06 FAIL | Фаза 3: → `src/store/quizStore.ts` (файл есть в репо) |
| D3 | критерий 3 «Фабрика работает корректно» без проверяемого признака (стр. 65) | m11 FAIL | Фаза 5: → `` `node .project/scripts/validate-spec.mjs 999` печатает score в отчёте прогона, delta > 0 `` |

Команда и результат:

```
$ npm run spec:enrich -- drafts/_mas-results/spec-040/t4-cli/999-ad-hoc-enrich-test.md \
    --out drafts/_mas-results/spec-040/t4-cli/run \
    --llm-cmd "node drafts/_mas-results/spec-040/t4-cli/stub-llm.mjs"

Фаза 0 — Baseline score: 92/100 (порог 70)
Фаза 1 — 15 механических проверок: 12 PASS / 2 FAIL / 1 WARN
Фаза 4 — Traceability: сироты 0; hard-fail false
  Фаза 2 — Research + enrichment: ok (model: stub-llm-v1)
  Фаза 3 — Fact-check против репозитория: ok (model: stub-llm-v1)
  Фаза 5 — Семантика: ok (model: stub-llm-v1)
  Фаза 6 — Adversarial: ok (model: stub-critic-1)
  Фаза 7 — Simulation: ok (model: stub-simulator-1)
  Фаза 8 — Regeneration test: ok (model: stub-blind-1)
  Фаза 9 — Repair loop: ok (model: stub-llm-v1)
  Фаза 9 — Repair loop: warn (model: stub-llm-v1)
  Фаза 10 — External audit: ok (model: stub-auditor-1)

Score: 92 → 97 (delta +5)
LLM-вызовов в логе: 9 (drafts/_mas-results/spec-040/t4-cli/run/run-log.jsonl)
Правок применено: 4
Итог: прогон завершён
exit=0
```

Независимая проверка результата тем же ядром (`validate-before.json` /
`validate-after.json` в каталоге тестов):

```
D1 m07: WARN -> PASS | D2 m06: FAIL -> PASS | D3 m11: FAIL -> PASS
phase1: 12P/2F/1W -> 15P/0F/0W
score:  92 -> 97 (Testability 20 -> 25)
exit:   0 -> 0
```

Applied diff (из `run/report.md`, раздел «Правки спеки»):

```
- фаза 2-research:  edge-case + пометка [enriched: URL|tier|дата]
- фаза 3-factcheck: `src/lib/nonexistent-module.ts` → `src/store/quizStore.ts`
- фаза 5-semantics: `3. Фабрика работает корректно (задача t1).` → `3. `node .project/scripts/validate-spec.mjs 999` … delta > 0 (задача t1).`
- фаза 9-repair#1:  `Порог спеки: TBD.` → `Порог спеки: 70 (baseline score).`
```

Repair loop: итерация 1 — `accepted` (97 → 97), итерация 2 — `no-edits`
(стаб видит, что заглушки уже нет) → цикл завершён за 2 вызова из 3 разрешённых.
Снимки: `run/repair-1/spec-before.md`, `spec-accepted.md`, `score-before.json`.

## 5. Формат лога LLM-вызовов

`run-log.jsonl` — 9 записей на 8 фаз (Фаза 9 вызвана дважды). Пример
успешного вызова и вызова при недоступном раннере:

```json
{"phase":"6-adversarial","runner":"node drafts/_mas-results/spec-040/t4-cli/stub-llm.mjs","model":"stub-critic-1","prompt_hash":"sha256:0b887a09…","timestamp":"2026-10-01T01:58:58.077Z","status":"ok","iteration":1,"prompt":"…/prompts/phase-6-adversarial.prompt.md","summary":"5 атак, 2 findings"}
{"phase":"2-research","runner":"definitely-missing-runner-xyz","model":null,"prompt_hash":"sha256:e513d607…","timestamp":"2026-10-01T02:00:31.138Z","status":"skipped","iteration":1,"prompt":"…/prompts/phase-2-research.prompt.md","reason":"раннер не найден: definitely-missing-runner-xyz"}
```

Покрытие фаз в `run/run-log.jsonl`:
`2-research, 3-factcheck, 5-semantics, 6-adversarial, 7-simulation,
8-regeneration, 9-repair (×2), 10-external-audit`. Обязательные поля
(`phase`, `runner`, `prompt_hash`, `timestamp`, `status`) присутствуют в каждой
записи; Фаза 10 — отдельная запись с отдельным `model` (`stub-auditor-1`) и
отдельным промптом (findings Фазы 6 в её промпт не передаются).

## 6. Ветка «раннер недоступен» (WARN, exit 0)

```
$ npm run spec:enrich -- …/999-ad-hoc-enrich-test.md --out …/run-nollm --llm-cmd definitely-missing-runner-xyz
  Фаза 2 … Фаза 10 — WARN [llm: unavailable — раннер не найден: definitely-missing-runner-xyz]
Score: 92 → 92 (delta +0)
LLM-вызовов в логе: 8 (…/run-nollm/run-log.jsonl)
exit=0
```

Все 8 промпт-паков сохранены в `run-nollm/prompts/`, счётчик правок = 0,
спека не изменена, все записи лога имеют `status: "skipped"` + `reason`.
Детерминированные фазы при этом отработали штатно (baseline 92, hard-fail false).

## 7. Дополнительные сценарии (проверка защиты от gaming и rollback)

**A. Падение score в repair loop → rollback** (фикстура `997-ad-hoc-regress.md`,
стаб в режиме `regress` подсовывает ломающую правку):

```
| итерация | решение | score до | score после | правок |
| 1 | reverted | 97 | 69 | 1 |
| 2 | reverted | 97 | 69 | 1 |
| 3 | reverted | 97 | 69 | 1 |
WARN Фаза 9, итерация 1..3: score упал 97 → 69, правки откатаны (rollback)
Score: 92 → 97; Правок применено: 3; exit=0
```

Три итерации исчерпаны (жёсткий лимит соблюдён), ни одна ломающая правка не
осталась в тексте: в финале `m06`/`m11` — PASS (правки фаз 3 и 5), `m07` — WARN
(правка Фазы 9 так и не была принята).

**B. Specification gaming → hard-fail + rollback Фазы 9** (фикстура
`998-ad-hoc-intent-gaming.md`, стаб в режиме `intent-change`):

```
  Фаза 10 — External audit: ok (model: stub-auditor-1)
Score: 92 → 97 (delta +5)
Правок применено: 3
WARN Фаза 10: INTENT-CHANGED → hard-fail, правки Фазы 9 откатаны (rollback)
Итог: HARD-FAIL — external audit зафиксировал изменение intent
exit=1
```

В `run-intent/report.md` правка Фазы 9 перенесена в раздел «Откатано (rollback
правок Фазы 9…)», а в самой спеке заглушка `Порог спеки: TBD.` (стр. 22) на
месте: правки фаз 2/3/5 сохранены, правки Фазы 9 откатаны — ровно то поведение,
которое предписывает SKILL.md.

**C. hard-fail детерминированных фаз → STOP, exit != 0** (фикстура
`996-ad-hoc-hardfail.md` с критерием-сиротой):

```
Фаза 4 — Traceability: сироты 1; hard-fail true
STOP: hard-fail детерминированных фаз (Фаза 4 / frontmatter). Правки не применяются.
Сироты: критерий 3 (стр. 65)
exit=1
```

LLM-фазы не запускаются: в `run-hardfail/` только `report.md`,
`score-before.json`, `spec-original.md`; файла `run-log.jsonl` нет.

## 8. package.json

```
$ git diff --stat -- package.json
 package.json | 1 +
 1 file changed, 1 insertion(+)
```

Единственная добавленная строка — `"spec:enrich": "node .project/scripts/enrich-spec.mjs",`
(соседние строки не переформатированы, JSON валиден, других диффов нет).

## 9. Проверки (verify из контракта)

| Команда | Результат |
|---|---|
| `node --check .project/scripts/enrich-spec.mjs` | exit 0 |
| `npm run spec:enrich -- .project/specs/040-spec-chain.md --dry-run` | exit 0, 11 фаз, baseline 85/100, дерево не изменено |
| `node --input-type=commonjs -e "…p.scripts['spec:enrich']…"` | напечатано `node .project/scripts/enrich-spec.mjs`, exit 0 |
| `npm run spec:enrich -- --help` | назначение, 5 аргументов, каталог прогона по умолчанию, exit 0 |

## 10. Known limitations / что важно знать qc

1. **Реальный LLM-раннер не запускался** (см. §2). `--llm-cmd` — штатная точка
   подмены, но качество модельных фаз этим прогоном не проверено.
2. Формат ответа раннера (JSON с `edits`/`findings`/`verdict`) — контракт,
   который CLI диктует раннеру через промпт-пак. Реальный `dsh --profile
   headless` такого контракта не знает: для боевого прогона нужен раннер-адаптер
   или промпт-обёртка. Это зафиксировано в `--help` и в промпт-паках, но
   остаётся ограничением: CLI не «общается» с интерактивным dsh из коробки.
3. Правки применяются только литеральной заменой уникальной подстроки. Реальный
   LLM часто отдаёт переписанные абзацы целиком — тогда правка не применяется и
   попадает в «Не применены» (диагностика есть, тихой потери нет).
4. Фаза 9 в реализации делает не «переписывание», а итеративные минимальные
   правки; жёсткий лимит 3 итерации и правило oscillation реализованы, но сценарий
   STOP (oscillation) отдельным прогоном не демонстрировался (демонстрировался
   более сильный случай — rollback при падении score).
5. В ходе самотестирования найдены и исправлены два собственных дефекта:
   (a) промпт-пак не содержал текст спеки (`ctx.specText` не заполнялся) — фазы
   получали пустой вход; (b) номер итерации repair loop не пробрасывался в
   `runLlmPhase`, из-за чего второй вызов логировался как итерация 1. Оба
   воспроизведены, исправлены и перепроверены (в логе теперь `iteration: 2` и
   `phase-9-repair.iter2.prompt.md`).
6. Артефакты тестов живут только в `drafts/_mas-results/spec-040/t4-cli/`
   (фикстуры 996/997/998/999, `pristine/`, `stub-llm.mjs`, каталоги
   `run`, `run-nollm`, `run-regress`, `run-intent`, `run-hardfail`), в
   `.project/specs/**` и `docs/spec-chain/**` правок нет.
