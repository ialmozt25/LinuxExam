# Batch 7 preview — 6 вопросов из 6 (DRAFT, не закоммичено)

Тема: `networking` («Сеть», канон `src/data/topics.ts`) · банк 189 → 189 · 2026-09-27 · ночная смена
Кандидаты: `%TEMP%\linuxexam-batch7-networking.json` · ids `ntw_011`…`ntw_016`

> **Это draft, а не интеграция.** Вопросы НЕ добавлены в `src/data/questions/*`,
> `_order.json` и `_topics.json` не тронуты. Approve капитана обязателен.

## Итог QC

| метрика | значение | порог |
|---|---|---|
| cos против всего банка (max) | **0.7614** (`ntw_014` ~ `net_001`) | 0.85 (DOD) / 0.80 (инструмент) |
| cos intra-batch (max) | **0.6274** (`ntw_013` ~ `ntw_015`) | 0.85 |
| option ratio (max) | **1.1455** (`ntw_014`, класс `sentences`) | 1.3 |
| верных ответов != 1 | 0 | — |
| explanation без перевода строки | 6/6 | ≤ 3 строк |

**6/6 принято, 0 отклонено.** Лучший батч смены по близости к банку (cos ≤ 0.7614)
и по intra-batch (0.6274).

### Таблица QC

| id | cos против банка | ratio (класс) | порог класса | вердикт QC | решение Оркестратора |
|---|---|---|---|---|---|
| `ntw_011` | 0.5804 (`et_009`) | 1.0833 (`token`) | 2.0 | accept | accept |
| `ntw_012` | 0.6005 (`pm_007`) | 1.0588 (`token`) | 2.0 | accept | accept |
| `ntw_013` | 0.7263 (`rs_010`) | 1.0909 (`sentences`) | 1.3 | accept | accept |
| `ntw_014` | **0.7614** (`net_001`) | 1.1455 (`sentences`) | 1.3 | accept | accept + замечание 2 |
| `ntw_015` | 0.6538 (`rs_001`) | 1.0333 (`sentences`) | 1.3 | accept | accept |
| `ntw_016` | 0.5996 (`ms_002`) | 1.0000 (`sentences`) | 1.3 | accept | accept |

## Замечания Оркестратора (читать до approve)

1. **Explanation длинные:** 327…512 символов при ориентире 300; 6/6 выше ориентира.
   Порог DOD («≤ 3 строк») соблюдён — переводов строки нет, — и в банке уже 132
   объяснения длиннее 300 символов, но это самый «многословный» батч смены.
   Замечание стилевое, не блокирующее.
2. **`ntw_014` (firewalld masquerade) — единственное не подтверждённое исполнением
   утверждение батча.** В WSL этого хоста нет `firewalld`/`firewall-cmd`
   (`apt-get download firewalld` → «no candidate»), а сам хост — Ubuntu 26.04,
   не RHEL/Rocky. Writer опирался на:
   - upstream `firewall-cmd(1)` с firewalld.org — это документация **firewalld 2.x**,
     тогда как RHEL 9 / RHCSA EX200 несёт **firewalld 1.x**;
   - список служб firewalld v2.1.0 через GitHub API — подтверждено, что службы
     с именем `masquerade` не существует (это и делает дистрактор C неверным).
   **Расхождение версий man-страниц построчно не сверено.** Ключ `--add-masquerade`
   и фраза о неявном включении `ip_forward` в firewalld стабильны между 1.x и 2.x,
   но это утверждение Writer'а, а не моя проверка. Капитан может либо принять
   риск, либо отложить `ntw_014` до прогона на Rocky.
3. **Префикс `ntw_` и «похожесть» на `net_*`.** В файле темы уже есть `net_011`
   и `net_012` (пропуски — только `net_004` и `net_009`), поэтому `ntw_011`/`ntw_012`
   строково отличимы, но глазом в ревью путаются. Коллизий id нет; предлагалось
   перенумеровать в `ntw_101`…`ntw_106`, но 3-значные номера выбиваются из
   конвенции банка (везде 2 цифры), поэтому **оставлено как есть** — префикс
   `ntw_` и есть различитель. Решение капитана, если нужна другая нумерация.
