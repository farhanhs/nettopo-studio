# DEV_DBM_002 — Migration checksum 跨平台最小修正

| 欄位 | 值 |
|---|---|
| Group | DEV |
| Feature | DBM |
| Priority | P0 |
| Status | READY_FOR_QA |
| Created | 2026-09-04 |
| Dependencies | DSG_DBM_002 設計完成；PM_GOV_001-D29 APPROVED |

## 需求與執行位置

來源：QA_REL_001 2026-09-04 CRLF checksum 退件；使用者要求各組繼續至 commit 前。

- 設計完成後依 MIGRATION-CHECKSUM-PORTABILITY contract 開工。
- 唯一產品修改位置：`C:/Users/DUS/Desktop/project/nettopo-studio/.local/worktrees/dev-rel-001-checkpoint`。
- 開工基準 HEAD：`87a04d57d8d848b42924f01924286bf4bce46ff9`；先核對 HEAD/index/diff，有未知變動先回 PM。
- 只修設計指定的 loader/generator/checksum helper、必要 scoped EOL 規則及 regression tests；不得新增 runtime SQL/fs import。
- 不改已發布 SQL 語意、不重寫 schema_migrations、不調整 secrets/roles、不 reset DB。
- 完成 LF/CRLF equality、真實 SQL 變更仍拒絕、legacy checksum 相容、migrate twice/verify、TypeScript/build 與 regression。
- 寫明修正相對既有 frozen snapshot 的具名 delta；保留舊 artifact/hash/QA_FAILED，不以重建 baseline 隱藏變更。
- 完成後回報 READY_FOR_QA 並通知測試組 QA_REL_001 同票 pre-commit re-test。

## Commit 前硬停止

所有變更保持 unstaged；禁止 git add/commit/amend/cherry-pick/rebase/merge/push/tag/deploy。只交付 diff、測試、預定 commit 訊息與風險，等使用者批准，PM 或 QA 通過不能代替批准。

## 開發交付 — 2026-09-04

狀態：READY_FOR_QA；依 D29 保持 unstaged，未 commit、未 push、未 deploy。

實作位置：`C:/Users/DUS/Desktop/project/nettopo-studio/.local/worktrees/dev-rel-001-checkpoint`

變更摘要：
- `db/postgres-migrations.js` 新增 canonical migration source helper；LF 與 CRLF 皆以 canonical LF source checksum／執行，mixed EOL、bare CR、UTF-8 BOM fail closed。
- `db/postgres-migrations.js` runner 接受 canonical checksum 或 deterministic `legacy_raw_crlf` alias；任意 checksum mismatch 仍 fail closed。
- `legacy_raw_crlf` alias 限定目前已發布且已審查的 `0001`–`0004`；未來 migration 預設只記 canonical checksum。
- `scripts/generate-postgres-schema-version.mjs` 與 `db/postgres-schema-version.ts` 產出 canonical checksum 與 legacy alias metadata，不包含 SQL body。
- `db/postgres-schema-check.ts` runtime schema checker 只用 generated metadata 判斷 canonical/alias 相容，不讀 migration SQL。
- `tests/postgres-migrations.test.mjs`、`tests/migration-boundary.test.mjs`、`tests/postgres-schema-check.test.mjs` 補 LF/CRLF portability、invalid EOL、final newline、真內容變更、legacy alias、future migration no-alias、既有 SQL literal EOL audit 與 metadata sync regression。

驗證結果：
- `node --test tests\postgres-migrations.test.mjs tests\migration-boundary.test.mjs tests\postgres-schema-check.test.mjs tests\postgres-schema-status-fixtures.test.mjs`：PASS，35/35。
- `node node_modules\typescript\bin\tsc --noEmit --pretty false`：PASS。
- scoped ESLint：PASS。
- `node --env-file-if-exists=C:\Users\DUS\Desktop\project\nettopo-studio\.env.local --env-file-if-exists=C:\Users\DUS\Desktop\project\nettopo-studio\.env --test tests\*.test.mjs`：PASS，209/209。
- checkpoint runner `scripts\migrate-postgres.mjs` 連跑兩次：PASS，Applied none／Skipped 4。
- checkpoint `scripts\verify-postgres-schema.mjs`：PASS，schema ready，currentVersion `0004`。
- `tests\qa-dbm-001-real-postgres.test.mjs tests\qa-pil-001-real-postgres.test.mjs`：PASS，2/2。
- `npm.cmd run build:local`：PASS，僅既有 chunk size／route classification warning。
- artifact forbidden pattern scan against `dist`：PASS，無 migration SQL/runtime fs boundary 命中。
- diff secret scan：PASS，無 DSN／password／secret／token／cookie／ciphertext／nonce 命中。
- `git diff --check`：PASS，僅 Git CRLF warning。

剩餘風險：
- QA_REL_001 仍需在同票 pre-commit re-test 中獨立確認未提交候選、release delta 與 checkpoint equivalence。
- D29 仍禁止任何 staging／commit／push；即使 QA 通過，也需等待使用者明確批准 commit point。
