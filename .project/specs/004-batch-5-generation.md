---
id: 004
slug: batch-5-generation
status: draft
type: content
created: 2026-09-27
updated: 2026-09-27
commit: null
commit_format: "feat(bank): M2.9 batch 5 - <N> questions on local_storage (<A>-><B>)"
commit_regex:  "^feat\\(bank\\), (\\d+)\\s+questions?"
---

# DRAFT ONLY — не запускать до approve капитана

> **Нумерация согласована с планом ночной смены 2026-09-27:** batch 5 = `local_storage`,
> batch 6 = `manage_software` (spec 005), batch 7 = `networking` (spec 006).
> Три темы с наименьшим `count` в `_topics.json`; `local_storage` и `manage_software`
> делят минимум (8), порядок между ними произволен и зафиксирован здесь.
> Префикс — **`lsl_`**, а не канонический `ls_`: номера `ls_001`..`ls_008` заняты,
> а `ls_009` выглядел бы как продолжение той же серии, хотя вопросов с такими id
> ещё нет. Отдельный префикс делает батч видимым в ревью. См. также «Отклонения».

Это бумага. Никакой генерации, никакого Writer'а, никакого коммита по этой спеке
не происходит до явного approve. Approve переводит спеку в `running`.

## Pre-flight — STOP и доклад при любом расхождении

1. `git rev-parse --short HEAD` — зафиксировать SHA в отчёте. `git status --porcelain` —
   зафиксировать список изменённых/untracked путей; грязное дерево само по себе не STOP,
   но в отчёт идёт.
2. Прочитать `.project/specs/README.md` — frontmatter этой спеки должен совпасть по полям
   (включая `commit_format`/`commit_regex` для `type=content`). Расхождение — STOP, доклад.
3. Прочитать `src/data/topics.ts` — подтвердить, что канонический key темы
   = `local_storage`. Если канон другой (переименование/новая тема) — использовать канон
   и указать расхождение в отчёте. Если темы нет — STOP, доклад.
