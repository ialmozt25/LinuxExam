# LinuxExam — BLUEPRINT 300+

> Целевой банк: 300 вопросов (потолок 320).
> Определяет числа по темам, сабтопики, порядок батчей.
> Docs-only артефакт. Код и банк не меняет.

## Итоговые числа

Текущее состояние: **66** вопросов, 14 тем (6 `available`, 8 `planned`), 54 уникальных сабтопика, домены `objective_domain` 1–9 (все 66 записей имеют валидный домен).

| тема | статус | сейчас | цель | дельта |
|---|---|---|---|---|
| `file_permissions` | available | 12 | 16 | +4 |
| `file_management` | available | 12 | 18 | +6 |
| `process_management` | available | 11 | 14 | +3 |
| `essential_tools` | available | 7 | 10 | +3 |
| `text_files` | planned | 0 | 22 | +22 |
| `shell_scripts` | planned | 0 | 22 | +22 |
| `running_systems` | planned | 0 | 22 | +22 |
| `manage_software` | planned | 0 | 22 | +22 |
| `local_storage` | planned | 0 | 22 | +22 |
| `file_systems` | planned | 0 | 22 | +22 |
| `deploy_systems` | planned | 0 | 22 | +22 |
| `networking` | planned | 0 | 22 | +22 |
| `users_groups` | available | 12 | 15 | +3 |
| `security` | available | 12 | 25 | +13 |
| **итого** | — | **66** | **300** | **+234** |

Проверка суммы: planned-темы 8 × 22 = **176**; расширение available +4 +6 +3 +3 +3 +13 = **58**; 66 + 176 + 58 = **300** (потолок 320 — резерв на перегенерацию отбракованных слотов, не на расширение списка тем).

Обоснование чисел:
- **planned = 22 на тему.** Тема с нуля: 7 сабтопиков × 3 вопроса + 1 добивочный = 22. Это даёт кворум для L5c-проверки внутри темы (≥3 вопроса на сабтопик) и не создаёт перекоса «одна тема — один сабтопик».
- **available = дельта по дефициту покрытия, а не поровну.** Приоритет отдан темам, чьи домены сейчас представлены слабее: `security` (домен 9, 23 вопроса в банке — но тема заявляет ещё и домен 7 через `chage`/`pwquality`, см. «Дыры покрытия») и `file_management` (домены 1/4/5).
- **Сумма доменов и сумма тем — разные оси.** По темам план даёт 300; по `objective_domain` распределение изменится только после генерации, потому что домен задаётся на уровне вопроса, а не темы.

## Приоритет батчей

Порядок — от закрытия дыр к расширению. Один батч = одна тема (как в пайплайне v2.0: 8 уровней, 5 ролей, 10 черновиков → 7–12 принятых за итерацию).

| # | тема | статус | вопросов в батче | почему в этом порядке |
|---|---|---|---|---|
| 1 | `shell_scripts` | planned | 22 | домен 2 = **0 вопросов**, единственный полностью пустой домен |
| 2 | `networking` | planned | 22 | полностью отсутствует; домен 7 уже нагружен 15 вопросами из других тем |
| 3 | `running_systems` | planned | 22 | перекрывается с `process_management` (systemctl/journalctl) — делать сразу после, пока контекст свеж |
| 4 | `manage_software` | planned | 22 | полностью отсутствует |
| 5 | `local_storage` | planned | 22 | полностью отсутствует; домен 4 = 2 вопроса |
| 6 | `file_systems` | planned | 22 | домен 5 = 4 вопроса; требует man по ext4/xfs/NFS |
| 7 | `deploy_systems` | planned | 22 | домен 6 = 3 вопроса (at/cron/systemd) |
| 8 | `text_files` | planned | 22 | решение капитана — Вариант B: `sed, awk, cut, sort, uniq, tr, wc, head/tail` (описание уже обновлено в `src/data/topics.ts`) |
| 9 | `security` | available | +13 (до 25) | расширение после всех новых тем; SELinux/firewalld/sudo уже покрыты 12 вопросами |
| 10 | `file_management` | available | +6 (до 18) | расширение существующих сабтопиков |
| 11 | `file_permissions` | available | +4 (до 16) | расширение; тема самая насыщенная (12 вопросов, домен 9) |
| 12 | `process_management` | available | +3 (до 14) | расширение |
| 13 | `essential_tools` | available | +3 (до 10) | расширение |
| 14 | `users_groups` | available | +3 (до 15) | расширение |

