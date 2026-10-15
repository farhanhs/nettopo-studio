# TRUSTED-NETWORK-TOPOLOGY-V1 — Section 5 Focused Addendum

Status: `WAITING_PM_SCOPE_REVIEW`  
Revision: `SECTION5-R1.1` (supersedes conflicting R1 details)  
Date: 2026-10-14  
Parent: `TRUSTED-NETWORK-TOPOLOGY-V1.md` §5 / `DSG_NTM_001`  
Implementation / QA: `DEV_NTM_004` / `QA_NTM_004`

This addendum narrows the already-approved physical/logical-view intent to the interfaces that the committed CORE-R2 can actually support. It does not modify the parent contract, authorize persistence, approve CSV v3, define a portable verification actor, or set a product scale SLA.

## 1. Observed implementation boundary

The committed tree contains `ProjectV2`, `TrustedNetworkModelV1`, strict V2 validation, legacy in-memory upcast, interface candidates and PLAN-R1. The application integration remains V1:

- `topology-types.ts` defines durable `Project` as only `devices`, `links`, and `groups`;
- `topology-validation.ts` parses that V1 shape and strips unknown V2 fields;
- Zustand, Dexie, the topology API and PostgreSQL repository all read/write that V1 `Project`;
- `page.tsx` maps only V1 devices and links into the canvas and keeps selection only for `device | link`.

Consequently, NTM004 must not pass a `ProjectV2` to `setProject`, `saveProject`, import, Dexie or PostgreSQL. The first vertical slice is:

```text
already-authorized active V1 Project
  -> clone
  -> upcastProject() in memory
  -> validateProjectV2()
  -> projectTrustedNetworkView()
  -> read-only physical/logical UI
```

This slice can show legacy physical topology and explicit legacy ports as unverified provisional interfaces. It cannot truthfully show persisted structured VLAN/subnet/area data because no approved V2 read/write path exists. Synthetic `ProjectV2` fixtures may prove projector semantics in module tests, but do not prove Browser persistence or product data availability.

Any proposal to persist V2, change the API response, add a Dexie table/index, change PostgreSQL JSON validation, or introduce V2 import/export is a separate named scope and stops NTM004 for PM/DSG review.

## 2. Projection module contract

The focused implementation seam is one pure read module, recommended as `app/lib/trusted-network-projection.ts`. It may import CORE-R2 types and validation; it must not import Zustand, Dexie, React, repository, API, filesystem, network or environment modules.

```ts
type ProjectionView = "physical" | "logical";
type ProjectionMode = "all" | "verified-only";

type TrustedEntityRef = {
  type:
    | "area" | "device" | "interface" | "physical-link"
    | "vlan" | "subnet" | "interface-vlan"
    | "interface-subnet" | "resiliency";
  id: string;
};

type ProjectionRequest = {
  // This exact document has already passed the existing server/repository
  // authorization boundary. The projector has no loading authority.
  authorizedProject: ProjectV2;
  view: ProjectionView;
  mode: ProjectionMode;
  selection?: TrustedEntityRef;
  focusAreaId?: string;
  collapsedAreaIds?: readonly string[];
};

type ProjectionTrust = {
  state: "verified" | "unverified" | "mixed";
  evidenceCount: number;
  safeReasonCodes: readonly string[];
  verifiedAt?: string;
};

type ProjectionItem = {
  ref: TrustedEntityRef;
  label: string;
  owner?: TrustedEntityRef;
  areaId?: string;
  trust: ProjectionTrust;
  hiddenChildCounts?: Readonly<Record<string, number>>;
};

type ProjectionRelation = {
  ref: TrustedEntityRef;
  from: TrustedEntityRef;
  to: TrustedEntityRef;
  label?: string;
  trust: ProjectionTrust;
  diagnostic?: "route-unresolved";
};

type ProjectionSummary = {
  ref: TrustedEntityRef;
  memberRefs: readonly TrustedEntityRef[];
  label: string;
  trust: ProjectionTrust;
};

type ProjectionIssueCode =
  | "SELECTION_NOT_VISIBLE"
  | "FOCUS_AREA_NOT_VISIBLE"
  | "LEGACY_INTERFACE_UNKNOWN"
  | "LEGACY_LOGICAL_RELATION_UNSTRUCTURED"
  | "UNVERIFIED_CLOSURE_HIDDEN"
  | "STALE_TRUST_RECORD_IGNORED"
  | "NO_VISIBLE_ENTITIES";

type ProjectionResult = {
  view: ProjectionView;
  mode: ProjectionMode;
  items: readonly ProjectionItem[];
  relations: readonly ProjectionRelation[];
  summaries: readonly ProjectionSummary[];
  breadcrumb: readonly ProjectionItem[];
  requestedSelection?: TrustedEntityRef;
  effectiveSelection?: TrustedEntityRef;
  issues: readonly { code: ProjectionIssueCode; ref?: TrustedEntityRef; count?: number }[];
  hidden: { unverifiedEntities: number; unverifiedRelations: number };
};

type ProjectionErrorCode = "INVALID_REQUEST" | "INVALID_PROJECT" | "DUPLICATE_ENTITY_ID";
type ProjectionOutcome =
  | { ok: true; result: ProjectionResult }
  | { ok: false; error: {
      code: ProjectionErrorCode;
      safeMessage: "Unable to display this topology projection.";
      issueCount: number;
    } };

function projectTrustedNetworkView(request: ProjectionRequest): Promise<ProjectionOutcome>;
```

