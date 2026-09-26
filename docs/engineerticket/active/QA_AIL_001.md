# QA_AIL_001 — 雙軌 mock／Browser／儲存獨立驗收

## 2026-09-25 Phase A R2：PASS（整票 BLOCKED）

依測試組 2026-09-25 獨立重驗回報：R2 manifest 14 檔測前／測後一致；blocker/runner 6/6、focused 64/64、真 Worker Browser 1/1、TypeScript、scoped ESLint、no-env build、diff-check 均 PASS。clone/post 同步例外已走共同 cleanup、terminate exactly once。PM 核對現有 R2 14 檔雜湊一致；未代稱自行重跑 QA。

本段由 PM 依原 QA 回報補錄，解決原 apply_patch sandbox ACL 寫入阻擋。首輪 QA_FAILED 保留如下；整票仍 BLOCKED 等待 AIL002/003 與 UIX 整合，未驗完整頁面／儲存／模型品質，不因本階段通過改為整票 PASS。Checkpoint 僅收斂 DEV_AIL_001 核心／Worker，不含 Git、部署或 live 授權。

## 2026-09-22 Phase A 獨立結果：QA_FAILED

Phase A focused＋QA回歸為63 total／62 pass／1 fail；真worker Browser 1/1 PASS，TypeScript、scoped ESLint及no-env build PASS。Blocker：`runLayoutWorker()` 的 `worker.postMessage()` 若同步throw，Promise雖拒絕但未走共同cleanup，`terminate()`實際0、listeners/timer未清；依R2退回`DEV_AIL_001`最小修正`app/lib/topology-layout-runner.ts`及DEV regression。完整證據見[Phase A QA紀錄](../../dev測試紀錄/qa-ail-001-phase-a-2026-09-22.md)與[候選manifest](../contracts/QA_AIL_001-PHASE-A-CANDIDATE-R1.json)。Phase A=`QA_FAILED`；整票仍`BLOCKED`等待下游整合，不啟002/003。

## 2026-09-22 Phase A 派驗：DEV_AIL_001 核心／Worker

依使用者持續做其他驗證與拓樸開發授權，PM核對DEV五檔SHA-256均符合`docs/dev開發紀錄/2026-09-22-dev-ail-001-completion.md`，接受READY_FOR_QA交接，不代簽QA。Phase A=READY；整票BLOCKED等待下游002/003與UIX整合，正式執行此phase時記IN_QA並保留整票依賴。

- 位置：本worktree `C:/Users/DUS/Desktop/project/nettopo-studio/.local/worktrees/ai-layout-poc`，branch `codex/ai-layout-poc`，HEAD `2e77d3fe299d2e231268bf7f3a124608ab7d9030` 加未提交候選。QA自行固定完整相關source/依賴/QA工具manifest，測前後核對；DEV在驗收期間不改候選。
- Owner：現有測試組，先安全完成正在執行的無Docker Auth batch，再接本phase；不要重做既有通過Auth矩陣，也不需等待Docker修好。
- 獨立驗證：candidate完整ID/finite/pins、graph其他欄位不變、node overlap、wired缺route/unresolved/穿node、wireless既有例外、固定quality tuple/最多3候選/輸入排列determinism、無改善/無安全候選保留原圖、geometry不相容拒絕。
- Worker/runner：正常、error、deadline、abort（含pre-abort）、requestId不符/late reply、postMessage失敗等有界cleanup。fake worker測試只作單元證據；以已產生真worker bundle及獨立owned Browser harness確認載入/運算/UI thread可回應/取消，不以bundle存在代簽真Worker行為。只做核心harness，不放行雙軌畫布/儲存完整Browser驗收。
- 既有quick四模式、layout/routing/validation/visibility/transfer相關回歸按impact選取；不新增低於既有quick能力的hard graph cap。page抽離僅核對scope及既有調用語意；跨拓樸/使用者的完整page UAT與preview/apply/undo仍待UIX_006–008明確整合，不借用別分支PASS。
- Allowed writes：本worktree `tests/qa-ail-*`、`docs/dev測試紀錄/qa-ail-*`、本票及本worktree Register本列、QA manifest。產品/DEV tests/package/lock/router/API/store/DB只讀。不讀env，不Docker/DB/真模型/公司API，不動dustool候選。可用既有本地依賴、no-env build、owned動態loopback preview/Browser並精確cleanup；無新增安裝平台。
- DEV full Node 229pass/2fail/9skip如實保留；無DATABASE_URL歸類須核查，不載現用env補通過，不把全測當PASS。只影響本scope者納本phase出口，其餘明列風險。
- 結果：Phase A PASS/FAIL/BLOCKED與整票分列，附獨立案例、候選、實際命令/exit、cleanup與未驗。scope內缺陷完成cleanup後依root R2直接release for repair回DEV_AIL_001，最小paths/hunks/契約/重驗清單清楚；不用每輪新DSG/PM freeze。新語意才回PM。
- 不stage/commit/push/merge/deploy；不啟DEV_AIL_002/003或QA_AIL_002，不將mock/quick成果宣稱GPT模型品質。

| 欄位 | 值 |
|---|---|
| Group | QA |
| Feature | AIL |
| Priority | P1 |
| Status | BLOCKED |
| Planned Order | 094 |
| Development Branch | codex/ai-layout-poc |
| Worktree | C:/Users/DUS/Desktop/project/nettopo-studio/.local/worktrees/ai-layout-poc |
| Base Commit | 1b0b084518886cda347f175bfc959401fd1d18ed |
| Integration Target | codex/dev-rel-001-checkpoint |
| Checkpoint | AI Layout POC；提交前依使用者既有要求停止 |
| Owner | QA組 |
| Created / Updated | 2026-09-11 |

## Objective

雙軌 mock／Browser／儲存獨立驗收。本次授權先完成分支與設計對接，DEV/QA 依賴滿足後由 PM 排程。

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

DEV_AIL_001/002/003 READY_FOR_QA。工作位置與跨分支狀態以 [BRANCH-MAP](../BRANCH-MAP.md) 為準。

## In Scope / Allowed Files

tests/qa-ail-*；docs/dev測試紀錄/qa-ail-*；本票

## Acceptance Criteria

- [ ] 真 Browser、local/server、read-only、stale/cancel/undo、secret scan、round-trip、fixture cleanup；人工/模型品質結果分開記錄
- [ ] 交接附 Development Branch、Worktree、實際 HEAD、測試證據版本與限制。
- [ ] 修改以 primary ticket hunk 區分；無無關功能變更。

## Out of Scope / Forbidden Changes

本輪不含 commit/push/merge/deploy；不讀取／複製 env 或 credentials；不新增監控或防禦 agent；不變更既有 AST/MED/UIX 票的核准狀態。DSG 只改設計文件，QA 不改產品碼。

## Verification Evidence

本次為分支與文件建立；產品測試／模型品質尚未執行。後續依本票交付附 command、result、base/HEAD 與 fixture cleanup。

## Handoff History

| Date | From | To | Status | Summary |
|---|---|---|---|---|
| 2026-09-11 | PM | QA | BLOCKED | D33 票鏈建立；僅 PM／DSG 現階段可執行；開發組可先做 read-only 對接檢查 |
