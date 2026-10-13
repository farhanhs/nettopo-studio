# Trusted Network Topology V1 — §4 Focused Addendum

| Field | Value |
|---|---|
| Addendum | NTM-PLAN-R1.1 |
| Parent contract | `TRUSTED-NETWORK-TOPOLOGY-V1.md` |
| Parent raw SHA-256 | `0bb2145fb2b1844d576449e55c6f3e040ce9ae14175891c21716d963334dbf63` |
| Ticket | DSG_NTM_001 focused addendum for DEV_NTM_003 / QA_NTM_003 |
| Status | PM CONDITIONALLY APPROVED — R1.1 implementation gate |
| Branch / base | `codex/dev-rel-001-checkpoint` / `a9abe637f0ad419aced6d31faf30a127ce5b81e6` |
| Change class | CORRECT/EXTEND §4 detail only; §1–3 and §5–11 remain unchanged |

## 1. Outcome and limits

This addendum fixes the GEN-R1 → field proposal mapping and the small interface for preview, decisions and snapshot application. It does not approve UI, Zustand, Dexie, API, PostgreSQL, CSV v3, privacy choices, scale promises or a new authentication mechanism.

The approved first implementation phase is a pure snapshot module. It returns a validated new `ProjectV2` but performs no durable write. A passing pure test is not evidence of a repository transaction, authenticated verification, Browser behavior or persistence.

## 2. One deep module, instance-owned execution

The seam is one module, proposed as `app/lib/trusted-network-change-plan.ts`. A caller creates one in-process planner instance and uses only `prepare`, `resolve` and `apply`. The same instance privately owns every executable snapshot and its validated evidence.

```ts
type TrustedPlanOwner = {
  projectScopeId: string; // trusted orchestrator resource key; not authorization
  deviceId: string;
};

type TrustedPlanHandle = object; // opaque runtime identity; no public fields

type TrustedPlanPreview = {
  planVersion: "trusted-network-plan-r1.1";
  planId: string;
  owner: TrustedPlanOwner;
  baseRevision: string;
  candidateFingerprint: string;
  previewFingerprint: string;
  proposals: readonly TrustedFieldProposal[];
  issues: readonly TrustedPlanIssue[];
  summary: { total: number; blocking: number; warnings: number; protected: number };
  canResolve: boolean;
};

type TrustedPlanIssue = {
  id: string;
  severity: "blocking" | "warning" | "info";
  disposition: "hard-block" | "resolved-by-decisions" | "acknowledge" | "observe";
  code: TrustedChangePlanErrorCode | InterfaceCandidateConflictCode | "MISSING_INFO";
  proposalIds: readonly string[];
  safePath?: string;
};

type TrustedPlanDecision =
  | { kind: "cancel" }
  | {
      kind: "resolve";
      resolutions: readonly TrustedProposalResolution[];
      warningAcknowledged: boolean;
    };

type PreparedTrustedPlan = {
  handle: TrustedPlanHandle;
  preview: TrustedPlanPreview; // serializable display DTO only
};

type ResolvedTrustedPlan = {
  handle: TrustedPlanHandle;
  preview: TrustedPlanPreview;
  decisionSummary: {
    acceptedProposalIds: readonly string[];
    excludedProposalIds: readonly string[];
    warningAcknowledged: boolean;
  };
};

type TrustedSnapshotApplyResult = {
  project: ProjectV2;
  receipt: {
    planId: string;
    beforeRevision: string;
    afterRevision: string;
    acceptedProposalIds: readonly string[];
    excludedProposalIds: readonly string[];
    trustInvalidated: readonly TrustedFieldKey[];
    verified: readonly [];
    persistence: "not-performed";
  };
};

type TrustedChangePlanner = {
  prepare(input: {
    owner: TrustedPlanOwner;
    currentProject: ProjectV2;
    candidatePlan: InterfaceCandidatePlan;
  }): Promise<PreparedTrustedPlan>;
  resolve(handle: TrustedPlanHandle, decision: TrustedPlanDecision): Promise<ResolvedTrustedPlan | { status: "cancelled" }>;
  apply(handle: TrustedPlanHandle, input: {
    owner: TrustedPlanOwner;
    currentProject: ProjectV2;
  }): Promise<TrustedSnapshotApplyResult>;
};

createTrustedChangePlanner(): TrustedChangePlanner;
```

