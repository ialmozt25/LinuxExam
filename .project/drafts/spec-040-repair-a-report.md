# spec 040 · t8 (repair A, раунд 2) — отчёт: enrich-spec.mjs + spec-enrich SKILL.md

**Задача:** ремонт Компонента A по находкам qc-раунда 1 (t6, `needs_revision`):
F2 (high), F3 (medium), F6 (medium), F8 (low).
F1 (`sync:check`) и F5 (assignee t7) — вне этого скоупа (операции капитана).
**Attempt:** 1, attempt_id `6f56bf08-e65b-43d3-bf4f-a62af61b2a45`.
**Вердикт автора:** все четыре находки закрыты, ранее подтверждённое поведение
воспроизведено; ложной зелёнки нет — ограничения перечислены в §6.

## 1. Изменённые файлы (файл:строка)

| Файл | Строки | Что сделано |
|---|---|---|
| `.project/scripts/enrich-spec.mjs` | 505–586 | **F2:** `INTENT_SECTION_RES`, `lineOffsets`, `intentRanges`, `lineAt`, `splitIntentEdits` — структурная защита секций «Цель»/«Критерии приёмки» |
| `.project/scripts/enrich-spec.mjs` | 587–625 | **F3:** `ENRICHED_RE`, `ensureEnrichedMarker` — гарантия маркера `[enriched: URL\|tier\|дата]` |
| `.project/scripts/enrich-spec.mjs` | 353–430 | Разделение вызова фазы на `callLlmPhase` (промпт-пак + раннер) и `commitLlmPhase` (патч статуса → run-log → артефакт → stdout), чтобы статус фазы учитывал пост-обработку (F2/F3) |
| `.project/scripts/enrich-spec.mjs` | 710–745 | Отчёт: раздел «Структурная защита intent (F2)» и «Гарантия маркера обогащения (F3)» |
| `.project/scripts/enrich-spec.mjs` | 216–226 | **F8:** таблица exit-кодов в `--help` (`exit 0/1/2` по классам) |
| `.project/scripts/enrich-spec.mjs` | 838–840, 862–864 | **F8:** ошибки окружения (ядро/`SKILL.md` недоступны) → `exit 2` вместо `exit 1` |
| `.project/scripts/enrich-spec.mjs` | 955–990, 1026–1075 | Применение защиты intent и гарантии маркера в основном цикле фаз 2/3/5 и в repair loop |
| `.project/scripts/enrich-spec.mjs` | 1182 строк | Итоговый размер (было 927) |
| `docs/spec-chain/skills/spec-enrich/SKILL.md` | 114–116 | **F2:** класс реакции `intent-protected` в «Уровни реакций» |
| `docs/spec-chain/skills/spec-enrich/SKILL.md` | 121–142 | **F2:** новый раздел «Структурная защита intent (F2)» |
| `docs/spec-chain/skills/spec-enrich/SKILL.md` | 143–158 | **F8:** новый раздел «Таблица exit-кодов по классам отказа (F8)» |
| `docs/spec-chain/skills/spec-enrich/SKILL.md` | 170–182 | **F6:** «Что НЕ влияет на baseline score» — m04/m06/m07/m08/m09/m10 + следствие для delta |
| `docs/spec-chain/skills/spec-enrich/SKILL.md` | 232–242 | **F3:** шаг 8 Фазы 2 «Контрактная гарантия маркера» |
| `docs/spec-chain/skills/spec-enrich/SKILL.md` | 246–252 | **F3:** критерий завершения и режим отказа Фазы 2 |
| `docs/spec-chain/skills/spec-enrich/SKILL.md` | 300–320 | **F2:** Фаза 5 — шаг 6 и режим отказа про класс m11/m13 |
| `docs/spec-chain/skills/spec-enrich/SKILL.md` | 490–515 | **F2:** Фаза 9 — шаг 5, выход (`intent-blocked`), режим отказа |
| `docs/spec-chain/skills/spec-enrich/SKILL.md` | 592 строки | Итоговый размер (было 510; лимит t2 — 300–600), 11 заголовков «### Фаза », LF |
| `.project/drafts/spec-040-repair-a-report.md` | — | этот отчёт |

