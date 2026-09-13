# QA_AIL_001 — 雙軌 mock／Browser／儲存獨立驗收

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
