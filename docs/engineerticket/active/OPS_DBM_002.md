# OPS_DBM_002 — 分離 Pilot Migration 與 Runtime PostgreSQL Role

| 欄位 | 值 |
|---|---|
| Group | OPS |
| Feature | DBM |
| Priority | P0 |
| Status | READY_FOR_QA |
| Planned Order | 021 |
| Checkpoint | Internal Pilot |
| Dependencies | OPS_DBM_001 READY_FOR_QA |
| Created／Updated | 2026-08-20 |

## Objective

在不重建資料庫、不搬移既有物件 ownership 的前提下，將 Application Runtime 與 Migration CLI 的 PostgreSQL 身分及權限真正分離，解除 `QA_DBM_001` 的真實整合驗收阻擋。

本票只處理本機 Internal Pilot DB role bootstrap 與驗證；不擴張為正式 production provisioning。

## Approved Decisions

- `PM_GOV_001-D02`：Migration 修改者與 Application Runtime 使用者分離。
- `PM_GOV_001-D03`、`D04`：先走輕量 Internal Pilot，且只使用 synthetic data。
- `PM_GOV_001-D11`、`D12`、`D13`：依追溯基線、核准架構與票面範圍工作。
- `PM_GOV_001-D15`：只操作已驗證可啟動的既有 local cluster，不 reset／reinit。
- `PM_GOV_001-D16`：保留既有 `nettopo` 為 Migration owner，新增 `nettopo_runtime`；不做 ownership 搬移。

## Requirement Traceability

| 欄位 | 內容 |
|---|---|
| User Intent | 以輕量、快速且可驗證方式落實「修改 DB 者」與「使用 DB 者」分離，支援內網 Pilot |
| Historical Sources | Migration Boundary 架構決議、`DEV_DBM_001`、`OPS_DBM_001`、`QA_DBM_001`、`.env.example`、README DB 設定 |
| Change Type | `EXTEND`：把已完成的程式邊界落實到真實 PostgreSQL role，不改既有 runtime／migration 程式契約 |
| Affected Layers | OPS local role bootstrap、`.env.local`、DB grants/default privileges、runbook；必要時更新無 secret 的範例文件 |
| Preserved Invariants | Runtime 不讀 migration SQL、不 migrate、不 DDL；Migration DSN 不 fallback；已發布 migration 不修改；既有資料不重建 |
| Conflict Check | 現況兩個 DSN 都使用 `nettopo`；此票只替換 `DATABASE_URL` 的 user，不改 `MIGRATION_DATABASE_URL` owner |
| Regression Map | role attributes、connect/schema/table/sequence grants、runtime DML、runtime DDL denial、migration idempotency、db:verify、secret leakage、重跑 idempotency |
| Rollback／No-path | 保留既有 migration owner 與資料；若必須轉移 ownership、重建 DB 或修改 migration，立即停下回 PM |

## Role Contract

### Migration role — `nettopo`

- 沿用目前資料庫與 schema 物件 owner。
- 只供 `MIGRATION_DATABASE_URL` 與受控維運工作使用。
- 可執行既有 migration runner 所需 DDL、migration lock、checksum 與正式字典更新。
- 本票不得重新命名、刪除、替換或轉移其既有 ownership。

### Runtime role — `nettopo_runtime`

- 新增具 LOGIN 的非 superuser role，使用本機產生且不入版控的密碼。
- 必須為 `NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS`。
- 可 CONNECT `nettopo_studio`、USAGE `public` schema。
- 對現有應用資料表只允許 `SELECT／INSERT／UPDATE／DELETE`。
- 對既有 sequences 只給 runtime DML 所需的 `USAGE／SELECT`。
- 不得擁有 schema 或應用資料表；不得 `CREATE／ALTER／DROP`。
- 不得讀取或執行 migration 檔，也不得具有 role management 權限。

### Future-object default privileges

- 由 migration owner `nettopo` 設定 default privileges，使未來 migration 建立的 tables 自動授予 `nettopo_runtime` DML，sequences 自動授予 `USAGE／SELECT`。
- 這是環境 bootstrap，不得寫入已發布的 `db/migrations/*.sql`。

## In Scope

- 先以 read-only SQL 盤點 current user、database/schema/table/sequence owner、role attributes 與現有 grants。
- 建立可重跑、預設不輸出 secret 的本機 role bootstrap script／runbook。
- 建立或校正 `nettopo_runtime` role 與最小 grants/default privileges。
- 僅更新被 `.gitignore` 排除的 `.env.local`：
  - `DATABASE_URL` 使用 `nettopo_runtime`。
  - `MIGRATION_DATABASE_URL` 保持 `nettopo`。
