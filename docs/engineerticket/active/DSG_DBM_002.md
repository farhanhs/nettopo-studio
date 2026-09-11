# DSG_DBM_002 — Migration checksum 跨平台退件修正設計

| 欄位 | 值 |
|---|---|
| Group | DSG |
| Feature | DBM |
| Priority | P0 |
| Status | READY |
| Created | 2026-09-04 |
| Dependencies | QA_REL_001 QA_FAILED；PM_GOV_001-D29 APPROVED |

## 需求與來源

QA_REL_001 2026-09-04 發現 Windows checkpoint CRLF checkout 與 LF checksum 不一致；full tests 198/200，db:migrate idempotency 失敗。修正僅限跨平台 deterministic checksum，不改 SQL 語意、DB 權限、runtime/migration 分離或已發布 migration 歷史。

## 交付

- 讀取 loader、generator、runner、schema metadata、Git EOL 設定與既有 QA 證據。
- 比較 scoped `.gitattributes` EOL 策略及共用 canonical checksum 策略，選擇最小方案並說明限制。
- 明訂 CRLF、LF、mixed EOL、bare CR、BOM、末尾 newline 與 SQL 真實內容變更的處理；不要任意 trim/whitespace normalization，也不能改變 SQL literal 的語意。
- 設計與既有 applied checksum 相容的方式；不得以覆寫 schema_migrations checksum、接受任意 mismatch 或 DB reset 來通過。
- 列出 DEV allowed paths、QA fixtures、fresh checkout／working-tree 驗證及 no-path。無法在上述邊界內修正時回 PM，不擴張實作。
- 將方案寫入 `docs/engineerticket/contracts/MIGRATION-CHECKSUM-PORTABILITY.md`，完成後交 DEV_DBM_002；本次使用者已授權設計後繼續最小實作，不需新增 DSG 輪次。

## 停止條件

D29：不得 stage、commit、改寫歷史、push 或 deploy；只能完成設計與交接。若需修改既有 DB checksum/SQL 語意，停止回 PM。

## Requirement Traceability Gate

| 欄位 | 內容 |
|---|---|
| User Intent | 修正 QA_REL_001 發現的 Windows CRLF checkout 導致 migration checksum 誤判，讓 release checkpoint 可在不改 SQL 語意、不重寫 DB checksum 的前提下完成 pre-commit re-test。 |
| Historical Sources | `QA_REL_001.md`、`docs/dev測試紀錄/qa-rel-001-release-checkpoint-2026-09-04.md`、`db/postgres-migrations.js`、`scripts/lib/load-postgres-migrations.mjs`、`scripts/generate-postgres-schema-version.mjs`、`scripts/migrate-postgres.mjs`、`db/postgres-schema-version.ts`、`tests/migration-boundary.test.mjs`、`tests/postgres-migrations.test.mjs`、Git EOL evidence。 |
| Approved Decisions | `PM_GOV_001-D02` Migration/Runtime boundary；`PM_GOV_001-D29` 修正與驗證可繼續，但 commit point 前停止等使用者批准。 |
| Change Type | `CORRECT`；修正 checksum portability bug，不改產品語意。 |
| Affected Layers | Migration checksum helper、loader/generator/runner、generated schema metadata、schema status compatibility、DBM regression tests、QA_REL_001 re-test。 |
| Preserved Invariants | Runtime 不讀 SQL、不 migrate、不 DDL；已發布 SQL 不修改；不覆寫 `schema_migrations`；真 SQL 變更仍 fail closed；不改 DB role、secret、env、package 或 release checkpoint commits。 |
| Conflict Check | 只靠 `.gitattributes` 不能修復既有 CRLF worktree 或 DB applied checksum；必須使用共用 canonical checksum policy。 |
| Regression Map | LF/CRLF equality、existing published SQL EOL semantic audit、mixed/bare CR/BOM invalid、末尾 newline 保留、真內容變更拒絕、legacy checksum 相容、migrate twice idempotent、db:verify、runtime module graph 禁止 SQL/fs。 |
| Rollback／No-path | 若需要改 migration SQL、改 DB checksum、接受任意 mismatch、DB reset、Runtime 讀 SQL 或 broad EOL rewrite，停止回 PM。 |

## Design Output — 2026-09-04

正式契約已新增：[MIGRATION-CHECKSUM-PORTABILITY.md](../contracts/MIGRATION-CHECKSUM-PORTABILITY.md)。

設計裁定：

- 採共用 canonical checksum helper 作為最小修復。
- canonical checksum 只處理跨平台行尾：LF 與 CRLF 代表同一份 migration；CRLF 會轉 LF 後 checksum 與執行。
- 不做任意 `trim`、空白正規化、comment 正規化或 SQL literal 猜測。
- mixed EOL、bare CR、UTF-8 BOM 直接 fail closed。
- 末尾 newline 是否存在必須保留；新增或移除末尾 newline 仍是 checksum-significant。
- 既有 applied LF checksum 不需 DB rewrite；若曾以舊 CRLF raw checksum 套用，可只接受由同一 canonical SQL 產生的 `legacy_raw_crlf` alias。
- `legacy_raw_crlf` alias 只限目前已發布且已讀取審查的 `0001`–`0004`；未來 migration 預設只記 canonical checksum，不無限推廣 legacy alias。
- 真實 SQL token、字串、comment、空白或 final newline 變更仍必須被 checksum mismatch 擋下。
- `.gitattributes` 可作 scoped defense-in-depth，但不得作唯一修復，也不得造成 broad line-ending churn。
- DEV 可執行但不可修改 QA-owned 驗收腳本 `tests/qa-dbm-001-real-postgres.test.mjs`。

R1 PM 收斂後的唯讀 SQL EOL 語意檢查：

- 對 `db/migrations/*.sql` 搜尋 dollar-quoted body、COPY/stdin payload、E 字串、decode/chr、bytea、function/procedure、explicit `\r`/`\n` 等 physical-EOL-sensitive constructs：無命中。
- 只發現 `0001` 與 `0004` 有一般 dictionary `insert ... values`；未發現 multiline literal payload、function body、COPY payload 或 bytea payload。
- 因此現有 `0001`–`0004` 可套用 CRLF→LF canonical checksum/執行；若 DEV 後續發現任何實體 CR/LF bytes 語意依賴，須停止回 PM。

DEV_DBM_002 allowed paths 與 QA matrix 以 contract 為準；本票不修改 Register，避免跨組衝突。

## Handoff Boundary

使用者／PM 已授權設計完成後移交 DEV_DBM_002 執行最小修復。移交後仍受 D29 約束：

- 所有變更保持 unstaged。
- 禁止 `git add`、commit、amend、cherry-pick、rebase、merge、push、tag、deploy。
- DEV 完成後只能回報 diff、測試結果、預定 commit message 與風險，等使用者 commit approval。
