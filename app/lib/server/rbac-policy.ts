import type { RoleCode, TopologyRecord, UserRecord } from "../topology-types";

export type RbacUser = Pick<UserRecord, "id" | "role" | "siteIds">;
export type RbacTopology = Pick<TopologyRecord, "siteId" | "ownerUserId" | "createdByUserId">;

export function rolePermissions(user: Pick<UserRecord, "role">) {
  return {
    canCreate: user.role !== "sales_procurement",
    canWriteAll: user.role === "boss",
    canReadAll: user.role === "boss" || user.role === "sales_procurement",
  };
}

export function canWriteCustomer(user: Pick<UserRecord, "role">) {
  return user.role === "boss";
}

export function canCreateTopology(user: RbacUser, targetSiteId: string) {
  if (user.role === "boss") return true;
  if (user.role === "sales_procurement") return false;
  return user.siteIds.includes(targetSiteId);
}

export function canReadTopology(user: RbacUser, topology: RbacTopology) {
  if (user.role === "boss" || user.role === "sales_procurement") return true;
  if (!topology.siteId || !user.siteIds.includes(topology.siteId)) return false;
  if (user.role === "site_manager") return true;
  return topology.ownerUserId === user.id || topology.createdByUserId === user.id;
}

export function canWriteTopology(user: RbacUser, topology: RbacTopology) {
  if (user.role === "boss") return true;
  if (user.role === "sales_procurement") return false;
  if (!topology.siteId || !user.siteIds.includes(topology.siteId)) return false;
  if (user.role === "site_manager") return true;
  return topology.ownerUserId === user.id || topology.createdByUserId === user.id;
}

export function roleCanReadAudit(role: RoleCode) {
  return role === "boss";
}
