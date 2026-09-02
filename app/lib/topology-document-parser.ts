import { MASKED_SECRET, maskCredentialUsername } from "./credential-masking.ts";
import {
  createMissingInfoItem,
  type MissingInfoItem,
} from "./topology-missing-info.ts";
import type { CredentialKind, Device, DeviceType, Group, Link, Project } from "./topology-types.ts";
import type { ImportIssue, MaskedCredentialRow } from "./topology-transfer.ts";

export type TopologyDocumentDraft = {
  project: Project;
  maskedCredentials: MaskedCredentialRow[];
  missingInfo: MissingInfoItem[];
  issues: ImportIssue[];
};

const DEVICE_TYPES: DeviceType[] = [
  "router",
  "modem",
  "firewall",
  "switch",
  "server",
  "nas",
  "erp",
  "access-point",
  "client",
  "ssid",
  "mesh-node",
  "printer",
  "camera",
  "pos",
  "iot",
];

const TYPE_ALIASES = new Map<string, DeviceType>([
  ["pc", "client"],
  ["computer", "client"],
  ["tablet", "client"],
  ["phone", "client"],
  ["ap", "access-point"],
  ["accesspoint", "access-point"],
  ["wifiap", "access-point"],
  ["mesh", "mesh-node"],
  ["印表機", "printer"],
  ["攝影機", "camera"],
  ["防火牆", "firewall"],
  ["交換器", "switch"],
  ["路由器", "router"],
  ["數據機", "modem"],
  ["伺服器", "server"],
  ["客戶端", "client"],
]);

const HEADER_ALIASES = new Map<string, string>([
  ["id", "id"],
  ["deviceid", "id"],
  ["設備id", "id"],
  ["name", "name"],
  ["devicename", "name"],
  ["設備名稱", "name"],
  ["名稱", "name"],
  ["type", "type"],
  ["devicetype", "type"],
  ["設備類型", "type"],
  ["類型", "type"],
  ["ip", "ip"],
  ["ipaddress", "ip"],
  ["管理ip", "ip"],
  ["mac", "mac"],
  ["macaddress", "mac"],
  ["model", "model"],
  ["型號", "model"],
  ["location", "location"],
  ["位置", "location"],
  ["url", "url"],
  ["quantity", "quantity"],
  ["數量", "quantity"],
  ["group", "groupId"],
  ["groupid", "groupId"],
  ["群組", "groupId"],
  ["from", "from"],
  ["source", "from"],
  ["來源", "from"],
  ["來源設備", "from"],
  ["to", "to"],
  ["target", "to"],
  ["目的", "to"],
  ["目的設備", "to"],
  ["fromport", "fromPort"],
  ["sourceport", "fromPort"],
  ["來源port", "fromPort"],
  ["toport", "toPort"],
  ["targetport", "toPort"],
  ["目的port", "toPort"],
  ["kind", "kind"],
  ["linkkind", "kind"],
  ["連線類型", "kind"],
  ["vlan", "vlan"],
  ["speed", "speed"],
  ["速率", "speed"],
  ["color", "color"],
  ["顏色", "color"],
  ["collapsed", "collapsed"],
  ["username", "username"],
  ["account", "username"],
  ["帳號", "username"],
  ["password", "secret"],
  ["secret", "secret"],
  ["密碼", "secret"],
]);

function clean(value: string | undefined) {
  const next = value?.trim();
  return next || undefined;
}

function key(value: string) {
  return value.trim().toLowerCase().replace(/[\s_\-/:()（）?？]+/g, "");
}

function columnName(value: string) {
  return HEADER_ALIASES.get(key(value)) ?? key(value);
}

function stableId(prefix: string, value: string, index: number) {
  const base = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 52);
  return `${prefix}-${base || index + 1}`;
}

function parseType(value: string | undefined): { type: DeviceType; guessed: boolean } {
  const normalized = key(value ?? "");
  if (DEVICE_TYPES.includes(normalized as DeviceType)) return { type: normalized as DeviceType, guessed: false };
  const aliased = TYPE_ALIASES.get(normalized);
  if (aliased) return { type: aliased, guessed: false };
  return { type: "client", guessed: Boolean(value?.trim()) };
}

