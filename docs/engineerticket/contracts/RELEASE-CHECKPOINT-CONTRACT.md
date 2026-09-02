# RELEASE-CHECKPOINT-CONTRACT — Freeze／Recovery／Checkpoint Contract

| Field | Value |
|---|---|
| Contract ID | RELEASE-CHECKPOINT-CONTRACT |
| Primary Design Ticket | DSG_REL_001 |
| Revision | DSG_REL_001-R1 |
| Status | APPROVED |
| Created | 2026-08-30 |
| Authority | PM_REL_001 draft input, DEV_REL_001 emergency pause evidence, QA_REL_001 acceptance intent, PM_GOV_001-D24 APPROVED, DEV_REL_001 recovery artifact secret-boundary stop evidence |
| Scope | Freeze snapshot, sanitized overlay recovery artifacts, path/hunk ownership, checkpoint commit chain, per-commit verification, final tree equivalence |

## 1. Requirement Traceability

| Gate Field | Content |
|---|---|
| User Intent | 在不清空、不覆寫原 dirty workspace 的前提下，把已通過 Internal Pilot 驗收的多票工作整理成可辨識、可回復、可逐 commit 驗證的 checkpoint。 |
| Historical Sources | `DSG_REL_001.md`, `PM_REL_001.md`, `DEV_REL_001.md`, `QA_REL_001.md`, `PM_REL_001-FREEZE-MANIFEST.md`, `DECISION-LOG.md`, `TICKET-REGISTER.md`, latest QA_API/QA_DBM/QA_PIL/QA_UIX/QA_IMP records, `.local/recovery/dev-rel-001/*` read-only drafts, `.local/recovery/dev-rel-001/formal-20260830-1420/secret-scan-report.json` safe summary. |
| Approved Decisions | D02 migration/runtime split, D03/D04/D05/D06/D07 Pilot boundaries, D09/D10 routing, D11/D12 traceability, D13 architecture map, D14 audit strict limit, D15-D19 DB/secret gates, D20-D21 Pilot binding, D22-D23 strict transfer, D24 release/checkpoint contract. |
| Approved Release Decision | D24 is `APPROVED`; this R1 revision updates only recovery artifact format and secret boundary. |
| Change Type | EXTEND：建立 release/checkpoint process；不改產品語意。 |
| Affected Layers | Git history, release workspace, recovery artifacts, path-to-ticket map, hunk staging, test gates, QA release acceptance. |
| Preserved Invariants | 原 workspace 不 reset/checkout/clean/stash；不修改 app/db/scripts/tests/package/env；不改已發布 migration；不把 credential/secret 放入 snapshot、log、audit 或 artifacts；QA 不修改產品碼。 |
| Conflict Check | PM draft is input only. DEV_REL_001 has now cleared formal PATH-MAP `UNMAPPED`; the blocker is that a raw full-index Git patch preserves deleted historical credential syntax from `.env.example`, so raw patches cannot be portable canonical recovery artifacts. Existing HEAD `cbce10b...` is not rewritten. |
| Regression Map | Per-commit targeted tests + final full Node, TypeScript, build, scoped/full lint handling, real DB gates, Browser gates, secret scan and final tree equivalence. |
| Rollback / No-path | Unmapped path, any portable artifact secret hit, unrecoverable overlay snapshot, worktree setup failure, independent commit test failure, or final equivalence mismatch stops DEV_REL_001 and returns to PM. |

## 2. Recommendation Summary

Recommended release architecture:

```text
Original dirty workspace remains read-only for recovery capture
→ Generate frozen inventory + sanitized overlay recovery bundle
→ Restore base HEAD in isolated directory
→ Apply delete manifest + current-files overlay + mode manifest
→ Validate restored tree/content/hash equivalence
→ Create ignored nested checkpoint worktree under .local/worktrees/dev-rel-001-checkpoint
→ Apply approved path/hunk map by commit DAG
→ Verify each incremental clean commit
→ Final frozen-tree equivalence against approved snapshot
→ DEV_REL_001 READY_FOR_QA
→ QA_REL_001 independent recovery/commit/equivalence acceptance
```

Design choice: use an ignored nested Git worktree under `.local/worktrees/` for this local Windows/Codex environment, because it stays inside the writable project root, can reuse the existing dependency cache through ancestor `node_modules`, and keeps all destructive cleanup within an explicitly guarded ignored subtree. Repo-outside sibling worktree remains the safer CI/OPS option when external workspace permission and dependency provisioning are available.

## 3. Impact Matrix

