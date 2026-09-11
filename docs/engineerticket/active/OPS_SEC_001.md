# OPS_SEC_001 — 輪替 Local DB Credential 並移除 Tracked 有效預設值

| 欄位 | 值 |
|---|---|
| Group | OPS |
| Feature | SEC |
| Priority | P0 |
| Status | READY_FOR_QA |
| Planned Order | 023 |
| Checkpoint | Internal Pilot |
| Dependencies | QA_DBM_001 QA_FAILED |
| Created／Updated | 2026-08-20 |

## Objective

修正 `QA_DBM_001` 唯一 release blocker：目前 local Migration owner 的 active password 等於 tracked 開發預設值。輪替 active Migration credential，並把 tracked 設定改成明確 placeholder／required env，使任何 tracked 字串都不可能同時是 local active DB credential。

這是 P0 corrective action；不重做已通過的 Migration／Runtime role 架構。

## Approved Decisions

- `PM_GOV_001-D02`、`D16`：Migration owner 與 Runtime role 維持分離，既有 `nettopo` ownership 不搬移。
- `PM_GOV_001-D04`：環境只包含 synthetic Pilot data。
- `PM_GOV_001-D11`、`D12`、`D13`：依 QA 證據與核准架構做最小修正。
- `PM_GOV_001-D17`：active credential 不得等於 tracked example/default；secret 只存 ignored `.env.local`。
- `PM_GOV_001-D18`：目前 native Windows Pilot 只要求 Compose 靜態 fail-closed／zero-secret；實際 Docker parse 在採用 Docker 路線前由 `OPS_PIL_001` 驗證。

## Requirement Traceability

| 欄位 | 內容 |
|---|---|
| User Intent | 保持輕量快速 Pilot，同時避免開發預設密碼直接成為實際可登入 credential |
| Historical Sources | `QA_DBM_001` 失敗報告、`OPS_DBM_001`、`OPS_DBM_002`、`.env.example`、README、Docker Compose、local PostgreSQL script |
| Change Type | `CORRECT`：修正 active secret lifecycle，不改 DB schema／role 語意 |
| Affected Layers | local `nettopo` credential、ignored `.env.local`、local init/start script、`.env.example`、README、`docker-compose.yml`、OPS runbook |
| Preserved Invariants | Runtime/Migration 分離；Runtime 不 DDL；不 reset/reinit；不搬 ownership；不修改 migration；不顯示或 commit secret |
| Conflict Check | Runtime active password 已是非 tracked 隨機值；只需輪替 Migration owner active password，不能誤把 Runtime 改回共用 DSN |
| Regression Map | credential rotation/rollback、start/stop/restart、bootstrap idempotency、migrate/verify、DB role/DDL matrix、tracked/local-log leakage scan、fresh-init fail-closed |
| Rollback／No-path | Rotation 與 `.env.local` 更新必須同一受控流程；任一步失敗需用仍在記憶體中的舊 credential 回復，不可留下不可登入 cluster |

## Root Cause

- `nettopo_runtime` 使用隨機 local password，未命中 tracked files。
- Migration owner `nettopo` 仍沿用早期 tracked 開發預設值。
- 同一字串存在 `.env.example`、README、`docker-compose.yml`、`scripts/postgres-local.ps1`，因此 QA active-secret scan 正確失敗。

本票與後續文件不得抄錄或輸出該字串。

## In Scope

### 1. Active credential rotation

- 以目前 `MIGRATION_DATABASE_URL` 建立受控連線，生成新的密碼學安全 random Migration password。
- 修改既有 `nettopo` password 後，原子更新 ignored `.env.local` 的 `MIGRATION_DATABASE_URL`。
- `DATABASE_URL` 必須仍是 `nettopo_runtime`，不得變回 `nettopo`。
- Rotation script 不得輸出 old/new password、完整 DSN 或含 secret 的 SQL／exception context。
- 若 `.env.local` 更新或 post-check 失敗，必須在同一受控連線生命週期內回復舊 password／舊 `.env.local`；無法保證時先停下回 PM。

### 2. Remove tracked valid defaults

- `.env.example`：改為分離的 runtime/migration username 與明確 `REPLACE_WITH_*` placeholder；不得提供可直接使用的 password。
- README：同上，移除「local 可讓兩個 DSN 相同」的過時文字；指向安全 bootstrap／rotation runbook。
- `docker-compose.yml`：PostgreSQL password 必須由 required environment variable 注入；未提供時 fail closed，不得有 fallback default。
- `scripts/postgres-local.ps1`：移除 tracked password fallback。
  - 既有 cluster 的 start/Ensure-AppDatabase 應安全讀取 ignored `.env.local` Migration DSN，或使用明確注入的 local env secret。
  - 新 cluster init 必須生成安全 local secret並只寫 ignored `.env.local`，或在沒有明確 secret 時 fail closed；不得重新建立 Runtime/Migration 共用 DSN。

### 3. Verification and documentation

