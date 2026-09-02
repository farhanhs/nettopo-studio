# DSG_UIX_002 — 直角避障路由與最近邊連接點設計

| 欄位 | 值 |
|---|---|
| Group | DSG |
| Feature | UIX |
| Priority | P1 |
| Status | DONE |
| Planned Order | 043 |
| Checkpoint | UI Routing |
| Dependencies | DSG_UIX_001 |
| Related Tickets | DEV_UIX_002, QA_UIX_001 |
| Created／Updated | 2026-08-18 |

## Objective

重新設計設備連線幾何，使設備間連線預設為清楚、可辨識且不穿越設備的直角路徑；連接點預設落在朝向對端的最近設備邊，僅在端點或路由走廊確實重疊時才套用 deterministic offset。

## Approved Decisions

- `PM_GOV_001-D09`：設備連結預設採直角路由，線段不得與非端點設備疊合。
- `PM_GOV_001-D10`：連接點預設位於朝向對端的最近設備邊；只有實際重疊／同 corridor 才配置 offset。

## Current Implementation Findings

目前相關檔案：

- `app/lib/topology-routing.ts`
- `app/lib/topology-layout.ts`
- `app/page.tsx`
- `tests/topology-routing.test.mjs`
- `tests/topology-layout.test.mjs`

已確認的現況落差：

1. `routeTopologyLink()` 在直線無障礙時回傳 `kind: "direct"`，仍會畫斜線，不符合預設直角路由。
2. `orthogonalPort()` 用設備中心的 `abs(dx) >= abs(dy)` 選左右／上下邊，尚未正式定義「最近邊」的幾何規則與 tie-break。
3. `linkEndpointOffset()` 以設備所有 incident links 排序並直接攤滿邊長；即使連線落在不同邊、不同 anchor 或完全不重疊，也會被 offset。
4. `linkChannelOffset()` 雖存在，但目前 routing 沒有使用，平行中段仍可能完全重疊。
5. `fallbackRoute()` 只依 obstacle intersection count 排序，沒有保證結果為零碰撞；這不符合「不得與設備疊合」硬規則。
6. 現有自動化測試只驗證部分 blocker/spine-leaf 避障，尚未覆蓋最近邊 anchor、overlap-only offset、同 corridor lane 與拖曳穩定性。

## In Scope

### A. Orthogonal Path Contract

- 設備連結預設由水平／垂直線段組成。
- 路徑從 source device 邊界 anchor 開始，結束於 target device 邊界 anchor。
- 除端點接觸外，任何 segment 都不得進入 source、target 或其他設備的 interior。
- 非端點設備使用含 clearance 的 obstacle rectangle。
- 不允許在找不到路徑時退化為穿越設備的 fallback。
- 設計 direct／wireless 是否保留例外；若需要例外，必須列為使用者待確認項，不能自行決定。

### B. Nearest-side Anchor Contract

- 針對每一端獨立計算 `left/right/top/bottom` side。
- Anchor 預設為對端中心到候選設備邊的最近投影點，並保留 corner padding。
- 定義對角線、等距、兩設備重疊、同列／同欄、對端位於設備投影範圍內時的 deterministic tie-break。
- Anchor 是 view/routing derivation，第一階段不得新增到 `Device`／`Link` 持久 domain。
- Port name（如 LAN1／Port 1）與視覺 anchor 分離，不能用 visual offset 改寫實體 port metadata。

### C. Overlap-only Offset Contract

- 先計算未 offset 的 base side／anchor／route。
- 只有下列情況才分配 lane：
  - 同設備、同 side、anchor 座標落在同一 collision tolerance。
  - 兩條或以上路徑有實際共線重疊 segment／同 corridor。
- 不同 side、不同 anchor 或僅交叉而不共線的路徑不得為了 link 數量預先 offset。
- Lane index 使用穩定排序，建議 `0, +1, -1, +2, -2...`，不可因 array insertion order 造成抖動。
- 定義 lane spacing、最大偏移、corner padding、hit-area stroke 與縮放下的最小可辨識距離。
- Offset 後必須重新跑 obstacle validation；若 offset 造成碰撞，需重新 route 或改用其他 lane。

### D. Routing／Congestion Strategy

設計組需比較並推薦：

1. Grid/visibility route 加入 occupied-segment congestion cost。
2. 先產生 base orthogonal route，再做 shared-corridor lane assignment。
3. 混合策略：anchor collision 先分流，middle corridor 由 congestion-aware grid route 解決。