| Area | Impact | Contract |
|---|---|---|
| Original workspace | Read-only source of frozen state | No staging, reset, clean, checkout, stash/pop, branch switch or commit. |
| Git index | Must start and remain empty until DEV_REL approved workflow | Any staged path before DEV_REL start is stop condition. |
| `.local/recovery/dev-rel-001` | PM/DEV emergency draft evidence | Read-only; do not modify/delete; use only as input and compare against regenerated artifacts. |
| `.local/worktrees/dev-rel-001-checkpoint` | Recommended checkpoint worktree location | Created only after approval; must be ignored and path-guarded. |
| tracked modified/deleted paths | Captured by current-files overlay, delete manifest and mode manifest | Every path requires primary ticket and hunk ownership. |
| untracked approved source/evidence | Captured in the same current-files overlay + manifest | Every file requires include/exclude decision and primary ticket. |
| generated/local artifacts | Excluded | `test-results/`, `dist/`, local logs, DB data, env secrets never checkpointed. |
| shared files | Hunk split required | `app/page.tsx`, `topology-transfer.ts`, `topology-store.ts`, `db/topology-postgres.ts`, `package*.json`, `scripts/*` cannot be whole-file staged blindly. |
| QA evidence | Included only if formal evidence | Screenshots/summaries/docs mapped to their QA ticket; temporary browser downloads excluded unless explicitly evidence. |

## 4. Frozen Snapshot Definition

The frozen snapshot is not simply `git status`. It is a typed manifest of the approved tree-to-be-reconstructed.

```ts
type FrozenSnapshot = {
  contractVersion: 2;
  capturedAt: string;
  baseHead: "cbce10bba027d246ef78e92a1e2f01660da55e1f";
  baseBranch: "dustool";
  indexStatus: "empty";
  gitStatusPorcelainV1: string;
  paths: FrozenPathEntry[];
  exclude: FrozenExcludeEntry[];
  releaseMetadataDelta: FrozenPathEntry[];
  sha256: {
    inventory: string;
    currentFilesArchive: string;
    deleteManifest: string;
    modeManifest: string;
    manifest: string;
  };
};

type FrozenPathEntry = {
  gitPath: string;                 // slash-separated Git path, UTF-8/NFC canonical.
  displayPath: string;             // human-readable path.
  status: "M" | "D" | "A" | "R" | "??";
  include: true;
  primaryTicket: string;
  secondaryTickets?: string[];
  hunkMapRequired: boolean;
  fileKind: "text" | "binary" | "symlink" | "directory";
  executableMode?: boolean;
  symlinkTargetHash?: string;
  lineEnding?: "lf" | "crlf" | "mixed" | "binary";
  contentSha256?: string;
  mode?: string;
  notes?: string;
};

type FrozenExcludeEntry = {
  gitPath: string;
  reason:
    | "generated"
    | "local-secret"
    | "local-db"
    | "dependency-cache"
    | "runtime-log"
    | "temporary-download"
    | "recovery-artifact";
};
```

### 4.1 Include Set

Include only:

- source files for approved tickets,
- package/lock changes required by approved tickets,
- migration metadata files but not modified published SQL unless separately approved,
- project-local skill files approved by governance,
- ticket/governance/runbook/design/DEV/QA documentation,
- formal QA screenshots, summaries and evidence artifacts that are intentionally referenced by QA tickets.

### 4.2 Exclude Set

Always exclude:

- `.local/`, except read-only recovery evidence is referenced but not checkpointed;
- `node_modules/`, `.next/`, `dist/`, coverage, browser cache;
- `test-results/` and ad-hoc downloaded ZIPs unless explicitly copied into QA evidence under `docs/dev測試紀錄/screenshots/` and mapped;
- `.env`, `.env.*`, DB data/logs, PID/port files;
- any file containing active password, token, cookie, DSN, credential plaintext, ciphertext or nonce.

## 5. PATH-MAP Contract

`PATH-MAP.csv` is a machine-readable mapping. It must have no `UNMAPPED` entries before any checkpoint commit is created.

Required columns:

```text
status,path,normalizedPath,primaryTicket,secondaryTickets,include,kind,hunkMapRequired,commitGroup,sha256,notes
```

Rules:

1. `path` must be Git path with `/`.
2. `normalizedPath` must be Unicode NFC and must not contain mojibake byte segments such as `346/270/...`.
3. `primaryTicket` must be a real ticket ID or `EXCLUDE`.
4. `include=include` requires a non-empty `primaryTicket` other than `UNMAPPED`.
5. Binary files require hash and explicit QA/evidence ticket ownership.
6. Shared files require `hunkMapRequired=true` and a companion hunk map.
7. `EXCLUDE` entries must include reason.

### 5.1 Current UNMAPPED Classes and Required Resolution

The read-only draft `.local/recovery/dev-rel-001/PATH-MAP.csv` currently contains UNMAPPED entries. They must be resolved as follows before DEV_REL_001 can start:

