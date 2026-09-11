# QA_REL_001 — Checkpoint Chain 與 Frozen-tree Equivalence 驗收

| 欄位 | 值 |
|---|---|
| Group | QA |
| Feature | REL |
| Priority | P0 |
| Status | QA_FAILED |
| Planned Order | 052 |
| Checkpoint | Release Acceptance |
| Dependencies | DEV_REL_001 READY_FOR_QA |
| Created／Updated | 2026-08-30 |

## Handoff History

| Date | From | To | Status | Summary |
|---|---|---|---|---|
| 2026-09-02 | PM | QA | IN_QA | DEV_REL_001 已 READY_FOR_QA；QA_REL_001 啟動獨立 Release Checkpoint 驗收，禁止 push/merge/deploy |
| 2026-09-04 | QA | PM/DEV | QA_FAILED | Release checkpoint recovery/path/hunk/secret/tree diff 前置 gate 通過；final full Node suite 與 db:migrate idempotency 因 PostgreSQL migration checksum 對 Windows CRLF checkout 敏感而失敗，禁止 push/merge/deploy |
| 2026-09-04 | DEV | QA | READY_FOR_QA | DEV_DBM_002 checksum portability unstaged candidate returned for same-ticket pre-commit re-test |
| 2026-09-04 | QA | PM/DEV | CANDIDATE_PASS_PENDING_USER_COMMIT_APPROVAL | DEV_DBM_002 unstaged candidate re-test 通過：targeted 33/33、real DB migrate idempotent、full serial Node 209/209、tsc/build/scoped ESLint/secret/delta/Browser UAT pass；依 D29 等待使用者批准 commit point |
| 2026-09-04 | DEV | QA | HOLD | DEV_DBM_002 handoff 暫停；等待 MIGRATION-CHECKSUM-PORTABILITY contract 小範圍修訂後再正式交 DEV/QA。前一列僅保留為 HOLD 前 evidence，不作 QA_PASSED 判定 |
| 2026-09-04 | DEV | QA | READY_FOR_QA revised-final | DEV_DBM_002 revised-final unstaged candidate returned；要求重跑 QA_REL_001 pre-commit matrix，full suite 明確使用 `--test-concurrency=1` |
| 2026-09-04 | QA | PM/DEV | REVISED_FINAL_CANDIDATE_PASS_PENDING_USER_COMMIT_APPROVAL | revised-final candidate re-test 通過：7檔hash已記錄、targeted 35/35、real DB migrate idempotent、full serial Node 209/209 with `--test-concurrency=1`、tsc/build/scoped ESLint/security/delta/Browser UAT pass；依 D29 停等使用者批准 commit point |

## D29 同票 Pre-commit Re-test 交接 — 2026-09-04

- 保留上次 QA_FAILED。先準備 LF/CRLF、真內容變更拒絕、既有 checksum 相容與 migrate idempotency matrix；等待 DEV_DBM_002 READY_FOR_QA 後重驗。
- 基準 HEAD `87a04d57d8d848b42924f01924286bf4bce46ff9` 加具名 unstaged corrective delta，不要求把修正 tree 偽裝成與舊 frozen snapshot byte-equal。
- 在修正候選上執行完整單次 serial full suite（不得用累計分次通過冒充單次完整 PASS）、tsc/build、真 DB、必要 Browser/security/artifact regression。
- 掃描新增 diff及更新 recovery delta，保留舊證據；只允許具名 corrective paths 與 QA evidence 差異。
- 正式產品/DB/DEV tests 不由 QA 修改。QA 可新增自己的測試／日誌，不變更被驗收 commits。
- 回報 PASS/FAIL 時必須註明「未提交候選」，通過也只到等待使用者 commit approval；禁止 stage/commit/push/merge/deploy。

## Objective（原驗收範圍）

獨立驗證 recovery snapshot 可重建、每個 checkpoint 可辨識且符合 Ticket scope、逐 commit 可測，以及最終 tree 與 PM freeze tree 等價。

