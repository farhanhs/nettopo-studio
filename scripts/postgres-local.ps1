[CmdletBinding()]
param(
  [Parameter(Position = 0)]
  [ValidateSet("init", "start", "stop", "status")]
  [string]$Action = "status"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$postgresRoot = Join-Path $projectRoot ".local\postgresql-17.10\pgsql"
$postgresBin = Join-Path $postgresRoot "bin"
$dataDirectory = Join-Path $projectRoot ".local\postgres-data"
$logDirectory = Join-Path $projectRoot ".local\logs"
$logFile = Join-Path $logDirectory "postgres.log"
$port = if ($env:NETTOPO_LOCAL_DB_PORT) { $env:NETTOPO_LOCAL_DB_PORT } else { "5432" }
$databaseUser = "nettopo"
$databaseName = "nettopo_studio"
$envFile = Join-Path $projectRoot ".env.local"

$initdb = Join-Path $postgresBin "initdb.exe"
$pgCtl = Join-Path $postgresBin "pg_ctl.exe"
$pgIsReady = Join-Path $postgresBin "pg_isready.exe"
$psql = Join-Path $postgresBin "psql.exe"
$createdb = Join-Path $postgresBin "createdb.exe"
$postgres = Join-Path $postgresBin "postgres.exe"

function Read-EnvFile {
  param([string]$Path)

  $values = [ordered]@{}
  if (-not (Test-Path -LiteralPath $Path)) {
    return $values
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

function New-MigrationDsn {
  param([string]$Password)

  $builder = [System.UriBuilder]::new("postgresql", "127.0.0.1", [int]$port, $databaseName)
  $builder.UserName = $databaseUser
  $builder.Password = $Password
  return $builder.Uri.AbsoluteUri
}

function Get-LocalMigrationPassword {
  param([bool]$AllowGenerate)

  if ($env:NETTOPO_LOCAL_DB_PASSWORD) {
    return $env:NETTOPO_LOCAL_DB_PASSWORD
  }

  $envValues = Read-EnvFile $envFile
  if ($envValues.Contains("MIGRATION_DATABASE_URL")) {
    $migrationUri = ConvertTo-PostgresUri $envValues["MIGRATION_DATABASE_URL"]
    if ((Get-UserInfoPart $migrationUri 0) -ne $databaseUser) {
      throw "MIGRATION_DATABASE_URL must use the local migration owner."
    }
    $password = Get-UserInfoPart $migrationUri 1
    if (-not [string]::IsNullOrEmpty($password)) {
      return $password
    }
  }

  if (-not $AllowGenerate) {
    throw "Local migration password is required in ignored .env.local or NETTOPO_LOCAL_DB_PASSWORD."
  }

  $password = New-StrongPassword
  $lines = if (Test-Path -LiteralPath $envFile) {
    [System.IO.File]::ReadAllLines($envFile)
  } else {
    [string[]]@(
      "NETTOPO_RUNTIME_PROFILE=development",
      "NETTOPO_AUTH_MODE=demo",
      "NETTOPO_ENABLE_DEV_IDENTITY_HEADER=1",
      "NETTOPO_ENABLE_DEMO_SEED=1",
      "NEXT_PUBLIC_TOPOLOGY_STORAGE=server",
      "POSTGRES_POOL_MAX=1"
    )
  }
  $updatedLines = Set-EnvValue $lines "MIGRATION_DATABASE_URL" (New-MigrationDsn $password)
  Write-EnvFileAtomic $updatedLines
  Write-Output "Generated local migration credential in ignored .env.local."
  return $password
}

function Assert-PostgresRuntime {
  if (-not (Test-Path -LiteralPath $initdb) -or -not (Test-Path -LiteralPath $pgCtl) -or -not (Test-Path -LiteralPath $postgres)) {
    throw "PostgreSQL 17.10 runtime was not found at $postgresRoot."
  }
}

function Test-ClusterInitialized {
  return Test-Path -LiteralPath (Join-Path $dataDirectory "PG_VERSION")
}

function Test-ServerReady {
  & $pgIsReady -h 127.0.0.1 -p $port -U $databaseUser -d "postgres" *> $null
  return ($LASTEXITCODE -eq 0)
}

function Start-PostgresDirect {
  New-Item -ItemType Directory -Force -Path $logDirectory | Out-Null
  $launcher = Join-Path $logDirectory "postgres-direct-start.cmd"
  $launcherBody = @(
    "@echo off",
    "cd /d `"$projectRoot`"",
    "`"$postgres`" -D `"$dataDirectory`" -h 127.0.0.1 -p $port >> `"$logFile`" 2>&1"
  ) -join "`r`n"
  [System.IO.File]::WriteAllText($launcher, $launcherBody, [System.Text.UTF8Encoding]::new($false))

  Start-Process `
    -FilePath $launcher `
    -WorkingDirectory $projectRoot `
    -WindowStyle Hidden
}

function Wait-UntilServerReady {
  param(
    [int]$TimeoutSeconds = 60
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  do {
    if (Test-ServerReady) {
      return $true
    }
    Start-Sleep -Milliseconds 500
  } while ((Get-Date) -lt $deadline)

  return $false
}

function Ensure-AppDatabase {
  $previousPassword = $env:PGPASSWORD
  try {
    $env:PGPASSWORD = $databasePassword
    $exists = & $psql `
      -h 127.0.0.1 `
      -p $port `
      -U $databaseUser `
      -d "postgres" `
      -tAc "select 1 from pg_database where datname = '$databaseName'"
    if ($LASTEXITCODE -ne 0) {
      throw "Could not inspect the local PostgreSQL databases."
    }
    if (@($exists) -notcontains "1") {
      & $createdb -h 127.0.0.1 -p $port -U $databaseUser $databaseName
      if ($LASTEXITCODE -ne 0) {
        throw "Could not create the $databaseName database."
      }
      Write-Output "Created PostgreSQL database $databaseName."
    }
  } finally {
    $env:PGPASSWORD = $previousPassword
  }
}

Assert-PostgresRuntime

switch ($Action) {
  "init" {
    if (Test-ClusterInitialized) {
      Write-Output "PostgreSQL data cluster is already initialized at $dataDirectory."
      break
    }

    New-Item -ItemType Directory -Force -Path $dataDirectory | Out-Null
    New-Item -ItemType Directory -Force -Path $logDirectory | Out-Null
    $passwordFile = Join-Path $projectRoot ".local\postgres-init-password.txt"
    $databasePassword = Get-LocalMigrationPassword $true

    try {
      [System.IO.File]::WriteAllText(
        $passwordFile,
        $databasePassword,
        [System.Text.UTF8Encoding]::new($false)
      )
      & $initdb `
        -D $dataDirectory `
        -U $databaseUser `
        -A "scram-sha-256" `
        --pwfile=$passwordFile `
        --encoding="UTF8" `
        --locale="C"
      if ($LASTEXITCODE -ne 0) {
        throw "initdb failed with exit code $LASTEXITCODE."
      }
    } finally {
      if (Test-Path -LiteralPath $passwordFile) {
        Remove-Item -LiteralPath $passwordFile -Force
      }
    }

    Write-Output "PostgreSQL data cluster initialized at $dataDirectory."
  }

  "start" {
    $databasePassword = Get-LocalMigrationPassword $false
    if (-not (Test-ClusterInitialized)) {
      throw "PostgreSQL is not initialized. Run npm run db:local:init first."
    }
    if (Test-ServerReady) {
      Ensure-AppDatabase
      Write-Output "PostgreSQL is already accepting connections on 127.0.0.1:$port."
      break
    }

    New-Item -ItemType Directory -Force -Path $logDirectory | Out-Null
    & $pgCtl -D $dataDirectory -l $logFile -o "-h 127.0.0.1 -p $port" -w -t 60 start
    if ($LASTEXITCODE -ne 0 -or -not (Test-ServerReady)) {
      Write-Output "pg_ctl start did not report a ready server; trying direct postgres.exe startup against the existing data directory."
      Start-PostgresDirect
    }
    if (-not (Wait-UntilServerReady 60)) {
      throw "PostgreSQL did not become ready. Check $logFile."
    }
    Ensure-AppDatabase
    Write-Output "PostgreSQL is accepting connections on 127.0.0.1:$port."
  }

  "stop" {
    if ((-not (Test-ClusterInitialized)) -or (-not (Test-ServerReady))) {
      Write-Output "PostgreSQL is already stopped."
      break
    }

    & $pgCtl -D $dataDirectory -w -t 60 stop -m fast
    if ($LASTEXITCODE -ne 0) {
      throw "PostgreSQL did not stop cleanly."
    }
    Write-Output "PostgreSQL stopped."
  }

  "status" {
    if ((Test-ClusterInitialized) -and (Test-ServerReady)) {
      Write-Output "PostgreSQL is ready at 127.0.0.1:$port."
    } elseif (Test-ClusterInitialized) {
      Write-Output "PostgreSQL is initialized but stopped."
    } else {
      Write-Output "PostgreSQL is not initialized."
    }
  }
}
