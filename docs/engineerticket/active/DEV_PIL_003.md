# DEV_PIL_003 — Runtime Profile 專屬登出路由

| 欄位 | 值 |
|---|---|
| Group | DEV |
| Feature | PIL |
| Priority | P1 |
| Status | QA_PASSED |
| Planned Order | 039 |
| Checkpoint | Functional UAT Fix |
| Owner | PM 主對話接管實作 |
| Created | 2026-09-01 |
| Updated | 2026-09-01 |

## Objective

讓 Pilot workspace 登出只呼叫 `/api/pilot/session`，development/demo 只呼叫 `/api/dev/session`，避免跨 profile 串行呼叫造成 Pilot logout UAT 無回應。

## Requirement Traceability

| 欄位 | 內容 |
|---|---|
| User Intent | 完成工程師實務工作流並驗證登入、工作與登出可正常閉環 |
| Historical Sources | QA_PIL_003 後段 UAT；D06、D20、D21 runtime profile/session boundary |
| Change Type | CORRECT |
| Affected Layers | UI session logout、Pilot Browser UAT |
| Preserved Invariants | Cookie 名稱/options、same-origin、Pilot binding、dev gate、RBAC 不變 |
| Conflict Check | 不新增 OIDC；不允許 Pilot 呼叫 development authentication；不改 API handler |
| Regression Map | Pilot logout request、development logout request、logout 後 protected API 401、QA_PIL_003 |
| Rollback／No-path | runtime capabilities 未載入時 fail closed，不得同時嘗試多個 profile endpoint |

## Allowed Scope

- `app/page.tsx`
- `tests/dev-pil-003-*`
- 本 Ticket、Register 與開發紀錄

## Acceptance Criteria

- [x] Pilot profile 只送出 `DELETE /api/pilot/session`。
- [x] Development/demo 只送出 `DELETE /api/dev/session`。
- [x] Pilot logout response 正常，登出後 protected topology API 為 401。
- [x] 不修改 cookie/session/RBAC/API handler 語意。
- [x] targeted、TypeScript、scoped ESLint、build 與 QA_PIL_003 完整 UAT 通過。

## DEV／QA Evidence — 2026-09-01

- Workspace logout 依 `runtimeCapabilities.profile` 選擇唯一 endpoint；Pilot request 保留 JSON mutation header，development 不跨呼叫 Pilot route。
- Targeted DEV_PIL_003 tests：PASS，2/2；合併 UIX/PIL targeted：PASS，8/8。
- `QA_PIL_003` 獨立 UAT 捕捉實際 DELETE request，嚴格確認 pathname 為 `/api/pilot/session`；response 200，登出後 topology 401，tampered cookie 401。

## Handoff History

| Date | From | To | Status | Summary |
|---|---|---|---|---|
| 2026-09-01 | PM | PM/DEV | IN_PROGRESS | UAT 通過拖曳與 round-trip 後，修正 profile-specific logout |
| 2026-09-01 | PM/DEV | QA | READY_FOR_QA | profile-specific endpoint 與 targeted regression 完成 |
| 2026-09-01 | QA | PM/DEV | QA_PASSED | Pilot-only logout、登出後 401 與 tampered cookie 401 通過 |
