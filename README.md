# NetTopo Studio

A browser-based network topology editor for quickly documenting routers, ISP modems, firewalls, switches, servers, NAS, ERP systems, wireless access points, and client devices.

## Current capabilities

- Add one or multiple devices with structured metadata
- Record IP, MAC, model, location, management URL, interfaces, ports, VLAN, and link speed
- Create wired and wireless links
- Group devices by site, domain, and VLAN
- Automatically arrange devices by network role
- Save topology data in browser local storage
- Export the topology through the browser's Print to PDF flow
- Mask credential fields in the interface

> Security note: credential fields are stored in browser local storage and are not a password vault. Do not store production passwords on shared or untrusted computers.

## Run locally

Requirements: Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

Then open the local URL shown by the development server.

## Build

```bash
npm run build
```

## Main source files

- `app/page.tsx`: topology editor state and interactions
- `app/globals.css`: editor layout, device styles, and print/PDF rules
- `app/layout.tsx`: application metadata and root layout
