# NetTopo Studio Migration Boundary Refactor

- 決議日期：2026-08-13
- 狀態：架構決議已核准；詳細設計待確認；尚未授權實作
- 優先級：高，建議先於下一輪新功能開發完成
- 適用範圍：本機 PostgreSQL、Node/Vinext、Cloudflare、Docker、CI/CD、未來 On-Premise 部署

## 1. 決議摘要

NetTopo Studio 正式採用「資料庫修改者與應用程式使用者分離」的 Migration 管理架構。

核心決議：

1. Migration CLI 是唯一允許讀取 `db/migrations/*.sql` 並執行 `CREATE`、`ALTER`、正式字典更新的元件。
2. Application Runtime（Next/Vinext API、Node server、Cloudflare Worker）不得讀取 SQL migration、不得執行 migration、不得補建正式字典、不得建立 Demo 資料。
3. Application Runtime 只允許唯讀檢查資料庫 schema 是否符合程式要求，通過後才執行正常業務 SQL。
4. Demo Seed 是獨立的 development tool，必須受 Development Gate 控制，不得和 migration 或 runtime bootstrap 混在一起。
5. 已發布的 migration 永遠不可修改；修正必須新增下一個 migration。`schema_migrations` 的 checksum 持續作為完整性依據。

## 2. 決策背景

目前 `db/postgres-migration-manifest.ts` 使用 Vite 專用的 `*.sql?raw`：

```text
Vite / Vinext build → 能把 SQL 內嵌進 bundle
Node / Next script  → 不認得 .sql module，出現 Unknown module type
```

SQL 與 PostgreSQL 本身沒有損壞，問題在於 Application Runtime 依賴了 bundler-specific SQL loader。

現有 `scripts/migrate-postgres.mjs` 已採用 `node:fs/promises` 讀取 migration，這是應保留的正確邊界。需要移除的是 runtime 的 `?raw` dependency 與 first-request migration 行為。

## 3. 目標架構

```text
Build / Automated Tests
          │
          ▼
DB Compatibility Check
          │
          ▼
Migration CLI
  - fs.readFile(db/migrations/*.sql)
  - checksum
  - advisory lock
  - CREATE / ALTER / dictionary data
          │
          ▼
PostgreSQL schema_migrations
          │
          ▼
Schema Verification（唯讀）
  - required version
  - current version
  - checksum/status
          │
     ready│not ready
          │      └── 503 DATABASE_SCHEMA_OUTDATED
          ▼
Application Runtime
  - SELECT / INSERT / UPDATE / DELETE
  - 不讀 SQL 檔
  - 不執行 migration
  - 不 seed demo
  - 不補 dictionary
          │
          ▼
Health Check / Normal Traffic
```

## 4. 三層責任邊界

### 4.1 Migration Layer

允許：

- 從 repository 讀取 `db/migrations/*.sql`。
- 依檔名排序 migration。
- 計算 SHA-256 checksum。
- 使用 PostgreSQL advisory lock 防止重複執行。
- 建立或更新 schema、constraint、index 與正式字典資料。
- 寫入 `schema_migrations`。

禁止：

- 修改已經發布或套用的 migration。
- 建立客戶、使用者、拓樸等 Demo 業務資料。
- 由 HTTP request 觸發。

標準入口：

```text
npm run db:migrate
```

### 4.2 Schema Verification Layer

只允許唯讀檢查：

- `schema_migrations` 是否存在。
- DB 目前最高版本與程式要求版本。
- 必要 migration 是否完整套用。
- 是否出現 checksum 不一致或未知版本狀態。

建議輸出契約：

```ts
type PostgresSchemaStatus = {
  ready: boolean;
  requiredVersion: string;
  currentVersion?: string;
  missingVersions: string[];
  incompatibleVersions: string[];
};
```

建議錯誤：

```json
{
  "error": "DATABASE_SCHEMA_OUTDATED",
  "requiredVersion": "0004",
  "currentVersion": "0003",
  "action": "Run npm run db:migrate before starting this release."
}
```

