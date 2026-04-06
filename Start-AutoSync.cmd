@echo off
chcp 65001 >nul
cd /d "%~dp0"
title NVC Trainer — синхронизация с GitHub
echo Запуск авто-синхронизации... Закройте это окно, чтобы остановить.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\auto-sync.ps1"
pause
