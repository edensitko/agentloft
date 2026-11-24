# Runs Agentloft in the background on Windows and starts it again at login.
#   powershell -ExecutionPolicy Bypass -File scripts\install-windows.ps1             install and start
#   powershell -ExecutionPolicy Bypass -File scripts\install-windows.ps1 uninstall   stop and remove
param([string]$Action = 'install')
$ErrorActionPreference = 'Stop'
$Name = 'Agentloft'
$Root = Split-Path -Parent $PSScriptRoot
if ($Action -eq 'uninstall') {
  Stop-ScheduledTask -TaskName $Name -ErrorAction SilentlyContinue
  Unregister-ScheduledTask -TaskName $Name -Confirm:$false -ErrorAction SilentlyContinue
  Write-Host 'Agentloft was removed.'; exit 0
}
$Node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $Node) { Write-Error 'node was not found on PATH. Install Node.js 22 or newer first.' }
if (-not (Test-Path (Join-Path $Root 'node_modules\three'))) { Write-Error "Dependencies are missing. Run 'npm install' in $Root first." }
$Server = Join-Path $Root 'server\index.js'
$Run = New-ScheduledTaskAction -Execute "$env:SystemRoot\System32\conhost.exe" -Argument "--headless `"$Node`" `"$Server`"" -WorkingDirectory $Root
$When = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME"
$How = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([TimeSpan]::Zero)
Register-ScheduledTask -TaskName $Name -Action $Run -Trigger $When -Settings $How -Force | Out-Null
Start-ScheduledTask -TaskName $Name
Write-Host 'Agentloft is running at http://localhost:4455 and will start at login.'
