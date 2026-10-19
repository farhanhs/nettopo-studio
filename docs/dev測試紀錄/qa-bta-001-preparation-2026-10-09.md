# QA_BTA_001 preparation — 2026-10-09

## Scope

Preparation only for the approved local feedback Beta on `codex/public-beta-0.1`, base `a9abe637f0ad419aced6d31faf30a127ce5b81e6`. Formal product, package, Browser, offline, persistence, import/export and release acceptance remain `NOT RUN` until DSG contract and DEV_BTA_001–003 provide one fixed `READY_FOR_QA` package with source/artifact/dependency hashes and stop product writes.

## QA-owned assets

- `tests/qa-bta-001-preparation.test.mjs`
- `tests/fixtures/qa-bta-001/acceptance-matrix.json`
- `tests/fixtures/qa-bta-001/synthetic-topology.json`
- `tests/fixtures/qa-bta-001/sentinel-catalog.json`
- `tests/fixtures/qa-bta-001/environment-matrix.json`

The matrix keeps BTA-A01–12 as `NOT_RUN`. Fixtures are synthetic and anonymous. No current env, DSN, secret, DB, HR/OTP or company API is read. No Docker, global Node, Browser or plugin is installed. No product or DEV test is changed.

## Formal gates

Formal QA requires the approved DSG contract, DEV_BTA_001–003 all `READY_FOR_QA`, exact product/source/artifact/runtime dependency manifest, fixed ZIP hash, product writer stop and an owned isolated test location. Browser interaction, clean ZIP extraction, first setup, offline-loopback, Chrome/Edge, IndexedDB, JSON/CSV, backup/upgrade, sentinel sinks, process ownership, MIT/notices and public-source review must be recorded separately; preparation/source scan/build cannot substitute.

Current result: QA tool and fixtures are prepared; product BTA-A01–12 are all `NOT RUN`. Next owner for product readiness remains DSG then the single DEV owner. QA stops at preparation after its tool self-check and hashes.

## Preparation self-check history

First run: 3 PASS／1 FAIL. The QA-owned DSN sentinel used `qa-sentinel` while the runner required the common `QA_BETA`／`qa_beta` marker. This was a fixture naming defect, not a product result. The synthetic value was renamed only; no assertion or product file changed. Re-test result and final hashes are appended after execution. Scoped ESLint is `NOT RUN` because this clean Beta worktree has no installed workspace dependencies; QA did not install or borrow dependencies from another worktree.

Re-test: 4/4 PASS; `node --check` PASS. `git diff --check` reported no content error; only the worktree fsmonitor IPC warning appeared during Git queries. Staged index remains empty.

Final QA-only SHA-256:

- runner `43885bd6859554980139ccb74898e09e6ad3f6f0e3047d454250e749946231b0`
- acceptance matrix `7cf5a5f3bc30b0f2c07f99affad3a5fb700ac6dcc7a53afe9e2ecc9bce0af76c`
- synthetic topology `fcfaa6ec693b77f2bf303966c3d017f5a7090be18351242bbe54c845285c2b3c`
- sentinel catalog `1d36e0a6a46c06c86f4dd23811ca40ce929ecd39934474b61f87a2f66c582f25`
- environment matrix `fbd53aeb6764d0d12a99e2c92ace197145a369fe30e18c02c8c70a9f55a5171a`

Preparation final: `PASS`; ticket returns to `READY` for formal handoff. BTA-A01–12 product results remain `NOT RUN`. No external/temp resource was created, so cleanup count is zero. No stage／commit／push/tag/Release/merge/deploy occurred.

## PM scope-review alignment

After PM reviewed DSG_BTA_001, QA remained preparation-only and did not inspect or run the changing product. The QA matrix now explicitly preserves:

- existing per-topology full JSON and five-file CSV contracts only; no `LocalBackupV1` or whole-workspace replacement;
- BTA-A10 compatibility, incompatible/corrupt rejection, original-data preservation and restore, without claiming a download trigger proves a disk write;
- originless same-origin capability GET, framework RSC/navigation/static, owned status and token-bound shutdown, plus cross-site/protected API denial;
- acyclic package manifest/checksum rules and exact allowlisted hashes for dirty PRE-COMMIT source instead of falsely calling it a committed tree.

These are prepared observations only. Formal product and Browser results remain `NOT RUN` pending the revised DSG contract and one fixed DEV_BTA_001–003 package.

Aligned preparation self-check: 4/4 PASS; syntax PASS. Updated QA-only hashes:

- runner `5ed79054a0f541cb7d1ec3d427cf9c49875df143312a4c01bdd9e11b0e61a887`
- acceptance matrix `107241ec3021bfee2f295efbc6e83831fcdd62b77a7ac167bb0167153bb6245d`
- environment matrix `0c8d5ecbaba4e65f4b60e92b2acaadd499650c08ffce8aa429acce51e600930b`
- synthetic topology unchanged `fcfaa6ec693b77f2bf303966c3d017f5a7090be18351242bbe54c845285c2b3c`
- sentinel catalog unchanged `1d36e0a6a46c06c86f4dd23811ca40ce929ecd39934474b61f87a2f66c582f25`

Earlier hashes remain historical preparation evidence and are not reused as the formal candidate lock.

## 2026-10-19 latest-main resume

唯一 Beta worktree 已由DEV安全fast-forward至核准main `b5c53916cbda6f8bcd2f42f9d9772ef181c1adee`；原 preparation base `a9abe637f0ad419aced6d31faf30a127ce5b81e6`只保留歷史。QA 在DEV產品writer仍active期間只做準備重核，沒有檢視或執行可變產品。

- `node --check tests/qa-bta-001-preparation.test.mjs`：PASS。
- `node --test tests/qa-bta-001-preparation.test.mjs`：4/4 PASS。
- runner／acceptance matrix／topology／sentinel／environment五個hash與10/09 PM scope-review alignment完全相同。
- BTA-A01–12：全部`NOT_RUN`。
- build／server／ZIP／Browser／env／DB／Docker／全域安裝：未啟動。

QA仍等待DEV_BTA_001→002→003完成並交付一個固定source/tools/deps/ZIP manifest與writer stop。正式交付前不得把準備PASS、main舊PASS或DEV自測代稱Beta產品驗收。
