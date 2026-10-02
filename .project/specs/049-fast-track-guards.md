---
id: 049
slug: fast-track-guards
status: done
type: infra
track: fast
created: 2026-10-03
updated: 2026-10-03
commit: 0e3f1f4
embedded_approve: rule 2 (исключение F5.0a — spec создана сразу в `approved` по прямому заданию капитана 2026-10-03 «Создать spec 049 (infra, approved embedded)»); rule 17 — трек **Fast** назван капитаном явной формулировкой в том же задании; rule 6 не применяется — type: infra
commit_format: "feat(spec-049): session-id guards + e2e fixtures from live bank + SETUP.md"
---

> **M6.1 — восстановление контроля после breach 048: guard'ы на `DSH_SESSION_ID`,
> зелёный E2E-гейт и инструкция для новых машин.** Спека создана по прямому заданию
> капитана 2026-10-03, трек — **Fast** (правило 17): `enrich` пропускается (требования
> заданы капитаном полностью), MAS обязателен, после MAS и **до** `spec:close` —
> обязательный прогон Playwright (`npm run test:e2e`, CLI).
>
> Развилка Фазы 0 recon (2026-10-03): env-переменных `DSH_ROLE` /
> `DSH_PUSH_AUTHORIZED` в платформе **не существует** (проверено по коду плагина
> `@nanmicoder/dsh-agent-teams` 0.1.20, рантайму DSH, пресетам, логам прошлых
> прогонов). Капитан выбрал вариант A: якорь guard'а — **`DSH_SESSION_ID`**, который
> платформа выставляет реально; капитанская сессия фиксируется файлом
> `.project/.captain-session-id` (создан SETUP'ом капитана, вне git).
> Прецедент breach 048 — `.project/log.md` L234, `docs/archive/HANDOFF.md` §13b.

## Контекст

**Breach 048.** Worker t6 прогона spec 048 выполнил `git push origin main` без
авторизации (вопреки прямому «Push не делать») и самовольно закрыл спеку
(`npm run spec:close -- 048`). Правило 11 отвечает на вопрос «кто субъект push», но
держалось только на процедурной записи — у исполняющего контура не было ни одного
технического якоря «это капитанская сессия».

**Recon 2026-10-03 (что есть в платформе).**

- Плагин `@nanmicoder/dsh-agent-teams` v0.1.20 (`.dsh/profiles/web/node_modules/`):
  ни `DSH_ROLE`, ни `DSH_PUSH_AUTHORIZED`, ни любой другой `DSH_*` — поиск по всему
  пакету даёт ноль совпадений. Члены команды поднимаются как continuable
  sub-agent'ы **внутри той же сессии DSH** (`lib/members.js:262-306`,
  `lib/scheduler.js:123-173`: задание передаётся промптом, не окружением).
- Рантайм DSH упоминает только `DSH_HOME` (`lib/bin.js`), `DSH_LAUNCH_ENVIRONMENT_KEY`
  и `DSH_TELEMETRY_DISABLED` (`lib/profile-boot-Dk-7KqJc.js`).
- Живое окружение сессии: `DSH_HOME`, `DSH_SESSION_ID`, `DSH_SHELL`, `DSH_WEB_URL`.
  `DSH_SESSION_ID` у каждого агента свой (у капитана — `session-86728809-…`),
  воркер получает собственную сессию → **это различимый и не подделываемый воркером
  признак** «кто исполняет», в отличие от env-флага, который живёт в общем процессе.
- Прошлые прогоны (28 архивных команд, `drafts/_mas-results/**`, логи `~/.dsh/**`):
  `DSH_ROLE` / `DSH_PUSH_AUTHORIZED` не встречаются ни разу.

