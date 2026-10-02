---
id: 043
slug: batch6-deploy-systems
status: done
type: content
track: full
created: 2026-10-02
updated: 2026-10-02
commit: 3370bdf
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
> превью `.project/drafts/batch-6-deploy-systems-preview.md` + явный approve капитана
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
  максимальный в банке, и тема **входит в топ-3 по `count` 13** (вместе с
  `essential_tools` и `local_storage`) — порядок здесь по числу вопросов темы,
  а не по позиции в каноническом порядке `src/data/topics.ts`;
- тема входит в objective domain 6 RHCSA EX200 («Deploy, configure and maintain
  systems») — ядро экзамена, покрытие намеренно увеличивается.

Новые id: от `ds_014` до `ds_025` (продолжение после существующих `ds_001`..`ds_013`;
диапазон свободен, коллизий нет). `objective_domain` — `"6"` у всех 12 (конвенция
темы: 13/13 существующих).

## Что делаем

1. Написать 12 вопросов в схеме банка (`id`, `topic`, `difficulty`,
   `objective_domain`, `subtopic`, `question`, `options[4]`, `explanation`).
2. `topic` — строго `deploy_systems` (канон из `src/data/topics.ts`, не выдуманный).
3. Механизмы — 12 позиций таблицы «Компонент 1» ниже. Чертёж
   `.project/drafts/recon-043-batch6-deploy-systems.md` (§1 — §4) заморожен этой
   спекой как обязательный вход. Его sha256 —
   `9bad30eaba185cd1b02ac0ffc6b79b7b6974046185a00dd16d041646acaf3398`
   (`Get-FileHash .project/drafts/recon-043-batch6-deploy-systems.md -Algorithm SHA256`);
   правка чертежа после этой спеки недействительна. Каждый механизм проверяется
   против §2 (существующие ds_001 — ds_013) и §3 (кросс-тема `rs_*`); списки §2 и
   §3 входят в контракт проверки наравне с таблицей «Компонент 1». Две позиции
   исправлены: у `ds_014` механизм один (`OnBootSec=`, без
   `systemctl enable --now`), а `ds_022` берёт `localectl set-locale` вместо
   занятого `hostnamectl set-hostname`.
4. Прогнать QC до записи в `src/data/**` по **копии** банка: кандидат живёт в
   `.project/drafts/`, а инструменты читают банк, поэтому копия
   `src/data/questions/**` и файл-кандидат кладутся в одноразовый каталог.
   Обёртка `node .project/drafts/batch-6-qc-prereq.mjs` (write-скоуп t1) даёт
   ratio по классу вопроса (`tools/_lib/ratio.cjs`), cosine против **всего**
   банка (229) и intra-batch, Haladyna AUTO+SEMI, bigram Jaccard. Сам
   `src/data/**` шаг не трогает.
5. Собрать превью `.project/drafts/batch-6-deploy-systems-preview.md`. Новое имя
   вместо `.project/drafts/batch-6-preview.md`: тот путь занят превью закрытого
   батча M2.9, перезаписи нет. Внутри — полный текст всех 12 вопросов и таблица
   метрик (`id`, класс по словам, ratio chars, порог класса, max cos по банку и
   по `drafts/**`, ближайший сосед по всему банку 229 с темой соседа, Haladyna,
   позиция верной опции, вердикт).
6. **STOP-точка D:** остановиться, показать превью капитану, ждать явного approve
   (таймаут 30 мин — молчание не считается согласием).
7. Только **после** approve — интеграция: дописать вопросы в
   `src/data/questions/deploy_systems.json`, затем 12 вызовов
   `npm run order:add ds_0NN` (чистый append; ручной правки `_order.json` нет —
   порядок существующих 229 id не нормализуется, он описан в
   `docs/archive/HANDOFF.md` §7.1). Затем пересобрать `_topics.json` **только
   генератором** (`npm run manifest`), прогнать гейты, `npm run sync` → коммит →
   `npm run sync:check` = 0 и `npm run order:check` = 0.
8. **Проверка распределения `correctIndex` до записи в `src/data/**`.** Пока
   кандидат лежит в `.project/drafts/`, t1 прогоняет
   `node .project/drafts/batch-6-shuffle-preview.mjs` и печатает доли четырёх
   позиций верной опции (13 существующих + 12 новых). Позиция проходит порог,
   если держит **не больше 15 из 25** вопросов темы (`WARN_SHARE = 0.6`); иначе
   `npm run shuffle-bank:check` вернёт exit 1. Предсказание и фактический
   `npm run shuffle-bank:check` после интеграции сверяются: расхождение — STOP.

Не в этой задаче (после approve, кроме интеграции t4): сами гейты. Это
`npm run qc`, `npm run shuffle-bank:check` (при fail — `npm run shuffle-bank
-- deploy_systems`, переставляющий опции вопросов темы, чей порядок
отличается от целевого, в том числе существующих; после `--apply` ds_001 —
ds_013 контролируются через `git diff`, см. Edge Cases). Директива
`systemctl enable --now` как механизм запрещена: она занята `rs_015` и `ds_009`
(см. «Компонент 1»); t1 её не берёт. Это `npm run typecheck`,
`npm run test:run`, `npm run build`, `npm run order:check`. Каноническая
последовательность интеграции одна — «Порядок работ» п.3; сокращённый дубль
здесь не приводится.

### Компонент 1 — механизмы 12 вопросов `ds_014` — `ds_025`

Таблица замораживает чертёж `recon §4` в тексте спеки: t1 пишет вопросы по этим
механизмам, t2 проверяет свободу механизма по всему банку.

| id (план) | механизм (единственный) | objective_domain | почему не дубль |
|---|---|---|---|
| ds_014 | systemd-таймер: директива `OnBootSec=` | "6" | `OnCalendar` занят `ds_004`; активация `enable --now` не берётся — занята `rs_015` и `ds_009` |
| ds_015 | `CPUQuota=`: ограничение CPU юнита | "6" | механизм свободен во всём банке 229 |
| ds_016 | `MemoryMax=`: жёсткое ограничение памяти юнита | "6" | `MemoryMax=` не равен `CPUQuota=`; мягкий `MemoryHigh=` идёт дистрактором |
| ds_017 | `Restart=` и `RestartSec=`: автоперезапуск упавшего юнита | "6" | механизм свободен; `Restart=` встречается только дистрактором в `rs_002` |
| ds_018 | `systemctl list-unit-files --state=disabled`: аудит отключённых юнитов | "6" | `is-enabled` занят `rs_003` и `rs_010`; здесь инвентарь всей системы |
| ds_019 | `systemctl list-timers`: таймеры, которые сработают | "6" | `systemctl cat` занят `rs_014`; `list-timers` во всём банке свободен |
| ds_020 | `systemctl restart` после правки конфигурации службы | "6" | `daemon-reload` занят `rs_006` и `rs_007`; `restart` встречается только дистракторами |
| ds_021 | `timedatectl set-timezone`: часовой пояс системы | "6" | механизм свободен во всём банке; не `set-default` (`rs_001`) |
| ds_022 | `localectl set-locale`: локаль системы | "6" | замена: `hostnamectl set-hostname` целиком занят вопросом `net_002` темы networking |
| ds_023 | `grubby --update-kernel=ALL --args=`: параметр ядра | "6" | механизм свободен во всём банке |
| ds_024 | `chronyc sources` против `chronyc tracking` | "6" | механизм свободен во всём банке; `timedatectl set-ntp` (`ds_021`) — другой инструмент |
| ds_025 | закрытие крышки ноутбука через **пример: systemd unit file** | "6" | механизм свободен во всём банке; не `Storage=` (`ds_007`) |

