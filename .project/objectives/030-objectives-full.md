# RHCSA EX200 — текущие objectives (RHEL 10)

Полный дословный список целей экзамена RHCSA EX200 (current, эра RHEL 10).
Документ подготовлен в рамках spec 036 (семантический аудит банка); правки банка
не выполняются — файл фиксирует только источник для сравнения.

## Источник

- URL: `https://www.redhat.com/en/services/training/ex200-red-hat-certified-system-administrator-rhcsa-exam`
- Дата снятия снимка: 2026-09-29
- HTTP-код: 200
- Локальная копия: `%TEMP%/rhcsa-current.html` (340 777 байт)
- Метод извлечения: линейный сканер `<li aria-level>` с учётом вложенности
- Контроль разметки: `<li aria-level>` = 72 = 10 категорий (`aria-level="1"`) + 62 objective-пункта (`aria-level="2"`)
- Контроль терминов: категория `Manage software` присутствует; `Manage containers` отсутствует

## 1. Understand and use essential tools

1. Access a shell prompt and issue commands with correct syntax
2. Use input-output redirection (>, >>, |, 2>, etc.)
3. Use grep and regular expressions to analyze text
4. Access remote systems using SSH
5. Log in and switch users in multi-user targets
6. Archive, compress, unpack, and uncompress files using tar, gzip, and bzip2
7. Create and edit text files
8. Create, delete, copy, and move files and directories
9. Create hard and soft links
10. List, set, and change standard ugo/rwx permissions
11. Locate, read, and use system documentation including man, info, and files in /usr/share/doc

## 2. Manage software

1. Configure access to RPM repositories
2. Install and remove RPM software packages
3. Configure access to Flatpak repositories
4. Install and remove Flatpak software packages

## 3. Create simple shell scripts

1. Conditionally execute code (use of: if, test, [], etc.)
2. Use Looping constructs (for, etc.) to process file, command line input
3. Process script inputs ($1, $2, etc.)
4. Processing output of shell commands within a script

## 4. Operate running systems

1. Boot, reboot, and shut down a system normally
2. Boot systems into different targets manually
3. Interrupt the boot process in order to gain access to a system
4. Identify CPU/memory intensive processes and kill processes
5. Adjust process scheduling
6. Manage tuning profiles
7. Locate and interpret system log files and journals
8. Preserve system journals
9. Start, stop, and check the status of network services
10. Securely transfer files between systems

## 5. Configure local storage

1. List, create, and delete partitions on GPT disks
2. Create and remove physical volumes
3. Assign physical volumes to volume groups
4. Create and delete logical volumes
5. Configure systems to mount file systems at boot by universally unique ID (UUID) or label
6. Add new partitions and logical volumes, and swap to a system non-destructively

## 6. Create and configure file systems

1. Create, mount, unmount, and use VFAT, ext4, and XFS file systems
2. Mount and unmount network file systems using NFS
3. Configure autofs
4. Extend existing logical volumes
5. Diagnose and correct file permission problems

## 7. Deploy, configure, and maintain systems

1. Schedule tasks using at, cron and systemd timer units
2. Start and stop services and configure services to start automatically at boot
3. Configure systems to boot into a specific target automatically
4. Configure time service clients
5. Install and update software packages from Red Hat Content Delivery Network, a remote repository, or from the local file system
6. Modify the system bootloader

## 8. Manage basic networking

1. Configure IPv4 and IPv6 addresses
2. Configure hostname resolution
3. Configure network services to start automatically at boot
4. Restrict network access using firewalld and firewall-cmd

## 9. Manage users and groups

1. Create, delete, and modify local user accounts
2. Change passwords and adjust password aging for local user accounts
3. Create, delete, and modify local groups and group memberships
4. Configure privileged access

## 10. Manage security

1. Configure firewall settings using firewall-cmd/firewalld
2. Manage default file permissions
3. Configure key-based authentication for SSH
4. Set enforcing and permissive modes for SELinux
5. List and identify SELinux file and process context
6. Restore default file contexts
7. Manage SELinux port labels
8. Use Boolean settings to modify system SELinux settings

## Контроль полноты

| # | Категория | Пунктов |
|---|---|---|
| 1 | Understand and use essential tools | 11 |
| 2 | Manage software | 4 |
| 3 | Create simple shell scripts | 4 |
| 4 | Operate running systems | 10 |
| 5 | Configure local storage | 6 |
| 6 | Create and configure file systems | 5 |
| 7 | Deploy, configure, and maintain systems | 6 |
| 8 | Manage basic networking | 4 |
| 9 | Manage users and groups | 4 |
| 10 | Manage security | 8 |
| — | **Итого** | **62** |

Распределение: 11 / 4 / 4 / 10 / 6 / 5 / 6 / 4 / 4 / 8 = 62 пункта в 10 категориях.
