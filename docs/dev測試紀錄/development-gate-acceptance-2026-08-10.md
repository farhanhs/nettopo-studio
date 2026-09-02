# Development Gate 架構驗收 - 2026-08-10

## 測試範圍

- 專案：NetTopo Studio
- 功能：RuntimePolicy、request identity、dev session、Demo seed gate
- 測試角色：測試組獨立驗收
- 日期：2026-08-10
- 原則：不修改產品程式碼

## 基礎閘門

| 項目 | 結果 |
| --- | --- |
| TypeScript `tsc --noEmit` | 通過 |
| `node --test tests/*.test.mjs` | 68 tests passed |
| scoped ESLint | 0 errors / 0 warnings |
| `npm.cmd run build:local` | 通過 |
| production RuntimePolicy 摘要 | `production / disabled / demoAuth=false / devIdentityOverride=false / demoSeed=false` |

## Production 動態驗證

- production 嘗試使用 `authMode=demo`：policy validation 預期失敗。
- production 嘗試開啟 `NETTOPO_ENABLE_DEV_IDENTITY_HEADER=1`：policy validation 預期失敗。
- production／disabled 下，`/api/topology`、`/api/credentials?topologyId=...`、`/api/audit-logs`、`/api/session` 均回 401。
- 同時傳送舊 `x-nettopo-user-email` 與新 `x-nettopo-dev-user-email` 仍無法通過 production 身分驗證。
- 可見 DOM 無「進入本機 Demo」按鈕、無測試身分 selector、無 DEVELOPMENT MODE banner。
- `/api/runtime-capabilities` 回傳所有 development capabilities 為 false。

注意：`/api/credentials` 未提供必要 `topologyId` 時會先回 400；提供參數後，未驗證請求回 401。此項視為參數驗證順序，不影響已驗證的身分 fail-closed 結果。

## Development 動態驗證

- development + demo + dev identity gate 在非 loopback host 驗證時預期失敗。
- 建立 dev session 前：`/api/dev/identities` 回 401。
- 建立 dev session 前，即使傳送 allowlisted `x-nettopo-dev-user-email`，protected API 仍回 401。
- `POST /api/dev/session` 回 200。
- cookie 具 `HttpOnly`、`SameSite=Strict`、`Path=/`、`Max-Age=14400`。
- 建立 session 後：`/api/dev/identities` 回 200；dev identity header 可進入後續 API 參數驗證階段。

## Demo Seed 與密碼掃描

- `NETTOPO_ENABLE_DEMO_SEED=0` 執行 `scripts/seed-demo.mjs` 預期失敗，訊息為 Demo seed disabled；未進入資料庫連線。
- `db:migrate` 與 `db:seed:demo` 為分離命令，兩者皆先執行 RuntimePolicy validation。
- 掃描 `app`、`dist`、`scripts`、`.env.example`、`README.md`，未發現舊密碼 `sean002002dus`。
- 測試檔保留該字串只用於負向斷言，不屬於 client artifact。

## 驗收結論

Development Gate 本輪驗收通過，未發現 blocker。production fail-closed、dev session 前置條件、loopback 限制、Demo seed gate 與舊密碼移除均符合交接要求。

## 剩餘風險

- OIDC 尚未接入；production `authMode=disabled` 是安全封閉狀態，但不可提供正式登入服務。
- 本次沒有在真實 PostgreSQL 中執行允許狀態的 demo seed，以避免修改既有資料；gate 關閉及 migration/seed 命令分離已驗證。
- cookie 4 小時是否符合組織對「短效」的正式定義，仍應由 PM／資安政策確認。
