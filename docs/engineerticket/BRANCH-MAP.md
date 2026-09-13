# Branch 與跨組交接索引

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
- UIX_006–008／QA_UIX_002–004：checkpoint 未提交候選已 QA_PASSED；不在 AIL 初始產品樹。
- DSG_AST_001／DSG_MED_001／DSG_UIX_003：既有線 WAITING_APPROVAL；不能因新分支成立就視為已整合或已核准。
- AIL 現有 node geometry 為 178×112；192×148 node、160×100 image 是 AST 候選，非目前實作。
- 本次 D33 不授權既有 AST/MED/UIX 票開工；AIL 應以 geometry adapter 和既有 router 對接，不複製／重寫其演算法。
- DEV_AIL_003 的 Browser 整合前，PM 必須安排 UIX_006–008 已提交修正的明確 commit 範圍整合，或列為基準限制並停止該驗收；不能把跨樹 QA_PASS 當成本分支證據。

## 工單必要欄位

所有新票與後續啟動／重新交接的舊票必填 Development Branch、Worktree、Base Commit、Integration Target。禁止用「目前分支」或「同主線」代替名稱。開始時記錄 git branch --show-current、git rev-parse HEAD 和 git status --short；branch/worktree 不符就先修正工作位置。

共用同一功能分支的多張票，保留各 primary Ticket 與 hunk ownership。分支建立不是 commit/push/merge/deploy 授權。不得把 checkout 內複製的歷史 register 當成其他 worktree 的最新狀態。
