param([int]$Port = 8000, [switch]$SkipBuild)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$pythonExe = Join-Path $projectRoot '.venv\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $pythonExe)) { throw 'Falta .venv. Sigue la instalación del README.' }
Push-Location $projectRoot
try {
    if (-not $SkipBuild) {
        Push-Location (Join-Path $projectRoot 'frontend')
        try { npm run build; if ($LASTEXITCODE -ne 0) { throw 'Ha fallado la compilación del frontend.' } }
        finally { Pop-Location }
    }
    Write-Host "AEGIS local: http://127.0.0.1:$Port  (Ctrl+C para detener)" -ForegroundColor Cyan
    & $pythonExe -m uvicorn backend.aegis.main:app --host 127.0.0.1 --port $Port
} finally { Pop-Location }