The module implementation owns canonicalization, fingerprints, GEN mapping, field-presence interpretation, evidence, dependency closure, conflict completeness, Missing Info/relation recomputation, stale checks and trust transitions. Callers must not reproduce them. No repository, storage or identity adapter is introduced.

`canResolve` is true exactly when there is no `hard-block` issue. `resolved-by-decisions` blocking issues are intentionally reviewable and may clear only through the explicit result rules in §5–§6.1. `canResolve` and all preview fields are display hints, never execution authority.

### 2.1 Private registry and lifecycle

`prepare` validates and deep-clones the current Project, complete GEN plan, complete evidence payload and proposal-to-source/presence mapping into a private registry entry. The public preview may contain safe display values and evidence IDs, but never the private evidence payload or executable state. `apply` reads evidence only from that private entry; it never asks the caller to resupply it and never silently drops it.

The handle is an object created by that planner instance and recognized by runtime object identity in its private `Map`/`WeakMap`. A TypeScript brand, `planId`, fingerprint or SHA is not the handle. A preview, clone, spread, `structuredClone`, JSON round-trip, hand-built lookalike or handle from another planner/reload/process returns `TRUSTED_PLAN_HANDLE_INVALID`, even when all public hashes match.

Lifecycle is deterministic:

- `prepare` creates one `prepared` registry entry; maximum live entries per instance is 32, otherwise `TRUSTED_PLAN_CAPACITY_EXCEEDED`.
- a structurally invalid decision leaves the prepared entry available for correction;
- successful `resolve` changes that same private entry to `resolved`; a second resolve is rejected;
- `cancel` deletes the entry immediately and returns no Project; later resolve/apply returns `TRUSTED_PLAN_HANDLE_INVALID`;
- stale detection, successful apply and any apply integrity/scope/result failure consume and delete the entry, forcing a fresh preview;
- loss of the planner instance (reload/process/module lifetime end) invalidates all handles; plans are intentionally not resumable or portable in R1.1.

Prepare, resolve, cancel and failed apply leave caller-owned values byte-for-byte unchanged. Apply is an in-memory transformation only; its result explicitly says `persistence:"not-performed"`.

## 3. Lossless identity, ownership and stale rules

- `baseRevision` is SHA-256 over the same raw-string canonical Project semantics used by CORE-R2: stable object-key order, contract array order, exact stored strings and every trust/evidence field. It does not NFC-normalize, trim, case-fold, sort ordinary arrays or rewrite values.
- Every raw Project change, including canonically equivalent Unicode bytes such as NFC versus NFD, changes `baseRevision` and makes the handle stale. This prevents normalization-equivalent edits from escaping concurrency detection.
- Name/alias comparison may use the existing GEN/CORE comparison normalization only to detect collisions or matches. The compared normalized key is never persisted and never replaces the original safe string.
- Set-like identifier collections explicitly named by the contract (`evidenceIds`, issue/proposal ID sets and dependency IDs) are deduplicated and sorted for plan identity. Data arrays and user strings retain their original order/content.
- `candidateFingerprint` covers the exact validated private GEN snapshot, evidence, conflicts and Missing Info. `planId` is deterministic from `{planVersion, owner, baseRevision, candidateFingerprint}`.
- `proposalId` is deterministic from raw-value fingerprints and `{planId, entityType, entityId, fieldPath, operation, evidenceIds, alternativeGroupId}`. `alternativeGroupId` is deterministic from the owner, field key and the sorted raw proposed fingerprints, independent of GEN input order.
- `previewFingerprint` is diagnostic traceability only. Resolve/apply authority comes exclusively from the same-instance private handle and registry state.
- Apply requires exact owner equality and recomputed raw-string `baseRevision`; mismatch is `TRUSTED_PLAN_SCOPE_MISMATCH` or `TRUSTED_PLAN_STALE` before any result is produced.

`projectScopeId` binds the entry to a repository resource but grants no permission. In the pure phase tests use an explicit synthetic scope. Product callers may not derive authority from a client-supplied scope, actor, role, hash or owner DTO.

## 4. GEN-R1 → proposal mapping

### 4.1 Proposal contract

```ts
type TrustedFieldKey = {
  entityType: "interface";
  entityId: string;
  fieldPath: "$record" | "name" | "kind" | "aliases" | "parentInterfaceId" | "mac" | "description" | "adminLabel";
};

type TrustedFieldProposal = TrustedFieldKey & {
  proposalId: string;
  operation: "add" | "replace";
  currentFingerprint?: string;
  proposedFingerprint: string;
  proposedValue: unknown; // transient preview only; never included in safe errors/logs
  evidenceIds: readonly string[];
  conflict: "none" | "unverified-existing" | "verified-protected" | "relation" | "alias-collision";
  protected: boolean;
  alternativeGroupId?: string;
  dependsOn: readonly string[];
  applicability: "applicable" | "exclude-only";
};
```

