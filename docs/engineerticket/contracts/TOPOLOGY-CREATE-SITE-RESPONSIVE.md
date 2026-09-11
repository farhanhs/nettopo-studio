# TOPOLOGY-CREATE-SITE-RESPONSIVE — 新增拓樸站點欄位與響應式容器契約

| 欄位 | 值 |
|---|---|
| Contract ID | TOPOLOGY-CREATE-SITE-RESPONSIVE |
| Primary Design Ticket | DSG_PIL_002 |
| Downstream DEV Ticket | DEV_PIL_002 |
| QA Ticket | QA_PIL_004 |
| Status | DESIGN_COMPLETE |
| Created | 2026-09-04 |
| Original Workspace Reference | branch `dustool`, HEAD `cbce10bba027d246ef78e92a1e2f01660da55e1f` |
| Checkpoint Reference Observed | branch `codex/dev-rel-001-checkpoint`, HEAD `73c38014c0ef2de8066f220268292730bef02d15` |
| Authority | PM_GOV_001-D03/D04/D05/D11/D12/D13/D25/D29, DSG_PIL_002, DEV_PIL_002, QA_PIL_004, topology-ui skill |

## 1. Requirement Traceability

| Gate Field | Content |
|---|---|
| User Intent | 新增拓樸不應因本機 demo／browser-local 測試資料沒有 site options 而卡死；同時 modal/topbar/panel 在窄視窗、短高度、長文字、200% zoom 下仍可操作。 |
| Historical Sources | `DSG_PIL_002.md`, `DEV_PIL_002.md`, `QA_PIL_004.md`, `QA_PIL_003` UAT context, `DSG_PIL_001`, `app/page.tsx` create topology modal/SiteField/topbar/panel, `app/globals.css` modal/form/workspace rules, `app/lib/topology-store.ts`, `db/topology-postgres.ts`, topology-ui skill. |
| Approved Decisions | Internal Pilot 使用 synthetic data；Pilot Engineer 可建立 synthetic Customer；Temporary Pilot Session；功能 UAT 優先；D29 禁止 commit point 前自動 stage/commit/push/deploy。 |
| Change Type | CORRECT + EXTEND：修正本機新增拓樸空 site list 阻擋；補響應式容器規格。不改 Pilot/production 授權語意。 |
| Affected Layers | Create topology modal, shared SiteField, topbar/project switcher visual containment, modal CSS, Zustand createTopology call boundary, Dexie local persistence, server createTopology payload boundary, QA browser UAT. |
| Preserved Invariants | Credential 不進 Project/Zustand/Dexie/DOM/export；Pilot/server 仍 server-side authoritative；component 不直接寫 Dexie；不新增 DB schema/migration/package；不以 client role/site/header 決定權限；layout/container 狀態不寫入 topology domain。 |
| Conflict Check | `siteId` 在 `TopologyRecord` 型別可 optional，但 `db/topology-postgres.ts` server createTopology 目前要求 target site；因此「未指定」只能是 browser-local/允許未指定模式的 UI 與 payload omission，不得擴張到 Pilot/server。 |
| Regression Map | Empty sites local create, loaded sites create, loading/error handling, server/Pilot site required, no activeTopology site fallback when blank, reload persistence, long site names/error text, narrow modal/topbar/panels, keyboard focus, 200% zoom, no horizontal overflow. |
| Rollback / No-path | 若需放寬 Pilot/server site scope、改 DB schema、加新套件、重設計全站容器、把 fake site ID 存入資料、或讓 loading/error 當空清單，停止回 PM。 |

## 2. Current Evidence and Reference Boundary

Original workspace evidence:

- `app/page.tsx` computes `availableSites = editableSites(currentUser, sites)`.
- `SiteField` currently renders `<select name="siteId" ... required>`.
- `addTopology()` currently calls `createTopology(name, copyCurrent, clean(data.get("siteId")) || activeTopology?.siteId)`.
- `topology-store.ts` local `TopologyRecord` creation does not require `siteId`.
- `topology-store.ts` server path forwards `siteId` to `/api/topology`.
- `db/topology-postgres.ts` server createTopology uses Pilot site for Pilot context and rejects missing `siteId` outside local storage with `siteId is required.`
- Existing modal CSS uses `.modal`, `.form-grid`, `.form-actions`, and topbar/workspace panel rules; no new package is needed.