Артефакты тестов — только в `drafts/_mas-results/spec-040/t8/` (§3).
`.project/scripts/validate-spec.mjs`, `.project/specs/**`,
`docs/spec-chain/skills/run-spec-chain/**`, `package.json` не трогались
(`package.json` — чужая правка из t5: «1 insertion», мой diff по нему пуст).

## 2. Что именно изменено по механикам

### F2 — structural intent guard
- Защищённые секции: `## Цель` и `## Критерии приёмки` (до следующего
  заголовка `#`/`##`). `splitIntentEdits(text, edits)` до применения правок
  проверяет пересечение диапазона `find` с этими секциями.
- Пересечение → правка отбрасывается, фаза получает `status: "warn"`,
  в `run-log.jsonl` пишется `intent_blocked: [{section, find, replace, reason, line}]`,
  в `report.md` — раздел «Структурная защита intent (F2)», в stdout — WARN
  `[intent-protected — секция «…» (стр. N): правка не применена; дефект класса
  m11/m13 требует отдельного решения]`.
- Прогон **не завершается hard-fail** из-за этого; итерация Фазы 9 помечается
  `intent-blocked`.
- Способность Фазы 10 дать `INTENT-CHANGED` + rollback сохранена (проверена
  фикстурой `993`).

### F3 — guarantee of `[enriched: URL|tier|дата]`
- После Фазы 2 CLI проверяет: есть ли `sources` и есть ли в спеке маркер.
- Если маркера нет, а sources есть — CLI сам вставляет строку
  `- <claim> [enriched: <URL>|<tier>|<дата>]` в конец секции «## Источники»,
  фиксирует это как правку `2-research#enrichment-guard` и пишет в run-log
  `enriched_injected: true`, `enriched_marker: "..."`.
