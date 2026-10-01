# spec 039 / t4 — отчёт: интеграция (_order.json +4, _topics.json, shuffle, полные гейты)

- task: `t4`, attempt_id `fe042988-241b-44e5-aad6-37575f114ade`, member `writer-software`
- предусловие: t1, t2, t3 — completed (verdict pass у всех трёх)
- базовый HEAD: `0abd658`
- write-скоуп t4: `src/data/questions/_order.json`, `src/data/questions/_topics.json`,
  отчёты/артефакты `.project/drafts/spec-039-t4-*`
- НЕ делалось (запрет задачи/brief §2): `npm run sync`, `state:update`, коммит, push,
  правки `tools/**`, правки файлов тем (кроме манифестов)

## verdict

```
verdict: pass
files: src/data/questions/_order.json, src/data/questions/_topics.json,
       .project/drafts/spec-039-t4-report.md, .project/drafts/spec-039-t4-haladyna-batch.json
```

**Одна оговорка уровня прогона** (см. §4): шаг (7) `node tools/haladyna.cjs all --auto-only`
даёт `exit 1` — 228/229 auto-perfect, единственный сбой `lsl_009` (тема `local_storage`,
AUTO[5] — длина верной опции). Это **предсуществующее** состояние банка (на снимке HEAD —
224/225, `exit 1`), а `local_storage` — одна из 9 тем, которые brief §2 запрещает трогать.
Все гейты прогона из цели команды при этом зелёные (§2). Решение — за капитаном.

## 1. SHA256 манифестов до/после

| файл | до | после |
|---|---|---|
| `_order.json` | `0A1DF3556045FD0579F6C8CF73E8996DD3944893E2201C9505C41887EFA006E6` | `6AED065BEF8D1208F0274F03D4D52980DCA08AFAAED4A4100298CFB0E0598E47` |
| `_topics.json` | (был `total 225`) | `9D359C83A8AE4B527BD32EF60E5197FB7F4E8328CB899E8605DAADDC11966E55` |

Байтовые инварианты обоих манифестов (после записи):

```
node -e "..."
_order.json bytes=2802 bom=false cr=false finalLF=true
_topics.json bytes=392 bom=false cr=false finalLF=true
```

## 2. Гейты (сырые команды + exit-коды)

### 2.1 `npm run order:add` ×4 (append, по одному вызову) — exit 0 каждый

```
$ npm run order:add ntw_017
OK: appended ntw_017 to _order.json (225 -> 226 ids)
tail: msw_015, msw_016, ntw_017
A1=0

$ npm run order:add ntw_018
OK: appended ntw_018 to _order.json (226 -> 227 ids)
tail: msw_016, ntw_017, ntw_018
A2=0

$ npm run order:add ug_019
OK: appended ug_019 to _order.json (227 -> 228 ids)
tail: ntw_017, ntw_018, ug_019
A3=0

$ npm run order:add ug_020
OK: appended ug_020 to _order.json (228 -> 229 ids)
tail: ntw_018, ug_019, ug_020
A4=0

ORDER_COUNT=229
ORDER_TAIL=msw_015, msw_016, ntw_017, ntw_018, ug_019, ug_020
```

Диф `_order.json` — ровно одна вставка в конец, остальные 225 id не сдвинуты:

```
$ git diff -U0 -- src/data/questions/_order.json
@@ -226 +226,5 @@
-  "msw_016"
+  "msw_016",
+  "ntw_017",
+  "ntw_018",
+  "ug_019",
+  "ug_020"
```

### 2.2 `npm run manifest` — exit 0

```
$ npm run manifest
> node tools/gen-topics-manifest.mjs
OK: 229 questions, 14 topics
MANIFEST_EXIT=0
```

`_topics.json` после регенерации (не ручная правка):

```
{
  "total": 229,
  "byTopic": {
    "deploy_systems": 13, "essential_tools": 13, "file_management": 18,
    "file_permissions": 19, "file_systems": 14, "local_storage": 13,
    "manage_software": 16, "networking": 18, "process_management": 17,
    "running_systems": 16, "security": 20, "shell_scripts": 16,
    "text_files": 16, "users_groups": 20
  }
}
```

