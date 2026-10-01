# spec 039 — ревью-отчёт (t6, финальное ревью t1–t5)

> Роль: reviewer. Метод: независимая перепроверка гейтов, scope и данных банка (банк read-only).
> Дата: 2026-09-30. HEAD = 0abd658210f5058b40bc9c0d68a422aad721bd41.
> Предмет: итоговое состояние банка после t1–t4 + отчёт qc (t5, `.project/drafts/spec-039-qc-report.md`).

## Вердикт

**needs_revision**

Обоснование: все гейты воспроизводятся с exit 0, все 10 критериев приёмки (1–9) выполнены,
scope-дисциплина соблюдена, stale-метки отсутствуют. Блокирует ровно одна low-находка qc —
**qc-f1** (фактически ложное утверждение в explanation нового вопроса `ntw_017`) — признана
must-fix (подробности в §4). Остальные две low-находки (qc-f2, qc-f3) приняты как
задокументированные accepted-low с обоснованием.

## 1. Гейты (перезапуск, сырые exit-коды)

| команда | exit | ключевая строка |
|---|---|---|
| `npm run order:check` | 0 | `OK: _order.json matches 229 ids from 14 topic files` |
| `npm run manifest` | 0 | `OK: 229 questions, 14 topics` |
| `npm run shuffle-bank:check` | 0 | `BANK 229 = 69/51/48/61` (WARN нет) |
| `npm run qc` | 0 | `Total: 229 questions` / `Fails: 0, Warns: 22` |
| `npm run test:run` | 0 | `Test Files 28 passed (28)` / `Tests 198 passed (198)` |
| `npm run typecheck` | 0 | `tsc --noEmit -p tsconfig.app.json` (без вывода ошибок) |
| `node .project/drafts/spec-039-cosine-neighbors.mjs ms_004 msw_011 msw_014 net_001 net_002 net_003 fm_008 fm_011 ug_002 ug_007 fs_004 ntw_017 ntw_018 ug_019 ug_020` | 0 | `checked=15 over_threshold=0` (max 0.7701 = ntw_017~ntw_018) |

Примечание: `npm run manifest` — генеративный (пишет `_topics.json`), но идемпотентен:
результат совпал с состоянием t4 (`total 229`, diff `_topics.json` = 6 строк: total 225→229,
networking 16→18, users_groups 18→20). Новых изменений сверх t4 не внесено.

## 2. Критерии приёмки спеки 039 (1–9; критерий 10 — см. Вердикт)

| # | критерий | результат | улика |
|---|---|---|---|
| 1 | 10 вопросов rewritten, нет «Rocky 9»/«RHEL 9»/`.el9`/`mlocate`/модульных потоков | ✅ | grep по 5 темам: 0 совпадений; построчно ms_004/msw_011/msw_014/net_001..003/fm_008/ug_002/ug_007/fs_004 |
| 2 | fm_011 ровно 1 верный вариант | ✅ | набор `-czf`/`-cf`/`-cJf`/`-cjf`, ровно 1 `correct:true` (`-cjf` = bzip2) |
| 3 | +4 новых (2 IPv6 ntw_017/018, 2 sudo/wheel ug_019/020), схема + objective_domain | ✅ | ntw_017/018 domain «8», ug_019/020 domain «9»; 4 опции / 1 correct у всех 15 |
| 4 | `_topics.json` total 229; networking 18, users_groups 20 | ✅ | `total 229`, `byTopic.networking 18`, `byTopic.users_groups 20`, 14 тем |
| 5 | `_order.json` 229 id, +4 новых одной транзакцией (append) | ✅ | len 229, уникальны, tail `…msw_016, ntw_017, ntw_018, ug_019, ug_020` |
| 6 | `npm run shuffle-bank:check` → 0 | ✅ | §1 |
| 7 | `npm run manifest` → 0 (`OK: 229 questions, 14 topics`) | ✅ | §1 |
| 8 | `npm run qc` → 0 (Fails 0, Warns ≤ 22) | ✅ | Fails 0, Warns 22 = baseline |
| 9 | `npm run test:run` → 0 | ✅ | 28 файлов / 198 тестов |
| 10 | qc verdict=pass; reviewer verdict=pass | ⚠️ | qc=pass (t5); reviewer=needs_revision (qc-f1) |

## 3. Scope-дисциплина

`git diff --name-only` — изменены ровно 7 tracked-файлов, все в скоупе:

```
src/data/questions/_order.json
src/data/questions/_topics.json
src/data/questions/file_management.json
src/data/questions/file_systems.json
src/data/questions/manage_software.json
src/data/questions/networking.json
src/data/questions/users_groups.json
```

Untracked-артефакты прогона: `.project/drafts/spec-039-*` (brief, cosine-neighbors.mjs,
t1–t5 отчёты, t4-haladyna-batch.json). `tools/**`, `.project/sync.mjs`, `.project/scripts/**`,
`package.json`, `.project/specs/**` — не тронуты.

Построчная сверка HEAD↔current по 5 topic-файлам (id-level):

```
manage_software : head=16 cur=16  changed=[ms_004,msw_011,msw_014]
networking      : head=16 cur=18  changed=[net_001,net_002,net_003]  added=[ntw_017,ntw_018]
file_management : head=18 cur=18  changed=[fm_008,fm_011]
file_systems    : head=14 cur=14  changed=[fs_004]
users_groups    : head=18 cur=20  changed=[ug_002,ug_007]  added=[ug_019,ug_020]
```

