param(
    [Parameter(Mandatory = $true)][string]$InstallDir,
    [Parameter(Mandatory = $true)][string]$GroqApiKey
)

$ErrorActionPreference = "Stop"
$logFile = Join-Path $InstallDir "installer\post-install.log"
New-Item -ItemType Directory -Force -Path (Split-Path $logFile) | Out-Null
Start-Transcript -Path $logFile -Append | Out-Null

function Resolve-Tool($Name, $FallbackPath) {
    $cmd = Get-Command $Name -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    if (Test-Path $FallbackPath) { return $FallbackPath }
    throw "$Name not found on PATH or at $FallbackPath"
}

# Freshly-installed git/python/node may not be on PATH yet within this
# process (silent installers update the registry, not our env block), so
# fall back to their default AllUsers install locations.
$git = Resolve-Tool "git" "C:\Program Files\Git\cmd\git.exe"
$python = Resolve-Tool "python" "C:\Program Files\Python312\python.exe"
$npm = Resolve-Tool "npm" "C:\Program Files\nodejs\npm.cmd"

Write-Host "Using git: $git"
Write-Host "Using python: $python"
Write-Host "Using npm: $npm"

Set-Location $InstallDir

Write-Host "== Linking to origin/main so the in-app update button works =="
if (-not (Test-Path (Join-Path $InstallDir ".git"))) {
    & $git init | Out-Null
    & $git remote add origin "https://github.com/ratnadipsinha/kidgk.git"
}
try {
    & $git fetch origin --quiet
    & $git checkout -B main origin/main --force --quiet
    Write-Host "Repo aligned with origin/main."
} catch {
    Write-Warning "No internet (or fetch failed) during install - keeping bundled files. Use the in-app 'Check for updates' button once online."
}

Write-Host "== Backend: virtual environment + dependencies =="
$venvPath = Join-Path $InstallDir "backend\.venv"
if (-not (Test-Path $venvPath)) {
    & $python -m venv $venvPath
}
$venvPython = Join-Path $venvPath "Scripts\python.exe"
& $venvPython -m pip install -r "$InstallDir\backend\requirements.txt" --quiet

Write-Host "== Backend: writing .env =="
$envFile = Join-Path $InstallDir "backend\.env"
$envContent = "GROQ_API_KEY=$GroqApiKey`nGROQ_MODEL=llama-3.3-70b-versatile`n"
# Set-Content -Encoding utf8 writes a BOM in Windows PowerShell 5.1, which
# corrupts the first "GROQ_API_KEY=..." line for python-dotenv (it reads
# the BOM as part of the key name, so the lookup silently fails and every
# round falls back to the offline bank). Write plain UTF-8 without a BOM.
[System.IO.File]::WriteAllText($envFile, $envContent, (New-Object System.Text.UTF8Encoding($false)))

Write-Host "== Frontend: dependencies =="
Push-Location (Join-Path $InstallDir "frontend")
& $npm install --silent
Pop-Location

# Launch-on-demand, not auto-start-at-logon: the installer's Desktop/Start
# Menu shortcuts (see [Icons] in kidgk-setup.iss) run scripts\launch.ps1,
# which opens the app in its own window and stops backend/frontend the
# moment that window closes - nothing runs silently between sessions.
Write-Host "Done. Use the KidGK shortcut (Desktop or Start Menu) to play - closing its window stops the app."
Stop-Transcript | Out-Null