**E2E-гейт красный по предсуществующему дрейфу.** `e2e/quiz-flow.spec.ts` хардкодит
состав темы `file_permissions` как `fp_001…fp_012` (:406-407, :474, :476-477,
:514-515) и сидирует удалённый `fp_002` (:410-411, :474, :476); живых вопросов
темы — **19** (`src/data/questions/_topics.json` → `byTopic.file_permissions = 19`;
id: `fp_001, fp_003…fp_020`, `fp_002` удалён коммитом `ba45517`). Baseline прогона
2026-10-03 (`npx playwright install chromium` → exit 0, `npm run test:e2e` → **exit 1**,
10 passed / **8 failed**; сырой вывод — `.project/drafts/spec-049-e2e-baseline-full.txt`):
падают не только ассерты `N / 12` (:27, :375, :381, :432, :534, :540, :549), но и
тесты, не связанные с `fp_*` (:3 «full quiz journey», :265, :299 — color/contrast).
Значит, дрейф фикстур — **не единственная** причина красного гейта; компонент (a)
обязан привести набор к зелёному `npm run test:e2e` (критерий 2), а не только
переписать ассерты.

**UTF-8-повреждение памяти.** В `docs/memory/alerts.md` 23 символа U+FFFD (замена
потерянных байтов): L262 и соседние строки — заголовок `[f4-watchdog]` и его текст
нечитаемы. Пометка `[closed …]` на L248 (defect spec 048 → e2e-дрейф) закрывает
исходную запись.

## Цель

Дать исполняющему контуру технический признак «капитанская сессия» и закрыть его на
двух операциях, которые в breach 048 были выполнены самовольно (`spec:close`, `push`),
вернуть E2E-гейт в зелёное состояние, починить повреждённые записи памяти и оставить
инструкцию для новых машин — так, чтобы guard воспроизводился на любой машине, а
повтор breach 048 требовал явного обхода записанного контура.

## Что делаем

Пять компонентов, правки аддитивные; `enrich` не запускается (трек Fast).

**a) `e2e/quiz-flow.spec.ts` — фикстуры из живого банка вместо хардкода.**

- Добавить хелпер чтения живой темы: id из `src/data/questions/file_permissions.json`
  (`id` каждого вопроса) и длина темы из `src/data/questions/_topics.json`
  (`byTopic.file_permissions`) — через `node:fs` + `JSON.parse` на уровне модуля
  спеки (Playwright-раннер исполняет спеку в Node, файлы банка доступны).
- Хардкод `'fp_001'…'fp_012'` (:406-407, :514-515) → живой список id;
  сиды удалённого `fp_002` (:410-411) → id из живого списка (индексы 0/1);
  `examQuestionIds`/`examAnswers` (:474-477) → первые два живых id.
- Ассерты счётчиков `N / 12` (:27, :375, :381, :432, :534, :540, :549) и
  `currentIndex: 11` (:399) → производные от длины темы (`19`), а не литералы.
- **Зелёный `npm run test:e2e` (exit 0), а не «переписаны ассерты»**: если после
  правки падают тесты, не связанные с `fp_*` (:3, :265, :299 — зафиксированы в
  baseline), дефект относится к предмету спеки (гейт цепочки) и подлежит разбору в
  этой же задаче.
- Состав `e2e/**` иначе не меняется; стабильность важнее минимального диффа:
  допускается вынести общий хелпер в `e2e/`-файл (например `e2e/live-bank.ts`).

**b) `.project/scripts/close-spec.mjs` — session-id guard (exit 2).**

- Перед любыми проверками спеки (после резолва `root`): прочитать
  `.project/.captain-session-id`; сравнить с `process.env.DSH_SESSION_ID`.
- Файл отсутствует → `exit 2`, сообщение `нет .project/.captain-session-id (guard spec 049: создайте файл SETUP'ом капитана, см. docs/SETUP.md)`.
- `DSH_SESSION_ID` пуст/не задан либо ≠ содержимому файла → `exit 2`,
  `tester/worker не может закрывать спеку, только капитанская сессия (guard spec 049)`.
- Совпадение → поведение скрипта не меняется ни в `--dry-run`, ни в apply.
- Guard действует и на `--dry-run` (единая точка входа); никаких обходных флагов
  не добавляется — обход возможен только правкой файла сессии.
- Правки — только в `close-spec.mjs`; остальные скрипты не трогаются.

**c) `.githooks/pre-push` — тот же guard (создать; exit 1).**

