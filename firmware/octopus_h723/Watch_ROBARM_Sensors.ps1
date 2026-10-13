$ErrorActionPreference = "Stop"

$firmwareRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$python = Join-Path $firmwareRoot ".venv\Scripts\python.exe"
$utility = Join-Path $firmwareRoot "tools\commission.py"

$Host.UI.RawUI.WindowTitle = "ROBARM live sensor monitor - COM5"
Set-Location -LiteralPath $firmwareRoot
Write-Host "ROBARM live sensor monitor" -ForegroundColor Cyan
Write-Host "Watching STOP0..STOP7 on COM5. Press Ctrl+C to stop." -ForegroundColor Yellow
Write-Host ""
& $python -u $utility --port COM5 sensors --watch
