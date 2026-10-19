# DEV_BTA_003 — 試用文件、合成範例、MIT及回饋範本

| 欄位 | 值 |
|---|---|
| Group / Feature / Priority | DEV / BTA / P1 |
| Status | READY_FOR_QA |
| Planned Order | 158 |
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

繁中快速說明、合成範例、已知限制、備份還原/升級、資料位置提示、MIT Copyright (c) 2026 sean.hsieh、第三方notices、外部GitHub Issues範本（僅本地檔）。

來源為本對話使用者「核准，請先開在github開分支然後馬上派單」及計畫Q1–Q12。首次install可連網、日常離線；Windows＋Chrome/Edge、單人IndexedDB、匿名案例、預建程式、Node自備。不是R3正式人事B工作包。root dirty Auth、checkpoint dirty NTM/QA和AIL全部排除。已有13檔UIX基準delta做常見secret-pattern/禁止路徑查核零命中；這不是全歷史/active-secret或Beta secret PASS。

## Dependencies / Next owner

DEV_BTA_001/002；runtime及備份契約固定。

Next owner：QA_BTA_001 正式固定包驗收；PRE-COMMIT停。

## Allowed Files / Systems

README.md必要Beta段、docs/beta/**、LICENSE、THIRD_PARTY_NOTICES.md、public具名合成範例、.github/ISSUE_TEMPLATE/beta-feedback.yml；必要公開公司品牌移除hunks先依DSGallowed path核對；自身測試/票/log/register。

開始前讀root AGENTS/R3/BRANCH-MAP及本樹票；再次核branch/HEAD/dirty。只在本樹工作，不直接用root工作位置。正式QA時產品固定、一個primary產品writer。各owner只更新自身票及register列，PM維護治理／package source。

## Out of Scope / Forbidden Changes

不開NTM/CSVv3/AIL/HR/監控/新功能，不讀現用.env/DSN/秘密、不用現用DB或公司API/OTP，不安裝Docker/全域Node/Browser/新plugin、不重設使用者資料。不改正式RBAC/CSV/secret原契約，不將QA_FAILED/NOT RUN改PASS或移除獨立QA斷言。不stage/commit/push/tag/Release/merge/deploy，不改寫Git歷史、不搬另一工作樹候選。安裝必要workspace相依僅限本樹／具名自有隔離目錄，記artifact/hash/cleanup，不覆用另一工作線node_modules或env。

## Acceptance / Verification Evidence

BTA-A05/A06/A07/A10/A12所需文件與DEV回歸具證據；public feedback不含敏感圖/原始組態，不自動上傳；safe分享≠完整匿名備份，按原canonical/safeCanonical。不可聲稱NTM、AI、HR、監控已可用。MIT不改第三方條款。完成整包manifest，停止產品寫入。

Required acceptance IDs依核准計畫 BTA-A01–12；具體契約完成後列適用矩陣，必要項不削減。candidate、tools、deps及artifact測前後hash、實際版本、結果、owned cleanup與next owner都需記錄。Code/QA/Git/live分開。

| Evidence | Result | Date |
|---|---|---|
| PM baseline branch / clean worktree | a9abe637f0ad419aced6d31faf30a127ce5b81e6；正式產品測試NOT RUN | 2026-10-09 |
| 此票實作／獨立驗收 | NOT RUN | 2026-10-09 |

## 2026-10-19 fixed candidate

文件、MIT、合成JSON/CSV及28套件/30份完整license-notice來源已補；@vitejs/plugin-rsc npm缺根license，補官方0.5.26 tag正文及隨包vendor license，沒有把第三方條款改成專案MIT。

三票固定包 `.local/bta-20261019/artifacts/NetTopo-Studio-0.1.0-beta.1.zip`，SHA256 `0054e9897492a9a6152dd1066d7df7e29f924e10a2e1426e58d75ae2ef72d15b`。Source manifest `e8afd08d2f54a4ea235c056f653cdc4569fe73d2c7736843dce8e9fd42776a10`，不是HEAD等價宣告。

DEV正向清單127/127，真ZIP/CIM兩項2/2、tsc、scoped ESLint、diff-check、CI no-DSN build、46檔payload及巢狀sample ZIP掃描通過。Chrome/Edge寫入失敗zero mutation與實際非空JSON備份通過。Full lint執行exit1（Windows Bash launcher失敗）；原生DB、現用env/live未執行。詳細命令/hash/evidence及剩餘QA矩陣見[開發紀錄](../../dev開發紀錄/2026-10-19-dev-beta.md)。

產品writer停止，next owner QA_BTA_001獨立驗收；QA期間不修改候選，退修由同票release-for-repair。狀態非QA PASS、不stage/commit/push/Release/deploy。

## Risks / Stop / Handoff History

### 2026-10-19 Engineering Archive Authorization

使用者另核准本機工程存檔commit，不push/發布，A08維持BLOCKED。隨收錄此註記的commit保存R4公開說明、notices、canonical合成範例與QA紀錄；不改QA結論或擴大public release權限。精確path及未驗限制見 [工程存檔紀錄](../../dev開發紀錄/2026-10-19-beta-engineering-snapshot.md)。票況READY_FOR_QA保留，已存檔不等於驗收完成。

秘密、資源歸屬、產品QA並行衝突或新語意立即停止受影響部分；缺條件BLOCKED，其他可獨立項仍可準備。普通既有契約缺陷DEV↔QA同票闭環並保留歷史；新package/API/profile语義超出本包交PM。GitHubbranch不是可用Release。

2026-10-09 PM建立本票；送達／實際開工另記，不將送單當IN_PROGRESS或PASS。

2026-10-09 DEV 完成唯讀文件/公開內容 preflight，狀態仍 BLOCKED。LICENSE/notices/Beta說明尚無；layout/page 公司識別與 store 具名 local user、Demo chunks/範例需列 DSG allowed hunks。MIT 權利人沿使用者 sean.hsieh，但未檢完第三方正文/素材；safe 分享不等於完整備份，feedback 禁自動上傳敏感內容。見 [preflight](../../dev開發紀錄/2026-10-09-dev-bta-preflight.md)。只追加交接紀錄，未建立產品文件/授權/範例候選或做發布；待 runtime/資料契約固定。