This phase supports interface additions and mutable interface-field replacements only. `id` and `deviceId` are immutable and never become field proposals. Remove/link operations, VLAN/subnet/link/resiliency mutation and arbitrary paths fail with `TRUSTED_OPERATION_UNSUPPORTED`; they are not silently ignored.

For an `$record` addition, preview enumerates the present mutable leaf fields. This phase can only `accept-unverified`; it creates one unverified `FieldTrustRecord` per accepted present leaf, with deterministic ID from `{entityType, entityId, fieldPath}` and the exact raw-value fingerprint. Immutable `id`/`deviceId`, absent optional fields, inferred relations and hidden data are never verified.

### 4.2 Field presence and no implicit clear

GEN-R1 is unchanged. Its projected `aliases: []` and absent optional fields do not prove a user's intent to clear an existing value. Therefore:

- a new `$record` uses the complete validated candidate as produced;
- for an existing interface, required `name` and `kind` may produce explicit replacements when GEN reports an explainable difference;
- non-empty candidate aliases are treated as explicit additions and proposed as the stable union of current aliases plus candidate aliases; this phase never removes an existing alias;
- candidate `aliases: []` preserves current aliases and produces no replacement;
- present optional `parentInterfaceId`, `mac`, `description` or `adminLabel` may replace a different current value;
- an absent optional candidate field preserves the current field and produces no clear/remove proposal;
- any conflict whose intended clear/removal cannot be proven becomes `FIELD_INTENT_AMBIGUOUS`, `blocking/hard-block`, and requires a new source/preview. It is never guessed.

The module may inspect the private validated GEN snapshot and source mapping to determine presence, but it must not modify GEN-R1 output or accept an arbitrary caller patch/presence mask.

### 4.3 Deterministic mapping and deduplication

| GEN-R1 input | Prepared result |
|---|---|
| candidate ID absent from current Project and structurally safe | one `interface/$record/add` proposal containing the complete interface |
| candidate equals the current interface using exact raw values | no proposal and no trust/evidence mutation |
| `EXISTING_DIFFERENCE` | one `replace` proposal for each explicitly present changed mutable field; absent/default-clear ambiguity follows §4.2 |
| multiple distinct source variants | one proposal per distinct field value in a shared deterministic `alternativeGroupId`; at most one may be accepted |
| current field has matching verified trust and proposed fingerprint differs | conflict becomes `verified-protected`, `protected=true`; acceptance is unavailable in snapshot-only R1.1 |
| current field has a verified record whose fingerprint does not match the exact current raw value | `TRUSTED_TRUST_FINGERPRINT_STALE`, `blocking/hard-block`, and protected; it cannot be downgraded to unverified or overwritten |
| current field exists but is unverified and differs | conflict becomes `unverified-existing` |
| `ALIAS_COLLISION` | blocking `alias-collision`; only keep/exclude is legal unless an explicit collision-free aliases proposal already exists |
| `PARENT_MISSING`, `PARENT_CYCLE`, `PARENT_BLOCKED`, `ID_COLLISION` | `blocking/resolved-by-decisions` when tied to an `exclude-only` candidate; otherwise `blocking/hard-block` and reprepare required |
| `TEMPLATE_AMBIGUOUS`, `TEMPLATE_CHANGED`, `TEMPLATE_REMOVED`, missing template identity/source | safe issue/Missing Info; no implicit latest-template choice and no automatic deletion |

`EXISTING_DIFFERENCE` and `TEMPLATE_CHANGED` for the same `{entity, field, raw proposed fingerprint}` produce one proposal. The proposal keeps the union of source/evidence IDs and links to both safe issue codes; it is not duplicated. Distinct alternatives share the stable `alternativeGroupId` defined in §3 and remain mutually exclusive.

GEN evidence is staged in the private registry, not exposed as independently selectable payload. On apply, only evidence referenced by accepted proposals is merged. Duplicate evidence IDs with unequal exact canonical content are blocking; evidence referenced solely by kept/excluded proposals is not added.

Parent references form proposal dependencies. A child `$record` proposal depends on its proposed parent `$record` when the parent is also new. Existing referenced parents must still exist at apply. Dependency cycles and cross-device parents are blocking.

