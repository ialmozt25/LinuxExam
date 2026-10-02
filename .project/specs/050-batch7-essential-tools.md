---
id: 050
slug: batch7-essential-tools
status: approved
type: content
track: fast
created: 2026-10-03
updated: 2026-10-03
commit: pending
embedded_approve: rule 2 (исключение F5.0a — spec создана сразу в `approved` по прямому заданию капитана 2026-10-03 «Создать spec 050 (content, approved embedded)»); rule 17 — трек **Fast** назван капитаном явной формулировкой; rule 6 — превью и approve капитана (STOP D) обязательны и на треке Fast, банк в `src/data/**` без approve не пишется
commit_format: "feat(bank): M2.9 batch 7 - 12 questions on essential_tools (241→253)"
---

> **M2.9, батч 7 — 12 вопросов темы `essential_tools` (банк 241 → 253).** Спека
> создана по прямому заданию капитана 2026-10-03 с embedded approve; трек —
> **Fast** (правило 17): `enrich` пропускается (требования заданы капитаном
> полностью), MAS обязателен, Playwright после MAS, превью и approve капитана
> обязательны (правило 6, STOP D).
>
> Прямое указание капитана: commit_format — дословно
> `feat(bank): M2.9 batch 7 - 12 questions on essential_tools (241→253)`.

## Контекст

Банк — **241** вопрос (`_topics.json` → `total`), цель проекта — 300
(`TARGET_QUESTIONS`, `goal.per_topic_target = 22`). Тема `essential_tools`
(«Базовые инструменты») — **13** вопросов (`et_001…et_013`), цель темы 22,
`objective_domain` у всех 13 активных — `"1"`.

Recon 2026-10-03 (read-only, до создания спеки):

- занятые id: `et_001…et_013`; свободные слоты для батча — `et_014…et_025` (12 ≥ 12);
- занятые механизмы (subtopic, 13 шт.): `grep` (fixed-string, counting, case-insensitive),
  `find` (size, depth), `sort` (numeric, field), `tar` (gzip create, gzip extract),
  `xargs` (batching), `stat` (permission representation), `man` (keyword search),
  `ssh` (public key install);
- свободных механизмов «базовых инструментов» — с запасом (awk, sed, cut, tr, wc,
  head/tail, sort `-u`/`-k`-комбинации, find `-exec`, grep `-A/-B`, tar `-tzf`,
  stat `-c`, rsync, df/du, tee, comm/diff и др.);

**Поправка recon (2026-10-03, по итогам задачи t1 — ошибка первой редакции).**
Список «свободных направлений» выше был построен только по 13 subtopic самой темы
`essential_tools` и **не учитывал соседнюю тему `text_files`** (`tf_001…tf_016`,
16 вопросов): `awk` (выбор полей), `sed` (подстановка и диапазоны строк), `cut`,
`tr`, `sort -u`/`uniq`, `wc`, `head`/`tail` (срезы по знаку), `tee`, `grep` с
контекстом (`-B/-A/-C`, `tf_013`) — **уже заняты** соседом. Прецедент цены такого
пересечения уже зафиксирован: пара `tf_001~tf_002` (cosine 0.9020,
`tools/cosine-calibration.json`). Следовательно эти направления для батча 7
**не годятся** (Edge Case «пересечение с темой соседа недопустимо»).

Фактически занятые 12 механизмов батча (кандидаты t1, свободны и от 13 subtopic
`essential_tools`, и от `text_files`): `find -iname`, `grep -r`, `grep -A`
(after-context), `tar -tzf`, `find -exec`, `stat -c`, `ln -s`, `du -sh`, `diff -u`,
`comm`, `df -h`, `head -n`. Помечено: `et_016` (`grep -A`) **соседствует** с
`tf_013` (`grep: контекст до совпадения`) — обязательная явная проверка cosine
против всей темы `text_files`; значение ≥ 0.80 → кандидат заменяется (t3), порог
не поднимается.
- плюс требование спеки 043: 25 вопросов темы `deploy_systems` при
  `per_topic_target` 22 — принятый перебор (+3), тема `essential_tools` к батчу 7
  будет иметь 25 при 22 — тот же класс перебора, решение — за капитаном
  (в спеке фиксируется, отдельных правок `state.json` не требуется).

## Цель

Добавить 12 вопросов темы `essential_tools` (241 → 253) строго по конвейеру
M2.9 — кандидаты → QC (dedup + Haladyna + cosine) → превью → approve капитана →
интеграция в `src/data/**` → QC-ревью интегрированного банка — так, чтобы банк
стал 253 вопросов, RHEL-верификация подтверждена для каждого вопроса, а дубли и
cosine-пересечения остались ниже порога.

## Что делаем

