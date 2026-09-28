$ErrorActionPreference = "Stop"
Set-Location "{{PROJECT_ROOT}}"
$dsh = "{{DSH_BIN}}"
$log = ".project\scripts\keepers\cleaner.log"
New-Item -ItemType Directory -Force -Path (Split-Path $log) | Out-Null
# -Encoding utf8: иначе PowerShell 5.1 пишет лог в UTF-16 и файл нечитаем.
"=== $(Get-Date -Format o) ===" | Out-File $log -Append -Encoding utf8

$env:DEEPSEEK_API_KEY = [Environment]::GetEnvironmentVariable('DEEPSEEK_API_KEY','User')
if (-not $env:DEEPSEEK_API_KEY) {
  "[$(Get-Date -Format o)] DEEPSEEK_API_KEY not available — abort" | Out-File $log -Append -Encoding utf8
  exit 1
}

$prompt = @'
Ты — Чистильщик. Прочитай docs/memory/episodic.md. Найди записи старше 14 дней. Предложи свёртку одной заметкой в alerts.md с заголовком:
## YYYY-MM-DD | [f4-cleaner] предложение
Не правь episodic.md и semantic.md. Верни сводку одной строкой.
'@

# См. checker.ps1: временный файл промпта + редирект cmd (обход stderr-ловушки PS 5.1).
$pf = Join-Path $env:TEMP "f4-cleaner-prompt.txt"
# WriteAllText + UTF8Encoding($false): Set-Content -Encoding UTF8 дописывает BOM,
# и промпт уезжает в модель испорченным.
[System.IO.File]::WriteAllText($pf, $prompt, (New-Object System.Text.UTF8Encoding($false)))

$js = Join-Path $PSScriptRoot "run-headless.mjs"
cmd /c "node `"$js`" `"$pf`" `"$dsh`" >> `"$log`" 2>&1"
$code = $LASTEXITCODE
Remove-Item $pf -Force -ErrorAction SilentlyContinue
"[$(Get-Date -Format o)] exit=$code" | Out-File $log -Append -Encoding utf8
exit $code
