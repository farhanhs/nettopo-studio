# QA_UIX_003 — Topbar responsive overlap 驗收

| 欄位 | 值 |
|---|---|
| Group | QA |
| Feature | UIX |
| Priority | P1 |
| Status | BLOCKED |
| Planned Order | 073 |
| Dependency | DEV_UIX_007 READY_FOR_QA |
| Updated | 2026-09-08 |

## Scope

- 真 Browser 量測 768/1024/1280、短高度與 200% zoom；元素 bounding boxes 不相交。
- 覆蓋長 email/role、development/Pilot banner、project switcher、layout、import/export/PDF 與 logout。
- 正常 pointer/keyboard 操作，不以 force click 通過；回歸 DEV_UIX_004 Inspector action 可達。

## Queue Alignment — 2026-09-08

PM_GOV_001-D31 已發單，本票排入測試佇列但不啟動。等待 `DEV_UIX_007` 狀態變更為 `READY_FOR_QA` 後，才可進入 `IN_QA` 並執行 768/1024/1280、200% zoom、長身分與 bounding boxes 真 Browser 驗收。