Итого по плану: 8 батчей × 22 + 58 расширения = **234 новых вопроса**, финальный банк **300**.

Замечание по порядку: `text_files` стоит на 8-м месте не из-за низкого приоритета (капитан выбрал Вариант B), а потому что его сабтопики (`sed`/`awk`/`cut`/`tr`) технически ближе к `shell_scripts`; если генерировать их подряд (позиции 1 и 8), можно переиспользовать man-контекст и избежать дублей между темами. Альтернатива — перенести `text_files` на позицию 2.

## Objectives RHCSA

**В репо не зафиксированы.** Полного списка целей EX200 нет: файлов `blueprint*` в репозитории не существует, списка из девяти доменов тоже. Что есть — только номера доменов и две расшифровки:

| domain | название (verbatim) | источник (файл:строка) |
|---|---|---|
| 1 | `1. Understand and use essential tools` | `drafts/pending-2026-09-22-2322.json` (поле `domain`) |
| 2 | `Create simple shell scripts` | `docs/content-generation-20260921-1403.md:24`, `docs/STATE-SNAPSHOT-2026-09-24.md:274` |
| 3–9 | — | расшифровок в репо **нет** |

Покрытие по доменам на текущем банке (факт, посчитан по `src/data/questions.json`):

| domain | вопросов | темы, которые его дают |
|---|---|---|
| 1 | 13 | `file_management` (fm_001, fm_002, fm_003, fm_005, fm_008, fm_009), `essential_tools` (et_001..et_007) |
| 2 | **0** | — (дыра) |
| 3 | 5 | `process_management` (pm_001, pm_002, pm_008, pm_009, pm_011) |
| 4 | 2 | `file_management` (fm_004, fm_011) |
| 5 | 4 | `file_management` (fm_006, fm_007, fm_010, fm_012) |
| 6 | 3 | `process_management` (pm_003, pm_005, pm_010) |
| 7 | 15 | `process_management` (pm_004, pm_006, pm_007), `users_groups` (ug_001..ug_012) |
| 8 | 1 | `file_permissions` (fp_004) |
| 9 | 23 | `file_permissions` (11 вопросов), `security` (sec_001..sec_012) |

Следствие для блюпринта: **целевые числа по темам не могут быть выведены из objectives** — сверка невозможна без внешнего источника. Blueprint построен на темах из `topics.ts` и фактическом банке. Соответствие «тема → домен» придётся фиксировать вручную при генерации каждого батча.

## Сабтопики по темам

### available (расширение)

**`file_permissions`** → +4 (до 16). Уже есть: numeric modes, symbolic modes, special bits, umask, ACLs, default ACLs, чёткость sticky/setgid, `chown/chgrp`.
Новые: `capabilities: getcap/setcap`, `SGID на каталогах (наследование группы)`, `sticky bit на shared-каталогах`, `umask для пользователя vs системы`.

**`file_management`** → +6 (до 18). Уже есть: `cp/mv/ln`, `find` (name/type/mtime/size/exec), `tar/gzip/bzip2`, `redirection`, `locate/updatedb`, `xargs`, `file/stat/ls -l`.
Новые: `rsync локально и по ssh`, `find -exec vs xargs (порядок и quoting)`, `cp --reflink/--preserve=xattr`, `hardlink на несколько целей и восстановление`, `tar --exclude/--listed-incremental`, `ln -s в каталог и относительные пути`.

