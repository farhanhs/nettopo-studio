# DEV_NTM_003 — 差異預覽、核實與衝突批次套用

| 欄位 | 值 |
|---|---|
| Status / Planned Order | READY_FOR_QA（PLAN-R1 純 snapshot；writer stopped） / 163 |
| Primary Owner | 開發組 019fa64f-d5f1-7d61-bf93-47a9e7c293c7 |
| Development Branch | codex/dev-rel-001-checkpoint |
| Worktree | C:/Users/DUS/Desktop/project/nettopo-studio/.local/worktrees/dev-rel-001-checkpoint |
| Base Commit | a9abe637f0ad419aced6d31faf30a127ce5b81e6 |
| Integration Target | 同分支，未授權跨線整合 |
| Authority | 2026-10-10 使用者「下一票繼續推進」；root R3；PM接續紀錄 |
| Dependencies | CORE-R2 + GEN-R1未提交精確候選；DSG_NTM_001 §4 focused addendum／PM scope check |
| Design / QA | 既有DSG_NTM_001補§4；QA_NTM_003 |
| Stop | 必要獨立QA後PRE-COMMIT；無stage/commit/push/部署 |

## 成果與範圍

將NTM002介面候選轉成可審查差異；使用者可保留原值、排除或明確接受，已核實欄位遇差異不得默默覆寫。過期預覽必須重建，不部分套用。來源確認和人工核實分離。

本票對應既有契約 TRUSTED-NETWORK-TOPOLOGY-V1 §4 與 NTM-A06/A07/A10；不是整份契約待選項一併核准。UI、Zustand/Dexie/API/DB尚未接入V2，先確定最小可驗模組與後續接入依賴，不假裝pure apply已持久化。不得以此票順帶修改正式Auth/RBAC/CSV版本或safe actor portability。

## 本次立即開工：唯讀 preflight

1. 核對本工作樹branch/HEAD/dirty/index、CORE-R2／GEN-R1 manifest与無active正式QA／writer。Beta暫不切入。
2. 追蹤現有候選輸出與§4 change plan欄位落差，包括conflicts的穩定識別、父子參照、來源／trust映射、原值fingerprint與baseRevision。
3. 列最小module interface、實作路徑、依賴及驗收方式；prepare/resolve/apply共用檢查，避免額外pass-through層或第二套Project。
4. 判定第一批可否以純snapshot prepare/resolve/返回新Project完成，明確分開持久化transaction及身份adapter；不將傳入任意actor當已認證session。若尚無可信adapter，accept-and-verify fail closed，不能用local假Boss解鎖。
5. 對齊DSG focused addendum後交PM核對精確phase/allowed paths；不重開整份設計，不把一般細節再次升使用者。

目前只寫本票、`docs/dev開發紀錄/2026-10-10-dev-ntm-003-preflight.md` 與register本列；產品修改須待此次局部契約及精確路徑核對。不得動CORE-R2/GEN-R1或QA断言来配合設計。

## 固定驗收意圖（PLAN-01–08）

- PLAN-01：相同current/candidates產生穩定可追溯差異，prepare/取消零寫入、原輸入不變。
- PLAN-02：每一衝突明確決策；未知／重複／矛盾proposal決策、未解blocking或未ack warning拒絕，零部分結果／寫入。
- PLAN-03：baseRevision/current fingerprint/plan scope不符或plan內容被竄改時typed fail closed，不靠client canApply或hash本身當授權。
- PLAN-04：keep-current/exclude保持現值與既有trust；接受變更不能留下指向舊值的verified標記；受保護變更需具名明確決策。
- PLAN-05：新增/變更只有明確合法核實動作及可信actor才可verified；匯入、模板、格式成功、單純apply都不自動核實。缺actor／錯scope不得核實。
- PLAN-06：父子、endpoint、來源與trust相依重新驗證；排除後重算，不留下孤兒／alias碰撞；實作域之外的operation明確拒絕，不默默略過。
- PLAN-07：整批成功或整批拒絕；純snapshot證据與真儲存transaction證据分列，不拿mock/純函式當真DB。
- PLAN-08：秘密／raw來源／未知欄位與錯誤回顯安全；CORE-R2/GEN-R1相依不變或依影響重驗。既有失敗歷史保留。

