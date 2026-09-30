# Аудит 036 — группа 2

> Источник: .project/specs/030-objectives-full.md (RHEL 10) · дата прогона 2026-09-30 · охват 67 вопросов
> Темы: shell_scripts (16), process_management (17), running_systems (16), users_groups (18).
> Метод: прочитан каждый элемент массива (id, topic, difficulty, objective_domain, subtopic, question, options, explanation, `_meta`), содержимое сверено с objectives RHCSA EX200 RHEL 10.
> Закрытые spec 031 находки (`fp_002`, `sec_007`) не переоткрывались.

## shell_scripts (16)

- `sh_001` — shell_scripts — актуален — объектив 3.1 «Conditionally execute code (use of: if, test, [], etc.)»; разбор `-f`/`-e`/`-d`/`-r` верен, устаревших терминов/путей нет.
- `sh_002` — shell_scripts — актуален — объектив 3.1; конструкция `if test -d …; then …; else …; fi` синтаксически и семантически корректна.
- `sh_003` — shell_scripts — актуален — объектив 3.2 «Use Looping constructs (for, etc.)»; `for d in $dirs` — подстановка переменной, дистрактор `for d in dirs` объективно перебирает одно слово.
- `sh_004` — shell_scripts — актуален — объективы 3.2 и 3.4; `while read line; done < list.txt` использует актуальное перенаправление stdin, дистракторы `>`/`until` разобраны верно.
- `sh_005` — shell_scripts — актуален — объектив 3.3 «Process script inputs ($1, $2, etc.)»; `$3`/`$0`/`$#`/`$2` различены верно.
- `sh_006` — shell_scripts — актуален — объектив 3.3; `test $# -eq 2` — проверка «ровно два аргумента», `$?` как дистрактор истолкован верно.
- `sh_007` — shell_scripts — актуален — объектив 3.4 «Processing output of shell commands within a script»; `count=$(wc -l < list.txt)` против `wc -l list.txt` (имя файла в выводе) — разбор верен.
- `sh_008` — shell_scripts — актуален — объективы 3.1/3.4; `cmd || exit $?` сохраняет код неудачи, `&&`-дистракторы разобраны верно.
- `sh_009` — shell_scripts — актуален — прямая формулировка объектива 3 для `local` отсутствует (в списке 4 пункта: if/loops/args/output), но это базовая скриптовая практика RH124 для RHEL 10; синтаксис `local` актуален, устаревших элементов нет.
- `sh_010` — shell_scripts — актуален — объектив 3.3; `read -p "Имя: " user` (имя переменной без `$`) разобрано верно.
- `sh_011` — shell_scripts — актуален — объектив 3.1; синтаксис `case … in … ) … ;; esac` верен, дистракторы `of`/`if`/`when` — не ключевые слова shell.
- `sh_012` — shell_scripts — актуален — объектив 3.3; `getopts "vo:"` (значение требует только `-o`, `OPTARG`) — верно и совместимо с bash в RHEL 10.
- `sh_013` — shell_scripts — актуален — объектив 3.4 (обработчик завершения — скриптовая практика); `trap "…" EXIT` корректен, `STOP` действительно не перехватывается.
- `sh_014` — shell_scripts — актуален — объектив 3.1 (немедленный выход при ошибке — скриптовая практика); `set -e` против `-x/-u/-v` разобран верно.
- `sh_015` — shell_scripts — актуален — объектив 3.4; `source /etc/profile.d/settings.sh` выполняет файл в текущей оболочке — верно, путь `/etc/profile.d` актуален для RHEL 10.
- `sh_016` — shell_scripts — актуален — объектив 3.4 (проверка синтаксиса); `bash -n` — режим чтения без выполнения, различие с `-x/-v/-e` верно.

## process_management (17)