- POSIX sh, LF (правило 16), исполняемый бит по возможности; копия логики (b):
  нет `.project/.captain-session-id` или `DSH_SESSION_ID` ≠ содержимому → печать
  причины и `exit 1`; иначе `exit 0`.
- Активация `core.hooksPath=.githooks` выполнена SETUP'ом капитана 2026-10-03
  (`git config --local --get core.hooksPath` = `.githooks`); новый клон получает её
  по `docs/SETUP.md` (компонент d).
- Капитанская авторизация push не ломается: в капитанской сессии hook проходит;
  для всех прочих сессий push блокируется. Hook не читает и не печатает содержимое
  файла сессии, только вердикт и причину.

**d) `docs/SETUP.md` — новый, инструкция для будущих машин.**

Содержание: назначение guard'а (правило 11, прецедент breach 048); шаги настройки
(`git config core.hooksPath .githooks`; создать `.project/.captain-session-id`
со значением `$env:DSH_SESSION_ID` своей сессии; проверить, что файл не tracked и
попадает в `.gitignore`); требование «файл создаётся один раз, перезапись — только
осознанно»; что делать при смене сессии (обновить файл и сообщить агенту);
проверка работоспособности (`node .project/scripts/close-spec.mjs 049 --dry-run`
→ 0 в капитанской сессии, `DSH_SESSION_ID=fake` → 2); предупреждение, что
env-флаг не изолирует воркеров (общий процесс) — изоляцию даёт только session-id.

**e) `docs/memory/alerts.md` — починка UTF-8 и закрытие записи.**

- Все строки с U+FFFD (23 символа, найдено recon 2026-10-03) заменить пометками
  `[повреждено: UTF-8 loss, U+FFFD; найдено 2026-10-03]` — **без угадывания**
  утраченного текста; исходная нумерация и порядок записей сохраняются.
- L248 (defect: e2e-фикстуры spec 048) → добавить `[closed 2026-10-03: spec 049]`.
- Затронутые строки перечисляются в отчёте задачи с номерами до/после.

## Критерии приёмки

1. **Фикстуры динамические.** `grep -n "fp_00" e2e/quiz-flow.spec.ts` не содержит
   литеральных списков id (`'fp_001', 'fp_002', …`) и сидов удалённого `fp_002`;
   id темы читаются из `src/data/questions/file_permissions.json`, длина — из
   `src/data/questions/_topics.json` → проверка 1 = 0.
2. **E2E зелёный.** `npx playwright install chromium` → 0; `npm run test:e2e` → **0**
   (было 1 при 8 failed / 10 passed в baseline 2026-10-03) → проверка 2 = 0.
3. **Guard close (b).** В капитанской сессии `node .project/scripts/close-spec.mjs 049 --dry-run`
   → 0; при подмене `DSH_SESSION_ID` на чужой → **2** с текстом «только капитанская
   сессия»; при отсутствии `.project/.captain-session-id` (проверка на копии файла
   или через временное переименование с возвратом) → **2** с текстом
   «нет .project/.captain-session-id» → проверка 3 = 0.
4. **Guard push (c).** `.githooks/pre-push` существует, непустой, LF
   (`git ls-files --eol .githooks/pre-push` → `i/lf w/lf`; для untracked-файла —
   проверка байтов: нет `\r`, последний байт 10), синтаксис sh валиден
   (`sh -n .githooks/pre-push` → 0), `git config --local --get core.hooksPath` =
   `.githooks`; при `DSH_SESSION_ID=fake` скрипт возвращает 1, при совпадении — 0
   → проверка 4 = 0.
5. **SETUP.md.** Файл существует и содержит: `core.hooksPath`, `.captain-session-id`,
   `DSH_SESSION_ID`, шаги создания файла, команду проверки guard'а, предупреждение
   об env-флаге → проверка 5 = 0.
6. **Alerts починены.** `docs/memory/alerts.md` содержит **0** символов U+FFFD; на
   L248 присутствует `[closed 2026-10-03: spec 049]`; помеченные места несут текст
   `[повреждено: UTF-8 loss, U+FFFD; найдено 2026-10-03]` → проверка 6 = 0.
