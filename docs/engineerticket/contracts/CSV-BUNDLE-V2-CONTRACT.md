# CSV Bundle v2 Strict Exchange Contract

| Field | Value |
|---|---|
| Contract ID | CSV-BUNDLE-V2-CONTRACT |
| Primary Design Ticket | DSG_IMP_002 |
| Status | WAITING_APPROVAL |
| Created | 2026-08-26 |
| Authority | PM_GOV_004, PM_GOV_001-D22, PM_GOV_001-D23 |
| Scope | CSV Bundle v2 import/export strict exchange protocol, v1 legacy compatibility boundary, preview/apply fail-closed contract |

## 1. Requirement Traceability Gate

| Gate Field | Content |
|---|---|
| User Intent | 使用者要能用 TXT／MD／CSV 匯入拓樸；CSV Bundle v2 必須是固定、安全、可 round-trip 驗證的交換格式。所有資料必須先 Preview，確認後才可寫入。 |
| Historical Sources | `PM_GOV_004.md`, `DSG_IMP_002.md`, `DEV_IMP_001.md`, `DEV_EXP_001.md`, `DEV_SEC_001.md`, `QA_IMP_001.md`, `qa-imp-001-2026-08-25.md`, `tests/qa-imp-001-transfer-contract.test.mjs` |
| Approved Decisions | D22：五檔 CSV、10 MiB／25 MiB gate、full/safe canonical equality、masked credential preview-only。D23：v2 strict exchange protocol，不以寬鬆 parser 或 row guessing 接受不完整 bundle。 |
| Change Type | CORRECT |
| Affected Layers | Browser file adapter, transfer core, Papa Parse, Zod schemas, Missing Info, Import Preview, Zustand apply boundary, CSV/ZIP export, QA browser acceptance |
| Preserved Invariants | Project 不含 credential；Preview 前不寫入；blocking 不可 Apply；v1 相容不得降低 v2 gate；ZIP import 第一階段仍不支援；DEV_IMP_002／DEV_EXP_002／DEV_SEC_002 保持 BLOCKED 直到本設計經 PM 核准。 |
| Conflict Check | `topology-transfer.ts` 繼續是 Project 可寫入 schema 的單一權威；UI 不複製 schema；component 不直接寫 Dexie；export/import 共用同一份 filename/header/envelope 常數。 |
| Regression Map | QA_IMP_001 四個 blocker：缺五檔、duplicate canonical filename、mixed sharing、pre-read size gate，全部須轉為 DEV regression 與 QA retest。 |
| Rollback / No-path | 任一 gate blocking 時回傳 safe issue + `canApply=false`，不得 fallback 到舊寬鬆 parser；Apply handler 再次檢查同一 plan invariants，失敗即零寫入。 |

## 2. Non-goals

- 不支援 ZIP import；看到 `.zip` 直接 blocking。
- 不把 masked credential 寫回 credentials API。
- 不新增 DB migration、package、env 或 runtime policy。
- 不改正式 Customer／Topology RBAC、Pilot Session 或 OIDC。
- 不把 v2 optional member 缺失解讀成「沒有資料」；v2 五檔必須齊全。

## 3. Fixed Pipeline

```text
Browser File metadata
→ File Gate
→ Manifest Gate
→ Envelope / Row Gate
→ Relation / Missing Info Gate
→ Preview
→ Apply
→ Zustand importProject
→ Dexie / PostgreSQL topology persistence
```

### 3.1 Ownership