Invariants:

1. Validate and clone at the boundary; never mutate or return mutable references from `authorizedProject`.
2. Sort every output by the fixed rank below, then NFC-normalized stable ID using Unicode code-point order (not locale collation). Input array order, canvas position and localized label do not affect identity or fallback.
3. Physical projection uses devices, interfaces and `LinkV2` endpoint references. Logical projection uses interfaces, VLANs, subnets and their typed relations. Resiliency is a relation summary, not a new durable graph.
4. React Flow node/edge IDs are derived from `{type}:{id}` only at the view adapter. React Flow handles, anchors, routes and coordinates never become domain IDs.
5. The projector is read-only. No callback in this interface may load, save, verify, infer, expand authorization or fetch a missing entity.

The fixed rank is the only ordering oracle:

```text
area(10) < device(20) < interface(30) < vlan(40) < subnet(50)
< physical-link(60) < interface-vlan(70) < interface-subnet(80)
< resiliency(90)
```

`items`, `relations`, `summaries`, equal-level breadcrumb children and fallback candidates use this rule. Breadcrumb ancestor order itself remains root-to-leaf. Duplicate IDs anywhere in the globally unique CORE-R2 ID space fail before projection with `DUPLICATE_ENTITY_ID`; the projector never keeps first/last or renames a duplicate.

Malformed requests, invalid ProjectV2 and duplicate IDs return the public failure branch above; they do not throw raw Zod/CORE errors across the UI seam. `safeMessage` is the exact fixed public text. `issueCount` is bounded to the number of validation issues and contains no path, ID or value. Internal diagnostics may retain typed CORE codes outside user-visible state/DOM/log payloads, but never raw input, stack, database details or evidence content.

## 3. Exact verified-only closure

### 3.1 Current-value verification

A trust record is usable only when all of the following are true:

- its `entityType`, `entityId`, and `fieldPath` identify the exact current entity/field;
- `verification === "verified"` and the structurally required actor/time are present;
- `valueFingerprint` equals the fingerprint of the current canonical value;
- every referenced evidence ID still exists.

A structurally valid but fingerprint-mismatched verified record is stale. It is treated as unverified, produces `STALE_TRUST_RECORD_IGNORED`, and never exposes the stale value or actor.

The committed modules currently have two digest implementations: CORE legacy upcast uses private `fingerprintValue` (dual namespace stable hash over `JSON.stringify`), while PLAN-R1.1 uses Web Crypto SHA-256 over its recursively key-sorted, undefined-omitting `canonical(value)`. They are not interchangeable. SECTION5-R1.1 makes PLAN-R1.1's SHA-256 canonical digest authoritative for current-value trust inspection and all future trust writes. Projection is therefore async and must call the shared digest seam; it must not copy either algorithm or try both.

Exact compatibility rules:

- move/export PLAN's existing `canonical` + SHA-256 behavior as one dependency-light async helper (recommended `app/lib/trusted-network-digest.ts`) and make PLAN plus projection import it;
- preserve exact raw strings and ordinary array order; recursively sort object keys and omit `undefined`, exactly as PLAN-R1.1 already does;
- do not recompute, migrate or rewrite existing CORE legacy-upcast fingerprints: those records are unverified and inspection returns `unverified` before digest comparison;
- PLAN-created field trust is also unverified and remains unverified without a stale verdict; its stored digest is already compatible if a later authorized verification transition preserves the same value;
- a pre-R1.1 record marked verified but carrying another/unknown digest has no algorithm marker and therefore fails the authoritative SHA-256 comparison as stale. There is no dual-algorithm guessing or silent upgrade.

Recommended minimal CORE seam:

```ts
type TrustedFieldStatus = {
  state: "verified" | "unverified" | "stale";
  evidenceIds: readonly string[];
  verifiedAt?: string;
};

async function inspectTrustedField(
  project: ProjectV2,
  key: { entityType: TrustedEntityType; entityId: string; fieldPath: string },
): Promise<TrustedFieldStatus>;
```

This helper returns no actor ID, raw value, fingerprint or evidence body. Adding it is a read seam, not verification authority. It short-circuits unverified records without hashing, uses the shared PLAN digest only for verified records, and returns `stale` on verified digest mismatch.

### 3.2 Required fields

`$record` is an explicit trust key; it is not inferred by aggregating field-level trust. It resolves to the complete current schema record below, then passes that record to the shared PLAN canonical SHA-256 helper.

| Entity type | Exact `$record` value |
|---|---|
| device | complete current `DeviceV2` record |
| link | complete current `LinkV2` record |
| group | complete current `GroupV2` record |
| area | complete current `NetworkArea` record |
| interface | complete current `NetworkInterface` record; alias order is meaningful |
| vlan | complete current `NetworkVlan` record |
| subnet | complete current `NetworkSubnet` record |
| interface-vlan | complete current `InterfaceVlanRelation` record |
| interface-subnet | complete current `InterfaceSubnetRelation` record |
| resiliency | complete current `ResiliencyRelation` record; member order is meaningful |

Because `$record` covers the complete record, adding, removing or changing any optional field changes the digest and makes verified `$record` trust stale. A field trust such as `interface:name` verifies only that field. Even if all current leaf fields have verified entries, they do not aggregate into `$record`; without one exact current verified `$record` entry, record status is unverified.

| Visible record/relation | Required verified keys |
|---|---|
| device | `device:$record` |
| area | `area:$record`; every ancestor area `$record` |
| interface | `interface:$record`; owning device `$record`; parent interface `$record` when present |
| physical link | `link:$record`; both devices `$record`; both `fromInterfaceId`/`toInterfaceId` must exist; both endpoint interfaces `$record` and ownership must match |
| VLAN | `vlan:$record`; referenced area closure when present |
| subnet | `subnet:$record`; referenced VLAN/area closure when present |
| interface-VLAN | `interface-vlan:$record`; interface and VLAN closure |
| interface-subnet | `interface-subnet:$record`; interface and subnet closure |
| resiliency | `resiliency:$record`; every member physical-link closure; primary member closure when present |

Verified-only is an induced, reference-safe subgraph. If one required member fails, the relation and any orphaned relation-only node are omitted. The result increments hidden counters and reports a safe issue. It must not render a dangling edge, replace the missing endpoint with a guessed device, or state that the network is disconnected, healthy, failed over or unreachable.

Legacy-upcast trust is unverified by definition. A blank legacy port creates no interface. A non-empty legacy port may create the committed deterministic provisional interface, but that endpoint stays out of verified-only until an authorized verification flow creates current matching trust.

### 3.3 Exact view membership and mapping

All-mode is inclusive over the authorized document; verified-only applies §3.2 closure first. “Orphan” means a relation whose required endpoint is absent, not a standalone inventory entity.

| View | Items | Relations | Summaries |
|---|---|---|---|
| physical / all | every area, device and interface | every physical link | folded-area counts only |
| physical / verified-only | every area/device/interface whose own required closure passes | only physical links whose complete closure passes | hidden and folded-area counts |
| logical / all | every area, device, interface, VLAN and subnet, including inventory with zero logical relations | every interface-VLAN and interface-subnet relation | every resiliency record plus folded/legacy-unstructured counts |
| logical / verified-only | every area/device/interface/VLAN/subnet whose own closure passes, including zero-relation inventory | only logical relations whose complete closure passes | resiliency only when its member-link closure passes; hidden counts |

Physical link endpoint mapping in all-mode is exact:

1. use the referenced endpoint interface when `fromInterfaceId`/`toInterfaceId` exists and CORE ownership validation passed;
2. otherwise use the corresponding device ref from `from`/`to` and add `LEGACY_INTERFACE_UNKNOWN` once per missing endpoint;
3. never synthesize an unknown-interface ID, use `fromPort/toPort` as an ID, or use a canvas anchor/handle.

A normal legacy blank-port link therefore remains visible device-to-device in physical all-mode. Verified-only hides it because interface endpoints are required. An explicit legacy port may use CORE's deterministic provisional interface in all-mode but remains unverified.

