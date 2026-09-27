# Tools audit — 2026-09-27

- HEAD: `1a4950b` (`docs(spec): lifecycle rule + commit_format field`)
- Область: `tools/*`, `.project/sync.mjs`, `package.json` scripts
- Режим: read-only (ни один файл, кроме этого отчёта, не изменён)
- Контекст: 189 вопросов в банке, 14 тем, соло-проект (не production-инфраструктура).
  Серьёзность калибрована по этому масштабу; `docs/dashboard/*` — легаси-артефакт V1–V9.
- Примечание: во время аудита параллельно приземлился коммит `1a4950b`
  (`docs(spec): lifecycle rule + commit_format field`) — он сдвинул HEAD и изменил
  состав рабочего дерева; факты ниже приведены на момент соответствующей команды,
  все выводы перепроверены после сдвига.

Состояние проверяемых инструментов на момент аудита:

| гейт | команда | exit | вывод |
|---|---|---|---|
| qc | `npm run qc` | **0** | `Total: 189 questions`, `Fails: 0, Warns: 16` |
| sync | `npm run sync:check` | **2** | `SYNC DRIFT` (4 пункта, см. C) |

---

## A. qc.cjs — ratio по символам vs порог по словам

### A.1 Что именно измеряется

Единица измерения задаётся вызывающей стороной и не выводится из данных:

- `tools/qc.cjs:13` — `const RATIO_UNIT = 'chars';`
- `tools/qc.cjs:151` — `const r = checkRatio(q.options, RATIO_UNIT);`
- `tools/_lib/ratio.cjs:28-30` — `lengthOf(option, unit)` возвращает `textOf(option).length`
  при `unit === 'chars'` и `wordCount(...)` иначе.
- `tools/_lib/ratio.cjs:3` — комментарий модуля: «Общая библиотека оценки option ratio
  по ЧИСЛУ СЛОВ (не символов)». То есть библиотека по умолчанию (`unit = 'words'`,
  `tools/_lib/ratio.cjs:42` и `:51`) считает по словам, а единственные два её
  потребителя явно переключают её на символы.

### A.2 Как выбирается порог

`tools/_lib/ratio.cjs:32-39`:

```js
// sentences: все опции ≥ 4 слов; token: все ≤ 3 слов; иначе mixed.
function classifyOptions(options) {
  const counts = (options || []).map((o) => wordCount(textOf(o)));
  if (counts.length === 0) return 'mixed';
  if (counts.every((c) => c >= 4)) return 'sentences';
  if (counts.every((c) => c <= 3)) return 'token';
  return 'mixed';
}
```

Пороги (`tools/_lib/ratio.cjs:7-11`):

```js
const RULES = {
  sentences: { threshold: 1.3, warnFrom: 1.25 },
  token: { threshold: 2.0, warnFrom: 1.35 },
  mixed: { threshold: 1.5, warnFrom: 1.35 },
};
```

Проверка (`tools/_lib/ratio.cjs:51-59`): `ratio = max(len)/min(len)` **в символах**,
`verdict='fail'` если `ratio > rule.threshold`, `'warn'` если `> rule.warnFrom`.
Итог: **числитель и знаменатель — символы, а сам порог выбран по числу слов в опциях.**

### A.3 Конкретное расхождение на `fm_016`

`fm_016` (источник: `src/data/questions/file_management.json`) измерен вызовом
того же кода, что использует гейт (`tools/_lib/ratio.cjs`):

| опция | текст | символов | слов |
|---|---|---|---|
| 0 (correct) | `truncate -s 0 data.log` | 22 | 4 |
| 1 | `rm --force -- data.log` | 22 | 4 |
| 2 | `truncate -s 100 data.log` | 24 | 4 |
| 3 | `touch -c -m data.log` | 20 | 4 |

```
classify: sentences
chars : {"type":"sentences","ratio":1.2,"verdict":"ok","threshold":1.3,"unit":"chars"}
words : {"type":"sentences","ratio":1,"verdict":"ok","threshold":1.3,"unit":"words"}
```

- Класс — `sentences` (все 4 опции ≥ 4 слов), значит применимый порог FAIL — **1.30**,
  а не 1.5 из DOD.
- **Текущее значение ratio = 1.2000** (24/20), verdict `ok`.
- Поэтому **сейчас `fm_016` гейт проходит**: прогон `npm run qc` даёт
  `Total: 189 questions` / `Fails: 0, Warns: 16`, exit **0**, `fm_016` в выводе
  отсутствует вообще (ни FAIL, ни WARN). Реворк банка до 1.2000 сработал.

Историческое значение **1.4118 записи DECISIONS.md (2026-09-27, п. 2) в текущем
банке не наблюдается** — я его не могу измерить, потому что версия опций до реворка
в репозитории отсутствует. Соотношение 1.4118 = 24/17 арифметически совместимо с
парой «длинная опция 24 символа / короткая 17 символов», но исходный текст опций
восстановить не из чего: `git log -p src/data/questions/file_management.json` не
содержит промежуточной версии (в коммите `f4e2538` файл уже финальный).
**Не проверено: требует записи** — точная историческая пара символов.
Проверяемое утверждение: при классе `sentences` значение 1.4118 > 1.30 дало бы
`FAIL fm_016: option ratio (sentences) 1.41 > 1.3` с `process.exitCode = 1`
(`tools/qc.cjs:152-153`, `:203`) — то есть формально проходило DOD (≤ 1.5) и валило гейт.

### A.4 Следствие: у Writer'а нет предсказуемости

`npm run qc` печатает только `id` и итоговые числа, но не «какой класс и порог
применён» в сводке. Единственная диагностика класса — текст сообщения FAIL/WARN:

- `tools/qc.cjs:152-156`:
  ```js
  if (r.verdict === 'fail') {
    fail(q.id, `option ratio (${r.type}) ${r.ratio.toFixed(2)} > ${r.threshold}`, 'ratio');
  } else if (r.verdict === 'warn') {
    warn(q.id, `option ratio (${r.type}) ${r.ratio.toFixed(2)} > warn ${RULES[r.type].warnFrom}`, 'ratio');
  }
  ```
- `tools/qc.cjs:200-201` — сводка печатает только категории без класса:
  ```js
  if (fails > 0) console.log(`FAIL by category: ${fmtCats(failByCat)}`);
  if (warns > 0) console.log(`WARN by category: ${fmtCats(warnByCat)}`);
  ```
  В текущем прогоне категория обозначена как `ratio=13`; разбивки «sentences=4,
  token=7, mixed=2» нет. Класс виден только у WARN-строк (`fails` печатаются, но
  сводка их теряет, а `MAX_WARNS_PRINT = 30`, `tools/qc.cjs:40`).

