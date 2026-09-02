# PM_GOV_002 — 採用 Engineer Ticket 與 Requirement Traceability 治理

| 欄位 | 值 |
|---|---|
| Group | PM |
| Feature | GOV |
| Priority | P0 |
| Status | READY |
| Planned Order | 002 |
| Checkpoint | Governance |
| Dependencies | PM_GOV_001 |
| Created | 2026-08-17 |
| Approved／Updated | 2026-08-19 |

## Objective

正式採用 Engineer Ticket、Decision Log、Requirement Traceability Gate 與跨組 handoff 規則，使所有工作能從使用者意圖一路追溯至設計、程式、測試、checkpoint 與部署。

## Approval Record

- 2026-08-19：使用者明確核准 `PM_GOV_001` 與 `PM_GOV_002`。
- `PM_GOV_001-D08`：正式採用 Engineer Ticket 治理規則。
- `PM_GOV_001-D11`：所有新票必須先完成歷史回溯與 Requirement Traceability Gate。

## Effective Rules

- `RULES.md` 為狀態、權限、排序、handoff 與 DoD 的權威規則。
- `REQUIREMENT-BASELINE.md` 為歷史來源、產品基線、權威順序與開工前追溯閘門。
- `DECISION-LOG.md` 是產品語意批准的唯一索引。
- `TICKET-REGISTER.md` 是工作狀態與排序的唯一總表。
- 任何組別不得只讀最近一則聊天或目前程式就開始工作。

## Acceptance Criteria

- [x] 使用者明確批准 Engineer Ticket 治理。
- [x] Requirement Traceability Gate 寫入正式規則與工單模板。
- [x] 歷史開發／測試計畫建立索引與權威順序。
- [x] 設計、開發、測試與 OPS 組收到同一份治理通知。
- [ ] 治理文件納入乾淨 checkpoint；完成前 Ticket 維持 `READY` 而非 `DONE`。
