@echo off
rem Inicia TUDO para desenvolvimento: PocketBase (ouvindo na rede), front com recarga, navegador
rem e o app nativo (Expo) da pasta ..\dinodesk-nativo. Rodar de novo = reiniciar tudo.
rem O celular precisa estar no MESMO Wi-Fi deste PC. Para parar: parar.bat
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\iniciar-dev.ps1" -ComApp %*
if errorlevel 1 pause
