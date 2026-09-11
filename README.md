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

## Project skills

- `.codex/skills/topology-ui/SKILL.md`: skill guide for `@xyflow/react`, `elkjs`, `react-resizable-panels`, `dexie`, `zustand`, and `zod`
- `.codex/skills/document-to-topology/SKILL.md`: skill guide for converting customer network handover documents into NetTopo Studio topology data

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

`db:local:setup` initializes/starts the local database, runs migrations, and verifies the schema. It does not seed demo data; run `npm.cmd run db:seed:demo` separately when the development gate is enabled.

The ignored `.env.local` must contain:

```env
NEXT_PUBLIC_TOPOLOGY_STORAGE=server
DATABASE_URL=postgres://nettopo_runtime:REPLACE_WITH_RUNTIME_PASSWORD@127.0.0.1:5432/nettopo_studio
MIGRATION_DATABASE_URL=postgres://nettopo:REPLACE_WITH_MIGRATION_PASSWORD@127.0.0.1:5432/nettopo_studio
POSTGRES_POOL_MAX=1
NETTOPO_CREDENTIAL_ENCRYPTION_KEY=<32-byte base64 key>
```

`DATABASE_URL` is used by the runtime application role. `MIGRATION_DATABASE_URL` is used only by migration CLI commands and never falls back to `DATABASE_URL`. They must use different PostgreSQL usernames and different passwords, including in local development.

For this Windows workspace, use the OPS runbooks to bootstrap or rotate local credentials without printing secrets:

- `docs/engineerticket/runbooks/OPS_DBM_002-runtime-role.md`
- `docs/engineerticket/runbooks/OPS_SEC_001-local-secret-rotation.md`

Build and run the Node-targeted local production server:

```powershell
npm.cmd run build:local
npm.cmd run start:local
```

Open `http://127.0.0.1:3000`. Use `npm.cmd run db:local:status` to check PostgreSQL and `npm.cmd run db:local:stop` after the application server has stopped. The schema is managed only through versioned files in `db/migrations`; API requests verify schema readiness but do not run migrations, DDL, dictionary seed, or demo seed.

Docker remains an alternative when Docker Desktop is installed:

```powershell
$env:NETTOPO_POSTGRES_PASSWORD="<local migration password from your secret store>"
docker compose up -d postgres
npm.cmd run db:migrate
npm.cmd run db:verify
```

## Internal role model

PostgreSQL migrations seed the formal role and permission dictionaries. Demo users, sites, customers, and sample topologies are only created by the gated command `npm.cmd run db:seed:demo`:

- `manner@company.local`: boss, can read/write everything.
- `north1.manager@company.local`: 北一站站長, can read/write 北一站 topology files.
- `north2.manager@company.local`: 北二站站長, can read/write 北二站 topology files.
- `engineer@company.local`: engineer, can read/write topology files they created or own.
- `sales@company.local`: procurement/sales, can read all topology files but cannot write.

Before formal OIDC login is added, local role testing must go through the development gate:

```env
NETTOPO_RUNTIME_PROFILE=development
NETTOPO_AUTH_MODE=demo
NETTOPO_ENABLE_DEV_IDENTITY_HEADER=1
NETTOPO_ENABLE_DEMO_SEED=1
NETTOPO_DEV_SESSION_SECRET=replace-with-local-random-secret
```

The UI shows a passwordless `進入本機 Demo` button only when demo auth is enabled. The role selector uses `x-nettopo-dev-user-email` and only works with an active HttpOnly dev session. The legacy `x-nettopo-user-email` header is ignored.

## Build

```bash
npm run build
```

## Main source files

- `app/page.tsx`: topology editor state and interactions
- `app/globals.css`: editor layout, device styles, and print/PDF rules
- `app/layout.tsx`: application metadata and root layout
