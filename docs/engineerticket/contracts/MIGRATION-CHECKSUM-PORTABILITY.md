# MIGRATION-CHECKSUM-PORTABILITY — PostgreSQL Migration Checksum 跨平台契約

| 欄位 | 值 |
|---|---|
| Contract ID | MIGRATION-CHECKSUM-PORTABILITY |
| Primary Design Ticket | DSG_DBM_002 |
| Downstream DEV Ticket | DEV_DBM_002 |
| QA Ticket | QA_REL_001 同票 pre-commit re-test |
| Status | READY_FOR_DEV |
| Created | 2026-09-04 |
| Authority | PM_GOV_001-D02, PM_GOV_001-D29, QA_REL_001 2026-09-04 QA_FAILED evidence |

## 1. Requirement Traceability

| Gate Field | Content |
|---|---|
| User Intent | 修正 Windows checkpoint checkout 將 `db/migrations/*.sql` 轉成 CRLF 後造成 migration checksum 誤判，讓同一份已發布 SQL 在 LF／CRLF 工作樹下都能穩定 migrate/verify。 |
| Historical Sources | `docs/engineerticket/active/DSG_DBM_002.md`, `DEV_DBM_002.md`, `QA_REL_001.md`, `docs/dev測試紀錄/qa-rel-001-release-checkpoint-2026-09-04.md`, `db/postgres-migrations.js`, `scripts/lib/load-postgres-migrations.mjs`, `scripts/generate-postgres-schema-version.mjs`, `scripts/migrate-postgres.mjs`, `db/postgres-schema-version.ts`, `tests/migration-boundary.test.mjs`, `tests/postgres-migrations.test.mjs`, Git EOL evidence. |
| Approved Decisions | D02：Migration CLI 是唯一讀 SQL／DDL 元件，Runtime 不讀 SQL；D29：可繼續修正與驗證，但 commit point 前停下，禁止 stage/commit/push/deploy。 |
| Change Type | CORRECT：目前 checksum 對 checkout line ending 敏感，違反 migration boundary 的跨平台可驗證性；不改產品或 SQL 語意。 |
| Affected Layers | Migration loader、migration runner、schema metadata generator、schema status compatibility、DBM tests、QA_REL_001 release gate。 |
| Preserved Invariants | 已發布 migration SQL 不修改；不重寫 `schema_migrations`；Runtime 不讀 `db/migrations/*.sql`、不 import `node:fs`、不 DDL；真實 SQL 內容變更仍 checksum fail closed；不新增 migration；不改 DB role/secret/env。 |
| Conflict Check | `.gitattributes` 可減少未來 CRLF checkout，但不能修復已存在的 Windows worktree、也不能保證 loader/generator/runner 一致；必須以共用 canonical checksum policy 為主。 |
| Regression Map | LF/CRLF checksum equality、existing published SQL EOL semantic audit、mixed/bare CR/BOM invalid、trailing newline checksum significant、real SQL text change rejected、existing applied checksum compatibility、metadata sync、migrate twice idempotent、db:verify ready、runtime SQL/fs boundary。 |
| Rollback / No-path | 若修復需要改既有 SQL 語意、覆寫 DB checksum、接受任意 mismatch、DB reset、Runtime 讀 SQL 或放寬 checksum mismatch，即停止回 PM。 |

## 2. Problem Statement

QA_REL_001 於 2026-09-04 退件：

- final full Node suite：200 total / 198 pass / 2 fail。
- `tests/migration-boundary.test.mjs`：generated metadata checksum 與 loader checksum 不一致。
- 真實 DB `db:migrate` idempotency：runner 誤判 `0001_formal_topology_schema.sql` changed after applied。
- QA root cause：`db/postgres-schema-version.ts` 使用 LF-normalized checksum；Windows checkpoint worktree 中 `db/migrations/*.sql` 變成 CRLF；`definePostgresMigrations()` 對 raw string 直接 hash。

這不是 SQL 語意改變，也不是 DB 權限或 migration boundary 失效。它是 checksum input 缺少跨平台 canonicalization。

## 3. Strategy Comparison