Checkpoint note:

- PM handoff referenced checkpoint HEAD `87a04d57d8d848b42924f01924286bf4bce46ff9`.
- Read-only observation on 2026-09-04 found checkpoint worktree at `73c38014c0ef2de8066f220268292730bef02d15`.
- DEV/QA must re-check their active worktree HEAD before implementation/validation. This contract defines behavior, not a frozen code diff.

## 3. Mode and Load-State Matrix

Definitions:

- `browser-local`: `NEXT_PUBLIC_TOPOLOGY_STORAGE !== "server"`; durable write is Dexie through Zustand.
- `server-development/test`: server storage outside Pilot/production; backend still authoritative.
- `pilot`: runtime profile `pilot`; Temporary Pilot Session and pilot site scope apply.
- `production/server`: server storage with production semantics; formal OIDC/RBAC may be future, but missing site must fail closed.
- `sitesState`: `loading`, `error`, `loaded-empty`, `loaded-with-options`.

| Mode | sitesState | Site control | Submit allowed? | Payload rule | Message |
|---|---|---|---|---|---|
| browser-local | loading | disabled placeholder | no | no submit | `正在載入站點資料…` |
| browser-local | error | disabled + retry/help | no | no submit | `站點資料載入失敗，請重試；這不是空清單。` |
| browser-local | loaded-empty | readonly/disabled display `未指定` or select with one empty option | yes | omit `siteId`; do not send `""`; do not synthesize ID | `目前沒有站點資料，將建立為未指定站點。` |
| browser-local | loaded-with-options | enabled select | yes | selected `siteId`, or omit only if explicit `未指定` option is shown and allowed | selected site |
| server-development/test | loading | disabled placeholder | no | no submit | loading is not empty |
| server-development/test | error | disabled + retry/help | no | no submit | error is not empty |
| server-development/test | loaded-empty | disabled | no unless a future server-side approved gate explicitly allows unassigned server topology | no submit | `目前帳號沒有可建立拓樸的站點。` |
| server-development/test | loaded-with-options | enabled select | yes | selected valid `siteId` | backend validates |
| pilot | loading | disabled placeholder | no | no submit | loading is not empty |
| pilot | error | disabled + retry/help | no | no submit | error is not empty |
| pilot | loaded-empty | disabled | no | no submit | `目前帳號沒有 Pilot 站點權限，請聯絡 Pilot Admin。` |
| pilot | loaded-with-options | enabled select, scoped to writable Pilot site(s) | yes | selected valid `siteId`; backend may force/validate pilot site | Pilot scope preserved |
| production/server | any non-ready | disabled | no | no submit | fail closed |
| production/server | loaded-empty | disabled | no | no submit | no site permission |
| production/server | loaded-with-options | enabled select | yes | selected valid `siteId` | backend validates |

Rule：loading/error must never be interpreted as an empty list. Only `browser-local + loaded-empty` can create an unspecified topology in this ticket.

## 4. Field Contract

### 4.1 Create Topology Form

| UI Label | Key | Type | Required | Default | Disabled | Validation | Payload / Omission |
|---|---|---|---|---|---|---|---|
| 拓樸名稱 | `name` | string | yes | empty input; submit fallback may use `新拓樸` only if browser form permits blank, but preferred UI requires non-empty | while submit busy | trim; non-empty; existing max length if any remains server-side | send trimmed `name`; do not include secrets |
| 所屬站點 | `siteId` | string \| undefined | conditional | if loaded-with-options: active topology site if still visible, else first editable site; if browser-local loaded-empty: undefined | loading/error/server-empty/pilot-empty | selected ID must exist in available options; empty only allowed in browser-local loaded-empty or explicit local `未指定` option | omit `siteId` when undefined; never send fake ID like `unspecified`; never send empty string |
| 複製目前拓樸作為新版草稿 | `copyCurrent` | boolean | no | true | while submit busy | boolean from checkbox | send boolean to Zustand action only; server receives project snapshot already sanitized |

Important `siteId` invariant:

```text
const selectedSiteId = clean(formData.get("siteId"));
const nextSiteId = selectedSiteId || undefined;
await createTopology(name, copyCurrent, nextSiteId);
```

Do not use:

```text
clean(formData.get("siteId")) || activeTopology?.siteId
```