| Stage | Owner | Input | Output | Must not do |
|---|---|---|---|---|
| Browser File adapter | `app/page.tsx`, `FileDropZone` | `FileList` / drag files | `ImportFileDescriptor[]` with metadata only | 不得先呼叫 `File.text()`；不得決定 v1/v2；不得寫 store |
| File Gate | `topology-transfer.ts` pure core | descriptors without text | accepted descriptors or blocking issues | 不讀內容、不 Papa Parse、不 Zod |
| Manifest Gate | `topology-transfer.ts` pure core | accepted names + optional headers after text read | `BundleManifest` | 不用 `Map` last-wins；不以 row 成功與否猜完整 bundle |
| Envelope / Row Gate | `topology-transfer.ts` + Papa + Zod | canonical files text | typed rows, envelope, issues | 不吞掉 row error；不把 raw row 放進 issue |
| Relation / Missing Info | `validateProjectRelations`, `buildMissingInfo` | Project draft | sanitized Project, missing info, issues | 不建立殘缺 Link；不混淆 schema issue 與 missing info |
| Preview | `app/components/import/*` | `ImportPlan` | 使用者確認、排除、ack | 不寫 Project／Dexie；不顯示 raw secret |
| Apply | `confirmImport`, `materializeImport`, store action | confirmed plan + strategy | persisted sanitized Project | 不只依賴 button disabled；不寫 masked credential |

## 4. File Gate

File Gate 發生在 `File.text()`、Papa Parse、ZIP decode、Zod parse 之前。UI 與核心都必須支援 metadata gate；核心不能只相信 UI。

### 4.1 Limits

| Limit | Value | Applies to | Failure code |
|---|---:|---|---|
| CSV v2 file count | exactly 5 CSV files | CSV bundle v2 | `FILE_COUNT_LIMIT` / `V2_MEMBER_MISSING` |
| CSV v1 file count | exactly 3 CSV files | legacy CSV mode | `FILE_COUNT_LIMIT` |
| TXT／MD document count | exactly 1 | document import | `FILE_COUNT_LIMIT` |
| Single file size | `10 * 1024 * 1024` bytes | every import file | `FILE_SIZE_LIMIT` |
| Batch size | `25 * 1024 * 1024` bytes | whole selected batch | `BATCH_SIZE_LIMIT` |
| ZIP import | 0 files accepted | `.zip` or ZIP signature | `ZIP_IMPORT_UNSUPPORTED` |

Boundary rule: `limit` is allowed; `limit + 1` is blocking. Unknown size is blocking in browser entry because a real `File` always has `size`.

### 4.2 ImportFileDescriptor

```ts
type ImportFileDescriptor = {
  sourceIndex: number;
  originalName: string;       // Browser File.name only; never full path.
  sizeBytes: number;          // Must exist before text read.
  mediaType?: string;         // Advisory only; extension/header remain authoritative.
  lastModified?: number;      // Advisory; never security authority.
  canonicalName?: CanonicalImportName;
  text?: string;              // Absent before File Gate; populated only after metadata passes.
};

type CanonicalImportName =
  | "devices.csv"
  | "links.csv"
  | "groups.csv"
  | "credentials.masked.csv"
  | "missing-info.csv";
```

Trust boundary: `originalName`, `mediaType`, `lastModified` are untrusted user input. Only sanitized `canonicalName` may appear in safe UI evidence.

## 5. Filename Canonicalization and Manifest Gate

### 5.1 Canonicalization

For every selected file:

1. Reject empty names, names containing NUL/control chars, or names longer than 255 chars.
2. Reject path-looking input containing `/`, `\`, drive prefixes like `C:`, URL prefixes, or `..`.
3. Normalize Unicode to NFC.
4. Lowercase with locale-independent ASCII rules.
5. Accept only exact canonical ASCII names listed below.
6. Detect duplicate canonical names after normalization; duplicate is blocking even if file content is identical.

Canonical v2 members:

```text
devices.csv
links.csv
groups.csv
credentials.masked.csv
missing-info.csv
```

No implementation may build the bundle with `new Map(sources.map(...))` unless duplicate detection has already blocked and the code proves no last-wins overwrite can occur.

### 5.2 BundleManifest

```ts
type BundleManifest = {
  sourceKind: "csv-bundle" | "document" | "json";
  csvMode?: "v2-strict" | "v1-legacy";
  files: Array<{
    sourceIndex: number;
    originalName: string;
    canonicalName?: string;
    sizeBytes: number;
    status: "accepted" | "blocked";
    issues: ImportIssue[];
  }>;
  totalSizeBytes: number;
  expectedMembers: string[];
  presentMembers: string[];
  missingMembers: string[];
  duplicateMembers: string[];
  unknownMembers: string[];
  envelope?: BundleEnvelope;
};
```

## 6. v1 / v2 Mode Truth Table

Mode is chosen from manifest and header shape before row Zod success. It is never inferred from “any row parsed successfully”.

| Selected files / headers | Mode | Result |
|---|---|---|
| Exactly five canonical v2 members, each with exact v2 header | `v2-strict` | Continue to Envelope / Row Gate, even if every file is header-only. |
| Any v2-only member present but five members not complete | v2 attempted | Blocking `V2_MEMBER_MISSING`. |
| Any core CSV has `schemaVersion,sharing` v2 header but optional v2 members absent | v2 attempted | Blocking `V2_MEMBER_MISSING`; do not fallback to v1. |
| Exactly three core members `devices.csv`, `links.csv`, `groups.csv` with legacy headers and no v2-only members | `v1-legacy` | Continue through isolated v1 parser. |
| Three core members plus any unknown file | none | Blocking `UNKNOWN_MEMBER`. |
| Three core members with mixed v1/v2 headers | none | Blocking `BUNDLE_VERSION_MIXED`. |
| Five canonical names but one invalid/missing header | none | Blocking `CSV_HEADER_INVALID`. |
| All files empty or without header row | none | Blocking `CSV_HEADER_INVALID`. |
| CSV mixed with TXT/MD/JSON | none | Blocking `MIXED_SOURCE_KIND`. |
| `.zip` or ZIP signature | none | Blocking `ZIP_IMPORT_UNSUPPORTED`. |

### 6.1 Header-only Envelope Rules

CSV rows carry `schemaVersion` and `sharing`; header-only members have no row envelope. v2 still needs a bundle-level envelope:

1. If at least one non-empty v2 row exists, all non-empty rows across all five files must use identical `schemaVersion=2` and identical `sharing`.
2. Header-only members inherit that bundle envelope and record `inferredFrom: "non-empty-bundle-row"`.
3. If all five v2 members are header-only and headers exactly match v2, the bundle envelope is:

```ts
{ schemaVersion: 2, sharing: "safe", inferredFrom: "all-members-header-only" }
```

Reason: no row contains full/safe data, so `safe` is the only safe deterministic default. Preview may show an info issue `EMPTY_V2_BUNDLE`, but this is not blocking by itself.

4. If any row has missing or non-`2` schemaVersion, blocking `BUNDLE_VERSION_MIXED`.
5. If any row has missing, invalid, or mixed sharing, blocking `BUNDLE_SHARING_MIXED`.

```ts
type BundleEnvelope = {
  schemaVersion: 2;
  sharing: "safe" | "full";
  inferredFrom: "row" | "non-empty-bundle-row" | "all-members-header-only";
  evidence: Array<{ sourceFile: CanonicalImportName; row?: number }>;
};
```

## 7. CSV Headers and Row Limits

All CSV files are UTF-8 / UTF-8 BOM friendly. Export uses BOM and CRLF. Import must use Papa Parse with `header=true` and `skipEmptyLines="greedy"` after File Gate passes.

Exact v2 headers:

```text
devices.csv
schemaVersion,sharing,id,name,type,ip,mac,model,location,url,quantity,x,y,groupId

links.csv
schemaVersion,sharing,id,from,to,kind,fromPort,toPort,vlan,speed

groups.csv
schemaVersion,sharing,id,name,kind,color,collapsed

credentials.masked.csv
schemaVersion,sharing,projectDeviceId,deviceName,kind,usernameMasked,secretMasked,keyVersion,lastRotatedAt

missing-info.csv
schemaVersion,sharing,id,severity,entityType,entityId,field,code,question,suggestion,sourceFile,sourceLine,status
```

Header comparison trims BOM only at the first header cell. Header names must match exactly after trim; extra, missing, reordered, duplicate or blank headers are blocking `CSV_HEADER_INVALID`.

Resource limits:

| Limit | Value | Failure |
|---|---:|---|
| devices rows | 5,000 | `ROW_LIMIT` |
| links rows | 20,000 | `ROW_LIMIT` |
| groups rows | 1,000 | `ROW_LIMIT` |
| credentials rows | 5,000 | `ROW_LIMIT` |
| missing-info rows | 25,000 | `ROW_LIMIT` |
| field length | 2,000 UTF-16 code units unless schema is stricter | `CSV_CELL_LIMIT` |
| CSV columns | exact approved header count | `CSV_HEADER_INVALID` |

Empty string is normalized to `undefined` before schema parse, except required string fields where it becomes a schema error.

## 8. Data Contracts

### 8.1 ImportIssue

```ts
type ImportIssueSeverity = "blocking" | "warning" | "info";

