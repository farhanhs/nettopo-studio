# DEV_UIX_007 — Topbar 中等寬度登入者與操作區防重疊

## 本輪解除暫停確認與送達 — 2026-10-06

PM明確詢問解除先前暫停、恢復本票R2退修及獨立自動驗收後，使用者直接回覆「請送單」。本輪開發組派送工具已成功；下方BLOCKED是前次拒絕歷史，不是最新停令。scope及QA release/cleanup/writer互斥條件沿原A/R3；實際開始由DEV確認後改狀態。必要QA及checkpoint gate後本地commit，不push／跨分支整合／部署。

## PM R1 重驗退修／續行 — 2026-10-06

派送狀態：READY；使用者已於 2026-10-06 明確解除暫停並要求重新進入測試狀態與接受派單。R1 QA 已結束並 release-for-repair；本票由開發組接續 R2 修復，尚未代表 DEV 已實際進入 `IN_PROGRESS`。

使用者再次指示「請繼續派發處理」。QA已結束R1 Browser batch：768修復後繼續在1024×900觀測到七個控制被不可捲動topbar裁切（含登出）；Inspector/Canvas影響測試報PASS。證據：[R1 Browser summary](../../dev測試紀錄/2026-10-06-uix-007-r1-retest/qa-uix-003-topbar-responsive-summary.json)。這是原responsive契約的產品FAIL，不是新需求，不新開DSG。

Next owner開發組：先核對QA已結束／owned cleanup／release-for-repair與無active產品QA，再沿本票改IN_PROGRESS修復。不能只對1024特判：釐清共用topbar高度、內容換行與overflow在既有各breakpoint的根因，於768/1024/1280、短高度及breakpoint邊界補DEV回歸。允許路徑仍topbar JSX/CSS hunk與DEV focused test，禁止改auth/session、Canvas行為或獨立QA斷言。

交新revision R2候選/manifest/impact map，R1與歷史packet原樣保留；新revision checkpoint packet不得沿用R1 hash冒稱等價。修復READY_FOR_QA後由QA_UIX_003獨立重驗，再接QA_PIL_006。未通過必要獨立QA及中間態gate前不stage/commit；不push／整合／部署。PM不把發單當已開始，實際狀態由DEV記錄。

| 欄位 | 值 |
|---|---|
| Group | DEV |
| Feature | UIX |
| Priority | P1 |
| Status | DONE |
| Planned Order | 072 |
| Change Type | CORRECT |
| Owner | 開發組 |
| QA | QA_UIX_003 |
| Development Branch / Integration Target | codex/dev-rel-001-checkpoint / 同分支 checkpoint；無跨分支整合授權 |
| Worktree | C:/Users/DUS/Desktop/project/nettopo-studio/.local/worktrees/dev-rel-001-checkpoint |
| Recorded Base | 1b0b084518886cda347f175bfc959401fd1d18ed；開工另記 dirty candidate |

## Local Checkpoint — 2026-10-09

- Commit: `c481ab43a059e4d6eac782e01ba82c9b774928f1`.
- Committed-tree cumulative focused tests: 8/8 PASS.
- Scope: local checkpoint only; no push, merge, integration, or deployment.

## D42 A 開工核准 — 2026-10-05

使用者已核准 [A-WP-20261005](C:/Users/DUS/Desktop/project/nettopo-studio/docs/開發計畫/2026-10-05-a-topology-work-package.md)；本票 READY 交開發組，實際收件並確認無 active QA/writer 後自行改 IN_PROGRESS。10/03 QA_FAILED 保留，不等於已修好。

本批 CORRECT 只處理既有退件的 768 breakpoint topbar height/layout/overflow及 DEV focused test；不動 auth/session、Canvas或006/008行為，不改独立QA斷言。舊10/02 packet原樣保留，新候選另產 revision/manifest/hash，READY_FOR_QA交QA_UIX_003及A工作包。

依 root [R3](C:/Users/DUS/Desktop/project/nettopo-studio/docs/engineerticket/contracts/DEVOPS-AGILE-WORKFLOW.md) 取得本 checkpoint 必要獨立 QA 與中間態測試後，可精確 staging 小批次本地 commit；取代舊 packet 的再次等待批准要求。不 push、整合、部署或使用現用 DB/env。

