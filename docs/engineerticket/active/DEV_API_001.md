# DEV_API_001 — Audit API Auth-first 修正

| 欄位 | 值 |
|---|---|
| Group | DEV |
| Feature | API |
| Priority | P0 |
| Status | QA_PASSED |
| Planned Order | 010 |
| Checkpoint | Internal Pilot |
| Created／Updated | 2026-08-20 |

## Objective

確保 Audit Logs API 在解析 `limit` 或任何 query／resource 參數前，先完成 request identity 與 session 驗證。

使用者於 2026-08-20 核准 `DEV_API_001` 開工，並核准 Audit API `limit` 採 strict contract。

## Requirement Traceability

| 欄位 | 內容 |
|---|---|
| User Intent | 修正 Audit API 在 protected endpoint 上的 auth-first 行為，並將 `limit` 查詢參數收斂為可測、可預期的嚴格契約 |
| Historical Sources | `REQUIREMENT-BASELINE.md`、`RULES.md`、`DECISION-LOG.md`、`ARCHITECTURE-MAP.md`、`DESIGN-DEVELOPMENT-MAP.md`、`TICKET-REGISTER.md`、`DSG_API_002.md` |
| Approved Decisions | `PM_GOV_001-D03`、`D06`、`D11`、`D12`、`D13`、`D14` |
| Change Type | `CORRECT` + `EXTEND`：修正 auth-first 測試缺口，擴充 strict limit 與 typed safe error |
| Affected Layers | API route、Identity boundary、Audit repository call boundary、Security headers、Node handler tests |
| Preserved Invariants | Audit read 維持 repository Boss／`audit.read` 授權；不改 Pilot Session／OIDC／Customer RBAC／DB schema／migration／package/env；所有回應 no-store 且不洩漏 secret／stack／SQL／DB URL |
| Conflict Check | 本票只處理 `GET /api/audit-logs`；不重構所有 protected API；不把 source-order test 當作唯一驗收 |
| Regression Map | 未登入 precedence、invalid limit、repository zero-call、Boss success、non-Boss forbidden、schema 503、未知錯誤 500、安全 headers、topology／credentials auth-first smoke |
| Rollback／No-path | 可回退 `app/api/audit-logs/route.ts` 與新增 handler tests；若需改 Audit RBAC、Pilot、DB schema 或 package 才能通過，停止回設計／PM |

## Evidence of Current Failure

- `node --test tests/*.test.mjs`：128 total，120 pass，1 fail，7 skip。
- Fail：`audit logs GET authenticates before query parsing`。
- 目前 `searchParams.get("limit")` 的執行順序早於 `requireRequestIdentity(request)`。

## In Scope

- `app/api/audit-logs/route.ts`
- `tests/api-auth-order.test.mjs`
- `tests/audit-api-handler.test.mjs`
- Strict `limit` validation：缺失預設 100；存在時只允許整數 1–200；多值、空值、小數、非數字、0、負數、201 以上皆回 400 `INVALID_LIMIT`。
- Route-local typed safe error mapper。
- 最小 handler dependency injection seam，證明未登入與 invalid limit 時 repository 為零呼叫。

## Out of Scope

- 新增角色、改變 Audit read 權限。
- Pilot 登入方式、Customer RBAC、DB schema。

## Acceptance Criteria

- [x] 未登入且 query malformed／缺失時仍先回安全 401。
- [x] 未登入時不解析 query、不呼叫 repository。
- [x] 已登入後才解析 limit 與執行 repository 查詢。
- [x] Strict `limit` contract 已覆蓋 absent、1、100、200、encoded valid、0、負數、201、小數、NaN、Infinity、abc、空字串、多值、encoded invalid。
- [x] Repository forbidden 轉為 403 `AUDIT_FORBIDDEN`，不回傳原始錯誤訊息。
- [x] Schema not ready 轉為安全 503 response。
- [x] Unknown error 轉為 500 `AUDIT_API_ERROR`。
- [x] no-store 與安全 headers 保持。
- [x] 全套自動化測試 0 fail；現有 skip 另由 QA_DBM_001／Pilot ticket 處理。
- [x] TypeScript、lint 與 build:local 通過。

## Implementation Summary

- `app/api/audit-logs/route.ts` 新增 `parseAuditLimit()`、`mapAuditApiError()`、`createAuditLogsGetHandler()`，固定 pipeline 為 authentication → limit validation → repository call。
- `readAuditLogs()` 的 Boss／`audit.read` 授權維持在 repository，不更動 RBAC。
- 所有 success/error response 均使用 `noStoreHeaders()`。
- Error body 改為 typed safe contract，不再以 repository 原始 message 作公開回應。
- `tests/audit-api-handler.test.mjs` 新增可執行 handler 行為測試；`tests/api-auth-order.test.mjs` 保留為 smoke regression。

## Verification Evidence

- 2026-08-20：`node --test tests\audit-api-handler.test.mjs tests\api-auth-order.test.mjs` pass，14/14。
- 2026-08-20：`node node_modules\typescript\bin\tsc --noEmit --pretty false` pass。
- 2026-08-20：`node --test tests\*.test.mjs` pass，152 total／145 pass／7 skip／0 fail。
- 2026-08-20：`node_modules\.bin\eslint.cmd app\api\audit-logs\route.ts tests\api-auth-order.test.mjs tests\audit-api-handler.test.mjs` pass。
- 2026-08-20：`npm.cmd run build:local` pass，僅既有 chunk size／route classification warning。
- 2026-08-20：`npm.cmd run lint` blocked：Windows 環境找不到 `bash`，為既有 npm script 環境問題；DEV_API_001 scoped ESLint 已通過。
- 2026-08-20：QA_API_001 獨立重驗通過；`node --test tests\audit-api-handler.test.mjs tests\api-auth-order.test.mjs` 14/14 pass、`node --test tests\*.test.mjs` 152 total／145 pass／7 skip／0 fail、TypeScript／scoped ESLint／build:local pass。

## Handoff

- 2026-08-20：DEV_API_001 進入 `READY_FOR_QA`。
- 請 QA_API_001 依 strict `limit`、auth-first precedence、safe error/no-store/security headers 與 leakage scan 做獨立驗收。
- 2026-08-20：QA_API_001 驗收通過，DEV_API_001 標為 `QA_PASSED`。
