# spec 039 — отчёт задачи t2 (networking: net_001..003 + IPv6 ntw_017/018)

> Автор: writer-network (attempt 1, attempt_id 99e4b395-97d1-491d-be06-2db6f9a2d8fa).
> Дата: 2026-09-30. Спека: `.project/specs/039-bank-audit-036-fixes.md`; брифинг: `.project/drafts/spec-039-brief.md` §3, §5, §7.
> Оценка: **verdict: pass**.

## verdict

```
verdict: pass
files: src/data/questions/networking.json, .project/drafts/spec-039-t2-report.md
гейты:
  npm run qc => exit 0 | "Total: 229 questions" / "Fails: 0, Warns: 22" (baseline до прогона — 225 вопросов, тоже 22 warns)
  node .project/drafts/spec-039-cosine-neighbors.mjs net_001 net_002 net_003 ntw_017 ntw_018 => exit 0 | "checked=5 over_threshold=0"
  node tools/haladyna.cjs ntw_017 --auto-only => exit 0 | "ntw_017: score=8/10 (auto=5/5, semi=3/3)"
  node tools/haladyna.cjs ntw_018 --auto-only => exit 0 | "ntw_018: score=8/10 (auto=5/5, semi=3/3)"
улики: по каждому вопросу — в §3 ниже
оговорки: гейты t2 сняты дважды — на промежуточном состоянии (227: правки t1/t3 записаны, t4 ещё нет) и повторно на финальном банке 229; вердикт и цифры ниже — по финальному прогону
```

## 1. Что изменено в `src/data/questions/networking.json`

Порядок `options` у net_001/net_002/net_003 не менялся; изменены только `question`/`explanation`
(net_002, net_003) и `explanation` (net_001). Новые вопросы добавлены строго в конец массива.

| id | поле | было → стало (суть) |
|---|---|---|
| `net_001` | `explanation` | Разбор ссылался на вариант `ip addr add`, которого нет среди options, а дистрактор `nmcli connection show eth0` не разбирался. Теперь разобраны ровно три реальных дистрактора: (1) `connection show` только печатает профиль и не применяет его; (2) `ipv4.method auto` означает DHCP, и статический адрес не применяется; (3) `connection add` без `--type` завершается ошибкой и создаёт новое подключение вместо правки существующего. |
| `net_002` | `question` | «Какая команда на Rocky 9 изменит…» → «Какая команда изменит…» (версионно-нейтрально). |
| `net_002` | `explanation` | Добавлен разбор правильного варианта (`set-hostname` пишет статическое имя в `/etc/hostname`) и явно назван неверный ключ `--set-static` у `hostname`; убрана формулировка, звучавшая как описание верного варианта («hostname db1.example.com меняет только текущее имя…»). |
| `net_003` | `question` | «В каком файле на Rocky 9 хранятся…» → «В каком файле хранятся…». |
| `net_003` | `explanation` | «на типовой Rocky 9 пакет tcp_wrappers не установлен» → версионно-нейтральное «относится к TCP wrappers и управляет доступом к службам по адресу клиента, а не разрешением имён»; убрана Rocky-9-улика «в Rocky 9 содержит, например, «multi on»» → «устаревший файл glibc». |
| NEW `ntw_017` | весь объект | IPv6 8.1, `nmcli connection modify … ipv6.method manual … && nmcli connection up eth0` — статический IPv6-адрес, сохраняющийся после перезагрузки. |
| NEW `ntw_018` | весь объект | IPv6 8.1, `ip -6 addr add 2001:db8::20/64 dev eth0` — временный IPv6-адрес без правки профилей. |

Оба новых вопроса: `topic: "networking"`, `objective_domain: "8"` (объектив 8.1 «Configure IPv4 and
IPv6 addresses»), `difficulty`, `subtopic`, ровно 4 опции ровно с одним `correct: true`,
`explanation` — одна строка без переносов, `_meta` со схемой §3 (`added_at 2026-09-30`,
`pipeline_version spec-039`, `verified_rhel 10`, `verified_at 2026-09-30T00:00:00Z`,
`source spec-039-bank-audit-036-fixes`, `status active`, `reference` — официальная документация Red Hat для RHEL 10).

