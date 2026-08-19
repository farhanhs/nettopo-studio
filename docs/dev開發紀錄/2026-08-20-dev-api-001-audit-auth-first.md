# DEV_API_001 — Audit API Auth-first Strict Limit 開發紀錄

- 日期：2026-08-20
- 開發組：DEV
- 對應設計票：`DSG_API_002`
- 對應測試票：`QA_API_001`
- 最終狀態：`QA_PASSED`

## 開發目標

修正 `GET /api/audit-logs` 的 request precedence，確保 Audit API 在解析 `limit` 或呼叫 repository 前，必須先完成 request identity authentication。同時依 2026-08-20 使用者核准內容，將 `limit` 改為 strict contract。

## Requirement Traceability

| 欄位 | 內容 |
|---|---|
| User Intent | 修正 Audit protected API 的 auth-first 邊界，並讓 `limit` 查詢參數具備可預期、可測試的嚴格契約 |
| Historical Sources | `REQUIREMENT-BASELINE.md`、`RULES.md`、`DECISION-LOG.md`、`ARCHITECTURE-MAP.md`、`DESIGN-DEVELOPMENT-MAP.md`、`TICKET-REGISTER.md`、`DSG_API_002.md`、`DEV_API_001.md` |
| Approved Decisions | `PM_GOV_001-D03`、`D06`、`D11`、`D12`、`D13`；2026-08-20 使用者核准 strict `limit` contract |
| Change Type | `CORRECT` + `EXTEND` |
| Affected Layers | Audit API route、Request identity boundary、Audit repository call boundary、Security headers、Node handler tests |
| Preserved Invariants | Audit read 維持 repository Boss／`audit.read` 授權；未修改 Pilot Session／OIDC／Customer RBAC／DB schema／migration／package/env；所有 response 維持 no-store 且不洩漏 stack、SQL、DB URL、secret、token、cookie 或 checksum manifest |
| Conflict Check | 本次只處理 Audit API，不擴大重構所有 protected API；source-order test 保留為 smoke，主要驗收改為可執行 handler test |
| Regression Map | 未登入 precedence、invalid limit、repository zero-call、Boss success、non-Boss forbidden、schema 503、unknown 500、安全 headers、topology／credentials auth-first smoke |
| Rollback／No-path | 若需修改 Audit RBAC、Pilot、DB schema、migration、package/env 才能通過，應停止並回設計／PM；本次未觸發 |

## 實作內容

- `app/api/audit-logs/route.ts`
  - 新增 `parseAuditLimit(url)`。
  - 新增 `mapAuditApiError(error)`。
  - 新增 `createAuditLogsGetHandler(deps)`。
  - 固定流程為 authentication → strict limit validation → `readAuditLogs(identity.email, limit)`。
  - 所有 success/error response 都套用 `noStoreHeaders()`。
  - 不再將 repository 原始錯誤 message 作為公開回應。

- `tests/audit-api-handler.test.mjs`
  - 新增真正執行 handler 的行為測試。
  - 驗證未登入時 malformed limit 仍回 401，且 parse/repository 都是 0 call。
  - 驗證已登入 invalid limit 回 400，repository 0 call。
  - 驗證已登入 valid limit 只呼叫 repository 一次，並傳入正確 email／limit。
  - 覆蓋 repository forbidden、schema not ready、DB unavailable、unknown error、安全 headers 與 leakage scan。

- `tests/api-auth-order.test.mjs`
  - 保留 topology／credentials protected API auth-first smoke。
  - Audit smoke 改為檢查 handler factory 內 authenticate 位於 parse 前。

- 工單文件
  - `DEV_API_001` 更新為 `QA_PASSED`。
  - `DSG_API_002` 更新為 `DONE`，strict limit 決策已 resolved。
  - 新增 `QA_API_001`，並由測試組更新為 `QA_PASSED`。
  - `TICKET-REGISTER.md` 已同步 DEV／QA 狀態與目前 release blocker。

## Strict Limit Contract

- 缺失 `limit`：預設 100。
- 合法：整數 `1` 到 `200`。
- 合法 encoded value：例如 `%31%30` 解析為 10。
- 不合法：`0`、負數、`201`、小數、非數字、`NaN`、`Infinity`、空字串、多個 `limit`、encoded invalid value。
- 不合法時回 400 `{ error: "INVALID_LIMIT", message: "limit must be an integer between 1 and 200." }`。

## Safe Error Contract

| 情境 | HTTP | Safe code |
|---|---:|---|
| 未登入／Session 無效 | 401 | `AUTHENTICATION_REQUIRED` |
| 已登入但無 audit read 權限 | 403 | `AUDIT_FORBIDDEN` |
| `limit` 不合法 | 400 | `INVALID_LIMIT` |
| Schema 未就緒 | 503 | `DATABASE_SCHEMA_*`／`DATABASE_UNAVAILABLE` |
| 未知內部錯誤 | 500 | `AUDIT_API_ERROR` |

## 開發驗證

| 指令 | 結果 |
|---|---|
| `node --test tests\audit-api-handler.test.mjs tests\api-auth-order.test.mjs` | PASS，14/14 |
| `node node_modules\typescript\bin\tsc --noEmit --pretty false` | PASS |
| `node --test tests\*.test.mjs` | PASS，152 total／145 pass／7 skip／0 fail |
| `node_modules\.bin\eslint.cmd app\api\audit-logs\route.ts tests\api-auth-order.test.mjs tests\audit-api-handler.test.mjs` | PASS |
| `npm.cmd run build:local` | PASS，僅既有 chunk size／route classification warning |
| `npm.cmd run lint` | BLOCKED，Windows 環境找不到 `bash`；本票以 scoped ESLint 作 lint 證據 |
| `git diff --check` | PASS，僅 CRLF 提醒 |

## QA 回傳

測試組已完成 `QA_API_001` 獨立驗收，結果 `PASS／QA_PASSED`。

測試組確認：
- 未登入 + malformed limit 回 401，parse 0 call，repository 0 call。
- 已登入 + invalid limit 回 400，repository 0 call。
- 已登入 + valid limit repository exactly once，email／limit 正確。
- Strict limit cases 全覆蓋。
- Repository forbidden 回 403 safe body，Audit boss-only／RBAC 不變。
- Schema uninitialized／outdated／too_new／checksum_mismatch／unavailable 回 503 safe body。
- Unknown error 回 500 safe body。
- 所有 success/error response 均含 `Cache-Control: no-store` 與 security headers。
- response body 與 Audit build artifact slice 未發現 stack、SQL、DSN、secret、token、cookie、ciphertext、nonce、checksum manifest 對外輸出。
- legacy `x-nettopo-user-email` 不可 auth；pilot/production dev header 不可 auth；topology／credentials protected API auth-first smoke 未退步。

## 目前剩餘進度

`DEV_API_001` 與 `QA_API_001` 已完成，不再是 release blocker。

Release 仍受以下票阻擋：
- `QA_DBM_001`：真實 PostgreSQL integration。
- `QA_PIL_002`：完整 Pilot browser E2E。
- `QA_IMP_001`：Import／Export Browser E2E 與 secret scan。

另有文件追溯風險：`TICKET-REGISTER.md` 中 `DSG_API_001`／`DSG_OBS_001` 標為 `DONE`，但 active markdown 檔目前未在工作樹出現；建議 PM／文件組後續補齊或標明封存位置。
