# .project/checklists — единая точка проверки UI/UX

Каталог отвечает на вопрос «экран готов?» одним прогоном, а не тремя
источниками по памяти.

| файл | что это |
|---|---|
| `ui-ux.yaml` | 30 критериев: LAYOUT (8), COLOR (6), TYPO (5), SPACE (4), STATE (4), COPY (3) |
| `README.md` | этот файл: как добавлять критерии и как читать прогон |

Две команды:

```bash
npm run check          # машинные критерии: ~30 сек (grep по src + чтение двух JSON)
npm run audit:screens  # печатает инструкцию визуального аудита; PNG читает агент
```

## Как это работает

`npm run check` (`.project/scripts/check.mjs`, zero-deps) читает `ui-ux.yaml` и
диспатчит проверку по полю `check`:

| `check` | источник | что делает |
|---|---|---|
| `playwright` | `.project/drafts/layout-probe-075.json` | нарушения пробы вёрстки spec 075 по виду (`overflow`, `touch-target`, `cta-out-of-viewport`, `clipped-text`, `escaped-element`) |
| `axe` | `.project/drafts/a11y-baseline.json` | правила axe (`color-contrast`, `focus-visible`), детали из `violations[].nodes[].failureSummary` |
| `grep` | `src/presentation/**` | регексп по исходникам |
| `vision` | — (агент) | пропуск: PNG читает агент с `npm run audit:screens` |
| `manual` | — (агент) | пропуск: ручная проверка, статус остаётся `manual` |

Прогон обновляет `status` в `ui-ux.yaml` (запись temp + rename, точечно —
правится только значение `status:`), пишет
`.project/drafts/checklist-report-<дата>.md` и возвращает **exit 1**, если
провалился критичный критерий (`COLOR-001` контраст текста, `LAYOUT-003` CTA во
вьюпорте). Любой другой fail — exit 0: он попадает в отчёт, но не блокирует
работу.

`unknown` ≠ `fail`. Если источник не найден (нет `layout-probe-075.json` или
`a11y-baseline.json`), критерий честно помечается `unknown` — «не проверено»,
а не «плохо». Критичный `unknown` тоже не роняет exit-код, но печатается
пометкой `check: NOTE критичный критерий … не проверен`.

## Как добавить критерий

1. Выбери категорию и следующий свободный номер: `LAYOUT-009`, `COLOR-007`, …
   Номер не переиспользуется даже после `obsolete`.
2. Добавь запись в конец своей категории в `ui-ux.yaml`:

```yaml
  - id: LAYOUT-009
    title: Кратко, что проверяем
    check: grep                       # playwright | axe | grep | manual | vision
    threshold: совпадений 0           # человеку читаемое условие
    status: unknown                   # прогон перепишет сам
    source: internal                  # WCAG 2.2 | Apple HIG | Nielsen | TMA docs | internal
    grep:                             # блок нужен только для check: grep
      pattern: 'overflow-x:\s*scroll'
      include: ['.ts', '.tsx']
      # exclude: ['theme/tokens\.css$']   # когда критерий неприменим к файлу
      # mode: distinct; max-distinct: 8   # «не больше N уникальных значений»
      # mode: modulo; modulo: 4           # «все числовые значения кратны N»
      # mode: near; near: 'letterSpacing'; radius: 5   # «X только рядом с Y»
      # expect: match                     # pass при >0 совпадений (иначе pass при 0)
```

**Режимы `distinct`/`modulo` читают ИМЕНОВАННУЮ группу `(?<value>…)`** —
значение должно быть помечено в регекспе явно:

```yaml
      pattern: 'fontSize:\s*[^0-9\n]{0,3}(?<value>[0-9]+)px'
      mode: distinct
      max-distinct: 8
```

Индекс группы (`([0-9]+)` как первая скобка) для этого не годится: добавление
любой другой группы в паттерн молча подменяет значение — критерий начинает
мерить не то, что написан в его `title`. Именованная группа такой правкой не
ломается: `check.mjs` берёт значение по имени.

`mode: near` решает критерий «свойство только вместе с другим»: для каждого
совпадения сканируется окно `radius` строк вокруг и критерий падает, если
в окне нет регекспа `near` (например, `textTransform: 'uppercase'` без
`letterSpacing` рядом).

Для `check: playwright` добавь блок `probe: {check-kind: <вид нарушения>}` —
вид берётся из `CheckKind` в `e2e/layout-smoke.spec.ts`. Для `check: axe` —
блок `axe: {rule: <id правила>, screen-match: '<регексп экранов>'}`, при
необходимости `large-text: true` (порог 3:1 вместо 4.5:1).

3. Проверь структуру без прогона:

```bash
node .project/scripts/check.mjs --self-test
```

Self-test валидирует чек-лист (число критериев по категориям, обязательные
поля, компилируемость регекспов) и не трогает `status`. Опечатка в регекспе
иначе превращается в «критерий всегда unknown» и живёт в отчёте месяцами.

## Чего НЕ делать

- **Не удалять критерий.** Критерий, потерявший смысл, переводится в
  `status: obsolete` (и остаётся в файле): история проверок важнее чистоты
  списка — по удалённой записи нельзя понять, что именно перестали проверять.
- **Не подгонять `status` руками.** `status` — выход прогона: если он
  переписан вручную, следующий `npm run check` вернёт правду, а расхождение
  будет выглядеть как регрессия. Правится критерий (порог, паттерн), а не
  статус.
- **Не править `check.mjs` после прогона, чтобы «получить pass».** Скрипт —
  часть контракта: изменение его логики меняет смысл всех 30 критериев сразу и
  требует отдельной спеки.
- **Не трогать baseline PNG** (`e2e/visual-regression.spec.ts-snapshots/*.png`)
  и не запускать `npm run test:e2e --update-snapshots`: 19 снимков — эталон
  визуальной регрессии (spec 074), обновляются только отдельным решением.

## `npm run check` — время прогона

Порядок ~30 секунд: 34 файла `src/presentation/**` читаются один раз, плюс два
JSON в `.project/drafts/`. Зависимостей нет (zero-deps), сети нет, тесты не
поднимаются — поэтому команду можно запускать на каждый экранный дифф.

```bash
$ npm run check
check: 21 pass / 7 fail / 2 unknown / 2 manual
check: status обновлён в .project/checklists/ui-ux.yaml (изменено 3)
check: отчёт .project/drafts/checklist-report-2026-10-04.md
```

## Визуальный аудит: `npm run audit:screens`

Скрипт ничего не анализирует — он печатает список 19 baseline PNG (размер,
читаемость, битые файлы) и инструкцию:

> Прочитай каждый PNG через Read tool. Для каждого запиши: screen, viewport,
> 3–5 проблем с severity (critical/high/medium/low) и категорией
> (layout|typography|spacing|color|hierarchy|consistency|copy). Запиши
> результат в `.project/drafts/visual-audit-<дата>.md`.

**PNG читает агент, а не скрипт:** у агента есть зрение, у `node` — нет.
Поэтому шаг не автоматизирован: автоматизировано только то, что
детерминировано (список снимков, имя отчёта, шаблон наблюдений). Битый PNG или
недоступный Read tool — наблюдение отчёта («PNG не читается», «vision
unavailable»), а не остановка аудита остальных экранов.

Аудит **ничего не меняет**: ни PNG, ни `src/**`, ни `e2e/**`. Найденные
дефекты — вход для отдельных спек.
