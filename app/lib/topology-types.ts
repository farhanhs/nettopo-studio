export type DeviceType =
  | "router"
  | "modem"
  | "firewall"
  | "switch"
  | "server"
  | "nas"
  | "erp"
  | "access-point"
  | "client"
  | "ssid"
  | "mesh-node"
  | "printer"
  | "camera"
  | "pos"
  | "iot";

export type Device = {
  id: string;
  name: string;
  type: DeviceType;
  ip?: string;
  mac?: string;
  model?: string;
  location?: string;
  url?: string;
  username?: string;
  password?: string;
  quantity?: number;
  x: number;
  y: number;
  groupId?: string;
};

export type Link = {
  id: string;
  from: string;
  to: string;
  kind: "wired" | "wireless";
  fromPort?: string;
  toPort?: string;
  vlan?: string;
  speed?: string;
};

export type Group = {
  id: string;
  name: string;
  kind: "site" | "domain" | "vlan";
  color: string;
  collapsed?: boolean;
};

export type Project = { devices: Device[]; links: Link[]; groups: Group[] };

export type RoleCode = "boss" | "site_manager" | "engineer" | "sales_procurement";

export type CredentialKind = "device_admin" | "device_readonly" | "wifi" | "vpn" | "external_service";

export type DeviceCredentialRecord = {
  id: string;
  topologyId: string;
  projectDeviceId: string;
  kind: CredentialKind;
  usernameMasked?: string;
  secretMasked: string;
  keyVersion?: string;
  lastRotatedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type DeviceCredentialWriteInput = {
  topologyId: string;
  projectDeviceId: string;
  kind: CredentialKind;
  username?: string;
  secret: string;
};

export type AuditLogRecord = {
  id: string;
  actorUserId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  siteId?: string;
  customerId?: string;
  topologyId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

export type SiteRecord = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type UserRecord = {
  id: string;
  email: string;
  name: string;
  role: RoleCode;
  siteIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type CustomerRecord = {
  id: string;
  name: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export type TopologyRecord = {
  id: string;
  customerId: string;
  siteId?: string;
  ownerUserId?: string;
  createdByUserId?: string;
  updatedByUserId?: string;
  name: string;
  versionLabel: string;
  project: Project;
  createdAt: string;
  updatedAt: string;
};

export const EMPTY_PROJECT: Project = { devices: [], links: [], groups: [] };

export const SAMPLE_PROJECT: Project = {
  groups: [
    { id: "g-hq", name: "台北總公司", kind: "site", color: "#526cf5" },
    { id: "g-vlan", name: "VLAN 20｜Server Zone", kind: "vlan", color: "#18a674" },
  ],
  devices: [
    { id: "d-modem", name: "中華電信數據機", type: "modem", ip: "114.x.x.x", x: 80, y: 150, groupId: "g-hq" },
    { id: "d-fw", name: "FortiGate 90G", type: "firewall", ip: "192.168.1.1", x: 330, y: 150, groupId: "g-hq" },
    { id: "d-sw", name: "核心交換器", type: "switch", ip: "192.168.1.2", x: 580, y: 150, groupId: "g-hq" },
    { id: "d-nas", name: "Synology NAS", type: "nas", ip: "192.168.20.10", x: 830, y: 150, groupId: "g-vlan" },
  ],
  links: [
    { id: "l1", from: "d-modem", to: "d-fw", kind: "wired", fromPort: "LAN1", toPort: "WAN1", speed: "1 Gbps" },
    { id: "l2", from: "d-fw", to: "d-sw", kind: "wired", fromPort: "LAN2", toPort: "Port 1", vlan: "Trunk", speed: "10 Gbps" },
    { id: "l3", from: "d-sw", to: "d-nas", kind: "wired", fromPort: "Port 8", toPort: "LAN1", vlan: "20", speed: "1 Gbps" },
  ],
};

export function cloneProject(project: Project): Project {
  return {
    devices: project.devices.map((device) => ({ ...device })),
    links: project.links.map((link) => ({ ...link })),
    groups: project.groups.map((group) => ({ ...group })),
  };
}
