# Inicia o Dino Desk para desenvolvimento com um clique (use iniciar.bat na raiz do projeto).
# - na primeira vez: instala as dependencias, baixa o PocketBase e cria o superusuario de teste;
# - abre duas janelas: PocketBase (porta 8090) e front com recarga (porta 5173);
# - se ja estiver rodando, reinicia (util depois de editar pb_hooks, que no Windows nao recarrega sozinho);
# - abre o navegador quando tudo estiver no ar.
# Opcoes:  -Parar (so para tudo, inclusive o app nativo)   -SemNavegador
#          -Somente backend|front (reinicia so um dos dois; usado pelo reiniciar.bat)
#          -ComApp (usado pelo iniciar-tudo.bat): PocketBase ouvindo na rede + app nativo (Expo) de ..\dinodesk-nativo

param([switch]$Parar, [switch]$SemNavegador, [switch]$ComApp, [ValidateSet("tudo", "backend", "front")][string]$Somente = "tudo")
$ErrorActionPreference = "Stop"

$raiz = Split-Path -Parent $PSScriptRoot
$backend = Join-Path $raiz "backend"
$frontend = Join-Path $raiz "frontend"
$ferramentas = Join-Path $raiz "ferramentas"
$exe = Join-Path $backend "pocketbase.exe"
$nativo = Join-Path (Split-Path -Parent $raiz) "dinodesk-nativo"

function Parar-Porta([int]$porta) {
  $conexoes = Get-NetTCPConnection -LocalPort $porta -State Listen -ErrorAction SilentlyContinue
  foreach ($c in $conexoes) {
    if ($c.OwningProcess -gt 0) {
      Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue
      Write-Host "  parado o que rodava na porta $porta"
    }
  }
}

function Esperar-Url([string]$url, [int]$segundos) {
  for ($i = 0; $i -lt $segundos; $i++) {
    try {
      Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2 | Out-Null
      return $true
    } catch { Start-Sleep -Seconds 1 }
  }
  return $false
}

function Abrir-Janela([string]$titulo, [string]$pasta, [string]$comando) {
  $script = "`$host.UI.RawUI.WindowTitle = '$titulo'; Set-Location '$pasta'; $comando"
  Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $script | Out-Null
}

Write-Host ""
Write-Host "Dino Desk - ambiente de desenvolvimento" -ForegroundColor Cyan

$fazBackend = $Somente -ne "front"
$fazFront = $Somente -ne "backend"

# PocketBase na rede (0.0.0.0) para o celular alcancar: pedido pelo -ComApp, ou mantido se ja estava assim
# (assim um "reiniciar.bat backend" depois do iniciar-tudo.bat nao tira o app nativo do ar)
$naRede = $ComApp -or [bool](Get-NetTCPConnection -LocalPort 8090 -State Listen -ErrorAction SilentlyContinue |
  Where-Object { $_.LocalAddress -eq "0.0.0.0" -or $_.LocalAddress -eq "::" })

# para o que estiver rodando (reinicio) e fecha as janelas abertas por uma execucao anterior
if ($fazBackend) {
  Parar-Porta 8090
  Get-Process powershell -ErrorAction SilentlyContinue |
    Where-Object { $_.MainWindowTitle -like "Dino Desk - PocketBase*" } |
    Stop-Process -Force -ErrorAction SilentlyContinue
}
if ($fazFront) {
  Parar-Porta 5173
  Get-Process powershell -ErrorAction SilentlyContinue |
    Where-Object { $_.MainWindowTitle -like "Dino Desk - front*" } |
    Stop-Process -Force -ErrorAction SilentlyContinue
}
# app nativo (Expo, porta 8081): para no -Parar e reinicia no -ComApp
if ($Parar -or $ComApp) {
  Parar-Porta 8081
  Get-Process cmd -ErrorAction SilentlyContinue |
    Where-Object { $_.MainWindowTitle -like "*Dino Desk - app nativo*" } |
    Stop-Process -Force -ErrorAction SilentlyContinue
}
if ($Parar) { Write-Host "Tudo parado."; exit 0 }

