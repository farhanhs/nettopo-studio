# QA_REL_001 — Release Checkpoint 獨立驗收

| 欄位 | 結果 |
|---|---|
| Ticket | `QA_REL_001` |
| Date | 2026-09-04 |
| Checkpoint worktree | `.local/worktrees/dev-rel-001-checkpoint` |
| Branch | `codex/dev-rel-001-checkpoint` |
| Expected HEAD | `87a04d57d8d848b42924f01924286bf4bce46ff9` |
| Base | `cbce10bba027d246ef78e92a1e2f01660da55e1f` |
| Recovery artifact | `.local/recovery/dev-rel-001/r1-20260901-170537` |
| Final result | `QA_FAILED` |

## Scope

依 PM 交接執行 `DEV_REL_001` checkpoint release gate。QA 未修改產品碼、migration、DB role/grant、credential 或 checkpoint commit；僅建立 QA-only restore scratch 與更新本測試紀錄／票面。

## Passed evidence before stop condition

| Gate | Result | Evidence |
|---|---:|---|
| Checkpoint worktree branch / HEAD | PASS | branch=`codex/dev-rel-001-checkpoint`; HEAD=`87a04d57d8d848b42924f01924286bf4bce46ff9` |
| Checkpoint pre-QA cleanliness | PASS | `git status --short` no output |
| Original workspace staged index | PASS | no staged files before QA |
| Recovery artifact member hash recompute | PASS | `SHA256SUMS.txt`: 10/10 matched |
| R1 raw patch boundary | PASS | canonical artifact set does not contain raw full-index patch |
| PATH-MAP | PASS | 206 rows; 204 include; 2 exclude; 0 unmapped; include/exclude validation 0 bad rows |
| HUNK-MAP | PASS | 16 shared-file entries; required hunk map count 0 missing |
| Commit chain | PASS | 17 commits after base; every commit subject contains Ticket ID; no unmapped changed file |
| Isolated restore proof | PASS | QA scratch restore from base + delete manifest + current-files overlay compared 204 frozen paths; 0 mismatch |
| Frozen diff path equivalence | PASS with allowed metadata delta | checkpoint diff paths 204/204 matched frozen snapshot; 4 content differences limited to release metadata files: `docs/engineerticket/TICKET-REGISTER.md`, `docs/engineerticket/DECISION-LOG.md`, `docs/engineerticket/active/DEV_REL_001.md`, `docs/engineerticket/contracts/RELEASE-CHECKPOINT-CONTRACT.md` |
| Active secret value scan | PASS | 3 sensitive values read from ignored checkpoint `.env.local`; 0 hits in tracked files; 0 tracked generated/local artifact paths |
| DB availability precheck | PASS after environment start | Original workspace existing local PostgreSQL runtime started; checkpoint `npm.cmd run db:verify` returned ready/currentVersion `0004` |

## Stop condition failure

`node --env-file-if-exists=.env.local --env-file-if-exists=.env --test tests\*.test.mjs`

Result: `FAIL` — 200 tests total, 198 pass, 2 fail.

First failure:

- `tests/migration-boundary.test.mjs`
- Test: `generated schema version metadata is synchronized with SQL migrations and contains no SQL body`
- Expected: `expectedPostgresMigrations` equals checksums computed from `db/migrations/*.sql`
- Actual: all four migration checksums differ on Windows checkout.

Second failure:

- `tests/qa-dbm-001-real-postgres.test.mjs`
- Failure line: `db:migrate` idempotency assertion
- Actual: `npm.cmd run db:migrate` exits `1`
- Safe output class: migration runner rejects `0001_formal_topology_schema.sql` as changed after it was applied.

Confirmed root cause:

- `db/postgres-schema-version.ts` stores LF-normalized migration checksums.
- `db/migrations/*.sql` are checked out as CRLF in this Windows checkpoint worktree.
- `scripts/lib/load-postgres-migrations.mjs` reads the SQL text and `definePostgresMigrations()` hashes the raw string without line-ending normalization.
- Therefore the same committed SQL content produces different migration checksums depending on checkout line endings.
- This breaks both metadata synchronization and `db:migrate` idempotency in the target Windows local environment.

QA verification details:

| Migration | Metadata checksum matches LF-normalized SQL | Metadata checksum matches current CRLF file |
|---|---:|---:|
| `0001_formal_topology_schema.sql` | yes | no |
| `0002_dictionary_constraints.sql` | yes | no |
| `0003_project_device_credentials.sql` | yes | no |
| `0004_topology_quantity_and_collapse.sql` | yes | no |

