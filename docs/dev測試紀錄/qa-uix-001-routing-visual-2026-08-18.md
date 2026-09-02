# QA_UIX_001 直角避障路由與無線例外驗收 - 2026-08-18

測試單號：`QA_UIX_001`  
對應開發單：`DEV_UIX_002`  
對應設計單：`DSG_UIX_002`  
Workspace：`C:\Users\DUS\Desktop\project\nettopo-studio`  
角色：測試組

## 結論

結果：**Pass。Visual evidence blocker 已解除。**

目前沒有發現 wired routing / wireless exception 的產品缺陷。原阻塞點是測試組首輪無法產出實際瀏覽器截圖：

- Browser plugin 初始化被 trusted code path 檢查阻擋。
- 專案未安裝 Playwright / Chromium 測試套件，無法用本機 Playwright 補截圖。
- 已啟動臨時 dev server `http://127.0.0.1:4191/` 做連線準備，完成後確認 port 4191 無 listener 殘留。

開發組後續補強後，測試組已獨立重跑 Playwright E2E wrapper，確認 Chromium browser tests 與 screenshots 可重現。

## 新增測試

- `tests/topology-routing-qa-uix.test.mjs`

新增覆蓋：

- 對角 wired route 不 fallback 成兩點 diagonal direct path。
- blocker avoidance 不穿越 padded non-endpoint device rect。
- endpoint padded rect overlap 時回 `unresolved-no-path`。
- lane assignment deterministic，且只在 shared corridor / anchor overlap 出現。
- crossing-only 不套用 lane。
- wireless 維持 direct exception。
- route / anchor / lane 不寫入 durable Project / Zustand / PostgreSQL source。
- page overlay 必須輸出 `data-route-kind`、`data-route-status`、no-path label、selected / hit-area CSS guard。

## 自動化測試結果

| Command | Result |
|---|---|
| `node --test tests\topology-routing.test.mjs tests\topology-layout.test.mjs tests\topology-routing-qa-uix.test.mjs` | Pass：22 tests / 22 pass |
| `node node_modules\typescript\bin\tsc --noEmit --pretty false` | Pass |
| `node --test tests\*.test.mjs` | Pass：142 total / 135 pass / 7 skip / 0 fail |
| `node_modules\.bin\eslint.cmd app\lib\topology-routing.ts app\lib\topology-layout.ts app\page.tsx tests\topology-routing.test.mjs tests\topology-layout.test.mjs tests\topology-routing-qa-uix.test.mjs` | Pass |
| `npm.cmd run build:local` | Pass；僅既有 chunk size / route classification warning |
| `git diff --check` | Pass；僅 CRLF 提醒 |
| `npm.cmd run test:e2e:uix` | Pass：2 Playwright browser tests / 2 pass；screenshots regenerated |

Performance evidence：

- Scoped routing test：60 devices / 120 wired links 約 `39.49 ms`。
- Full suite run：60 devices / 120 wired links 約 `66.64 ms`。
- 兩次皆低於 120 ms budget。

## 測試矩陣

| 項目 | 結果 | 證據 |
|---|---|---|
| 對角 wired 為 orthogonal，不是 diagonal | Pass | `QA_UIX_001: diagonal wired route never falls back to a direct segment` |
| 水平、垂直、四種對角方向 wired 皆為水平/垂直 segment | Pass | `horizontal, vertical, and diagonal wired directions are always orthogonal` |
| 中間 blocker 不被 resolved route 穿越 | Pass | `blocker avoidance does not intersect padded non-endpoint device rects` |
| endpoint 太近 / padded rect overlap 回 no-path | Pass | `no safe wired path reports unresolved` |
| 同 anchor / shared corridor lane deterministic | Pass | `lane assignment is deterministic and only applies to shared corridors` |
| crossing-only 不套 lane offset | Pass | `lanes are not assigned for routes that cross but do not share a corridor` |
| wireless 明確例外 | Pass | `wireless remains an explicit direct exception` |
| route/anchor/lane 不進 durable schema | Pass | source-level durable scan |
| selected link stroke / hit area 更明顯 | Pass | CSS source guard：hit-line 22px、selected visible-line 5.4px |
| 60 devices / 120 wired links < 120 ms | Pass | 39.49 ms / 66.64 ms |
| Browser / Visual screenshot evidence | Pass | 測試組重跑 `npm.cmd run test:e2e:uix`：2 tests / 2 pass |
| 開發組補跑 Playwright browser evidence | Pass | `npm.cmd run test:e2e:uix`：2 tests / 2 pass |

## Browser / Visual QA 狀態

已嘗試：

1. 啟動 local dev server：`http://127.0.0.1:4191/`。
2. Browser plugin 連線到該 URL，初始化時失敗：
   - `Trusted RPC dependency must resolve within a configured trusted code path`
3. 檢查本機 Playwright：
   - `Cannot find package 'playwright'`
4. 停止 dev server，確認 `4191` 無 listener。

測試組當時未能產出的項目：

- 對角兩設備截圖。
- blocker 繞線截圖。
- spine-leaf 重整後線條截圖。
- multi-lane / crossing-only / no-path / wireless / selected link 截圖。

替代證據：

- 幾何 invariant 已由 unit tests 直接驗證 route points、segment/rect intersection、lane stability。
- UI visual invariant 已由 page/CSS source guard 驗證 overlay class、no-path label、selected stroke/hit-area。

測試組補測結果：

- `npm.cmd run playwright:install`：執行超過兩分鐘無輸出，測試組中斷；後續 E2E 證明 Chromium cache 已可用。
- `npm.cmd run test:e2e:uix`：Pass，2 Playwright browser tests / 2 pass。
- `http://127.0.0.1:4391/` preview server 測後已關閉，port 4391 無 listener。
- screenshots 已於 2026-08-18 14:32 重新產生。

## 開發組補充 Visual Evidence

新增／調整：

- `@playwright/test` dev dependency。
- `playwright.config.ts`。
- `scripts/run-uix-playwright.mjs`：自動 build、啟動 preview server、等待 `http://127.0.0.1:4391/`、執行 Playwright、最後關閉 preview。
- `tests/e2e/uix-routing.spec.ts`。
- `scripts/preview-server.mjs` 增加 graceful shutdown。

補跑結果：

| Command | Result |
|---|---|
| `node_modules\.bin\playwright.cmd install chromium` | Pass（開發組回報；測試組重跑 npm wrapper 時超過兩分鐘無輸出後中斷） |
| `npm.cmd run test:e2e:uix` | Pass：2 tests / 2 pass（測試組獨立重跑通過） |

Screenshots：

- `docs/dev測試紀錄/screenshots/qa-uix-001-routing-overlay.png`
- `docs/dev測試紀錄/screenshots/qa-uix-001-selected-link.png`

## 風險與建議

- Browser plugin 仍受 trusted path 阻塞，但本單已由 Playwright Chromium 補足 browser visual evidence。
- 建議：`QA_UIX_001` 改為 Pass；`DEV_UIX_002` 可進入 UI Routing checkpoint。
