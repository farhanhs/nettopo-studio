# QA_NTM_003 PLAN-R1 preparation — 2026-10-10

Preparation only for DEV_NTM_003 PLAN-R1 on `codex/dev-rel-001-checkpoint`, base `a9abe637f0ad419aced6d31faf30a127ce5b81e6`. Product implementation has not started. QA fixtures capture semantic truth only and deliberately do not invent a public API, actor adapter, limits or persistence interface. Beta QA remains isolated in its own worktree.

Prepared semantics cover PLAN-01–08: deterministic prepare/cancel, complete conflict decisions, stale/tamper/scope refusal, protected keep/exclude and trust invalidation, trusted actor separation, dependency revalidation, all-or-none pure snapshot behavior, and safe secret/raw/unknown rejection.

Formal product acceptance remains `NOT RUN` until the focused DSG addendum and PM scope check are complete, DEV publishes the real prepare/resolve/apply seam and typed contract, candidate/dependency/tool manifest is fixed, product writer stops and hashes are locked. Preparation or mocks cannot be cited as storage, authorization or product PASS.

## Preparation self-check

- `node --test tests/qa-ntm-003-preparation.test.mjs`：6/6 PASS。
- syntax：PASS。
- scoped ESLint `--max-warnings 0`：PASS。
- `git diff --check`：無content error，shared register僅既有CRLF warning。
- staged index empty；無external/temp resource，cleanup=0。

QA-only SHA-256：

- runner `87881de9086c56975d7045cfb79d9b6c7ecddd89dcd5ea01a3bba59ac125746d`
- plan vectors `e61baf9bd1b52a7075efda3529f620c1b397dd9a8f0fc9fd0ca94e73cda0dd7f`
- secret/actor fixture `90136509948c6797776fe484b8191671f90a5481f745d9b70957905a8dceca5c`

Preparation result：`PASS`；ticket維持 `READY` 等正式交接。PLAN-01–08產品結果仍全數 `NOT RUN`。未載入env、未用DB／Browser／live／安裝或Git寫入。

## DSG focused addendum alignment

QA independently verified `TRUSTED-NETWORK-TOPOLOGY-V1-SECTION4-ADDENDUM.md` raw SHA-256 `258d5d7c9ec27125648aef71e865b65a368f09adb3fd3fbee0fb00584a10c157`. A QA-only `contract-alignment.json` now fixes the three public operations, supported interface add/replace field paths, four resolution actions, deterministic error precedence, safe error fields, and the initial pure-snapshot actor boundary.

The fixture explicitly keeps actor-backed verification `NOT_RUN`: without a future opaque authorized actor adapter, `accept-and-verify` and protected-value acceptance must return `TRUSTED_ACTOR_REQUIRED`. Successful pure apply must report `persistence: not-performed`; it cannot be evidence of repository/DB atomicity. PM scope review and a fixed DEV candidate are still required before formal QA.

Aligned self-check：7/7 PASS；syntax與scoped ESLint PASS。Updated QA-only SHA-256：runner `a6470a51d5011d073da1cc9f6ea88295bd285536e2352700bfba4d622eba7b70`、contract alignment `81d582f209c17676125687aadf274949d993f76cba9ac32104591933f97f2456`；plan vectors與secret/actor fixture維持 `e61baf9bd1b52a7075efda3529f620c1b397dd9a8f0fc9fd0ca94e73cda0dd7f`／`90136509948c6797776fe484b8191671f90a5481f745d9b70957905a8dceca5c`。No product execution or result was added.

## PM scope review / R1.1 pending alignment

QA read the root PM scope review and added `r1-1-pending-vectors.json` for the six required correction families: opaque executable-plan lifecycle and private evidence closure; raw-preserving stale detection for NFC-equivalent strings; field-presence semantics; stale verified-trust protection; legacy Link port-reference revalidation after interface rename; and explicit GEN issue/exclusion plus parent-child contradiction truth.

Every new vector is marked `PENDING_DSG_R1_1`, and the preparation guard verifies that QA has not selected an unresolved parent-child behavior. These are readiness checks only, not formal assertions against the old addendum and not product PASS. Formal PLAN-01–08, actor-backed behavior, persistence, Browser and DB remain `NOT RUN` until R1.1 and the fixed DEV handoff are available.

R1.1 pending preparation self-check：8/8 PASS；syntax與scoped ESLint PASS；`git diff --check` has no content error (shared register CRLF warning only)；staged index empty；cleanup=0。QA-only SHA-256：runner `d8e29b8d13b9526607cb52d13188af5359397767c8cacb50884c74592cc678e4`、pending vectors `986352711c06a83abbe1c52cc546d3b259bd4df52385d878847a25212207873b`、contract alignment `81d582f209c17676125687aadf274949d993f76cba9ac32104591933f97f2456`、plan vectors `e61baf9bd1b52a7075efda3529f620c1b397dd9a8f0fc9fd0ca94e73cda0dd7f`、secret/actor fixture `90136509948c6797776fe484b8191671f90a5481f745d9b70957905a8dceca5c`。No product/env/DB/Browser/live/install/Git action was performed.

## R1.1 final contract alignment

QA independently verified the final addendum raw SHA-256 `e612bc77309a64b7b12326a5e11e82b2197462dc42fa1cd4403d6dc141ab5255` and parent hash `0bb2145fb2b1844d576449e55c6f3e040ce9ae14175891c21716d963334dbf63`. The earlier pending fixture is retained only in this historical record and has been replaced in the active QA preparation by `r1-1-contract-vectors.json`.

The fixed vectors now assert same-instance private handle/evidence ownership; clone, JSON and cross-instance rejection; raw NFC/NFD stale detection without rewriting; no implicit clears from empty/default/absent fields; stale verified-trust hard block; visible coupled alias handling for legacy Link ports; explicit GEN severity and private-graph recomputation; deterministic rejection of parent-excluded/child-accepted decisions; and safe pure-snapshot receipt/error boundaries.

Final-contract preparation self-check：8/8 PASS；syntax and scoped ESLint PASS；diff check has no content error (shared register CRLF warning only)；staged index empty；cleanup=0。SHA-256：runner `d218fe30cd05dadf1b80e08de2c91d5d73d42bced833b17da8a312b200414650`、contract alignment `a82f13dc44a7711f4f0dae072d01b80055beaf49c65521bc177e8e60702f9758`、R1.1 contract vectors `4a3491f64c37ae1e385cbc716b943debf34e4ae235f4e0f4d825064666fa9c72`、plan vectors `e61baf9bd1b52a7075efda3529f620c1b397dd9a8f0fc9fd0ca94e73cda0dd7f`、secret/actor fixture `90136509948c6797776fe484b8191671f90a5481f745d9b70957905a8dceca5c`。

Formal PLAN-01–08 product acceptance remains `NOT RUN`. Actor-backed verification, persistence, Browser and DB remain `NOT RUN`; the next gate is a fixed DEV candidate plus manifest and writer release.
