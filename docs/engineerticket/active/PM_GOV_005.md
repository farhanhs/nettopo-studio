# PM_GOV_005 — DevOps／敏捷分工與流程過渡

## 2026-10-13 checkpoint 存檔核准

使用者已核准 [本次 commit／push](../../dev開發紀錄/2026-10-13-pm-approved-checkpoint-push.md)。NTM、Native B1、共用治理分開提交，不將整票BLOCKED或未驗功能改為完成；本票仍IN_PROGRESS。共用治理由PM在OPS釋放root Git writer後精確存檔，保留其餘dirty變更。

## 生效更新 — Harness 有界授權（2026-10-12）

- 使用者核准補強授權／分工及必要環境調整；本票維持 IN_PROGRESS。唯一新規則來源：[R3 補充](../contracts/HARNESS-AUTHORIZATION.md)。不新增平行治理票。
- PM 維護入口、scope 與核收；OPS_ENV_001 交專責環境組；QA_ENV_001 獨立驗工具。DEV_NTM_003 交 QA_NTM_003 正式驗收，不等待 DB／Docker。
- 詳見 [實施與派送紀錄](../../dev開發紀錄/2026-10-12-pm-harness-authorization.md)。本次不改產品、獨立 QA assertions、現用 env／DB；無 Git 寫入或發布。
- 歷史「PM 暫代 OPS」交接後終止工具 writer 責任；歷史工作包及失敗保持可追溯，不把本次工具檢查當作全部 phase 通過。

## 生效更新 — D42／R3（2026-10-05）

- Identity：`PM_GOV_005@dustool`／root；本票 IN_PROGRESS。checkpoint/AIL 的同號 Topology Asset／Dock／Medium 治理票不是本票，保留歷史、不整檔覆寫。
- 使用者已核准 [流程 R3](../contracts/DEVOPS-AGILE-WORKFLOW.md) 落盤及 [A-WP-20261005](../../開發計畫/2026-10-05-a-topology-work-package.md) 開工。A→C→B；工程 checkpoint 與 UAT/live/release 分開；A 的小批次 commit 在獨立 QA 後依 R3 執行，不授權 push／整合／部署。
- Allowed：共用規則、AGENTS 入口、決議、模板、分支索引、A 票／工作包／PM 日誌及既有開發組／測試組派送。PM 不改產品、QA assertions、env 或 DB。
- [x] 決議與具名授權落盤，舊 D38/D39/D41 記錄保留。
- [x] 工作包明列 UIX_007 修復、獨立重驗、實用流程、自動成果與人工 release 邊界。
- [x] DEV／QA 實際收件與開始：2026-10-05 快照確認開發組已改 DEV_UIX_007 為 IN_PROGRESS 並執行窄範圍修復；測試組開始 QA_PIL_006 工具／隔離 fixture 準備。見 PM 日誌，正式 QA 尚待新候選。
- [ ] A 完成後回顧回合數／等待與成果；不是規則落盤就 DONE。

下文「目前」及當時 Git 限制均為 D42 前歷史；未衝突的安全與契約繼續有效。

## 2026-09-21 QA效率回顧

[PM評估與工具優先序](../../dev開發紀錄/2026-09-21-pm-qa-efficiency-review.md)：流程妥善、效率需調整；先完成QA_ENV_001 B2與QA_AUTH_003/QA_AUTH_001剩餘必要acceptance。沿用Docker PG＋native hybrid及impact-based證據引用。統一runner/summary/Browser evidence列收尾後首批工具候選，Testcontainers/CI後置；本次不啟新工具平台或新增套件，不降低驗收。QA需先補齊B2已執行結果的逐case證據，不能由DEV smoke或聊天phase摘要代簽整票。治理票仍IN_PROGRESS。

## 目前生效更新 — D41（2026-09-20）

使用者核准草案第二部分與 QA 閉環建議，全專案 [流程 R2](../contracts/DEVOPS-AGILE-WORKFLOW.md) 即日起生效。Change=SUPERSEDE（流程）；取代 D38/D39 與下文歷史「全專案待批／Auth 全完才切換／PM 逐輪解凍」的要求，不換產品 acceptance。沿用本票 IN_PROGRESS：規則生效不等於 checkpoint DONE，待首個轉入工作包回顧。

- Branch/worktree/base：dustool／C:/Users/DUS/Desktop/project/nettopo-studio／72783636a8b22f353e8c25fe68b859ad62e3c237。
- Allowed：RULES、DECISION、流程 R2、草案/R1 取代註記、模板、Register/地圖入口、本票、Auth 三票流程註記、PM 日誌及既有組別協調。
- Preserved：產品與安全契約、独立 QA、失敗歷史、測試期間候選固定、唯一產品 writer、所有外部及 Git 權限；不修改產品/QA assertions/env/DB/全域技能，不自動批准延後或發布。
- [x] 正式啟用五角色＋DEV↔QA 批次闭環，記錄 D41。
- [x] 同步規則／模板／索引，具名 Auth 轉入；一般 fail 不全停、QA 可隔離預跑、QA release-for-repair 取代 PM 逐輪解凍。
- [ ] 設計／開發／測試完成新規則收件；派送與回覆另記 PM 日誌，不把送出當啟動。
- [ ] 首個工作包結束回顧回合數、產品／工具／環境失敗、PM 等待與實際成果。
- 小批次 Git 存檔新政策、CI 平台與全域技能仍不在本次範圍；不以它們未完成阻擋本流程生效。