Reason：if the user intentionally creates an unspecified local topology, or if the SiteField is unavailable, falling back to the old active topology site silently writes the wrong ownership hint.

### 4.2 Shared SiteField Use in Create Customer

`SiteField` is shared by create customer and create topology. DEV may either:

1. extend `SiteField` with explicit props such as `mode`, `sitesState`, `allowUnspecified`, `requiredWhenOptions`, `label`, `helpText`; or
2. create a small wrapper for create topology while preserving create customer behavior.

Create customer must not accidentally broaden Customer mutation rights. Pilot Engineer synthetic customer exception remains governed by existing Pilot policy. If create customer receives no site in server/Pilot, backend behavior remains authoritative.

### 4.3 Site Option Display

Site option labels:

- Use actual `SiteRecord.name`.
- Long names must wrap or truncate with accessible full title/aria text; never force horizontal overflow.
- `未指定` is display text only, not a persisted ID.
- Empty option value must be `""` and converted to `undefined` before calling store actions.

## 5. Zustand / Dexie / Server Persistence Boundary

| Layer | Rule |
|---|---|
| React component | May collect form values and call Zustand action; must not write Dexie directly. |
| Zustand `createTopology` | Receives `siteId?: string`; local mode may persist undefined; server mode sends only selected valid siteId. |
| Dexie local | May store topology without `siteId`; reload must preserve `undefined` and display `未指定站點`. |
| Server API | Must not infer permission from client role/site/header; validates session and site server-side. |
| Pilot repository | Must preserve Pilot site binding and fail closed on missing/unauthorized site. |
| Active selection | Creating an unspecified local topology must not inherit `activeTopology.siteId`; active selection may change to new topology only after successful write. |

Payload omission:

- `undefined` siteId should be omitted from JSON payload by `JSON.stringify`.
- Empty string must be normalized to `undefined` before calling store.
- Fake IDs such as `none`, `unassigned`, `local`, `unspecified`, `site-default` are forbidden.

## 6. Loading / Error / Retry Contract

The UI must distinguish:

| State | Meaning | UI behavior |
|---|---|---|
| `loading` | sites not known yet | disable submit or site-dependent field; show loading copy. |
| `error` | sites failed to load or permissions could not be read | disable submit; show retry/help; do not fall back to unspecified. |
| `loaded-empty` | sites loaded successfully and current mode permits empty interpretation | browser-local may submit as unspecified; server/Pilot cannot. |
| `loaded-with-options` | known choices exist | require valid selection unless explicit local unspecified is permitted. |

Retry may call existing initialize/fetch path. It must not create a site, seed demo data, or change authorization scope.

## 7. Responsive Container Contract

Use existing `app/page.tsx` modal/topbar/panel structure and `app/globals.css`. No new UI package, no all-site layout redesign.

### 7.1 Create Modal

| Container condition | Required behavior |
|---|---|
| ≥ 768px available modal width | Two-column form grid may remain; full-width fields span both columns. |
| < 640px available modal width | Create topology/customer forms become single-column; no horizontal scroll. |
| 360px viewport | Modal width fits `calc(100dvw - 24px)` or equivalent; labels/select/input/buttons fit; long text wraps. |
| Short viewport / 200% zoom | Header remains visible; body scrolls; footer actions remain reachable and not obscured. |
| Long site names/errors | Wrap or truncate safely; no layout blowout; accessible full text remains available. |
| Touch / keyboard | Controls have at least current button height; focus ring visible; tab order follows visual order. |

Recommended minimal CSS direction:

- Keep `.modal-backdrop` fixed and centered.
- Keep `.modal` max width around existing `920px`, but ensure `max-width: calc(100dvw - 24px/32px)`, `max-height: calc(100dvh - 24px/32px)`, `display: flex`, `flex-direction: column`.
- Make modal header sticky or non-shrinking.
- Make form body scrollable if content exceeds height.
- Make `.form-actions.full` sticky to bottom or at least always reachable after scroll with enough padding.
- Add media/container rule for `.form-grid` single column under narrow width.
- Ensure `.form-grid input, select, button` use `min-width: 0`, `max-width: 100%`.

### 7.2 Topbar and Workspace Panels

This ticket does not redesign the whole workspace. Minimal compatibility rules:

- Topbar project switcher controls must not overflow horizontally at 768px and 200% zoom; if needed, allow wrapping to additional rows inside existing topbar responsive block.
- Workspace panels already use `react-resizable-panels`; do not store topology data in panel layout.
- Existing panel layout localStorage remains separate from topology data.
- Narrow side/inspector panels should not force form/modal width; modal should size from viewport/container, not panel min width.
- If viewport is too narrow for the full editor, create modal must remain usable even if canvas/panels require scrolling or reduced layout.

## 8. Accessibility and Keyboard Focus

Minimum acceptance:

- Modal root has dialog semantics (`role="dialog"` or native equivalent) and `aria-modal`.
- Modal title is associated with the dialog.
- Close button has accessible label.
- Initial focus goes to the first meaningful input (`name`) or dialog heading.
- Tab order: name → site → copy checkbox → cancel → submit → close, or another documented logical order.
- Escape/backdrop close behavior must not discard in-progress input without existing app convention; if unchanged, QA records behavior.
- Submit button disabled state must be programmatic and visible, not only color.
- Error/help text must be associated with field where practical.

## 9. DEV_PIL_002 Allowed Scope

Primary allowed files:

- `app/page.tsx`
- `app/globals.css`
- `app/lib/topology-store.ts`
- `tests/pilot-checkpoint.test.mjs` or equivalent DEV-owned regression test if already used for Pilot UI/state
- `docs/engineerticket/active/DEV_PIL_002.md`
- `docs/dev開發紀錄/2026-09-04-dev-pil-002.md`

Allowed hunk ownership:

- create topology modal and shared SiteField behavior,
- addTopology payload normalization,
- local createTopology siteId persistence if needed,
- minimal responsive CSS for existing modal/form/topbar containment,
- DEV-owned tests for local empty-site and server/Pilot no-relax behavior.

Forbidden without PM expansion:

- DB schema or migration changes,
- Pilot/server policy relaxation,
- formal Customer/RBAC redesign,
- new package/dependency,
- broad global CSS reset,
- rewriting React Flow/canvas/panel architecture,
- changing import/export or credential behavior,
- modifying QA-owned acceptance scripts to pass,
- Register edits if PM has asked to avoid cross-group conflict,
- stage/commit/push/deploy before explicit user approval.

## 10. QA_PIL_004 Acceptance Matrix

QA-owned validation should cover:

| Area | Case | Expected |
|---|---|---|
| Local empty sites | browser-local / `availableSites=[]` / loaded | Create topology succeeds; display `未指定站點`; persisted `siteId` is absent/undefined; reload preserves unspecified. |
| Local no fake ID | inspect stored record / payload | No `siteId` value such as `unspecified`, `none`, `local`, previous active site or empty string. |
| Local active-site fallback | active topology has site, new form chooses unspecified | New topology does not inherit active topology site. |
| Local loaded sites | one or more sites | default selected site is active visible site else first editable; submit persists selected site. |
| Loading state | sites loading | submit disabled; not interpreted as empty; user sees loading copy. |
| Error state | sites fetch error | submit disabled/retry/help shown; not interpreted as empty. |
| Server/Pilot empty sites | no authorized site | create disabled or API rejects safely; no unspecified server topology. |
| Pilot with site | authorized Pilot site exists | create works only within Pilot site; backend validation preserved. |
| Long site name | long CJK/English site label | no horizontal overflow; accessible full label available. |
| Long error | long server/loading error | wraps within modal; footer still reachable. |
| 360px viewport | create modal | single column; no horizontal scroll; buttons visible or reachable. |
| 768px viewport | create modal/topbar | controls do not overlap; form usable. |
| 1280px viewport | create modal | two-column layout still good. |
| 200% zoom / short height | create modal | body scrolls; footer actions reachable; focus visible. |
| Keyboard | tab/shift-tab/enter/escape per app convention | focus order logical; disabled submit not focus-trapping. |
| Security boundary | credential/import/export unaffected | no credential, CSV or server-scope regression. |

QA may add QA-owned fixtures/reports/screenshots. QA must not modify product code to pass.

## 11. Stop Conditions

Stop and return to PM if implementation requires:

- making Pilot/server `siteId` optional,
- creating fake site IDs,
- inferring permissions from client-provided role/site/header,
- changing database schema or migrations,
- seeding demo/Pilot site data from this UI fix,
- changing credential/import/export semantics,
- adding a UI dependency package,
- broad workspace responsive redesign,
- committing/staging/pushing/deploying before user approval.
