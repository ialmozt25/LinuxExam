# spec 039 — отчёт repair-задачи t7 (r1): ntw_017 — удаление ложной клаузы в explanation

> Автор: writer-network (attempt 1, attempt_id cfab3550-36ba-4632-8482-79397a31b9ca).
> Дата: 2026-09-30. Задача: закрыть must-fix finding `r6-f1` из `.project/drafts/spec-039-review-report.md`
> (и `qc-f1` из `.project/drafts/spec-039-qc-report.md`).
> Оценка: **verdict: pass**.

## verdict

```
verdict: pass
files: src/data/questions/networking.json, .project/drafts/spec-039-r1-report.md
гейты:
  npm run qc => exit 0 | "Total: 229 questions" / "Fails: 0, Warns: 22"
  node .project/drafts/spec-039-cosine-neighbors.mjs ntw_017 ntw_018 => exit 0 | "checked=2 over_threshold=0"
  node tools/haladyna.cjs ntw_017 --auto-only => exit 0 | "ntw_017: score=8/10 (auto=5/5, semi=3/3)"
дополнительно (не гейт задачи): npm run shuffle-bank:check => exit 0 (BANK 229 = 69/51/48/61)
```

## 1. Что именно исправлено (одна правка, одна строка)

Finding `r6-f1`: последний дистрактор `ntw_017` —
`nmcli connection modify eth0 ipv6.method manual ipv6.addresses 2001:db8::10/64 ipv6.gateway 2001:db8::1 && nmcli connection show eth0` —
записывает длину префикса `/64` **корректно**. Ложным было придаточное, утверждавшее обратное.

Было (строка 459 до правки):

```
… Ключ connection add создаёт новое подключение с именем con-name, а не изменяет существующий профиль eth0. Последний вариант лишь печатает параметры профиля, ничего не меняя, и в нём неверно записан ключ длины префикса.",
```

Стало (строка 459 после правки):

```
… Ключ connection add создаёт новое подключение с именем con-name, а не изменяет существующий профиль eth0. Последний вариант лишь печатает параметры профиля, ничего не меняя.",
```

Удалён ровно один придаточный фрагмент `, и в нём неверно записан ключ длины префикса`.
Причина отклонения последнего дистрактора теперь — только «`nmcli connection show` лишь печатает
параметры профиля, ничего не меняя» (это подтверждено `man nmcli`: `connection show` — «show details
of connection profiles», активацию выполняет `connection up`).

Ничего другого в файле не менялось: ни `options`, ни `_meta`, ни остальные 17 вопросов.

## 2. Сырой вывод гейтов

### 2.1 `npm run qc` → exit 0

```
> vite-react-typescript-starter@0.0.0 qc
> node tools/qc.cjs

---
Total: 229 questions
Fails: 0, Warns: 22
WARN by category: absolute=2 length-hint=2 ratio=16 stopword=2
RATIO by class (unit=chars, символы): sentences=99 token=99 mixed=29
[exit code: 0]
```

Baseline после t4 (и до правки r1) — те же `Fails: 0, Warns: 22`; категории WARN не изменились,
WARN от `ntw_017` отсутствует.

### 2.2 `node .project/drafts/spec-039-cosine-neighbors.mjs ntw_017 ntw_018` → exit 0

```
bank=229 threshold=0.8
ok     ntw_017  max=0.7701  ntw_018:0.7701 net_001:0.5980 et_009:0.5919
ok     ntw_018  max=0.7701  ntw_017:0.7701 net_001:0.6863 sec_005:0.6535
checked=2 over_threshold=0
[exit code: 0]
```

Правка касалась только `explanation`; cosine считается по `question`, поэтому значения совпадают
с прогоном t2 (0.7701 < порога 0.80).

### 2.3 `node tools/haladyna.cjs ntw_017 --auto-only` → exit 0

```
ntw_017: score=8/10 (auto=5/5, semi=3/3)
AUTO_FAIL: нет
SEMI_FAIL: нет
MANUAL: [9, 10]
[exit code: 0]
```

### 2.4 (сверх задания) `npm run shuffle-bank:check` → exit 0

```
| networking             | 18    | 7    | 2    | 4    | 5    |
| BANK                   | 229   | 69   | 51   | 48   | 61   |
[exit code: 0]
```

## 3. `git diff` по `src/data/questions/networking.json`

Файл не закоммичен с начала spec-039 (HEAD `0abd6582`), поэтому `git diff` показывает весь объём
прогона: 5 изменённых строк + 72 добавленных. Ниже — hunk-заголовки (в скобках — id, которым
принадлежит хунк) и последний hunk целиком.