4. **Исправление факта в задании Writer'у.** Я написал, что в `networking.json`
   вопросы «net_001, net_002, net_003, net_005, …»; фактически там ещё `net_011`
   и `net_012`. Writer это заметил и сообщил — задание было неполным, неверных
   выводов из него сделано не было.

## Вопросы

### `ntw_011` — ip neigh: таблица соседей (ARP-кэш)

- **topic:** `networking` · **difficulty:** easy · **objective_domain:** `7`
- **question:** На сервере нужно увидеть, каким MAC-адресам соответствуют IP-адреса соседей в локальном сегменте, то есть содержимое ARP-кэша. Какая команда выведет эту таблицу?

  - **A.** `ip neigh show` ← **верный**
  - **B.** `ip link show`
  - **C.** `ip route show`
  - **D.** `ip addr show`

- **correct:** A
- **explanation:** Команда ip neigh show печатает таблицу соседей: для каждого адреса видны интерфейс, MAC-адрес (lladdr) и состояние записи, например REACHABLE или STALE. Команда ip link show описывает сами интерфейсы — флаги, MTU и собственный MAC интерфейса, но чужие IP-адреса с MAC-адресами не сопоставляет. Команда ip route show выводит таблицу маршрутизации, а ip addr show — адреса, назначенные интерфейсам, и сведений о соседях ни та, ни другая не содержат.
- **Верификация:** `man ip-neighbour` + live `ip neigh show` (поля IP/lladdr/REACHABLE), `ip link show`, `ip addr show`, `ip route show`.

### `ntw_012` — dig: запрос MX-записей

- **topic:** `networking` · **difficulty:** medium · **objective_domain:** `7`
- **question:** Нужно получить MX-записи домена example.com, то есть список его почтовых серверов. Какая команда выполнит такой запрос к DNS?

  - **A.** `dig A example.com`
  - **B.** `dig MX example.com` ← **верный**
  - **C.** `dig NS example.com`
  - **D.** `dig -x example.com`

- **correct:** B
- **explanation:** В dig тип запроса задаётся отдельным аргументом, поэтому dig MX example.com запрашивает записи типа MX и печатает их в разделе ANSWER SECTION. Команда dig A example.com запрашивает адресную запись, а dig NS example.com — серверы имён домена, и к почтовым серверам ни одна из них не относится. Ключ -x включает обратный запрос и ожидает на входе IP-адрес, а не имя домена, поэтому MX-записи он не вернёт.
- **Верификация:** `man dig` + live-прогоны `dig MX`, `dig A`, `dig NS`, `dig -x` в WSL (после установки `bind9-dnsutils`).

### `ntw_013` — ip route get: выбор маршрута для адреса

- **topic:** `networking` · **difficulty:** hard · **objective_domain:** `7`
- **question:** На сервере несколько маршрутов. Нужно заранее узнать, какой именно маршрут и через какой интерфейс ядро выберет для пакета к адресу 10.20.30.40, не просматривая таблицу целиком. Какая команда это покажет?

  - **A.** `ip route show table main`
  - **B.** `ip link show dev ens18`
  - **C.** `ip route get 10.20.30.40` ← **верный**
  - **D.** `ip addr show dev ens18`

- **correct:** C
- **explanation:** Команда ip route get выполняет поиск по таблице маршрутизации для одного адреса и печатает выбранный маршрут так, как его видит ядро: шлюз, интерфейс и адрес источника. Команда ip route show table main выводит всю основную таблицу, и нужную строку из неё пришлось бы выбирать вручную. Команды ip link show dev ens18 и ip addr show dev ens18 показывают состояние и адреса интерфейса, но по ним нельзя узнать, какой маршрут будет использован для конкретного адреса.
- **Верификация:** `man ip-route` («get a single route … exactly as the kernel sees it») + live `ip route get 10.20.30.40`, `ip route show table main`.

### `ntw_014` — firewalld: masquerade для NAT · ⚠️ версия man не сверена

- **topic:** `networking` · **difficulty:** medium · **objective_domain:** `7`
- **question:** Сервер должен раздавать интернет в подсеть 192.168.50.0/24: адреса из неё должны подменяться адресом внешнего интерфейса ens18, который отнесён к зоне public. Какую команду нужно выполнить, чтобы включить такую подмену в постоянной конфигурации?

  - **A.** `firewall-cmd --permanent --zone=public --add-forward-port`
  - **B.** `firewall-cmd --permanent --zone=public --remove-masquerade`
  - **C.** `firewall-cmd --permanent --zone=public --add-service=masquerade`
  - **D.** `firewall-cmd --permanent --zone=public --add-masquerade` ← **верный**

