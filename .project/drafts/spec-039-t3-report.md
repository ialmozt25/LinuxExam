# spec 039 — отчёт задачи t3

> Задача: rewrite `fm_008`, `fm_011`, `ug_002`, `ug_007`, `fs_004` + add sudo/wheel `ug_019`, `ug_020`
> (объектив 9.4 «Configure privileged access»).
> Исполнитель: writer-accounts. Дата: 2026-09-30. Attempt: 1 (`e6c17275-3cd8-44b1-adce-d845aa34d5fe`).
> Спека: `.project/specs/039-bank-audit-036-fixes.md` (approved). Брифинг: `.project/drafts/spec-039-brief.md` §3, §5, §7.

```
verdict: pass
files: src/data/questions/file_management.json
       src/data/questions/users_groups.json
       src/data/questions/file_systems.json
       .project/drafts/spec-039-t3-report.md
```

## 1. Гейты (дословный вывод)

### Гейт 1 — `npm run qc`

```
--- 
Total: 229 questions
Fails: 0, Warns: 22
WARN by category: absolute=2 length-hint=2 ratio=16 stopword=2
RATIO by class (unit=chars, символы): sentences=99 token=101 mixed=29
```
`exit 0` — банк 229 (225 baseline + 2 t2 + 2 t3), `Fails 0`, `Warns 22` (не больше baseline).
Ни один из правленых/добавленных вопросов не добавил WARN (разбивка категорий не изменилась:
`absolute=2 length-hint=2 ratio=16 stopword=2`).

### Гейт 2 — `node tools/haladyna.cjs ug_019 --auto-only` и `node tools/haladyna.cjs ug_020 --auto-only`

```
ug_019: score=7/10 (auto=5/5, semi=2/3)
AUTO_FAIL: нет
SEMI_FAIL: [7]
MANUAL: [9, 10]
```
`exit 0` (AUTO 5/5).

```
ug_020: score=7/10 (auto=5/5, semi=2/3)
AUTO_FAIL: нет
SEMI_FAIL: [7]
MANUAL: [9, 10]
```
`exit 0` (AUTO 5/5). SEMI-критерий 7 (`same category`: «все опции — команды | числа | Зона/В/Поле»)
у обоих новых вопросов не проходит — у них концептуальные ответы (имя группы / путь), как у уже
существующих концептуальных вопросов банка (например, `fm_012`); гейт t3 — `--auto-only`, SEMI в него
не входит (брифинг §4: «AUTO 5/5 → exit 0»).

### Гейт 3 — cosine против всего банка (самоисключение)

```
bank=229 threshold=0.8
ok     fm_008  max=0.5942  fp_009:0.5942 ls_004:0.5898 ug_004:0.5857
ok     fm_011  max=0.7391  et_013:0.7391 fm_004:0.6708 fm_001:0.6107
ok     ug_002  max=0.7424  sh_010:0.7424 fm_007:0.7401 ug_003:0.7206
ok     ug_007  max=0.7535  ug_010:0.7535 ug_018:0.7135 ug_003:0.7094
ok     fs_004  max=0.6413  ls_007:0.6413 lsl_014:0.6105 fs_001:0.6079
ok     ug_019  max=0.7332  sec_018:0.7332 ug_020:0.7072 sec_008:0.6863
ok     ug_020  max=0.7072  ug_019:0.7072 sec_017:0.6638 sec_010:0.6632
checked=7 over_threshold=0
```
`exit 0` — ни один id не выше порога 0.80 (`tools/cosine-calibration.json` → `thresholds.cosine`).
Промежуточный прогон дал `REJECT ug_020 max=0.8290 sec_010` — формулировка стема переписана
(см. §3, ug_020) и перепроверена; итоговый прогон выше — зелёный.

## 2. Что именно изменено

