# Recon-чертёж — spec 043, batch 6, тема `deploy_systems` (12 вопросов)

> **Артефакт разведки.** Создан по прямому заданию капитана 2026-10-02 (вариант 1:
> «recon сам»). Вход: read-only чтение `_topics.json`, `deploy_systems.json`,
> `running_systems.json`, `process_management.json`, `security.json`, `topics.ts`,
> `tools/gen-state.mjs`, спеки 005/015/018/020, `.project/DOD.md`, `ORCH-RULES.md`.
> Ни одного файла репозитория этот шаг не менял.
>
> **Статус файла при создании:** отсутствовал (проверено `.project/drafts/recon-043*`
> → пусто). Перезапись существующего артефакта не выполнялась, WARN не требуется.

Дата: 2026-10-02 · HEAD на момент recon: `27ae10c` · Банк: **229**

---

## 1. Состояние банка и приоритет темы

`src/data/questions/_topics.json` (`total: 229`), цель — `per_topic_target: 22` × 14 тем:

| Тема | Есть | Разрыв до 22 | Комментарий |
|---|---|---|---|
| `deploy_systems` | **13** | **9** | тема батча 6 |
| `essential_tools` | 13 | 9 | |
| `local_storage` | 13 | 9 | |
| `file_systems` | 14 | 8 | |
| `manage_software` | 16 | 6 | |
| `running_systems` | 16 | 6 | |
| `shell_scripts` | 16 | 6 | |
| `text_files` | 16 | 6 | |
| `process_management` | 17 | 5 | |
| `file_management` | 18 | 4 | |
| `networking` | 18 | 4 | |
| `file_permissions` | 19 | 3 | |
| `security` | 20 | 2 | |
| `users_groups` | 20 | 2 | |

`deploy_systems` — одна из трёх тем с максимальным разрывом (9), при этом по
каноническому порядку `src/data/topics.ts` идёт первой из них. Тема подтверждена.

**Канон темы (проверено `src/data/topics.ts`):** ключ `deploy_systems`, человеческое
название «Развёртывание систем». `state.json.goal`: `current_questions: 229`,
`target_questions: 300`, `per_topic_target: 22`.

## 2. Занятые механизмы `ds_001..ds_013` (исключаются целиком)

Все 13 существующих вопросов имеют `objective_domain: "6"`; выбранный диапазон
новых id — `ds_014..ds_025` (свободен, коллизий нет).

| id | difficulty | subtopic (механизм) |
|---|---|---|
| ds_001 | easy | `at`: однократное задание по времени |
| ds_002 | easy | `crontab`: строка расписания |
| ds_003 | medium | `cron.d`: системное задание и поле пользователя |
| ds_004 | medium | systemd timer: `OnCalendar` |
| ds_005 | medium | `tuned-adm`: переключение профиля |
| ds_006 | medium | systemd drop-in: правка юнита без его файла |
| ds_007 | medium | `journald`: постоянное хранение журнала |
| ds_008 | medium | SELinux: контекст порта для нового сервиса |
| ds_009 | easy | `systemctl`: автозапуск сервиса (`enable`) |
| ds_010 | medium | `systemctl`: маскирование юнита (`mask`) |
| ds_011 | easy | `systemctl`: цель загрузки по умолчанию |
| ds_012 | medium | `journalctl`: фильтр по приоритету |
| ds_013 | medium | `systemd-analyze`: время инициализации юнитов (`blame`) |

## 3. Кросс-тема `rs_*` (исключить как кросс-тему, задание капитана)

16 вопросов `running_systems`, **14 из 16 — тоже `objective_domain: "6"`**,
то есть это прямой конкурент за те же формулировки. Опасные совпадения:

| Занятый механизм | Где занят | Вывод для batch 6 |
|---|---|---|
| `systemctl get-default` / `set-default` | `rs_001` **и** `ds_011` | исключить |
| unit-файлы: `[Unit]`/`[Service]`/`[Install]` | `rs_002` | исключить |
| `systemctl is-active` / `is-enabled` / `status` | `rs_003`, `rs_010` | исключить |
| `journalctl -u` / `-b` / `-p` / `--since` | `rs_004`, `rs_005`, `ds_012`, `pm_005` | исключить |
| `systemctl daemon-reload` | `rs_006`, `rs_007` | исключить |
| `systemctl mask` / `--now` | `rs_006`, `ds_010` | исключить |
| `systemctl show -p` | `rs_011` | исключить |
| `systemctl reset-failed` | `rs_012` | исключить |
| `journalctl --vacuum-size` | `rs_013` | исключить |
| `systemctl cat` | `rs_014` | исключить |
| `systemctl enable --now` | `rs_015` **и** `ds_009` | исключить |
| `systemctl poweroff` | `rs_016` | исключить |
| `systemctl enable` / `start` / `stop` / `mask` / `status` | `pm_003`, `pm_010` | исключить |
| `systemd-analyze` | `pm_014` **и** `ds_013` | исключить |
| `systemctl --user` | `pm_015` | исключить |

