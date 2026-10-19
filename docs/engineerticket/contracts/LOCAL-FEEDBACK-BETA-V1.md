# Local Feedback Beta V1 Contract

| Field | Value |
|---|---|
| Contract ID | LOCAL-FEEDBACK-BETA-V1 |
| Ticket | DSG_BTA_001 |
| Status | APPROVED / READY FOR DEV |
| Revision | R1.1 — PM scope review corrections |
| Authority | PM_BTA_001；2026-10-09 local-feedback-beta plan；使用者核准 Q1–Q12；2026-10-09 PM Beta scope review；2026-10-19 使用者裁定 Group 刪除語意 |
| Source base | original `a9abe637f0ad419aced6d31faf30a127ce5b81e6`; current Beta base `b5c53916cbda6f8bcd2f42f9d9772ef181c1adee`; dirty candidate provenance is recorded separately |
| Target | `v0.1.0-beta.1` local feedback candidate; Release is not authorized |

## 0. User outcome and non-goals

The user downloads a prebuilt ZIP on Windows, supplies a tested Node.js version, runs setup once with network access, and then uses NetTopo Studio in Chrome or Edge at one fixed loopback origin. Daily start, edit, IndexedDB save/reload, backup/restore, JSON/CSV exchange, and stop must work with the external network disconnected.

This contract does not enable company login, PostgreSQL, migration, demo identity/header, Pilot, credentials, HR/DUS, NTM, AIL, CSV v3, monitoring, device control, Docker, auto-update, telemetry, or an internet-facing service. It preserves current topology, five-file CSV v2, RBAC and secret contracts.

The Beta is single-user and single-browser-profile. Data in Chrome and Edge, or in different browser profiles, is separate unless explicitly exported and restored. “Local” does not mean permanent backup or shared storage.

## 1. Module and interface map

The local Beta should be one deep module at the packaging/runtime seam:

```text
producer build
  → createBetaArtifact(source, toolchain)
  → Beta ZIP + manifest + lock + checksums

downloaded ZIP
  → setup.cmd → setupBeta()
  → start.cmd → startBeta()
  → http://127.0.0.1:4317
  → stop.cmd  → stopOwnedBeta()

Browser
  → LocalBeta capability
  → existing IndexedDB/Zustand topology workflow
  → backup/share interfaces
```

Recommended interfaces:

```ts
createBetaArtifact(options): Promise<BetaArtifactResult> // producer only
setupBeta(options): Promise<BetaCommandResult>
startBeta(options): Promise<BetaCommandResult>
stopOwnedBeta(options): Promise<BetaCommandResult>
validateBetaRequest(request, runtime): BetaRequestDecision
```

Implementation details—process discovery, dependency tracing, file hashing, Host/Origin checks and PID ownership—stay behind these interfaces. Tests call the same interfaces used by the `.cmd` wrappers. Backup/restore reuses the existing per-topology Project JSON export plus import Preview/Apply pipeline; V1 adds no backup schema or workspace-replacement API.

## 2. Local profile, identity, Host/Origin, and API deny

### 2.1 Runtime policy

Add an explicit server-only runtime profile and capability:

```ts
type RuntimeProfile = "development" | "test" | "production" | "pilot" | "local-beta";

type RuntimePolicy = {
  profile: RuntimeProfile;
  authMode: "demo" | "oidc" | "disabled" | "pilot";
  storageMode: "indexeddb" | "server";
  capabilities: {
    localBeta: boolean;
    demoAuth: boolean;
    devIdentityOverride: boolean;
    demoSeed: boolean;
    pilotAuth: boolean;
    pilotFullExport: boolean;
  };
};
```

`localBeta=true` iff all are true:

- profile is exactly `local-beta`;
- auth mode is exactly `disabled`;
- storage mode is exactly `indexeddb`;
- bind host is exactly `127.0.0.1`;
- port is exactly `4317`;
- demo, dev identity, seed, Pilot, OIDC and server-storage capabilities are off.

The packaged launcher supplies these fixed values; it does not load `.env`, `.env.local` or repository settings. If the compiled artifact indicates server storage, or any forbidden capability becomes active, startup fails closed with `BTA_PROFILE_INVALID` or `BTA_STORAGE_MODE_INVALID`.

### 2.2 Local entry is not authentication

