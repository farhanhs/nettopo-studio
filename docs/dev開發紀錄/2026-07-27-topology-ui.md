# Development Log - Topology UI - 2026-07-27

## Scope

This log records the topology UI work completed for the local testing pass on 2026-07-27.

## Ability Setup

- Added Codex ability metadata for topology UI work under `.codex/abilities/`.
- Target packages:
  - `@xyflow/react`
  - `elkjs`
  - `react-resizable-panels`

## Dependency Notes

- `package.json` now declares the three target topology dependencies.
- The local Windows environment did not expose `npm`, `npx`, or `corepack` on PATH.
- The bundled runtime was used for local dependency resolution.
- `package-lock.json` should be regenerated later in a normal npm environment so npm metadata fully matches `package.json`.

## Topology Panel Rewrite

- Replaced the middle canvas with a React Flow topology surface.
- Added topology nodes generated from project devices.
- Added React Flow background, controls, minimap, panning, zooming, and fit-view support.
- Added an ELK auto-layout action to produce cleaner left-to-right topology placement.
- Added a custom SVG link overlay because the React Flow edge layer did not render reliably in the current local environment.
- Added clickable device and link selection.
- Added right-side inspector editing for existing devices and links.

## Link Logic

- Added wired link validation for occupied device interfaces.
- Added bidirectional duplicate endpoint detection.
- Invalid physical links now return a user-facing warning instead of being added to the project.

## Orthogonal Link Routing

- Replaced the custom SVG overlay's diagonal `<line>` rendering with orthogonal SVG `<path>` rendering.
- Link routes now use Manhattan-style horizontal and vertical segments instead of slanted direct lines.
- React Flow's built-in edge rendering is disabled for now so each logical link is drawn only once.
- Added route obstacle checks against device rectangles.
- The router first tries a simple middle-lane orthogonal path.
- If that path intersects other devices, it chooses an outer routing lane above, below, left, or right of the visible topology.
- Link labels now render as SVG label groups with a light background rectangle.
- Label placement is based on the longest route segment so labels are less likely to overlap devices, device text, or short bend segments.

## Architecture Assessment - Classical Topologies

- Three-tier and spine-leaf topology layout were evaluated but not implemented in this pass.
- Recommended next architecture is to split auto-layout into layout strategies:
  - `auto`
  - `three-tier`
  - `spine-leaf`
- Suggested strategy contract:
  - `detect(project)` scores how well a project matches the topology style.
  - `layout(project)` returns a repositioned `Project`.
- Three-tier detection should classify devices into WAN/modem, edge firewall/router, core, distribution, access, and endpoint/server layers.
- Spine-leaf detection should identify switch-heavy fabrics where spine switches connect to multiple leaf switches and leaf switches connect to endpoints.
- Recommended UI addition: a layout mode selector with automatic detection plus manual strategy choices.
- Implementation is intentionally deferred until the user confirms the strategy direction.

## Layout Strategy Implementation

- Added a first-pass layout mode selector to the top toolbar:
  - Automatic detection
  - Three-tier
  - Spine-Leaf
  - General layered
- Added graph scoring helpers that count:
  - total links per device
  - switch-to-switch links per device
  - endpoint-facing links per device
- Added three-tier classification:
  - WAN/source: modem or devices named like WAN, Internet, ISP, telecom modem.
  - Edge: firewall and router.
  - Core/backbone: switch devices named like core/backbone, or the highest-degree switches when no name hint exists.
  - Distribution: switches named like distribution/aggregation, or switches with several links.
  - Access: remaining switches and wireless APs.
  - Endpoints: server, NAS, ERP, and client devices.
- Added spine-leaf classification:
  - Spine: switches named like spine/core/backbone, or switches with multiple switch-to-switch links and no endpoint-facing links.
  - Leaf: switches named like leaf/access/ToR, or switches connected to endpoints.
  - Endpoints are placed below leaves.
- Automatic detection now prefers Spine-Leaf when the switch fabric score is high enough, otherwise it uses Three-tier when the project has modem/router-firewall/switch shape, and falls back to ELK layered layout.

## Customer Template Smoke Test - Xinghengyi

