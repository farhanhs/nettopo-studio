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

> Security note: PostgreSQL server mode encrypts credential secrets with AES-256-GCM, returns masked values only, and records credential changes in the audit log. Keep the encryption key outside Git and require HTTPS before storing production credentials.

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

This Windows workspace includes a project-local PostgreSQL 17.10 runtime under the ignored `.local` directory. Initialize it, start it, and apply the migrations with:

```powershell
npm.cmd run db:local:setup
```

The ignored `.env.local` must contain:

```env
NEXT_PUBLIC_TOPOLOGY_STORAGE=server
DATABASE_URL=postgres://nettopo:nettopo_dev_password@127.0.0.1:5432/nettopo_studio
POSTGRES_POOL_MAX=1
NETTOPO_CREDENTIAL_ENCRYPTION_KEY=<32-byte base64 key>
```

Build and run the Node-targeted local production server:

```powershell
npm.cmd run build:local
npm.cmd run start:local
```

Open `http://127.0.0.1:3000`. Use `npm.cmd run db:local:status` to check PostgreSQL and `npm.cmd run db:local:stop` after the application server has stopped. The schema is managed only through versioned files in `db/migrations`; API requests no longer own ad hoc table creation.

Docker remains an alternative when Docker Desktop is installed:

```powershell
docker compose up -d postgres
npm.cmd run db:migrate
```

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
