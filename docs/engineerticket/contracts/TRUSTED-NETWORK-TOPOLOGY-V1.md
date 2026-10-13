# Trusted Network Topology V1 Contract

| Field | Value |
|---|---|
| Contract ID | TRUSTED-NETWORK-TOPOLOGY-V1 |
| Design Ticket | DSG_NTM_001 |
| Status | PROPOSED / WAITING_APPROVAL |
| Authority | PM_GOV_001-D43；2026-10-09 trusted network topology plan；Q1–Q16，Q16=A |
| Product reference | `codex/dev-rel-001-checkpoint` at `a9abe637f0ad419aced6d31faf30a127ce5b81e6` |
| Change | EXTEND；尚未成為產品 schema 或開發授權 |

## 0. Outcome, scope, and preserved invariants

本契約把現有 `Device / Link / Group` 延伸成同一份可追溯的可信網路資料，支援：

- 設備上的獨立介面；
- 實體接線的兩端介面；
- VLAN、子網與介面的結構化邏輯關係；
- 區域 → 站點 → 設備／介面／VLAN 的工程導航；
- 來源、推測理由與人工核實狀態；
- 同一份資料的實體視圖與邏輯視圖。

第一階段是可信文件與工程交接，不是網路協定模擬器、監控平台或設備控制器。推測資料不得作為 live 健康、故障結論、自動變更或設備操作依據。

以下既有不變量保留：

1. `topology-transfer.ts` 仍是可寫入 Project 的單一傳輸契約；UI 不複製 schema。
2. 所有持久化拓樸修改仍經 Zustand write seam；component 不直接寫 Dexie。
3. Project 不保存明文 credential、masked credential、ciphertext、nonce、cookie、token 或原始敏感組態。
4. 五個 canonical CSV member、safe/full、v1 legacy、strict manifest、重名拒絕、大小 gate、Missing Info 與 preview-before-apply 均保留。
5. 畫布 anchor、dock、route、lane、offset、cost、cache 是視圖衍生，不是介面或實體接線真值。
6. 工程站點／區域不擴張授權站點或現行 RBAC；伺服器授權仍先於資料投影。
7. A04／A05／A07 未完整驗收及全部歷史失敗／NOT RUN 保留，本設計不代簽。

## 1. Module and seam map

推薦建立一個深 module `trusted-network-model`，讓呼叫者只學會少量 interface，將 upcast、關聯驗證、可信度、衝突、投影與交換映射集中在同一處。

```text
TXT / MD / CSV / UI forms
          │
          ▼
prepareTrustedTopologyChange(input, currentProject)
          │  returns preview plan; no persistence
          ▼
TrustedChangePlan ── review conflicts / select verification scope
          │
          ▼
applyTrustedTopologyChange(plan, decision)
          │  revalidate revision + relations + Missing Info
          ▼
ProjectV2 ── Zustand write seam ── Dexie / PostgreSQL JSON
    │
    ├── projectPhysicalProjection(project, accessContext)
    ├── projectLogicalProjection(project, accessContext)
    └── export/import through topology-transfer
```

Suggested future file responsibilities (not authorized by this design):

| Module | Interface responsibility | Must hide |
|---|---|---|
| `app/lib/trusted-network-model.ts` | V1 types, upcast, canonicalization, relationship validation | ID generation, legacy port migration, cross-reference indexes |
| `app/lib/trusted-network-provenance.ts` | safe evidence normalization, field trust, explicit verification transitions | value fingerprints, conflict matching, source sanitization |
| `app/lib/trusted-network-inference.ts` | explicit source → trusted template → manual generation and explainable proposals | alias parsing, template lookup, reason codes |
| `app/lib/trusted-network-projection.ts` | physical/logical/verified-only read projections | closure rules, redaction, fold summaries, breadcrumbs |
| `app/lib/topology-transfer.ts` | JSON/CSV v1-v3 gate, import plan, round-trip canonicalization | record grammar, remapping every new reference |
| `app/lib/topology-missing-info.ts` | deterministic completeness rules for new entities | blocking/warning derivation; no persistence side effects |
| UI under `app/components/topology/*` | preview, conflicts, navigator, badges, inspectors | no duplicated validation or direct Dexie writes |

External interface target:

```ts
upcastProject(input: unknown): ProjectV2
prepareTrustedTopologyChange(input: TrustedInput, current: ProjectV2): TrustedChangePlan
applyTrustedTopologyChange(plan: TrustedChangePlan, decision: TrustedApplyDecision): ProjectV2
projectTrustedTopology(project: ProjectV2, options: ProjectionOptions): TopologyProjection
```

The interface includes these invariants: deterministic output, safe typed errors, zero writes during prepare, revision-checked atomic apply, and no authorization expansion. Tests should exercise this seam rather than internal helper order.

## 2. NTM-D01 — Shared durable data contract

### 2.1 Project version and extension shape