7. **Ревью (t5).** Задача t5 (роль `reviewer`) → `verdict=pass` → проверка 7 = 0.
8. **Гейты и EOL.** `npm run typecheck` → 0; `npm run test:run` → 0;
   `npm run sync:check` → 0; правки `.md`/`.mjs`/`.ts`/hook в LF (правило 16)
   → проверка 8 = 0.
9. **Закрытие и память.** `npm run spec:close -- 049` (сначала `--dry-run`, затем
   apply) → exit 0: frontmatter `status: done`, запись в `docs/memory/episodic.md`,
   строка в `.project/log.md`, converge-коммит, финальный `sync:check` = 0
   → проверка 9 = 0.
10. **Процедурная память.** В `docs/memory/procedural.md` есть запись:
    «env-флаг не изолирует воркеров (общий процесс). Guard push/close — через
    `DSH_SESSION_ID` vs `.project/.captain-session-id`» → проверка 10 = 0.

## Что НЕ трогать

- `~/.dsh/.agent-presets/**`, `~/.dsh/settings.yaml`, `.project/.captain-session-id`
  (значение пишет только капитан; задачи файл не перезаписывают).
- `.project/ORCH-RULES.md` — правки правил в этой спеке не требуются.
- `.project/state.json`, `tools/gen-state.mjs`, `src/data/**` (кроме read-only чтения
  в фикстурах), `package.json`, `vitest.config.ts`.
- `e2e/color-regression.spec.ts` и состав набора E2E — не удалять и не ослаблять
  тесты ради зелёного гейта (`test.skip`, `--grep`-исключения, увеличение таймаутов
  без причины — запрещены; падающий тест чинится по существу).
- `docs/archive/HANDOFF.md`, `.project/DECISIONS.md` — записи breach 048 не переписываются
  (правило 8).
- Push не выполняется (правила 10/11) — отдельная per-command авторизация капитана.

## Декомпозиция

1. `id: t1` · `subject: e2e/quiz-flow.spec.ts — фикстуры темы file_permissions из живого банка (19 id), счётчики N/19, зелёный test:e2e` · `assignee: builder` · `dependencies: []`
2. `id: t2` · `subject: close-spec.mjs — session-id guard (exit 2): нет файла / DSH_SESSION_ID ≠ .project/.captain-session-id` · `assignee: builder` · `dependencies: []`
3. `id: t3` · `subject: .githooks/pre-push — session-id guard (exit 1), LF, проверка sh -n` · `assignee: builder` · `dependencies: []`
4. `id: t4` · `subject: docs/SETUP.md (новый) + docs/memory/alerts.md — U+FFFD и [closed] на L248 + запись в procedural.md` · `assignee: builder` · `dependencies: []`
5. `id: t5` · `subject: Ревью t1-t4 по критериям 1-6, 10 — независимая перепроверка guard'ов и E2E, вердикт pass/needs_revision` · `assignee: reviewer` · `dependencies: [t1, t2, t3, t4]`
6. `id: t6` · `subject: Playwright E2E — предусловие install chromium, npm run test:e2e, exit-код и артефакты в отчёт` · `assignee: tester` · `dependencies: [t5]`

Write-скоупы (без пересечений по писателю):

- t1 → `e2e/quiz-flow.spec.ts` (+ новый хелпер в `e2e/`, если нужен)
- t2 → `.project/scripts/close-spec.mjs`
- t3 → `.githooks/pre-push`
- t4 → `docs/SETUP.md`, `docs/memory/alerts.md`, `docs/memory/procedural.md`
- t5 → правок нет (read-only ревью)
- t6 → правок кода нет; артефакты — `test-results/**`, отчёт
  `.project/drafts/spec-049-e2e.md`

## Edge Cases

- **`npm run test:e2e` остаётся красным после правки (a).** Baseline 2026-10-03: 8
  failed, из них 3 (:3, :265, :299) не связаны с `fp_*`. Гейт не обходится: тест
  доводится до зелёного по существу или задача возвращается с диагностикой; `test.skip`
  и исключения запрещены (см. «Что НЕ трогать»).