function parseKind(value: string | undefined): Link["kind"] {
  const normalized = key(value ?? "");
  if (normalized.includes("wireless") || normalized.includes("wifi") || normalized.includes("無線")) return "wireless";
  return "wired";
}

function splitTableRow(line: string) {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
}

function isSeparatorRow(cells: string[]) {
  return cells.every((cell) => /^:?-{3,}:?$/.test(cell.replace(/\s/g, "")));
}

function parseTables(lines: string[]) {
  const tables: { headers: string[]; rows: string[][]; line: number }[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (!lines[index].trim().startsWith("|")) continue;
    const headers = splitTableRow(lines[index]);
    const separator = lines[index + 1]?.trim().startsWith("|") ? splitTableRow(lines[index + 1]) : [];
    if (!separator.length || !isSeparatorRow(separator)) continue;
    const rows: string[][] = [];
    let cursor = index + 2;
    while (cursor < lines.length && lines[cursor].trim().startsWith("|")) {
      rows.push(splitTableRow(lines[cursor]));
      cursor += 1;
    }
    tables.push({ headers: headers.map(columnName), rows, line: index + 1 });
    index = cursor - 1;
  }
  return tables;
}

function rowObject(headers: string[], cells: string[]) {
  return Object.fromEntries(headers.map((header, index) => [header, clean(cells[index])])) as Record<string, string | undefined>;
}

function nextPosition(index: number) {
  return { x: 80 + (index % 4) * 240, y: 100 + Math.floor(index / 4) * 170 };
}

function credentialKind(row: Record<string, string | undefined>): CredentialKind {
  const text = `${row.kind ?? ""} ${row.type ?? ""} ${row.name ?? ""}`.toLowerCase();
  if (text.includes("wifi") || text.includes("ssid") || text.includes("無線")) return "wifi";
  if (text.includes("vpn")) return "vpn";
  if (text.includes("readonly") || text.includes("read only") || text.includes("唯讀")) return "device_readonly";
  return "device_admin";
}

function addCredential(
  maskedCredentials: MaskedCredentialRow[],
  missingInfo: MissingInfoItem[],
  row: Record<string, string | undefined>,
  projectDeviceId: string | undefined,
  deviceName: string | undefined,
  sourceFile: string,
  sourceLine: number,
) {
  if (!row.username && !row.secret) return;
  if (!projectDeviceId) {
    missingInfo.push(createMissingInfoItem({
      severity: "blocking",
      entityType: "credential",
      field: "projectDeviceId",
      code: "credential.device.missing",
      question: "偵測到帳密欄位，但無法判定這筆帳密屬於哪個設備。",
      sourceFile,
      sourceLine,
    }));
    return;
  }
  maskedCredentials.push({
    projectDeviceId,
    deviceName,
    kind: credentialKind(row),
    usernameMasked: maskCredentialUsername(row.username),
    secretMasked: MASKED_SECRET,
  });
}

