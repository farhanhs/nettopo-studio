# DEV_NTM_001 — 可信拓樸共用資料核心與舊資料相容

| 欄位 | 值 |
|---|---|
| Group / Feature / Priority | DEV / NTM / P1 |
| Status / Planned Order | READY_FOR_QA（CORE-R2，同票 QA return）；完整 pipeline BLOCKED / 152 |
| Owner | 既有開發組／019fa64f-d5f1-7d61-bf93-47a9e7c293c7／local |
| Development Branch | codex/dev-rel-001-checkpoint |
| Worktree | C:/Users/DUS/Desktop/project/nettopo-studio/.local/worktrees/dev-rel-001-checkpoint |
| Base Commit | a9abe637f0ad419aced6d31faf30a127ce5b81e6 |
| Integration Target | codex/dev-rel-001-checkpoint；未授權整合 |
| Governance / Checkpoint | root R3／D43＋D44；READY_FOR_QA 後獨立驗收，PRE-COMMIT 停 |
| Created / Updated | 2026-10-09 / 2026-10-09 |
| Authorization | CORE-R1 依票尾 PM Scope Review R1；其餘產品 pipeline 仍未解除 |
| Git / env / DB / live / deploy | 未授權 |

## Objective / Requirement Traceability

使用者在 D43 設計交接後要求「繼續開發」。第一批先落實共用資料與舊資料相容，不先改圖面或一次啟五條 writer。來源：[root 計畫](C:/Users/DUS/Desktop/project/nettopo-studio/docs/開發計畫/2026-10-09-trusted-network-topology-plan.md) 的 NTM-D01／NTM-A08／NTM-A10；設計依赖 DSG_NTM_001 的完成契約與 PM 範圍核對。

## 當前允許：preflight

- 核實 branch／HEAD／dirty、單一 writer、沒有 active 正式 QA lock。
- 唯讀檢查 types／validation／clone/sanitize／Zustand／Dexie／repository／import-export 資料路徑，列出會 strip／忽略新欄位的節點。
- 根據已交付契約提出最小完整第一批 allowed paths、相容與 round-trip 風險、自測／獨立 QA 案例；設計未交付不猜欄位、不改產品。
- 只寫本票及 `docs/dev開發紀錄/2026-10-09-dev-ntm-001-preflight.md`、register 本票行。

## 實作範圍（待完成契約及 PM 解除依赖）

共用模型／驗證、舊資料上轉與安全回退、clone/sanitize 保留新語意、必要儲存 seam，以及純合成 fixture 自測。實作必須沿完成契約，不因預估拆分先默默引入新必填欄位或使原畫面／匯入無法工作。最小路徑及 acceptance 在 preflight 收件後固定。

不包含設備模板取得、推測演算法、核實 UX、雙視圖、分層導航、CSV 新版本正式入口、API／DB migration 或後端 schema 改變；若核心依赖後幾項，先列出阻擋／安全替代，不越界落實。不要以一個未接產品的 type 宣稱整個核心已完成。

## 驗收與停止

- 舊 Device／Link／Group／quantity／port 字串不丟、不造已核實真值；新介面端點、來源與核實的關聯可驗。
- clone/sanitize 等經允許路徑能保留新資料與安全邊界，非法引用／秘密候選拒絕；資料不支援的讀写或交换 fail closed，不靜默降版丢失。
- 合成自測／types／lint 等不載 `.env` 或現用 DB；不能用含 env loader 的 package script 偷讀現用資料。
- DEV 不修改獨立 QA 斷言；完成交精確 manifest／自測／相依／未驗與 cleanup，停 READY_FOR_QA。
- 獨立 QA 尚未派工／NOT RUN；PM 取得候選再派對應 QA。至 PRE-COMMIT 停，不 stage/commit/push。

## History

2026-10-09：PM 建票；DSG_NTM_001 仍 IN_PROGRESS。next owner DEV 做唯讀 preflight；產品依赖尚未解除，NOT STARTED。其他已驗與未驗 A 項不改。

2026-10-09：唯讀 preflight 完成。實際 branch／HEAD 為 `codex/dev-rel-001-checkpoint`／`a9abe637f0ad419aced6d31faf30a127ce5b81e6`，index empty；QA_PIL_006 仍 `IN_QA`，但本輪未修改或測試其受測產品。現行 strict V1 validators、clone/sanitize、store、repository 與 transfer 會拒絕或遺失 proposed ProjectV2 欄位，第一批必須以單一 ProjectV2/upcast/validation seam 收斂後才可寫入。詳細路徑、相容風險及測試矩陣見 [preflight](../../dev開發紀錄/2026-10-09-dev-ntm-001-preflight.md)。`TRUSTED-NETWORK-TOPOLOGY-V1` 仍為 `PROPOSED / WAITING_APPROVAL`，CSV v3、尺度與 privacy 待決策；本票維持 `BLOCKED`，未開始產品實作。

2026-10-09：CORE-R1 純模組候選完成，phase 改 `READY_FOR_QA`；完整 pipeline 仍 `BLOCKED`。新增 `trusted-network-types.ts`、`trusted-network-model.ts` 與 DEV core test，未修改既有 Project/types/validation/store/DB/transfer/API/UI。Targeted 12/12、TypeScript、scoped ESLint（0 warning）PASS；Browser/DB/build/full suite/正式 QA 均 NOT RUN。Manifest：[CORE-R1 manifest](../../dev開發紀錄/checkpoints/dev-ntm-001-core-r1/manifest.json)。停在 PRE-COMMIT，未 stage/commit/push；next owner PM 具名派 QA_NTM_001。

## PM Scope Review R1 — 2026-10-09