HTTP status 使用 `503 Service Unavailable`，避免將部署狀態誤判為一般資料驗證錯誤。

### 4.3 Application Runtime Layer

允許：

- 驗證 schema ready。
- 執行正常業務資料讀寫。
- 使用既有 permission、credential、audit 與 validation 邊界。

禁止：

- import `*.sql?raw`。
- 使用 `fs.readFile()` 讀 migration。
- 執行 migration 或 DDL。
- 呼叫 `seedDictionaries()`。
- 建立 Demo user/site/customer/topology。
- 因資料表或欄位不存在而自行修補 schema。

## 5. Migration 與資料分類

### 5.1 正式 migration 管理

- Schema、table、column、constraint、index。
- roles、permissions。
- device/group/link/credential/config kinds。
- 正式、可重現的基礎字典資料。

未來新增字典值，例如新的 device type，必須新增 migration：

```text
0005_add_device_types.sql
```

不得由 runtime 啟動時自行 `INSERT`。

### 5.2 Demo Seed 管理

Demo 資料包括：

- Demo users 與 sites。
- Demo customer。
- SAMPLE_PROJECT。
- Sean Spine-Leaf topology。
- 其他只供本機或測試使用的資料。

標準流程：

```text
npm run db:migrate
→ npm run db:verify
→ npm run db:seed:demo
→ npm run dev
```

`db:seed:demo` 必須：

- 受 `RuntimePolicy` 與 `NETTOPO_ENABLE_DEMO_SEED=1` 控制。
- 在 production profile fail closed。
- 可重複執行且結果 idempotent。
- schema 未 ready 時拒絕執行並提示先 migrate。
- 不讀取或執行 migration SQL。

## 6. 模組規劃方向

設計組需評估並提出最終命名；目前建議如下。

### 保留

- `db/migrations/*.sql`
- `db/postgres-migrations.js`：排序、checksum、lock、runner。
- `scripts/migrate-postgres.mjs`：使用 `fs.readFile()` 的唯一 migration loader。

### 建議新增

- `db/postgres-schema-version.ts`：程式所要求的 schema version，不含 SQL source。
- `db/postgres-schema-check.ts`：runtime-safe、唯讀 schema verification。
- `scripts/verify-postgres-schema.mjs`：部署與本機可執行的 `db:verify`。
- `tests/postgres-schema-check.test.mjs`。
- `tests/migration-boundary.test.mjs`。

### 建議移除

- `db/postgres-migration-manifest.ts`。
- `db/sql.d.ts`。
- Application Runtime 對 `postgresMigrations`、`runPostgresMigrations()` 的依賴。
- `databaseBootstrapped` 與 first-request migration。
- Runtime `seedDictionaries()`。

### 建議調整

- `db/topology-postgres.ts`：只連線、驗證 schema、執行業務 SQL。
- `scripts/seed-demo.mjs`：只做 Demo seed，先驗證 schema。
- `package.json`：提供 `db:migrate`、`db:verify`、`db:seed:demo`、`db:local:setup`。
- `.env.example`、`README.md`：說明本機、production、CI/CD 與 On-Premise 的操作順序。

## 7. 環境變數與權限分離方向

設計組需決定是否採用不同 DB credential；建議至少支援：

```text
DATABASE_URL                 Application Runtime 使用，只需業務 DML 權限
MIGRATION_DATABASE_URL       Migration Job 使用，允許 DDL
NETTOPO_REQUIRED_DB_VERSION  是否由環境覆寫待決；預設建議由程式版本固定
NETTOPO_SCHEMA_CHECK_MODE    startup | first-request | health-check，待決
```

推薦安全原則：

- Runtime DB role 不具有 `CREATE`、`ALTER`、`DROP` 權限。
- Migration DB role 僅存在於部署環境／CI secret。
- Application container 或 Worker 不需要 SQL migration 檔案與 migration credential。
- `requiredVersion` 優先由應用程式版本固定，避免環境誤設使不相容版本被放行。

