# PM_GOV_001 — 確認專案憲章與底層規則

| 欄位 | 值 |
|---|---|
| Group | PM |
| Feature | GOV |
| Priority | P0 |
| Status | READY |
| Planned Order | 001 |
| Checkpoint | Governance |
| Created／Updated | 2026-08-19 |

## Objective

由使用者確認產品目標、架構框架、Pilot 定位、底層安全規則與跨組權限，建立後續所有工單的最高依據。

## In Scope

- NetTopo Studio 與 netNNassist 的產品邊界。
- Domain、State、Import/Export、Credential、Migration、Runtime Profile 規則。
- PM／設計／開發／測試／OPS 工作權限。
- Internal Pilot 的範圍與延後項目。

## Acceptance Criteria

- [x] 使用者於 2026-08-19 明確批准專案憲章與底層規則。
- [x] 過去已明確下達的 Pilot 決策回填 Decision Log；未有明確依據的項目不得推定。
- [x] 建立 `REQUIREMENT-BASELINE.md`，把歷次開發計畫與驗收紀錄納入開工前追溯。
- [x] 設計、開發、測試與維運組已收到同一份規則，不再使用推薦值或目前程式推定產品語意。

## Approval Record

- 2026-08-19：使用者明確核准 `PM_GOV_001` 與 `PM_GOV_002`。
- 核准不代表所有下游開發票自動獲准；每張 `DEV_*` 仍需依 Requirement Traceability Gate 與自身狀態啟動。
- 本票在治理文件進入乾淨 checkpoint 前維持 `READY`，不提前標記 `DONE`。

## Forbidden Changes

- 本票未批准前不得用它授權產品實作。
- 不得把工作樹候選行為視為正式產品規格。
