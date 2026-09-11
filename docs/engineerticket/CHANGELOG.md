# Engineer Ticket Changelog

## 2026-08-17

- 建立 `docs/engineerticket/` 工單治理目錄。
- 定義 `組別_特徵碼_執行序` 編號規則。
- 建立組別碼、特徵碼、狀態、優先級、交接與 Definition of Done。
- 將現有架構分解為 Ticket Map。
- 建立 P0/P1 執行佇列、延後清單與 Decision Log。
- 建立目前活躍阻擋工單。
- 補齊前期設計單號：UI、Domain、Import、Export、Security、Auth、DB Migration、API、Observability、Release、Deployment。
- 建立 `DESIGN-DEVELOPMENT-MAP.md`，將每張設計票對應到開發／OPS／QA 工單。

本次只建立治理與規劃文件，沒有批准任何 `WAITING_APPROVAL` 決策，也沒有授權產品開發。

## 2026-08-18

- 新增 `DSG_UIX_002`：直角避障路由、最近邊連接點與 overlap-only offset 設計。
- 預留 `DEV_UIX_002` 實作票與 `QA_UIX_001` 驗收票，兩者維持 `BLOCKED`。
- 將使用者明確需求登錄為 `PM_GOV_001-D09`、`PM_GOV_001-D10`。
- 設計組完成 `DSG_UIX_002` 重檢並改為 `WAITING_APPROVAL`；推薦分階段 Hybrid，尚待裁定 wireless 是否為直角規則例外。

## 2026-08-19

- 使用者明確核准 `PM_GOV_001` 與 `PM_GOV_002`；兩票改為 `READY`，治理規則立即生效，待乾淨 checkpoint 後再標 `DONE`。
- 建立 `REQUIREMENT-BASELINE.md`，整理權威順序、已批准底層原則、歷史開發／測試來源與跨層 invariant。
- 新增 Requirement Traceability Gate、Definition of Ready、`EXTEND／CORRECT／SUPERSEDE` 分類與兩次返工 root-cause review 規則。
- 更新 Ticket Template，強制填寫 User Intent、Historical Sources、Affected Layers、Conflict Check 與 Regression Map。
- 回填先前已明確確認的 Pilot Engineer synthetic Customer、Temporary Pilot Session 與 Pilot full export gate 決策。
- 校正 UI Routing 工單的非標準狀態與 Planned Order，使 Register、設計圖與 Active Tickets 一致。
- 使用者推進確認 `DSG_ARC_001`；架構地圖改為 `READY／已核准`，新增 `PM_GOV_001-D13`。
- 修正架構依賴圖的 GOV／ARC 方向，並把 `DEV_API_001`、`DEV_UIX_002` 補入 checkpoint 分解。
- 記錄舊內網計畫中 identity header、local mode「零資安疑慮」與 runtime migration 等描述已被後續決策取代。
- 新增 `DSG_API_002`，要求設計組細化 Audit API request precedence、limit、安全錯誤與可執行 Handler 驗證；`DEV_API_001` 維持 `WAITING_APPROVAL`。

## 2026-08-20

- 設計組完成 `DSG_API_002`，狀態改為 `WAITING_APPROVAL`；推薦 Strict limit、route-local typed safe error 與可證明 repository zero-call 的 Handler test seam。
- `DEV_API_001`、`QA_API_001` 維持未啟動；等待使用者裁定 Strict `limit` 契約。
- PM 核准 `PM_GOV_001-D14` Strict limit；開發組完成 `DEV_API_001`，測試組完成 `QA_API_001`，兩票均為 `QA_PASSED`。
- Audit API targeted 14/14、全套 Node 152 total／145 pass／7 skip／0 fail、TypeScript、scoped ESLint、`build:local` 通過；full lint 仍受 Windows 缺少 bash 阻擋。
- 核准 `PM_GOV_001-D15`，將 `OPS_DBM_001` 改為 `READY`；限定先做非破壞性 local PostgreSQL 診斷與啟動修復，禁止 reset／reinit／刪除既有 cluster。
- 維運組完成 `OPS_DBM_001`：修正 Windows ready 判斷與 `pg_ctl` restricted-token fallback；既有 cluster、migration 0001–0004 與資料均保留，狀態改為 `READY_FOR_QA`。
- 核准 `PM_GOV_001-D16` 並啟動 `OPS_DBM_002`：Pilot 沿用 `nettopo` 為 Migration owner，只新增最低權限 `nettopo_runtime`；禁止 ownership 搬移、資料重建與 secret 入版控。
- 維運組完成 `OPS_DBM_002` 並改為 `READY_FOR_QA`：Runtime DML、DDL deny、兩次 bootstrap、migration 及 schema verify 通過。
- PM 補查 PostgreSQL database-level `TEMPORARY` 邊界，確認 Runtime 原可建立 temp table；已在 local Pilot database 撤除 `PUBLIC` TEMPORARY，Runtime `CREATE TEMP TABLE`／`CREATE SCHEMA` 均拒絕，Migration owner 權限不受影響。
- `QA_DBM_001` 依賴解除並改為 `READY`，要求測試組獨立重驗權限矩陣、checksum／schema 狀態、TTL recovery、artifact boundary 與 secret leakage。
- 測試組完成 `QA_DBM_001`，DB role/grant、Runtime DML/DDL denial、migration/checksum/schema/TTL 與 artifact boundary 通過，但 active Migration password 同時存在於四個 tracked 設定／說明檔，結果為 `QA_FAILED`。
- 新增並核准 `PM_GOV_001-D17`／`OPS_SEC_001`：只輪替 local Migration credential、移除 tracked 有效預設值並補安全初始化／rollback；修復後回到 `QA_DBM_001` 重驗。
- 維運組完成 `OPS_SEC_001` 並改為 `READY_FOR_QA`：舊 Migration credential 已失效，新 credential 只存 ignored `.env.local`；tracked defaults、local start/restart、bootstrap、migrate/verify 與 leakage 預檢通過。
- 核准 `PM_GOV_001-D18`：目前 native Windows Pilot 不因缺少 Docker CLI 阻擋；Compose 僅可記為靜態 fail-closed 已驗，實際 parse 留到採用 Docker 路線前的 `OPS_PIL_001`。
- `QA_DBM_001` 第二次 re-test：active secret、完整 DSN、tracked fallback、舊 credential 與 DBM 全矩陣均通過，但 keyword-only role-password log assertion 仍使票面失敗。
- 依兩次返回規則建立 `PM_GOV_003` root-cause review：安全分類確認 3 個 role-password operand 全為精確 `[REDACTED_TOKEN]`，沒有 active secret／完整 DSN；核准 `PM_GOV_001-D19`，將 log gate 校正為 value-based redaction，不刪除或改寫歷史 log 來配合測試。
- `QA_DBM_001` 第三次完整重驗通過，狀態改為 `QA_PASSED`；Migration／Runtime role、credential rotation、DDL denial、checksum/TTL、artifact 與 value-based secret gate 均有真實 PostgreSQL 證據。
- PM review `DSG_PIL_001` 與候選 Pilot 實作，核准 `D20` 身分/DB role/site 三重交集及 `D21` Temporary Pilot Session 的內網風險邊界；設計票改 `DONE`，`DEV_PIL_001` 升為 P0 `READY`。
