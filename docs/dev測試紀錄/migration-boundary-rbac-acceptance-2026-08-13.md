# Migration Boundary 與多使用者權限驗收 - 2026-08-13

## 結論

- Migration／runtime 邊界：通過。
- 核心 topology RBAC 矩陣：通過。
- Schema 錯誤契約與 TTL 恢復：通過。
- 真實 PostgreSQL ready 狀態的 Demo seed idempotency：未驗證，測試環境 `DATABASE_URL` 回 unavailable。
- Customer 跨站寫入語意：需要 PM／開發確認；目前 customer 為全域資料，站長若對其中一張 topology 可寫，即可 rename 整個 customer。

## 新增測試

- `tests/migration-boundary.e2e.test.mjs`
- `tests/postgres-schema-status-fixtures.test.mjs`
- `tests/rbac-multi-user-fixtures.test.mjs`
- `tests/db-seed-boundary.test.mjs`

## 假資料

- Sites：`north-1`、`north-2`。
- Users：boss、north-1 manager、north-2 manager、north-1 engineer、north-2 engineer、sales/procurement。
- Topologies：north-1 owned、north-2 owned、engineer-owned cross-site fixture。
- Schema fixtures：empty、0001-0003、0001-0004、0005 extra、0004 changed checksum、unavailable→ready TTL recovery。

## 驗證結果

### Migration boundary

- Runtime graph 無 `db/migrations`、`.sql?raw`、`node:fs`、`runPostgresMigrations`、舊 manifest：PASS。
- Direct import `db/topology-postgres.ts`：PASS，沒有 Unknown module type。
- Runtime source 無 DDL／dictionary seed：PASS。
- Migration CLI 使用 `MIGRATION_DATABASE_URL`：PASS。
- 缺少 migration DSN 時 fail closed，不 fallback：PASS。
- `db:verify` 使用 `DATABASE_URL` 且 read-only：PASS。
- Health schema 於 DB unavailable 回 safe 503：PASS。
- 最新 dist 無 SQL body／raw manifest：PASS。
- migrations 最後版本為 0004，無空 0005：PASS。

### Schema states

- ready、uninitialized、outdated、too_new、checksum_mismatch、unavailable：PASS。
- too-new DB 明確拒絕服務：PASS。
- protected topology、credentials、audit、session API 在 schema unavailable 時均回 503：PASS。
- failure cache 5 秒 TTL 後可恢復 ready，無需重啟：PASS。
- safe response 不含 DSN、secret、stack、SQL body 或實際 checksum：PASS。

### RBAC

- Boss 全域讀寫：PASS。
- North-1／North-2 manager 只讀寫自己 site topology：PASS。
- Engineer 只讀寫 created/owned topology：PASS。
- Sales/Procurement 全域唯讀：PASS。
- topology 跨站 manager 存取拒絕：PASS。
- credential：boss read/write；manager、engineer、sales masked-read only：PASS。
- audit.read 只有 boss：PASS。
- 舊 identity header 無法冒用；新 header 需 gate/session/allowlist：由既有及完整回歸測試 PASS。

### Demo seed

- `db:local:setup` 不含 demo seed：PASS。
- gate off／production 拒絕 seed：PASS。
- schema unavailable 時回 `DATABASE_UNAVAILABLE` 且不 seed：PASS。
- dictionary 位於 migration，與 demo seed 無關：PASS。
- schema ready 下實際 seed idempotency：NOT RUN，runtime DSN 無法連線。

## 工具結果

- `node --test tests/*.test.mjs`：95 passed。
- TypeScript：PASS。
- 新增測試 scoped ESLint：PASS。
- `npm.cmd run build:local`：PASS。
- schema metadata generator：PASS，required version 0004。
- `git diff --check`：無 whitespace error，僅 CRLF 提醒。

## 待確認風險

`renameCustomer()` 只要求該 customer 至少有一張 topology 對目前使用者可寫，之後更新的是全域 customer row。若同一 customer 橫跨 north-1 與 north-2，north-1 manager 的 rename 會影響 north-2 顯示。`createTopology()` 也沒有先驗證使用者是否可存取傳入的 customerId。若產品定義 customer 必須站點隔離，這是權限缺口；若 customer 有意設計為跨站共享，應在 PM 權限規格明記。

## PM 正式決議：Customer 跨站共享

決議日期：2026-08-13

正式採用 B 模型：Customer 是公司級跨站共享主檔；Topology 才是站點隔離與所有權邊界。本階段不新增 customer site ownership migration。

### 修正後驗收規則

- `renameCustomer` 僅具 `customer.write.all` 的角色可執行，目前等同 Boss-only。
- Site Manager、Engineer、Sales/Procurement 不得 rename Customer。
- `deleteCustomer` 維持 Boss-only。
- `duplicateCustomer` 必須納入 Customer 全域 mutation 稽核，不得成為共享主檔授權繞過路徑。
- `createTopology` 必須先確認 Customer 存在，且 server mode 必須提供明確 `siteId`。
- Boss 可在任何有效 site 為任何 Customer 建立 topology。
- Site Manager 的 `siteId` 必須屬於本人，且本人已能透過該站點既有 topology 讀取 Customer。
- Engineer 的 `siteId` 必須屬於本人，且本人已能透過 created/owned topology 讀取 Customer。
- Sales/Procurement 不得建立 topology。
- Customer 不存在與無權存取應統一回覆 `Customer not found or not accessible`，避免 ID enumeration。
- `createCustomer` 可原子建立新 Customer 與第一張 topology，但 Site Manager／Engineer 必須提供本人已授權的明確 site。
- Site Manager／Engineer 的 Customer 清單繼續由可讀 topology 反推。

### 後續必測案例

- 四角色 `renameCustomer` 權限矩陣。
- `duplicateCustomer` 不得繞過共享主檔 mutation 邊界。
- `createTopology` 的 Customer 存在性、明確 site、site membership 與既有 Customer 可見性組合。
- 猜測其他站點 customerId 時，非 Boss 一律取得相同安全錯誤。
- `createCustomer` 第一張 topology 的明確 site 授權與原子性。
- 同一 Customer 同時具有 north-1／north-2 topology 時，各角色 Customer 可見性不洩漏不可讀 topology。

### 狀態

- Migration Boundary：通過。
- RBAC：條件式通過；等待開發組依上述規則修正並由測試組獨立重驗。