- `LoginGate` may enter the editor directly only after the same-origin capability response says `localBeta:true`.
- It must show a persistent, non-dismissible label: `本機試用模式｜資料只保存在此瀏覽器設定檔`.
- No session cookie, company account, default password, dev header or role selector is created.
- Local editing authority is a UI/storage capability, not `boss`, Pilot Admin, OIDC, or a server-side RBAC principal.
- Client role/site/owner/header values remain non-authoritative. All protected server routes are unreachable in this profile.
- Credential controls remain unavailable because server storage is off. Plaintext/masked credential contracts are unchanged.

### 2.3 Fixed origin and request gate

Canonical origin:

```text
http://127.0.0.1:4317
```

Rules:

- Listener binds only `127.0.0.1`. `0.0.0.0`, LAN addresses, hostname, `localhost`, IPv6 and user-selected ports are rejected in V1.
- `Host` must equal `127.0.0.1:4317`. A different Host returns `421 BTA_HOST_DENIED` before the app worker.
- Browser requests with `Origin` must match the canonical origin. A mismatched Origin returns `403 BTA_ORIGIN_DENIED`.
- Requests without Origin are not generally trusted. They are allowed only by the exact request-class matrix in §2.4; cross-site Fetch Metadata, non-loopback peers and unlisted routes fail before the worker.
- No CORS headers are emitted. CSP uses `default-src 'self'`; script/style/font/connect are self-only with only the minimum framework exceptions proven by the built artifact. `frame-ancestors 'none'`, `nosniff`, `Referrer-Policy: no-referrer` and no-store on control/error responses are required.

### 2.4 Local route allowlist

The package server applies this exact allowlist before forwarding to the built worker. `Origin=canonical` means exactly `http://127.0.0.1:4317`; `peer=loopback` means the accepted socket peer is IPv4 `127.0.0.1`, not a forwarded header.

| Request class | Method | Origin | Fetch Metadata | Peer | Token | Result |
|---|---|---|---|---|---|---|
| top-level application navigation | GET/HEAD | absent or canonical | `Sec-Fetch-Mode=navigate`; `Sec-Fetch-Site=none` or `same-origin`; `Sec-Fetch-Dest=document` | loopback | none | forward only the canonical application entry/navigation paths |
| packaged static/framework resource | GET/HEAD | absent or canonical | site `same-origin` or `none`; destination must match the allowlisted asset kind (`script`, `style`, `image`, `font`, `empty`) | loopback | none | serve only manifest-listed paths; unknown paths fail |
| framework/RSC GET | GET/HEAD | absent or canonical | site `same-origin` or `none`; mode/destination must match the observed packaged framework request (`cors`/`same-origin`/`navigate`, `empty`/`document`) | loopback | none | forward only approved RSC/framework paths and query shapes recorded by producer tests |
| `/api/runtime-capabilities` | GET | canonical, or absent only when site is `same-origin`/`none` and mode is `cors`/`same-origin` | Browser metadata required and must match the preceding rule | loopback | none | safe booleans including `localBeta`; no env/path/token |
| `/__local_beta/status` from Node start/stop tool | GET | absent | Browser Fetch Metadata must be absent | loopback | exact per-instance control token | safe version, artifact ID, instance ID and ready state only |
| `/__local_beta/shutdown` from Node stop tool | POST | absent | Browser Fetch Metadata must be absent | loopback | exact per-instance control token plus state/process ownership proof | bounded owned shutdown; empty request body |
| every other `/api/*`, `/_dev/*`, migration/health/admin path; any unlisted method/class | any | any | any | any | any | `404 BTA_API_DENIED`, generic body, no worker call |

A browser may omit `Origin` on legitimate same-origin GETs, but must still meet its request-class Fetch Metadata rule. Node control tools legitimately send neither `Origin` nor Browser Fetch Metadata; that exception applies only to the two control paths and still requires loopback, exact Host and the current instance token. `Sec-Fetch-Site=cross-site`, general originless API requests, protected APIs and CORS/preflight requests never pass.

This denies topology server APIs, session/dev/pilot/OIDC routes, credentials, audit, schema health, migrations and seed even if their source is present in the built artifact. The deny list is defense-in-depth; build-time tree-shaking/removal is desirable but not sufficient alone.

The shutdown token is random per process, stored only in the owned runtime state file, never printed, returned to browsers, logged or exported. Browser JavaScript cannot read that file. A failed token check returns generic 404.

## 3. Prebuilt artifact and dependency closure

### 3.1 Artifact layout

Proposed ZIP root:

```text
NetTopo-Studio-0.1.0-beta.1/
  setup.cmd
  start.cmd
  stop.cmd
  QUICKSTART.zh-TW.md
  DATA-AND-BACKUP.zh-TW.md
  KNOWN-ISSUES.md
  FEEDBACK.md
  LICENSE
  THIRD_PARTY_NOTICES.md
  beta-manifest.json
  SHA256SUMS.txt
  runtime/
    package.json
    package-lock.json
    server.mjs
    tools/
      setup.mjs
      start.mjs
      stop.mjs
      run-approved-lifecycle.mjs
    lib/**
    dist/client/**
    dist/server/**
    public/**
  samples/
    synthetic-topology.json
    synthetic-topology-csv-bundle.zip
```

Do not include source checkout metadata, `.git`, `.env*`, logs, databases, QA screenshots/evidence, test secrets, node_modules copied from a developer tree, NTM/AIL/Auth dirty work, or unapproved company material.

### 3.2 Runtime dependency closure

Current source keeps `vinext` in `devDependencies`; therefore the original project `package.json` plus `npm ci --omit=dev` is not accepted evidence.

The producer must:

1. build the Node-target artifact from the recorded base commit plus the allowlisted dirty source candidate, with no DSN and no existing `.env`;
2. trace actual static/dynamic imports reachable from `runtime/server.mjs` and `dist/server`;
3. generate a minimal `runtime/package.json` with only required production dependencies;
4. generate a matching npm lockfile from that manifest;
5. install from the lock into a clean, owned directory;
6. copy only manifest-approved output/runtime files into a fresh isolated staging directory; the artifact must have no dependency on the source checkout, and the producer must never delete or modify the original worktree;
7. run the packaged server and required Browser flow from the extracted artifact;
8. record the closure and hashes in `beta-manifest.json`.

If the built server truly needs `vinext`, it must appear as a pinned runtime dependency in the generated runtime manifest. It may not remain an implicit dev dependency. Prefer the package-owned Node server wrapper around `dist/server/index.js` when that cleanly eliminates the vinext CLI at runtime, but verification—not preference—decides the closure.

No dependency is considered closed merely because build succeeds in the developer worktree. Missing dynamic imports, native binaries, install scripts and optional platform packages must be proven in a clean ZIP setup/start run.

### 3.3 Manifest and hashes

```ts
type BetaManifestV1 = {
  format: "nettopo-local-beta";
  formatVersion: 1;
  appVersion: "0.1.0-beta.1";
  baseCommit: string;
  sourceBranch: "codex/public-beta-0.1";
  sourceCandidate: {
    dirty: boolean;
    manifestSha256: string;
    files: Array<{ path: string; status: "base" | "modified" | "added"; sha256: string }>;
  };
  toolchain: { node: string; npm: string; producer: string; producerSha256: string };
  supportedNode: { major: number; min: string; maxExclusive: string };
  supportedWindows: string[];
  supportedBrowsers: Array<{ name: "Chrome" | "Edge"; minVersion: string }>;
  origin: "http://127.0.0.1:4317";
  storage: "indexeddb";
  runtimeLockSha256: string;
  fileManifestSha256: string;
  files: Array<{ path: string; size: number; sha256: string; mode: "file" }>;
  runtimeDependencies: Array<{ name: string; version: string; integrity?: string }>;
  allowedLifecycleScripts: Array<{ package: string; version: string; lifecycle: string; commandSha256: string }>;
  offlineExternalOrigins: [];
  createdAt: string;
};
```

`baseCommit` is provenance for the clean starting point only. A PRE-COMMIT product candidate is not described as an exact committed tree: every allowed base/modified/added source input and its raw-byte SHA-256 is listed in `sourceCandidate`, while unlisted dirty input is a hard failure. Tool/dependency versions and producer hash are also mandatory. The producer must not create an early commit merely to populate this field.

Paths are relative, NFC-normalized, `/` separated, unique after Windows case-folding, and reject absolute paths, drive prefixes, `..`, symlink/reparse points and reserved device names. Canonical hashing is:

1. validate and normalize every payload path, then sort by unsigned UTF-8 byte order;
2. hash each file's exact bytes with SHA-256;
3. form each record as `path + NUL + decimal-size + NUL + lowercase-sha256 + LF`;
4. hash the UTF-8 concatenation of those records as `fileManifestSha256`;
5. serialize `beta-manifest.json` with stable key order and UTF-8 LF, hash it, and write that hash plus all payload hashes to `SHA256SUMS.txt`.

