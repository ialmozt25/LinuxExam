# spec 039 — QC-отчёт (t5, независимая проверка t1–t4)

> Роль: qc. Метод: ratification by re-execution — гейты перезапущены заново, отчёты t1–t4 на веру не принимались.
> Дата: 2026-09-30. Состояние банка проверено на working tree (HEAD = 0abd658, 7 изменённых файлов +4 untracked id в манифестах).
> Write-скоуп соблюдён: банк read-only, изменён только `.project/drafts/spec-039-qc-report.md`.

## Вердикт

**verdict: pass**

Обоснование: все гейты прогона exit 0; находок blocker/high нет. Три low-находки зафиксированы ниже и не блокируют (не влияют на корректность верного ответа, не создают второго верного варианта).

## 1. Гейты (перезапуск, сырые exit-коды)

| команда | exit | ключевая строка |
|---|---|---|
| `npm run order:check` | 0 | `OK: _order.json matches 229 ids from 14 topic files` |
| `npm run manifest` | 0 | `OK: 229 questions, 14 topics` |
| `npm run shuffle-bank:check` | 0 | `BANK 229 = 69/51/48/61` (WARN нет) |
| `npm run qc` | 0 | `Total: 229 questions` / `Fails: 0, Warns: 22` |
| `npm run test:run` | 0 | `Test Files 28 passed (28)` / `Tests 198 passed (198)` |
| `npm run typecheck` | 0 | (tsc --noEmit, без вывода ошибок) |
| `node .project/drafts/spec-039-cosine-neighbors.mjs ms_004 msw_011 msw_014 net_001 net_002 net_003 fm_008 fm_011 ug_002 ug_007 fs_004 ntw_017 ntw_018 ug_019 ug_020` | 0 | `checked=15 over_threshold=0` (max 0.7701 = ntw_017~ntw_018) |

Дополнительно (haladyna):
- `node tools/haladyna.cjs --batch .project/drafts/spec-039-t4-haladyna-batch.json --auto-only` → exit 0, `Auto-perfect (5/5): 15/15`.
- `node tools/haladyna.cjs all --auto-only` → exit 1, `Auto-perfect (5/5): 228/229`; единственный сбой `lsl_009` (`AUTO_FAIL: [5]`). **Вне скоупа spec 039 и предсуществующий долг**: `local_storage.json` не входит в изменённые файлы (git status: только 5 topic-файлов + 2 манифеста), долг зафиксирован в `docs/archive/HANDOFF.md:308-311` («lsl_009 ratio 1.78 + длина верной опции», принят осознанно). Принято капитаном как вне-скоуповый долг (вариант «а»); FAIL/WARN против spec 039 не считается.

## 2. Построчная проверка 15 вопросов (10 rewritten + fm_011 + 4 new)

Автоматическая сверка (node-скрипт по 5 файлам) + чтение каждой записи:

| id | опции/correct | objective_domain | stale-метки | _meta | expl newline |
|---|---|---|---|---|---|
| ms_004 | 4 / 1 (correctIndex 3=3) | 6 | нет (post-modular) | нет | нет |
| msw_011 | 4 / 1 (0=0) | 6 | нет (.el10) | нет | нет |
| msw_014 | 4 / 1 (2=2) | 6 | нет (.el10) | нет | нет |
| net_001 | 4 / 1 (0=0) | 7 | нет | нет | нет |
| net_002 | 4 / 1 (2=2) | 7 | нет | нет | нет |
| net_003 | 4 / 1 (3=3) | 7 | нет | нет | нет |
| fm_008 | 4 / 1 (3=3) | 1 | нет (plocate) | нет | нет |
| fm_011 | 4 / 1 (3=3) | 4 | нет | нет | нет |
| ug_002 | 4 / 1 (3=3) | 7 | нет | полная (verified_rhel "10") | нет |
| ug_007 | 4 / 1 (1=1) | 7 | нет | полная (verified_rhel "10") | нет |
| fs_004 | 4 / 1 (0=0) | 5 | нет («в RHEL 10») | нет | нет |
| ntw_017 | 4 / 1 | 8 (exp 8) | нет | полная | нет |
| ntw_018 | 4 / 1 | 8 (exp 8) | нет | полная | нет |
| ug_019 | 4 / 1 | 9 (exp 9) | нет | полная | нет |
| ug_020 | 4 / 1 | 9 (exp 9) | нет | полная | нет |

