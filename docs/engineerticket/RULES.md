# Engineer Ticket 治理規則

## 0. 開工前 Requirement Traceability Gate

所有組別在建立設計、啟動開發、編寫驗收或部署前，必須先讀取：

1. `REQUIREMENT-BASELINE.md`。
2. `DECISION-LOG.md`。
3. `ARCHITECTURE-MAP.md` 與 `DESIGN-DEVELOPMENT-MAP.md`。
4. 目標 Ticket 與其 Dependencies／Related Tickets。
5. Ticket 所列的歷史開發計畫、handoff、開發與測試紀錄。

每張 Ticket 必須填寫 User Intent、Historical Sources、Approved Decisions、Change Type、Affected Layers、Preserved Invariants、Conflict Check 與 Regression Map。未完成者不得進入 `READY` 或 `IN_PROGRESS`。

變更分類只有三種：

- `EXTEND`：延伸既有能力，不改已批准語意。
- `CORRECT`：修正目前實作對已批准決策的偏離。
- `SUPERSEDE`：改變既有產品語意，必須先由 PM 建立並批准新 Decision ID。

禁止把目前程式行為、最近一則聊天、設計推薦或候選實作單獨當成需求來源。權威順序與完整閘門見 `REQUIREMENT-BASELINE.md`。

## 1. 編號規則

格式固定為：

```text
<GROUP>_<FEATURE>_<SEQ>
```

### 組別碼

| 代碼 | 組別 | 可以決定／修改的範圍 |
|---|---|---|
| `PM` | PM／產品決策 | 產品目標、優先級、範圍、批准、freeze |
| `DSG` | 設計組 | 契約、架構、資料欄位、流程、UX、測試地圖；不得直接實作 |
| `DEV` | 開發組 | 已批准範圍內的產品程式與工程文件 |
| `QA` | 測試組 | 測試、fixture、測試紀錄與獨立驗收；不得修改產品程式 |
| `OPS` | 部署／維運 | DB、環境、部署、備份、監控與 runbook |

### 特徵碼

| 代碼 | 範圍 | 代碼 | 範圍 |
|---|---|---|---|
| `GOV` | 治理／專案規則 | `ARC` | 架構／模組邊界 |
| `DOM` | Domain／State／Persistence | `UIX` | Canvas／UI／UX |
| `IMP` | Import／Parser／Missing Info | `EXP` | Export／CSV／ZIP |
| `SEC` | Credential／Secret／OWASP | `AUTH` | Login／Session／Identity |
| `RBAC` | 角色與資源授權 | `API` | API contract／error/order |
| `DBM` | Database／Migration | `PIL` | Internal Pilot |
| `REL` | Freeze／Checkpoint／Release | `OIDC` | Entra／Keycloak／OIDC |
| `DOC` | 文件輸入／報表 | `OBS` | Audit／Logging／Health |
| `DEP` | 部署／備份／網路 |  |  |

### 執行序

- 固定三位數，從 `001` 開始。
- 以同一組別＋同一特徵碼獨立遞增。
- 不得因排序、取消或搬移階段而重編。
- 跨特徵工作選擇主要交付物作為 primary feature，其餘放在 Related Tickets。

## 2. 狀態規則

```text
PROPOSED
→ WAITING_APPROVAL
→ READY
→ IN_PROGRESS
→ READY_FOR_QA
→ QA_PASSED
→ DONE
```

例外狀態：

| 狀態 | 語意 |
|---|---|
| `BLOCKED` | 外部環境或已批准依賴未完成，無法繼續 |
| `QA_BLOCKED` | QA 已確認產品或環境阻擋，不能放行 |
| `DEFERRED` | 已知工作，明確延後且不得實作 |
| `CANCELLED` | 工作取消，ID 永久保留 |

### 狀態權限

- 任一組可以建立 `PROPOSED`。
- 設計完成只能進入 `WAITING_APPROVAL`，不能自行進入 `READY`。
- 只有使用者／PM 明確批准後才能進入 `READY`。
- 開發組只能將 `READY` 改為 `IN_PROGRESS` 或 `READY_FOR_QA`。
- 測試組只能將 `READY_FOR_QA` 改為 `QA_PASSED`、`QA_BLOCKED` 或 `BLOCKED`。
- `DONE` 代表已通過驗收且已存在於乾淨 checkpoint，不等於「程式寫完」。
- `PM_GOV_*` 在使用者核准並進入 `READY` 後，其治理規則立即生效，可滿足票面明載的 `PM_GOV_* READY` 依賴；仍須等乾淨 checkpoint 才能標記 `DONE`。

## 3. 優先級與排序

| 優先級 | 定義 |
|---|---|
| `P0` | 安全、資料損失、部署阻擋、checkpoint 阻擋 |
| `P1` | Pilot 必要功能或驗收 |
| `P2` | Pilot 後強化 |
| `P3` | 長期 backlog／研究 |

全組共同排序規則：

1. `P0` 優先於 `P1`、`P2`、`P3`。
2. 同優先級依 `Planned Order` 由小到大。
3. 依賴未完成時不得跳過並實作下游工單。
4. 同 order 才以 Ticket ID 字典序排列。

## 4. 批准與範圍控制

