# Registers a Windows Task Scheduler task that runs update.ps1 every 15 minutes,
# so the target PC's KidGK checkout stays in sync with origin/main automatically.
# Run this once on the target PC (as the user who should own the task).

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$updateScript = Join-Path $root "scripts\update.ps1"
$taskName = "KidGK-AutoUpdate"

$action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$updateScript`""

$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 15) -RepetitionDuration ([TimeSpan]::MaxValue)

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Force `
    -Description "Pulls KidGK updates from origin/main every 15 minutes"

Write-Host "Registered scheduled task '$taskName'. It will run scripts\update.ps1 every 15 minutes."
Write-Host "To remove it later: Unregister-ScheduledTask -TaskName '$taskName' -Confirm:`$false"
