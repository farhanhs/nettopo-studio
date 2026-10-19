# QA_BTA_001 — 本機 Beta 預建包獨立驗收

| 欄位 | 值 |
|---|---|
| Group / Feature / Priority | QA / BTA / P1 |
| Status | BLOCKED（R4可安全獨立矩陣完成；A08 OS enforcement平台BLOCKED） |
| Planned Order | 159 |
| Owner | 測試組 / 019fac8e-94dc-79c1-b156-7f242cf82967 |
| Development Branch | codex/public-beta-0.1 |
| Worktree | C:/Users/DUS/Desktop/project/nettopo-studio/.local/worktrees/public-beta-0.1 |
| Base Commit | b5c53916cbda6f8bcd2f42f9d9772ef181c1adee（原準備 base a9abe637f0ad419aced6d31faf30a127ce5b81e6 保留於歷史） |
| Integration Target | codex/public-beta-0.1；不合併其他分支 |
| Created / Updated | 2026-10-09 / 2026-10-19 |
| Governance / Work Package | root R3；PM_BTA_001；[核准計畫](C:/Users/DUS/Desktop/project/nettopo-studio/docs/開發計畫/2026-10-09-local-feedback-beta-plan.md) |
| Engineering commit authority | 無；第一個必要獨立驗收PRE-COMMIT停，不stage/commit |
| Release / push / integration / deploy / live | 僅PM已完成建立GitHub baseline分支；後續push/tag/Release/merge/deploy/live未授權 |

## Objective / Requirement Traceability

獨立合成fixtures/QA-only tools及本機Browser矩陣；BTA-A01–12全批與原A04/A05/A07適用缺口。乾淨包/來源/hash、loopback仍可用而外網隔離、Chrome/Edge、備份/還原、secret sentinels、API deny、owned cleanup。

來源為本對話使用者「核准，請先開在github開分支然後馬上派單」及計畫Q1–Q12。首次install可連網、日常離線；Windows＋Chrome/Edge、單人IndexedDB、匿名案例、預建程式、Node自備。不是R3正式人事B工作包。root dirty Auth、checkpoint dirty NTM/QA和AIL全部排除。已有13檔UIX基準delta做常見secret-pattern/禁止路徑查核零命中；這不是全歷史/active-secret或Beta secret PASS。

## Dependencies / Next owner

準備可先做；正式測試待DSG contract＋DEV三票READY_FOR_QA整包manifest、artifact及停止產品寫入。

Next owner：PM PRE-COMMIT核收；未完成必要gate不得放行，QA不得stage/commit/push。

## Allowed Files / Systems