| Current class | Examples | Required mapping |
|---|---|---|
| Shared product file | `app/lib/topology-store.ts` | Hunk map across `DEV_DOM_001`, `DEV_SEC_001`, `DEV_IMP_002`, `DEV_PIL_001`; stop if hunks cannot be separated. |
| Shared tooling file | `scripts/preview-server.mjs`, `tests/rendered-html.test.mjs` | Hunk map to the ticket that introduced each behavior; likely `DEV_UIX_002`, `DEV_PIL_001`, `DEV_API_001`, `DEV_IMP_002` depending on diff content. |
| Shared helper | `app/lib/server/http-security.ts`, `app/api/health/schema/route.ts` | Map to `DEV_API_001` for safe headers/error helper or `DEV_DBM_001` for schema health; if both, split hunks or create release-map note. |
| Mojibake/byte-expanded Chinese paths | `docs/dev/346/...`, `docs/dev/351/...`, `docs//351/...` | Re-scan paths using Git-native path bytes and PowerShell `-LiteralPath`; map to intended Unicode directories `docs/dev測試紀錄`, `docs/dev開發紀錄`, `docs/開發計畫`. Do not checkpoint mojibake duplicate paths. |
| QA evidence docs/screenshots | `qa-dbm-*`, `qa-pil-*`, `qa-imp-*`, `qa-uix-*` | Map to exact QA ticket: `QA_DBM_001`, `QA_PIL_001/002`, `QA_IMP_001`, `QA_UIX_001`. |
| DEV records | `2026-08-26-dev-imp-002.md`, etc. | Map to exact DEV ticket. |
| Governance active docs | `DSG_ARC_001.md`, `QA_DBM_001.md` | Map to their own ticket, not PM_REL. |
| Seed boundary test | `tests/db-seed-boundary.test.mjs` | Map to `DEV_AUTH_001` if testing demo seed gate; split if migration/runtime assertions are present. |

No `misc`, `release-cleanup`, or broad `PM_REL_001` bucket may absorb unmapped source or evidence.

## 6. Shared-file Hunk Ownership

Each shared file needs a hunk map:

```ts
type HunkMap = {
  file: string;
  baseHead: string;
  hunks: Array<{
    hunkId: string;
    lineRangeBefore?: string;
    lineRangeAfter?: string;
    primaryTicket: string;
    secondaryTickets?: string[];
    summary: string;
    dependencies?: string[];
    stagingMethod: "git-add-patch" | "manual-patch-file" | "copy-from-ticket-patch";
  }>;
};
```

Algorithm:

1. Generate full diff with zero context and normal context.
2. Classify hunks by nearest symbol/function/component and approved ticket scope.
3. Split hunks when a single diff block contains unrelated ticket changes.
4. If a hunk cannot be split without breaking build, attach it to the earliest dependency ticket and document downstream dependency.
5. Stage only selected hunks in the checkpoint worktree.
6. After each commit, verify working tree is clean before applying the next ticket patch.

High-conflict ownership defaults:

| File | Ownership rule |
|---|---|
| `app/page.tsx` | Auth/session display → `DEV_AUTH_001`/`DEV_PIL_001`; import preview/apply → `DEV_IMP_002`; export UI → `DEV_EXP_002`; routing view overlay → `DEV_UIX_002`. |
| `app/lib/topology-transfer.ts` | Import gate → `DEV_IMP_002`; export/ZIP/canonical equality → `DEV_EXP_002`; secret strip/materialize defense → `DEV_SEC_002`. |
| `app/lib/topology-store.ts` | multi-topology state → `DEV_DOM_001`; credential stripping → `DEV_SEC_001/002`; Pilot server dataset → `DEV_PIL_001`; import apply → `DEV_IMP_002`. |
| `db/topology-postgres.ts` | migration/runtime connection split → `DEV_DBM_001`; credential table/API → `DEV_SEC_001`; Pilot/RBAC scope → `DEV_PIL_001`; audit strict read → `DEV_API_001`. |
| `package.json` / `package-lock.json` | Dependency belongs to first commit that requires it: `fflate` → `DEV_EXP_001/002`; Playwright → `DEV_UIX_002` if screenshots require it; script-only changes to owning test/release ticket. |
| migration metadata | generated `db/postgres-schema-version.ts` and loader scripts → `DEV_DBM_001`; published SQL files must not be edited. |

## 7. Recovery Artifact Contract — R1 Sanitized Overlay

DEV_REL_001 must not use a raw full-index Git patch as the portable, canonical recovery artifact. The canonical recovery format is an end-state overlay bundle: it stores only the approved final file contents and explicit deletion/mode metadata. It does not preserve removed lines from historical base content.

Required canonical artifacts:

```text
.local/recovery/dev-rel-001/formal-<timestamp>/
  base-head.txt
  current-files.zip
  delete-manifest.json
  mode-manifest.json
  PATH-MAP.csv
  HUNK-MAP.json
  SHA256SUMS.txt
  frozen-snapshot.json
  secret-scan-report.json
  restore-proof.md
```

`branch.txt`, `git-status-porcelain-v1.txt` and `index-status.txt` may be retained as safe diagnostic metadata when they do not contain secrets, but they are not restore inputs. `tracked-full-index-binary.patch` is not a canonical artifact and must not appear in the portable artifact set.

### 7.1 Overlay Bundle Schema

