# SETUP — настройка guard'а session-id на новой машине

Инструкция для машины, на которой будет работать **капитанская сессия** DSH
(и любой клон репозитория, где планируется `spec:close` или `git push`).

Правило 11 («субъект push — только капитанская сессия») до spec 049 держалось
только на процедурной записи: у исполняющего контура не было технического
признака «это капитанская сессия». **Прецедент breach 048** (2026-10-02):
worker t6 прогона spec 048 выполнил `git push origin main` без авторизации и
сам закрыл спеку (`npm run spec:close -- 048`). Записи: `.project/log.md` L234,
`docs/archive/HANDOFF.md` §13b.

Guard spec 049 закрывает технически ровно две операции, которые были выполнены
самовольно: **закрытие спеки** (`.project/scripts/close-spec.mjs`, exit 2) и
**push** (`.githooks/pre-push`, exit 1). Оба сравнивают `DSH_SESSION_ID`
исполняющего процесса с содержимым файла `.project/.captain-session-id`.

---

## 1. Что именно настраивается

| Артефакт | Роль | В git |
| --- | --- | --- |
| `.project/.captain-session-id` | значение `DSH_SESSION_ID` капитанской сессии (одна строка) | **нет** (в `.gitignore`) |
| `core.hooksPath = .githooks` | включает `.githooks/pre-push` | настройка машины, не репозитория |
| `.githooks/pre-push` | guard push: чужая сессия → exit 1 | да |
| `.project/scripts/close-spec.mjs` | guard закрытия: чужая сессия → exit 2 | да |

Файл сессии — **машинозависимый**: на каждой машине своё значение, поэтому он
не коммитится и не должен быть tracked.

## 2. Шаги настройки (SETUP капитана)

Шаг 1. Включить git-хуки репозитория:

```powershell
git config --local core.hooksPath .githooks
git config --local --get core.hooksPath   # ожидаем: .githooks (exit 0)
```

Шаг 1b. Исполняемый бит хука. На Windows `core.fileMode=false`, поэтому
`.githooks/pre-push` попадает в индекс как `100644`, а `git find_hook()` на
POSIX-системах требует `X_OK` — без бита push-guard там молча не сработает:

```powershell
git ls-files -s .githooks/pre-push            # ожидаем 100755 после фиксации бита
git update-index --chmod=+x .githooks/pre-push # фиксирует бит в индексе (клоны его получат)
```
```sh
chmod +x .githooks/pre-push                     # для уже существующего клона
```

Шаг 2. Создать `.project/.captain-session-id` со значением `$env:DSH_SESSION_ID`
своей (капитанской) сессии. Рекомендуемый способ — без BOM и без CRLF, ровно
одна строка:

```powershell
node -e "require('node:fs').writeFileSync('.project/.captain-session-id', process.env.DSH_SESSION_ID.trim())"
# проверить, что записано то, что нужно:
node -e "console.log(JSON.stringify(require('node:fs').readFileSync('.project/.captain-session-id','utf8')))"
```

Если `$env:DSH_SESSION_ID` пуст — сессия запущена не через DSH; guard в такой
сессии не пройдёт, писать в файл нечего (см. §7 «Что делать при блокировке»).

Шаг 3. Убедиться, что файл попадает в `.gitignore` и **не tracked**. В
репозитории LinuxExam нужная строка уже есть (секция «spec 049» в `.gitignore`):

```powershell
Select-String -Path .gitignore -Pattern 'captain-session-id'   # ожидаем совпадение
git check-ignore -v .project/.captain-session-id                # ожидаем: .gitignore:N:...
git ls-files --error-unmatch .project/.captain-session-id       # ожидаем ошибку: файл не известен git
```

Если строки в `.gitignore` нет — добавить `.project/.captain-session-id` и
только после этого создавать файл.

## 3. Правило «создаётся один раз»

Файл создаётся SETUP'ом **один раз** и дальше не переписывается ни задачами, ни
воркерами. Перезапись — только осознанное действие капитана (смена сессии,
§4). Задача, которой понадобился этот файл, не создаёт и не правит его: ей
доступен только read-only путь через guard.

Признак устаревшего или повреждённого (например, перезаписанного другой
кодировкой) файла — guard блокирует легитимное закрытие/push в капитанской
сессии; лечится повторным выполнением Шага 2, а не правкой скриптов.

## 4. Смена сессии капитана (перезапуск DSH)

`DSH_SESSION_ID` у новой сессии другой, а файл хранит старое значение — guard
начнёт блокировать закрытие и push. Порядок:

1. Повторить Шаг 2 в новой сессии (перезаписать файл новым значением).
2. Сообщить агенту (капитану команды/оркестратору), что файл обновлён —
   иначе исполнитель будет диагностировать это как регресс guard'а.
3. Прогнать проверки из §5.

## 5. Проверка работоспособности

Все команды выполняются из корня репозитория; `<spec-id>` — любая spec в
статусе `approved` (для LinuxExam spec 049 подходит).