Дополнительно: **DOD.md:9 недоописывает гейт.** «ratio длин опций ≤ 1.5» —
это только *внешняя граница*; фактический порог для преобладающего класса
(`sentences`) — 1.30. Writer, считающий арифметику по DOD, систематически
недопонимает запас. Это уже привело к одному циклу реворка (fm_016).

### A.5 Дублирующая проверка того же ratio в том же файле

`tools/qc.cjs:143-149` содержит легаси-проверку с **другим** порогом:

```js
  // Историческая проверка по символам (грубый порог 2.5) — сохранена.
  const lens = q.options.map(o => o.text.length);
  const minLen = Math.min(...lens);
  if (minLen >= 20) {
    const ratio = Math.max(...lens) / minLen;
    if (ratio > 2.5) warn(q.id, `option length ratio ${ratio.toFixed(2)} > 2.5`, 'ratio-char');
  }
```

- Порог 2.5 не документирован нигде, кроме этого комментария, и не выводится из `RULES`.
- Проверка практически недостижима: следующий же вызов библиотеки ловит `> 2.5`
  как FAIL раньше (пороги 1.30/1.5/2.0), поэтому `ratio-char` WARN не может
  сработать без одновременного `ratio` FAIL — категория в `WARN by category` мертва.
- Обратный случай даёт **противоречивые диагнозы об одном и том же**: для класса
  `token` библиотечный порог 2.0 строже 2.5, поэтому вопрос с ratio 2.2 получает
  два разных вердикта по одной метрике.

---

## B. gen-state.mjs — зависимость от commit message

### B.1 Код, выводящий обе метрики

`tools/gen-state.mjs:97-112`:

```js
function readAddedToday() {
  try {
    const raw = git(['log', '--since=midnight', '--pretty=format:%s']);
    let sum = 0;
    for (const line of raw.split('\n')) {
      const msg = line.trim();
      if (!/^feat\(bank\)/i.test(msg)) continue;
      const m = msg.match(/(\d+)\s+questions?/i);
      if (m) sum += parseInt(m[1], 10);
    }
    return sum;
```

`tools/gen-state.mjs:121-136`:

```js
function readAvgDaily7d() {
  try {
    const raw = git(['log', '--since=7.days.ago', '--pretty=format:%s']);
    let sum = 0;
    for (const line of raw.split('\n')) {
      const msg = line.trim();
      if (!/^feat\(bank\)/i.test(msg)) continue;
      const m = msg.match(/(\d+)\s+questions?/i);
      if (m) sum += parseInt(m[1], 10);
    }
    return (sum / 7).toFixed(2);
```

Значения уходят в `state.goal.added_today` / `avg_daily_7d`
(`tools/gen-state.mjs:526-527` внутри объекта `state`, строки 518-534),
а оттуда — в STATE.md (`tools/gen-state.mjs` их не рендерит; рендерит
`.project/sync.mjs:405-406`).

### B.2 Почему это хрупкая связка

Требуется **одновременно** три условия, ни одно из которых не проверяется:

1. subject начинается ровно с `feat(bank)` (регистр игнорируется);
2. в subject есть фрагмент `<число> question`/`questions`;
3. число означает именно количество *добавленных* вопросов.

Корректный conventional commit, не удовлетворивший п. 1 или 2, **молча даёт 0**:

```
WARN-ов нет, сообщений нет, exit code 0.
          ↓
state.json: {"added_today": 0, "avg_daily_7d": "0.00"}
          ↓
STATE.md: "- Добавлено сегодня: 0", "- Темп (7 дней): 0.00 в день"
```

`try/catch` (`tools/gen-state.mjs:108-111`) спасает только от падения `git`, а не от
несовпадения формата; при `sum = 0` **ничего не логируется**. Это ровно тот сценарий,
который зафиксирован в DECISIONS.md п. 6 (формат из spec 001
`M2.9 batch 4: file_management +6 (183→189)` не матчит оба regex).

Чем гейт это ловит: **ничем**. Зелёный `npm run sync:check` проверяет байтовое
совпадение производных с `state.json`, а не корректность чисел в нём (см. C.4).

### B.3 Дублирование хрупкого regex

Один и тот же парсинг продублирован в двух функциях:

- `tools/gen-state.mjs:103-105` (в `readAddedToday`):
  ```js
      if (!/^feat\(bank\)/i.test(msg)) continue;
      const m = msg.match(/(\d+)\s+questions?/i);
      if (m) sum += parseInt(m[1], 10);
  ```
- `tools/gen-state.mjs:127-129` (в `readAvgDaily7d`) — **посимвольно идентичный** блок.

Фикс формата коммита нужно вносить в две точки; забытая вторая ветка даёт
несогласованные `added_today` и `avg_daily_7d` при одном и том же входе.

### B.4 Окна и арифметика: что происходит на практике

`--since=midnight` и `--since=7.days.ago` интерпретируются `git` в **локальной**
зоне (TZ = +1000, подтверждено `%ad` в `git log`: `2026-09-27 11:45:09 +1000`).

Воспроизведение той же логики regex на реальном `git log`:

```
--since=midnight → sum = 12, hits:
  feat(bank): M2.9 batch 4 - 6 questions on file_management (183->189)   → 6
  feat(bank): M2.9 batch 3 - 6 questions on file_systems                 → 6
--since=7.days.ago → sum = 29 (5 коммитов), avg_daily_7d = "4.14"
```

