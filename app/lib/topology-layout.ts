import type { Device, Project } from "./topology-types";

export type ResolvedLayoutMode = "three-tier" | "spine-leaf" | "layered";

type GraphMetrics = {
  degree: Map<string, number>;
  switchDegree: Map<string, number>;
  endpointDegree: Map<string, number>;
};

function isEndpoint(device: Device) {
  return ["server", "nas", "erp", "client", "access-point", "mesh-node", "ssid", "printer", "camera", "pos", "iot"].includes(device.type);
}

function isNamedSpine(device: Device) {
  const name = device.name.toLocaleLowerCase();
  return ["spine", "main switch", "core", "backbone", "主幹", "核心"].some((keyword) => name.includes(keyword));
}

function sharedEndpointCount(leftId: string, rightId: string, project: Project) {
  const byId = new Map(project.devices.map((device) => [device.id, device]));
  const endpointsFor = (deviceId: string) => new Set(project.links.flatMap((link) => {
    const neighborId = link.from === deviceId ? link.to : link.to === deviceId ? link.from : undefined;
    const neighbor = neighborId ? byId.get(neighborId) : undefined;
    return neighbor && isEndpoint(neighbor) ? [neighbor.id] : [];
  }));
  const left = endpointsFor(leftId);
  return [...endpointsFor(rightId)].filter((id) => left.has(id)).length;
}

export function buildLayoutMetrics(project: Project): GraphMetrics {
  const byId = new Map(project.devices.map((device) => [device.id, device]));
  const degree = new Map(project.devices.map((device) => [device.id, 0]));
  const switchDegree = new Map(project.devices.map((device) => [device.id, 0]));
  const endpointDegree = new Map(project.devices.map((device) => [device.id, 0]));

  for (const link of project.links) {
    const from = byId.get(link.from);
    const to = byId.get(link.to);
    if (!from || !to) continue;
    degree.set(from.id, (degree.get(from.id) ?? 0) + 1);
    degree.set(to.id, (degree.get(to.id) ?? 0) + 1);
    if (to.type === "switch") switchDegree.set(from.id, (switchDegree.get(from.id) ?? 0) + 1);
    if (from.type === "switch") switchDegree.set(to.id, (switchDegree.get(to.id) ?? 0) + 1);
    if (isEndpoint(to)) endpointDegree.set(from.id, (endpointDegree.get(from.id) ?? 0) + 1);
    if (isEndpoint(from)) endpointDegree.set(to.id, (endpointDegree.get(to.id) ?? 0) + 1);
  }

  return { degree, switchDegree, endpointDegree };
}

export function resolveLayoutMode(project: Project, requested: "auto-detect" | ResolvedLayoutMode): ResolvedLayoutMode {
  if (requested !== "auto-detect") return requested;
  const metrics = buildLayoutMetrics(project);
  const switches = project.devices.filter((device) => device.type === "switch");
  const namedSpines = switches.filter(isNamedSpine);
  const dualSpineServerLeafShape = namedSpines.length >= 2 && namedSpines.some((left, index) =>
    namedSpines.slice(index + 1).some((right) => sharedEndpointCount(left.id, right.id, project) >= 3),
  );
  const possibleSpines = switches.filter((device) =>
    (metrics.switchDegree.get(device.id) ?? 0) >= 2 &&
    (metrics.endpointDegree.get(device.id) ?? 0) === 0,
  );
  const possibleLeaves = switches.filter((device) => (metrics.endpointDegree.get(device.id) ?? 0) > 0);
  const spineLeafScore = switches.length >= 3 && possibleSpines.length >= 1 && possibleLeaves.length >= 2
    ? possibleSpines.length * 2 + possibleLeaves.length + switches.length
    : 0;
  if (spineLeafScore >= 7 || dualSpineServerLeafShape) return "spine-leaf";

  const hasThreeTierShape =
    project.devices.some((device) => device.type === "modem") &&
    project.devices.some((device) => device.type === "firewall" || device.type === "router") &&
    project.devices.some((device) => device.type === "switch");
  return hasThreeTierShape ? "three-tier" : "layered";
}

function neighborPositions(deviceId: string, positioned: Map<string, number>, project: Project) {
  const positions: number[] = [];
  for (const link of project.links) {
    const neighborId = link.from === deviceId ? link.to : link.to === deviceId ? link.from : undefined;
    const position = neighborId ? positioned.get(neighborId) : undefined;
    if (position !== undefined) positions.push(position);
  }
  return positions;
}

/**
 * Applies a barycentric sweep to each layer/row. Nodes are ordered near the
 * average position of their already-positioned neighbors, reducing crossings
 * without changing any device or link relationship.
 */
export function orderLayersByConnectivity(layers: Device[][], project: Project) {
  const ordered: Device[][] = [];
  const positioned = new Map<string, number>();

  for (const layer of layers) {
    const next = [...layer].sort((a, b) => {
      const aPositions = neighborPositions(a.id, positioned, project);
      const bPositions = neighborPositions(b.id, positioned, project);
      const aAverage = aPositions.length
        ? aPositions.reduce((sum, value) => sum + value, 0) / aPositions.length
        : Number.POSITIVE_INFINITY;
      const bAverage = bPositions.length
        ? bPositions.reduce((sum, value) => sum + value, 0) / bPositions.length
        : Number.POSITIVE_INFINITY;
      return aAverage - bAverage || a.name.localeCompare(b.name);
    });
    next.forEach((device, index) => positioned.set(device.id, index));
    ordered.push(next);
  }

  return ordered;
}

export const LAYOUT_DESCRIPTIONS: Record<ResolvedLayoutMode, string> = {
  "three-tier": "依 WAN／邊界／核心／匯聚／存取／端點分欄，適合企業園區與辦公室網路。",
  "spine-leaf": "依邊界／Spine／Leaf／端點分列，強調 Spine 與 Leaf 的東西向互連。",
  layered: "依實際連線關係由 ELK 計算階層與交叉最少位置，適合不規則或混合拓樸。",
};
