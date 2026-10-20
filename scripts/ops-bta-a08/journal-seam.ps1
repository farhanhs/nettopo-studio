Set-StrictMode -Version Latest

function Reserve-A08Journal([string] $Path) {
    $folder = Split-Path $Path -Parent
    New-Item -ItemType Directory -Path $folder -Force | Out-Null
    $reservation = "$Path.reserve"
    New-Item -ItemType File -Path $reservation -ErrorAction Stop | Out-Null
    return $reservation
}

function Write-A08Journal([string] $Path, [object] $Journal) {
    if (Test-Path -LiteralPath $Path) { throw "Run journal already exists: $Path" }
    $Journal | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $Path -Encoding utf8 -NoNewline
}
