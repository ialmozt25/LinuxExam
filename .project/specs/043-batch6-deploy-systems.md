---
id: 043
slug: batch6-deploy-systems
status: approved
type: content
track: full
created: 2026-10-02
updated: 2026-10-02
commit: null
embedded_approve: rule 2 (исключение F5.0a — перевод spec в approved авторизован явной формулировкой капитана 2026-10-02; запись rule2-exception в .project/log.md)
commit_format: "feat(bank): M2.9 batch 6 - 12 questions on deploy_systems (229->241)"
commit_regex:  "^feat\\(bank\\): .*?(\\d+)\\s+questions?"
---

> **M6.0 — batch 6, тема `deploy_systems`, первый боевой прогон run-spec-chain.**
> Спека создана по прямому заданию капитана 2026-10-02 с embedded approve
> (правило 2 в редакции F5.0a: перевод spec в `approved` авторизован явной
> формулировкой; запись `rule2-exception` — строкой в `.project/log.md`).
>
> ВНИМАНИЕ: правило 2 к `type=content` **не** применяется — см. правило 6 в
> редакции 2026-09-28. `status: approved` здесь означает «спека принята к
> исполнению», а **не** право коммитить вопросы в `src/data/**`. Точка остановки —
> превью `.project/drafts/batch-6-preview.md` + явный approve капитана
> (**STOP-точка D** цепочки `run-spec-chain`, Шаг 4a).
>
> Основание: recon-чертёж `.project/drafts/recon-043-batch6-deploy-systems.md`
> (создан по заданию капитана 2026-10-02; отдельного чертежа на диске не было —
> recon выполнен по факту). Трек — **Full** (правило 17: `type: content` всегда Full).

## Контекст

Это **первый боевой прогон** цепочки run-spec-chain (spec 040/046/047) на
контентной спеке: до сих пор цепочка проверялась на инфраструктурных спеках
(045, 046, 047). Для контента критична STOP-точка D — approve капитана на превью
вопросов (правило 6, Шаг 4a скилла): без него вопросы не попадают в `src/data/**`.

Состояние на старте (проверено recon-чертежом):

```powershell
Get-Content src/data/questions/_topics.json -Raw          # total: 229, deploy_systems: 13
$j = Get-Content src/data/questions/deploy_systems.json -Raw | ConvertFrom-Json
$j.id                                                      # ds_001..ds_013
```

- банк — **229** вопросов в 14 темах (`goal.current_questions: 229`, `target_questions: 300`);
- `deploy_systems` — **13** вопросов, разрыв до `per_topic_target: 22` = **9**, максимум в банке;
- все 13 существующих вопросов темы имеют `objective_domain: "6"`;
- диапазон от `ds_014` до `ds_025` **свободен** (коллизий id нет).

Тема `running_systems` (16 вопросов, 14 из них — тоже `objective_domain: "6"`) —
**прямой конкурент** за те же формулировки: это кросс-тема, исключённая заданием
капитана; перечень занятых ею механизмов приведён в recon-чертеже §3.

Границы задания: 12 новых id, `objective_domain` `"6"`, исключение механизмов
ds_001 — ds_013 и кросс-темы `rs_*`; push не выполняется (правила 10/11).
Разбор занятых механизмов — в recon-чертеже §2 (тема) и §3 (кросс-тема).

## Цель

Банк **229 → 241**: добавить **12** вопросов по канонической теме `deploy_systems`
(«Развёртывание систем»), `objective_domain` — `"6"`.

Обоснование выбора темы (recon §1):
- `deploy_systems` = **13** вопросов при `per_topic_target: 22` — разрыв **9**,
  максимальный в банке (вместе с `essential_tools` и `local_storage`), и
  `deploy_systems` идёт первой из трёх по каноническому порядку `src/data/topics.ts`;
- тема входит в objective domain 6 RHCSA EX200 («Deploy, configure and maintain
  systems») — ядро экзамена, покрытие намеренно увеличивается.

Новые id: от `ds_014` до `ds_025` (продолжение после существующих `ds_001`..`ds_013`;
диапазон свободен, коллизий нет). `objective_domain` — `"6"` у всех 12 (конвенция
темы: 13/13 существующих).

## Что делаем

1. Написать 12 вопросов в схеме банка (`id`, `topic`, `difficulty`,
   `objective_domain`, `subtopic`, `question`, `options[4]`, `explanation`).
2. `topic` — строго `deploy_systems` (канон из `src/data/topics.ts`, не выдуманный).
3. Механизмы — из recon §4 (12 позиций), с обязательной проверкой против §2
   (исключённые ds_001 — ds_013) и §3 (исключённая кросс-тема `rs_*`).
