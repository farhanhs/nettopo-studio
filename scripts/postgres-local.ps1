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
$databasePassword = if ($env:NETTOPO_LOCAL_DB_PASSWORD) {
  $env:NETTOPO_LOCAL_DB_PASSWORD
} else {
  "nettopo_dev_password"
}

$initdb = Join-Path $postgresBin "initdb.exe"
$pgCtl = Join-Path $postgresBin "pg_ctl.exe"
$pgIsReady = Join-Path $postgresBin "pg_isready.exe"
$psql = Join-Path $postgresBin "psql.exe"
$createdb = Join-Path $postgresBin "createdb.exe"

function Assert-PostgresRuntime {
  if (-not (Test-Path -LiteralPath $initdb) -or -not (Test-Path -LiteralPath $pgCtl)) {
    throw "PostgreSQL 17.10 runtime was not found at $postgresRoot."
  }
}

function Test-ClusterInitialized {
  return Test-Path -LiteralPath (Join-Path $dataDirectory "PG_VERSION")
}

function Test-ServerReady {
  & $pgIsReady -h 127.0.0.1 -p $port -U $databaseUser -d "postgres" *> $null
  return $LASTEXITCODE -eq 0
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
      throw "PostgreSQL did not become ready. Check $logFile."
    }
    Ensure-AppDatabase
    Write-Output "PostgreSQL is accepting connections on 127.0.0.1:$port."
  }

  "stop" {
    if (-not (Test-ClusterInitialized) -or -not (Test-ServerReady)) {
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
    if (Test-ClusterInitialized -and (Test-ServerReady)) {
      Write-Output "PostgreSQL is ready at 127.0.0.1:$port."
    } elseif (Test-ClusterInitialized) {
      Write-Output "PostgreSQL is initialized but stopped."
    } else {
      Write-Output "PostgreSQL is not initialized."
    }
  }
}
