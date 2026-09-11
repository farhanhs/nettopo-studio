# DEV_UIX_002 — 直角避障路由與最近邊連接點實作

| 欄位 | 值 |
|---|---|
| Group | DEV |
| Feature | UIX |
| Priority | P1 |
| Status | QA_PASSED |
| Planned Order | 044 |
| Checkpoint | UI Routing |
| Owner | 開發組 |
| Created | 2026-08-18 |
| Updated | 2026-08-18 |

## Objective

將 wired 設備連線改為水平／垂直直角避障折線，wireless 則保留 dashed direct 例外，並將 routing 幾何維持為 view-only derivation。

## Approved Decisions

- `PM_GOV_001-D09`：設備連結預設採直角路由，線段不得與非端點設備疊合。
- `PM_GOV_001-D10`：連接點預設位於朝向對端的最近設備邊；只有實際重疊或同 corridor 才配置 offset。
- `DSG_UIX_002-D03`：wireless 維持 dashed direct / soft curve，是 wired orthogonal routing 的明確例外。

## Dependencies

- `DSG_UIX_002`
- `QA_UIX_001`

## In Scope

- `app/lib/topology-routing.ts` 新增 route contract、nearest-side anchor、orthogonal base route、route validation、batch lane assignment。
- Wired links 不再回傳 diagonal/direct route。
- 無安全 wired path 時回傳 `unresolved-no-path`，不 fallback 穿越設備。
- `app/page.tsx` 改用 `routeTopologyLinks()` 產生 route map。
- `app/globals.css` 補 unresolved/no-path visual class。
- `tests/topology-routing.test.mjs` 更新 wired/wireless/lane/no-path 測試。
- `tests/topology-layout.test.mjs` 移除舊 layout offset expectation。

## Out of Scope

- 手動拖曳 anchor 或 bend point。
- 將 anchor、route points、lane 寫入 Device、Link、Dexie 或 PostgreSQL。
- 真實交換器 port geometry。
- congestion-aware grid/visibility routing 第二階段。

## Acceptance Criteria

- [x] Wired route adjacent points 皆同 x 或同 y。
- [x] Wired route 不回傳 diagonal/direct path。
- [x] Wireless route 明確標示 `kind="wireless"`，保留 direct/dashed 例外。
- [x] Anchor 位於朝向對端的最近 device side。
- [x] Offset/lane 僅由 anchor overlap 或 shared corridor 觸發。
- [x] Routing 結果不依賴 links array input order。
- [x] No-path route 顯示 unresolved warning，不畫穿越設備的 resolved line。

## Verification Evidence

| Command／Evidence | Result | Date |
|---|---|---|
| `node --test tests\topology-routing.test.mjs tests\topology-layout.test.mjs tests\topology-routing-qa-uix.test.mjs` | Pass, 22 tests | 2026-08-18 |
| `node node_modules\typescript\bin\tsc --noEmit --pretty false` | Pass | 2026-08-18 |
| `node --test tests\*.test.mjs` | Pass, 142 total／135 pass／7 skip／0 fail | 2026-08-18 |
| `node_modules\.bin\eslint.cmd app\lib\topology-routing.ts app\lib\topology-layout.ts app\page.tsx tests\topology-routing.test.mjs tests\topology-layout.test.mjs tests\topology-routing-qa-uix.test.mjs app\api\audit-logs\route.ts tests\rendered-html.test.mjs` | Pass | 2026-08-18 |
| `npm.cmd run build:local` | Pass | 2026-08-18 |
| `npm.cmd run lint` | Blocked by existing Windows shell issue: `bash` is not recognized | 2026-08-18 |
| QA_UIX_001 Browser / Visual screenshot evidence | Blocked: Browser plugin trusted path blocked; Playwright unavailable | 2026-08-18 |
| `npm.cmd run playwright:install` / `node_modules\.bin\playwright.cmd install chromium` | Pass; Chromium installed under Playwright cache | 2026-08-18 |
| `npm.cmd run test:e2e:uix` | Pass; 2 Playwright browser tests / 2 pass; screenshots generated | 2026-08-18 |

## Risks／Blockers

- 60 devices / 120 wired links 自動化 performance 已通過；Playwright browser screenshot / interaction evidence 已由測試組複驗通過。
- Lane assignment 第一階段採 base route + shared corridor offset，尚未導入 congestion-aware global route cost。

## Handoff History

| Date | From | To | Status | Summary |
|---|---|---|---|---|
| 2026-08-18 | 設計組 | 開發組 | IMPLEMENTED_PENDING_QA | 完成第一階段 wired orthogonal routing 與 wireless 例外。 |
| 2026-08-18 | 測試組 | 開發組 | AUTOMATION_CHECKPOINT_PASSED_VISUAL_BLOCKED | QA_UIX_001 automation/source-level invariant 通過；Browser screenshot evidence 因工具環境阻塞待補。 |
| 2026-08-18 | 開發組 | 測試組 | VISUAL_EVIDENCE_ADDED_PENDING_QA_CONFIRMATION | 補 Playwright Chromium、UIX E2E wrapper、routing overlay / selected link screenshots。 |
| 2026-08-18 | 測試組 | 開發組 | QA_PASSED | 測試組重跑 Playwright E2E 與 routing invariant，確認 visual evidence blocker 已解除。 |
