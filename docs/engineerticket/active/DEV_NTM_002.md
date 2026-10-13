# DEV_NTM_002 — 介面候選產生（GEN-R1）

| 欄位 | 值 |
|---|---|
| Status / Planned Order | READY_FOR_QA（GEN-R1） / 161 |
| Primary Owner | 開發組 019fa64f-d5f1-7d61-bf93-47a9e7c293c7 |
| Development Branch | codex/dev-rel-001-checkpoint |
| Worktree | C:/Users/DUS/Desktop/project/nettopo-studio/.local/worktrees/dev-rel-001-checkpoint |
| Base Commit | a9abe637f0ad419aced6d31faf30a127ce5b81e6 |
| Integration Target | 同分支；無跨分支整合授權 |
| Authority | 2026-10-09 使用者「啟動後續開發」；root PM 接續紀錄；R3 |
| Contract | TRUSTED-NETWORK-TOPOLOGY-V1 §2.4、§2.8、§3.1–3.3；僅本 phase 核准 |
| Dependency | DEV_NTM_001 CORE-R2／QA_NTM_001 pure QA_PASSED，未提交候選另核 manifest |
| QA / Next Owner | QA_NTM_002；固定候選交 QA，必要驗收後 PRE-COMMIT |

## 使用者成果與本批邊界

為後續「建立設備時可選介面數量與編號」提供可驗證的候選產生引擎：安全結構化明列介面 → 精確可信模板 → 人工數量／編號。這批先完成純模組，不宣稱畫面已可使用。完整原始文字解析、VLAN/主備推測、保存／核實操作及 UI 另階段；不預先批准完整 DSG 契約待選項。

允許新增 `app/lib/trusted-network-interface-candidates.ts`（內含自身 input/output types）、`tests/dev-ntm-002*.test.mjs`、`tests/fixtures/dev-ntm-002/**`、自身票／日誌／manifest／register本列。讀取但不修改 CORE-R2 types/model、既有 Project/validator/store/transfer/UI/DB/API、package/lock 與 QA 斷言。不得搬進 Beta 樹。

## 必要行為／GEN-01–07

1. GEN-01：同一安全輸入產出穩定 IDs、順序及結果；原值不變、無副作用，候選符合 CORE-R2 介面引用／collision 規則。
2. GEN-02：明列來源優先；精確 vendor/model + 具名版本/fingerprint 的受信任模板才可補缺。未知／模糊匹配不冒充模板命中；模板由呼叫者明確提供受信任集合，本批只合成 fixture，無外部取得或實際廠商完整性承諾。
3. GEN-03：人工明確 quantity/start/pattern/prefix/suffix 產生可預覽列表；使用有限格式語法而非 eval／任意 regex。非整數、負數、溢位、過大輸入、有歧義格式均 typed 拒絕；實作前記錄具體有限資源上限，不將其宣称產品尺度。禁止使用 Device.quantity 或觀測連線數代替介面總數。
4. GEN-04：trim/NFC/case-fold 僅供名稱／alias 碰撞比對，保留安全原文；來源互相不同、與既有資料衝突、模板改名／刪除皆產出衝突，不 silent overwrite。既有 verified 值不變，不以優先序吞掉衝突。
5. GEN-05：新增候選皆 unverified，來源和核實分離；無來源的資訊保持缺失，不造真值。既有可讀資料不被重新核實或降級。
6. GEN-06：只收安全結構化輸入，拒絕未知欄位與 raw config/secret-bearing metadata，錯誤不回顯輸入；沿用 CORE-R2 安全 evidence 驗證，不宣稱已完成原始檔遮蔽器。
7. GEN-07：重複執行無重複候選、無跨設備誤配；所有失敗零輸入修改。回歸 CORE-R2 20 個 DEV cases及獨立核心適用案例，測前後依賴 hashes不變。

## 執行／交接

開工先核 branch/HEAD/dirty、CORE-R2 manifest 7檔及無 active QA/產品writer。DEV 記具體 API、有限編號語法與上限及正反例後實作；只有與已核准語意矛盾才升 DSG，不因一般實作細節再問使用者。使用本樹既有相依與 no-env 合成測試、tsc/scoped lint；不安裝、啟 Browser/DB/Docker/live、不讀現用env。

