# OPS_DBM_002 Runtime Role Runbook

- Ticket: `OPS_DBM_002`
- Date: 2026-08-20
- Scope: project-local Internal Pilot PostgreSQL only.

## Safety Rules

- Do not print or commit full `DATABASE_URL`, `MIGRATION_DATABASE_URL`, or passwords.
- Do not reset, reinitialize, delete, move, or overwrite `.local\postgres-data`.
- Do not modify `db/migrations/*.sql`.
- Do not run migration commands with `nettopo_runtime`.
- Do not grant `CREATE`, ownership, superuser, createdb, createrole, replication, or bypassrls to `nettopo_runtime`.

## Bootstrap

Run from the project root:

```powershell
Set-Location -LiteralPath "C:\Users\DUS\Desktop\project\nettopo-studio"
npm.cmd run db:local:status
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/bootstrap-local-runtime-role.ps1
```

Expected masked output:

```text
Runtime role bootstrap complete.
DATABASE_URL user: nettopo_runtime
MIGRATION_DATABASE_URL user: nettopo
Database: nettopo_studio
Secrets: masked; .env.local remains gitignored.
```

The script is idempotent. Running it again must produce the same masked result without deleting data or changing ownership.

## Expected Role Contract

- `MIGRATION_DATABASE_URL`: user `nettopo`.
- `DATABASE_URL`: user `nettopo_runtime`.
- Runtime role attributes:
  - `LOGIN`: true
  - `SUPERUSER`: false
  - `CREATEDB`: false
  - `CREATEROLE`: false
  - `REPLICATION`: false
  - `BYPASSRLS`: false
- Runtime database/schema permissions:
  - `CONNECT` on `nettopo_studio`
  - no database-level `CREATE`
  - no database-level `TEMPORARY`
  - `USAGE` on schema `public`
- Runtime object permissions:
  - existing tables: `SELECT`, `INSERT`, `UPDATE`, `DELETE`
  - existing sequences: `USAGE`, `SELECT`
- Future objects created by `nettopo`:
  - tables: `SELECT`, `INSERT`, `UPDATE`, `DELETE`
  - sequences: `USAGE`, `SELECT`

## QA Verification Matrix

Positive checks:

```powershell
npm.cmd run db:migrate
npm.cmd run db:verify
```

Expected:

- `db:migrate`: applied none, skipped existing migrations.
- `db:verify`: `ready:true`, `currentVersion:"0004"`.

Runtime DML fixture must be wrapped in a transaction and rolled back or explicitly deleted before rollback. The fixture row id used by OPS was:

```text
ops_dbm_002_runtime_fixture
```

Expected cleanup checks:

- fixture customer row count: `0`
- unexpected table count: `0`
- unexpected column count: `0`
- unexpected role count: `0`

Negative checks with `DATABASE_URL` / `nettopo_runtime`:

| Operation | Expected result |
|---|---|
| `CREATE TABLE public.ops_dbm_002_runtime_should_not_create(...)` | DENY |
| `CREATE TEMP TABLE ops_dbm_002_runtime_temp_should_not_create(...)` | DENY |
| `CREATE SCHEMA ops_dbm_002_runtime_schema_should_not_create` | DENY |
| `ALTER TABLE public.customers ADD COLUMN ...` | DENY |
| `DROP TABLE public.customers` inside transaction | DENY |
| `CREATE ROLE ops_dbm_002_should_not_exist` | DENY |

## Database-level TEMPORARY Boundary

PostgreSQL can allow temporary tables through the `PUBLIC` database privilege. The local Pilot bootstrap revokes only database-level `TEMPORARY` from `PUBLIC`:

```sql
REVOKE TEMPORARY ON DATABASE "nettopo_studio" FROM PUBLIC;
```

Impact confirmed during OPS:

- Local login roles were only `nettopo` and `nettopo_runtime`.
- `nettopo` remains database owner and still has `CREATE` and `TEMPORARY`.
- `nettopo_runtime` has `CONNECT` only at the database level.
- Migration still completed idempotently after the revoke.
- Schema verification still reported ready after the revoke.

Rollback, if PM explicitly approves reverting this hardening:

```sql
GRANT TEMPORARY ON DATABASE "nettopo_studio" TO PUBLIC;
```

Do not run the rollback unless a later approved OPS ticket decides that local Pilot requires inherited temporary-table access.

## Cleanup

No cleanup should be necessary after the denied DDL tests. If a future manual test accidentally creates an `ops_dbm_002_*` object, stop and escalate to PM before deleting objects outside an approved cleanup plan.