type ImportIssueCode =
  | "FILE_COUNT_LIMIT"
  | "FILE_SIZE_LIMIT"
  | "BATCH_SIZE_LIMIT"
  | "MIXED_SOURCE_KIND"
  | "ZIP_IMPORT_UNSUPPORTED"
  | "FILENAME_INVALID"
  | "PATH_SPOOF"
  | "UNKNOWN_MEMBER"
  | "DUPLICATE_CANONICAL_FILENAME"
  | "V2_MEMBER_MISSING"
  | "CSV_HEADER_INVALID"
  | "BUNDLE_VERSION_MIXED"
  | "BUNDLE_SHARING_MIXED"
  | "ROW_LIMIT"
  | "CSV_PARSE_FAILED"
  | "CSV_CELL_LIMIT"
  | "SCHEMA_INVALID"
  | "ID_DUPLICATE"
  | "LINK_ENDPOINT_MISSING"
  | "LINK_SELF_REFERENCE"
  | "GROUP_REFERENCE_MISSING"
  | "MISSING_INFO_BLOCKING"
  | "EMPTY_V2_BUNDLE"
  | "LEGACY_CREDENTIAL_MASKED"
  | "FORMULA_CELL_NEUTRALIZED";

type ImportIssue = {
  severity: ImportIssueSeverity;
  code: ImportIssueCode;
  phase: "file" | "manifest" | "envelope" | "row" | "relation" | "missing-info" | "preview" | "apply";
  message: string;              // Safe, localized UI text.
  sourceFile?: string;          // Canonical basename only.
  sourceRow?: number;           // 1-based data row when safe.
  field?: string;
  blocking: boolean;            // Convenience for canApply.
};
```

Safe issue rules:

- Do not include raw CSV row, raw cell, original full path, parser stack, token, cookie, DSN, credential plaintext, ciphertext, nonce, checksum or SQL.
- `sourceFile` is canonical basename only.
- For row evidence, use `sourceRow` and `field`, not row content.
- Legacy lowercase codes may remain during transition only if mapped into the typed codes before UI and QA assertions.

### 8.2 ImportPlan

```ts
type ImportPlan = {
  pipelineVersion: "csv-bundle-v2-strict";
  sourceKind: "document" | "csv-bundle" | "json";
  csvMode?: "v2-strict" | "v1-legacy";
  sourceNames: string[];              // Sanitized display names, not full paths.
  suggestedName: string;
  manifest?: BundleManifest;
  envelope?: BundleEnvelope;
  project: Project;
  maskedCredentials: MaskedCredentialRow[];
  missingInfo: MissingInfoItem[];
  issues: ImportIssue[];
  summary: {
    devices: number;
    links: number;
    groups: number;
    maskedCredentials: number;
    missingBlocking: number;
    missingWarnings: number;
    missingInfoOnly: number;
  };
  canApply: boolean;
  requiresWarningAcknowledgement: boolean;
  staleAfter?: string;                // Optional implementation detail for UI invalidation.
};
```

`canApply` is true only when:

- there is no blocking issue,
- Missing Info has no open blocking item,
- ProjectSchema and relation validation passed after exclusion/recalculation,
- the plan still matches the current preview state.

## 9. Preview / Apply Fail-closed State Machine

```text
idle
→ metadata_received
→ file_blocked
→ content_reading
→ manifest_blocked
→ row_blocked
→ preview_blocked
→ preview_review
→ acknowledgement_required
→ ready_to_apply
→ applying
→ applied

