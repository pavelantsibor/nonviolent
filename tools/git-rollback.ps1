#Requires -Version 5.1
<#
  Просмотр последних коммитов и откат без «магии».
  Запуск из любой папки: powershell -File tools\git-rollback.ps1
  Или из корня репозитория.
#>
param(
  [ValidateSet("list", "soft", "revert", "hard")]
  [string]$Action = "list",
  [int]$Back = 1
)

$ErrorActionPreference = "Stop"
$root = if ($PSScriptRoot) { Split-Path -Parent $PSScriptRoot } else { Get-Location }
Set-Location $root

if (-not (Test-Path (Join-Path $root ".git"))) {
  Write-Error "Не найден .git в $root"
  exit 1
}

function Show-Recent {
  Write-Host "`nПоследние коммиты:`n" -ForegroundColor Cyan
  git --no-pager log --oneline -15
  Write-Host ""
}

switch ($Action) {
  "list" {
    Show-Recent
    Write-Host @"
Действия (выполните вручную или с параметром -Action):

  -Action soft    — убрать последние $Back коммита(ов) из истории, изменения останутся в индексе/рабочей папке (удобно перед исправлением).
  -Action revert  — создать НОВЫЙ коммит, отменяющий последний (безопасно после push на GitHub).
  -Action hard    — ОПАСНО: отбросить последние $Back коммита(ов) и все несохранённые правки в отслеживаемых файлах.

Примеры:
  .\tools\git-rollback.ps1 -Action revert
  .\tools\git-rollback.ps1 -Action soft -Back 1
"@
  }
  "soft" {
    Show-Recent
    if ($Back -lt 1) { throw "Back >= 1" }
    git reset --soft "HEAD~$Back"
    Write-Host "[ok] HEAD сдвинут на $Back комм. назад; изменения сохранены (staged)." -ForegroundColor Green
  }
  "revert" {
    Show-Recent
    git revert HEAD --no-edit
    Write-Host "[ok] Создан коммит отмены. Выполните: git push origin" -ForegroundColor Green
  }
  "hard" {
    Show-Recent
    Write-Host "ВНИМАНИЕ: будут потеряны незакоммиченные изменения в отслеживаемых файлах и последние $Back коммита(ов)." -ForegroundColor Red
    $c = Read-Host "Введите YES для продолжения"
    if ($c -ne "YES") { Write-Host "Отменено."; exit 0 }
    git reset --hard "HEAD~$Back"
    Write-Host "[ok] Жёсткий откат выполнен." -ForegroundColor Yellow
  }
}
