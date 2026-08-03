import {
  CustomerDatabaseRecordSchema,
  PermissionRecordSchema,
  RoleRecordSchema,
  SiteRecordSchema,
  TopologyDatabaseRecordSchema,
  TopologyDeviceRecordSchema,
  TopologyGroupRecordSchema,
  TopologyLinkRecordSchema,
  UserDatabaseRecordSchema,
  validateDatabaseRecord,
  type ValidationIssue,
} from "./data-dictionary.ts";

export function generateVirtualDatabase(seed = 1) {
  const suffix = String(seed).padStart(3, "0");
  const role = { code: "engineer", name: "網路工程師", description: "測試資料角色" };
  const permission = { code: "topology.write.owned", name: "編輯自有拓樸", description: "測試權限" };
  const site = { id: `site-test-${suffix}`, name: `測試站點 ${suffix}` };
  const user = {
    id: `user-test-${suffix}`,
    email: `tester${suffix}@example.test`,
    name: `測試工程師 ${suffix}`,
    role: role.code,
    siteIds: [site.id],
  };
  const customer = { id: `customer-test-${suffix}`, name: `虛擬客戶 ${suffix}`, notes: "自動測試資料" };
  const topologyId = `topology-test-${suffix}`;
  const group = { id: `group-test-${suffix}`, topologyId, name: "伺服器區", kind: "vlan", color: "#526cf5" };
  const router = {
    id: `device-router-${suffix}`,
    topologyId,
    deviceType: "router",
    groupId: group.id,
    name: "測試路由器",
    ip: "192.0.2.1",
    mac: "02:00:00:00:00:01",
    model: "Virtual Router 1000",
    location: "測試機房 A",
    managementUrl: "https://192.0.2.1",
    positionX: 80,
    positionY: 120,
  };
  const server = {
    id: `device-server-${suffix}`,
    topologyId,
    deviceType: "server",
    groupId: group.id,
    name: "測試伺服器",
    ip: "192.0.2.10",
    mac: "02:00:00:00:00:10",
    model: "Virtual Server",
    location: "測試機房 A",
    managementUrl: "https://192.0.2.10",
    positionX: 360,
    positionY: 120,
  };
  const link = {
    id: `link-test-${suffix}`,
    topologyId,
    fromDeviceId: router.id,
    toDeviceId: server.id,
    kind: "wired",
    fromPort: "LAN1",
    toPort: "eth0",
    vlan: "20",
    speed: "1 Gbps",
  };
  const project = {
    groups: [{ id: group.id, name: group.name, kind: group.kind, color: group.color }],
    devices: [
      { id: router.id, name: router.name, type: router.deviceType, ip: router.ip, mac: router.mac, model: router.model, location: router.location, url: router.managementUrl, x: router.positionX, y: router.positionY, groupId: group.id },
      { id: server.id, name: server.name, type: server.deviceType, ip: server.ip, mac: server.mac, model: server.model, location: server.location, url: server.managementUrl, x: server.positionX, y: server.positionY, groupId: group.id },
    ],
    links: [{ id: link.id, from: router.id, to: server.id, kind: link.kind, fromPort: link.fromPort, toPort: link.toPort, vlan: link.vlan, speed: link.speed }],
  };
  const topology = {
    id: topologyId,
    customerId: customer.id,
    siteId: site.id,
    ownerUserId: user.id,
    name: `虛擬網路拓樸 ${suffix}`,
    versionLabel: "v1",
    project,
  };

  return {
    roles: [role],
    permissions: [permission],
    sites: [site],
    users: [user],
    customers: [customer],
    topologies: [topology],
    topologyGroups: [group],
    topologyDevices: [router, server],
    topologyLinks: [link],
  };
}

export function validateVirtualDatabase(database: ReturnType<typeof generateVirtualDatabase>) {
  const issues: ValidationIssue[] = [];
  const validateMany = (table: string, schema: Parameters<typeof validateDatabaseRecord>[1], records: unknown[]) => {
    for (const record of records) issues.push(...validateDatabaseRecord(table, schema, record).issues);
  };
  validateMany("roles", RoleRecordSchema, database.roles);
  validateMany("permissions", PermissionRecordSchema, database.permissions);
  validateMany("sites", SiteRecordSchema, database.sites);
  validateMany("users", UserDatabaseRecordSchema, database.users);
  validateMany("customers", CustomerDatabaseRecordSchema, database.customers);
  validateMany("topologies", TopologyDatabaseRecordSchema, database.topologies);
  validateMany("topology_groups", TopologyGroupRecordSchema, database.topologyGroups);
  validateMany("topology_devices", TopologyDeviceRecordSchema, database.topologyDevices);
  validateMany("topology_links", TopologyLinkRecordSchema, database.topologyLinks);

  const roleCodes = new Set(database.roles.map((record) => record.code));
  const siteIds = new Set(database.sites.map((record) => record.id));
  const customerIds = new Set(database.customers.map((record) => record.id));
  const topologyIds = new Set(database.topologies.map((record) => record.id));
  const groupIds = new Set(database.topologyGroups.map((record) => record.id));
  const deviceIds = new Set(database.topologyDevices.map((record) => record.id));
  for (const user of database.users) {
    if (!roleCodes.has(user.role)) issues.push({ table: "users", field: "role", code: "foreign_key", message: `Unknown role ${user.role}.` });
    for (const siteId of user.siteIds) if (!siteIds.has(siteId)) issues.push({ table: "user_sites", field: "siteId", code: "foreign_key", message: `Unknown site ${siteId}.` });
  }
  for (const topology of database.topologies) {
    if (!customerIds.has(topology.customerId)) issues.push({ table: "topologies", field: "customerId", code: "foreign_key", message: `Unknown customer ${topology.customerId}.` });
  }
  for (const device of database.topologyDevices) {
    if (!topologyIds.has(device.topologyId)) issues.push({ table: "topology_devices", field: "topologyId", code: "foreign_key", message: `Unknown topology ${device.topologyId}.` });
    if (device.groupId && !groupIds.has(device.groupId)) issues.push({ table: "topology_devices", field: "groupId", code: "foreign_key", message: `Unknown group ${device.groupId}.` });
  }
  for (const link of database.topologyLinks) {
    if (!deviceIds.has(link.fromDeviceId) || !deviceIds.has(link.toDeviceId)) issues.push({ table: "topology_links", field: "fromDeviceId/toDeviceId", code: "foreign_key", message: "Link references an unknown device." });
  }

  return { valid: issues.length === 0, issues };
}