- 新增最小 OPS runbook，涵蓋 rotation、fresh init、recovery、masked output 與 QA handoff。
- 重新執行 start/stop/restart、Runtime bootstrap、`db:migrate`、`db:verify`。
- 以 QA 的 active-secret scan 邏輯預檢 tracked files 與 local logs，但 OPS 不得修改 QA 測試或結論。

## Out of Scope

- 重建／重置 cluster、database、schema 或 business data。
- 轉移 ownership、重新命名 role、修改 grants 或 application RBAC。
- 修改 `db/migrations/*.sql`、產品功能或 QA acceptance。
- production secret manager、Docker production deployment、OIDC 或 Pilot deployment。
- 刪除或覆蓋 QA 失敗紀錄。

## Required Execution Order

1. Read-only 盤點 DB ready、current owner、兩個 DSN username、`.env.local` ignored 與 tracked 命中檔案；全程遮蔽。
2. 先完成 rotation script 的 failure rollback／atomic env update 設計，再實際輪替；不得用手動分離命令造成中間不可回復狀態。
3. 輪替 Migration password並更新 `.env.local`，立即以新 credential 驗證連線；舊 credential 必須失效。
4. 修改四個 tracked source 的 default／placeholder 行為；不得將新 secret帶入 patch。
5. 重跑 local start/stop/restart、Runtime bootstrap、migrate、verify 與角色關鍵負向 smoke。
6. 執行 tracked files/local logs secret scan、Git ignored 與 diff 檢查；輸出只准檔名與 PASS/FAIL。
7. 更新票與 runbook，狀態只改為 `READY_FOR_QA` 或 `BLOCKED`，停下交 PM。

## Acceptance Criteria

- [x] Local Migration password 已輪替為高熵值，舊 credential 無法登入；兩者值均未出現在輸出或文件。
- [x] `.env.local` 仍被 ignore，Migration user=`nettopo`、Runtime user=`nettopo_runtime`，password 不相同。
- [x] `.env.example`、README、Compose、local script 不含任何可直接使用的 DB password fallback。
- [x] Compose tracked config 無 password fallback，採 required-env fail-closed 語法且 zero-secret；依 `PM_GOV_001-D18`，本機缺 Docker CLI 的實際 parse 不屬本票放行條件，移交 `OPS_PIL_001`。
- [x] Local script 對既有 cluster 可使用 ignored `.env.local` 安全 start/restart；fresh init 不會建立 tracked/default credential或共用 DSN。
- [x] `nettopo` 仍是既有 DB／tables owner；`nettopo_runtime` attributes、DML grants 與所有 DDL/TEMP deny 不變。
- [x] Runtime bootstrap 連跑兩次、`db:migrate`、`db:verify` 通過。
- [x] QA active-secret scan 的 tracked file 與 local log 預檢均為零命中，且不輸出比對值。
- [x] rotation failure／env write failure 有可重現但不暴露 secret 的 rollback test 或安全 seam 證據。
- [x] 未 reset/reinit、未修改 migration/schema/business data、未改 QA 結論。

## Stop Conditions

- 無法在不顯示 secret 的情況下安全輪替或回復。
- 輪替後無法以新 credential 連線，且舊 credential也無法安全回復。
- local script 修正需要 reset/reinit 既有 cluster。
- 必須修改 DB role/grant、ownership、migration 或 QA test 才能通過。
- 發現 active secret 已進入 Git history 或外部系統；此票只處理 current working tree/local environment，需另開 incident scope。

## Handoff

完成後改為 `READY_FOR_QA`，由 PM 把 `QA_DBM_001` 改回 `READY` 並交測試組重驗。OPS 不得自行將 QA 標為通過，也不得啟動 Pilot 後續票。

## OPS Execution Evidence — 2026-08-20

### Traceability Gate

| 欄位 | 結論 |
|---|---|
| User Intent | 移除 tracked default credential 可直接登入 local Migration owner 的 P0 release blocker，同時保留輕量 Internal Pilot。 |
| Historical Sources | `QA_DBM_001` failure、`OPS_DBM_001`、`OPS_DBM_002`、`.env.example`、README、`docker-compose.yml`、`scripts/postgres-local.ps1`。 |
| Approved Decisions | `PM_GOV_001-D02`、`D04`、`D11`、`D12`、`D13`、`D16`、`D17`。 |
| Change Type | `CORRECT`。 |
| Affected Layers | local Migration credential、ignored `.env.local`、local PostgreSQL script、tracked env examples、Compose、README、OPS runbook。 |
| Preserved Invariants | Runtime/Migration 分離；Runtime 不 DDL/TEMP；不 reset/reinit；不搬 ownership；不修改 migration/schema/business data；不改 QA 結論。 |
| Conflict Check | `DATABASE_URL` 仍是 `nettopo_runtime`；只輪替 `MIGRATION_DATABASE_URL` 的 `nettopo` password。 |
| Regression Map | DB ready/owner、rotation old/new credential、start/stop/restart、runtime bootstrap idempotency、migrate/verify、Runtime DDL/TEMP deny、tracked/local log secret scan、Compose required env。 |
| Rollback／No-path | Rotation script 先保存舊 env 與舊 credential 在記憶體；post-check 失敗時回復 DB password 與 `.env.local`。若 rollback 也失敗，停止回 PM。 |