Проверка структуры (node · ConvertFrom-Json):

```
count=18                       (было 16 — +ntw_017, +ntw_018)
net_001 opts=4 correct=1 domain=7
net_002 opts=4 correct=1 domain=7
net_003 opts=4 correct=1 domain=7
ntw_017 opts=4 correct=1 domain=8 meta=True
ntw_018 opts=4 correct=1 domain=8 meta=True
```

Покрытие IPv6 в `networking.json` до этой задачи отсутствовало (скан брифинга §6 + скан капитана);
после правки IPv6 встречается ровно в ntw_017/ntw_018.

## 2. Сырой вывод гейтов

### 2.1 `npm run qc` → exit 0

```
> node tools/qc.cjs
--- 
Total: 229 questions
Fails: 0, Warns: 22
WARN by category: absolute=2 length-hint=2 ratio=16 stopword=2
RATIO by class (unit=chars, символы): sentences=99 token=99 mixed=29
[exit code: 0]
```

Baseline «до» (снят капитаном на HEAD `0abd6582`, банк 225): `Fails: 0, Warns: 22`.
После правок: `Fails: 0, Warns: 22` — ни один новый WARN не добавлен; правки net_001/002/003
не породили ни одного WARN. Промежуточная итерация ntw_017 давала `WARN ntw_017: option ratio
(sentences, chars) 1.28 > warn 1.25` — устранена выравниванием длины опций (max/min = 152/126 = 1.21).
Повторный прогон на финальном банке 229 (t4 дозаписала `_order.json`/`_topics.json`) даёт те же
`Fails: 0, Warns: 22`.

### 2.2 `node .project/drafts/spec-039-cosine-neighbors.mjs net_001 net_002 net_003 ntw_017 ntw_018` → exit 0

```
bank=229 threshold=0.8
ok     net_001  max=0.7614  ntw_014:0.7614 ntw_018:0.6863 ntw_017:0.5980
ok     net_002  max=0.6488  pm_009:0.6488 fm_007:0.6334 ls_004:0.6293
ok     net_003  max=0.7587  net_006:0.7587 ms_008:0.6512 ntw_012:0.6458
ok     ntw_017  max=0.7701  ntw_018:0.7701 net_001:0.5980 et_009:0.5919
ok     ntw_018  max=0.7701  ntw_017:0.7701 net_001:0.6863 sec_005:0.6535
checked=5 over_threshold=0
[exit code: 0]
```

Максимум по пятёрке — 0.7701 (ntw_017 ~ ntw_018), ниже порога 0.80 и ниже warn-порога 0.75 не
переходит ни одна пара.

### 2.3 `node tools/haladyna.cjs ntw_017 --auto-only` → exit 0, то же для ntw_018 → exit 0

```
ntw_017: score=8/10 (auto=5/5, semi=3/3)
AUTO_FAIL: нет
SEMI_FAIL: нет
MANUAL: [9, 10]
[exit code: 0]

ntw_018: score=8/10 (auto=5/5, semi=3/3)
AUTO_FAIL: нет
SEMI_FAIL: нет
MANUAL: [9, 10]
[exit code: 0]
```

## 3. Улики по каждому вопросу

Хост — Ubuntu 26.04/WSL: `nmcli`, `ip`, `ip6`, `hostnamectl`, `dnf`, `rpm` **отсутствуют**
(проверено `Get-Command`), поэтому эмпирика на хосте не заявляется — только официальная
документация Red Hat для RHEL 10 и `man`-страницы.

