# Orchestrator — push 5A (вариант A) + spec 017 gen-state v2

## 2026-09-28 · Orchestrator · Phase 5, push + инфра-фикс

### Goal

1. Выполнить **A** (подтверждённый капитаном диапазон push: 10 коммитов, включая
   4 ранних docs/state-коммита Phase 5) — один `git push origin main`.
2. Spec 017: привести `tools/gen-state.mjs` к схеме v2 (`state:update` не уничтожает
   v2-ключи, `sync:check` остаётся зелёным, метрики `added_today`/`avg_daily_7d`
   снова обновляются). Time-box 30 минут.
3. Повторный push после фикса (rule 10 explicit).

### Completed

**A — push №1.** `9ce80e2..8505522`, **10 коммитов**, exit 0, `origin/main`
`9ce80e2 → 8505522`. `sync:check` сразу после push — exit 0. Запись правила 11:
`log.md` + authorization trail в `DECISIONS.md` (коммиты `f67c512`, `de71549`).
Перед push капитану был показан STOP с расхождением «6 vs 10» и получено
подтверждение — over-scope не возник.

**Spec 017 — done, time-box соблюдён (fix ≈ 20 минут чистого времени).**
- Реализация: `previousState()` читает прежний файл, свои ключи пишутся **поверх**
  (`{...prevState, ...owned}`) вместо сборки с нуля; `schema_version` = 2, если поля
  нет; потеря любого ключа из `SYNC_OWNED_KEYS` — падение сборки с перечислением;
  `semanticKey()` даёт идемпотентность (метки времени не «тикают» впустую).
- v1-ключи не тронуты: `goal`, `gates` (вкл. `shuffle_bank`), `topics`, `milestones`,
  `issues_open`, `recent_commits`, `last_update` — 7/7.
- `sync.mjs` не изменялся ни на байт; `src/data/**` и `.project/contracts/**` — тоже.

**Замеры (после фикса):**

| проверка | результат |
|---|---|
| `npm run state:update` | **exit 0** |
| ключей sync.mjs сохранено | **9/9 полей v2** (`head`, `specs`, `log_tail`, `last_sync`, `schema_version`, `commits`, `roles`, `products`, `audits`) |
| `schema_version` | **2** |
| `goal.added_today` | **0 → 6** |
| `goal.avg_daily_7d` | **6.57 → 7.43** |
| идемпотентность | прогон №2 **байт-идентичен** прогону №1 (`1FE6CB6D361DDE84…`), в логе `идемпотентно: семантика не изменилась` |
| `sync:check` после `state:update` → `sync` → коммита | **exit 0** |

**Push №2.** `8505522..ec48622`, **7 коммитов**, exit 0, `origin/main = ec48622`.
Trail закрыт записью фактического SHA (`b77c25b` + `5660d89`).

**Финальные гейты на `ec48622`:** `typecheck` 0 · `test:run` 0 (26 файлов / 167
тестов) · `build` 0 · `qc` 0 (**Total 212, Fails 0**, Warns 22) ·
`shuffle-bank:check` 0 · `sync:check` 0. После финальной правки спеки — ещё одна
сходимость + `sync:check` 0 на `35dc55d`.

### Точная формулировка про «`state:update` → `sync:check` exit 0»

Сразу после `state:update`, **до** коммита, `sync:check` даёт **exit 2** — и это
принципиально **не** schema-ошибка. В выводе нет строки про `schema_version`
(проверено); проблемы ровно две, обе легитимные:
`.project/STATE.md` / `docs/index.html` / `.project/SPEC.md` «отстали» (метрики
действительно обновились) и `state.json` «изменён и не закоммичен» (`sync.mjs:1322-1325`).
После `sync` → `git add` → commit gate зелёный: **exit 0**.

Состав первого прогона `state:update` (сверен диффом JSON до/после): изменились
только `last_update`, метки `gates.*.last_run` и окно `recent_commits`
(`de71549,f67c512,8505522,…` → `4fe4abf,337d8d6,de71549,…`) — окно и должно
сдвинуться: в истории появились два новых коммита.

**Остаточная самоссылочность (правило 9, не дефект):** любой новый коммит меняет
`recent_commits`, поэтому `state:update` после коммита снова делает `state.json`
«грязным» — так же, как `sync.mjs` обновляет `head` после не-sync коммита. Лечится
`state:update → sync → commit`. Именно идемпотентность меток времени убирает
бесконечный цикл, который был бы при «тикающих» `last_update` / `last_run`.

### Находки

1. **Копия дашборда не переживает `sync` — наследие, не регрессия фикса.**
   `gen-state.mjs:546-549` копирует `state.json` в `docs/dashboard/state.json`
   (на момент записи байт-идентично, проверено), но следующий `npm run sync`
   перезаписывает `.project/state.json` и legacy-копию не обновляет. Файлы
   расходились **уже до фикса** (на `8505522`: `bcad3965…` ≠ `5bdf3ce3…`); сейчас
   расходятся ровно поля владельца `sync.mjs` — `head`, `specs`, `log_tail`,
   `commits`. Устранение требует правки `sync.mjs` (запрещено заданием) → записано
   находкой в spec 017.
2. **Две строки «HEAD» в `STATE.md`, одна вне volatile-маркеров.** Строка
   «HEAD (закреплён)» в секции «Коммиты банка» не обёрнута маркерами, поэтому сдвиг
   `head` требует дополнительной сходимости (`sync` → commit), тогда как
   одноимённая строка в шапке вырезается гейтом. Это делает правило 9 дороже на
   один коммит в тех задачах, где база сдвинулась. Не чинилось (правка `sync.mjs`
   запрещена) — зафиксировано здесь.
3. **GitHub advisories (информационно):** remote вернул при push
   «52 vulnerabilities on default branch (1 critical, 23 high, 24 moderate, 4 low)»
   с ссылкой на dependabot. К задаче не относится, ничего не менялось; вынесено,
   потому что это первое, что видит капитан на странице репозитория. Вне скоупа
   (`package.json` / зависимости не трогаются без запроса).

### Коммиты (11 сверх `8505522`)

| SHA | subject |
|---|---|
| `f67c512` | docs(rules): record authorized push 5A (rule 10/11 trail) |
| `de71549` | chore(state): converge after push 5A record |
| `337d8d6` | fix(tools): gen-state.mjs preserves schema v2 keys |
| `4fe4abf` | chore(state): converge after spec 017 fix |
| `5706b10` | docs(spec): close 017 as done |
| `f80c65b` | chore(state): converge after spec 017 |
| `ec48622` | chore(state): converge head after spec 017 — **origin/main** |
| `b77c25b` | docs(rules): record push 017 SHA (rule 11 trail) |
| `5660d89` | chore(state): converge after push 017 record |
| `3a4533f` | docs(spec): 017 - precise wording on dashboard copy invariant |
| `35dc55d` | chore(state): converge after spec 017 wording — **local HEAD** |

`origin/main = ec48622` (проверено `ls-remote`); локально впереди на 4 коммита
(trail/wording) — они уйдут следующим авторизованным push.

### Blockers

Нет. Time-box не исчерпан, отклонений от merge-контракта нет.

### Next Steps

1. Промпт на **batch 5B** (контент: approve превью обязателен, правило 6).
2. При желании — отдельная инфра-спека на находку 1 (копия дашборда) и находку 2
   (volatile-маркеры вокруг «HEAD (закреплён)»): обе требуют правки `sync.mjs`,
   поэтому сейчас не трогались.
3. `git push` для 4 локальных коммитов — только отдельной per-command авторизацией
   (правило 10), субъект — orchestrator (правило 11).
