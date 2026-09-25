# Node.js: скрипт в %TEMP% не видит node_modules из $DSH_HOME\profiles

Дата: 2026-09-26
Контекст: M2.3, валидация YAML-контракта через js-yaml.

## Проблема

Скрипт, записанный в %TEMP% и запущенный через:
  node "$env:TEMP\validate.js" "$target"
падает с ошибкой:
  Error: Cannot find module 'js-yaml'
  code: 'MODULE_NOT_FOUND'
  requireStack: [...]

Причина: Node.js ищет node_modules в трёх местах:
- от cwd,
- от расположения скрипта (скрипт в %TEMP%, там node_modules нет),
- от путей в NODE_PATH (пусто).

Пакет js-yaml установлен в $DSH_HOME\profiles\node_modules, который Node
не проверяет автоматически.

## Решение 1 (применено в M2.3)

Передавать абсолютный путь как аргумент и делать require() по нему:

  $jsYamlPath = "$env:DSH_HOME\profiles\node_modules\js-yaml"
  node "$env:TEMP\validate.js" "$jsYamlPath" "$target"

В скрипте:
  const yaml = require(process.argv[2]);

## Решение 2 — NODE_PATH

  $env:NODE_PATH = "$env:DSH_HOME\profiles\node_modules"
  node "$env:TEMP\validate.js" "$target"

## Решение 3 — module.paths

В начале скрипта:
  module.paths.push("<abs path to node_modules parent>");

## Проверка

Если node-скрипт из %TEMP% даёт MODULE_NOT_FOUND и модуль точно установлен —
это скорее всего эта ловушка. Проверить:
  Test-Path "$env:DSH_HOME\profiles\node_modules\<module>"
  node -e "console.log(require.resolve('<module>'))"

## Связанные

- pwsh-cyrillic-escaped-parens.md — паттерн «скрипт в %TEMP% + &».
- why-pwsh.md — почему мы работаем через pwsh и Node.
