' Запуск авто-синхронизации без окна (фон). Двойной щелчок = скрипт работает тихо.
Dim fso, sh, proj, ps1
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
proj = fso.GetParentFolderName(WScript.ScriptFullName)
ps1 = proj & "\tools\auto-sync.ps1"
sh.Run "powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & ps1 & """", 0, False