## Not run after stop condition

Per `QA_REL_001` stop condition, after confirming a final suite / DB migration failure QA stopped the release gate and did not continue to claim:

- final Browser Pilot gate,
- Import Browser round-trip gate,
- final `build:local`,
- scoped/full lint completion.

Earlier checkpoint evidence for those areas remains useful historical evidence, but this QA run cannot mark them passed after a hard release blocker.

## Required DEV correction

Recommended minimal fix:

1. Make PostgreSQL migration checksum canonical across platforms:
   - either normalize migration SQL line endings to LF before checksum and execution metadata comparison, or
   - add repository-level `.gitattributes` enforcing `db/migrations/*.sql text eol=lf` and regenerate/verify metadata in a clean checkout.
2. Preserve the immutability rule for published migrations:
   - do not edit SQL semantics to match checksum;
   - update only checksum generation/loading policy if normalization is chosen.
3. Add regression coverage:
   - a test fixture where SQL source contains CRLF but expected checksum equals LF canonical hash;
   - `db:migrate` idempotency test under CRLF checkout/input.
4. Re-run QA_REL_001 from the same checkpoint acceptance matrix after DEV_REL_001 is corrected and returned to `READY_FOR_QA`.

## D29 pre-commit re-test matrix prepared

PM 後續補充 `PM_GOV_001-D29`：任何新 commit 前都必須等待使用者批准；本輪只保留 `QA_FAILED`、準備同票 pre-commit 重驗矩陣，不改產品，不碰 Register，不 push。

QA-only script prepared:

- `tests/qa-rel-001-checksum-portability.mjs`

Retest intent after DSG/DEV correction returns `READY_FOR_QA`:

| Gate | Expected candidate result |
|---|---|
| Current worktree SQL vs generated schema metadata | PASS |
| Forced CRLF SQL fixture vs generated schema metadata | PASS |
| LF SQL fixture vs generated schema metadata | PASS |
| Real SQL content mutation | checksum changes; mismatch remains rejected |
| `db:migrate` against existing ready DB | idempotent PASS |
| `db:verify` after migrate | ready/currentVersion `0004` |
| Full serial Node suite | one single run PASS; do not combine partial runs |
| Checkpoint frozen-tree equivalence | old snapshot plus explicitly named corrective delta only |
| Secret / artifact boundary | no active secret, DSN, cookie, token, plaintext credential, ciphertext, nonce |

The script is intentionally not named `*.test.mjs`, so it will not alter the current failing full-suite evidence before DEV returns a candidate. Run explicitly during re-test:

```powershell
node --env-file-if-exists=.env.local --env-file-if-exists=.env tests\qa-rel-001-checksum-portability.mjs
$env:QA_REL_001_RUN_DB='1'; node --env-file-if-exists=.env.local --env-file-if-exists=.env tests\qa-rel-001-checksum-portability.mjs
```

## Final decision

`QA_REL_001 = QA_FAILED`.

Checkpoint branch must not be pushed, merged, or deployed until DEV resolves the migration checksum line-ending blocker and QA_REL_001 re-test passes.

## Same-ticket pre-commit re-test — DEV_DBM_002 candidate

| 欄位 | 結果 |
|---|---|
| Date | 2026-09-04 |
| Candidate location | `.local/worktrees/dev-rel-001-checkpoint` |
| Candidate status | unstaged / uncommitted |
| Candidate files | `db/postgres-migrations.js`; `db/postgres-schema-check.ts`; `db/postgres-schema-version.ts`; `scripts/generate-postgres-schema-version.mjs`; `tests/migration-boundary.test.mjs`; `tests/postgres-migrations.test.mjs`; `tests/postgres-schema-check.test.mjs` |
| Re-test result | `CANDIDATE_PASS_PENDING_USER_COMMIT_APPROVAL` |

依 D29，本段只驗證未提交候選；不 stage、commit、push、merge、deploy。`QA_REL_001` 的 2026-09-04 `QA_FAILED` 歷史保留。

### Commands and results

