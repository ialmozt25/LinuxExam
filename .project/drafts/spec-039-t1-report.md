# spec 039 / t1 — отчёт: rewrite manage_software (ms_004, msw_011, msw_014)

- task: `t1`, attempt_id `bbf43220-dee1-4d51-8610-a67b8d340683`, member `writer-software`
- дата прогона: 2026-09-30 (сессия spec-039-bank-audit-036-fixes)
- базовый HEAD: `0abd658` (`0abd658 chore(state): converge after spec-039 stale-refs fix`)
- write-скоуп t1: `src/data/questions/manage_software.json`, `.project/drafts/spec-039-t1-*`
- изменённый файл банка: `src/data/questions/manage_software.json`
  SHA256 (после правок) = `2DD8DE56DC9032ED39E0DA897628E8E29442767587763137175D7297224963B0`

## verdict

```
verdict: pass
files: src/data/questions/manage_software.json, .project/drafts/spec-039-t1-report.md
```

`_order.json` / `_topics.json` / другие темы не трогались (интеграция — t4).

## 1. Гейты (сырые команды + exit-коды + ключевые строки)

### 1.1 `npm run qc` — обязательный гейт t1

```
$ npm run qc

> vite-react-typescript-starter@0.0.0 qc
> node tools/qc.cjs

...
---
Total: 227 questions
Fails: 0, Warns: 22
WARN by category: absolute=2 length-hint=2 ratio=16 stopword=2
RATIO by class (unit=chars, символы): sentences=99 token=99 mixed=29

QC_EXIT=0
```

- exit **0**, `Fails 0`, `Warns 22` (baseline прогона — 22, brief §1) — гейт выполнен.
- В списке WARN **нет ни одной строки** `ms_004`, `msw_011`, `msw_014` → правки t1 не
  добавили предупреждений. Все 22 WARN — унаследованные (ds_013, et_001, fm_003, fp_008,
  fp_012, ls_006, lsl_009×2, lsl_010×2, lsl_012, lsl_014, ms_003, ms_007, pm_005, pm_007,
  pm_010, sec_003, sec_005, sec_007, sec_012, ug_012).
- `Total: 227` (а не 229) — потому что на момент прогона в банке были добавлены только
  `ntw_017`/`ntw_018` (t2); `ug_019`/`ug_020` (t3) ещё не добавлены. Это ожидаемое
  промежуточное состояние (brief §1), t1 его не создаёт.

### 1.2 cosine-гейт по своим id — обязательный гейт t1

```
$ node .project/drafts/spec-039-cosine-neighbors.mjs ms_004 msw_011 msw_014

bank=227 threshold=0.8
ok     ms_004  max=0.7052  ms_002:0.7052 ms_008:0.6700 sh_008:0.6631
ok     msw_011  max=0.7057  msw_014:0.7057 tf_001:0.6130 msw_010:0.6061
ok     msw_014  max=0.7057  msw_011:0.7057 fp_018:0.6500 msw_010:0.6468
checked=3 over_threshold=0
COSINE_EXIT=0
```

- exit **0**; максимум 0.7057 < порога 0.80 (`tools/cosine-calibration.json`) у всех трёх.
- Порог рабочий: скрипт уже проверен капитаном на известной whitelist-паре `tf_001`
  (REJECT 0.9020, brief §4), т.е. `ok` здесь — не следствие сломанного сравнения.

### 1.3 Haladyna (предметная проверка DOD `content`, brief §4)

```
$ node tools/haladyna.cjs ms_004 --auto-only
ms_004: score=8/10 (auto=5/5, semi=3/3)
AUTO_FAIL: нет
SEMI_FAIL: нет
MANUAL: [9, 10]
H_MS004=0

$ node tools/haladyna.cjs msw_011 --auto-only
msw_011: score=8/10 (auto=5/5, semi=3/3)   H_MSW011=0

$ node tools/haladyna.cjs msw_014 --auto-only
msw_014: score=8/10 (auto=5/5, semi=3/3)   H_MSW014=0
```

AUTO 5/5 и SEMI 3/3 у всех трёх (exit 0 у каждого вызова).

### 1.4 Инвариантность порядка опций и позиции верного ответа (жёсткий запрет brief §2)

```
$ node %TEMP%\le-t1-verify.mjs        # сравнение HEAD-снимка и текущего файла

ms_004: options 4->4, correctIndex 3->3 (SAME), correctCount=1
msw_011: options 4->4, correctIndex 0->0 (SAME), correctCount=1
msw_014: options 4->4, correctIndex 2->2 (SAME), correctCount=1

RESULT: PASS (order + single correct + 4 options preserved)
VERIFY_EXIT=0
```

Скрипт сравнивает текущий `manage_software.json` с версией из HEAD (`0abd658`),
распакованной `git archive` в `%TEMP%\le-baseline-039` (банк в репозитории не менялся).

### 1.5 Baseline для контекста (HEAD `0abd658`, снимок в %TEMP%)

```
$ node %TEMP%\le-baseline-039\tools\qc.cjs

Total: 225 questions
Fails: 0, Warns: 22
WARN by category: absolute=2 length-hint=2 ratio=16 stopword=2
BASE_EXIT=0
```