Новые вопросы: `et_014…et_025`, тема `essential_tools`, `objective_domain: "1"`,
`_meta.pipeline_version: "3.0"`, `source: m2.9-batch7-essential_tools`,
`status: "active"`, `verified_rhel` + `verified_at` для каждого.

- Каждый вопрос: 4 опции ровно с одним `correct: true`, дистракторы — реальные
  команды/ключи того же семейства (не случайные строки), объяснение на русском,
  которое обосновывает верный вариант и **опровергает** каждый дистрактор.
- Механизмы новых вопросов — только свободные: не дублируют 13 занятых subtopic
  `essential_tools` **и** не пересекаются с темой соседа `text_files`
  (`tf_001…tf_016`); фактический список 12 механизмов — в поправке recon выше,
  источник истины для QC — файл кандидатов.
- **Решение по позициям верных опций (2026-10-03, по findings t2, D9).**
  Наивная вставка давала 11 из 12 верных вариантов на позиции 0 → 56% при пороге
  позиционного перекоса. `npm run shuffle-bank -- essential_tools` применять
  **запрещено**: он переупорядочил бы 11 из 13 замороженных live-вопросов темы.
  Решение: переставить опции **только у 12 новых** вопросов в позиции (0-based)
  `3,3,3,1,1,0,2,0,1,0,1,2` для `et_014…et_025`; содержание вопросов, дистракторов
  и объяснений не меняется. Ожидаемая тема после интеграции — 6/7/6/6 (28% на
  позиции 0) при нетронутых live-13; `shuffle-bank:check` остаётся гейтом.
- Dedup: по id, по формулировке и по cosine против всего банка 241 (порог 0.80,
  прецеденты spec 031/039/043); пересечение с темой соседа — недопустимо.
- Haladyna: без «все перечисленное»/«ничего из перечисленного», длина опций
  сопоставима, ни один дистрактор не спорит с содержанием, верный вариант не
  выделен формой/порядком.
- Превью для капитана: `.project/drafts/batch-7-essential-tools-preview.md` с
  12 вопросами в читаемом виде (id, subtopic, вопрос, опции с пометкой верной,
  объяснение, RHEL-источник) — STOP D, approve обязателен до записи в `src/data/**`.

## Критерии приёмки

1. **Кандидаты.** 12 вопросов `et_014…et_025` подготовлены с пречеком (id свободны,
   подтопики не дублируют 13 занятых) → проверка 1 = 0.
2. **QC кандидатов.** Задача qc: dedup (id/формулировка/cosine ≥ 0.80), Haladyna,
   RHEL-факт-чек → отчёт с вердиктом; найденные дефекты возвращаются writer'у до
   превью → проверка 2 = 0.
3. **Превью.** `.project/drafts/batch-7-essential-tools-preview.md` содержит все 12
   вопросов в читаемом виде, включая пометку верной опции и RHEL-ссылку → проверка 3 = 0.
4. **Approve капитана (rule 6, STOP D).** Препятствие: без approve вопросы в
   `src/data/**` не пишутся; reject → правки и повторная STOP D. Внешний владелец —
   капитан, исполнитель проверки — t4 (пишет банк только после approve);
   гейт STOP D подтверждается записью approve в отчёте t4 → проверка 4 = 0.
5. **Интеграция.** В `src/data/questions/essential_tools.json` ровно 25 вопросов
   (`et_001…et_025`), у 12 новых — обязательные поля и `_meta`; `_topics.json` →
   `total` 253, `byTopic.essential_tools` 25; JSON парсится → проверка 5 = 0.
6. **QC интегрированного банка.** `npm run qc` → 0 (без новых findings по теме),
   dedup-отчёт без пар ≥ 0.80 в новых вопросах; распределение позиций верных
   вариантов темы после интеграции — по решению выше (6/7/6/6, позиция 0 = 28%);
   `npm run shuffle-bank -- essential_tools` НЕ запускался (иначе переупорядочил бы
   live-13), проверка позиций — прямым подсчётом по `correct: true` новые 12 vs
   live-13 → проверка 6 = 0.
7. **Гейты.** `npm run typecheck` → 0; `npm run test:run` → 0; `npm run qc` → 0;
   `npm run shuffle-bank:check` → 0; `npm run manifest` → 0;
   `npm run order:check` → 0; `npm run sync:check` → 0 → проверка 7 = 0.
8. **Ревью (qc review).** Финальная QC-задача по интегрированному банку →
   `verdict=pass` → проверка 8 = 0.
9. **Коммит и закрытие.** Коммит банка ровно с subject
   `feat(bank): M2.9 batch 7 - 12 questions on essential_tools (241→253)`;
   `npm run spec:close -- 050` (dry-run → apply) → 0: frontmatter `status: done`,
   episodic, log, converge, финальный `sync:check` = 0 → проверка 9 = 0.