- 如需更新 README／`.env.example`，只能使用明確的假密碼，且說明 Pilot 與 production 差異。
- 以正向／反向 SQL 矩陣驗證 role contract。

## Out of Scope

- 正式 production DB、HA、backup、TLS、network ACL 或雲端 secret manager。
- 新增／修改 migration SQL、schema、business data 或 Demo seed。
- 轉移 database/schema/table/sequence ownership。
- 正式 OIDC／應用 RBAC／Customer scope。
- 啟動 `QA_DBM_001` 或修改 QA 驗收結論。

## Required Execution Order

1. 確認 `OPS_DBM_001` 的既有 cluster、database 與 migration 0001–0004 狀態；記錄遮蔽後證據。
2. Read-only 盤點 role、owner、grant 與 default privilege；如 owner 不是預期的 `nettopo`，停止回 PM。
3. 建立 idempotent role bootstrap；密碼只能由本機安全產生／注入，不得出現在 command output、文件或 Git diff。
4. 套用 `nettopo_runtime` role attributes、現有 table／sequence grants 與 `nettopo` default privileges。
5. 更新 `.env.local` 的分離 DSN，不顯示完整 DSN。
6. 依 Acceptance Matrix 驗證；第二次重跑 bootstrap 必須無破壞且結果一致。
7. 附證據，將本票改為 `READY_FOR_QA` 或 `BLOCKED`，停下交 PM。

## Acceptance Matrix

| 驗證 | Migration `nettopo` | Runtime `nettopo_runtime` |
|---|---:|---:|
| 連線 `nettopo_studio` | PASS | PASS |
| `db:migrate` idempotent | PASS | 不適用／不得使用 |
| `db:verify` schema ready | PASS 可輔助 | PASS |
| 讀取應用資料 | PASS | PASS |
| 受 transaction rollback 保護的 INSERT／UPDATE／DELETE fixture | PASS 可輔助 | PASS |
| `CREATE TABLE` | PASS | 必須 DENY |
| `CREATE TEMP TABLE` | PASS | 必須 DENY |
| `CREATE SCHEMA` | PASS | 必須 DENY |
| `ALTER TABLE` | PASS | 必須 DENY |
| `DROP TABLE` | PASS | 必須 DENY |
| 建立／修改 role | 受控維運 | 必須 DENY |

## Acceptance Criteria

- [x] `DATABASE_URL` 與 `MIGRATION_DATABASE_URL` 使用不同 username，且程式仍無 fallback。
- [x] `nettopo_runtime` role attributes 與最小 grants 符合 Role Contract。
- [x] Runtime 以 transaction rollback fixture 完成必要 DML，不留下測試資料。
- [x] Runtime 的 CREATE／ALTER／DROP 反向測試均被 PostgreSQL 拒絕。
- [x] Runtime 的 database-level `TEMPORARY`／`CREATE` privilege 已驗證為 false；`CREATE TEMP TABLE` 與 `CREATE SCHEMA` 均被 PostgreSQL 拒絕。
- [x] Migration role 可執行 `db:migrate`，重跑為 idempotent；`db:verify` 以 Runtime DSN 回 schema ready。
- [x] Default privileges 能涵蓋未來由 `nettopo` 建立的 table／sequence；驗證 fixture 完成後安全清理。
- [x] Bootstrap 連續執行兩次結果一致，不刪除資料、不搬移 ownership。
- [x] Git diff、logs、Ticket 與 runbook 不含真實 password 或完整 secret DSN。
- [x] 提供給 `QA_DBM_001` 的遮蔽版執行方式、預期 PASS／DENY 與 cleanup 規則。

## Stop Conditions

- 盤點結果顯示主要物件 owner 不是既有 `nettopo`，需要 ownership transfer 才能完成。
- 需要 reset／reinit／刪除／搬移既有 cluster、database 或資料。
- 需要修改已發布 migration 或把 role bootstrap 混入 application runtime。
- 需要把真實密碼寫入 tracked file、測試紀錄或命令輸出。
- Runtime 無法在不授予 DDL／ownership 的情況下完成必要業務 DML。
- 撤銷 inherited `TEMPORARY` 會影響未盤點的其他 login/user。

## Handoff

完成後只回報遮蔽證據並標為 `READY_FOR_QA`；由 PM 同步 Register，再交測試組執行 `QA_DBM_001`。維運組不得自行擴張到 `OPS_PIL_001` 或 production deployment。