```ts
type RecoveryOverlayBundle = {
  contractVersion: 2;
  revision: "DSG_REL_001-R1";
  baseHead: "cbce10bba027d246ef78e92a1e2f01660da55e1f";
  members: {
    currentFilesArchive: "current-files.zip";
    deleteManifest: "delete-manifest.json";
    modeManifest: "mode-manifest.json";
    pathMap: "PATH-MAP.csv";
    hunkMap: "HUNK-MAP.json";
    snapshot: "frozen-snapshot.json";
    sha256: "SHA256SUMS.txt";
    secretScan: "secret-scan-report.json";
    restoreProof: "restore-proof.md";
  };
  limits: {
    maxMemberBytes: number;
    maxArchiveBytes: number;
    maxFileCount: number;
  };
};

type CurrentFileEntry = {
  path: string;                    // Git-style relative path, slash-separated, Unicode NFC.
  source: "tracked-current" | "untracked-approved";
  fileKind: "text" | "binary" | "symlink";
  sizeBytes: number;
  sha256: string;
  mode: "100644" | "100755" | "120000";
  lineEnding?: "lf" | "crlf" | "mixed" | "binary";
  primaryTicket: string;
  secondaryTickets?: string[];
};

type DeleteManifest = {
  contractVersion: 2;
  baseHead: string;
  deletes: Array<{
    path: string;
    baseSha256?: string;
    baseMode?: string;
    primaryTicket: string;
    reason: "deleted-in-frozen-state";
  }>;
};

type ModeManifest = {
  contractVersion: 2;
  entries: Array<{
    path: string;
    mode: "100644" | "100755" | "120000";
    fileKind: "text" | "binary" | "symlink";
    executable: boolean;
    symlinkTargetSha256?: string;
  }>;
};
```

### 7.2 Restore Algorithm

Restore is deterministic and must run only in an isolated directory:

```text
verify base-head.txt equals expected HEAD
→ create clean restore destination from base HEAD
→ verify destination is clean and empty of unrelated files
→ read and validate SHA256SUMS
→ validate current-files.zip member list before extraction
→ apply delete-manifest.json with path guards
→ overlay current-files.zip entries
→ apply mode-manifest.json
→ recompute frozen-snapshot.json from restored tree
→ compare content/mode/type/symlink/line-ending/deleted-path equivalence
→ run secret scan against portable artifacts and restored tree
→ write restore-proof.md with safe summaries only
```

Fail closed before extraction or deletion if any path is absolute, contains `..`, contains a drive prefix, targets `.git`, targets `.local`, or escapes the restore root after path normalization.

### 7.3 Path and File Semantics

| Case | R1 rule |
|---|---|
| Rename | Represent as `delete old path` + `overlay new path`. `PATH-MAP.csv` may include a shared `renameGroup`, but restore must not depend on Git rename detection. |
| Delete | Represent only in `delete-manifest.json`; deletion is applied to the clean base tree with exact path guard. |
| Binary file | Store final bytes in `current-files.zip`; compare SHA-256 and mode. Do not create textual diff. |
| File mode | Store in `mode-manifest.json`; executable bit and symlink mode are part of equivalence. |
| Approved untracked files | Store in `current-files.zip` with `source="untracked-approved"` and ticket ownership. |
| Empty directory | Not Git-durable and not part of canonical equivalence. If a directory must exist, add an approved placeholder file with ticket ownership; otherwise omit it. |
| Unicode path | Store path as UTF-8 NFC Git path. Detect and fail on mojibake, case collision and Unicode normalization collision. |
| Symlink/reparse point | Symlink entries require mode `120000` and target hash metadata. Windows reparse points/junctions are rejected unless separately approved; restore must not follow them. |

### 7.4 Raw Patch Policy

Raw Git patch is no longer the canonical recovery format.

Rules:

1. DEV_REL_001 should not produce a raw full-index patch during the normal portable recovery flow.
2. Do not whitelist `.env.example` or deleted lines to pass a portable artifact secret scan.
3. Do not manually redact a Git patch and still claim it is directly applicable or canonical.
4. If a local forensic patch is explicitly requested later by PM/security, it must be:
   - ignored under `.local/`,
   - access-restricted to the local workstation context,
   - non-portable,
   - not zipped,
   - not attached to docs,
   - not QA evidence,
   - not referenced by restore proof,
   - not required to reconstruct the frozen tree.
5. Existing recovery artifacts must not be deleted by design work. They become read-only stop evidence until replaced by an approved sanitized overlay bundle.

### 7.5 Secret Classification and Gate

```ts
type SecretFindingClassification =
  | "active_exact"
  | "usable_dsn"
  | "retired_exact"
  | "approved_placeholder"
  | "credential_syntax";

type SecretScanFinding = {
  artifact: string;
  sourcePath?: string;
  provenanceSide: "current" | "base-deleted" | "metadata" | "restored-tree";
  classification: SecretFindingClassification;
  fingerprintPrefix: string;       // hash prefix only; never secret text.
  proofStatus: "hard_fail" | "allowed_placeholder" | "needs_classification";
  remediation: string;
};
```

Gate behavior:

| Classification | Meaning | Portable artifact result |
|---|---|---|
| `active_exact` | Known active password/token/cookie/key or exact currently usable secret | hard fail |
| `usable_dsn` | Any complete DSN/connection string that could plausibly be used, even if environment is local | hard fail |
| `retired_exact` | Historical credential value known or likely retired | hard fail in portable artifacts; regenerate sanitized overlay |
| `approved_placeholder` | Explicit marker that cannot log in, such as controlled fake value or documented `<REDACTED_...>` marker | pass only if marker format is approved and non-usable |
| `credential_syntax` | Keyword or partial syntax that may or may not be secret | must be parsed/classified; cannot be passed by keyword false-positive alone |

