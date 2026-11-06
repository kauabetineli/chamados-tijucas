# Gera um .zip pronto para levar ao PC servidor: executavel, regras, migrations e front compilado.
# Rode no computador de desenvolvimento (precisa de Node.js):
#   powershell -ExecutionPolicy Bypass -File scripts\gerar-pacote.ps1
# Producao = branch main. O pacote so sai da main sem alteracoes pendentes
# (para testar um pacote de outra branch: -Forcar). O commit vai no arquivo VERSAO.txt do pacote.
param([switch]$Forcar)
$ErrorActionPreference = "Stop"
$raiz = Split-Path -Parent $PSScriptRoot

Push-Location $raiz
$branch = (git rev-parse --abbrev-ref HEAD).Trim()
$commit = (git rev-parse --short HEAD).Trim()
$pendente = git status --porcelain
Pop-Location
if (-not $Forcar) {
  if ($branch -ne "main") { throw "Pacote de producao so sai da branch main (voce esta em '$branch'). Faca o merge da develop na main, ou use -Forcar para um pacote de teste." }
  if ($pendente) { throw "Ha alteracoes sem commit. Faca o commit (ou descarte) antes de gerar o pacote de producao." }
}

Push-Location (Join-Path $raiz "frontend")
npm install
npm run build
Pop-Location

$backend = Join-Path $raiz "backend"
if (-not (Test-Path (Join-Path $backend "pocketbase.exe"))) { & (Join-Path $PSScriptRoot "baixar-pocketbase.ps1") }

$tmp = Join-Path $env:TEMP "dinodesk-pacote"
Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path "$tmp\backend", "$tmp\scripts" | Out-Null
Copy-Item "$backend\pocketbase.exe" "$tmp\backend\"
Copy-Item "$backend\pb_hooks", "$backend\pb_migrations", "$backend\pb_public" "$tmp\backend\" -Recurse
if (Test-Path "$backend\bin\ffmpeg.exe") { Copy-Item "$backend\bin" "$tmp\backend\" -Recurse } else { Write-Host "Aviso: sem backend\bin\ffmpeg.exe (rode scripts\baixar-ffmpeg.ps1); os videos nao serao comprimidos." }
Copy-Item "$PSScriptRoot\instalar-servico.ps1", "$PSScriptRoot\desinstalar-servico.ps1", "$PSScriptRoot\copiar-backups.ps1", "$PSScriptRoot\atualizar.ps1", "$PSScriptRoot\baixar-ffmpeg.ps1" "$tmp\scripts\"
Copy-Item (Join-Path $raiz "docs\IMPLANTACAO.md") $tmp
$teste = ""; if ($branch -ne "main" -or $pendente) { $teste = " (PACOTE DE TESTE, nao e producao)" }
Set-Content -Path "$tmp\VERSAO.txt" -Encoding ASCII -Value @(
  "Dino Desk - pacote gerado em $(Get-Date -Format 'yyyy-MM-dd HH:mm')$teste",
  "branch: $branch",
  "commit: $commit"
)

$data = Get-Date -Format "yyyy-MM-dd"
$saida = Join-Path $raiz "dinodesk-$data.zip"
Compress-Archive -Path "$tmp\*" -DestinationPath $saida -Force
Remove-Item $tmp -Recurse -Force
Write-Host "Pacote gerado: $saida (commit $commit, branch $branch)"
if (-not $teste) {
  Write-Host "Depois de instalar na Prefeitura, marque a versao em producao:"
  Write-Host "  git tag -a prod-$data -m `"Instalado na Prefeitura em $data`" && git push origin prod-$data"
}