## OPS Execution Evidence — 2026-08-20

### Traceability Gate

| 欄位 | 結論 |
|---|---|
| User Intent | 以本機 Internal Pilot PostgreSQL 真實 role/grant 落實 Migration 與 Runtime 分離，解除 QA_DBM_001 的 role blocker。 |
| Historical Sources | `REQUIREMENT-BASELINE.md`、`RULES.md`、`DECISION-LOG.md`、`ARCHITECTURE-MAP.md`、`DESIGN-DEVELOPMENT-MAP.md`、`OPS_DBM_001.md`、`QA_DBM_001.md`。 |
| Approved Decisions | `PM_GOV_001-D02`、`D03`、`D04`、`D11`、`D12`、`D13`、`D15`、`D16`。 |
| Change Type | `EXTEND`。 |
| Affected Layers | OPS local PostgreSQL role/grants、ignored `.env.local` DSN、local bootstrap script、runbook、ticket evidence。 |
| Preserved Invariants | 未 reset/reinit/delete/move data directory；未修改 migration SQL；未修改產品 runtime/migration 程式契約；Runtime 不 DDL、不 migrate、不讀 SQL。 |
| Conflict Check | 既有 DB 與 23 張 public tables owner 均為 `nettopo`；schema owner 為 PostgreSQL 17 default `pg_database_owner`，database owner 為 `nettopo`，不需要 ownership transfer。 |
| Regression Map | local status、owner inventory、role attributes、table grants、default privileges、runtime DML rollback、runtime DDL denial、bootstrap idempotency、`db:migrate`、`db:verify`、secret scan。 |
| Rollback／No-path | 若 QA 發現權限不足，重跑 bootstrap；若需要 ownership transfer、DB rebuild 或 migration SQL 修改，停止回 PM。 |

### Read-only Inventory

- Existing cluster：`C:\Users\DUS\Desktop\project\nettopo-studio\.local\postgres-data`
- PostgreSQL version：`17`
- Local server：`127.0.0.1:5432` ready。
- Database：`nettopo_studio`
- Database owner：`nettopo`
- Public table owners：23 tables owned by `nettopo`
- Sequences：0 existing sequences
- Schema migrations：4 rows，current max version `0004`
- `.env.local`：gitignored；full DSN 與 password 未寫入本票。

### Changes

- Added `scripts/bootstrap-local-runtime-role.ps1`.
  - Reads `.env.local` and requires `MIGRATION_DATABASE_URL` user `nettopo`.
  - Creates or updates `nettopo_runtime` with a local strong password.
  - Writes active runtime DSN only to ignored `.env.local`.
  - Applies role attributes, current table/sequence grants, and future default privileges.
  - Uses `psql` stdin for SQL and does not print active password or full DSN.
- Added `docs/engineerticket/runbooks/OPS_DBM_002-runtime-role.md`.

### Bootstrap Verification

- First successful run:
  - `DATABASE_URL user: nettopo_runtime`
  - `MIGRATION_DATABASE_URL user: nettopo`
  - `Database: nettopo_studio`
  - secrets masked
- Second run:
  - same masked result
  - no data deletion
  - no ownership transfer

Note: an initial pre-fix failed invocation used an invalid dynamic SQL quote pattern and printed an inactive generated candidate password in Codex tool output and PostgreSQL local log context. That candidate was never applied to PostgreSQL and was never written to `.env.local`. The corrected successful bootstrap generated the active runtime password afterward and did not print it. The inactive candidate token was redacted from `.local\logs\postgres.log`; a follow-up log scan found no long token, full DSN, or runtime password pattern.

### Role And Grant Verification

- `nettopo_runtime` attributes:
  - `rolcanlogin`: `true`
  - `rolsuper`: `false`
  - `rolcreatedb`: `false`
  - `rolcreaterole`: `false`
  - `rolreplication`: `false`
  - `rolbypassrls`: `false`
- Current table grants for `nettopo_runtime`:
  - `SELECT`: 23 tables
  - `INSERT`: 23 tables
  - `UPDATE`: 23 tables
  - `DELETE`: 23 tables
- Default privileges by `nettopo`:
  - tables: `arwd` for `nettopo_runtime`
  - sequences: `rU` for `nettopo_runtime`
- DSN split:
  - `DATABASE_URL`: user `nettopo_runtime`, host `127.0.0.1`, port `5432`, database `nettopo_studio`, password masked
  - `MIGRATION_DATABASE_URL`: user `nettopo`, host `127.0.0.1`, port `5432`, database `nettopo_studio`, password masked