## Acceptance Matrix

- Recovery patch/archive/hash 重算與隔離還原通過。
- Commit message 含 primary Ticket；無混入 unmapped path／secret／generated artifacts。
- 共用檔案 hunk ownership 有 release map，無整檔偷帶其他票。
- 每 commit 執行票面 targeted test；DB、Browser、Security checkpoint 使用對應真實 gate。
- Final serial full Node、TypeScript、build:local、scoped/full lint evidence、DB verify、Pilot Browser、Import Browser／round-trip／secret scan通過。
- Final tree content/mode/type 與 frozen snapshot 等價；只有核准 release metadata 可列為差異。
- QA 不修改產品碼、commit內容、migration、env、DB role/grant配合通過。

## Stop Condition

Recovery 不可還原、commit 無 Ticket、secret/generated artifact 命中、任一測試失敗或 tree mismatch 即 `QA_FAILED`／`QA_BLOCKED`，不得部署。

## QA Result — 2026-09-04

結果：`QA_FAILED`。

通過項目：

- checkpoint worktree branch / HEAD 符合 PM 指定，且 pre-QA `git status --short` 乾淨。
- recovery artifact `SHA256SUMS.txt` 10/10 重新計算相符。
- R1 canonical artifact 不含 raw full-index patch。
- PATH-MAP：206 rows、204 include、2 exclude、0 unmapped。
- HUNK-MAP：16 shared-file entries，required hunk ownership 無遺漏。
- commit chain：base 後 17 commits；每個 commit subject 皆含 Ticket ID，無 unmapped changed file。
- QA-only isolated restore：base `cbce10bba027d246ef78e92a1e2f01660da55e1f` + delete manifest + current-files overlay 後，204 frozen paths 全部相符、0 mismatch。
- frozen diff path equivalence：checkpoint diff paths 204/204 相符；4 個 content mismatch 皆屬 release metadata 文件。
- active secret value scan：ignored `.env.local` 的 3 個敏感值在 tracked files 中 0 命中；0 tracked generated/local artifact paths。

退件 blocker：

- `node --env-file-if-exists=.env.local --env-file-if-exists=.env --test tests\*.test.mjs`：200 total / 198 pass / 2 fail。
- `tests/migration-boundary.test.mjs` 顯示 `db/postgres-schema-version.ts` 的 expected checksum 與 `db/migrations/*.sql` loader checksum 不一致。
- `tests/qa-dbm-001-real-postgres.test.mjs` 在 `db:migrate` idempotency gate 失敗；單獨重跑 `npm.cmd run db:migrate` exit `1`，safe output 顯示 migration runner 判定 `0001_formal_topology_schema.sql` changed after applied。
- QA 確認根因為 Windows checkpoint working tree 將 `db/migrations/*.sql` checkout 成 CRLF，而 metadata checksum 對應 LF-normalized SQL；loader / migration runner 直接 hash 當前 CRLF text，導致跨平台 checksum 不穩定。

測試紀錄：

- [qa-rel-001-release-checkpoint-2026-09-04.md](../../dev測試紀錄/qa-rel-001-release-checkpoint-2026-09-04.md)

DEV 修正方向：

- 將 migration checksum 政策改為跨平台 canonical，例如 loader/generator 統一 LF-normalize 後 checksum，或加入 `.gitattributes` 強制 `db/migrations/*.sql text eol=lf` 並重驗乾淨 checkout。
- 不得修改已發布 migration SQL 語意來配合 checksum。
- 增加 CRLF migration fixture / db:migrate idempotency regression。
- 修正後需重新交 `DEV_REL_001 READY_FOR_QA`，由 QA_REL_001 同票 re-test；在通過前不得 push checkpoint branch、merge 或 deploy。

## D29 Pre-commit Re-test Matrix