Дополнительно исключаются занятые в других темах: SELinux-режимы/контексты/булевы
(`sec_001..sec_004`, `ds_008`), firewalld (`sec_005..sec_007`, `sec_020`),
`chage`/`pwquality` (`sec_011`, `sec_012`), `fstab` (`fs_002`).

## 4. Программа батча: 12 кандидатов `ds_014..ds_025`

Механизмы выбраны из RHCSA EX200, objective domain 6 («Deploy, configure and
maintain systems»), с проверкой против таблиц §2 и §3. Приведён **механизм**, а не
готовый текст вопроса: формулировки пишутся writer'ом и показываются капитану
полностью в превью на STOP-точке D.

| id (план) | Механизм | objective_domain | Почему не дубль |
|---|---|---|---|
| ds_014 | systemd-таймер: активация `OnBootSec` + `systemctl enable --now` | "6" | `OnCalendar` занят `ds_004`; boot-таймер — другой триггер |
| ds_015 | `CPUQuota=` — ограничение CPU юнита | "6" | нигде не занято |
| ds_016 | `MemoryMax=` — ограничение памяти юнита | "6" | `MemoryMax` ≠ `CPUQuota`; `systemctl show -p` занят `rs_011` |
| ds_017 | `Restart=` + `RestartSec=` — автоперезапуск упавшего юнита | "6" | нигде не занято |
| ds_018 | `systemctl list-unit-files --state=disabled` — аудит отключённых юнитов | "6" | `is-enabled` занят `rs_003`/`rs_010`; другой глагол и другой вывод |
| ds_019 | `systemctl get-property`/`show` vs `cat` — **заменён** на `systemctl list-timers` (см. §6) | "6" | `systemctl cat` занят `rs_014`; выбран `list-timers` |
| ds_020 | `/etc/cron.d` vs `/etc/crontab` vs `crontab -l` — **заменён** на `systemctl restart <unit>` | "6" | `cron.d` занят `ds_003`; выбран restart/reload-сценарий |
| ds_021 | `timedatectl set-timezone` — часовой пояс системы | "6" | нигде не занято; НЕ `set-default` (`rs_001`) |
| ds_022 | `hostnamectl set-hostname` — статическое имя хоста | "6" | нигде не занято |
| ds_023 | `grubby --update-kernel=ALL --args=` — параметр ядра в GRUB2 | "6" | нигде не занято |
| ds_024 | `chronyc sources` / `chronyc makestep` — состояние синхронизации времени | "6" | `timedatectl` (ds_021) — другой инструмент и другой аспект |
| ds_025 | `/etc/systemd/logind.conf` — обработка закрытия крышки ноутбука | "6" | нигде не занято; НЕ `journald Storage=` (`ds_007`) |

Все 12 — `objective_domain: "6"` (конвенция темы: 13/13 существующих и 14/16 `rs_*`).

## 5. Батч 12: расхождение с per-topic целью (зафиксировано для STOP D)

`13 + 12 = 25` при `per_topic_target: 22` → **перебор по теме +3**.
Глобально: `229 + 12 = 241` при `target_questions: 300`.

Решение капитана 2026-10-02 (`docs/memory/alerts.md:232-237`) приняло перебор
**+8** (банк 308 при 14×22) и оставило `per_topic_target: 22`. Батч 6 **увеличивает
перебор до +11**. Правок `state.json` / `tools/gen-state.mjs` в этой спеке нет —
расхождение фиксируется, решение за капитаном (выносится на STOP-точку D).

## 6. Правка плана по итогам перепроверки

Две позиции программы §4 были отвергнуты при самопроверке против §2/§3:

- **`systemctl cat`** как механизм ds_019 — уже занят `rs_014` → заменён на
  `systemctl list-timers` (обзор активных таймеров; `OnCalendar` в `ds_004` —
  про другое: там настройка директивы, здесь инвентаризация).
- **`/etc/cron.d` vs `/etc/crontab`** как механизм ds_020 — `cron.d` уже занят
  `ds_003` → заменён на `systemctl restart <unit>` (перезапуск службы после
  правки её конфигурации; `daemon-reload` занят `rs_006`/`rs_007` — там про
  перечитывание unit-файлов, здесь про перезапуск службы).

## 7. Поля коммита (проверено исполнением парсера, не перепечаткой)

`commit_format` (образец subject):

```
feat(bank): M2.9 batch 6 - 12 questions on deploy_systems (229->241)
```