- **correct:** D
- **explanation:** Ключ --add-masquerade включает в зоне маскарадинг IPv4, то есть подмену адресов источника адресом внешнего интерфейса, а ip_forward при этом включается неявно. Ключ --remove-masquerade выключает маскарадинг, то есть делает обратное. Ключ --add-forward-port служит для перенаправления портов и требует значения вида port=8080:proto=tcp, поэтому без него команда завершится ошибкой, а --add-service принимает имя службы из набора firewalld (http, ssh и подобные), среди которых службы masquerade нет.
- **Верификация:** upstream `firewall-cmd(1)` (firewalld.org) + список служб firewalld v2.1.0 через GitHub API. **Не сверено:** man-страница firewalld 1.x (то, что несёт RHEL 9) — построчного diff нет; live-прогон невозможен (firewalld в WSL отсутствует). См. замечание 2.

### `ntw_015` — ip link set: MTU интерфейса

- **topic:** `networking` · **difficulty:** medium · **objective_domain:** `7`
- **question:** Через интерфейс ens18 идёт туннель, в котором теряются пакеты крупнее 1400 байт. Нужно сразу понизить MTU самого интерфейса до 1400, не правя файлы конфигурации. Какая команда это сделает?

  - **A.** `ip link set dev ens18 mtu 1400` ← **верный**
  - **B.** `ip link show dev ens18 mtu 1400`
  - **C.** `ip addr set dev ens18 mtu 1400`
  - **D.** `ip link set dev ens18 mtu 1500`

- **correct:** A
- **explanation:** Команда ip link set изменяет параметры интерфейса, а параметр mtu задаёт новый размер, поэтому ip link set dev ens18 mtu 1400 сразу понизит MTU до 1400 байт (такой же пример есть в man ip-link). Команда ip link show только выводит сведения об интерфейсе и MTU не меняет: аргумента mtu у неё нет, и такой вызов завершится ошибкой; подкоманды set у объекта ip addr тоже не существует, поэтому и она не сработает. Вариант с mtu 1500 устанавливает другое значение, то есть задачу с понижением до 1400 байт не решает.
- **Верификация:** `man ip-link` (EXAMPLES: `ip link set dev ppp0 mtu 1400`) + live: `ip link set dev lo mtu 65536` успешно, `ip link show dev lo mtu 1500` → ошибка, `ip addr set dev lo mtu 1500` → unknown command.

### `ntw_016` — ping: ограничение числа запросов

- **topic:** `networking` · **difficulty:** easy · **objective_domain:** `7`
- **question:** Скрипт проверки связи должен отправить ровно три ICMP-запроса к узлу 8.8.8.8 и завершиться сам, без ожидания Ctrl-C. Какая команда это сделает?

  - **A.** `ping -i 3 8.8.8.8`
  - **B.** `ping -c 3 8.8.8.8` ← **верный**
  - **C.** `ping -t 3 8.8.8.8`
  - **D.** `ping -W 3 8.8.8.8`

- **correct:** B
- **explanation:** Ключ -c count останавливает ping после отправки указанного числа запросов, поэтому ping -c 3 отправит ровно три пакета и завершится сам. Ключ -i 3 задаёт интервал в три секунды между запросами, но их число не ограничивает. Ключ -t задаёт TTL, а -W — время ожидания ответа, поэтому такие команды продолжают работу до прерывания.
- **Верификация:** `man ping` (`-c`, `-i`, `-t ttl`, `-W`) + live-прогоны под `timeout`: сам завершается только `-c 3`.

## Отклонённые

Нет. 6 из 6 приняты.

## Что дальше

Approve капитана → интеграция в `src/data/questions/networking.json`,
`_order.json`, `_topics.json`, `npm run shuffle-bank --apply networking`,
`npm run qc`, `npm run shuffle-bank:check`, `typecheck`, `test:run`, `build`.
До approve в `src/data` не меняется ничего.
