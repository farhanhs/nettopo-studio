# QA_UIX_001 — 直角避障路由與無線例外驗收

| 欄位 | 值 |
|---|---|
| Group | QA |
| Feature | UIX |
| Priority | P1 |
| Status | QA_PASSED |
| Planned Order | 045 |
| Checkpoint | UI Routing |
| Owner | 測試組 |
| Created | 2026-08-18 |
| Updated | 2026-08-18 |

## Objective

驗證 DEV_UIX_002 的 wired orthogonal invariant、wireless direct exception、no-path visual、lane stability 與既有 topology layout 不退步。

## Approved Decisions

- Wired links 必須為水平／垂直直角避障折線。
- Wireless links 維持 dashed direct / soft curve，不參與 wired invariant。
- Offset 僅能由實際 anchor overlap 或 shared corridor 觸發。

## Dependencies

- `DSG_UIX_002`
- `DEV_UIX_002`

## In Scope

- 單元測試：routing/layout。
- Browser visual QA：React Flow overlay path rendering。
- 60-device pilot performance budget。
- Selection hit-area 與 selected link stroke 可辨識性。

## Out of Scope

- 正式 RBAC、Pilot auth、PostgreSQL migration boundary。
- 手動 route 編輯器。
- ZIP import。

## Acceptance Criteria

- [x] 兩台對角設備的 wired link 是 orthogonal，不是 diagonal。
- [x] 水平、垂直、四種對角方向 wired route 皆通過 orthogonal invariant。
- [x] 中間 blocker 不被 resolved wired route 穿越。
- [x] 無安全路徑時顯示 no-path warning，不 fallback 成穿越線。
- [x] 多條共用 corridor links 有 lane 且可辨識。
- [x] crossing only 不套用 lane offset。
- [x] Wireless 顯示 dashed direct/soft route，且不污染 wired routing。
- [x] Link selected 狀態 stroke 加粗明顯。
- [x] 拖曳設備後 route 穩定，不因 input order 跳動。
- [x] 60 devices / 120 wired links 全量 route 低於 120 ms 或提出測試結果與瓶頸。

## Verification Evidence

| Command／Evidence | Result | Date |
|---|---|---|
| `node --test tests\topology-routing.test.mjs tests\topology-layout.test.mjs tests\topology-routing-qa-uix.test.mjs` | Pass：22 tests / 22 pass | 2026-08-18 |
| `node node_modules\typescript\bin\tsc --noEmit --pretty false` | Pass | 2026-08-18 |
| `node --test tests\*.test.mjs` | Pass：142 total / 135 pass / 7 skip / 0 fail | 2026-08-18 |
| scoped ESLint for routing/layout/page/tests | Pass | 2026-08-18 |
| `npm.cmd run build:local` | Pass；僅既有 warning | 2026-08-18 |
| Browser / Visual screenshot QA | Blocked：Browser plugin trusted path blocked；Playwright unavailable | 2026-08-18 |
| `npm.cmd run test:e2e:uix` | Pass：2 Playwright browser tests / 2 pass；screenshots generated | 2026-08-18 |
| `docs/dev測試紀錄/screenshots/qa-uix-001-routing-overlay.png` | Captured：routing overlay rendered with CSS | 2026-08-18 |
| `docs/dev測試紀錄/screenshots/qa-uix-001-selected-link.png` | Captured：selected link stroke visibly stronger | 2026-08-18 |
| `Get-NetTCPConnection -LocalPort 4391` | Pass：no listener after E2E wrapper cleanup | 2026-08-18 |

## Risks／Blockers

- 若 browser visual QA 發現 lane offset 仍造成碰撞，請回報具體 topology fixture 與截圖。
- Visual evidence blocker 已解除；Playwright Chromium E2E 與 screenshots 已由測試組獨立重跑確認。

## Handoff History

| Date | From | To | Status | Summary |
|---|---|---|---|---|
| 2026-08-18 | 開發組 | 測試組 | READY_FOR_QA | 請測試組驗收 wired orthogonal routing、wireless exception 與 visual stability。 |
| 2026-08-18 | 開發組 | 測試組 | VISUAL_EVIDENCE_ADDED_PENDING_QA_CONFIRMATION | 已補 Playwright browser E2E 與兩張 visual screenshot，請測試組複驗。 |
| 2026-08-18 | 測試組 | 開發組 | PASS | 測試組重跑 `test:e2e:uix`、routing scoped tests、tsc、node tests、ESLint、diff check 均通過；visual evidence blocker 已解除。 |
