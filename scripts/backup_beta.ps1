param(
    [string]$EnvFile = (Join-Path $PSScriptRoot "..\.env"),
    [string]$OutputDirectory = (Join-Path $PSScriptRoot "..\backups")
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

$envPath = Resolve-Path -LiteralPath $EnvFile
$config = Read-DotEnv $envPath
$required = @("DB_HOST", "DB_PORT", "DB_NAME", "DB_USER", "DB_PASSWORD")
foreach ($key in $required) {
    if (-not $config[$key]) {
        throw "Falta $key en $EnvFile"
    }
}

$pgDump = Resolve-PgTool "pg_dump"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$backupRoot = [System.IO.Path]::GetFullPath($OutputDirectory)
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupPath = Join-Path $backupRoot "$($config.DB_NAME)_$timestamp"

New-Item -ItemType Directory -Path $backupPath -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $backupPath "config") -Force | Out-Null

$previousPassword = $env:PGPASSWORD
$env:PGPASSWORD = $config.DB_PASSWORD
try {
    $dumpPath = Join-Path $backupPath "database.dump"
    & $pgDump `
        --host $config.DB_HOST `
        --port $config.DB_PORT `
        --username $config.DB_USER `
        --format custom `
        --no-owner `
        --no-privileges `
        --file $dumpPath `
        $config.DB_NAME
    if ($LASTEXITCODE -ne 0) {
        throw "pg_dump finalizó con código $LASTEXITCODE"
    }

    $uploadsSource = Join-Path $root "uploads"
    if (Test-Path -LiteralPath $uploadsSource) {
        Copy-Item -LiteralPath $uploadsSource -Destination (Join-Path $backupPath "uploads") -Recurse
    }

    Copy-Item -LiteralPath $envPath -Destination (Join-Path $backupPath "config\.env")

    $gitCommit = "sin-git"
    try {
        $gitCommit = (git -C $root rev-parse HEAD 2>$null).Trim()
    }
    catch {
        $gitCommit = "sin-git"
    }

    $manifest = [ordered]@{
        created_at = (Get-Date).ToString("o")
        database = $config.DB_NAME
        database_host = $config.DB_HOST
        git_commit = $gitCommit
        dump_sha256 = (Get-FileHash -LiteralPath $dumpPath -Algorithm SHA256).Hash
        includes_uploads = (Test-Path -LiteralPath (Join-Path $backupPath "uploads"))
        includes_env = $true
    }
    $manifest | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $backupPath "manifest.json") -Encoding UTF8

    Write-Host "Backup creado: $backupPath" -ForegroundColor Green
}
finally {
    $env:PGPASSWORD = $previousPassword
}
