# DEV_NTM_001 唯讀 Preflight

## 結論

- Ticket：`DEV_NTM_001`；候選位置 `codex/dev-rel-001-checkpoint`，HEAD `a9abe637f0ad419aced6d31faf30a127ce5b81e6`。
- Index empty；工作樹既有治理、QA、AST/MED/AIL dirty scopes 全數保留。本輪沒有產品、測試、環境或 Git 寫入。
- `TRUSTED-NETWORK-TOPOLOGY-V1` 已交付，但狀態仍為 `PROPOSED / WAITING_APPROVAL`。因此本票可完成差距盤點，不能開始 ProjectV2 產品實作或自行採納 CSV v3、尺度、RBAC、verification actor privacy 等待決策項。
- QA_PIL_006 仍為 `IN_QA`；本輪只讀產品，沒有碰受測候選。正式 NTM QA 尚未建立／派驗。

## 現況資料路徑與遺失點

| 邊界 | 現況 | ProjectV2 風險 |
|---|---|---|
| `app/lib/topology-types.ts` | `Project` 只有 devices/links/groups；`cloneProject` 僅逐列淺拷貝 | `trustedNetwork` 會直接遺失，巢狀 evidence/trust 也無深拷貝保證 |
| `app/lib/topology-validation.ts` | strict V1 device/link/group/project Zod；sanitize 只支援 V1 | V2 unknown keys fail；沒有 legacy upcast、cross-reference/cycle/alias/trust 驗證 |
| `app/lib/topology-transfer.ts` | 另一套 `.strip()` V1 schema，JSON schema v1、CSV strict v2 | `.strip()` 會靜默丟掉 device/link additions；v2 無法承載 trusted data；不能在本票暗改 headers |
| `app/lib/topology-store.ts` | 所有 Zustand/Dexie write 經 `safeProject`；初始化會回寫 credential 清理差異 | V2 會被拒絕；若把 upcast 混入現有 cleanup 比對，可能在「讀取舊資料」時自動持久化，違反 explicit-save 規則 |
| `app/lib/topology-db.ts` | Dexie topology record 保存 nested Project JSON，無 Project 欄位 index | 只新增 nested JSON 不需 Dexie version；但 validator/clone 必須先正確，不能建立 shadow graph |
| `db/topology-postgres.ts` | topologies.project JSON 讀取只 strip credentials；create/save 驗 V1；duplicate 直接複製 JSON | read 需安全 upcast，write 需 strict V2；duplicate 必須深拷貝且保留 stable IDs，不可跳過驗證 |
| `app/api/topology/route.ts` | `requiredProject()` 呼叫 V1 `validateProject` | API 不接受 V2；verification actor 不可由 client payload 信任 |
| `db/data-dictionary.ts` | `TopologyDatabaseRecordSchema.project` 引用 transfer 的 V1 `ProjectSchema` | DB record validation 與 domain validator 分叉，會拒絕 V2或造成 schema drift |
| credentials/audit | credentials 獨立 API；audit 只記 counts/safe metadata | 必須維持 raw secret/ciphertext/nonce/cookie/token/raw provenance 零進入 Project/state/log/export |

## 建議第一批最小完整實作

契約核准並由 PM 解除依賴後，第一批只處理 core／validation／legacy compatibility，不包含 UI、inference、template、conflict workflow 或正式 CSV v3。

1. `app/lib/trusted-network-model.ts`（新增）
   - 定義核准後的 ProjectV2／TrustedNetworkModelV1 型別與唯一 strict schemas。
   - 對外只暴露 `upcastProject(input)`、`validateProjectV2(input)`、`cloneProjectV2(project)` 與 typed issue/error。
   - 集中 deterministic legacy port provisional interface ID、reference indexes、area/parent cycle、interface ownership/parent cycle、VLAN/subnet/resiliency/trust integrity。
2. `app/lib/topology-types.ts`
   - 將 durable Project 型別接到核准的 ProjectV2；保留 Device/Link/Group 舊欄位與 quantity/port 字串。
   - `cloneProject` 委派唯一深拷貝 seam，不再手刻三陣列而遺漏新資料。