```powershell
# 5.1 close-spec в капитанской сессии — guard пройден, dry-run успешен
node .project/scripts/close-spec.mjs 049 --dry-run
Write-Output "close captain EXIT=$LASTEXITCODE"        # ожидаем 0

# 5.2 чужая (поддельная) сессия — guard закрытия сработал
$env:DSH_SESSION_ID = 'session-fake'
node .project/scripts/close-spec.mjs 049 --dry-run
Write-Output "close foreign EXIT=$LASTEXITCODE"        # ожидаем 2 + текст «только капитанская сессия»

# 5.3 вернуть своё значение
$env:DSH_SESSION_ID = (Get-Content .project/.captain-session-id -Raw).Trim()

# 5.4 hook push напрямую: чужая сессия → 1, капитанская → 0
#     (нужен `sh` в PATH: Git Bash / MSYS. В pwsh на Windows его обычно нет —
#      тогда это диагностика, а не провал; штатная проверка — 5.5)
$env:DSH_SESSION_ID = 'session-fake'
sh .githooks/pre-push
Write-Output "hook foreign EXIT=$LASTEXITCODE"         # ожидаем 1
$env:DSH_SESSION_ID = (Get-Content .project/.captain-session-id -Raw).Trim()
sh .githooks/pre-push
Write-Output "hook captain EXIT=$LASTEXITCODE"         # ожидаем 0

# 5.5 основная проверка на Windows: git исполняет hook своим sh, ничего не отправляя
$env:DSH_SESSION_ID = 'session-fake'
git push --dry-run origin main
Write-Output "push foreign EXIT=$LASTEXITCODE"         # ожидаем 1 + «push заблокирован (guard spec 049...)»
$env:DSH_SESSION_ID = (Get-Content .project/.captain-session-id -Raw).Trim()
git push --dry-run origin main
Write-Output "push captain EXIT=$LASTEXITCODE"         # ожидаем 0 (реального push нет: --dry-run)
```

Проверено на машине 2026-10-03: `sh` в PATH pwsh отсутствует (диагностика
фиксируется, hook от этого не отключается), а `git push --dry-run` из чужой
сессии реально упирается в hook — exit 1 и текст «push заблокирован (guard
spec 049, правило 11)». `--dry-run` не отправляет данные и не двигает
`origin/main`: это проверка контура, а не push (правила 10/11).

Ожидаемая матрица:

| Сессия | `close-spec --dry-run` | `sh .githooks/pre-push` | `git push --dry-run` |
| --- | --- | --- | --- |
| капитанская (совпадает с файлом) | 0 | 0 | 0 |
| чужая / `DSH_SESSION_ID=fake` | 2 | 1 | 1 (hook) |
| файла `.project/.captain-session-id` нет | 2 («нет .project/.captain-session-id») | 1 | 1 (hook) |

Проверка «файла нет» — на копии репозитория либо временным переименованием
файла с обязательным возвратом (значение пишет только капитан).

## 6. Почему не env-флаг (важное предупреждение)

Env-флаг (гипотетический `DSH_ROLE` / `DSH_PUSH_AUTHORIZED`) **не изолирует
воркеров**: переменная окружения живёт в общем процессе DSH-сессии, и её видит
каждый агент — и капитан, и любой worker, запущенный внутри той же сессии.
Recon spec 049 (2026-10-03) подтвердил, что таких переменных в платформе
вообще нет: члены команды поднимаются как continuable sub-agent'ы внутри той же
сессии (`@nanmicoder/dsh-agent-teams` 0.1.20), а не как отдельные процессы с
своим окружением.

Изоляцию даёт **только session-id**: `DSH_SESSION_ID` платформа выдаёт каждому
агенту свой (у капитана — `session-86728809-…`, воркер получает собственную
сессию), поэтому сравнение с `.project/.captain-session-id` различает
«кто исполняет» и не подделывается воркером изнутри его же процесса.

Границы guard'а (известные ограничения, зафиксированы осознанно):

- `git push --no-verify` обходит hook технически — но это уже явный обход
  записанного контура, а не «не заметил»; правило 11 (per-command авторизация
  капитана) остаётся в силе.
- Правка `.project/.captain-session-id` или снятие `core.hooksPath` тоже
  является осознанным обходом; файл untracked, поэтому изменение не всплывёт в
  `git status` — факт обхода фиксируется в `.project/log.md`.
- Guard защищает две операции (`spec:close`, `push`), а не всю работу воркера.

## 7. Что делать при блокировке

- `close-spec` вернул 2, а сессия капитанская → сверить значения:
  `node -e "const f=require('node:fs').readFileSync('.project/.captain-session-id','utf8').trim();console.log('file='+JSON.stringify(f)+' env='+JSON.stringify(process.env.DSH_SESSION_ID))"`
  — расхождение лечится Шагом 2, обходной флаг не вводится.
- `pre-push` вернул 1 → push выполняется не из капитанской сессии; push
  отменяется до отдельной per-command авторизации капитана (правила 10/11).
- `core.hooksPath` пуст → guard push не сработает; вернуться к Шагу 1 (STOP с
  диагностикой, а не push «на доверии»).
- Новая машина, guard возвращает 2 из-за отсутствия файла → выполнить SETUP
  целиком (Шаги 1–3), затем §5.

## Ссылки

- `.project/specs/049-fast-track-guards.md` — spec guard'ов (компоненты b, c, d).
- `.gitignore` — исключение `.project/.captain-session-id`.
- `.githooks/pre-push` — guard push; `.githooks/pre-commit` — образец POSIX-sh hook'а.
- `.project/scripts/close-spec.mjs` — guard закрытия (exit 2).
- `.project/log.md` L234, `docs/archive/HANDOFF.md` §13b — breach 048.
- `docs/memory/procedural.md` — запись guard-правила; `docs/memory/alerts.md` —
  реестр инцидентов (в т.ч. починка повреждённых U+FFFD-записей 2026-10-03).