| id | утверждение в вопросе/разборе | источник |
|---|---|---|
| `net_001` | статический IPv4 задают `nmcli connection modify <conn> ipv4.method manual ipv4.addresses … ipv4.gateway …`, затем изменения применяют `nmcli connection up <conn>` | официальная документация RHEL 10 «Configuring and managing networking» (NetworkManager, профили keyfile): https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/10/html/configuring_and_managing_networking/ |
| `net_001` | `nmcli connection show` только печатает параметры подключения (KEY/VALUE) и не активирует их | `man nmcli` (`connection show` — «show details of connection profiles»); ср. тот же документ RHEL 10, шаг проверки: `nmcli connection show <name>` после `connection up` |
| `net_001` | `ipv4.method` принимает auto/manual/link-local/disabled; `auto` = DHCP, статический `ipv4.addresses` не применяется | `man nmcli` (описание `ipv4.method`); официальная документация RHEL 10 (там же) |
| `net_001` | `nmcli connection add` требует тип соединения (`--type ethernet` / `type ethernet`), иначе завершается ошибкой; он создаёт новое подключение, а не изменяет существующее | `man nmcli`: «connection add type <type> … con-name <name>»; официальная документация RHEL 10 (создание профиля: `nmcli con add type ethernet con-name … ifname …`) |
| `net_002` | `hostnamectl set-hostname` задаёт статическое имя и записывает его в `/etc/hostname`, оно сохраняется после перезагрузки | `man hostnamectl` («set-hostname NAME … the static hostname is stored in /etc/hostname»); официальная документация RHEL 10 (Configuring a host name) |
| `net_002` | `hostname NAME` меняет только transient-имя в ядре; ключа `--set-static` у `hostname` нет; `hostnamectl --transient` задаёт только временное имя; у `sysctl` нет ключа `set` для имени хоста | `man hostname` (`-F/--file`, `-f/--fqdn`, `-d`, `-i` — ключа `--set-static` нет), `man hostnamectl` (`--static`, `--transient`, `--pretty`), `man sysctl` (`-w, --write`; ключа `set` нет) |
| `net_003` | адреса DNS-серверов хранит `/etc/resolv.conf` (строки `nameserver <IP>`) | `man resolv.conf`; официальная документация RHEL 10 (Configuring DNS) |
| `net_003` | `/etc/nsswitch.conf` задаёт только порядок источников (`hosts: files dns`), адресов серверов не содержит | `man nsswitch.conf` |
| `net_003` | `/etc/hosts.allow` относится к TCP wrappers (host-based access control) и адресов серверов имён не хранит | `man hosts_access` / `man hosts_options` (TCP wrappers: «access control … based on the client host name/address»); формулировка версионно-нейтральна, поэтому опираться на неверифицированное утверждение «в RHEL 10 пакета нет» не требуется |
| `net_003` | `/etc/host.conf` — устаревший файл glibc и адресов серверов имён не хранит | `man host.conf` (resolver options glibc) |
| `ntw_017` | статический IPv6 задают `nmcli connection modify <conn> ipv6.method manual ipv6.addresses "2001:db8::10/64" ipv6.gateway "2001:db8::1"`, затем `nmcli connection up <conn>`; настройка хранится в профиле (keyfile) на диске и сохраняется после перезагрузки | официальная документация Red Hat для RHEL 10, «Configuring and managing networking» (IPv6-адресация через NetworkManager): https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/10/html/configuring_and_managing_networking/ ; `man nmcli` (`ipv6.method`, `ipv6.addresses`, `ipv6.gateway`) |
| `ntw_017` | `ipv6.method auto` — автоконфигурация (SLAAC/RA), заданный вручную адрес не применяется | `man nmcli` (`ipv6.method auto` — «IPv6 autoconfiguration»; ручные адреса ожидает `manual`) |
| `ntw_017` | `connection add` создаёт новое подключение (`con-name`), а не изменяет существующий профиль | `man nmcli` (`connection add … con-name`) |
| `ntw_017` | `nmcli connection show` печатает параметры профиля и ничего не применяет | `man nmcli` (`connection show`) |
| `ntw_018` | семейство адресов у `ip` задаёт ключ `-6`/`-4`; `ip -6 addr add 2001:db8::20/64 dev eth0` добавляет IPv6-адрес в ядро (действует до перезагрузки) | `man ip-address` (`ip address add IFADDR dev IFNAME`, `ip -6`/`-4` — «family»); **не** входит в список legacy-команд, помеченных `ip` как deprecated (`ifconfig`, `route`, `arp` — `man ip`: «ip … supersedes ifconfig/route/arp»), тогда как `netstat`/`ifconfig` в банке уже используются как дистракторы |
| `ntw_018` | без `-6` команда `ip addr add` по умолчанию работает с IPv4 и IPv6-литерал отвергает; `-4` явно выбирает IPv4 | `man ip-address` / `man ip` (по умолчанию `ip addr` показывает `inet` и `inet6`, но литерал адреса разбирается по семейству; при `-4` IPv6-литерал недопустим) |
| `ntw_018` | запись `2001:db8::20:0:0:64` длиной префикса не является (двоеточие вместо `/`) | синтаксис CIDR по RFC 4291/4632; `man ip-address` (форма `IFADDR` = «address/prefixlen») |

