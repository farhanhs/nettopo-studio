# DSG_API_002 — Audit API Auth-first 與驗證契約詳細設計

| 欄位 | 值 |
|---|---|
| Group | DSG |
| Feature | API |
| Priority | P0 |
| Status | DONE |
| Planned Order | 004 |
| Checkpoint | Internal Pilot |
| Dependencies | PM_GOV_001 READY, PM_GOV_002 READY, DSG_ARC_001 READY, DSG_API_001 DONE |
| Related Tickets | DEV_API_001, QA_API_001 |
| Owner | 設計組 |
| Created／Updated | 2026-08-20 |

## Objective

將 Audit Logs protected API 的 auth-first request pipeline、`limit` 輸入契約、安全錯誤、repository 邊界與可執行驗證方式設計完整，使 `DEV_API_001` 能以一次小範圍修正通過 `QA_API_001`，不再靠原始碼字串順序測試推定安全行為。

## Requirement Traceability

| 欄位 | 內容 |
|---|---|
| User Intent | 把 DEV_API_001 的功能與驗證規劃到可直接交接，避免只補一行順序後留下錯誤契約與測試漏洞 |
| Historical Sources | `DSG_API_001`、`DEV_API_001.md`、`ARCHITECTURE-MAP.md`、`api-auth-order.test.mjs`、Migration Boundary／RBAC 驗收紀錄 |
| Approved Decisions | `PM_GOV_001-D03`、`D06`、`D11`、`D12`、`D13` |
| Change Type | `EXTEND`：細化既有 auth-first hard boundary，不改 Audit read RBAC |
| Affected Layers | API、Identity/Session、Repository、Security Headers、QA；不影響 UI、Domain、DB schema、Migration |
| Preserved Invariants | Pilot/production 不接受 dev identity header；Audit boss-only；runtime 不 migrate；no-store；安全錯誤不洩漏內部資訊 |
| Conflict Check | 目前未提交候選程式已調整順序，但它只能作現況證據；現有測試只掃 source order，不能證明 handler 行為與 repository 未被呼叫 |
| Regression Map | topology／credentials／session protected APIs、RBAC role matrix、schema 503、security headers、build/test |
| Rollback／No-path | 若無法在不改 RBAC/schema 下建立可測 seam，設計需提出最小 helper，不得擴大重構所有 API |

## Current Evidence

- `app/api/audit-logs/route.ts` 工作樹已有候選順序：`requireRequestIdentity()` 位於 `searchParams.get("limit")` 前。
- `tests/api-auth-order.test.mjs` 目前 4/4 通過，但只比較 source string index。
- `readAuditLogs()` 已在 repository 層限制 boss／`audit.read`，並將數量 defense-in-depth clamp 到 `1–200`。
- 目前 route 仍以 error message substring 判定 HTTP status，且直接回傳 message；需設計安全且不過度擴張的錯誤契約。

## Required Design Scope

### A. Request Pipeline

設計明確且不可重排的執行順序：

```text
Request
→ Runtime policy / session / identity authentication
→ query extraction and validation
→ repository authorization
→ schema-ready business query
→ safe response mapping
```

必須定義：

- 未登入時 query malformed、DB 未設定或 schema outdated，哪一個錯誤優先。
- 哪些步驟不得在 authentication 前執行。
- Authentication、authorization、validation 與 availability 的 HTTP status/error code。

### B. Limit Contract

比較並推薦以下策略，不得自行視為使用者已批准：

1. Strict：缺失預設 100；只有整數 `1–200` 合法，其餘 `400 INVALID_LIMIT`。
2. Tolerant：缺失／非數字預設 100；數字由 repository clamp `1–200`。

輸出必須包含：

- 空字串、小數、負數、0、超過 200、NaN、多個 limit、encoded value 的處理。
- Route validation 與 repository defense-in-depth 的責任切分。
- 對 Internal Pilot 操作與測試穩定性的取捨。

### C. Safe Error Contract

至少設計：

| 情境 | 預期狀態 |
|---|---:|
| 未登入／Session 無效 | 401 |
| 已登入但無 `audit.read` | 403 |
| `limit` 不合法 | 400，若採 Strict |
| DB schema 未就緒 | 503 |
| 未知內部錯誤 | 500 |

需比較：

- Route-local typed mapper。
- 共用 protected API error helper。
- 維持 message substring mapping 的風險。

回應不得包含 stack、DB URL、SQL、credential、cookie、token、checksum 或原始 identity header。

### D. Testability Contract

設計能真正執行 Handler 的測試 seam，至少能證明：

- 未登入時 query/repository 不被執行。
- 驗證失敗時 `readAuditLogs()` 呼叫次數為 0。
- 已授權請求只呼叫 repository 一次，並傳入經驗證的 email／limit。
- 所有 success/error response 都有 `no-store` 與安全 headers。

需比較：

- 抽出純函式 `parseAuditLimit()`／`mapAuditApiError()`。
- 對 Handler 使用 dependency injection factory。
- 直接以 Worker/route integration 測試，不引入過重 mock framework。

### E. Verification Matrix

至少覆蓋：