| Strategy | 優點 | 風險／限制 | Verdict |
|---|---|---|---|
| Scoped `.gitattributes`: `db/migrations/*.sql text eol=lf` | 簡單，可減少未來 checkout 差異 | 不能修復既有 CRLF worktree；需重新 checkout 才生效；runner/generator 仍可能在其他來源拿到 CRLF；不解決既有 applied checksum 相容 | 可作第二防線，不作唯一修復 |
| Common canonical checksum helper | loader、generator、runner、tests 使用同一規則；可直接修復 Windows CRLF；不需 DB rewrite | 必須清楚限制只正規化行尾，不可 trim 或吞掉真 SQL 變更 | 推薦最小方案 |
| 接受多種 checksum mismatch fallback | 可快速通過部分 DB | 會弱化「已發布 migration 不可修改」；可能吞掉真實 SQL 變更 | 拒絕 |
| 重寫 `schema_migrations` checksum 或 reset DB | 表面解除本機 blocker | 破壞 migration audit trail；不可用於已發布資料庫 | 拒絕 |

Decision：DEV_DBM_002 採「共用 canonical checksum helper」為主；可加入 scoped `.gitattributes` 作為輔助，但修復不可依賴重新 checkout。`legacy_raw_crlf` alias 只適用目前已發布且已完成 EOL semantic audit 的既有 migration 版本，不無限推廣到未來 migration。

## 3A. Existing SQL EOL Semantic Audit

Before DEV applies CRLF normalization or compatibility aliases, the existing published migrations must be read-only audited for constructs that could intentionally depend on physical CR/LF bytes.

Audit command used by DSG on 2026-09-04:

```text
rg -n --glob "*.sql" "\$\$|\$[A-Za-z0-9_]*\$|\bCOPY\b|\bcopy\b|\bE'|\bdecode\s*\(|\bchr\s*\(|\\r|\\n|bytea|lo_import|from\s+stdin|function|procedure|language\s+plpgsql|do\s+\$" db/migrations
```

Result for current `0001`–`0004` migrations: no matches.

Follow-up check:

```text
rg -n --glob "*.sql" "insert\s+into|values" db/migrations
```

Result: only ordinary dictionary `insert ... values` rows in `0001_formal_topology_schema.sql` and `0004_topology_quantity_and_collapse.sql`; no multiline literal payload, function body, COPY stdin payload, bytea payload or explicit CR/LF data dependency was found.

Design conclusion:

- Existing published versions `0001`–`0004` may use CRLF→LF canonicalization for checksum and execution.
- Existing published versions `0001`–`0004` may include deterministic `legacy_raw_crlf` compatibility aliases if DEV confirms the generated alias exactly matches the old raw-CRLF hash.
- If DEV finds any SQL construct that depends on physical CR/LF bytes, DEV must stop and return to PM; do not treat all EOL as semantically equivalent.
- Future migrations should record canonical LF checksum only. Do not automatically add open-ended legacy aliases for future versions.

## 4. Canonical Migration Source Policy

### 4.1 Canonicalization Function

DEV 應建立一個單一 helper，由 generator、loader/runner 與 tests 共用。建議 API：

```ts
type MigrationEolStyle = "lf" | "crlf" | "none";

type CanonicalMigrationSource = {
  canonicalSource: string;
  checksumInput: string;
  eolStyle: MigrationEolStyle;
  checksum: string;
  compatibleChecksums: Array<{
    checksum: string;
    reason: "legacy_raw_crlf";
  }>;
};

function canonicalizePostgresMigrationSource(filename: string, source: string): CanonicalMigrationSource;
function postgresMigrationChecksum(source: string): string;
function isCompatiblePostgresMigrationChecksum(applied: string, expected: PostgresMigrationExpectation): boolean;
```

Minimal rule：

```text
canonicalSource = source.replaceAll("\r\n", "\n")
checksum = sha256(canonicalSource)
```

But only after fail-closed validation below.

### 4.2 EOL / BOM / Newline Rules

| Input condition | Behavior | Rationale |
|---|---|---|
| LF-only | Accept. Hash and execute as-is. | Canonical repository form. |
| CRLF-only | Accept only for audited existing migrations and ordinary future files without physical-EOL-sensitive constructs. Convert CRLF to LF before checksum and before migration execution. | Windows checkout must not change checksum or DB result. |
| No newline in single-line file | Accept if no CR/BOM; hash exact content. | No arbitrary newline insertion. |
| Mixed LF and CRLF | Reject before checksum. | Mixed EOL is likely accidental corruption; do not normalize ambiguity. |
| Bare CR | Reject before checksum. | Not a supported SQL migration line ending; avoids hidden semantic changes. |
| UTF-8 BOM | Reject before checksum. | SQL migrations are not BOM-tolerant by contract; do not silently strip content. |
| Final newline present | Preserve as LF after CRLF normalization. | Adding/removing final newline remains checksum-significant. |
| Final newline absent | Preserve absence. | No trim, no append. |
| Spaces/tabs/comments | Preserve exactly. | True SQL text changes must still alter checksum. |

