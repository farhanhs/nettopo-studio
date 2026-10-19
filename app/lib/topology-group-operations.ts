import type { Group, Project } from "./topology-types";

export type GroupOperationResult = {
  status: "changed" | "not-found";
  project: Project;
  affectedDevices: number;
};

export function editTopologyGroup(project: Project, groupId: string, patch: Pick<Group, "name" | "kind" | "color">): GroupOperationResult {
  if (!project.groups.some(group => group.id === groupId)) {
    return { status: "not-found", project, affectedDevices: 0 };
  }
  return {
    status: "changed",
    affectedDevices: 0,
    project: {
      ...project,
      groups: project.groups.map(group => group.id === groupId
        ? { ...group, name: patch.name, kind: patch.kind, color: patch.color }
        : group),
    },
  };
}

export function deleteTopologyGroupKeepMembers(project: Project, groupId: string): GroupOperationResult {
  if (!project.groups.some(group => group.id === groupId)) {
    return { status: "not-found", project, affectedDevices: 0 };
  }
  const members = project.devices.filter(device => device.groupId === groupId);
  return {
    status: "changed",
    affectedDevices: members.length,
    project: {
      ...project,
      groups: project.groups.filter(group => group.id !== groupId),
      devices: project.devices.map(device => device.groupId === groupId ? { ...device, groupId: undefined } : device),
    },
  };
}