- `pm_001` — process_management — актуален — объектив 4.4 «Identify CPU/memory intensive processes and kill processes»; SIGKILL (9) не перехватывается — верно для RHEL 10.
- `pm_002` — process_management — актуален — объектив 4.4; состояния R/S/D/Z описаны верно (Z — зомби до `wait`).
- `pm_003` — process_management — актуален — объективы 4.9 и 7.2 «Start and stop services and configure services to start automatically at boot»; `systemctl enable --now httpd.service` и отсутствие `--also-start-now`/`start --enable` — верно для systemd в RHEL 10.
- `pm_004` — process_management — актуален — объектив 4.4; `ps -u dev1` (эффективный пользователь) против `-C` (имя команды) и `-e dev1` — верно.
- `pm_005` — process_management — актуален — объектив 4.7 «Locate and interpret system log files and journals»; `journalctl -u sshd -b` — текущая загрузка, актуальный journald-синтаксис.
- `pm_006` — process_management — актуален — объектив 4.5 «Adjust process scheduling»; `renice -n 10 -p 1234`, отсутствие `-p` у `nice`, знак приоритета — верно.
- `pm_007` — process_management — актуален — объектив 4.4; `nohup … &` против чистого `&` и `jobs` — верно, SIGHUP-семантика актуальна.
- `pm_008` — process_management — актуален — объектив 4.4; SIGKILL нельзя перехватить/заблокировать, остальные перечисленные сигналы перехватываемы — верно.
- `pm_009` — process_management — актуален — объектив 4.4; `top -d 1` как динамический монитор, различие с `ps aux`, `jobs -l`, `uptime -p` — верно; `htop` не требуется (в stock RHEL нет).
- `pm_010` — process_management — актуален — объективы 4.9/7.2; mask (`/dev/null`) блокирует и ручной запуск, disable — только автозапуск; верно.
- `pm_011` — process_management — актуален — объектив 4.4; `kill` без сигнала отправляет SIGTERM (15) — верно.
- `pm_012` — process_management — актуален — объектив 4.4; `pkill -f worker` (полная командная строка) против `pkill worker` (имя процесса) и `pgrep` — верно.
- `pm_013` — process_management — актуален — объектив 4.4; путь `/proc/PID/environ` актуален, отличие от `cmdline`/`status` и отсутствие `environment` — верно.
- `pm_014` — process_management — актуален — объективы 4.7/7.2; `systemd-analyze blame` актуален в systemd RHEL 10, различие с `plot` и `journalctl -b` — верно.
- `pm_015` — process_management — актуален — прямо соответствует новому объективу RHEL 10 «Schedule tasks using at, cron and systemd timer units» (7.1) и 7.2; `systemctl --user enable --now backup.timer` — актуальный timer-юнит, не legacy cron.
- `pm_016` — process_management — актуален — объективы 4.4/4.7; `coredumpctl list` против `info` и `journalctl -b -k` — верно; systemd-coredump входит в RHEL 10.
- `pm_017` — process_management — актуален — объектив 4.4 (управление заданиями); `disown %1` убирает задание из таблицы, процесс продолжает работу, SIGHUP не приходит — верно.

## running_systems (16)