export function parseTopologyDocument(source: { name: string; text: string }): TopologyDocumentDraft {
  const lines = source.text.replace(/^\uFEFF/, "").split(/\r?\n/);
  const tables = parseTables(lines);
  const issues: ImportIssue[] = [];
  const missingInfo: MissingInfoItem[] = [];
  const maskedCredentials: MaskedCredentialRow[] = [];
  const devices: Device[] = [];
  const links: Link[] = [];
  const groups: Group[] = [];
  const deviceIdsByName = new Map<string, string>();

  for (const table of tables) {
    const hasDeviceColumns = table.headers.some((header) => ["name", "type", "ip", "mac", "model"].includes(header));
    const hasLinkColumns = table.headers.includes("from") || table.headers.includes("to");
    const hasGroupColumns = table.headers.includes("groupId") && table.headers.includes("name") && !hasDeviceColumns;

    for (const [rowIndex, cells] of table.rows.entries()) {
      const row = rowObject(table.headers, cells);
      const sourceLine = table.line + rowIndex + 2;

      if (hasLinkColumns) {
        const from = row.from;
        const to = row.to;
        if (!from || !to) {
          missingInfo.push(createMissingInfoItem({
            severity: "blocking",
            entityType: "link",
            entityId: stableId("link", `${from ?? "missing"}-${to ?? "missing"}`, rowIndex),
            field: "endpoint",
            code: "link.endpoint.unparsed",
            question: "無法解析連線的來源或目的設備。",
            sourceFile: source.name,
            sourceLine,
          }));
          continue;
        }
        links.push({
          id: row.id ?? stableId("link", `${from}-${to}-${row.fromPort ?? ""}-${row.toPort ?? ""}`, links.length),
          from,
          to,
          kind: parseKind(row.kind),
          fromPort: row.fromPort,
          toPort: row.toPort,
          vlan: row.vlan,
          speed: row.speed,
        });
        continue;
      }

      if (hasGroupColumns) {
        const name = row.name ?? row.groupId;
        if (!name) continue;
        groups.push({
          id: row.id ?? row.groupId ?? stableId("group", name, groups.length),
          name,
          kind: row.kind === "domain" || row.kind === "vlan" ? row.kind : "site",
          color: row.color && /^#[0-9a-f]{6}$/i.test(row.color) ? row.color : "#526cf5",
          collapsed: row.collapsed === "true",
        });
        continue;
      }

      if (hasDeviceColumns) {
        const name = row.name ?? row.id;
        if (!name) {
          missingInfo.push(createMissingInfoItem({
            severity: "blocking",
            entityType: "device",
            field: "name",
            code: "device.name.unparsed",
            question: "文件表格中有設備列，但缺少設備名稱。",
            sourceFile: source.name,
            sourceLine,
          }));
          continue;
        }
        const { type, guessed } = parseType(row.type);
        const id = row.id ?? stableId("device", name, devices.length);
        const position = nextPosition(devices.length);
        devices.push({
          id,
          name,
          type,
          ip: row.ip,
          mac: row.mac,
          model: row.model,
          location: row.location,
          url: row.url,
          quantity: row.quantity ? Number(row.quantity) || undefined : undefined,
          x: position.x,
          y: position.y,
          groupId: row.groupId,
        });
        deviceIdsByName.set(key(name), id);
        if (guessed) {
          issues.push({
            severity: "warning",
            code: "document.device-type.guessed",
            message: `無法辨識設備類型「${row.type}」，已暫時映射為 client。`,
            path: `${source.name} row ${sourceLine}`,
          });
        }
        addCredential(maskedCredentials, missingInfo, row, id, name, source.name, sourceLine);
      }
    }
  }

  const linkedDevices = new Set(devices.map((device) => device.id));
  const normalizedLinks = links.map((link) => ({
    ...link,
    from: linkedDevices.has(link.from) ? link.from : deviceIdsByName.get(key(link.from)) ?? link.from,
    to: linkedDevices.has(link.to) ? link.to : deviceIdsByName.get(key(link.to)) ?? link.to,
  }));

  const arrowPattern = /(.+?)\s*(?:->|→|-->|連到|連接)\s*(.+?)(?:\s+(?:port|Port)\s+(.+))?$/;
  for (const [index, line] of lines.entries()) {
    if (line.includes("|")) continue;
    const match = line.trim().match(arrowPattern);
    if (!match) continue;
    const from = deviceIdsByName.get(key(match[1])) ?? clean(match[1]);
    const to = deviceIdsByName.get(key(match[2])) ?? clean(match[2]);
    if (!from || !to || !linkedDevices.has(from) || !linkedDevices.has(to)) {
      missingInfo.push(createMissingInfoItem({
        severity: "blocking",
        entityType: "link",
        entityId: stableId("link", line, index),
        field: "endpoint",
        code: "link.endpoint.unparsed",
        question: "箭頭連線敘述無法對應到既有設備，請確認兩端設備名稱或 ID。",
        sourceFile: source.name,
        sourceLine: index + 1,
      }));
      continue;
    }
    normalizedLinks.push({ id: stableId("link", `${from}-${to}`, normalizedLinks.length), from, to, kind: "wired" });
  }

  if (devices.length === 0 && normalizedLinks.length === 0 && groups.length === 0) {
    issues.push({ severity: "error", code: "document.empty", message: "文件中未解析到可匯入的設備、連線或群組。", path: source.name });
  }

  return {
    project: { devices, links: normalizedLinks, groups },
    maskedCredentials,
    missingInfo,
    issues,
  };
}
