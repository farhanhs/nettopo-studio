# OPS_SEC_001 Local Secret Rotation Runbook

- Ticket: `OPS_SEC_001`
- Date: 2026-08-20
- Scope: project-local Internal Pilot PostgreSQL credentials only.

## Safety Rules

- Do not print old passwords, new passwords, full DSNs, or SQL containing secrets.
- Do not commit `.env.local`, `.local`, or any generated password file.
- Do not reset, reinitialize, delete, move, or overwrite `.local\postgres-data`.
- Do not change role ownership, grants, schema, migrations, product code, or QA conclusions.
- Runtime must remain `nettopo_runtime`; migration owner remains `nettopo`.

## Rotation Command

Run from the project root:

```powershell
Set-Location -LiteralPath "C:\Users\DUS\Desktop\project\nettopo-studio"
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/rotate-local-migration-password.ps1
```

Expected masked output:

```text
Local migration credential rotation complete.
MIGRATION_DATABASE_URL user: nettopo
DATABASE_URL user: nettopo_runtime
Old credential rejected: true
New credential accepted: true
Secrets: masked; .env.local remains gitignored.
```

## Failure Seam And Rollback

The rotation script performs these steps in one controlled flow:

1. Read the old ignored `.env.local` content into memory.
2. Read the old migration credential only from ignored `.env.local`.
3. Confirm the old migration credential can connect before changes.
4. Confirm `DATABASE_URL` still uses `nettopo_runtime`.
5. Generate a new high-entropy migration password in memory.
6. Change only the `nettopo` role password.
7. Atomically replace `.env.local` with the updated `MIGRATION_DATABASE_URL`.
8. Verify the new credential connects.
9. Verify the old credential is rejected.

If the DB password is changed but `.env.local` update or post-check fails, the script uses the new in-memory credential to restore the old DB password, then restores the old `.env.local` content. If rollback itself cannot be verified, stop and escalate to PM.

## Post-rotation Verification

```powershell
npm.cmd run db:local:stop
npm.cmd run db:local:start
npm.cmd run db:local:stop
npm.cmd run db:local:start
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/bootstrap-local-runtime-role.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/bootstrap-local-runtime-role.ps1
npm.cmd run db:migrate
npm.cmd run db:verify
```

Expected:

- start/stop/restart works without tracked default passwords.
- runtime bootstrap remains idempotent and masked.
- migration remains idempotent.
- schema verification reports `ready:true`, `currentVersion:"0004"`.
- runtime DDL and temporary table smoke tests remain denied.

## Tracked Defaults

Tracked files must use placeholders or required environment variables only:

- `.env.example`: `REPLACE_WITH_RUNTIME_PASSWORD`, `REPLACE_WITH_MIGRATION_PASSWORD`
- `README.md`: placeholder DSNs only
- `docker-compose.yml`: `${NETTOPO_POSTGRES_PASSWORD:?Set NETTOPO_POSTGRES_PASSWORD outside source control}`
- `scripts/postgres-local.ps1`: no password fallback; reads ignored `.env.local` or explicit local env secret

## Rollback Command

There is no standalone rollback command because rollback requires the old password to remain only in memory. If rotation reports failure, use the script's built-in rollback result. If the process is interrupted after DB password change and before env update, stop and escalate to PM; do not reconstruct secrets from logs or tracked files.
