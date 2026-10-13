# Branch 與跨組交接索引

## 2026-10-13 已驗收候選 commit／push

使用者已 [核准](../dev開發紀錄/2026-10-13-pm-approved-checkpoint-push.md) NTM CORE／GEN／PLAN在checkpoint分支、Native B1與獨立治理在dustool分開提交推送。DEV與OPS核候選／相依／遠端後執行，root index先OPS後PM。不混Auth／其他未驗票、不跨分支整合；下列PRE-COMMIT為歷史停止點，僅此具名範圍解除。實際完成以commit／remote SHA證據為準。

## 2026-10-12 Harness 授權補強與 NTM QA 接續

root `dustool`／HEAD 72783636a8b22f353e8c25fe68b859ad62e3c237：PM_GOV_005 共用治理、OPS_ENV_001 環境工具與 QA_ENV_001；[授權補充](contracts/HARNESS-AUTHORIZATION.md)、[實施紀錄](../dev開發紀錄/2026-10-12-pm-harness-authorization.md)。checkpoint 樹／codex/dev-rel-001-checkpoint／HEAD a9abe637f0ad419aced6d31faf30a127ce5b81e6：DEV_NTM_003 PLAN-R1 已 READY_FOR_QA，交 QA_NTM_003 正式驗收，未提交候選不等於 HEAD。產品、工具與 QA 各自單 writer；無 Git 寫入、跨分支或 live。下文日期舊狀態保留歷史，正式進度以各票最新證據為準。

## 2026-10-10 NTM003 後續工作

DEV_NTM_003／QA_NTM_003與DSG_NTM_001 §4補充在 `.local/worktrees/dev-rel-001-checkpoint`／`codex/dev-rel-001-checkpoint`／base a9abe63。root PM [接續紀錄](../dev開發紀錄/2026-10-10-pm-ntm-plan-start.md)。DEV preflight＋QA準備並行，DSG補新語意後PM核精確實作；無Git或跨線整合。

## 2026-10-09 NTM002 GEN-R1 已到 PRE-COMMIT

checkpoint worktree／codex/dev-rel-001-checkpoint／base a9abe63：GEN-R1 純引擎開發及獨立QA完成；PM核hash一致，未提交。[最新核收](../dev開發紀錄/2026-10-09-pm-ntm-gen-r1-precommit.md)。使用者此次要求到ntm002完成，現停、不自動啟下一票或切Beta；未接UI/storage。

## 2026-10-09 NTM 最新後續開發授權

DEV_NTM_002／QA_NTM_002 GEN-R1 在 `.local/worktrees/dev-rel-001-checkpoint`／`codex/dev-rel-001-checkpoint`，base a9abe63；[接續紀錄](../dev開發紀錄/2026-10-09-pm-ntm-gen-start.md)。只介面候選純模組及獨立QA，無Git或跨分支。Beta保留、同一DEV順序接續，不混工作樹。

## 2026-10-09 本機 Beta 已核准工作線

使用者核准工作包並要求先在GitHub建分支後派單。GitHub與新本機樹均為 `codex/public-beta-0.1`／`a9abe637f0ad419aced6d31faf30a127ce5b81e6`；Worktree `C:/Users/DUS/Desktop/project/nettopo-studio/.local/worktrees/public-beta-0.1`。GitHub新ref已建立，沒有新commit或跨線合併；root/checkpoint dirty不搬入。

- root只維護 [PM_BTA_001](active/PM_BTA_001.md)、[核准計畫](../開發計畫/2026-10-09-local-feedback-beta-plan.md)、治理與交接。
- 本樹 [DSG_BTA_001](C:/Users/DUS/Desktop/project/nettopo-studio/.local/worktrees/public-beta-0.1/docs/engineerticket/active/DSG_BTA_001.md) READY；DEV_BTA_001–003等待契約／依賴，僅preflight；QA_BTA_001僅準備；OPS_BTA_001等待另授權發布。
- 單人本機／IndexedDB、Windows＋Chrome/Edge、自備Node、預建ZIP、首次setup可連網、日常離線、匿名案例、MIT sean.hsieh、外部Issues→內部Markdown。產品與證據以Beta樹票/register為準，不引用其他branch PASS代驗。
- 此Beta不是R3正式人事B或新的NTM/AIL phase；CORE-R2 PRE-COMMIT停止保留。第一個必要獨立QA PRE-COMMIT停，不stage/commit/後續push/tag/Release。只有已建立baseline分支的遠端寫入獲本次具名授權。


## 同日 D44 CORE-R1 接續

DEV_NTM_001／QA_NTM_001 均在 `codex/dev-rel-001-checkpoint`、同worktree／base a9abe637f0ad419aced6d31faf30a127ce5b81e6；只新純核心與自身測試，不改root Auth、不跨分支或開新branch。root PM文件仍dustool。最新狀態由本地票／manifest／測試日誌判斷，必要QA後PRE-COMMIT停止。索引：[接續紀錄](../dev開發紀錄/2026-10-09-pm-ntm-development-resume.md)。

## 2026-10-09 D43 設計線索（不切分支）

