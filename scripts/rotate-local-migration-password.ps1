[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$envFile = Join-Path $projectRoot ".env.local"
$postgresBin = Join-Path $projectRoot ".local\postgresql-17.10\pgsql\bin"
$psql = Join-Path $postgresBin "psql.exe"
$migrationUserName = "nettopo"
$runtimeUserName = "nettopo_runtime"

function Read-EnvFile {
  param([string]$Path)

  $values = [ordered]@{}
  if (-not (Test-Path -LiteralPath $Path)) {
    throw ".env.local was not found."
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
  $bytes = [byte[]]::new(48)
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

function Invoke-PsqlScalar {
  param(
    [System.Uri]$Uri,
    [string]$Password,
    [string]$Sql
  )

  $previousPassword = $env:PGPASSWORD
  try {
    $env:PGPASSWORD = $Password
    $port = if ($Uri.Port -gt 0) { $Uri.Port } else { 5432 }
    $databaseName = $Uri.AbsolutePath.TrimStart("/")
    $output = $Sql | & $psql `
      -h $Uri.Host `
      -p $port `
      -U (Get-UserInfoPart $Uri 0) `
      -d $databaseName `
      -v "ON_ERROR_STOP=1" `
      -tA `
      -q 2>$null
    if ($LASTEXITCODE -ne 0) {
      throw "psql command failed."
    }
    return ($output | Select-Object -First 1)
  } finally {
    $env:PGPASSWORD = $previousPassword
  }
}

function Test-PsqlConnection {
  param(
    [System.Uri]$Uri,
    [string]$Password
  )

  try {
    $result = Invoke-PsqlScalar $Uri $Password "select 'ok';"
    return ($result -eq "ok")
  } catch {
    return $false
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

function Write-EnvFileAtomic {
  param([string[]]$Lines)

  $tempFile = Join-Path (Split-Path -Parent $envFile) (".env.local.tmp." + [Guid]::NewGuid().ToString("N"))
  [System.IO.File]::WriteAllLines($tempFile, $Lines, [System.Text.UTF8Encoding]::new($false))
  Move-Item -LiteralPath $tempFile -Destination $envFile -Force
}

function Set-MigrationPassword {
  param(
    [System.Uri]$Uri,
    [string]$ConnectionPassword,
    [string]$TargetPassword
  )

  $passwordLiteral = Get-SqlLiteral $TargetPassword
  $sql = "ALTER ROLE nettopo WITH PASSWORD $passwordLiteral;"
  [void](Invoke-PsqlScalar $Uri $ConnectionPassword $sql)
}

if (-not (Test-Path -LiteralPath $psql)) {
  throw "psql.exe was not found."
}

$originalEnvLines = [System.IO.File]::ReadAllLines($envFile)
$envValues = Read-EnvFile $envFile
$migrationUri = ConvertTo-PostgresUri $envValues["MIGRATION_DATABASE_URL"]
$runtimeUri = ConvertTo-PostgresUri $envValues["DATABASE_URL"]
$migrationUser = Get-UserInfoPart $migrationUri 0
$runtimeUser = Get-UserInfoPart $runtimeUri 0
$oldMigrationPassword = Get-UserInfoPart $migrationUri 1
$runtimePassword = Get-UserInfoPart $runtimeUri 1

if ($migrationUser -ne $migrationUserName) {
  throw "MIGRATION_DATABASE_URL must use the local migration owner."
}
if ($runtimeUser -ne $runtimeUserName) {
  throw "DATABASE_URL must remain on the separated runtime role."
}
if ([string]::IsNullOrEmpty($oldMigrationPassword) -or [string]::IsNullOrEmpty($runtimePassword)) {
  throw "Both local DSNs must include masked local-only passwords before rotation."
}
if ($oldMigrationPassword -eq $runtimePassword) {
  throw "Migration and runtime passwords are not separated before rotation."
}
if (-not (Test-PsqlConnection $migrationUri $oldMigrationPassword)) {
  throw "Current migration credential could not connect; rotation aborted before changes."
}

$newMigrationPassword = New-StrongPassword
if ($newMigrationPassword -eq $oldMigrationPassword -or $newMigrationPassword -eq $runtimePassword) {
  throw "Generated password collision; rotation aborted before changes."
}

$newMigrationBuilder = [System.UriBuilder]::new($migrationUri)
$newMigrationBuilder.UserName = $migrationUserName
$newMigrationBuilder.Password = $newMigrationPassword
$updatedEnvLines = Set-EnvValue $originalEnvLines "MIGRATION_DATABASE_URL" $newMigrationBuilder.Uri.AbsoluteUri

$dbPasswordChanged = $false
$envChanged = $false
try {
  Set-MigrationPassword $migrationUri $oldMigrationPassword $newMigrationPassword
  $dbPasswordChanged = $true

  Write-EnvFileAtomic $updatedEnvLines
  $envChanged = $true

  if (-not (Test-PsqlConnection $migrationUri $newMigrationPassword)) {
    throw "Post-check with rotated migration credential failed."
  }
  if (Test-PsqlConnection $migrationUri $oldMigrationPassword) {
    throw "Previous migration credential still connects after rotation."
  }

  Write-Output "Local migration credential rotation complete."
  Write-Output "MIGRATION_DATABASE_URL user: $migrationUserName"
  Write-Output "DATABASE_URL user: $runtimeUserName"
  Write-Output "Old credential rejected: true"
  Write-Output "New credential accepted: true"
  Write-Output "Secrets: masked; .env.local remains gitignored."
} catch {
  if ($dbPasswordChanged) {
    try {
      Set-MigrationPassword $migrationUri $newMigrationPassword $oldMigrationPassword
    } catch {
      throw "Rotation failed and rollback could not restore the previous DB credential."
    }
  }
  if ($envChanged) {
    try {
      Write-EnvFileAtomic $originalEnvLines
    } catch {
      throw "Rotation failed and rollback could not restore the previous .env.local."
    }
  }
  throw "Rotation failed; previous DB credential and .env.local were restored when needed."
}