Проверки:
- Ровно 4 опции и ровно 1 `correct: true` — у всех 15 (подтверждено скриптом и вручную).
- correctIndex (позиция верного ответа) у 11 переписанных НЕ менялся: ms_004 3, msw_011 0, msw_014 2, net_001 0, net_002 2, net_003 3, fm_008 3, fm_011 3, ug_002 3, ug_007 1, fs_004 0.
- Запрещённые токены по всему банку (жёсткие): `.el9` = false, `mlocate` = false, `Rocky 9` = false, «модульные потоки» = false, `dnf module enable` = false. (Слово «RHEL 9» сохраняется только в `ms_006` — вне скоупа, «синтаксис config-manager совпадает с RHEL 9», допустимо.)
- `objective_domain` новых вопросов: ntw_017/018 = «8» (8.1 IPv6), ug_019/020 = «9» (9.4 sudo/wheel) — верно.
- `_meta` новых и переверифицированных вопросов: ключи `added_at/pipeline_version/verified_rhel/verified_at/source/reference/status` полные; `verified_rhel="10"` у всех 6 вопросов с _meta.
- explanation: ≤ 3 строк и без переносов строки — у всех 15; содержимое сверено построчно (см. §5 находки).

## 3. Критерии приёмки спеки 039 (1–9)

| # | критерий | результат |
|---|---|---|
| 1 | 10 вопросов rewritten, нет «Rocky 9»/«RHEL 9»/`.el9`/`mlocate`/модульных потоков | ✅ (см. §2) |
| 2 | fm_011 ровно 1 верный вариант | ✅ (`-cjf`; набор `-czf`/`-cf`/`-cJf`/`-cjf`) |
| 3 | +4 новых (2 IPv6, 2 sudo/wheel), схема + objective_domain | ✅ (ntw_017/018=«8», ug_019/020=«9») |
| 4 | `_topics.json` total 229, networking 18, users_groups 20 | ✅ |
| 5 | `_order.json` +4 новых id одной транзакцией (append) | ✅ (229 id, tail `msw_015, msw_016, ntw_017, ntw_018, ug_019, ug_020`, все id уникальны) |
| 6 | `npm run shuffle-bank:check` → 0 | ✅ |
| 7 | `npm run manifest` → 0 (`OK: 229 questions, 14 topics`) | ✅ |
| 8 | `npm run qc` → 0 (Fails 0, Warns ≤ 22) | ✅ (Fails 0, Warns 22 = baseline) |
| 9 | `npm run test:run` → 0 | ✅ (28 файлов / 198 тестов) |

## 4. «Решения капитана» — сверка

1. **fs_004** — вопрос сохранён; формулировка «Тип smbfs устарел и в RHEL 10 не поддерживается: для SMB служит только cifs» — соответствует решению (rewrite, не удаление). ✅
2. **fm_011** — дистрактор `tar -cJf backup.tar.bz2 /home` присутствует; explanation явно: «J — xz, не bzip2»; ровно 1 верный (`-cjf`). Оговорка t3 (буквальная замена давала дубль `-cJf`, поэтому набор `-czf`/`-cf`/`-cJf`/`-cjf`) подтверждена — дублей нет, порядок и позиция верного не менялись. ✅
3. **Объём add = 4** — добавлено ровно 4: ntw_017, ntw_018, ug_019, ug_020. ✅

## 5. Находки (findings, все low — не блокируют)