The inner payload set excludes `beta-manifest.json` and `SHA256SUMS.txt`, avoiding a cycle. `SHA256SUMS.txt` excludes itself but includes the serialized manifest hash. The ZIP's outer SHA-256 is release/QA evidence outside the ZIP. A duplicate, missing, extra or changed member fails closed.

Supported Node/Windows/browser values must come from QA evidence. Until tested, the current `Node >=22.13` statement is only a source requirement, not the final public support matrix.

### 3.4 No-DSN build gate

The producer build must start with `DATABASE_URL`, `MIGRATION_DATABASE_URL`, credential keys and all company/auth env absent. The explicit conjunction `profile=local-beta` + `storage=indexeddb` + every server capability disabled bypasses migration-DSN validation even when the producer runs under CI. This is a narrow DEV_BTA_001 policy branch: production and every other CI/profile combination keep their existing DSN validation unchanged. `local-beta` must make DB validation and server adapters unreachable without inventing a DSN.

If the current build path still requires a DSN, `DEV_BTA_002` is blocked. Forbidden workarounds include placeholder DSNs, starting PostgreSQL, reading `.env`, copying another worktree's build output or telling the downloader to build.

## 4. Setup, start, stop and owned cleanup

### 4.1 Public commands

```text
setup.cmd   → node runtime/tools/setup.mjs
start.cmd   → node runtime/tools/start.mjs
stop.cmd    → node runtime/tools/stop.mjs
```

The exact filenames above are fixed for V1. They work from paths containing spaces and Traditional Chinese without Bash, administrator rights, Docker or global npm packages.

### 4.2 Setup

Setup may use the network only to install the locked runtime dependencies. It:

1. validates Windows architecture and Node/npm versions;
2. validates manifest and packaged-file hashes before install;
3. validates runtime `package.json`/lock coherence;
4. runs `npm ci --omit=dev --ignore-scripts --no-audit --no-fund` only inside `runtime/`;
5. does not run a product build;
6. revalidates installed runtime closure and records only safe status/hash data;
7. leaves IndexedDB/browser data untouched on first or repeated setup.

The default lifecycle allowlist is empty. If the proven runtime closure requires one, producer review must record exact package, version, lifecycle name and command hash in `allowedLifecycleScripts`; `run-approved-lifecycle.mjs` may run only those entries after the script-disabled install. Any unlisted script, command/hash drift, package/version mismatch or lock change is `BTA_DEPENDENCY_LOCK_MISMATCH`. The runner operates only inside the isolated runtime tree and receives no DB/auth/company environment.

Setup does not read project `.env`, create DSNs, install Node, modify machine PATH, install services, open firewall ports, register startup tasks or check for updates.

### 4.3 Start

Start:

- validates setup marker, manifest/lock and required files;
- refuses a changed artifact or runtime dependency tree;
- starts one child Node process with a minimal environment allowlist;
- binds `127.0.0.1:4317` only;
- writes an owned state file after readiness, then prints the canonical URL;
- may open the default browser only after readiness; failure to open a browser does not stop the server;
- performs no npm install, build, update check, external fetch or data upload.

Minimal child environment may include Windows system/temp/user paths required by Node plus fixed Beta values. It must not inherit DB URLs, migration URLs, credential keys, dev/pilot/DUS/OIDC settings or arbitrary `.env` values.

If port 4317 is occupied:

- if status and ownership match the same artifact/instance, return success with `BTA_ALREADY_RUNNING` and the same URL;
- otherwise return `BTA_PORT_IN_USE`, do not choose another port and do not kill the process.

### 4.4 Owned state and stop

Owned runtime state is stored under the extracted package's `runtime/.state/` and contains only:

```ts
type BetaRuntimeState = {
  schemaVersion: 1;
  artifactId: string;
  instanceId: string;
  pid: number;
  processStartedAt: string;
  origin: "http://127.0.0.1:4317";
  shutdownToken: string;
};
```

Stop verifies state schema, artifact, PID/start time, executable/entry path and live status instance ID, then sends the token to the loopback shutdown endpoint. It waits with a bounded timeout and cleans only this state file after confirmed exit.

On any ownership mismatch, stop returns `BTA_OWNERSHIP_MISMATCH` and kills nothing. It never deletes the extracted package, `node_modules`, browser profile, IndexedDB, downloads or backups. Stale state may be removed only after proving no matching live process; ambiguity fails closed.

## 5. Offline resource closure

After successful setup, normal use must work with all non-loopback network blocked:

- entry, navigation, canvas, icons, CSS, JavaScript, WASM and fonts load from the package;
- no Google Fonts/CDN fallback, analytics, telemetry, update check, remote image or provider call;
- import/export/ZIP generation remains browser-local;
- start/stop do not contact npm/GitHub;
- GitHub feedback is a separate manual online action and is not part of offline use.

`next/font/google` source usage is not proof of failure or success. Producer and QA inspect the actual ZIP and new Browser profile. Required fonts must appear in the file manifest and render with external network blocked. An unobserved network channel is NOT RUN, not zero leakage.

## 6. Data persistence, backup, restore, and sharing

### 6.1 Persistence

- Existing Dexie/IndexedDB remains the only Beta application store.
- The fixed origin is part of the storage identity. Changing host/port, browser or profile does not migrate data.
- Stop, setup rerun and package replacement must not clear data.
- Browser “clear site data”, private mode, profile deletion or OS cleanup can remove data; documentation must say so plainly.

### 6.2 Existing per-topology JSON backup and restore

V1 adds no `LocalBackupV1`, workspace envelope, whole-workspace replacement, new persistence transaction or new API. It preserves the existing full Project JSON export and existing import Preview/Apply path:

- One export backs up one topology. Users with multiple topologies must export each topology separately.
- It is not a workspace snapshot and does not promise to restore Customer master records, active selection, UI/panel settings, browser profile data, sessions, audit data or anything not present in that Project export.
- Existing Project validation and credential stripping remain authoritative. Full JSON may contain sensitive network/location fields but never plaintext credentials.
- Restore must enter the existing preview, relation/schema validation and explicit new/merge/replace confirmation path. Cancel, malformed/incompatible input or blocking issues cause zero writes and preserve the current data.
- Existing supported legacy Project JSON upgrades remain supported; unknown/incompatible future formats are rejected through existing typed import issues, not a new Beta backup error family.
- A browser download event proves only that export was requested. User guidance must require the operator to verify that each expected file exists and is non-empty before destructive work; the application must not claim the file is safely stored on disk.

### 6.3 Project exchange / sharing

- Existing Project JSON and five-file CSV Bundle v2 remain unchanged.
- Safe sharing is default and follows `safeCanonical`; intentionally stripped IP/MAC/location/URL cannot be restored.
- Full export requires the existing explicit confirmation and still contains no plaintext credentials.
- CSV missing member, duplicate/case/Unicode collision, mixed sharing/version, size gate, formula injection, Missing Info, Preview/Apply and cancellation rules are unchanged.
- This Beta does not implement NTM or CSV v3.

## 7. License, public content, and feedback

### 7.1 License package

- Project-owned source intended for this Beta uses MIT text with `Copyright (c) 2026 sean.hsieh`.
- MIT does not relicense dependencies, fonts, images, company documents or third-party assets. Their notices and license texts remain in `THIRD_PARTY_NOTICES.md` and, when required, accompanying files.
- Absence of a detected license is a release blocker, not permission to label material MIT.
- The public-content manifest explicitly lists included code/assets/docs/samples and their owner/license status.

### 7.2 Anonymous sample and feedback

- Samples use synthetic or user-sanitized data only: no customer/company names, public IPs, credentials, tokens, serial numbers or raw configurations.
- The package contains a local feedback template. It does not call GitHub APIs or upload automatically.
- Suggested GitHub Issue fields: Beta version, artifact SHA-256 prefix, Windows/Node/browser versions, feature, reproducible steps, expected/actual, severity, backup availability and sanitized screenshot acknowledgement.
- The template warns users not to attach topology exports, credentials, public IPs or company data unless separately sanitized and authorized.
- PM manually triages external Issues into the existing internal Markdown ticket system. Issue creation does not become an internal acceptance decision.

## 8. Typed command and HTTP errors