### Read-only Preflight

- `npm.cmd run db:local:status`：ready at `127.0.0.1:5432`。
- `.env.local`：ignored by `.gitignore`。
- DSN usernames only:
  - `DATABASE_URL` user：`nettopo_runtime`
  - `MIGRATION_DATABASE_URL` user：`nettopo`
- Database owner：`nettopo`
- Public table owners：23 tables owned by `nettopo`
- Pre-change tracked scan found the obsolete active-default pattern in tracked defaults; the secret value is intentionally not repeated in this ticket.

### Failure Seam / Rollback Design

Added `scripts/rotate-local-migration-password.ps1`.

The script:

1. Reads old `.env.local` content and old Migration credential only into memory.
2. Confirms old Migration credential connects before changes.
3. Confirms Runtime DSN remains `nettopo_runtime` and password differs from Migration.
4. Generates a high-entropy new Migration password in memory.
5. Changes only `nettopo` password.
6. Atomically rewrites ignored `.env.local` with only `MIGRATION_DATABASE_URL` changed.
7. Verifies new credential connects.
8. Verifies old credential is rejected.
9. On post-change failure, restores the DB password and old `.env.local` using in-memory values.

The script output is masked and does not print old/new password, full DSN, or SQL containing secrets.

### Active Rotation

- `scripts/rotate-local-migration-password.ps1`：PASS
- `MIGRATION_DATABASE_URL user`：`nettopo`
- `DATABASE_URL user`：`nettopo_runtime`
- old credential rejected：`true`
- new credential accepted：`true`
- runtime and migration passwords different：`true`

### Tracked Defaults Removed

- `.env.example`
  - Runtime DSN uses `nettopo_runtime` with `REPLACE_WITH_RUNTIME_PASSWORD`.
  - Migration DSN uses `nettopo` with `REPLACE_WITH_MIGRATION_PASSWORD`.
  - Removed statement allowing local DSNs to be the same.
- README
  - Shows separated placeholder DSNs only.
  - States local development must use different PostgreSQL usernames and different passwords.
  - Points to OPS runbooks for bootstrap/rotation.
- `docker-compose.yml`
  - Uses required env interpolation: `${NETTOPO_POSTGRES_PASSWORD:?Set NETTOPO_POSTGRES_PASSWORD outside source control}`.
  - No fallback default password remains.
- `scripts/postgres-local.ps1`
  - Removed tracked password fallback.
  - Existing cluster start reads ignored `.env.local` Migration DSN or explicit `NETTOPO_LOCAL_DB_PASSWORD`.
  - Fresh init generates a strong local Migration password and writes only ignored `.env.local`; it does not create a shared Runtime/Migration DSN.

### Verification

- `npm.cmd run db:local:stop`：PASS
- `npm.cmd run db:local:start`：PASS via existing Windows direct fallback against current data directory
- restart sequence stop/start：PASS
- `scripts/bootstrap-local-runtime-role.ps1` run 1：PASS, masked output
- `scripts/bootstrap-local-runtime-role.ps1` run 2：PASS, masked output
- `npm.cmd run db:migrate`：`Applied: none. Skipped: 4.`
- `npm.cmd run db:verify`：`ready:true`, `currentVersion:"0004"`
- Runtime DDL/TEMP smoke:
  - `CREATE TABLE`：DENY PASS
  - `CREATE TEMP TABLE`：DENY PASS
  - `CREATE SCHEMA`：DENY PASS
  - `CREATE ROLE`：DENY PASS

### Compose Check

- Docker CLI is not installed in this workstation, so OPS could not execute `docker compose config`.
- Static check confirmed `docker-compose.yml` uses Compose required environment interpolation and has no fallback password.
- QA should run:
  - without `NETTOPO_POSTGRES_PASSWORD`: expect Compose config failure
  - with explicit local secret env: expect Compose config parse success

### Secret Scan

- Active secret tracked-file scan：PASS
- Tracked default password scan：PASS
- Active secret local-log scan：PASS
- Local-log default password scan：PASS
- Secret values and full DSNs were not printed in ticket/runbook output.

### Scope Check

- No reset/reinit/delete/move of `.local\postgres-data`.
- No migration SQL changes.
- No schema/business data/product code changes.
- No DB ownership transfer.
- No DB grant changes beyond retaining the already-approved OPS_DBM_002 runtime boundary.
- No QA conclusion changes.

### Handoff

`OPS_SEC_001` is `READY_FOR_QA`.

PM may move `QA_DBM_001` back to `READY` for independent re-verification. OPS stops here.
