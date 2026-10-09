# Instala o sistema para iniciar sozinho quando o PC servidor liga.
# Rode como ADMINISTRADOR no PC que vai ser o servidor:
#   powershell -ExecutionPolicy Bypass -File scripts\instalar-servico.ps1
# Opcional: -Porta 8080 (padrao 80, assim o endereco fica http://IP-do-PC sem porta)

param([int]$Porta = 80)
$ErrorActionPreference = "Stop"

$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  throw "Abra o PowerShell como Administrador e rode de novo."
}

$raiz = Split-Path -Parent $PSScriptRoot
$backend = Join-Path $raiz "backend"
$exe = Join-Path $backend "pocketbase.exe"
if (-not (Test-Path $exe)) { throw "Nao achei $exe. Rode antes: scripts\baixar-pocketbase.ps1" }
if (-not (Test-Path (Join-Path $backend "pb_public\index.html"))) {
  throw "Nao achei o front compilado em backend\pb_public. Rode 'npm run build' na pasta frontend (ou use o pacote gerado por scripts\gerar-pacote.ps1)."
}

$nome = "DinoDesk"
$argumentos = "serve --http 0.0.0.0:$Porta " +
  "--dir `"$backend\pb_data`" --publicDir `"$backend\pb_public`" " +
  "--hooksDir `"$backend\pb_hooks`" --migrationsDir `"$backend\pb_migrations`""

$acao = New-ScheduledTaskAction -Execute $exe -Argument $argumentos -WorkingDirectory $backend
$gatilho = New-ScheduledTaskTrigger -AtStartup
$conta = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$config = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
  -StartWhenAvailable -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) `
  -ExecutionTimeLimit (New-TimeSpan -Seconds 0)

Unregister-ScheduledTask -TaskName $nome -Confirm:$false -ErrorAction SilentlyContinue
Register-ScheduledTask -TaskName $nome -Action $acao -Trigger $gatilho -Principal $conta -Settings $config `
  -Description "Dino Desk - Chamados do Departamento de TI (PocketBase)" | Out-Null

# libera a porta so na rede interna (perfis Dominio e Privado)
Remove-NetFirewallRule -DisplayName "Dino Desk" -ErrorAction SilentlyContinue
New-NetFirewallRule -DisplayName "Dino Desk" -Direction Inbound -Protocol TCP -LocalPort $Porta `
  -Action Allow -Profile Domain,Private | Out-Null

Start-ScheduledTask -TaskName $nome
Start-Sleep -Seconds 3

$ips = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" }).IPAddress
$sufixo = if ($Porta -eq 80) { "" } else { ":$Porta" }
Write-Host ""
Write-Host "Dino Desk instalado e rodando."
foreach ($ip in $ips) { Write-Host "  Sistema:       http://$ip$sufixo" }
foreach ($ip in $ips) { Write-Host "  Painel admin:  http://$ip$sufixo/_/" }
Write-Host ""
Write-Host "Proximo passo: abra o painel admin neste PC e crie a conta de superusuario."
Write-Host "Se a rede do Windows estiver como 'Publica', mude para 'Privada' ou o firewall bloqueia o acesso."