- Used the local customer equipment note as a functional test template.
- Created private, git-ignored test artifacts under `private/`:
  - `xinghengyi-topology.local.json`
  - `xinghengyi-credentials.masked.json`
  - `xinghengyi-app-test-result.json`
  - `xinghengyi-app-screen.png`
  - `xinghengyi-app-print.pdf`
- Mapped the source document into 16 topology devices, 15 links, and 4 containers.
- Existing app types were sufficient for a smoke test, but not semantically complete:
  - Printer currently maps to `client`.
  - Camera locations currently map to `client`.
  - SSIDs currently map to `access-point`.
- Verified through the real app running on Next dev:
  - 16 rendered topology nodes.
  - 15 rendered topology links.
  - React Flow controls visible.
  - Minimap visible.
  - Zoom in/out changed the React Flow viewport transform.
  - All rendered link paths remained orthogonal.
- Printed the loaded topology to PDF through the browser print API.
- Adjusted print canvas height from `740px` to `700px` so the app PDF fits on one A4 landscape page.
- Credential output is masked only; plaintext source secrets were not copied into project files.

## Document-To-Topology Skill

- Added a project-local Codex skill at `.codex/skills/document-to-topology/`.
- The skill defines the workflow for converting customer equipment notes, screenshots, and handover documents into NetTopo Studio topology data.
- The workflow covers:
  - source encoding checks
  - device/link/SSID extraction
  - uncertainty tracking
  - credential masking
  - private artifact generation
  - topology completeness checks
  - PDF and zoom verification
- Added reusable equipment information templates:
  - `.codex/skills/document-to-topology/references/equipment-info-template.md`
  - `docs/templates/equipment-info-template.md`
- Compared the generated Xinghengyi topology against the provided reference architecture image.
- Conclusion: the generated topology is a reasonable first pass from the TXT source, but incomplete compared with the reference image because the TXT lacks AiMesh nodes, LAN1/LAN2 physical links, POS, Chunghwa whole-home Wi-Fi, `v sense lounge wifi`, endpoint counts, and camera-to-SSID mapping.

## Resizable Workspace

- Added `react-resizable-panels` for left device/list panel, center topology canvas, and right inspector.
- Added panel layout persistence through localStorage.
- Added validation for saved layout values.
- Invalid saved layouts are removed and replaced with a stable default layout.
- Current default panel layout:
  - Left sidebar: `24%`
  - Center canvas: `52%`
  - Right inspector: `24%`
- Current side panel limits:
  - Sidebar: `16%` to `32%`
  - Canvas: minimum `38%`
  - Inspector: `14%` to `34%`

## User Feedback Addressed

- Canvas controls were replaced with React Flow controls.
- Right inspector was made resizable.
- Existing device and link editing was moved into the right inspector.
- Physical interface reuse now triggers validation.
- Bidirectional duplicate physical links now trigger validation.
- Left/right panel sizing instability was addressed by validating stored layouts and improving CSS constraints.

## Verification

- `app/page.tsx` ESLint passed.
- Local dev page returned HTTP `200` at `http://localhost:3000/`.
- `tsc --noEmit` was run and only reported pre-existing Cloudflare Worker type errors:
  - `cloudflare:workers`
  - `Fetcher`
  - `D1Database`
- 2026-07-27 follow-up verification:
  - `npm.cmd exec eslint -- app/page.tsx` passed after orthogonal routing changes.
  - `npm.cmd run dev` started Vite successfully at `http://localhost:5173/`.
  - Local HTTP page verification is currently blocked by an existing Windows runtime issue in the Cloudflare/Vinext worker runner:
    - `_Worker is not a constructor`
  - Browser visual verification could not be completed because the in-app browser blocked `http://localhost:5173/` with `ERR_BLOCKED_BY_CLIENT`.

## Remaining Work

- Regenerate `package-lock.json` with a normal npm installation environment.
- Add automated tests for link validation logic.
- Fix Cloudflare Worker type declarations so the whole project becomes type-clean.
- Add focused tests for orthogonal route generation and device-obstacle avoidance.
- Confirm the layout strategy architecture before implementing three-tier and spine-leaf auto-layout.
