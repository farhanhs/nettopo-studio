# QA_API_001 — Audit API Auth-first 與 Strict Limit 驗收紀錄

- 日期：2026-08-20
- 測試組：QA
- 對應開發票：`DEV_API_001`
- 對應設計票：`DSG_API_002`
- 結果：`QA_PASSED`

## 測試範圍

本次驗收限定於 `GET /api/audit-logs` 的 auth-first precedence、strict `limit` contract、typed safe error、no-store/security headers、repository zero-call 與 protected API auth-first regression。未修改產品程式、RBAC、Pilot Session、DB schema、migration、package 或 env。

## Requirement Traceability

| 欄位 | 內容 |
|---|---|
| User Intent | 確認 Audit protected API 不會在未驗證身分前解析不可信 query 或碰 repository／DB，且 `limit` 行為可測可預期 |
| Historical Sources | `REQUIREMENT-BASELINE.md`、`RULES.md`、`DECISION-LOG.md`、`ARCHITECTURE-MAP.md`、`DESIGN-DEVELOPMENT-MAP.md`、`TICKET-REGISTER.md`、`DSG_API_002.md`、`DEV_API_001.md`、`QA_API_001.md` |
| Approved Decisions | `PM_GOV_001-D03`、`D06`、`D11`、`D12`、`D13`；2026-08-20 strict `limit` contract approved |
| Change Type | `CORRECT` + `EXTEND` |
| Affected Layers | Audit API route、Request identity、Audit repository boundary、Security headers、Node handler tests |
| Preserved Invariants | Audit boss-only／`audit.read` 不變；Pilot／OIDC／Customer RBAC／DB schema／migration 不變；response/log 不洩漏 stack、SQL、DB URL、secret、token、cookie、checksum |
| Conflict Check | 本票只驗 handler 行為與相關 smoke，不以目前程式現況單獨定義語意；未發現需回設計或 PM 的衝突 |
| Regression Map | topology／credentials protected API auth-first smoke、schema 503 safe mapping、legacy/dev header 不可冒用、role forbidden、security headers |
| Rollback／No-path | 若發現需改 Audit RBAC、Pilot Session、DB schema 或 package 才能通過，應標 `BLOCKED` 並回設計／PM；本次未觸發 |

## 指令結果

| 指令 | 結果 |
|---|---|
| `node --test tests\audit-api-handler.test.mjs tests\api-auth-order.test.mjs` | PASS，14 tests／14 pass |
| `node node_modules\typescript\bin\tsc --noEmit --pretty false` | PASS |
| `node_modules\.bin\eslint.cmd app\api\audit-logs\route.ts tests\api-auth-order.test.mjs tests\audit-api-handler.test.mjs` | PASS |
| `node --test tests\*.test.mjs` | PASS，152 total／145 pass／7 skip／0 fail |
| `npm.cmd run build:local` | PASS，僅既有 chunk size／route classification warning |
| `npm.cmd run lint` | BLOCKED，Windows 環境找不到 `bash`；沿用 scoped ESLint 作本票 lint 證據 |
| `git diff --check` | PASS；僅 CRLF 提醒 |

## 驗收矩陣

| 驗收項 | 結果 | 證據 |
|---|---|---|
| 未登入 + malformed limit → 401，parse 0 call，repository 0 call | PASS | `unauthenticated requests fail before parsing query or calling repository` |
| 未登入 + valid limit → 401，repository 0 call | PASS | `unauthenticated valid limit still fails before repository access` |
| 已登入 + invalid limit → 400 `INVALID_LIMIT`，repository 0 call | PASS | `authenticated invalid limits return INVALID_LIMIT before repository access` |
| 已登入 + valid limit → repository exactly once，email／limit 正確 | PASS | `authenticated valid limits call repository exactly once with email and validated limit` |
| Strict limit cases | PASS | absent、1、100、200、encoded valid、0、-1、201、decimal、NaN、Infinity、abc、empty、multiple、encoded invalid 皆覆蓋 |
| Repository forbidden → 403 `AUDIT_FORBIDDEN` | PASS | `repository authorization failure maps to safe AUDIT_FORBIDDEN`；RBAC dictionary full test 仍維持 boss-only |
| Schema uninitialized/outdated/too_new/checksum_mismatch/unavailable → 503 safe body | PASS | `schema not ready maps...`、`schema unavailable, uninitialized...` |
| Unknown error → 500 `AUDIT_API_ERROR` | PASS | `database unavailable and unknown failures return safe errors` |
| no-store/security headers | PASS | handler tests 對 success/error response 驗證 `Cache-Control: no-store` 與安全 headers |
| leakage scan | PASS | response body tests 與 Audit build artifact slice 未發現 stack、SQL、DSN、secret、token、cookie、ciphertext、nonce、checksum manifest 對外輸出 |
| legacy/dev header 不可冒用 | PASS | full tests 中 request identity 與 protected endpoints smoke 通過 |
| topology／credentials/session protected API auth-first smoke | PASS | `tests\api-auth-order.test.mjs` 與 full tests 通過 |

## 風險與限制

- `npm.cmd run lint` 仍因 Windows 找不到 `bash` blocked；這是既有 npm script 環境問題，本票 scoped ESLint 已通過。
- Register 中 `DSG_API_001`、`DSG_OBS_001` 標為 DONE，但目前 active markdown 檔未出現在工作樹；本次以 `DSG_API_002`、`DEV_API_001`、`QA_API_001` 與治理基線完成驗收。建議 PM/文件組後續補齊或標明封存位置，避免追溯斷點。
- Release 仍不可放行：`QA_DBM_001`、`QA_PIL_002`、`QA_IMP_001` 仍在 Register 中阻擋 `PM_REL_001`。

## 結論

`QA_API_001` 通過。Audit API 已符合 auth-first precedence、strict limit、typed safe error、repository zero-call、no-store/security headers 與本票指定的 leakage scan。建議將 `DEV_API_001` 與 `QA_API_001` 標為 `QA_PASSED`，但不解除其他 P0 release blockers。
