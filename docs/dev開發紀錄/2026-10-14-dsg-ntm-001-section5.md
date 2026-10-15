# 2026-10-14 DSG_NTM_001 §5 focused addendum

## Candidate and authority

- Ticket: `DSG_NTM_001@codex/dev-rel-001-checkpoint`
- Worktree: `C:/Users/DUS/Desktop/project/nettopo-studio/.local/worktrees/dev-rel-001-checkpoint`
- Observed HEAD/base: `590339395ec8cf5af5591d3be4379bd3ab4ebc6b`
- Authority: user “請按照現在的工作流程繼續開發”; root `2026-10-14-pm-ntm-projection-start.md`
- Scope: design-only SECTION5-R1.1 for DEV_NTM_004/QA_NTM_004
- Stop: PM local scope review; no product write, test execution, stage, commit, push, integration, deploy or live

The worktree was already dirty before this design pass. Existing register/governance/QA_REL/browser evidence and untracked tickets/tests were preserved and are not part of this design candidate.

## Evidence reviewed

- root AGENTS, R3, HARNESS-AUTHORIZATION, BRANCH-MAP and PM NTM004 start record;
- `DSG_NTM_001`, `DEV_NTM_004`, `QA_NTM_004`;
- parent `TRUSTED-NETWORK-TOPOLOGY-V1.md` §5/§6;
- committed `trusted-network-types.ts`, `trusted-network-model.ts`, interface candidates and change planner;
- current `topology-types.ts`, `topology-validation.ts`, `topology-store.ts`, `page.tsx`, PostgreSQL repository/schema and existing NTM tests.

## Result

Created and revised [TRUSTED-NETWORK-TOPOLOGY-V1-SECTION5-ADDENDUM.md](../engineerticket/contracts/TRUSTED-NETWORK-TOPOLOGY-V1-SECTION5-ADDENDUM.md) to SECTION5-R1.1 without editing the parent contract.

The central finding is an integration boundary, not a new product decision: CORE-R2 V2 exists as a pure module, while application state, validation, Dexie, API and PostgreSQL still accept the legacy V1 Project. SECTION5-R1.1 therefore permits only authorized V1 -> in-memory V2 upcast -> read-only projection for the first Browser slice. Passing V2 through an existing writer would silently drop trusted-network fields and is forbidden.

The addendum defines:

- `ProjectionRequest`, `ProjectionResult`, stable entity refs, trust summaries and typed safe issues;
- exact `$record`-based closure for device/area/interface/link/VLAN/subnet/logical/resiliency records;
- one CORE-owned read helper for current-value fingerprint/stale determination, with no actor/fingerprint/raw-value output;
- stable navigation/fallback independent of names, array order and canvas geometry;
- authorization before projection, cache invalidation on scope change and no hidden-resource loader;
- safe source display, actor suppression and no raw evidence/config/secret/error leakage;
- read-only V1 Browser behavior, honest logical empty states and separation of synthetic V2, Browser, persistence and UAT evidence;
- responsive keyboard/touch/list fallback and unchanged PRE-COMMIT/Git/live boundaries.

PM scope review identified ambiguity in `$record`, the conflicting CORE/PLAN digest algorithms, public error/ordering, exact membership/blank-port mapping and untrusted selection echo. SECTION5-R1.1 resolves them without expanding product scope:

- PLAN-R1.1 canonical SHA-256 becomes the one shared async digest for future/current verified trust; CORE legacy and PLAN records already marked unverified are not rehashed, migrated or guessed;
- `$record` is one explicit whole-record trust entry, optional changes make it stale, and leaf trust never aggregates into record trust;
- projection returns a safe discriminated outcome, uses one fixed type rank/code-point order and fails closed on duplicates;
- physical/logical membership is enumerated, blank-port physical links map device-to-device in all-mode, unrelated logical inventory remains visible, and resiliency is a summary;
- untrusted selection/focus/collapse refs are existence-checked against the authorized Project before any ID is returned.

Expected minimal implementation impact for PM/DEV scope review: new `app/lib/trusted-network-digest.ts`; narrow replacement of PLAN's private canonical/fingerprint with the shared import in `app/lib/trusted-network-change-plan.ts`; read-only inspection seam in `app/lib/trusted-network-model.ts`; new projector/UI integration paths already named by SECTION5; focused DEV regressions for digest equivalence, legacy unverified no-rewrite, PLAN field compatibility, verified stale detection and safe errors. QA needs cross-CORE-legacy/PLAN-field compatibility vectors in addition to PROJ-01–08.

## Preserved decisions and exclusions

- Parent contract and §4 hash/content were not rewritten.
- No CSV v3, actor portability, scale SLA, anonymous truth case, NTM005, RBAC expansion or persistence was approved.
- Existing route/layout remains view-only; canvas geometry is not domain truth.
- Ordinary defects inside SECTION5-R1.1 stay in DEV_NTM_004 <-> QA_NTM_004.

## Verification and next owner

- Documentation consistency/readback: pending after write.
- Product tests/Browser/persistence/DB/live: `NOT RUN` by design.
- Focused design status: `WAITING_PM_SCOPE_REVIEW`.
- Next owner: PM compares DEV_NTM_004 preflight paths/hunks with SECTION5-R1.1. Only the matched local product scope may then proceed.
