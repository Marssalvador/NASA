param()
$ErrorActionPreference = 'Stop'
$stateFile = Join-Path (Split-Path -Parent $PSScriptRoot) 'data\postgres-setup-state.json'
try {
    Write-Host 'AEGIS - Conexion privada a AEGIS-Development' -ForegroundColor Cyan
    Write-Host 'Introduce la contrasena de PostgreSQL. La entrada estara oculta.'
    Write-Host 'No se mostrara ni se guardara en archivos del proyecto.'
    $dbSecret = Read-Host 'Contrasena de la base de datos' -AsSecureString
    $dbCredential = [Net.NetworkCredential]::new('', $dbSecret)
    if ([string]::IsNullOrWhiteSpace($dbCredential.Password)) {
        throw 'La contrasena esta vacia.'
    }
    $dbTemplate = 'postgresql://postgres.hudkkzrkwdbgoltrtlqu:[YOUR-PASSWORD]@aws-0-eu-central-1.pooler.supabase.com:5432/postgres?sslmode=require'
    $dbUrl = $dbTemplate.Replace('[YOUR-PASSWORD]', [Uri]::EscapeDataString($dbCredential.Password))
    [Environment]::SetEnvironmentVariable('AEGIS_DATABASE_URL', $dbUrl, 'User')
    Remove-Variable dbSecret, dbCredential, dbTemplate, dbUrl
    @{status='ready'; updated_at=[DateTime]::UtcNow.ToString('o')} | ConvertTo-Json | Set-Content -LiteralPath $stateFile -Encoding UTF8
    Write-Host 'Configuracion guardada. Codex puede iniciar las pruebas.' -ForegroundColor Green
    Start-Sleep -Seconds 3
} catch {
    # Never write the error message: an exception could contain connection data.
    @{status='failed'; updated_at=[DateTime]::UtcNow.ToString('o')} | ConvertTo-Json | Set-Content -LiteralPath $stateFile -Encoding UTF8
    Write-Host 'No se pudo guardar la configuracion. No compartas la contrasena en el chat.' -ForegroundColor Red
    Read-Host 'Pulsa Enter para cerrar' | Out-Null
    exit 1
}