### 4.4 Legacy link compatibility for rename/aliases

Before offering or applying an interface `name`/`aliases` change, the module finds every `LinkV2` whose `fromInterfaceId`/`toInterfaceId` points to that interface. The corresponding legacy `fromPort`/`toPort` raw string must remain equal to the resulting interface name or one resulting alias under the existing comparison rule.

If a rename would strand a legacy port label, prepare adds a visible coupled aliases proposal that preserves the exact old name as an alias. Rename and coupled alias proposals depend on each other and must both be accepted or both kept/excluded. If the alias collides or compatibility still fails, the issue is blocking. The module never edits a Link, clears a port string or silently inserts an alias.

## 5. Decisions, protection and dependency closure

```ts
type TrustedProposalResolution = {
  proposalId: string;
  action: "accept-unverified" | "accept-and-verify" | "keep-current" | "exclude";
};
```

- Every proposal has exactly one explicit resolution. Unknown IDs, duplicates, missing resolutions or two accepted alternatives return typed failure. The module never fixes contradictory decisions by silently changing an action.
- `cancel` consumes the handle, returns no Project and has zero caller-visible mutation.
- `keep-current` is legal only when a current value/record exists and preserves its raw value and exact trust/evidence record. `keep-current` on a proposed new parent has no current value and returns `TRUSTED_DECISION_INVALID_FOR_OPERATION`; use `exclude`.
- `exclude` discards only proposed additions/changes. It never deletes an existing record.
- Parent/dependent decisions have one result: parent accepted + child accepted/excluded are both legal; parent excluded/kept while child accepted is `TRUSTED_DECISION_DEPENDENCY_CONFLICT`; parent excluded/kept requires every proposed dependent child to be explicitly excluded. There is no automatic override of an explicit child action.
- After valid decisions, the module computes the exclusion closure as a verification step, prunes unused evidence, and recomputes issues/Missing Info. A `resolved-by-decisions` issue disappears only when all unsafe alternatives are excluded or exactly one safe alternative is accepted and all competing alternatives are excluded.
- A `hard-block` issue remains blocking regardless of acknowledgement or exclusions and requires a newly prepared source/Project. `acknowledge` warnings require `warningAcknowledged=true`; `observe` information does not.
- `verified-protected` may be kept/excluded. This R1.1 phase cannot accept a different protected value because no actor interface exists.
- `accept-and-verify` always returns `TRUSTED_ACTOR_REQUIRED`. `add-alias`, remove, link and unknown actions return `TRUSTED_OPERATION_UNSUPPORTED`; none has a success path in R1.1. A safe aliases replacement/addition is an ordinary explicit field proposal.

## 6. Trust transition and no-actor rule

| Current / action | Result |
|---|---|
| no value + `accept-unverified` | value added; matching field trust is `unverified` with accepted evidence |
| unverified value changes + `accept-unverified` | old value trust removed/replaced; new fingerprint is `unverified` |
| verified value changes + any accept action | `TRUSTED_ACTOR_REQUIRED`; no Project returned |
| stale verified trust fingerprint + any apply | `TRUSTED_TRUST_FINGERPRINT_STALE`; no Project returned |
| any `accept-and-verify` | `TRUSTED_ACTOR_REQUIRED`; no Project returned |
| same value / keep / exclude | existing trust remains byte-for-byte unchanged |

A changed value can never inherit `verification="verified"`, `verifiedByUserId` or `verifiedAt` from the old fingerprint. Validation/template/import/apply success never verifies a value. R1.1 has no actor parameter, actor type, actor provenance in receipts, identity constructor or synthetic authenticated path. Client role/actor/capability data and fake Boss/session fixtures cannot unlock protected or verified behavior.

## 6.1 GEN issue severity and resolution table

