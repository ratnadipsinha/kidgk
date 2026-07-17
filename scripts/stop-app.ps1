# Stops the KidGK backend process started by start-app.ps1 (it serves both
# the API and the pre-built frontend, so there's nothing else to stop).

$root = Split-Path -Parent $PSScriptRoot
$runDir = Join-Path $root ".run"

foreach ($name in @("backend")) {
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