`Warns 22` до и `22` после → бюджет предупреждений не израсходован правками t1.

### 1.6 Гейты, которые t1 НЕ закрывает (brief §1)

`npm run order:check`, `npm run manifest`, `npm run test:run` (loader-invariant),
`npm run shuffle-bank:check` намеренно неконсистентны до t4 — они относятся к t4/t5,
для t1 не запускались и провалом t1 не являются.

## 2. Что именно изменено

`git diff --stat`: `src/data/questions/manage_software.json | 36 +++++++--------`
(вторая строка stat — `networking.json` от t2, не мой скоуп).

### ms_004 — модульные потоки убраны, RHEL 10 post-modular

| поле | было (HEAD) | стало |
|---|---|---|
| subtopic | `dnf module: активный поток модуля` | `post-modular: версия в имени пакета` |
| question | «В репозитории есть модуль postgresql с потоками 15, 16 и 18…» | «В RHEL 10 применяется post-modular подход: каждая версия приложения поставляется отдельным пакетом. Нужно установить PostgreSQL версии 16 из репозитория RHEL 10 с помощью dnf. Какая команда это сделает?» |
| option 0 (false) | `dnf module disable postgresql` | `dnf info postgresql16` |
| option 1 (false) | `dnf module enable postgresql-16` | `dnf install postgresql-16` |
| option 2 (false) | `dnf module install postgresql:16` | `dnf download postgresql16` |
| option 3 (**true**, позиция сохранена) | `dnf module enable postgresql:16` | `dnf install postgresql16` |
| explanation | разбор `module enable/install/disable` | versioned-имя как суффикс; `dnf info` только печатает метаданные; `dnf download` только скачивает rpm; форма с дефисом не соответствует versioned-имени |

- Верный ответ больше **не** `dnf module enable` — требование audit-036/brief §5 выполнено.
- Токены `module` / `modul` (кроме заимствованного `post-modular`) и `postgresql:16`
  в блоке отсутствуют (проверено скриптом §1.4: `module-token: false`).

### msw_011 — `.el9` → `.el10` + исправлен ошибочный разбор про dnf

- question: `htop-3.2.2-1.el9.x86_64.rpm` → `htop-3.2.2-1.el10.x86_64.rpm`
- все 4 опции: `.el9` → `.el10` (порядок опций и `correctIndex=0` сохранены);
- explanation, 3-е предложение (единственная смысловая правка разбора): было
  «Команда dnf install умеет ставить локальный файл, но перед этим обращается к
  метаданным репозиториев, а они не подключены, поэтому команда завершится ошибкой» →
  стало «Команда dnf install тоже умеет ставить локальный rpm-файл, но путь к нему
  указывают явно (./htop-3.2.2-1.el10.x86_64.rpm), а без пути dnf ищет аргумент как имя
  пакета в репозиториях; установка ключом rpm -i от репозиториев не зависит».
  Безусловное ложное утверждение «упадёт, потому что репозитории не подключены» убрано,
  разбор по-прежнему объясняет, почему дистрактор `dnf install <голое имя файла>` неверен.
- первые два предложения разбора не тронуты.

### msw_014 — `.el9` → `.el10` в имени пакета

- question + все 4 опции: `myapp-2.1.0-1.el9.x86_64.rpm` → `myapp-2.1.0-1.el10.x86_64.rpm`
  (5 вхождений, `correctIndex=2` сохранён);
- explanation, subtopic, difficulty, objective_domain не менялись.

## 3. Улики (источник на каждое содержательное утверждение)

1. **ms_004 — RHEL 10 post-modular, `dnf install postgresql16`, отказ от `dnf module enable`.**
   Red Hat Developer, Filip Janus, 2025-03-11, «Discover packaging parallel database streams
   in RHEL 10» — <https://developers.redhat.com/articles/2025/03/11/discover-packaging-parallel-database-streams-rhel-10>
   (HTTP 200, текст получен). Дословно: *«RHEL 10 comes with a post-modular solution»*;
   *«Previously in modularity, you needed to handle modular streams by using the
   `dnf module enable` and `dnf module reset` commands. However, the new post-modular
   concept does not require such operations»*; *«This new concept incorporates the stream
   version into the package name as a suffix. As a result, the user only needs the
   information about the stream version to install. For example, to install PostgreSQL 16,
   enter: `dnf install postgresql16`»*. Отсюда: суффиксная форма имени (option 3 —
   верная), дефисная форма (`postgresql-16`) соглашению не соответствует (option 1 —
   дистрактор), сам ответ `dnf module enable` механику RHEL 10 не отражает.
   Та же улика приведена в audit-036 (`.project/drafts/audit-036-summary.md`, строка `ms_004`).
2. **ms_004 — `dnf info` только читает метаданные; `dnf download` только скачивает rpm.**
   DNF5 documentation: `dnf5-info(8)` / `dnf5-download(8)` (RHEL 10 поставляется с DNF5):
   <https://dnf5.readthedocs.io/en/latest/commands/index.html> (в списке команд —
   `Info Command`, `Download Command`).