## A 工作包開工 — 2026-10-05

- 實際位置：`codex/dev-rel-001-checkpoint`，HEAD/base `1b0b084518886cda347f175bfc959401fd1d18ed`。
- 已確認 `QA_UIX_003` 維持 `QA_FAILED` 等待新候選，沒有 active `IN_QA`；開發組為唯一產品 writer。
- 根因：`max-width: 900px` 仍繼承 `.topbar { overflow: hidden; }`，只有 700px／短高度 breakpoint 開啟垂直捲動，導致 768×900 的三列內容在固定 238px 高度內被祖先裁切。
- 修正範圍：只在 900px breakpoint 開啟 `overflow-y: auto` 與 containment，並補 DEV focused regression；舊 10/02 packet／manifest／patch 不變。

## A 工作包候選交付 — 2026-10-05

- Revision：`A-WP-20261005-DEV_UIX_007-R1`；manifest 見 [開發紀錄](../../dev開發紀錄/2026-10-05-dev-uix-007-a-work-package.md)。
- 修改：`app/globals.css` 的 900px breakpoint 與 `tests/dev-uix-007-topbar-responsive.test.mjs` focused regression；`app/page.tsx` 未再修改。
- DEV 驗證：UIX_004／006／007／008 focused tests 15/15、TypeScript、scoped ESLint、no-env local build 全部 PASS。
- Browser 尚未由 DEV 執行，不能宣稱產品已通過；狀態為 `READY_FOR_QA`，next owner `QA_UIX_003`。

## Requirement Traceability

| Gate | 內容 |
|---|---|
| User Intent | 登入身分、測試身分、排版模式及動作按鈕在實際視窗不得互相遮擋 |
| Historical Sources | DEV_UIX_004、QA_PIL_003、DSG_PIL_002 responsive contract；2026-09-08 回報 |
| Approved Decisions | PM_GOV_001-D25/D30/D31 |
| Affected Layers | `app/page.tsx` topbar semantics、`app/globals.css` responsive layout |
| Preserved Invariants | 登入者角色與 logout 保持可見可用；不改 session/auth；不遮擋 workspace |
| Conflict Check | DEV_UIX_004 已完成 1280×900 浮層移位；本票只補中等寬度/zoom 回歸，不重寫歷史 |
| Regression Map | 768/1024/1280、200% zoom、長 email/role、development/Pilot banner、鍵盤操作 |
| No-path | 若需重做資訊架構或隱藏安全身分/登出，停止回 PM |

## Scope and Acceptance

- 在既有 topbar flow 中使用 wrap/grid/compact presentation；不新增 UI 套件。
- 768、1024、1280px 與 200% zoom 無元素重疊或水平溢位，主要動作及 logout 可達。
- 長 email/role 可安全 ellipsis 或換行，完整值保持 accessible。
- Allowed：topbar JSX/CSS hunk與 DEV tests；禁止 auth/session/API、全域 CSS reset。

## DEV Implementation 2026-09-09

- `app/page.tsx`：保留既有 topbar 語意，補登入者名稱/角色 email 的 `title`，並替主要操作列加上 accessible label。
- `app/globals.css`：在既有 topbar flow 補 `min-width: 0`、操作列 `flex-wrap`、中寬/窄寬/短高度 breakpoint；身分、測試身分、排版模式與操作按鈕會改為可壓縮/可換行配置。
- Topbar/Workspace 高度同步收斂為 `.app-shell --topbar-height` token；本票只定義 responsive topbar contract，避免 topbar 與 workspace 高度各自漂移。
- 未改 session/auth/logout，未改 React Flow/PanelGroup/canvas viewport，未改 domain/Dexie/API。
- `tests/dev-uix-007-topbar-responsive.test.mjs`：新增 DEV focused regression，覆蓋 shrink/wrap、長身分 accessible title、breakpoint guard 與 canvas resize non-scope guard。

驗證：

