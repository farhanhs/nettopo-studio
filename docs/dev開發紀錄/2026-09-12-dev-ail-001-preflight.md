# DEV_AIL_001 — Preflight 開工前檢查

- 日期：2026-09-12
- 執行：PM 本對話直接檢查；不是開發組已交付產品的回報
- Development Branch：codex/ai-layout-poc
- Worktree：C:/Users/DUS/Desktop/project/nettopo-studio/.local/worktrees/ai-layout-poc
- Base Commit / HEAD：1b0b084518886cda347f175bfc959401fd1d18ed
- Integration Target：codex/dev-rel-001-checkpoint
- 結論：Preflight 完成；DEV_AIL_001 維持 READY。可以從 shared contract／純函式抽離開始；geometry 與測試環境限制如下。本票產品尚未 IN_PROGRESS 或 READY_FOR_QA。

## 1. 分支與授權基準

實查 branch/HEAD 均與票面一致。開始時 dirty 檔案全為 PM/DSG 治理與設計文件，app/db/tests/package/lock 沒有產品 diff。沒有 staging；本輪保持 docs-only。

本 worktree 沒有 AGENTS.md 搜尋命中。已讀 DEV_AIL_001、DSG R1 第17節及現有 layout/routing/tests；沿用 topology-ui 的純排版轉換、controlled view 與 Zustand write boundary。

UIX_006–008 的已驗收 dirty 候選不在本分支；這不阻擋 core 抽離，但 DEV_AIL_003 Browser 整合不能借用其 QA 結果。AST 的新尺寸、MED 的 medium 欄位與多成本 route 實作亦未整合。

## 2. 現有接點與抽離清單

| 檔案／接點 | 現況 | DEV_AIL_001 工作 |
|---|---|---|
| page.tsx: LayoutMode、DeviceGraph、DEVICE_ORDER、ELK instance | 排版定義放 UI 檔內 | 移到 core/contract；UI保留 labels 和按鈕 |
| page.tsx: deviceName/hasAnyKeyword/buildDeviceGraph/isEndpointDevice/sortDevices | 本地角色分類／排序；與 topology-layout.ts 部分重複 | 抽出／共用；保留四種模式與分類優先語意 |
| page.tsx: applyColumnLayout/applyRowLayout/classifyThreeTier/classifySpineLeaf | 三層／Spine–Leaf 專用定位 | 純輸入輸出，移到 topology-layout-core.ts |
| page.tsx: layoutByMode/layoutWithElk | ELK只一般分層；其他模式自訂格位 | 統一 core API，注入engine runner，禁止把UI/persistence放進函式 |
| page.tsx: autoLayout | await 後直接setProject | 本票只改呼叫新core的hunk；preview/apply/undo留DEV_AIL_003 |
| topology-layout.ts: resolveLayoutMode/orderLayersByConnectivity | 既有對外函式／3項layout測試 | 保留export相容；stable ordinal id tie-break補齊 |
| topology-routing.ts: routeTopologyLinks/validateOrthogonalRoute/deviceRoutingRect | 同步路由、固定geometry、margin=14 | scorer呼叫既有API；不改router演算法或重寫offset |
| topology-types.ts/validation.ts | Device/Link/Group與strict Project | 沿用；不增加AI durable欄位 |
| topology-store.ts/API/repository | 背景儲存與權限 | 只記錄依賴；本票不實作atomic apply或undo |

## 3. 已證實的差異與處理方式

### PF-01：相同名稱排序依賴輸入順序（實際probe）

使用現有 orderLayersByConnectivity，兩個無連線、相同 name、不同 id 的設備：
- 輸入 [a,b] → [a,b]
- 輸入 [b,a] → [b,a]

原因：現有最後 comparator 為 name.localeCompare，tie時保留array原順序。新契約要求相同graph/intent重排輸入仍同結果。
處理：新core入口先以固定 ordinal id 正規化graph及layers；排序使用明確比較與id tie-break，避免locale預設差異。保留既有模式/分類語意，不能承諾所有模糊排序的座標字節完全不變。
需新增行為測試：同名、無連線、多個等價鄰接設備、input permutations、固定mock intent。

### PF-02：geometry adapter 不能假裝既有router支援任意尺寸（source evidence）

- TOPOLOGY_NODE_WIDTH=178、HEIGHT=112。
- deviceRoutingRect、center、boundary、anchor內部使用固定常數；routeTopologyLinks没有geometry參數。
- OBSTACLE_MARGIN=14為private常數。

首期adapter包裝既有geometry來源：dimensions引用已export常數，margin可由 deviceRoutingRect 對測試基準設備的結果取得／一致性assert，不複製一套新router常數。
本票只支援目前geometry。注入192×148可測layout座標計算，但若接既有router必須拒絕不相容geometry，不能把它算成安全候選或宣稱支援AST完整尺寸。
真正新尺寸router adapter需與AST/路由票協調，明確整合再驗；不因此阻擋base geometry core實作。這是現有能力限制，不是核准192×148。

### PF-03：worker與可中止運算尚未接入

