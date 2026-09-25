# DSH: pwsh + git — подводные камни

Дата: 2026-09-26
Контекст: закрытие M1.5, push коммита 5bb7778.

## Проблема 1: try/catch не ловит ошибки git

Стандартный паттерн:

    try { git fetch origin } catch { $fetchOk = $false }

Не работает. pwsh не преобразует stderr нативных команд (git, node, ssh)
в PowerShell-исключения. Переменная `$fetchOk` остаётся `$true`, даже
если fetch упал.

## Решение

Проверять `$LASTEXITCODE` после каждой нативной команды:

    git fetch origin
    if ($LASTEXITCODE -ne 0) { $fetchOk = $false }

## Проблема 2: fetch/push падают с exit 128

Под sandbox (workspace-write или ограниченный danger-full-access)
git fetch/push падают с:

    ssh.exe: couldn't create signal pipe, Win32 error 5
    fatal: Could not read from remote repository

Причина: sandbox запрещает named pipes, которые ssh использует для
взаимодействия. `$LASTEXITCODE` = 128.

## Решение

Запросить escalation до полного `danger-full-access`. После этого
fetch/push работают штатно. Не пытаться обходить (--no-verify, разные
SSH-опции) — это не помогает.

## Проверка

- После fetch: `$LASTEXITCODE -eq 0` И `git rev-list --left-right --count
  origin/main...HEAD` вернул числа (не ошибку).
- После push: `git log origin/main -1 --oneline` содержит новый хеш.

## Примечание: ahead 0 может быть ложным

`git status -sb` без `[ahead N]` опирается на *локальный* ref
`origin/main`. Если fetch упал (Проблема 2), этот ref не обновлён, и
"ahead 0" ничего не говорит о состоянии удалёнки. Перед выводом
"синхронизировано" — проверить, что fetch прошёл (`$LASTEXITCODE -eq 0`).

## Copy-Item не задаёт $LASTEXITCODE

Copy-Item — cmdlet PowerShell, не native-программа. После его вызова
$LASTEXITCODE сохраняет значение от предыдущей native-команды (git, node, wsl).

Ошибка: проверять `if ($LASTEXITCODE -ne 0) { throw }` после Copy-Item.

Правильно:
  Copy-Item -Path $src -Destination $dst -Force -ErrorAction Stop
  if (-not (Test-Path $dst)) { throw "copy failed" }
  # опционально: SHA256-сверка src/dst

## $LASTEXITCODE — automatic variable, не присваивать

Присваивание `$LASTEXITCODE = $value` создаёт локальную переменную, которая
затеняет automatic variable. Последующие native-команды обновляют global,
но read возвращает затенённую — значение от присваивания.

Ошибка: сохранить exit-код через `$LASTEXITCODE = ...` и потом читать его.

Правильно: своя переменная.
  $myExit = $LASTEXITCODE
  # ... позже проверять $myExit