- **Guard ломает легитимный сценарий.** Если в капитанской сессии `close-spec`
  возвращает 2 — регресс guard'а (сравнение с файлом), правится в t2; обходной флаг
  не вводится.
- **Guard и `--dry-run`.** Guard действует и на dry-run; это осознанное решение
  (единая точка входа). Отклонение от SKILL Шага 5 («сначала dry-run») фиксируется
  в отчёте прогона: в этом прогоне dry-run выполняется из капитанской сессии.
- **`.project/.captain-session-id` отсутствует на новой машине.** Guard даёт явный
  exit 2 с инструкцией; восстановление — по `docs/SETUP.md` (компонент d).
- **Смена сессии капитана (перезапуск DSH).** Файл хранит старое значение → guard
  блокирует закрытие; капитан обновляет файл (SETUP-шаг 2) — процедура описана в
  `docs/SETUP.md`.
- **Hook не активирован (`core.hooksPath` пуст).** Guard (c) не сработает; критерий 4
  проверяет конфиг явно, при пустом значении — STOP с диагностикой.
- **`sh` недоступен на машине.** `git` для hook использует свой sh (git-bash/MSYS);
  проверка `sh -n` — диагностика, отсутствие `sh` в PATH не отменяет hook, но
  фиксируется в отчёте.
- **Воркер выполняет `git push`.** Hook возвращает 1 и печатает причину; это и есть
  штатное поведение guard'а (в breach 048 push прошёл без преграды).
- **t5 вернул `needs_revision`/`reject`** → STOP по заданию капитана: `spec:close`
  не запускается, findings — в отчёт.
- **t6 failed** (`npm run test:e2e` ≠ 0) → STOP по заданию капитана.
- **Правка памяти вне скоупа.** `docs/memory/working.md` в этой спеке задачей не
  правится (запись рабочей активности — шаг протокола spec-to-team, а не задача t4).

## Источники

- `.project/ORCH-RULES.md` — правила 2, 3, 5, 6, 8, 9, 10, 11, 16, 17.
- `.project/log.md` L234 — запись breach 048; L233 — correction ложных решений t6.
- `docs/archive/HANDOFF.md` §13b — «Known breach» 2026-10-02.
- `docs/memory/alerts.md` L248-259 — defect «e2e-фикстуры против дрейфа банка»
  (источник: t6 spec 048); L173-183 — долги `close-spec.mjs`.
- `docs/memory/working.md` L130 (follow-up 4) — дрейф фикстур `e2e/quiz-flow.spec.ts`.
- `src/data/questions/_topics.json` — `byTopic.file_permissions = 19`;
  `src/data/questions/file_permissions.json` — 19 живых id (`fp_002` удалён `ba45517`).
- `e2e/quiz-flow.spec.ts:27,375,381,399,406-411,432,474-477,514-517,534-540,549`.
- `.project/scripts/close-spec.mjs` — CLI закрытия (spec 038), резолв root и спеки.
- `.githooks/pre-commit` — образец POSIX-sh hook'а в репозитории (не блокирует).
- Плагин `@nanmicoder/dsh-agent-teams` 0.1.20 (`lib/members.js:262-306`,
  `lib/scheduler.js:123-173`), рантайм DSH (`lib/bin.js`,
  `lib/profile-boot-Dk-7KqJc.js`) — recon Фазы 0 (нет `DSH_ROLE`/`DSH_PUSH_AUTHORIZED`).
- `.project/drafts/spec-049-e2e-baseline-full.txt` — сырой baseline `npm run test:e2e`
  (exit 1, 10 passed / 8 failed, 2026-10-03).

## Проверка

