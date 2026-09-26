# DEV_AIL_001 — 共用排版核心、候選及評分器

| 欄位 | 值 |
|---|---|
| Group | DEV |
| Feature | AIL |
| Priority | P1 |
| Status | QA_PASSED |
| Planned Order | 091 |
| Development Branch | codex/ai-layout-poc |
| Worktree | C:/Users/DUS/Desktop/project/nettopo-studio/.local/worktrees/ai-layout-poc |
| Base Commit | 1b0b084518886cda347f175bfc959401fd1d18ed |
| Integration Target | codex/dev-rel-001-checkpoint |
| Checkpoint | AI Layout POC；提交前依使用者既有要求停止 |
| Owner | DEV組 |
| Created / Updated | 2026-09-11 / 2026-09-25 |
| Preflight | 2026-09-12 COMPLETED；29/29 baseline；產品尚未實作 |

## Objective

### 2026-09-25 核心／Worker checkpoint 核收

QA_AIL_001 Phase A R2 已獨立重驗 PASS（runner 6/6、focused 64/64、真 Worker Browser 1/1；型別／lint／build／diff-check PASS）。PM 依 QA 回報與現有 14 檔 hash 一致核收本票範圍，狀態 QA_PASSED，尚未 commit 或 DONE。原失敗及 READY_FOR_QA 歷史不刪。後續 AIL002/003、UIX 整合與完整 UI／儲存驗收不在本 checkpoint。提交範圍見 `../../dev開發紀錄/2026-09-25-ail-core-worker-checkpoint.md`。

### 2026-09-21 使用者核准同票續作（與 Auth QA 平行）

使用者要求處理剩餘Auth QA並同時接續先前拓樸開發。PM確認本worktree為`codex/ai-layout-poc`，續作起點HEAD=`2e77d3f`（contract/core已提交），派工前git status為乾淨。本次正式接續下方尚未完成的scorer/candidate hard gates、最多3候選比較、worker/runner取消與deadline、page排版抽離轉接及worktree-local驗證，不重做已交付core，不啟動DEV_AIL_002/003。

開發組為本票唯一產品writer；QA留在root `dustool` 處理Auth。所有命令明確指定本worktree，不checkout根目錄、不借用或修改Auth build/fixture/env/node_modules。沿下方allowed paths及R1 §17，以既有178×112 geometry/router對接；不改router演算法、store/API/DB/auth、AST/MED欄位或雙軌preview/apply/undo。遵循root文件`docs/engineerticket/contracts/DEVOPS-AGILE-WORKFLOW.md`的R2直接退修流程，不复制其全套治理到本分支。

可按本worktree既有lock建立local dependencies；先檢查安裝腳本，任何所需網路/沙箱升權走正式工具，不修改package/lock、不複製現用env或依賴目錄。依賴未就緒時先完成可獨立core/tests，不把ancestor測試當local build PASS。允許本worktree focused tests、typecheck、scoped lint與安全no-env local build；不啟DB/Docker/公司API或真模型請求，不占Auth runtime。

交付需附實際branch/HEAD、修改hash清單、scoring/graph-preservation/worker cancellation與late-result測試、回歸與build結果，未驗Browser或未整合UIX_006–008限制明列。Browser整合基線gate不由本次跳過。完成停READY_FOR_QA（必要條件缺失則BLOCKED且具名），交PM排獨立QA；本次不stage/commit/push/merge/deploy，9/13的保存授權不延伸到這批新變更。新契約衝突才交DSG，不為既定實作新增設計前置。

共用排版核心、候選及評分器。2026-09-13 使用者授權先實作共用資料契約與純佈局核心；候選評分／worker／page 轉接仍須同票後續完成，未全部完成不得 READY_FOR_QA。

## Requirement Traceability

| 欄位 | 內容 |
|---|---|
| User Intent | 使用者同意快速整理／智慧整理雙軌，要求開分支、後續票標分支，整理現有拓樸供設計／開發對接 |
| Historical Sources | ../contracts/TOPOLOGY-FUNCTION-DATA-MAP.md；../contracts/AI-LAYOUT-DUAL-TRACK-HANDOFF.md；D09/D10/D11/D12、UIX_006–008、既有 DSG_UIX_003 |
| Approved Decisions | PM_GOV_001-D33；D01/D02/D04/D09/D10 的保留邊界 |
| Change Type | EXTEND |
| Affected Layers | Layout／UI／State／API／QA；詳見下列 allowed scope |
| Preserved Invariants | 只調位置、不改 topology 結構；credential 分離；scope/auth；runtime 不 migrate；route view-only |
| Conflict Check | AIL base 未包含 UIX_006–008 dirty 候選、AST/MED 新欄位；不得推定已整合；group site 不等於授權 site |
| Regression Map | topology-layout/routing/visibility/validation/transfer；QA_UIX_002–004 以整合後實際樹重驗 |
| Rollback / No-path | 保留原圖／快速整理；拒絕 stale/invalid 候選；復原必須驗版本 |

## Dependencies

DSG_AIL_001 R1 已於 2026-09-12 完成 PM scope review。[詳細契約](../contracts/AI-LAYOUT-DETAILED-CONTRACT.md) 第17節與本票是開工基準。工作位置以 [BRANCH-MAP](../BRANCH-MAP.md) 為準。2026-09-13 已由使用者授權實作 contract/core 區塊；本票 IN_PROGRESS，不解鎖 DEV_AIL_002/003 或 QA。

