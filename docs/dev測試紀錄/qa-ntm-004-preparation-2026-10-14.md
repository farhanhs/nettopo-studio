# QA_NTM_004 — Projection / Navigation preparation

## Status and candidate boundary

- Result: `PREPARED / FORMAL NOT RUN`.
- Worktree: `C:/Users/DUS/Desktop/project/nettopo-studio/.local/worktrees/dev-rel-001-checkpoint`.
- Branch / base: `codex/dev-rel-001-checkpoint` / `590339395ec8cf5af5591d3be4379bd3ab4ebc6b`.
- The tree already contained unrelated register/governance/QA_REL/browser-flow changes and untracked evidence before this preparation. They were preserved and are not part of the QA_NTM_004 candidate.
- No product candidate is locked. DEV is still preflight and DSG §5 is pending. No product server, DB, Docker, current environment, Browser profile or external resource was started.

## Prepared QA assets

- `tests/fixtures/qa-ntm-004/projection-vectors.json`: independent expected truths for PROJ-01–08.
- `tests/fixtures/qa-ntm-004/browser-matrix.json`: loopback/profile/storage/no-current-env/cleanup contract and responsive/input matrix.
- `tests/qa-ntm-004-preparation.test.mjs`: fixture and boundary guard only; it intentionally does not import or call a projection implementation.

The oracle covers deterministic dual projection without a second durable graph; stable ID back-links and legacy unknown endpoints; verified-only relation/endpoints/identity closure; explicit navigation fallback; authorization-before-projection and hidden-data exclusion; non-color trust cues, keyboard/touch and 360/768/1024/1280 plus short-height Browser checks; synthetic performance observation without inventing a threshold; and separate module/Browser/persistence/DB evidence with full manifest and cleanup.

## Browser isolation plan

Formal Browser execution waits for DEV `READY_FOR_QA`, writer stop and a locked dependency manifest. It will use an owned server bound only to `127.0.0.1`, a random owned non-5432 port, a temporary QA_NTM_004-only browser profile with fresh storage, and an explicit no-current-env allowlist. DB and Docker are not prerequisites for the read-only projection slice and will not be started. Final cleanup must independently prove server PID stopped, port closed, browser profile/downloads/temp fixtures removed. Browser observations will include network, DOM, console and storage secret/hidden-data scans; source or rendered-HTML scans cannot replace interaction.

## Contract points DSG §5 must fix before formal assertions

1. Name the public projection input/output Interface and its result/error discriminants; QA must not infer an API from implementation.
2. Define the exact physical and logical membership/edge mapping for each current CORE-R2 entity, including order/canonicalization and duplicate handling.
3. Define verified-only closure precisely: required trust paths for relation, both endpoints and identity; stale trust and filtered/missing dependencies; safe reason codes and whether an ancestor remains visible.
4. Define legacy behavior for missing `fromInterfaceId`/`toInterfaceId`, stable provisional IDs versus explicit `unknown`, and prohibit treating canvas anchors or port labels as verified interfaces.
5. Define selection fallback priority and observable result for missing, hidden and verified-filtered IDs; breadcrumb behavior and collapse/list fallback must not mutate topology relations.
6. Define authorization input ownership and the requirement that inaccessible sites/entities are excluded before projection, not merely hidden by CSS; client area selection grants no access.
7. Define the safe source/trust display allowlist and forbidden values. Raw config, credentials, tokens, DSNs and unsafe error text may not enter summaries, DOM, console, network payloads or durable storage.
8. Define read-only UI integration and persistence behavior. Current V1 Zustand/Dexie/API writers cannot receive a V2 snapshot; formal Browser acceptance needs an explicit load-only adapter and a statement that no projection/navigation action writes or downcasts V2.
9. Define keyboard focus order, touch target expectation, short-height/list fallback and the non-color cue used for unverified/filtered content.
10. Define the performance dataset generator and measurements to record. No new 250 ms or real-world scale promise is assumed without an approved threshold.

## Next gate

Preparation can be rerun independently, but its PASS only validates QA assets. Formal PROJ-01–08 remain `NOT RUN` until DSG §5 is fixed, DEV supplies exact allowed paths/import closure/raw hashes, `READY_FOR_QA` and writer stop are confirmed, and QA locks the candidate. Existing CORE/GEN/PLAN results and unrelated UI evidence are inputs to regression selection, not substitutes for this ticket.

## SECTION5-R1.1 pending compatibility oracles

PM accepted the preparation-only 6/6 as tool self-check, not product acceptance. SECTION5-R1 is not used as a final product oracle because DSG is preparing R1.1 clarifications. QA added `tests/fixtures/qa-ntm-004/r1-1-pending-oracles.json` as a requirements-only sidecar; it contains no assumed product output and was not used to start or rerun formal acceptance.

The compatibility gate must preserve two distinct implemented facts: CORE legacy `fingerprintValue` derives from `stableHash(JSON.stringify(rawValue))`, while PLAN fingerprints use asynchronous SHA-256 over a canonical raw value. They are not interchangeable algorithms. R1.1 therefore must state how projection recognizes CORE legacy unverified trust and PLAN-produced fieldTrust without silently recomputing one as the other; how optional/record canonical values become stale; and how record verification differs from field verification. A verified field may not upgrade its whole record, and a verified record or sibling field may not automatically upgrade another field.

