# DSG_ARC_001 — 專案架構分層與 Ticket Map

| 欄位 | 值 |
|---|---|
| Group | DSG |
| Feature | ARC |
| Priority | P0 |
| Status | READY |
| Planned Order | 003 |
| Checkpoint | Governance |
| Dependencies | PM_GOV_001 READY, PM_GOV_002 READY |
| Created | 2026-08-17 |
| Approved／Updated | 2026-08-19 |

## Objective

將 NetTopo Studio 的產品邊界、架構分層、資料流、不可跨越規則、Ticket ownership 與 release dependency 固定為所有組別的共同地圖。

## Approval Record

- 2026-08-19：使用者明確指示「DSG_ARC_001 推進確認」。
- `PM_GOV_001-D13`：核准 `ARCHITECTURE-MAP.md` 與 `DESIGN-DEVELOPMENT-MAP.md` 作為跨組架構依據。
- 本次核准不自動授權任何下游 `DEV_*`、`QA_*` 或 `OPS_*` 工單。

## Requirement Traceability

| 欄位 | 內容 |
|---|---|
| User Intent | 固定專案大方向與底層規則，避免不同組別依局部需求反覆改動基礎架構 |
| Historical Sources | 原始開發計畫、內網 Pilot 計畫、CSV Bundle、Development Gate、Migration Boundary、RBAC 收尾與 UI Routing 紀錄；索引見 `REQUIREMENT-BASELINE.md` |
| Change Type | `EXTEND`：把已批准決策正式映射成架構與工單責任，不改產品語意 |
| Affected Layers | Governance、Domain、State、UI、API、Security、DB、Import/Export、Deploy、QA、Release |
| Preserved Invariants | Credential 隔離、Migration/Runtime 分離、auth-first、safe export、preview-before-write、view/domain 分離、QA 獨立驗收 |
| Conflict Check | 已修正舊依賴圖方向；舊計畫中 dev identity header／static mode「零資安疑慮」等描述以最新 Approved Decision 為準 |
| Regression Map | 各 Layer 的 QA Ticket、真實 PostgreSQL integration、browser critical flow、round-trip 與 secret scan |
| Rollback／No-path | 架構語意衝突時停止下游票並回到 PM Decision；不得由程式現況自行選邊 |

## Approved Architecture Boundary

- NetTopo Studio 與 netNNassist 保持產品分離。
- Domain／State／View／Persistence 不可互相越權。
- Credential、Identity、RBAC、Migration 與 Runtime 保持獨立安全邊界。
- Import 先 Preview；Export 以 safe bundle 為預設。
- QA 不能修改產品程式；Release 必須等待完整 gate。
- 高衝突檔案必須依 Primary Ticket 做 hunk ownership。

## Acceptance Criteria

- [x] 產品與 netNNassist 邊界明確。
- [x] Domain、State、UI、API、Security、DB、Migration、QA、Release 分層完成。
- [x] 每一層都有 Primary Tickets 與禁止事項。
- [x] Runtime Profile 與 checkpoint dependency 已映射。
- [x] 依賴圖方向與 Ticket Register 一致。
- [x] Requirement Traceability Gate 已成為所有模組的前置條件。
- [ ] 治理文件進入乾淨 checkpoint 後才改為 `DONE`。

