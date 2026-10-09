# Atualiza o sistema no PC servidor sem perder dados.
# 1) Extraia o pacote novo por cima da pasta atual (pb_data nao vem no pacote, entao fica intacto).
# 2) Rode este script como ADMINISTRADOR. As migrations novas rodam sozinhas ao iniciar.
$ErrorActionPreference = "Stop"
Stop-ScheduledTask -TaskName "DinoDesk" -ErrorAction SilentlyContinue
Get-Process pocketbase -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2
Start-ScheduledTask -TaskName "DinoDesk"
Write-Host "Sistema reiniciado com a versao nova."
