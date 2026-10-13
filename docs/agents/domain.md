# Domain docs — NetTopo Studio

採 single-context；這是術語及決議的讀取設定，不是新增產品架構或要求先補一套文件。

## 探索前讀取

1. 依 [票據 adapter](issue-tracker.md) 定位該票 worktree、scope 與核准來源。
2. 在該工作樹的 `docs/開發計畫/`、`docs/engineerticket/contracts/` 與相關開發／測試日誌，以票號、功能及模組路徑檢索；讀相關內容，不全面搬入所有歷史。
3. 若根目錄已有 `GLOSSARY.md`，讀取相關術語；若已有 `docs/adr/`，讀涉及本次模組的 ADR。
4. 若日後存在 `GLOSSARY-MAP.md`，依其指向讀相關 context，不能自行假定所有分支或模組已變成 monorepo。

Glossary／ADR 尚未存在時直接繼續，不列為 blocker，也不為完成 setup 預先建立空文件。需要釐清術語或裁定架構時，再依核准工作範圍記錄。

## 使用既有詞彙

- 使用票面與已核准契約中的概念名稱、欄位及權限語意；不得為不同技能任意重命名。
- 分清 Project／Device／Link／Group 的資料模型、畫布視圖、持久化及 repository 邊界；具體契約以相關模組文件為準。
- 分清本機 IndexedDB 與 server PostgreSQL 模式；通用技能的儲存建議不能覆蓋本專案已核准的模式與安全邊界。
- 分清認證 API、人事名冊同步與直接查詢人事 DB；不得由「人事對接」名稱自行擴大 scope。
- 分清 DEV 自測／QA／Browser／真 DB／live，以及未提交候選／已提交樹／已部署成果。

## 決議衝突

以使用者有效核准、票據契約及相關已生效決議追溯方向；R2 管分工與流程，不取代產品或安全契約。新舊文件衝突時指出來源、時間、適用 scope 及是否已明確取代；未能確認時提出最小澄清，不悄悄選擇較寬鬆規則。

若提案與既有 ADR／決議相反，明確列出相反之處與重開理由，取得必要核准後再改；不重写失敗歷史或把模型推論當成使用者決策。
