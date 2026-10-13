# DSG_NTM_001 — 可信拓樸、介面與雙視圖資料契約

| 欄位 | 值 |
|---|---|
| Group / Feature / Priority | DSG / NTM / P1 |
| Status / Planned Order | WAITING_APPROVAL / 151（本設計交接鏈內排序） |
| Owner | 既有設計組／019fda8a-0b05-7a41-8fe0-b72f8c12ad9d／local |
| Development Branch | codex/dev-rel-001-checkpoint |
| Worktree | C:/Users/DUS/Desktop/project/nettopo-studio/.local/worktrees/dev-rel-001-checkpoint |
| Base Commit | a9abe637f0ad419aced6d31faf30a127ce5b81e6 |
| Integration Target | codex/dev-rel-001-checkpoint；未授權整合 |
| Governance / Checkpoint | root R3／PM_GOV_001-D43／WAITING_APPROVAL |
| Created / Updated | 2026-10-09 / 2026-10-10 |
| Engineering commit / push / deploy / live | none |

## Objective / Authority

把使用者已確認的新需求設計成可實作且不破壞既有交換、安全及資料的契約，完成後等使用者核准，不寫產品。

single-context 權威：[root 計畫](C:/Users/DUS/Desktop/project/nettopo-studio/docs/開發計畫/2026-10-09-trusted-network-topology-plan.md)、[root D43](C:/Users/DUS/Desktop/project/nettopo-studio/docs/engineerticket/DECISION-LOG.md)、[root R3](C:/Users/DUS/Desktop/project/nettopo-studio/docs/engineerticket/contracts/DEVOPS-AGILE-WORKFLOW.md)、[root glossary](C:/Users/DUS/Desktop/project/nettopo-studio/GLOSSARY.md)。不能用本工作樹歷史 R2 替代 R3。

Change EXTEND：目前 Device／Link／Group 不能完整表达獨立介面、可追溯推測及共用雙視圖。既有 DOM／IMP／EXP／UIX 契約是相容基礎，不視為已實作本票；未啟動的 DSG_UIX_003／DSG_MED_001 只做依賴／重複檢查，不擅自推進。

## 五項 In Scope 交付

1. **NTM-D01 共用資料**：設備、獨立介面、實體兩端參照、VLAN／子網／介面邏輯關係、區域／站點映射。欄位字典列型別、必填／空值、穩定 ID、所有權、別名、方向、關聯完整性及 API/state/storage 映射。多個 IP／VLAN、邏輯介面父關係及無資料時語意要明確。保留原 ID／quantity；不得把 quantity 複製成虛構多台或介面真值。
2. **NTM-D02 解析／生成／推測**：明列來源介面→可信型號模板→人工數量／編號；說明模板可信來源／版本、命名／別名、衝突與資料不足。允許推測接線、VLAN、主備，記錄可解釋理由／安全來源；不因看過連線推定總介面數，不虛构機率。首期無真 GPT/API。
3. **NTM-D03 核實／衝突**：來源與核實分開；設備儲存／匯入确认批次保存，不逐介面确认。新增／缺漏可補、已核實不被靜默覆寫；集中差異預覽、確認範圍與狀態轉換。明確匯入確認與人工核實的區別，不繞過 Missing Info blocking。
4. **NTM-D04 雙視圖／分層**：同資料實體／邏輯投影、區域→站點→設備／介面／VLAN、跨站追溯、折疊／標籤／僅核實模式、responsive 容器與清晰度策略。推測不能只靠顏色區分；畫布 anchor／路徑不當實體介面。不能擴張 RBAC site 可見性；現有無路徑與密集圖限制如實列出。
5. **NTM-D05 驗收／實作拆分**：設計 NTM-A01–10 的任務、樣本真值、門檻、相依、回歸及五項實作順序；列建議 DEV/QA 子票與 owner/allowed paths（提案，不建票派工）。合成回歸＋使用者提供匿名總部／兩分點實用測試。樣本未交及尺度未定需標示待確認，不承諾任意規模。

## 必備相容設計

- 明確版本/upcast 與舊 Project／DB／本地儲存／CSV／ZIP／JSON 路徑；未知 port 不得假造已核實介面，舊字串能保留回溯。說明回退或無法無損回退時的拒絕／備份設計。
- 保留五 canonical CSV、safe/full、v1、manifest、重名、sharing、大小閘門及安全 round-trip；新增欄位／版本如何保存來源／核實及關係須提出方案，不默默增加第六檔或宣稱有損交換100%還原。
- 不保存明文秘密或原始敏感組態作 provenance；masked credential 仍 preview-only，不授權進 Project／state／Dexie。
- 未核實推測不能驅動真健康／影響結論／設備操作；資料驗證不能因推測而降低。

## Allowed Files / Forbidden

只可寫本 worktree：本票、`docs/engineerticket/contracts/TRUSTED-NETWORK-TOPOLOGY-V1.md`、`docs/dev開發紀錄/2026-10-09-dsg-ntm-001.md`、本地 register 的本票行／入口。產品 app/db/tests/scripts/package 可只讀作參照；root 治理唯讀，dirty 內容不可搬移／覆蓋。

禁止產品／測試修改與執行、DB／env／secret／live、安裝、Docker、provider、stage／commit／push／checkout、新分支、跨分支整合、部署及對 DEV／QA 派工。工具成功不等於完成；不要自行宣稱真實場景 PASS。