| id | файл | поле | было → стало |
|---|---|---|---|
| `fm_008` | file_management | options[2] | `mlocate -r` → `plocate -r` |
| `fm_008` | file_management | explanation | «индекс `mlocate.db`» → «база `/var/lib/plocate/plocate.db`»; верный ответ `updatedb` и порядок опций не тронуты |
| `fm_011` | file_management | options[1] | `tar -cJf backup.tar.bz2 /home` → `tar -cf backup.tar.bz2 /home` (см. оговорку 1) |
| `fm_011` | file_management | options[2] | `tar -cf backup.tar.bz2 --bzip2 /home` → `tar -cJf backup.tar.bz2 /home` (решение капитана п.2) |
| `fm_011` | file_management | explanation | ложное «`--long-option` без `-f` не создаст архив» → корректный разбор: `j` = bzip2, `z` = gzip, **`J` = xz, не bzip2**, вариант без ключа сжатия даёт несжатый tar |
| `ug_002` | users_groups | explanation | убрана эмпирика Rocky 9.8 («`-n` — недокументированный алиас `--no-user-group`»); под RHEL 10: `-m`/`-d`/`CREATE_HOME`/`-s`, `-n` в man useradd не документирован; верный ответ `-m` не тронут |
| `ug_002` | users_groups | `_meta` | `verified_rhel` `9.8` → `10`, `verified_at` 2026-09-30, `source` = spec-039, reference с URL man-страницы |
| `ug_007` | users_groups | explanation | убрана улика «на Rocky 9.8 это неверно … проверено эмпирически»; осталось: `-r` удаляет каталог и ящик, `-f` лишь снимает проверки и каталог сам не удаляет, `-R` = chroot; верный ответ `-r` не тронут |
| `ug_007` | users_groups | `_meta` | удалены `flags: ["educational_man_limitation"]` и `human_review` (verdict_before/after, reason про RHEL 9); `verified_rhel` `9.8` → `10` |
| `fs_004` | file_systems | explanation | «Типа smbfs в RHEL 9 нет» → «Тип smbfs устарел и в RHEL 10 не поддерживается»; вопрос и все опции сохранены (решение капитана п.1) |
| `ug_019` | users_groups | NEW | id следующий после max `ug_018`, `objective_domain` `"9"`, 4 опции, 1 верная (`wheel`), explanation 2 строки, `_meta` по §3 |
| `ug_020` | users_groups | NEW | id `ug_020`, `objective_domain` `"9"`, 4 опции, 1 верная (`/etc/sudoers.d/rules`), explanation 2 строки, `_meta` по §3 |

`_order.json` / `_topics.json` и 9 чужих тем не трогались (t4). `src/data/questions/users_groups.json`
после правки: 18 + 2 = 20 вопросов (файл валиден как JSON, `node`-парсинг — OK).

### Новые вопросы (дословно)

`ug_019` — «Членство пользователя в какой группе даёт ему права sudo в RHEL 10 по умолчанию?»
опции: `sudo` / `root` / **`wheel`** / `users`.
explanation: «В RHEL 10 право запускать команды через sudo по умолчанию даёт членство в группе wheel:
строка %wheel ALL=(ALL) ALL в /etc/sudoers действует на всю группу. Группы sudo в RHEL нет, а членство
в root или users доступа к sudo не открывает.»

`ug_020` — «В каком каталоге в RHEL 10 лежат отдельные файлы с правилами sudo, подключённые к основному
конфигурационному файлу?»
опции: **`/etc/sudoers.d/rules`** / `/etc/sudo.conf.d/rules` / `/etc/sudo.d/rules` / `/etc/sudoers/rules.d`.
explanation: «Основной файл /etc/sudoers подключает каталог /etc/sudoers.d, поэтому отдельные правила
кладут туда: они читаются наравне с основным файлом и не конфликтуют с обновлением пакета sudo.
Остальные пути sudo не читает, а файлы с точкой в имени или с тильдой в конце в /etc/sudoers.d
игнорируются.»

Обе темы — из непокрытого в `users_groups` объектива 9.4; `sudo -l`, `visudo` и синтаксис `sudoers`
уже закрыты в теме `security` (`sec_008`, `sec_010`, `sec_011`), поэтому новые вопросы намеренно
закрывают другой срез: группу `wheel` и drop-in каталог `/etc/sudoers.d`. Пересечения по cosine
не превышают 0.71.

## 3. Улики (источник на каждое содержательное утверждение)

