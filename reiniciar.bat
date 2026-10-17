@echo off
rem Reinicia o Dino Desk sem abrir outra aba do navegador (a aba aberta recarrega sozinha).
rem   reiniciar.bat           reinicia PocketBase e front
rem   reiniciar.bat backend   so o PocketBase (depois de editar pb_hooks ou criar migration)
rem   reiniciar.bat front     so o front (depois de criar arquivos novos no frontend)
set ALVO=%1
if "%ALVO%"=="" set ALVO=tudo
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\iniciar-dev.ps1" -SemNavegador -Somente %ALVO%
if errorlevel 1 pause
