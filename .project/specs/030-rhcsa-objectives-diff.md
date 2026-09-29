---
id: 030
slug: rhcsa-objectives-diff
type: content
status: draft
commit: null
---

# Спека 030 — RHCSA objectives diff (RHEL 9 → RHEL 10)

Источник фактов: официальная страница экзамена EX200 (current) и её снимок
Wayback Machine (historical), оба извлечены дословно 29.09.2026. Этот документ
код не меняет.

## Цель

Выявить расхождения между банком (224 вопроса) и текущими objectives RHCSA
EX200 (RHEL 10 era); сформировать план обновления. Продуктовый риск: экзамен
обновлён под RHEL 10, банк может содержать устаревшее.

## Источники

- **Current (RHEL 10 era):**
  `https://www.redhat.com/en/services/training/ex200-red-hat-certified-system-administrator-rhcsa-exam`
  — fetch `2026-09-29`, HTTP 200, 340 674 байта raw HTML, 10 категорий / 62 objectives.
  Локальная копия: `%TEMP%\rhcsa-current.html`.
- **Historical (RHEL 9 era):**
  `http://web.archive.org/web/20240601045351/https://www.redhat.com/en/services/training/ex200-red-hat-certified-system-administrator-rhcsa-exam`
  — snapshot `20240601045351` (2024-06-01 04:53:51 UTC), HTTP 200, 168 785 байт,
  10 категорий / 68 objectives. Локальная копия: `%TEMP%\rhcsa-2024.html`.
- Разметка eras различается: current — вложенные `<ul>` с `aria-level`; snapshot —
  `<dt>Категория</dt><dd><ul><li>`. Извлечение — линейный сканер с учётом глубины;
  контроль: число `<li aria-level>` в current = 72 = категории (10) + objectives (62).

## Что делаем

1. Diff objectives (current vs historical) — таблица ниже, verdict по каждому пункту.
2. Сопоставить банк ↔ current objectives (14 тем `_topics.json` ↔ 10 категорий).
3. Список: устаревшие вопросы (id), недостающие темы.
4. План правок с приоритетами.

Анализ — только чтение. Правки банка в этой спеке не выполняются.

## Diff objectives

Verdict: `added` — только в current; `removed` — только в historical;
`renamed` — тот же смысл, изменённая формулировка; `unchanged` — совпадает дословно.

### Категории

| # | Historical (RHEL 9, snapshot 2024-06-01) | Current (RHEL 10) | objectives | verdict |
|---|---|---|---|---|
| 1 | Understand and use essential tools | Understand and use essential tools | 11 → 11 | unchanged |
| 2 | — | Manage software | 0 → 4 | **added** |
| 3 | Create simple shell scripts | Create simple shell scripts | 4 → 4 | unchanged |
| 4 | Operate running systems | Operate running systems | 10 → 10 | unchanged (1 renamed) |
| 5 | Configure local storage | Configure local storage | 6 → 6 | unchanged (2 renamed) |
| 6 | Create and configure file systems | Create and configure file systems | 6 → 5 | unchanged (1 removed, 2 renamed) |
| 7 | Deploy, configure, and maintain systems | Deploy, configure, and maintain systems | 6 → 6 | unchanged (2 renamed) |
| 8 | Manage basic networking | Manage basic networking | 4 → 4 | unchanged (1 renamed) |
| 9 | Manage users and groups | Manage users and groups | 4 → 4 | unchanged (1 renamed) |
| 10 | Manage security | Manage security | 9 → 8 | unchanged (1 removed) |
| 11 | **Manage containers** | — | 8 → 0 | **removed** |

Итого: 68 → 62 objectives, категорий 10 → 10 (−1, +1).

### Пункты, изменившиеся между версиями

