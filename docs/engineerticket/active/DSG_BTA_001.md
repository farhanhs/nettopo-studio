# DSG_BTA_001 — 本機 Beta 最小入口與預建包契約

| 欄位 | 值 |
|---|---|
| Group / Feature / Priority | DSG / BTA / P1 |
| Status | READY |
| Planned Order | 155 |
| Owner | 設計組 / 019fda8a-0b05-7a41-8fe0-b72f8c12ad9d |
| Development Branch | codex/public-beta-0.1 |
| Worktree | C:/Users/DUS/Desktop/project/nettopo-studio/.local/worktrees/public-beta-0.1 |
| Base Commit | current b5c53916cbda6f8bcd2f42f9d9772ef181c1adee；original a9abe637f0ad419aced6d31faf30a127ce5b81e6 retained in history |
| Integration Target | codex/public-beta-0.1；不合併其他分支 |
| Created / Updated | 2026-10-09 / 2026-10-19 |
| Governance / Work Package | root R3；PM_BTA_001；[核准計畫](C:/Users/DUS/Desktop/project/nettopo-studio/docs/開發計畫/2026-10-09-local-feedback-beta-plan.md) |
| Engineering commit authority | 無；第一個必要獨立驗收PRE-COMMIT停，不stage/commit |
| Release / push / integration / deploy / live | 僅PM已完成建立GitHub baseline分支；後續push/tag/Release/merge/deploy/live未授權 |

## Objective / Requirement Traceability

本機 profile／入口／Host-Origin／API deny；runtime artifact/dependency closure、setup/start/stop與固定origin、可搬移性；離線字體、既有逐拓樸JSON備份/還原、MIT/notices與public內容清單；BTA-A01–12正常、拒絕、恢復條件。不要重設現有拓樸功能或新增workspace backup schema。

來源為本對話使用者「核准，請先開在github開分支然後馬上派單」及計畫Q1–Q12。首次install可連網、日常離線；Windows＋Chrome/Edge、單人IndexedDB、匿名案例、預建程式、Node自備。不是R3正式人事B工作包。root dirty Auth、checkpoint dirty NTM/QA和AIL全部排除。已有13檔UIX基準delta做常見secret-pattern/禁止路徑查核零命中；這不是全歷史/active-secret或Beta secret PASS。

## Dependencies / Next owner

PM_BTA_001 已核准；source a9abe637f0ad419aced6d31faf30a127ce5b81e6

PM範圍核對已完成並要求同票修正後直接交接。Next owner：`DEV_BTA_001`；同一 primary DEV 依序處理001→002→003，不得開第二條產品writer或自行發布。

## Allowed Files / Systems

docs/engineerticket/contracts/LOCAL-FEEDBACK-BETA-V1.md；自身票；自身register列；docs/dev開發紀錄/2026-10-09-dsg-bta-001.md。

開始前讀root AGENTS/R3/BRANCH-MAP及本樹票；再次核branch/HEAD/dirty。只在本樹工作，不直接用root工作位置。正式QA時產品固定、一個primary產品writer。各owner只更新自身票及register列，PM維護治理／package source。

## Out of Scope / Forbidden Changes

不開NTM/CSVv3/AIL/HR/監控/新功能，不讀現用.env/DSN/秘密、不用現用DB或公司API/OTP，不安裝Docker/全域Node/Browser/新plugin、不重設使用者資料。不改正式RBAC/CSV/secret原契約，不將QA_FAILED/NOT RUN改PASS或移除獨立QA斷言。不stage/commit/push/tag/Release/merge/deploy，不改寫Git歷史、不搬另一工作樹候選。安裝必要workspace相依僅限本樹／具名自有隔離目錄，記artifact/hash/cleanup，不覆用另一工作線node_modules或env。

## Acceptance / Verification Evidence

欄位／env／命令／manifest/lock/runtime imports／錯誤碼及UI映射明確；是否無DSN成功build須驗前置，不能補假DSN；原safe/full/五CSV契約不放寬。只在本機免公司登入，不新增Boss或正式RBAC繞過。完成交PM做範圍核對；無歧義且符合核准包可交DEV，新增語意／超範圍再升級。

Required acceptance IDs依核准計畫 BTA-A01–12；具體契約完成後列適用矩陣，必要項不削減。candidate、tools、deps及artifact測前後hash、實際版本、結果、owned cleanup與next owner都需記錄。Code/QA/Git/live分開。

| Evidence | Result | Date |
|---|---|---|
| PM baseline branch / clean worktree | a9abe637f0ad419aced6d31faf30a127ce5b81e6；正式產品測試NOT RUN | 2026-10-09 |
| 此票實作／獨立驗收 | NOT RUN | 2026-10-09 |

## Design Output — 2026-10-09

`DSG_BTA_001 = READY`

- Contract: [LOCAL-FEEDBACK-BETA-V1.md](../contracts/LOCAL-FEEDBACK-BETA-V1.md)
- Design log: [2026-10-09-dsg-bta-001.md](../../dev開發紀錄/2026-10-09-dsg-bta-001.md)

### Fixed design