Legacy Project has no internal version and is treated as `ProjectV1`. The proposed canonical write shape is:

```ts
type ProjectV2 = {
  projectSchemaVersion: 2;
  devices: DeviceV2[];
  links: LinkV2[];
  groups: GroupV2[];
  trustedNetwork: TrustedNetworkModelV1;
};

type TrustedNetworkModelV1 = {
  modelVersion: 1;
  areas: NetworkArea[];
  interfaces: NetworkInterface[];
  vlans: NetworkVlan[];
  subnets: NetworkSubnet[];
  interfaceVlans: InterfaceVlanRelation[];
  interfaceSubnets: InterfaceSubnetRelation[];
  resiliencyRelations: ResiliencyRelation[];
  evidence: EvidenceSource[];
  fieldTrust: FieldTrustRecord[];
};
```

`trustedNetwork` is the only durable extension container in v2. Route, view mode, selection, pan/zoom, lane and derived display labels are forbidden in it.

Layer mapping:

| Layer | Canonical representation | Rule |
|---|---|---|
| Domain / validation | `ProjectV2` + `TrustedNetworkModelV1` | single writable schema; strict unknown-key rejection |
| Zustand state | current authorized `ProjectV2` | mutations only through existing actions / trusted apply interface |
| Dexie | nested ProjectV2 JSON in topology record | no separate shadow graph or localStorage topology copy |
| PostgreSQL | validated ProjectV2 JSON in existing topology storage | authorization and active-session checks occur before repository read/write |
| API | authorized ProjectV2 DTO | server strips/rejects server-only authorization metadata and untrusted verifier identity |
| JSON export | versioned ProjectV2 envelope | full/safe canonical rules apply |
| CSV/ZIP | isolated v1/v2 readers; proposed five-file v3 writer/reader | exact manifest/header/recordType gate; no sixth file |
| React Flow | `TopologyProjection` nodes/edges | view-only IDs point back to durable entity IDs; route geometry never writes back as truth |

### 2.2 Stable ID rules

- IDs are opaque, unique within a Project, persisted once and never recomputed from mutable display names.
- New records use a collision-resistant generated ID with a type prefix (`if-`, `area-`, `vlan-`, `subnet-`, `ivr-`, `isr-`, `rr-`, `ev-`, `trust-`). Exact generator is implementation detail, but output is string, 1–128 characters.
- Import `merge` remaps collisions and every transitive reference in one plan. A partial remap is blocking.
- Legacy port upcast may create a deterministic provisional interface ID from `(deviceId, normalized legacy port label)` using a versioned hash namespace. Raw labels remain display data; a rename never changes the persisted ID.
- Empty or unknown legacy port text does not create an interface. It remains unresolved Missing Info.

### 2.3 Device and area

```ts
type DeviceV2 = Device & {
  networkAreaId?: string;
};

type NetworkArea = {
  id: string;
  kind: "region" | "site";
  name: string;
  parentAreaId?: string;   // region may contain site; cycles forbidden
  groupId?: string;        // optional visual containment mapping
};
```

Rules:

- Each device may belong to at most one engineering `NetworkArea` in V1.
- `NetworkArea` is documentation hierarchy. It does not grant access and must not cause hidden cross-site records to load.
- Any mapping from `NetworkArea` to an authorization `SiteRecord` lives in server-side repository/policy metadata outside portable Project, state and transfer files. It is never accepted from import.
- Existing `Group(kind="site")` remains valid visual grouping. `NetworkArea.groupId` may link it, but neither record silently creates the other.
- Existing `Device.quantity` remains “represented device count”; it never generates device or interface records.

### 2.4 Independent network interfaces

```ts
type NetworkInterface = {
  id: string;
  deviceId: string;
  name: string;
  kind: "physical" | "logical" | "aggregate" | "wireless";
  parentInterfaceId?: string;
  aliases: string[];
  mac?: string;
  description?: string;
  adminLabel?: string;
};
```

Invariants:

- `deviceId` must exist. `parentInterfaceId`, when present, must exist on the same device and must not form a cycle.
- `name` is required, while aliases are optional, normalized for matching but preserve original safe text for display.
- Canonical name and aliases must not collide within the same device after trim, Unicode NFC and case-fold normalization. A collision is a review conflict, not last-wins.
- A logical or aggregate interface may have a parent; a physical interface does not require one.
- Interface MAC is optional and distinct from legacy `Device.mac`. No automatic copy is treated as verified truth.
- UI dock/handle ID is never a `NetworkInterface.id` unless an explicit user selection has created that domain reference.

### 2.5 Physical links and endpoint references

```ts
type LinkV2 = Link & {
  fromInterfaceId?: string;
  toInterfaceId?: string;
  medium?: "unspecified" | "cat5e" | "cat6" | "cat7" | "fiber";
};
```

Rules:

- Existing `from` and `to` device IDs remain canonical device endpoints for compatibility.
- A physical link is semantically undirected in V1. `from/to` provide stable serialization and display orientation only; they do not assert packet or traffic direction.
- If `fromInterfaceId` exists, that interface must belong to `from`; same rule for target.
- A verified wired physical link requires both interface IDs. A legacy or incomplete link may remain unverified with missing IDs so old Projects can load; Missing Info is blocking before it can be marked verified or used as trustworthy handoff evidence.
- `fromPort` and `toPort` remain lossless legacy display strings in V2. Once mapped, their normalized value must agree with the referenced interface name or alias; mismatch becomes a conflict.
- Existing self-link and missing-device rules remain blocking. An interface cannot be both ends of the same physical link.
- Interface occupancy is not inferred universally: aggregate, trunk and logical interfaces may legitimately participate in multiple relations. Physical point-to-point duplicate use is validated by device/interface kind and explicit rule, never by canvas geometry.
- `medium` follows the separate proposed medium contract if later approved; it must not be inferred from speed.

### 2.6 VLANs, subnets, and logical relations

```ts
type NetworkVlan = {
  id: string;
  vlanNumber: number;      // 1..4094
  name?: string;
  areaId?: string;
};

type NetworkSubnet = {
  id: string;
  cidr: string;            // canonical IPv4 or IPv6 CIDR
  name?: string;
  areaId?: string;
  vlanId?: string;
};

type InterfaceVlanRelation = {
  id: string;
  interfaceId: string;
  vlanId: string;
  mode: "access" | "trunk-allowed" | "native" | "tagged" | "untagged" | "unknown";
};

type InterfaceSubnetRelation = {
  id: string;
  interfaceId: string;
  subnetId: string;
  address?: string;
  role?: "gateway" | "member" | "management" | "unknown";
};
```

Rules:

- Multiple IPs and VLANs are represented by multiple relation rows; comma-separated strings are not canonical truth.
- CIDR and address parsing is syntax validation only. It does not prove live reachability, routing or configuration.
- Referenced area/interface/VLAN/subnet must exist and be visible in the already-authorized Project.
- Legacy `Link.vlan` is preserved. A parser may propose structured VLAN records and relations, but does not silently rewrite the string or claim verification.
- Duplicate semantic relations after canonical normalization are blocking or merged only when their evidence/trust records are identical.

### 2.7 Primary/backup relationship

```ts
type ResiliencyRelation = {
  id: string;
  kind: "primary-backup" | "active-active" | "candidate";
  memberLinkIds: string[]; // at least two unique existing links
  primaryLinkId?: string;
  name?: string;
};
```

This is documented intent, not live failover state. An inferred primary/backup relation remains unverified and always carries an explainable reason. `primaryLinkId` must be one of `memberLinkIds`; active-active must not set a primary.

### 2.8 Safe evidence and field-level trust

Source and verification are separate dimensions:

```ts
type EvidenceSource = {
  id: string;
  method: "parsed" | "template" | "inferred" | "human" | "legacy-upcast";
  sourceKind: "document" | "csv" | "json" | "template" | "manual" | "legacy-project";
  displayName: string;
  locator?: { file?: string; line?: number; section?: string };
  template?: { templateId: string; version: string; fingerprint: string };
  ruleCode?: string;
  safeSummary?: string;
  capturedAt?: string;
};

type TrustedEntityType =
  | "device" | "link" | "group" | "area" | "interface"
  | "vlan" | "subnet" | "interface-vlan" | "interface-subnet" | "resiliency";

type FieldTrustRecord = {
  id: string;
  entityType: TrustedEntityType;
  entityId: string;
  fieldPath: string;
  valueFingerprint: string;
  evidenceIds: string[];
  verification: "unverified" | "verified";
  verifiedByUserId?: string;
  verifiedAt?: string;
};
```

Rules:

- `valueFingerprint` compares the canonical current value without copying its plaintext into logs or issues.
- Every verified record requires `verifiedByUserId` and `verifiedAt`; these are server/session-derived, never trusted from CSV import.
- Import confirmation, successful parsing, Zod validation and template match do not set `verification="verified"`.
- Evidence file names are canonical basenames only; line/section are safe locators. Raw upload content, configuration blobs, credentials, cookies, tokens, DSN, ciphertext and nonce are forbidden.
- If safe/full policy removes a value, its trust record and fingerprint are also removed or safely recomputed; an orphan fingerprint must not leak that a hidden value existed.
- Unknown or unavailable value is absence plus Missing Info, not the literal verified value `unknown`.

## 3. NTM-D02 — Source, template, manual generation, and inference

### 3.1 Fill priority

Priority applies only when generating missing candidate data. It never overrides a current verified fact:

1. Explicit interface/source rows parsed from the selected document or CSV.
2. Exact match to a trusted, versioned model template.
3. Explicit human-provided interface quantity, numbering pattern and names.
4. Explainable inference for endpoint/VLAN/resiliency proposals only.