- 無 Session＋正常／惡意 limit。
- Pilot／production 使用 legacy/dev identity header。
- Boss、site manager、engineer、sales_procurement。
- 缺失、邊界、非法 limit。
- Schema ready／outdated／too-new／checksum mismatch。
- no-store、安全 headers、no secret／stack leakage。
- topology／credentials／session auth-first 回歸。
- TypeScript、lint、`build:local`、全套 Node tests。

## In Scope

- `app/api/audit-logs/route.ts` 的建議結構與 API contract。
- 最小必要的 server helper API 設計。
- `tests/api-auth-order.test.mjs` 的替代／保留策略。
- `DEV_API_001` 實作清單與 `QA_API_001` 驗收清單。

## Out of Scope

- 修改產品程式、測試、package、migration、env。
- 改變 Audit boss-only／`audit.read` 權限。
- 建立新 DB table／migration。
- 修改 Pilot Session、OIDC、Customer／Topology RBAC。
- 將所有 API 一次性大規模重構。

## Required Outputs

1. Request pipeline 與 precedence contract。
2. `limit` 策略比較、推薦與最少待使用者決策。
3. Typed error data contract 與 mapping pseudo-code。
4. Handler／helper／repository 責任拆分。
5. 可證明 repository zero-call 的測試架構。
6. DEV_API_001 allowed files、修改步驟與停止條件。
7. QA_API_001 行為矩陣、證據格式與 release gate。
8. 既有未提交候選修改的保留／重做判斷。

## Design Result

設計組於 2026-08-20 完成詳細規劃，推薦以窄範圍方式完成 `DEV_API_001`：

1. 固定 pipeline：authentication → query validation → repository authorization／schema guard／business query → safe response。
2. 保留目前候選程式的 auth-first、`noStoreHeaders()` 與 `safePostgresSchemaError()` 方向。
3. `limit` 推薦採 Strict：缺失預設 100；存在時只能是整數 `1–200`；空字串、小數、0、負數、超過 200、非數字或多個 limit 回 `400 INVALID_LIMIT`。
4. 使用 route-local typed safe error mapper，取代 message substring mapping 與直接回傳 repository error message。
5. 建立最小 `createAuditLogsGetHandler(deps)` test seam；行為測試需證明未登入時 parse／repository 零呼叫，已登入但 limit 不合法時 repository 零呼叫。
6. 保留 `readAuditLogs()` 的 Boss-only／`audit.read` 與 `1–200` defense-in-depth clamp，不改 RBAC、DB schema 或 migration。

### Proposed Error Contract

| 情境 | HTTP | Safe code |
|---|---:|---|
| 未登入／Session 無效／禁止的 dev header | 401 | `AUTHENTICATION_REQUIRED` |
| 已登入但無 Audit 權限 | 403 | `AUDIT_FORBIDDEN` |
| Strict limit 驗證失敗 | 400 | `INVALID_LIMIT` |
| Schema 未就緒 | 503 | 沿用 `safePostgresSchemaError()` 的 `DATABASE_*` |
| DB unavailable | 503 | `DATABASE_UNAVAILABLE` |
| 未知內部錯誤 | 500 | `AUDIT_API_ERROR` |

所有回應均需套用 `noStoreHeaders()`，且不得回傳 stack、DB URL、SQL、credential、cookie、token、checksum、原始 identity header 或 repository 原始訊息。

### Proposed Minimal APIs

```ts
parseAuditLimit(url: string): number
mapAuditApiError(error: unknown): { status: number; body: SafeAuditApiError }
createAuditLogsGetHandler(deps: {
  authenticate: (request: Request) => RequestIdentity;
  readAuditLogs: (email: string, limit: number) => Promise<unknown[]>;
}): (request: Request) => Promise<Response>
```

### DEV_API_001 Allowed Scope

- `app/api/audit-logs/route.ts`
- `tests/api-auth-order.test.mjs`
- 可新增 `tests/audit-api-handler.test.mjs`
- 若 route 檔案過重，可新增 audit-local `app/api/audit-logs/handler.ts`

不得藉此修改其他 protected API、Pilot Session、Customer／Topology RBAC、DB schema、migration、package 或 env。

### QA_API_001 Minimum Evidence

- 未登入＋正常／惡意 limit 均回 401，parse 與 repository 皆為零呼叫。
- 已登入＋invalid limit 回 400，repository 零呼叫。
- 已授權＋valid limit 只呼叫 repository 一次，email／limit 正確。
- Boss 為 200；site manager、engineer、sales_procurement 為 403。
- legacy／dev header 不可在 Pilot／production 冒用身分。
- schema uninitialized／outdated／too-new／checksum mismatch／unavailable 均回安全 503。
- 每個 success/error response 都驗證 no-store、安全 headers 與 leakage scan。
- source-order test 只保留為 smoke；P0 主驗收必須真正執行 Handler。

### Resolved User Decision

2026-08-20 使用者已核准 Strict `limit` 契約，`DEV_API_001` 可依本設計開工。

## Handoff Rule

完成後將 `DSG_API_002` 改為 `DONE`，並由 `DEV_API_001` 承接實作、`QA_API_001` 承接獨立驗收。
