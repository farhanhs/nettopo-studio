# QA_API_001 — Audit API Auth-first 與 Strict Limit 驗收

| 欄位 | 值 |
|---|---|
| Group | QA |
| Feature | API |
| Priority | P0 |
| Status | QA_PASSED |
| Planned Order | 011 |
| Checkpoint | Internal Pilot |
| Dependencies | DEV_API_001 READY_FOR_QA |
| Related Tickets | DSG_API_002, DEV_API_001 |
| Created／Updated | 2026-08-20 |

## Objective

獨立驗證 `GET /api/audit-logs` 已落實 auth-first request precedence、strict `limit` contract、typed safe error、no-store/security headers 與 repository zero-call 邊界。

## Requirement Traceability

| 欄位 | 內容 |
|---|---|
| User Intent | 確認 Audit protected API 不會在未驗證身分前解析不可信 query 或碰 repository／DB，並讓 limit 行為可測可預期 |
| Historical Sources | `REQUIREMENT-BASELINE.md`、`RULES.md`、`DECISION-LOG.md`、`DSG_API_002.md`、`DEV_API_001.md` |
| Approved Decisions | `PM_GOV_001-D03`、`D06`、`D11`、`D12`、`D13`；2026-08-20 strict `limit` contract approved |
| Change Type | `CORRECT` + `EXTEND` |
| Affected Layers | Audit API route、Request identity、Audit repository boundary、Security headers、Node handler test |
| Preserved Invariants | Audit boss-only／`audit.read` 不變；不改 Pilot／OIDC／Customer RBAC／DB schema／migration／package/env；response/log 不洩漏 stack、SQL、DB URL、secret、token、cookie、checksum |
| Conflict Check | QA 應測 handler 行為，不只讀 source string；不得要求本票修改 RBAC 或資料庫結構 |
| Regression Map | topology／credentials／session auth-first smoke、schema 503 safe mapping、legacy/dev header 不可冒用、role forbidden |
| Rollback／No-path | 若發現需改 Audit RBAC、Pilot Session、DB schema 或 package 才能通過，標示 blocked 並回設計／PM |

## In Scope

- `GET /api/audit-logs?limit=...` handler behavior。
- Strict `limit` cases：absent、1、100、200、0、負數、201、小數、NaN、Infinity、abc、空字串、多值、encoded valid、encoded invalid。
- Auth precedence：未登入時 malformed limit 仍回 401，且 parse/repository 皆 0 call。
- Repository boundary：authenticated valid request exactly one call；invalid limit 0 call。
- Safe error：401、400、403、503、500 typed body。
- no-store/security headers 與 leakage scan。

## Out of Scope

- 修改 Audit boss-only／`audit.read` 權限。
- Pilot Session、OIDC、Customer／Topology RBAC。
- DB schema、migration、package、env。
- 大規模 protected API error framework 重構。

## Acceptance Criteria

- [x] 未登入 + malformed limit → 401 `AUTHENTICATION_REQUIRED`，parse 0 call，repository 0 call。
- [x] 未登入 + valid limit → 401，repository 0 call。
- [x] 已登入 + invalid limit → 400 `INVALID_LIMIT`，repository 0 call。
- [x] 已登入 + valid limit → repository exactly once，email／limit 正確。
- [x] Repository forbidden → 403 `AUDIT_FORBIDDEN` safe body。
- [x] Schema uninitialized／outdated／too-new／checksum mismatch／unavailable → 503 safe body。
- [x] Unknown error → 500 `AUDIT_API_ERROR` safe body。
- [x] Boss success；site_manager／engineer／sales_procurement forbidden via repository or integration evidence。
- [x] Legacy `x-nettopo-user-email` 不可 auth；pilot/production 下 dev header 不可 auth。
- [x] 所有 success/error response 都包含 `Cache-Control: no-store` 與 security headers。
- [x] Response body/log 不含 stack、DB URL、SQL、password、secret、ciphertext、nonce、cookie、token、raw header、checksum manifest。
- [x] topology／credentials／session protected API auth-first smoke 不退步。

## QA Result

- 結果：`QA_PASSED`。
- 測試紀錄：`docs/dev測試紀錄/qa-api-001-audit-api-2026-08-20.md`。
- Targeted handler tests：`node --test tests\audit-api-handler.test.mjs tests\api-auth-order.test.mjs` 通過，14/14。
- Full Node tests：`node --test tests\*.test.mjs` 通過，152 total／145 pass／7 skip／0 fail；skip 為既有 DB/RBAC integration 後續票範圍。
- TypeScript：`node node_modules\typescript\bin\tsc --noEmit --pretty false` 通過。
- Scoped ESLint：`node_modules\.bin\eslint.cmd app\api\audit-logs\route.ts tests\api-auth-order.test.mjs tests\audit-api-handler.test.mjs` 通過。
- Build：`npm.cmd run build:local` 通過，僅既有 chunk size／route classification warning。
- Full lint：`npm.cmd run lint` 仍 blocked，Windows 環境找不到 `bash`；本票以 scoped ESLint 作驗收證據。
- Leakage scan：Audit API response body tests 與 build artifact slice 未發現 stack、SQL、DSN、secret、token、cookie、ciphertext、nonce 或 checksum manifest 對外輸出。

## Suggested Validation Commands

```powershell
node --test tests\audit-api-handler.test.mjs tests\api-auth-order.test.mjs
node --test tests\*.test.mjs
npm.cmd run lint
npm.cmd run build:local
```

## Handoff

- 2026-08-20：開發組已將 DEV_API_001 標為 `READY_FOR_QA`。
- 開發組自測：
  - `node --test tests\audit-api-handler.test.mjs tests\api-auth-order.test.mjs` pass，14/14。
  - `node node_modules\typescript\bin\tsc --noEmit --pretty false` pass。
  - `node --test tests\*.test.mjs` pass，152 total／145 pass／7 skip／0 fail。
  - `node_modules\.bin\eslint.cmd app\api\audit-logs\route.ts tests\api-auth-order.test.mjs tests\audit-api-handler.test.mjs` pass。
  - `npm.cmd run build:local` pass。
  - `npm.cmd run lint` blocked：Windows 環境找不到 `bash`；請 QA 以可用 bash 環境補跑 full lint，或沿用 scoped ESLint 作本票證據。
- 請測試組回傳 QA_API_001 的自動化結果、角色矩陣證據、leakage scan 與任何 release gate blocker。
- 2026-08-20：測試組獨立重驗通過，QA_API_001 標為 `QA_PASSED`；DEV_API_001 可標為 `QA_PASSED`，但 release 仍受 QA_DBM_001／QA_PIL_002／QA_IMP_001 阻擋。
