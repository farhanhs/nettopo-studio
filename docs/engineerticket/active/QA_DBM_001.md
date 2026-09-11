# QA_DBM_001 — 真實 PostgreSQL Migration Boundary 驗收

| 欄位 | 值 |
|---|---|
| Group | QA |
| Feature | DBM |
| Priority | P0 |
| Status | QA_PASSED |
| Planned Order | 022 |
| Checkpoint | Internal Pilot |
| Dependencies | OPS_DBM_001, OPS_DBM_002 |
| Created／Updated | 2026-08-20 |

## Objective

以真實 PostgreSQL 證明 Runtime 與 Migration 權限、schema 狀態、checksum、idempotency 與失敗恢復符合架構決議。

## Approved Decisions

- `PM_GOV_001-D02`：Migration 修改者與 Application Runtime 使用者分離。
- `PM_GOV_001-D03`、`D04`：先以 synthetic data 的 Internal Pilot 驗證。
- `PM_GOV_001-D11`、`D12`、`D13`：驗收必須能回溯核准決議與架構 map。
- `PM_GOV_001-D15`、`D16`：沿用既有 local cluster 與 `nettopo` Migration owner；Runtime 使用 `nettopo_runtime`，不得 DDL 或搬移 ownership。

## Requirement Traceability

| 欄位 | 內容 |
|---|---|
| User Intent | 獨立證明輕量 Pilot 的 DB 分權不是只有程式命名，而是真實 PostgreSQL 權限邊界 |
| Historical Sources | `DEV_DBM_001`、`OPS_DBM_001`、`OPS_DBM_002`、Migration Boundary 開發計畫與既有 source-level tests |
| Change Type | `VERIFY`：不得修改產品、OPS script、DB role/grant 或 QA 目標來配合結果 |
| Affected Layers | QA integration fixtures／report；只允許 transaction rollback 或明確票面命名的可清理 fixture |
| Preserved Invariants | 不 reset/reinit、不修改 migration SQL、不顯示 secret、不以 migration DSN 代替 runtime DSN |
| Conflict Check | OPS 曾有一組未套用候選密碼出現在工具輸出與 local log context；QA 必須獨立掃描 tracked files 與可用 local logs，不能只採信 OPS 結論 |
| Regression Map | role attributes、DML、DDL/TEMP deny、migration idempotency/checksum、schema states/TTL、artifact SQL/fs boundary、secret leakage、cleanup |
| Rollback／No-path | fixture 一律 rollback／清理；若需重建 DB、修改 role/grant 或揭露 DSN，停止回 PM |

## Acceptance Criteria

- [x] Migration role 可執行 migration；Runtime 的 CREATE TABLE／TEMP TABLE／SCHEMA、ALTER、DROP、CREATE ROLE 均被拒絕。
- [x] `MIGRATION_DATABASE_URL` 與 `DATABASE_URL` 不 fallback。
- [x] migrate 重跑 idempotent；修改已套用 SQL checksum 必須 fail。
- [x] schema uninitialized／outdated／too-new／mismatch／unavailable 回安全狀態。
- [x] migration 完成後 Runtime 在 TTL 後恢復，不需重啟。
- [x] App artifact 不包含 SQL body、migration loader 或 runtime `node:fs` 依賴。
- [x] 測試 fixture 清理可驗證，不影響其他資料。
- [x] `.env.local` 仍被 ignore；tracked files／可用 local logs 不含 active password、完整 DSN 或未核准候選 token。
- [x] OPS role bootstrap 重跑仍 idempotent，且不得為測試重新產生或輸出密碼。

## QA Result — 2026-08-20

- 結果：`QA_FAILED`。
- 測試紀錄：`docs/dev測試紀錄/qa-dbm-001-2026-08-20.md`。
- Blocker：`.env.local` 本身確實被 `.gitignore` 忽略，但 QA 的 active-secret 掃描發現目前 `.env.local` 使用中的 active password 字串也存在於 tracked files：`.env.example`、`README.md`、`docker-compose.yml`、`scripts/postgres-local.ps1`。QA 未輸出密碼或完整 DSN。
- DB 權限面已通過：Runtime role `nettopo_runtime` 為非 superuser／非 createdb／非 createrole／非 replication／非 bypassrls；Runtime 具 read + transaction rollback DML；CREATE TABLE、CREATE TEMP TABLE、CREATE SCHEMA、ALTER TABLE、DROP TABLE、CREATE ROLE 均 DENY；fixture 零殘留。
- Migration/schema 面已通過：`db:migrate` idempotent，`db:verify` ready，checksum mismatch fail-safe 後復原，TTL 後不用重啟恢復 ready。
- Artifact boundary 已通過：`dist` 未命中 migration SQL body、migration loader、`runPostgresMigrations`、runtime `node:fs` 或 `.sql?raw`。

### Stop Decision

依 PM 交接要求，QA 不修改產品、OPS script、role/grant、migration 或測試目標來配合通過；本票停在 `QA_FAILED`，等待 PM／OPS 決議。

## Required QA Order