1. `local-beta` 是明確 RuntimePolicy capability：`authMode=disabled`、IndexedDB、固定 `127.0.0.1:4317`。它只解除本機 UI LoginGate，不建立正式身分、role、session 或任何 server 權限。
2. package server 在 worker 前依精確矩陣檢查 Method、Host、Origin、Fetch Metadata、loopback peer與control token；Browser originless same-origin GET、RSC/framework資源與Node status/shutdown各有窄例外，其他 `/api/*` 固定安全拒絕。
3. 預建 ZIP 由 base commit＋allowlisted dirty source manifest 產生，記錄工具、依賴及無循環hash；實際 Node build import closure生成最小runtime package/lock。`vinext`目前在devDependencies，禁止以原package `npm ci --omit=dev`冒充完成；若runtime真需要它，必須在產生的runtime manifest明列並鎖版。
4. `setup.cmd` 只安裝 locked runtime deps、不 build；`start.cmd` 不安裝／更新／外連；`stop.cmd` 只用 state＋PID/start time＋instance/token 停 owned process，未知 port/process 不殺。
5. 日常所有 app 資源必須自託管，斷外網只保留 loopback。現有字體 cache 不是驗收，須以實際 ZIP＋新 Browser profile 證明。
6. 不新增完整 workspace backup、schema或API；沿用既有逐拓樸完整JSON與Preview/Apply。多張拓樸逐張備份，不承諾還原Customer主檔或UI設定；觸發瀏覽器下載不等於已保存。分享沿用原JSON／五檔CSV v2 safe/full，不做v3。
7. MIT 權利人固定 `sean.hsieh`；第三方 notices、匿名 sample、手動 GitHub Issue → PM 轉內部 Markdown。無自動上傳。

### Honest blockers/gates

- Producer 必須在 DB/env/secret 全 absent 下成功 build；若仍需 DSN，DEV_BTA_002 BLOCKED，禁止假 DSN。
- Portable runtime closure、實際 Windows/Node/Chrome/Edge 支援版本、離線資源與 BTA-A01–12 均尚未驗；不得寫成可用 Release。
- 本票不更改拓樸、CSV、RBAC、secret、HR、NTM、AIL 或監控語意。
- 設計期間另有 QA-owned `tests/fixtures/`／`tests/qa-bta-001-preparation.test.mjs` 出現；本票未讀、未改、未執行，不能作產品或獨立驗收 PASS。

### Handoff

PM scope review修正已納入，直接交同一開發組的 `DEV_BTA_001`。`DEV_BTA_001 → DEV_BTA_002 → DEV_BTA_003 → QA_BTA_001`；本工作包的一般既有契約 bug 依 R3 同票修復，不逐項重問；新 profile/package member/network/schema/auth/license 語意或超範圍才升級。這不授權第二條產品writer或任何Git/Release動作。

## Risks / Stop / Handoff History

秘密、資源歸屬、產品QA並行衝突或新語意立即停止受影響部分；缺條件BLOCKED，其他可獨立項仍可準備。普通既有契約缺陷DEV↔QA同票闭環並保留歷史；新package/API/profile语義超出本包交PM。GitHubbranch不是可用Release。

2026-10-09 PM建立本票；送達／實際開工另記，不將送單當IN_PROGRESS或PASS。

2026-10-09 設計組核對 `codex/public-beta-0.1`／`a9abe637f0ad419aced6d31faf30a127ce5b81e6` 與本樹 dirty 後正式開工；只修改本票核准的設計文件，不觸碰產品或其他工作線候選。

2026-10-09 最小契約與設計日誌完成，票轉 `WAITING_APPROVAL` 交 PM scope check；產品／測試／安裝／Git／Release 全部未執行。

2026-10-09 PM scope review要求同票修正：移除新workspace backup、補精確request matrix、runtime/tools與canonical hash/lifecycle、dirty PRE-COMMIT provenance、local-beta no-DSN窄例外及公開內容邊界。R1.1完成後本票轉`READY`並交DEV_BTA_001；未修改產品，未執行測試或Git/Release。

## 2026-10-19 R1.1 Group semantics addendum

使用者已裁定刪除容器採「保留設備與連線，成員改為未分類」。依 root [PM Beta resume 最後一節](C:/Users/DUS/Desktop/project/nettopo-studio/docs/dev開發紀錄/2026-10-19-pm-beta-resume.md)，已在既有 [LOCAL-FEEDBACK-BETA-V1](../contracts/LOCAL-FEEDBACK-BETA-V1.md) §12 追加窄幅契約，不重開整體設計、不作 DEV 前置等待。

- edit：只改既有 `name/kind/color`，保留 `id/collapsed` 與全部 membership；
- delete：確認後只移除目標 Group，將其 member `groupId` 清為 `undefined`；所有 Device/Link/座標/端點/其他 Group 保留；
- Cancel、missing target、persistence failure、read-only 均零 mutation；單一 Project updater + 既有 Dexie commit-before-publish 邊界；不得先顯示成功；
- allowed product hunks 僅 `page.tsx` Group 操作、直接相關 `globals.css`、可選純 `topology-group-operations.ts`；不改 store/schema/API/DB/RBAC/CSV/QA；
- A08 平台 `BLOCKED` 不變，必要 QA 後仍 PRE-COMMIT，無 Git/Release 權限。

本次設計同步只修改 contract、本票／設計日誌及 register 本列。產品、DEV/QA tests、其他票與候選未由 DSG 修改。`DSG_BTA_001` 維持 `READY`；next product owner 仍為已獲 PM 授權的 `DEV_BTA_001`，QA_BTA_001 對新固定 packet 獨立重驗。