4. Прогнать QC до записи в `src/data/**`: ratio по классу вопроса
   (`tools/_lib/ratio.cjs`), cosine против **всего** банка (229) и intra-batch,
   Haladyna AUTO+SEMI, распределение `correctIndex`.
5. Собрать превью `.project/drafts/batch-6-preview.md`: полный текст всех 12
   вопросов + таблица метрик (`id`, класс по словам, ratio chars, порог класса,
   max cos, ближайший сосед, Haladyna, вердикт).
6. **STOP-точка D:** остановиться, показать превью капитану, ждать явного approve
   (таймаут 30 мин — молчание не считается согласием).
7. Только **после** approve — интеграция: дописать вопросы в
   `src/data/questions/deploy_systems.json`, дополнить `_order.json` чистым
   append (порядок существующих id не нормализуется, HANDOFF §7.1), пересобрать
   `_topics.json` **только генератором** (`npm run manifest`), прогнать гейты.

Не в этой задаче (после approve): `npm run qc`, `npm run shuffle-bank:check`
(при fail — `npm run shuffle-bank --apply deploy_systems`, переставляющий только
новые вопросы), `npm run typecheck`, `npm run test:run`, `npm run sync` → коммит →
`npm run sync:check` (правило 3).

### Коммит (обязательное поле для добавления вопросов)

`commit_format` = `feat(bank): M2.9 batch 6 - 12 questions on deploy_systems (229->241)`;
subject матчит **оба** шаблона парсера `tools/gen-state.mjs` (строки 158-159 и
182-183): шаблон начала subject `feat(bank)` и `/(\d+)\s+questions?/i` — проверено **исполнением**
(recon §7, `node .project/drafts/recon-043-regex-check.mjs` → exit 0, захвачено `12`).
Следствие: `goal.added_today += 12`, `avg_daily_7d` учтёт 12.

`commit_regex` объявляет ту же пару регулярок как единый шаблон:
`^feat\(bank\): .*?(\d+)\s+questions?`. Требуемый `.*?` после `": "` —
принципиален: количество стоит не сразу после двоеточия, а после префикса вехи
(`M2.9 batch 6 - `). Конвенция specs 005/020 (`…, (\d+)\s+questions?`, запятая
после `(bank)`) и «дословная» передача её в 043 **несовместимы с требованием
матча**: исправления в чужие спеки и `.project/specs/README.md` **не вносятся**
(правило 13, граница скоупа) — долг выносится отдельным кандидатом.

## Критерии приёмки

1. **12** новых вопросов, id ровно `ds_014`..`ds_025`, `topic` = `deploy_systems`
   (канон `src/data/topics.ts`), `objective_domain` = `"6"` у всех 12.
   Проверка: `(Get-Content src/data/questions/deploy_systems.json -Raw | ConvertFrom-Json).Count` → 25
   и `Select-String -Path src/data/questions/deploy_systems.json -Pattern '"ds_02[0-5]"'` → 6 совпадений.
2. DOD content (`.project/DOD.md`): 4 опции и ровно 1 верная; `explanation` ≤ 3 строк;
   ratio в **символах** (`RATIO_UNIT = 'chars'`) не выходит за порог **класса**
   вопроса по числу слов (`RATIO_TABLE` в `tools/_lib/ratio.cjs`:
   `sentences` FAIL > 1.30, `token` FAIL > 2.00, `mixed` FAIL > 1.50).
3. Haladyna: AUTO 5/5 **и** SEMI 3/3 у каждого вопроса
   (`node tools/haladyna.cjs --batch <candidate.json>`; SEMI 8 требует пути или
   имени команды в стеме).
4. Cosine против **всего** банка (229) ≤ 0.85 у каждого вопроса, без `REJECT`
   от `tools/cosine.cjs`; intra-batch (`--intra-batch`) не добавляет пар > 0.80.
   Проверка: `node tools/cosine.cjs --intra-batch <candidate.json>` и
   `node tools/cosine.cjs <candidate.json>` — exit 0, max cos ≤ 0.85.
5. Bigram Jaccard между опциями ≤ 0.9 (`tools/qc.cjs`); учесть, что токенизатор
   срезает пунктуацию с краёв токена — различие только в ней гейт не увидит.
6. **Не дублируют механизмы** ds_001 — ds_013 (список — recon §2) и **не заходят**
   в кросс-тему `rs_*` (recon §3): по каждому вопросу в превью назван ближайший
   сосед и указано, почему это другой механизм, а не только cosine
   (урок батча 5C: `rs_011` был концептуальным дублем `ds_006` при cosine 0.7308).
