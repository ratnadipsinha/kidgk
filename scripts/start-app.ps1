# Starts the KidGK backend (uvicorn) and frontend (vite preview) as background
# processes, recording their PIDs so stop-app.ps1 / update.ps1 can manage them.

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$runDir = Join-Path $root ".run"
New-Item -ItemType Directory -Force -Path $runDir | Out-Null

$backendPidFile = Join-Path $runDir "backend.pid"
$frontendPidFile = Join-Path $runDir "frontend.pid"

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

Start-Tracked -Name "Backend" -PidFile $backendPidFile -WorkDir (Join-Path $root "backend") `
    -FilePath $venvPython -ArgumentList "-m uvicorn main:app --host 0.0.0.0 --port 8000"

$viteJs = Join-Path $root "frontend\node_modules\vite\bin\vite.js"
if (-not (Test-Path $viteJs)) {
    throw "Frontend dependencies not found. Run setup.ps1 first."
}
# Launched as `node vite.js` directly (not `npm run dev` or vite.cmd) so the
# tracked PID is the actual server process. Both npm.cmd and vite.cmd are
# batch wrappers that exec node.exe as a *child* process on Windows - killing
# the wrapper's PID leaves that child (and the listening port) running.
Start-Tracked -Name "Frontend" -PidFile $frontendPidFile -WorkDir (Join-Path $root "frontend") `
    -FilePath "node" -ArgumentList "`"$viteJs`" --host 0.0.0.0 --port 5173"

Write-Host "KidGK is running: http://localhost:5173"
