$ErrorActionPreference = "Stop"
Set-Location "{{PROJECT_ROOT}}"

# Будильник: проверяет метку [f4-checker] в alerts.md, а не mtime файла —
# иначе любая чужая правка выглядела бы как «Сверщик сработал» (устраняет У13).
$alerts = Get-Content "docs\memory\alerts.md" -Raw
$matches = [regex]::Matches($alerts, '(\d{4}-\d{2}-\d{2}).*\[f4-checker\]')
if ($matches.Count -eq 0) {
  Add-Content "docs\memory\alerts.md" "## $(Get-Date -Format yyyy-MM-dd) | [f4-watchdog] Сверщик ещё не запускался"
} else {
  $last = [datetime]::ParseExact($matches[$matches.Count-1].Groups[1].Value, "yyyy-MM-dd", $null)
  $days = ((Get-Date) - $last).Days
  if ($days -gt 2) {
    Add-Content "docs\memory\alerts.md" "## $(Get-Date -Format yyyy-MM-dd) | [f4-watchdog] Сверщик не запускался $days дней"
  }
}