| 票／資料 | branch／位置 | 本輪範圍 |
|---|---|---|
| PM_NTM_001、D43、計畫、GLOSSARY | root dustool／HEAD 72783636a8b22f353e8c25fe68b859ad62e3c237 | 治理／PM 文件；不動 dirty Auth |
| [DSG_NTM_001](C:/Users/DUS/Desktop/project/nettopo-studio/.local/worktrees/dev-rel-001-checkpoint/docs/engineerticket/active/DSG_NTM_001.md)／設計契約 | codex/dev-rel-001-checkpoint／.local/worktrees/dev-rel-001-checkpoint；參照 HEAD a9abe637f0ad419aced6d31faf30a127ce5b81e6 | 設計文件；完成 WAITING_APPROVAL |

權威：[root 計畫](../開發計畫/2026-10-09-trusted-network-topology-plan.md)。歷史 base 1b0b084 不等於本次產品參照；共用流程仍 root R3。索引是定位入口，狀態以票與實際交付為準，不新建分支／搬候選／整合。

## 目前治理與 A 工作包（2026-10-05 / D42）

- 共用規則唯一版本：root [流程 R3](contracts/DEVOPS-AGILE-WORKFLOW.md)，治理識別 `PM_GOV_005@dustool`；異分支同號資產治理票保留。
- A：`codex/dev-rel-001-checkpoint`／`.local/worktrees/dev-rel-001-checkpoint`／base `1b0b084518886cda347f175bfc959401fd1d18ed`。工作包：[A-WP-20261005](../開發計畫/2026-10-05-a-topology-work-package.md)。UIX_007 同票修復先行，QA_UIX_003 → QA_PIL_006 獨立驗收；個票狀態以 checkpoint worktree 為準。
- 排序 A→C→B；现在只 A 啟動。AIL 和 dustool Auth 不搬候選，不跨分支整合。工程 commit 依具名工作包與獨立 QA；push／部署仍未授權。

## 2026-09-14 DUS Auth 工作線（D34）

| 工作線 | Development Branch | Worktree | Base Commit | Integration Target |
|---|---|---|---|---|
| PM_AUTH_001／DSG_AUTH_002 及後續 AUTH/DBM 票 | dustool | C:/Users/DUS/Desktop/project/nettopo-studio | 72783636a8b22f353e8c25fe68b859ad62e3c237 | dustool；本輪文件設計，無 Git 授權 |

目前 root 除歷史入口外，也是 DUS Auth 規劃工作區。狀態以本樹 [register](TICKET-REGISTER.md) 與 [計畫](../開發計畫/2026-09-14-dus-auth-integration-plan.md) 為準；其他 worktree 不動。以下 AIL 資訊保留為原建線紀錄，非本輪更新。

- Primary Ticket：PM_AIL_001
- 更新：2026-09-11
- 使用者核准：建立智慧整理分支、雙軌介面、整理現有功能及資料對接；後續單號標明分支。
- 本表是工作位置索引；各票狀態由其指定 worktree 的票面與 register 管理。

| 工作線 | Development Branch | Worktree（相對 repo root） | Base Commit | Integration Target |
|---|---|---|---|---|
| 智慧整理 AIL | codex/ai-layout-poc | .local/worktrees/ai-layout-poc | 1b0b084518886cda347f175bfc959401fd1d18ed | codex/dev-rel-001-checkpoint；整合與 commit 另按既有 checkpoint 授權 |
| Canvas／資產／Medium／路由既有線 | codex/dev-rel-001-checkpoint | .local/worktrees/dev-rel-001-checkpoint | 1b0b084518886cda347f175bfc959401fd1d18ed | 既有 release 流程 |
| 歷史工作區／全域入口 | dustool | repo root | 保留現況，不作 AIL 基準 | 不直接合併 AIL |

Repo root：C:/Users/DUS/Desktop/project/nettopo-studio

## 基準差異

- AIL 初始產品樹精確取自上述已提交 base；未複製主工作區或 checkpoint 的 dirty product files，也未複製 .env、DB、logs、node_modules。
- UIX_006–008／QA_UIX_002–004：10/03 checkpoint 重驗 006/008 PASS、007 FAIL；D42 啟動 007 修復，新結果以本地票與證據為準。不在 AIL 初始產品樹，不能沿用歷史整包 PASS。
- DSG_AST_001／DSG_MED_001／DSG_UIX_003：既有線 WAITING_APPROVAL；不能因新分支成立就視為已整合或已核准。
- AIL 現有 node geometry 為 178×112；192×148 node、160×100 image 是 AST 候選，非目前實作。
- 本次 D33 不授權既有 AST/MED/UIX 票開工；AIL 應以 geometry adapter 和既有 router 對接，不複製／重寫其演算法。
- DEV_AIL_003 的 Browser 整合前，PM 必須安排 UIX_006–008 已提交修正的明確 commit 範圍整合，或列為基準限制並停止該驗收；不能把跨樹 QA_PASS 當成本分支證據。

## 工單必要欄位

所有新票與後續啟動／重新交接的舊票必填 Development Branch、Worktree、Base Commit、Integration Target。禁止用「目前分支」或「同主線」代替名稱。開始時記錄 git branch --show-current、git rev-parse HEAD 和 git status --short；branch/worktree 不符就先修正工作位置。

共用同一功能分支的多張票，保留各 primary Ticket 與 hunk ownership。分支建立不是 commit/push/merge/deploy 授權。不得把 checkout 內複製的歷史 register 當成其他 worktree 的最新狀態。
