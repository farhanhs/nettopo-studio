# NetTopo Studio Engineer Ticket

- 建立日期：2026-08-17
- 管理範圍：PM、設計、開發、測試、部署／維運
- 最高原則：**推薦不等於批准；沒有 `READY` 工單不得動工。**

本目錄是 NetTopo Studio 的跨組工作識別與排序入口。所有會改變產品語意、架構、程式、資料庫、測試、部署或正式文件的工作，都必須先有工單。

## 入口文件

- [RULES.md](RULES.md)：編號、狀態、審批、交接、測試及 commit 規則。
- [TICKET-REGISTER.md](TICKET-REGISTER.md)：唯一的全域工單總表與執行順序。
- [ARCHITECTURE-MAP.md](ARCHITECTURE-MAP.md)：專案架構分層與工單對應。
- [DESIGN-DEVELOPMENT-MAP.md](DESIGN-DEVELOPMENT-MAP.md)：前期設計工作與對應開發單號。
- [DECISION-LOG.md](DECISION-LOG.md)：已批准、延後及待確認的產品決策。
- [REQUIREMENT-BASELINE.md](REQUIREMENT-BASELINE.md)：歷史來源索引、產品底層基線、權威順序與開工前追溯閘門。
- [TICKET-TEMPLATE.md](TICKET-TEMPLATE.md)：新工單模板。
- [active/](active/)：目前 P0／P1 活躍工單的詳細紀錄。
- [CHANGELOG.md](CHANGELOG.md)：工單治理文件的變更紀錄。

## 工單格式

```text
組別_特徵碼_執行序
```

範例：

```text
DEV_DBM_001
QA_PIL_002
PM_REL_001
```

工單 ID 一旦建立不得重用、改名或重新編號。工作取消時保留原 ID，將狀態改為 `CANCELLED`。

## 模型接手工作的最短流程

1. 先讀本檔、[RULES.md](RULES.md) 與 [REQUIREMENT-BASELINE.md](REQUIREMENT-BASELINE.md)。
2. 讀 [DECISION-LOG.md](DECISION-LOG.md)，確認相關產品語意已 `APPROVED`。
3. 到 [TICKET-REGISTER.md](TICKET-REGISTER.md) 找到被指派的工單。
4. 確認工單狀態是 `READY` 或 `IN_PROGRESS`。
5. 完成 Ticket 的 Requirement Traceability／衝突／回歸檢查。
6. 讀取工單的依賴、允許範圍、禁止範圍與驗收條件。
7. 開始前將工單更新為 `IN_PROGRESS` 並記錄時間、執行組與基準 commit。
8. 完成後附上測試證據，再依角色送交下一狀態。

如果工單、正式決策與目前程式互相衝突，必須停止並回報 PM；不得自行以程式現況取代產品決策。