| Code | Surface | Meaning / behavior |
|---|---|---|
| `BTA_NODE_MISSING` | setup/start | Node not found; show tested download guidance, no install attempt |
| `BTA_NODE_VERSION_UNSUPPORTED` | setup/start | outside tested range; no install/start |
| `BTA_ARTIFACT_INVALID` | setup/start | manifest/file hash/path mismatch; stop |
| `BTA_DEPENDENCY_LOCK_MISMATCH` | setup | manifest/lock/install closure differs; stop |
| `BTA_RUNTIME_NOT_SETUP` | start | setup marker/dependencies absent; point to setup |
| `BTA_PROFILE_INVALID` | build/start | local-beta invariants not met; no listener |
| `BTA_STORAGE_MODE_INVALID` | build/start | server storage compiled/requested; no listener |
| `BTA_PORT_IN_USE` | start | unrelated/unknown owner on 4317; do not kill/switch port |
| `BTA_ALREADY_RUNNING` | start | same owned instance ready; return canonical URL |
| `BTA_NOT_RUNNING` | stop | no owned instance; successful no-op only when no ambiguous state |
| `BTA_OWNERSHIP_MISMATCH` | stop | state/process/status mismatch; kill nothing |
| `BTA_OFFLINE_RESOURCE_MISSING` | QA/runtime | required packaged asset unavailable; affected acceptance fails |
| `BTA_HOST_DENIED` | HTTP 421 | wrong Host; no worker call |
| `BTA_ORIGIN_DENIED` | HTTP 403 | cross-origin request; no worker call |
| `BTA_API_DENIED` | HTTP 404 | route not in local allowlist; generic no-store response |

Command exit convention: `0` success/already-safe state; `2` prerequisite; `3` profile/config; `4` port/ownership conflict; `5` integrity/security; `6` runtime failure. Default output is one safe code plus user guidance. Stack, env values, paths containing usernames, tokens and dependency secrets are not printed; an opt-in local diagnostic log remains secret-scanned and path-redacted.

## 9. BTA-A01–A12 acceptance matrix

All are NOT RUN until independent QA executes against the fixed extracted ZIP. DEV checks are preflight only.

| ID | Fixture / action | Required result and evidence | Primary owner |
|---|---|---|---|
| BTA-A01 | Clean Windows user path (ASCII and Traditional Chinese/space), tested Node, actual ZIP | setup/start without source checkout/env/build; file/artifact/runtime hashes recorded | DEV_BTA_002 → QA |
| BTA-A02 | Node missing/old/new, lock tamper, partial install, repeated setup, port occupied | typed safe errors; data untouched; unknown process not killed; repeat setup idempotent | DEV_BTA_002 → QA |
| BTA-A03 | Chrome and Edge, fresh profiles, localBeta profile | direct local entry, persistent mode banner; protected APIs/header/server/credential/migration denied; non-loopback/wrong Host/Origin fail closed | DEV_BTA_001 → QA |
| BTA-A04 | Anonymous/synthetic topology editing at 360/768/1024/1280 and normal desktop | device/link/group create-edit-delete, layout, panels and applicable UIX flows complete; historical missing UAT remains separately visible | DEV_BTA_001 → QA Browser |
| BTA-A05 | save, close tab, stop, restart, reload; injected failed write | same canonical IndexedDB data; fixed origin; failed edit has no partial write | DEV_BTA_001/003 → QA |
| BTA-A06 | existing JSON full/safe and exact five-file CSV v2 cases | canonical/safeCanonical equality; strict manifest/size/formula rules unchanged | DEV_BTA_003 → QA |
| BTA-A07 | import Preview with masked, Missing Info, cancel, blocking, warning ack and exclusion | counts and decisions match; cancel/block zero write; no raw secret | DEV_BTA_003 → QA Browser |
| BTA-A08 | successful setup, then firewall/DNS deny all non-loopback in new profiles | entry/edit/save/reload/backup/restore/exchange pass; app network log has loopback only; every channel observed or NOT RUN | DEV_BTA_002 → QA |
| BTA-A09 | synthetic unique sentinels across Project/state/Dexie/DOM/network/export/log/package scan | zero prohibited hits in observed sinks; raw secret never supplied to unauthorized sink; unobserved is NOT RUN | all DEV → QA security |
| BTA-A10 | existing per-topology full JSON export, old supported Project JSON, malformed/incompatible input, preview cancel/block and replace apply | supported upgrade restores canonical Project through existing Preview/Apply; cancel/block/failure preserves current data; incompatible format safely rejects; multiple topologies are exported one by one; evidence verifies the downloaded file exists and is non-empty because a browser download event alone is insufficient | DEV_BTA_003 → QA |
| BTA-A11 | start twice, stop, stale/forged state, unrelated 4317 process, forced crash | only owned instance stops; bounded shutdown; state cleanup; no data/package deletion | DEV_BTA_002 → QA |
| BTA-A12 | artifact/source/license/public-content review | version/source/deps/hash traceable; MIT holder exact; third-party notices present; forbidden/private paths and active/retired secrets absent | DEV_BTA_003 → QA/PM |

QA support matrix must name exact Windows build, Node/npm, Chrome and Edge versions. One tested matrix does not imply all Windows/Node/browser versions.

