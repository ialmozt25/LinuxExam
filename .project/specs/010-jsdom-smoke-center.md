---
id: 010
slug: jsdom-smoke-center
status: draft
type: feature
created: 2026-09-27
updated: 2026-09-27
commit: null
---

## Цель

Закрыть центр разработки (`docs/index.html`) smoke-тестами на структуру. Файл
целиком генерируется `.project/sync.mjs` (`renderCenter()` + `esc()`,
`.project/sync.mjs:471-675`) и **не покрыт ни одним тестом**: сломанная таблица,
потерянный класс чипа, неэкранированный HTML из текста спеки или пустая секция
«Очередь решений» уезжают в прод-центр молча. Известный прецедент класса ошибки:
`renderCenter({... inSync: true})` захардкожен (`.project/sync.mjs:750`), из-за чего
индикатор синхронизации всегда зелёный (`.project/audits/tools-audit-2026-09-27.md`,
C.6), — такой дефект не виден ни `sync:check`, ни глазами при беглом просмотре.

## Что уже есть в тестовой инфраструктуре

- Vitest 3 (`vitest ^3.2.7`), `npm run test:run` = `vitest run`
  (`package.json:21`); наблюдаемый baseline: **25 passed**, **149 passed**.
- `environment: 'jsdom'` включён глобально (`vitest.config.ts:15`), `jsdom ^29.1.1`
  есть в devDependencies.
- `@testing-library/react` + `@testing-library/jest-dom` подключены глобально через
  `setupFiles: './src/test/setup.ts'` (`vitest.config.ts:17`).
- Прецедент теста вне `src/` уже существует: `docs/dashboard/__tests__/humanize.test.mjs`
  (12 тестов, подхватывается дефолтным `include`, потому что совпадает с
  `**/*.{test,spec}.?(c|m)[jt]s?(x)`).
- `vitest.config.ts` переопределяет только `exclude` (`e2e/**`) — `include` не задан.

## Главный блокер: генератор нельзя импортировать

**Проверено экспериментом:** импорт `.project/sync.mjs` как модуля запускает
`main()` (вызов в конце файла, `.project/sync.mjs:859-863`) и **пишет на диск**
`.project/state.json`, `STATE.md`, `SPEC.md`, `docs/index.html`. Модуль не экспортирует
ничего (`Object.keys(await import('../sync.mjs'))` → пустой список). Прямое следствие:
тест, который импортирует текущий `sync.mjs`, перезаписывает артефакты репозитория —
недопустимо.

**Требуемый рефакторинг (часть задачи):**

- Вариант A (предпочтительный): вынести рендер в `.project/lib/center.mjs`
  (например `export function esc(v)` и `export function renderCenter(ctx)`),
  а `sync.mjs` оставить CLI-точкой входа, импортирующей их.
- Вариант B: оставить код в `sync.mjs`, но обернуть `main()` в guard вида
  `if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))`
  (`import.meta.main` в Node 22.16+ можно использовать, но версия Node в CI — 22
  из `.github/workflows/deploy.yml:25`, а локальная — по факту; guard через
  `process.argv[1]` не зависит от минорной версии).
- **Инвариант рефакторинга:** `docs/index.html` после рефакторинга байт-идентичен
  файлу до него (`git diff --stat -- docs/index.html` пусто; дополнительно — `npm run sync`
  в чистом дереве не меняет файл).
- Рендер обязан остаться чистым по данным: без чтения git, без `fs`, без времени —
  всё это уже собрано в `ctx` вызывающим кодом (`sync.mjs:747-750`).

## Путь теста и конфиг

- Файл: **`docs/__tests__/center.test.mjs`**. Обоснование: центр — артефакт `docs/`,
  рядом уже есть прецедент `docs/dashboard/__tests__/humanize.test.mjs`, и путь попадает
  в дефолтный `include` Vitest — правки `vitest.config.ts` не нужны.