Logical view retains authorized area/device/interface inventory even when unrelated so navigation can say “no structured logical relation is recorded”; this must not be phrased as “no VLAN exists.” `Link.vlan` contributes only a legacy-unstructured summary count/safe label and never creates a VLAN item or logical relation. Physical links are not logical relations. `ResiliencyRelation` is a `ProjectionSummary` whose `memberRefs` are stable physical-link refs; it is not fabricated as a binary edge.

Every relation endpoint references an emitted item. Summaries may reference domain relations by stable ref. Filtering a relation never removes an otherwise valid standalone inventory item; hidden relation counts remain explicit.

## 4. Navigation, selection and deterministic fallback

Navigation is restricted to entities already present in the authorized document and current projection closure.

### 4.1 Breadcrumb

- Area path is derived by `parentAreaId` and stable IDs: region -> site -> device -> interface -> selected logical/physical relation.
- Breadcrumb payloads carry `TrustedEntityRef`; labels are display-only.
- A cycle/missing parent is already a CORE validation error and must fail before rendering, not be repaired by the UI.
- `focusAreaId` outside the visible closure produces `FOCUS_AREA_NOT_VISIBLE` and falls back to the closest visible ancestor known in the same authorized document; otherwise projection root.

### 4.2 View switch and filters

Keep `requestedSelection` independently from `effectiveSelection` so a temporary filter does not overwrite the user's stable domain intent, subject to authorization-safe normalization.

1. If the same ref is visible in the target view, retain it.
2. Interface -> owning device.
3. Physical link -> lexicographically first visible endpoint interface, then its device.
4. Interface-VLAN/interface-subnet -> visible interface, then owning device, then VLAN/subnet.
5. VLAN/subnet -> lexicographically first visible related interface, then its device.
6. Resiliency -> primary visible link, otherwise lexicographically first visible member link.
7. Any entity -> closest visible area ancestor.
8. Otherwise first visible item by fixed type rank then NFC-normalized stable ID; if none, selection is empty and `NO_VISIBLE_ENTITIES` is reported.

Fallback never crosses topology, requests a hidden site, uses an array index, or selects by non-unique name. When verified-only hides the requested selection, show “所選項目未通過目前的核實篩選” and `SELECTION_NOT_VISIBLE`; do not silently pretend the fallback is the original item. Switching the filter off restores the requested stable ref if it is visible again.

`selection`, `focusAreaId` and collapsed IDs are untrusted client input. Before copying any ref into `requestedSelection`, issue `ref`, breadcrumb or UI state, the projector proves the exact type+ID exists in `authorizedProject`. A missing/invalid client ref is omitted entirely and yields only the constant code `SELECTION_NOT_VISIBLE` (or `FOCUS_AREA_NOT_VISIBLE`) with no client ID/text. An authorized-but-filtered entity may retain its stable ref because existence is already authorized; its issue still contains only the ref and constant code, never stale field/value, actor or raw input. Unknown collapsed IDs are silently discarded.

Collapsing is view state only for NTM004. It may temporarily reveal the selected path without changing `Group.collapsed`, coordinates, ProjectV2, Zustand or storage. Hidden counts are calculated from authorized records only.

## 5. Authorization and safe display

The order is fixed:

```text
session/identity -> repository resource authorization -> authorized Project clone
-> V1 in-memory upcast/V2 validation -> projection -> React rendering
```

- Projection receives one authorized Project document and no repository/session/context loader.
- Client area IDs, breadcrumbs and selected refs have no authorization meaning.
- Changing customer/topology/session discards the prior projection and requested selection before rendering the next document.
- A projection result may not be cached or rehydrated under a different `activeTopologyId` or identity scope. Cache keys, if used, include authorized topology ID plus canonical document revision and are cleared on 401/403/session change.
- Missing cross-topology endpoints are absent. NTM004 does not create a redacted external stub because no existing API contract authorizes that fact.

Allowed source display is limited to validated evidence metadata already inside the authorized document:

- method and source kind as localized labels;
- `displayName` and `safeSummary` only after CORE unsafe-evidence validation;
- optional file basename (never a path) plus line number, or template version/fingerprint prefix when needed for support;
- verification state and `verifiedAt`.

Do not render `verifiedByUserId` in this phase. Do not render raw source, secret/config content, cookie/token, full local path, database value, evidence fingerprint, value fingerprint, internal error/stack, or authorization data. Inferred/unverified state always has text plus icon/line pattern and an accessible reason; color and hover are supplementary only.

## 6. UI boundary and fallback experience

Recommended UI ownership:

- `trusted-network-projection.ts`: all projection, closure, ordering, fallback and safe issue codes;
- a small NTM view component under `app/components/topology/`: view/mode controls, breadcrumb, list fallback and Inspector-safe summaries;
- `page.tsx`: obtains the already-authorized active Project, performs in-memory upcast, coordinates active topology changes, and maps projected nodes/edges to the existing canvas;
- existing routing/layout: physical route visualization only; no domain truth or verification decisions;
- Zustand/store: unchanged for this read-only phase.

The existing V1 edit canvas remains the write surface. NTM004 projection controls must be clearly marked read-only; they do not expose save/verify/apply controls. Device/link editing may continue only through existing V1 actions and causes projection regeneration from the new authorized V1 snapshot.

The list/Inspector fallback is mandatory, not an optional accessibility enhancement:

- every visible entity/relation is reachable without canvas hit-testing;
- view, mode, search result, breadcrumb and list rows use native buttons/controls with visible focus;
- keyboard supports normal Tab/Shift+Tab/Enter/Space behavior without custom traps;
- touch targets are at least 44 CSS px in the new controls;
- reasons and hidden counts are available without hover;
- at 360/768/1024/1280 CSS px and short height, controls/detail remain reachable through local vertical scrolling and the page has no horizontal overflow;
- dense overview may suppress interface labels on canvas, but the list retains full safe labels;
- route `no-path` is shown as `route-unresolved`, never as a missing domain relation.

## 7. Legacy and empty-state behavior

| Condition | Required behavior |
|---|---|
| V1 explicit endpoint port | deterministic provisional interface; “舊資料／未核實”; all-mode only |
| V1 blank endpoint port | no interface invented; physical device link may remain with “介面未知”; verified-only hides it |
| V1 `Link.vlan` string | retain existing V1 display as “未結構化 VLAN”; do not create a VLAN entity/logical edge |
| no structured logical records | logical view shows an honest empty state and legacy-unstructured count; do not claim “no VLAN exists” |
| invalid V2 relation/schema | fail closed to safe error state; no partial canvas |
| selected entity removed by V1 edit | apply deterministic fallback and announce the change |
| zero visible verified records | empty verified-only state with hidden counts and reset-filter action |

## 8. DEV/QA scope gate

Before product writing, DEV preflight must identify the exact paths and prove they do not overlap an active writer. Expected minimal path classes are:

- new pure projector and its DEV tests;
- new shared async digest helper plus equivalence tests against committed PLAN-R1.1 vectors;
- minimal read-only topology view component/style;
- narrow `page.tsx` integration hunk;
- narrow replacement of PLAN's private canonical/fingerprint helper with the shared import, with unchanged PLAN IDs/revisions/field fingerprints for identical inputs;
- the CORE read-only `inspectTrustedField` seam and focused cross-CORE-legacy/PLAN regressions.

The following are forbidden in NTM004: `topology-types.ts` durable V1 widening, topology validation/storage/repository/API migrations, import/export changes, verification actor creation, PLAN decision/apply semantics changes beyond the behavior-preserving shared-digest extraction, RBAC changes, package/lock changes, CSV v3, and NTM005 work.

QA must independently prove PROJ-01–08, including:

- deterministic projections and fallback under permuted input;
- exact closure for each relation type, stale fingerprint rejection and zero dangling relations;
- byte-for-byte PLAN digest/ID/revision compatibility after helper extraction, legacy unverified fingerprint preservation, no dual-algorithm acceptance, and verified authoritative-digest stale/non-stale cases;
- legacy port/blank/VLAN-string behavior;
- auth-first lifecycle and no hidden rehydrate after topology/session change;
- safe evidence/DOM/error scanning and absence of actor/raw source/secret surfaces;
- Browser keyboard/touch/list fallback and the required viewport matrix;
- CORE/GEN/PLAN plus affected legacy UI regression;
- explicit separation of pure ProjectV2 fixture PASS, V1 Browser integration PASS, persistence `NOT RUN`, true V2 Browser data `BLOCKED`, and anonymous UAT `NOT RUN` until their gates exist.

No numeric performance SLA is created here. QA records fixture size, device/browser/OS and observed duration; existing gates may not be weakened. Any attempt to promote an observed number to a release threshold requires PM approval.

## 9. Stop conditions

Stop and return to PM/DSG if implementation requires:

- V2 persistence, API/repository/Dexie schema or CSV v3;
- a second source of fingerprint/trust truth;
- verification actor portability or client-created verification;
- cross-topology loading, redacted hidden endpoints, or wider RBAC;
- storing selection/collapse by changing durable topology data;
- claiming full logical Browser functionality from a synthetic fixture;
- a new scale threshold or anonymous/live acceptance promise.

Within this contract, ordinary implementation defects remain DEV_NTM_004 <-> QA_NTM_004 and do not reopen design.
