$ErrorActionPreference = 'Stop'
$envPath = Join-Path $PSScriptRoot '.env'
if (-not (Test-Path -LiteralPath $envPath)) {
    throw 'Create services/api/.env from .env.example with a new random local database password first.'
}
$allowedNames = @('POSTGRES_PASSWORD', 'CONTINUUM_DATABASE_URL', 'CONTINUUM_ORIGIN', 'CONTINUUM_LOCAL_HTTP')
foreach ($line in Get-Content -LiteralPath $envPath) {
    if ([string]::IsNullOrWhiteSpace($line) -or $line.StartsWith('#')) { continue }
    $parts = $line.Split('=', 2)
    if ($parts.Length -ne 2 -or $parts[0] -notin $allowedNames) {
        throw 'Unexpected local environment entry.'
    }
    [Environment]::SetEnvironmentVariable($parts[0], $parts[1], 'Process')
}
