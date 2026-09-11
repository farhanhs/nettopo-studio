# QA_UIX_002 — Inspector selection 同步驗收

| 欄位 | 值 |
|---|---|
| Group | QA |
| Feature | UIX |
| Priority | P1 |
| Status | BLOCKED |
| Planned Order | 071 |
| Dependency | DEV_UIX_006 READY_FOR_QA |
| Updated | 2026-09-08 |

## Scope

- 真 Browser 驗證設備 A→B→A、canvas/list、設備↔連線切換與 persisted value。
- 在 B 儲存後確認只有 B 更新，reload 後一致；read-only 使用者不獲得寫入能力。
- 回歸 Device/Link 新增、刪除、credential 不進 DOM/Project；QA 不修改產品碼。

## Queue Alignment — 2026-09-08

PM_GOV_001-D31 已發單，本票排入測試佇列但不啟動。等待 `DEV_UIX_006` 狀態變更為 `READY_FOR_QA` 後，才可進入 `IN_QA` 並執行真 Browser Inspector selection/save/reload 驗收。
