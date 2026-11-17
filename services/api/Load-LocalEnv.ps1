$ErrorActionPreference = 'Stop'
$envPath = Join-Path $PSScriptRoot '.env'
if (-not (Test-Path -LiteralPath $envPath)) {
    throw 'Create services/api/.env from .env.example with a new random local database password first.'
}
$allowedNames = @(
    'POSTGRES_PASSWORD',
    'CONTINUUM_DATABASE_URL',
    'CONTINUUM_ORIGIN',
    'CONTINUUM_LOCAL_HTTP',
    'CONTINUUM_REDIS_URL',
    'CONTINUUM_NEO4J_URI',
    'CONTINUUM_NEO4J_USER',
    'CONTINUUM_NEO4J_PASSWORD',
    'CONTINUUM_NEO4J_DATABASE',
    'CONTINUUM_ALLOW_CUSTOM_WORKSPACES',
    'CONTINUUM_ALLOW_LOCAL_GIT',
    'CONTINUUM_LOCAL_GIT_ROOTS',
    'CONTINUUM_CUSTOM_INPUTS_ROOT'
)
foreach ($line in Get-Content -LiteralPath $envPath) {
    if ([string]::IsNullOrWhiteSpace($line) -or $line.StartsWith('#')) { continue }
    $parts = $line.Split('=', 2)
    if ($parts.Length -ne 2 -or $parts[0] -notin $allowedNames) {
        throw 'Unexpected local environment entry.'
    }
    [Environment]::SetEnvironmentVariable($parts[0], $parts[1], 'Process')
}