The pending sidecar also asks R1.1 to close typed result/error and deterministic sort-rank rules, physical blank-port versus logical mapping, and unknown/hidden/filtered selection fallback without echoing an inaccessible requested ID. Until those points and DEV candidate scope are fixed, all affected PROJ cases remain `NOT RUN`.

## SECTION5-R1.1 fixed runner preparation

PM fixed and locally approved `SECTION5-R1.1` at SHA-256 `d87640d787533de697b405f433843c132da38294bcea69d656778c0fc4b6bb34`. The requirements-only sidecar remains as history. QA added `section5-r1-1-contract-vectors.json` and `qa-ntm-004-contract-preparation.test.mjs` to turn those requirements into a fixed runner oracle without importing a product implementation.

The digest oracle stores exact canonical UTF-8 bytes and independent SHA-256 results for a scalar raw string plus an interface `$record` before and after removing an optional field. The formal runner must compare the extracted shared digest byte-for-byte and prove identical PLAN inputs retain PLAN IDs, revisions and field fingerprints. CORE legacy unverified fingerprints must remain byte-for-byte unchanged and short-circuit digest inspection; dual-algorithm guessing is forbidden.

The fixed vectors also require complete-record `$record` staleness for any optional-field addition/removal/change, no field-to-record or record-to-field automatic trust promotion, exact blank-port/legacy VLAN behavior, and unknown selection returning only `SELECTION_NOT_VISIBLE` without copying or echoing the untrusted ID. These are now contract-backed runner gates, but product/module/Browser results remain `NOT RUN` until DEV supplies a fixed candidate, dependency manifest and writer stop.

## PROJ-R1 scope-review additions

PM approved the exact DEV product scope but DEV remains the active writer. QA therefore extended only its runner preparation. A fixed ordering vector now permutes two raw IDs that are NFC-equivalent (`if-café` and `if-café`) and requires both input orders to resolve by the original raw Unicode code-point tie-break, with no ID normalization or rewrite.

The Browser plan no longer treats clearing the child process environment as sufficient. Vite/vinext/Next can discover dotenv files from their project root, and the legacy wrapper explicitly loads `.env.local`/`.env`; it is forbidden for this ticket. Formal Browser execution must use a QA-owned sanitized project mirror with every `.env` variant absent, explicit runtime-policy values, no env-file flags/current-worktree `loadEnv`, and a read-only explicit dependency path. The mirror becomes an owned resource and must be removed together with the PID, port, profile, downloads and fixtures. Failure to prove this isolation blocks Browser/build only, not independent module cases.

PM's implementation-fact correction is recorded without weakening the gate: the V1 validator strictly rejects unknown top-level fields; a specific cleaner may reconstruct only devices/links/groups and thereby drop top-level V2 data, while nested unknowns may still reject. Neither behavior authorizes V2 to enter an existing writer or counts as safe persistence. True V2 Browser/persistence remains outside PROJ-R1.

## Explicit test selection and side-effect classification

DEV preflight exposed that a broad test glob can include the untracked `qa-pil-006-postgres-lifecycle.test.mjs`, which imports the PostgreSQL client and starts an `initdb` fixture even when normal application env is absent. PM observed cleanup completed (processes 0 and run subdirectories 0), but this is retained as a selection deviation, not a QA_NTM_004 product failure or new database authorization.

QA added `test-selection-r1.json` as a positive allowlist. It separates module tests from the one owned Browser entry and marks real-DB/integration tests, unknown tests and all broad globs as blocked/prohibited. `qa-ntm-004-selection-preparation.test.mjs` performs a static relative-import closure walk without evaluating the selected test or product modules. It rejects child-process, Playwright and PostgreSQL imports plus unapproved `process.env` reads in the module subset. The existing QA_NTM_001 preparation flag is the sole declared env-read exception and still requires the explicit sanitized environment at formal invocation.

No result from the explicit safe module subset may be called a “full suite PASS.” Database-dependent cases remain `BLOCKED_NO_AUTHORIZATION`; Browser remains a separate owned-resource gate; unknown tests remain blocked until classified. Formal selection and hashes must be taken from the final DEV manifest after writer stop.

Selection-preparation history is retained: the first static scan was 4/5 because the QA resolver did not handle extensionless TypeScript imports (`topology-types`). It did not evaluate a test or start a process. QA added deterministic local resolution for the existing file plus `.ts`/`.tsx`/`.mjs`/`.js`/index forms; unresolved local imports now fail closed. The corrected selection-preparation run passed 5/5. Runner SHA-256 is `e05ef9124473f8d43852ecbecc2fa672996047c3925afa80b6e6be5ca5e0446a`; selection SHA-256 is `b09aaca8fac19abf9358fa8ec82893d9655270ea9ad4f5b751498c0ae59ed8b1`.
