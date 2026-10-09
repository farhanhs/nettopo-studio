# DEV_UIX_008 — 登入後 Canvas 初始滿版與 resize 同步

| 欄位 | 值 |
|---|---|
| Group | DEV |
| Feature | UIX |
| Priority | P1 |
| Status | READY_FOR_QA |
| Planned Order | 074 |
| Change Type | CORRECT |
| Owner | 開發組 |
| QA | QA_UIX_004 |

## Requirement Traceability

| Gate | 內容 |
|---|---|
| User Intent | 登入後第一次顯示即填滿可用工作區，不必先點設備觸發 Inspector 才正常 |
| Historical Sources | DEV_UIX_001/004/005/007、QA_PIL_003、QA_UIX_003；2026-09-08 回報 |
| Approved Decisions | PM_GOV_001-D09/D10/D25/D31 |
| Affected Layers | app shell/topbar/workspace CSS、PanelGroup ready、React Flow viewport resize/fit |
| Preserved Invariants | React Flow controlled view；panel layout 與 topology data 分離；不改 persisted coordinates |
| Conflict Check | DEV_UIX_007 已收斂 topbar responsive token；本票移除 Canvas 對 magic-number 高度與 selection-side-effect 的依賴 |
| No-path | 若需改 domain/schema、routing cost 或每次 selection 強制 fitView，停止回 PM |

## Scope and Acceptance

- 優先以 app-shell flex/dynamic viewport 統一高度來源；不得保留 topbar/workspace 互相漂移的 magic number。
- 在 auth、store、panel layout ready 後只觸發一次正確 React Flow measurement/fit。
- fresh login、reload/session restore、panel layout restore 的 canvas rect 與可用工作區一致。
- 選取 Inspector 不得重設使用者 pan/zoom；drag persistence 不退步。
- Allowed：`app/page.tsx` shell/ReactFlow hunk、`app/globals.css` shell/workspace hunk、DEV tests；禁止 domain/Dexie/routing 演算法改動。

## Development Result — 2026-09-09

- `.app-shell` 改為 `100dvh` flex column；`.workspace` 使用剩餘 flex 高度與 `min-height: 0`，不再用 topbar 高度做 viewport subtraction。
- `flow-shell` 使用 `ResizeObserver` 量測實際可用尺寸，將 width/height 明確傳給 React Flow；Panel resize 不再靠選取 Inspector 造成的 incidental re-render。
- 移除會隨 `panelLayout` 改變而 remount 整個 PanelGroup 的 dynamic key，避免 panel resize 重建 Canvas instance。
- React Flow `onInit` 後等待 viewport 與 node measurement ready，再依 active topology 做一次 `fitView`；selection 不在 fit effect dependency，設備／連線選取不會重設 pan/zoom。
- 保留 DEV_UIX_005 的 drag persistence 邊界：`onNodesChange` 僅做 transient update，durable write 仍只在 `onNodeDragStop`。

## Verification

- `node --test tests/dev-uix-008-canvas-resize.test.mjs`：PASS，4/4。
- `node --test tests/dev-uix-006-inspector-remount.test.mjs tests/dev-uix-007-topbar-responsive.test.mjs tests/dev-uix-008-canvas-resize.test.mjs tests/dev-pil-002-topology-site.test.mjs tests/pilot-checkpoint.test.mjs`：PASS，25/25。
- `node node_modules\typescript\bin\tsc --noEmit --pretty false`：PASS。
- `node_modules\.bin\eslint.cmd app\page.tsx app\globals.css tests\dev-uix-006-inspector-remount.test.mjs tests\dev-uix-007-topbar-responsive.test.mjs tests\dev-uix-008-canvas-resize.test.mjs`：PASS，CSS ignored warning only。
- `npm.cmd run build:local`：PASS，僅既有 chunk size／route classification warning。
- `git diff --check`：PASS，僅既有 CRLF warnings。

## Handoff

交付狀態：`READY_FOR_QA`。請 `QA_UIX_004` 以真 Browser 驗 fresh login、reload/session restore、PanelGroup restore、selection 不 reset pan/zoom 與 drag persistence。

## QA Result — 2026-09-11

`QA_UIX_004` 已完成並通過。真 Browser 驗證 fresh login、reload/session restore、panel layout restore、PanelGroup resize、selection viewport stability、drag persistence，以及 DEV_UIX_007 topbar responsive regression 均 PASS。證據見 `docs/dev測試紀錄/qa-uix-004-canvas-resize-2026-09-11.md`。

## Checkpoint Preparation — 2026-10-02

狀態維持 `QA_PASSED`。本票已拆為順序 patch `003-dev-uix-008.patch`，接在 006/007 後加入 flex shell、ResizeObserver、PanelGroup instance stability、one-time measured fit、print shell，以及 UIX_004/007 compatibility assertions。三段重建後 final normalized hash `6/6` 一致。完整 manifest、AIL page conflict list與 QA supporting 清單見 [checkpoint 準備紀錄](../../dev開發紀錄/2026-10-02-uix-006-008-checkpoint.md)。未 stage／commit／push／merge。

## A-REV-03 開工 — 2026-10-09

- Code review 發現：切換空拓樸 A → 有設備拓樸 B 時，`flowNodes` 仍可能是 A 的空陣列；舊 effect 會立即把 B 寫入 `fittedTopologyRef`，下一輪 B 節點同步後因同 key guard 而永遠不呼叫 `fitView`。
- 本批沿原票 CORRECT，只修 first-fit 同步／量測 gate 與 DEV regression；保留 2026-09-11 歷史 `QA_PASSED`，不把 review finding 捏造成過去 QA_FAILED。
- 開發組為唯一產品 writer；新候選交付 QA 後停止產品寫入。Next owner 預定 `QA_UIX_004`，另需 `QA_UIX_003` impact 與 `QA_PIL_006` A03。

## A-REV-03 候選交付 — 2026-10-09

- Revision：`A-WP-20261005-DEV_UIX_008-A-REV-03`；差異、hash、impact 與驗證見 [開發紀錄](../../dev開發紀錄/2026-10-09-dev-uix-008-a-rev-03.md)。
- 修改僅限 `app/page.tsx` first-fit effect 與 `tests/dev-uix-008-canvas-resize.test.mjs`；不改 persisted coordinates、drag persistence、selection 或 panel 操作語意。
- DEV 驗證：focused 16/16、TypeScript、scoped ESLint、no-env build PASS。
- Browser／完整 A03 尚待獨立 QA；本票 `READY_FOR_QA`，next owner `QA_UIX_004`，並交 `QA_UIX_003` impact／`QA_PIL_006` A03。

## 最新停止點 — PRE-COMMIT

使用者要求後續自動派單、同票修復與獨立 QA 重驗，直到形成可審查的 `PRE-COMMIT` checkpoint 再停止。此指示優先於 A 工作包先前可自行建立本地 commit 的授權。

- QA 必要條件通過後，開發組只整理精確候選、差異、hash、測試／cleanup 證據與建議 commit 拆分。
- 不得 stage、commit、push；不得為 A09 committed-tree 驗證自行建立暫時 commit。
- A09 的 pre-commit packet／中間態驗證可繼續；actual committed-tree 部分維持 `NOT RUN`，等待使用者另行驗收與授權。
- `READY_FOR_QA` 不是停止一般驗收；明確產品缺陷仍沿原票 DEV↔QA 閉環，直到 PRE-COMMIT gate 或超 scope 阻擋。