DSG 已交付 TRUSTED-NETWORK-TOPOLOGY-V1@2026-10-09（完整契約仍 WAITING_APPROVAL）。PM 依使用者最新「繼續開發」選取 **CORE-R1 純資料模組**作第一個實作 phase，僅核准契約 §2 的共用模型、§6.1 legacy read/upcast、§6.3 無損 downcast／拒絕的純函式與 NTM-A08／A10 核心案例。此 phase 不採用完整契約五項待決策，更不預先批准 CSV v3／任務時間／safe verifier marker。

**解除範圍**：preflight 完成且核無 active writer／QA lock 後，可實作此純模組；整票資料管線接入仍 BLOCKED。Owner 開工時自行更新票的狀態，區分 CORE-R1 與整票。

Allowed product paths：新增 `app/lib/trusted-network-model.ts`、`app/lib/trusted-network-types.ts`；若確有必要抽小 helper，先在 preflight 列出並由 PM 擴路徑。自測僅新增 `tests/dev-ntm-001-core.test.mjs`，可新增 `tests/fixtures/dev-ntm-001/` 自有合成資料。允許 import 現有 legacy types／validator，不能修改它們或其他既有產品／測試檔。

必要結果：

1. versioned pure V2 parse／upcast／validation／canonicalization 與資料深複製；不變動現行 Project 型別／clone／sanitizer／app 行為，不在此批呼叫 Zustand／Dexie／repository。
2. 顯式 legacy port 生成 deterministic unverified provisional interface，沒 port 不造假；保留 Device/Link/Group 原 ID、quantity、字串與幾何。新引用／owner／alias／parent/area cycle／VLAN CIDR 等不變量有正反例。
3. safe typed error 不回輸入秘密；strict unknown key 與受限 evidence 欄位，秘密注入／原始 source 不能入模組結果；parse/upcast 不把任何推測變 verified。
4. downcast 只能無損，不支援新資料必須拒絕；純模組不能自称已建立備份或已整合可保存。明確報告既有 clone／state／transfer 尚不能使用 V2，此 phase 產物不可從 UI 開啟。
5. 對可輸入 verified fixture 的 validation 僅證明資料結構，不授權 imported actor／verification；本批不新增可執行的 verify／apply 操作，後續可信 actor derivation 仍由驗證／API phase 接入。

本批 no-env 合成測試、TypeScript與 scoped ESLint 已核准；直接使用 runtime，不執行 package 中會載 env 的 build/test scripts。不裝依賴、不啟 Browser／DB/live；不改 QA-owned 斷言。交付 CORE-R1 manifest（raw 及 normalized hash）、自測結果／相依與未驗，停 READY_FOR_QA，獨立 QA 接件後才驗；不 stage/commit/push。若純模組無法沿契約合理實作，停報真 blocker，不偷偷擴整個 pipeline。

## CORE-R2 QA Return Repair — 2026-10-09

- Change Type：CORRECT，沿 PM Scope Review R1 / D44 與 PM 本次具名退修，不改設計或完整 pipeline。
- 已核對 QA_NTM_001 票尾 `QA release for repair`、測試組 idle、無 active QA lock / owned runtime resources；原三檔 hash 符合 CORE-R1。工作樹 / HEAD 不變，保留其他票 dirty changes。
- 缺陷：NTM-CORE-01 legacy safe port 被 trim，破壞 C01/C05 lossless；NTM-CORE-02 缺公開 `canonicalProjectV2()`，C04 無法驗證。
- 最小重現已在 no-env Node 跑出兩項 FAIL：`Gi0/1 !== " Gi0/1 "`、canonical export 為 undefined。修復限原 pure module / types / DEV 自測；不修改獨立 QA 斷言與既有 legacy validator/type/store/DB/API/UI/transfer。
- Preserved Invariants：strict unknown-key / relation / evidence validation、unverified 不自動升級、不可無損則拒絕 downcast、零持久化。canonical 保留陣列順序與安全原字串，不承接 CSV v3 或 actor privacy 未核准語意。
- Regression Map：raw-space port / alias / legacy string 的 upcast→clone→downcast，canonical deterministic / deep copy / immutable input / typed invalid rejection；原 CORE-R1 DEV cases、tsc、scoped ESLint。失敗留同票；完成交 CORE-R2 manifest，停 READY_FOR_QA / PRE-COMMIT，不 Git。

### CORE-R2 Ready for QA

修復完成：驗證與原文保存分離，legacy port/name/alias/color 等安全字串無損；新增公開 canonicalProjectV2，嚴格驗證後只固定 object key order，深複製且不改陣列順序或核實狀態。canonical key ordering 不再造成 downcast 假性拒絕，有損 trusted 資料仍拒絕。

DEV 自測 20/20、原始最小 repro 2/2、tsc、scoped ESLint（0 warning）PASS。測前後 132 個 source/package/舊 manifest 檔案比對，只有 model 與 DEV test 改變；types、QA-owned tests/fixtures 與既有 pipeline 均未改。三檔 raw/normalized hashes、四個依賴 hash、差異與未驗見 [CORE-R2 manifest](../../dev開發紀錄/checkpoints/dev-ntm-001-core-r2/manifest.json)，細節見 [DEV QA Return Fix](../../dev開發紀錄/2026-10-09-dev-ntm-001-preflight.md)。

CORE-R1 QA_FAILED 與 manifest 保留。CORE-R2 獨立 QA / build / full suite / Browser / DB / Docker NOT RUN；完整 pipeline、CSV v3、scale/actor privacy 不在此 phase。產品 writer 停止，PRE-COMMIT，未 stage/commit/push。依 PM 最新指示，由 PM 直接讀取票/manifest與完成回報後派 QA_NTM_001 重驗；本輪不自行派 QA 或跨對話回送。