| id | severity | problem | requiredFix |
|---|---|---|---|
| qc-f1 | low | `ntw_017` explanation, последнее предложение: «Последний вариант лишь печатает параметры профиля, ничего не меняя, **и в нём неверно записан ключ длины префикса**» — ложное утверждение: последний дистрактор (`… ipv6.addresses 2001:db8::10/64 … && nmcli connection show eth0`) использует корректный префикс `/64` (фраза — артефакт, скопированный из ntw_018, где дистрактор действительно искажает префикс). | Убрать «и в нём неверно записан ключ длины префикса» из разбора ntw_017 (опционально, т.к. верная причина «show только печатает» уже указана). |
| qc-f2 | low | `ntw_017` explanation: «Ключ connection add создаёт новое подключение с именем con-name» — двусмысленно («con-name» это имя опции, а не имя подключения). | Переформулировать, напр. «connection add создаёт новое подключение (через con-name), а не изменяет существующий профиль eth0». |
| qc-f3 | low | `ug_020` вопрос спрашивает «в каком каталоге», а верный вариант — путь к файлу `/etc/sudoers.d/rules` (не каталог); все 4 опции имеют суффикс `/rules`. Неоднозначности нет (каталог `/etc/sudoers.d` уникально опознаваем), но форма неточна. | Опционально: привести вопрос/опции к единой форме («каталог» → `/etc/sudoers.d`, либо вопрос «в каком каталоге … лежит файл /rules»). |

## 6. Оценка оговорок (по запросу капитана)

- **(а) fm_011** — набор `-czf`/`-cf`/`-cJf`/`-cjf` проверен: ровно 1 верный (`-cjf` = bzip2); `-cJf` = xz (не bzip2) — дистрактор действительно неверен по объяснению. ✅
- **(б) ug_002/ug_007** — `_meta.verified_rhel="10"` опирается на `man useradd`/`man userdel` + `src/userdel.c` (shadow-maint github) и пакет shadow-utils EL10 `4.15.0-5.el10`, а не на URL redhat.com. Оценка: **улика достаточна для заявленных утверждений** (утверждения — стабильная семантика shadow-utils, версия EL10 установлена; `ug_002` заявляет лишь «-n в man useradd не документирован», что безопасно; `ug_007` — «удаление каталога лишь в ветке -r», что подтверждается исходником userdel.c). Строго по brief §3 reference не является официальным Red Hat URL — фиксирую как low (не блокирует, т.к. факты подкреплены upstream + версией EL10, а эмпирика не выдумана).
- **(в) net_003** — дистрактор `/etc/hosts.allow` объяснён версионно-нейтрально («относится к TCP wrappers и управляет доступом…, а не разрешением имён, поэтому адресов DNS-серверов в нём не было и нет») — утверждение «в RHEL 10 нет TCP wrappers» не делается. ✅

## 7. Scope-дисциплина

`git status --porcelain` — изменены ровно: `_order.json`, `_topics.json`, `file_management.json`, `file_systems.json`, `manage_software.json`, `networking.json`, `users_groups.json`. Построчная сверка HEAD↔current по 5 topic-файлам: изменены/добавлены только 15 id из §5, удалений нет, чужие вопросы в этих файлах не тронуты, 9 запрещённых тем не изменены.

```
changed: manage_software → ms_004, msw_011, msw_014
changed: networking → net_001, net_002, net_003; added ntw_017, ntw_018
changed: file_management → fm_008, fm_011
changed: file_systems → fs_004
changed: users_groups → ug_002, ug_007; added ug_019, ug_020
```

## Итог

- Гейты: order:check 0, manifest 0, shuffle-bank:check 0, qc 0 (229 / Fails 0 / Warns 22), test:run 0, typecheck 0, cosine-15 0 (max 0.7701).
- 15 вопросов: 4 опции / 1 correct, domains и _meta корректны, stale-метки отсутствуют.
- Критерии 1–9 спеки 039 выполнены; решения капитана соблюдены.
- Находок blocker/high — нет. Три low-находки (qc-f1..f3) — не блокируют.
