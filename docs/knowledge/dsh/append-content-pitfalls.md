# DSH: Add-Content и запись в DECISIONS.md

Дата: 2026-09-26
Контекст: серия правок .project/DECISIONS.md (M1.5, M2, мини-фиксы).

## Проблема

Паттерн записи в конец файла:

    Add-Content -Path .project/DECISIONS.md -Value $text -NoNewline

Не добавляет перевод строки ПЕРЕД содержимым. Если файл не заканчивается
символом \n (а .project/DECISIONS.md исторически именно такой),
новая запись приклеивается к последней строке предыдущей:

    - **Decided-by:** Капитан + Orchestrator.## 2026-09-26 · Архитектура M2

Заголовок `## 2026-09-26` сливается с `Decided-by` — markdown-структура
ломается, при следующем чтении агент не видит новую запись.

## Проявление

- Случилось минимум 3 раза (M1.5, M2 архитектура, мини-фиксы).
- `Test-Path` и `Get-Item` показывают, что файл есть — баг невидим
  на уровне «файл на месте».
- `Select-String "M1.5 закрыт"` находит 1 совпадение — но не проверяет
  разделители вокруг него.

## Надёжный шаблон

### Вариант 1 — сначала \n, потом содержимое

    $text = @'
## 2026-09-26 · Заголовок
- **Decision:** ...
- **Decided-by:** Капитан + Orchestrator.
'@

    $bytes = [System.IO.File]::ReadAllBytes($path)
    $hasTrailingNewline = ($bytes[$bytes.Length - 1] -eq 10)

    if ($hasTrailingNewline) {
        Add-Content -Path $path -Value ("`n" + $text) -NoNewline -Encoding UTF8
    } else {
        Add-Content -Path $path -Value ("`n`n" + $text) -NoNewline -Encoding UTF8
    }

### Вариант 2 — собрать целиком, записать один раз

    $existing = [System.IO.File]::ReadAllText($path, [Text.Encoding]::UTF8)
    $separator = if ($existing.EndsWith("`n")) { "`n" } else { "`n`n" }
    $result = $existing + $separator + $text
    [System.IO.File]::WriteAllText($path, $result, [Text.UTF8Encoding]::new($false))

Вариант 2 предпочтительнее: одна операция записи, атомарно, без Add-Content.

## Проверка после записи

Всегда проверять границу записи:

    Get-Content .project/DECISIONS.md -Encoding UTF8 | Select-Object -Last 8

Ожидаемо: последние 8 строк содержат пустую строку перед заголовком
новой записи. Если пустой строки нет — запись приклеилась, надо
перезаписать.

## Связанные

- pwsh-git-pitfalls.md — про try/catch и exit 128.

## @'...'@ теряет trailing LF

Single-quoted here-string `@'...'@` съедает завершающий перевод строки
перед закрывающим `'@`. Если последняя содержательная строка контента — `text`,
то после WriteAllText файл закончится на `text`, без LF.

Следствие: следующий append через `+=` даст `textNextContent` (склейка
без разделителя), что ломает Markdown и последующие diff.

Правильно:
  $content = @'
  ...многострочный текст...
  '@
  # добавить LF вручную, если нужно:
  $content += "`n"
  [System.IO.File]::WriteAllText($path, $content, [System.Text.UTF8Encoding]::new($false))

Проверка после записи:
  $bytes = [System.IO.File]::ReadAllBytes($path)
  $lastIsLF = ($bytes[$bytes.Length - 1] -eq 0x0A)
  if (-not $lastIsLF) { throw "trailing LF отсутствует" }

## Три случая в проекте — одна семья

1. Add-Content не ставит \n перед содержимым (см. выше).
2. Set-Content добавляет CRLF на Windows.
3. @'...'@ срезает trailing LF.

Все три — про потерю контроля над переводом строки на границе записи.
Общее правило: после WriteAllText ВСЕГДА проверять последний байт = 0x0A.