## Acceptance / Stop

- [x] 五節交付、欄位／端點／來源／核實／相容／UI 投影及範例一致。
- [x] NTM-A01–10 都有預期結果／fixture／門檻／owner；缺匿名案例及待決策獨立標示。
- [x] 與現有 DOM／IMP／EXP／RBAC／secret／UIX 相依及差異可追溯，沒有擅自改安全契約。
- [x] 記錄參照 branch／HEAD／dirty；所有產品候選不改，原 QA 失敗／缺口保留。
- [x] 完成改 WAITING_APPROVAL，回傳摘要、文件與待選項後停止；使用者確認前不啟 DEV。

DEV 自測／獨立 QA／Browser／真 DB／live：NOT RUN（設計不是產品驗收）。next owner：完成設計後 PM 收件，使用者作最終確認。

## Handoff History

2026-10-09：PM 按 Q16 A 建立 READY 設計票，送達證據由 PM 日誌記錄；設計組開始才改 IN_PROGRESS，不能預寫完成。

2026-10-09：設計組核對 `codex/dev-rel-001-checkpoint`／`a9abe637f0ad419aced6d31faf30a127ce5b81e6` 與既有 dirty candidate 後開始；只寫本票核准的四類設計文件，產品與既有候選保持唯讀。

## Design Output — 2026-10-09

`DSG_NTM_001 = WAITING_APPROVAL`

Formal contract:

- [TRUSTED-NETWORK-TOPOLOGY-V1.md](../contracts/TRUSTED-NETWORK-TOPOLOGY-V1.md)
- [Design log](../../dev開發紀錄/2026-10-09-dsg-ntm-001.md)

### Recommendation

採 `ProjectV2 + TrustedNetworkModelV1` 單一可信資料：既有 Device／Link／Group 保留，新增 area、independent interface、structured VLAN/subnet relations、resiliency、safe evidence 與 field-level verification。實體／邏輯畫面都是同資料投影，route/anchor/dock 不進 durable schema。

Legacy Project/CSV v1/v2 走明確 upcast；只有顯式 legacy port 字串能建立 unverified provisional interface，缺 port 不造假。新資料交換推薦 CSV Bundle v3，仍固定五個檔名，使用 typed `recordType` rows；不得改寫 strict v2 header 或加入第六檔。無法無損 downcast 時拒絕並保留升級前備份。

來源與核實為兩條軸：parsed/template/inferred/human 只描述來源；只有明確選定範圍的人工動作能設為 verified。匯入確認、格式驗證、模板匹配或保存都不會自動核實。已核實值遇到差異必須進集中 conflict review，不能 last-wins。

### Pending user/PM decisions

1. 是否核准五檔 CSV Bundle v3 typed-row 方案。
2. 是否採首輪 60 devices／180 interfaces／120 links／12 VLANs／8 subnets 與契約中的任務時間門檻。
3. 提供匿名總部＋兩分點案例與 expected truth；在此之前 NTM-A09 與真實尺度驗收保持 BLOCKED／NOT RUN。
4. 是否確認第一階段跨區導航只存在於已授權可讀的單一 Project，不擴張跨 topology／RBAC site 存取。
5. safe export 的核實者資訊是否採非識別 marker；推薦 safe 隱去 actor ID、保留 verification state/time。

### Proposed downstream sequence — not dispatched

`DEV_NTM_001/QA_NTM_001` core → `002` source/inference → `003` conflict/verification → `004` dual views → `005` v3 exchange and handoff acceptance。這些名稱只是提案，未建票、未授權、未派工。

2026-10-09：五節契約、相容方案、NTM-A01–10 與待選項完成；票轉 WAITING_APPROVAL。未修改或驗證產品，未啟動 DEV/QA/Git/live。

## §4 Focused Addendum — 2026-10-10

使用者「下一票繼續推進」後，PM具名要求沿本票補§4，不重寫原契約。原契約raw SHA-256 `0bb2145fb2b1844d576449e55c6f3e040ce9ae14175891c21716d963334dbf63`保持不變。

- Addendum: [TRUSTED-NETWORK-TOPOLOGY-V1-SECTION4-ADDENDUM.md](../contracts/TRUSTED-NETWORK-TOPOLOGY-V1-SECTION4-ADDENDUM.md)
- Log: [2026-10-10-dsg-ntm-001-section4.md](../../dev開發紀錄/2026-10-10-dsg-ntm-001-section4.md)
- Focused status: `PM CONDITIONALLY APPROVED — R1.1 implementation gate`;整票其餘待選項仍`WAITING_APPROVAL`。

初版R1補充固定GEN→field proposals、prepare/resolve/apply深模組interface、owner/scope/fingerprint、tamper/stale、取消零副作用、protected決策、值變更trust失效、相依排除、actor來源/no-auth fail closed、typed errors及PLAN-01–08真值；當時仍待PM scope review。R1.1以下述紀錄取代其衝突細節。

2026-10-10 R1.1：依PM scope review補同instance opaque handle/private evidence registry、CORE raw-string revision、GEN欄位presence/no-clear、stale verified/legacy link保護及唯一issue/decision結果表。DEV記錄final hash並逐項核對五組要求後，可在具名兩產品路徑開始PLAN-R1.1，不需再等一般PM輪次；有矛盾只升該項。原parent contract不變，無Git或其他scope放行。
