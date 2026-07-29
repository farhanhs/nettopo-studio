# Topology UI Ability

Use this project-local ability when improving NetTopo Studio's topology editor, canvas behavior, or workspace panel layout.

## Mounted Packages

- `@xyflow/react`: use as the main topology canvas for nodes, edges, pan, zoom, selection, controls, minimap, and device dragging.
- `elkjs`: use as the auto-layout engine for clean layered network diagrams. Prefer left-to-right layouts for ISP/modem/firewall/switch/server flows.
- `react-resizable-panels`: use for the app shell so the device list, canvas, and inspector can be resized or collapsed.
- `dexie`: use for browser-local IndexedDB storage of customers, topology projects, active selections, and future schema migrations.
- `zustand`: use for app state that spans the topbar, sidebar, canvas, and inspector, especially active customer/topology switching and dirty/saving state.
- `zod`: use for validating imported topology drafts, CSV rows, and future exported project schemas before writing them into the app model.
- `papaparse`: use for CSV import/export workflows, including devices, links, groups, masked credentials, and missing-info files.
- `dom-to-image-more`: use as the first-choice DOM capture layer for exporting topology canvases to image/PDF workflows.

## Integration Rules

- Keep `Device`, `Link`, and `Group` as the app-level domain model; map them into React Flow nodes and edges at the view boundary.
- Keep the durable topology model in IndexedDB via Dexie. Do not put customer/topology project data back into a single `localStorage` record.
- Use Zustand actions as the write boundary for topology mutations so canvas drags, forms, import, export, and project switching share the same persistence path.
- Keep ELK layout as a pure transformation from domain data to node positions. Do not mix layout computation with form submission or localStorage persistence.
- Use React Flow controlled `nodes` and `edges` state so canvas edits can be written back to `Project`.
- Store panel sizes separately from topology data, preferably under a dedicated localStorage key.
- Keep the inspector as regular React UI outside the canvas.

## Suggested First Implementation Pass

1. Replace the fixed `.canvas` device/link rendering with `ReactFlow`.
2. Convert `project.devices` into React Flow nodes and `project.links` into React Flow edges.
3. Add an `applyElkLayout(project, direction)` helper.
4. Wrap sidebar, canvas, and inspector in `PanelGroup`, `Panel`, and `PanelResizeHandle`.
5. Persist node positions and panel layout independently.