## 10. Handoff ownership

After PM scope check, one primary DEV proceeds in order. This section narrows existing tickets; it does not authorize Git or Release.

### DEV_BTA_001 — local entry/security

Allowed paths/hunks:

- `app/lib/server/runtime-policy.ts` local-beta policy only;
- one local request-gate module under `app/lib/server/`;
- `app/api/runtime-capabilities/route.ts` safe capability projection;
- `app/page.tsx` LoginGate/local banner and server-only UI hiding;
- `app/lib/topology-store.ts` local capability/header suppression and IndexedDB-only guards;
- DEV-owned `tests/dev-bta-001*.mjs`, own ticket/log/register line.

It must not change existing protected API authorization, formal RBAC roles, Project/CSV schema, credentials, DB or migration behavior.

### DEV_BTA_002 — artifact/setup/start/stop/offline

Allowed paths/hunks:

- `scripts/beta/**`, `release/beta/**`, required package/lock scripts only;
- package-owned local server wrapper/control endpoints;
- `app/layout.tsx`, `app/globals.css` and `public/**` only for system-font selection or legally packaged local fonts/assets; no new visual feature;
- DEV-owned `tests/dev-bta-002*.mjs`, own ticket/log/register line;
- ignored owned build/install/extract directories with recorded cleanup.

It must first prove no-DSN build and minimal portable closure. If impossible within scope, stop and return to PM; do not ask users to build.

### DEV_BTA_003 — docs/license/sample/existing backup guidance/feedback

Allowed paths/hunks:

- `README.md` Beta section, `docs/beta/**`, `LICENSE`, `THIRD_PARTY_NOTICES.md`;
- `samples/**` or approved `public/samples/**` synthetic files;
- only the necessary public-content hunks that replace company metadata, personal local placeholders or non-synthetic samples; existing Project JSON/Preview code remains unchanged unless PM records a concrete contract defect;
- `.github/ISSUE_TEMPLATE/beta-feedback.yml` as a repository file only; no GitHub configuration call;
- DEV-owned tests, own ticket/log/register line.

It must not alter topology/CSV canonical semantics or introduce automatic uploads.

### QA_BTA_001

QA may prepare its isolated runners early, but formal acceptance waits for one fixed ZIP/source/tool manifest. QA records actual/expected per BTA-A01–12, browser/network/process cleanup, candidate/tool hashes, FAIL/BLOCKED/NOT RUN history, and release-for-repair. QA does not modify product or weaken assertions.

## 11. Stop conditions

Stop and return to PM/design for new semantics or scope if any of these occurs:

- clean producer build needs a DSN, current env, PostgreSQL, Docker or company service;
- downloader must build, install global tooling or use developer node_modules;
- runtime dependency closure cannot be made deterministic from a lock;
- fixed loopback origin cannot be enforced before worker routing;
- local entry requires enabling Demo/Pilot/dev header or protected server APIs;
- daily use performs a required external request;
- existing per-topology backup/restore would require changing Project/CSV schema or bypassing Preview/Apply;
- package includes secret/company/private/unlicensed material;
- an unknown process would need to be killed or a user's IndexedDB cleared;
- DEV/QA reaches PRE-COMMIT and would need stage/commit/push/tag/Release/merge/deploy.

Ordinary bugs within this contract return through DEV↔QA without another design cycle. Any new profile semantics, package member, supported platform, network behavior, schema, auth/RBAC, external service or license scope returns to PM/DSG.

## 12. R1.1 addendum — Group edit/delete semantics (2026-10-19)

Authority: the user explicitly selected “保留設備與連線，改為未分類”; detailed scope is the final section of root [`2026-10-19-pm-beta-resume.md`](C:/Users/DUS/Desktop/project/nettopo-studio/docs/dev開發紀錄/2026-10-19-pm-beta-resume.md). This addendum records that decided behavior for BTA-A04. It does not reopen the Beta design, add a schema, or delay the already-authorized DEV repair.

### 12.1 Edit existing Group

An edit targets one existing `Group.id` and may change only:

- `name`;
- `kind` (`site | domain | vlan`);
- `color` using the existing `#RRGGBB` validation.

The update preserves the target Group's `id` and current `collapsed` value. It preserves array order and every other Group. It does not rewrite any `Device.groupId`, Device/Link field, coordinate, endpoint or selection merely because a label/kind/color changed. The handler uses the Group from the latest committed Project inside the single Project updater; a missing target is a safe no-op/error notice, never a recreated Group.

