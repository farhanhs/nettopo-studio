# DEV_AIL_001 — 共用排版核心、候選及評分器

| 欄位 | 值 |
|---|---|
| Group | DEV |
| Feature | AIL |
| Priority | P1 |
| Status | IN_PROGRESS |
| Planned Order | 091 |
| Development Branch | codex/ai-layout-poc |
| Worktree | C:/Users/DUS/Desktop/project/nettopo-studio/.local/worktrees/ai-layout-poc |
| Base Commit | 1b0b084518886cda347f175bfc959401fd1d18ed |
| Integration Target | codex/dev-rel-001-checkpoint |
| Checkpoint | AI Layout POC；提交前依使用者既有要求停止 |
| Owner | DEV組 |
| Created / Updated | 2026-09-11 / 2026-09-13 |
| Preflight | 2026-09-12 COMPLETED；29/29 baseline；產品尚未實作 |

## Objective

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
- [ ] 同票後續：quality/candidate schema及硬gate、最多3候選比較、可中止worker/runner、page抽離轉接、worktree-local build。
- [ ] 既有模式無回歸；有界 deterministic；pins 不移動；ID/links/groups 保留；finite 座標、碰撞/無路徑檢查；geometry adapter
- [ ] 交接附 Development Branch、Worktree、實際 HEAD、測試證據版本與限制。
- [ ] 修改以 primary ticket hunk 區分；無無關功能變更。

## Out of Scope / Forbidden Changes

本輪不含 commit/push/merge/deploy；不讀取／複製 env 或 credentials；不新增監控或防禦 agent；不變更既有 AST/MED/UIX 票的核准狀態。DSG 只改設計文件，QA 不改產品碼。

## Verification Evidence

2026-09-13：[contract/core 開發紀錄](../../dev開發紀錄/2026-09-13-dev-ail-001-contract-core.md)。新增22項DEV tests＋既有41項回歸，63/63 PASS；TypeScript與scoped ESLint PASS。均使用主工作區ancestor依賴；本worktree未建立node_modules，build/Browser/full Node/QA/live provider NOT RUN。

本輪回傳 LayoutDraft.status=unscored；無metrics/canApply/safeReasons，不代表 LayoutCandidate，也沒有接入畫布。Scorer、Worker及page轉接尚未完成，不得宣稱本票 READY_FOR_QA 或整體智慧整理可用。

## Handoff History

| Date | From | To | Status | Summary |
|---|---|---|---|---|
| 2026-09-11 | PM | DEV | BLOCKED | D33 票鏈建立；僅 PM／DSG 現階段可執行；開發組可先做 read-only 對接檢查 |
| 2026-09-12 | PM | DEV | READY | R1核准；先讀共享contract與pure core/scorer allowed scope，不依賴AST/MED尚未整合內容 |
| 2026-09-12 | PM | DEV | READY | 使用者要求preflight已完成；29/29基線通過，五項接點／環境注意事項落盤；未啟動產品實作 |
| 2026-09-13 | User/PM | DEV | IN_PROGRESS | 授權並完成contract/core區塊；63/63 PASS；scorer/worker/page仍待同票續作，未commit/push |
| 2026-09-13 | User | PM | IN_PROGRESS | 後續明確授權commit/push保存上述進度；不代表QA通過，不啟動merge/deploy；實際提交以本分支git log為準 |
