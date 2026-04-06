# Ярлык в «Автозагрузку» на скрипт в папке проекта (путь к проекту не ломается).
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$vbs = Join-Path $root "Start-AutoSync-Hidden.vbs"
if (-not (Test-Path $vbs)) {
  Write-Error "Не найден: $vbs"
  exit 1
}
$startup = [Environment]::GetFolderPath("Startup")
$lnkPath = Join-Path $startup "NVC-Trainer GitHub Sync.lnk"
$wsh = New-Object -ComObject WScript.Shell
$s = $wsh.CreateShortcut($lnkPath)
$s.TargetPath = $vbs
$s.WorkingDirectory = $root
$s.Description = "Авто-синхронизация NVC Trainer с GitHub"
$s.Save()
Write-Host "Готово. После перезагрузки или следующего входа синхронизация запустится сама."
Write-Host "Ярлык: $lnkPath"
Write-Host "Убрать: удалите этот ярлык из Автозагрузки."