| id | утверждение | улика |
|---|---|---|
| `fm_008` | в EL 10 база locate ведётся пакетом `plocate`, БД `/var/lib/plocate/plocate.db` | `audit-036-summary.md:65` (в EL 10 baseos `plocate-1.1.22-10.el10`); листинг EL10-пакета, собранный аудитом 036: `audit-036-group1.md:95`; man `updatedb(8)` (plocate) — https://manpages.debian.org/unstable/plocate/updatedb.8.en.html |
| `fm_011` | `-j` = bzip2, `-J` = xz, `--bzip2` = длинная форма bzip2; `tar -cf ARCH --bzip2 …` создаёт **сжатый** архив, т.е. в вопросе было два технически верных варианта | `audit-036-summary.md:68` (прогон GNU tar 1.35, «создаёт сжатый архив»); GNU tar manual, «gzip/xz/bzip2» — https://www.gnu.org/software/tar/manual/html_node/gzip.html |
| `fs_004` | `smbfs` — устаревший тип, в RHEL 10 SMB монтируют только `-t cifs`; правильный вариант не затронут | решение капитана п.1; `audit-036-summary.md:199` («команда `mount -t cifs …` в RHEL 10 работоспособна, правильный вариант не затронут») |
| `ug_002` | RHEL 10 man useradd документирует `-m, --create-home`, `-d, --home-dir` (+`CREATE_HOME`), `-s, --shell`; `-n` в перечне опций отсутствует | man `useradd` (shadow-utils; в EL 10 — `shadow-utils-2:4.15.0-5.el10`), https://github.com/shadow-maint/shadow/blob/master/man/useradd.8.xml — опции `-m`/`--create-home`, `-d`/`--home-dir`, `-N`/`--no-user-group` есть, `-n` нет |
| `ug_007` | домашний каталог и ящик удаляются только в ветке `-r` (`if (rflg)`); `-f` (`fflg`) лишь снимает проверки (занятость пользователя, владелец файлов) и сам каталог не удаляет | `shadow-utils` `src/userdel.c`: `case 'f': fflg = true`, `case 'r': rflg = true`, `if (rflg) { remove_mailbox(); … remove_tree(user_home) }` — https://github.com/shadow-maint/shadow/blob/master/src/userdel.c (линия пакета EL 10 — `shadow-utils-2:4.15.0-5.el10`) |
| `ug_019` | в RHEL 10 права sudo по умолчанию даёт группа `wheel`; действует строка `%wheel ALL=(ALL) ALL` | RHEL 10 docs, «Chapter 8. Managing sudo access» / «8.2. Granting sudo access to a user» — https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/10/html/security_hardening/managing-sudo-access (HTTP 200, раздел про wheel); синтаксис `%группа` и `ALL=(ALL) ALL` — `sudoers(5)`: https://manpages.opensuse.org/Leap-15.6/sudo/sudoers.5.en.html (sudo 1.9.15p5 — линия sudo в RHEL 10) |
| `ug_020` | дополнительные правила кладут в `/etc/sudoers.d`, каталог подключается основным `sudoers`; файлы с `.` в имени или `~` в конце игнорируются | `sudoers(5)`, раздел «Including other files from within sudoers» (`@includedir /etc/sudoers.d`, «skipping file names that end in `~` or contain a `.` character») — https://manpages.opensuse.org/Leap-15.6/sudo/sudoers.5.en.html ; RHEL 10 docs, там же (Chapter 8. Managing sudo access) |

## 4. Оговорки

1. **`fm_011` — коллизия решения капитана п.2 с гейтом.** Решение предписывает переписать дистрактор
   `tar -cf backup.tar.bz2 --bzip2 /home` в `tar -cJf backup.tar.bz2 /home`. Однако `tar -cJf …` уже
   был вторым дистрактором вопроса, и буквальное применение дало бы **две одинаковые опции** →
   `FAIL fm_011: options 1/2 bigram jaccard 1.00 > 0.9` в `npm run qc` (жёсткое нарушение гейта
   `Fails 0` и требования «в options ровно 1 верный вариант»). Разрешено так: позиция 3 (тот самый
   дистрактор) получила ровно текст капитана `tar -cJf backup.tar.bz2 /home`, а прежний `-cJf`
   на позиции 2 заменён на `tar -cf backup.tar.bz2 /home` (несжатый tar). Итоговый набор опций —
   `-czf` (gzip) / `-cf` (без сжатия) / `-cJf` (xz) / `-cjf` (bzip2, верный): ровно один верный
   вариант, `-J` = xz явно назван в explanation. Порядок опций и позиция верного ответа не менялись.
2. **`docs.redhat.com` рендерит страницы клиентским JS** — инструмент извлечения текста отдаёт только
   заголовки. Улика по этим страницам: HTTP 200 + заголовок раздела RHEL 10 («Chapter 8. Managing sudo
   access», локализованный «8.2. Granting sudo access to a user»). Содержательные формулировки
   (wheel, `/etc/sudoers.d`) подкреплены апстримным `sudoers(5)` (`@includedir`, `%группа`,
   пропуск файлов с `.`/`~`). Прямого RHEL-хоста в среде нет (хост — Ubuntu, RHEL-бинарников нет).
3. **`_meta.verified_rhel: "10"` у `ug_002`/`ug_007`** опирается не на docs.redhat.com (книги RHEL 10
   про управление пользователями найти не удалось — проверенные path-варианты отдают 404), а на
   апстримный man/исходник shadow-utils, который в EL 10 поставляется пакетом
   `shadow-utils-2:4.15.0-5.el10` (листинг EL10). Если капитан требует именно redhat.com-URL для
   этих двух id — правка формулировок не изменится, изменится только строка `reference`.
4. **Промежуточные (не t3) гейты красные по построению:** `_order.json`/`_topics.json` не тронуты,
   поэтому `npm run order:check`, `npm run manifest` и `npm run test:run`
   (`loaders-invariant.test.ts`) упадут до t4 — это ожидаемо по брифингу §1.
5. `SEMI_FAIL [7]` у `ug_019`/`ug_020` — ограничение эвристики «same category» для концептуальных
   ответов; в гейт t3 входит только `--auto-only` (AUTO 5/5). Для сведения t5/t6.
