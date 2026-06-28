param(
    [Parameter(Mandatory = $true)]
    [string]$BackupPath,
    [Parameter(Mandatory = $true)]
    [ValidatePattern("^[A-Za-z0-9_]+$")]
    [string]$TargetDatabase,
    [string]$EnvFile = (Join-Path $PSScriptRoot "..\.env"),
    [string]$UploadsDirectory = (Join-Path $PSScriptRoot "..\uploads"),
    [switch]$RestoreUploads
)

$ErrorActionPreference = "Stop"

function Read-DotEnv([string]$Path) {
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

$resolvedBackup = (Resolve-Path -LiteralPath $BackupPath).Path
$dumpPath = Join-Path $resolvedBackup "database.dump"
$manifestPath = Join-Path $resolvedBackup "manifest.json"
if (-not (Test-Path -LiteralPath $dumpPath)) {
    throw "El backup no contiene database.dump"
}
if (-not (Test-Path -LiteralPath $manifestPath)) {
    throw "El backup no contiene manifest.json"
}

$config = Read-DotEnv (Resolve-Path -LiteralPath $EnvFile)
$psql = Resolve-PgTool "psql"
$createdb = Resolve-PgTool "createdb"
$pgRestore = Resolve-PgTool "pg_restore"
$previousPassword = $env:PGPASSWORD
$env:PGPASSWORD = $config.DB_PASSWORD

try {
    $baseArgs = @(
        "--host", $config.DB_HOST,
        "--port", $config.DB_PORT,
        "--username", $config.DB_USER,
        "--no-psqlrc"
    )
    $exists = (& $psql @baseArgs --dbname postgres --tuples-only --no-align --command "SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = '$TargetDatabase');").Trim()
    if ($exists -eq "t") {
        throw "La base destino '$TargetDatabase' ya existe. El restore nunca sobrescribe una base."
    }

    & $createdb --host $config.DB_HOST --port $config.DB_PORT --username $config.DB_USER --encoding UTF8 $TargetDatabase
    if ($LASTEXITCODE -ne 0) {
        throw "No se pudo crear la base destino."
    }

    & $pgRestore `
        --host $config.DB_HOST `
        --port $config.DB_PORT `
        --username $config.DB_USER `
        --dbname $TargetDatabase `
        --no-owner `
        --no-privileges `
        --exit-on-error `
        $dumpPath
    if ($LASTEXITCODE -ne 0) {
        throw "pg_restore finalizó con código $LASTEXITCODE. La base destino se conserva para diagnóstico."
    }

    if ($RestoreUploads) {
        $uploadsBackup = Join-Path $resolvedBackup "uploads"
        $uploadsTarget = [System.IO.Path]::GetFullPath($UploadsDirectory)
        if (-not (Test-Path -LiteralPath $uploadsBackup)) {
            throw "El backup no contiene uploads."
        }
        if ((Test-Path -LiteralPath $uploadsTarget) -and (Get-ChildItem -LiteralPath $uploadsTarget -Force | Select-Object -First 1)) {
            throw "La carpeta uploads destino no está vacía. Restaurala manualmente para evitar sobrescrituras."
        }
        New-Item -ItemType Directory -Path $uploadsTarget -Force | Out-Null
        Get-ChildItem -LiteralPath $uploadsBackup -Force | ForEach-Object {
            Copy-Item -LiteralPath $_.FullName -Destination $uploadsTarget -Recurse -Force
        }
    }

    $tableCount = (& $psql @baseArgs --dbname $TargetDatabase --tuples-only --no-align --command "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';").Trim()
    Write-Host "Restore correcto en '$TargetDatabase'. Tablas públicas: $tableCount" -ForegroundColor Green
    Write-Host "La configuración respaldada está en: $(Join-Path $resolvedBackup 'config\.env')" -ForegroundColor Yellow
}
finally {
    $env:PGPASSWORD = $previousPassword
}
