# DSH на Windows: почему pwsh, а не Python

Дата: 2026-09-26

## Коротко

PowerShell — не выбор проекта. Это то, что DSH даёт на Windows.
Альтернативы (Python, Bash) не закрывают задачу лучше.

## Три причины

1. В DSH-пресетах жёстко: `dsh-tool-bash` disabled на win32, `dsh-tool-pwsh`
   disabled на не-win32. У агента на Windows есть только pwsh.
2. Python на Windows-стороне не подтверждён как зависимость.
3. Repo-скрипты уже на Node.js (`tools/*.cjs`, `tools/*.mjs`, `npm run *`).

## Где pwsh нас бьёт

- try/catch не ловит ошибки git/native — только $LASTEXITCODE.
- Backticks в @"..."@ интерполируются.
- Add-Content не ставит \n перед содержимым.
- Set-Content добавляет CRLF.
- `\(` + кириллица в двойных кавычках = parse error.
- `.Length-1` без пробелов = parse error.
- Copy-Item не задаёт $LASTEXITCODE (cmdlet, не native).
- $LASTEXITCODE нельзя присваивать (automatic variable).

## Почему не переключаемся

1. Python не установлен — новая зависимость.
2. DSH не даёт tool-python — пришлось бы всё равно идти через pwsh.
3. Repo-инструменты на Node. Три языка хуже, чем два.
4. Все грабли уже задокументированы.

## Как держим pwsh под контролем

- pwsh — только для git-обвязки и файловых операций.
- Сложная логика (regex, Unicode, много кода) — в Node (`tools/*.mjs`).
- Валидация YAML, банка, cosine — уже на Node.

## Когда пересмотрим

Триггер: 10+ pwsh-ловушек накоплено И одна из них стоила >30 минут
отладки. Тогда — пересмотр подхода, не раньше.

## Связанные

- pwsh-git-pitfalls.md — try/catch не ловит git, Copy-Item/$LASTEXITCODE.
- pwsh-cyrillic-escaped-parens.md — pwsh + Cyrillic + экранированные скобки.
- append-content-pitfalls.md — Add-Content не добавляет \n.
