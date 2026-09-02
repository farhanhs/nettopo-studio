# Development Gate 架構實作紀錄

日期：2026-08-10

## 背景

PM 決議將 Demo 登入、可偽造身分 header、Demo seed 全部放到明確、預設關閉、fail-closed 的 development gate 後方。production 不得因預設值或漏設 env 啟用 Demo 能力。

## 已完成

- 新增 `app/lib/server/runtime-policy.ts` 作為唯一 RuntimePolicy 來源。
- 新增 `app/lib/server/request-identity.ts` 作為 protected API 的集中式身分解析器。
- 新增 `GET /api/runtime-capabilities`，只回傳安全能力摘要。
- 新增 `POST/DELETE /api/dev/session`，建立或清除短效 HttpOnly dev session cookie。
- 新增 `GET /api/dev/identities`，只有 dev gate 與 dev session 都成立時才回傳可測試身分。
- `/api/topology`、`/api/credentials`、`/api/audit-logs`、`/api/session` 改用 `requireRequestIdentity()`。
- 舊 `x-nettopo-user-email` 僅保留 deprecation warning，不再生效。
- 新 dev header 為 `x-nettopo-dev-user-email`，且必須同時符合 gate、dev session、allowlist。
- 移除 client 端 demo password 與 `validateLogin()`。
- Login UI 改為 gated passwordless `進入本機 Demo`。
- 非 production capability 載入後顯示 DEVELOPMENT MODE banner。
- IndexedDB demo seed 改為依 runtime capability 動態載入 demo topology。
- PostgreSQL migration 不再自動 seed demo users/sites/customers/topologies。
- 新增 `db:seed:demo`，必須 demoSeed capability 開啟才可執行。
- `build`、`build:local`、`preview`、`start`、`start:local`、`db:migrate`、`db:seed:demo` 接上 `scripts/validate-runtime-policy.mjs`。
- `.env.example` 改為 production-safe defaults，並補 local development example。

## 驗證結果

- `node node_modules\typescript\bin\tsc --noEmit --pretty false`：通過。
- `node --test tests/*.test.mjs`：通過，68 tests。
- scoped ESLint：通過，0 errors / 0 warnings。
- `npm.cmd run build:local`：通過。
- `scripts/validate-runtime-policy.mjs`：通過，預設摘要為 production / disabled / capabilities off。
- `scripts/seed-demo.mjs` 在 gate 關閉時預期失敗，未觸碰 DB。

## 測試組交接

已將修正摘要、受影響檔案與重驗重點送交測試組 task：`019fac8e-94dc-79c1-b156-7f242cf82967`。