完成交固定 candidate/dependencies/工具 manifest、自測、差異、未驗與 cleanup，停止產品寫入並交 QA_NTM_002。一般缺陷 QA release-for-repair 後同票閉環。沒有 stage/commit/push/tag/Release/deploy 權限；舊 CORE-R2 PASS 僅屬原精確候選。

2026-10-09 PM 建票；正式實作及 QA 均 NOT RUN，送達不等於開工。Beta 工作不取消；同一 DEV 不交錯兩條產品 writer。

## DEV Start / API Contract — 2026-10-09

已核 branch/HEAD 如上、index empty、CORE-R2 manifest 七檔 raw hash MATCH。QA_NTM_001 已釋放產品鎖；QA_NTM_002 僅準備。Beta 樹只有文件/QA preparation，沒有產品修改，本輪只在 checkpoint 新增 GEN 模組。

Traceability：EXTEND；User Intent 為建立設備前的介面候選預覽。Historical Sources 為本票指定契約 §2.4/2.8/3.1–3.3、CORE-R2 manifest、QA_NTM_001 R1/R2。Approved Scope 為 root 2026-10-09-pm-ntm-gen-start / D44 接續；Affected Layers 僅純 domain 與 DEV 測試。Preserved Invariants：來源不等於核實、safe 原文不正規化寫回、無 side effect、既有 verified 不變、無 quantity/link-count 推定。Conflict Check：不承接原契約未核准項；Rollback/No-path 為 typed reject 或 blocking conflict，無 apply/write API。Regression Map 為 GEN-01–07、CORE DEV 20 cases 與既有 QA core；DEV 執行 QA core 只作補充回歸，不代獨立 GEN QA。

固定入口：`generateInterfaceCandidates(currentProject: unknown, input: unknown, trustedTemplates: unknown = []): Promise<InterfaceCandidatePlan>`。async 僅使用 Web Crypto SHA-256 產生 deterministic namespace IDs，無 I/O、env、clock、random、網路或持久化。

- `input` strict：`deviceId`、可選 `vendor/model`、`explicit[]`、`templateSelection`、`manual`。explicit 每份為 `{evidence, interfaces}`；evidence 必須 parsed + document/csv/json，沿 CORE-R2 驗證；不得提供 verified/actor。
- row strict：`name/kind` 必填，`aliases/parentName/mac/description/adminLabel` 可選；template row 僅 name/kind/aliases/parentName。parentName 只解析同設備的名稱或 alias。
- trustedTemplates 使用契約 InterfaceTemplate，版本/fingerprint/reviewedAt 必填，呼叫者提供已信任集合，非此引擎驗簽。vendor/model trim+NFC+en-US lowercase 精確比對；多個命中需 `templateSelection={templateId,version,fingerprint}`，不能自動選最新版。
- manual strict：`quantity/start/pattern/kind` 必填；prefix/suffix 可選。pattern 僅 `{n}`、`{n:02}`–`{n:06}`，prefix/suffix 不允許大括號。例 `{quantity:24,start:1,pattern:"{n}",prefix:"Gi1/0/",kind:"physical"}`；無 eval、自由 regex 或多 placeholder。
- 防資源耗盡上限（本 phase 實作限制，非產品尺度）：quantity 1–512；start/end 0–999999 且 safe integer；32 explicit sources、32 templates；每 source/template 512 rows，全部 registry rows 4096、被選來源總 rows 4096；每 row aliases 32、name/alias/parentName 256 UTF-16 units、prefix/suffix 各128、其他 safe text 2000。structured input/registry 最深12、100000節點、累計字串1 Mi UTF-16 units；拒絕非 plain JSON／循環／accessor／未知欄位。輸入過限整批 typed reject，無部分結果。
- output：`candidates[]`（可新增且無衝突的 interface + source + evidenceIds + unverified）、`evidence[]`（僅被結果引用）、`conflicts[]`（固定 code、未核實 proposals、existingInterfaceIds、protected），`missingInfo[]`（固定 code）。不回 Project 或 apply capability，不產生新 verified record。
- 優先序只補缺：同名同值去重並合併來源，explicit → template → manual 補尚未提供的欄位；任一共同欄位值不同產生衝突。trim/NFC/case-fold 僅比對，不覆寫原文。與現存資料相同不重建候選；不同一律 review（包括既有 unverified）。不同名 alias 碰撞、missing/cyclic parent 及 ID collision 皆不進 safe candidates；相依子項一併阻擋。
- 模板移除/改名：利用現有 fieldTrust→evidence.template 同 templateId 追溯；新版本未列現存名稱則 `TEMPLATE_REMOVED`，匹配 alias 但不同內容則 `TEMPLATE_CHANGED`。未知 provenance 不猜刪除。既有 interface/trust 完全不修改。
- `InterfaceCandidateError` 只含固定 code/message，CORE 驗證例外轉為安全錯誤，不轉送原 error/輸入 path/value。這是已遮蔽結構化資料入口，非原始組態去密器；安全字串 gate 加 CORE evidence validation，拒絕敏感標記與多行 raw config。

