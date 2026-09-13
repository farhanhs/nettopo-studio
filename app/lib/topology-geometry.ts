import type { Device } from "./topology-types";
import { deviceRoutingRect, TOPOLOGY_NODE_WIDTH, TOPOLOGY_NODE_HEIGHT } from "./topology-routing.ts";
import { GeometryVersionSchema, LayoutContractError, parseLayout, canonicalJson } from "./topology-layout-contract.ts";
import type { GeometryVersion } from "./topology-layout-contract.ts";

const probe: Device = { id: "geometry-probe", name: "geometry-probe", type: "switch", x: 0, y: 0 };
const rect = deviceRoutingRect(probe);
export const BASE_LAYOUT_GEOMETRY: Readonly<GeometryVersion> = Object.freeze({
  source: "base-178x112", nodeWidth: TOPOLOGY_NODE_WIDTH, nodeHeight: TOPOLOGY_NODE_HEIGHT,
  routingRectMargin: -rect.left,
});

/** Base router cannot accept AST dimensions yet. Fail closed rather than score wrong rectangles. */
export function assertBaseGeometry(value: unknown): GeometryVersion {
  const geometry = parseLayout(GeometryVersionSchema, value);
  if (canonicalJson(geometry) !== canonicalJson(BASE_LAYOUT_GEOMETRY)) throw new LayoutContractError();
  return geometry;
}
export function layoutNodeRect(device: Device, geometry: GeometryVersion = BASE_LAYOUT_GEOMETRY) {
  assertBaseGeometry(geometry);
  return { deviceId: device.id, x: device.x, y: device.y, width: geometry.nodeWidth, height: geometry.nodeHeight };
}