If two sources at any rank disagree, create a conflict. Do not select the newest or highest rank silently.

### 3.2 Trusted template contract

```ts
type InterfaceTemplate = {
  templateId: string;
  version: string;
  vendor: string;
  modelMatch: string;
  fingerprint: string;
  reviewedAt: string;
  interfaces: Array<{
    name: string;
    kind: NetworkInterface["kind"];
    aliases?: string[];
    parentName?: string;
  }>;
};
```

- Match is normalized exact vendor/model in V1; fuzzy model matching is not trusted.
- A model string in an import is not proof that the template is complete or applies to a hardware revision.
- Template records are proposals with `method="template"` and `verification="unverified"` until explicitly verified.
- Template updates never rewrite existing verified interfaces. Added missing candidates are previewed; renamed/removed/changed ports become conflicts.
- No package, provider, vendor API or live device lookup is part of V1.

### 3.3 Manual generation

Manual generation requires quantity, start index, formatting pattern and optional prefix/suffix. It produces a preview before save.

Examples: `Port 1..24`, `Gi1/0/1..24`. Quantity must never come from `Device.quantity` or observed link count. Generated names must pass the same per-device collision rules as parsed names.

### 3.4 Explainable inference

Allowed V1 reason codes:

- `ENDPOINT_LABEL_EXACT_ALIAS`: legacy/source endpoint label exactly matches interface name/alias.
- `TEMPLATE_ENDPOINT_EXACT`: endpoint name exists in the exact trusted template.
- `VLAN_EXPLICIT_LABEL`: an explicit VLAN number/name appears in a safe structured source field.
- `SUBNET_EXPLICIT_CIDR`: a syntactically valid CIDR is explicitly present.
- `RESILIENCY_EXPLICIT_ROLE_WORD`: source explicitly labels primary/backup or active-active.
- `LEGACY_PORT_UPCAST`: existing `fromPort/toPort` creates an unverified provisional interface.

Not allowed:

- deriving total interface count from connected links;
- deriving cable medium from speed;
- deriving reachability or forwarding path from canvas route;
- inventing confidence percentages without a calibrated model;
- treating naming convention alone as verified primary/backup state;
- using hidden/unauthorized topology data as evidence.

Every inferred proposal must reference one or more `EvidenceSource` records with `ruleCode` and a safe, user-readable reason. The UI must show “推測” plus reason text/icon; color alone is insufficient.

## 4. NTM-D03 — Verification, batch save, and conflict review

### 4.1 State model

```text
candidate(unpersisted)
  ├─ apply without verification → persisted + unverified
  ├─ explicit selected-field verification → persisted + verified
  ├─ keep current → proposal discarded, current unchanged
  └─ exclude → proposal discarded, Missing Info recalculated

persisted unverified
  ├─ explicit verify → verified
  └─ later conflicting source → conflict review

persisted verified
  └─ any different proposal → protected conflict; never automatic overwrite
```

There is no automatic `verified` transition from import confirmation, format validation, template generation, save, reload or export/import.

### 4.2 Change plan and conflict interface

```ts
type FieldChangeProposal = {
  id: string;
  entityType: TrustedEntityType;
  entityId?: string;
  fieldPath: string;
  operation: "add" | "replace" | "remove" | "link";
  currentFingerprint?: string;
  proposedValue: unknown;       // held only in transient preview
  proposedFingerprint: string;
  evidenceIds: string[];
  conflict: "none" | "unverified-existing" | "verified-protected" | "relation" | "alias-collision";
};

type TrustedChangePlan = {
  planVersion: "trusted-network-v1";
  baseRevision: string;
  proposals: FieldChangeProposal[];
  relationIssues: ImportIssue[];
  missingInfo: MissingInfoItem[];
  canApply: boolean;
};

type TrustedApplyDecision = {
  resolutions: Array<{
    proposalId: string;
    action: "accept-unverified" | "accept-and-verify" | "keep-current" | "exclude" | "add-alias";
  }>;
  verificationScope: Array<{ entityType: TrustedEntityType; entityId: string; fieldPath: string }>;
  warningAcknowledged: boolean;
};
```

`accept-and-verify` requires a valid active user/session and a UI action explicitly describing its exact field/entity scope. Bulk “verify all” may be offered only after listing the included count and entities; it cannot include hidden or unresolved blocking records.

### 4.3 Apply and concurrency

- Prepare is pure and performs no Project/Dexie/PostgreSQL write.
- Apply rechecks `baseRevision`, plan ownership, blocking issues, conflict resolution completeness, relationship integrity and Missing Info.
- A stale plan returns typed `TRUSTED_PLAN_STALE`, performs zero writes and asks the user to rebuild preview.
- Apply is one logical transaction at the existing Zustand/repository write seam. No partial entity/trust/source persistence.
- Excluding a device cascades proposed interfaces, physical links, logical relations and masked credential preview rows exactly as the existing import exclusion contract requires, then recalculates validation.
- A verified field can change only through an explicit protected conflict decision. The before/after fingerprints and actor are audit-safe metadata; raw secret/source content is forbidden.

