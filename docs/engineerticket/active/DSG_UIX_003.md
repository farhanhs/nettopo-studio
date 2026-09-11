# DSG_UIX_003 — 線路交叉／重疊成本最小化路由設計

| 欄位 | 值 |
|---|---|
| Group | DSG |
| Feature | UIX |
| Priority | P1 |
| Status | READY |
| Planned Order | 076 |
| Change Type | EXTEND |
| Owner | 設計組 |
| Downstream | DEV_UIX_009 → DEV_UIX_003 → QA_UIX_005 |

## Requirement Traceability

| Gate | 內容 |
|---|---|
| User Intent | 手動移動設備後自動尋找較少交叉、較少重疊且可辨識的路徑，不只要求使用者自己移動設備 |
| Historical Sources | DSG_UIX_002、DEV_UIX_002、QA_UIX_001、DEV_UIX_003；2026-09-08 回報 |
| Approved Decisions | PM_GOV_001-D09/D10/D11/D12/D13/D31 |
| Affected Layers | routing view derivation、route cache/stability、warning fallback、Browser geometry QA |
| Preserved Invariants | 設備避障是硬限制；最近邊 anchor；offset 僅真重疊；route/lane 不寫入 Device/Link domain；wireless 例外不變 |
| Conflict Check | 現有 DEV_UIX_003 只改善告警，不能取代自動路由；本需求是 EXTEND，須先完成成本契約 |
| Regression Map | no-path、crossing-only、shared corridor、drag stability、dense graph、label occlusion、performance |
| No-path | 不承諾全域最佳解；若 bounded deterministic search 無法達成效能，須回 PM 降階而非阻塞 UI |

## Design Deliverable

- 定義 lexicographic/weighted cost：設備碰撞（不可行）→ 線段重疊長度 → 交叉次數 → label/node 遮擋 → bends → path length → 與前一路徑差異。
- 定義 candidate corridor/grid、deterministic tie-break、增量重算與避免拖曳時跳線的 stability/hysteresis。
- 定義效能預算與降階：互動期間快速路徑、drag-stop 精算、找不到改善時保留安全路徑並交 DEV_UIX_003 顯示原因。
- 定義 crossing/overlap geometry、測試 fixtures、視覺驗收與不持久化的資料邊界。
- 完成後狀態只能 `WAITING_APPROVAL`，由 PM/使用者核准演算法契約後才開 DEV_UIX_009。

