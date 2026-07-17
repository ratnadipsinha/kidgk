# Starts the KidGK backend (uvicorn) as a background process, recording its
# PID so stop-app.ps1 / update.ps1 can manage it. The backend serves both
# the API and the pre-built frontend (frontend/dist) on the same port, so
# there's no separate frontend process to track.

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$runDir = Join-Path $root ".run"
New-Item -ItemType Directory -Force -Path $runDir | Out-Null

$backendPidFile = Join-Path $runDir "backend.pid"

function Start-Tracked($Name, $PidFile, $WorkDir, $FilePath, $ArgumentList) {
    if (Test-Path $PidFile) {
        $existing = Get-Content $PidFile -ErrorAction SilentlyContinue
        if ($existing -and (Get-Process -Id $existing -ErrorAction SilentlyContinue)) {
            Write-Host "$Name already running (PID $existing)."
            return
        }
    }
    $proc = Start-Process -FilePath $FilePath -ArgumentList $ArgumentList `
        -WorkingDirectory $WorkDir -WindowStyle Hidden -PassThru
    Set-Content -Path $PidFile -Value $proc.Id
    Write-Host "$Name started (PID $($proc.Id))."
}

$venvPython = Join-Path $root "backend\.venv\Scripts\python.exe"
if (-not (Test-Path $venvPython)) {
    throw "Backend virtual environment not found. Run setup.ps1 first."
}

$frontendDist = Join-Path $root "frontend\dist\index.html"
if (-not (Test-Path $frontendDist)) {
    Write-Warning "frontend\dist not found - the API will work but the UI won't load. Run: cd frontend; npm run build"
}

Start-Tracked -Name "Backend" -PidFile $backendPidFile -WorkDir (Join-Path $root "backend") `
    -FilePath $venvPython -ArgumentList "-m uvicorn main:app --host 0.0.0.0 --port 8000"

Write-Host "KidGK is running: http://localhost:8000"