10. **Метрика `added_today`.** Обе регулярки `tools/gen-state.mjs`
    (`/^feat\(bank\)/i` и `/(\d+)\s+questions?/i`) матчат subject коммита:
    после коммита `goal.added_today` = 12 → проверка 10 = 0.
11. **EOL.** Правки `.json`/`.md` в LF (`git ls-files --eol` → `i/lf w/lf`),
    финальный перевод строки; JSON — отступ 2, порядок ключей как в банке
    (правило 16). Проверяет исполнитель интеграции — t4 (файлы банка), для
    draft-файлов (t1/t3) — авторы задач; внешняя проверка — гейт прогона
    → проверка 11 = 0.

## Что НЕ трогать

- Существующие 13 вопросов `et_001…et_013` — ни текст, ни порядок опций, ни `_meta`.
- Другие темы банка (`deploy_systems`, `file_*`, `networking`, …) и их id.
- `tools/gen-state.mjs`, `.project/sync.mjs`, `src/data/questions/index.ts`,
  `.project/state.json`, `package.json`, `vite.config.ts`,
  `playwright.config.ts`, `.project/scripts/**`, `e2e/**`.
- `docs/memory/alerts.md`, `docs/memory/procedural.md`, `docs/SETUP.md` — этой
  спекой не правятся.
- `.project/specs/0*.md` — карточки других спеков (включая закрытые).
- Пуш не выполняется (правила 10/11) — отдельная per-command авторизация капитана.

## Декомпозиция

1. `id: t1` · `subject: 12 кандидатов et_014…et_025 (essential_tools) + пречек: id свободны, подтопики не дублируют 13 занятых` · `assignee: writer` · `dependencies: []`
2. `id: t2` · `subject: QC кандидатов — dedup (id/формулировка/cosine ≥ 0.80), Haladyna, RHEL-факт-чек; вердикт и дефекты обратно writer'у` · `assignee: qc` · `dependencies: [t1]`
3. `id: t3` · `subject: Превью батча 7 для STOP D — .project/drafts/batch-7-essential-tools-preview.md (12 вопросов, верная опция, RHEL-источник)` · `assignee: writer` · `dependencies: [t2]`
4. `id: t4` · `subject: Интеграция после approve — et_014…et_025 в src/data/questions/essential_tools.json, банк 241→253 (коммит feat(bank) batch 7)` · `assignee: builder` · `dependencies: [t3]`
5. `id: t5` · `subject: QC-ревью интегрированного банка — поля/_meta, dedup, Haladyna, гейты; verdict pass/needs_revision` · `assignee: qc` · `dependencies: [t4]`

Write-скоупы (без пересечений по писателю):

- t1 → `.project/drafts/batch-7-essential-tools-candidates.json`
- t2 → `.project/drafts/batch-7-essential-tools-qc.md` (read-only по банку)
- t3 → `.project/drafts/batch-7-essential-tools-preview.md`
- t4 → `src/data/questions/essential_tools.json`, `src/data/questions/_topics.json`
- t5 → `.project/drafts/batch-7-essential-tools-qc-review.md` (read-only по банку)

## Edge Cases

- **STOP D не получен / ответ «revision»** → вопросы в `src/data/**` не пишутся,
  `feat(bank)`-коммит не делается, `spec:close` не запускается: правки — новой
  итерацией кандидатов (правка уже интегрированного банка запрещена, прецедент 039).
- **Таймаут STOP D (30 мин)** → STOP, отчёт, вопросы остаются в черновиках.
- **Cosine ≥ 0.80 с любым существующим вопросом** → кандидат возвращается writer'у
  до превью (порог не поднимается).
- **Свободных механизмов меньше 12** → STOP: батч не добивается вариациями уже
  занятых механизмов.
- **`qc`/`shuffle-bank:check`/`manifest`/`order:check` ≠ 0** → STOP, интеграция
  не коммитится (правило 6: контент без зелёных гейтов и approve не публикуется).
- **`_topics.json` не обновился после интеграции** (total 241) → правка t4 неполная:
  генератор темы пересчитывает `byTopic`, ручная правка `total` не допускается.
- **Перебор темы (25 > 22)** → принятый риск как в spec 043: фиксируется в отчёте
  и `log.md`, решение — за капитаном; `state.json` правится только через `npm run state:update`/`sync`.
- **`sync:check` красный после коммита банка** → сначала `npm run sync` и commit
  производных (правило 3), затем гейт; после этого ≠ 0 → STOP.
- **EOL-шум (CRLF) в JSON** → нормализовать до `git add` (правило 16).

## Источники

