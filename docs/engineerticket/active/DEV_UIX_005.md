# DEV_UIX_005 — Canvas 設備拖曳與座標持久化

| 欄位 | 值 |
|---|---|
| Group | DEV |
| Feature | UIX |
| Priority | P1 |
| Status | QA_PASSED |
| Planned Order | 038 |
| Checkpoint | Functional UAT Fix |
| Owner | 開發組 |
| Created | 2026-08-31 |
| Updated | 2026-09-01 |

## Objective

確保具編輯權限的工程師可以用正常滑鼠操作拖曳 React Flow 設備，拖曳結束後透過既有 Zustand／server save boundary 保存座標，重新載入後位置不回復。

## Approved Decisions

- `PM_GOV_001-D25`：優先修正工程師實務 UAT 的第一個可重現 blocker，不新增 DSG 前置。
- `PM_GOV_001-D09/D10`：設備位置變動後，直角避障、anchor 與 offset 必須重新計算且保持可讀。

## Requirement Traceability

| 欄位 | 內容 |
|---|---|
| User Intent | 工程師必須能調整拓樸設備位置並在 reload 後保留結果 |
| Historical Sources | `QA_PIL_003` DEV_UIX_004 後 re-test、route DOM evidence、drag screenshot 與 DB coordinate evidence |
| Change Type | CORRECT |
| Affected Layers | React Flow interaction、Canvas overlay hit priority、Zustand write boundary、server persistence、Browser regression |
| Preserved Invariants | Device/Project schema 不變；座標仍由 Project 保存；不把暫態 route/anchor 寫入 domain；Pilot/RBAC/credential/import/export 不變 |
| Conflict Check | 不取代 `DEV_UIX_003` 告警改善或 `DEV_UIX_004` session layout；不得用 QA force-drag、直接 DB update 或關閉 link selection 掩蓋 |
| Regression Map | onNodesChange／onNodeDragStop、wired/wireless hit-area、route recalculation、save queue、reload、QA_PIL_003 全流程 |
| Rollback／No-path | 若問題需要改 React Flow/domain schema 或整體 routing interaction contract，停止回 PM；不得擴張重構 |

## Dependencies

- `QA_PIL_003 = QA_FAILED`：DEV_UIX_004 原遮擋已解除，新 blocker 為 drag persistence。
- `DEV_UIX_004 = READY_FOR_QA`。
- `QA_UIX_001 = QA_PASSED`。

## Reproduction Evidence

1. Pilot Engineer 建立／匯入包含 Router、Switch、Server 與四條連線的 topology。
2. routing DOM：三條 wired 為 `orthogonal/resolved`，一條 wireless 為 `wireless/resolved`。
3. 以正常路徑「設備頁籤 → 選 Router → 從節點上方安全區拖曳」。
4. 拖曳後畫面與 PostgreSQL Project 中 `uat-router` 均仍為 `x=80,y=160`。
5. QA 已排除 link 數量、DB save wait 與 session-profile 覆蓋造成的假失敗。

## Required Root-cause Checks

- 確認 React Flow 是否收到 `NodeChange` position／dragging events，以及 normal node 是否實際 `draggable`。
- 確認 `.flow-link-overlay`／`.hit-line` 是否在節點範圍攔截 pointer drag；link hit target 不得覆蓋 node drag surface。
- 確認 controlled `nodes` 與 `applyNodeChanges(changes, nodes)` 是否因 stale render/state 導致位置立即回復。
- 確認拖曳持久化應在 transient move 還是 `onNodeDragStop` 寫入；避免每一 frame 排入 server write queue。
- 確認 `setProject`／`queueServerWrite` 不會以較舊 project response 覆寫最新座標。

## In Scope

- 修正 Canvas node drag 的 pointer priority／controlled state。
- 以 Zustand `setProject` 作唯一 durable mutation boundary；可在 drag stop 合併單次座標更新。
- server/local persistence 一致性與 reload regression。
- 拖曳後 routing 重新計算，wired 不穿越設備、wireless 例外不退步。
- 新增 targeted unit/interaction test，以及至少一個真 Browser Pilot Engineer drag/reload regression。

## Out of Scope

- 改動 Device/Link/Group schema、migration、RBAC、session、credential、Import／Export contract。
- 重寫 routing algorithm、auto layout 或整套 Canvas state architecture。
- 直接修改 QA_PIL_003 斷言來接受座標不變。
- Release recovery、checkpoint、push 或 deploy；push 要等完整 UAT 通過。

## Allowed Files／Systems

- `app/page.tsx`
- `app/globals.css`
- 必要時最小修改 `app/lib/topology-store.ts`
- `tests/dev-uix-005-*`
- `docs/dev開發紀錄/2026-08-31-dev-uix-005.md`
- 本 Ticket 與 `TICKET-REGISTER.md` 狀態

## Forbidden Changes

- `db/`、migration、package、env、auth/pilot policy、CSV contract。
- 修改 `tests/qa-pil-003-engineer-uat.mjs` 來繞過產品缺陷。
- 在原 dirty workspace 建立混合 commit、push 或 deploy。

## Acceptance Criteria

- [x] Pilot Engineer 可用正常 pointer drag 移動設備，不使用 force drag 或 DevTools。
- [x] drag stop 後 Project 中目標設備座標實際改變，PostgreSQL 保存完成。
- [x] reload 後座標與 drag stop 結果一致，其他設備與四條 links 不遺失。
- [x] link hit-area 仍可選取連線，但不得攔截節點主要拖曳區。
- [x] 拖曳後 wired/wireless routes 重新渲染且維持已核准 routing invariant。
- [x] server write queue 不因逐 frame 寫入造成舊位置覆寫最新位置。
- [x] targeted tests、TypeScript、scoped ESLint、`build:local` 通過。
- [x] 完成後先到 `READY_FOR_QA`，並由 `QA_PIL_003` 同票完整重驗通過。

## DEV／QA Evidence — 2026-09-01

- `app/page.tsx` 使用 transient `flowNodes` 呈現 drag frame，並由 `onNodeDragStop` 單次呼叫 Zustand `setProject` 寫入 durable position。
- `latestNodePositionsRef` 保留最後拖曳座標，避免 controlled nodes 的 stale render 把位置回復。
- Targeted DEV_UIX_005 tests：PASS，3/3；合併 UIX/PIL targeted：PASS，8/8。
- `QA_PIL_003` 真 Browser/Pilot/PostgreSQL UAT：drag 後 DB 座標變動；reload 後仍保留 3 devices／4 links／1 group，routing invariants 通過。

## Stop Condition

若修復需要改 durable schema、RBAC、routing contract 或大規模 state architecture，停止回 PM。不得自行標 QA pass、commit、push 或 deploy。

## Handoff History

| Date | From | To | Status | Summary |
|---|---|---|---|---|
| 2026-08-31 | PM | DEV | READY | 依 QA_PIL_003 re-test 的 drag persistence blocker 建立最小修復票 |
| 2026-09-01 | DEV/PM | QA | READY_FOR_QA | transient drag state 與 drag-stop durable persistence 完成 |
| 2026-09-01 | QA | PM/DEV | QA_PASSED | 真 Browser drag/reload、DB persistence 與 routing regression 全部通過 |
