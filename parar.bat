@echo off
rem Para o PocketBase e o front do ambiente de desenvolvimento.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\iniciar-dev.ps1" -Parar
pause