```
=== hunks
@@ -27 +27 @@        (net_001 · explanation — t2)
@@ -35 +35 @@        (net_002 · question — t2)
@@ -54 +54 @@        (net_002 · explanation — t2)
@@ -62 +62 @@        (net_003 · question — t2)
@@ -81 +81 @@        (net_003 · explanation — t2)
@@ -432,0 +433,72 @@  (новые ntw_017 + ntw_018 — t2)
=== объём
+ строк: 77, - строк: 5
```

Последний hunk (добавленные вопросы) — `explanation` ntw_017 здесь уже в исправленном виде:

```
+    "explanation": "Профиль NetworkManager настраивают ключом connection modify с ipv6.method manual, ipv6.addresses и ipv6.gateway, а команда nmcli connection up eth0 сразу применяет эти параметры к интерфейсу; они хранятся в профиле и сохраняются после перезагрузки. Метод auto означает автоконфигурацию IPv6 (SLAAC), и заданный вручную адрес не применяется. Ключ connection add создаёт новое подключение с именем con-name, а не изменяет существующий профиль eth0. Последний вариант лишь печатает параметры профиля, ничего не меняя.",
```

Почему в diff нет отдельного хунка под правку r1: `ntw_017` целиком попадает в добавленный блок
(он новый относительно `HEAD`), поэтому правка «до/после» здесь — это единственная строка в теле
этого блока. Изолированность правки подтверждена программно: сравнение состояния сразу после t2
с текущим состоянием даёт ровно одно различие — удаление подстроки
`, и в нём неверно записан ключ длины префикса` (см. §4, критерий 1).

## 4. Доказательства по критериям приёмки

| критерий | доказательство |
|---|---|
| В `explanation` нет утверждения о неверном ключе/длине префикса у последнего дистрактора; причина отклонения — только «печатает параметры профиля, ничего не меняя» | `$q.explanation -match 'префикс'` → `False`; `-match 'неверно'` → `False`; `lines=1`; хвост строки: «…Последний вариант лишь печатает параметры профиля, ничего не меняя.» |
| `options` не изменены: 4 опции, ровно 1 correct, correctIndex и тексты те же | `opts=4 correct=1 correctIndex=0`; в `git diff` хунков внутри блока `options` ntw_017 нет (блок добавлен целиком и не редактировался после t2: изменение r1 = одна подстрока в `explanation`) |
| `explanation` ≤ 3 строк без переносов; остальные 17 вопросов и все прочие поля ntw_017 побайтно не изменены | `count=18`, `explanation len=514`, `lines=1`, переносов `\r\n` в файле нет (`crlf=0`, 506 LF-строк); единственное различие с состоянием после t2 — удалённая подстрока; остальные 5 хунков diff принадлежат net_001/002/003 (t2) и в этой задаче не трогались |
| Все гейты exit 0 | §2.1–2.3: `qc` exit 0 (`Total: 229, Fails: 0, Warns: 22`), `cosine` exit 0 (`checked=2 over_threshold=0`), `haladyna --auto-only` exit 0 (`auto=5/5`) |
| Отчёт содержит дословный вывод команд с exit-кодами, `git diff` и verdict | этот файл, §2 и §3 |

## 5. Оговорки

1. Единственная содержательная правка — удаление ложного придаточного (найдено адверсариальным
   ревью r6 и подтверждено QC). `options` ntw_017 сформулированы корректно: дистрактор с
   `connection show eth0` неверен именно потому, что не активирует профиль, а не из-за префикса.
2. В `explanation` ntw_017 остались утверждения, которые я не проверял эмпирически (на хосте нет
   `nmcli`): семантика `ipv6.method auto` (= SLAAC) и то, что `connection add` создаёт новый профиль.
   Они опираются на `man nmcli` и официальную документацию Red Hat RHEL 10
   («Configuring and managing networking») и не входят в объём finding'а r6-f1; scope задачи
   ограничен удалением ложной клаузы.
3. `HALADYNA` MANUAL-критерии 9/10 остаются человеку (как и для всего банка) — задача их не закрывает.

## 6. Итог для `output` задачи

```
verdict: pass
files: src/data/questions/networking.json (удалена одна подстрока в explanation ntw_017),
       .project/drafts/spec-039-r1-report.md
гейты: npm run qc => exit 0 (Total: 229 questions; Fails: 0, Warns: 22)
       node .project/drafts/spec-039-cosine-neighbors.mjs ntw_017 ntw_018 => exit 0 (checked=2 over_threshold=0)
       node tools/haladyna.cjs ntw_017 --auto-only => exit 0 (score=8/10, auto=5/5, semi=3/3)
       npm run shuffle-bank:check => exit 0 (дополнительно, BANK 229 = 69/51/48/61)
улики: man nmcli (`connection show` печатает параметры; активирует `connection up`);
       официальная документация Red Hat RHEL 10 «Configuring and managing networking» (IPv6 через nmcli)
оговорки: правка r1 — ровно одна подстрока; ложное придаточное про длину префикса удалено,
       «/64» в последнем дистракторе теперь не оспаривается
```