3. `app/lib/topology-validation.ts`
   - credential boundary 保留；改以唯一 model seam 驗證／上轉。
   - 分開 read-upcast 與 write-canonical：讀 V1 只在記憶體得到 V2，不能因初始化自動寫回；第一次明確 save/apply 才持久化 V2。
4. `app/lib/topology-store.ts`
   - initialize/select/duplicate/import/write 全部使用同一 canonical clone/validate。
   - 保留 Zustand 單一 write seam；修正 legacy credential 清理與 V1→V2 upcast 判定，避免 read side-effect。
5. `db/topology-postgres.ts`、`app/api/topology/route.ts`、`db/data-dictionary.ts`
   - RBAC/session-before-data 順序不變；authorized read 才 upcast。
   - create/save transaction 內 strict V2 revalidation；duplicate 經 canonical deep clone，不重算 stable IDs。
   - verifier identity 仍由 server/session 注入；第一批若不實作 verification write，則 client supplied verifiedBy/verifiedAt 必須拒絕或維持未核實，不能照單接受。
6. `app/lib/topology-transfer.ts`
   - 第一批只做 safety guard：既有 JSON/CSV v1/v2 行為不變；ProjectV2 有 trusted data 時，在 v3 尚未核准／實作前明確拒絕 lossful export/import，不得 `.strip()` 後宣稱成功。
   - 正式 v3 typed-row grammar 留 `DEV_NTM_005`；不新增第六檔。

建議第一批 allowed paths：上述六個既有模組、新 model 模組，以及 DEV-owned `tests/trusted-network-model.test.mjs`、`tests/trusted-network-compatibility.test.mjs`、必要的 store/repository behavior tests。若 PM 要求第一批完全不碰 transfer，則必須同時明列「V2 export disabled/fail-closed」的既有入口 owner；否則會有靜默資料損失風險。

## Schema／Migration／交換判斷

- PostgreSQL：目前 `topologies.project` 是 JSON；第一批不需要 `0005+` SQL migration。若要新增可查詢欄位、索引、server-only area→authorization site mapping，須另立 migration 設計，不能混入本票。
- Dexie：nested Project JSON 無需升 Dexie version；若新增 table/index 才需另核 migration。禁止建立第二份 trusted graph。
- CSV：正式保存 V2 trusted data 需要設計提案中的 CSV Bundle v3，屬待核准契約改變；本票第一批不能實作新入口。strict v1/v2 必須保持原樣。
- JSON/API：Project schema/envelope version 會改；server API 可在同一 JSON project 欄位保存，但必須先核准 ProjectV2 契約與舊 app fail-closed 行為。

## DEV 自測需求（產品授權後才執行）

- V1 no-version Project upcast 保留 devices/links/groups/order/IDs/quantity/fromPort/toPort；有明確 port 才建 provisional unverified interface，缺 port 不造假。
- V2 strict parse、unknown future version fail closed；duplicate/cross-reference/parent cycles/alias collision/VLAN range/CIDR/resiliency/trust orphan 全部有 typed deterministic issues。
- clone/sanitize/duplicate/local/server save-reload 完整保留巢狀資料與 stable IDs；mutation 不共享巢狀 reference。
- legacy read zero-write；第一次 explicit save 才 V2 persist。取消/validation failure 保持 Dexie/PostgreSQL/Zustand zero-write。
- credential/raw config/secret/token/cookie/ciphertext/nonce 不進 Project、state、Dexie、PostgreSQL project、audit/error。
- V2 在 v3 未完成前 export fail closed；舊 v1/v2 JSON/CSV regression 不變，不能用 strip 產生看似成功的有損輸出。
- server route auth-first、transaction revalidation、RBAC visibility與 credential orphan cleanup 不退步。

## 獨立 QA 建議