依 2026-09-04 PM D29 校正：新 commit 前需等待使用者批准；本票保留 `QA_FAILED`，只準備同票 pre-commit 重驗矩陣，不改產品、不碰 Register、不 push。

QA 已新增 QA-only 顯式腳本：

- `tests/qa-rel-001-checksum-portability.mjs`

DEV_DBM_002／後續 candidate 回 `READY_FOR_QA` 後，QA_REL_001 re-test 至少需確認：

- worktree SQL 與 generated schema metadata 相符。
- forced CRLF fixture 與 LF fixture checksum 等價。
- 真 SQL 內容變更仍會改變 checksum 並被拒絕。
- `db:migrate` 對既有 ready DB idempotent pass。
- `db:verify` 回 ready/currentVersion `0004`。
- full serial Node suite 必須單次完整通過，不得以累計 199+1 取代。
- 舊 frozen snapshot 只能加具名 corrective delta，不得混入產品語意變更。
- secret/artifact boundary 維持 0 active secret / DSN / cookie / token / plaintext credential / ciphertext / nonce。

## Same-ticket Pre-commit Re-test — 2026-09-04

DEV_DBM_002 unstaged candidate result：`CANDIDATE_PASS_PENDING_USER_COMMIT_APPROVAL`。

受測 checkpoint worktree：

- `.local/worktrees/dev-rel-001-checkpoint`
- HEAD 保持 `87a04d57d8d848b42924f01924286bf4bce46ff9`
- unstaged candidate files 只限：
  - `db/postgres-migrations.js`
  - `db/postgres-schema-check.ts`
  - `db/postgres-schema-version.ts`
  - `scripts/generate-postgres-schema-version.mjs`
  - `tests/migration-boundary.test.mjs`
  - `tests/postgres-migrations.test.mjs`
  - `tests/postgres-schema-check.test.mjs`

Re-test evidence:

- Targeted checksum/schema tests：33/33 PASS。
- Real PostgreSQL：`db:verify` ready/currentVersion `0004`；`db:migrate` 連跑兩次 `Applied: none. Skipped: 4`；再 verify ready。
- Full serial Node：單次完整 `209/209 PASS`。
- TypeScript：PASS。
- `build:local`：PASS，僅既有 chunk size / route classification warning。
- Scoped ESLint：PASS。
- `git diff --check`：PASS，僅 Git CRLF touch warnings。
- dist / diff / active secret scan：PASS；ignored env 3 sensitive values checked，tracked files 0 hit。
- release delta / frozen equivalence：PASS；candidate 僅七個具名 DEV_DBM_002 corrective files，無 unexpected extra、無 missing frozen path，既有四個 release metadata delta 不變。
- Browser UAT impact：`tests\qa-pil-003-engineer-uat.mjs` PASS；Pilot login/logout/tamper、TXT/MD/CSV import、canvas routing、safe ZIP、secret/formula scan、cleanup=0。
- `npm.cmd run lint`：仍因 Windows lacks `bash` blocked；本輪 scoped ESLint 已通過，release 前需由具 bash/CI 環境補 full lint。

依 D29：本結果只代表未提交候選通過 QA re-test；不授權 QA 自行 stage/commit/push/merge/deploy。checkpoint branch 仍等待使用者批准 commit point。

## DEV_DBM_002 HOLD — 2026-09-04

DEV 已通知前一則 `READY_FOR_QA` 交付暫停，等待 MIGRATION-CHECKSUM-PORTABILITY contract 小範圍修訂後再正式重交。

因此：

- 上方 `CANDIDATE_PASS_PENDING_USER_COMMIT_APPROVAL` 僅保留為 HOLD 前 evidence。
- QA_REL_001 不改為 `QA_PASSED`。
- 有效 release 狀態仍受 2026-09-04 原始 `QA_FAILED` 阻擋。
- 後續需等待 revised contract / revised DEV handoff 後，重新執行同票 pre-commit re-test。
- D29 仍有效：禁止 git add/commit/amend/rebase/cherry-pick/merge/push/tag/deploy。