The scan report must never print secret values, raw matching text, full DSN, cookie, token, credential ciphertext, nonce or HTTP headers. It may record artifact name, source path, provenance side, classification, fingerprint/hash prefix, proof status and remediation.

### 7.6 Restore Equivalence Acceptance

Fail closed if any of the following occurs:

- `base-head.txt` does not match the approved base commit.
- Restore destination is dirty, non-empty, outside the allowed scratch root, or resolves through symlink/reparse point.
- Required artifact member is missing, duplicated, oversized, or has a SHA-256 mismatch.
- ZIP member uses absolute path, `..`, drive prefix, path traversal, backslash spoofing, case collision or Unicode normalization collision.
- `delete-manifest.json`, `mode-manifest.json`, `PATH-MAP.csv`, `HUNK-MAP.json` or `frozen-snapshot.json` fails schema validation.
- Any path remains unmapped or has inconsistent ticket ownership between snapshot/map/hunk map.
- Any secret hit is `active_exact`, `usable_dsn`, `retired_exact`, or unclassified `credential_syntax`.
- Restored tree differs from `frozen-snapshot.json` in content, mode, type, symlink target, line ending, deleted path or approved untracked path set.

The original workspace remains read-only. All restore proof, extraction and deletion happen only in the isolated restore directory.

### 7.7 Generator and Verifier Interfaces

R1 expects implementation as small deterministic release utilities, not ad-hoc manual archive editing.

```ts
type GenerateRecoveryOverlayInput = {
  repoRoot: string;
  baseHead: string;
  outputDir: string;
  pathMapPath: string;
  hunkMapPath: string;
  excludeGlobs: string[];
  maxArchiveBytes: number;
  maxMemberBytes: number;
};

type GenerateRecoveryOverlayResult = {
  result: "pass" | "fail";
  artifactDir: string;
  members: string[];
  frozenSnapshotHash?: string;
  errors: Array<{
    code:
      | "UNMAPPED_PATH"
      | "SECRET_HIT"
      | "PATH_COLLISION"
      | "UNSAFE_PATH"
      | "HASH_MISMATCH"
      | "ARTIFACT_TOO_LARGE";
    path?: string;
    safeMessage: string;
  }>;
};

type VerifyRecoveryOverlayInput = {
  artifactDir: string;
  restoreRoot: string;
  expectedBaseHead: string;
};

type VerifyRecoveryOverlayResult = {
  result: "pass" | "fail";
  restoredSnapshotHash?: string;
  equivalenceReportPath?: string;
  errors: Array<{
    code:
      | "BASE_HEAD_MISMATCH"
      | "DIRTY_DESTINATION"
      | "MISSING_MEMBER"
      | "DUPLICATE_MEMBER"
      | "UNSAFE_MEMBER_PATH"
      | "PATH_COLLISION"
      | "HASH_MISMATCH"
      | "SCHEMA_INVALID"
      | "SECRET_HIT"
      | "EQUIVALENCE_MISMATCH";
    path?: string;
    safeMessage: string;
  }>;
};
```

Recommended implementation files for DEV_REL_001:

- `scripts/release/generate-recovery-overlay.mjs`
- `scripts/release/verify-recovery-overlay.mjs`
- `scripts/release/scan-recovery-secrets.mjs`

These scripts belong to release tooling only. They must not import app runtime modules, must not read `.env*`, and must not write outside `.local/recovery/dev-rel-001/formal-<timestamp>` or `.local/restore-proof/dev-rel-001-r1` without explicit path guards.

### 7.8 R1 Stop Evidence Summary

Read-only evidence from `.local/recovery/dev-rel-001/formal-20260830-1420/secret-scan-report.json` shows:

- scan result: fail,
- hard findings: 5,
- safe placeholders: 22,
- informational findings: 93.

The report contents must not be copied into docs if they include secret values. R1 uses only safe metadata counts and the known blocker class: raw full-index patch preserves deleted historical credential syntax from `.env.example`.

## 8. Windows-safe Command Design

This contract does not authorize executing the commands yet. DEV_REL_001 must use these safety rules when approved:

- Resolve absolute paths before any delete/move/extract.
- Destructive cleanup may target only exact paths under:
  - `C:\Users\DUS\Desktop\project\nettopo-studio\.local\worktrees\dev-rel-001-checkpoint`
  - `C:\Users\DUS\Desktop\project\nettopo-studio\.local\restore-proof\dev-rel-001`
- Never delete or move workspace root, `.git`, `docs`, `app`, `db`, `scripts`, `tests`, `node_modules`, or parent directories.
- Prefer `git worktree remove <exact-path>` for checkpoint worktree cleanup; if manual cleanup is needed, use PowerShell `Remove-Item -LiteralPath <verified-path> -Recurse`.
- Do not compose destructive paths through shell string interpolation.
- Do not use `git reset --hard`, `git clean`, `git checkout --`, `stash`, `stash pop` in the original workspace.

## 9. Worktree Strategy Evaluation

