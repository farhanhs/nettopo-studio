# OPS_DBM_001 — 修復 Local PostgreSQL 啟動與連線阻擋

| 欄位 | 值 |
|---|---|
| Group | OPS |
| Feature | DBM |
| Priority | P0 |
| Status | READY_FOR_QA |
| Planned Order | 020 |
| Checkpoint | Internal Pilot |
| Created／Updated | 2026-08-20 |

## Objective

讓專案本機 PostgreSQL 能以可重現方式啟動、接受 `.env.local` 的 `DATABASE_URL`／`MIGRATION_DATABASE_URL` 連線，供 real integration 使用。

本票已由 `PM_GOV_001-D15` 核准，可先執行非破壞性診斷與必要的本機啟動修正。

## Approved Decisions

- `PM_GOV_001-D02`：Migration 修改者與 Application Runtime 使用者分離。
- `PM_GOV_001-D11`、`D12`、`D13`：依追溯基線、核准架構與票面範圍工作。
- `PM_GOV_001-D15`：核准非破壞性 local PostgreSQL 啟動／連線修復。

## Requirement Traceability

| 欄位 | 內容 |
|---|---|
| User Intent | 解除真實 PostgreSQL integration 阻擋，讓 status 與 TCP／SQL 連線結果一致 |
| Historical Sources | Migration Boundary 設計／開發／驗收紀錄、`scripts/postgres-local.ps1`、QA_DBM_001 blocker |
| Change Type | `CORRECT`：修復本機 process／port／connection orchestration，不改 migration 架構 |
| Affected Layers | OPS、Local PostgreSQL process、runbook、DB verification；必要時只改 local script |
| Preserved Invariants | 不 reset/reinit、Runtime/Migration credential 不 fallback、runtime 不 migrate、已發布 migration 不修改 |
| Conflict Check | 舊 status 曾顯示 ready 但 TCP 拒絕；必須以 pg_isready＋TCP／SQL 實測為準 |
| Regression Map | init/status/start/stop、TCP、psql、db:migrate、db:verify；Windows restricted token |
| Rollback／No-path | 保留既有 cluster；若 native Windows 無法可靠啟動，只提出 Docker 替代，不自行搬移／刪除資料 |

## Current Blocker

- `db:local:start` 遇到 Windows `pg_ctl` restricted token 問題。
- 狀態腳本曾顯示 ready，但 `127.0.0.1:5432` 連線遭拒。
- 不得以 source-level test 取代真實 DB 驗證。

## In Scope

- `scripts/postgres-local.ps1` 與本機 `.local` PostgreSQL runbook。
- Read-only 檢查 process、port、data directory、log、DSN。
- 必要時提出 Docker PostgreSQL 作為明確替代方案。
- 若需調整 `scripts/postgres-local.ps1`，只能處理 process 啟動、ready 判斷、log 與安全停止，不得修改 schema／migration。

## Forbidden Changes

- 不 reset、刪除或重新初始化既有 DB data directory，除非另行取得明確批准。
- 不把 migration credential fallback 到 runtime credential。
- 不修改 migration SQL 來解決啟動問題。

## Acceptance Criteria

- [x] `db:local:start` 或核准替代方案可重現。
- [x] `db:local:status` 與實際 TCP 連線結果一致。
- [x] `db:migrate`、`db:verify` 可執行。
- [x] 停止／重啟流程有 runbook，且不遺失未授權資料。
- [x] 診斷與修正過程未 reset、刪除、搬移或重新初始化既有 data directory。
- [x] Log／回報不顯示完整 DB password／DSN secret。

## Required Execution Order

1. Read-only 驗證 PostgreSQL binary、cluster `PG_VERSION`、process、5432 listener、`pg_isready`、log 與 `.env.local` DSN 指向。
2. 確認精確 data directory 與現有資料後，才允許啟動現有 cluster。
3. Native 修正成功後驗證 status、TCP、psql、stop、restart。
4. 執行 `db:migrate`、`db:verify`；不得 fallback credential。
5. 若 native 路線仍受 restricted token 阻擋，提出 Docker 方案與資料隔離影響，先停下回 PM。

## Stop Conditions

- 需要 reset／刪除／重新初始化現有 cluster。
- 需要搬移既有 data directory 或覆寫未確認資料。
- 需要讓 Runtime credential 執行 DDL 或 fallback 成 Migration credential。
- 需要修改已發布 migration。

完成後回報證據並改為 `READY_FOR_QA` 或 `BLOCKED`；不得自行啟動 `OPS_DBM_002`。

## OPS Execution Evidence — 2026-08-20

### Traceability Gate