Итого 15 id (10 rewritten + fm_011 + 4 new), удалений нет, чужие вопросы в этих файлах не
тронуты, 9 запрещённых тем не изменены.

Дополнительные сверки (node-скриптами):
- 15 id: ровно 4 опции, ровно 1 `correct:true`, `explanation` без `\n` и ≤3 строк.
- correctIndex у 11 rewritten не менялся (ms_004 3, msw_011 0, msw_014 2, net_001 0,
  net_002 2, net_003 3, fm_008 3, fm_011 3, ug_002 3, ug_007 1, fs_004 0 — все SAME).
- `_meta` полная у 6 вопросов с ней (ntw_017/018, ug_019/020, ug_002, ug_007),
  `verified_rhel="10"`; `ug_007._meta.human_review` удалён.

## 4. Adjudication 3 low-находок qc (по запросу капитана)

### qc-f1 — MUST-FIX

Ложное утверждение в explanation `ntw_017`, последнее предложение: «Последний вариант лишь
печатает параметры профиля, ничего не меняя, **и в нём неверно записан ключ длины префикса**».

Факт: последний дистрактор (`… ipv6.addresses 2001:db8::10/64 … && nmcli connection show eth0`)
записывает префикс `/64` **корректно**. Клауза «в нём неверно записан ключ длины префикса» —
артефакт копирования из `ntw_018` (там дистрактор действительно искажает префикс
`2001:db8::20:0:0:64`), то есть в `ntw_017` это фактически ложное утверждение.

Оценка класса дефекта (сопоставление с net_001): audit-036 отнёс «разбор ссылается на то,
чего нет в options» (net_001, ghost-ссылка на отсутствующий `ip addr add`) к «требует правок».
qc-f1 — **тот же класс** («разбор не соответствует options»), хотя механизм мягче: опция
существует, первичная причина отклонения («show лишь печатает, не применяет») корректна, ложная
клауза избыточна. Различие в механизме снижает тяжесть (это не ghost-ссылка), но не меняет
класс: разбор содержит утверждение об опции, которое противоречит её содержимому.

Почему must-fix (не accepted-low):
1. Это **фактическая ложь**, а не стиль: верный вариант (опция 1) использует ту же запись
   `2001:db8::10/64`, поэтому объяснение внутренне противоречиво (утверждает, что `/64`
   «неверно записан», при этом верный ответ пишет `/64` так же).
2. Банк — экзаменационный; ложная клауза может научить экзаменуемого, что корректная запись
   префикса `/64` неверна. Spec 039 создан именно для устранения неточностей/устаревшего
   контента; пропустить новую ложь в НОВОМ вопросе противоречит цели спеки.
3. Фикс тривиален и безрисков (удаление 8 слов), цена итерации ниже цены ложного факта в банке.

`requiredFix`: удалить из explanation `ntw_017` придаточное «и в нём неверно записан ключ
длины префикса», оставив корректную причину «лишь печатает параметры профиля, ничего не меняя»
(либо переформулировать хвост без утверждения о префиксе).

### qc-f2 — ACCEPTED-LOW

«Ключ connection add создаёт новое подключение с именем con-name» — двусмысленно: `con-name`
это имя опции (`con-name eth0`), а не имя создаваемого подключения. Обоснование приёмки:
фактическая суть верна (connection add создаёт НОВОЕ подключение и не меняет существующий
профиль eth0); ложного факта нет; смысл восстанавливается из контекста; корректность верного
ответа не затронута. Необязательная правка: «создаёт новое подключение (через опцию con-name),
а не изменяет существующий профиль eth0».

### qc-f3 — ACCEPTED-LOW

`ug_020` спрашивает «в каком каталоге», а верный вариант — путь к файлу `/etc/sudoers.d/rules`
(все опции имеют суффикс `/rules`). Обоснование приёмки: фактической ошибки нет — explanation
верно называет каталог `/etc/sudoers.d`, а верный вариант единственный указывает в него; второго
верного варианта нет; ложного факта не сообщается. Это формальная неточность (каталог vs файл),
а не фактическая ложь. Необязательная правка: привести вопрос к форме «по какому пути (каталог)
…» или опции к bare-каталогам.

## 5. Findings (для needs_revision)

| id | severity | problem | requiredFix |
|---|---|---|---|
| r6-f1 | low | `ntw_017` explanation, последнее предложение: «…и в нём неверно записан ключ длины префикса» — фактически ложное утверждение: дистрактор записывает префикс `/64` корректно (артефакт копирования из ntw_018). Класс — тот же, что у net_001 («разбор не соответствует options»), audit-036 относил его к «требует правок». | Удалить придаточное «и в нём неверно записан ключ длины префикса» из explanation `ntw_017` (файл `src/data/questions/networking.json`), оставив «Последний вариант лишь печатает параметры профиля, ничего не меняя». |

## Итог

- Гейты: order:check 0, manifest 0, shuffle-bank:check 0, qc 0 (229 / Fails 0 / Warns 22),
  test:run 0, typecheck 0, cosine-15 0 (max 0.7701).
- 15 вопросов: 4 опции / 1 correct, domains и _meta корректны, correctIndex не менялся,
  stale-метки отсутствуют.
- Scope: только 5 topic-файлов + 2 манифеста + `.project/drafts/spec-039-*`; чужие темы,
  `tools/**`, `.project/sync.mjs` не тронуты.
- Критерии 1–9 спеки 039 выполнены; решения капитана соблюдены.
- Одна must-fix находка (r6-f1 = qc-f1) → **verdict: needs_revision**. После удаления ложной
  клаузы и перезапуска `npm run qc` приёмка допустима.
