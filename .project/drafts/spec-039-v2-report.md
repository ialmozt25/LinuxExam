# spec 039 — verification v2 (t8): независимая проверка repair t7 (r6-f1)

> Роль: qc. Метод: ratification by re-execution — гейты перезапущены заново, отчёт `.project/drafts/spec-039-r1-report.md` на веру не принимался.
> Дата: 2026-09-30. Банк read-only: изменён только `.project/drafts/spec-039-v2-report.md`.

## Вердикт

**verdict: pass**

repair t7 закрыл finding r6-f1 (тождественен qc-f1 из t5): ложная клауза «и в нём неверно записан ключ длины префикса» удалена из explanation ntw_017. Регрессий нет: все гейты прогона зелёные, scope правки относительно HEAD — те же 15 id, что приняло ревью t6.

## 1. Гейты (перезапуск, сырые exit-коды)

| команда | exit | ключевая строка |
|---|---|---|
| `npm run order:check` | 0 | `OK: _order.json matches 229 ids from 14 topic files` |
| `npm run manifest` | 0 | `OK: 229 questions, 14 topics` |
| `npm run shuffle-bank:check` | 0 | `BANK 229 = 69/51/48/61` (WARN нет) |
| `npm run qc` | 0 | `Total: 229 questions` / `Fails: 0, Warns: 22` (WARN от ntw_017 нет) |
| `npm run test:run` | 0 | `Test Files 28 passed (28)` / `Tests 198 passed (198)` |
| `npm run typecheck` | 0 | (tsc --noEmit, без ошибок) |
| `node .project/drafts/spec-039-cosine-neighbors.mjs ms_004 msw_011 msw_014 net_001 net_002 net_003 fm_008 fm_011 ug_002 ug_007 fs_004 ntw_017 ntw_018 ug_019 ug_020` | 0 | `checked=15 over_threshold=0` (max 0.7701 ntw_017~ntw_018) |

## 2. Проверка r6-f1 (ложная клауза в ntw_017)

- explanation ntw_017 (строка 459) теперь: «…Последний вариант лишь печатает параметры профиля, ничего не меняя.» — ложная клауза «, и в нём неверно записан ключ длины префикса» отсутствует.
- Независимая сверка: в explanation нет подстрок «префикс» и «неверно» (node-проверка: `/префикс/`=false, `/неверно/`=false, `/неверно записан ключ длины префикса/`=false).
- Причина отклонения последнего дистрактора корректна и согласуется с текстом опции: `nmcli connection modify … && nmcli connection show eth0` — `connection show` лишь печатает профиль, ничего не применяет (активирует `connection up`); префикс `/64` в опции корректен, и разбор это больше не оспаривает.
- Структура ntw_017 сохранена: explanation len=514, lines=1 (без переносов); options=4, correct=1, correctIndex=0.

## 3. Построчная сверка ntw_017 и ntw_018 с реальным поведением

ntw_017 (разбор):
1. «connection modify … && connection up eth0 сразу применяет … сохраняются после перезагрузки» — верно (modify правит профиль персистентно, up активирует).
2. «Метод auto означает автоконфигурацию IPv6 (SLAAC), и заданный вручную адрес не применяется» — верно (при ipv6.method auto ручной ipv6.addresses игнорируется).
3. «connection add создаёт новое подключение …, а не изменяет существующий профиль eth0» — верно по смыслу (add создаёт новый профиль; существующий eth0 не модифицируется).
4. «Последний вариант лишь печатает параметры профиля, ничего не меняя» — верно (connection show не применяет).

ntw_018 (разбор, не изменялся):
1. «ip -6 addr add добавляет адрес IPv6 в ядро до ближайшей перезагрузки» — верно (адрес без персистентного профиля сбрасывается при перезагрузке/flush).
2. «Без ключа -6 команда ip addr add по умолчанию работает с IPv4 и IPv6-литерал отвергает» — верно (AF_INET по умолчанию).
3. «ip -4 addr add явно выбирает семейство IPv4, где такой адрес недопустим» — верно.
4. «Последний вариант искажает запись длины префикса и IPv6-адресом не является» — верно (2001:db8::20:0:0:64 — некорректный литерал).

Ложных утверждений нет.

## 4. Scope (независимо, относительно HEAD)

Per-question сверка HEAD↔current по 5 topic-файлам:

```
manage_software: changed ms_004, msw_011, msw_014
networking:      changed net_001, net_002, net_003; added ntw_017, ntw_018
file_management: changed fm_008, fm_011
file_systems:    changed fs_004
users_groups:    changed ug_002, ug_007; added ug_019, ug_020
```

- Изменены ровно те же 15 id, что приняло ревью t6; удалений нет; чужие вопросы/поля/темы не тронуты.
- `git status --porcelain -- src/data/questions/` — изменены только 7 файлов: `_order.json`, `_topics.json`, `file_management.json`, `file_systems.json`, `manage_software.json`, `networking.json`, `users_groups.json` (9 запрещённых тем не изменены).
- Правка r1 — ровно одна подстрока в explanation ntw_017 (хвост строки 459); ntw_018, options/question/_meta ntw_017 без изменений.

## 5. Банк read-only

В этой задаче изменён только `.project/drafts/spec-039-v2-report.md`; файлы банка не правились.

## Итог

r6-f1/qc-f1 закрыт, регрессий нет. Все гейты exit 0, scope сохранён. Вердикт: pass.
