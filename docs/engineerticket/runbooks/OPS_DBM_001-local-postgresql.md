# OPS_DBM_001 Local PostgreSQL Runbook

- Ticket：`OPS_DBM_001`
- Date：2026-08-20
- Scope：project-local Windows PostgreSQL runtime only.

## Paths

- Project root：`C:\Users\DUS\Desktop\project\nettopo-studio`
- PostgreSQL runtime：`C:\Users\DUS\Desktop\project\nettopo-studio\.local\postgresql-17.10\pgsql`
- Existing data directory：`C:\Users\DUS\Desktop\project\nettopo-studio\.local\postgres-data`
- Main log：`C:\Users\DUS\Desktop\project\nettopo-studio\.local\logs\postgres.log`
- Direct fallback launcher：`C:\Users\DUS\Desktop\project\nettopo-studio\.local\logs\postgres-direct-start.cmd`

## Safety Rules

- Do not delete, reset, move, overwrite, or reinitialize `.local\postgres-data` without a new explicit approval.
- Do not modify published migration SQL files to fix local startup.
- Do not copy or print full `DATABASE_URL`, `MIGRATION_DATABASE_URL`, or passwords in reports.
- Migration remains separate from runtime. Use `MIGRATION_DATABASE_URL` for migration commands.

## Normal Commands

```powershell
Set-Location -LiteralPath "C:\Users\DUS\Desktop\project\nettopo-studio"
npm.cmd run db:local:status
npm.cmd run db:local:start
npm.cmd run db:migrate
npm.cmd run db:verify
```

Stop when finished:

```powershell
Set-Location -LiteralPath "C:\Users\DUS\Desktop\project\nettopo-studio"
npm.cmd run db:local:stop
```

## Verification Commands

Status:

```powershell
npm.cmd run db:local:status
```

TCP listener:

```powershell
netstat -ano | Select-String ':5432'
```

PostgreSQL readiness:

```powershell
& ".local\postgresql-17.10\pgsql\bin\pg_isready.exe" -h 127.0.0.1 -p 5432 -U nettopo -d postgres
```

Schema verification:

```powershell
npm.cmd run db:verify
```

Expected ready result:

```text
PostgreSQL schema {"ready":true,"state":"ready","requiredVersion":"0004","currentVersion":"0004","action":"schema ready"}
```

## Windows Restricted Token Fallback

On this machine, `pg_ctl start` may fail with:

```text
pg_ctl: could not create restricted token: error code 87
pg_ctl: could not start server: error code 3
```

The local script now falls back to a hidden `postgres.exe` launcher against the existing data directory. This does not reset or reinitialize the cluster.

## Stop/Restart Proof Pattern

1. Run `npm.cmd run db:local:stop`.
2. Confirm:
   - status says initialized but stopped
   - no `127.0.0.1:5432 LISTENING`
   - `pg_isready` says no response
3. Run `npm.cmd run db:local:start`.
4. Confirm:
   - status says ready
   - `127.0.0.1:5432 LISTENING`
   - `pg_isready` says accepting connections
   - `npm.cmd run db:verify` reports `currentVersion:"0004"`
