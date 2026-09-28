$ErrorActionPreference = "Stop"
Set-Location "{{PROJECT_ROOT}}"
$dsh = "{{DSH_BIN}}"
$log = ".project\scripts\keepers\checker.log"
New-Item -ItemType Directory -Force -Path (Split-Path $log) | Out-Null
# -Encoding utf8: иначе PowerShell 5.1 пишет лог в UTF-16 и файл нечитаем.
"=== $(Get-Date -Format o) ===" | Out-File $log -Append -Encoding utf8

# --- SHA-skip: без новых коммитов headless не запускаем (F4.2a-iv).
# 5 попыток в день при неизменном HEAD превратились бы в 5 оплаченных вызовов
# модели с одинаковым результатом.
$lastCheckedFile = ".project\scripts\keepers\.last-checked"
$currentSha = (git log -1 --format=%H).Trim()
if (Test-Path $lastCheckedFile) {
  $lastSha = (Get-Content $lastCheckedFile -Raw).Trim()
  if ($lastSha -eq $currentSha) {
    "[$(Get-Date -Format o)] No new commits since $lastSha — skip" | Out-File $log -Append -Encoding utf8
    exit 0
  }
}

# Ключ модели живёт в user-scope окружения Windows; дочерний процесс его не
# наследует, поэтому пробрасываем явно (решение капитана, F4.2a-i).
$env:DEEPSEEK_API_KEY = [Environment]::GetEnvironmentVariable('DEEPSEEK_API_KEY','User')
if (-not $env:DEEPSEEK_API_KEY) {
  "[$(Get-Date -Format o)] DEEPSEEK_API_KEY not available — abort" | Out-File $log -Append -Encoding utf8
  exit 1
}

$prompt = @'
Ты — Сверщик. Проверь ровно эти 4 пункта:
1) state.head в .project/state.json = SHA последнего коммита git log -1?
2) все фазы со status: done в YAML-шапке docs/FACTORY-PLAN.md имеют запись в docs/memory/episodic.md?
3) все файлы, упомянутые в ЧАСТИ 4 плана как созданные, существуют?
4) Отставание state.head от git HEAD на 1 коммит — допустимо (самоссылка из spec 009, следствие amend). Если отставание >1 — это расхождение, перечисли. sync:check в headless НЕ вызывать (sandbox блокирует spawnSync git).
Добавь в docs/memory/alerts.md запись с заголовком:
## YYYY-MM-DD | [f4-checker] результат
Если всё OK — «все проверки OK». Если расхождения — построчно. Не правь ничего другого. Верни одну строку сводки.
'@

# Промпт уходит через временный файл: так он не едет через аргументы командной
# строки, а вывод dsh собирается редиректом cmd — PowerShell 5.1 под
# $ErrorActionPreference = "Stop" завершает скрипт на stderr нативной команды,
# а dsh пишет туда reasoning и вердикт sync:check.
$pf = Join-Path $env:TEMP "f4-checker-prompt.txt"
# WriteAllText + UTF8Encoding($false): Set-Content -Encoding UTF8 дописывает BOM,
# и промпт уезжает в модель испорченным.
[System.IO.File]::WriteAllText($pf, $prompt, (New-Object System.Text.UTF8Encoding($false)))

$js = Join-Path $PSScriptRoot "run-headless.mjs"
cmd /c "node `"$js`" `"$pf`" `"$dsh`" >> `"$log`" 2>&1"
$code = $LASTEXITCODE
Remove-Item $pf -Force -ErrorAction SilentlyContinue
"[$(Get-Date -Format o)] exit=$code" | Out-File $log -Append -Encoding utf8
# Метка «этот HEAD уже сверен» ставится только при успехе: упавший прогон
# должен быть повторён следующей попыткой.
if ($code -eq 0) { $currentSha | Out-File $lastCheckedFile -Encoding utf8 -NoNewline }
exit $code
