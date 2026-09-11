# QA_UIX_004 — Canvas initial viewport／resize 驗收

| 欄位 | 值 |
|---|---|
| Group | QA |
| Feature | UIX |
| Priority | P1 |
| Status | BLOCKED |
| Planned Order | 075 |
| Dependency | DEV_UIX_008 READY_FOR_QA |
| Updated | 2026-09-08 |

## Scope

- 真 Browser 驗證 fresh login、reload/session restore、panel layout restore 的首幀與穩定後尺寸。
- 選設備前後 canvas/workspace rect 不應由錯誤高度跳成正常；無垂直/水平溢位。
- 驗證初次 fit 後，選取設備不重設使用者手動 pan/zoom；拖曳持久化不退步。

## Queue Alignment — 2026-09-08

PM_GOV_001-D31 已發單，本票排入測試佇列但不啟動。等待 `DEV_UIX_008` 狀態變更為 `READY_FOR_QA` 後，才可進入 `IN_QA` 並驗證登入首幀 Canvas/resize、panel restore 與 pan/zoom 不被 selection 重設。
