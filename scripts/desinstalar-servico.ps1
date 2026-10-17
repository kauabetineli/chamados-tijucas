# Para o sistema e remove a inicializacao automatica. Os dados (backend\pb_data) NAO sao apagados.
# Rode como ADMINISTRADOR.
$ErrorActionPreference = "Stop"
Stop-ScheduledTask -TaskName "DinoDesk" -ErrorAction SilentlyContinue
Unregister-ScheduledTask -TaskName "DinoDesk" -Confirm:$false -ErrorAction SilentlyContinue
Remove-NetFirewallRule -DisplayName "Dino Desk" -ErrorAction SilentlyContinue
Get-Process pocketbase -ErrorAction SilentlyContinue | Stop-Process -Force
Write-Host "Servico removido. Os dados continuam em backend\pb_data."