## DEV_DBM_002 Revised-final Pre-commit Re-test — 2026-09-04

結果：`REVISED_FINAL_CANDIDATE_PASS_PENDING_USER_COMMIT_APPROVAL`。

Candidate identity:

- checkpoint worktree：`.local/worktrees/dev-rel-001-checkpoint`
- candidate base HEAD：`87a04d57d8d848b42924f01924286bf4bce46ff9`
- candidate files：7 個 unstaged DEV_DBM_002 files only
- candidate hashes：
  - `f10858e772ef53c60802d9d77a7d74fb6dad50ccba195213fa8a617838e25369` — `db/postgres-migrations.js`
  - `22a894df703dcd7c7266aa7ebbc298f0995a88fa44f4cd847ef19860a4603dd9` — `db/postgres-schema-check.ts`
  - `6c142aba7a962e425c39122c2b1faf7c9ebef6cd7e1836db12a9c59a7a633481` — `db/postgres-schema-version.ts`
  - `b7e02e013833e68d9f3d03ea417a9fab1b0fb0782b3b96ffac4e1502295e794c` — `scripts/generate-postgres-schema-version.mjs`
  - `5cb8dac16a568e27f389e2a7049dcb9ae8e5ba414afa7c937e4adee6d0a12e17` — `tests/migration-boundary.test.mjs`
  - `fd969776e7892227c3d9100775b6a2ccfb0d0b068f3136f47d2bc5e1c8760c31` — `tests/postgres-migrations.test.mjs`
  - `220d6aea5a5f0e75072cbb479a03a94bd6c4261b69bce3567c0df7da55484868` — `tests/postgres-schema-check.test.mjs`

Re-test evidence:

- Targeted checksum/schema tests：35/35 PASS。
- Real PostgreSQL：`db:verify` ready/currentVersion `0004`；`db:migrate` 連跑兩次 `Applied: none. Skipped: 4`；再 verify ready。
- Full serial Node：`node --env-file-if-exists=C:\Users\DUS\Desktop\project\nettopo-studio\.env.local --env-file-if-exists=C:\Users\DUS\Desktop\project\nettopo-studio\.env --test --test-concurrency=1 tests\*.test.mjs`，單次完整 `209/209 PASS`。
- TypeScript：PASS。
- `build:local`：PASS，僅既有 chunk size / route classification warning。
- Scoped ESLint：PASS。
- `git diff --check`：PASS，僅 Git CRLF touch warnings。
- dist / diff / active secret scan：PASS；ignored env 3 sensitive values checked，tracked files 0 hit。
- release delta / frozen equivalence：PASS；candidate 僅七個具名 DEV_DBM_002 corrective files，無 unexpected extra、無 missing frozen path，既有四個 release metadata delta 不變。
- Browser UAT impact：`tests\qa-pil-003-engineer-uat.mjs` PASS；Pilot login/logout/tamper、TXT/MD/CSV import、canvas routing、safe ZIP、secret/formula scan、cleanup=0；port `4396` 測後未 listening。
- `npm.cmd run lint`：仍因 Windows lacks `bash` blocked；本輪 scoped ESLint 已通過，release 前需由具 bash/CI 環境補 full lint。

QA conclusion:

- DEV_DBM_002 revised-final candidate resolves the CRLF migration checksum blocker.
- LF/CRLF migration checkout text checksum stable。
- mixed LF/CRLF、bare CR、UTF-8 BOM fail closed。
- final newline、whitespace/comment、SQL-token changes remain checksum-significant。
- deterministic legacy raw CRLF alias limited to existing reviewed 0001–0004 migrations。
- future migrations do not automatically receive legacy raw CRLF alias。
- runtime schema checker remains SQL-body-free and migration-loader-free。

依 D29，本結果不授權 QA 自行 stage/commit/push/merge/tag/deploy；等待使用者批准 commit point。