Сырой `git log --since=midnight --pretty=format:%s` (6 subject'ов):
`docs(spec): lifecycle rule + commit_format field`, `chore(state): sync after M2.9 batch 4 (bank 189)`,
`feat(bank): M2.9 batch 4 - 6 questions on file_management (183->189)`,
`M4.0: solid base — state.json source of truth + sync + dev center`,
`feat(dashboard): V9 - human-readable summary + avg_daily_7d`,
`feat(bank): M2.9 batch 3 - 6 questions on file_systems`.

**Реестр дефектов метрики (все наблюдаемы на живых данных):**

1. **Двойной счёт сегодня.** Метрика сейчас дала бы `added_today = 12`, хотя за
   сутки добавлено 6 вопросов: batch 3 закоммичен в `06:42 +1000`, то есть попал
   в окно «с локальной полуночи». Запись в `state.json` — `"added_today": 6`
   (зафиксирована прогоном в 11:40 `+1000`, т.е. *до* коммита batch 4), то есть
   **текущее опубликованное значение одновременно и устарело, и было посчитано
   по другому окну**. Расхождение 12 vs 6 — прямое следствие того, что окно
   привязано к календарной полуночи, а не к сессии разработки.
2. **Rework-коммит завышает.** `feat(bank): ... rework ... 2 questions ...`
   (или любой feat(bank) с числом) прибавляется к «добавлено», хотя банк не вырос.
3. **Число в сообщении больше одного раза.** `msg.match` без `/g` берёт **первое**
   совпадение: `feat(bank): M2.9 batch 4 - 6 questions (183->189), 189 total` → `6`.
   Требование DECISIONS.md п. 6 «гибрид …`(183->189)`» безопасно только потому, что
   стрелка не подпадает под `(\d+)\s+questions?`; любая формулировка вида
   `6 questions (was 183 questions)` даст тихую ошибку.
4. **`avg_daily_7d` = сумма / 7.** `tools/gen-state.mjs:131`. Пять коммитов за
   ~1.5 суток дают «4.14 в день» — это не темп, а суммарный объём, размазанный по
   неделе. При 29 вопросах за 7 дней цифра формально верна, но как «hero-метрика»
   она нестабильна: она падает/скачет в зависимости от того, попадает ли батч
   в скользящее окно.
5. **Версии с двумя окнами расходятся.** `added_today` (полночь) и `avg_daily_7d`
   (7 суток) считаются по разным определениям одних и тех же данных и не связаны
   друг с другом.

### B.5 Побочные эффекты того же инструмента (найдено здесь)

- **`npm run state:update` завершается 0 даже при красных гейтах.**
  `tools/gen-state.mjs:598-600`:
  ```js
  const failed =
    exits && Object.values(exits).some((c) => c !== 0) ? ' (один или несколько гейтов FAIL)' : '';
  process.stdout.write(`gen-state: итог — ok${failed}\n`);
  ```
  `process.exitCode` выставляется только в `catch` (строка 607). То есть
  `qc`/`typecheck`/`vitest`/`shuffle-bank:check` могут быть FAIL, а скрипт всё равно
  вернёт 0 — в автоматизации это не отличить от успеха.
- **`docs/dashboard/state.json` перезаписывается безусловно**
  (`tools/gen-state.mjs:545-549`, `fs.copyFileSync(STATE_PATH, dashboardPath)`),
  хотя DECISIONS.md п. 7 и spec 001 запрещают трогать `docs/dashboard/*`.
  Шапка файла (строки 7-18) этот побочный эффект в списке источников/записи
  не перечисляет: документировано только `.project/state.json`.
- **Двойной источник правды.** `state.json` объявлен единственным источником
  (`tools/gen-state.mjs:5`), но `goal`, `topics`, `milestones` полностью
  перегенерируются из `_topics.json`/`PLAN.md`, а `head`, `specs`, `log_tail`,
  `spec_commit` пишет `.project/sync.mjs` — то есть `state.json` одновременно
  и выход, и вход, с разными владельцами по полям и без схемы.

---

## C. sync.mjs — предположения о структуре

### C.1 Что предполагается о внешних данных

| Источник | Предположение | Строки |
|---|---|---|
| `.project/state.json` | существует, парсится, содержит поля `head`, `specs`, `log_tail`, `last_sync`, `goal`, `topics` | `READ`: `sync.mjs:185-192`; проверка схемы `:764-766` |
| `src/data/topics.ts` | записи вида `{ key: '<slug>', title: '<человеческое имя>'` — **именно в этом порядке, в одной строке**, одиночные кавычки | `sync.mjs:202` `TOPIC_ENTRY_RE`, `:205-218` |
| `src/data/questions/_topics.json` | обязателен, объект `byTopic` (иначе фолбэк на массив `topics` с `slug`/`count`) | `sync.mjs:221-231` |
| `.project/specs/*.md` | frontmatter `---` начинается **с первой строки**; ключи `id`, `slug`, `status`, `type`, `created`, `updated`, `commit`; статус из фиксированного списка; секции `## Цель`, `## Критерии приёмки`, `## Что НЕ трогать`, `## Превью` | `sync.mjs:268-283`, `:300-333` |
| `git` | присутствует в `PATH`; `rev-parse HEAD` непустой; непустой `git status --porcelain -- <4 пути>` = «не закоммичено» | `sync.mjs:96-98`, `:107-109`, `:174-182` |
| чистота репозитория | `--check` требует, чтобы 4 синхронизируемых пути были **закоммичены**, а производные — байтово равны свежесгенерированным | `sync.mjs:785-788` |

Про фактический regex: он **работает** на текущем файле — измерено 14 совпадений
(`{ key: 'file_permissions', title: 'Права доступа'` → capture `"file_permissions"`,
`"Права доступа"`). Но он держится на порядке и односрочности полей: любая
перестановка (`{ title: ..., key: ... }`), переход на двойные кавычки со сменой
формата, вычисляемые ключи (`[TopicKey.FM]: ...`) или многострочная запись
`key:` и `title:` в разных строках — и `labels` окажется пустым,
`labels.size !== 14` даст WARN (`sync.mjs:214-216`), а **все человеческие имена тем
в STATE.md и docs/index.html молча заменятся на slug'и** (`sync.mjs:245`
`labels.get(slug) || ... || slug`). Exit при этом останется **0**
(WARN идёт в `notes`, `sync.mjs:73`/`:798`).

### C.2 `EXPECTED_TOPIC_COUNT = 14` — что ломается на 15-й теме

`sync.mjs:61` — `const EXPECTED_TOPIC_COUNT = 14;` (дубль того же литерала в
`tools/gen-state.mjs:148`).

Поведение sync.mjs при 15-й теме:

1. `sync.mjs:214-216` — WARN `src/data/topics.ts: тем 15, ожидалось 14`.
2. `buildTopics` (`sync.mjs:233-250`) строит объединение slug'ов из `state.topics`,
   `_topics.json` и `labels` — **15 тем попадут в STATE.md и в центр без ошибки**.
3. `sync.mjs:240-241` — `per_topic_target` берётся из state или пересчитывается
   как `Math.ceil(target/14)` = **Math.ceil(300/14) = 22** — при 15 темах цель
   на тему должна быть 20. STALE, но никто не замечает.
4. `sync.mjs:764-766` — схема `--check` требует только наличия 4 ключей; `topics`
   не проверяется по длине вообще.
5. **Exit code остаётся 0** (и в `--check`, и в обычном режиме): WARN не влияет
   на `process.exitCode`.

Контраст: `tools/gen-state.mjs:167-171` при `entries.length !== 14` **бросает
исключение** (`STOP`) и завершается 1. То есть при добавлении 15-й темы
`npm run state:update` падает, а `npm run sync` / `npm run sync:check` — зелёные.
Два инструмента расходятся в семантике одной и той же константы.

### C.3 Закрепление HEAD (`state.head`) и `movesOnlySyncFiles`

Решение о значении `head` — `sync.mjs:692-703`:

```js
  const pinnedHead = state.head ?? null;
  let head = fullHead;
  if (pinnedHead === null || pinnedHead === undefined) {
    info(`state.head закреплён впервые: ${fullHead}`);
  } else if (movesOnlySyncFiles(pinnedHead)) {
    head = pinnedHead;
  } else {
    info(`база изменилась: head ${pinnedHead} → ${fullHead}`);
  }
```

