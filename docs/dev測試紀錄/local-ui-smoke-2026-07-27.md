# Local UI Smoke Test - 2026-07-27

## Test Context

- Project: NetTopo Studio
- Test type: local development UI smoke test
- Local URL: `http://127.0.0.1:5173/`
- Date: 2026-07-27
- Runtime target: local Vite/Vinext dev server

## Setup Notes

- The dev server was started locally and responded with HTTP `200`.
- `vite.config.ts` was adjusted so local dev can start when `.openai/hosting.json` is absent.
- The browser tab was opened through the Codex in-app browser for interactive verification.

## Smoke Test Steps

1. Opened `http://127.0.0.1:5173/`.
2. Confirmed the main app shell rendered.
3. Confirmed the initial sample topology rendered with 4 devices.
4. Selected `FortiGate 90G` from the device list.
5. Confirmed the right inspector updated with the selected device details.
6. Opened the add-device modal.
7. Added a test access point named `Codex 測試 AP`.
8. Confirmed the device list and canvas increased from 4 devices to 5 devices.
9. Deleted `Codex 測試 AP`.
10. Confirmed the device list and canvas returned to 4 devices.
11. Clicked the auto-layout button.
12. Confirmed the auto-layout status changed to `已依設備角色自動整理`.

## Smoke Test Result

- Page load: passed
- Initial topology render: passed
- Device selection: passed
- Inspector update: passed
- Add-device flow: passed
- Delete-device flow: passed
- Auto-layout trigger: passed
- Browser console errors observed during smoke test: none

## Current Known Technical Notes

- `tsc --noEmit` still reports Cloudflare Worker type errors for `cloudflare:workers`, `Fetcher`, and `D1Database`.
- The local UI can run despite those type errors, but the type setup should be fixed before treating the project as fully build-clean.
- The environment did not expose `npm`, `npx`, or `corepack` on PATH. The target packages were resolved through the bundled Node/pnpm runtime, but `package-lock.json` should still be regenerated in a normal npm environment before release.

## User Test Feedback

1. The canvas scale controls do not work.
   - The zoom-out, zoom-in, and fullscreen buttons are currently visible UI only.
   - Expected behavior: zoom buttons should adjust the canvas scale, and fullscreen should expand the topology workspace.

2. The right information panel cannot be resized smaller, which affects the canvas area.
   - Expected behavior: the right inspector should be resizable or collapsible.
   - Suggested implementation direction: use `react-resizable-panels` for the left device list, center canvas, and right inspector.

3. Existing devices and links cannot be clicked and edited.
   - Expected behavior: clicking an existing device or link should open/edit its details in the right information panel.
   - Preferred UX: edit forms should live in the right inspector instead of only modal-based creation.

4. The system allows two devices to connect to the same node interface, which is physically invalid.
   - Expected behavior: when creating a physical wired link, the system should warn or block if the selected endpoint interface is already occupied.
   - Example invalid case: two different links using the same device and same port/interface.

5. Links should be treated as bidirectional endpoint pairs.
   - Expected behavior: the app should prevent duplicate physical links where the same two devices are connected through the same endpoint interfaces, regardless of link direction.
   - Example duplicate cases that should be considered equivalent:
     - `A:Port1 -> B:Port2`
     - `B:Port2 -> A:Port1`

6. After the first implementation pass, the left device list/add panel and right device information panel layout became visually incorrect.
   - Observed behavior: the panel boundaries could not be adjusted as expected, and the left/right columns appeared too narrow or unstable.
   - Expected behavior: the left device list and right inspector should keep usable default widths, stay resizable, and never push the center topology canvas out of view.
   - Follow-up implementation direction: validate stored panel layout values, discard invalid saved widths, and make resize handles easier to grab.

## Follow-Up Implementation Tasks

1. Implement canvas zoom state and wire it to the toolbar controls.
2. Add a resizable workspace shell using `react-resizable-panels`.
3. Add editable inspector states for selected devices and selected links.
4. Add link validation for occupied ports/interfaces.
5. Add bidirectional duplicate-link detection.
6. Add tests for invalid link creation and duplicate bidirectional endpoints.

## Implementation Verification - Topology Panel Rewrite

Date: 2026-07-27

Changes verified:

- Installed and wired the topology UI dependency set declared in `.codex/abilities/topology-ui.*`:
  - `@xyflow/react`
  - `elkjs`
  - `react-resizable-panels`
- Rewrote the center topology canvas to use React Flow nodes, controls, minimap, and a custom SVG link overlay.
- Added ELK auto-layout action for cleaner topology arrangement.
- Added right-side inspector editing for selected devices and links.
- Added wired-link validation for occupied physical interfaces.
- Added bidirectional duplicate endpoint detection.

Verification performed:

- Direct dependency imports resolved through the local runtime.
- `app/page.tsx` ESLint passed.
- Local Next dev server responded with HTTP `200` at `http://localhost:3000/`.
- Browser smoke test confirmed:
  - 4 sample topology devices rendered.
  - 3 topology links rendered through the overlay.
  - React Flow controls and minimap were visible.
  - Device selection opened editable inspector fields.
  - Link selection opened editable inspector fields.
  - Duplicate physical endpoint creation showed a warning.
  - ELK auto-layout updated the topology and status notice.

Known remaining issues after this pass:

- Full project `tsc --noEmit` still reports existing Cloudflare Worker type errors:
  - `db/index.ts`: missing `cloudflare:workers` type declaration.
  - `worker/index.ts`: missing `Fetcher`.
  - `worker/index.ts`: missing `D1Database`.
- Vite/Vinext local startup remains sensitive to the partially broken native package install state on this Windows environment; Next local dev was used for the physical UI test.

## Implementation Verification - Resizable Side Panel Fix

Date: 2026-07-27

User-reported issue:

- The left device list/add panel and right device information panel had incorrect sizing.
- Panel boundaries were not adjustable in the expected way.

Changes verified:

- Added stable default workspace layout of `24 / 52 / 24` for left panel, canvas, and right inspector.
- Added panel layout validation before saving to localStorage.
- Added logic to discard invalid previously saved panel widths.
- Deferred rendering of the resizable panel group until the client-side layout state is ready.
- Increased resize handle hit target to 12px and enabled `touch-action: none`.
- Added CSS constraints so side panel content uses `min-width: 0`, truncates text, and does not force the panel wider.

Verification performed:

- `app/page.tsx` ESLint passed.
- Local dev page responded with HTTP `200`.
- `tsc --noEmit` produced only the pre-existing Cloudflare Worker type errors listed above.
- Temporary `tsconfig.tsbuildinfo` produced by the TypeScript check was removed after verification.
