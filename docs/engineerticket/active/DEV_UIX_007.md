# DEV_UIX_007 — Topbar 中等寬度登入者與操作區防重疊

| 欄位 | 值 |
|---|---|
| Group | DEV |
| Feature | UIX |
| Priority | P1 |
| Status | READY |
| Planned Order | 072 |
| Change Type | CORRECT |
| Owner | 開發組 |
| QA | QA_UIX_003 |

## Requirement Traceability

| Gate | 內容 |
|---|---|
| User Intent | 登入身分、測試身分、排版模式及動作按鈕在實際視窗不得互相遮擋 |
| Historical Sources | DEV_UIX_004、QA_PIL_003、DSG_PIL_002 responsive contract；2026-09-08 回報 |
| Approved Decisions | PM_GOV_001-D25/D30/D31 |
| Affected Layers | `app/page.tsx` topbar semantics、`app/globals.css` responsive layout |
| Preserved Invariants | 登入者角色與 logout 保持可見可用；不改 session/auth；不遮擋 workspace |
| Conflict Check | DEV_UIX_004 已完成 1280×900 浮層移位；本票只補中等寬度/zoom 回歸，不重寫歷史 |
| Regression Map | 768/1024/1280、200% zoom、長 email/role、development/Pilot banner、鍵盤操作 |
| No-path | 若需重做資訊架構或隱藏安全身分/登出，停止回 PM |

## Scope and Acceptance

- 在既有 topbar flow 中使用 wrap/grid/compact presentation；不新增 UI 套件。
- 768、1024、1280px 與 200% zoom 無元素重疊或水平溢位，主要動作及 logout 可達。
- 長 email/role 可安全 ellipsis 或換行，完整值保持 accessible。
- Allowed：topbar JSX/CSS hunk與 DEV tests；禁止 auth/session/API、全域 CSS reset。

