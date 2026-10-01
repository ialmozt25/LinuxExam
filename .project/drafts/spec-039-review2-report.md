# spec 039 — ревью-отчёт round 2 (t9, финальное ревью после repair r6-f1)

> Роль: reviewer. Раунд 2 после repair t7 (finding r6-f1) и verification t8. Банк read-only.
> Дата: 2026-09-30. HEAD = 0abd658210f5058b40bc9c0d68a422aad721bd41.
> Раунд 1 (t6) подтвердил критерии 1–9, скоуп и гейты; единственный must-fix r6-f1 передан в repair.
> Здесь — diff-scoped проверка закрытия r6-f1, отсутствия регрессий и сохранения приёмки.

## Вердикт

**pass**

## 1. Закрытие finding r6-f1 (diff-scoped проверка правки t7)

- `ntw_017` explanation (`src/data/questions/networking.json`, строка 459) теперь заканчивается:
  «…Последний вариант лишь печатает параметры профиля, ничего не меняя.»
- Ложное придаточное «, и в нём неверно записан ключ длины префикса» удалено; подстрок
  «префикс» и «неверно» в explanation `ntw_017` больше **не встречаются** (независимый grep).
- `options` `ntw_017`: opts=4, correct=1, correctIndex=0 — не менялись (те же тексты, что после t2).
- `ntw_018` не изменён; его клауза «Последний вариант искажает запись длины префикса» корректна
  (дистрактор `2001:db8::20:0:0:64` действительно искажает префикс) — это не регрессия и не ложь.
- Правка r1 = ровно одно удаление придаточного; `explanation` len=514, lines=1, без переносов.

## 2. Гейты (перезапуск, сырые exit-коды)

| команда | exit | ключевая строка |
|---|---|---|
| `npm run order:check` | 0 | `OK: _order.json matches 229 ids from 14 topic files` |
| `npm run manifest` | 0 | `OK: 229 questions, 14 topics` |
| `npm run shuffle-bank:check` | 0 | `BANK 229 = 69/51/48/61` |
| `npm run qc` | 0 | `Total: 229 questions` / `Fails: 0, Warns: 22` (absolute=2 length-hint=2 ratio=16 stopword=2; WARN от ntw_017 нет) |
| `npm run test:run` | 0 | `Test Files 28 passed (28)` / `Tests 198 passed (198)` |
| `npm run typecheck` | 0 | `tsc --noEmit -p tsconfig.app.json` |
| `node .project/drafts/spec-039-cosine-neighbors.mjs <15 id>` | 0 | `checked=15 over_threshold=0` (max 0.7701 = ntw_017~ntw_018) |

## 3. Критерии приёмки спеки 039 (1–9) — подтверждены на итоговом состоянии

Правка r1 не затронула ничего из предмета round 1 (только explanation одного нового вопроса),
поэтому подтверждения round 1 остаются в силе; ключевые пункты перепроверены заново:

| # | критерий | результат |
|---|---|---|
| 1 | 10 rewritten, нет stale-меток | ✅ (grep по 5 темам: 0 совпадений) |
| 2 | fm_011 ровно 1 верный | ✅ (`-cjf`) |
| 3 | +4 новых, схема + domain | ✅ (ntw_017/018=«8», ug_019/020=«9»; 4 опции/1 correct) |
| 4 | `_topics.json` total 229, networking 18, users_groups 20 | ✅ |
| 5 | `_order.json` 229 id, +4 append | ✅ |
| 6–9 | гейты shuffle/manifest/qc/test | ✅ (см. §2) |
| 10 | qc pass; reviewer pass | ✅ (t5 pass; настоящий отчёт pass) |

## 4. Scope финального диффа

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

Id-level сверка vs HEAD — ровно 15 id, без удалений:

```
manage_software : changed=[ms_004,msw_011,msw_014]
networking      : changed=[net_001,net_002,net_003]  added=[ntw_017,ntw_018]
file_management : changed=[fm_008,fm_011]
file_systems    : changed=[fs_004]
users_groups    : changed=[ug_002,ug_007]  added=[ug_019,ug_020]
```

`tools/**`, `.project/sync.mjs`, `.project/scripts/**`, `package.json`, `.project/specs/**` и
9 других тем — не тронуты. Артефакты прогона — только `.project/drafts/spec-039-*`.

## 5. Остаточные пункты (явный вердикт)

| id | вердикт | обоснование |
|---|---|---|
| qc-f2 | accepted-low | Двусмысленность «с именем con-name» (con-name — имя опции, а не подключения). Ложного факта нет, смысл восстановим, корректность верного ответа не затронута. Новой улики для эскалации нет. |
| qc-f3 | accepted-low | Вопрос `ug_020` «в каком каталоге» vs верный путь к файлу `/etc/sudoers.d/rules`. Ложного факта нет (explanation верно называет каталог `/etc/sudoers.d`), ответ уникален. Новой улики нет. |
| lsl_009 | вне скоупа | `haladyna all` даёт AUTO[5] на `lsl_009` (local_storage). Предсуществующий долг (HEAD-снимок тоже падает), зафиксирован в `docs/archive/HANDOFF.md:308-311`, принят капитаном; `local_storage.json` не изменён. Не относится к spec 039. |

Ни один из трёх не переводится в must-fix без новой улики.

## 6. Findings

Нет новых. Finding r6-f1 закрыт (см. §1).

## Итог

- r6-f1 закрыт: ложная клауза удалена, `ntw_017` explanation чист, options/correctIndex не тронуты, `ntw_018` не изменён.
- Регрессий нет: все гейты exit 0, `qc` Warns 22 = baseline (WARN от ntw_017 отсутствует), cosine max 0.7701.
- Критерии 1–9 спеки 039 выполнены на итоговом состоянии; скоуп = 5 topic + 2 манифеста = ровно 15 id.
- **verdict: pass** (приёмка спеки 039 подтверждена; финальный approve — за капитаном).
