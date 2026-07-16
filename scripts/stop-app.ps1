# Stops the KidGK backend/frontend processes started by start-app.ps1.

$root = Split-Path -Parent $PSScriptRoot
$runDir = Join-Path $root ".run"

foreach ($name in @("backend", "frontend")) {
    $pidFile = Join-Path $runDir "$name.pid"
    if (Test-Path $pidFile) {
        $procId = Get-Content $pidFile -ErrorAction SilentlyContinue
        if ($procId -and (Get-Process -Id $procId -ErrorAction SilentlyContinue)) {
            Stop-Process -Id $procId -Force
            Write-Host "Stopped $name (PID $procId)."
        }
        Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
    }
}
