# NetTopo Studio

A browser-based network topology editor for quickly documenting routers, ISP modems, firewalls, switches, servers, NAS, ERP systems, wireless access points, and client devices.

## Current capabilities

- Add one or multiple devices with structured metadata
- Record IP, MAC, model, location, management URL, interfaces, ports, VLAN, and link speed
- Create wired and wireless links
- Group devices by site, domain, and VLAN
- Automatically arrange devices by network role
- Save topology data in browser IndexedDB, or switch to the PostgreSQL API for shared internal deployments
- Export the topology through the browser's Print to PDF flow
- Mask credential fields in the interface

> Security note: credential fields are not a password vault. Do not store production passwords until role permissions, audit logs, and encrypted secret handling are added.

## Project abilities

- `.codex/abilities/topology-ui.json`: machine-readable ability mount for `@xyflow/react`, `elkjs`, and `react-resizable-panels`
- `.codex/abilities/topology-ui.md`: implementation guidance for using those packages in this topology editor

## Run locally

Requirements: Node.js 22.13 or newer.

```powershell
npm install
npm run dev
```

On Windows PowerShell, if script execution is blocked, use the npm command shim:

```powershell
npm.cmd install
npm.cmd run dev
```

Then open the local URL shown by the development server.

## PostgreSQL storage mode

The app defaults to browser IndexedDB:

```env
NEXT_PUBLIC_TOPOLOGY_STORAGE=indexeddb
```

For a shared internal deployment, start PostgreSQL and switch the frontend store to the server-backed API:

```powershell
docker compose up -d postgres
copy .env.example .env.local
```

Set this in `.env.local`:

```env
NEXT_PUBLIC_TOPOLOGY_STORAGE=server
DATABASE_URL=postgres://nettopo:nettopo_dev_password@localhost:5432/nettopo_studio
```

The first request to `/api/topology` creates the required `customers` and `topologies` tables if they do not exist.

## Internal role model

PostgreSQL storage mode seeds the first internal roles and sites:

- `manner@company.local`: boss, can read/write everything.
- `north1.manager@company.local`: 北一站站長, can read/write 北一站 topology files.
- `north2.manager@company.local`: 北二站站長, can read/write 北二站 topology files.
- `engineer@company.local`: engineer, can read/write topology files they created or own.
- `sales@company.local`: procurement/sales, can read all topology files but cannot write.

Before formal account login is added, set `NETTOPO_DEV_USER_EMAIL` in `.env.local` to test a role.
You can also use the `測試身分` selector in the top-right toolbar during local preview; the selected email is sent to the topology API as `x-nettopo-user-email`.

## Build

```bash
npm run build
```

## Main source files

- `app/page.tsx`: topology editor state and interactions
- `app/globals.css`: editor layout, device styles, and print/PDF rules
- `app/layout.tsx`: application metadata and root layout
