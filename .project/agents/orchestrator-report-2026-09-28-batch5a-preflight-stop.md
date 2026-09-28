# Orchestrator — pre-flight STOP: batch 5A (spec 015)

**Дата:** 2026-09-28 · **Команда капитана:** «закоммитить batch 5A, push не делать»
**Результат:** STOP на pre-flight. Ни одна строка в `src/data/**` не изменена, коммитов нет.

## 1. Pre-flight — что проверено

| # | Проверка | Ожидание | Факт | Итог |
|---|---|---|---|---|
| 1 | `git log --oneline -3` → HEAD | зафиксировать | `553330b chore(state): converge after spec 015` | ✅ |
| 2 | `npm run sync:check` | exit 0 | exit 0, «sync: ok (check)» | ✅ |
| 3 | дерево tracked чистое | чисто | только `??` (untracked), tracked diff пуст | ✅ |
| 4 | `.project/drafts/batch-5a-preview.md` | есть | есть, 15255 B | ✅ |
| 5 | 6 кандидатов в `.project/drafts/` | `tf_011..tf_016` | `.project/drafts/batch-5a-candidates.json`, ровно 6, id `tf_011..tf_016` | ✅ |
| 6 | формат кандидатов 1:1 к банку | совпадает | наборы ключей идентичны: `id,topic,difficulty,objective_domain,subtopic,question,options,explanation`; опция `text,correct`; 4 опции, ровно 1 верная у всех 6; `topic=text_files` у всех 6 | ✅ |
| 7 | `npm run qc` (базлайн) | exit 0 | exit 0, **Total 206**, Fails 0, Warns 22 | ✅ |
| 8 | `.project/DOD.md`, `ORCH-RULES.md` rule 10/11 | прочитано | прочитано | ✅ |
| 9 | **структура `src/data/questions/text_files/` для «1:1 копии»** | каталог с `tf_*.json` | **путь не существует** | ❌ **РАСХОЖДЕНИЕ** |

## 2. Расхождение (единственное, но блокирующее)

Команда задаёт интеграцию **по одному файлу на вопрос** в каталог:

```
src/data/questions/text_files/tf_011.json … tf_016.json      ← из команды
git add src/data/questions/text_files/tf_011..tf_016.json   ← шаг 4
```

Фактическая раскладка банка — **один агрегирующий файл на тему**, каталогов тем нет:

- `src/data/questions/text_files.json` — массив из 10 объектов (`tf_001..tf_010`), не каталог;
- `git ls-files src/data/questions/*` — 14 файлов тем + `_order.json` + `_topics.json` + `index.ts` + 2 теста; ни одного `tf_0NN.json`;
- `src/data/questions/index.ts` строки 35–50: ровно 14 статических `import('./<topic>.json')`, `text_files: () => import('./text_files.json')`. Каталог `text_files/` не читается **никем** — новые файлы туда попали бы в мёртвую зону;
- `Get-ChildItem -Recurse src -Filter tf_0*.json` → 0 результатов;
- `Test-Path src/data/questions/text_files/` → `False`.

**Почему это не косметика.** Значит, «формат — по образцу существующих `src/data/questions/text_files/tf_*.json`» из pre-flight проверить нечем (образца не существует — проверено косвенно, через `text_files.json`: наборы ключей совпали, см. п.1.6). А выполнение шага 2 как написано дало бы: 6 осиротевших файлов + банк **206 → 206** → гейт `qc` «Total 212» красный, `_topics.json` не изменится. То есть цель «206 → 212» недостижима по указанному пути.

**Внутреннее противоречие источников.** Команда капитана расходится с собственной одобренной спекой 015 и с превью:

- `.project/specs/015-batch5a-text-files.md` (строки 43–46): «дописать вопросы в `src/data/questions/text_files.json`, дополнить `_order.json`»;
- `.project/drafts/batch-5a-preview.md` §6 (строки 210–211): «дописать в `src/data/questions/text_files.json` (порядок массива)»;
- каноническая практика прошлого батча: `.project/drafts/m2.9-batch4-integrate.mjs` → `BANK_DIR/file_management.json` (агрегат), а не каталог.

То есть спека, превью и прецедент согласованно указывают на `text_files.json`, а шаги 2/4 команды — на несуществующий каталог. Правило pre-flight «STOP при расхождении» применено.

## 3. Что НЕ сделано (сознательно)

- Не создан `src/data/questions/text_files/` и не записаны `tf_011..tf_016.json` — это сломало бы цель (банк не вырос бы).
- Не тронут `src/data/**` — ни строки. `git status` tracked-часть осталась пустой.
- Нет коммитов: ни `feat(bank)…`, ни `chore(state)…`, ни `docs(spec)…`.
- Spec 015 не переведена в `done` (нет SHA интеграционного коммита).
- Spec 016 **не создана** — она часть той же цепочки и была бы закоммичена в дерево поверх незавершённой интеграции.
- `git push` не выполнялся (правило 10 — и по команде «push не делать», и потому что пушить нечего).
- `sync.mjs`, `.project/contracts/**`, `_order.json`, `tools/**` — не тронуты.

## 4. Что предлагается (ждёт одной строки подтверждения)

Единственная правка к команде — адрес интеграции. Остальные шаги 3–7 исполняются как написано:

```
Заменить:  src/data/questions/text_files/tf_011..tf_016.json
На:        src/data/questions/text_files.json          (append в конец массива)
И:         src/data/questions/_order.json              (append 6 id в САМЫЙ КОНЕЦ,
                                                        без сортировки, HANDOFF §7.1)

git add src/data/questions/text_files.json src/data/questions/_order.json
```

Всё остальное без изменений: `typecheck` → `test:run` → `build` → `qc (Total 212, Fails 0)` → `shuffle-bank:check` → `sync:check`, затем два коммита (batch / converge), spec 015 → `done`, spec 016 → `draft`, push — skip.

Также прошу подтвердить один момент интерфейса, который команда не покрывает: `_topics.json` и `docs/` пересчитываются производными (`npm run manifest` / `npm run state:update` / `npm run sync`) — при варианте «как написано» они не упомянуты в `git add`. Предлагаю взять их из `npm run sync`, как в спеке 015 (пункт 3 превью §6: `npm run manifest` → `212, text_files: 16`).

## Блокеры

1. Расхождение пути интеграции (п.2) — правка команды или подтверждение исправленного адреса.
2. `_topics.json` / `docs/index.html` не названы в шагах 2–4 команды, хотя банк-тотал берётся оттуда (`getBankTotal()` читает `_topics.json`).

Инвариант цели **не нарушен**: банк 206, гейты зелёные, дерево tracked чистое, `HEAD = 553330b`.