- `rs_001` — running_systems — актуален — объективы 4.2 «Boot systems into different targets manually» и 7.3 «Configure systems to boot into a specific target automatically»; `set-default multi-user.target` против `isolate`/`enable`/`get-default` — верно.
- `rs_002` — running_systems — актуален — объектив 7.2; `ExecStart=` в разделе `[Service]`, назначение `ExecStop`/`Restart`/`WantedBy` — верно для unit-файлов systemd RHEL 10.
- `rs_003` — running_systems — актуален — объективы 7.2 и 4.9; `systemctl is-enabled sshd` (автозапуск, код возврата) против `is-active`/`status`/`list-units --all` — верно.
- `rs_004` — running_systems — актуален — объектив 4.7; `journalctl -u httpd` (по юниту) против `-b 0`, `-n 20`, `-p err` — верно, синтаксис journald актуален.
- `rs_005` — running_systems — актуален — объектив 4.7; `journalctl --boot -1` (предыдущая загрузка), смысл `-0` и положительного смещения — верно.
- `rs_006` — running_systems — актуален — объектив 7.2; `systemctl mask telnet.socket` против `stop`/`disable`/`unmask` — верно, socket-юниты актуальны.
- `rs_007` — running_systems — актуален — объектив 7.2; `systemctl daemon-reload` против `reload`/`restart`/`reset-failed` — верно.
- `rs_008` — running_systems — актуален — объектив 4.2; `systemctl isolate rescue.target` (немедленный переход, без перезагрузки) против `start`/`enable`/`set-default` — верно.
- `rs_009` — running_systems — актуален — объективы 4.4 и 3.3; переменная `$!` (PID фонового процесса) против `$$`/`$0`/`$#` — верно.
- `rs_010` — running_systems — актуален — объективы 7.2 и 4.9; `systemctl is-enabled httpd` только читает состояние автозапуска — верно.
- `rs_011` — running_systems — актуален — объектив 7.2; `systemctl show -p MainPID httpd.service` против `status`/`cat`/несуществующей `list` — верно.
- `rs_012` — running_systems — актуален — объектив 7.2; `systemctl reset-failed httpd.service` (сброс состояния отказа и счётчиков перезапуска) — верно, отсутствие `clear-failed` корректно.
- `rs_013` — running_systems — актуален — объектив 4.8 «Preserve system journals»; `journalctl --vacuum-size=200M` и указание на `SystemMaxUse` в `/etc/systemd/journald.conf` — актуальные путь и директива RHEL 10, каталог `/var/log/journal` верен.
- `rs_014` — running_systems — актуален — объектив 7.2; `systemctl cat` печатает действующие файлы с drop-in-переопределениями, различие с `show`/`edit`/`status` — верно.
- `rs_015` — running_systems — актуален — объективы 4.9 и 7.4 «Configure time service clients»; `systemctl enable --now chronyd.service`, путь `/etc/chrony.conf` актуален для RHEL 10.
- `rs_016` — running_systems — актуален — объектив 4.1 «Boot, reboot, and shut down a system normally»; `systemctl poweroff` против `halt`/`reboot`/`suspend` — верно.

## users_groups (18)

- `ug_001` — users_groups — актуален — объектив 9.1 «Create, delete, and modify local user accounts»; `useradd -u 4200` (--uid) против `-g`/`-G`/несуществующего `-i` — верно для shadow-utils RHEL 10.
- `ug_002` — users_groups — требует правок — объяснение опирается на RHEL-9-эру: «на Rocky 9.8 `-n` является недокументированным алиасом --no-user-group», `_meta.verified_rhel="9.8"`; при прогоне в WSL Rocky-9.8 улика подтвердилась (`useradd -n` → usage без LOGIN, контроль `useradd -Q` → `invalid option -- 'Q'`), но поведение shadow-utils 4.16 в RHEL 10 не проверено — формулировку/верификацию нужно обновить под RHEL 10 (правильный ответ `-m` не затронут).
- `ug_003` — users_groups — актуален — объектив 9.1; `useradd -d /srv/home/alice` (--home-dir, шестое поле /etc/passwd) против `-p`/`-c`/несуществующего `-h` — верно.
- `ug_004` — users_groups — актуален — объектив 9.1; `useradd -s /bin/bash` (--shell) против `-f`/`-e` и регистрозависимого `-S` — верно.
- `ug_005` — users_groups — актуален — объектив 9.3 «Create, delete, and modify local groups and group memberships»; `useradd -m -G developers` (дополнительные группы) против `-g`/`-N`, отсутствие `-a` у useradd — верно.
- `ug_006` — users_groups — актуален — объектив 9.3; `usermod -aG auditors alice` сохраняет прежние дополнительные группы, `-G` без `-a` заменяет список — верно.
- `ug_007` — users_groups — требует правок — объяснение содержит RHEL-9-эру улику «man-страница userdel для `-f` … однако на Rocky 9.8 это неверно … проверено эмпирически» и `_meta.human_review` с `flags:["educational_man_limitation"]`, `verdict_before/after: pass_with_flag` (2026-09-23); поведение `userdel -f` в RHEL 10 не переверифицировано (проверка в WSL Rocky-9.8 требует root) — нужно переверифицировать/переформулировать под RHEL 10 (правильный ответ `-r` не затронут).
- `ug_008` — users_groups — актуален — объектив 9.3; `groupadd -g 5000` (--gid) против `-r`/несуществующих `-u`/`-i` — верно.
- `ug_009` — users_groups — актуален — объектив 9.2 «Change passwords and adjust password aging for local user accounts»; `chage -M 90` (--maxdays) против `-m`/`-d`/`-E` — верно.
- `ug_010` — users_groups — актуален — объектив 9.2; `chage -E 2099-12-31` (--expiredate, формат ГГГГ-ММ-ДД) против `-I`/`-W`/`-M` — верно, оговорка про число дней от 1970 корректа.
- `ug_011` — users_groups — актуален — объектив 9.3; `id -nG alice` (имена всех групп) против `-G`/`-g`/`-gn` — верно.
- `ug_012` — users_groups — актуален — объектив 9.1; разбор семи полей `/etc/passwd` (домашний каталог — шестое поле, GECOS — пятое, `x` во втором) — верно.
- `ug_013` — users_groups — актуален — объектив 9.2; `usermod -L` ставит `!` перед хешем в /etc/shadow, `-U` снимает блокировку — верно (примечание man про EXPIRE_DATE не противоречит).
- `ug_014` — users_groups — актуален — объективы 9.1/9.3; `usermod -g developers alice` меняет основную группу (четвёртое поле /etc/passwd) против `-G`/`-c`/`-e` — верно.
- `ug_015` — users_groups — актуален — объектив 9.3; `groupmod -n devteam developers` (--new-name) против `groupadd` и отсутствующих `-c`/`-d`; улика подтверждена в WSL Rocky-9.8 (`groupmod -c x y` → `invalid option -- 'c'`).
- `ug_016` — users_groups — актуален — объектив 9.1; `useradd -r` (системная запись, SYS_UID_MIN–SYS_UID_MAX 201-999 из /etc/login.defs) против `-u`/`-d`/`-c` — верно для RHEL 10.
- `ug_017` — users_groups — актуален — объектив 9.2; `chage -l alice` только печатает сроки, `-M`/`-E`/`-I` меняют базу или ожидают число — верно.
- `ug_018` — users_groups — актуален — объективы 9.1 и 9.3; `useradd -m` копирует `/etc/skel` (`SKEL` в `/etc/default/useradd`) против `-M`/`-d`/`-g` — верно.