# pre-requisitos
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Node.js nao encontrado. Instale a versao LTS em https://nodejs.org e rode de novo."
}
if (-not (Test-Path $exe)) {
  Write-Host "Baixando o PocketBase (so na primeira vez)..."
  & powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "baixar-pocketbase.ps1")
}
if (-not (Test-Path (Join-Path $frontend "node_modules"))) {
  Write-Host "Instalando dependencias do front (so na primeira vez)..."
  Push-Location $frontend; npm install; Pop-Location
}
if ((Test-Path (Join-Path $ferramentas "package.json")) -and -not (Test-Path (Join-Path $ferramentas "node_modules"))) {
  Write-Host "Instalando dependencias das ferramentas de IA (so na primeira vez)..."
  Push-Location $ferramentas; npm install --no-audit --no-fund; Pop-Location
}
if (-not (Test-Path (Join-Path $backend "pb_data"))) {
  Write-Host "Criando o banco e o superusuario de teste (admin@local.dev / SenhaForte123)..."
  Push-Location $backend; & $exe superuser upsert admin@local.dev SenhaForte123 | Out-Null; Pop-Location
}
if (-not (Test-Path (Join-Path $backend "bin\ffmpeg.exe"))) {
  Write-Host "  aviso: sem ffmpeg os videos nao sao comprimidos (scripts\baixar-ffmpeg.ps1)" -ForegroundColor Yellow
}

# sobe o PocketBase e espera responder
if ($fazBackend) {
  Write-Host "Iniciando o PocketBase..."
  if ($naRede) {
    Abrir-Janela "Dino Desk - PocketBase na rede (8090)" $backend ".\pocketbase.exe serve --http 0.0.0.0:8090"
  } else {
    Abrir-Janela "Dino Desk - PocketBase (8090)" $backend ".\pocketbase.exe serve"
  }
  if (-not (Esperar-Url "http://127.0.0.1:8090/api/health" 30)) {
    throw "O PocketBase nao respondeu. Veja a mensagem de erro na janela dele."
  }
}

# sobe o front
if ($fazFront) {
  Write-Host "Iniciando o front..."
  Abrir-Janela "Dino Desk - front (5173)" $frontend "npm run dev -- --strictPort"
  if (-not (Esperar-Url "http://localhost:5173" 60)) {
    throw "O front nao respondeu. Veja a mensagem de erro na janela dele."
  }
}

# app nativo: abre o iniciar-app.bat do dinodesk-nativo numa janela propria (ele grava o .env com o IP,
# confere as dependencias e mostra o QR code do Expo Go; o PocketBase ja esta na rede, entao ele nao sobe outro)
$appAberto = $false
if ($ComApp) {
  $bat = Join-Path $nativo "iniciar-app.bat"
  if (Test-Path $bat) {
    Write-Host "Iniciando o app nativo (Expo)..."
    Start-Process cmd -ArgumentList "/c", "`"$bat`"" -WorkingDirectory $nativo | Out-Null
    $appAberto = $true
  } else {
    Write-Host "  aviso: nao achei $bat (o app nativo fica de fora)." -ForegroundColor Yellow
    Write-Host "  Clone o dinodesk-nativo ao lado desta pasta: $(Split-Path -Parent $raiz)" -ForegroundColor Yellow
  }
}

$ip = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
  Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" -and $_.PrefixOrigin -ne "WellKnown" } |
  Select-Object -First 1 -ExpandProperty IPAddress

Write-Host ""
Write-Host "Pronto!" -ForegroundColor Green
Write-Host "  Sistema:       http://localhost:5173"
if ($ip) { Write-Host "  Pelo celular:  http://${ip}:5173  (mesma rede Wi-Fi)" }
Write-Host "  Painel admin:  http://127.0.0.1:8090/_/"
if ($appAberto) { Write-Host "  App nativo:    leia o QR code da janela do Expo com o Expo Go (mesma rede Wi-Fi)" }
if ($naRede) { Write-Host "  (PocketBase ouvindo na rede; se o Firewall perguntar, permita em Redes privadas)" }
Write-Host ""
Write-Host "Editou pb_hooks ou migrations? reiniciar.bat backend (ou reiniciar.bat para os dois)."
Write-Host "Para parar: parar.bat (ou feche as janelas)."

if (-not $SemNavegador) { Start-Process "http://localhost:5173" }