Important SQL literal rule：physical checkout line endings are not how migrations should encode intentional CR/LF data inside SQL literals. If a future migration needs carriage returns or exact binary/text payloads, it must express them explicitly with SQL syntax such as escapes/functions, not rely on file line-ending bytes. If a migration uses function bodies, COPY payloads, multiline literals or explicit CR/LF data construction, DEV must prove normalization is semantically safe or stop for PM design.

## 5. Execution Semantics

`definePostgresMigrations()` must return:

```ts
type PostgresMigration = {
  version: string;
  name: string;
  filename: string;
  source: string;          // canonicalSource, not raw checkout text.
  checksum: string;        // sha256(canonicalSource).
  compatibleChecksums?: Array<{
    checksum: string;
    reason: "legacy_raw_crlf";
  }>;
};
```

Runner behavior:

1. Read migration file text via migration-only loader.
2. Validate and canonicalize line endings.
3. Execute `migration.source`, which is canonical LF text.
4. Insert canonical checksum for newly applied migrations.
5. For already-applied rows, compare by `isCompatiblePostgresMigrationChecksum()`.
6. If applied checksum matches neither canonical checksum nor an approved compatible checksum alias, fail with the existing “changed after applied” error.

This keeps DB behavior stable and avoids a world where Windows executes CRLF SQL while Linux executes LF SQL.

## 6. Existing Applied Checksum Compatibility

No existing database checksum may be overwritten by this fix.

Compatibility policy for existing published migrations:

- Existing rows whose checksum equals the canonical LF checksum pass.
- Existing rows whose checksum equals the deterministic legacy raw CRLF hash of the same current migration may pass as `legacy_raw_crlf`.
- Existing rows with any other checksum fail as `checksum_mismatch`.
- New migrations always record only canonical LF checksum.

Generated metadata may include compatibility aliases:

```ts
export type PostgresMigrationExpectation = {
  version: string;
  name: string;
  filename: string;
  checksum: string; // canonical LF checksum
  compatibleChecksums?: Array<{
    checksum: string;
    reason: "legacy_raw_crlf";
  }>;
};
```

Runtime schema checker still must not read SQL. It may compare DB rows against generated `checksum` plus generated `compatibleChecksums`. Safe HTTP responses must not expose checksum values.

Why this still fail-closes true SQL changes：the legacy CRLF alias is generated only for approved existing migration content with only LF→CRLF line-ending transformation. Any added/removed SQL token, changed string, changed comment, changed whitespace, changed final newline, BOM, mixed EOL or bare CR produces a different checksum and remains rejected. Future migration versions must not receive legacy aliases unless a future PM-approved compatibility ticket explicitly scopes that version.

## 7. `.gitattributes` Policy

DEV may add a scoped `.gitattributes` entry:

```gitattributes
db/migrations/*.sql text eol=lf
```

Conditions:

- This is defense-in-depth only.
- It must be scoped to migration SQL, not a broad repository-wide line-ending rewrite.
- It must not cause unrelated source/doc churn.
- The tests must still pass if a migration source is supplied to the loader as CRLF text.

If adding `.gitattributes` creates broad line-ending diffs or conflicts with checkpoint frozen-tree rules, skip it and rely on canonical checksum helper.

## 8. DEV_DBM_002 Allowed Paths

Primary allowed implementation paths:

- `db/postgres-migrations.js`
- `scripts/lib/load-postgres-migrations.mjs`
- `scripts/generate-postgres-schema-version.mjs`
- `db/postgres-schema-version.ts`
- `db/postgres-schema-check.ts`
- `tests/postgres-migrations.test.mjs`
- `tests/migration-boundary.test.mjs`
- `tests/postgres-schema-check.test.mjs`
- `tests/postgres-schema-status-fixtures.test.mjs`