| Option | Git safety | Node/dependency resolution | Sandbox permissions | Cleanup | Original workspace pollution | Decision |
|---|---|---|---|---|---|---|
| Ignored nested worktree under `.local/worktrees/dev-rel-001-checkpoint` | Medium: nested Git worktree must be ignored and commands must use exact cwd | Good: can reuse ancestor `node_modules`; no install needed unless lock changes require it | Best for current Codex workspace: inside writable root | Manageable with exact path guard | Low if `.local` remains ignored; risk is operator cwd confusion | Recommended for this local execution |
| Repo-outside sibling worktree | High: clean separation from original repo | Medium/low: needs install, copy, or explicit dependency strategy | Requires write permission outside current root or escalation | Clean if path guarded | Very low | Recommended for CI/OPS or if user grants external workspace |
| Temporary directory under OS temp | Medium/high | Low: no dependency cache unless installed/copied | Usually writable | Auto cleanup possible but easy to lose evidence | Very low | Good for restore proof, not for long-running checkpoint commits |
| Same workspace staging | Low | Good | Good | Hard to keep clean | High | Rejected |

Required guard for nested worktree:

- `.local/` must be ignored.
- `git worktree list --porcelain` must show exactly original + checkpoint worktree after creation.
- All DEV_REL commands that stage/commit must run with `cwd` equal to checkpoint worktree absolute path.
- Original workspace `git diff --cached --name-status` must remain empty.

## 10. Checkpoint Dependency DAG and Commit Chain

Existing base commit is fixed:

```text
cbce10bba027d246ef78e92a1e2f01660da55e1f
```

This commit is not rewritten. The release map must associate it with its governing API hardening work where applicable, but checkpoint commits start after it.

Recommended commit chain:

```text
base cbce10b
→ [PM_GOV_002] docs(governance): establish engineering ticket baseline
→ [PM_GOV_002] chore(tooling): register project-local topology skill
→ [DEV_AUTH_001] feat(auth): gate demo identity and seed
→ [DEV_DBM_001] refactor(db): separate migration and runtime boundaries
→ [OPS_SEC_001] chore(db): harden local postgres bootstrap secrets
→ [DEV_SEC_001] fix(credentials): isolate credential storage boundaries
→ [DEV_API_001] fix(api): auth-first and safe errors
→ [DEV_PIL_001] feat(pilot): add internal pilot session and site scope
→ [DEV_UIX_002] feat(routing): add obstacle-safe orthogonal links
→ [DSG_IMP_002] docs(import): define strict csv bundle contract
→ [DEV_IMP_002] feat(import): enforce strict preview and bundle contract
→ [DEV_EXP_002] feat(export): add canonical safe csv bundle
→ [DEV_SEC_002] fix(security): harden transfer secret boundaries
→ [QA_REL_001] test(release): add acceptance evidence and release map
```

Notes:

- `DEV_API_001` may already be represented partly by base `cbce10b`; do not rewrite it. If the dirty tree still contains API docs/tests related to the same ticket, add a small follow-up checkpoint commit and map base commit in release metadata.
- `DEV_SEC_001` and `DEV_SEC_002` must stay distinct if hunk separation is possible; if one defense-in-depth hunk is inseparable, assign to the earliest required secret-boundary commit and document dependency.
- QA evidence can be committed with the feature ticket it proves only when it is already formal ticket evidence. Final release map and equivalence report belong to `QA_REL_001`/`DEV_REL_001`.

## 11. Per-commit Clean Verification

Each checkpoint commit must be verified from a clean working tree containing only commits up to that point.

| Commit group | Required gate |
|---|---|
| PM_GOV_002 docs/skill | markdown/path sanity, no product code diff unless project-local skill registration, no secrets |
| DEV_AUTH_001 | `runtime-policy`, `request-identity`, demo-gate/login tests, TypeScript, scoped ESLint, build |
| DEV_DBM_001 | migration-boundary tests, schema-check tests, `db:verify`, artifact SQL/fs boundary, TypeScript, build |
| OPS_SEC_001 | local script static secret gate, no active credential in tracked files, no full DSN fallback |
| DEV_SEC_001/002 | credential crypto/validation/security sentinel tests, no Project/DOM/export secrets |
| DEV_API_001 | audit handler tests, auth-order tests, strict limit, safe error/header leakage scan |
| DEV_PIL_001 | pilot session/request/policy/repository tests, real DB pilot scope, browser smoke if dependencies satisfied |
| DEV_UIX_002 | routing/layout/unit tests, Playwright UIX E2E screenshots, performance budget |
| DSG_IMP_002 docs | contract path exists, referenced from ticket/register/map, DEV tickets not prematurely DONE |
| DEV_IMP_002/EXP_002 | strict transfer tests, QA_IMP contract regression, browser preflight where possible |
| QA_REL_001 | full final validation, recovery restore, equivalence, release report |

Global gates for final commit:

- `node --env-file-if-exists=.env.local --env-file-if-exists=.env --test tests\*.test.mjs` expected pass.
- `node node_modules\typescript\bin\tsc --noEmit --pretty false` pass.
- `npm.cmd run build:local` pass.
- scoped ESLint for touched files pass.
- `npm.cmd run lint` pass where bash is available; if Windows bash remains unavailable, record as tooling BLOCKED and require CI/OPS rerun before deployment.
- real PostgreSQL `db:migrate`/`db:verify` and QA_DBM real role gate pass.
- Browser QA gates for Pilot, UIX and Import pass.
- secret scan pass.