## 禁止與交接

無Git、安裝、Browser/DB/Docker/live、現用env/DSN/秘密、跨分支或新套件授權。不啟NTM004/005，不擅定CSVv3／actor公開策略／規模UAT。新增持久化、可信身份接入或契約歧義只升受影響部分給PM/DSG。

產品phase核對後沿R3單一writer、自測→固定manifest停止寫入→獨立QA→普通同票修復，不逐缺陷詢問使用者。當前產品實作/正式驗收NOT RUN；next owner DSG補契約，DEV並行preflight、QA準備。

## DEV Preflight Start — 2026-10-10

已讀 root 接續紀錄、BRANCH-MAP、R3 及 codebase-design 指引；工作樹/branch/HEAD 如票面，index empty。GEN-R1 manifest 的2候選、6依賴、4回歸工具、CORE-R2 manifest，共13檔 raw hash MATCH。QA_NTM_002 票面記獨立7/7、本批73/73與產品鎖釋放；目前 QA_NTM_003 只準備語意向量、DSG 只補文件，沒有正式產品 QA run 或另一產品 writer。Beta 不切入。

本批 EXTEND preflight：來源為 GEN-R1/CORE-R2、§4、root 2026-10-10-pm-ntm-plan-start；Affected Layers 本輪僅文件。保留 immutable input、unverified 不自升、verified 保護、舊管線/資料/QA 斷言不動。Conflict Check 聚焦 snapshot vs DB transaction、fingerprint vs identity proof、GEN row vs field proposal；未核准語意由 DSG focused addendum + PM scope check 收斂。Regression Map 預計 PLAN-01–08 + CORE/GEN，尚未執行。Rollback/No-path 為不接持久化、缺可信 actor 拒絕核實、契約未固定不改產品。

## Preflight / Conditional Scope Review — 2026-10-10

[前置盤點](../../dev開發紀錄/2026-10-10-dev-ntm-003-preflight.md)已完成，列GEN→field proposals/presence/父參照/舊fingerprint與既有V1 write pipeline缺口；純snapshot不能宣稱真DB transaction。

DSG §4 R1已讀；PM [scope review](C:/Users/DUS/Desktop/project/nettopo-studio/docs/dev開發紀錄/2026-10-10-pm-ntm-plan-scope-review.md)條件核准最小兩檔PLAN-R1。等待R1.1 fixed owned handle/evidence closure、raw-string revision、presence非clear、stale verified/legacy port保護、severity/exclusion唯一規則。DEV逐項核對五項和PLAN-01–08並記hash後即可實作；未符合前不改產品。所有verify/protected修改因無actor adapter一律拒絕，不引進假Boss或synthetic authenticated adapter。

## PLAN-R1.1 Gate MATCH — 2026-10-10

已完整讀R1.1並核raw SHA-256：addendum `e612bc77309a64b7b12326a5e11e82b2197462dc42fa1cd4403d6dc141ab5255`；parent `0bb2145fb2b1844d576449e55c6f3e040ce9ae14175891c21716d963334dbf63` 不變。依PM條件核准轉產品IN_PROGRESS。

五項一致性MATCH：私有registry/handle/evidence（PLAN01/03/07）；raw revision（01/03）；無implicit clear與去重（02/06）；stale verified與legacy port（04/05）；severity與明確依賴決策（02/06）。safe receipt/error與CORE/GEN不動對應08。只新增具名module/test及自身文件；apply僅snapshot，無actor參數、protected/verify全拒絕，無持久化。自測後固定manifest停止writer，正式QA前不宣稱驗收通過，PRE-COMMIT停。

## PLAN-R1 Ready for QA — 2026-10-10

只新增私有instance planner與DEV測試；公開prepare/resolve/apply、32 entry上限、一次性handle、raw revision、explicit decisions、來源閉包、trust保護與legacy alias pairing。無durable寫入與actor成功路径。

