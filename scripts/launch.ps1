# Double-click entry point for KidGK. Starts the backend/frontend if not
# already running, opens the app in a dedicated (tab/address-bar-free) Edge
# window, and stops the backend/frontend the moment that window is closed -
# so closing the app window is enough; nothing has to be done by hand.

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

& "$PSScriptRoot\start-app.ps1"

Write-Host "Waiting for the app to come up..."
# Invoke-WebRequest can hang for a long time on a fresh Windows PowerShell
# 5.1 session (its default engine has a WinINET dependency that sometimes
# stalls even against a perfectly reachable localhost endpoint) - a raw
# TCP connect check avoids that entirely and is all we actually need here.
$deadline = (Get-Date).AddSeconds(20)
$ready = $false
while ((Get-Date) -lt $deadline) {
    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $client.Connect("127.0.0.1", 8000)
        $ready = $client.Connected
    } catch {
        $ready = $false
    } finally {
        $client.Close()
    }
    if ($ready) { break }
    Start-Sleep -Milliseconds 500
}
if (-not $ready) {
    Write-Warning "Backend didn't come up in time - opening the app window anyway."
}

function Find-Browser {
    $candidates = @(
        "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
        "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
        "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
        "$env:ProgramFiles\Google\Chrome\Application\chrome.exe"
    )
    foreach ($c in $candidates) {
        if (Test-Path $c) { return $c }
    }
    return $null
}

$browser = Find-Browser

if ($browser) {
    Write-Host "Opening KidGK in an app window..."
    # --app opens a bare window (no tabs/address bar) tied to one process;
    # --user-data-dir isolates it from the user's normal browser profile so
    # it doesn't merge into whatever Edge/Chrome windows are already open.
    $profileDir = Join-Path $root ".run\browser-profile"
    $proc = Start-Process -FilePath $browser -ArgumentList @(
        "--app=http://localhost:8000",
        "--user-data-dir=`"$profileDir`"",
        "--no-first-run"
    ) -PassThru

    Write-Host "KidGK window open (PID $($proc.Id)). Close it to stop the app."
    Wait-Process -Id $proc.Id -ErrorAction SilentlyContinue

    Write-Host "App window closed - stopping the backend..."
    & "$PSScriptRoot\stop-app.ps1"
} else {
    Write-Warning "Could not find Edge or Chrome for app-mode. Opening in your default browser instead - closing that tab will NOT stop the app; run scripts\stop-app.ps1 manually when done."
    Start-Process "http://localhost:8000"
}
