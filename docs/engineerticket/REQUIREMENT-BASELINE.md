# NetTopo Studio Requirement Traceability Baseline

- 生效日期：2026-08-19
- Authority：`PM_GOV_001`、`PM_GOV_002`
- 適用組別：PM、DSG、DEV、QA、OPS
- 目的：在建立或啟動工單前，先回溯既有指令、決策、開發計畫與驗收紀錄，避免同一基礎反覆改寫。

## 1. 權威順序

發現描述不一致時，依下列順序判定；低順位資料不得覆蓋高順位資料：

1. 使用者最新明確指令，且已由 PM 寫入 `DECISION-LOG.md` 的 `APPROVED` Decision。
2. `PM_GOV_001` 核准的產品憲章與本文件的不可破壞基線。
3. 狀態為 `READY`／`IN_PROGRESS` 的 Active Ticket 內 Approved Decisions、In Scope、Out of Scope。
4. `ARCHITECTURE-MAP.md` 與 `DESIGN-DEVELOPMENT-MAP.md` 的分層、依賴與責任邊界。
5. 歷次開發計畫、handoff、開發紀錄與測試紀錄，作為需求來源與回歸證據。
6. 目前程式行為與未提交工作樹，只能作為現況證據，不能反向定義產品規格。

聊天中的新指令若尚未轉成 Decision ID／Ticket，不得由其他組自行推定完整產品語意。PM 必須先完成落盤。

## 2. 已核准產品基線

### 2.1 產品與交付策略

- NetTopo Studio 專注網路拓樸建模、文件轉換、Missing Info、安全資料交換與內部協作。
- 漏洞偵測、Wazuh／SIEM、即時監控與防禦 Agent 屬於 `netNNassist`，不得混入本專案。
- 先走輕量、快速的 Internal Pilot，以 synthetic data 驗證工程師工作流；正式 OIDC／完整跨站 RBAC 延後。
- 新增能力依「資料與契約 → 安全與權限 → view／UX → 真實整合驗收 → checkpoint／部署」順序發展。

### 2.2 Domain、State 與 Persistence

- `Project` 的核心只包含 Device、Link、Group 與必要拓樸 metadata。
- Credential 不得進入 Project、React state、Zustand、Dexie、DOM、Audit 或一般 export。
- React Flow 是 controlled view；Domain 與 React Flow node／edge 在 view boundary 映射。
- Component 不直接寫 Dexie；持久化由 Zustand action／repository write boundary 管理。

### 2.3 Import／Export

- TXT／MD／CSV 匯入先解析成 draft，經 Zod 驗證與 Preview，使用者確認後才寫入畫布。
- Preview 必須顯示設備數、連線數、遮蔽結果與 Missing Info Checklist。
- CSV Bundle 固定為 `devices.csv`、`links.csv`、`groups.csv`、`credentials.masked.csv`、`missing-info.csv`。
- Safe export 是預設；Pilot full export 預設禁用；不得輸出 plaintext secret。
- Round-trip 必須以自動化證明，而不是依 UI 觀察推定。

### 2.4 Identity、Credential 與 RBAC

- Demo account、Demo seed、development identity header 必須受 development gate 控制，Pilot／production fail closed。
- Internal Pilot 採 Temporary Pilot Session；OIDC 待 Pilot 回饋或 Entra 條件成熟後啟動。
- Pilot Engineer 可建立 synthetic Customer；此例外不得擴張成正式 Customer mutation 權限。
- Customer 是公司共享主檔；正式 rename／delete／duplicate 仍需集中權限控制。
- 停用帳號、跨站越權與未知 Customer 必須 fail closed，且不得透過錯誤訊息枚舉資源。

### 2.5 Database 與 Runtime

- Migration CLI 是唯一可讀 `db/migrations/*.sql` 並執行 DDL 的元件。
- Application Runtime 只做 schema read-only verification 與業務 DML；不得 migrate、DDL、auto seed 或讀 SQL。
- Demo seed 是獨立 development tool；已發布 migration 不可修改，只能新增下一張 migration。
- Runtime role 與 Migration role 分離；真實 PostgreSQL 權限必須由 integration test 驗證。

### 2.6 Canvas 與 Routing

- Wired link 使用 obstacle-safe orthogonal route，不得穿越非端點設備。
- Anchor 預設在朝向對端的最近設備邊；只有實際 anchor／corridor 重疊才配置 deterministic offset。
- Wireless 可使用 dashed direct／soft curve，作為 wired 規則的明確例外。
- Route、anchor、lane 是 view derivation，不寫入 durable Device／Link schema。

## 3. 歷史計畫與證據索引

下列資料必須在相關工單設計前檢索；它們是需求脈絡與回歸來源，不會自動高於最新 `APPROVED` Decision：

