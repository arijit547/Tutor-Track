param([Parameter(Mandatory=$true)][string]$RulesPath)
$listener = Get-NetTCPConnection -LocalPort 8089 -State Listen -ErrorAction SilentlyContinue
foreach ($connection in $listener) {
  $emulatorProcess = Get-CimInstance Win32_Process -Filter "ProcessId = $($connection.OwningProcess)"
  if ($emulatorProcess.Name -eq 'java.exe' -and
      $emulatorProcess.CommandLine.Contains('cloud-firestore-emulator-') -and
      $emulatorProcess.CommandLine.Contains('--project_id demo-tutortrack') -and
      $emulatorProcess.CommandLine.Contains('--port 8089') -and
      $emulatorProcess.CommandLine.Contains($RulesPath)) {
    Stop-Process -Id $emulatorProcess.ProcessId
  }
}
exit 0
