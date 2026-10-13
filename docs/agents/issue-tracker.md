# Issue tracker — 既有 Markdown 票據

本專案以 `docs/engineerticket` 管理工作。這是 Matt Pocock engineering skills 的自訂 Markdown adapter，不採種子模板的 `.scratch` 結構，也不建立平行的 GitHub Issues。GitHub remote 的存在不改變本決議。

## 位置與權威來源

以下路徑均相對於該票指定 worktree 的根目錄。

| 內容 | 位置／用途 |
|---|---|
| 個別票面 | `docs/engineerticket/active/<TICKET_ID>.md`；需求、scope、owner、依賴及當前執行結果 |
| 票據索引 | [TICKET-REGISTER.md](../engineerticket/TICKET-REGISTER.md)；單號、排序及摘要，不代替詳細票面 |
| 工作位置 | [BRANCH-MAP.md](../engineerticket/BRANCH-MAP.md)；定位 worktree／branch，不以歷史摘要判定當前 PASS |
| 共用流程 | root [DEVOPS-AGILE-WORKFLOW.md](../engineerticket/contracts/DEVOPS-AGILE-WORKFLOW.md)；R3 分工、工作包授權與停止點；其他 worktree 只引用此版本 |
| 設計契約 | `docs/engineerticket/contracts/` 及票面引用的設計文件 |
| 計畫與成果 | `docs/開發計畫/`、`docs/dev開發紀錄/`、`docs/dev測試紀錄/`；按主題檢索並引用，不複製整段歷史 |

## 單號與必要欄位

- 沿用 `組別_特徵碼_執行序`，例如 `DEV_UIX_007`；新增前查 register 與票檔避免重號，不重新編號舊票。
- 分支歷史出現同號不同工作時以 `Ticket@branch + worktree` 區分，例如共用流程 `PM_GOV_005@dustool`；不得覆寫 checkpoint 的同號資產治理票。
- 每票沿用既有版型，記錄目標、核准來源、scope／allowed paths、primary owner、QA、依賴、排序及驗收條件。
- Development Branch、Worktree、Base Commit、Integration Target 必須具名；開始時另外核實實際 branch／HEAD／dirty candidate。
- 產品／測試授權、Git／發布／live 授權與票面狀態分開記錄。這份 adapter 不啟動未核准工作。

## 技能操作對照

| 技能要求 | 本專案操作 |
|---|---|
| Fetch relevant ticket | 先按分支索引定位，再讀對應 `<TICKET_ID>.md`、相關契約與結果 |
| Publish spec／tickets | 在使用者已授權範圍內沿用既有票；只有確需新工作才建立新票與 register 索引，spec 放既有計畫／契約位置並互相引用 |
| Comment／answer | 在原票追加具日期的結果或退修段落，引用日誌；不覆寫首輪失敗 |
| Claim | 先核授權、依賴及是否有 active QA／產品 writer；由責任 owner 將自己的票改 `IN_PROGRESS`，不新增 `claimed` 狀態 |
| Resolve／close | 依該票成功條件記錄階段結果、下一 owner 與正式狀態；不得因技能說 resolved 就跳過 QA、checkpoint 或使用者核准 |

## 狀態與直接退修

沿 R3 使用 `READY → IN_PROGRESS → READY_FOR_QA → IN_QA → QA_PASSED`。產品驗收失敗記 `QA_FAILED`；依原票修復、重驗並保留歷史。缺必要條件記 `BLOCKED` 及 owner；未執行案例記 `NOT RUN`。既有 `DEFERRED`／等待核准項不因安裝技能自動啟動。

QA 完成本批及 owned cleanup，具名記 `QA release for repair`、缺陷、最小 scope、回歸與 next DEV。DEV 確認無 active QA 後，在既有授權內直接同票修復；完成交新候選，QA 先重驗 blocker 再跑受影響矩陣。一般修復不重新轉 DSG；新語意或越界才升級。

PM／決議共享文件由 PM 主責；各組更新自己的票與 register 對應列。索引和票面不一致時核對工作位置與最新有效證據，提出差異，不把其中一份歷史摘要默認為完成。

## 相依地圖與排程操作

- Map：沿用相關開發計畫／架構地圖與 register，引用子票；如確需新增地圖，先在既有計畫範圍確認，不新建第二套票庫。
- Child：一張既有格式票對應一個具名工作，列 parent／dependency 與工作位置；不把所有子票合成單一大文件。
- Blocking：按票內具體 gate 判定，例如 `QA_PASSED`、使用者核准或已提交整合；不能只看依賴票是否「關閉」。
- Frontier：在已授權票內先排除未滿足 gate、暫緩及 active writer 衝突，再按 register 排序／優先序選工作；有衝突交 PM，不由技能自行越級開工。
- Resolve：記錄答案／證據及正式 phase 結果，回鏈地圖；研究決策完成不代表相依產品已實作或發布。

## Triage

`triage` 已安裝，但本專案尚未設定其分類映射；不產生第二套票庫／`triage-labels.md`，不把既有工程狀態換成另一套 label。啟用前先確認分類與執行狀態的映射。
