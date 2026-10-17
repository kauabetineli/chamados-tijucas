# Inicia o Dino Desk para desenvolvimento com um clique (use iniciar.bat na raiz do projeto).
# - na primeira vez: instala as dependencias, baixa o PocketBase e cria o superusuario de teste;
# - abre duas janelas: PocketBase (porta 8090) e front com recarga (porta 5173);
# - se ja estiver rodando, reinicia (util depois de editar pb_hooks, que no Windows nao recarrega sozinho);
# - abre o navegador quando tudo estiver no ar.
# Opcoes:  -Parar (so para tudo)   -SemNavegador
#          -Somente backend|front (reinicia so um dos dois; usado pelo reiniciar.bat)

param([switch]$Parar, [switch]$SemNavegador, [ValidateSet("tudo", "backend", "front")][string]$Somente = "tudo")
$ErrorActionPreference = "Stop"

$raiz = Split-Path -Parent $PSScriptRoot
$backend = Join-Path $raiz "backend"
$frontend = Join-Path $raiz "frontend"
$ferramentas = Join-Path $raiz "ferramentas"
$exe = Join-Path $backend "pocketbase.exe"

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
  Abrir-Janela "Dino Desk - PocketBase (8090)" $backend ".\pocketbase.exe serve"
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

$ip = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
  Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" -and $_.PrefixOrigin -ne "WellKnown" } |
  Select-Object -First 1 -ExpandProperty IPAddress

Write-Host ""
Write-Host "Pronto!" -ForegroundColor Green
Write-Host "  Sistema:       http://localhost:5173"
if ($ip) { Write-Host "  Pelo celular:  http://${ip}:5173  (mesma rede Wi-Fi)" }
Write-Host "  Painel admin:  http://127.0.0.1:8090/_/"
Write-Host ""
Write-Host "Editou pb_hooks ou migrations? reiniciar.bat backend (ou reiniciar.bat para os dois)."
Write-Host "Para parar: parar.bat (ou feche as duas janelas)."

if (-not $SemNavegador) { Start-Process "http://localhost:5173" }
