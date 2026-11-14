param()
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Push-Location $projectRoot
try {
    if ([string]::IsNullOrWhiteSpace($env:AEGIS_DATABASE_URL)) {
        $env:AEGIS_DATABASE_URL = [Environment]::GetEnvironmentVariable('AEGIS_DATABASE_URL', 'User')
    }
    if ([string]::IsNullOrWhiteSpace($env:AEGIS_DATABASE_URL)) {
        throw 'Falta AEGIS_DATABASE_URL. No se ha conectado ni modificado ninguna base de datos.'
    }
    & '.venv/Scripts/python.exe' -m pytest tests/test_medical_postgres.py tests/test_medical_postgres_workflow.py -q --tb=short
    exit $LASTEXITCODE
} finally { Pop-Location }