| пункт | RHEL 9 (historical) | RHEL 10 (current) | verdict |
|---|---|---|---|
| Flatpak | отсутствует (в snapshot слово «Flatpak» не встречается ни разу) | `Configure access to Flatpak repositories`; `Install and remove Flatpak software packages` | **added** (2 пункта, новая категория «Manage software») |
| Управление ПО | категории нет; RPM-пункты в других категориях | `Manage software` целиком: RPM-репозитории, установка/удаление RPM, Flatpak-репозитории, установка/удаление Flatpak | **added** (категория) |
| Контейнеры | категория `Manage containers`, 8 пунктов (registry, inspect, podman/skopeo, Containerfile, run/start/stop/list, сервис в контейнере, автозапуск через systemd, persistent storage) | категории нет; строка `Manage containers` в current HTML отсутствует (контрольная проверка: 0 совпадений) | **removed** (8 пунктов) |
| SELinux-нарушения | `Diagnose and address routine SELinux policy violations` | отсутствует | **removed** |
| set-GID | `Create and configure set-GID directories for collaboration` | отсутствует | **removed** |
| Разделы дисков | `List, create, delete partitions on MBR and GPT disks` | `List, create, and delete partitions on GPT disks` | **renamed** (MBR убран) |
| Планировщики | `Schedule tasks using at and cron` | `Schedule tasks using at, cron and systemd timer units` | **renamed** (добавлены timer units) |
| Репозиторий ПО | `Install and update software packages from Red Hat Network, a remote repository, or from the local file system` | `… from Red Hat Content Delivery Network, …` | **renamed** (RHN → CDN) |
| Firewalld | `Restrict network access using firewall-cmd/firewall` | `Restrict network access using firewalld and firewall-cmd` | **renamed** |
| Привилегии | `Configure superuser access` | `Configure privileged access` | **renamed** |
| SELinux boolean | `Use boolean settings to modify system SELinux settings` | `Use Boolean settings to modify system SELinux settings` | **renamed** (регистр) |
| ФС: регистр | `Create, mount, unmount, and use vfat, ext4, and xfs file systems` | `… and use VFAT, ext4, and XFS file systems` | **renamed** (регистр) |
| Журналы мультиюзера | `Log in and switch users in multiuser targets` | `Log in and switch users in multi-user targets` | **renamed** (дефис) |

Не изменилось (примеры дословных совпадений): `Access a shell prompt and issue commands with correct syntax`,
`Manage tuning profiles`, `Preserve system journals`, `Configure autofs`, `Modify the system bootloader`,
`Configure IPv4 and IPv6 addresses`, `Configure key-based authentication for SSH`.

## Соответствие банка

Источник чисел: `src/data/questions/_topics.json` (total 224) + `wc` по 14 файлам тем.
Статус: `актуальна` — покрытие полное, правок не требуется; `требует правок` — есть
устаревшие формулировки/пробелы; `устарела` — тема опирается на удалённые objectives.

| тема банка | вопросов | категории current objectives | RHEL 10 статус |
|---|---|---|---|
| `essential_tools` | 13 | Understand and use essential tools (11) | актуальна |
| `text_files` | 16 | Understand and use essential tools (grep/regex, man/info, /usr/share/doc) | актуальна |
| `file_management` | 18 | Understand and use essential tools (create/delete/copy/move, hard/soft links) | актуальна |
| `file_permissions` | 20 | essential tools (ugo/rwx) + Manage security (default permissions, context, port labels) | актуальна |
| `users_groups` | 18 | Manage users and groups (4) | требует правок (`Configure privileged access`; проверить формулировки про superuser) |
| `shell_scripts` | 16 | Create simple shell scripts (4) | актуальна |
| `process_management` | 17 | Operate running systems (10) | актуальна (tuning profiles — проверить покрытие) |
| `running_systems` | 16 | Operate running systems (10) | актуальна |
| `local_storage` | 13 | Configure local storage (6, GPT-only) | требует правок (проверить вопросы про MBR) |
| `file_systems` | 14 | Create and configure file systems (5) + Configure local storage (mount at boot) | требует правок (set-GID удалён; регистр VFAT/XFS) |
| `manage_software` | 14 | Manage software (4, включая Flatpak) | требует правок (Flatpak — вероятный пробел) |
| `networking` | 16 | Manage basic networking (4) | требует правок (firewalld-формулировки) |
| `deploy_systems` | 13 | Deploy, configure, and maintain systems (6) | требует правок (RHN → CDN; at+cron → timer units) |
| `security` | 20 | Manage security (8) | требует правок (SELinux-нарушения удалены; Boolean-регистр) |

Покрытие: все 10 категорий current objectives отображаются на 14 тем банка;
отдельной темы, которой не соответствует ни одна категория, нет. Обратная сторона:
категория `Manage containers` (8 пунктов) удалена, но в банке нет ни одной
контейнерной темы — проверка «остались ли контейнерные вопросы» входит в план ниже.

## Критерии приёмки

1. Diff задокументирован (со ссылками на 2 URL + timestamp текущего fetch и
   timestamp snapshot).
2. Для каждой темы банка (14) — verdict (`актуальна` / `требует правок` / `устарела`).
3. Список конкретных вопросов (id), требующих изменения.
4. План правок с приоритетами.

## Что НЕ трогать

- `src/data/**` — только анализ, правки банка отдельным approve.
- Спеки 028/029.
- `tools/**` — гейты `qc` / `cosine` / `shuffle-bank` не меняются.
