@echo off
rem Para o PocketBase, o front e o app nativo (Expo) do ambiente de desenvolvimento.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\iniciar-dev.ps1" -Parar
pause