- Импорт генератора: `import { esc, renderCenter } from '../../.project/lib/center.mjs';`
  (при варианте B — `from '../../.project/sync.mjs'` **только после** появления guard'а).
- jsdom импортируется напрямую: `import { JSDOM } from 'jsdom';` и
  `new JSDOM(html)` — `environment: 'jsdom'` даёт глобальные `document`/`window`, но
  тест разбирает именно **свой** HTML, поэтому нужен собственный `JSDOM`-инстанс.
- Если выбран вариант A с именем `.project/lib/center.mjs`, проверить, что путь не
  попал в `SYNC_ONLY_FILES` (`.project/sync.mjs:111-117`) — иначе закрепление `state.head`
  начнёт считать правку генератора «базой изменилась».

## Что именно проверять (конкретные утверждения)

Собрать `ctx` синтетически (state/goal/topics/specs/head/inSync/logTail) и проверить
на разобранном DOM:

- [ ] **Чипы статусов.** Для каждой спеки в таблице `#specs` строка с её `id` содержит
      `span.chip` с классом `chip--<status>` (`sync.mjs:503`);
      набор статусов `preview/running/approved/done/rejected/draft` — каждый даёт
      свой класс. Проверка «всего одна ячейка статуса на строку» и совпадение числа
      строк таблицы с числом спек.
- [ ] **Экранирование `esc()`.** Все пять символов: `esc('&<>"\'')` →
      `'&amp;&lt;&gt;&quot;&#39;'` (`sync.mjs:471-475`); спека с `slug: 'a&b'`
      и заголовком `A & B` рендерится как `a&amp;b` / `A &amp; B`, и **ни в одном**
      месте HTML нет сырого `&`/`<` от данных спеки.
- [ ] **Нет пробивающегося `<script>`.** Спека с полем вида
      `A <script>alert(1)</script> B` не создаёт в DOM ни одного `script`-элемента
      (`dom.window.document.querySelectorAll('script').length === 0`) и её текст виден
      в `textContent` строки таблицы/очереди.
- [ ] **Прогресс.** `.progress__cur` === `String(state.goal.current_questions)`,
      `.progress__tot` === `` `/ ${state.goal.target_questions}` ``,
      ширина `.progress__fill` (`style="width:<percent>%"`) ===
      `state.goal.progress_percent`, текст `.progress__pct` содержит процент и
      `осталось <target - current>` (`sync.mjs:631-636`).
- [ ] **Темы.** Число элементов `.topic` === числу элементов `ctx.topics`; `.topic__count`
      каждой строки === `` `${count} / ${target}` ``; тема с `count < target * 0.5`
      получает класс `topic--gap`, остальные — не получают (`sync.mjs:510-523`).
- [ ] **Очередь решений.** Если в `ctx.specs` нет статуса `preview` — в `#queue` есть
      `p.empty` с текстом «Решений не ждёт» и ноль `.queue-item`; если есть — ровно
      столько `.queue-item`, сколько `preview`-спек, и внутри `.queue-item__meta`
      присутствует путь `.project/specs/<file>` (`sync.mjs:482-493`).
- [ ] **Журнал и политики.** Число `li` в `#journal` === `ctx.logTail.length` (при
      пустом `logTail` — один `li.muted`); блок `#policies` содержит три карточки
      (`DOD`, `TOKENS`, `ORCH-RULES`, `sync.mjs:66-70`) с непустыми `code`
      (`sync.mjs:525-537`).
- [ ] **Шапка.** `#head` содержит `HEAD <state.head>` и `last_sync <state.last_sync>`;
      точка индикатора имеет класс `dot dot--ok` при `inSync: true` (`sync.mjs:619-627`).
- [ ] **Ноль побочных эффектов.** Тест не пишет в репозиторий: до/после
      `npm run test:run` вывод `git status --porcelain` совпадает (проверяется в превью,
      а не внутри теста).

## Критерии приёмки

- [ ] Существует `docs/__tests__/center.test.mjs`; все утверждения выше реализованы
      (каждое — отдельный `it` с осмысленным именем на русском).
- [ ] Смоук ловит регрессию, а не только «зелёное сейчас»: продемонстрировано на
      намеренно испорченном рендере (например, чип без класса `chip--<status>`,
      `esc()` без замены `&`, пустая очередь при наличии `preview`-спеки) — тест падает.
- [ ] Генератор импортируется без побочных эффектов (рефакторинг выполнен);
      `docs/index.html` после рефакторинга байт-идентичен прежнему.
- [ ] `npm run test:run` exit 0; число тестов выросло на число новых проверок
      (baseline: 25 файлов / 149 тестов), регрессий нет.
- [ ] `npm run typecheck` exit 0; `npm run build` exit 0.
- [ ] Никаких новых зависимостей: используются уже установленные `vitest`, `jsdom`
      (AGENTS.md: «не устанавливать новые зависимости без явного запроса»).
- [ ] `npm run sync` → `git add` → один коммит → `npm run sync:check` exit 0.
- [ ] Строка в `.project/log.md`.

## Что НЕ трогать

- Содержимое и вёрстку центра (разметка, CSS-токены, тексты) — задача про тесты,
  а не про редизайн. Единственные допустимые правки в `sync.mjs` — выделение рендера
  в импортируемый модуль/guard.
- `.project/specs/**` (в т.ч. `README.md`), `.project/DOD.md`, `.project/state.json`.
- Семантику `sync` / `sync:check` (байтовое сравнение, exit 0/2) — она не меняется.
- Исключение `e2e/**` и `setupFiles` в `vitest.config.ts`: не переставлять, не удалять;
  `include` менять только если без этого тест не подхватывается (тогда — минимальным
  паттерном и с объяснением в отчёте).
- `.github/workflows/deploy.yml` — CI-прогон тестов не добавляется.

## Превью

1. Список из ~10 `it` с их именами и что каждый ловит.
2. Дамп фрагмента HTML, сгенерированного на синтетическом `ctx` с «вредной» спекой
   (`A & B`, `<script>`), — видно экранирование.
3. Доказательство байт-идентичности: `git diff --stat -- docs/index.html` пусто
   после рефакторинга.
4. Доказательство «тест ловит регрессию»: вывод упавшего прогона на намеренно
   испорченной копии рендера (копия во временном каталоге, оригинал не портится).
5. `npm run test:run`: было 25/149 — стало N/M.
6. `git status --porcelain` до и после прогона тестов — совпадает.

## Отчёт капитану

1. Какой вариант рефакторинга выбран (A или B) и почему.
2. Путь теста и подтверждение, что `vitest.config.ts` не потребовал правок `include`.
3. Какие именно регрессии ловит новый тест (по одному примеру на класс).
4. Число тестов до/после; exit-коды `typecheck`, `test:run`, `build`, `sync:check`.
5. Отклонения от спеки и вопросы капитану.
6. Ждать approve. Коммит не делать.
