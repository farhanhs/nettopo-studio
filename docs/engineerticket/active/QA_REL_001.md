# QA_REL_001 — Checkpoint Chain 與 Frozen-tree Equivalence 驗收

| 欄位 | 值 |
|---|---|
| Group | QA |
| Feature | REL |
| Priority | P0 |
| Status | BLOCKED |
| Planned Order | 052 |
| Checkpoint | Release Acceptance |
| Dependencies | DEV_REL_001 READY_FOR_QA |
| Created／Updated | 2026-08-30 |

## Objective

獨立驗證 recovery snapshot 可重建、每個 checkpoint 可辨識且符合 Ticket scope、逐 commit 可測，以及最終 tree 與 PM freeze tree 等價。

## Acceptance Matrix

- Recovery patch/archive/hash 重算與隔離還原通過。
- Commit message 含 primary Ticket；無混入 unmapped path／secret／generated artifacts。
- 共用檔案 hunk ownership 有 release map，無整檔偷帶其他票。
- 每 commit 執行票面 targeted test；DB、Browser、Security checkpoint 使用對應真實 gate。
- Final serial full Node、TypeScript、build:local、scoped/full lint evidence、DB verify、Pilot Browser、Import Browser／round-trip／secret scan通過。
- Final tree content/mode/type 與 frozen snapshot 等價；只有核准 release metadata 可列為差異。
- QA 不修改產品碼、commit內容、migration、env、DB role/grant配合通過。

## Stop Condition

Recovery 不可還原、commit 無 Ticket、secret/generated artifact 命中、任一測試失敗或 tree mismatch 即 `QA_FAILED`／`QA_BLOCKED`，不得部署。