### Runtime Positive Fixture

Runtime user `nettopo_runtime` completed a transaction-protected fixture on `customers`:

- `INSERT`: PASS
- `UPDATE`: PASS
- `DELETE`: PASS
- inside transaction row count：`1`
- after rollback row count：`0`

### Runtime Negative Tests

Runtime user `nettopo_runtime` was denied:

- `CREATE TABLE public.ops_dbm_002_runtime_should_not_create`：DENY PASS (`permission denied for schema public`)
- `ALTER TABLE public.customers ADD COLUMN ...`：DENY PASS (`must be owner of table customers`)
- `DROP TABLE public.customers`：DENY PASS (`must be owner of table customers`)
- `CREATE ROLE ops_dbm_002_should_not_exist`：DENY PASS (`permission denied to create role`)

Cleanup verification:

- fixture customer rows：`0`
- unexpected table rows：`0`
- unexpected column rows：`0`
- unexpected role rows：`0`

### PM Supplemental DDL Boundary — Database TEMPORARY／CREATE

PM review requested explicit coverage for database-level `TEMPORARY` and `CREATE` privileges.

Initial read-only check:

- `has_database_privilege('nettopo_runtime', current_database(), 'TEMPORARY')`：`true`
- `has_database_privilege('nettopo_runtime', current_database(), 'CREATE')`：`false`
- Database ACL showed `PUBLIC` carried inherited `TEMPORARY`.
- Local Pilot login roles were only:
  - `nettopo`
  - `nettopo_runtime`

Initial runtime behavior:

- `CREATE TEMP TABLE ops_dbm_002_runtime_temp_should_not_create(...)`：UNEXPECTED PASS
- `CREATE SCHEMA ops_dbm_002_runtime_schema_should_not_create`：DENY PASS

Minimal correction:

- Updated `scripts/bootstrap-local-runtime-role.ps1` to run:
  - `REVOKE TEMPORARY ON DATABASE "nettopo_studio" FROM PUBLIC`
- No migration SQL, ownership, schema, product code, package/env contract, QA conclusion, or DB data was changed.
- No password was regenerated or printed by this supplemental correction; the existing `.env.local` runtime DSN was reused.

Impact and rollback:

- Confirmed local Pilot had only `nettopo` owner and `nettopo_runtime` login roles before revoking inherited TEMPORARY.
- `nettopo` remains database owner and still has `CREATE` and `TEMPORARY`.
- `nettopo_runtime` now has database-level `CONNECT` only.
- If PM later approves reverting this hardening, rollback is `GRANT TEMPORARY ON DATABASE "nettopo_studio" TO PUBLIC`; do not run without a new approved OPS ticket.

Supplemental verification after correction:

- Bootstrap run 1 after correction：PASS, masked output only.
- Bootstrap run 2 after correction：PASS, masked output only.
- Runtime database privilege booleans:
  - `TEMPORARY`: `false`
  - `CREATE`: `false`
- Migration owner database privilege booleans:
  - `TEMPORARY`: `true`
  - `CREATE`: `true`
- Runtime `CREATE TEMP TABLE ...`：DENY PASS (`permission denied to create temporary tables in database "nettopo_studio"`)
- Runtime `CREATE SCHEMA ...`：DENY PASS (`permission denied for database nettopo_studio`)
- Cleanup verification:
  - unexpected schema rows：`0`
  - unexpected persistent table rows：`0`
- `npm.cmd run db:migrate` after correction：
  - `PostgreSQL migrations complete. Applied: none. Skipped: 4.`
- `npm.cmd run db:verify` after correction：
  - `ready: true`
  - `currentVersion: 0004`
  - `action: schema ready`

### Migration And Schema Verification

- `npm.cmd run db:migrate`
  - `PostgreSQL migrations complete. Applied: none. Skipped: 4.`
- `npm.cmd run db:verify`
  - `ready: true`
  - `requiredVersion: 0004`
  - `currentVersion: 0004`
  - `action: schema ready`

### Secret And Scope Check

- `.env.local` is ignored by `.gitignore`.
- No active password or full secret DSN was added to tracked files.
- No product code, schema, migration SQL, package contract, RBAC, or QA conclusion was modified by this ticket.

### Handoff

`OPS_DBM_002` is `READY_FOR_QA`.

PM may synchronize the ticket register and hand this to QA for `QA_DBM_001`. OPS stops here and does not start deployment or later DB tickets.