| GEN code / condition | Severity / disposition | Resolution and recomputation |
|---|---|---|
| `SOURCE_DISAGREEMENT` | blocking / resolved-by-decisions | accept exactly one safe alternative and exclude all competitors, or exclude all |
| `ALIAS_COLLISION` | blocking / resolved-by-decisions when exclude-only proposal exists; otherwise hard-block | colliding proposal must be excluded; an accepted collision-free aliases proposal is revalidated globally |
| `EXISTING_DIFFERENCE` on unverified current | warning / acknowledge | keep, exclude or explicit accept-unverified; acceptance requires warning acknowledgement |
| `EXISTING_DIFFERENCE` on verified current | blocking / resolved-by-decisions | keep/exclude only in R1.1; accept fails for missing actor |
| stale verified fingerprint | blocking / hard-block | no decision can downgrade it; reprepare after trust repair |
| `TEMPLATE_AMBIGUOUS` | blocking / hard-block | reprepare with one exact template identity; no latest-version guess |
| `TEMPLATE_CHANGED` | warning / acknowledge | dedupe with same field proposal; never remove current interface automatically |
| `TEMPLATE_REMOVED` | warning / acknowledge | current interface remains; no remove proposal |
| `PARENT_MISSING`, `PARENT_CYCLE`, `PARENT_BLOCKED`, `ID_COLLISION` | blocking / resolved-by-decisions if an exclude-only proposal exists, else hard-block | explicitly exclude every affected proposal, then recompute; never repair the parent silently |
| `NO_SOURCE` | warning / acknowledge | no generated change; caller may acknowledge no-op or reprepare with a source |
| `TEMPLATE_NOT_FOUND`, `TEMPLATE_IDENTITY_MISSING` | warning / acknowledge | no template change; reprepare to use template data |
| unknown GEN conflict/Missing Info code | blocking / hard-block | `TRUSTED_CANDIDATE_PLAN_INVALID`; do not ignore |

Issue IDs derive from `{planId, code, sorted proposalIds, safePath}`. Recompute uses the private original issue/proposal graph and resolved actions, never the caller's preview issue array.

## 7. Apply order and all-or-none result

Apply performs the following inside the module before returning any Project:

1. resolve the handle by same-instance object identity and require private state `resolved`;
2. strict-parse current Project, require exact owner, and recompute raw-string `baseRevision`;
3. read proposals, presence/source mappings, evidence and normalized decisions only from the private entry;
4. validate decision completeness, alternatives, warning acknowledgement, hard blocks and no-actor restrictions;
5. validate the explicit dependency closure and remaining proposals;
6. clone current Project, merge only private evidence referenced by accepted proposals, then apply in deterministic dependency order;
7. invalidate old trust before creating unverified trust for a changed raw value;
8. validate legacy port/name/alias consistency and run full `validateProjectV2`, relation/alias/parent checks and Missing Info recomputation;
9. consume the private entry and return one canonical new snapshot plus safe receipt, or consume and throw one typed error with no snapshot.

No partial result is exposed on failure. The future durable adapter must compare `beforeRevision` and write Project/evidence/trust/audit in one owned transaction. Until that adapter is implemented and independently tested, receipt says `persistence: "not-performed"`.

## 8. Typed safe errors

```ts
type TrustedChangePlanErrorCode =
  | "TRUSTED_CANDIDATE_PLAN_INVALID"
  | "TRUSTED_OPERATION_UNSUPPORTED"
  | "TRUSTED_PLAN_HANDLE_INVALID"
  | "TRUSTED_PLAN_CAPACITY_EXCEEDED"
  | "TRUSTED_PLAN_STATE_INVALID"
  | "TRUSTED_PLAN_SCOPE_MISMATCH"
  | "TRUSTED_PLAN_STALE"
  | "TRUSTED_FIELD_INTENT_AMBIGUOUS"
  | "TRUSTED_TRUST_FINGERPRINT_STALE"
  | "TRUSTED_LEGACY_PORT_INCOMPATIBLE"
  | "TRUSTED_DECISION_UNKNOWN"
  | "TRUSTED_DECISION_DUPLICATE"
  | "TRUSTED_DECISION_INCOMPLETE"
  | "TRUSTED_DECISION_INVALID_FOR_OPERATION"
  | "TRUSTED_DECISION_DEPENDENCY_CONFLICT"
  | "TRUSTED_ALTERNATIVE_CONFLICT"
  | "TRUSTED_BLOCKING_ISSUE"
  | "TRUSTED_WARNING_ACK_REQUIRED"
  | "TRUSTED_DEPENDENCY_EXCLUDED"
  | "TRUSTED_ACTOR_REQUIRED"
  | "TRUSTED_RESULT_INVALID";
```

Errors expose only `{code, safePath?, proposalId?}`. Receipts expose only IDs, revisions and field keys. Neither surface includes current/proposed values, raw evidence, source lines, secrets, actor/session/header, stack, Project or candidate payload. Ordering is deterministic: invalid handle/state → invalid structure → scope → stale/trust-stale → decision completeness → hard/resolvable blocking → warning → actor-required → dependency/legacy-link/result validation.