Optional, only if scoped and no broad churn:

- `.gitattributes`

DEV evidence/report paths:

- `docs/engineerticket/active/DEV_DBM_002.md`
- `docs/dev測試紀錄/dev-dbm-002-migration-checksum-portability-2026-09-04.md`

Forbidden paths for DEV_DBM_002 unless PM explicitly expands scope:

- `db/migrations/*.sql`
- `db/schema.ts`
- app runtime routes/components
- credential/auth/pilot/import/export/routing product files
- package/package-lock, unless a test/tool dependency is already impossible without PM approval
- env files, local DB files, recovery artifact baseline files
- Register updates if PM has asked to avoid cross-group conflict
- QA-owned acceptance tests, including `tests/qa-dbm-001-real-postgres.test.mjs`; DEV may execute them but must not edit them to pass.

## 9. Test Matrix

### Unit / Contract

| Test | Expected |
|---|---|
| LF source checksum | Equals existing `expectedPostgresMigrations[*].checksum`. |
| CRLF source checksum | Equals LF checksum. |
| CRLF source execution | Runner executes canonical LF source, not raw CRLF source. |
| Mixed LF/CRLF source | Throws invalid migration EOL error. |
| Bare CR source | Throws invalid migration EOL error. |
| UTF-8 BOM source | Throws invalid migration source error. |
| Final newline removed/added | Produces different checksum and is rejected as true content change. |
| SQL token/comment/space changed | Produces different checksum and runner rejects applied row mismatch. |
| Legacy raw CRLF applied checksum | Accepted only when it equals generated `legacy_raw_crlf` alias. |
| Future migration metadata | Records canonical checksum only; no automatic legacy alias. |
| Arbitrary mismatch | Rejected with existing fail-closed migration-changed error. |

### Metadata / Boundary

| Test | Expected |
|---|---|
| `generate-postgres-schema-version.mjs` | Regenerates canonical LF checksums and compatible aliases without SQL body. |
| `tests/migration-boundary.test.mjs` sync test | Deep-equals generated metadata to loader output under LF and CRLF fixture. |
| Runtime graph test | Runtime modules still do not import `db/migrations`, `.sql?raw`, `node:fs`, or migration runner. |
| Safe schema response | Does not expose checksum values, SQL body, DSN, stack, token or secret. |

### Real PostgreSQL / QA_REL_001

| Test | Expected |
|---|---|
| `npm.cmd run db:migrate` twice | Second run applies none and exits 0 under Windows CRLF-capable checkout. |
| `npm.cmd run db:verify` | ready/currentVersion `0004`. |
| Checksum mismatch fail-safe | Temporarily corrupt DB checksum → mismatch; restore original checksum → ready after TTL/fresh check. |
| Existing applied LF checksum | Passes without DB rewrite. |
| Optional legacy CRLF checksum fixture | Passes only for deterministic alias; no arbitrary fallback. |
| Full serial Node suite | Single run pass; no cumulative partial pass. |
| TypeScript/build | Pass. |
| Release delta scan | Only DEV_DBM_002 named delta paths differ; no push/deploy/commit. |

## 10. QA_REL_001 Re-test Expectations

QA keeps the previous `QA_FAILED` record. After DEV_DBM_002 returns `READY_FOR_QA`, QA_REL_001 performs a same-ticket pre-commit re-test:

1. Confirm all DEV changes are unstaged per D29.
2. Confirm no new commit, tag, push, merge, deploy.
3. Re-run checksum portability unit tests.
4. Re-run full serial Node suite once.
5. Re-run TypeScript and build gates.
6. Re-run real PostgreSQL migrate/verify/idempotency/checksum fail-safe.
7. Re-run release delta scan and ensure only named corrective paths changed.
8. Report PASS/FAIL as “未提交候選”; even PASS waits for user commit approval.

## 11. No-path Conditions

Stop and return to PM if any of these becomes necessary:

- Editing any published migration SQL file.
- Updating existing `schema_migrations` rows as part of normal fix.
- Accepting arbitrary checksum mismatch.
- Resetting or recreating the database to pass.
- Making Runtime read SQL files or migration directory.
- Modifying DB role/grants/secrets/env to hide the issue.
- Broad repository line-ending rewrite.
- New dependency/package change.
- Commit/stage/push/deploy before explicit user approval.