Все 12 — `objective_domain: "6"` (конвенция темы). Свобода механизма
проверяется по **всему** банку (229 id) и по пулу `drafts/**`, а не только
против ds_001 — ds_013 и `rs_*`. В превью у каждого вопроса указан ближайший
сосед и тема соседа.

### Компонент 2 — пречек кандидата до записи в `src/data/**`

Пречек идёт по копии банка: `src/data/**` до approve не трогается. Обёртки
живут в write-скоупах t1 и t2.

1. `node .project/drafts/batch-6-qc-prereq.mjs` — QC по копии: ratio, cosine
   против всего банка (229) и intra-batch, Haladyna AUTO+SEMI, bigram Jaccard.
2. `node .project/drafts/batch-6-neighbors.mjs` — топ-1 сосед каждого вопроса
   (`loadBank()` и `embed()` из `tools/cosine.cjs`) с темой соседа.
3. `node .project/drafts/batch-6-shuffle-preview.mjs` — доли четырёх позиций
   верной опции по кандидату (13 существующих + 12 новых) плюс прогноз
   `npm run shuffle-bank:check` без `--apply`. Порог — `WARN_SHARE = 0.6`
   (`tools/shuffle-bank.mjs`, константа): ни одна позиция не держит больше
   15 из 25 вопросов темы; иначе `:check` вернёт exit 1.

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
4. Cosine против **всего** банка (229) ≤ 0.80 у каждого вопроса, без `REJECT`
   от `tools/cosine.cjs`; intra-batch (`--intra-batch`) не добавляет пар > 0.80.
   Проверка: `node tools/cosine.cjs --intra-batch <candidate.json>` и
   `node tools/cosine.cjs <candidate.json>` — exit 0, max cos ≤ 0.80. Порог
   выровнен с инструментом (`tools/cosine-calibration.json`,
   `thresholds.cosine: 0.80`) и с `.project/DOD.md` — решение капитана на
   STOP-точке A (Open Q 2 снят правкой от 2026-10-02).
5. Bigram Jaccard между опциями ≤ 0.9 (`tools/qc.cjs`); учесть, что токенизатор
   срезает пунктуацию с краёв токена — различие только в ней гейт не увидит.
6. **Не дублируют механизмы** ds_001 — ds_013 (список — recon §2) и **не заходят**
   в кросс-тему `rs_*` (recon §3): по каждому вопросу в превью назван ближайший
   сосед **по всему банку 229** с указанием **темы соседа**, и указано, почему
   это другой механизм, а не только cosine (урок батча 5C: `rs_011` был
   концептуальным дублем `ds_006` при cosine 0.7308). Механизм каждого нового
   вопроса (`ds_014` — `ds_025`) — из таблицы «Компонент 1», где `ds_022` берёт
   `localectl set-locale` вместо занятого `hostnamectl set-hostname`
   (занят `net_002` темы networking).
7. Распределение `correctIndex` по новым вопросам и темы проверено до записи;
   при `shuffle-bank:check` = fail после интеграции — ровно
   `npm run shuffle-bank -- deploy_systems` (**только эта тема**; переставляет
   порядок опций вопросов темы, чей порядок отличается от целевого при текущей
   соли, включая существующие ds_001 — ds_013), затем `shuffle-bank:check` = 0
   (прецедент spec 020). После команды обязателен контроль `git diff` по
   ds_001 — ds_013 (см. Edge Cases); изменение существующих вопросов = rollback
   + STOP.
8. Превью `.project/drafts/batch-6-deploy-systems-preview.md` создано, содержит полный текст
   12 вопросов **и** таблицу метрик; показано капитану на **STOP-точке D**;
   получен **явный** approve (не таймаут). Путь превью — то же имя, что у задачи
   t3 в «Декомпозиции» и в write-скоупах (Open Q 5 снят правкой от 2026-10-02).
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

## Проверка — сигналы критериев приёмки

Секция даёт исполнимые сигналы тем критериям, где команда не названа: 2, 5, 6,
7, 8, 9, 12. Текст критериев не меняется — секция только уточняет способ
проверки.

- Критерий 1 (точная сверка id): `$j.id -join ','` → `ds_001,…,ds_025`,
  `$j | Group-Object objective_domain` → 25 групп `"6"`.
- Критерий 2 (MANUAL): поиск перевода строки внутри `explanation` по 12 новым id
  → 0 совпадений; пункт смотрит человек в превью.
- Критерий 5: `node tools/qc.cjs` по копии банка с кандидатом, bigram Jaccard
  между опциями не больше 0.9.
- Критерий 6: таблица превью — ближайший сосед по всему банку 229 и **тема соседа**;
  dedup ведётся против всего банка 229 и пула `drafts/**` (не только против
  ds_001 — ds_013 и `rs_*`).
- Критерий 7: доли четырёх позиций верной опции по кандидату до записи; после
  интеграции `npm run shuffle-bank:check` = 0, при fail — ровно
  `npm run shuffle-bank -- deploy_systems` (только эта тема), затем контроль
  `git diff --stat -- src/data/questions/deploy_systems.json` по ds_001 — ds_013
  (существующие вопросы — только перемещение опций, байтовый контроль).
- Критерий 8: `Test-Path .project/drafts/batch-6-deploy-systems-preview.md` →
  True; явный approve фиксирует капитан на STOP-точке D.
- Критерий 9: `npm run order:check` = 0; `total` в `_topics.json` → 241, счётчик
  темы `deploy_systems` → 25; `git diff` по `_order.json` — одна вставочная
  группа в конце.
- Критерий 11: `Select-String -Path <файл> -Pattern ([char]13)` → 0 совпадений на
  каждом из трёх файлов; `git diff --check` = пусто.
- Критерий 12: `Select-String -Path .project/log.md -Pattern 'rule2-exception'` →
  не меньше одного совпадения; строку пишет капитан или CLI, не задача.
- Критерий 10 (среда): гейты, заблокированные sandbox, отмечаются в артефакте t5
  и прогоняются в неконфайненной оболочке.

## Что НЕ трогать

- **Существующие вопросы банка** — ds_001 — ds_013 и весь остальной банк (229 id);
  долг темы (пары выше линии 0.80 и перекрытия по совпадению опций из
  `.project/audits/bank-audit-2026-09-27.md` §7.3, включая `ds_013`~`pm_014` с cosine 0.7086 — ниже линии, но
  одна и та же верная команда `systemd-analyze blame` в двух темах) походя
  не правится.
- **Кросс-тема `running_systems`** (rs_001 — rs_016) — правок нет; используется
  только как источник запретов (recon §3).
- `.project/sync.mjs`, `.project/contracts/**`, `tools/**` (в том числе
  `tools/qc.cjs`, `tools/cosine.cjs`, `tools/shuffle-bank.mjs`,
  `tools/haladyna.cjs`, `tools/_lib/ratio.cjs`, `tools/gen-state.mjs`).
