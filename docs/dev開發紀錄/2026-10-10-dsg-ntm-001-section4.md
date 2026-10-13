# DSG_NTM_001 §4 Focused Addendum — 2026-10-10

## Candidate and authority

- Worktree/branch/base: `.local/worktrees/dev-rel-001-checkpoint` / `codex/dev-rel-001-checkpoint` / `a9abe637f0ad419aced6d31faf30a127ce5b81e6`.
- Authority: user “下一票繼續推進”, root `2026-10-10-pm-ntm-plan-start.md`, DEV_NTM_003 / QA_NTM_003.
- Parent contract raw SHA-256 remains `0bb2145fb2b1844d576449e55c6f3e040ce9ae14175891c21716d963334dbf63`; it was not edited.
- Scope: design documents only. Product, tests, package, DB, env and Git operations were not modified or run.

## Design result

Created [TRUSTED-NETWORK-TOPOLOGY-V1-SECTION4-ADDENDUM.md](../engineerticket/contracts/TRUSTED-NETWORK-TOPOLOGY-V1-SECTION4-ADDENDUM.md).

The design uses one deep module with `prepareTrustedChangePlan`, `resolveTrustedChangePlan` and `applyTrustedChangePlan`. GEN-R1 candidates become deterministic record-add or mutable-field replace proposals; unsafe parent/collision/template states become typed issues instead of implicit writes. The module owns fingerprints, decision completeness, dependency closure, stale/tamper detection, trust invalidation and full validation.

The first phase is pure snapshot only. It does not persist. With no trusted identity adapter, `accept-and-verify` and protected-value acceptance fail closed. This prevents tests or product code from inventing a Boss/session while still allowing unprotected unverified proposal behavior to be implemented and independently tested.

## Verification and handoff state

- Contract consistency/manual trace against parent §4, GEN-R1 types and PLAN-01–08: completed.
- Product tests/build/Browser/DB/live: NOT RUN.
- Existing CORE-R2/GEN-R1 QA evidence: referenced as dependency only, not rerun or reclassified.
- Status: focused addendum `READY FOR PM SCOPE REVIEW`; DEV product writing remains blocked until that review.
- Proposed next owner after PM approval: existing primary DEV on DEV_NTM_003; QA_NTM_003 prepares independently and formally runs only on the fixed candidate.

No UI/store/DB/CSVv3/privacy/scale decision was made. No second Project model, identity seam or persistence adapter was introduced.

## R1.1 PM scope correction

PM conditionally approved the snapshot direction and required five consistency corrections. The same addendum now:

1. separates serializable preview DTO from same-instance opaque handle and private validated Project/GEN/evidence registry; clone/JSON/cross-instance handles cannot execute;
2. uses CORE raw-string canonical revision semantics, so NFC/NFD-equivalent byte changes remain stale-detectable;
3. treats GEN `aliases: []` and absent optional fields as preserve/not-clear unless explicit intent exists;
4. hard-blocks stale verified fingerprints and revalidates legacy link port strings for rename/alias changes without editing Links;
5. fixes the GEN severity/disposition table and requires explicit, non-contradictory parent/dependent decisions before recomputation.

Focused status is now `PM CONDITIONALLY APPROVED — R1.1 implementation gate`. DEV must record the final addendum hash and five-point conformance before writing the two allowed product paths; no further routine PM wait is required when they match. Product verification remains NOT RUN in this design record.