4. Определить ID-префикс: прочитать существующие `id` в файле темы. Наблюдаемые занятые
   префиксы всего банка (проверено grep'ом `"id":` по `src/data/questions/*.json`):
   `ds_` (deploy_systems), `et_` (essential_tools), `fm_` (file_management), `fp_`
   (file_permissions), `fs_` (file_systems), `ls_` (local_storage), `ms_` (manage_software),
   `net_` (networking), `pm_` (process_management), `rs_` (running_systems), `sec_`
   (security), `sh_` (shell_scripts), `tf_` (text_files), `ug_` (users_groups).
   Для `local_storage` канон — `ls_`, но НЕ использовать его: занятые id на момент
   написания спеки — `ls_001`..`ls_008`. Взять свободный префикс `lsl_` и номера
   `lsl_009`..`lsl_014` (первый свободный), префикс не переиспользуется.
   **Перед выбором проверить, что префикса `lsl_` нет ни в одном файле темы.**
5. **Размер банка — читать, а не помнить.** Прочитать `src/data/questions/_topics.json`:
   поле `total`. На момент написания спеки `total` = **189**. Записывать это число в спеку
   как константу запрещено (spec 001 хардкодил 183 и устарел за один батч) — в отчёт идёт
   фактическое значение из файла, `A` в формулировках ниже.
6. Проверить, что `npm run test:run` зелёный **до** начала генерации: если тесты красные
   на чистом дереве — STOP, доклад (генерация не должна маскировать чужую регрессию).
7. Прочитать `.project/specs/002-dehardcode-positional-test.md`: если она уже выполнена,
   guard-тест берёт размер банка из данных (`getBankTotal()`), и ручная правка теста не нужна.
   Если нет — правка хардкода `EXPECTED_QUESTIONS` **не входит** в эту задачу: STOP, доклад.

## Тема

Предложение (капитан может переопределить): **`local_storage`** — «Локальное хранилище».

Почему: наблюдаемые счётчики из `src/data/questions/_topics.json` (проверено чтением):

| слаг | count |
|---|---|
| `manage_software` | 8 |
| `local_storage` | 8 |
| `networking` | 10 |
| `running_systems` | 10 |
| `shell_scripts` | 10 |
| `text_files` | 10 |
| `deploy_systems` | 13 |
| `essential_tools` | 13 |
| `file_systems` | 14 |

`local_storage` — минимум по банку (8) вместе с `manage_software` при цели 22 на тему
(`goal.per_topic_target` в `.project/state.json`), поэтому идёт первым. Назначение —
**предложение**, не приказ; смена темы капитаном требует правки pre-flight п.3–4 и
раздела «Тема».

## Цель

Банк `A` → `A + N` (N ≤ 6) новыми вопросами по канонической теме `local_storage`.
`A` берётся из `src/data/questions/_topics.json.total` на момент старта.

## Источники

- **Avoid-list:** `.project/log.md` (последние 30 строк) + `state.json.issues_open`
  (там: `ug_013`, `ug_018`, `ug_014`, `ug_016`, `ug_017`). Наблюдаемый avoid-list batch 4:
  `ds_002, ds_014, rs_001, pm_014, pm_010, fs_005, fs_006, fs_013, ls_002, ls_005, ls_007`.
  Если оба источника пусты — доклад, не угадывать.
  **Свой стем-avoid-list для этой темы:** перед генерацией выписать темы/команды уже
  покрытых вопросов `ls_001..ls_008` (прочитать файл темы) и не дублировать их.
  **Три id этой темы уже в avoid-list батча 4 — `ls_002`, `ls_005`, `ls_007`:** их
  команды (`lvextend`+`xfs_growfs`, `findmnt -T`, `lsblk -f`) не переиспользовать
  как верные ответы. Проверено для батча 5: ни одна из них не взята.
- **Канон тем:** `src/data/topics.ts` (read-only).
- **DOD content:** `.project/DOD.md`, раздел `content`.
- **Контракты MAS:** `.project/contracts/orchestrator_to_writer.yaml`,
  `writer_to_qc.yaml`, `qc_to_orchestrator.yaml`.
- **Предыдущий батч как образец процесса:** `.project/specs/001-file-management-batch-4.md`
  (включая раздел «Отклонения» — там зафиксированы реальные ловушки batch 4).

## Критерии приёмки

- [ ] N новых вопросов (N ≤ 6), `topic = local_storage`, id с первого свободного номера.
- [ ] DOD content: 4 опции, ровно 1 верная, explanation ≤ 3 строк.
- [ ] Option ratio проверен **тем же кодом**, что гейт: `checkRatio(options, 'chars')`
      (`tools/_lib/ratio.cjs`), а не арифметикой по «≤ 1.5» из DOD. Порог зависит от класса
      по числу слов (`sentences` 1.30 / `token` 2.00 / `mixed` 1.50). Детали и долг —
      spec `007-qc-ratio-semantics`; до её выполнения класс считается вручную.
- [ ] `npm run qc` — `Fails: 0` (baseline на 189 вопросах: `Fails: 0, Warns: 16`).
- [ ] Cosine против **всего** банка ≤ 0.85 и между кандидатами ≤ 0.85 (`tools/cosine.cjs`,
      помнить: он читает **только JSON** — YAML кандидатов сначала конвертируется).
- [ ] Avoid-list соблюдён.
- [ ] Артефакты интеграции обновлены и согласованы: файл темы, `_order.json`,
      `_topics.json` (`npm run manifest` перегенерирует счётчики из файлов и сверит id с
      `_order.json`; ожидаемый вывод `OK: <total> questions, 14 topics`).
- [ ] Позиции верных ответов: `npm run shuffle-bank --apply local_storage`
      (только своя тема — глобальный `--apply` переупорядочивает чужие темы, см. spec 003),
      затем `npm run shuffle-bank:check` exit 0.
- [ ] Гейты: `npm run qc` exit 0, `npm run typecheck` exit 0, `npm run test:run` exit 0,
      `npm run build` exit 0.
- [ ] `npm run sync` → `git add` → **один** коммит → `npm run sync:check` exit 0.
- [ ] Строка в `.project/log.md` (append-only).
- [ ] `docs/dashboard/state.json` не коммитится (DECISIONS 2026-09-27, п. 7).

## Пайплайн

1. Writer (`reasoning_effort=high`) генерирует 6 кандидатов (цель — все 6; лучше 5+1 запас,
   чем 6 с риском).
2. QC проверяет каждый: ratio (тем же кодом), cos против всего банка, cos между собой,
   отсутствие второго верного дистрактора, explanation, man-верификацию команд.
3. QC возвращает вердикт по каждому: `accept` / `reject` с причиной.

## Обработка отказов

- **1 reject:** Writer переделывает 1 вопрос → QC повторно. Макс 1 доп. итерация на вопрос.
- **2 reject:** Writer переделывает 2 → QC повторно. Макс 1 доп. итерация на вопрос.
- **После 2 итераций вопрос всё ещё reject:** вопрос выбывает; партия коммитится с тем,
  что принято (N < 6).
- **Принято < 4:** партия провалилась, коммита нет, доклад капитану.
- **Partial approve капитаном** («эти 4 ок, эти 2 убери»): коммит с N=4, отчёт о том,
  какие убраны.
- **Конфликт с уже существующим вопросом (cos > 0.85 против банка):** кандидат выбывает
  без итерации; при выбывании ≥ 3 кандидатов — STOP, доклад (тема выбрана неудачно).

## Коммит

Формат (совместим с `tools/gen-state.mjs:103-104`, `:127-128` — обязаны матчиться
**обе** регулярки `/^feat\(bank\)/i` и `/(\d+)\s+questions?/i`, иначе метрики центра
молча обнулятся):

```
feat(bank): M2.9 batch 5 - <N> questions on local_storage (<A>-><B>)
```

где `N` — число принятых, `A` — `_topics.json.total` до интеграции, `B = A + N`.
Пример формы (числа подставить фактические): `feat(bank): M2.9 batch 5 - 6 questions on local_storage (189->195)`.

Push НЕ делать до approve (правило 4).

## Что НЕ трогать

- `src/data/questions/*` других тем — только файл темы + манифесты `_order.json`/`_topics.json`.
- `src/data/topics.ts` — read-only канон.
- `docs/dashboard/*` — легаси-дашборд V1–V9.
- `.project/contracts/*`, `.project/DOD.md`, `.project/specs/README.md`.
- Чужие темы через глобальный `shuffle-bank --apply` (см. spec 003).
- Прод и origin — push только после approve.

## Превью

Файл `.project/drafts/batch-5-preview.md`:

1. Заголовок: «Batch 5 preview — N вопросов из 6, тема local_storage».
2. Таблица QC: id, cos против банка, класс + ratio, вердикт.
3. По каждому вопросу: id, question, 4 опции (A–D), correct, explanation, topic.
4. Отклонённые (если есть): id, причина.
5. Путь к файлу — в отчёте капитану.

## Отчёт капитану

1. Pre-flight: HEAD, состояние дерева, канон темы, префикс, `A` = `_topics.json.total`.
2. Сколько кандидатов сгенерировано / принято / отклонено (с причинами).
3. Путь к превью.
4. Exit-коды: `qc`, `shuffle-bank:check`, `typecheck`, `test:run`, `build`, `sync:check`.
5. Отклонения от спеки и вопросы капитану.
6. Ждать approve. Коммит не делать.

## Отклонения

Зафиксировано по итогам ночной смены 2026-09-27 (draft-исполнение до approve):

- **Тема спеки изменена с `manage_software` на `local_storage`.** Исходная версия спеки
  назначала batch 5 = `manage_software`, а batch 6 = `local_storage`; план ночной смены
  определяет batch 5 = `local_storage`. Обе темы делят минимум `count` (8), поэтому
  выбор произволен, но нумерация приведена к плану, чтобы номер батча, номер спеки,
  имя превью и subject коммита указывали на одну тему.
- **Префикс `lsl_` вместо канонического `ls_`.** Номера `ls_009`… были бы продолжением
  занятой серии; отдельный префикс делает новые id видимыми в ревью и в диффе.
  Коллизий нет (проверено grep'ом по всем файлам тем).
- **`objective_domain` для этой темы — `4`** (у всех 8 существующих `ls_*` вопросов).
  В шаблоне задания Writer'у для соседней темы стояла цифра, которую пришлось
  исправлять по факту; проверяй значение по файлу темы, а не по шаблону.
- **`lsl_013` отклонён при QC.** Дистрактор `lvremove -y lv_temp` неинтерактивен так же,
  как верный `lvremove -f datavg/lv_temp`, а стем не разделяет `-y` и `-f` — риск второго
  верного ответа. Проверить live нельзя (в WSL нет lvm2), поэтому вопрос не принят.
  Детали — в `.project/drafts/batch-5-preview.md`, замечание 3.