## In Scope / Allowed Files

app/lib/topology-layout.ts；新 layout core/types/quality 模組；page.tsx 排版函式抽離 hunk；對應 DEV tests

Preflight補充明確檔案：topology-layout-contract.ts、topology-layout-core.ts、topology-layout-quality.ts、topology-geometry.ts、topology-layout-worker.ts、topology-layout-runner.ts（均在app/lib）。geometry adapter本期只以既有178×112 router驗證；不相容尺寸拒絕，不修改router演算法。詳見[Preflight紀錄](../../dev開發紀錄/2026-09-12-dev-ail-001-preflight.md)。

## Acceptance Criteria

- [x] 2026-09-13 contract/core slice：strict request/response/intent/ref schemas、canonical full Project revision、immutable snapshot、完整positions/pins、四種模式純函式與base geometry。
- [x] 同票後續：quality/candidate schema及硬gate、最多3候選比較、可中止worker/runner、page抽離轉接、worktree-local build。
- [x] 既有模式無回歸；有界 deterministic；pins 不移動；ID/links/groups 保留；finite 座標、碰撞/無路徑檢查；geometry adapter。
- [x] 交接附 Development Branch、Worktree、實際 HEAD、測試證據版本與限制。
- [x] 修改以 primary ticket hunk 區分；無無關功能變更。

## Out of Scope / Forbidden Changes

本輪不含 commit/push/merge/deploy；不讀取／複製 env 或 credentials；不新增監控或防禦 agent；不變更既有 AST/MED/UIX 票的核准狀態。DSG 只改設計文件，QA 不改產品碼。

## Verification Evidence

2026-09-13：[contract/core 開發紀錄](../../dev開發紀錄/2026-09-13-dev-ail-001-contract-core.md)。新增22項DEV tests＋既有41項回歸，63/63 PASS；TypeScript與scoped ESLint PASS。均使用主工作區ancestor依賴；本worktree未建立node_modules，build/Browser/full Node/QA/live provider NOT RUN。

本輪回傳 LayoutDraft.status=unscored；無metrics/canApply/safeReasons，不代表 LayoutCandidate，也沒有接入畫布。Scorer、Worker及page轉接尚未完成，不得宣稱本票 READY_FOR_QA 或整體智慧整理可用。

2026-09-22：[scorer／worker／page完成紀錄](../../dev開發紀錄/2026-09-22-dev-ail-001-completion.md)。新增硬gate與固定tuple評分、最多3候選、真Worker terminate／5秒deadline／late-result隔離，並將既有自動整理按鈕轉接到共用runner/core。Focused 41/41 PASS；TypeScript、scoped ESLint及worktree-local no-env build PASS。完整Node僅兩個需`DATABASE_URL`的既有真DB測試失敗，AIL及其他229項通過；本票未啟Docker、DB、Browser、live provider或UIX_006–008整合。狀態到`READY_FOR_QA`，不是QA通過。

2026-09-25 QA return fix：`runLayoutWorker()` 的 `structuredClone()`／`postMessage()` 同步例外已納入共同 `finish()` cleanup，確保listener與abort listener清除、deadline取消、worker恰好terminate一次，並拒絕原同步錯誤；page仍只顯示固定安全訊息。DEV＋QA blocker 11/11 PASS，完整focused 67/67 PASS，TypeScript、scoped ESLint、no-env build與diff-check PASS。新候選為 [R2 manifest](../contracts/QA_AIL_001-PHASE-A-CANDIDATE-R2.json)；R1與首次QA_FAILED保留。

## Handoff History

| Date | From | To | Status | Summary |
|---|---|---|---|---|
| 2026-09-11 | PM | DEV | BLOCKED | D33 票鏈建立；僅 PM／DSG 現階段可執行；開發組可先做 read-only 對接檢查 |
| 2026-09-12 | PM | DEV | READY | R1核准；先讀共享contract與pure core/scorer allowed scope，不依賴AST/MED尚未整合內容 |
| 2026-09-12 | PM | DEV | READY | 使用者要求preflight已完成；29/29基線通過，五項接點／環境注意事項落盤；未啟動產品實作 |
| 2026-09-13 | User/PM | DEV | IN_PROGRESS | 授權並完成contract/core區塊；63/63 PASS；scorer/worker/page仍待同票續作，未commit/push |
| 2026-09-13 | User | PM | IN_PROGRESS | 後續明確授權commit/push保存上述進度；不代表QA通過，不啟動merge/deploy；實際提交以本分支git log為準 |
| 2026-09-22 | DEV | PM／QA | READY_FOR_QA | scorer/candidate/worker/page轉接完成；本地focused/typecheck/lint/build通過，限制及hash見完成紀錄；未commit/push/merge/deploy |
| 2026-09-25 | QA | DEV | IN_PROGRESS | Phase A唯一blocker同票退修：structuredClone/postMessage同步throw須走共同cleanup；保留原錯誤拒絕，UI仍為固定安全訊息 |
| 2026-09-25 | DEV | QA | READY_FOR_QA | 同步clone/post例外共同cleanup與兩類DEV regression完成；R2 hash、focused/typecheck/lint/build證據已交付，等待同票重驗 |
