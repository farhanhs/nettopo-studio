# DEV_UIX_004 — 登入者資料卡不得遮擋工作區操作

| 欄位 | 值 |
|---|---|
| Group | DEV |
| Feature | UIX |
| Priority | P1 |
| Status | QA_PASSED |
| Planned Order | 037 |
| Checkpoint | Functional UAT Fix |
| Owner | 開發組 |
| Created | 2026-08-31 |
| Updated | 2026-08-31 |

## Objective

修正 `session-profile` 固定浮層遮住 Inspector 操作按鈕的問題，讓工程師在支援的工作區尺寸中可以正常儲存設備與連線，同時保留目前登入者資訊及登出入口。

## Approved Decisions

- `PM_GOV_001-D25`：先完成工程師實務工作流驗證；UAT 缺陷建立最小 DEV 修復票，不新增 DSG 前置。
- `PM_GOV_001-D03/D04/D05/D21`：Pilot、synthetic data、Engineer 與 session 安全邊界不變。

## Requirement Traceability

| 欄位 | 內容 |
|---|---|
| User Intent | 優先確保功能在實際工程工作中可用，避免畫面元素阻擋核心操作 |
| Historical Sources | `QA_PIL_003` QA_FAILED、`qa-pil-003-uat-2026-08-31.md`、failure screenshot 與 Playwright pointer-interception evidence |
| Change Type | CORRECT |
| Affected Layers | UI layout、topbar/session presentation、Browser regression |
| Preserved Invariants | session/auth/logout 行為不變；currentUser 來源不變；不改 Canvas/domain/persistence/RBAC/API/DB/import/export |
| Conflict Check | 不改 `DSG_UIX_002` routing；不取代 `DEV_UIX_003` 告警改善；不碰 `DEV_REL_001` recovery；不以測試 force-click 掩蓋重疊 |
| Regression Map | `QA_PIL_003` 同票重驗；既有 Pilot Browser、UIX routing、TypeScript、build、scoped lint |
| Rollback／No-path | 若無法在既有 topbar／workspace layout 內安全放置帳號控制，停止回 PM；不得降低 logout 或 session 可見性 |

## Dependencies

- `QA_PIL_003 = QA_FAILED`，第一個 blocker 已可重現。
- `QA_PIL_002 = QA_PASSED`。

## Root Cause

- `.session-profile` 使用 `position: fixed; right: 18px; bottom: 18px; z-index: 45`。
- Inspector 內容可捲動至畫面右下方，浮層與 `儲存連線`／`儲存設備` 佔用相同區域。
- 真 Browser 正常 click 被 `aside.session-profile` 攔截，沒有送出 `/api/topology` POST。

## In Scope

- 將 current-user／logout 控制放入有保留空間的 layout flow，優先使用既有 topbar／save-state 區域或等價非覆蓋容器。
- 必要的 responsive／compact 樣式，確保帳號資訊與登出仍可見、可鍵盤操作。
- 新增針對非覆蓋、正常 click 與 logout 可用性的 targeted Browser／source guard 測試。
- 保留 `aria-label="登入者資料"` 或提供等價可存取名稱，讓既有驗收可穩定定位。

## Out of Scope

- 重做整個 topbar、Inspector、Canvas 或登入頁。
- 修改 authentication、cookie、session、RBAC、API、DB、schema、migration、Import／Export。
- 以 force click、JS click、`pointer-events:none`、提高 Inspector z-index 或單純縮小浮層掩蓋問題。
- Release recovery、checkpoint、push 或 deploy；push 要等 `QA_PIL_003` 完整 UAT 通過後依 PM 指示處理。

## Allowed Files／Systems

- `app/page.tsx`
- `app/globals.css`
- 新增或更新 `tests/dev-uix-004-*`
- `docs/dev開發紀錄/2026-08-31-dev-uix-004.md`
- 本 Ticket 與 `TICKET-REGISTER.md` 狀態

## Forbidden Changes

- `db/`、migration、package、env、credential、Pilot policy、routing algorithm、Import／Export contract。
- 修改 `tests/qa-pil-003-engineer-uat.mjs` 來繞過產品缺陷。
- 在原 dirty workspace 建立混合 commit、push 或 deploy。

## Acceptance Criteria

- [x] 在至少 1280×900 的真 Browser 工作區，登入者資料／登出控制不與 Inspector、Canvas、modal 或主要操作按鈕重疊。
- [x] `儲存連線` 與 `儲存設備` 使用正常 pointer click 可成功觸發既有儲存流程，不使用 force click。
- [x] Inspector 捲到最下方時，最後一個操作按鈕完整可見且可點擊。
- [x] current user name、role 與 logout 仍可見；logout 行為與安全邊界不變。
- [x] Pilot 與 development profile 均不出現新的 identity/session 顯示回歸。
- [x] targeted tests、TypeScript、scoped ESLint、`build:local` 通過。
- [x] 完成後狀態只能到 `READY_FOR_QA`，交回 `QA_PIL_003` 同票從失敗點開始完整重跑。

## DEV Evidence — 2026-08-31

- 修正：`session-profile` 已從 fixed bottom-right overlay 移入 topbar `save-state` 正常 layout flow。
- Targeted：`node --test tests/dev-uix-004-session-profile-layout.test.mjs` PASS，2/2。
- TypeScript：`node node_modules\typescript\bin\tsc --noEmit --pretty false` PASS。
- Scoped ESLint：`node_modules\.bin\eslint.cmd app\page.tsx app\globals.css tests\dev-uix-004-session-profile-layout.test.mjs` PASS，0 errors；CSS 檔因 eslint config 顯示 1 warning。
- Build：`npm.cmd run build:local` PASS，僅既有 chunk size / route classification warning。
- Browser preflight：未修改 `tests/qa-pil-003-engineer-uat.mjs`；原 blocker 已解除，`儲存連線` 正常 pointer click 送出 `/api/topology` POST 並回 200。`儲存設備` 與完整 profile matrix 留給 QA_PIL_003 快速重驗確認。完整 UAT 後續停在新的 `wired routes should be rendered` routing count assertion，待 QA/PM 另行判定。

## Responsive Follow-up／QA Evidence — 2026-09-01

- 1280px Pilot topbar 改為雙列 responsive grid，`top-actions` 與 `project-switcher` 各自占用明確區域，登入者卡片及登出不再被操作列覆蓋。
- Targeted layout/logout/drag tests：PASS，8/8；TypeScript、scoped ESLint、Pilot build：PASS。
- `QA_PIL_003` 獨立完整 UAT：`QA_PASSED`；正常 pointer click 可觸發儲存與 Pilot logout，未使用 force click。

## Stop Condition

若修正需要改產品資訊架構、auth/session 語意、整體 topbar 重設計或支援尺寸決策，停止回 PM；不得擴大本票。不得自行標記 QA pass、push 或 deploy。

## Handoff History

| Date | From | To | Status | Summary |
|---|---|---|---|---|
| 2026-08-31 | PM | DEV | READY | 依 QA_PIL_003 第一個 blocker 建立最小 UI 修復；完成後回同票 UAT |
| 2026-09-01 | QA | PM/DEV | QA_PASSED | 1280×900 responsive topbar、Inspector 正常 pointer click 與完整工程師 UAT 通過 |