比較維度：

- 避障正確性。
- 路徑穩定性。
- bend 數量與總長度。
- 60 台設備／大量 links 的效能。
- 拖曳單一設備後局部重算能力。
- 實作與測試複雜度。

## Out of Scope

- 手動拖曳 anchor／bend point。
- 在 Domain schema 儲存 anchor 或 route points。
- 真實交換器 port geometry／front-panel view。
- 修改 Customer、Topology、Credential、Import/Export schema。
- 直接實作產品程式或移交開發組。

## Required Design Outputs

1. Routing data contract：side、anchor、exit、segment、lane、route validation result。
2. Anchor side selection 與 tie-break 的 pseudo-code。
3. Obstacle rectangle、clearance、corner padding、lane spacing 建議值與理由。
4. Route scoring：distance、bend、obstacle、congestion、stability 的成本順序。
5. Fallback 規則：無零碰撞路徑時 UI 如何顯示／回報，不得穿越設備。
6. `topology-routing.ts`、`topology-layout.ts`、`page.tsx` 的責任拆分。
7. 是否保留 `linkEndpointOffset()`／`linkChannelOffset()`，或改為新的純函式 API。
8. 單元測試、幾何 property tests、browser visual cases 與 performance threshold。
9. 真正需要使用者決定的最少選項。

## Design Result

設計組於 2026-08-18 完成重檢，推薦採「Hybrid 目標架構、分階段落地」：

1. 第一階段先實作 nearest-side anchor 與零碰撞 orthogonal base route。
2. 完成 base route 後，僅針對實際 anchor overlap 或 shared corridor 配置 deterministic lane。
3. 保留 congestion-aware grid／visibility routing 擴充點，不在第一階段一次導入完整壅塞成本搜尋。
4. Offset 後必須重新驗證 obstacle collision；沒有安全路徑時回傳 `unresolved-no-path`，不得退回穿越設備的 fallback。
5. Anchor、route points、lane 與 diagnostics 全部維持 view-only derivation，不寫入 `Device`、`Link`、Dexie 或 PostgreSQL schema。

### Approved Contract for Later Development

- Wired link 永遠由水平／垂直 segment 組成。
- 每一端依對端中心獨立選最近邊，anchor 投影需保留 corner padding。
- 相等距離時先比較 Manhattan route；仍相同才依固定 side 順序決勝，確保 deterministic。
- Lane 序列採 `0, +1, -1, +2, -2...`，排序鍵不得依賴 array insertion order。
- 不同 side、不同 anchor 或只交叉而不共線時，不得套用 offset。
- `topology-routing.ts` 負責 anchor、route、lane 與 validation；`topology-layout.ts` 只負責設備排列；`page.tsx` 只做 route map 與 SVG/UI render。
- 60 devices／120 wired links 全量計算目標小於 120 ms；拖曳中可採局部重算或 50–80 ms debounce。

### User Decision

- 2026-08-18 使用者已確認：無線連線維持 dashed direct／soft curve，作為 wired orthogonal routing 的明確例外。

### Downstream Gate

- `DEV_UIX_002` 已交接開發組實作。
- `QA_UIX_001` 已建立，等待測試組驗收。

## Minimum Test Map

- [ ] 水平、垂直、四種對角方向皆產生 orthogonal path。
- [ ] Anchor 位於正確 side 且不落入 corner padding。
- [ ] 單一 link 沒有 offset。
- [ ] 多 link 分散到不同 side 時沒有不必要 offset。
- [ ] 同 side／同 anchor 重疊時產生穩定對稱 lane。
- [ ] 共用 corridor 的平行 links 不完全重疊。
- [ ] 單純交叉但不共線時不套用 lane offset。
- [ ] 所有非端點設備 padded rect 都不被 route segment 穿越。
- [ ] Endpoint 僅在 anchor 觸碰，route 不穿過 endpoint interior。
- [ ] 拖曳設備後 side／route 重算穩定，不因 link array 順序跳動。
- [ ] collapsed group、quantity node、spine-leaf 與不規則拓樸不退步。
- [ ] 60 台設備情境有明確 performance budget。

## Handoff Rule

設計完成後只能改為 `WAITING_APPROVAL`，並停下等待使用者確認。不得自行建立／啟動 `DEV_UIX_002`，不得修改產品程式。