1. Read-only 盤點 server ready、role、owner、grant、DSN username 與 migration version；輸出必須遮蔽。
2. 以 Runtime DSN 驗證必要讀寫並 rollback；確認 `db:verify` ready。
3. 執行全部 DDL/TEMP/role-management 負向矩陣並檢查零殘留。
4. 以 Migration DSN 驗證 migrate idempotency 與 checksum fail-safe；不得永久改寫已發布 migration。
5. 驗證 schema 狀態 fixtures、TTL recovery 及 artifact boundary。
6. 重跑 bootstrap idempotency與 secret/leakage scan；不得輸出完整 DSN／password。
7. 建立 `docs/dev測試紀錄/qa-dbm-001-*.md`，票面只改 `QA_PASSED` 或 `QA_FAILED`／`BLOCKED`，停下交 PM。

## Stop Conditions

- 需要 reset／reinit／刪除 database 或 cluster。
- 需要修改 role/grant、OPS script、migration SQL 或產品程式才能通過。
- 測試會顯示或保存 active password／完整 DSN。
- fixture 無法確保 rollback／cleanup，或可能碰觸非 synthetic data。

## Re-test Trigger

`OPS_SEC_001` 已完成 credential rotation 與 tracked default 移除並為 `READY_FOR_QA`。PM 將本票重新排入驗收；測試組必須保留首輪 `QA_FAILED` 紀錄，在同一報告追加 re-test，不能覆寫歷史失敗原因。

依 `PM_GOV_001-D18`，目前使用 native Windows PostgreSQL；本機沒有 Docker CLI 時，QA 只驗證 Compose required-env fail-closed 字面契約與 zero-secret，實際 `docker compose config` 由採用 Docker 路線前的 `OPS_PIL_001` 負責。

## QA Re-test Result — 2026-08-20

- 結果：`QA_FAILED`。
- 測試紀錄：`docs/dev測試紀錄/qa-dbm-001-2026-08-20.md` Re-test 段落。
- 改善確認：
  - active runtime／migration password 與完整 DSN 在 tracked files：PASS，零命中。
  - active runtime／migration password 與完整 DSN 在 local log：PASS，零命中。
  - 舊 tracked default credential 連線：PASS，已拒絕。
  - tracked files 可登入 DSN fallback：PASS，零命中；Compose 只保留 required-env placeholder。
  - Runtime DML rollback、CREATE/TEMP/SCHEMA/ALTER/DROP/CREATE ROLE deny、migrate idempotent、verify ready、checksum fail-safe／TTL recovery、schema fixtures、artifact boundary、bootstrap idempotent：PASS。
- Re-test blocker：local PostgreSQL log 仍含 `CREATE/ALTER ROLE ... PASSWORD` 類型歷史語句 context。QA 未輸出語句內容或 secret；此項仍違反 local logs 不得殘留候選 token／secret context 的驗收精神。

## PM Root-cause Correction — PM_GOV_003

第二次失敗後，PM 依治理規則做 root-cause review，沒有直接開第三張 OPS 局部清理票：

- 安全分類只輸出 count／boolean，未讀出或回報 token 值。
- local log 有 3 個 role-password statement context。
- 3 個 password operand 全部相同，且均為精確核准 marker `[REDACTED_TOKEN]`。
- active runtime/migration password、完整 DSN 與 high-entropy credential scan 都是零命中。

依 `PM_GOV_001-D19`，QA 應把 keyword-only assertion 改成 value-based assertion：

1. 仍必須拒絕 active secret、完整 DSN、舊可用 credential 與任何未核准 operand。
2. 每一個 role-password statement 的 password operand 必須可解析，且精確等於 `[REDACTED_TOKEN]`；否則失敗。
3. 不得刪除、截斷或改寫 local log 來讓測試通過。
4. QA 可以修正自己的測試語意並重跑，這是 acceptance correction，不是修改產品或 OPS 行為。

本票重新改為 `READY`；第三次只需針對校正後 gate 加上全矩陣 regression，保留前兩次 `QA_FAILED` 歷史。

## QA Third Re-test Result — 2026-08-20

- 結果：`QA_PASSED`。
- 測試紀錄：`docs/dev測試紀錄/qa-dbm-001-2026-08-20.md` Third Re-test 段落。
- PM_GOV_003／`PM_GOV_001-D19` 校正已落實：
  - `tests/qa-dbm-001-real-postgres.test.mjs` 已移除 keyword-only role-password assertion。
  - local log 逐一解析 role-password statement 的 password operand；所有可見 context 均可解析且精確為核准 marker `[REDACTED_TOKEN]`。
  - active runtime／migration password、完整 DSN、tracked fallback、舊 credential 可用性 gate 未因 D19 放寬。
- 全矩陣 regression：
  - DB role attributes、owner/grants/default privileges：PASS。
  - Runtime read + transaction rollback DML：PASS。
  - Runtime CREATE TABLE／CREATE TEMP TABLE／CREATE SCHEMA／ALTER TABLE／DROP TABLE／CREATE ROLE：全部 DENY，且 fixture 零殘留。
  - migrate idempotent、verify ready、checksum mismatch fail-safe／復原／TTL recovery、schema fixtures、artifact boundary、bootstrap idempotent：PASS。
  - `.env.local` 與 local log ignored；tracked files／local log active secret 與 full DSN scan：PASS。
  - Docker CLI 本機不存在；依 `PM_GOV_001-D18` 僅完成 Compose required-env／zero-secret 字面契約檢查，不宣稱實跑 `docker compose config`。

### Stop Decision

QA 未修改產品、OPS script、DB credential/grants、migration 或 local log。此票可標 `QA_PASSED`，並停下交 PM；不啟動後續 Pilot 票。