`movesOnlySyncFiles` — `sync.mjs:111-138`:

```js
const SYNC_ONLY_FILES = new Set([
  '.project/state.json', '.project/STATE.md', '.project/SPEC.md',
  '.project/sync.mjs', 'docs/index.html',
]);
...
  const raw = git(['diff', '--name-only', `${pinned}..HEAD`]);
  ...
  return files.length > 0 && files.every((f) => SYNC_ONLY_FILES.has(f));
```

Ключевая деталь: **`files.length > 0 &&`**. Пустой диф (pinned == предок HEAD,
но между ними ничего) → `false` → `head` перезаписывается на новый `fullHead` →
`before !== after` (`sync.mjs:740-744`) → `state.json` и производные меняются →
HEAD сдвигается от записи в синхронизируемый файл → **новый цикл**. Комментарий
на `sync.mjs:692-694` прямо предупреждает об этой ловушке
(«иначе поле head становится самоссылкой и гейт невозможно закрыть»), но условие
её не покрывает.

Сценарий, дающий застойное значение (наблюдаемый сейчас):

```
f4e2538  feat(bank): M2.9 batch 4 ... (183->189)   ← state.head закреплён здесь
edc5d24  chore(state): sync after M2.9 batch 4     ← только sync-файлы
1a4950b  docs(spec): lifecycle rule + ...          ← .project/specs/README.md !!!
```

`git diff --name-only f4e2538..HEAD` = `[.project/SPEC.md, .project/STATE.md,
docs/index.html, .project/state.json, .project/specs/README.md]`. Последний файл
**не** в `SYNC_ONLY_FILES` → `false` → `state.head` «база изменилась» хочет
обновиться. Дополнительно рабочее дерево грязное (` M
src/data/questions/__tests__/positional-distribution.test.ts` — 16+/12−,
плюс 30 untracked-записей: `.project/drafts/*`, `.project/agents/*`,
`drafts/_mas-results/`), любая запись обновила бы state.json. Итог — зафиксированный `head = f4e2538…`, реальный
`HEAD = 1a4950b`, и `npm run sync:check` краснеет с **exit 2**:

```
SYNC DRIFT: state.json и производные разошлись
  - .project/state.json: head=f4e25381b060be041615f863d63c2c35fc26058a != якорь 1a4950bf29d3d49b92e092dc06abda0b1b9ec5c2 (git HEAD 1a4950bf29d3d49b92e092dc06abda0b1b9ec5c2) — база изменилась, нужен npm run sync
  - .project\STATE.md отстал от state.json — нужен npm run sync
  - .project\SPEC.md отстал от state.json — нужен npm run sync
  - docs\index.html отстал от state.json — нужен npm run sync
```