page.tsx目前 new ELK() 使用bundled engine；沒有指定worker。route/scorer亦為同步函式，單純 Promise.race(timeout) 不能中止CPU工作。
處理：本票新增受控layout worker及runner（可注入fake runner供Node測試），core/route/scorer在worker執行，deadline到時terminate；UI維持回應。每次最多3候選，原圖保留。
本機 elkjs/lib/elk-worker.min.js 可找到，但專案尚無AIL worker bundle/build證據。Browser worker載入與中止必須在後續實作build/UI驗證，不能以檔案存在即標PASS。

### PF-04：測試可借用ancestor套件，build尚非獨立環境

本 worktree 的 node_modules 不存在。
Node v24.18.0，符合 package engines >=22.13.0。require.resolve 在 ancestor 主工作區找到依賴：
elkjs 0.11.1、zod 4.4.3、typescript 5.9.3、vite 8.0.13；抽查四項與本worktree lock一致。
這僅證明本輪focused tests可執行，不是完整依賴樹可重現證明。

scripts/build-local.mjs直接定位 worktree/node_modules/vinext/dist/cli.js；檔案路徑缺少，未執行 npm build/lint/tsc，不宣稱全套PASS。
正式實作驗證前按此分支lock建立worktree-local依賴（優先既定安裝流程／npm ci並注意安裝腳本），不複製.env、DB或其他工作樹dist。本輪preflight不安裝套件、不建立junction、不改package/lock。
環境setup不是產品失敗，不能拿ancestor測試當隔離build證據。

### PF-05：route validity回傳值不能單獨當candidate gate

validateOrthogonalRoute 對 invalid-missing-endpoint 會回 valid=true；routeTopologyLinks亦可能過濾null。
Scorer先驗完整Project參照，再逐一對照每個link是否有route及status=resolved，最後驗segment/node幾何。缺路徑不可當0交叉而選成最佳。Wireless保留既有例外。
需新增測試：缺失端點、null/invalid/unresolved route、wired/wireless混合；missing路徑與unsafe candidate必須拒絕。

## 4. 開發順序與 hunk ownership

1. topology-layout-contract.ts：R1的共享型別、strict schema、canonical輸入與intent/ref驗證。UI/request wire payload以第17節為準，internal snapshot不等於可外送payload。
2. topology-layout-core.ts：抽離現有函式；保留topology-layout.ts public exports，補排列穩定性、pins及既有ID集合。
3. topology-geometry.ts：包裝178×112現有幾何；明確拒絕不相容router geometry。
4. topology-layout-quality.ts：候選硬gate、crossings/shared segment/bends/length/movement/bounds、固定tie-break；label bounding-box評分本期明確延後。
5. topology-layout-worker.ts + topology-layout-runner.ts：中止／deadline／requestId隔離；new Worker bundler入口按既有Vite/Vinext實際build驗。
6. page.tsx：只有移除local helpers/import和轉接core；不改雙軌按鈕、preview、store或API。
7. tests/dev-ail-001-*.test.mjs 與本票evidence；完成targeted/tsc/scoped lint/build後才回 READY_FOR_QA。

邊界：不改topology-routing.ts演算法、AST/MED實作、schema/migration、API/store、provider或env。若新geometry需要router可變尺寸，另記依賴，不能順手擴大本票。

## 5. 已執行基線驗證

Command：
node --test --test-concurrency=1 tests/topology-layout.test.mjs tests/topology-routing.test.mjs tests/topology-routing-qa-uix.test.mjs tests/topology-visibility.test.mjs tests/topology-validation.test.mjs

Result：29 tests / 29 pass / 0 fail / 0 skip。
其中現有60-device/120-wired-link routing budget test通過，該次約27.13ms；不是未來AIL整條pipeline的效能結果。

Additional：
- 排序probe：成功重現PF-01。
- Node與四項依賴resolve/version：符合上述抽查結果。
- branch/HEAD與無product diff：符合票面。
- build/tsc/full lint/Browser/DB/live provider：NOT RUN，本次docs/preflight範圍。
- 未讀.env內容、未發送provider請求、未改產品／tests／package；未stage/commit/push。

## 6. 後续驗證矩陣

| 類別 | 預期 |
|---|---|
| strict contract | unknown fields/ids、duplicate/missing positions、非法數字、pins、provider ref拒絕 |
| graph preservation | 原輸入deep-freeze；輸出只改x/y；links/groups與其餘Device欄位相等 |
| modes | auto-detect/three-tier/spine-leaf/layered、空圖、單點、disconnected、cycle、groups |
| deterministic | 同name/id tie、device/link/group permutations、相同validated intent |
| safe geometry | pins、node overlap、nonendpoint collision、unresolved/missing route、base geometry mismatch |
| scoring | 同端點交叉排除、正長度重疊、wireless例外、original/quick/smart tie-break |
| worker | real cancel/terminate、deadline、late result、worker error，UI不凍結 |
| regressions | 上述29項＋轉移helper新增行為測試；UIX前序實際整合後再Browser驗 |

## 7. 交接判斷

可以開始DEV_AIL_001的base geometry/shared core實作；PF-01/03/05是本票必要工作，PF-02限制納入adapter/測試，PF-04是build前環境前置。沒有需要使用者重新裁定的產品方向。
READY不等於QA通過。本輪完成preflight即停止產品實作，等待排程；開發開始需把本票改IN_PROGRESS並記實際HEAD與依賴setup。
