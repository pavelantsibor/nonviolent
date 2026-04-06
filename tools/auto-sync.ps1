#Requires -Version 5.1
<#
Автоматическая отправка проекта на GitHub: раз в несколько секунд проверяет папку,
если есть изменения — делает commit и push. Работает без ручного git commit/push.

ОДИН РАЗ (пока Git не запомнит GitHub):
  - Установите Git для Windows.
  - Откройте PowerShell в этой папке проекта и выполните: git push
  - В браузере войдите в GitHub — дальше пароль не спрашивают.

Запуск: двойной щелчок Start-AutoSync.cmd в корне проекта (или этот файл).
Останов: закройте окно или Ctrl+C.

Автозапуск при входе в Windows: правый щелчок tools\install-autostart.ps1 → «Выполнить с PowerShell»
#>
param(
  [int]$IntervalSeconds = 45
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Continue"

$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

function Test-GitAvailable {
  $null -ne (Get-Command git -ErrorAction SilentlyContinue)
}

function Sync-Once {
  if (-not (Test-Path (Join-Path $RepoRoot ".git"))) {
    Write-Host "[auto-sync] Нет папки .git — это не репозиторий Git."
    return
  }

  $dirty = git status --porcelain 2>$null
  if (-not $dirty) { return }

  git add -A 2>&1 | Out-Null
  git diff --cached --quiet 2>$null
  if ($LASTEXITCODE -eq 0) {
    return
  }

  $msg = "chore: авто-синхронизация $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
  git commit -m $msg 2>&1
  if ($LASTEXITCODE -ne 0) {
    Write-Host "[auto-sync] Не удалось сделать commit. Задайте имя и почту Git (один раз):"
    Write-Host "  git config user.email `"you@example.com`""
    Write-Host "  git config user.name `"Ваше имя`""
    return
  }

  $branch = git branch --show-current 2>$null
  if (-not $branch) { $branch = "master" }

  Write-Host "[auto-sync] Отправка на GitHub (ветка $branch)..."
  git push -u origin $branch 2>&1 | ForEach-Object { Write-Host $_ }
  if ($LASTEXITCODE -ne 0) {
    Write-Host "[auto-sync] Ошибка push. Проверьте интернет и доступ к github.com/pavelantsibor/nonviolent"
  } else {
    Write-Host "[auto-sync] Готово."
  }
}

if (-not (Test-GitAvailable)) {
  Write-Host "Установите Git: https://git-scm.com/download/win"
  Read-Host "Нажмите Enter"
  exit 1
}

Write-Host "Авто-синхронизация с GitHub. Интервал проверки: $IntervalSeconds с."
Write-Host "Папка: $RepoRoot"
Write-Host "Останов: Ctrl+C или закройте окно.`n"

while ($true) {
  try {
    Sync-Once
  } catch {
    Write-Host "[auto-sync] Ошибка: $_"
  }
  Start-Sleep -Seconds $IntervalSeconds
}