- 「建議」、「推薦」、「可考慮」都不是批准。
- 只有使用者明確表示「同意」、「開始」、「交開發組實作」才視為批准。
- 設計組不得把推薦值寫成「使用者已確認」。
- 開發組不得從聊天摘要推定產品語意；必須核對 Ticket 與 Decision Log。
- 工單進入 `IN_PROGRESS` 後發現產品語意不明，必須回到 `WAITING_APPROVAL` 或設為 `BLOCKED`。
- 不得順手加入與工單無關的 refactor、dependency、schema 或 UI。
- 若新需求影響兩個以上基礎層，設計票必須先完成 impact matrix，再拆成可獨立驗證的 checkpoint。
- 同一問題連續兩次返回設計時，PM 必須先做 root-cause review，不得直接開始第三輪局部修改。

## 4A. Definition of Ready

Ticket 進入 `READY` 前必須具備：

- Requirement Traceability Matrix 完整。
- 所有引用 Decision 均為 `APPROVED`。
- Domain／API／DB／CSV／UI 的受影響契約已明確。
- Security、Credential、Migration、Runtime Profile 等底層 invariant 已列入驗收。
- 既有 regression map 與對應 QA Ticket 已指定。
- 高衝突檔案的 Primary Ticket 與修改邊界已確定。
- 核心產品語意沒有未決問題；一般工程細節不得再回拋使用者。

## 5. 各組工作邊界

### PM

- 維護產品目標、Decision Log、Ticket priority 與 checkpoint 範圍。
- 決定 `WAITING_APPROVAL → READY` 與 `QA_PASSED → DONE`。

### 設計組

- 輸出 contract、diagram、field map、error contract、test map。
- 不修改產品程式、migration、package、env 或產品測試。
- 完成後停在 `WAITING_APPROVAL`。

### 開發組

- 只能修改 Ticket `Allowed Scope` 內的檔案與必要相依。
- 保留其他組既有工作，不 reset、不覆蓋。
- 遇到共用檔案使用 patch/hunk 級修改與 staging。
- 功能與對應 unit tests 同一工單完成。

### 測試組

- 可以新增或調整測試、fixture、測試紀錄。
- 不修改正式產品程式來讓測試通過。
- 環境無法驗證必須標示 `BLOCKED`，不能以 source scan 取代 real DB 或 browser E2E。
- 至少回報 pass、fail、skip、重現方式與證據。

### OPS

- DB 啟停、migration、backup、restore、reverse proxy、HTTPS、network ACL 必須有 OPS Ticket。
- 不以 Runtime credential 執行 migration。
- 破壞性 DB 操作必須先確認精確目標與可回復點。

## 6. Handoff 格式

每次跨組交接標題固定：

```text
[TICKET_ID][STATUS] 來源組 → 目標組｜短標題｜YYYY-MM-DD
```

交接內文至少包含：

- Ticket ID、目前狀態、優先級、Planned Order。
- 已批准決策與 Decision Log 參考。
- In Scope／Out of Scope。
- 修改或預計修改檔案。
- 已執行測試與結果。
- 未解決風險、依賴與停止條件。
- 目標組完成後應轉移到的狀態。

## 7. Branch／Commit／文件規則

- D33：所有新票與後續重新啟動／交接的舊票必填 Development Branch、Worktree、Base Commit、Integration Target；開始前驗 git branch --show-current、git rev-parse HEAD、git status --short。
- AIL 使用使用者核准的共用功能分支 `codex/ai-layout-poc`，為下列預設命名的明確例外；各票仍保留獨立 ID。工作線位置見 [BRANCH-MAP.md](BRANCH-MAP.md)。
- 跨 worktree QA／dirty 內容不自動屬於新分支；需要明確的 committed integration 與回歸。分支建立不等於 commit/push/merge/deploy 授權。

- Branch：`codex/<ticket-id-lowercase>-<short-name>`。
- Commit：`[TICKET_ID] type(scope): summary`。
- 一個 commit 原則上只有一個 primary Ticket。
- 測試與功能同行；驗收報告可使用對應 QA Ticket。
- 每份開發／測試紀錄首頁必須標示 Ticket ID。
- 共用檔案如 `app/page.tsx`、`app/lib/topology-store.ts`、`db/topology-postgres.ts`、`package.json` 必須使用 patch staging，不能整檔混入多張票。

## 8. Definition of Done

工單至少符合：

- Acceptance Criteria 全部有證據。
- TypeScript 通過。
- 相關 unit／integration tests 通過。
- 全測試 0 fail；skip 有原因且不掩蓋本工單核心能力。
- `build:local` 通過。
- Lint 通過或有可重現的工具環境 Ticket。
- DB 工單有真實 PostgreSQL 證據。
- UI 工單有 browser critical flow 證據。
- Security 工單完成 secret scan 與安全錯誤檢查。
- 開發／測試文件與 Register 狀態同步。

## 9. 禁止事項

- 無 Ticket 開發。
- `WAITING_APPROVAL`、`DEFERRED` 或 `BLOCKED` 狀態下實作。
- 以內網取代 authentication／authorization。
- 將 credential 加回 Device、Project、Zustand、Dexie、DOM、Audit 或 export。
- Runtime 讀 migration SQL、執行 DDL、auto migrate 或 auto seed。
- 修改已發布 migration。
- 測試組修改產品程式。
- 尚未 QA pass 就 checkpoint、部署或宣告完成。
