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
    throw "No se encontro $Name. Instala PostgreSQL con sus herramientas de linea de comandos."
}

function Resolve-BackupInput([string]$Path) {
    $resolvedInput = (Resolve-Path -LiteralPath $Path).Path
    $result = @{
        DumpPath = $null
        UploadsPath = $null
        ConfigPath = $null
        TemporaryPath = $null
    }

    try {
        if (Test-Path -LiteralPath $resolvedInput -PathType Container) {
            $root = $resolvedInput
            $result.DumpPath = Join-Path $root "database.dump"
        }
        elseif ([System.IO.Path]::GetExtension($resolvedInput) -ieq ".dump") {
            $root = $null
            $result.DumpPath = $resolvedInput
        }
        elseif ([System.IO.Path]::GetExtension($resolvedInput) -ieq ".zip") {
            $root = Join-Path ([System.IO.Path]::GetTempPath()) "sistema-agus-restore-$([guid]::NewGuid().ToString('N'))"
            New-Item -ItemType Directory -Path $root -Force | Out-Null
            $result.TemporaryPath = $root
            Expand-Archive -LiteralPath $resolvedInput -DestinationPath $root -Force
            $result.DumpPath = Join-Path $root "database.dump"
        }
        else {
            throw "BackupPath debe ser una carpeta de backup, un archivo .dump o un archivo .zip."
        }

        if (-not (Test-Path -LiteralPath $result.DumpPath -PathType Leaf)) {
            throw "El backup no contiene database.dump ni es un dump valido."
        }

        if ($root) {
            $uploadsCandidate = Join-Path $root "uploads"
            if (Test-Path -LiteralPath $uploadsCandidate -PathType Container) {
                $result.UploadsPath = $uploadsCandidate
            }

            $configCandidate = Join-Path $root "config\.env"
            if (Test-Path -LiteralPath $configCandidate -PathType Leaf) {
                $result.ConfigPath = $configCandidate
            }
        }

        return $result
    }
    catch {
        if ($result.TemporaryPath -and (Test-Path -LiteralPath $result.TemporaryPath)) {
            Remove-Item -LiteralPath $result.TemporaryPath -Recurse -Force
        }
        throw
    }
}

$previousPassword = $env:PGPASSWORD
$backup = $null

try {
    $backup = Resolve-BackupInput $BackupPath
    $config = Read-DotEnv (Resolve-Path -LiteralPath $EnvFile)
    $required = @("DB_HOST", "DB_PORT", "DB_USER", "DB_PASSWORD")
    foreach ($key in $required) {
        if (-not $config[$key]) {
            throw "Falta $key en $EnvFile"
        }
    }

    $psql = Resolve-PgTool "psql"
    $createdb = Resolve-PgTool "createdb"
    $pgRestore = Resolve-PgTool "pg_restore"
    $env:PGPASSWORD = $config.DB_PASSWORD
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
        $backup.DumpPath
    if ($LASTEXITCODE -ne 0) {
        throw "pg_restore finalizo con codigo $LASTEXITCODE. La base destino se conserva para diagnostico."
    }

    if ($RestoreUploads) {
        if (-not $backup.UploadsPath) {
            throw "El backup no contiene uploads."
        }

        $uploadsTarget = [System.IO.Path]::GetFullPath($UploadsDirectory)
        if ((Test-Path -LiteralPath $uploadsTarget) -and (Get-ChildItem -LiteralPath $uploadsTarget -Force | Select-Object -First 1)) {
            throw "La carpeta uploads destino no esta vacia. Usa una carpeta vacia para evitar sobrescrituras."
        }

        New-Item -ItemType Directory -Path $uploadsTarget -Force | Out-Null
        Get-ChildItem -LiteralPath $backup.UploadsPath -Force | ForEach-Object {
            Copy-Item -LiteralPath $_.FullName -Destination $uploadsTarget -Recurse -Force
        }
    }

    $tableCount = (& $psql @baseArgs --dbname $TargetDatabase --tuples-only --no-align --command "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';").Trim()
    Write-Host "Restore correcto en '$TargetDatabase'. Tablas publicas: $tableCount" -ForegroundColor Green

    if ($backup.ConfigPath) {
        Write-Host "Configuracion respaldada: $($backup.ConfigPath)" -ForegroundColor Yellow
    }
    else {
        Write-Host "El backup no incluye .env. Actualiza DB_NAME manualmente para probar la base restaurada." -ForegroundColor Yellow
    }
}
finally {
    $env:PGPASSWORD = $previousPassword
    if ($backup -and $backup.TemporaryPath -and (Test-Path -LiteralPath $backup.TemporaryPath)) {
        Remove-Item -LiteralPath $backup.TemporaryPath -Recurse -Force
    }
}