Практическое следствие: **любой не-синхронизируемый коммит (docs, chore, spec,
правка README) замораживает `head` и требует нового цикла `sync → commit`**,
а в грязном дереве WIP цикл не закрывается вовсе. Заодно `specs[].commit`
рисуется как «—» (`state.json.specs`), а `nextState.specs` — это `specs`
(структуры с полями `id/slug/status/...`, `sync.mjs:317-330`), в которые
`spec_commit` не попадает: SPEC.md печатает `commit` **только из frontmatter**
(spec'ы 001/002 имеют `commit: null` → «—», проверено вычиткой frontmatter).

### C.4 `readSpecCommit()` — вестигиальный код

`sync.mjs:145-159`:

```js
function readSpecCommit(specs) {
  if (!Array.isArray(specs) || specs.length === 0) return null;
  try {
    const raw = git(['log', '-50', '--pretty=format:%h%x09%s']);
    ...
      if (/^M4\.0\b/i.test(subject.trim())) return hash.trim();
```

Факты:

- `git log -50` содержит **ровно один** subject, матчащий `/^M4\.0\b/i`:
  `e01cd02  M4.0: solid base — state.json source of truth + sync + dev center`.
- Текущая практика — conventional commits: `docs(spec): …`, `chore(state): …`,
  `feat(bank): …`. Ни один из них не начинается с `M4.0`.
- Результат пишется в `nextState.spec_commit` лишь **один раз**:
  `sync.mjs:735-737` — `if (specCommit && nextState.specs.length > 0 && !nextState.spec_commit)`
  → после первой записи значение **заморожено навсегда** (`spec_commit: e01cd02`
  в текущем `state.json`).
- Grep по всему репозиторию: `spec_commit` встречается **только** в этих трёх
  строках sync.mjs — нет ни одного читателя (ни в `sync.mjs`, ни в `tools/`,
  ни в `src/`, ни в `docs/index.html`).

**Вывод: `readSpecCommit()` + поле `spec_commit` — мёртвый код.** Он не влияет
ни на один выход, не читается никем и не может обновиться. 15 строк + поле в схеме
`state.json` — чистая цена сопровождения.

### C.5 `--check`: где он даёт ложный дрейф и где пропускает реальную ошибку

Логика (`sync.mjs:762-801`): (1) наличие 4 ключей, (2) сверка `state.head`
с якорем, (3) байтовое сравнение 3 производных, (4) `git status --porcelain`
по 4 путям.

**Ложный дрейф (exit 2 при семантически корректном состоянии):**

1. **Не-синхронизируемый коммит после закрепления.** Именно текущий случай
   (`docs(spec)` тронул `.project/specs/README.md`) — см. C.3. Формально «гейт
   прав», практически это шум: база (банк, темы, спеки как данные) не менялась.
2. **Незакоммиченный WIP в одном из 4 путей.** `diffHead` (`sync.mjs:174-182`)
   не различает staged/unstaged/untracked — любой из 4 файлов в ` M`-состоянии
   даёт «изменены и не закоммичены». При работе «sync запускается до коммита,
   коммит после» это нормальный промежуточный статус.
3. **Первый запуск в свежем worktree.** `state.head` отсутствует → `pinnedHead = null`
   → идёт ветка «закреплён впервые» (`sync.mjs:697-698`), а `problems` уже
   содержит `нет поля "head"` (`sync.mjs:764-766`) — то есть до первого
   `sync` гейт структурно красный.

**Ложное OK (exit 0 при семантически неверном артефакте):**

1. **Схема проверяется только на наличие ключей.** `sync.mjs:764-766` требует
   `'head', 'specs', 'log_tail', 'last_sync'` — и всё. `"goal": null` или
   `"goal": {}` проходит: рендер подставит `'—'`/`NaN` через `??`
   (`sync.mjs:709-716`), а гейт этого не увидит. `goal.current_questions`,
   `topics`, `per_topic_target`, `length(specs) == 14` не валидируются **вообще**.
2. **`--check` сверяет производные с `state.json`, а не с реальностью.**
   Если `state.json.goal.current_questions` руками поставлен в 200 при
   `_topics.json.total = 189`, то STATE.md прочитает 189? Нет —
   прочитает **то, что в state.json** (`current = Number(goal.current_questions ?? …)`,
   `sync.mjs:707`, и `goalView` на `:709-716`). STATE.md/центр покажут 200,
   сверка «производные == сгенерированные» пройдёт, exit 0. Расхождение
   с `_topics.json` не проверяется ни одной из четырёх ступеней.
3. **Хардкод в `renderStateMd`.** `sync.mjs:425-429`:
   ```js
   ...list([
     'M4.0: держать базу зелёной — `npm run sync` после каждой задачи, `npm run sync:check` как гейт.',
     'M2.9: массовая генерация (банк 183/300).',
     'M5: монетизация (Cloudflare Worker, Telegram Stars) — по approve капитана.',
   ]),
   ```
   Строка **425-427** в исходнике, конкретно стейл-фраза — `sync.mjs:427`:
   `'M2.9: массовая генерация (банк 183/300).'`

   **Проверено в артефакте:** `.project/STATE.md`, секция «## Следующие шаги»
   содержит дословно `- M2.9: массовая генерация (банк 183/300).`
   при `- Банк: **189 / 300** (63%)` строкой выше. Это **не производная** —
   это литерал внутри генератора, поэтому `--check` его **не может** поймать
   никогда: генератор выдаёт его же, сравнение с диском всегда совпадает.
   Тот же литерал печатается и в `docs/index.html` (нет — только через
   `renderStateMd`, HTML-рендер этой секции не содержит; в HTML стейл-числа нет).
4. **«Следующие шаги» вообще не выводятся из состояния.** Секция статична,
   значит «что делать дальше» в STATE.md деградирует молча при любом движении
   проекта — это и есть причина, по которой файл «гнил» (мотивация M4.0,
   `sync.mjs:5-7`), просто гниль переехала из ручного текста в литерал генератора.

### C.6 Мелкое, но реальное

- `sync.mjs:193` (`Дрейф производных относительно коммита (гейт --check)`) —
  комментарий-докстринг на самом деле относится к `diffHead`, а не к `--check`.
- `sync.mjs:718` — `const specCommit = readSpecCommit(specs);`: результат
  используется только внутри `if (!nextState.spec_commit)`, поэтому вызов
  бесполезен, начиная со второго прогона (в текущем дереве — всегда).
- `sync.mjs:750` — `renderCenter({... inSync: true })` **захардкожен**: центр
  всегда рисует зелёную точку «синхронизировано» и текст
  `statusText = inSync ? 'синхронизировано' : …` (`sync.mjs:479-480`), даже когда
  `stillDiverged.length > 0` и рантайм сам печатает WARN «не удалось привести
  к источнику» (`sync.mjs:820-824`). Индикатор не несёт информации.
- `sync.mjs:731` / `:742-744` — идемпотентность `last_sync` достигается лишь при
  полном совпадении JSON; при `--check` файл не пишется, поэтому «last_sync»
  в артефакте может быть старее, чем факт последнего успешного гейта (гарантий нет).

---

## D. Tech debt и приоритеты

Легенда: **[D]** — уже зафиксировано в `.project/DECISIONS.md` (2026-09-27 и ранее);
**[N]** — найдено в этом аудите.

| # | инструмент | дефект | влияние | серьёзность | усилие | приоритет |
|---|---|---|---|---|---|---|
| 1 | `tools/gen-state.mjs:97-136` | Метрики `goal.added_today` / `avg_daily_7d` выводятся из subject'ов коммитов (`^feat(bank)` + `(\d+)\s+questions?`); несовпадение формата → молча 0, без warning и без non-zero exit **[D п.6]** | Дашборд/STATE.md публикуют неверный темп; Writer не может предсказать метрику | **high** | M | P1 |
| 2 | `tools/_lib/ratio.cjs:7-11,33-39` + `tools/qc.cjs:13,151` | ratio считается в символах, порог выбирается по числу слов; фактический FAIL-порог 1.30 (класс `sentences`) при DOD «≤ 1.5» **[D п.2]** | Recidiv: уже стоил одного цикла реворка (fm_016); любой Writer считает запас неверно | **high** | M | P1 |
| 3 | `.project/DOD.md:9` | DOD недоописывает гейт: «ratio ≤ 1.5» вместо порогов 1.30/1.5/2.0 по классам **[N]** | Формально зелёный DOD-чек и красный `npm run qc` — расхождение политики и кода | medium | S | P1 |
| 4 | `tools/gen-state.mjs:103-105` vs `:127-129` | Посимвольно идентичный хрупкий regex продублирован в двух функциях **[N]** (следствие [D п.6]) | Фикс формата надо вносить дважды; забытая ветка рассинхронизирует две метрики | medium | S | P1 |
| 5 | `tools/qc.cjs:143-149` | Легаси ratio-чек с недокументированным порогом 2.5 и условием `minLen >= 20`; недостижим (перекрыт строгим библиотечным), даёт противоречивые диагнозы для класса `token` **[N]** | Мёртвая категория `ratio-char` в отчёте + два вердикта по одной метрике | medium | S | P1 |
| 6 | `tools/gen-state.mjs:598-600` | `state:update` возвращает exit 0 даже когда гейты FAIL (exitCode ставится только в `catch`, `:607`) **[N]** | Сломанный гейт не отличим от зелёного в любой автоматизации | medium | S | P2 |
| 7 | `tools/gen-state.mjs:545-549` | Безусловная перезапись `docs/dashboard/state.json` (легаси V1–V9), вопреки spec 001 и DOD-скоупу **[D п.7]** | Случайный коммит легаси-артефакта; скрытый побочный эффект не в шапке файла | medium | S | P2 |
| 8 | `.project/sync.mjs:111-138,692-703` | `state.head` застревает на любом не-sync-коммите; пустой diff → `false` → self-reference цикл (комментарий `:692-694` предупреждает, условие не покрывает) **[N]** | `sync:check` краснеет (сейчас exit 2) после post-sync коммитов; гейт нельзя закрыть в грязном дереве | medium | M | P2 |
| 9 | `.project/sync.mjs:762-801` | `--check` валидирует только **наличие** ключей и байтовое равенство производных, не сверяя `goal`/`topics` с `_topics.json`; exit 0 при семантически неверном артефакте **[N]** | Ложное чувство защищённости: главного инварианта (число вопросов == банк) гейт не проверяет | medium | M | P2 |
| 10 | `.project/sync.mjs:427` | Хардкод `'M2.9: массовая генерация (банк 183/300).'` в `renderStateMd`; **присутствует** в `.project/STATE.md` при `Банк: 189 / 300`; `--check` не может это поймать в принципе **[N]** (продолжение [D п.1] о расхождениях spec↔реальность) | STATE.md/центр врут о следующем шаге; секция «Следующие шаги» не выводится из состояния | medium | S | P2 |
| 11 | `tools/qc.cjs` целиком | Игнорирует CLI-аргументы: `process.argv` в файле **0** вхождений; всегда проверяет весь банк **(проверено: `node tools/qc.cjs --ids fm_016 --topic file_management` → `Total: 189`)** **[D п.3]** | Кандидатов нельзя проверить до интеграции; нужен зеркальный банк во временном каталоге (так и делалось в 2 раундах) | **high** (для pipeline) | M | P1 |
| 12 | `tools/cosine.cjs:404` | Читает только JSON (`JSON.parse`), YAML-выход Writer'а не принимает **[D п.4]** | Лишний конвертирующий шаг в каждом раунде, риск расхождения кандидатов | medium | S | P2 |
| 13 | `tools/shuffle-bank.mjs:248-264` | `--apply` без позиционного аргумента нормализует весь банк: в batch 4 переупорядочил 40 вопросов вне скоупа **[D п.5]** | Диффы вне батча, ревью шума, риск конфликтов | medium | S | P2 |
| 14 | `.project/sync.mjs:145-159`, `:735-737` | `readSpecCommit()` + `state.spec_commit` — мёртвый код: regex `/^M4\.0\b/i` в `git log -50` матчит ровно 1 устаревший не-conventional subject, значение заморожено на `e01cd02`, читателей нет (grep по репо — 0) **[N]** | 15 строк + поле схемы без функции; SPEC.md печатает сотни `—` вместо реальных коммитов спек | low | S | P3 |
| 15 | `.project/sync.mjs:61` vs `tools/gen-state.mjs:148` | `EXPECTED_TOPIC_COUNT = 14` продублирован с **разной семантикой**: gen-state бросает STOP, sync.mjs — только WARN, exit 0; при 15-й теме `per_topic_target` остаётся 22 (должно быть 20) **[N]** | Тихая деградация центра/STATE.md при расширении канона тем | low | S | P3 |
| 16 | все инструменты | Несогласованные CLI/exit-конвенции: `qc.cjs` без usage-кода и без аргументов; `export-pending.mjs:33` — missing arg → 1, но missing file → 2; `gen-topics-manifest.mjs` — коды 3/4/5/6/7; `haladyna.cjs:161` — usage → 1 при `:184` — 2; `shuffle-bank.mjs` и `cosine.cjs` — 2 для usage **[N]** | Нельзя написать общий CI-гейт по exit-коду; разные инструменты по-разному отвечают на «неверный вызов» | low | M | P3 |

Итого: **16** позиций — **2 high, 8 medium, 4 low, 0 blocker**.
Уже задокументированных: № 1, 2, 7, 11, 12, 13 (шесть). Новых: № 3, 4, 5, 6, 8, 9, 10, 14, 15, 16 (десять).

Почему нет blocker'ов: банк (189 вопросов) корректен и защищён (`npm run qc` exit 0,
`shuffle-bank:check` независимо от exit-кода qc считает распределение по всем темам),
а все перечисленные дефекты — в производных витринах, диагностике и предсказуемости
гейта, а не в контенте. Самый дорогой класс последствий здесь — «дорогой раунд
Writer'а, отменённый непредсказуемым порогом» (№ 2) и «метрика, которую нельзя
проверить» (№ 1, 11).

