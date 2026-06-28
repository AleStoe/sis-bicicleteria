param(
    [string]$EnvFile = (Join-Path $PSScriptRoot "..\.env"),
    [switch]$BaselineExisting
)

$ErrorActionPreference = "Stop"

function Read-DotEnv([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path)) {
        throw "No existe el archivo de entorno: $Path"
    }

    $values = @{}
    foreach ($line in Get-Content -LiteralPath $Path -Encoding UTF8) {
        $trimmed = $line.Trim()
        if (-not $trimmed -or $trimmed.StartsWith("#") -or -not $trimmed.Contains("=")) {
            continue
        }
        $parts = $trimmed.Split("=", 2)
        $values[$parts[0].Trim()] = $parts[1].Trim().Trim('"').Trim("'")
    }
    return $values
}

function Resolve-PgTool([string]$Name) {
    $command = Get-Command $Name -ErrorAction SilentlyContinue
    if ($command) {
        return $command.Source
    }

    $candidate = Get-ChildItem "C:\Program Files\PostgreSQL\*\bin\$Name.exe" -ErrorAction SilentlyContinue |
        Sort-Object FullName -Descending |
        Select-Object -First 1
    if ($candidate) {
        return $candidate.FullName
    }

    throw "No se encontró $Name. Instalá PostgreSQL con sus herramientas de línea de comandos."
}

function Invoke-Psql([string[]]$Arguments) {
    & $script:Psql @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "psql finalizó con código $LASTEXITCODE"
    }
}

$config = Read-DotEnv (Resolve-Path -LiteralPath $EnvFile)
$required = @("DB_HOST", "DB_PORT", "DB_NAME", "DB_USER", "DB_PASSWORD")
foreach ($key in $required) {
    if (-not $config[$key]) {
        throw "Falta $key en $EnvFile"
    }
}

$script:Psql = Resolve-PgTool "psql"
$previousPassword = $env:PGPASSWORD
$env:PGPASSWORD = $config.DB_PASSWORD
$connectionArgs = @(
    "--host", $config.DB_HOST,
    "--port", $config.DB_PORT,
    "--username", $config.DB_USER,
    "--dbname", $config.DB_NAME,
    "--set", "ON_ERROR_STOP=1",
    "--no-psqlrc"
)

try {
    Invoke-Psql ($connectionArgs + @(
        "--command",
        "CREATE TABLE IF NOT EXISTS public.schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());"
    ))

    $migrationDirectory = Resolve-Path (Join-Path $PSScriptRoot "..\database\migrations")
    $migrations = Get-ChildItem -LiteralPath $migrationDirectory -Filter "*.sql" |
        Sort-Object Name

    if ($BaselineExisting) {
        foreach ($migration in $migrations) {
            $escaped = $migration.Name.Replace("'", "''")
            Invoke-Psql ($connectionArgs + @(
                "--command",
                "INSERT INTO public.schema_migrations(version) VALUES ('$escaped') ON CONFLICT (version) DO NOTHING;"
            ))
        }
        Write-Host "Historial inicializado. No se ejecutó SQL de migraciones." -ForegroundColor Green
        exit 0
    }

    $existingCount = (& $script:Psql @connectionArgs --tuples-only --no-align --command "SELECT count(*) FROM public.schema_migrations;").Trim()
    $hasApplicationTables = (& $script:Psql @connectionArgs --tuples-only --no-align --command "SELECT to_regclass('public.ventas') IS NOT NULL;").Trim()
    if ([int]$existingCount -eq 0 -and $hasApplicationTables -eq "t") {
        throw "La base ya contiene el sistema pero no tiene historial. Verificá el esquema y ejecutá una sola vez con -BaselineExisting."
    }

    foreach ($migration in $migrations) {
        $escaped = $migration.Name.Replace("'", "''")
        $alreadyApplied = (& $script:Psql @connectionArgs --tuples-only --no-align --command "SELECT EXISTS (SELECT 1 FROM public.schema_migrations WHERE version = '$escaped');").Trim()
        if ($alreadyApplied -eq "t") {
            Write-Host "Omitida: $($migration.Name)"
            continue
        }

        Write-Host "Aplicando: $($migration.Name)" -ForegroundColor Cyan
        Invoke-Psql ($connectionArgs + @("--file", $migration.FullName))
        Invoke-Psql ($connectionArgs + @(
            "--command",
            "INSERT INTO public.schema_migrations(version) VALUES ('$escaped');"
        ))
    }

    Write-Host "Migraciones al día." -ForegroundColor Green
}
finally {
    $env:PGPASSWORD = $previousPassword
}