- `src/data/questions/essential_tools.json` — 13 активных вопросов (`et_013`:
  схема полей, `_meta.pipeline_version "3.0"`, `source: m2.9-batch1-essential_tools`).
- `_topics.json` — `total: 241`, `byTopic.essential_tools: 13`;
  `tools/gen-state.mjs:203` (`EXPECTED_TOPIC_COUNT = 14`), `:568` (`per_topic_target`
  = `Math.ceil(300/14)` = 22), `:152-167` (`readAddedToday`, `:158` `/^feat\(bank\)/i`,
  `:159` `/(\d+)\s+questions?/i`), `:176-191` (`readAvgDaily7d`).
- `.project/specs/043-batch6-deploy-systems.md` — конвейер батча и прецедент перебора
  темы (25 > 22); `.project/specs/039-bank-audit-036-fixes.md` — правки существующего
  банка вместо интеграции недопустимы.
- `AGENTS.md` — гейты `typecheck`, `test:run`; правило 6 (контент: превью + approve).
- `.project/ORCH-RULES.md` — правила 2, 3, 5, 6, 9, 10, 11, 12, 16, 17.
- `.project/log.md` L228 — решение капитана по перебору `deploy_systems`.

## Проверка

```powershell
# 1. Кандидаты: 12 уникальных id et_014..et_025, подтопики не дублируют занятые
node -e "const c=require('./.project/drafts/batch-7-essential-tools-candidates.json');const live=require('./src/data/questions/essential_tools.json');const used=new Set(live.map(q=>q.id));const arr=Array.isArray(c)?c:c.questions;const bad=arr.filter(q=>used.has(q.id));console.log('candidates='+arr.length+' id-collisions='+bad.length);process.exit(arr.length===12&&bad.length===0?0:1)"

# 2/3. Отчёты QC и превью существуют и непусты
Test-Path .project/drafts/batch-7-essential-tools-qc.md
Test-Path .project/drafts/batch-7-essential-tools-preview.md

# 5. Интеграция: 25 вопросов темы, банк 253, обязательные поля у новых
node -e "const b=require('./src/data/questions/essential_tools.json');const t=require('./src/data/questions/_topics.json');const n=b.filter(q=>/^et_0(1[4-9]|2[0-5])$/.test(q.id));const req=['id','topic','difficulty','objective_domain','subtopic','question','options','explanation','_meta'];const miss=n.filter(q=>req.some(k=>q[k]===undefined)||q.options.length!==4||q.options.filter(o=>o.correct).length!==1);console.log('topic='+b.length+' new='+n.length+' total='+t.total+' byTopic='+t.byTopic.essential_tools+' bad='+miss.length);process.exit(b.length===25&&n.length===12&&t.total===253&&t.byTopic.essential_tools===25&&miss.length===0?0:1)"

# 6/7. Гейты
npm run typecheck; Write-Output "typecheck EXIT=$LASTEXITCODE"
npm run test:run; Write-Output "test:run EXIT=$LASTEXITCODE"
npm run qc; Write-Output "qc EXIT=$LASTEXITCODE"
npm run shuffle-bank:check; Write-Output "shuffle-bank:check EXIT=$LASTEXITCODE"
npm run manifest; Write-Output "manifest EXIT=$LASTEXITCODE"
npm run order:check; Write-Output "order:check EXIT=$LASTEXITCODE"
# Playwright E2E не применяется: spec 050 — type: content, см. SKILL.md Шаг 4b.
npm run sync:check; Write-Output "sync:check EXIT=$LASTEXITCODE"

# 9/10. Коммит и метрика
git log --oneline -3
node -e "const s=require('./.project/state.json');console.log('added_today='+s.goal.added_today)"

# 11. EOL
git ls-files --eol src/data/questions/essential_tools.json src/data/questions/_topics.json .project/specs/050-batch7-essential-tools.md
```

## Отчёт капитану

1. Recon: тема `essential_tools` — 13 вопросов, свободные слоты `et_014…et_025`
   (12 ≥ 12), `objective_domain` темы `"1"`, банк 241 → цель батча 253.
2. Конвейер: t1 кандидаты (+пречек) → t2 QC (dedup/Haladyna/cosine) → t3 превью
   → **STOP D** (approve капитана, ожидание 30 мин) → t4 интеграция
   (`feat(bank): M2.9 batch 7 - 12 questions on essential_tools (241→253)`)
   → t5 QC-ревью.
3. Сырые exit-коды гейтов до/после, вердикт t5, превращение банка 241 → 253.
4. Перебор темы 25 > 22 (`per_topic_target`) — принятый риск (прецедент 043),
   решение за капитаном; отдельной правки `state.json` не делается.
5. Push не выполняется (правила 10/11) — коммиты под отдельную авторизацию капитана.