### 4.4 Typed issue codes

Recommended new safe codes:

```text
INTERFACE_OWNER_MISSING
INTERFACE_PARENT_INVALID
INTERFACE_NAME_COLLISION
LINK_INTERFACE_OWNER_MISMATCH
LINK_INTERFACE_REQUIRED_FOR_VERIFICATION
VLAN_REFERENCE_MISSING
SUBNET_REFERENCE_MISSING
AREA_REFERENCE_MISSING
AREA_CYCLE
TRUST_EVIDENCE_MISSING
TRUST_VALUE_STALE
VERIFIED_VALUE_CONFLICT
TEMPLATE_NOT_TRUSTED
TEMPLATE_VERSION_CONFLICT
INFERENCE_REASON_MISSING
TRUSTED_PLAN_STALE
V3_RECORD_TYPE_INVALID
V3_RELATION_INVALID
DOWNCAST_WOULD_LOSE_DATA
```

Issue messages include safe entity ID, field and reason code only. They must not contain raw source lines or sensitive values.

## 5. NTM-D04 — Physical/logical views and hierarchy navigation

### 5.1 Same-data projections

Both views are derived from `ProjectV2`; neither is persisted as a second graph.

| View | Primary records | Edges/relations | Required labels |
|---|---|---|---|
| Physical | device, interface, network area | `LinkV2` with device + interface endpoints | interface names, medium/speed when known, trust badge |
| Logical | device/interface, VLAN, subnet, network area | interface-VLAN, interface-subnet, resiliency | VLAN number/name, CIDR, relation mode/role, trust badge |

Switching views keeps the selected domain entity where it exists, breadcrumb and current engineering area. It must not copy or mutate domain records.

### 5.2 Verified-only closure

Verified-only mode includes a relation only when:

1. the relation's required fields are verified; and
2. all referenced entity identities and required endpoint fields are verified.

If closure removes part of a path, the UI shows a count and safe explanation (“3 筆未核實關係已隱藏”), not an apparently complete path. It must not claim disconnected or healthy.

### 5.3 Navigation and RBAC

```text
authorized Project
  → Region (engineering area)
    → Site (engineering area)
      → Device
        → Interface
          → VLAN / Subnet / Physical link evidence
```

- Authorization filtering happens before projection. The projector cannot request or rehydrate hidden resources.
- Engineering `NetworkArea` is not an authorization grant. A client-provided `authorizationSiteId` is ignored/rejected.
- A cross-area link inside an already-readable Project can be traced in both views.
- A link requiring a topology/site the user cannot read is shown only as a redacted external endpoint if the existing server contract already permits that fact; otherwise it is absent. V1 does not expand RBAC to enable cross-topology traversal.
- Breadcrumbs and “back to source” actions carry stable entity IDs, not names or array indexes.

### 5.4 Inference and accessibility

Unverified/inferred records use at least two independent signals:

- text badge such as `推測` / `未核實`;
- icon or line pattern plus accessible name containing the reason.

Color may supplement these signals but is never the only distinction. Hover-only disclosure is insufficient; keyboard and touch users need the same reason in Inspector/summary.

### 5.5 Folding, dense diagrams, and responsiveness

- Folding is a view operation over area/group/device/interface summaries. Existing persisted `Group.collapsed` remains supported; new view-only temporary expansion does not rewrite it unless the user explicitly saves.
- A folded summary shows hidden device/interface/link counts, inferred/verified counts and cross-boundary connection count. Selecting a cross-boundary relation can expand or breadcrumb to its source without losing stable IDs.
- Detail is progressive: area summary → site devices → selected device interfaces → selected VLAN/subnet relations. Do not render every interface label at overview zoom.
- Search, filter and a list/Inspector fallback are required for dense diagrams; visual canvas is not the sole access path.
- At 360, 768, 1024 and 1280 CSS px and short-height layouts: primary navigation and selected detail remain reachable by keyboard/touch, modal content scrolls vertically, no page-level horizontal overflow, and canvas resize does not alter durable positions/relations.
- Existing physical route no-path remains a view diagnostic. It cannot change the domain link to disconnected.

Recommended scale target pending user confirmation: 3 engineering sites, 60 devices, 180 interfaces, 120 physical links, 12 VLANs and 8 subnets. The target is an acceptance fixture, not a promise of arbitrary scale.

## 6. Compatibility and migration

### 6.1 Read/upcast matrix

