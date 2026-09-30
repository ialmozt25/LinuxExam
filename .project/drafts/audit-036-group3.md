# Аудит 036 — группа 3

> Источник: .project/specs/030-objectives-full.md (RHEL 10) · дата прогона 2026-09-30 · охват 43 вопросов
> Темы: local_storage (13), file_systems (14), manage_software (16).
> Метод: прочитан каждый элемент массива (id, topic, difficulty, objective_domain, subtopic, question, options, explanation, `_meta`), содержимое сверено с objectives RHCSA EX200 RHEL 10; факты RHEL 10 перепроверены по внешним источникам (см. «Итог группы»).
> Закрытые spec 031 находки не переоткрывались (`fp_002`, `sec_007`; `msw_015`/`msw_016` — Flatpak уже добавлены).

## local_storage (13)

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

## file_systems (14)

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

## manage_software (16)

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

## Итог группы

- актуален: 39 · требует правок: 4 · устарел: 0 · требует ручного решения: 0
- `требует правок`: `fs_004` (эра RHEL 9 в объяснении + CIFS/SMB вне objectives RHEL 10), `ms_004` (модульные потоки устарели: RHEL 10 — post-modular), `msw_011` и `msw_014` (тег `.el9` в именах rpm-файлов). Во всех четырёх случаях правильный вариант ответа не затронут — правки формулировок/атрибутики.
- Ни одного вопроса, опирающегося на удалённые objectives RHEL 10: MBR-разделы, set-GID, контейнеры/Podman, RHN, yum как основной менеджер, `chkconfig`, `iptables` — 0 вхождений по трём файлам (grep, case-insensitive).
- Ложные риски проверены и отклонены: `ms_006` — DNF5-сценарий не применим, RHEL 10 остаётся на DNF 4.20 (пакет `dnf-4.20.0-14.el10_0`) и сохраняет `config-manager --set-enabled`; `lsl_012` — опция `mkswap -F/--file` появилась в util-linux ≥2.41, в RHEL 10 (util-linux 2.40.2) её нет, поэтому дистрактор невалиден, верный ответ `mkswap /swapfile` сохраняется; `msw_009` — filelists не скачиваются по умолчанию (Fedora change `DNFConditionalFilelists`), но загружаются по требованию запроса.
- Метаданные (не содержание вопросов): `objective_domain` — служебное поле, отсутствует в модели `src/data/models/Question.ts` (строки 9–25) и приложением не читается; валидируется только `tools/qc.cjs` (строка 110) как одна цифра 1–9. В группе проставлена нумерация эры RHEL 9 (`local_storage`=4, `file_systems`=5, `manage_software`=6) и не совпадает с порядком категорий RHEL 10 (5 / 6 / 2, где 2 — новая категория `Manage software`). На вердикты не влияет — решение о ремапе за капитаном (spec 037). У `fs_009`–`fs_014` в `_meta` стоит `verified_rhel: "9.8"` — содержание версионно-нейтрально (man-справки), но поле стоит обновить при правках.
- Пробелы покрытия objectives (относятся к темам, не к отдельным id): `local_storage` — нет вопросов на `vgcreate`/`vgremove`/`pvremove`/`lvremove`, поэтому объективы 5.2–5.4 закрыты частично (`pvcreate`, `lvextend`, `lvcreate -s`); `file_systems` — объектив 6.5 «Diagnose and correct file permission problems» в этой теме не представлен (закрыт темой `file_permissions`, группа 1); `manage_software` — покрытие 2.1–2.4 полное (RPM-репозитории: `ms_006`/`ms_007`; установка и удаление RPM: `ms_001`, `msw_011`–`msw_013`; Flatpak: `msw_015`, `msw_016`).
- Источники проверки фактов RHEL 10 (внешние, на дату 2026-09-30): https://runentlinux.com/en/reference/el10-changes/ и https://runentlinux.com/en/package-management/repositories/ (EL 10 = DNF 4.20, синтаксис config-manager как в EL 9, filelists не скачиваются по умолчанию); https://developers.redhat.com/articles/2025/03/11/discover-packaging-parallel-database-streams-rhel-10 (RHEL 10 — post-modular вместо `dnf module enable`); https://fedoraproject.org/wiki/Changes/DNFConditionalFilelists (условная загрузка filelists); https://manpages.debian.org/trixie/util-linux/mkswap.8.en.html (появление `-F/--file` в util-linux 2.41); сведения о пакетах `dnf-4.20.0-14.el10_0` и `util-linux-2.40.2-13.el10` — из зеркал репозиториев EL 10.

## Непокрытые id

(пусто)
