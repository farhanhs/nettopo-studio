[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$envFile = Join-Path $projectRoot ".env.local"
$postgresBin = Join-Path $projectRoot ".local\postgresql-17.10\pgsql\bin"
$psql = Join-Path $postgresBin "psql.exe"
$runtimeUser = "nettopo_runtime"

function Read-EnvFile {
  param([string]$Path)

  $values = [ordered]@{}
  if (-not (Test-Path -LiteralPath $Path)) {
    throw ".env.local was not found at $Path."
  }

  foreach ($line in [System.IO.File]::ReadAllLines($Path)) {
    if ($line.Trim().Length -eq 0 -or $line.TrimStart().StartsWith("#")) {
      continue
    }
    $separator = $line.IndexOf("=")
    if ($separator -le 0) {
      continue
    }
    $key = $line.Substring(0, $separator).Trim()
    $value = $line.Substring($separator + 1).Trim()
    $values[$key] = $value
  }

  return $values
}

function ConvertTo-PostgresUri {
  param([string]$Value)

  if ([string]::IsNullOrWhiteSpace($Value)) {
    throw "A PostgreSQL DSN is empty."
  }
  $builder = [System.UriBuilder]::new($Value)
  if ($builder.Scheme -eq "postgres") {
    $builder.Scheme = "postgresql"
  }
  return $builder.Uri
}

function Get-UserInfoPart {
  param([System.Uri]$Uri, [int]$Index)

  $parts = $Uri.UserInfo.Split(":", 2)
  if ($parts.Length -le $Index) {
    return ""
  }
  return [System.Uri]::UnescapeDataString($parts[$Index])
}

function New-StrongPassword {
  $bytes = [byte[]]::new(36)
  $generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try {
    $generator.GetBytes($bytes)
  } finally {
    $generator.Dispose()
  }
  return [Convert]::ToBase64String($bytes).TrimEnd("=") -replace "\+", "-" -replace "/", "_"
}

function Get-SqlLiteral {
  param([string]$Value)
  return "'" + ($Value -replace "'", "''") + "'"
}

function Invoke-Psql {
  param(
    [System.Uri]$MigrationUri,
    [string]$MigrationPassword,
    [string]$Sql
  )

  $previousPassword = $env:PGPASSWORD
  try {
    $env:PGPASSWORD = $MigrationPassword
    $databaseName = $MigrationUri.AbsolutePath.TrimStart("/")
    $port = if ($MigrationUri.Port -gt 0) { $MigrationUri.Port } else { 5432 }
    $Sql | & $psql `
      -h $MigrationUri.Host `
      -p $port `
      -U (Get-UserInfoPart $MigrationUri 0) `
      -d $databaseName `
      -v "ON_ERROR_STOP=1" `
      -q
    if ($LASTEXITCODE -ne 0) {
      throw "psql failed while applying the runtime role bootstrap."
    }
  } finally {
    $env:PGPASSWORD = $previousPassword
  }
}

function Set-EnvValue {
  param(
    [string[]]$Lines,
    [string]$Key,
    [string]$Value
  )

  $found = $false
  $result = foreach ($line in $Lines) {
    if ($line -match "^\s*$([regex]::Escape($Key))\s*=") {
      $found = $true
      "$Key=$Value"
    } else {
      $line
    }
  }
  if (-not $found) {
    $result += "$Key=$Value"
  }
  return [string[]]$result
}

if (-not (Test-Path -LiteralPath $psql)) {
  throw "psql.exe was not found at $psql."
}

$envValues = Read-EnvFile $envFile
$migrationDsn = $envValues["MIGRATION_DATABASE_URL"]
if (-not $migrationDsn) {
  throw "MIGRATION_DATABASE_URL is required in .env.local."
}

$migrationUri = ConvertTo-PostgresUri $migrationDsn
$migrationUser = Get-UserInfoPart $migrationUri 0
$migrationPassword = Get-UserInfoPart $migrationUri 1
if ($migrationUser -ne "nettopo") {
  throw "MIGRATION_DATABASE_URL must use the nettopo migration owner for OPS_DBM_002."
}
if ([string]::IsNullOrEmpty($migrationPassword)) {
  throw "MIGRATION_DATABASE_URL must include a password for local bootstrap."
}

$runtimePassword = $null
if ($envValues.Contains("DATABASE_URL")) {
  $currentRuntimeUri = ConvertTo-PostgresUri $envValues["DATABASE_URL"]
  if ((Get-UserInfoPart $currentRuntimeUri 0) -eq $runtimeUser) {
    $runtimePassword = Get-UserInfoPart $currentRuntimeUri 1
  }
}
if ([string]::IsNullOrEmpty($runtimePassword)) {
  $runtimePassword = New-StrongPassword
}

$databaseName = $migrationUri.AbsolutePath.TrimStart("/")
$runtimePasswordSql = Get-SqlLiteral $runtimePassword
$runtimeUserSql = '"' + ($runtimeUser -replace '"', '""') + '"'
$runtimeUserLiteral = Get-SqlLiteral $runtimeUser

$bootstrapSql = @"
DO `$bootstrap`$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '$runtimeUser') THEN
    EXECUTE format('CREATE ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS', $runtimeUserLiteral, $runtimePasswordSql);
  ELSE
    EXECUTE format('ALTER ROLE %I WITH LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS', $runtimeUserLiteral, $runtimePasswordSql);
  END IF;
END
`$bootstrap`$;

GRANT CONNECT ON DATABASE "$databaseName" TO $runtimeUserSql;
REVOKE TEMPORARY ON DATABASE "$databaseName" FROM PUBLIC;
REVOKE ALL ON SCHEMA public FROM $runtimeUserSql;
GRANT USAGE ON SCHEMA public TO $runtimeUserSql;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO $runtimeUserSql;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO $runtimeUserSql;
ALTER DEFAULT PRIVILEGES FOR ROLE nettopo IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO $runtimeUserSql;
ALTER DEFAULT PRIVILEGES FOR ROLE nettopo IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO $runtimeUserSql;
"@

Invoke-Psql $migrationUri $migrationPassword $bootstrapSql

$runtimeBuilder = [System.UriBuilder]::new($migrationUri)
$runtimeBuilder.UserName = $runtimeUser
$runtimeBuilder.Password = $runtimePassword
$updatedLines = Set-EnvValue ([System.IO.File]::ReadAllLines($envFile)) "DATABASE_URL" $runtimeBuilder.Uri.AbsoluteUri
[System.IO.File]::WriteAllLines($envFile, $updatedLines, [System.Text.UTF8Encoding]::new($false))

Write-Output "Runtime role bootstrap complete."
Write-Output "DATABASE_URL user: $runtimeUser"
Write-Output "MIGRATION_DATABASE_URL user: $migrationUser"
Write-Output "Database: $databaseName"
Write-Output "Secrets: masked; .env.local remains gitignored."