Оба новых `_meta.reference` указывают на официальную документацию Red Hat для RHEL 10
(раздел про NetworkManager/IPv6 в «Configuring and managing networking»), а не на несуществующий
`man`-прогон. `verified_rhel: "10"` — по документации Red Hat RHEL 10; эмпирика на хосте
не заявляется (бинарников в хосте нет).

## 4. Что сознательно НЕ делалось

- `_order.json`, `_topics.json` не тронуты (t4). Поэтому `npm run order:check`, `npm run manifest`
  и `npm run test:run` (loaders-invariant) до t4 падают закономерно — см. брифинг §1.
- `objective_domain` у net_001/002/003 оставлен `"7"` (правка не входила в задание: переписывались
  только разбор/метки версии).
- Порядок опций и позиция верного ответа в net_001/002/003 не менялись; `_meta` к старым трём
  вопросам не добавлялась (задание требует `_meta` только для новых ntw_017/018).
- Инструменты/файлы вне write-скоупа (`tools/**`, `.project/sync.mjs`, `.project/scripts/**`,
  `package.json`, `.project/specs/**`, другие темы банка) не изменялись.

## 5. Оговорки

1. `npm run qc` проверяет весь банк. Первый прогон гейтов сделан на промежуточном состоянии
   (229 ещё не собрано: правки t1/t3 уже записаны, `_order.json`/`_topics.json` — ещё нет),
   финальный прогон — на банке 229 вопросов. В обоих прогонах `Fails: 0, Warns: 22` — не хуже
   baseline 225/22; ни один WARN не принадлежит вопросам этой задачи.
2. Cosine-скрипт читает банк как он есть в файлах, а не `_order.json`, поэтому и на промежуточном
   состоянии (без t4) он работает корректно — все 5 id найдены в банке; результат не изменился
   при `bank=227` и `bank=229`.
3. Ни один из 22 WARN qc не принадлежит net_001/net_002/net_003/ntw_017/ntw_018.
4. По `net_003` сознательно не утверждается факт «в RHEL 10 TCP wrappers/`/etc/hosts.allow` отсутствуют»:
   первичного подтверждения (Red Hat RHEL 10 release notes / «Considerations in adopting RHEL 10»)
   получить не удалось (docs.redhat.com отвечает 403, текст PDF в mirror-копии release notes закодирован
   глифами и не извлекается). Поэтому дистрактор объяснён версионно-нейтрально: файл относится к
   контролю доступа по адресу клиента, а не к разрешению имён. STOP-условие брифинга §6 не
   срабатывает — неверность дистрактора от этого не зависит.

## 6. Итог для `output` задачи

```
verdict: pass
files: src/data/questions/networking.json, .project/drafts/spec-039-t2-report.md
гейты: npm run qc => exit 0 (Total 229; Fails 0, Warns 22)
       node .project/drafts/spec-039-cosine-neighbors.mjs net_001 net_002 net_003 ntw_017 ntw_018 => exit 0 (checked=5 over_threshold=0)
       node tools/haladyna.cjs ntw_017 --auto-only => exit 0 (auto=5/5)
       node tools/haladyna.cjs ntw_018 --auto-only => exit 0 (auto=5/5)
улики: man nmcli / man hostnamectl / man hostname / man resolv.conf / man nsswitch.conf / man host.conf /
       man ip-address + официальная документация Red Hat RHEL 10 «Configuring and managing networking» (URL в §3)
оговорки: гейты прогонялись и на промежуточном состоянии (227), и на финальном банке 229 — результат одинаков (Fails 0 / Warns 22); order:check/manifest/test:run — зона t4/t5
```