---

## E. Унификация

### E.1 Один модуль ratio с ОДНОЙ единицей измерения и таблицей порогов

**Что меняется**

1. Зафиксировать единицу: `UNIT = 'chars'` — как фактически работает банк сегодня
   (по словам 10 вопросов дают FAIL, включая `fm_003`, который должен остаться WARN —
   комментарий `tools/_lib/ratio.cjs:24-27`, `tools/qc.cjs:8-13`). Убрать
   параметр `unit` из публичного API, оставить его как явный `RATIO_UNIT` экспорт.
2. Оставить таблицу классов, но **сделать её единственным источником порогов**
   и добавить в неё человека-читаемое описание класса:
   ```js
   const RULES = {
     sentences: { threshold: 1.30, warnFrom: 1.25, words: '>=4' },
     token:     { threshold: 2.00, warnFrom: 1.35, words: '<=3' },
     mixed:     { threshold: 1.50, warnFrom: 1.35, words: 'иначе'   },
   };
   ```
3. Один API: `checkRatio(options) -> { class, unit, ratio, threshold, verdict, warnFrom }`
   — без параметра единицы. `classifyOptions`/`computeRatio` перестают быть
   публичными (или помечаются внутренними).
4. Обновить `DOD.md:9`: `ratio (символы, класс sentences) ≤ 1.30; token ≤ 2.00;
   mixed ≤ 1.50 — проверять тем же кодом: node tools/ratio.cjs --ids <id>`.