- QA_NTM_001 應獨立重跑 NTM-A08 與 A10 core subset：legacy upcast truth table、explicit-port/no-port、stable deterministic IDs、lossless fields、downcast/data-loss rejection、secret sentinel。
- Local Dexie：load V1 zero-write → explicit save V2 → reload equality；duplicate equality與巢狀 reference independence。
- Real isolated PostgreSQL：authorized read/upcast、save/reload/duplicate、transaction failure zero-write、RBAC known-ID 404/403 precedence；不使用現用 DB/env。
- Transfer regression：strict CSV v1/v2、五檔、safe/full、header/manifest/duplicate/file gate不退步；V2 unsupported path 明確拒絕，不宣稱 v3 PASS。
- TypeScript、targeted Node、scoped ESLint、build 分開記錄；Browser/UI、真匿名案例、v3 round-trip 在本票保持 NOT RUN。

## 阻擋與下一責任

1. `TRUSTED-NETWORK-TOPOLOGY-V1` 尚未 APPROVED；ProjectV2 欄位與驗證語意不能進產品。
2. CSV Bundle v3、acceptance scale、匿名案例、跨區 RBAC 邊界與 safe verifier marker 仍待使用者／PM 決策。
3. PM 尚未固定第一批 allowed paths、驗收 IDs 與 transfer fail-closed owner。

Disposition：`DEV_NTM_001 = BLOCKED`。Preflight 可供 PM/DSG 收斂，但不是開工、產品候選、自測或 QA PASS。下一責任：PM 核契約及待選項；核准後再具名解除產品寫入依賴。

## CORE-R1 Implementation Result

PM Scope Review R1 後只新增：

- `app/lib/trusted-network-types.ts`
- `app/lib/trusted-network-model.ts`
- `tests/dev-ntm-001-core.test.mjs`

實作包含 versioned ProjectV2 strict parse、legacy deterministic upcast、只由明確 port 產生 unverified provisional interface、global ID/reference/owner/cycle/alias/VLAN/CIDR/IP/resiliency/evidence/trust validation、canonical deep clone，以及 canonical re-upcast 完全相等才允許的 lossless downcast。沒有 verify/apply authority；結構上可驗的 imported actor 不代表授權資格。未加入 medium、CSV v3、store/DB/API/UI wiring。

修正歷史保留：首輪測試 source 有非 async `await` 且 BigInt 不符合 TS target；第二輪 direct Node import 缺 `.ts`；第三輪發現 optional `undefined` 破壞 canonical shape；最終 code review 再收緊 downcast，避免 provisional interface alias/evidence 變更被有損丟棄。

最終 no-env 驗證：

- `node --test tests/dev-ntm-001-core.test.mjs`：12/12 PASS。
- `node node_modules/typescript/bin/tsc --noEmit --pretty false`：PASS。
- scoped ESLint with `--max-warnings 0`：PASS。
- Browser、DB、build、full suite、獨立 QA：NOT RUN（不在 CORE-R1 自測範圍）。
- Cleanup：未建立 process/port/DB/browser/container；無 runtime cleanup 項目。

完整 pipeline 仍不能使用 ProjectV2：既有 clone/state/Dexie/repository/transfer/API/UI 未接線；CSV v3 與其他待決策不因本 phase 自動核准。CORE-R1 停 `READY_FOR_QA / PRE-COMMIT`，未 stage/commit/push。

## CORE-R2 QA Return Fix — 2026-10-09

Ticket：DEV_NTM_001；Change：CORRECT；Authority：D44 / PM Scope Review R1 與本日 PM 具名同票退修。已讀 QA_NTM_001 的 `QA release for repair`，確認測試組 idle、產品鎖釋放、無 owned runtime/temp resource 後才修改。保留 CORE-R1 manifest 與 QA_FAILED（最終 5 PASS / 3 FAIL）歷史，不改獨立 QA 斷言。

Branch / HEAD：`codex/dev-rel-001-checkpoint` / `a9abe637f0ad419aced6d31faf30a127ce5b81e6`。CORE-R2 為未提交候選，不等同 HEAD；raw/normalized hashes 與相依閉包见 [CORE-R2 manifest](checkpoints/dev-ntm-001-core-r2/manifest.json)，捕捉時間 2026-10-09 16:50:29（Asia/Taipei）。

### 根因、修復與範圍