```
$ git diff -U0 -- src/data/questions/_topics.json
@@ -2 +2 @@
-  "total": 225,
+  "total": 229,
@@ -11 +11 @@
-    "networking": 16,
+    "networking": 18,
@@ -17 +17 @@
-    "users_groups": 18
+    "users_groups": 20
```

Изменены ровно 3 числа: total 225→229, networking 16→18, users_groups 18→20.
Остальные 12 тем не менялись.

### 2.3 `npm run order:check` — exit 0

```
$ npm run order:check
> node tools/order-manifest.mjs --check
OK: _order.json matches 229 ids from 14 topic files
ORDER_CHECK_EXIT=0
```

### 2.4 `npm run shuffle-bank:check` — exit 0 (правки порядка опций НЕ потребовались)

```
$ npm run shuffle-bank:check
| topic | total | pos0 | pos1 | pos2 | pos3 |
|---|---|---|---|---|---|
| deploy_systems         | 13    | 5    | 4    | 3    | 1    |
| essential_tools        | 13    | 3    | 3    | 4    | 3    |
| file_management        | 18    | 5    | 2    | 4    | 7    |
| file_permissions       | 19    | 5    | 3    | 3    | 8    |
| file_systems           | 14    | 5    | 4    | 3    | 2    |
| local_storage          | 13    | 3    | 3    | 4    | 3    |
| manage_software        | 16    | 5    | 2    | 2    | 7    |
| networking             | 18    | 7    | 2    | 4    | 5    |
| process_management     | 17    | 2    | 5    | 4    | 6    |
| running_systems        | 16    | 4    | 6    | 3    | 3    |
| security               | 20    | 7    | 3    | 3    | 7    |
| shell_scripts          | 16    | 8    | 3    | 3    | 2    |
| text_files             | 16    | 5    | 4    | 5    | 2    |
| users_groups           | 20    | 5    | 7    | 3    | 5    |
| BANK                   | 229   | 69   | 51   | 48   | 61   |
SHUFFLE_CHECK_EXIT=0
```

WARN-строк нет, ни одна тема/банк не превышает 60% на позицию. Поскольку check зелёный,
`npm run shuffle-bank --apply` **не запускался**: ни один `options` в этом задании не
переставлялся (единственные изменения в файлах тем — правки t1–t3, см. `git diff --stat`).

### 2.5 `npm run qc` — exit 0

```
$ npm run qc
Total: 229 questions
Fails: 0, Warns: 22
WARN by category: absolute=2 length-hint=2 ratio=16 stopword=2
RATIO by class (unit=chars, символы): sentences=99 token=101 mixed=29
QC_EXIT=0
```

`Warns 22` = baseline (brief §1), ни одного WARN у 15 правленых/новых id.

### 2.6 `npm run test:run` — exit 0

```
$ npm run test:run
 ✓ src/data/questions/__tests__/loaders-invariant.test.ts (5 tests) 666ms
   ✓ bank loader invariant (files ⇔ LOADERS ⇔ _order.json ⇔ _topics.json) > loadAll() resolves every id of _order.json, in order
 ✓ src/data/questions/__tests__/positional-distribution.test.ts (4 tests)
 ✓ tools/__tests__/order-manifest.test.mjs (21 tests)
 Test Files  28 passed (28)
      Tests  198 passed (198)
TEST_RUN_EXIT=0
```

`loaders-invariant` (файлы ⇔ `_order.json` ⇔ `_topics.json`) и
`positional-distribution` — зелёные, т.е. интеграция манифестов подтверждена тестом.

### 2.7 `npm run typecheck` — exit 0

```
$ npm run typecheck
> tsc --noEmit -p tsconfig.app.json
TYPECHECK_EXIT=0
```

### 2.8 cosine по всем 15 правленым/новым id — exit 0

