# One-shot setup for a target PC. Run this once after cloning the repo:
#
#   git clone https://github.com/ratnadipsinha/kidgk.git
#   cd kidgk
#   powershell -ExecutionPolicy Bypass -File scripts\setup.ps1
#
# After this finishes, the app is running locally AND will keep pulling
# and applying updates from origin/main automatically (every 15 minutes),
# restarting itself whenever new code lands.

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

function Require-Command($Name, $HelpUrl) {
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "$Name is required but wasn't found on PATH. Install it from $HelpUrl and re-run this script."
    }
}

Write-Host "== 1/6: Checking prerequisites ==" -ForegroundColor Cyan
Require-Command "git" "https://git-scm.com/downloads"
Require-Command "python" "https://www.python.org/downloads/"
Require-Command "npm" "https://nodejs.org/"
Write-Host "git, python, npm all found."

Write-Host "== 2/6: Backend - virtual environment + dependencies ==" -ForegroundColor Cyan
$venvPath = Join-Path $root "backend\.venv"
if (-not (Test-Path $venvPath)) {
    python -m venv $venvPath
}
$venvPython = Join-Path $venvPath "Scripts\python.exe"
& $venvPython -m pip install -r "$root\backend\requirements.txt" --quiet
Write-Host "Backend dependencies installed."

Write-Host "== 3/6: Backend - API key ==" -ForegroundColor Cyan
$envFile = Join-Path $root "backend\.env"
if (-not (Test-Path $envFile)) {
    Copy-Item "$root\backend\.env.example" $envFile
    $key = Read-Host "Enter your Groq API key (from console.groq.com), or leave blank to use the offline fallback bank for now"
    if ($key) {
        (Get-Content $envFile) -replace "your_groq_api_key_here", $key | Set-Content $envFile
        Write-Host "Groq API key saved to backend\.env."
    } else {
        Write-Host "No key entered - the app will use the offline fallback question bank until backend\.env is updated."
    }
} else {
    Write-Host "backend\.env already exists - leaving it as is."
}

Write-Host "== 4/6: Frontend - dependencies ==" -ForegroundColor Cyan
Push-Location "$root\frontend"
npm install --silent
Pop-Location
Write-Host "Frontend dependencies installed."

Write-Host "== 5/6: Registering auto-update task ==" -ForegroundColor Cyan
$taskName = "KidGK-AutoUpdate"
$existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "Scheduled task '$taskName' already registered - skipping."
} else {
    & "$PSScriptRoot\register-auto-update.ps1"
}

Write-Host "== 6/6: Starting the app ==" -ForegroundColor Cyan
& "$PSScriptRoot\start-app.ps1"

Write-Host ""
Write-Host "Setup complete." -ForegroundColor Green
Write-Host "  App running at:      http://localhost:5173"
Write-Host "  Auto-update task:    KidGK-AutoUpdate (checks origin/main every 15 min)"
Write-Host "  Stop the app with:   scripts\stop-app.ps1"
Write-Host "  Manual update check: scripts\update.ps1"
