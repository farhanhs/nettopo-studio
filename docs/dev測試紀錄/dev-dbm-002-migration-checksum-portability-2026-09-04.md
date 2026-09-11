# DEV_DBM_002 — Migration checksum portability 開發紀錄

日期：2026-09-04

狀態：READY_FOR_QA；依 PM_GOV_001-D29 保持 unstaged，未 commit、未 push、未 deploy。

## 來源

- `docs/engineerticket/active/DSG_DBM_002.md`
- `docs/engineerticket/contracts/MIGRATION-CHECKSUM-PORTABILITY.md`
- `docs/engineerticket/active/DEV_DBM_002.md`
- `docs/engineerticket/active/QA_REL_001.md`
- `docs/dev測試紀錄/qa-rel-001-release-checkpoint-2026-09-04.md`
- `PM_GOV_001-D29`

## 實作位置

產品修正只在 checkpoint worktree：

`C:/Users/DUS/Desktop/project/nettopo-studio/.local/worktrees/dev-rel-001-checkpoint`

原 workspace 僅更新本 DEV ticket 與本開發紀錄。

## 變更摘要

- `db/postgres-migrations.js`
  - 新增 `canonicalizePostgresMigrationSource()`。
  - LF 與 CRLF migration source 以相同 canonical LF source 產生 checksum。
  - CRLF checkout 執行時也執行 canonical LF source。
  - mixed LF/CRLF、bare CR、UTF-8 BOM 直接 reject。
  - final newline、space、comment、SQL token 仍 checksum-significant。
  - runner 只接受 canonical checksum 或 deterministic `legacy_raw_crlf` alias。
  - `legacy_raw_crlf` alias 限定目前已發布且已審查的 `0001`–`0004`；未來 migration 預設只記 canonical checksum。

- `scripts/generate-postgres-schema-version.mjs`
  - generated metadata 增加 `compatibleChecksums`。
  - 不輸出 SQL body。

- `db/postgres-schema-version.ts`
  - canonical checksum 維持既有 LF checksum。
  - 增加 deterministic `legacy_raw_crlf` alias。

- `db/postgres-schema-check.ts`
  - runtime schema checker 只使用 generated metadata 判斷 canonical/alias checksum。
  - runtime 仍不讀 migration SQL，不 import migration loader。

- tests
  - 補 LF/CRLF equality。
  - 補 CRLF executes canonical LF source。
  - 補 mixed EOL、bare CR、UTF-8 BOM rejection。
  - 補 final newline 與真內容變更 checksum-significant。
  - 補 legacy raw CRLF alias accepted、arbitrary mismatch rejected。
  - 補 future migration no automatic alias。
  - 補既有 published SQL 不依賴 physical CR/LF bytes inside SQL literals。
  - 補 metadata under CRLF fixture sync。
  - 補 schema checker 接受 deterministic alias。

## 驗證結果

| Gate | Result |
|---|---|
| `node --test tests\postgres-migrations.test.mjs tests\migration-boundary.test.mjs tests\postgres-schema-check.test.mjs tests\postgres-schema-status-fixtures.test.mjs` | PASS，35/35 |
| `node node_modules\typescript\bin\tsc --noEmit --pretty false` | PASS |
| scoped ESLint | PASS |
| `node --env-file-if-exists=C:\Users\DUS\Desktop\project\nettopo-studio\.env.local --env-file-if-exists=C:\Users\DUS\Desktop\project\nettopo-studio\.env --test tests\*.test.mjs` | PASS，209/209 |
| checkpoint `scripts\migrate-postgres.mjs` first run | PASS，Applied none／Skipped 4 |
| checkpoint `scripts\migrate-postgres.mjs` second run | PASS，Applied none／Skipped 4 |
| checkpoint `scripts\verify-postgres-schema.mjs` | PASS，schema ready，currentVersion `0004` |
| `tests\qa-dbm-001-real-postgres.test.mjs tests\qa-pil-001-real-postgres.test.mjs` | PASS，2/2 |
| `npm.cmd run build:local` | PASS，僅既有 chunk size／route classification warning |
| artifact forbidden pattern scan against `dist` | PASS，無 migration SQL/runtime fs boundary 命中 |
| diff secret scan | PASS，無 DSN／password／secret／token／cookie／ciphertext／nonce 命中 |
| `git diff --check` | PASS，僅 Git CRLF warning |

## Diff 範圍

checkpoint worktree changed files：

- `db/postgres-migrations.js`
- `db/postgres-schema-check.ts`
- `db/postgres-schema-version.ts`
- `scripts/generate-postgres-schema-version.mjs`
- `tests/migration-boundary.test.mjs`
- `tests/postgres-migrations.test.mjs`
- `tests/postgres-schema-check.test.mjs`

未修改：

- `tests/qa-dbm-001-real-postgres.test.mjs`；此 QA-owned acceptance test 僅執行，未修改。
- `db/migrations/*.sql`
- app runtime routes/components
- package/package-lock
- env/local DB/recovery artifact baseline files

原 workspace governance/evidence changed files：

- `docs/engineerticket/active/DEV_DBM_002.md`
- `docs/dev測試紀錄/dev-dbm-002-migration-checksum-portability-2026-09-04.md`

## 預定 commit 訊息

`fix(db): make migration checksums portable across LF and CRLF`

## 剩餘風險

- QA_REL_001 仍需同票 pre-commit re-test，確認未提交候選、release delta 與 checkpoint equivalence。
- D29 仍禁止任何 staging／commit／push；QA 通過後仍需等待使用者明確批准 commit point。
