# QA_UIX_005 — 多成本路由幾何／效能驗收

| 欄位 | 值 |
|---|---|
| Group | QA |
| Feature | UIX |
| Priority | P1 |
| Status | BLOCKED |
| Planned Order | 078 |
| Dependency | DEV_UIX_009 READY_FOR_QA；DEV_UIX_003 READY_FOR_QA |
| Updated | 2026-09-08 |

## Scope

- 幾何 fixtures 比較 baseline 與新路由：設備碰撞必為零，交叉次數/重疊長度不可惡化並在指定案例改善。
- 驗 deterministic、拖曳後穩定、shared corridor lane、label 遮擋、wireless 例外、no-path fallback。
- 真 Browser dense topology drag/route 與效能預算；不得只靠截圖或 source scan。

## Queue Alignment — 2026-09-08

PM_GOV_001-D31 已發單，本票排入測試佇列但不啟動。等待 `DEV_UIX_009` 與 `DEV_UIX_003` 均為 `READY_FOR_QA` 後，才可進入 `IN_QA` 並執行多成本路由幾何、穩定、效能與 no-path 真 Browser 驗收。