### 12.2 Delete Group and keep topology

After explicit confirmation, deleting Group `G` is exactly this single Project transformation:

```ts
{
  ...current,
  groups: current.groups.filter((group) => group.id !== G),
  devices: current.devices.map((device) =>
    device.groupId === G ? { ...device, groupId: undefined } : device
  ),
  links: current.links,
}
```

Required invariants:

1. Only Group `G` is removed.
2. Every member device remains with the same ID, order, type, fields and coordinates; only `groupId === G` becomes `undefined` and is displayed as `未分類`.
3. Every Link remains with the same ID, order, endpoints and fields, including links between former members and other devices.
4. Every other Group and its membership remain unchanged.
5. Empty, non-empty and collapsed Groups use the same rule. `collapsed` is not transferred to devices or another Group.
6. A missing target at updater execution time is a safe no-op/error notice. It must not unclassify devices by a client-only/stale ID.

The confirmation must name the Group using safe UI text, show the affected member-device count, and state: `刪除容器後，設備與連線會保留；此容器內的設備將改為未分類。` The destructive action is distinct from Cancel and keyboard focus remains trapped/restored according to the existing Modal behavior.

### 12.3 Atomicity, failure and read-only denial

- Cancel closes the edit/delete flow without calling `setProject`, changing view overrides, publishing a success notice or writing IndexedDB.
- Confirm invokes exactly one `setProject(current => nextProject)` operation. Group removal and member unclassification are computed in that same updater; separate writes are forbidden.
- The existing local-beta store transaction remains the persistence boundary: it derives from the latest committed record, commits the complete sanitized Project in one Dexie transaction, and publishes Zustand only after commit. This addendum does not authorize a store change.
- On persistence failure, the committed Project, rendered group/device/link data and durable IndexedDB remain unchanged. The UI uses the existing safe write-error path and must not show “edited/deleted successfully.” A modal may close after enqueue, but no success state may be inferred before the committed Project no longer/again contains the target values.
- The edit/delete controls are absent or disabled when `canWriteActiveTopology` is false. Handlers also check `canWriteActiveTopology` before opening confirmation or calling `setProject`; the existing local-beta capability guard remains defense in depth. Read-only attempts perform zero mutation.

### 12.4 Optional pure helper and allowed hunks

DEV may keep the transformation in the narrow `page.tsx` handler or introduce one optional I/O-free module, `app/lib/topology-group-operations.ts`, with an equivalent small interface:

```ts
editTopologyGroup(project, groupId, patch: Pick<Group, "name" | "kind" | "color">): GroupOperationResult
deleteTopologyGroupKeepMembers(project, groupId): GroupOperationResult

type GroupOperationResult =
  | { status: "changed"; project: Project; affectedDevices: number }
  | { status: "not-found"; project: Project; affectedDevices: 0 };
```

The helper validates no identity/authorization and performs no I/O; callers enforce permission and existing form validation. It must not mutate its input, alter schema, persist, import/export, or touch credentials.

Exact product scope remains:

- `app/page.tsx`: Group form, edit/delete handlers, list actions, confirmation and safe status only;
- `app/globals.css`: directly related responsive Group-action layout only;
- optional `app/lib/topology-group-operations.ts`: pure Project transformation only;
- DEV-owned `tests/dev-bta-001*.mjs`, DEV_BTA_001 ticket/log/register line.

No `topology-store.ts`, Project/CSV/JSON schema, API, DB, RBAC, credential, package or QA assertion changes are authorized. A need outside these hunks returns to PM/DSG.

### 12.5 Focused QA oracle

The fixed candidate must independently prove:

- edit changes only name/kind/color and preserves ID/collapsed/membership;
- delete works for empty, non-empty and collapsed Groups and preserves exact device/link/other-Group content except target member `groupId` removal;
- confirmation copy/member count, Cancel zero write, missing-target no-op, injected persistence failure zero partial publish and no false success;
- read-only controls/handlers reject mutation;
- save/reload/export/restore retain the decided result;
- Chrome and Edge at 360/768/1024/1280 CSS px keep actions reachable without overlap or horizontal page overflow.

Affected BTA-A04/A05/A06/A07/A09/A10 evidence is re-run or explicitly justified by candidate/dependency hash. A08 remains independently `BLOCKED`; this addendum does not lower, satisfy or bypass it. All work still stops PRE-COMMIT with no stage/commit/push/Release/deploy.