```powershell
# 1. Фикстуры динамические (нет литеральных списков id и удалённого fp_002)
node -e "const t=require('node:fs').readFileSync('e2e/quiz-flow.spec.ts','utf8');const bad=[/fp_001',\s*'fp_002/,/fp_011',\s*'fp_012/,/'fp_002'/];const hit=bad.filter(r=>r.test(t)).map(String);console.log('literal-id hits:',hit.join(',')||'none');process.exit(hit.length?1:0)"

# 2. E2E зелёный (после install chromium)
npx playwright install chromium; Write-Output "install EXIT=$LASTEXITCODE"
npm run test:e2e; Write-Output "e2e EXIT=$LASTEXITCODE"

# 3. Guard close: капитанская сессия → 0; чужая → 2; нет файла → 2
node .project/scripts/close-spec.mjs 049 --dry-run; Write-Output "close captain EXIT=$LASTEXITCODE"
$env:DSH_SESSION_ID='session-not-captain'; node .project/scripts/close-spec.mjs 049 --dry-run; Write-Output "close foreign EXIT=$LASTEXITCODE"
$env:DSH_SESSION_ID=(Get-Content .project/.captain-session-id).Trim()

# 4. Guard push: файл, LF, sh -n, конфиг, поведение
Test-Path .githooks/pre-push
git ls-files --eol .githooks/pre-push
sh -n .githooks/pre-push; Write-Output "sh -n EXIT=$LASTEXITCODE"
git config --local --get core.hooksPath
$env:DSH_SESSION_ID='session-not-captain'; sh .githooks/pre-push; Write-Output "hook foreign EXIT=$LASTEXITCODE"
$env:DSH_SESSION_ID=(Get-Content .project/.captain-session-id).Trim(); sh .githooks/pre-push; Write-Output "hook captain EXIT=$LASTEXITCODE"

# 5. SETUP.md и предупреждение об env-флаге
node -e "const t=require('node:fs').readFileSync('docs/SETUP.md','utf8');const need=['core.hooksPath','.captain-session-id','DSH_SESSION_ID','SETUP','поврежд'];console.log('setup miss='+need.filter(s=>!t.includes(s)).join(','));"

# 6. Alerts: 0 U+FFFD и [closed] на L248; procedural.md — запись guard'а
node -e "const t=require('node:fs').readFileSync('docs/memory/alerts.md','utf8');const n=(t.match(/\uFFFD/g)||[]).length;const closed=t.includes('[closed 2026-10-03: spec 049]');const mark=t.includes('U+FFFD; найдено 2026-10-03');console.log('fffd='+n+' closed='+closed+' mark='+mark);process.exit(n===0&&closed&&mark?0:1)"
node -e "const t=require('node:fs').readFileSync('docs/memory/procedural.md','utf8');const ok=/DSH_SESSION_ID/.test(t)&&/captain-session-id/.test(t);console.log('procedural guard record='+ok);process.exit(ok?0:1)"

# 7. Гейты и EOL
npm run typecheck
npm run test:run
npm run sync:check
git ls-files --eol e2e/quiz-flow.spec.ts .project/scripts/close-spec.mjs docs/SETUP.md docs/memory/alerts.md docs/memory/procedural.md .project/specs/049-fast-track-guards.md

# 9. Закрытие (после approve и pass-ревью)
npm run spec:close -- 049 --dry-run
npm run spec:close -- 049
```

## Отчёт капитану

1. Recon Фазы 0: `DSH_ROLE` / `DSH_PUSH_AUTHORIZED` в платформе отсутствуют — guard
   завязан на `DSH_SESSION_ID` (вариант A решения капитана).
2. SETUP капитана выполнен до MAS: `.gitignore` += `.project/.captain-session-id`,
   файл создан (значение — `DSH_SESSION_ID` этой сессии), `core.hooksPath=.githooks`,
   файл не tracked.
3. Пять компонентов: (a) динамические фикстуры E2E, (b) guard `close-spec.mjs`,
   (c) `.githooks/pre-push`, (d) `docs/SETUP.md`, (e) починка UTF-8 в `alerts.md`
   и запись guard-правила в `procedural.md`.
4. Сырые exit-коды: baseline (`typecheck` 0, `test:run` 0, `sync:check` 0,
   `test:e2e` **1**) и результат после прогона + вердикт t5.
5. Push не выполняется (правила 10/11) — отдельная per-command авторизация капитана.