| 主題 | 歷史來源 | 必須保留的脈絡 |
|---|---|---|
| 原始產品路線 | `docs/dev開發紀錄/開發計畫/開發計畫.md` | 多拓樸、文件匯入、五檔 CSV、圖面交付採分階段發展 |
| 輕量內網 Pilot | `docs/dev開發紀錄/開發計畫/開發計畫0804.md` | 先快速試用與收集回饋，再逐步整合正式身分與部署 |
| CSV Bundle v2 | `docs/dev開發紀錄/2026-08-10-csv-bundle-v2-handoff.md`、`docs/dev測試紀錄/csv-bundle-v2-acceptance-2026-08-10.md` | Preview、五檔契約、round-trip、credential boundary 與曾出現的明文風險 |
| Development Gate | `docs/dev開發紀錄/2026-08-10-development-gate.md`、`docs/dev測試紀錄/development-gate-acceptance-2026-08-10.md` | Demo identity/header/seed 不得進入 Pilot／production |
| Migration Boundary | `docs/開發計畫/2026-08-13-migration-boundary-refactor.md`、`docs/dev開發紀錄/2026-08-13-migration-boundary-refactor.md`、`docs/dev測試紀錄/migration-boundary-rbac-acceptance-2026-08-13.md` | Migration 修改者與 Runtime 使用者分離 |
| Customer／Topology RBAC | `docs/開發計畫/2026-08-13-customer-topology-rbac-plan.md`、`docs/dev測試紀錄/rbac-p0-closeout-2026-08-13.md` | Customer 共享主檔、Topology site boundary、不可透過 duplicate/create 繞過 |
| UI Routing | `docs/engineerticket/active/DSG_UIX_002.md`、`DEV_UIX_002.md`、`QA_UIX_001.md` | 直角避障、最近邊 anchor、overlap-only lane 與 browser 驗收 |

### 已知歷史描述的權威校正

- 2026-08-04 內網計畫提到以 `x-nettopo-user-email` 作測試身分；此做法已被 Development Gate 與 Temporary Pilot Session 決策取代，Pilot／production 不得採用該 header。
- 2026-08-04 計畫將純前端 IndexedDB 描述為「零資安疑慮」；此說法不再有效。Local mode 仍必須遵守 credential、export、DOM 與 synthetic-data 邊界。
- 早期 Boss-only create Customer 規則在 Internal Pilot 有一個已批准例外：Pilot Engineer 可建立 synthetic Customer；此例外不適用正式環境。
- 早期 runtime bootstrap／`*.sql?raw` 路線已由 Migration Boundary 決策取代；Application Runtime 不得讀 migration SQL 或自動修改 schema。

## 4. Requirement Traceability Gate

任何 `DSG_*`、`DEV_*`、`QA_*`、`OPS_*` 票進入下一狀態前，都必須完成以下矩陣：

| 必填欄位 | 要回答的問題 |
|---|---|
| User Intent | 使用者真正要改善的工作結果是什麼？ |
| Historical Sources | 哪些開發計畫、handoff、測試紀錄曾處理相同問題？ |
| Approved Decisions | 引用了哪些 `APPROVED` Decision ID？ |
| Change Type | `EXTEND`、`CORRECT` 或 `SUPERSEDE`？ |
| Affected Layers | Domain、State、UI、API、Security、DB、Import/Export、Deploy、QA 哪些受影響？ |
| Preserved Invariants | 哪些底層規則與既有通過能力不得破壞？ |
| Conflict Check | 新需求是否與舊決策、schema、API 或測試衝突？ |
| Regression Map | 哪些既有測試與實際流程必須重驗？ |
| Rollback／No-path | 失敗時如何停下、回復或安全呈現？ |

判定規則：

- `EXTEND`：不改既有語意，延伸原 Ticket 或建立同 Feature 下一序號。
- `CORRECT`：現況違反已批准決策；建立 DEV／QA 修正票，不重做產品設計。
- `SUPERSEDE`：會改變已批准語意；PM 必須建立新 Decision ID，舊 Decision 標為 `SUPERSEDED`，未批准前不得開發。

## 5. 防止「粉刷牆式開發」的 Definition of Ready

工單不得只因畫面需求清楚就進入 `READY`。開始 coding 前必須同時具備：

1. 需求追溯矩陣完整，且沒有未處理的高順位衝突。
2. Domain／API／DB／CSV／UI 中受影響的契約已明確，不以 coding 過程猜語意。
3. 安全、migration、credential、runtime profile 等不可破壞邊界已列入 acceptance criteria。
4. 既有功能的 regression map 與測試責任已指定到 QA Ticket。
5. 高衝突檔案已有 Primary Ticket 與 hunk ownership。
6. 不確定事項被縮到真正需要使用者決定的最少選項；一般工程細節由設計／開發組自行收斂。
7. 若需求跨越兩個以上基礎層，先拆成可驗證 checkpoint，不把 schema、auth、UI、部署混在單一 commit。

任一條缺失，工單維持 `PROPOSED`／`WAITING_APPROVAL`／`BLOCKED`，不得先寫候選實作再倒推規格。

## 6. 變更與衝突處理

- 新指令補充細節但不改語意：更新原 Ticket 的 traceability 與 acceptance criteria。
- 新指令改變已批准語意：新增 Decision ID，明確標記被取代決策，不靜默改寫歷史。
- 程式現況與決策衝突：以決策為準，建立 `CORRECT` Ticket；不得把 bug 合理化成新規格。
- 歷史文件彼此衝突：保留文件，於本基線或 Decision Log 標明 authoritative／superseded 關係。
- 同一問題連續兩次返回設計：PM 必須做 root-cause review，判斷是需求缺口、契約缺口、測試缺口或跨層耦合，再允許第三次修改。