3. **msw_011 — локальный rpm dnf ставит по пути, а не по «голому» имени файла.**
   DNF5 `install(8)`, раздел Examples: *«`dnf5 install ~/Downloads/tito-0.6.21-1.fc36.noarch.rpm`
   — Install the local rpm file from the given location»* —
   <https://dnf5.readthedocs.io/en/latest/commands/install.8.html> (HTTP 200, текст получен).
   `specs(7)` описывает `<package-spec>` как сопоставление с NEVRA/provides/file-provides;
   файловый путь обрабатывается только для spec, начинающихся с `/` или `*/` —
   <https://dnf5.readthedocs.io/en/latest/misc/specs.7.html> (HTTP 200, текст получен).
   Требование убрать ложное «упадёт, т.к. репозитории не подключены» — audit-036,
   строка `msw_011`.
4. **msw_011 / msw_014 — `.el9` → `.el10`: требование спеки/аудита.**
   `.project/specs/039-bank-audit-036-fixes.md` §P1 («`msw_011`: `.el9` → `.el10` в условии и
   вариантах», «`msw_014`: `.el9` → `.el10` в имени пакета») и `.project/drafts/audit-036-summary.md`
   (строки `msw_011`, `msw_014`: «тег `.el9`; для RHEL 10 — `.el10`»).
   Оговорка по улике: прямой страницы docs.redhat.com с dist-tag `.el10` через доступный
   поиск получить не удалось (выдача — PDF и JS-рендеренные страницы), поэтому это
   утверждение опирается на аудит 036 (проектный источник требования) + общепринятый
   dist-tag сборок RHEL 10 (вторичное подтверждение: обсуждение dist-tag `.el10` в
   списке centos-devel, <https://lists.centos.org/hyperkitty/list/devel@lists.centos.org/thread/TKZIDJHUZEZPJM6QWD7GUXSROIX6LL4U/>).
   Правка — переименование образца имени файла в условии/опциях, никаких новых
   утверждений о репозиториях она не вводит.
5. **Хост — Ubuntu 26.04:** `dnf`/`rpm` и RHEL-специфичные бинарники отсутствуют, поэтому
   эмпирических прогонов команд в этом отчёте нет и не заявлено; все утверждения — из
   документации Red Hat/DNF5 по URL выше.

## 4. Оговорки

1. На момент прогонов банк правился параллельно t2 (`networking.json` в `git diff --stat`
   — чужой скоуп). Один промежуточный прогон `npm run qc` дал `Total: 227, Warns: 23`
   (лишнее предупреждение — `WARN ntw_017: option ratio (sentences, chars) 1.28 > warn 1.25`,
   файл t2); к финальному прогону §1.1 оно исчезло — t2 его закрыл. Правки t1 в warn-бюджет
   не вносили ни в одном из прогонов.
2. `_meta` у ms_004/msw_011/msw_014 не добавлялась (brief §3: `_meta` опциональна) —
   расхождение не создаёт, схема вопроса не расширена.
3. `difficulty` ms_004 оставлена `medium` (не менялась), `objective_domain` — `"6"` у всех
   трёх (не менялись), `subtopic` msw_011/msw_014 не менялись.
4. `_order.json`, `_topics.json`, `networking.json`, `users_groups.json` и остальные темы
   не затрагивались; коммитов/пушей не делалось.

## 5. Итог для передачи в output

```
verdict: pass
files: src/data/questions/manage_software.json, .project/drafts/spec-039-t1-report.md
гейты:
  npm run qc                                              => exit 0  (Total: 227 questions; Fails: 0, Warns: 22; RATIO by class: sentences=99 token=99 mixed=29)
  node .project/drafts/spec-039-cosine-neighbors.mjs ms_004 msw_011 msw_014
                                                          => exit 0  (bank=227 threshold=0.8; ok ms_004 max=0.7052, ok msw_011 max=0.7057, ok msw_014 max=0.7057; checked=3 over_threshold=0)
  node tools/haladyna.cjs <id> --auto-only (ms_004,msw_011,msw_014) => exit 0  (auto=5/5, semi=3/3 у всех трёх)
  node %TEMP%\le-t1-verify.mjs (HEAD-снимок vs текущий файл)        => exit 0  (correctIndex 3->3 / 0->0 / 2->2 — SAME; 4 опции; ровно 1 верная)
улики:
  ms_004        — Red Hat Developer 2025-03-11 (post-modular, суффикс версии, dnf install postgresql16, без dnf module enable)
  ms_004        — DNF5 docs info(8)/download(8) (info только метаданные, download только скачивание)
  msw_011       — DNF5 install(8) Examples (локальный rpm ставится по пути) + specs(7) (spec vs file-provides); audit-036 (снять ложное «упадёт из-за репозиториев»)
  msw_011/014   — spec 039 §P1 + audit-036 (строки msw_011/msw_014): .el9 → .el10 для RHEL 10
оговорки: утверждение про dist-tag .el10 опирается на audit-036/spec 039 (официальной страницы docs.redhat.com с этим тегом найти не удалось); банк правился параллельно t2/t3, финальные цифры qc сняты на Total=227 (ug_019/020 ещё не добавлены t3)
```