- `.project/DOD.md`, `.project/ORCH-RULES.md`, `.project/DECISIONS.md`,
  `.project/specs/README.md` и спеки 001–047 (в каталоге фактически нет 026 и
  027) — включая долг поля `commit_regex`: у 005/020 шаблон с запятой после
  `(bank)` не матчит ни один банковский subject, у 015/018 поле отсутствует
  вовсе (recon §7): фиксируется, но не правится.
- `.project/state.json` (поле `target_questions`, поле `per_topic_target`): расхождение
  «13 + 12 = 25 > 22» (перебор по теме) и глобальный перебор **фиксируются** в
  отчёте и на STOP-точке D, решение — за капитаном.
- `src/data/**` **до** явного approve на STOP-точке D (правило 6).
- Пресет `~/.dsh/.agent-presets/**` — операция капитана, вне репо.
- **Push не выполняется** (правила 10/11 — только per-command авторизация).

## Декомпозиция

1. id: t1, subject: 12 кандидатов ds_014..ds_025 по recon §4 и пречек QC до записи в src/data/**; assignee: writer, dependencies: []
2. id: t2, subject: Независимый QC 12 кандидатов: fact-check каждой опции, objective, dedup (cosine по банку и drafts плюс ближайший сосед по всему банку 229 с указанием темы соседа, скрипт-обёртка .project/drafts/batch-6-neighbors.mjs на loadBank() и embed() из tools/cosine.cjs), ratio и Haladyna, машиночитаемый verdict; assignee: qc, dependencies: [t1]
3. id: t3, subject: Превью .project/drafts/batch-6-deploy-systems-preview.md (полный текст 12 вопросов и таблица метрик) и остановка на STOP-точке D; assignee: writer, dependencies: [t2]
4. id: t4, subject: Интеграция после approve: src/data/questions/deploy_systems.json, src/data/questions/_order.json (чистый append), src/data/questions/_topics.json генератором, гейты; assignee: builder, dependencies: [t3]
5. id: t5, subject: Финальное ревью результата прогона: вердикт pass или needs_revision по критериям приёмки спеки; assignee: reviewer, dependencies: [t4]

Каждая задача пишет **только свой** артефакт: t1 и t2 — файл-кандидат в
`.project/drafts/`, t3 — превью, t4 — `src/data/**`, `_order.json` и производные
через `npm run sync`, t5 — отчёт ревью. Файл спеки `.project/specs/043-*.md` —
артефакт капитана, ни одна задача его не правит (m08 self-reference). Внешние
владельцы: запись в `.project/log.md`, `spec:close` (критерий 12), **явный
approve критерия 8** — капитан и `run-spec-chain` Шаг 4a; критерий 10 —
CLI закрытия. Задача t3 останавливается на STOP-точке D и согласия не фиксирует.

Покрытие критериев приёмки задачами: t1 — 1, 2, 4, 5, 6, 7; t2 — 2, 3, 4, 5, 6, 7;
t3 — 7, 8; t4 — 1, 9, 10, 11; t5 — 9, 10, 11.

## Оговорки

### Write-скоупы задач

- t1 → .project/drafts/batch-6-candidates.json, .project/drafts/batch-6-qc-prereq.mjs, .project/drafts/batch-6-shuffle-preview.mjs
- t2 → .project/drafts/batch-6-qc.md, .project/drafts/batch-6-neighbors.mjs
- t3 → .project/drafts/batch-6-deploy-systems-preview.md
- t4 → src/data/questions/deploy_systems.json, src/data/questions/_order.json, src/data/questions/_topics.json, .project/state.json, .project/STATE.md, .project/SPEC.md, docs/index.html
- t5 → .project/drafts/batch-6-review.md

Каждая задача владеет ровно своим артефактом; пересечений write-скоупов нет
(m09). Производные в скоупе t4 (`.project/state.json`, `.project/STATE.md`,
`.project/SPEC.md`, `docs/index.html`) пишет **только генератор** `npm run sync`:
ручных правок этих файлов задача не делает, поля `target_questions` и
`per_topic_target` вручную не меняются. Файл спеки
`.project/specs/043-batch6-deploy-systems.md` не входит ни в один скоуп — это
артефакт капитана.

### Порядок работ (правило 3)

1. t1 и t2 идут **до** любой записи в `src/data/**` — кандидат проверяется целиком
   на файле в `.project/drafts/`.
2. Интеграция (t4) выполняется **только после** явного approve на STOP-точке D.
3. Каноническая последовательность интеграции (единственная в спеке): правка
   `src/data/questions/deploy_systems.json` → 12× `npm run order:add ds_0NN`
   (`_order.json`) → `npm run manifest` (`_topics.json`) → гейты (`typecheck`,
   `test:run`, `qc`, `shuffle-bank:check`, `build`, `order:check`) → `npm run sync`
   (генератор производных) → `git add` → коммит → `npm run sync:check` = 0.
4. `npm run sync` — CLI-генератор, а не ручная правка: он пишет производные в
   рамках скоупа t4. `npm run sync:check` — read-only; расхождение производных
   лечится `npm run sync` и новым коммитом, а не правкой файлов руками.

## Edge Cases

- **Кандидат дублирует механизм** любого из 229 вопросов банка — ds_001 — ds_013,
  кросс-темы `rs_*` или другой темы → вопрос отвергается, кандидат переписывается
  **до** записи в `src/data/**`. В превью
  фиксируется пара и причина (урок батча 5C: **черновая** редакция `rs_011`
  (`systemctl edit`, drop-in) дублировала `ds_006` при cosine 0.7308 и была
  отвергнута — в банк ушёл `systemctl show -p MainPID`
  (`.project/agents/orchestrator-report-2026-09-28-batch5c.md:45`,
  `.project/drafts/batch-5c-preview.md:225`). На текущем банке пара
  `ds_006`~`rs_011` даёт 0.5936 (`node tools/cosine.cjs --intra-batch`), то есть
  порог такое не ловит — решает чтение ближайшего соседа.
  Живой пример: механизм `hostnamectl set-hostname` (план `ds_022`) целиком занят
  вопросом `net_002` темы networking с тем же стемом. Поэтому `ds_022` берёт
  `localectl set-locale`. Директива `systemctl enable --now` как механизм
  запрещена: она занята `rs_015` и `ds_009`.
- **Cosine выше линии 0.80** (новая близкая пара) → правка формулировки или
  отказ от кандидата; батч не должен добавлять пару выше линии. Пуль два: банк
  (229) и `drafts/**`. Каналов отказа тоже два: cosine больше порога и
  stem-bigram Jaccard больше 0.9. Порог инструмента — 0.80
  (`tools/cosine-calibration.json`, ключ `thresholds`); критерий 4 называет
  0.85, и до решения капитана (Open Q 2) верным считается порог инструмента.
  В превью печатаются обе метрики: `bank(j=… cos=…)` и `drafts(j=… cos=…)`.
- **`shuffle-bank:check` = fail после интеграции** → ровно
  `npm run shuffle-bank -- deploy_systems` (только эта тема; скрипт `package.json`
  уже несёт применённый режим, `--apply` в команде не нужен), затем `:check` = 0.
  Режима «только новые
  вопросы» у инструмента нет: соль выбирается по всей теме
  (`tools/shuffle-bank.mjs:123-138`), а `apply()` переставляет опции **каждого**
  вопроса темы, чей порядок отличается от целевого при текущей соли (`:217-231`).
  Поэтому после `--apply` обязателен контроль `git diff`, что ds_001 — ds_013
  побайтово не изменились; изменение существующих вопросов = rollback + STOP
  (их правка запрещена). Повторный fail после одного `--apply` → STOP, доклад
  капитану (цикл не запускать).
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
  фиксируется в отчёте и выносится на STOP-точку D. `.project/state.json`
  правится **только** генератором `npm run sync`: поля `current_questions` и
  `progress_percent` — производные от счётчика тем в `_topics.json`, а
  `target_questions` и `per_topic_target` вручную не меняются.
- **Кавычка или обратный слэш в тексте вопроса** (`awk '{print $1}'`,
  `grep -E "\s"`) → в JSON-строке `"` и `\` экранируются обязательно
  [enriched: https://datatracker.ietf.org/doc/html/rfc8259|Tier 1|2026-10-02]:
  неэкранированный символ валит `ConvertFrom-Json` (критерий 1) и `JSON.parse`
  в `tools/haladyna.cjs` / `tools/cosine.cjs` на файле-кандидате — кандидат не доходит
  до QC. Пречек до интеграции:
  `node -e "JSON.parse(require('fs').readFileSync('.project/drafts/batch-6-candidates.json','utf8'))"`.
- **Кодировка и EOL после правок** (правило 16) → три файла интеграции
  (`src/data/questions/deploy_systems.json`, `src/data/questions/_order.json`,
  `src/data/questions/_topics.json`) проверяются по отдельности: UTF-8 без BOM и
  LF. Ожидаемый результат для каждого файла — 0 совпадений по символу CR
  (`Select-String -Path <файл> -Pattern ([char]13)`), плюс пустой
  `git diff --check`.
- **Распределение `correctIndex` до записи (критерий 7)** → доля каждой из
  четырёх позиций верной опции считается по кандидату, а не после интеграции:
  `node .project/drafts/batch-6-shuffle-preview.mjs` печатает четыре доли по
  файлу-кандидату (13 существующих + 12 новых). Целевой порог — `WARN_SHARE = 0.6`
  (`tools/shuffle-bank.mjs`): позиция держит **не больше 15 из 25** вопросов темы,
  иначе `npm run shuffle-bank:check` возвращает exit 1.
  После интеграции фактический `npm run shuffle-bank:check` сверяется с прогнозом:
  расхождение — STOP.
- **Две опции, каждая из которых верна при недосказанном условии** → гейты
  (ratio, cosine, Haladyna) такого не видят: `systemctl enable` и
  `systemctl enable --now` различаются только тем, запускается ли юнит сейчас.
  Включение и запуск ортогональны
  [enriched: https://www.freedesktop.org/software/systemd/man/latest/systemctl.html|Tier 1|2026-10-02];
  `firewall-cmd --permanent` без `--reload` не меняет активный набор правил
  [enriched: https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/9/html/configuring_firewalls_and_packet_filters/index|Tier 1|2026-10-02].
  Требование к стему: назвать конечное состояние явно («сейчас и после
  перезагрузки», «немедленно», «только после перезагрузки») — иначе верных
  опций две.
- **Опция «все перечисленное» и отрицательный стем** → `tools/haladyna.cjs`
  ищет absolute terms только в стеме и только `все|оба|ни одно|ни один`
  (SEMI 4): опция «Все перечисленные варианты» не блокируется ни одним гейтом,
  а негативный стем («Какая команда НЕ …») не проверяется вовсе. Контрольный
  список приёмки требует обратного — all/none-of-the-above в опциях нет, стем
  не сформулирован отрицательно
  [enriched: https://pmc.ncbi.nlm.nih.gov/articles/PMC12273594/|Tier 1|2026-10-02].
  Независимый QC проверяет это вручную и фиксирует в превью: автоматика не поймает.
- **SEMI 7: опции одного класса** (механизмы ds_014 — ds_025) → `tools/haladyna.cjs`
  требует, чтобы опции были одного класса: либо все — команды, либо все — числа.
  Директивные механизмы (таймер `OnBootSec=`, ресурсные `CPUQuota=` и
  `MemoryMax=`, `Restart=`, logind.conf) оформляются полными командами или
  полными значениями директив. Иначе SEMI 3/3 не берётся.
- **Порядок опций после `npm run shuffle-bank -- deploy_systems`** → инструмент
  переставляет опции (Fisher-Yates; `correct` путешествует со своей опцией),
  поэтому: (а) `explanation` не ссылается на букву или позицию опции («вариант Б»,
  «первый вариант»); (б) источник требует логического порядка опций (хронология,
  по возрастанию) — перестановка его ломает
  [enriched: https://pmc.ncbi.nlm.nih.gov/articles/PMC12273594/|Tier 1|2026-10-02].
  Для вопросов, где порядок опций несёт смысл, берётся другой механизм либо риск
  фиксируется в превью.
- **Версионно-зависимый механизм без якоря версии** → `dnf module` и модульные
  потоки, суффиксы `.el9`, старые подкоманды Podman устаревают между RHEL 9 и
  RHEL 10 (урок батча 5: `ms_004`, `.el9` → `.el10`). Официальные справочники для
  проверки опций — RHEL 9 DNF
  [enriched: https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/9/html/managing_software_with_the_dnf_tool/index|Tier 1|2026-10-02]
  и RHEL 9 containers
  [enriched: https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/9/html/building_running_and_managing_containers/index|Tier 1|2026-10-02];
  у вопроса банка 8 содержательных полей (`id`, `topic`, `difficulty`,
  `objective_domain`, `subtopic`, `question`, `options`, `explanation`) плюс
  необязательный `_meta`; `_meta.verified_rhel` в банке **есть** (64 вопроса, в том
  числе ds_009 — ds_013 со значением `"9.8"`, но модель `QuestionJson` в
  `src/data/models/Question.ts` его не типизирует). Поэтому якорь версии ставится
  в стем (`в RHEL 9`) как конвенция батча, а не из-за отсутствия поля — иначе
  вопрос тихо устаревает.
- **Таймер `OnBootSec=` отсчитывается от загрузки, а не от календаря**
  (план ds_014) → `OnBootSec=` — монотонный таймер относительно момента загрузки
  машины, `OnStartupSec=` — относительно старта менеджера служб. В контейнере для
  системного менеджера первое отображается на второе, то есть значения
  эквивалентны. `OnCalendar=` — другой механизм (занят `ds_004`)
  [enriched: https://raw.githubusercontent.com/systemd/systemd/v252/man/systemd.timer.xml|Tier 1|2026-10-02].
  Требование к стему: назвать якорь запуска («через 15 минут после каждой
  загрузки») и среду (физическая машина, а не контейнер) — иначе «после загрузки»
  одинаково верно для `OnBootSec=` и `OnStartupSec=`.
- **Ресурсные директивы юнита: формат значения и мягкий/жёсткий лимит**
  (план ds_015, ds_016) → `CPUQuota=` принимает процент **со знаком `%`**
  относительно одного ядра (`> 100 %` — несколько ядер). `MemoryMax=` — байты с
  суффиксами `K/M/G/T` (основание 1024) либо процент от физической памяти.
  Превышение `MemoryMax=` вызывает OOM-killer внутри юнита. `MemoryHigh=` —
  отдельный мягкий порог; man-страница рекомендует его как основной механизм
  [enriched: https://raw.githubusercontent.com/systemd/systemd/v252/man/systemd.resource-control.xml|Tier 1|2026-10-02].
  Дистракторы `CPUQuota=50` (без `%`) и `MemoryMax=512` (это байты, а не 512 МиБ)
  невалидны, а стем «ограничить память сервиса» без слова «жёстко» делает верными
  обе опции — `MemoryHigh=` и `MemoryMax=`.
- **Инвентарь юнитов: `list-timers` показывает только таймеры в памяти**
  (план ds_018, ds_019) → `systemctl list-timers` перечисляет таймеры, находящиеся
  в памяти, упорядоченные по времени следующего срабатывания
  (NEXT/LEFT/LAST/PASSED/UNIT/ACTIVATES), тогда как
  `systemctl list-unit-files --type service` печатает STATE установленных файлов
  юнитов (`enabled`/`disabled`). Словарь состояний `is-enabled` различает
  `enabled`, `disabled`, `static`, `indirect`, `masked`: это разные значения, а не
  синонимы
  [enriched: https://raw.githubusercontent.com/systemd/systemd/v252/man/systemctl.xml|Tier 1|2026-10-02].
  Требование к стему: различать «настроенные таймеры» (инвентарь) и «таймеры,
  которые сработают» (память) — опция `list-timers` как «полный список настроенных
  таймеров» неверна.
- **`grubby` правит BLS-записи, и параметр действует только после перезагрузки**
  (план ds_023) → `grubby --update-kernel=ALL --args="<param>"` добавляет параметр
  в каждый файл `/boot/loader/entries/<entry>.conf`; охват задаётся
  `--update-kernel=ALL|DEFAULT|<версия>`, удаление — `--remove-args`. Для только
  что установленного ядра документирована известная проблема: параметры до него
  не доходят без `grub2-mkconfig`
  [enriched: https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/9/html/managing_monitoring_and_updating_the_kernel/configuring-kernel-command-line-parameters_managing-monitoring-and-updating-the-kernel|Tier 1|2026-10-02].
  Требование к стему: назвать конечное состояние («после перезагрузки») и охват
  записей — иначе верны и `--update-kernel=ALL`, и `=DEFAULT`, и правка
  `/etc/default/grub` выглядит равнозначной.
- **`/etc/systemd/logind.conf`: `HandleLidSwitch=` не действует на док-станции**
  (план ds_025) → значения директивы — закрытый список (`ignore`, `poweroff`,
  `reboot`, `halt`, `kexec`, `suspend`, `hibernate`, `hybrid-sleep`,
  `suspend-then-hibernate`, `lock`, `factory-reset`), по умолчанию
  `HandleLidSwitch=suspend`. Если система в док-станции или подключено больше
  одного дисплея, срабатывает `HandleLidSwitchDocked=` (по умолчанию `ignore`).
  `HandleLidSwitchExternalPower=` по умолчанию полностью игнорируется, пока ему
  не задано явное значение
  [enriched: https://raw.githubusercontent.com/systemd/systemd/v252/man/logind.conf.xml|Tier 1|2026-10-02].
  Требование к стему: назвать сценарий (крышка в док-станции, на внешнем питании,
  автономно) — иначе верны разные директивы, а значение вне списка делает опцию
  невалидной.
- **Проверка синхронизации времени: `sources` ≠ `tracking`, `makestep` двигает
  часы** (план ds_024) → RHEL 9 документирует `chronyc tracking` (состояние
  синхронизации) и `chronyc sources`/`sourcestats` (список источников) как разные
  запросы, а `chronyc makestep` принудительно «шагает» системные часы вместо
  плавной подстройки; по `chronyc(1)` команды мониторинга (`sources`,
  `sourcestats`, `tracking`, …) разрешены по сети по умолчанию. Меняющие
  поведение `chronyd` команды — только через Unix-сокет
  [enriched: https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/9/html/configuring_basic_system_settings/configuring-time-synchronization_configuring-basic-system-settings|Tier 1|2026-10-02]
  [enriched: https://chrony-project.org/doc/latest/chronyc.html|Tier 1|2026-10-02].
  Требование к стему: назвать, что именно проверяется («синхронизированы ли часы»
  против «какие источники опрашиваются») — иначе `chronyc sources` и
  `chronyc tracking` обе верны.
- **Имя хоста и часовой пояс: три имени хоста и «первая существующая» служба
  синхронизации** (план ds_021, ds_022) → `hostnamectl` различает pretty, static и
  transient hostname (static и transient ограничены 64 символами; при заданном
  static transient не используется), а `--static|--transient|--pretty` при
  `set-hostname` меняют разные имена. Подкоманда `timedatectl set-timezone`
  правит симлинк `/etc/localtime`, `list-timezones` печатает доступные пояса, а
  `timedatectl set-ntp true` включает и запускает **первую существующую** службу
  сетевой синхронизации (в RHEL 9 — `chronyd`), пояс не трогая
  [enriched: https://raw.githubusercontent.com/systemd/systemd/v252/man/hostnamectl.xml|Tier 1|2026-10-02]
  [enriched: https://raw.githubusercontent.com/systemd/systemd/v252/man/timedatectl.xml|Tier 1|2026-10-02].
  Требование к стему: назвать требуемое имя/состояние («статическое имя,
  сохраняющееся после перезагрузки», «пояс `Europe/Moscow`») — иначе верны разные
  подкоманды.
- **Постоянное хранение журнала: `Storage=` не единственный переключатель**
  (механизм занят `ds_007` — новый кандидат его не переиспользует) → journald
  хранит данные либо постоянно в
  `/var/log/journal`, либо волатильно в `/run/log/journal/` (во втором случае
  журнал **теряется при перезагрузке**). По умолчанию данные постоянны, **если
  `/var/log/journal/` существует на момент загрузки**, иначе — молчаливый откат к
  волатильному хранению. Переключение на постоянное хранение требует создания
  каталога (`mkdir -p /var/log/journal` + `systemctl restart systemd-journald`),
  причём до этого момента journald пишет волатильно
  [enriched: https://raw.githubusercontent.com/systemd/systemd/v252/man/systemd-journald.service.xml|Tier 1|2026-10-02].
  Требование к стему: назвать хранение явно («сохраняются после перезагрузки»,
  «только до перезагрузки») — иначе верны и `Storage=persistent`, и `mkdir`, и
  `journalctl --flush`; «постоянное хранение» и «постоянная настройка в конфиге» —
  разные утверждения.
- **`sudoers.d`: имя файла и `visudo -c` важнее содержания правила** (общий
  deploy-риск, применим к любому кандидату про sudo) → файлы из `@includedir
  /etc/sudoers.d` разбираются в **лексическом**, а не числовом порядке (`1_whoops`
  загрузится **после** `10_second`), имена с точкой или `~` **пропускаются** как
  временные. Drop-in обычно называют без точки (`/etc/sudoers.d/90-deploy`).
  При синтаксической ошибке `sudo` может отказаться работать («sudo may refuse to
  run»), если это единственный способ получить root, а `visudo` не редактирует
  файлы из `@includedir`, пока один из них не содержит ошибку
  [enriched: https://raw.githubusercontent.com/sudo-project/sudo/main/docs/sudoers.man.in|Tier 1|2026-10-02].
  Требование к стему: не ставить верным «создать файл с правилом» без проверки
  (`visudo -cf /etc/sudoers.d/<файл>`) — иначе «добавить файл» выглядит достаточным
  действием; дистрактор с точкой в имени (`app.deploy`) не читается вовсе.
- **`sshd`-конфигурация: `Include` и `Match` меняют то, какое значение победит**
  (общий deploy-риск, применим к любому кандидату про sshd) → для каждого ключевого
  слова `sshd_config` действует **первое полученное значение**. `Include` со
  wildcard раскрывается и обрабатывается в **лексическом порядке**. `Include` можно
  ставить внутри блока `Match`. Блок `Match` перекрывает глобальные значения
  только до следующей строки `Match`/конца файла. При нескольких подходящих блоках
  `Match` применяется **первое** вхождение ключа
  [enriched: https://raw.githubusercontent.com/openssh/openssh-portable/V_9_9_P1/sshd_config.5|Tier 1|2026-10-02].
  Требование к стему: назвать место правки и проверку синтаксиса
  (`sshd -t`), а не «поправить sshd_config» — при drop-in после строки `Include`
  новое значение может не победить старое, и верной окажется не та опция.
- **`Restart=` и `RestartSec=` — два разных поля, и `always` недопустим у
  `Type=oneshot`** (план ds_017) → `Restart=` (по умолчанию `no`) решает, будет ли
  служба перезапущена при выходе процесса, `on-failure` перезапускает при ненулевом
  коде возврата, сигнале (кроме `SIGHUP`/`SIGINT`/`SIGTERM`/`SIGPIPE`), таймауте
  операции и срабатывании watchdog. Значение `always` перезапускает юнит
  независимо от исхода. Останов или перезапуск **по инициативе systemd**
  перезапуска не вызывает, задержку задаёт
  отдельное поле `RestartSec=` (по умолчанию 100 ms, принимает `5min 20s`), а для
  `Type=oneshot` значения `Restart=always` и `Restart=on-success` **недопустимы**
  [enriched: https://raw.githubusercontent.com/systemd/systemd/v252/man/systemd.service.xml|Tier 1|2026-10-02].
  Требование к стему: называть требуемое поведение («перезапускать при аварийном
  завершении», «не перезапускать после ручной остановки») и не подменять `Restart=`
  полем `RestartSec=` — иначе верны обе опции, а `Type=oneshot` + `Restart=always`
  делает опцию невалидной.

## Источники

Проверено Фазой 2 (`2-research`) 2026-10-02. Tier 1 — официальная документация,
стандарты, peer-reviewed публикации; Tier 2 — авторитетные инженерные практики;
Tier 3 (блоги, форумы) в подтверждение не принимался.

- Официальная страница экзамена RHCSA (EX200) — состав целей экзамена; точка
  перепроверки привязки темы `deploy_systems` к objective domain. Нумерация
  доменов 1–9 — конвенция репозитория, а не текст Red Hat
  [enriched: https://www.redhat.com/en/services/training/ex200-red-hat-certified-system-administrator-rhcsa-exam|Tier 1|2026-10-02].
- `systemctl(1)` (systemd) — включение и запуск юнита ортогональны, `--now`
  добавляет запуск
  [enriched: https://www.freedesktop.org/software/systemd/man/latest/systemctl.html|Tier 1|2026-10-02].
- RHEL 9, «Configuring firewalls and packet filters» — семантика `firewall-cmd`
  (`--permanent` против runtime, `--reload`)
  [enriched: https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/9/html/configuring_firewalls_and_packet_filters/index|Tier 1|2026-10-02].
- RHEL 9, «Managing software with the DNF tool» — справочник по `dnf` для
  проверки опций про установку и обновление ПО
  [enriched: https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/9/html/managing_software_with_the_dnf_tool/index|Tier 1|2026-10-02].
- RHEL 9, «Building, running, and managing containers» — справочник по Podman
  [enriched: https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/9/html/building_running_and_managing_containers/index|Tier 1|2026-10-02].
- RFC 8259 (JSON, Internet Standard) — `"` и `\` в строке экранируются
  обязательно
  [enriched: https://datatracker.ietf.org/doc/html/rfc8259|Tier 1|2026-10-02].
- Magzoub et al., «Ten tips to harnessing generative AI for high-quality MCQs»,
  Medical Education Online 2025, PMC12273594 — контрольный список приёмки
  вопроса (длинная опция, all/none-of-the-above, отрицательный стем, логический
  порядок опций)
  [enriched: https://pmc.ncbi.nlm.nih.gov/articles/PMC12273594/|Tier 1|2026-10-02].

Дополнение повторного прогона Фазы 2 (`2-research`) 2026-10-02 — источники под
механизмы программы батча 6 (`ds_014` — `ds_025`, recon §4). Все URL открыты на
этом прогоне обычным HTTP-клиентом (`node fetch`, HTTP 200). Man-страницы systemd
взяты из upstream-репозитория проекта с закреплённым тегом `v252` (та же
major-версия, что несёт линейка RHEL 9), потому что `freedesktop.org` отдаёт
браузерным User-Agent'ам анти-бот-заглушку `418` вместо страницы: тот же URL
отвечает `200` клиенту без браузерного UA, то есть ссылка жива, но из браузера
нечитаема.

- RHEL 9, «Managing systemd» (книга «Configuring basic system settings») —
  инвентарь служб: `systemctl list-unit-files --type service` печатает колонку
  STATE (`enabled`/`disabled`), `list-units` показывает только загруженные юниты
  [enriched: https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/9/html/configuring_basic_system_settings/managing-systemd_configuring-basic-system-settings|Tier 1|2026-10-02].
- RHEL 9, «Configuring time synchronization» — `chronyc tracking` против
  `chronyc sources`/`sourcestats`, ручная подстройка `chronyc makestep`
  [enriched: https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/9/html/configuring_basic_system_settings/configuring-time-synchronization_configuring-basic-system-settings|Tier 1|2026-10-02].
- RHEL 9, «Configuring kernel command-line parameters» (книга «Managing,
  monitoring, and updating the kernel») — `grubby --update-kernel=ALL --args=`,
  `--remove-args`, правка `/boot/loader/entries/<entry>.conf`, известная проблема
  с новым ядром и `grub2-mkconfig`
  [enriched: https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/9/html/managing_monitoring_and_updating_the_kernel/configuring-kernel-command-line-parameters_managing-monitoring-and-updating-the-kernel|Tier 1|2026-10-02].
- `chronyc(1)` (chrony project) — формы `makestep` (порог и лимит), список команд
  мониторинга, разрешённых по сети, и правило «меняющие поведение команды — только
  через Unix-сокет»
  [enriched: https://chrony-project.org/doc/latest/chronyc.html|Tier 1|2026-10-02].
- `systemd.timer(5)` v252 — `OnBootSec=`/`OnStartupSec=` как монотонные таймеры и
  их эквивалентность в контейнере
  [enriched: https://raw.githubusercontent.com/systemd/systemd/v252/man/systemd.timer.xml|Tier 1|2026-10-02].
- `systemd.resource-control(5)` v252 — `CPUQuota=` (процент с `%`, `> 100 %` на
  несколько ядер), `MemoryMax=` (байты, суффиксы `K/M/G/T`, OOM-killer внутри
  юнита) против мягкого `MemoryHigh=`
  [enriched: https://raw.githubusercontent.com/systemd/systemd/v252/man/systemd.resource-control.xml|Tier 1|2026-10-02].
- `systemctl(1)` v252 — таблица состояний `is-enabled` (`enabled`, `disabled`,
  `static`, `indirect`, `masked`, …), `list-timers` как «таймеры в памяти»,
  `daemon-reload` против `reload`
  [enriched: https://raw.githubusercontent.com/systemd/systemd/v252/man/systemctl.xml|Tier 1|2026-10-02].
- `logind.conf(5)` v252 — закрытый список значений `HandleLidSwitch=`, приоритет
  `HandleLidSwitchDocked=`/`HandleLidSwitchExternalPower=`, дефолт `suspend`
  [enriched: https://raw.githubusercontent.com/systemd/systemd/v252/man/logind.conf.xml|Tier 1|2026-10-02].
- `hostnamectl(1)` v252 — три имени хоста (pretty/static/transient), лимит
  64 символа, `--static|--transient|--pretty`
  [enriched: https://raw.githubusercontent.com/systemd/systemd/v252/man/hostnamectl.xml|Tier 1|2026-10-02].
- `timedatectl(1)` v252 — `set-timezone` правит симлинк `/etc/localtime`,
  `list-timezones` печатает доступные пояса, `set-ntp` включает и запускает первую
  существующую службу синхронизации
  [enriched: https://raw.githubusercontent.com/systemd/systemd/v252/man/timedatectl.xml|Tier 1|2026-10-02].

Дополнение третьего прогона Фазы 2 (`2-research`) 2026-10-02 — источники под
**пробелы контроля качества**, найденные сверкой Edge Cases с механизмами
программы батча (recon §2 — §4): журнал, sudo, sshd и автоперезапуск юнита. Все
URL скачаны на этом прогоне обычным HTTP-клиентом (`node fetch`, HTTP 200, не
`HEAD`); systemd закреплён тегом `v252` (major-версия линейки RHEL 9), OpenSSH —
тегом `V_9_9_P1` (версия 9.9p1 линейки RHEL 9). Источник `sudoers(5)` — ветка
`main` проекта sudo без закреплённого тега (теги `v1.9.x` в репозитории есть,
но источник взят из `main`; в `docs/sudoers.man.in` не раскрыты подстановки
шаблона, включая `@PACKAGE_VERSION@`, поэтому версию источник не называет),
что фиксируется как предел точности этого источника. У `docs.redhat.com` `HEAD`
отдаёт `403` (анти-бот), `GET` — `200` с телом около 700 КБ.

- `systemd-journald.service(8)` v252 — постоянное (`/var/log/journal`) и
  волатильное (`/run/log/journal/`, данные **теряются при перезагрузке**) хранение;
  постоянное включается существованием каталога на момент загрузки, иначе —
  молчаливый откат к волатильному
  [enriched: https://raw.githubusercontent.com/systemd/systemd/v252/man/systemd-journald.service.xml|Tier 1|2026-10-02].
- `sudoers(5)` (sudo project, `docs/sudoers.man.in`) — `@includedir /etc/sudoers.d`:
  лексический (не числовой) порядок разбора, пропуск имён с точкой и `~`,
  предупреждение «sudo may refuse to run» при синтаксической ошибке, `visudo` не
  правит файлы `@includedir` без ошибки
  [enriched: https://raw.githubusercontent.com/sudo-project/sudo/main/docs/sudoers.man.in|Tier 1|2026-10-02].
- `sshd_config(5)`, тег `V_9_9_P1` — «первое полученное значение» для каждого
  ключевого слова, `Include` с wildcard в лексическом порядке и внутри `Match`,
  при нескольких подходящих блоках `Match` применяется первое вхождение ключа
  [enriched: https://raw.githubusercontent.com/openssh/openssh-portable/V_9_9_P1/sshd_config.5|Tier 1|2026-10-02].
- `systemd.service(5)` v252 — `Restart=` (по умолчанию `no`; `on-failure` против
  `always`; останов по инициативе systemd перезапуск не вызывает), отдельное поле
  `RestartSec=` (по умолчанию 100 ms) и запрет `Restart=always`/`on-success` для
  `Type=oneshot`
  [enriched: https://raw.githubusercontent.com/systemd/systemd/v252/man/systemd.service.xml|Tier 1|2026-10-02].

## Открытые вопросы и решения (STOP-точка A)

1. **Нумерация `objective_domain` и границы темы.** Тезис спеки: «все 13
   существующих вопросов темы имеют `objective_domain: "6"`» → конвенция темы
   переносится на все 12 новых id (критерий 1). Тезис источника: официальная
   страница экзамена RHCSA (EX200) задаёт состав целей, но не нумерует домены 1–9
   [enriched: https://www.redhat.com/en/services/training/ex200-red-hat-certified-system-administrator-rhcsa-exam|Tier 1|2026-10-02];
   нумерация зафиксирована только внутренним документом
   (`docs/content-generation-20260921-1403.md`). Почему это конфликт: спека
   опирается на номер домена как на внешний факт, а внешнего подтверждения
   нумерации нет; при этом `docs/BLUEPRINT-300.md` объявляет домен полем
   **вопроса**, а не темы, — жёсткое `"6"` у всех 12 может проставить неверный
   домен там, где механизм вопроса лежит на границе с целями «Manage security»
   или «Manage basic networking». Вариант A: оставить `"6"` у всех 12 по
   конвенции 13/13 (риск — mislabel у 1–3 вопросов). Вариант B: считать домен по
   механизму вопроса и разрешить у части id значения `"7"`/`"9"` — это меняет
   критерий 1, поэтому правка за капитаном, не за конвейером. **Решено
   капитаном 2026-10-02: вариант A** — все 12 новых id пишут `"6"`.

Далее — дефекты, найденные Фазой 3 (`3-factcheck`) и **не исправимые** в ней:
правка требует защищённой секции («## Цель» / «## Критерии приёмки») или
write-скоупа, поэтому они были вынесены как hard-fail на решение капитана
(Фаза 9 / STOP).

### Решение капитана — правки 1-9 (2026-10-02)

Авторизованы правки защищённых секций («## Цель», «## Критерии приёмки») и
write-скоупов по всем 9 hard-fail; правки применены оркестратором на STOP-точке A
(коммит `de15109 docs(spec-043): resolve 9 hard-fail`).
Решения по «Открытым вопросам»: п. 1 — вариант A (все 12 = `"6"`); пункты 8,
9 и 11 ниже — **сняты**.

1. **F3-01 (Цель)** — «идёт первой из трёх по каноническому порядку
   `src/data/topics.ts`» → «входит в топ-3 по `count` 13».
2. **F3-02 (критерий 4)** — порог cosine 0.85 → **0.80** (выровнен с
   `tools/cosine-calibration.json` `thresholds.cosine` и `.project/DOD.md`).
3. **F3-03 (критерий 8)** — путь превью
   `.project/drafts/batch-6-preview.md` → `.project/drafts/batch-6-deploy-systems-preview.md`.
4. **ADV-d1 + SIM-02 (t4, write-скоуп и порядок работ)** — в скоуп t4 добавлены
   `.project/state.json`, `.project/STATE.md`, `.project/SPEC.md`, `docs/index.html`,
   и `npm run sync` вписан в каноническую последовательность интеграции.
5. **ADV-d2 (критерий 6)** — `hostnamectl set-hostname` → `localectl set-locale`
   (согласовано с «Что делаем» п.3 и таблицей «Компонент 1»).
6. **SIM-01 (t3, write-скоуп)** — путь артефакта t3 =
   `.project/drafts/batch-6-deploy-systems-preview.md`, как в критерии 8.
7. **SIM-03 (t2 + «Превью»)** — dedup против банка 229 и ближайший сосед с темой
   соседа зафиксированы явно.
8. **m06 (ядро, Фаза 1)** — упомянутый несуществующий путь
   `/etc/systemd/logind.conf` в таблице механизмов заменён на «пример: systemd
   unit file».
9. **Open Q 7 (критерий 7)** — формулировка «`shuffle-bank --apply` переставляет
   только новые вопросы» заменена на `npm run shuffle-bank -- deploy_systems`
   (только эта тема) + `shuffle-bank:check` = 0 (прецедент spec 020),
   согласовано с Edge Cases («режима „только новые вопросы“ у инструмента нет»).
   Авторизация правки защищённой секции «## Критерии приёмки» — отдельным
   решением капитана 2026-10-02 (в дополнение к правкам 1–8).
10. **m06, остаточные срабатывания** — оставлены без правок (решение капитана
    2026-10-02): строка Edge Cases `/etc/systemd/logind.conf` и 30 ложных
   срабатываний (ссылки с номерами строк, man-страницы, домены, синтетические
   токены).

Открытые решения капитана, зафиксированные тем же решением:
`objective_domain` — **все 12** новых вопросов = `"6"` (уточнение пункта 1 ниже);
порог cosine — **0.80** (уточнение пункта 2 ниже).

8. **Порог cosine: критерий 4 против инструмента — снято решением капитана
   2026-10-02.** Критерий 4 требовал «cosine против всего банка ≤ 0.85 … exit 0»,
   тогда как `tools/cosine.cjs` берёт порог из `tools/cosine-calibration.json`
   (`thresholds.cosine: 0.80`) и отклоняет пару при `cos > 0.80`. Критерий 4
   правкой приведён к **0.80** (см. правку 2 выше).

9. **Утверждение Цели о порядке тем — снято решением капитана 2026-10-02.**
   Обоснование выбора темы утверждало «`deploy_systems` идёт первой из трёх по
   каноническому порядку `src/data/topics.ts`»; фактически в `topics.ts` тема —
   11-я из 14, а «первой» она является только в алфавитном `state.json.topics`.
   Обоснование заменено на «входит в топ-3 по `count` 13» (см. правку 1 выше) — утверждение о каноническом порядке из спеки убрано.

10. **URL перепроверены на третьем прогоне Фазы 3 (пометка снята; вопрос закрыт).** Первый прогон
   Фазы 3 не смог разрешить URL из своего раннера (7 URL того прогона: DNS отдавал
   непубличные адреса, `web_fetch` — ошибка, `Invoke-WebRequest` — ошибка TLS).
   На третьем прогоне Фазы 3 все **21** уникальных URL текущей спеки открылись
   обычным HTTP-клиентом (`node fetch`, GET) — HTTP 200 у всех 21, dead 0
   (`.project/drafts/spec-043-enrich/phase-3-url-results.json`); маркеров
   `|unverified` в спеке нет, поэтому finding «dead URL» не требуется. Ограничение
   относилось к раннеру первого прогона, а не к спеке.

11. **Коллизия имени превью — снято решением капитана 2026-10-02.** t3 писал в
   `.project/drafts/batch-6-preview.md`, занятый превью закрытого батча M2.9
   (`manage_software`, 2026-09-27, spec 005). Принято новое имя
   `.project/drafts/batch-6-deploy-systems-preview.md`; критерий 8 и «## Превью»
   приведены к тому же имени (см. правки 3 и 6 выше).

12. **Критерий 7 против Edge Cases — снято решением капитана 2026-10-02.**
   Формулировка «`shuffle-bank --apply` переставляет только новые вопросы»
   заменена на `npm run shuffle-bank -- deploy_systems` (только эта тема) и
   `shuffle-bank:check` = 0 (прецедент spec 020) — см. правку 9 выше.

13. **Внешние маппинги и процессный нарратив не проверяются командами репозитория
   (UNVERIFIABLE, на исполнение не влияет).** Утверждение «systemd `v252` /
   OpenSSH `V_9_9_P1` — те же major-версии, что несёт линейка RHEL 9» требует
   внешней матрицы версий RHEL 9. Утверждение «до сих пор цепочка проверялась
   на инфраструктурных спеках (045, 046, 047)» — процессной истории. Ни то, ни
   другое не доказывается командами репозитория (`.project/log.md` и
   `.project/logs/notify-log.jsonl` подтверждают только, что 045/046/047 —
   инфраструктурные спеки и закрыты). Пометка `UNVERIFIABLE` Фазы 3, не блокер.

## Превью

Превью обязательно (правило 6). Файл
`.project/drafts/batch-6-deploy-systems-preview.md` содержит (новое имя: старый
путь `.project/drafts/batch-6-preview.md` занят превью закрытого батча M2.9,
перезаписи нет; критерий 8 называет **то же** новое имя — Open Q 5 снят решением
капитана 2026-10-02):

1. Полный текст всех 12 вопросов (стем, 4 опции, explanation) — сгенерирован из
   файла-кандидата, а **не** перенабран руками.
2. Таблицу метрик: `id`, класс по числу слов, ratio (chars), порог класса, max cos
   против банка и против `drafts/**`, ближайший сосед по всему банку 229 с темой
   соседа, вердикт Haladyna, позиция верной опции. Печать обеих метрик:
   `bank(j=… cos=…)` и `drafts(j=… cos=…)`.
3. Точную сверку множества id: `$j.id -join ','` → `ds_001,…,ds_025`, группировку
   `$j | Group-Object objective_domain` → 25 групп `"6"`.
4. Разбор: какие механизмы выбраны (таблица «Компонент 1») и почему они не
   дублируют ds_001 — ds_013, механизмы кросс-темы `rs_*` и остальные 229
   вопросов банка (каждый вопрос — с ближайшим соседом по всему банку 229 и
   темой соседа; dedup против банка 229 явно).
5. Риски и обязательные ручные проверки независимого QC: две верные опции при
   недосказанном условии (случай `systemctl enable` против `systemctl enable --now`),
   опции с absolute terms («все перечисленные варианты»), отрицательный стем
   («Какая команда НЕ …»), ссылка `explanation` на букву или позицию опции.
6. Явное указание: вопросы в `src/data/**` **не** записаны, `feat`-коммит **не**
   сделан; интеграция — только после approve.

Остановка: **STOP-точка D** (`run-spec-chain` Шаг 4a; только для `type: content`).
Нет approve (или ответ `revision`) → вопросы в `src/data/**` не пишутся,
`feat`-коммит не делается, правки — новой итерацией кандидатов.

## Отчёт капитану

1. Тема: `deploy_systems`, `count` 13 → 25, банк 229 → 241.
2. Spec 043: approved (embedded approve, правило 2 / F5.0a), трек Full.
3. Батч 6: 12 кандидатов, accept / reject по QC.
4. Превью: `.project/drafts/batch-6-deploy-systems-preview.md` + сводная таблица (STOP-точка D).
5. Находки recon: долг поля `commit_regex` (specs 005/015/018/020, `.project/specs/README.md`, раздел `commit_format`),
   перебор per-topic +3, риск концептуальных дублей с `rs_*`.
6. Push не выполнялся.
