param([int]$Port = 8000, [switch]$SkipBuild, [switch]$MedicalPostgres, [switch]$Presentation)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$pythonExe = Join-Path $projectRoot '.venv\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $pythonExe)) { throw 'Falta .venv. Sigue la instalación del README.' }
Push-Location $projectRoot
try {
    if ($Presentation -and $MedicalPostgres) { throw 'Elige Presentation (local) o MedicalPostgres, no ambos.' }
    if ($Presentation) {
        $env:AEGIS_RECORD_BACKEND = 'memory'
        Write-Host 'PULSS: presentacion local con datos sinteticos y motor medico real.' -ForegroundColor Cyan
    }
    if ($MedicalPostgres) {
        if ([string]::IsNullOrWhiteSpace($env:AEGIS_DATABASE_URL)) {
            $env:AEGIS_DATABASE_URL = [Environment]::GetEnvironmentVariable('AEGIS_DATABASE_URL', 'User')
        }
        if ([string]::IsNullOrWhiteSpace($env:AEGIS_DATABASE_URL)) { throw 'Falta AEGIS_DATABASE_URL para activar el backend PostgreSQL.' }
        $env:AEGIS_RECORD_BACKEND = 'postgres'
        Write-Host 'Expediente medico: PostgreSQL / Supabase' -ForegroundColor Cyan
    }
    if (-not $SkipBuild) {
        Push-Location (Join-Path $projectRoot 'frontend')
        try { npm run build; if ($LASTEXITCODE -ne 0) { throw 'Ha fallado la compilación del frontend.' } }
        finally { Pop-Location }
    }
    Write-Host "AEGIS local: http://127.0.0.1:$Port  (Ctrl+C para detener)" -ForegroundColor Cyan
    & $pythonExe -m uvicorn backend.aegis.main:app --host 127.0.0.1 --port $Port
} finally { Pop-Location }