- Если вставить нельзя (нет секции «## Источники» либо нет источника с URL) —
  Фаза 2 получает `status: "warn"`, в run-log `enriched_guarantee: "failed"` +
  `enriched_reason`, в консоль WARN `[enriched: not guaranteed — …]`,
  в `report.md` — раздел «Гарантия маркера обогащения (F3)».

### F6 — согласование формулировки с рубрикой
- В SKILL.md (Фаза 0) явно перечислены классы, не влияющие на baseline score:
  `m04`, `m06`, `m07`, `m08`, `m09`, `m10`; перечислены измерения рубрики и
  сказано, что `delta > 0` измеряется по измеримым измерениям, а прогон,
  снявший только `m04`/`m06`/`m07`, даёт delta = 0 — это ожидаемо.
- Формулировка сверена с **фактическим** поведением рубрики на текущем ядре
  (в т.ч. после правок ремонта B): фикстура `991` → `delta = 0` при переходе
  `m04: FAIL→PASS`, `m06: FAIL→PASS`, `m07: WARN→PASS` (97 → 97).

### F8 — единая политика exit-кодов
- Таблица классов сведена в SKILL.md («Таблица exit-кодов по классам отказа (F8)»)
  и в `--help` CLI; коды реализации приведены к таблице: ошибки окружения
  (ядро/спека/`SKILL.md`) → `exit 2`, STOP фаз 0/1/4 → `exit 1` (одинаково в
  apply и `--dry-run`), `INTENT-CHANGED` → `exit 1` + rollback, WARN-классы →
  `exit 0`.
- Согласовано с текущим ядром: hard-fail даёт нечитаемый frontmatter `m01`
  (`severity: hard-fail`) и сироты traceability; `m02` (id/slug) — только
  диагностика (это правка ремонта B, формулировка обновлена).

## 3. Фикстуры (`drafts/_mas-results/spec-040/t8/`)

| Фикстура / стенд | Назначение |
|---|---|
| `stub-llm.mjs` | детерминированный стенд-ин раннера; режимы `fix` (по умолчанию), `criteria-edit`, `intent-change`, `mclass`. Фаза 2 всегда отдаёт `sources` и НЕ отдаёт правку с `[enriched:` — так проверяется гарантия F3 |
| `999-ad-hoc-enrich-test.md` | 3 дефекта вне защищённых секций: заглушка `TBD` (m07 WARN), путь `src/lib/nonexistent-module.ts` (m06 FAIL), vague term «Сборка идёт быстро.» (Clarity 19/25) |
| `994-ad-hoc-criteria-guard.md` | только m11 (критерий без проверяемого признака) — фикстура F2: стаб предлагает правку внутри «## Критерии приёмки» |
| `993-ad-hoc-intent-gaming.md` | те же 3 дефекта + стаб в режиме `intent-change` (Фаза 10 → INTENT-CHANGED) |
| `992-ad-hoc-no-sources-section.md` | нет секции «## Источники» при наличии `sources` — fallback F3 |
| `991-ad-hoc-mclass-only.md` | только m04 (неизвестная зависимость `t9`) + m06 + m07, измеримых дефектов нет — демонстрация F6 (delta = 0) |
| `990-ad-hoc-hardfail.md` | критерий-сирота → hard-fail ядра (проверка STOP и кодов F8) |
| `pristine/` | нетронутые копии для воспроизводимости; `validate-before-*.json` / `validate-after-*.json` — снимки ядра; `run-*/` — каталоги прогонов с `report.md`, `run-log.jsonl`, промпт-паками |

## 4. Вывод «до/после» (сырые прогоны)

### F2, фикстура 994 (правка критерия приёмки)
```
$ npm run spec:enrich -- …/994-ad-hoc-criteria-guard.md --out …/run-994 \
    --llm-cmd "node …/stub-llm.mjs --mode criteria-edit"
Фаза 0 — Baseline score: 92/100 (порог 70)
  Фаза 9 — Repair loop: warn (model: stub-llm-v1)
Score: 92 → 92 (delta +0)
Отклонено структурной защитой intent (F2): 1
WARN [intent-protected — секция «Критерии приёмки» (стр. 61): правка не применена;
дефект класса m11/m13 требует отдельного решения]
Итог: прогон завершён
exit=0
```
- repair-log: `| 1 | intent-blocked | 92 | 92 | 0 |`
- run-log (Фаза 9): `"status":"warn"`, `intent_blocked:[{section:"Критерии приёмки", find:"3. Фабрика работает корректно (задача t1).", line:61}]`
- спека не изменилась: строка 61 осталась `3. Фабрика работает корректно (задача t1).`
- **hard-fail Фазы 10 отсутствует** (exit 0), при этом критерий всё ещё FAIL —
  дефект класса m11/m13 вынесен на отдельное решение.

### F2, фикстура 993 (INTENT-CHANGED сохраняется как hard-fail)
```
Фаза 9 — Repair loop: ok; Фаза 9 — Repair loop: warn; Фаза 10 — External audit: ok (model: stub-auditor-1)
Score: 91 → 97 (delta +6)
WARN Фаза 10: INTENT-CHANGED → hard-fail, правки Фазы 9 откатаны (rollback)
Итог: HARD-FAIL — external audit зафиксировал изменение intent
exit=1
```
- в спеке: правка Фазы 9 (`Порог спеки: TBD.` → `Порог спеки: 70 …`) откатана
  (стр. 21 снова `Порог спеки: TBD.`), а правки фаз 3 и 5 сохранены
  (стр. 22 — измеримая формулировка, стр. 32 — существующий путь).
- в отчёте: раздел «Откатано (rollback правок Фазы 9…)» с этой правкой.

### F3, фикстура 999 (маркер вставляет CLI)
```
Фаза 2 — Research + enrichment: ok (model: stub-llm-v1)
Score: 91 → 97 (delta +6);  Правок применено: 4
Гарантия маркера обогащения (F3): injected
exit=0
```
- спека, стр. 45: `- ESM-модули Node.js [enriched: https://nodejs.org/api/esm.html|Tier 1|2026-10-01]`
- run-log Фазы 2: `"enriched_injected":true`, `"enriched_marker":"[enriched: https://nodejs.org/api/esm.html|Tier 1|2026-10-01]"`
- дефекты 999 закрыты: `m06 FAIL→PASS`, `m07 WARN→PASS`, `Clarity 19→25`,
  `phase1 13P/1F/1W → 15P/0F/0W` (независимая проверка ядром).

### F3, фикстура 992 (fallback: warn + explicit record)
```
Фаза 2 — Research + enrichment: warn (model: stub-llm-v1)
Score: 88 → 94 (delta +6)
Гарантия маркера обогащения (F3): no-section
WARN [enriched: not guaranteed — в спеке нет секции «## Источники»] (Фаза 2)
exit=0
```
- run-log: `"status":"warn"`, `"enriched_guarantee":"failed"`,
  `"enriched_reason":"в спеке нет секции «## Источники»"`.
- `report.md` → раздел «Гарантия маркера обогащения (F3)», п. «статус Фазы 2
  понижен до `warn`».

### F6, фикстура 991 (delta = 0 ожидаемо)
```
Фаза 1 — 15 механических проверок: 12 PASS / 2 FAIL / 1 WARN
Score: 97 → 97 (delta +0)
exit=0
```
- независимая проверка ядром: `m04 FAIL→PASS`, `m06 FAIL→PASS`, `m07 WARN→PASS`,
  score 97 → 97 → **delta 0** — ровно то, что теперь написано в SKILL.md
  (Фаза 0, «Что НЕ влияет на baseline score»).

### F8, коды по классам (прогоны)
```
999 (3 дефекта)                              exit 0
994 (intent-protected)                       exit 0
992 (F3 fallback warn)                       exit 0
991 (m-class only, delta 0)                  exit 0
999 + недоступный раннер (8× WARN, лог skipped, 8 промпт-паков)   exit 0
993 (INTENT-CHANGED → rollback)              exit 1
990 (hard-fail Фазы 4) apply                 exit 1
990 (hard-fail Фазы 4) --dry-run             exit 1
нет аргумента <spec>                         exit 2
несуществующая спека                         exit 2
SKILL.md отсутствует (переименован и возвращён)  exit 2
```
Коды совпадают с таблицей в SKILL.md и в `--help`.

## 5. Таблица «находка → улика»

| Находка | Требование | Улика (команда/файл) | Статус |
|---|---|---|---|
| **F2** | Правки в «Цель»/«Критерии приёмки» не применяются; нет hard-fail Фазы 10; фаза skipped/WARN с пояснением про m11/m13 | Прогон `994` (`--mode criteria-edit`): `Отклонено структурной защитой intent (F2): 1`, `WARN [intent-protected — … m11/m13 требует отдельного решения]`, `exit=0`; repair-log `intent-blocked`; run-log `intent_blocked`; спека не изменена. Код: `splitIntentEdits` (enrich-spec.mjs:555), вызовы :955 и :1026. Документация: SKILL.md:121–142 | ✅ закрыта |
| **F2** (вторая половина) | Фаза 10 всё ещё даёт hard-fail + rollback при ином изменении intent | Прогон `993` (`--mode intent-change`): `intent-blocked` НЕ сработал (правка вне защищённой секции), `WARN Фаза 10: INTENT-CHANGED → hard-fail, правки Фазы 9 откатаны (rollback)`, `exit=1`; в спеке заглушка восстановлена, правки фаз 3/5 сохранены | ✅ закрыта |
| **F3** | CLI сам вставляет `[enriched: <URL>\|<tier>\|<дата>]` либо помечает Фазу 2 warn и фиксирует это в отчёте и run-log; поведение описано в SKILL.md Фазы 2 | Прогон `999`: спека стр. 45 содержит маркер; run-log `enriched_injected:true`; `report.md` → «Гарантия маркера обогащения (F3): injected». Прогон `992`: `no-section`, `status:"warn"`, `enriched_guarantee:"failed"` в run-log + WARN в stdout + раздел в отчёте. Код: `ensureEnrichedMarker` (:598), вызов :974. Документация: SKILL.md:232–252 | ✅ закрыта |
| **F6** | В SKILL.md (Фаза 0) перечислены классы, не влияющие на score; сказано, что delta измеряется по измеримым измерениям; формулировка согласована с рубрикой | SKILL.md:170–182; согласованность доказана прогоном `991`: при `m04/m06/m07 FAIL/WARN→PASS` score 97 → 97 (`delta = 0`) на текущем ядре (verify-снимки `validate-now-pristine991.json` / `validate-now-991.json`) | ✅ закрыта |
| **F8** | Таблица exit-кодов по классам сведена в SKILL.md и выводится в `--help`; фактические коды совпадают | SKILL.md:143–158 и `npm run spec:enrich -- --help` (блок «Таблица exit-кодов по классам отказа», строки `exit 0/1/2`); прогоны §4 (0/0/0/0/0/1/1/1/2/2/2). Код: `runValidate`-ошибки → `exit 2` (:838), `SKILL.md` не найден → `exit 2` (:862) | ✅ закрыта |

## 6. Что не сломано и ограничения

**Не сломано (регрессия проверена после правок SKILL.md):**
- демо «3 дефекта найдены и исправлены, delta > 0»: `999` → `13P/1F/1W → 15P/0F/0W`,
  score 91 → 97 (delta +6), exit 0;
- 11 фаз исполняются (Фазы 2, 3, 5, 6, 7, 8, 9×2, 10 отчитались в `run-999`);
- у Фазы 10 — отдельная запись `10-external-audit` (`model: stub-auditor-1`,
  собственный промпт без findings Фазы 6);
- при недоступном раннере: 8× `WARN [llm: unavailable — …]`, 8 записей
  `status: "skipped"` в run-log, 8 промпт-паков, exit 0 (`run-nollm`);
- SKILL.md: 11 заголовков «### Фаза », 592 строки (лимит 300–600), UTF-8 LF,
  других `### `-заголовков нет; секции Фаз 2, 3, 5–10 сохранили блоки
  «Входы/Шаги/Выход/Критерий завершения/Режим отказа».

**Ограничения (без ложной зелёнки):**
1. Реальный LLM-раннер `dsh --profile headless` не запускался — все LLM-фазы
   прогнаны детерминированным стендом через `--llm-cmd` (как и в t5). Проверен
   протокол конвейера, а не качество модельных суждений.
2. Критерий не «чинится» конвейером by design: дефекты `m11`/`m13` теперь
   явно выносятся на отдельное решение (это и есть выбранный вариант fix из F2,
   второй вариант — вывести критерии из repair loop — зафиксирован в SKILL.md).
3. Правило oscillation (STOP при отсутствии роста score и открытых
   hard-fail/high findings) реализовано, но отдельным прогоном не
   демонстрировалось; демонстрировались более сильные случаи — rollback при
   падении score (t5) и `intent-blocked`.
4. Отсутствие `SKILL.md` проверялось переименованием файла с гарантированным
   возвратом (`finally`); после теста 11 заголовков и 592 строки на месте.
5. `validate-spec.mjs` во время моего attempt правил другой исполнитель
   (ремонт B): формулировки F6/F8 сверены с **текущим** ядром повторным прогоном
   (`delta = 0` для m-class фикстуры; `m01` — единственная hard-fail проверка
   frontmatter). Если ядро изменится ещё раз, эти два абзаца SKILL.md надо
   сверить заново.
