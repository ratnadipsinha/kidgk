# Pulls the latest KidGK source and reinstalls dependencies on a target PC.
# Triggered by the "Check for updates" button in the app (POST /api/update/apply),
# or run directly for a manual check.

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$runDir = Join-Path $root ".run"

Set-Location $root

Write-Host "Checking for updates..."
git fetch origin
$local = git rev-parse HEAD
$remote = git rev-parse origin/main

if ($local -eq $remote) {
    Write-Host "Already up to date."
    exit 0
}

# Was the app running before we touch anything? Restart it after updating
# only if it was already up - this script shouldn't start the app cold.
$backendPidFile = Join-Path $runDir "backend.pid"
$wasRunning = $false
if (Test-Path $backendPidFile) {
    $existing = Get-Content $backendPidFile -ErrorAction SilentlyContinue
    if ($existing -and (Get-Process -Id $existing -ErrorAction SilentlyContinue)) {
        $wasRunning = $true
    }
}

if ($wasRunning) {
    Write-Host "Stopping running app before update..."
    & "$PSScriptRoot\stop-app.ps1"
}

Write-Host "Pulling latest changes..."
git pull origin main

if (Test-Path "$root\backend\requirements.txt") {
    Write-Host "Updating backend dependencies..."
    $venvPip = Join-Path $root "backend\.venv\Scripts\python.exe"
    if (Test-Path $venvPip) {
        & $venvPip -m pip install -r "$root\backend\requirements.txt" --quiet
    } else {
        & python -m pip install -r "$root\backend\requirements.txt" --quiet
    }
}

# No npm install step: frontend/dist is a pre-built static bundle committed
# to git, so `git pull` above already refreshed it. The target PC doesn't
# need Node.js installed at all.

if ($wasRunning) {
    Write-Host "Restarting app with updated code..."
    & "$PSScriptRoot\start-app.ps1"
}

Write-Host "KidGK updated to $((git rev-parse --short HEAD))."