## Итог группы

- актуален: 65 · требует правок: 2 · устарел: 0 · требует ручного решения: 0
- `требует правок`: `ug_002` (`-n` как «недокументированный алиас» зафиксирован на Rocky 9.8), `ug_007` (`userdel -f` и «эмпирика» привязаны к Rocky 9.8 + `_meta.human_review` от 2026-09-23); оба — RHEL-9-эра в объяснении при неизменном правильном ответе.
- Устаревших терминов/команд/путей нет: во всех 67 вопросах отсутствуют `chkconfig`, `service <name>` (sysvinit), `/etc/init.d`, `runlevel`/`inittab`, `yum` как основной, `ifconfig`, `iptables`, `cgroup v1`, контейнеры/Podman, MBR.
- Системное наблюдение вне построчных вердиктов (метаданные, не содержание): `objective_domain` записан в нумерации RHEL 9 (1–9). У `users_groups` он равен 7, тогда как по этой же нумерации 7 = Manage basic networking (совпадает с темой `networking`), а 8 = Manage users and groups (`fp_004`, docs/content-generation-20260921-1403.md); у `pm_004`, `pm_006`, `pm_017` стоит 7 при содержании «Operate running systems» (3). Дополнительно RHEL 10 вставил категорию 2 `Manage software`, сдвинув нумерацию последующих категорий. Поле не входит в `src/data/models/Question.ts` и приложением не читается — решение о правке метаданных за капитаном (не влияет на содержание вопросов).
- Пробелы покрытия objectives (не относятся к отдельным id, к темам группы): `users_groups` — ни одного вопроса про `sudo`/`wheel` при объективе 9.4 «Configure privileged access» (spec 030 уже зафиксировала «0 затронутых id»); `running_systems` — нет кейса «Interrupt the boot process in order to gain access to a system» (4.3, `rd.break`/`init=/bin/bash`) и объектив 4.8 закрыт только `--vacuum-size` без `Storage=persistent`; `process_management` — 0 упоминаний `tuned`/tuning profiles (4.6), spec 030 помечала это как «проверить покрытие».

## Непокрытые id

(пусто)
