---
name: topology-ui
description: Project-local skill for building, layouting, and extending NetTopo Studio's interactive topology canvas (@xyflow/react), auto-layout engine (elkjs), workspace resizable panels (react-resizable-panels), client storage (dexie), state management (zustand), and schema validation (zod).
---

# Topology UI Toolkit

## Purpose

Use this project-local skill when working on NetTopo Studio's topology editor, canvas behavior, auto-layout, workspace panel layout, or component state persistence.

## Mounted Packages & Roles

- `@xyflow/react` (`v12.11.2`): Main interactive topology canvas for rendering nodes and edges, dragging devices, panning/zooming, selection, minimap, and connection editing.
- `elkjs` (`v0.11.1`): Automatic graph layout engine for layered network topology diagrams. Prefer left-to-right layouts for ISP/modem/firewall/switch/server flows.
- `react-resizable-panels` (`v4.9.0`): Resizable and collapsible workspace panels (device list, canvas, inspector).
- `dexie` (`v4.4.4`): Browser-local IndexedDB storage of customers, topology projects, active selections, and schema migrations.
- `zustand` (`v5.0.14`): Global state management across topbar, sidebar, canvas, and inspector, especially active customer/topology switching and saving state.
- `zod` (`v4.4.3`): Schema validation for imported topology drafts, CSV rows, and exported project schemas.
- `papaparse` (`v5.5.4`): CSV import/export workflows for devices, links, groups, masked credentials, and missing-info files.
- `dom-to-image-more` (`v3.10.2`): Primary DOM capture layer for exporting topology canvases to image/PDF workflows.

## Integration Rules

- Keep `Device`, `Link`, and `Group` as the app-level domain model; map them into React Flow nodes and edges at the view boundary.
- Keep the durable topology model in IndexedDB via Dexie. Do not put customer/topology project data back into a single `localStorage` record.
- Use Zustand actions as the write boundary for topology mutations so canvas drags, forms, import, export, and project switching share the same persistence path.
- Keep ELK layout as a pure transformation from domain data to node positions. Do not mix layout computation with form submission or localStorage persistence.
- Use React Flow controlled `nodes` and `edges` state so canvas edits can be written back to `Project`.
- Store panel sizes separately from topology data, preferably under a dedicated localStorage key.
- Keep the inspector as regular React UI outside the canvas.

## Target Files & Commands

- **Primary UI & Layout**: `app/page.tsx`, `app/globals.css`, `app/components/`
- **Domain State & Persistence**: `app/lib/`
- **Verification Commands**: `npm run lint` && `npm run test` && `npm run build`