`commit_regex` — **пара регулярок парсера** `tools/gen-state.mjs` (строки 158-159
и 182-183), задокументированная в `.project/specs/README.md:104`; как единый
шаблон, матчащий образец:

```
^feat\(bank\): .*?(\d+)\s+questions?
```

**Проверка выполнена исполнением** (`node .project/drafts/recon-043-regex-check.mjs`):

| Проверка | Источник шаблона | Результат |
|---|---|---|
| `/^feat\(bank\)/i` | вырезан из `tools/gen-state.mjs:158,182` | **PASS** |
| `/(\d+)\s+questions?/i` | вырезан из `tools/gen-state.mjs:159,183` | **PASS**, захвачено `12` |
| `commit_regex` поля спеки | построен из двух первых | **PASS** |
| контроль: тот же шаблон с запятой вместо двоеточия | — | `false` (двоеточие значимо) |

Следствие: `goal.added_today += 12`, `avg_daily_7d` учтёт 12 в 7-дневном окне.

### ВАЖНО — дефект в исходной формулировке чертежа (исправлять не в этой спеке)

Первоначальный посыл «взять `commit_regex` дословно из конвенции specs 005/020» и
требование «образец subject обязан матчить оба шаблона» **несовместимы**:

1. Конвенция specs 005/020 (`commit_regex:  "^feat\\(bank\\), (\\d+)\\s+questions?"`)
   содержит **запятую** после `(bank)`; в реальных subject'ах там **двоеточие** →
   такой шаблон не матчит ни один банковский коммит в истории.
2. Даже с исправленным двоеточием `^feat\(bank\): (\d+)\s+questions?` **не
   матчится**, потому что количество стоит не сразу после `": "`, а после префикса
   вехи: `feat(bank): M2.9 batch 6 - 12 questions …`. Между `": "` и числом
   обязателен непустой префикс.

Поэтому в spec 043 объявлен вариант `^feat\(bank\): .*?(\d+)\s+questions?` — он
матчит и образец, и все реальные subject'ы. Долг текстового поля в specs 005/015/
018/020 и в `.project/specs/README.md:98-104` **не правится** в этой спеке
(правило 13 и граница скоупа) — выносится отдельным кандидатом.

## 8. Критерии приёмки — источники

- **DOD content** (`.project/DOD.md:6-22`): 4 опции / ровно 1 верная; ratio в
  **символах** (`RATIO_UNIT = 'chars'`) по классу вопроса из `RATIO_TABLE`
  (`sentences` FAIL > 1.30, `token` FAIL > 2.00, `mixed` FAIL > 1.50); cosine
  против **всего** банка ≤ 0.85; тема из канона `topics.ts`; `explanation` ≤ 3 строк;
  `npm run qc` (Fails 0) и `npm run shuffle-bank:check` зелёные.
- **Правило 6** (`ORCH-RULES.md:83-95`): даже `approved` спека `type=content` **не**
  даёт права коммитить вопросы в `src/data/**`; точка остановки — превью + approve
  капитана (STOP-точка D, `run-spec-chain/SKILL.md` Шаг 4a).
- **Правило 3**: `npm run sync` → `git add` → коммит → `npm run sync:check` = 0.
- **Правило 16**: после правок — EOL/кодировка (LF, UTF-8 без BOM) проверяются.
- **Правило 17**: двухтрековый режим — `type: content` = **всегда Full** (порог
  Small/Full по размеру диффа не применяется).
- **Правило 2 (исключение F5.0a)**: перевод spec 043 в `approved` авторизован
  явной формулировкой капитана; запись `rule2-exception` — в `.project/log.md`.

## 9. Риски и открытые вопросы (для STOP D)

1. **Перебор per-topic +11** (см. §5) — решение капитана.
2. **Тема-конкурент `rs_*`**: 14 из 16 вопросов `running_systems` — тот же домен 6,
   риск смысловых дублей при cosine ниже порога 0.85. Мера: превью обязано
   содержать ближайшего соседа и явную проверку механизма, а не только cosine
   (урок батча 5C, `alerts.md`: `rs_011` был концептуальным дублем `ds_006` при
   cosine 0.7308).
3. **Позиции верных ответов**: в банке 5C `shuffle-bank:check` дал fail после
   интеграции. Мера: пречек распределения `correctIndex` до записи в `src/data/**`.
4. **Долг поля `commit_regex`** в specs 005/015/018/020 и README (§7) — вне скоупа.

## 10. Инструменты recon

- `.project/drafts/recon-043-regex-check.mjs` — проверка шаблона коммита
  (исполняет шаблоны, вырезанные из `tools/gen-state.mjs`); exit 0 = PASS.