tests/qa-bta-001*.mjs、tests/fixtures/qa-bta-001/**、scripts/qa-bta/**（若必要）；docs/dev測試紀錄/qa-bta-001*.md與自有evidence；自身票及register列。只讀產品。

開始前讀root AGENTS/R3/BRANCH-MAP及本樹票；再次核branch/HEAD/dirty。只在本樹工作，不直接用root工作位置。正式QA時產品固定、一個primary產品writer。各owner只更新自身票及register列，PM維護治理／package source。

## Out of Scope / Forbidden Changes

不開NTM/CSVv3/AIL/HR/監控/新功能，不讀現用.env/DSN/秘密、不用現用DB或公司API/OTP，不安裝Docker/全域Node/Browser/新plugin、不重設使用者資料。不改正式RBAC/CSV/secret原契約，不將QA_FAILED/NOT RUN改PASS或移除獨立QA斷言。不stage/commit/push/tag/Release/merge/deploy，不改寫Git歷史、不搬另一工作樹候選。安裝必要workspace相依僅限本樹／具名自有隔離目錄，記artifact/hash/cleanup，不覆用另一工作線node_modules或env。

## Acceptance / Verification Evidence

DEV/source scan/build/mock不代Browser，準備/preflight不代正式PASS；ALL BTA-A01–12需逐case expected/actual/hash/evidence。缺環境列BLOCKED只停相依，保留失敗；批次測完cleanup/release-for-repair後沿DEV同票閉環。無現用env/DB/HR/OTP/Docker/全域安裝。可在本票自有隔離目錄做核准首次setup的npm install，限runtime/QA必要既有依賴，不改全域Node或Browser。

Required acceptance IDs依核准計畫 BTA-A01–12；具體契約完成後列適用矩陣，必要項不削減。candidate、tools、deps及artifact測前後hash、實際版本、結果、owned cleanup與next owner都需記錄。Code/QA/Git/live分開。

| Evidence | Result | Date |
|---|---|---|
| PM baseline branch / clean worktree | a9abe637f0ad419aced6d31faf30a127ce5b81e6；正式產品測試NOT RUN | 2026-10-09 |
| 此票實作／獨立驗收 | NOT RUN | 2026-10-09 |

## Risks / Stop / Handoff History

秘密、資源歸屬、產品QA並行衝突或新語意立即停止受影響部分；缺條件BLOCKED，其他可獨立項仍可準備。普通既有契約缺陷DEV↔QA同票闭環並保留歷史；新package/API/profile语義超出本包交PM。GitHubbranch不是可用Release。

2026-10-09 PM建立本票；送達／實際開工另記，不將送單當IN_PROGRESS或PASS。

2026-10-09：QA 已接單並在指定 Beta worktree 開始自身準備。branch／HEAD 為 `codex/public-beta-0.1`／`a9abe637f0ad419aced6d31faf30a127ce5b81e6`；初始 dirty 僅 PM 新增 BTA tickets/register。已從 root 唯讀讀取 AGENTS／R3／BRANCH-MAP／核准計畫，未搬入 root dirty。建立 BTA-A01–12 `NOT_RUN` 矩陣、匿名 topology、合成 sentinel、Windows／Chrome／Edge／offline-loopback 環境 fixture 與 preparation runner；正式產品與 Browser QA 仍等 DSG contract＋DEV_BTA_001–003 整包固定候選。

Preparation self-check 首輪 3 PASS／1 QA fixture FAIL；修正合成DSN sentinel一致命名後4/4 PASS，syntax PASS。Beta樹未安裝workspace dependencies，scoped ESLint `NOT RUN`；未安裝或借用其他樹相依。QA-only hashes：runner `43885bd6859554980139ccb74898e09e6ad3f6f0e3047d454250e749946231b0`、acceptance matrix `7cf5a5f3bc30b0f2c07f99affad3a5fb700ac6dcc7a53afe9e2ecc9bce0af76c`、topology `fcfaa6ec693b77f2bf303966c3d017f5a7090be18351242bbe54c845285c2b3c`、sentinels `1d36e0a6a46c06c86f4dd23811ca40ce929ecd39934474b61f87a2f66c582f25`、environment `fbd53aeb6764d0d12a99e2c92ace197145a369fe30e18c02c8c70a9f55a5171a`。狀態回 `READY` 等正式候選；BTA-A01–12仍全數 `NOT RUN`。

2026-10-09 PM scope review follow-up：QA 維持準備、不測可變產品。自有矩陣補入既有逐拓樸 JSON／五CSV（非整workspace snapshot）、下載trigger不等於磁碟寫入已確認、dirty source需allowlisted精確hash、manifest無循環；環境矩陣補 originless capability GET、RSC/navigation/static、owned status/shutdown、cross-site與protected API deny。DEV仍為單一writer；正式結果不變，BTA-A01–12持續 `NOT_RUN`。

對齊後 preparation self-check 4/4＋syntax PASS。新 QA-only hashes：runner `5ed79054a0f541cb7d1ec3d427cf9c49875df143312a4c01bdd9e11b0e61a887`、acceptance matrix `107241ec3021bfee2f295efbc6e83831fcdd62b77a7ac167bb0167153bb6245d`、environment matrix `0c8d5ecbaba4e65f4b60e92b2acaadd499650c08ffce8aa429acce51e600930b`；topology與sentinel hashes維持前值。舊 preparation hashes保留為歷史，不作正式候選證據。

2026-10-19 Beta resume：DEV 已將唯一 Beta worktree安全fast-forward至已核main `b5c53916cbda6f8bcd2f42f9d9772ef181c1adee`，並回報既有15個準備檔hash未變；產品writer現由DEV_BTA_001持有。QA獨立重核branch／HEAD／dirty，並只重跑不載入產品的 preparation runner：syntax PASS、4/4 PASS。五個QA-only資產hash與10/09對齊後hash逐一相同。票面Base更新為新main，但狀態維持`READY（formal waits fixed package）`，BTA-A01–12仍全數`NOT_RUN`；未啟build/server/ZIP/Browser/env/DB/Docker，未把main既有PASS搬入Beta驗收。正式入口仍須DEV_BTA_001–003固定source/tool/dependency/ZIP manifest、停止產品寫入並交`READY_FOR_QA` packet。

2026-10-19 executable harness preparation：依PM要求在等待固定包期間建立QA-owned ZIP/package/lifecycle/Browser/secret/offline runner與正向selection guard。合成ZIP、中文空白解壓、manifest/lock/SHA closure、tamper/path/link拒絕、safe-env setup/stop、external URL/sentinel/cleanup及Browser evidence classifier最終精確allowlist`15/15 PASS`。首輪7/8與PowerShell assembly失敗均保留為QA fixture歷史，未放寬R1.1。DEV建立的`node_modules`存在但QA未讀用或寫入。完整紀錄：[qa-bta-001-harness-preparation-2026-10-19.md](../../dev測試紀錄/qa-bta-001-harness-preparation-2026-10-19.md)。產品／正式ZIP／Browser仍`NOT_RUN`，狀態保持READY等待fixed packet。

2026-10-19 DEV interface alignment：在不啟產品測試的前提下，QA runner固定setup/stop單行JSON stdout、空stderr、`BTA_*` code、固定4317 origin，以及`data-local-beta=true`、status/shutdown paths與control header。syntax與精確allowlist重驗`15/15 PASS`；這不是正式交接或產品PASS，DEV writer仍未停止，票況維持`READY`。

2026-10-19 formal QA start：收到DEV_BTA_001–003 `READY_FOR_QA` 固定交接，writer已停止。QA獨立核對branch／HEAD為`codex/public-beta-0.1`／`b5c53916cbda6f8bcd2f42f9d9772ef181c1adee`，ZIP SHA-256為`0054e9897492a9a6152dd1066d7df7e29f924e10a2e1426e58d75ae2ef72d15b`且與外部sidecar一致；handoff宣告sourceDrift空、固定artifact/source manifest。狀態轉`IN_QA`，正式A01–A12從`NOT_RUN`開始獨立執行；DEV證據不直接計為QA PASS。

2026-10-19 formal result：`QA_FAILED / RELEASE_FOR_REPAIR`。A01在中文／空白路徑 lifecycle 通過，但ASCII路徑 setup後 start 連續兩次`BTA_START_FAILED`，均無listener/state；A02發現R1.1要求的npm版本驗證未實作，現行只驗Node／Windows／arch。HTTP Host／Origin／API deny獨立通過。Windows Computer Use因無法可靠確認既有Chrome視窗URL而安全停止，未再操作該視窗；A03 Browser部分及A04–A10相關UI項維持`BLOCKED/NOT_RUN`。已停止owned server，ZIP前後hash一致。完整報告：[qa-bta-001-formal-2026-10-19.md](../../dev測試紀錄/qa-bta-001-formal-2026-10-19.md)。next owner DEV_BTA_001/002同票修復並重建固定包；不stage/commit/push/Release/deploy。

2026-10-19 isolated Browser preparation：依PM具名授權，新增QA-owned full Browser runner與隔離Playwright 1.62.1 lock/closure；新profile、headless installed Chrome/Edge、固定loopback，絕不接管既有視窗。runner自測3/3 PASS，產品未執行。完整紀錄：[qa-bta-001-browser-runner-preparation-2026-10-19.md](../../dev測試紀錄/qa-bta-001-browser-runner-preparation-2026-10-19.md)。票況維持首輪`QA_FAILED`等待新fixed packet；Browser正式結果仍`BLOCKED/NOT_RUN`。

2026-10-19 R2 re-test start：收到新fixed ZIP `a309fd30f4954d3562f56aa4715a2ec1fd51d3da7fdaa56c7bec983ba9677f2c`、artifact manifest `841ffa09c8b8ec204f2bd07f6e759af29d49a93efcc0dfd67f71643fe9db2be8`、source manifest `58a3aac6c251de2d56303031591f661248e9f790b711fadb34152c928f171df2`；DEV writer stop、sourceDrift空、4317 listener 0、index 0。狀態轉`IN_QA`，首輪失敗不覆寫；先重驗A01/A02，再以隔離fresh-profile runner執行其餘必要矩陣。

2026-10-19 R2 result：`QA_FAILED / RELEASE_FOR_REPAIR`。首輪A01 ASCII start與A02 npm gate已修復並重驗；新A04缺陷在Chrome/Edge fresh profiles皆重現：360×640時可見且enabled的`+ 新增設備`被`.react-flow__pane`攔截一般pointer hit-test，未使用force click。1280/1024/768相同入口通過。其餘Browser/交換證據依實際斷言降為PARTIAL，edit/delete、stop/start/reopen、canonical equality、blocking/ack/exclusion、legacy/future、sentinel injection及未觀測離線channel維持NOT RUN/BLOCKED。完整報告：[qa-bta-001-r2-2026-10-19.md](../../dev測試紀錄/qa-bta-001-r2-2026-10-19.md)。owned service已停止，4317 listener 0；next owner DEV同票修360px，再交R3 fixed packet。

2026-10-19 QA resume：使用者要求測試組重新進入測試狀態並接受派單。QA 已重新核對指定 worktree／branch／HEAD 與 dirty changes，確認可接收同票 R3 re-test；並已通知 PM 與 DEV。因尚未收到 DEV 停止寫入且具 ZIP SHA-256、artifact/source manifest、sourceDrift 與 cleanup 證據的 R3 fixed packet，本票正式狀態仍保留 `QA_FAILED / RELEASE_FOR_REPAIR`，僅標記為 `READY-TO-RECEIVE`，不得提前改為 `IN_QA`。收到固定候選後先重驗 360px blocker，再執行 R1.1 既定未完成矩陣；不 stage／commit／push／Release／deploy。

2026-10-19 PM depth-gap preparation：QA 接受明確準備派單，依既定 Browser/UI、下載、IndexedDB 與匯入 Preview seams，以 TDD 補齊 A04 edit/delete、A05 stop/start同profile、A06 Full/Safe canonical round-trip、A07 blocking/warning/ack/exclusion、A09 sentinel positive-control／sink scan、A10 legacy/future/ZIP拒絕的 machine-readable matrix、fixtures與fail-closed preflight。三個預期紅燈歷史保留，最終 explicit QA self-tests `11/11 PASS`、兩支 runner syntax PASS、scoped diff-check PASS。詳細資產與hash見 [browser runner preparation](../../dev測試紀錄/qa-bta-001-browser-runner-preparation-2026-10-19.md)。產品尚未執行，票況仍為 `QA_FAILED / READY-TO-RECEIVE`；R3實際selector／package lifecycle／Preview與download assertions待固定候選後正式跑，不以工具自測代產品驗收。

2026-10-19 R3 re-test start：DEV 交付 fixed ZIP SHA-256 `49a37e0d80680a2fa460f9677fbf012af6b4b25fb015d7100477d2ba25b1f4fd`，package內 `beta-manifest.json` SHA-256 `a9578e150e328d6ffcdf91a037b34a9331fec03b2b9531c784fafce8d9dc7607`，source manifest identity `678a393757cc35b6d93537bc4b0e7f5372701a1a53bf066fd27b79c390a4a663`，`sourceDrift=[]`、writer stopped、4317 listener 0、staged 0。QA 已獨立核對 branch／HEAD與ZIP／artifact manifest，狀態轉 `IN_QA`；先執行 360px blocker，再執行固定 R1.1 深度矩陣。R1/R2失敗與未驗歷史不覆寫。

2026-10-19 R3 result：`QA_FAILED / RELEASE_FOR_REPAIR`。R2 360px blocker在fresh Chrome／Edge四寬度正常pointer hit-test皆PASS，Edge資源錯誤未重現；但R1.1 A04明確要求group create-edit-delete，真Browser建立容器後沒有任何edit/delete入口（兩者control count皆0），構成新產品契約失敗。A08由OPS依PM授權嘗試暫時Windows enforcement規則仍Access Denied，`RULE_PRESENT=NO`，維持必要gate BLOCKED；CSP／Browser route僅partial。explicit transfer/security module regression `41/41 PASS`，不替代A05–A10尚未完成的Browser深度案例。QA工具ESM loader及response evidence race均以TDD修復，最終工具自測`13/13 PASS`。完整報告：[qa-bta-001-r3-2026-10-19.md](../../dev測試紀錄/qa-bta-001-r3-2026-10-19.md)。`stop.cmd`成功、4317 listener 0、contexts closed、staged 0、ZIP hash不變；next owner DEV同票補group edit/delete並重建fixed packet，A08另由OPS／PM持有。不commit／push／Release／deploy。

2026-10-19 R3 non-group continuation：DEV 唯讀確認 group 刪除成員語意需 PM／使用者裁定，產品與 R3 ZIP 保持固定、writer stopped；並明確交回 A05–A10 不依賴 group 決策的深度驗證。QA 因此只對此固定候選重新進 `IN_QA`，鎖定新版 QA tool hashes後執行；A04 group缺口仍為FAIL、A08仍BLOCKED，任何非group結果不覆寫兩者。

2026-10-19 R3 non-group result：A05真正package stop/start同owned profile、A06 Full/Safe JSON/CSV四種Browser round-trip independent equality、A07 blocking/warning/ack/exclusion/Cancel zero-write、A09 sentinel positive-control＋實際惡意輸入＋DOM/Dexie/console/network/JSON/解壓CSV/package scan、A10 legacy/future/malformed/ZIP均完成並PASS。最終deep evidence SHA `77543de74d153eb636bba7ad7816f80be008c8e0af58f5ab225ee90adadcf300`，runner SHA `186f2b3f1bb86b04bb1d92f65bae7ef809d4a1dacc767dd5346f207d0888f7de`，工具自測13/13；兩輪start/stop成功、context closed、listener 0、staged 0、ZIP hash不變。完整補驗見 [R3報告續段](../../dev測試紀錄/qa-bta-001-r3-2026-10-19.md)。整票仍 `QA_FAILED / RELEASE_FOR_REPAIR`：A04 group edit/delete未解，A08 enforcement平台BLOCKED，不可PRE-COMMIT ready。

2026-10-19 group semantics preparation：使用者核准「刪除容器保留設備與連線、成員改未分類」，PM交DEV同票修復並要求QA只準備、不測mutable產品。QA以TDD新增空組／非空折疊組／跨組連線fixture、edit/delete transition與Cancel/storage failure/readonly exact zero-mutation assertions；首輪RED、最終QA tools `17/17 PASS`。資產hash與dependency impact map見 [Browser runner preparation](../../dev測試紀錄/qa-bta-001-browser-runner-preparation-2026-10-19.md)。票況維持 `QA_FAILED / READY-TO-RECEIVE`，等新fixed ZIP＋writer-stop後重驗；A08仍BLOCKED。

2026-10-19 DSG oracle alignment：收到R1.1 §12 contract raw SHA `69e3e5aa31d831a143fbd1999451a857d2e15d5bc038ef6d17b19e96e3222f1d`。QA補上Device/Link/Group raw order精確保留與missing-target fail-closed，新增RED後最終tools `18/18 PASS`；最新assertions SHA `f94547be982798e05b08781326948cd3631380b92f074915889a89ae4f0f9f12`、test SHA `012aa4c3b0e5aa00cc390714b2eda0177cae04576405113ddb707b53abbefd65`。確認文案affected count、各zero-write／false-success、reload/export/restore與雙Browser四寬度仍待新fixed packet真Browser驗證。

2026-10-19 R4 metadata alignment：PM 核准沿現有handoff packet列出contract path/revision/raw SHA，packet另取自身SHA並綁source manifest／ZIP；非runtime契約正文不必進ZIP，也不因此改producer。QA正式接收時會獨立核contract、packet、source與ZIP四方identity；漂移／缺欄先停止釐清。產品helper與runtime dependency仍須在完整source closure。此為接收準備，不是candidate鎖定或PASS。

2026-10-19 R4 re-test start：DEV 交付 `READY_FOR_QA` fixed packet 並停止產品寫入。QA 獨立核對 branch／HEAD、packet raw SHA、contract R1.1 §12 raw SHA、ZIP outer SHA／sidecar、package manifest、74 個 source inputs 與完整 source closure；實際 source drift 0、4317 listener 0、staged 0。四方 identity 一致後狀態轉 `IN_QA`。本輪保留 R1–R3 `QA_FAILED` 歷史，重驗 A04 group oracle、A05/A06/A09 impact graph與 Chrome／Edge 四寬度；A07/A10僅在 closure／hash證明未受影響後判定是否可沿用，A08 enforcement平台 `BLOCKED` 不重試防火牆。

2026-10-19 R4 result：產品修復範圍獨立驗收通過。QA-owned group oracle／harness `21/21 PASS`，包含真 page handler readonly／stale scope／missing target fail-closed；真 R4 ZIP 以 isolated Playwright、fresh Chrome/Edge profiles 在 360/768/1024/1280 完成 edit、非空與空 group delete、Cancel、IndexedDB failure、reload/export，A04 PASS。固定 R4 package另重跑 A05/A06/A07/A09/A10 均 PASS。contexts closed、owned server stopped、4317 listener 0、ZIP hash不變、staged 0。整票改 `BLOCKED` 而非 `QA_PASSED`，因必要 A08 OS-level enforcement仍缺平台權限；Browser route/CSP不替代。完整報告：[qa-bta-001-r4-2026-10-19.md](../../dev測試紀錄/qa-bta-001-r4-2026-10-19.md)。Next owner PM 安排可執行 A08 的環境；無產品退修、無Git／Release授權。

2026-10-19 A01–A12 closure correction：依PM要求補全總表，不再寫成「唯一只剩A08」。A01依R2獨立雙路徑QA＋R4未變runtime/producer與smoke判PASS；A02 npm/Node真替代安裝、lock/partial/occupied負向仍PARTIAL；A03完整host/network boundary PARTIAL；A11 forged/stale/unknown-owner/crash/unrelated-process矩陣PARTIAL；A12在核准provenance/license/filename/四方identity範圍PASS，但active env/DSN/secret依禁令未讀、完整人工內容審閱PARTIAL。DEV 12/12未計入QA，未變hash也未用來掩蓋NOT RUN。整票仍BLOCKED，詳見R4報告總表。

2026-10-19 safe gap closure：依PM具名範圍以QA-owned clean extraction補驗。A02 repeat setup／partial install recovery／lock tamper／owned occupied listener PASS，Node/npm old/new維持controlled seam而非替代binary相容宣稱；A03真IPv4 loopback Host/Origin/FetchMetadata/protected/dev-header deny PASS，非loopback inbound因禁開LAN未實測；A11 forged/unknown owner、stale state、精確proof後owned forced crash與dummy preservation PASS；A12 package 48-file allowlist/license/notices/sample/public metadata/identity與合成secret scan PASS，active env/DSN/秘密未讀。evidence SHA `113ea55b30f52f527b3610449b32976eea871fab63f328dc18b213ccbf3737d2`，cleanup 4317=0、ZIP unchanged、staged0。整票仍因A08 BLOCKED，不改產品。

