# Migration Boundary Refactor 實作紀錄

日期：2026-08-13

## 背景

依設計組確認的 Migration Boundary Refactor 決策，將 PostgreSQL migration / schema verification / application runtime 三個邊界切開：

- Migration CLI 是唯一讀取 `db/migrations/*.sql` 與執行 DDL 的元件。
- Application Runtime 不讀 SQL、不 migrate、不 seed dictionary、不 seed demo。
- Runtime 只做 schema readiness verification，未 ready 時回 safe 503。
- Demo seed 維持 Development Gate 下的獨立 command。

## 已完成

- 新增 `db/postgres-connection.ts`：
  - `createRuntimeSql()` 只讀 `DATABASE_URL`。
  - `createMigrationSql()` 只讀 `MIGRATION_DATABASE_URL`，不 fallback。
- 新增 `db/postgres-schema-version.ts`：
  - typed schema metadata。
  - 只含 required version、migration version/name/filename/checksum。
  - 不含 SQL body。
- 新增 `db/postgres-schema-check.ts`：
  - runtime-safe schema checker。
  - 支援 ready / uninitialized / outdated / too_new / checksum_mismatch / unavailable。
  - 提供 safe API error response。
- 新增 `scripts/lib/load-postgres-migrations.mjs`：
  - 唯一讀取 `db/migrations/*.sql` 的 loader。
- 新增 `scripts/generate-postgres-schema-version.mjs`。
- 新增 `scripts/verify-postgres-schema.mjs`。
- 新增 `GET /api/health/schema` safe schema status endpoint。
- `scripts/migrate-postgres.mjs` 改用 migration DSN 與 migration loader。
- `db/topology-postgres.ts` 移除 runtime 自動 migrate / dictionary seed。
- `seedDemoDatabase()` 改為 schema ready 後才 seed demo，不 migrate、不補 dictionary。
- `package.json` 新增 `db:generate-schema-version`、`db:verify`，並讓 `db:local:setup` 跑 migrate + verify，不自動 demo seed。
- 移除舊 `db/postgres-migration-manifest.ts` 與 `db/sql.d.ts`。
- README / `.env.example` 更新 migration DSN 與部署流程。

## 驗證結果

- `node node_modules\typescript\bin\tsc --noEmit --pretty false`：通過。
- `node --test tests/*.test.mjs`：通過，79 tests。
- scoped ESLint：通過，0 errors / 0 warnings。
- `npm.cmd run build:local`：通過。
- `node scripts\generate-postgres-schema-version.mjs`：通過。
- `rg "create table if not exists roles|alter table roles|insert into roles|postgres-migration-manifest|\.sql\?raw" dist`：無命中。
- `node scripts\migrate-postgres.mjs` 在未設定 `MIGRATION_DATABASE_URL` 時預期失敗。
- `node scripts\verify-postgres-schema.mjs` 在未設定 `DATABASE_URL` 時預期失敗。
- `node --env-file-if-exists=.env.local --env-file-if-exists=.env scripts\seed-demo.mjs` 在 DB unavailable 時回 `DATABASE_UNAVAILABLE`，未執行 demo seed。

## 注意事項

- 本次沒有新增空 `0005` migration。
- `.next/dev` 內仍可能有先前開發伺服器留下的舊錯誤 log/chunk；本次驗證以 `dist` build artifact 為準。