```
$ node .project/drafts/spec-039-cosine-neighbors.mjs net_001 net_002 net_003 ntw_017 ntw_018 fm_008 fm_011 ug_002 ug_007 fs_004 ug_019 ug_020 ms_004 msw_011 msw_014
bank=229 threshold=0.8
ok     net_001  max=0.7614  ntw_014:0.7614 ntw_018:0.6863 ntw_017:0.5980
ok     net_002  max=0.6488  pm_009:0.6488 fm_007:0.6334 ls_004:0.6293
ok     net_003  max=0.7587  net_006:0.7587 ms_008:0.6512 ntw_012:0.6458
ok     ntw_017  max=0.7701  ntw_018:0.7701 net_001:0.5980 et_009:0.5919
ok     ntw_018  max=0.7701  ntw_017:0.7701 net_001:0.6863 sec_005:0.6535
ok     fm_008  max=0.5942  fp_009:0.5942 ls_004:0.5898 ug_004:0.5857
ok     fm_011  max=0.7391  et_013:0.7391 fm_004:0.6708 fm_001:0.6107
ok     ug_002  max=0.7424  sh_010:0.7424 fm_007:0.7401 ug_003:0.7206
ok     ug_007  max=0.7535  ug_010:0.7535 ug_018:0.7135 ug_003:0.7094
ok     fs_004  max=0.6413  ls_007:0.6413 lsl_014:0.6105 fs_001:0.6079
ok     ug_019  max=0.7332  sec_018:0.7332 ug_020:0.7072 sec_008:0.6863
ok     ug_020  max=0.7072  ug_019:0.7072 sec_017:0.6638 sec_010:0.6632
ok     ms_004  max=0.7052  ms_002:0.7052 ms_008:0.6700 sh_008:0.6631
ok     msw_011  max=0.7057  msw_014:0.7057 tf_001:0.6130 msw_010:0.6061
ok     msw_014  max=0.7057  msw_011:0.7057 fp_018:0.6500 msw_010:0.6468
checked=15 over_threshold=0
COSINE_EXIT=0
```

### 2.9 Haladyna — см. §4

```
$ node tools/haladyna.cjs all --auto-only
--- 
Perfect (auto 5/5 and semi 3/3): 113/229
Auto-perfect (5/5): 228/229
HALADYNA_ALL_EXIT=1          <-- ОТКЛОНЕНИЕ, см. §4

$ node tools/haladyna.cjs --batch .project/drafts/spec-039-t4-haladyna-batch.json --auto-only
AUTO_FAIL: нет   (×15)
---
Perfect (auto 5/5 and semi 3/3): 8/15
Auto-perfect (5/5): 15/15
HALADYNA_BATCH_EXIT=0
```

## 3. Сводка counts (итог прогона)

| метрика | до (HEAD) | после |
|---|---|---|
| банк (вопросов) | 225 | **229** |
| тем | 14 | 14 |
| `_order.json` id | 225 | **229** (+ntw_017, ntw_018, ug_019, ug_020, append) |
| `_topics.json` total | 225 | **229** |
| networking | 16 | **18** |
| users_groups | 18 | **20** |
| qc Fails / Warns | 0 / 22 | **0 / 22** |
| shuffle BANK (pos0..3) | 66/51/47/61 | **69/51/48/61** |
| test:run | 28 файлов / 198 тестов | **28 / 198** |

Изменённые файлы (`git diff --stat`):

```
 src/data/questions/_order.json          |   6 +-
 src/data/questions/_topics.json         |   6 +-
 src/data/questions/file_management.json |  10 ++--     <- t3
 src/data/questions/file_systems.json    |   2 +-       <- t3
 src/data/questions/manage_software.json |  36 ++++---   <- t1
 src/data/questions/networking.json      |  82 ++++++--  <- t2
 src/data/questions/users_groups.json    | 103 +++++---  <- t3
 7 files changed, 192 insertions(+), 53 deletions(-)
```

В этом задании (t4) под моей подписью изменены только `_order.json` и `_topics.json`
(+ два артефакта отчёта).

## 4. Отклонение: `haladyna all --auto-only` = exit 1 (предсуществующее, вне скоупа)

Единственный AUTO-сбой по всему банку:

```
lsl_009: score=7/10 (auto=4/5, semi=3/3)  |  AUTO_FAIL: [5]
```