7. Распределение `correctIndex` по новым вопросам и темы проверено до записи;
   при `shuffle-bank:check` = fail после интеграции — ровно `npm run shuffle-bank --apply deploy_systems`
   (переставляются только новые вопросы), затем `:check` = 0.
8. Превью `.project/drafts/batch-6-preview.md` создано, содержит полный текст
   12 вопросов **и** таблицу метрик; показано капитану на **STOP-точке D**;
   получен **явный** approve (не таймаут).
9. Интеграция: `deploy_systems.json` (13 → 25), `_order.json` чистый append
   (229 → 241; позиции существующих 229 id побайтово сохранены), `_topics.json`
   только генератором (`Total 241`, `deploy_systems` 13 → 25).
10. Гейты после интеграции: `npm run typecheck` = 0, `npm run test:run` = 0,
   `npm run qc` (Fails 0), `npm run shuffle-bank:check` = 0, `npm run build` = 0,
   `npm run sync:check` = 0 (после конвергента, правило 3).
11. Правило 16: файлы, которые правит t4 — `src/data/questions/deploy_systems.json`,
   `src/data/questions/_order.json`, `src/data/questions/_topics.json` — в UTF-8 без BOM
   и с LF. Проверка: `git diff --stat` + контроль отсутствия CRLF
   (`Select-String -Path src/data/questions/deploy_systems.json -Pattern "\r"`) → 0 совпадений.
12. Строка в `.project/log.md`; запись `rule2-exception | embedded approve spec 043`
   присутствует.

## Что НЕ трогать

- **Существующие вопросы банка** — ds_001 — ds_013 и весь остальной банк (229 id);
  долг темы (пары выше линии 0.80, включая `ds_013`~`pm_014` из `bank-audit`) походя
  не правится.
- **Кросс-тема `running_systems`** (rs_001 — rs_016) — правок нет; используется
  только как источник запретов (recon §3).
- `.project/sync.mjs`, `.project/contracts/**`, `tools/**` (в том числе
  `tools/qc.cjs`, `tools/cosine.cjs`, `tools/shuffle-bank.mjs`,
  `tools/haladyna.cjs`, `tools/_lib/ratio.cjs`, `tools/gen-state.mjs`).
- `.project/DOD.md`, `.project/ORCH-RULES.md`, `.project/DECISIONS.md`,
  `.project/specs/README.md` и спеки 001–047 — включая долг поля `commit_regex`
  в specs 005/015/018/020 (recon §7): фиксируется, но не правится.
- `.project/state.json` (поле `target_questions`, поле `per_topic_target`): расхождение
  «13 + 12 = 25 > 22» (перебор по теме) и глобальный перебор **фиксируются** в
  отчёте и на STOP-точке D, решение — за капитаном.
- `src/data/**` **до** явного approve на STOP-точке D (правило 6).
- Пресет `~/.dsh/.agent-presets/**` — операция капитана, вне репо.
- **Push не выполняется** (правила 10/11 — только per-command авторизация).

## Декомпозиция