## 9. PLAN-01–08 acceptance truth

| ID | Required cases | Pass truth |
|---|---|---|
| PLAN-01 | repeat prepare; reordered set-like IDs; raw NFC/NFD-equivalent strings; cancel; frozen inputs | stable IDs only where contract says set-like; raw strings preserved and produce distinct revisions/values; cancel consumes handle, returns no Project; all inputs unchanged |
| PLAN-02 | unknown, duplicate, missing and mutually accepted alternatives; blocking; warning no-ack | exact typed failure; no snapshot/partial result |
| PLAN-03 | wrong owner/Project revision; preview/handle clone, JSON round-trip, cross-instance handle, recomputed public hash | exact scope/stale/handle failure; public DTO/hash/canResolve never executes a plan; stale/apply failures consume the handle |
| PLAN-04 | keep/exclude; verified field changed; verified record fingerprint already stale; rename with legacy ports | keep/exclude preserves raw value/trust; protected acceptance fails no-auth; stale trust hard-blocks; rename requires visible compatible alias pair or rejects without Link edits |
| PLAN-05 | parse/template/import/apply; supplied body actor/role; accept-and-verify | none verifies; no actor parameter/constructor exists; all verification/protected acceptance fails closed; authenticated behavior remains NOT RUN |
| PLAN-06 | aliases default/optional absence; excluded/kept parent plus child decisions; alias collision; unused evidence | no implicit clear; contradictory parent-child decisions reject; complete explicit exclude closure can clear resolvable issues; unused private evidence absent; unsupported operation rejects |
| PLAN-07 | failure at every validation stage; successful snapshot | failure returns no Project; success returns one fully valid cloned Project with `persistence:not-performed`; repository/DB transaction remains NOT RUN |
| PLAN-08 | secret/raw-source/actor sentinels, safe errors/receipt, CORE-R2 and GEN-R1 exact candidate | no prohibited value in errors/receipt/log-facing output; parent/CORE/GEN files remain unchanged and impacted tests pass |

QA tests the module interface, not helper ordering. Preparation vectors may be written now; formal QA waits for PM scope approval, fixed DEV candidate and writer release.

## 10. Minimal phase ownership

### DEV_NTM_003 first product phase

Allowed product paths:

- add `app/lib/trusted-network-change-plan.ts` only;
- add DEV-owned `tests/dev-ntm-003-change-plan.test.mjs`;
- own ticket, log, candidate manifest and own register row.

Read-only dependencies:

- `app/lib/trusted-network-types.ts`;
- `app/lib/trusted-network-model.ts`;
- `app/lib/trusted-network-interface-candidates.ts`;
- CORE-R2/GEN-R1 manifests and tests.

Do not modify UI, store, Dexie, repository, DB, API, auth/RBAC, transfer/CSV, Project schemas, existing CORE/GEN product files or QA-owned assertions. If the new module cannot be implemented without changing a read-only dependency or adding an actor/persistence seam, stop and return the exact required hunk to PM/DSG.

### QA_NTM_003

Allowed: `tests/qa-ntm-003*.test.mjs`, `tests/fixtures/qa-ntm-003/**`, own ticket/log/manifest/register row. Lock exact product/dependency hashes, execute PLAN-01–08 pure cases and affected CORE/GEN regression. Actor-backed verification, persistence, Browser and DB stay `NOT RUN`, not PASS.

## 11. Stop conditions

Stop the affected phase for any new operation/entity type, UI/store/persistence wiring, CSV v3, privacy/export decision, scale promise, raw actor/client role acceptance, fake Boss/session, weaker protected-value rule, partial apply, loss of CORE/GEN compatibility, active QA candidate mutation, or need to alter the parent contract. Ordinary implementation defects inside this addendum use DEV↔QA after PM scope approval.

## 12. R1.1 revision history and implementation gate

R1.1 supersedes only conflicting details in the initial R1 addendum. It adds same-instance private plan ownership/evidence closure, raw-string revisions, conservative field-presence rules, stale-trust and legacy-link protection, and one issue/decision result table. The parent contract remains byte-for-byte unchanged.

PM conditionally approved this exact snapshot-only direction. DEV_NTM_003 may begin only after recording this addendum hash and checking all five R1.1 groups against its planned two product paths. A mismatch stops only the conflicting item for PM/DSG; full alignment needs no additional user or routine PM round. Formal QA still waits for a fixed candidate and writer release.