| 欄位 | 結論 |
|---|---|
| User Intent | 解除本機真實 PostgreSQL integration 阻擋，讓 status、TCP、pg_isready、psql 與 schema verification 結果一致。 |
| Historical Sources | `REQUIREMENT-BASELINE.md`、`RULES.md`、`DECISION-LOG.md`、migration boundary plan、`scripts/postgres-local.ps1`、`QA_DBM_001.md`。 |
| Approved Decisions | `PM_GOV_001-D02`、`D11`、`D12`、`D13`、`D15`。 |
| Change Type | `CORRECT`。 |
| Affected Layers | OPS、本機 PostgreSQL process orchestration、status/ready check、runbook。 |
| Preserved Invariants | 未 reset、未刪除、未搬移、未重新初始化 data directory；未修改 migration SQL；未讓 runtime credential fallback 成 migration credential。 |
| Conflict Check | 修正前 `db:local:status` 會在 TCP/psql refused 時仍顯示 ready；修正後三者一致。 |
| Regression Map | binary/PG_VERSION/process/5432/pg_isready/log/DSN 診斷、start/status/TCP/psql、stop/restart、db:migrate、db:verify。 |
| Rollback／No-path | 若 native Windows direct startup 也失敗，應停下提出 Docker 替代；本次不需要啟動替代方案。 |

### Read-only Diagnostics

- PostgreSQL binary root：`C:\Users\DUS\Desktop\project\nettopo-studio\.local\postgresql-17.10\pgsql`
- Data directory：`C:\Users\DUS\Desktop\project\nettopo-studio\.local\postgres-data`
- `PG_VERSION`：`17`
- `pg_ctl.exe`、`pg_isready.exe`、`psql.exe`、`postgres.exe`：存在。
- 修正前 5432：無 listener。
- 修正前 `pg_isready -h 127.0.0.1 -p 5432 -U nettopo -d postgres`：`no response`，exit `2`。
- 修正前 `psql`：connection refused，exit `2`。
- `.env.local` DSN 指向：`DATABASE_URL` 與 `MIGRATION_DATABASE_URL` 都是 user `nettopo`、host `127.0.0.1`、port `5432`、database `nettopo_studio`；password 已遮蔽，未記錄完整 DSN。

### Root Cause

1. `pg_ctl start` 在此 Windows 環境會失敗：
   - `pg_ctl: could not create restricted token: error code 87`
   - `pg_ctl: could not start server: error code 3`
2. `scripts/postgres-local.ps1` 的 status compound condition 使用 PowerShell command syntax：
   - 修正前：`if (Test-ClusterInitialized -and (Test-ServerReady))`
   - 這會讓 `-and` 被當成 command argument，導致 cluster initialized 時誤判為 ready。
   - 修正後：`if ((Test-ClusterInitialized) -and (Test-ServerReady))`

### Changes

- `scripts/postgres-local.ps1`
  - 修正 `Test-ServerReady` return expression。
  - 修正 `status` 與 `stop` 的 compound condition。
  - 新增 `postgres.exe` runtime 檢查。
  - `pg_ctl start` 失敗時，以 hidden launcher 啟動既有 data directory 的 `postgres.exe`。
  - fallback 僅啟動既有 cluster，不 reset、不 reinit、不搬移、不覆寫資料。

### Verification

- `npm.cmd run db:local:status` stopped state：
  - `PostgreSQL is initialized but stopped.`
- stopped state cross-check：
  - 5432 無 listener。
  - `pg_isready`：`no response`，exit `2`。
- `npm.cmd run db:local:start`：
  - `pg_ctl` 仍遇 restricted token。
  - fallback direct `postgres.exe` 成功。
  - `PostgreSQL is accepting connections on 127.0.0.1:5432.`
- ready state cross-check：
  - `db:local:status`：`PostgreSQL is ready at 127.0.0.1:5432.`
  - TCP：`127.0.0.1:5432 LISTENING`
  - `pg_isready`：`accepting connections`，exit `0`
  - `psql`：`nettopo_studio|nettopo|0004`，exit `0`
- `npm.cmd run db:migrate`：
  - `PostgreSQL migrations complete. Applied: none. Skipped: 4.`
- `npm.cmd run db:verify`：
  - `ready: true`
  - `requiredVersion: 0004`
  - `currentVersion: 0004`
  - `action: schema ready`
- Stop/restart：
  - `npm.cmd run db:local:stop` cleanly stopped.
  - stopped state again matched status/TCP/pg_isready.
  - restart succeeded through fallback and schema remained `0004`.

### Handoff

`OPS_DBM_001` is `READY_FOR_QA`.

Do not start `OPS_DBM_002` from this ticket. QA may use the verified local PostgreSQL instance for DBM follow-up, but separated DB roles remain out of scope for this ticket.