## 8. 部署流程

### 8.1 Local Development

```text
db:local:init
→ db:local:start
→ db:migrate
→ db:verify
→ db:seed:demo（development gate 開啟時）
→ dev/start:local
```

可保留 `db:local:setup` 作為單一快速入口，但每個子步驟必須明確且可單獨執行。

### 8.2 Docker / Node

```text
Build image
→ Automated tests
→ Migration job（單一執行者）
→ db:verify
→ Deploy application instances
→ Health check
```

### 8.3 Cloudflare

```text
Build/test
→ CI 或受控管理環境執行 migration
→ db:verify
→ Deploy Worker
→ Health check
```

Worker runtime 不負責讀 repository SQL 或修改 schema。

### 8.4 On-Premise

```text
Backup / compatibility check
→ db:migrate
→ db:verify
→ 啟動新版本
→ health check
```

未來具破壞性的 schema 變更採用 Expand → Migrate Data → Contract，保留 rolling upgrade 與回退空間。

## 9. 驗收條件

1. Repository 與 build artifact 的 Application Runtime 不再包含 `*.sql?raw` import。
2. Node 可直接 import `db/topology-postgres.ts`，不出現 SQL module type 錯誤。
3. HTTP request 不會執行 DDL、migration 或正式字典 seed。
4. DB 尚未 migrate 時，API 回傳明確 `503 DATABASE_SCHEMA_OUTDATED`。
5. `db:migrate` 能依序套用 `0001–0004` 並驗證 checksum。
6. 修改已套用 migration 時，runner 必須拒絕。
7. `db:verify` 對 ready、outdated、missing table、checksum mismatch 均有可辨識結果。
8. `db:seed:demo` 在 schema ready 且 development gate 開啟時成功且 idempotent。
9. `db:seed:demo` 在 production 或 schema outdated 時拒絕執行。
10. 關閉 Demo seed 不影響正式 schema 與字典。
11. Node/Vinext、Cloudflare build、Docker artifact 不依賴 runtime SQL files。
12. Runtime DB credential 在權限測試中不能執行 DDL。

## 10. 待設計組確認的問題

1. `required schema version` 應由單一程式常數、build metadata，還是環境變數決定？
2. Runtime schema check 採 process startup、first request、定期 health check，或混合策略？
3. 是否在第一階段立即拆分 `DATABASE_URL` 與 `MIGRATION_DATABASE_URL`？
4. `schema_migrations` 尚不存在時的錯誤契約與維運提示內容。
5. 發現 DB 版本高於 Application 支援版本時，應回 `DATABASE_SCHEMA_TOO_NEW` 還是允許相容範圍？
6. `db:local:setup` 是否預設包含 Demo seed，或必須另設明確參數？
7. Cloudflare、Docker、On-Premise 各自的 migration job 由何種命令與 secret 執行？
8. Schema verification 的快取生命週期、重試與失敗恢復策略。
9. 是否在第一階段加入 expand/contract policy 文件與 migration template。
10. 是否需要 health endpoint 暴露安全的 schema ready 狀態；不得暴露 DB URL 或敏感資訊。

## 11. 實作順序建議

本節僅供設計，不代表已授權開發。

1. 確定 schema version 與 verification 契約。
2. 建立唯讀 schema checker 與錯誤碼。
3. 從 `topology-postgres.ts` 移除 runtime migration／dictionary seed。
4. 移除 `?raw` manifest 與型別宣告。
5. 拆分並修復 Demo seed command。
6. 補齊 package scripts、文件與測試。
7. 驗證 Node、Vinext、Cloudflare 與部署流程。

## 12. 停止條件

本文件只核准架構方向：

> Migration CLI、Schema Verification、Application Runtime 三層分離。

目前尚未核准實作。設計組完成模組、資料契約、環境變數、錯誤碼、部署流程與風險規劃後必須停止，等待使用者確認；未取得確認前不得修改程式、migration、package、測試或轉交開發組動工。
