param(
    [string]$HostName = "sistema-agus",
    [string]$IpAddress = ""
)

$hostsPath = "$env:SystemRoot\System32\drivers\etc\hosts"

if (-not $IpAddress) {
    $IpAddress = (Get-NetIPAddress -AddressFamily IPv4 |
        Where-Object {
            $_.IPAddress -notlike "127.*" -and
            $_.IPAddress -notlike "169.254.*" -and
            $_.PrefixOrigin -ne "WellKnown"
        } |
        Select-Object -First 1 -ExpandProperty IPAddress)
}

if (-not $IpAddress) {
    throw "No se pudo detectar una IP local. Ejecutá: .\scripts\configurar-host-sistema-agus.ps1 -IpAddress 192.168.x.x"
}

$line = "$IpAddress`t$HostName"
$content = Get-Content -Path $hostsPath -ErrorAction Stop
$pattern = "^\s*\d{1,3}(\.\d{1,3}){3}\s+$([regex]::Escape($HostName))\s*$"

if ($content -match $pattern) {
    $updated = $content | ForEach-Object {
        if ($_ -match $pattern) { $line } else { $_ }
    }
    Set-Content -Path $hostsPath -Value $updated -Encoding ASCII
} else {
    Add-Content -Path $hostsPath -Value $line
}

Write-Host "Listo: $HostName apunta a $IpAddress"