下列 D38/D39 內容及原 acceptance 保留歷史，切換時點與文件 allowed scope 以本節／D41 為準。

## 目前生效更新 — D39（2026-09-19）

使用者已要求 Auth 剩餘工作按新流程開始；[Auth 流程 R1](../contracts/DEVOPS-AGILE-AUTH-WORKFLOW.md) 現在限定生效，取代下方歷史「只準備／等 Auth 全完」時點。PM 已完成 [dusauth 一致性檢查](../../dev開發紀錄/2026-09-19-pm-dusauth-consistency-review.md)，按原票收斂契約偏差、QA 前移及 DEV 單一寫入線。全專案推廣、CI/工具、全域 skill 與小批次 Git 政策仍未授權，本票 IN_PROGRESS，不宣稱治理全面完成。

| 欄位 | 值 |
|---|---|
| Group / Feature | PM / GOV |
| Status | IN_PROGRESS |
| Priority / Planned Order | P2 / 140 |
| Owner | PM組；既有設計組、開發組、測試組協作 |
| Development Branch / Integration Target | dustool / dustool（無 Git 整合授權） |
| Worktree | C:/Users/DUS/Desktop/project/nettopo-studio |
| Base Commit | 72783636a8b22f353e8c25fe68b859ad62e3c237 |
| Created | 2026-09-19 |
| Decision | PM_GOV_001-D38 APPROVED：僅過渡準備與對話協調立即執行 |

## Requirement Traceability

- User Intent：按已討論草案調整專案對話、分工、工作原則，保留輕量快速及可查驗進度。
- Historical Sources：RULES §0–9、REQUIREMENT-BASELINE、D24–D29/D35–D37；QA_IMP_001、QA_REL_001、QA_AUTH_003 退件紀錄；使用者「先讓目前 Auth 修復與重驗完成」及本次「按這個草案進行專案的對話與工作修正」。
- Change Type：EXTEND（準備）；未來正式切換為有明確生效點的 SUPERSEDE。
- Affected Layers：治理文件、票據模板、跨組對話；不改產品/DB/測試標準。
- Preserved Invariants：独立 QA、失敗歷史、安全邊界、候選凍結、既有 Git/live 授權限制。
- Conflict Check：一般 PM_GOV READY 規則立即生效的慣例，本票由 D38 明確限制為準備生效；新版規則未啟用。
- Regression Map：核對 Auth 原票與契約不變；治理連結、唯一單號、狀態與交接一致性。
- Rollback：草案留存但不啟用；現行 RULES 繼續適用，不回退產品資料。

## Scope / Dependencies / Stop

現在：PM 建立條文差異、角色責任、交接模板與切換清單，向既有三組派送限定審閱。OPS 暫由 PM 維護準備清單，未建立或啟動新的 OPS 任務。各組唯讀審閱後回覆 PM，由 PM 單一維護文件，避免共寫。

正式生效依賴：PM 核收 QA_AUTH_003 全部適用 backend/UI/Browser 證據，以及 QA_AUTH_001 原 B2/相關矩陣收尾。非單獨 Phase B PASS；外部 fixture/效能問題須明確處置，不可當全測通過。Live QA_AUTH_002/公司環境另依授權，不以真人對接已完成作前提或宣稱。

Allowed：本票、contracts/DEVOPS-AGILE-TRANSITION-DRAFT.md、PM日誌、RULES/DECISION-LOG/Register 的過渡入口。不改現行 TICKET-TEMPLATE 主體，模板候選放草案。

Forbidden：產品、schema、package、CI/OPS script、測試 assertions、env、現用 DB、技能全域版本、Git、部署；不重命名／封存各組對話、不取消原票。

## Acceptance Criteria

- [x] 五組責任、條文差異、狀態與驗收模板草案落盤。
- [x] 現在／切換後／另需授權三種邊界明列。
- [x] 設計／開發／測試審閱回覆已記錄並收斂至 R1.1。
- [ ] Auth 完整範圍由 PM 核收，切換清單符合。
- [ ] PM 發布具版本/日期/適用新票的新規則；舊票不追溯換標準。
- [ ] 小批次 Git 政策若要啟用，取得明確獨立核准。

## Deliverable

[DevOps／敏捷過渡草案](../contracts/DEVOPS-AGILE-TRANSITION-DRAFT.md)。本票未 DONE；文件準備完成不等於規則已生效。
