import type { Device, Group, Link, Project } from "./topology-types";

export const COLLAPSED_GROUP_NODE_PREFIX = "collapsed-group:";

export type CanvasDevice = Device & {
  collapsedGroup?: Group;
  memberCount?: number;
  totalQuantity?: number;
};

export type CanvasLink = Link & {
  aggregateCount?: number;
  sourceLinkIds?: string[];
};

export type CanvasProject = {
  devices: CanvasDevice[];
  links: CanvasLink[];
  groups: Group[];
};

export function deviceQuantity(device: Pick<Device, "quantity">) {
  return Math.max(1, Math.trunc(device.quantity ?? 1));
}

export function collapsedGroupNodeId(groupId: string) {
  return `${COLLAPSED_GROUP_NODE_PREFIX}${groupId}`;
}

export function buildCanvasProject(project: Project): CanvasProject {
  const collapsedGroups = project.groups.filter((group) => group.collapsed);
  if (collapsedGroups.length === 0) {
    return {
      devices: project.devices.map((device) => ({ ...device })),
      links: project.links.map((link) => ({ ...link, aggregateCount: 1, sourceLinkIds: [link.id] })),
      groups: project.groups.map((group) => ({ ...group })),
    };
  }

  const collapsedGroupById = new Map(collapsedGroups.map((group) => [group.id, group]));
  const replacementByDeviceId = new Map<string, string>();
  const syntheticDevices: CanvasDevice[] = [];

  for (const group of collapsedGroups) {
    const members = project.devices.filter((device) => device.groupId === group.id);
    if (members.length === 0) continue;
    const id = collapsedGroupNodeId(group.id);
    for (const member of members) replacementByDeviceId.set(member.id, id);
    syntheticDevices.push({
      id,
      name: group.name,
      type: "client",
      quantity: members.reduce((sum, member) => sum + deviceQuantity(member), 0),
      x: members.reduce((sum, member) => sum + member.x, 0) / members.length,
      y: members.reduce((sum, member) => sum + member.y, 0) / members.length,
      collapsedGroup: { ...group },
      memberCount: members.length,
      totalQuantity: members.reduce((sum, member) => sum + deviceQuantity(member), 0),
    });
  }

  const devices: CanvasDevice[] = [
    ...project.devices
      .filter((device) => !device.groupId || !collapsedGroupById.has(device.groupId))
      .map((device) => ({ ...device })),
    ...syntheticDevices,
  ];
  const linksByKey = new Map<string, CanvasLink>();

  for (const link of project.links) {
    const from = replacementByDeviceId.get(link.from) ?? link.from;
    const to = replacementByDeviceId.get(link.to) ?? link.to;
    if (from === to) continue;

    const key = `${[from, to].sort().join("|")}|${link.kind}`;
    const existing = linksByKey.get(key);
    if (!existing) {
      linksByKey.set(key, {
        ...link,
        from,
        to,
        aggregateCount: 1,
        sourceLinkIds: [link.id],
      });
      continue;
    }

    existing.aggregateCount = (existing.aggregateCount ?? 1) + 1;
    existing.sourceLinkIds = [...(existing.sourceLinkIds ?? []), link.id];
    existing.fromPort = undefined;
    existing.toPort = undefined;
    if (existing.speed !== link.speed) existing.speed = undefined;
    if (existing.vlan !== link.vlan) existing.vlan = undefined;
  }

  return {
    devices,
    links: [...linksByKey.values()],
    groups: project.groups.map((group) => ({ ...group })),
  };
}
