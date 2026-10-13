$ErrorActionPreference = "Stop"

$commanderRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$packageFile = Join-Path $commanderRoot "package.json"
$modules = Join-Path $commanderRoot "node_modules"

if (-not (Test-Path -LiteralPath $packageFile)) {
    throw "ROBARM Commander package is missing: $packageFile"
}

if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
    throw "Node.js and npm are required. Install Node.js 22 or newer, then try again."
}

Set-Location -LiteralPath $commanderRoot
if (-not (Test-Path -LiteralPath $modules)) {
    & npm.cmd install
    if ($LASTEXITCODE -ne 0) { throw "ROBARM Commander dependency installation failed." }
}

& npm.cmd run dev
if ($LASTEXITCODE -ne 0) { throw "ROBARM Commander exited with code $LASTEXITCODE." }

