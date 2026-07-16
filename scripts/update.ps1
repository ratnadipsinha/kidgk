# Pulls the latest KidGK source and reinstalls dependencies on a target PC.
# Run manually, or register via scripts\register-auto-update.ps1 for a recurring pull.

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

Set-Location $root

Write-Host "Checking for updates..."
git fetch origin
$local = git rev-parse HEAD
$remote = git rev-parse origin/main

if ($local -eq $remote) {
    Write-Host "Already up to date."
    exit 0
}

Write-Host "Pulling latest changes..."
git pull origin main

if (Test-Path "$root\backend\requirements.txt") {
    Write-Host "Updating backend dependencies..."
    & python -m pip install -r "$root\backend\requirements.txt" --quiet
}

if (Test-Path "$root\frontend\package.json") {
    Write-Host "Updating frontend dependencies..."
    Push-Location "$root\frontend"
    npm install --silent
    Pop-Location
}

Write-Host "KidGK updated to $((git rev-parse --short HEAD))."
