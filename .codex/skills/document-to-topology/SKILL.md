---
name: document-to-topology
description: Convert customer equipment notes, network handover documents, screenshots, or structured equipment templates into NetTopo Studio topology data. Use when asked to generate devices, links, groups, masked credentials, topology test data, PDF/export checks, or completeness analysis from a customer network document.
---

# Document To Topology

## Purpose

Use this skill to turn customer network notes into NetTopo Studio project data while preserving uncertainty, protecting secrets, and producing a testable topology.

## Workflow

1. Read the source document with the correct encoding. For Traditional Chinese text files, try UTF-8 before Windows default encoding.
2. Extract facts into five buckets:
   - internet/WAN sources
   - network devices
   - SSIDs and wireless policies
   - wired and wireless links
   - endpoint devices and service accounts
3. Classify each item into the closest NetTopo Studio device type.
4. Mark uncertain facts explicitly instead of guessing silently.
5. Write project-local customer artifacts under `private/` unless the user explicitly asks for a commit-safe public example.
6. Mask credentials. Never copy plaintext passwords into project files that may be committed.
7. Generate or update:
   - topology JSON that matches the `Project` schema used by the IndexedDB topology store
   - masked credential JSON
   - test report
   - optional screenshot/PDF artifacts
8. Verify counts, link types, orthogonal paths, zoom behavior, and PDF page size when feasible.

## Classification Rules

- `modem`: ISP modem, telecom modem, WAN handoff, internet source.
- `router`: router, main AP/router, firewall-router appliance when no firewall type exists.
- `firewall`: firewall or security gateway.
- `switch`: core, distribution, access switch.
- `access-point`: physical AP, mesh node, or SSID placeholder when the app lacks an SSID type.
- `server`, `nas`, `erp`: use only when the document clearly names those roles.
- `client`: computers, tablets, phones, printers, cameras, POS, Google Home, IoT devices until the app has more specific types.

When the source includes counts, prefer aggregate labels like `iPad x5` only if individual device names are unknown. When exact device names exist, create individual nodes.

## Link Rules

- Use `wired` only when the document says LAN, Ethernet, cable, physical line, wired backhaul, or provides ports such as `LAN1`.
- Use `wireless` for Wi-Fi clients, wireless backhaul, mesh wireless return, SSID membership, or unclear wireless camera membership.
- Preserve port labels in `fromPort` and `toPort` when known.
- If a device appears connected to an SSID but the physical AP is unknown, link it to the SSID placeholder and mark the limitation in the report.
- If the source mentions a device but not how it connects, create the device but record the link as missing/unknown in the report instead of inventing a link.

## Completeness Analysis

Compare generated output with any reference diagram or source image:

- Identify missing devices, missing groups, missing links, and wrong link types.
- Separate causes:
  - source information missing or ambiguous
  - app schema missing a device type
  - parser/classification logic wrong
  - layout/rendering problem
- Recommend the smallest document/template change that would make the topology deterministic.

## Security

- Store customer-derived artifacts in `private/` and keep `private/` git-ignored.
- Mask secrets using first/last character only, such as `v**********!`.
- If the full secret must be retained, keep it only in the user-provided original file or an explicitly approved local-only secret file.
- Do not include plaintext passwords in final answers, Git-tracked files, screenshots, or PDFs.

## References

- For the preferred customer input format, read `references/equipment-info-template.md`.
