@echo off
rem Inicia (ou reinicia) o Dino Desk para desenvolvimento: PocketBase + front + navegador.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\iniciar-dev.ps1" %*
if errorlevel 1 pause