| Input | Read action | Trust result |
|---|---|---|
| Legacy Project with no version | Parse with existing strict V1 schema, then upcast in memory | existing values preserved; no blanket verification |
| Legacy link with non-empty `fromPort/toPort` | Create deterministic provisional interface and endpoint ref | `legacy-upcast`, unverified |
| Legacy link without one/both ports | Preserve link/device endpoints; no fake interface | blocking Missing Info for trustworthy endpoint |
| Legacy `Link.vlan` | Preserve exact safe string; optionally propose structured VLAN when explicit parse is unambiguous | unverified proposal |
| ProjectV2 | Strict V2 parse and relation validation | preserve all arrays/order/IDs/trust |
| Future/unknown project version | Fail closed | safe incompatible-version issue |

Reading old data does not write it. The first explicit save/import apply writes V2 after preview and validation.

### 6.2 Storage/API

- Dexie and PostgreSQL currently persist Project JSON. V1 design does not require a SQL column migration; the JSON validator and repository must accept only the approved V2 shape after implementation.
- Dexie schema version need not change solely for nested JSON, unless implementation needs a new index/table; that would require a separate approved migration design.
- APIs return/accept the same Project document after server-side authorization and validation. Client data cannot set verification actor or authorization mapping.
- A backup/export of the pre-upcast Project is required before a batch conversion is committed.

### 6.3 Downcast/rollback

Lossless downcast to old Project is allowed only when all of these hold:

- no independent interface exists beyond a one-to-one legacy `fromPort/toPort` projection;
- no area hierarchy, structured VLAN/subnet, resiliency, evidence or verification state would be lost;
- all LinkV2 additions map exactly to legacy fields.

Otherwise return `DOWNCAST_WOULD_LOSE_DATA`, keep the V2 Project unchanged and provide the pre-upgrade backup. An old application must not silently open and rewrite V2 data. Removing the new fields and calling the result a rollback is forbidden.

## 7. Five-file CSV/ZIP and JSON exchange

### 7.1 Version proposal

- Keep CSV v1 three-file legacy import unchanged.
- Keep strict CSV Bundle v2 five-file import/export unchanged.
- Add **CSV Bundle v3** only after user/PM approval. V3 still contains exactly the same five canonical files; it does not add a sixth member.
- Export a Project with any trusted-network data as v3. A legacy-only Project may be exported as v2 when explicitly selected; it must not drop V2 data silently.
- JSON Project export increments its envelope/project schema and preserves the complete V2 Project.

### 7.2 V3 row grammar

V3 adds an exact `recordType` grammar so independent interfaces and logical records remain spreadsheet-readable without hiding the whole model in one opaque blob.

| File | V3 record types |
|---|---|
| `devices.csv` | `device`, `interface` |
| `links.csv` | `physical-link`, `interface-vlan`, `interface-subnet`, `resiliency` |
| `groups.csv` | `group`, `network-area`, `vlan`, `subnet` |
| `credentials.masked.csv` | existing masked credential row only |
| `missing-info.csv` | existing missing-info row only |

Exact proposed headers:

```text
devices.csv
schemaVersion,sharing,recordType,id,ownerDeviceId,name,type,ip,mac,model,location,url,quantity,x,y,groupId,networkAreaId,interfaceKind,parentInterfaceId,aliasesJson,description,adminLabel,provenanceJson

links.csv
schemaVersion,sharing,recordType,id,from,to,kind,medium,fromInterfaceId,toInterfaceId,fromPort,toPort,vlan,speed,interfaceId,vlanId,subnetId,address,relationMode,relationRole,memberLinkIdsJson,primaryLinkId,name,provenanceJson

groups.csv
schemaVersion,sharing,recordType,id,name,kind,color,collapsed,parentAreaId,groupId,vlanNumber,cidr,areaId,linkedVlanId,provenanceJson

credentials.masked.csv
schemaVersion,sharing,projectDeviceId,deviceName,kind,usernameMasked,secretMasked,keyVersion,lastRotatedAt

missing-info.csv
schemaVersion,sharing,id,severity,entityType,entityId,field,code,question,suggestion,sourceFile,sourceLine,status
```

`provenanceJson` is canonical JSON containing only the row's relevant safe evidence and field-trust records. Object keys and arrays are deterministically sorted; duplicate IDs or unknown keys fail closed. It must not contain raw source content or secrets. Column-specific limit is proposed at 16 KiB; overall 10 MiB/file, 25 MiB/batch and entity row limits remain. If a row exceeds the column limit, export/import fails safely rather than truncating.

`aliasesJson` and `memberLinkIdsJson` are canonical JSON arrays of strings. Formula neutralization still applies to every string cell after canonical serialization.

### 7.3 Manifest and envelope rules