- `node --test tests/dev-uix-007-topbar-responsive.test.mjs`：PASS。
- `node --test tests/dev-uix-006-inspector-remount.test.mjs tests/dev-uix-007-topbar-responsive.test.mjs tests/dev-pil-002-topology-site.test.mjs tests/pilot-checkpoint.test.mjs`：PASS。
- `node node_modules\typescript\bin\tsc --noEmit --pretty false`：PASS。
- `node_modules\.bin\eslint.cmd app\page.tsx app\globals.css tests\dev-uix-006-inspector-remount.test.mjs tests\dev-uix-007-topbar-responsive.test.mjs`：PASS，0 errors；CSS 依現有 config 顯示 ignored warning。
- `npm.cmd run build:local`：PASS；僅既有 chunk size / route classification warning。

交付狀態：`QA_PASSED`；`QA_UIX_003` 已完成 development/Pilot 真 Browser responsive、操作、長身分與 200% zoom 等效驗收。`DEV_UIX_008` 仍獨立負責 app-shell/Canvas dynamic viewport、PanelGroup/React Flow resize sync 與 first-fit 行為，本票沒有加入 fitView、ResizeObserver 或 Canvas 行為。

## Checkpoint Preparation — 2026-10-02

狀態維持 `QA_PASSED`。本票已拆為順序 patch `002-dev-uix-007.patch`；中間態只擁有 topbar title/label/wrap/breakpoints 與高度 token，workspace 暫以 token 計算，flex shell／ResizeObserver／first-fit 保留給 UIX_008。該中間態已由 006 後狀態重建並通過 hash／006+007 focused tests。完整 manifest 見 [checkpoint 準備紀錄](../../dev開發紀錄/2026-10-02-uix-006-008-checkpoint.md)。未 stage／commit／push／merge。

## QA Checkpoint Return — 2026-10-03

目前狀態改為 `QA_FAILED`（同票 R2 退修待開發，尚未進入 `IN_PROGRESS`）；保留 2026-09-09 歷史 QA PASS 與 2026-10-02 frozen patch，不修改 manifest／patch。

- 重現：development/no-DB，viewport 768×900。
- 預期：Topology selector、登入者身分、logout 等必要控制可見且可實際操作，或透過可發現的垂直捲動存取。
- 實際：topbar bottom=238、scrollHeight=447、`overflow-y:hidden`；Topology selector top=280、logout top=390.75，6 個必要控制完全被祖先裁切。
- Runner false-positive：先前只驗 DOM existence/focus，沒有驗 ancestor clipping／可視交集。
- 最小修復範圍：只處理本票 768 breakpoint 的 topbar height/layout/overflow；不得改 auth/session、Canvas、DEV_UIX_006/008 或 frozen packet 來換 PASS。
- 回歸入口：QA-owned visibility 斷言先驗 768×900，再跑 768/1024/1280、短高度與 200% equivalent matrix。

證據：`docs/dev測試紀錄/qa-uix-006-008-checkpoint-retest-2026-10-03.md` 與 `docs/dev測試紀錄/2026-10-03-uix-006-008-checkpoint/screenshots/qa-uix-003-768x900.png`。

## R2 開工 — 2026-10-06

- 已確認 `QA_UIX_003` R1 結果為 `QA_FAILED` 並完成 release-for-repair；候選測後 hash 5/5 無漂移，測試 ports 4412／4418／4420／4426 全數關閉，沒有 active 產品 QA。
- R1 在 768×900 通過，但 1024×900 的七個必要控制被不可捲動 topbar 裁切。共同根因是三列式 topbar 從 `max-width: 1280px` 開始，垂直捲動卻只在 900px 以下啟用。
- R2 將可捲動邊界放在整個三列式 breakpoint，而非新增 1024px 特判；保留 768／900／1280 與短高度既有配置。

## R2 候選交付 — 2026-10-06

- Revision：`A-WP-20261005-DEV_UIX_007-R2`；單票及 006→007 R2→008 manifests 見 [R2 開發紀錄](../../dev開發紀錄/2026-10-06-dev-uix-007-r2.md)。
- 修改僅限 `app/globals.css` 的三列式 topbar overflow hunk與 `tests/dev-uix-007-topbar-responsive.test.mjs`；`app/page.tsx` 未修改。
- DEV 驗證：focused 15/15、TypeScript、scoped ESLint、no-env build 全部 PASS；順序 packet 三階段 PASS、final equivalence 6/6。
- Browser 尚待獨立 QA；狀態 `READY_FOR_QA`，next owner `QA_UIX_003`。QA 鎖版後 DEV 停止產品寫入。