**Файлы:** `tools/_lib/ratio.cjs`, `tools/qc.cjs:13,143-156`, `tools/haladyna.cjs:23-25,61`,
`.project/DOD.md:9` (новый CLI `tools/ratio.cjs` — маленькая обёртка для Writer'а).

**Риск регрессии:** низкий по существу (пороги не меняются), но **обязательно**
осознать: удаление варианта `'words'` — намеренное сужение API. Единственные
потребители — `qc.cjs` и `haladyna.cjs`, оба уже передают `'chars'`
(`tools/qc.cjs:151`, `tools/haladyna.cjs:61`), поэтому поведение гейта
не изменится. Гейт `npm run qc` обязан остаться `Fails: 0, Warns: 16`.

**Проверка:**
```
npm run qc              # ожидается Fails: 0, Warns: 16, exit 0
node tools/haladyna.cjs all > /dev/null ; echo $?   # до и после — одинаково
node tools/ratio.cjs --ids fm_016        # ожидается sentences / 1.20 / ok / 1.30
```
Плюс одноразовая сверка: прогнать `--ids all` до и после рефакторинга и сравнить
дамп `{id, class, ratio, verdict}` побайтово.

### E.2 Убрать связку метрики с commit message

**Что меняется.** Заменить оба grep'а на структурированный источник. Предложение
(минимум новых сущностей, ноль зависимостей):

- Источник — **история `_topics.json`**, а именно: number of questions приходит из
  `_topics.json.total`, а динамика — из `state.json.history`, append-only массива,
  который пишет `tools/gen-state.mjs` при каждом прогоне:
  ```json
  "history": [ { "at": "2026-09-27T01:40:58.685Z", "total": 189 } ]
  ```
  Тогда:
  - `added_today` = сумма положительных приростов `total` за локальные сутки
    относительно **последней записи предыдущего дня** (а не «все коммиты дня»);
  - `avg_daily_7d` = `(total_last − total_7d_ago) / 7` по фактическому приросту,
    без парсинга чего-либо.
- Точка съёма — та, где скрипт уже читает реальность:
  `tools/gen-state.mjs:473-478` (`currentQuestions = topics.total`). `history`
  дописывается перед записью `state.json` (`:537-539`).

**Что ломается:**
1. `docs/dashboard/*` (легаси V1–V9) читает `goal.added_today`/`avg_daily_7d` как
   строку/число — типы сохраняем (`string` с 2 знаками и `number`), поэтому
   витрина не ломается.
2. Метрика теряет способность видеть «добавлено, но не закоммичено»: теперь она
   измеряет **факт банка**, а не намерение коммита. Это и есть цель, но если
   Captain ожидает «сколько я намеревался добавить по коммитам» — семантика другая.
3. Требуется первый прогон, который создаст `history` с одной точкой:
   `added_today` и `avg_daily_7d` в этот прогон будут `0`/`0.00`. Это ожидаемо
   и должно быть явно отражено в выводе скрипта, а не молча.
4. Достаточность: дневной гранулярности `history` (по прогонам) хватает, но
   она приблизительная — «темп» станет функцией частоты запуска `state:update`.
   Альтернатива для точности: добавить `data/questions/_history.jsonl`
   (append по одной строке на интеграцию). Она честнее, но вводит новую
   ручную дисциплину — а именно от этого проект и уходит.

**Файлы:** `tools/gen-state.mjs:97-136` (удаляются обе функции), `:473-478`, `:518-534`
(новое поле `history`), `:583-584` (шаги вывода), шапка `:7-18`.

**Риск регрессии:** средний — меняется семантика двух публикуемых полей; тестов
на эти поля нет (проверить: `grep -rn "added_today" src/ test* *.ts` — вне
`tools/`/`.project/` вхождений нет), поэтому нужна явная фиксация решения
в `DECISIONS.md`.

**Проверка:**
```
npm run state:update -- --no-gates     # требует записи state.json! запускать только с явного разрешения
node -e "const g=require('./.project/state.json').goal; console.log(g.added_today, g.avg_daily_7d)"
```
Без записи: вынести чистую функцию расчёта в `tools/_lib/metrics.cjs` и покрыть
Vitest-тестом на трёх синтетических историях (рост, реворк без роста, разрыв дат) —
это единственный способ проверить метрику, не трогая `state.json`.

### E.3 `qc.cjs` c аргументами области проверки

**Что меняется.** Добавить разбор аргументов (сейчас `process.argv` не читается
**вообще** — 0 вхождений):
```
node tools/qc.cjs                        # весь банк (текущее поведение)
node tools/qc.cjs --topic file_management
node tools/qc.cjs --file <путь.json>     # схема банка ИЛИ {questions:[...]} (как haladyna --batch)
node tools/qc.cjs --ids fm_016,fm_017
```
- `--topic` / `--ids` фильтруют уже загруженный банк (`tools/qc.cjs:25-32`).
- `--file` читает внешний массив — тогда исчезает вся конструкция «зеркалить банк
  во временный каталог» из DECISIONS.md п. 3.
- Обязательно добавить: при непустой области печатать её в шапке
  (`scope: file / topic=... / ids=...`) и **не** менять exit-семантику (0/1).
- `validateTopic` при `--file` работает по тому же `validTopics`
  (`tools/qc.cjs:33-36`) — иначе кандидат с несуществующей темой пройдёт.

**Файлы:** `tools/qc.cjs` (только добавления: разбор argv + фильтр + шапка),
`package.json` (опционально `"qc:file": "node tools/qc.cjs --file"`).

**Риск регрессии:** низкий. Главное — сохранить агрегаты `Total:`/`Fails:`
в прежнем формате, потому что их парсит `tools/gen-state.mjs:421-422`
(`/Total:\s*(\d+)/`, `/Fails:\s*(\d+)/`) и от них зависит `state.gates.qc`.
Если область непуста, `Total` станет числом проверенных вопросов — это
**изменит** то, что попадёт в `state.gates.qc.total`. Решение: печатать
`Total: N questions (scope: …)` и добавить в gen-state явный флаг полного прогона,
либо оставить `--topic/--file/--ids` несовместимыми с парсингом (проверка
«или полный банк, или явная область» в одном месте).

**Проверка:**
```
npm run qc                                   # Fails: 0, Warns: 16, exit 0, Total: 189
npm run qc -- --ids fm_016                   # Fails: 0, exit 0, Total: 1, класс виден
npm run qc -- --topic file_management        # Total: 18
npm run qc -- --file $env:TEMP/cand.json     # кандидат проверяется без зеркала банка
```
И проверить, что `--ids fm_016` **не** изменил `state.gates.qc`, прогнав
`gen-state` не запускать (запись!) — сверять только stdout qc.

### E.4 Единая CLI/exit-конвенция

**Что меняется.** Ввести общий минимум:

| код | смысл | примеры |
|---|---|---|
| 0 | всё ок | `qc` при `Fails: 0`, `sync` после успешной записи |
| 1 | проверка провалена (содержательный FAIL) | `qc` при `Fails > 0`, `haladyna` при AUTO < 5/5 |
| 2 | дрейф / неверный вызов (usage) / файл не найден | `sync:check` при дрейфе, `shuffle-bank` без режима |

Требуемые правки (точечные, без смены поведения):
- `tools/qc.cjs:203` — `process.exitCode = fails > 0 ? 1 : 0` → оставить 1, добавить
  2 при неизвестном аргументе области (после E.3).
- `tools/haladyna.cjs:161` — usage сейчас `1`, при пустом batch `2` (`:184`) —
  привести к `2` для обоих usage-путей.
- `tools/export-pending.mjs:33,38` (missing arg / bad date) → `2`;
  `:44` (file not found) → `2`; `:52,57` (parse/shape) → оставить `3` или свести к `2`.
- `tools/gen-topics-manifest.mjs:24,34,46` — оставить, но задокументировать, что
  коды `>=3` — «повреждённые данные».
- `tools/gen-state.mjs:598-607` — **главное**: вернуть non-zero, если любой
  гейт-`exit != 0`, и отдельно `0` при успехе; `--no-gates` — не менять.

**Файлы:** `tools/qc.cjs`, `tools/haladyna.cjs`, `tools/export-pending.mjs`,
`tools/gen-state.mjs`, `tools/gen-topics-manifest.mjs` + новый короткий
`tools/README.md` с таблицей кодов (документация, а не код).

**Риск регрессии:** низкий для инструментов и **средний для `gen-state`**:
если `npm run state:update` начнёт возвращать 1 при красном `qc`, любой скрипт,
вызывающий его в цепочке, может остановиться. Это и есть желаемое поведение, но
его нужно катить вместе с решением по `.project/state.json` (см. находку № 7:
побочная запись в `docs/dashboard/`).

**Проверка:** набор позитивных и негативных вызовов, по одному на инструмент:
```
node tools/shuffle-bank.mjs ; echo $?          # 2 (usage)
node tools/cosine.cjs --intra-batch ; echo $?  # 2 (usage)
node tools/export-pending.mjs ; echo $?        # 2 (usage) — сейчас 1
node tools/haladyna.cjs ; echo $?              # 2 (usage) — сейчас 1
npm run qc > $env:TEMP/qc.txt ; echo $?        # 0 при Fails: 0
```
Для `gen-state` проверка требует записи `state.json`:
**не проверено: требует записи** — прогон `npm run state:update` перезаписывает
`.project/state.json` и `docs/dashboard/state.json`, поэтому в рамках read-only
аудита не выполнялся. Проверять только на копии репозитория.

---

## Методика

**Прочитано (полностью или в указанных границах):**

- `tools/qc.cjs` (203 строки, целиком), `tools/_lib/ratio.cjs` (61, целиком),
  `tools/haladyna.cjs` (215, целиком), `tools/cosine.cjs` (433, целиком),
  `tools/shuffle-bank.mjs` (270, целиком), `tools/gen-state.mjs` (608, целиком),
  `tools/gen-topics-manifest.mjs` (96), `tools/split-questions.mjs` (69),
  `tools/export-pending.mjs` (75).
- `.project/sync.mjs` (863, целиком).
- `package.json` (62, целиком), `.project/DECISIONS.md` (264, целиком),
  `.project/DOD.md` (35, целиком), `.project/STATE.md`, `.project/SPEC.md`,
  `.project/state.json` (ключевые поля), frontmatter
  `.project/specs/001-*.md`, `.project/specs/002-*.md`,
  `src/data/topics.ts:16-27`, `src/data/questions/_topics.json`,
  `.project/log.md` (хвост).

**Команды, которые реально запускались** (все — read-only или чистое чтение):

| команда | результат |
|---|---|
| `git log --oneline -15` | HEAD = `edc5d24` на момент чтения; 15 subject'ов |
| `git rev-parse --short HEAD` | `edc5d24` в начале аудита, `1a4950b` в конце (параллельно приземлился коммит `docs(spec)`) |
| `git status --porcelain` | ` M src/data/questions/__tests__/positional-distribution.test.ts` + 30 untracked (`.project/drafts/*`, `.project/agents/*`, `drafts/_mas-results/`) |
| `git log -8 --pretty=format:"%h %ad %s" --date=iso` | TZ `+1000` (напр. `2026-09-27 11:45:09 +1000`); HEAD стал `1a4950b` |
| `git diff --name-only f4e2538..HEAD` | 5 путей: `.project/{SPEC.md,STATE.md,state.json}`, `.project/specs/README.md`, `docs/index.html` — последний не из `SYNC_ONLY_FILES` |
| `git log --since=midnight --pretty=format:%s` | 6 subject'ов (перечислены в B.4) |
| `git rev-parse HEAD` | `1a4950bf29d3d49b92e092dc06abda0b1b9ec5c2` |
| `git log -50 --pretty=format:"%h%x09%s" \| Select-String "^[0-9a-f]+\s+M4\.0"` | ровно 1: `e01cd02` |
| `npm run qc` | `Total: 189 questions`, `Fails: 0, Warns: 16`, exit **0** |
| `npm run qc -- --ids fm_016 --topic file_management` | тот же полный прогон → подтверждение, что argv игнорируется |
| `npm run sync:check` | `SYNC DRIFT`, 4 пункта, exit **2** |
| `node tools/qc.cjs --ids ...` (см. выше) | идентично `npm run qc` |
| Node-скрипт в `$env:TEMP` (удалён): `classifyOptions`/`checkRatio` по `fm_016` | `sentences`, chars `1.2 ok th 1.3`, words `1.0 ok th 1.3` |
| Node-скрипт в `$env:TEMP` (удалён): обе regex из `gen-state.mjs` на живом `git log` | `midnight → 12`, `7.days.ago → 29`, `avg = 4.14` |
| Node-скрипт в `$env:TEMP` (удалён): `TOPIC_ENTRY_RE` по `src/data/topics.ts` | 14 совпадений, `"file_permissions"`/`"Права доступа"`, `"security"`/`"Безопасность"` |
| `node -e` по `state.json` | `head f4e2538…`, `spec_commit e01cd02`, `last_sync 2026-09-27T01:40:58.685Z`, `goal.added_today 6`, `avg_daily_7d "3.29"` |
| `grep spec_commit` по всему репозиторию | 0 совпадений вне `sync.mjs` |
| `Get-Content .project/STATE.md` | содержит `- Банк: **189 / 300**` и `- M2.9: массовая генерация (банк 183/300).` |
| `node -e` — длина `_order.json` | 189 |

**Что не проверено и почему:**

- Историческая пара опций `fm_016`, дающая 1.4118 (DECISIONS.md п. 2) —
  **не проверено: требует записи** (в `git log -p` промежуточной версии файла нет,
  восстановить текст опций не из чего). Проверяемо: сам факт, что при классе
  `sentences` значение 1.4118 > 1.30 → FAIL.
- `npm run state:update` и `npm run state:update -- --no-gates` **не запускались**:
  они перезаписывают `.project/state.json` и `docs/dashboard/state.json`.
  Обе метрики B реконструированы точной копией их regex на живом `git log`
  (см. таблицу выше), а не прогоном инструмента.
- `npm run shuffle-bank --apply` не запускался (перезаписывает банк).
  `--check` также не запускался отдельно: распределение позиций проверено
  чтением кода `tools/shuffle-bank.mjs` и тем, что `tools/gen-state.mjs` держит
  его как гейт (`:438-439`); прогон требует только чтения, но не даёт новых
  утверждений о дефектах, описанных в отчёте.
- `npm run typecheck`, `npm run test:run`, `npm run build` не запускались:
  вне области аудита (вопросы A–E относятся к `tools/` и `sync.mjs`).
- Поведение `sync.mjs` при 15-й теме (C.2) и при пустом diff (C.3) выведено
  из кода; **не проверено: требует записи** — воспроизведение потребовало бы
  правки `src/data/topics.ts` и коммитов.

**Файлы, созданные/изменённые этим аудитом:** только
`.project/audits/tools-audit-2026-09-27.md` (каталог `.project/audits/` создан).
Временные Node-скрипты создавались в `$env:TEMP` и удалены. Никаких коммитов,
`git add`, `checkout`, `stash`, `reset` не выполнялось.