1. id: t1, subject: 12 кандидатов ds_014..ds_025 по recon §4 и пречек QC до записи в src/data/**; assignee: writer, dependencies: []
2. id: t2, subject: Независимый QC 12 кандидатов: fact-check каждой опции, objective, dedup (cosine и ближайший сосед), ratio и Haladyna, машиночитаемый verdict; assignee: qc, dependencies: [t1]
3. id: t3, subject: Превью .project/drafts/batch-6-preview.md (полный текст 12 вопросов и таблица метрик) и остановка на STOP-точке D; assignee: writer, dependencies: [t2]
4. id: t4, subject: Интеграция после approve: src/data/questions/deploy_systems.json, src/data/questions/_order.json (чистый append), src/data/questions/_topics.json генератором, гейты; assignee: builder, dependencies: [t3]
5. id: t5, subject: Финальное ревью результата прогона: вердикт pass или needs_revision по критериям приёмки спеки; assignee: reviewer, dependencies: [t4]

Каждая задача пишет **только свой** артефакт: t1 и t2 — файл-кандидат в
`.project/drafts/`, t3 — превью, t4 — `src/data/**` и `_order.json`, t5 — отчёт
ревью. Файл спеки `.project/specs/043-*.md` — артефакт капитана, ни одна задача
его не правит (m08 self-reference). Запись в `.project/log.md` и `spec:close` —
за капитаном и CLI закрытия (внешний владелец, критерии 10 и 12).

Покрытие критериев приёмки задачами: t1 — 1, 2, 4, 5, 6, 7; t2 — 2, 3, 4, 5, 6, 7;
t3 — 7, 8; t4 — 1, 9, 10, 11; t5 — 9, 10, 11.

## Оговорки

### Write-скоупы задач

- t1 → .project/drafts/batch-6-candidates.json
- t2 → .project/drafts/batch-6-qc.md
- t3 → .project/drafts/batch-6-preview.md
- t4 → src/data/questions/deploy_systems.json, src/data/questions/_order.json, src/data/questions/_topics.json
- t5 → .project/drafts/batch-6-review.md

Каждая задача владеет ровно своим артефактом; пересечений write-скоупов нет
(m09). Файл спеки `.project/specs/043-batch6-deploy-systems.md` не входит ни в один
скоуп — это артефакт капитана.

### Порядок работ (правило 3)

1. t1 и t2 идут **до** любой записи в `src/data/**` — кандидат проверяется целиком
   на файле в `.project/drafts/`.
2. Интеграция (t4) выполняется **только после** явного approve на STOP-точке D.
3. Каноническая последовательность интеграции: правка `src/data/questions/deploy_systems.json`
   и `src/data/questions/_order.json` → `npm run manifest` (пересборка `_topics.json`) →
   `git add` → коммит → `npm run sync:check` = 0.
4. `npm run sync:check` — read-only; расхождение производных лечится `npm run sync`
   и новым коммитом, а не правкой `.project/STATE.md` / `.project/SPEC.md` / `docs/index.html` руками.

## Edge Cases

- **Кандидат дублирует механизм** ds_001 — ds_013 или кросс-темы `rs_*` → вопрос
  отвергается, кандидат переписывается **до** записи в `src/data/**`; в превью
  фиксируется пара и причина (урок батча 5C: `rs_011` дублировал `ds_006` при
  cosine 0.7308 — порог такое не ловит, решает чтение ближайшего соседа).
- **Cosine внутри батча > 0.80** (новая близкая пара) → правка формулировки или
  отказ от кандидата; батч не должен добавлять пару выше линии 0.80.
- **`shuffle-bank:check` = fail после интеграции** → ровно
  `npm run shuffle-bank --apply deploy_systems` (переставляются только новые
  вопросы, существующие не трогаются), затем `:check` = 0. Повторный fail после
  одного `--apply` → STOP, доклад капитану (цикл не запускать).
- **`npm run manifest` изменил не только счётчик темы** (порядок/состав
  `_topics.json` сверх `total`/`deploy_systems`) → STOP, доклад: `_topics.json`
  правится только генератором, ручных правок нет.
- **Нет approve на STOP-точке D** (или ответ `revision`) → вопросы в
  `src/data/**` не пишутся, `feat`-коммит не делается, правки — новой итерацией
  кандидатов, а не правкой уже интегрированного банка.
- **Таймаут STOP-точки D (30 мин)** → молчание не считается согласием: отчёт
  капитану и остановка цепочки без интеграции.
- **Гейт красный** (`typecheck` / `test:run` / `qc` / `sync:check`) → задача не
  `done`, коммита нет (правило 3); после `npm run sync` — новый коммит и повторный
  `sync:check`.
- **Уровень per-topic превышен** (`13 + 12 = 25 > 22`) → не блокер: расхождение
  фиксируется в отчёте и выносится на STOP-точку D, `.project/state.json` не правится.

## Превью

Превью обязательно (правило 6). Файл `.project/drafts/batch-6-preview.md` содержит:

1. Полный текст всех 12 вопросов (стем, 4 опции, explanation) — сгенерирован из
   файла-кандидата, а **не** перенабран руками.
2. Таблицу метрик: `id`, класс по числу слов, ratio (chars), порог класса, max cos
   против банка, ближайший сосед, вердикт Haladyna, `correctIndex`.
3. Разбор: какие механизмы выбраны (recon §4) и почему они не дублируют
   ds_001 — ds_013 и механизмы кросс-темы `rs_*`.
4. Риски, места для человеческого взгляда и результаты независимой проверки.
5. Явное указание: вопросы в `src/data/**` **не** записаны, `feat`-коммит **не**
   сделан; интеграция — только после approve.

Остановка: **STOP-точка D** (`run-spec-chain` Шаг 4a; только для `type: content`).
Нет approve (или ответ `revision`) → вопросы в `src/data/**` не пишутся,
`feat`-коммит не делается, правки — новой итерацией кандидатов.

## Отчёт капитану

1. Тема: `deploy_systems`, `count` 13 → 25, банк 229 → 241.
2. Spec 043: approved (embedded approve, правило 2 / F5.0a), трек Full.
3. Батч 6: 12 кандидатов, accept / reject по QC.
4. Превью: путь + сводная таблица (STOP-точка D).
5. Находки recon: долг поля `commit_regex` (specs 005/015/018/020, README §7),
   перебор per-topic +3, риск концептуальных дублей с `rs_*`.
6. Push не выполнялся.
