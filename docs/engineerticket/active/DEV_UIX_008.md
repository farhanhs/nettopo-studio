# DEV_UIX_008 — 登入後 Canvas 初始滿版與 resize 同步

| 欄位 | 值 |
|---|---|
| Group | DEV |
| Feature | UIX |
| Priority | P1 |
| Status | READY |
| Planned Order | 074 |
| Change Type | CORRECT |
| Owner | 開發組 |
| QA | QA_UIX_004 |

## Requirement Traceability

| Gate | 內容 |
|---|---|
| User Intent | 登入後第一次顯示即填滿可用工作區，不必先點設備觸發 Inspector 才正常 |
| Historical Sources | DEV_UIX_001/004/005、QA_PIL_003；2026-09-08 回報 |
| Approved Decisions | PM_GOV_001-D09/D10/D25/D31 |
| Affected Layers | app shell/topbar/workspace CSS、PanelGroup ready、React Flow viewport resize/fit |
| Preserved Invariants | React Flow controlled view；panel layout 與 topology data 分離；不改 persisted coordinates |
| Conflict Check | `.topbar` 106px 與 `.workspace calc(100vh - 96px)` 是可疑現況證據；根因須以 Browser measurement 證明 |
| Regression Map | first login、reload、session restore、panel layout restore、Inspector open/close、user pan/zoom |
| No-path | 若需改 domain/schema或每次 selection 強制 fitView，停止回 PM |

## Scope and Acceptance

- 優先用 app-shell flex/dynamic viewport 統一高度來源；不得保留互相矛盾的 magic-number 高度。
- 在 auth、store ready、panel layout ready 後觸發一次正確 React Flow measurement/fit；後續選取不得重設使用者 pan/zoom。
- 初始 Canvas client rect 與可用工作區一致，登入、reload、Inspector selection 前後不得跳動或溢出。
- Allowed：`app/page.tsx` shell/ReactFlow hunk、`app/globals.css` shell/workspace hunk、DEV tests；禁止 domain/Dexie/routing 演算法改動。

