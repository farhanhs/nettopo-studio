# DEV_BTA_002 — 預建執行 ZIP 與 setup/start/stop、離線資源

| 欄位 | 值 |
|---|---|
| Group / Feature / Priority | DEV / BTA / P1 |
| Status | READY_FOR_QA |
| Planned Order | 157 |
| Owner | 開發組 / 019fa64f-d5f1-7d61-bf93-47a9e7c293c7 |
| Development Branch | codex/public-beta-0.1 |
| Worktree | C:/Users/DUS/Desktop/project/nettopo-studio/.local/worktrees/public-beta-0.1 |
| Base Commit | b5c53916cbda6f8bcd2f42f9d9772ef181c1adee（2026-10-19 FF；原始a9abe63保留歷史） |
| Integration Target | codex/public-beta-0.1；不合併其他分支 |
| Created / Updated | 2026-10-09 / 2026-10-19 |
| Governance / Work Package | root R3；PM_BTA_001；[核准計畫](C:/Users/DUS/Desktop/project/nettopo-studio/docs/開發計畫/2026-10-09-local-feedback-beta-plan.md) |
| Engineering commit authority | 無；第一個必要獨立驗收PRE-COMMIT停，不stage/commit |
| Release / push / integration / deploy / live | 僅PM已完成建立GitHub baseline分支；後續push/tag/Release/merge/deploy/live未授權 |

## Objective / Requirement Traceability

生產者建置、runtime dependency closure/manifest/lock、預建ZIP、安全setup/start/stop、owned resource、固定loopback origin、離線字體/assets。Node由下載者安装，不附Node；首次setup可下載相依；日常不build/安裝/外傳或更新。

來源為本對話使用者「核准，請先開在github開分支然後馬上派單」及計畫Q1–Q12。首次install可連網、日常離線；Windows＋Chrome/Edge、單人IndexedDB、匿名案例、預建程式、Node自備。不是R3正式人事B工作包。root dirty Auth、checkpoint dirty NTM/QA和AIL全部排除。已有13檔UIX基準delta做常見secret-pattern/禁止路徑查核零命中；這不是全歷史/active-secret或Beta secret PASS。

## Dependencies / Next owner

DEV_BTA_001、DSG_BTA_001；先驗portable artifact最小可行性，若無法符合契約立即回PM，不改成讓使用者build。

Next owner：同一primary DEV接DEV_BTA_003；候選寫入完畢才正式QA。

## Allowed Files / Systems