| Gate | Command | Result |
|---|---|---|
| Candidate scope | `git status --short` in checkpoint worktree | PASS：只剩 DEV_DBM_002 七個 unstaged files |
| Targeted checksum / schema tests | `node --test tests\postgres-migrations.test.mjs tests\migration-boundary.test.mjs tests\postgres-schema-check.test.mjs tests\postgres-schema-status-fixtures.test.mjs` | PASS：33/33 |
| Real DB verify / migrate idempotency | `npm.cmd run db:verify`; `npm.cmd run db:migrate`; `npm.cmd run db:migrate`; `npm.cmd run db:verify` | PASS：schema ready/currentVersion `0004`; migrate 連跑兩次 `Applied: none. Skipped: 4` |
| Full serial Node suite | `node --env-file-if-exists=C:\Users\DUS\Desktop\project\nettopo-studio\.env.local --env-file-if-exists=C:\Users\DUS\Desktop\project\nettopo-studio\.env --test tests\*.test.mjs` | PASS：209/209 in one run |
| TypeScript | `node node_modules\typescript\bin\tsc --noEmit --pretty false` | PASS |
| Build | `npm.cmd run build:local` | PASS；only existing chunk size / route classification warnings |
| Scoped ESLint | `node_modules\.bin\eslint.cmd ...DEV_DBM_002 files...` | PASS |
| `git diff --check` | `git diff --check` | PASS；only Git CRLF touch warnings |
| dist / diff / active secret scan | QA value-based script | PASS：dist forbidden pattern 0；diff secret syntax 0；3 ignored env sensitive values checked / 0 tracked hits；tracked generated 0 |
| Release delta / frozen equivalence | QA delta script against frozen snapshot | PASS：candidate only seven named DEV_DBM_002 files; no unexpected extra; no missing frozen path; existing four release metadata deltas unchanged |
| Browser UAT impact | `node --env-file-if-exists=... tests\qa-pil-003-engineer-uat.mjs` | PASS：`QA_PASSED`, Pilot login/logout/tamper, TXT/MD/CSV import, canvas routing, safe ZIP, secret/formula scan, cleanup=0 |
| Preview cleanup | port check | PASS：`127.0.0.1:4396` not listening after Browser UAT |
| Full lint script | `npm.cmd run lint` | BLOCKED：Windows lacks `bash`; existing tooling blocker. Scoped ESLint passed. |

### Candidate validation conclusion

DEV_DBM_002 candidate resolves the QA_REL_001 CRLF checksum blocker:

- LF and CRLF migration checkout text now produce stable canonical checksums.
- mixed LF/CRLF, bare CR and UTF-8 BOM are fail-closed.
- final newline, whitespace/comment and SQL-token content changes remain checksum-significant.
- existing ready DB accepts deterministic legacy raw CRLF alias and `db:migrate` remains idempotent.
- runtime schema checker remains SQL-body-free and uses generated metadata only.

Decision: `CANDIDATE_PASS_PENDING_USER_COMMIT_APPROVAL`.

Per D29, this is not authorization to commit, push, merge or deploy. The checkpoint branch remains unpushed until the user approves the commit point.

## HOLD after pre-commit evidence — 2026-09-04

After the above pre-commit evidence was collected and reported, DEV sent a HOLD notice for the previous DEV_DBM_002 READY_FOR_QA handoff:

- QA_REL_001 pre-commit re-test is paused.
- DEV_DBM_002 candidate evidence above is retained only as pre-HOLD informational evidence.
- Formal QA_REL_001 re-test must wait for the revised MIGRATION-CHECKSUM-PORTABILITY contract and revised DEV handoff.
- No `QA_PASSED` decision is made.
- D29 remains active: no git add/commit/amend/rebase/cherry-pick/merge/push/tag/deploy.

Current effective QA state: `QA_FAILED` from the original 2026-09-04 release checkpoint run, with pre-HOLD candidate evidence recorded but not release-authorizing.

## Same-ticket pre-commit re-test — DEV_DBM_002 revised-final candidate

| 欄位 | 結果 |
|---|---|
| Date | 2026-09-04 |
| Candidate location | `.local/worktrees/dev-rel-001-checkpoint` |
| Candidate base HEAD | `87a04d57d8d848b42924f01924286bf4bce46ff9` |
| Candidate status | unstaged / uncommitted |
| Re-test result | `REVISED_FINAL_CANDIDATE_PASS_PENDING_USER_COMMIT_APPROVAL` |

Revised-final candidate file hashes:

| SHA-256 | Path |
|---|---|
| `f10858e772ef53c60802d9d77a7d74fb6dad50ccba195213fa8a617838e25369` | `db/postgres-migrations.js` |
| `22a894df703dcd7c7266aa7ebbc298f0995a88fa44f4cd847ef19860a4603dd9` | `db/postgres-schema-check.ts` |
| `6c142aba7a962e425c39122c2b1faf7c9ebef6cd7e1836db12a9c59a7a633481` | `db/postgres-schema-version.ts` |
| `b7e02e013833e68d9f3d03ea417a9fab1b0fb0782b3b96ffac4e1502295e794c` | `scripts/generate-postgres-schema-version.mjs` |
| `5cb8dac16a568e27f389e2a7049dcb9ae8e5ba414afa7c937e4adee6d0a12e17` | `tests/migration-boundary.test.mjs` |
| `fd969776e7892227c3d9100775b6a2ccfb0d0b068f3136f47d2bc5e1c8760c31` | `tests/postgres-migrations.test.mjs` |
| `220d6aea5a5f0e75072cbb479a03a94bd6c4261b69bce3567c0df7da55484868` | `tests/postgres-schema-check.test.mjs` |

### Revised-final commands and results

| Gate | Command | Result |
|---|---|---|
| Candidate scope / HEAD | `git status --short`; `git rev-parse HEAD` | PASS：HEAD unchanged; unstaged files only the 7 revised-final DEV_DBM_002 files |
| Targeted checksum / schema tests | `node --test tests\postgres-migrations.test.mjs tests\migration-boundary.test.mjs tests\postgres-schema-check.test.mjs tests\postgres-schema-status-fixtures.test.mjs` | PASS：35/35 |
| Real DB verify / migrate idempotency | `npm.cmd run db:verify`; `npm.cmd run db:migrate`; `npm.cmd run db:migrate`; `npm.cmd run db:verify` | PASS：schema ready/currentVersion `0004`; migrate twice `Applied: none. Skipped: 4` |
| Full serial Node suite | `node --env-file-if-exists=C:\Users\DUS\Desktop\project\nettopo-studio\.env.local --env-file-if-exists=C:\Users\DUS\Desktop\project\nettopo-studio\.env --test --test-concurrency=1 tests\*.test.mjs` | PASS：209/209 in one explicitly serial run |
| TypeScript | `node node_modules\typescript\bin\tsc --noEmit --pretty false` | PASS |
| Build | `npm.cmd run build:local` | PASS；only existing chunk size / route classification warnings |
| Scoped ESLint | `node_modules\.bin\eslint.cmd db\postgres-migrations.js db\postgres-schema-check.ts db\postgres-schema-version.ts scripts\generate-postgres-schema-version.mjs tests\migration-boundary.test.mjs tests\postgres-migrations.test.mjs tests\postgres-schema-check.test.mjs` | PASS |
| `git diff --check` | `git diff --check` | PASS；only Git CRLF touch warnings |
| dist / diff / active secret scan | QA value-based scan | PASS：dist forbidden pattern 0；diff secret syntax 0；3 ignored env sensitive values checked / 0 tracked hits；tracked generated 0 |
| Release delta / frozen equivalence | QA delta script against frozen snapshot | PASS：candidate only the 7 named DEV_DBM_002 files; no unexpected extra; no missing frozen path; existing four release metadata deltas unchanged |
| Browser UAT impact | `node --env-file-if-exists=... tests\qa-pil-003-engineer-uat.mjs` | PASS：`QA_PASSED`; Pilot login/logout/tamper, TXT/MD/CSV import, canvas routing, safe ZIP, secret/formula scan, cleanup=0 |
| Preview cleanup | port check | PASS：`127.0.0.1:4396` not listening after Browser UAT |
| Full lint script | `npm.cmd run lint` | BLOCKED：Windows lacks `bash`; existing tooling blocker. Scoped ESLint passed. |

### Revised-final conclusion

DEV_DBM_002 revised-final candidate satisfies the QA_REL_001 pre-commit re-test matrix:

- LF and CRLF migration checkout text are checksum-stable.
- mixed LF/CRLF, bare CR and UTF-8 BOM fail closed.
- final newline, whitespace/comment and SQL-token changes remain checksum-significant.
- deterministic legacy raw CRLF alias is accepted only for the existing reviewed 0001–0004 migrations.
- future migrations do not automatically receive legacy raw CRLF aliases.
- runtime schema checker remains SQL-body-free and migration-loader-free.
- existing ready PostgreSQL database migration remains idempotent.

Decision: `REVISED_FINAL_CANDIDATE_PASS_PENDING_USER_COMMIT_APPROVAL`.

Per D29, this is still not authorization to stage, commit, push, merge, tag or deploy. Stop here and wait for user approval of the commit point.
