# P0 Customer / Topology RBAC 收尾驗證 - 2026-08-13

更新日期：2026-08-14  
角色：測試組  
Workspace：`C:\Users\DUS\Desktop\project\nettopo-studio`  
Branch：`dustool`

## 結論

本輪驗證結果：**RBAC 收尾不通過，建議退回開發組修正；Migration Boundary 維持通過。**

主要原因不是架構方向錯誤，而是幾個上線閘門行為仍有缺口：

- 未登入請求仍可能先進入 JSON parser 或參數驗證，回 400，而不是先回 401。
- `duplicateCustomer()` 在 transaction 前讀取 source topologies，仍有 TOCTOU 風險。
- 不可見 site/customer scope 的 `createTopology()` 錯誤語意仍可能回 403，未完全符合防枚舉 404 契約。
- Sales 對可讀 topology 執行 credential write 時回 404，語意應為 403 Permission denied。

## 新增 / 使用的測試腳本

- `tests/api-auth-order.test.mjs`
- `tests/rbac-repository.integration.test.mjs`
- `tests/rbac-transaction-guards.test.mjs`
- `tests/rbac-multi-user-fixtures.test.mjs`

## 假資料設計

- Sites：`north-1`、`north-2`
- Users：Boss、north-1 manager、north-2 manager、north-1 engineer、Sales / Procurement、disabled Boss
- Customers：north-1 可見客戶、north-2 可見客戶
- Topologies：north-1 engineer-owned、north-2 manager-owned、engineer owner 但站點位於 north-2 的 cross-owned topology
- Credentials：以 Boss 寫入 masked credential；讀取驗證不可包含 plaintext、ciphertext、nonce、secret
- Duplicate Customer：驗證新 Customer / topology / audit action 與 credential 不複製

## 已通過項目

- Boss / Sales 全域讀取 projection 行為符合預期。
- 只有 Boss 可執行 Customer create / rename / delete / duplicate。
- Site Manager 只能讀寫 assigned site 的 topology。
- Engineer 必須同時符合 assigned site 與 owner / creator。
- disabled account 即使有 identity / session，也會 fail closed 為 `Authentication required.`
- Manager / Engineer 跨站 topology mutation 被拒絕。
- `duplicateCustomer()` 不複製 credentials，且新 topology owner / creator / updatedBy 會改為 actor。
- credential masked read 不回 raw username / secret / ciphertext / nonce。
- Manager / Engineer credential write 回 `Permission denied.`
- audit read 僅 Boss 可執行。
- createTopology / saveProject / credential upsert/delete / rename/delete Customer / rename/delete Topology 多數 mutation 會在 transaction 內重新檢查 active actor 與 resource。
- dev identity header 不能繞過 disabled DB account，動態 API 驗證回 401。
- schema 503 / Migration Boundary / TypeScript / scoped ESLint / build:local 維持通過。

## 發現問題

### 1. Auth-first 契約未完全落實

涉及檔案：

- `app/api/topology/route.ts`
- `app/api/credentials/route.ts`

重現結果：

- 未登入 POST `/api/topology` 且 body 為 malformed JSON，實際回 400；預期先回 401 `Authentication required.`
- 未登入 POST `/api/credentials` 且 body 為 malformed JSON，實際回 400；預期先回 401。
- 未登入 GET `/api/credentials` 且缺少 `topologyId`，實際回 400；預期先回 401。

風險：未授權請求可以透過 parser / validation 順序探測 API 行為，與開發交接的「未登入/session 無效一律 401」不一致。

### 2. `duplicateCustomer()` transaction 前讀取 source topologies

涉及檔案：

- `db/topology-postgres.ts`

測試觀察：

- `sourceTopologies` 在 `sql.begin()` 外讀取。
- transaction 內只重新檢查 / lock customer，未在同一 transaction 內重新讀取 source topology scope。

預期：duplicate 流程應在 transaction 內重新取得並驗證 source topologies，避免複製期間的 topology / project / site scope 變更造成 stale snapshot。

### 3. `createTopology()` 不可見 site/customer scope 回 403

重現結果：

- north-1 Manager 使用已知 customerId 指定 north-2 site 建立 topology。
- 實際：`Permission denied: cannot create topology for this site.`
- 預期：`Resource not found` / 404，避免洩漏 site 或 customer 是否存在。

### 4. Sales credential write 錯誤語意為 404

重現結果：

- Sales 可讀某 topology projection，但對該 topology 執行 credential upsert。
- 實際：`Resource not found.`
- 預期：`Permission denied` / 403。

原因推測：credential write 先走 topology writable scope，Sales 因不可寫而被視為 resource not found；但這是明確角色禁止的 credential write，應映射為 403。

## 指令輸出摘要

- `node --test tests/*.test.mjs`：111 total，100 pass，4 fail，7 skip。
- Full suite 失敗來源：3 個 auth-order 測試、1 個 duplicateCustomer transaction snapshot guard。
- PostgreSQL integration：7 total，5 pass，2 fail。
- Integration 失敗來源：unassigned-site 404 契約、Sales credential-write 403 契約。
- `node node_modules\typescript\bin\tsc --noEmit --pretty false`：PASS。
- scoped ESLint：PASS。
- `npm.cmd run build:local`：PASS，僅既有 chunk size warning。
- `git diff --check`：無 whitespace error，僅 CRLF 提醒。

## 規格待 PM / 開發組確認

PM 先前決議曾保留 `createCustomer` 例外：Site Manager / Engineer 可在明確且已授權 site 建立新 Customer + 第一張 topology。  
開發組本輪交接與目前實作則將所有 Customer mutation 收斂為 Boss-only。

測試組建議由 PM 明確確認第一階段到底採：

- A：所有 Customer mutation Boss-only。
- B：保留 createCustomer 原子流程例外，但必須補完整授權與防枚舉測試。

在 PM 補決議前，本輪不把此點列為產品 bug，但列為規格風險。

## 建議

- Migration Boundary：可維持通過。
- RBAC：不建議進入下一階段，需由開發組修正上述四類問題後再重驗。
- 測試組新增的失敗測試應保留，作為 P0 回歸護欄。
