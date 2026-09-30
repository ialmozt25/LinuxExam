# Аудит 036 — группа 1

> Источник: .project/specs/030-objectives-full.md (RHEL 10, 10 категорий / 62 пункта) · дата прогона 2026-09-30 · охват 66 вопросов
> Темы: essential_tools (13), text_files (16), file_management (18), file_permissions (19).
> Метод: прочитан каждый элемент массива (`id`, `topic`, `difficulty`, `objective_domain`, `subtopic`, `question`, `options`, `explanation`, `_meta`) в `src/data/questions/<topic>.json` (только чтение), содержание сверено с objectives RHCSA EX200 RHEL 10; спорные факты перепроверены исполнением — GNU tar 1.35, GNU chmod (coreutils 9.x), xargs, а также по данным пакетов EL 10 (`plocate-1.1.22-10.el10`, `rsync-3.4.1-2.el10`).
> Закрытые spec 031 находки (`fp_002` удалён, `sec_007` переписан) не переоткрывались.

## essential_tools (13)

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

## text_files (16)

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

## file_management (18)

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

## file_permissions (19)

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

## Итог группы

- актуален: 64 · требует правок: 1 · устарел: 0 · требует ручного решения: 1
- `требует правок`: `fm_008` — устаревшее имя БД/пакета `mlocate` в объяснении (RHEL 10 — `plocate`, `/var/lib/plocate/plocate.db`); правильный ответ `updatedb` не затронут.
- `требует ручного решения`: `fm_011` — два одновременно верных варианта (`-cjf` и `-cf … --bzip2`), объяснение опровергнуто проверкой на GNU tar 1.35; нужно решить, править дистрактор или объяснение.
- Устаревших терминов, команд и путей нет: case-insensitive поиск по четырём файлам даёт 0 вхождений `chkconfig`, `service <name>` (sysvinit), `/etc/init.d`, `runlevel`/`inittab`, `yum` как основной менеджер, `ifconfig`/`route` из net-tools, `ifcfg-*`/network-scripts, `iptables` как основной, MBR-разделов, контейнеров/Podman и set-GID-каталогов. Тема-специфичные риски RHEL 9 → RHEL 10 для этой группы отсутствуют.
- Ложные риски проверены и отклонены: `fp_005` — форма `chmod u=+x` синтаксически допустима (GNU-грамматика `[ugoa…][[-+=][perms…]…]`), из 644 даёт 144, поэтому объяснение верно, а дистрактор объективно не решает задачу; `et_013` — `tar -czf backup.tar.gz` без членов архива завершается ошибкой «Cowardly refusing to create an empty archive», ответ-дистрактор всё равно неверен (неточность формулировки объяснения — стилистическая); `fp_013` — без `-n` setfacl пересчитывает ACL-маску, поэтому отображаемые в `ls -l` права группы могут измениться, но intended-ответ остаётся единственным верным и вопрос не ломается.
- Метаданные (не содержание вопросов, на вердикты не влияют): `objective_domain` записан в служебной шкале 1–9 эры RHEL 9 (docs/STATE-SNAPSHOT-2026-09-24.md: домен 2 = «Create simple shell scripts»), а RHEL 10 добавил категорию №2 `Manage software`, сдвинув нумерацию последующих категорий (security в 030-objectives-full.md — №10). Внутри группы поле к тому же не согласовано с содержанием: `fm_004`, `fm_011` = «4» (legacy — local storage) при содержании объектива 1.6; `fm_006`, `fm_007`, `fm_010`, `fm_012` = «5» (legacy — file systems) при содержании 1.8/1.9; `fp_004`, `fp_016` = «8» (legacy — users and groups) для работ с владельцем; 17 вопросов `fp_*` = «9» (legacy — security) для ugo/rwx и umask. Поле не читается кодом приложения (0 совпадений в `src/**/*.ts`) и валидируется гейтом `tools/qc.cjs:110` регуляркой `/^[1-9]$/`, поэтому ремап на 10 категорий RHEL 10 — отдельное решение (spec 037 + правка гейта), а не контентная правка этой группы. Дополнительно `_meta.verified_rhel: "9.8"` стоит у `et_001`–`et_013` и `fm_013`–`fm_018`; для сравнения, spec 031 выставила `verified_rhel: "10"` у переписанного `sec_007`. Содержание этих вопросов версионно-нейтрально (coreutils/grep/tar/find), но поле — кандидат на централизованный рефреш.
- Пробелы покрытия objectives (относятся к темам, не к отдельным id): ни в одной из четырёх тем нет вопросов на объектив 1.7 «Create and edit text files» в части редакторов (vi/vim/nano) — тема `text_files` целиком про фильтры (sed/awk/cut/tr); нет вопросов на 1.5 «Log in and switch users in multi-user targets» и 1.1 «Access a shell prompt»; объектив 1.11 закрыт только `man -k` (`et_009`), без `info` и файлов `/usr/share/doc`. Объектив 1.10 покрыт плотно (13 вопросов `fp_*`), 6.5 «Diagnose and correct file permission problems» — частично (`fp_007`, `fp_018`, `fp_019`, `fp_020`); SELinux-контексты (10.5–10.8) в `file_permissions` не представлены и относятся к теме `security` (группа 4).
- Источники проверки фактов RHEL 10 (внешние, на дату 2026-09-30): https://linuxcommandlibrary.com/man/plocate (plocate — замена mlocate, БД `/var/lib/plocate/plocate.db`); пакеты EL 10 baseos `plocate-1.1.22-10.el10` и `rsync-3.4.1-2.el10` (листинги репозиториев Oracle Linux 10: https://repowatch.ulni.us-ashburn-1.oci.oraclecloud.com/repowatch/oraclelinux10.aarch64/ol10_baseos_latest/4a56f8be744922df18e3805c0b9cd42f7b4a973c и https://repowatch.ulni.us-ashburn-1.oci.oraclecloud.com/repowatch/oraclelinux10.aarch64/ol10_u0_baseos_base/33545bb3a766438e3306339b78a1a67b8b3c7e06); документация RHEL 10 «Risk reduction and recovery operations» (упоминание `/var/log/messages`): https://docs.redhat.com/ko/documentation/red_hat_enterprise_linux/10/html/risk_reduction_and_recovery_operations/configuring-a-remote-logging-solution. Локальные проверки: GNU tar 1.35 (`tar -cf ARCH --gzip …` → «gzip compressed data»), GNU chmod coreutils 9.x (`644` + `u=+x` → `144`), GNU xargs (`-n 0` → «value 0 for -n option should be >= 1»).

## Непокрытые id

(пусто — вердикты даны для всех 66 id: 13 + 16 + 18 + 19)