- V3 is selected only by exactly five canonical names, exact V3 headers and `schemaVersion=3` rows. V3 may not fall back to V2 on parse error.
- All non-empty rows share the same `schemaVersion` and `sharing`; header-only members inherit the bundle envelope.
- If all five V3 files are header-only, infer `{schemaVersion:3, sharing:"safe"}` exactly as v2 does. Such a bundle contains no trusted-network records.
- Duplicate canonical filename, path spoof, Unicode/case collision, unknown recordType, invalid union fields, broken reference or mixed version/sharing is blocking.
- Credentials remain preview-only and never populate Project/trustedNetwork.
- Missing Info is recomputed; imported checklist status is not allowed to mark a topology fact verified.

### 7.4 Canonical round-trip

Full equality:

```ts
deepEqual(
  canonicalProjectV2(importV3(exportV3(project, { sharing: "full" })).project),
  canonicalProjectV2(project),
)
```

Safe equality compares against `safeCanonicalProjectV2(project)`. Safe mode removes current management/network-sensitive fields already removed by v2 (`Device.ip/mac/location/url`) plus any relation address or evidence locator/summary classified sensitive by the approved safe policy. It preserves non-sensitive IDs, structure, verification state and safe reason codes. Trust records for removed values are removed with those values.

Order, IDs, coordinates, quantity, collapsed, interface ownership, endpoint references, area hierarchy, VLAN/subnet relations, resiliency, safe evidence and verification state must match canonical values. CSV byte equality is not required. Any format unable to preserve this data must reject export instead of claiming 100% round-trip.

## 8. Missing Info additions

Recommended deterministic rules:

| Condition | Severity |
|---|---|
| wired link missing either interface ID | blocking for verification/trustworthy handoff; legacy Project remains readable |
| interface owner missing or wrong | blocking |
| relation references missing VLAN/subnet/interface | blocking |
| inferred record lacks evidence/reason | blocking |
| verified fingerprint no longer matches current value | blocking |
| network device has no interface inventory | warning unless a verified physical link requires it, then blocking |
| VLAN has no related interface | warning |
| subnet has no VLAN or interface relation | warning/info according to explicit intended scope |
| unverified candidate remains | warning; verified-only view hides it |
| location/area absent | warning for first-stage handoff |

Entity types must be extended explicitly for `interface`, `vlan`, `subnet`, `area` and relation records. IDs remain deterministic from entity/field/code. A Missing Info resolution does not itself verify the underlying fact.

## 9. NTM-D05 — Acceptance design

### 9.1 Fixtures

Two distinct fixture classes are required:

1. **Synthetic regression fixture**: deterministic HQ + two branches, edge cases and known expected truth. It proves automation and does not count as user UAT.
2. **Anonymous real case**: supplied by the user, stripped of customer names, public IPs, credentials, tokens, serials and sensitive configuration. Until supplied, NTM-A09 and real usability/scale claims are `BLOCKED / NOT RUN`, never synthetic PASS.

Recommended anonymous-case minimum, pending user confirmation:

- 1 HQ + 2 branch engineering sites;
- 25–60 devices, 60–180 interfaces, 30–120 physical links;
- at least 4 VLANs, 3 subnets, one cross-site relation, one incomplete endpoint, one trusted template, one source conflict and one primary/backup candidate;
- expected truth sheet listing stable anonymous IDs, endpoint interfaces, VLAN/subnet memberships, verification state and task answers.

### 9.2 NTM-A01–A10 matrix

| ID | Independent task / assertion | Evidence and proposed gate | Owner after approval |
|---|---|---|---|
| NTM-A01 | From a device, locate engineering site, upstream link and both real interfaces | exact IDs and interface names match truth; zero canvas-anchor substitution | QA domain + Browser |
| NTM-A02 | Trace a selected VLAN and subnet to interfaces; explain source/trust | all returned relations/reasons match truth; no inferred item appears verified | QA domain + Browser |
| NTM-A03 | Switch physical/logical view and navigate area→site→device→interface, then trace cross-area link back | same stable IDs before/after; no duplicate graph; hidden RBAC data absent | QA Browser/RBAC |
| NTM-A04 | Import explicit interfaces, exact template and manual generator cases | priority order exact; observed link count never sets interface total | QA parser/template |
| NTM-A05 | Inspect inferred candidates and verified-only view | every inference has text/icon/reason; verified-only closure contains zero unverified relation | QA Browser/accessibility |
| NTM-A06 | Apply an update conflicting with a verified port/VLAN | one concentrated conflict review; no write before decision; keep-current leaves fingerprint unchanged | QA state/repository |
| NTM-A07 | Correct, save, reload, fold, full/safe export and re-import | canonical equality for allowed fields; trust/source/relations preserved; safe removals exact | QA persistence/transfer |
| NTM-A08 | Load legacy Project and CSV v1/v2 with missing/known port strings | lossless legacy values; provisional interfaces only from explicit labels; downcast loss blocks | QA compatibility |
| NTM-A09 | A second engineer performs handoff tasks on anonymous real case | all answers correct with no coaching; proposed task-time targets below | user UAT + QA observer |
| NTM-A10 | Run RBAC, secret, Missing Info and strict bundle regression | no security relaxation; raw secret zero across Project/state/DOM/log/export; all blocking gates hold | QA security/RBAC |