1. NTM-CORE-01：legacy validator 與 V2 schema 都產生正規化結果，先前將它當成保存真值；legacyEndpoint 又 trim/NFC 介面名。原自測只用無前後空白 port，另把 color lower-case 當預期，漏掉「安全原字串不丟」要求。
2. 本輪不改舊 validator，而是在新模組將驗證與保存分開：仍檢查正規化視圖的條件，再檢查原值引用與安全 evidence，回傳深拷貝原值。alias/ID matching 可正規化，但 raw port/name/alias/color 等文字保留；介面 name 的 fingerprint 依實際保存值產生。只有空白的 port 保留原字串，但不創造介面。
3. NTM-CORE-02：前次把深拷貝誤當成足够的 canonical 交付，漏掉公開函式。新增 `canonicalProjectV2(input)`，先嚴格驗證，再按物件 key 排序；陣列順序、原文字、ID、幾何、quantity、verification/actor 均不變，也不共享巢狀 reference。
4. downcast 比對採 canonical key order，避免只有物件欄位插入順序不同就誤判；實際新增 alias/evidence/其他 trusted 語意仍以 `DOWNCAST_WOULD_LOSE_DATA` 拒絕。非法 ID/reference 不因保留原文而放寬。
5. 只修改 `app/lib/trusted-network-model.ts` 與 `tests/dev-ntm-001-core.test.mjs`。`trusted-network-types.ts` 原值不變但列入新 manifest。DEV 原 2 項 color 預期改為原 legacy 字串相等，是補強 lossless 斷言，不是改 QA 測試或把 trim 合理化。

### DEV 驗證

| 階段 / 指令 | 實際結果 |
|---|---|
| 最小純合成 Node repro：`fromPort=" Gi0/1 "` / canonical export | 修前 2 FAIL；修後 2 PASS |
| 先加 regression，再跑 DEV test（未改產品） | 19 total / 11 PASS / 8 FAIL，確認能捕捉資料遺失與缺少 seam |
| `node --test tests/dev-ntm-001-core.test.mjs` 最終 | 20/20 PASS，0 FAIL / 0 SKIP |
| `node node_modules/typescript/bin/tsc --noEmit --pretty false --incremental false` | PASS，未產生 incremental cache |
| `node node_modules/eslint/bin/eslint.js app/lib/trusted-network-model.ts app/lib/trusted-network-types.ts tests/dev-ntm-001-core.test.mjs --max-warnings 0` | PASS，0 warning |

八個新增案例覆蓋 raw spaces / empty ports、Unicode/case alias matching、upcast→clone→validate→downcast 無損、frozen input、canonical key insertion-order independence / idempotency / deep clone / array order、verified/unverified 不變、非法 schema/version/duplicate/reference/evidence typed reject，以及 canonical 後 downcast 正常與 lossful 拒絕。只用自有合成 fixture，沒有執行獨立 QA runner，也不以 DEV 通過代簽 QA。

Node v24.18.0 / Zod 4.4.3 / TypeScript 5.9.3 / ESLint 9.39.4；直接 no-env Node，不經 package env loader。測前後掃描 app/db/tests 加 package/lock/CORE-R1 manifest 共 132 檔，僅上述 2 檔 hash 改變，其餘 130 不變；包含 QA runner/fixtures、舊 types/validator/store/DB/API/UI/transfer。原 CORE-R1 manifest 未改，Git index empty。

### 交付與停止

CORE-R2 pure-module phase `READY_FOR_QA`，產品 writer 已停止。Next owner：PM 以票面/本日誌/manifest 收件，安排 QA_NTM_001 先重驗 C01/C04/C05，再完整 C01–07。依 PM 最新收件方式，不另行跨對話回送或自行派啟 QA。

NOT RUN：獨立 QA、full suite、build、Browser、DB、Docker、持久化/產品 pipeline、CSV v3、scale/time、actor privacy、真匿名案例。完整 pipeline 仍 BLOCKED，這份純模組尚不能在 UI 開啟保存。沒有讀現用 env/DSN、啟動外部 runtime 或建立 temp fixture；所有測試/靜態檢查程序已結束，無 runtime cleanup 項目。停 PRE-COMMIT，未 stage/commit/push。
