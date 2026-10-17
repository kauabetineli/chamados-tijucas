# Baixa o executavel oficial do PocketBase (Windows 64 bits) para a pasta backend.
# Uso:  powershell -ExecutionPolicy Bypass -File scripts\baixar-pocketbase.ps1
# A versao fica fixa de proposito: nao atualize durante o projeto sem testar antes.

$ErrorActionPreference = "Stop"
$versao = "0.40.4"
$raiz = Split-Path -Parent $PSScriptRoot
$backend = Join-Path $raiz "backend"
$zip = Join-Path $env:TEMP "pocketbase_$versao.zip"
$url = "https://github.com/pocketbase/pocketbase/releases/download/v$versao/pocketbase_${versao}_windows_amd64.zip"

Write-Host "Baixando PocketBase $versao..."
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
Invoke-WebRequest -Uri $url -OutFile $zip -UseBasicParsing
Expand-Archive -Path $zip -DestinationPath $backend -Force
Remove-Item $zip
Write-Host "Pronto: $backend\pocketbase.exe"
& (Join-Path $backend "pocketbase.exe") --version