Proposed usability targets, pending confirmation:

- locate device/site/upstream/interfaces: ≤ 90 seconds;
- trace VLAN/subnet membership and state its trust/source: ≤ 120 seconds;
- trace one cross-area path and return to source: ≤ 120 seconds;
- resolve one concentrated verified-value conflict correctly: ≤ 180 seconds;
- zero wrong endpoint, hidden-resource disclosure or mistaken “inferred = verified” answer.

Automated performance target, also pending confirmation: the recommended 60-device/180-interface/120-link fixture projects either view and updates a selected-device detail within 250 ms settled computation on the agreed QA machine; interaction must yield rather than freeze. Existing 60-device routing budget remains separately applicable and is not replaced.

### 9.3 Regression map

- Current Project validation, duplicate IDs, self-link and relation failures.
- Existing five-file v1/v2 import/export, safe/full, formula neutralization, BOM/CRLF and size gates.
- Credentials preview-only and raw secret scanning.
- Group collapse, controlled React Flow nodes/edges, responsive panels and read-only behavior.
- Orthogonal wired routing, wireless dashed/soft curve, no-path and view-only anchor/lane state.
- RBAC site scope, customer/topology visibility and disabled-session fail closed.
- A04/A05/A07 unverified items remain visible as historical gates; this ticket does not erase or reclassify them.

## 10. Proposed downstream ticket order (not created or dispatched)

Names below are reservations proposed to PM only. They carry no authorization until PM creates/approves them.

1. **DEV_NTM_001 / QA_NTM_001 — ProjectV2 core and compatibility**  
   Own: trusted model, upcast, validation, storage/API JSON preservation, deterministic legacy endpoint mapping. Stop before UI/CSV. QA: model and persistence fixtures.
2. **DEV_NTM_002 / QA_NTM_002 — Source, template, generation, inference**  
   Own: safe evidence, trusted template registry, manual numbering, reasoned proposals and new Missing Info rules. QA: priority/conflict/insufficient-source boundaries.
3. **DEV_NTM_003 / QA_NTM_003 — Preview, verification and conflict apply**  
   Own: change plan, protected verified fields, batch confirmation, stale-plan/atomic apply. QA: zero-write cancel/block/stale and concurrent update.
4. **DEV_NTM_004 / QA_NTM_004 — Shared physical/logical projections and navigation**  
   Own: projectors, hierarchy, verified-only closure, badges, responsive dense navigation. QA: Browser, accessibility, RBAC projection and performance.
5. **DEV_NTM_005 / QA_NTM_005 — Five-file v3 exchange and end-to-end handoff**  
   Own: exact v3 headers/record grammar, JSON/full/safe round-trip, v1/v2 preservation, anonymous-case task harness. QA: NTM-A01–A10 consolidated acceptance; real case remains blocked until supplied.

Shared high-conflict files (`topology-types.ts`, validation, transfer, store, page) require one primary writer per phase and hunk ownership. AST/MED/UIX proposed tickets remain separate dependencies; NTM must consume their approved contracts if later approved, not silently start them.

## 11. Decisions still required before development

1. **Exchange version** — approve CSV Bundle v3 with five fixed files and typed `recordType` rows. Recommended: approve; do not mutate strict v2 headers in place.
2. **Acceptance scale** — approve or adjust 60 devices / 180 interfaces / 120 links / 12 VLANs / 8 subnets and the task-time gates in §9. Recommended: use as first measurable ceiling, then recalibrate from anonymous case.
3. **Anonymous real case** — user to provide a sanitized HQ + two branches case and expected truth. Until then NTM-A09 and real usability claim remain blocked.
4. **Cross-RBAC topology** — V1 recommendation is documentation areas inside an already-readable Project only; do not enable cross-topology/site traversal. Any broader shared view needs a later RBAC decision.
5. **Verification actor portability** — recommended full export preserves stable internal actor ID and timestamp only when allowed; safe export replaces actor ID with a non-identifying verifier marker while retaining verification state/time. Confirm privacy expectation before implementation.

## 12. Stop conditions

Stop and return to PM/user if implementation would require any of these:

- adding a sixth CSV member or weakening strict v1/v2/v3 detection;
- dropping trusted-network data while claiming full round-trip;
- changing verified facts without an explicit conflict decision;
- marking parse/template/import confirmation as human verification;
- creating total interface counts from observed links or `Device.quantity`;
- storing raw configuration or secret-bearing provenance;
- treating anchor/dock/route as a domain interface;
- expanding RBAC or loading hidden site data for cross-area navigation;
- using inference as live health, incident, failover or device-operation authority;
- product/schema implementation before this contract is approved;
- claiming anonymous real-case acceptance from synthetic evidence.