- 產品 raw SHA-256：`e403bd8be3a448870158353e2fa0cbb30e90af59c79ed85fd385b2a73933d6fb`。
- DEV runner raw SHA-256：`fa50fea0600ddf90b4ee40bcb3f3354daf47333100f344107cf224ee2f1290f7`。
- 新測試31/31；serial CORE/GEN＋PLAN合計104/104，0 fail/skip。TypeScript與scoped ESLint PASS。
- tracked diff-check PASS；新檔no-index check只有CRLF提醒，exit 1為新檔差異，不是空白錯誤。
- CORE/GEN既有manifest13檔MATCH；原164觀測路徑中163不變，唯一既有變更為QA組自身preparation runner，與QA票R1.1紀錄hash一致，DEV未修改QA。
- [開發報告](../../dev開發紀錄/2026-10-10-dev-ntm-003-plan-r1.md)、[固定manifest](../../dev開發紀錄/checkpoints/dev-ntm-003-plan-r1/manifest.json)、verification/ownership同目錄。

產品writer已停止，候選不是HEAD；index空且無stage/commit/push。下一責任組QA_NTM_003需獨立鎖hash再驗PLAN01–08；目前獨立QA NOT RUN，跨對話送件已詢問使用者本票授權，未把工具送出／DEV自測算QA完成。authenticated verification／UI／Browser／persistence／DB／build／full suite未測，皆非此次具名pure scope。必要QA後PRE-COMMIT停，不啟NTM004或切Beta。

## Freeze / Handoff Confirmation — 2026-10-12

已讀 root AGENTS、R3、[HARNESS-AUTHORIZATION](C:/Users/DUS/Desktop/project/nettopo-studio/docs/engineerticket/contracts/HARNESS-AUTHORIZATION.md) 與 [PM實施紀錄](C:/Users/DUS/Desktop/project/nettopo-studio/docs/dev開發紀錄/2026-10-12-pm-harness-authorization.md)，並核PM對話中的使用者授權。10/10的送件授權待回覆是歷史狀態；本次已核准DEV↔QA同票交付／退修與回PM，不再逐輪等待一般派送批准。

工作樹仍為票面checkpoint，branch `codex/dev-rel-001-checkpoint`／HEAD `a9abe637f0ad419aced6d31faf30a127ce5b81e6`，既有dirty全部保留，index empty。DEV本次唯讀重核PLAN-R1 manifest `b75045ead054d01906adfdb3dbd77f32e78938afa0f8724ac30da718a3641585`，28 entries全部MATCH、0 mismatch；未改歷史manifest、產品、相依、lock或QA工具。此hash核對不是完整dependency closure審查或獨立QA結果，也沒有重跑自測。

PM已派QA_NTM_003，下一責任組為測試組 `019fac8e-94dc-79c1-b156-7f242cf82967`。DEV維持writer停止，等待QA自行鎖版、完成正式批次；派送不等於已開工或PASS。本票仍READY_FOR_QA，QA正式狀態由QA票管理。

既有契約缺陷只在QA完成batch及owned cleanup、明確release-for-repair後收回；DEV核無active QA，沿原票最小兩檔scope修復、自測、建立新manifest，直接交同一測試組重驗。新語意／越界／重大風險才升PM／DSG。OPS_ENV_001由具名OPS主責；若請求原helper ownership，僅核具名路徑，不自行改root工具或啟Auth。

本次只修改此票及register本列。必要QA後PRE-COMMIT停止；不stage、commit、push、merge、deploy，不切Beta或啟下一票。無服務／fixture資源建立，cleanup=none。

### PM Confirmation Delivery Blocked

本次回PM確認訊息被平台auto-review拒絕，未送達；平台判定尚缺DEV_NTM_003本次訊息的明確使用者授權，未接受專案補充規則及PM對話一般授權作為足夠證明。已向使用者具名詢問，只待該傳送授權；不改工具／間接繞過、不重試外送。此阻擋僅回報通道，PM原已派QA及候選freeze不變，不把它記為QA_FAILED或產品BLOCKED。