AUTO[5] — «длина верной опции > средней длины дистракторов × 1.4»; qc сообщает про тот же
вопрос родственный `WARN lsl_009: correct option > avg distractor by >30% (16 vs 10.7)`.
Это **не** результат spec 039:

- снимок HEAD `0abd658` (225 вопросов, до правок t1–t3), запущенный из `%TEMP%\le-baseline-039`:
  `Perfect 110/225`, `Auto-perfect (5/5): 224/225`, `BASE_HALADYNA_EXIT=1` — т.е. 1 сбой
  AUTO был уже на baseline;
- `lsl_009` лежит в теме `local_storage`, которой spec 039 не касается; brief §2 прямо
  запрещает трогать 9 остальных тем (в т.ч. `local_storage`), а write-скоуп t4 — только
  манифесты, поэтому правка вне моих полномочий;
- долг зафиксирован в проектной документации: `docs/archive/HANDOFF.md:308-311`
  («Новые warns … `lsl_009` (ratio 1.78 + длина верной опции) … приняты осознанно»).

Контроль качества по скоупу spec 039 — чистый: `node tools/haladyna.cjs --batch
.project/drafts/spec-039-t4-haladyna-batch.json --auto-only` (все 15 вопросов t1–t3) →
`Auto-perfect 15/15`, `exit 0`. Файл батча оставлен в `.project/drafts/spec-039-t4-haladyna-batch.json`
для воспроизведения.

**Что нужно от капитана:** либо принять это как предсуществующий вне-скоуповый долг
(тогда шаг (7) задачи в его буквальной формулировке невыполним без нарушения brief §2), либо
открыть отдельную задачу на `lsl_009` вне spec 039. Правки `local_storage` в рамках t4 я не делал.

## 5. Границы (что не делалось)

- `npm run sync`, `npm run state:update` — не запускались (запрет задачи).
- Коммит/push — не делались.
- `tools/**`, `.project/specs/**`, `.project/sync.mjs` — не изменялись.
- Темы, кроме 5 в скоупе прогона, — не изменялись (в `git diff --stat` их нет).

## 6. Итог для output

```
verdict: pass
files: src/data/questions/_order.json, src/data/questions/_topics.json, .project/drafts/spec-039-t4-report.md, .project/drafts/spec-039-t4-haladyna-batch.json
гейты:
  npm run order:add ntw_017|ntw_018|ug_019|ug_020   => exit 0 (225->226->227->228->229; append в конец)
  npm run manifest                                  => exit 0 ("OK: 229 questions, 14 topics")
  npm run order:check                               => exit 0 ("OK: _order.json matches 229 ids from 14 topic files")
  npm run shuffle-bank:check                        => exit 0 (BANK 229 = 69/51/48/61, WARN нет; --apply НЕ запускался)
  npm run qc                                        => exit 0 (Total: 229 questions; Fails: 0, Warns: 22)
  npm run test:run                                  => exit 0 (28 files / 198 tests passed; loaders-invariant и positional-distribution зелёные)
  npm run typecheck                                 => exit 0
  node .project/drafts/spec-039-cosine-neighbors.mjs <15 id> => exit 0 (bank=229 threshold=0.8; checked=15 over_threshold=0; max 0.7701)
  node tools/haladyna.cjs all --auto-only            => exit 1 (228/229; единственный сбой lsl_009 AUTO[5])  <- см. оговорку
  node tools/haladyna.cjs --batch spec-039-t4-haladyna-batch.json --auto-only => exit 0 (Auto-perfect 15/15)
sha256: _order.json 0A1DF355...A006E6 -> 6AED065B...598E47; _topics.json -> 9D359C83A8AE4B527BD32EF60E5197FB7F4E8328CB899E8605DAADDC11966E55
counts: банк 229/14; networking 18; users_groups 20; _order.json 229 id (+4 append)
оговорки: haladyna all exit 1 из-за предсуществующего lsl_009 (local_storage, вне скоупа spec 039; на HEAD 224/225 exit 1) — нужно решение капитана; все гейты прогона из цели команды зелёные
```