R1 recovery gate:

- `tracked-full-index-binary.patch` is absent from the canonical portable artifact set.
- `current-files.zip`, `delete-manifest.json`, `mode-manifest.json`, `PATH-MAP.csv`, `HUNK-MAP.json`, `SHA256SUMS.txt`, `frozen-snapshot.json`, `secret-scan-report.json` and `restore-proof.md` are present and hash-verified.
- Secret scan classifies every hit without printing values; `active_exact`, `usable_dsn`, `retired_exact` and unclassified `credential_syntax` fail.
- Restore proof starts from base HEAD, applies delete manifest + overlay + mode manifest, and proves equivalence without relying on a raw patch.

## 12. Final Tree Equivalence

Final tree equivalence proves the checkpoint commit chain reconstructs the approved frozen tree.

```ts
type TreeEquivalenceReport = {
  baseHead: string;
  checkpointHead: string;
  frozenSnapshotHash: string;
  comparedAt: string;
  result: "pass" | "fail";
  comparedPaths: number;
  mismatches: Array<{
    path: string;
    kind: "missing" | "extra" | "content" | "mode" | "type" | "symlink-target" | "line-ending";
    frozen?: string;
    checkpoint?: string;
    allowed?: boolean;
    reason?: string;
  }>;
  allowlistedDifferences: Array<{
    path: string;
    reason: "release-metadata" | "generated-hash" | "qa-report-timestamp";
  }>;
};
```

Equivalence compares:

- content SHA-256,
- file mode/executable bit,
- file type,
- symlink target hash,
- deleted path presence,
- approved untracked path presence,
- line-ending class for text files.

Allowed differences:

- release metadata generated after freeze, such as final release map, equivalence report, and QA_REL_001 final report;
- deterministic hash/timestamp files that are explicitly listed in `allowlistedDifferences`.

Not allowed:

- extra source/test/package/db files,
- missing screenshots/evidence referenced by QA tickets,
- changed migration SQL,
- changed package lock not tied to dependency owner,
- `.local`, env, logs, test-results, active secrets.

## 13. DEV_REL_001 Allowed and Forbidden Actions

Allowed only after DSG_REL_001-R1 approval:

1. Regenerate inventory, recovery artifacts and path/hunk map.
2. Secret-scan the frozen artifacts.
3. Restore proof under exact `.local/restore-proof/dev-rel-001`.
4. Create checkpoint worktree under exact `.local/worktrees/dev-rel-001-checkpoint`.
5. Apply mapped hunks/files per DAG.
6. Commit with required Ticket ID messages.
7. Run per-commit and final gates.
8. Produce release map and DEV_REL_001 report.
9. Mark DEV_REL_001 no further than `READY_FOR_QA`.

Forbidden:

- staging/committing in the original workspace;
- resetting, cleaning, stashing or branch switching original workspace;
- editing product behavior while splitting commits;
- modifying `.local/recovery/dev-rel-001` draft files;
- hiding unmapped paths by excluding them without reason;
- adding new package, migration, env, product code or tests beyond frozen tree;
- deploying Pilot or marking QA/PM tickets passed.
- generating or using raw full-index Git patch as a portable checkpoint/recovery artifact.
- suppressing portable artifact secret findings by whitelisting `.env.example`, deleted lines or retired credentials.

## 14. QA_REL_001 Independent Acceptance Matrix

| Area | QA check |
|---|---|
| Recovery | Recompute SHA-256, restore in QA scratch path using delete manifest + current-files overlay + mode manifest, prove restored tree equals frozen snapshot. |
| Path map | No `UNMAPPED`; every include path has valid primary ticket; excludes have reason. |
| Hunk map | Shared files have hunk ownership; no broad whole-file staging for high-conflict files. |
| Commit chain | Messages contain Ticket ID; order respects DAG; no pre-freeze commit rewrite. |
| Per-commit build/test | Each incremental commit passes its required targeted gates or records approved tooling blocker. |
| Final full suite | Full Node tests, TypeScript, build, scoped/full lint handling, DB, Browser, import round-trip, routing, pilot and secret gates. |
| Tree equivalence | Content/mode/type/symlink/line-ending match frozen snapshot except allowlisted release metadata. |
| Secret/generated scan | No active secret/DSN/cookie/token/credential/ciphertext/nonce; no `.local`, env, DB log/data, `test-results` or dependency cache. |
| R1 raw patch boundary | No raw full-index patch is used as portable artifact, ZIP member, QA evidence or restore input. |
| QA boundary | QA does not modify products, commits, migration, env or DB roles to pass. |

## 15. Stop Conditions

Stop immediately and return to PM if any of the following occurs:

- D24 remains unapproved when DEV_REL start is requested.
- DSG_REL_001-R1 remains unapproved when DEV_REL restart is requested.
- Git index is not empty before recovery capture.
- Any path remains `UNMAPPED` after path-map resolution.
- Mojibake/duplicate Unicode path cannot be reconciled to one canonical path.
- Active secret, usable DSN, retired credential, cookie, token, credential plaintext, ciphertext, nonce or unclassified credential syntax appears in a portable artifact.
- Restore depends on a raw full-index Git patch.
- Restore proof fails.
- Checkpoint worktree cannot be created safely.
- Any commit cannot independently build/test and no approved tooling blocker applies.
- Published migration SQL differs from approved frozen snapshot.
- Final tree equivalence fails.
- DEV/QA would need to edit product behavior rather than split frozen work.

## 16. PM Draft Disposition

| PM draft item | Disposition |
|---|---|
| Original dirty workspace read-only freeze | Kept. |
| Tracked binary patch + approved untracked archive + SHA-256 manifest | Superseded by R1 sanitized overlay bundle: `current-files.zip`, `delete-manifest.json`, `mode-manifest.json`, `frozen-snapshot.json` and SHA-256 manifest. |
| Independent checkpoint worktree | Kept, but default location changed to ignored nested `.local/worktrees/...` for current sandbox; repo-outside sibling reserved for CI/OPS or explicit permission. |
| PATH-MAP draft | Partially rejected as-is because it contains UNMAPPED and mojibake paths; must be regenerated/corrected. |
| Frozen checkpoint sequence | Kept in principle, amended to include `DEV_API_001` mapping and distinct `DSG_IMP_002` docs checkpoint. |
| QA_REL_001 final equivalence | Kept, expanded to compare content/mode/type/symlink/line-ending and allowlisted release metadata only. |

## 17. R1 Resolved PM/User Confirmation

Already approved:

1. D24 remains approved for the release/checkpoint direction.
2. The default local checkpoint location remains the ignored nested worktree under `.local/worktrees/dev-rel-001-checkpoint`.
3. Repo-outside sibling worktree remains optional for CI/OPS.

R1 approved on 2026-08-31:

1. Replace raw full-index Git patch with the sanitized overlay bundle as the only canonical portable recovery format.
2. Do not generate raw patch in the normal flow; any future forensic raw patch requires separate PM/security approval and remains local-only, ignored, non-portable and non-evidence.

`DEV_REL_001` may restart from this R1 contract. `QA_REL_001` remains `BLOCKED` until DEV produces READY_FOR_QA evidence.

## 18. D27 Buildable Dependency-Closure Addendum — 2026-09-02

The original one-primary-ticket-per-commit recommendation is superseded only where executable evidence proves that it cannot create an independently buildable/testable intermediate tree. Recovery format, secret boundary, frozen content and final equivalence remain unchanged.

Rules:

1. Prefer a single-ticket commit when its required gate can run from the preceding checkpoint.
2. When a ticket's files/tests immediately import or inspect not-yet-applied files owned by another approved ticket, compute the smallest dependency closure that makes the checkpoint executable.
3. A composite commit message and release map must list every included Ticket ID; PATH-MAP/HUNK-MAP ownership remains per path/hunk and is not replaced by a broad composite owner.
4. Before committing, stage only the declared closure and prove no unrelated frozen paths are included.
5. After committing, run the union of all closure targeted gates plus TypeScript/build where the closure introduces an executable application boundary.
6. No product edit may be made in the checkpoint worktree to manufacture a passing intermediate state; only approved frozen content may be applied.
7. Final serial full tests, DB/Browser/security gates and frozen-tree equivalence remain mandatory and may not be deferred to post-push.
8. `QA_REL_001` must verify that each composite is the minimal practical dependency closure and that Ticket traceability remains auditable.

Initial evidence requiring this addendum:

- `DEV_AUTH_001` targeted gate failed in the isolated checkpoint tree because request identity imports Pilot session code, DB seed tests import the later PostgreSQL repository, and source/rendered guards inspect the later workspace shell.
- The failed pre-commit tree was not committed; checkpoint index returned to empty, original workspace index remained empty, and recovery/restore evidence stayed PASS.

## 19. D28 Structural Commit／Executable Integration Addendum — 2026-09-02

Dependency analysis after D27 proved that the smallest executable closure spans AUTH, DBM, PIL, API, SEC, UIX, IMP, EXP and the workspace shell. A single product commit would defeat the approved goal of recognizable Ticket history. Therefore:

1. Product paths continue as Ticket-scoped structural commits following PATH-MAP/HUNK-MAP ownership.
2. Each structural commit must have a clean index after commit, contain only declared Ticket paths/hunks and pass manifest/hash/source-syntax checks plus every targeted test that is executable at that point.
3. A targeted gate unavailable solely because a later approved dependency is absent must be recorded as `DEPENDENCY_NOT_YET_APPLIED`, with the exact dependency edge and future integration gate; it is not recorded as PASS or product failure.
4. No structural commit may edit frozen product content to create a temporary compatibility shim.
5. The first tree containing all approved product structural commits is the executable integration checkpoint. Before any QA handoff it must pass the complete targeted union, serial full tests, TypeScript, build, real DB, Browser UAT, artifact/secret scans and frozen-tree equivalence.
6. QA_REL_001 must inspect structural ownership and independently rerun the executable integration/final gates. Any unavailable gate remaining at final integration is a hard failure.
7. Push remains forbidden until QA_REL_001 is `QA_PASSED`.
