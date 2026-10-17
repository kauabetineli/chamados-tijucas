# Copia os backups automaticos do PocketBase para outro disco ou pasta de rede.
# 1) No painel admin (/_/), em Settings > Backups, ligue o backup automatico
#    (ex.: todo dia as 3h, cron "0 3 * * *", mantendo os 7 ultimos).
# 2) Agende este script no Agendador de Tarefas para rodar depois (ex.: 3h30):
#    powershell -ExecutionPolicy Bypass -File scripts\copiar-backups.ps1 -Destino "D:\BackupChamados"
param([Parameter(Mandatory = $true)][string]$Destino, [int]$Manter = 30)
$ErrorActionPreference = "Stop"

$origem = Join-Path (Split-Path -Parent $PSScriptRoot) "backend\pb_data\backups"
if (-not (Test-Path $origem)) { throw "Ainda nao ha backups em $origem. Ligue o backup automatico no painel." }
New-Item -ItemType Directory -Force -Path $Destino | Out-Null

Get-ChildItem $origem -Filter *.zip | ForEach-Object {
  $alvo = Join-Path $Destino $_.Name
  if (-not (Test-Path $alvo)) { Copy-Item $_.FullName $alvo; Write-Host "Copiado: $($_.Name)" }
}
# mantem so os N mais recentes no destino
Get-ChildItem $Destino -Filter *.zip | Sort-Object LastWriteTime -Descending | Select-Object -Skip $Manter | Remove-Item
Write-Host "Backups em $Destino atualizados."