Any state → cancelled
Any state → failed_safe
```

Rules:

- `file_blocked`, `manifest_blocked`, `row_blocked`, `preview_blocked`: `canApply=false`, Apply disabled.
- `preview_review`: no blocking; only info or no issues; Apply allowed.
- `acknowledgement_required`: unresolved warning exists; Apply disabled until the fixed acknowledgement text is checked.
- Blocking Missing Info can only be resolved by correction or exclusion; acknowledgement can never override it.
- Excluding a device must first show affected link count and masked credential row count, then cascade remove dependent links and masked credentials, then rerun ProjectSchema, relation validation and Missing Info.
- Cancel closes preview and clears transient plan; it never calls `importProject`, Dexie, PostgreSQL or credential APIs.
- Apply handler must repeat fail-closed checks even if the button is disabled in UI:

```ts
if (!plan || !plan.canApply) throw new ImportApplyBlockedError();
if (plan.issues.some((issue) => issue.blocking)) throw new ImportApplyBlockedError();
if (plan.summary.missingBlocking > 0) throw new ImportApplyBlockedError();
if (plan.requiresWarningAcknowledgement && !warningAcknowledged) throw new ImportApplyBlockedError();
```

## 10. Export and Round-trip Equality

### 10.1 Export

- CSV ZIP export contains exactly the five canonical members.
- No directory entries, no paths, no duplicate member names, no extra metadata files.
- Header-only files are emitted when there is no data.
- Safe is default. Full requires the already-approved full-export gates and still never exports plaintext credential.
- CSV formula injection neutralization applies to all string cells that start with `=`, `+`, `-`, `@`, tab or carriage return.

### 10.2 Canonical Project Equality

Full round-trip:

```ts
deepEqual(
  canonicalProject(importCsvBundle(exportCsvBundle(project, { safe: false })).project),
  canonicalProject(project),
);
```

Safe round-trip:

```ts
deepEqual(
  canonicalProject(importCsvBundle(exportCsvBundle(project, { safe: true })).project),
  safeCanonical(project),
);
```

`canonicalProject`:

- parses with `ProjectSchema`;
- normalizes `""` to `undefined`;
- preserves array order, IDs, x/y, quantity, collapsed, groupId and link endpoint references;
- lowercases validated group color;
- strips all credential-like fields.

`safeCanonical` equals `canonicalProject(project)` except device `ip`, `mac`, `location`, and `url` are removed because safe export intentionally omits management/network data.

Masked credentials:

- compared only as safe preview rows: `projectDeviceId`, `deviceName`, `kind`, `usernameMasked`, `secretMasked`, `keyVersion`, `lastRotatedAt`;
- may be remapped during merge for preview continuity;
- are never considered restorable credential secrets.

Missing Info:

- recomputed by the same deterministic completeness engine after import;
- compared by deterministic `id` and safe fields;
- preview-only resolved/accepted state is not persistent unless provided by `missing-info.csv`.

## 11. Secret Boundary

| Surface | Allowed | Forbidden |
|---|---|---|
| `Project`, `Device`, Zustand project | devices/links/groups only | username, password, secret, token, ciphertext, nonce |
| Dexie topology project | sanitized Project only | credential-like fields and masked credential rows |
| PostgreSQL topology JSON | sanitized Project only | credential plaintext/ciphertext/nonce |
| Credentials API | masked read; encrypted write inside credential boundary | writing masked CSV rows back as secrets |
| Import Preview state | masked username and `********`; missing info | raw username/password/secret or ciphertext |
| DOM | safe counts, masked previews, safe issue text | raw secrets, full parser rows, cookies/tokens/DSN |
| Console/log/audit | action/result/correlation id/safe codes | raw upload content, credentials, cookie/token, SQL/DSN |
| JSON export | safe/full Project envelope only | credential fields |
| CSV/ZIP export | five CSV members, masked-only credentials | plaintext credential, ciphertext, nonce, extra files |
| Network topology save | sanitized Project | masked credential rows or raw secret |

Legacy v1 `devices.csv` may contain `username` / `password`; the importer may detect and mask them for preview with `LEGACY_CREDENTIAL_MASKED`, but the raw values must be discarded before Project, DOM, store, persistence, export or audit.

## 12. DEV Handoff Boundaries

These are not authorizations to start. They become actionable only after DSG_IMP_002 is PM-approved and corresponding DEV tickets move out of BLOCKED.

### DEV_IMP_002

Allowed files / hunks:

- `app/lib/topology-transfer.ts`: file descriptor types, metadata gate, canonical filename/manifest gate, v1/v2 truth table, envelope/row gate, typed issues, `buildImportPlan` compatibility wrapper.
- `app/page.tsx`: `prepareImport` metadata-first read flow, file input accept text, Apply handler fail-closed hunk only.
- `app/components/import/*`: preview text/state display for blocking, warning ack and exclusion counts only.
- `tests/*transfer*`, QA regression tests copied/adapted as DEV tests.

Must not own:

- ZIP export canonicalization beyond import validation shared constants.
- credential persistence hardening beyond not writing masked rows during import.
- package/env/db/migration changes.

### DEV_EXP_002

Allowed files / hunks:

- `app/lib/topology-transfer.ts`: shared CSV headers, `projectToCsvFiles`, `projectToCsvBundleZip`, canonical project/safeCanonical helpers.
- `app/page.tsx`: export UI copy and full/safe gate hunk only.
- transfer/export-focused tests.

Must not own:

- Browser import apply state beyond shared contract tests.
- credential storage/API changes.

### DEV_SEC_002

Allowed files / hunks:

- `app/lib/topology-validation.ts`, `app/lib/topology-transfer.ts`, `app/lib/topology-store.ts`: defense-in-depth strip/validate at apply/export boundaries.
- `app/page.tsx` and import components only for DOM-safe rendering of masked preview and safe errors.
- security-focused tests for Project/Zustand/Dexie/PostgreSQL topology payload/network/audit/JSON/CSV/ZIP sentinel scan.

Must not own:

- QA-only Browser acceptance evidence.
- RBAC/session/runtime policy.

## 13. QA Matrix

| Layer | Positive | Negative / Boundary | Evidence |
|---|---|---|---|
| File Gate unit | 5 valid v2 files at 10 MiB boundary; 3 valid v1 files; 1 TXT/MD | 10 MiB + 1, 25 MiB + 1, mixed source, ZIP, zero file, six CSV | direct function tests proving no text read callback called |
| Manifest unit | exact five v2 canonical members | missing optional member, unknown filename, path spoof, case/Unicode duplicate, last-wins attempt | issue codes and `canApply=false` |
| Mode unit | all five header-only v2 => safe v2 envelope | empty files, mixed v1/v2 headers, v2 core without optional files | truth table tests |
| Envelope / Row | all rows schemaVersion=2 sharing=safe/full | mixed version, mixed sharing, invalid header, row/cell limit | typed issues, no raw row leakage |
| Relation / Missing Info | valid Project + warning-only import | duplicate IDs, broken link, self-link, blocking missing info | no Project write before Apply |
| Preview | warning acknowledgement, exclusion cascade revalidates | blocking ack bypass, duplicate controls, Cancel | Browser evidence |
| Apply | new/merge/replace with remap | stale plan, blocked plan, warning unacknowledged | store/Dexie/PostgreSQL snapshots |
| Export | five exact ZIP members; header-only optional files | extra member, duplicate member, unsafe full gate, formula cells | unzip + canonical equality |
| Round-trip | full canonical equality; safe safeCanonical equality | byte equality not required; lost x/y/quantity/collapsed/groupId fails | deepEqual fixture |
| Secret | masked preview only | plaintext/ciphertext/nonce in state/DOM/network/audit/CSV/ZIP | sentinel scan |

QA_IMP_001 re-test cannot start until DEV_IMP_002, DEV_EXP_002 and DEV_SEC_002 are all READY_FOR_QA.

## 14. Minimal PM Decisions Remaining

No product decision is blocking this design. The only recommendation that should remain visible for PM review is:

- Approve the all-header-only v2 bundle rule: treat exact five header-only v2 files as an empty v2 safe bundle with info issue `EMPTY_V2_BUNDLE`.

If PM rejects that rule, the fallback is to make all-header-only v2 blocking with `EMPTY_V2_BUNDLE`; this would be stricter but less friendly for templates.
