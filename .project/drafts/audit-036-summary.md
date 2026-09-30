# Аудит 036 — сводный список (QC-интеграция)

> Источник: .project/specs/030-objectives-full.md (RHEL 10, 10 категорий / 62 пункта) + .project/drafts/audit-036-group1.md … group4.md.
> Дата: 2026-09-30. Охват: 225 вопросов (14 тем, 4 группы: 66 + 67 + 43 + 49).
> Метод QC: независимая сверка полноты/формата скриптом (node), adversarial-чтение 18 вопросов (все «требует правок» + «требует ручного решения» + 7 «актуален»). Групповые файлы не правились.

## Сводка по вердиктам

| Вердикт | Количество |
|---|---|
| актуален | 214 |
| требует правок | 10 |
| устарел | 0 |
| требует ручного решения | 1 |
| **Итого** | **225** |

Полнота: 225 id банка = 225 строк-вердиктов; пропуски / дубли / лишние — 0 (сверено node-скриптом по 14 файлам src/data/questions/*.json).

## Сводный список (225)

### essential_tools (13)

- `et_001` — essential_tools — актуален — объектив 1.3 «Use grep and regular expressions to analyze text»; `grep -F/--fixed-strings` и разбор `-E/-v/-w` верны, ключи GNU grep в RHEL 10 не менялись.
- `et_002` — essential_tools — актуален — объектив 1 «Understand and use essential tools»; семантика `find -size +100M` (суффикс M = МиБ, знак «+» = строго больше, размер округляется вверх) описана верно, GNU find в RHEL 10 без изменений.
- `et_003` — essential_tools — актуален — объектив 1; `sort -n/-r/-u` и лексикографическое сравнение по умолчанию разобраны верно.
- `et_004` — essential_tools — актуален — объектив 1; `xargs -n` против `-I/-p/-t` разобран верно, поведение подтверждено (`xargs -n 0` → «value 0 for -n option should be >= 1»).
- `et_005` — essential_tools — актуален — объектив 1; спецификаторы `stat -c '%A'`/`%a`/`%n`/`%s` (coreutils) и различие регистра верны.
- `et_006` — essential_tools — актуален — объектив 1.6 «Archive, compress, unpack, and uncompress files using tar, gzip, and bzip2» (прямая формулировка RHEL 10); `-czf` против `-cjf/-xzf/-tf` разобран верно.
- `et_007` — essential_tools — актуален — объектив 1.3; `grep -c` против `-n/-v/-l` — верно.
- `et_008` — essential_tools — актуален — объектив 1.3; `grep -i`; ключа `-Q` у grep нет, дистрактор невалиден — верно.
- `et_009` — essential_tools — актуален — объектив 1.11 «Locate, read, and use system documentation including man, info, and files in /usr/share/doc»; `man -k`/`--apropos` против `-f`/`-w` — верно.
- `et_010` — essential_tools — актуален — объектив 1; `find -maxdepth` против `-mindepth`/`-depth` и несуществующей формы `-max-depth` — верно.
- `et_011` — essential_tools — актуален — объективы 1 и 9.1 (формат `/etc/passwd`); файл `/etc/passwd` в RHEL 10 сохраняется, `sort -t: -k3 -n` верен.
- `et_012` — essential_tools — актуален — объективы 1.4 «Access remote systems using SSH» и 10.3 «Configure key-based authentication for SSH»; `ssh-copy-id` входит в openssh-clients RHEL 10, разбор `ssh-keygen`/`ssh-add` верен.
- `et_013` — essential_tools — актуален — объектив 1.6; `tar -xzf` верен (мелкая неточность объяснения про `-czf` без членов архива — см. «Итог группы», на вердикт не влияет).

### text_files (16)

- `tf_001` — text_files — актуален — объективы 1.2 «Use input-output redirection (>, >>, |, 2>, etc.)» и 1.7; `sed 's/old/new/'` без флага g + перенаправление `>` — верно.
- `tf_002` — text_files — актуален — объектив 1.7 «Create and edit text files»; `sed -i` правит файл на месте, сочетание `-i -n` обнуляет файл — верно.
- `tf_003` — text_files — актуален — объектив 1; `sed -n '5,10p'`: диапазон через запятую, форма с дефисом не разбирается, поведение без `-n` описано верно.
- `tf_004` — text_files — актуален — объективы 1.3 и 1; `awk -F: '$7==...'` и различие `=`/`==` верны (7-е поле `/etc/passwd` — оболочка).
- `tf_005` — text_files — актуален — объектив 1; `cut -d: -f1,3` против `-f1`, `-f1-3`, `-c1,3` — верно.
- `tf_006` — text_files — актуален — объектив 1; `cut -c3-7`; поведение `cut -f` на строке без табуляции (возврат строки целиком) описано верно.
- `tf_007` — text_files — актуален — объектив 1; `sort -u` против `uniq` (только соседние повторы) — верно, все три вывода для входа b, a, b, b, c посчитаны правильно.
- `tf_008` — text_files — актуален — объектив 1; `uniq -c` против `-i/-d/-u` — верно.
- `tf_009` — text_files — актуален — объектив 1; `tr 'a-z' 'A-Z'` против `-d/-s` — верно.
- `tf_010` — text_files — актуален — объектив 1; `tail -n 20` против `head -n 20`, `head -n -20`, `tail -n +20` — верно.
- `tf_011` — text_files — актуален — объективы 1.3 и 4.7 (логи); `grep -c` верен, путь `/var/log/messages` актуален и в RHEL 10 (документация RHEL 10 «Risk reduction and recovery operations» ссылается на этот файл).
- `tf_012` — text_files — актуален — объектив 1.3; `grep -v` против `-x/-q/-i` — верно.
- `tf_013` — text_files — актуален — объектив 1.3; `grep -B 2` (before) против `-A`/`-C` и `-n` — верно.
- `tf_014` — text_files — актуален — объектив 1; `wc -l` против `-c/-m/-w` — верно.
- `tf_015` — text_files — актуален — объектив 1.2; `tee -a` (дозапись) против `tee`, `-i` и `> tee` — верно.
- `tf_016` — text_files — актуален — объектив 1; `tail -n +50` (начиная с 50-й строки) против `-n -50`, `head -n 50`, `head -n -50` — верно.

### file_management (18)

- `fm_001` — file_management — актуален — объектив 1.8 «Create, delete, copy, and move files and directories»; `cp -r` против `mv -r` (такого ключа нет), `cp` без `-r` и несуществующей `copy` — верно.
- `fm_002` — file_management — актуален — объектив 1; `find -mtime -1` против `-mmin -1`, `-mtime +1`, `-newer /etc` — верно.
- `fm_003` — file_management — актуален — объективы 1.8 и 1; `find -type f -name '*.conf'`; поведение `-maxdepth 1` и отсутствие `-name` у `locate` описаны верно.
- `fm_004` — file_management — актуален — объектив 1.6; `tar -czf` верен, `-cjf/-tzf/-xzf` разобраны верно (атрибуция `objective_domain="4"` — в «Итог группы»).
- `fm_005` — file_management — актуален — объектив 1.2 (прямая формулировка `2>`); `> log.txt 2>&1` против `2>1`, `>>`, `2>&1 > log.txt` — верно.
- `fm_006` — file_management — актуален — объектив 1.8; `cp -a` (=-dR --preserve=all) против `-r`, `-p` и `mv` — верно.
- `fm_007` — file_management — актуален — объектив 1; `find -mtime +7` против `-mtime -7`, `-mtime 7`, `-atime +7` — верно.
- `fm_008` — file_management — требует правок — объяснение (`src/data/questions/file_management.json:216`) называет устаревший индекс `mlocate.db`: в RHEL 10 `locate` и `updatedb` предоставляет пакет `plocate` (в EL 10 baseos — `plocate-1.1.22-10.el10`), база лежит в `/var/lib/plocate/plocate.db`. Заменить имя пакета/БД (`mlocate` → `plocate`, `/var/lib/mlocate/mlocate.db` → `/var/lib/plocate/plocate.db`); правильный ответ `updatedb` не меняется.
- `fm_009` — file_management — актуален — объектив 1; `find -print0 | xargs -0` против `-n 0` (невалидно), несуществующего `-exec0` и варианта без `-print0` — верно.
- `fm_010` — file_management — актуален — объектив 1; `file` определяет тип по содержимому, `stat`/`ls -l`/`type` разобраны верно.
- `fm_011` — file_management — требует ручного решения — в вопросе два технически верных варианта: `tar -cjf backup.tar.bz2 /home` и `tar -cf backup.tar.bz2 --bzip2 /home`. Проверено на GNU tar 1.35: `tar -cf ARCH --gzip …` создаёт сжатый архив, то есть длинная опция сжатия допустима вместе с `-f` (аналог `--bzip2` работает так же). Объяснение утверждает обратное («…без -f»), то есть ошибочно. Требуется решение человека: что править — дистрактор или объяснение.
- `fm_012` — file_management — актуален — объектив 1.9 «Create hard and soft links»; различие inode/путь, запрет жёстких ссылок на каталоги, граница файловой системы — верно.
- `fm_013` — file_management — актуален — объективы 1.8 и 1; `rsync -a --delete` против `--existing/--backup/--update` верен; rsync присутствует в RHEL 10 (в EL 10 baseos — `rsync-3.4.1-2.el10`).
- `fm_014` — file_management — актуален — объектив 1; `dd bs=1M count=100` против несуществующего операнда `size=`, чтения из `/dev/null` и `bs=1K count=100` — верно.
- `fm_015` — file_management — актуален — объектив 1; `split -b 10M` против `-l 10M`, `-n 10M` и отсутствующего `-c` — верно.
- `fm_016` — file_management — актуален — объектив 1; `truncate -s 0` против `-s 100`, `rm` и `touch -c -m` — верно.
- `fm_017` — file_management — актуален — объектив 1; `mktemp -d /tmp/tmp.XXXXXX` против вариантов, создающих файл, и `mkdir` с PID — верно.
- `fm_018` — file_management — актуален — объектив 1; `basename` против `dirname`, `realpath` и `readlink` — верно.

### file_permissions (19)

- `fp_001` — file_permissions — актуален — объектив 1.10 «List, set, and change standard ugo/rwx permissions»; 754 = rwx / r-x / r-- — верно.
- `fp_003` — file_permissions — актуален — объектив 1.10; отличие 640 от 600 (группа r-- против ---) — верно.
- `fp_004` — file_permissions — актуален — объективы 1.10 и 9.1/9.3 (владение); `chown -R owner:group`; строчного `-r` у chown нет — верно.
- `fp_005` — file_permissions — актуален — объектив 1.10; верный ответ `chmod u+x`; проверено на GNU chmod (coreutils 9.x): из режима 644 команда `chmod u=+x` даёт 144 (---xr--r--), то есть объяснение про сброс битов владельца знака `=` корректно.
- `fp_006` — file_permissions — актуален — объектив 10.2 «Manage default file permissions»; umask 022 → файл 644 (666 & ~022), каталог 755 — верно.
- `fp_007` — file_permissions — актуален — объективы 1.10 и 6.5 «Diagnose and correct file permission problems»; `getfacl` против `setfacl`, `ls -l` (только признак «+») и несуществующей `acl` — верно; пакет acl в RHEL 10 есть.
- `fp_008` — file_permissions — актуален — объектив 1.10 (спецбиты — надстройка над ugo/rwx); setuid = права владельца файла, отличие от setgid — верно; удалённый объектив RHEL 10 касался set-GID-каталогов (`fp_002` удалён spec 031) и setuid не затрагивает.
- `fp_009` — file_permissions — актуален — объективы 1.10 и 10.2; `setfacl -d -m` (default ACL) против `-R` и несуществующего `-default` — верно.
- `fp_010` — file_permissions — актуален — объектив 1.10; sticky `+t` (числовой префикс 1) против `+s`, `+sticky` и режима 2755 — верно.
- `fp_011` — file_permissions — актуален — объектив 1.10; `chmod g-w` меняет только бит записи группы — верно.
- `fp_012` — file_permissions — актуален — объектив 1.10; 600 против 644/640/666 — верно.
- `fp_013` — file_permissions — актуален — объективы 1.10 и 6.5; `setfacl -m u:alice:rw` — единственный вариант, дающий alice запись (нюанс пересчёта ACL-маски — в «Итог группы», верный ответ не меняется).
- `fp_014` — file_permissions — актуален — объектив 1.10; запись mask `-m m::r` против владельца (`u::`) и группы; длинной опции `--mask` у setfacl нет — верно.
- `fp_015` — file_permissions — актуален — объектив 10.2; umask 027 → каталоги 750, файлы 640; значение 028 недопустимо в восьмеричной системе — верно.
- `fp_016` — file_permissions — актуален — объективы 1.10, 9.1 и 9.3; `chown --reference` против `chmod --reference` (копирует только биты режима), несуществующего `--copy` и `cp -p` — верно.
- `fp_017` — file_permissions — актуален — объектив 1.10; заглавная `X` (только каталоги и уже исполняемые файлы) против `x`, знака `=` и несуществующего класса `any` — верно.
- `fp_018` — file_permissions — актуален — объективы 1.10 и 6.5; `chattr +i` против несуществующего `+I`, `+a` и `chmod 444` — верно.
- `fp_019` — file_permissions — актуален — объективы 1.10 и 6.5; `find -perm -4000` (бит установлен вместе с другими) против `-perm 4000` (ровно) и `-perm -2000` (setgid) — верно.
- `fp_020` — file_permissions — актуален — объективы 1.10 и 6.5; `getcap` (libcap) против `getfacl`, `lsattr` и отсутствующей длинной опции `--list` — верно.

### shell_scripts (16)

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

### process_management (17)

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

### running_systems (16)

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

### users_groups (18)

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

### local_storage (13)

- `ls_001` — local_storage — актуален — объектив 5.2 «Create and remove physical volumes»; `pvcreate /dev/sdb1` — актуальный синтаксис LVM2 в RHEL 10, дистракторы (`pvremove`, `vgcreate` без имени VG, `blkid`) разобраны верно.
- `ls_002` — local_storage — актуален — объектив 6.4 «Extend existing logical volumes» (и 5.4); `lvextend -L +5G` + `xfs_growfs /app` верно для XFS, `resize2fs` к XFS неприменим, `xfs_growfs -n` только печатает геометрию.
- `ls_003` — local_storage — актуален — объектив 5.6 «Add new partitions and logical volumes, and swap to a system non-destructively»; `mkswap` есть в RHEL 10 (util-linux 2.40.2), порядок «mkswap → swapon» описан верно.
- `ls_004` — local_storage — актуален — объектив 5.5 «Configure systems to mount file systems at boot by universally unique ID (UUID) or label»; `blkid /dev/sdb1` печатает UUID/тип, трактовка `blkid -U` (поиск по UUID) верна.
- `ls_005` — local_storage — актуален — объектив 5.5 (диагностика действующего монтирования); `findmnt -T /data` актуален, различие с `findmnt -T /`, `stat -f` и `umount -l` разобрано верно.
- `ls_006` — local_storage — актуален — объектив 5.1 в редакции RHEL 10 — только GPT («List, create, and delete partitions on GPT disks»); сценарий GPT, MBR не упоминается, `echo label:gpt | sfdisk /dev/sdb` — верный неинтерактивный путь (util-linux 2.40.2).
- `ls_007` — local_storage — актуален — объективы 5.5/6.1; `lsblk -f` выводит FSTYPE/LABEL/UUID, отсутствие опции `--fstype` и усечённость `blkid -s LABEL` разобраны верно.
- `ls_008` — local_storage — актуален — объектив 5.5; `mount -a` применяет новые строки `/etc/fstab` (в т.ч. с `nofail`) без перезагрузки, разбор `-A`, `-fa`, `umount -a` верен.
- `lsl_009` — local_storage — актуален — объектив 5.6; `swapon /dev/sdb2` включает только указанный раздел, отличие от `swapon -a` (все области из fstab) и `swapoff -a` показано верно.
- `lsl_010` — local_storage — актуален — объективы 5.2–5.4 (восстановление метаданных LVM); `vgcfgrestore` и путь `/etc/lvm/backup` актуальны в RHEL 10, отличие от `vgscan`/`pvscan`/`vgimport` верно.
- `lsl_011` — local_storage — актуален — объектив 5.4 «Create and delete logical volumes»; `lvcreate -s -n lv_snap datavg/lv_data` — корректный синтаксис снимка LVM2, `lvconvert --merge` — обратная операция.
- `lsl_012` — local_storage — актуален — объектив 5.6 (swap-файл); `mkswap /swapfile` — верный шаг перед `swapon`; опция `mkswap -F/--file` появилась в util-linux ≥2.41, в RHEL 10 (util-linux 2.40.2) её нет, поэтому дистрактор невалиден, а правильный ответ сохраняется.
- `lsl_014` — local_storage — актуален — объективы 5.1/5.2 (переиспользование раздела); `wipefs -a` стирает все подписи, разбор `-b` (резервная копия подписи) и `-f` (разрешение) верен.

### file_systems (14)

- `fs_001` — file_systems — актуален — объектив 6.1 «Create, mount, unmount, and use VFAT, ext4, and XFS file systems»; `mkfs.xfs /dev/sdb1` верно, опции `--new` у mkfs.xfs нет.
- `fs_002` — file_systems — актуален — объектив 6.1 (схема fstab); шестое поле — порядок проверки fsck (0/1/2), пятое — dump; схема fstab в RHEL 10 не менялась.
- `fs_003` — file_systems — актуален — объектив 6.2 «Mount and unmount network file systems using NFS»; `mount -t nfs nfs1:/export /mnt/data` — верная форма «сервер:/каталог», тип `cifs` и опция `--nfs` отклонены верно.
- `fs_004` — file_systems — требует правок — объяснение прямо опирается на эру RHEL 9: «Типа smbfs в RHEL 9 нет» (`src/data/questions/file_systems.json`, строка 108) — нужно «в RHEL 10» либо версионно-нейтральная формулировка; дополнительно монтирование CIFS/SMB не входит в objectives RHEL 10 (там только NFS, 6.2), решение о сохранении вопроса как околоэкзаменационного — за капитаном. Команда `mount -t cifs … -o username=` в RHEL 10 работоспособна, правильный вариант не затронут.
- `fs_005` — file_systems — актуален — объектив 5.5 (метка ФС как альтернатива UUID); `tune2fs -L data /dev/sdb1` верно, значение ключей `-l`/`-m`/`-o` разобрано верно.
- `fs_006` — file_systems — актуален — объектив 6.1 (диагностика); `fsck.ext4 -f /dev/sdb1` (e2fsck) актуален, отсутствия опции `-Z` и подмены на `mkfs.ext4` показаны верно.
- `fs_007` — file_systems — актуален — объектив 6.1; `mount -o remount,rw /srv/app` меняет режим без размонтирования, разбор `remount,ro`, вызова без `remount` и несуществующей `--remount` верен.
- `fs_008` — file_systems — актуален — объектив 6.3 «Configure autofs» (пункт дословно не менялся в RHEL 10); карта в `/etc/auto.master` и поведение «монтирование по обращению / отключение после простоя» описаны верно, отличия от `noauto`-юнита, таймера и `nofail` показаны верно.
- `fs_009` — file_systems — актуален — объектив 6.1 (диагностика занятой точки монтирования); `fuser -m /mnt/data` (psmisc) показывает PID, отличия от `fuser -k` и `lsof -i` разобраны верно.
- `fs_010` — file_systems — актуален — объектив 6.1 с редакцией RHEL 10 «VFAT» (регистр — имя ФС, команда остаётся `mkfs.vfat`); `mkfs.vfat -F 32` создаёт FAT32, отсутствие опции `-t` и роль `-c` показаны верно.
- `fs_011` — file_systems — актуален — объектив 6.2; `showmount -e nfs1` (nfs-utils) запрашивает список экспортов, отличия от `-a`, `exportfs -a -v` и `rpcinfo -p` верны.
- `fs_012` — file_systems — актуален — объектив 6.1 (mount); `mount -o loop /root/rocky.iso /mnt/iso` верно, `-t loop` ошибочен (loop — опция монтирования, не тип ФС), `bind` и `losetup --detach` отклонены верно.
- `fs_013` — file_systems — актуален — объектив 6.1 (ext4); `tune2fs -c 20 -i 30d` и суффиксы `d`/`m`/`w`, а также различие `-C` (счётчик) и `-c` (порог) разобраны верно.
- `fs_014` — file_systems — актуален — объектив 6.1 (диагностика); `df -i` показывает иноды, отличия от `-h`, `-T` и `du -sh` верны.

### manage_software (16)

- `ms_001` — manage_software — актуален — объектив 2.2 «Install and remove RPM software packages»; `dnf install tree` подбирает зависимости из метаданных репозитория, отличия от `rpm -ivh` (локальный файл), `download` и `remove` верны.
- `ms_002` — manage_software — актуален — объектив 2.2; `dnf upgrade -y` (`--assumeyes`) — RHEL 10 остаётся на DNF 4.20, команда и ключ без изменений; `makecache`, `check-update`, `downgrade` разобраны верно.
- `ms_003` — manage_software — актуален — объектив 2.2; `dnf info zsh` берёт описание и версию из метаданных репозитория, отличие от `rpm -qi` (только установленные) и `dnf search`/`list --installed` верно.
- `ms_004` — manage_software — требует правок — модульные потоки устарели: в RHEL 10 модульность заменена post-modular подходом, AppStream-модули не поставляются, поэтому сценарий «в репозитории есть модуль postgresql с потоками 15/16/18» и `dnf module enable postgresql:16` не отражают реальность RHEL 10 (улика: Red Hat Developer, 2025-03-11 — «Previously in modularity, you needed to handle modular streams by using the `dnf module enable` and `dnf module reset` commands. However, the new post-modular concept does not require such operations», установка как `dnf install postgresql16`). Нужна переформулировка под versioned packages; сам ответ `dnf module enable` синтаксически существует, но проверяет выведенную из обращения механику.
- `ms_005` — manage_software — актуален — объектив 2.2 (диагностика); `rpm -qf /usr/bin/ldd` находит владельца файла, отличия от `rpm -qR`, `rpm -qi` и `dnf list installed` верны.
- `ms_006` — manage_software — актуален — объектив 2.1 «Configure access to RPM repositories»; `dnf config-manager --set-enabled epel` корректен именно для RHEL 10: дистрибутив использует DNF 4.20, а не DNF5, поэтому синтаксис config-manager (`--set-enabled`/`--set-disabled`) совпадает с RHEL 9 (в DNF5 эти опции удалены, но к RHEL 10 это не относится); путь `/etc/yum.repos.d/epel.repo` актуален.
- `ms_007` — manage_software — актуален — объектив 2.1; `gpgcheck=0` в секции `.repo` отключает проверку подписи пакетов только для репозитория, `repo_gpgcheck` отвечает за метаданные, `nogpgcheck` не является параметром секции — всё верно, путь `/etc/yum.repos.d/local.repo` актуален.
- `ms_008` — manage_software — актуален — объектив 2.2 (откат обновления); `dnf history undo last` — подкоманда `undo` существует в dnf4 4.20, разбор `--undo`, `history info`, `history redo` верен.
- `msw_009` — manage_software — актуален — объектив 2.2 (просмотр файлов до установки); `dnf repoquery -l` — верная команда из метаданных репозитория; на RHEL 10 filelists-метаданные не скачиваются по умолчанию, но запрашиваются по требованию, поэтому правильный ответ не затронут (см. «Итог группы»).
- `msw_010` — manage_software — актуален — объектив 2.2 (проверка целостности); `rpm -V bash` сравнивает файлы с базой rpm, отличие от `-qi`, `-qR` и `dnf info` верно.
- `msw_011` — manage_software — требует правок — RHEL-9-артефакт в условии и во всех вариантах: `htop-3.2.2-1.el9.x86_64.rpm` (тег `.el9`; для RHEL 10 — `.el10`), т.е. вопрос демонстрирует установку пакета предыдущей эры; дополнительно безусловное утверждение объяснения «`dnf install` … обращается к метаданным репозиториев, а они не подключены, поэтому команда завершится ошибкой» требует проверки/переформулировки (локальный rpm ставится и без репозиториев, если зависимости удовлетворены). Правильный ответ `rpm -ivh` не затронут.
- `msw_012` — manage_software — актуален — объектив 2.2; `dnf autoremove` удаляет осиротевшие зависимости, отличия от `remove`, `clean all` и `upgrade` верны.
- `msw_013` — manage_software — актуален — объектив 2.2; `dnf group install "Development Tools"` ставит группу, `group list`/`group info`/`repoquery` только показывают — верно.
- `msw_014` — manage_software — требует правок — тот же RHEL-9-артефакт в имени пакета: `myapp-2.1.0-1.el9.x86_64.rpm` (нужно `.el10`); сам ответ `rpm -qp --scripts` актуален для RHEL 10.
- `msw_015` — manage_software — актуален — объектив 2.3 «Configure access to Flatpak repositories» (добавлен spec 031); `flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo` верно, `.flatpakref` описывает приложение, а не репозиторий.
- `msw_016` — manage_software — актуален — объектив 2.4 «Install and remove Flatpak software packages» (добавлен spec 031); `flatpak install flathub org.gnome.Calculator` и системный каталог `/var/lib/flatpak` верны.

### networking (16)

- `net_001` — networking — требует правок — разбор ссылается на несуществующий вариант: «Вариант с командой `ip addr add` меняет адрес только до перезапуска…», но такого варианта в `options` нет, а дистрактор `nmcli connection modify eth0 … && nmcli connection show eth0` в разборе вообще не разобран; сам вопрос и правильный ответ (`nmcli connection modify … ipv4.method manual … && nmcli connection up eth0`) соответствуют объективу 8.1 «Configure IPv4 and IPv6 addresses» и NetworkManager RHEL 10 (профили keyfile, `ifcfg`-синтаксис не используется) — нужна правка только текста разбора.
- `net_002` — networking — требует правок — устаревшая платформенная метка в формулировке: «Какая команда на Rocky 9 изменит статическое имя хоста…» (эра RHEL 9); правильный ответ `hostnamectl set-hostname db1.example.com` (объектив 8.2 «Configure hostname resolution») в RHEL 10 не изменился, разбор дистракторов (`sysctl hostname set`, `--set-static`, `--transient`) верен.
- `net_003` — networking — требует правок — устаревшая платформенная метка «на Rocky 9» в вопросе и «на типовой Rocky 9»/«в Rocky 9» в разборе (эра RHEL 9); содержательно верно и для RHEL 10: адреса DNS-серверов — в `/etc/resolv.conf`, `/etc/nsswitch.conf` задаёт только порядок источников, `/etc/hosts.allow` относится к tcp_wrappers (в RHEL 10 пакета нет), `/etc/host.conf` — устаревший файл glibc; объектив 8.2.
- `net_005` — networking — актуален — `firewall-cmd --permanent --add-port=8080/tcp` — объектив 8.4 «Restrict network access using firewalld and firewall-cmd» и 10.1; разбор верно отвергает `--add-service=8080`, несуществующий `--set-default-port` и синтаксис rich-rule `open port`; замечание (правка не требуется): без `--zone` команда пишет в зону по умолчанию, а «активная зона» в формулировке не задана и в вариантах `--zone` нет.
- `net_006` — networking — актуален — `echo '192.168.1.10 db1' >> /etc/hosts` — объектив 8.2; в разборе верно указано, что `/etc/resolv.conf` хранит адреса серверов (а не пары «адрес — имя», и может перезаписываться NetworkManager), директива `nameserver` ожидает IP, а перестановка местами делает строку в `/etc/hosts` недопустимой.
- `net_007` — networking — актуален — маска `255.255.255.0` ↔ префикс `/24` (24 бита единиц), отвергнуты `/16`, `/25` и несуществующий `/33`; базовая адресация, объектив 8.1, от RHEL 9 к RHEL 10 не менялась.
- `net_008` — networking — актуален — `ip route show` как вывод таблицы маршрутизации с маршрутом по умолчанию (`default via …`); дистракторы `ip link show`, `ip rule list`, `ip addr show` различены верно; iproute2 — штатный набор RHEL 10.
- `net_011` — networking — актуален — `ss --tcp state established --numeric` — фильтр по состоянию сокета и числовой вывод адресов/портов; запуск команды на Rocky 9.8 — exit 0, в RHEL 10 используется тот же `ss` (iproute2); дистракторы `listening`/`time-wait`/`close-wait` разобраны верно; объектив 8.1/диагностика сети.
- `net_012` — networking — актуален — `nmcli device wifi list` — подкоманда NetworkManager/`nmcli` актуальна в RHEL 10; прямого пункта про Wi-Fi в current-объективах нет (вне объективов, но технически верно), дистракторы `connection show`/`device status`/`general status` разобраны верно.
- `net_010` — networking — актуален — `firewall-cmd --permanent --zone=internal --add-interface=ens18` — объектив 8.4; разбор верно фиксирует, что без `--permanent` изменение теряется при `--reload`/перезагрузке, что `--new-zone` только создаёт зону, а `--set-interface` не существует.
- `ntw_011` — networking — актуален — `ip neigh show` (таблица соседей: `lladdr`, `REACHABLE`/`STALE`) — проверено на Rocky 9.8 (exit 0); устаревший `arp`/net-tools в вопросе не используется, объектив 8.1/диагностика.
- `ntw_012` — networking — актуален — `dig MX example.com` — тип запроса задаётся отдельным аргументом, `-x` — обратный запрос (ожидает IP), `A`/`NS` — не почтовые записи; `dig` (bind-utils) есть в RHEL 10; прямого объектива нет (поддерживает 8.2 «Configure hostname resolution»).
- `ntw_013` — networking — актуален — `ip route get 10.20.30.40` (выбранный ядром маршрут, шлюз, интерфейс, src) — команда актуальна в RHEL 10; дистракторы `ip route show table main`, `ip link show`, `ip addr show` разобраны верно.
- `ntw_014` — networking — актуален — `firewall-cmd --permanent --zone=public --add-masquerade` (маскарадинг IPv4, `ip_forward` включается неявно); firewalld RHEL 10 сохраняет `--add-masquerade`, `--remove-masquerade` и `--add-forward-port` независимо от nftables-бэкенда; объективы 8.4/10.1.
- `ntw_015` — networking — актуален — `ip link set dev ens18 mtu 1400` — runtime-изменение MTU без правки файлов конфигурации (как и требует вопрос); проверен разбор `ip link show` (mtu не принимает) и отсутствующей подкоманды `ip addr set`; объектив 8.1.
- `ntw_016` — networking — актуален — `ping -c 3 8.8.8.8` завершает работу после трёх запросов; в разборе верно различены `-i` (интервал), `-t` (TTL в iputils) и `-W` (таймаут ответа); RHEL 10 — iputils.

### deploy_systems (13)

- `ds_001` — deploy_systems — актуален — `at -f /root/report.sh 20:00` — объектив 7.1 «Schedule tasks using at, cron and systemd timer units»; утверждение разбора, что у `at` нет ключа `--file`, подтверждается man GNU at (поддерживаются только короткие ключи, файл — `-f file`), дистракторы `batch -f` и `run-parts` истолкованы верно.
- `ds_002` — deploy_systems — актуален — `30 3 * * * /opt/check.sh` (поля минуты/часы/день/месяц/день недели); отвергнуты `0 3` (3:00), `*` в минутах и час `25` вне диапазона 0–23; объектив 7.1.
- `ds_003` — deploy_systems — актуален — отличие системного файла `/etc/cron.d/backup` от пользовательского crontab: дополнительное поле пользователя перед командой; отвергнуты «очередь» (понятие `at`), обязательный `;` и обязательный `@daily`; объектив 7.1.
- `ds_004` — deploy_systems — актуален — `OnCalendar=*-*-* 04:15:00` — ровно та часть объектива 7.1, которая добавлена в RHEL 10 («…and systemd timer units»); выражение проверено на Rocky 9.8: `systemd-analyze calendar '*-*-* 04:15:00'` → `Normalized form: *-*-* 04:15:00`, порядок «часы:минуты» подтверждён; отвергнуты `OnUnitActiveSec`, строка без `=` и перестановка `15:04:00`.
- `ds_005` — deploy_systems — актуален — `tuned-adm profile throughput-performance`; объектив 4.6 «Manage tuning profiles» присутствует в current-списке дословно; подкоманды `set-profile` у `tuned-adm` нет, `list`/`recommend` профиль не меняют — разбор верен.
- `ds_006` — deploy_systems — актуален — `systemctl edit myservice.service` создаёт drop-in в `myservice.service.d` без правки юнита из пакета; объектив 7.2; отвергнуты `enable`, `revert` и несуществующая `override`.
- `ds_007` — deploy_systems — актуален — `Storage=persistent` в `/etc/systemd/journald.conf` (журнал в `/var/log/journal` переживает выключение), `volatile` — только в памяти, `ForwardToSyslog` на хранение не влияет; объектив 4.8 «Preserve system journals».
- `ds_008` — deploy_systems — актуален — `semanage port -a -t http_port_t -p tcp 8080`; объектив 10.7 «Manage SELinux port labels». Проверено эмпирически на Rocky 9.8: 8080/tcp уже занят типом `http_cache_port_t` (`semanage port -l`), однако `semanage port -a -t http_port_t -p tcp 8080` не завершается ошибкой, а печатает «Port tcp/8080 already defined, modifying instead», exit 0, после чего порт виден и в `http_port_t` (изменение в стенде откатано через `semanage port -d`); разбор дистракторов (без `-t`, `semanage fcontext`, порт 80) верен.
- `ds_009` — deploy_systems — актуален — `systemctl enable nginx.service` (символические ссылки автозапуска) против `start`/`restart` и несуществующей `activate`; объектив 7.2.
- `ds_010` — deploy_systems — актуален — `systemctl mask legacy.service` (привязка к `/dev/null` блокирует и автозапуск, и ручной старт) против `disable`/`stop`; отсутствие подкоманды `hide` подтверждено на Rocky 9.8 («Unknown command verb hide»); объектив 7.2.
- `ds_011` — deploy_systems — актуален — `systemctl set-default graphical.target` обновляет ссылку `/etc/systemd/system/default.target`; `isolate` не сохраняет настройку, `get-default` только читает, `enable` цель по умолчанию не меняет; объектив 7.3 «Configure systems to boot into a specific target automatically».
- `ds_012` — deploy_systems — актуален — `journalctl -p err` задаёт нижний порог приоритета (err…emerg); запуск команды на Rocky 9.8 — exit 0; отвергнуты `-p info`, `-l` (полнота строк) и несуществующий `-P`; объектив 4.7.
- `ds_013` — deploy_systems — актуален — `systemd-analyze blame` (юниты по убыванию времени инициализации); прямого пункта в current-объективах нет (вне объективов, но команда есть в systemd RHEL 10 и работает), различия с `time`/`critical-chain`/`plot` изложены верно.

### security (20)

- `sec_001` — security — актуален — вывод `getenforce`: `enforcing`/`permissive`/`disabled`; числовые режимы — аргумент `setenforce`, `On`/`Off` — вывод `getsebool`; объектив 10.4 «Set enforcing and permissive modes for SELinux».
- `sec_002` — security — актуален — `chcon -t httpd_sys_content_t /var/www/html/index.html` (ключ `-t`/`--type`), отвергнуты `-l` (диапазон MLS), `-R` без типа и `--reference` (файл-образец); объектив 10.5 (контексты файлов); `chcon` в RHEL 10 не удалён (рекомендуемый путь для постоянной разметки — `semanage fcontext` + `restorecon`, что вопрос и не утверждает).
- `sec_003` — security — актуален — семантика `semanage fcontext -a`: правило попадает в локальную политику, уже размеченные файлы перемаркировываются только `restorecon`; отвергнуты описания `-d`, немедленной перемаркировки и `-l`; объектив 10.6 «Restore default file contexts».
- `sec_004` — security — актуален — `setsebool -P` (`--persistent`) закрепляет значение булева параметра в локальной политике; `-V` только подробность вывода, `-N` отключает перезагрузку политики, ключа `-b` нет; объектив 10.8 «Use Boolean settings…» (в RHEL 10 изменён только регистр `boolean` → `Boolean`, в русском тексте вопроса устаревшего написания нет).
- `sec_005` — security — актуален — зоны firewalld: `trusted` принимает всё без фильтрации, `public` разрешает только выбранные службы, `drop` отбрасывает молча, `block` отвечает icmp-отказом; определения зон идентичны объективу 10.1 и не менялись в RHEL 10 (замечание: варианты описывают зоны словами, а не именами — на корректность ответа не влияет).
- `sec_006` — security — актуален — `firewall-cmd --reload` делает постоянную конфигурацию действующей, поэтому изменения только runtime теряются; разбор отдельно оговаривает `FlushAllOnReload` и `--runtime-to-permanent`; объектив 10.1; устаревшего `firewall`/iptables нет (закрыто spec 031).
- `sec_007` — security — актуален — находка spec 031 (`firewall` → `firewalld`) закрыта: в тексте и вариантах используется только `firewall-cmd`/`--permanent`; семантика (изменение попадает в постоянную конфигурацию и действует лишь после `--reload`/перезапуска) верна для firewalld RHEL 10, повторно не открывается.
- `sec_008` — security — актуален — `alice ALL=(ALL) NOPASSWD: ALL` в `/etc/sudoers`; отвергнуты `PASSWD:`, `SETENV:` и `NOINTERCEPT:`; объектив 9.4 «Configure privileged access» (устаревшего термина «superuser» в вопросе нет).
- `sec_009` — security — актуален — `Cmnd_Alias` объединяет команды, `User_Alias` — пользователей, `Host_Alias` — хосты, `Runas_Alias` — пользователей запуска; замечание про краткую форму `Cmd_Alias` (sudo ≥ 1.9.0) корректно для sudo в RHEL 10 (1.9.15+); объектив 9.4.
- `sec_010` — security — актуален — `sudo visudo` (блокировка файла и проверка синтаксиса перед установкой); ключ `--check` существует и лишь проверяет синтаксис без редактора — проверено на Rocky 9.8 (`visudo --check` → `/etc/sudoers: parsed OK`, exit 0); объектив 9.4.
- `sec_011` — security — актуален — `chage -M 90 alice` задаёт максимальный срок действия пароля; отвергнуты `-m` (минимум), `-E` (дата блокировки), `-W` (предупреждение); объектив 9.2 «Change passwords and adjust password aging for local user accounts».
- `sec_012` — security — актуален — `minlen` в `/etc/security/pwquality.conf` (минимум 6, по умолчанию 8); отвергнуты `minclass`, `difok`, `maxrepeat`; объектив 9.2 (смежно: политика качества паролей; путь и параметры в RHEL 10 те же).
- `sec_013` — security — актуален — `PasswordAuthentication no` в `/etc/ssh/sshd_config` отключает вход по паролю, оставляя ключи; отвергнуты `off` (значение не принимается), `PermitRootLogin prohibit-password` (ограничение только для root) и `yes`; объектив 10.3 «Configure key-based authentication for SSH»; в RHEL 10 у openssh есть drop-in `/etc/ssh/sshd_config.d/*.conf`, но правка основного файла по-прежнему действует.
- `sec_014` — security — актуален — `ssh-keygen -t ed25519 -f ~/.ssh/id_app` создаёт новую пару ключей; отвергнуты несуществующая `--genkey`, `-l` (отпечаток существующего ключа) и `-p` (смена парольной фразы); объектив 10.3; ed25519 поддерживается в RHEL 10.
- `sec_015` — security — актуален — открытые ключи, которым разрешён вход, добавляют в `~/.ssh/authorized_keys`; отвергнуты собственный `.pub`-файл, `known_hosts` и `sshd_config`; объектив 10.3.
- `sec_016` — security — актуален — `gpg --export --armor` выводит открытые ключи в текстовом виде; отвергнуты `--export-secret-keys` (закрытые ключи), `--list-keys` и несуществующая `--export-key`; прямого пункта про GPG в current-объективах нет (вне объективов, но утилита есть в RHEL 10 и разбор верен).
- `sec_017` — security — актуален — `ausearch -x /usr/bin/sudo` отбирает события по исполняемому файлу, `-k` — по ключу правила, `-m` — по типу сообщения, `--command` не существует; удалённый из RHEL 10 объектив «Diagnose and address routine SELinux policy violations» здесь не затрагивается (событие — запуск `sudo`, а не AVC-отказ); auditd присутствует в RHEL 10 (вне объективов).
- `sec_018` — security — актуален — `sudo -l` выводит список разрешённых команд; `-v` обновляет метку времени, `-k` сбрасывает её, `-u` требует имени пользователя; объектив 9.4.
- `sec_019` — security — актуален — `passwd -l backup` блокирует пароль, сохраняя запись; `-d` удаляет пароль, `chage --list` только читает, опции `--block` у passwd нет — проверено на Rocky 9.8 (`passwd: bad argument --block: unknown option`); объективы 9.1/9.2.
- `sec_020` — security — актуален — `firewall-cmd --add-rich-rule='rule source address=203.0.113.10 accept'` (внутри rich rule — адрес источника и действие); отвергнуты `--add-port` с адресом, `--add-service=https` (разрешает всем) и несуществующий `--rich-rule`; объектив 10.1.

## Топ-5 проблемных тем

1. **manage_software (16 вопросов, 4 «требует правок»)** — самая проблемная тема. `ms_004` проверяет модульные потоки (`dnf module enable postgresql:16`), которые в RHEL 10 заменены post-modular подходом (versioned packages, `dnf install postgresql16`) — нужна переформулировка механики; `msw_011` и `msw_014` несут RHEL-9-артефакт `.el9` в именах rpm-файлов (для RHEL 10 — `.el10`). Тема входит в новую категорию №2 «Manage software», поэтому её важность для экзамена максимальна.
2. **networking (16 вопросов, 3 «требует правок»)** — `net_001` имеет дефектный разбор (ссылается на отсутствующий в вариантах `ip addr add` и не разбирает дистрактор `nmcli connection show`); `net_002` и `net_003` содержат устаревшую платформенную метку «Rocky 9». Дополнительно тема не покрывает IPv6 (объектив 8.1 дословно «Configure IPv4 and IPv6 addresses») и объектив 8.3.
3. **file_management (18 вопросов)** — `fm_008` (устаревший индекс `mlocate.db` → в RHEL 10 `plocate`/`/var/lib/plocate/plocate.db`) и `fm_011` — единственное в банке «требует ручного решения» (два технически верных варианта: `-cjf` и `-cf … --bzip2`; объяснение «без -f» опровергнуто проверкой на GNU tar 1.35).
4. **users_groups (18 вопросов, 2 «требует правок»)** — `ug_002` и `ug_007` опираются в объяснениях на эмпирику Rocky 9.8 (RHEL-9-эра; правильные ответы `-m` и `-r` не затронуты). Плюс пробел покрытия: 0 вопросов про sudo/wheel при объективе 9.4 «Configure privileged access» (закрыт только темой security).
5. **file_systems (14 вопросов, 1 «требует правок»)** — `fs_004` несёт двойную проблему: объяснение опирается на «в RHEL 9 нет» и монтирование CIFS/SMB вне objectives RHEL 10 (6.2 — только NFS); решение о сохранении вопроса как околоэкзаменационного — за капитаном.

Вне топ-5 (пробелы покрытия, на вердикты не влияют): deploy_systems — 0 вопросов по 7.6 «Modify the system bootloader» (grub/bootloader не встречается нигде в банке); running_systems — нет 4.3 «Interrupt the boot process» (rd.break/init=/bin/bash) и 4.8 закрыт только `--vacuum-size` без `Storage=persistent`; process_management — 0 упоминаний tuned (4.6); essential_tools/text_files — нет вопросов на редакторы (1.7) и 1.5 multi-user targets.

## Дефекты аудита (findings)

Блокирующих расхождений не выявлено.

- Полнота: 225/225; пропуски/дубли/лишние = 0 (node-скрипт, сверка с банком).
- Формат: 0 нарушений — каждая строка `id — тема — verdict — причина`, verdict из набора {актуален, требует правок, устарел, требует ручного решения}, причина непустая и конкретная.
- Adversarial-выборка: независимо прочитано 18 вопросов (все 10 «требует правок», 1 «требует ручного решения», 7 «актуален»); каждый вердикт защитим содержимым src/data/questions/*.json, расхождений нет.
- `устарел` = 0 — требование о привязке «устарел» к конкретному удалённому objective RHEL 10 не задействовано (выполнено вакуумно).

Системные наблюдения (не дефекты аудита; вход для spec 037): префикс id в networking.json неоднороден (`net_*` и `ntw_*`) — аудит корректно использовал фактические id; `objective_domain` по всем темам — legacy-нумерация 1–9 эры RHEL 9 (кодом не читается, валидируется только tools/qc.cjs как /^[1-9]$/); `_meta.verified_rhel: "9.8"` у значительной части вопросов (исключение — sec_007 = "10").

## Итог

`verdict: pass` — сводный список полный (225/225), формат соблюдён, выборочная проверка расхождений не выявила.
