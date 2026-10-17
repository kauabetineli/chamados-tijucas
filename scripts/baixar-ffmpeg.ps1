# Baixa o ffmpeg (Windows 64 bits) para backend\bin. Ele comprime os videos enviados pelo celular.
# Sem ele o sistema funciona, mas os videos ficam no tamanho original (e o HEVC do iPhone
# pode nao abrir no Chrome do Windows).
# Uso:  powershell -ExecutionPolicy Bypass -File scripts\baixar-ffmpeg.ps1

$ErrorActionPreference = "Stop"
$raiz = Split-Path -Parent $PSScriptRoot
$bin = Join-Path $raiz "backend\bin"
$url = "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip"
$zip = Join-Path $env:TEMP "ffmpeg-essentials.zip"
$tmp = Join-Path $env:TEMP "ffmpeg-essentials"

Write-Host "Baixando ffmpeg (cerca de 100 MB)..."
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
Invoke-WebRequest -Uri $url -OutFile $zip -UseBasicParsing
Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
Expand-Archive -Path $zip -DestinationPath $tmp -Force
New-Item -ItemType Directory -Force -Path $bin | Out-Null
$exe = Get-ChildItem $tmp -Recurse -Filter ffmpeg.exe | Select-Object -First 1
Copy-Item $exe.FullName (Join-Path $bin "ffmpeg.exe") -Force
Remove-Item $zip, $tmp -Recurse -Force
Write-Host "Pronto: $bin\ffmpeg.exe"
& (Join-Path $bin "ffmpeg.exe") -hide_banner -version | Select-Object -First 1