**`process_management`** → +3 (до 14). Уже есть: `kill`-сигналы, состояния процессов, `systemctl` (start/stop/enable/mask/status), `journalctl`, `ps/top`, `nice/renice`, `jobs/bg/fg/nohup`.
Новые: `systemctl --user` и user-юниты`, `systemd-analyze blame/critical-chain`, `coredumpctl и лимиты core`.

**`essential_tools`** → +3 (до 10). Уже есть: `grep -F`, `sort -n`, `grep -c`, `find -size`, `xargs -n`, `stat %A`, `tar -czf`.
Новые: `ssh-keygen и ssh-copy-id`, `man -k / apropos и man-разделы`, `head/tail с -f и -n`.

**`users_groups`** → +3 (до 15). Уже есть: `useradd` (-u/-m/-d/-s/-G), `usermod -aG`, `userdel -r`, `groupadd -g`, `chage -M/-E`, `id -nG`, `/etc/passwd`.
Новые: `passwd -l/-u и /etc/shadow поля`, `groups и primary vs supplementary`, `/etc/skel и шаблоны домашнего каталога`.

**`security`** → +13 (до 25). Уже есть: SELinux-режимы, `chcon`, `semanage fcontext`, булевы, зоны firewalld, runtime vs permanent, sudoers/алиасы/visudo, `chage`/`pwquality`.
Новые: `restorecon -R и -v`, `semanage boolean -m`, `firewall-cmd --add-port/--remove-service`, `rich rules и priority`, `sshd_config: PermitRootLogin/PasswordAuthentication`, `ss -tulpn и netstat-замена`, `sudoers Defaults env_reset/secure_path`, `sudo -l и лог /var/log/secure`, `gpg для файлов`, `sha256sum/sha512sum и проверка целостности`, `PAM: pam_faillock`, `firewalld --permanent + --reload`, `SELinux booleans для httpd`.

### planned (с нуля)

**`text_files`** → 22. Сабтопики (Вариант B): `sed: подстановка`, `sed: удаление и диапазоны строк`, `awk: выбор полей и печать колонок`, `cut: поля и диапазоны`, `sort -u / uniq: дедупликация`, `tr: регистр и удаление символов`, `wc/head/tail: подсчёт и срезы`.

**`shell_scripts`** → 22 (домен 2). Сабтопики: `if/then/else и test [ ]`, `циклы for/while`, `позиционные аргументы $1.. и $@`, `подстановка $() и результат команды`, `коды возврата $? и exit`, `функции и локальные переменные`, `чтение stdin: read и перенаправления`.

**`running_systems`** → 22. Сабтопики: `boot targets: systemctl get-default/set-default`, `systemctl is-active/is-enabled/status`, `journalctl: -u, -b, -p, --since`, `перезагрузка и rescue/target`, `unit-файлы: [Unit]/[Service]/[Install]`, `systemctl daemon-reload и маскирование`, `процессы: $! и фоновые задания`.

**`manage_software`** → 22. Сабтопики: `dnf install/remove/info`, `dnf module list/enable/install`, `rpm -q/-ql/-qf/-qp`, `репозитории: /etc/yum.repos.d и dnf repolist`, `dnf history и rollback`, `groupinstall и environment groups`, `Flatpak: remote/install/list`.

**`local_storage`** → 22. Сабтопики: `разметка: parted/fdisk`, `LVM: pvcreate/vgcreate/lvcreate`, `расширение LV и xfs_growfs/resize2fs`, `swap: mkswap/swapon и /etc/fstab`, `mount by UUID`, `blkid и lsblk`, `fstab: опции и nofail`.

**`file_systems`** → 22. Сабтопики: `mkfs.ext4/xfs и их опции`, `mount/umount и типы ФС`, `fstab: строки, dump/pass`, `NFS-монтирование: showmount/mount -t nfs`, `autofs и /etc/auto.master`, `df/du и занятое место`, `setfacl/getfacl на ФС без ACL по умолчанию`.

**`deploy_systems`** → 22. Сабтопики: `at и batch`, `cron: crontab -e/-l/-r и /etc/cron.d`, `systemd timers: OnCalendar`, `tuning: tuned-adm`, `systemd service enable и drop-in`, `логирование сервисов и journald persistent`, `SELinux-контекст для новых сервисов`.

**`networking`** → 22. Сабтопики: `nmcli connection add/modify/up/down`, `nmcli device status и wifi`, `hostname и hostnamectl`, `/etc/hosts и порядок разрешения`, `/etc/resolv.conf и DNS`, `ip addr/route и проверка шлюза`, `firewalld zone и --add-interface`.

## Дыры покрытия

1. **Домен 2 (`Create simple shell scripts`) = 0 вопросов.** Единственный полностью пустой домен. Закрывается темой `shell_scripts` (батч 1, 22 вопроса). Причина задокументирована в `docs/content-generation-20260921-1403.md:33-35`: «в банке нет заданий на написание скриптов, а приписывать существующим вопросам этот домен было бы недостоверно».
2. **Домен 8 = 1 вопрос** (`fp_004 chown/chgrp`). Тема `users_groups` (12 вопросов) почти целиком лежит в домене 7. План +3 к `users_groups` и новые сабтопики `/etc/shadow`, `passwd -l/-u`, `/etc/skel` частично закроют домен 8.
3. **Домен 4 = 2 вопроса, домен 5 = 4, домен 6 = 3.** Все три зависят от отсутствующих тем (`local_storage`, `file_systems`, `deploy_systems`).
4. **`security` неоднородна по домену.** По названию темы (`SELinux, firewalld, SSH keys, sudo`) она ближе к домену 9, но два её вопроса (`sec_011 chage -M`, `sec_012 pwquality minlen`) фактически про парольную политику — то есть про домен 7/8. А `chage -M` уже есть и в `users_groups` (`ug_009`) — **дублирование сабтопика между темами**, кандидат на слияние или переформулировку.
5. **`text_files` и домен.** `drafts/report-2026-09-22.md:82` утверждает, что `text_files` «по разведке относится к домену 5, а не 1». В репо расшифровки домена 5 нет, подтвердить нечем (зафиксировано в `docs/RESEARCH-text-topic-2026-09-24.md`, «Открытые вопросы», п. 1).
6. **`essential_tools` = 7 вопросов, все в домене 1.** Тема заявляет `ssh` и `man pages`, но вопросов по ним нет ни одного.
7. **Пересечение `text_files` с существующими темами.** После правки описания на Вариант B пересечение снято формально, но `grep` остаётся в `essential_tools` (`et_001`, `et_007`), `sort` — там же (`et_003`), а `redirection` — в `file_management` (`fm_005`). При генерации `text_files` эти сабтопики писать **нельзя** — иначе дубликаты на уровне L3.5.

## Открытые вопросы

1. **Формат файлов вопросов при 300:** один `questions.json` (сейчас 98 233 байта при 66) или 14 файлов по темам с ленивой загрузкой? При 300 один файл даст ≈450 КБ, а bundle gzip уже **138.77 kB** при watch-пороге `>137 kB → стоп`.
2. **Порог Haladyna при 300:** оставляем 8/10 или ослабляем? В снапшоте L8 уже помечен как мягкий («12/12 без reject» — в `docs/CONTEXT.md` числится открытым пунктом «Ужесточение L8»).
3. **Cosine O(n²) при 300:** 300 вопросов = **44 850 пар** (сейчас 1 431 пара на 54 вопросах, то есть рост в ~31 раз). Нужен план: батчевый прогон, инкрементальная проверка только новых пар, или отказ от полного прогона.
4. **Bundle при 300:** lazy-load обязателен до начала генерации или можно обойтись `import()` по требованию? Потолок 320 не спасает — это про качество, а лимит gzip про размер.
5. **Cosine-модель:** менять на русскоязычную (`cointegrated/rubert-tiny2`) до или после 300? Сейчас `cosine_limitation.class_inversion = true`, primary defense — Jaccard 0.9.
6. **Домен-привязка planned-тем:** какие домены должны закрывать `networking`, `local_storage`, `file_systems`, `deploy_systems`, `manage_software`, `running_systems`? В репо расшифровок доменов 3–9 нет — нужен внешний источник.
7. **`retired.json` и monthly re-verify:** при 300 вопросах устаревание (RHEL 9.x) станет заметным. Нужен ли регламент вывода вопросов в retirement и с какой периодичностью?
8. **Стоп-правило для аудита:** в `docs/HANDOFF.md` зафиксировано «только minor findings в 2 батчах подряд → стоп аудит». При 14 батчах подряд это правило может остановить наполнение — сохраняем или пересматриваем?
9. **Дублирование `chage -M`** между `users_groups` (`ug_009`) и `security` (`sec_011`): объединять темы, переформулировать вопрос или оставить как разные аспекты?

## Провенанс

Собрано: 2026-09-24, из файлов репозитория:

| источник | что взято |
|---|---|
| `src/data/topics.ts` | 14 тем verbatim: key/title/description/status |
| `src/data/questions.json` | фактические счётчики: 66 вопросов, 6 тем в банке, 54 сабтопика, домены 1–9 |
| `docs/HANDOFF.md` | bundle gzip 138.77 kB и watch-порог 137 kB; L8 мягкий |
| `docs/STATE-SNAPSHOT-2026-09-24.md:274,645` | домен 2 = 0; домены 8 = 1, 4 = 2 |
| `docs/content-generation-20260921-1403.md:20-35` | таблица доменов, два названия, решение не трогать домен 2 |
| `drafts/report-2026-09-22.md:82` | цитата про скоуп `text_files` и домен 5 |
| `docs/RESEARCH-text-topic-2026-09-24.md` | решение Вариант B для `text_files`, открытый вопрос про домен |
| `docs/CONTEXT.md` | открытые пункты: lazy-load, ужесточение L8, cosine-модель |

При расхождении между этим файлом и кодом (`src/data/topics.ts`, `src/data/questions.json`) — **верить коду**. Целевые числа (300/320, 22 на planned-тему, дельты available) — плановые ориентиры, а не факты о текущем состоянии.
