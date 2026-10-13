# QA_NTM_002 GEN-R1 preparation — 2026-10-09

## Scope

QA preparation only for DEV_NTM_002 GEN-R1 on `codex/dev-rel-001-checkpoint`, base `a9abe637f0ad419aced6d31faf30a127ce5b81e6`. This batch covers the pure explicit → trusted-template → manual interface-candidate engine. UI, storage, API, DB, transfer, CSV v3, live/vendor lookup, actor portability, scale and real cases are outside this phase.

Beta QA preparation remains isolated in its own branch/worktree and is not reused here.

## Prepared independent semantics

- GEN-01 deterministic IDs/order/results, input immutability and zero side effects.
- GEN-02 explicit priority; exact trusted template match only; unknown/ambiguous/untrusted template does not match.
- GEN-03 finite manual quantity/start/pattern/prefix/suffix; non-integer, negative, overflow, candidate resource limit and ambiguous patterns typed reject. The concrete resource limit and public API remain candidate facts to lock from the DEV manifest, not QA inventions.
- GEN-04 comparison-only trim/NFC/case fold, safe text preservation, conflicts without silent overwrite.
- GEN-05 every new candidate unverified; verified existing records protected from overwrite/downgrade.
- GEN-06 unknown/raw/secret-bearing structured input typed rejects without echo.
- GEN-07 idempotence, no duplicate/cross-device association and all failures leave inputs unchanged.

## Formal gate

Formal product tests remain `NOT RUN` until DEV provides the actual API, concrete finite resource limit, candidate/dependency/tool manifest, writer stop and unchanged CORE-R2 dependency hashes. QA will then add only the adapter needed to call that public seam, lock hashes, execute all independent cases and CORE-R2 regression. Preparation cannot be cited as product PASS.

## Preparation self-check history

First run: 4 PASS／1 FAIL. The coverage guard collected only `generation-vectors.json`, so GEN-06 in the separate secret-rejection fixture was not counted. This is a QA fixture aggregation defect, not a product result. QA added explicit `covers: [GEN-06, GEN-07]` to the secret fixture and merged both fixture coverage sets; no product or DEV test changed.

Re-test: 5/5 PASS; syntax and scoped ESLint PASS. `git diff --check` has no content error; only the existing CRLF warning appears for the shared register. Staged index is empty.

Final QA-only SHA-256:

- runner `9ec88971be2a3b7b87670049f52236bcaabf8156bd82f30b656ae65a762d1367`
- generation vectors `be8efff781ab758a7401ae458378aba923393cd5edd7b325ceec6a46a54361f1`
- secret-rejection fixture `afcf87133049a112e31e1fdbf80fbab4921fb90dd9cd36d7b7782145a11bd873`

Preparation result: `PASS`; formal GEN-01–07 product acceptance remains `NOT RUN`. No env, Browser, DB, live, install, external/temp resource or Git write was used; cleanup count=0. Ticket remains `READY` for the fixed candidate handoff.

## Formal runner first execution — 2026-10-09

The locked GEN-R1 candidate was received and formal QA started. First independent runner execution produced 3 PASS／4 FAIL, all traced to QA adapter defects before any product defect classification:

- template fixture included `description`, which template rows intentionally forbid;
- resource limit assertions used invented property labels instead of the published `INTERFACE_CANDIDATE_LIMITS` names;
- `parentName` was observed under `interface` instead of the documented candidate wrapper;
- QA `structuredClone` executed the accessor fixture before the product function received it.

QA corrected only its formal runner invocation/observation while retaining equivalent GEN assertions. Product, DEV tests and locked candidate hashes were not changed. The first-run history is preserved; re-test follows on the same candidate.

## Formal independent result — 2026-10-09

Re-test on the same locked candidate: QA formal GEN-01–07 7/7 PASS. The full serial batch completed 73/73 PASS, 0 FAIL, 0 SKIP:

- QA formal behavior: 7
- QA preparation guards: 5
- DEV GEN regression: 33
- CORE-R2 DEV regression: 20
- existing independent QA core regression: 8

TypeScript `--noEmit --pretty false --incremental false` PASS. Scoped ESLint for GEN product/DEV test/QA formal/preparation runners with `--max-warnings 0` PASS. DEV-owned tests are supplementary regression only and do not substitute for the seven independent QA behaviors.

### Final behavior summary

| Acceptance | Result |
|---|---|
| GEN-01 deterministic IDs/order, safe original text, immutable input | PASS |
| GEN-02 explicit priority, missing-only template fill, exact selection, fuzzy/ambiguous refusal | PASS |
| GEN-03 finite numbering syntax, quantity/index/resource bounds, no inferred count | PASS |
| GEN-04 source/alias/parent/cycle conflicts, no silent overwrite | PASS |
| GEN-05 all proposals unverified, verified existing facts unchanged | PASS |
| GEN-06 strict unknown/raw/secret rejection, fixed safe error, getter not executed | PASS |
| GEN-07 CORE-valid additions, idempotent repeat, no cross-device association | PASS |

### Post-run lock and cleanup

- manifest `b2ada6bd6e47c556cf12aee4d028d13e77e7a653287fd79048708eef80f7f698`
- GEN product `d53c2f462f59d0a87c7588c6e4240b37885be1bc5000e73a77588a5f93357701`
- DEV GEN test `137e674aa2628be47df7b1982633a8622de3a5871748005bb5f977a660d4cbbf`
- QA formal runner `e19b5667d25e90872ee1f41ff2e2ae09ebb99ef6dc3039a5096ee746172c8940`
- QA preparation runner/vectors/secret fixture remain `9ec88971...`／`be8efff7...`／`afcf8713...`
- CORE-R2 and package dependencies remain the manifest values; no pre/post drift.
- staged index empty; no owned external/temp resource; cleanup=0; product test lock released.

Final：`QA_PASSED` for GEN-R1 pure engine only. UI/store/API/DB/CSVv3/full build/full suite/real vendor templates/raw config parser/real cases and the complete NTM product remain `NOT RUN`. Next owner PM PRE-COMMIT checkpoint; no stage/commit/push authorization.