scripts/beta/**、release/beta/**或契約具名runtime-package位置；必要package.json/lock hunk、build入口；app/layout.tsx/public本地資源離線hunks；自身tests/dev-bta-002*.mjs與票/log/register。dist/node_modules/.local只做ignored自有產物，不提交。

開始前讀root AGENTS/R3/BRANCH-MAP及本樹票；再次核branch/HEAD/dirty。只在本樹工作，不直接用root工作位置。正式QA時產品固定、一個primary產品writer。各owner只更新自身票及register列，PM維護治理／package source。

## Out of Scope / Forbidden Changes

不開NTM/CSVv3/AIL/HR/監控/新功能，不讀現用.env/DSN/秘密、不用現用DB或公司API/OTP，不安裝Docker/全域Node/Browser/新plugin、不重設使用者資料。不改正式RBAC/CSV/secret原契約，不將QA_FAILED/NOT RUN改PASS或移除獨立QA斷言。不stage/commit/push/tag/Release/merge/deploy，不改寫Git歷史、不搬另一工作樹候選。安裝必要workspace相依僅限本樹／具名自有隔離目錄，記artifact/hash/cleanup，不覆用另一工作線node_modules或env。

## Acceptance / Verification Evidence

BTA-A01/A02/A08/A11 producer自測，含乾淨中文/空白路徑、無現用env、缺Node/相依、port衝突、重跑setup、stop ownership。vinext在devDependencies，不能假定原npm ci --omit=dev完整；包不依賴开发checkout node_modules；來源commit/build/deps/hash可追溯。

Required acceptance IDs依核准計畫 BTA-A01–12；具體契約完成後列適用矩陣，必要項不削減。candidate、tools、deps及artifact測前後hash、實際版本、結果、owned cleanup與next owner都需記錄。Code/QA/Git/live分開。

| Evidence | Result | Date |
|---|---|---|
| PM baseline branch / clean worktree | a9abe637f0ad419aced6d31faf30a127ce5b81e6；正式產品測試NOT RUN | 2026-10-09 |
| 此票實作／獨立驗收 | NOT RUN | 2026-10-09 |

## 2026-10-19 DEV self-check

build-04 CI/no-DSN成功；portable-04真ZIP在中文空白目錄setup/start/重複start/stop完成。Chrome 155.0.8059.82、Edge 155.0.4283.45新context免登入、cookies=0、編輯/儲存/reload/ELK與非loopback攔截preflight通過；產品header/API gate正常。保留portable-02/03失敗歷史：CIM編碼與Vinext callable handler已修正。Windows CIM中文路徑測試先FAIL後PASS。封裝hash/manifest/integrity本地測試通過，獨立QA仍NOT RUN；003將補公開文件/完整授權正文並重建最終包。

## Risks / Stop / Handoff History

### 2026-10-19 Engineering Archive Authorization

使用者另核准本機工程存檔commit，不push/發布，A08維持BLOCKED。隨收錄此註記的commit保存固定R4 producer/runtime/測試閉包，不改受驗封裝工具或重標ZIP；原base鎖定及新HEAD直接package限制見 [工程存檔紀錄](../../dev開發紀錄/2026-10-19-beta-engineering-snapshot.md)。狀態READY_FOR_QA不升級，不代表整包驗收或Release-ready。

### 2026-10-19 QA Return Fix R2

- 根因：Windows 對無空白 entry 不加引號；原 ownership 用固定雙引號字串比對造成誤拒。先以真 child/CIM 測試重現 ASCII FAIL、中文空白 PASS，再改為精確兩個參數比對，仍驗 executable、entry、PID/creation time；額外參數、不同 entry、偽造時間均拒絕。
- setup 在建立狀態／安裝相依前讀取同一 Node 附帶 npm package metadata，精確比對 manifest；缺少／舊／新／malformed 回 BTA_NPM_VERSION_UNSUPPORTED、exit 2。setup marker 記錄 npm，daily start 只驗 marker，不呼叫 npm/network。QUICKSTART 同步前置條件。
- 新固定 ZIP：artifacts-r2/NetTopo-Studio-0.1.0-beta.1.zip，SHA256 a309fd30f4954d3562f56aa4715a2ec1fd51d3da7fdaa56c7bec983ba9677f2c（完整路徑與 manifest 見開發日誌）。
- DEV targeted 12/12、serial regression 128/128、tsc、scoped ESLint、no-DSN build-07、diff-check PASS；payload scan 0 findings。ASCII／中文空白兩個實際 ZIP 完成 setup/start/start/stop/stop/re-setup，未知 listener 不被終止；npm mismatch 實際 setup 零安裝／零狀態。
- 保留首輪 QA_FAILED、舊包 0054e989 與此次 DEV 測試漏帶 Fetch Metadata 的失敗紀錄；只修 DEV fixture，未改 request gate 或 QA 斷言。本輪 Browser NOT RUN，不取代獨立驗收。
- 產品 writer 停止，next owner QA_BTA_001 同票 re-test。平台 Browser 權限與 A08 分通道證據仍由 QA/PM 處理；不重試既有視窗控制。index 空，4317 無 listener，不 stage/commit/push。

2026-10-19 QA_BTA_001首輪QA_FAILED/RELEASE_FOR_REPAIR，接回唯一writer：修復ASCII無空白entry命令列歸屬與npm版本prerequisite gate。同票、不改QA斷言；舊ZIP保留，重建新候選。Browser工具BLOCKED另列，不混成產品FAIL。

秘密、資源歸屬、產品QA並行衝突或新語意立即停止受影響部分；缺條件BLOCKED，其他可獨立項仍可準備。普通既有契約缺陷DEV↔QA同票闭環並保留歷史；新package/API/profile语義超出本包交PM。GitHubbranch不是可用Release。

2026-10-09 PM建立本票；送達／實際開工另記，不將送單當IN_PROGRESS或PASS。

2026-10-09 DEV 完成唯讀 runtime/package preflight，狀態仍 BLOCKED。本樹無 node_modules/dist，因此 portable artifact 未驗；現有 start 依賴 dev-only vinext CLI，原 package 的 npm ci --omit=dev 不能直接當 runtime closure。Node producer 入口存在，但需獨立 runtime manifest/lock、乾淨解壓啟動與外網隔離證據；不得改成下載者 build。Sites metadata、env loader、Google fonts、Host/port override 均列精確風險，見 [preflight](../../dev開發紀錄/2026-10-09-dev-bta-preflight.md)。未建置/安裝/啟服務，待 DSG/PM 與 DEV_BTA_001。

