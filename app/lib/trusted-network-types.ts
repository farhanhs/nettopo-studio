import type { Device, Group, Link, Project } from "./topology-types.ts";

export type DeviceV2 = Device & {
  networkAreaId?: string;
};

export type LinkV2 = Link & {
  fromInterfaceId?: string;
  toInterfaceId?: string;
};

export type GroupV2 = Group;

export type NetworkArea = {
  id: string;
  kind: "region" | "site";
  name: string;
  parentAreaId?: string;
  groupId?: string;
};

export type NetworkInterface = {
  id: string;
  deviceId: string;
  name: string;
  kind: "physical" | "logical" | "aggregate" | "wireless";
  parentInterfaceId?: string;
  aliases: string[];
  mac?: string;
  description?: string;
  adminLabel?: string;
};

export type NetworkVlan = {
  id: string;
  vlanNumber: number;
  name?: string;
  areaId?: string;
};

export type NetworkSubnet = {
  id: string;
  cidr: string;
  name?: string;
  areaId?: string;
  vlanId?: string;
};

export type InterfaceVlanRelation = {
  id: string;
  interfaceId: string;
  vlanId: string;
  mode: "access" | "trunk-allowed" | "native" | "tagged" | "untagged" | "unknown";
};

export type InterfaceSubnetRelation = {
  id: string;
  interfaceId: string;
  subnetId: string;
  address?: string;
  role?: "gateway" | "member" | "management" | "unknown";
};

export type ResiliencyRelation = {
  id: string;
  kind: "primary-backup" | "active-active" | "candidate";
  memberLinkIds: string[];
  primaryLinkId?: string;
  name?: string;
};

export type EvidenceSource = {
  id: string;
  method: "parsed" | "template" | "inferred" | "human" | "legacy-upcast";
  sourceKind: "document" | "csv" | "json" | "template" | "manual" | "legacy-project";
  displayName: string;
  locator?: { file?: string; line?: number; section?: string };
  template?: { templateId: string; version: string; fingerprint: string };
  ruleCode?: string;
  safeSummary?: string;
  capturedAt?: string;
};

export type TrustedEntityType =
  | "device"
  | "link"
  | "group"
  | "area"
  | "interface"
  | "vlan"
  | "subnet"
  | "interface-vlan"
  | "interface-subnet"
  | "resiliency";

export type FieldTrustRecord = {
  id: string;
  entityType: TrustedEntityType;
  entityId: string;
  fieldPath: string;
  valueFingerprint: string;
  evidenceIds: string[];
  verification: "unverified" | "verified";
  verifiedByUserId?: string;
  verifiedAt?: string;
};

export type TrustedNetworkModelV1 = {
  modelVersion: 1;
  areas: NetworkArea[];
  interfaces: NetworkInterface[];
  vlans: NetworkVlan[];
  subnets: NetworkSubnet[];
  interfaceVlans: InterfaceVlanRelation[];
  interfaceSubnets: InterfaceSubnetRelation[];
  resiliencyRelations: ResiliencyRelation[];
  evidence: EvidenceSource[];
  fieldTrust: FieldTrustRecord[];
};

export type ProjectV2 = {
  projectSchemaVersion: 2;
  devices: DeviceV2[];
  links: LinkV2[];
  groups: GroupV2[];
  trustedNetwork: TrustedNetworkModelV1;
};

export type TrustedNetworkIssueCode =
  | "INVALID_PROJECT_VERSION"
  | "INVALID_PROJECT_SCHEMA"
  | "DUPLICATE_ID"
  | "MISSING_REFERENCE"
  | "INVALID_REFERENCE_OWNER"
  | "RELATION_CYCLE"
  | "ALIAS_COLLISION"
  | "INVALID_CIDR"
  | "INVALID_IP_ADDRESS"
  | "INVALID_RESILIENCY"
  | "INVALID_TRUST_RECORD"
  | "UNSAFE_EVIDENCE"
  | "DOWNCAST_WOULD_LOSE_DATA";

export type TrustedNetworkIssue = {
  code: TrustedNetworkIssueCode;
  path: string;
  message: string;
};

export type LegacyProject = Project;