Next owner 目前 DEV；產品固定與 manifest 後才交 QA_NTM_002。PRE-COMMIT 停止保留。

## GEN-R1 Delivery — 2026-10-09

純引擎與 DEV 自測已完成，產品 writer 停止。新增檔案只有 `app/lib/trusted-network-interface-candidates.ts` 與 `tests/dev-ntm-002-candidates.test.mjs`；CORE-R2、既有產品管線、QA-owned tests、package/lock 未修改。測前後 135 個既有 app/db/tests/package/CORE manifest 檔案 raw hash 全部相同，index empty。

API 細節補充：`InterfaceCandidate.parentName` 保留候選原始父介面要求，衝突替代方案不套用另一來源的父 ID。currentProject 同樣先經有限 plain JSON/安全字串 guard，拒絕 getter、循環、夾帶欄位、稀疏陣列，再呼叫 CORE-R2 validator；上限失敗回安全 `INVALID_CURRENT_PROJECT`，不裁切現存資料。以上僅此純引擎入參限制，不變更 CORE-R2 的輸入或持久化規格。

- GEN 自測：33/33 PASS；明列來源/可信模板/人工編號、來源衝突、父參照、模板更版、verified 保護、secret/未知欄位、limit-1/limit/limit+1、重複執行。
- serial regression：61/61 PASS = GEN 33 + CORE DEV 20 + 既有 QA core 8；QA core 由 DEV 執行只作回歸，不宣稱獨立 GEN QA。
- TypeScript `--noEmit --pretty false --incremental false`：PASS。
- scoped ESLint `--max-warnings 0`：PASS。
- tracked diff-check：PASS；新增檔 no-index check 僅新內容差異 exit 1 / CRLF advisory，無 whitespace error。
- 自測保留 red→green：三項補強原先 3 FAIL（父衝突來源未保留、array 額外屬性被忽略、current getter 可被讀取），最小修正後 3 PASS，最終 61 PASS。未修改 QA 斷言。

固定 [GEN-R1 manifest](../../dev開發紀錄/checkpoints/dev-ntm-002-gen-r1/manifest.json)、[完整命令證據](../../dev開發紀錄/checkpoints/dev-ntm-002-gen-r1/verification.json)、[開發日誌](../../dev開發紀錄/2026-10-09-dev-ntm-002-gen-r1.md)。獨立 QA_NTM_002 尚未執行，next owner 測試組；使用者已直接授權交該對話獨立驗收。

NOT RUN：whole-repo full suite/full lint/build、Browser、DB、Docker、live、UI/storage/CSVv3/真人模板與完整 NTM。此 phase 沒有 UI 可使用入口，沒有新 apply/verify 操作。未讀 env、未安裝依賴、owned external/temp resources=0、cleanup=0。Beta 契約 R1.1 收件排隊，不交錯產品 writer；本票固定後維持 PRE-COMMIT，不 stage/commit/push/deploy。
