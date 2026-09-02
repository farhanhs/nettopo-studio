import type { Device, Link, Project } from "./topology-types";

export const TOPOLOGY_NODE_WIDTH = 178;
export const TOPOLOGY_NODE_HEIGHT = 112;

const OBSTACLE_MARGIN = 14;
const GRID_CLEARANCE = 8;
const CORNER_PADDING = 12;
const LANE_SPACING = 12;
const MAX_ANCHOR_OFFSET = 42;
const ANCHOR_COLLISION_TOLERANCE = 2;
const SHARED_CORRIDOR_OVERLAP = 24;
const BEND_PENALTY = 34;
const MAX_GRID_OBSTACLES = 24;

export type RouteSide = "left" | "right" | "top" | "bottom";
export type Point = { x: number; y: number };
export type Rect = { left: number; right: number; top: number; bottom: number };
export type RouteAnchor = {
  deviceId: string;
  side: RouteSide;
  point: Point;
  exitPoint: Point;
  normal: { x: -1 | 0 | 1; y: -1 | 0 | 1 };
  baseAxisCoord: number;
};
export type TopologyRouteStatus = "resolved" | "unresolved-no-path" | "invalid-missing-endpoint";
export type TopologyRoute = {
  linkId: string;
  kind: "orthogonal" | "wireless";
  status: TopologyRouteStatus;
  source?: RouteAnchor;
  target?: RouteAnchor;
  points: Point[];
  labelPoint: Point;
  lane?: {
    anchorLaneIndex: number;
    corridorLaneIndex: number;
    spacing: number;
    reason?: "anchor-overlap" | "shared-corridor";
  };
  diagnostics?: {
    blockedByDeviceIds?: string[];
    reason?: string;
  };
};
export type RouteValidationResult = { valid: boolean; blockedByDeviceIds: string[]; reason?: string };
export type LinkVisualClass =
  | "speed-unknown"
  | "speed-copper-100"
  | "speed-copper-cat6"
  | "speed-fiber-1g"
  | "speed-fiber-10g"
  | "speed-fiber-40g"
  | "speed-wireless";

function roundCoordinate(value: number) {
  return Math.round(value * 100) / 100;
}

function uniqueSorted(values: number[]) {
  return [...new Set(values.map(roundCoordinate))].sort((a, b) => a - b);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function pointKey(point: Point) {
  return `${roundCoordinate(point.x)}:${roundCoordinate(point.y)}`;
}

function samePoint(left: Point, right: Point, tolerance = 0.001) {
  return Math.abs(left.x - right.x) <= tolerance && Math.abs(left.y - right.y) <= tolerance;
}

function deviceCenter(device: Device): Point {
  return { x: device.x + TOPOLOGY_NODE_WIDTH / 2, y: device.y + TOPOLOGY_NODE_HEIGHT / 2 };
}

export function deviceRoutingRect(device: Device, margin = OBSTACLE_MARGIN): Rect {
  return {
    left: device.x - margin,
    right: device.x + TOPOLOGY_NODE_WIDTH + margin,
    top: device.y - margin,
    bottom: device.y + TOPOLOGY_NODE_HEIGHT + margin,
  };
}

function deviceBoundaryRect(device: Device): Rect {
  return { left: device.x, right: device.x + TOPOLOGY_NODE_WIDTH, top: device.y, bottom: device.y + TOPOLOGY_NODE_HEIGHT };
}

function rectsOverlap(left: Rect, right: Rect) {
  return left.left <= right.right && left.right >= right.left && left.top <= right.bottom && left.bottom >= right.top;
}

function pointInsideRect(point: Point, rect: Rect) {
  return point.x > rect.left && point.x < rect.right && point.y > rect.top && point.y < rect.bottom;
}

export function segmentIntersectsRect(a: Point, b: Point, rect: Rect) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  let near = 0;
  let far = 1;
  const tests: Array<[number, number]> = [
    [-dx, a.x - rect.left],
    [dx, rect.right - a.x],
    [-dy, a.y - rect.top],
    [dy, rect.bottom - a.y],
  ];

  for (const [direction, distance] of tests) {
    if (Math.abs(direction) < 0.0001) {
      if (distance < 0) return false;
      continue;
    }
    const ratio = distance / direction;
    if (direction < 0) near = Math.max(near, ratio);
    else far = Math.min(far, ratio);
    if (near > far) return false;
  }
  return true;
}

function segmentIsClear(a: Point, b: Point, obstacles: Rect[]) {
  return obstacles.every((rect) => !segmentIntersectsRect(a, b, rect));
}

function segmentIsOrthogonal(a: Point, b: Point) {
  return roundCoordinate(a.x) === roundCoordinate(b.x) || roundCoordinate(a.y) === roundCoordinate(b.y);
}

export function selectNearestSide(device: Device, toward: Point): RouteSide {
  const center = deviceCenter(device);
  const dx = toward.x - center.x;
  const dy = toward.y - center.y;
  if (Math.abs(dx) > Math.abs(dy)) return dx >= 0 ? "right" : "left";
  if (Math.abs(dy) > Math.abs(dx)) return dy >= 0 ? "bottom" : "top";
  if (toward.x >= center.x) return "right";
  if (toward.y >= center.y) return "bottom";
  return "left";
}

function normalForSide(side: RouteSide): RouteAnchor["normal"] {
  if (side === "left") return { x: -1, y: 0 };
  if (side === "right") return { x: 1, y: 0 };
  if (side === "top") return { x: 0, y: -1 };
  return { x: 0, y: 1 };
}

export function computeRouteAnchor(device: Device, toward: Point, side = selectNearestSide(device, toward)): RouteAnchor {
  const center = deviceCenter(device);
  const normal = normalForSide(side);
  const point = side === "left" || side === "right"
    ? {
      x: side === "right" ? device.x + TOPOLOGY_NODE_WIDTH : device.x,
      y: clamp(toward.y, device.y + CORNER_PADDING, device.y + TOPOLOGY_NODE_HEIGHT - CORNER_PADDING),
    }
    : {
      x: clamp(toward.x, device.x + CORNER_PADDING, device.x + TOPOLOGY_NODE_WIDTH - CORNER_PADDING),
      y: side === "bottom" ? device.y + TOPOLOGY_NODE_HEIGHT : device.y,
    };
  return {
    deviceId: device.id,
    side,
    point,
    exitPoint: {
      x: point.x + normal.x * (OBSTACLE_MARGIN + GRID_CLEARANCE),
      y: point.y + normal.y * (OBSTACLE_MARGIN + GRID_CLEARANCE),
    },
    normal,
    baseAxisCoord: side === "left" || side === "right" ? point.y - center.y : point.x - center.x,
  };
}

function compactRoute(points: Point[]) {
  return points.filter((point, index) => {
    const previous = points[index - 1];
    const next = points[index + 1];
    if (!previous) return true;
    if (!next) return true;
    if (index === 1 || index === points.length - 2) return true;
    if (samePoint(previous, point)) return false;
    const sameVertical = roundCoordinate(previous.x) === roundCoordinate(point.x) && roundCoordinate(point.x) === roundCoordinate(next.x);
    const sameHorizontal = roundCoordinate(previous.y) === roundCoordinate(point.y) && roundCoordinate(point.y) === roundCoordinate(next.y);
    return !sameVertical && !sameHorizontal;
  });
}

function labelPointForRoute(points: Point[]): Point {
  let best = { length: -1, from: points[0] ?? { x: 0, y: 0 }, to: points[0] ?? { x: 0, y: 0 } };
  for (let index = 0; index < points.length - 1; index += 1) {
    const from = points[index];
    const to = points[index + 1];
    const length = Math.hypot(to.x - from.x, to.y - from.y);
    if (length > best.length) best = { length, from, to };
  }
  const dx = best.to.x - best.from.x;
  const dy = best.to.y - best.from.y;
  const length = Math.max(1, Math.hypot(dx, dy));
  let normalX = -dy / length;
  let normalY = dx / length;
  if (normalY > 0 || (Math.abs(normalY) < 0.01 && normalX < 0)) {
    normalX *= -1;
    normalY *= -1;
  }
  return {
    x: (best.from.x + best.to.x) / 2 + normalX * 14,
    y: (best.from.y + best.to.y) / 2 + normalY * 14,
  };
}

function addGridEdge(adjacency: Map<number, Array<{ to: number; distance: number; direction: 0 | 1 }>>, from: number, to: number, points: Point[]) {
  const direction = points[from].y === points[to].y ? 0 : 1;
  const distance = Math.abs(points[from].x - points[to].x) + Math.abs(points[from].y - points[to].y);
  adjacency.get(from)?.push({ to, distance, direction });
  adjacency.get(to)?.push({ to: from, distance, direction });
}

function pushQueue(queue: Array<{ key: string; cost: number }>, entry: { key: string; cost: number }) {
  queue.push(entry);
  let index = queue.length - 1;
  while (index > 0) {
    const parent = Math.floor((index - 1) / 2);
    if (queue[parent].cost <= queue[index].cost) break;
    [queue[parent], queue[index]] = [queue[index], queue[parent]];
    index = parent;
  }
}

function popQueue(queue: Array<{ key: string; cost: number }>) {
  const first = queue[0];
  const last = queue.pop();
  if (!last || queue.length === 0) return first;
  queue[0] = last;
  let index = 0;
  while (true) {
    const left = index * 2 + 1;
    const right = left + 1;
    let smallest = index;
    if (left < queue.length && queue[left].cost < queue[smallest].cost) smallest = left;
    if (right < queue.length && queue[right].cost < queue[smallest].cost) smallest = right;
    if (smallest === index) break;
    [queue[index], queue[smallest]] = [queue[smallest], queue[index]];
    index = smallest;
  }
  return first;
}

function gridRoute(start: Point, end: Point, obstacles: Rect[]) {
  if (obstacles.length > MAX_GRID_OBSTACLES) return undefined;
  const xs = uniqueSorted([
    start.x,
    end.x,
    ...obstacles.flatMap((rect) => [rect.left - GRID_CLEARANCE, rect.right + GRID_CLEARANCE]),
  ]);
  const ys = uniqueSorted([
    start.y,
    end.y,
    ...obstacles.flatMap((rect) => [rect.top - GRID_CLEARANCE, rect.bottom + GRID_CLEARANCE]),
  ]);
  const points: Point[] = [];
  const indexByKey = new Map<string, number>();

  for (const y of ys) {
    for (const x of xs) {
      const point = { x, y };
      if (obstacles.some((rect) => pointInsideRect(point, rect))) continue;
      indexByKey.set(pointKey(point), points.length);
      points.push(point);
    }
  }

  const startIndex = indexByKey.get(pointKey(start));
  const endIndex = indexByKey.get(pointKey(end));
  if (startIndex === undefined || endIndex === undefined) return undefined;
  const adjacency = new Map(points.map((_, index) => [index, [] as Array<{ to: number; distance: number; direction: 0 | 1 }>]));

  for (const y of ys) {
    const row = points.map((point, index) => ({ point, index })).filter(({ point }) => point.y === y).sort((a, b) => a.point.x - b.point.x);
    for (let index = 0; index < row.length - 1; index += 1) {
      if (segmentIsClear(row[index].point, row[index + 1].point, obstacles)) addGridEdge(adjacency, row[index].index, row[index + 1].index, points);
    }
  }
  for (const x of xs) {
    const column = points.map((point, index) => ({ point, index })).filter(({ point }) => point.x === x).sort((a, b) => a.point.y - b.point.y);
    for (let index = 0; index < column.length - 1; index += 1) {
      if (segmentIsClear(column[index].point, column[index + 1].point, obstacles)) addGridEdge(adjacency, column[index].index, column[index + 1].index, points);
    }
  }

  const startState = `${startIndex}:2`;
  const distance = new Map([[startState, 0]]);
  const previous = new Map<string, string>();
  const queue: Array<{ key: string; cost: number }> = [];
  pushQueue(queue, { key: startState, cost: 0 });
  let finalState: string | undefined;

  while (queue.length > 0) {
    const current = popQueue(queue);
    if (!current || current.cost !== distance.get(current.key)) continue;
    const [pointIndexText, directionText] = current.key.split(":");
    const pointIndex = Number(pointIndexText);
    const direction = Number(directionText);
    if (pointIndex === endIndex) {
      finalState = current.key;
      break;
    }
    for (const edge of adjacency.get(pointIndex) ?? []) {
      const bendCost = direction === 2 || direction === edge.direction ? 0 : BEND_PENALTY;
      const cost = current.cost + edge.distance + bendCost;
      const nextKey = `${edge.to}:${edge.direction}`;
      if (cost >= (distance.get(nextKey) ?? Number.POSITIVE_INFINITY)) continue;
      distance.set(nextKey, cost);
      previous.set(nextKey, current.key);
      pushQueue(queue, { key: nextKey, cost });
    }
  }

  if (!finalState) return undefined;
  const route: Point[] = [];
  for (let state: string | undefined = finalState; state; state = previous.get(state)) {
    route.push(points[Number(state.split(":")[0])]);
  }
  return compactRoute(route.reverse());
}

function safeOuterRoute(start: Point, end: Point, obstacles: Rect[]) {
  if (obstacles.length === 0) {
    const middle = start.x === end.x || start.y === end.y
      ? [start, end]
      : [start, { x: end.x, y: start.y }, end];
    return compactRoute(middle);
  }
  const minX = Math.min(...obstacles.map((rect) => rect.left), start.x, end.x) - 48;
  const maxX = Math.max(...obstacles.map((rect) => rect.right), start.x, end.x) + 48;
  const minY = Math.min(...obstacles.map((rect) => rect.top), start.y, end.y) - 48;
  const maxY = Math.max(...obstacles.map((rect) => rect.bottom), start.y, end.y) + 48;
  const candidates: Point[][] = [
    [start, { x: start.x, y: minY }, { x: end.x, y: minY }, end],
    [start, { x: start.x, y: maxY }, { x: end.x, y: maxY }, end],
    [start, { x: minX, y: start.y }, { x: minX, y: end.y }, end],
    [start, { x: maxX, y: start.y }, { x: maxX, y: end.y }, end],
  ].map(compactRoute);
  return candidates.find((points) => validateSegmentsOnly(points, obstacles).valid);
}

function validateSegmentsOnly(points: Point[], obstacles: Rect[]): RouteValidationResult {
  const blocked = new Set<string>();
  for (let index = 0; index < points.length - 1; index += 1) {
    const from = points[index];
    const to = points[index + 1];
    if (!segmentIsOrthogonal(from, to)) return { valid: false, blockedByDeviceIds: [], reason: "diagonal-segment" };
    obstacles.forEach((rect, rectIndex) => {
      if (segmentIntersectsRect(from, to, rect)) blocked.add(String(rectIndex));
    });
  }
  return { valid: blocked.size === 0, blockedByDeviceIds: [...blocked], reason: blocked.size ? "blocked-by-obstacle" : undefined };
}

function buildUnresolved(linkId: string, source: RouteAnchor, target: RouteAnchor, reason: string, blockedByDeviceIds?: string[]): TopologyRoute {
  const points = compactRoute([source.point, source.exitPoint, target.exitPoint, target.point]);
  return {
    linkId,
    kind: "orthogonal",
    status: "unresolved-no-path",
    source,
    target,
    points,
    labelPoint: labelPointForRoute(points),
    diagnostics: { reason, blockedByDeviceIds },
  };
}

export function buildBaseOrthogonalRoute(source: RouteAnchor, target: RouteAnchor, obstacles: Rect[], linkId = ""): TopologyRoute {
  const middle = gridRoute(source.exitPoint, target.exitPoint, obstacles)
    ?? safeOuterRoute(source.exitPoint, target.exitPoint, obstacles);
  if (!middle) return buildUnresolved(linkId, source, target, "no zero-collision orthogonal path");
  const points = compactRoute([source.point, source.exitPoint, ...middle, target.exitPoint, target.point]);
  const route: TopologyRoute = {
    linkId,
    kind: "orthogonal",
    status: "resolved",
    source,
    target,
    points,
    labelPoint: labelPointForRoute(points),
  };
  const validation = validateSegmentsOnly(points.slice(1, -1), obstacles);
  if (!validation.valid) {
    return { ...route, status: "unresolved-no-path", diagnostics: validation };
  }
  return route;
}

function routeWirelessLink(link: Link, from: Device, to: Device): TopologyRoute {
  const source = computeRouteAnchor(from, deviceCenter(to));
  const target = computeRouteAnchor(to, deviceCenter(from));
  const points = [source.point, target.point];
  return { linkId: link.id, kind: "wireless", status: "resolved", source, target, points, labelPoint: labelPointForRoute(points) };
}

export function routeTopologyLink(link: Link, project: Project): TopologyRoute | null {
  const from = project.devices.find((device) => device.id === link.from);
  const to = project.devices.find((device) => device.id === link.to);
  if (!from || !to) {
    return { linkId: link.id, kind: link.kind === "wireless" ? "wireless" : "orthogonal", status: "invalid-missing-endpoint", points: [], labelPoint: { x: 0, y: 0 } };
  }
  if (link.kind === "wireless") return routeWirelessLink(link, from, to);

  const fromCenter = deviceCenter(from);
  const toCenter = deviceCenter(to);
  const source = computeRouteAnchor(from, toCenter);
  const target = computeRouteAnchor(to, fromCenter);
  if (rectsOverlap(deviceRoutingRect(from), deviceRoutingRect(to))) {
    return buildUnresolved(link.id, source, target, "endpoint routing rectangles overlap", [from.id, to.id]);
  }
  const obstacles = project.devices
    .filter((device) => device.id !== from.id && device.id !== to.id)
    .map((device) => deviceRoutingRect(device));
  const route = buildBaseOrthogonalRoute(source, target, obstacles, link.id);
  const validation = validateOrthogonalRoute(route, project);
  return validation.valid ? route : { ...route, status: "unresolved-no-path", diagnostics: validation };
}

function laneOrder(index: number) {
  if (index === 0) return 0;
  const magnitude = Math.ceil(index / 2);
  return index % 2 === 1 ? magnitude : -magnitude;
}

function anchorGroupKey(anchor: RouteAnchor) {
  const bucket = Math.round(anchor.baseAxisCoord / ANCHOR_COLLISION_TOLERANCE);
  return `${anchor.deviceId}:${anchor.side}:${bucket}`;
}

type Segment = { linkId: string; index: number; a: Point; b: Point };

function routeSegments(route: TopologyRoute): Segment[] {
  const segments: Segment[] = [];
  for (let index = 0; index < route.points.length - 1; index += 1) {
    segments.push({ linkId: route.linkId, index, a: route.points[index], b: route.points[index + 1] });
  }
  return segments;
}

function corridorOverlap(left: Segment, right: Segment) {
  const leftHorizontal = roundCoordinate(left.a.y) === roundCoordinate(left.b.y);
  const rightHorizontal = roundCoordinate(right.a.y) === roundCoordinate(right.b.y);
  if (leftHorizontal !== rightHorizontal) return false;
  if (leftHorizontal) {
    if (roundCoordinate(left.a.y) !== roundCoordinate(right.a.y)) return false;
    const overlap = Math.min(Math.max(left.a.x, left.b.x), Math.max(right.a.x, right.b.x)) -
      Math.max(Math.min(left.a.x, left.b.x), Math.min(right.a.x, right.b.x));
    return overlap >= SHARED_CORRIDOR_OVERLAP;
  }
  if (roundCoordinate(left.a.x) !== roundCoordinate(right.a.x)) return false;
  const overlap = Math.min(Math.max(left.a.y, left.b.y), Math.max(right.a.y, right.b.y)) -
    Math.max(Math.min(left.a.y, left.b.y), Math.min(right.a.y, right.b.y));
  return overlap >= SHARED_CORRIDOR_OVERLAP;
}

function offsetRoute(route: TopologyRoute, laneIndex: number, reason: "anchor-overlap" | "shared-corridor") {
  if (!route.source || !route.target || laneIndex === 0) {
    return {
      ...route,
      lane: { anchorLaneIndex: laneIndex, corridorLaneIndex: laneIndex, spacing: LANE_SPACING, reason },
    };
  }
  const offset = clamp(laneIndex * LANE_SPACING, -MAX_ANCHOR_OFFSET, MAX_ANCHOR_OFFSET);
  const axis = Math.abs(route.points[0].x - route.points.at(-1)!.x) >= Math.abs(route.points[0].y - route.points.at(-1)!.y) ? "y" : "x";
  const shiftPoint = (point: Point) => axis === "y" ? { x: point.x, y: point.y + offset } : { x: point.x + offset, y: point.y };
  const points = route.points.map(shiftPoint);
  const shiftAnchor = (anchor: RouteAnchor): RouteAnchor => ({
    ...anchor,
    point: shiftPoint(anchor.point),
    exitPoint: shiftPoint(anchor.exitPoint),
    baseAxisCoord: anchor.baseAxisCoord + offset,
  });
  return {
    ...route,
    source: shiftAnchor(route.source),
    target: shiftAnchor(route.target),
    points: compactRoute(points),
    labelPoint: labelPointForRoute(points),
    lane: { anchorLaneIndex: laneIndex, corridorLaneIndex: laneIndex, spacing: LANE_SPACING, reason },
  };
}

export function assignRouteLanes(routes: Iterable<TopologyRoute>, project: Project): Map<string, TopologyRoute> {
  const byId = new Map([...routes].map((route) => [route.linkId, route]));
  const laneCandidates = new Map<string, { reason: "anchor-overlap" | "shared-corridor"; ids: Set<string> }>();
  const resolvedWired = [...byId.values()].filter((route) => route.kind === "orthogonal" && route.status === "resolved");

  const anchorGroups = new Map<string, string[]>();
  for (const route of resolvedWired) {
    for (const anchor of [route.source, route.target]) {
      if (!anchor) continue;
      const key = anchorGroupKey(anchor);
      anchorGroups.set(key, [...(anchorGroups.get(key) ?? []), route.linkId]);
    }
  }
  for (const ids of anchorGroups.values()) {
    const uniqueIds = [...new Set(ids)].sort();
    if (uniqueIds.length > 1) {
      laneCandidates.set(`anchor:${uniqueIds.join(":")}`, { reason: "anchor-overlap", ids: new Set(uniqueIds) });
    }
  }

  for (let leftIndex = 0; leftIndex < resolvedWired.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < resolvedWired.length; rightIndex += 1) {
      const shared = routeSegments(resolvedWired[leftIndex]).some((left) =>
        routeSegments(resolvedWired[rightIndex]).some((right) => corridorOverlap(left, right)),
      );
      if (shared) {
        const ids = [resolvedWired[leftIndex].linkId, resolvedWired[rightIndex].linkId].sort();
        laneCandidates.set(`corridor:${ids.join(":")}`, { reason: "shared-corridor", ids: new Set(ids) });
      }
    }
  }

  const laneById = new Map<string, { index: number; reason: "anchor-overlap" | "shared-corridor" }>();
  for (const candidate of laneCandidates.values()) {
    const ids = [...candidate.ids].sort();
    ids.forEach((id, index) => {
      const laneIndex = laneOrder(index);
      if (laneIndex === 0) return;
      const current = laneById.get(id);
      if (!current || Math.abs(laneIndex) > Math.abs(current.index)) {
        laneById.set(id, { index: laneIndex, reason: candidate.reason });
      }
    });
  }

  for (const [id, lane] of laneById) {
    const route = byId.get(id);
    if (!route) continue;
    const next = offsetRoute(route, lane.index, lane.reason);
    const validation = validateOrthogonalRoute(next, project);
    byId.set(id, validation.valid ? next : { ...route, status: "unresolved-no-path", diagnostics: validation });
  }
  return byId;
}

export function routeTopologyLinks(project: Project, links: Link[] = project.links): Map<string, TopologyRoute> {
  const routes = links
    .map((link) => routeTopologyLink(link, project))
    .filter((route): route is TopologyRoute => Boolean(route));
  return assignRouteLanes(routes, project);
}

export function validateOrthogonalRoute(route: TopologyRoute, project: Project): RouteValidationResult {
  if (route.kind === "wireless" || route.status === "invalid-missing-endpoint") return { valid: true, blockedByDeviceIds: [] };
  const blocked = new Set<string>();
  for (let index = 0; index < route.points.length - 1; index += 1) {
    const from = route.points[index];
    const to = route.points[index + 1];
    if (!segmentIsOrthogonal(from, to)) return { valid: false, blockedByDeviceIds: [], reason: "diagonal-segment" };
    for (const device of project.devices) {
      const endpoint = device.id === route.source?.deviceId || device.id === route.target?.deviceId;
      const rect = endpoint ? deviceBoundaryRect(device) : deviceRoutingRect(device);
      if (endpoint && (index === 0 || index === route.points.length - 2)) continue;
      if (segmentIntersectsRect(from, to, rect)) blocked.add(device.id);
    }
  }
  return { valid: blocked.size === 0, blockedByDeviceIds: [...blocked], reason: blocked.size ? "blocked-by-device" : undefined };
}

export function routePath(points: Point[]) {
  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${roundCoordinate(point.x)} ${roundCoordinate(point.y)}`).join(" ");
}

export function parseSpeedMbps(speed?: string) {
  const normalized = speed?.trim().toLowerCase().replaceAll(",", "");
  if (!normalized) return undefined;
  const value = Number.parseFloat(normalized);
  if (!Number.isFinite(value)) return undefined;
  if (/t(?:bps|bit|be|b\/s)?$/.test(normalized)) return value * 1_000_000;
  if (/g(?:bps|bit|be|b\/s)?$/.test(normalized)) return value * 1_000;
  if (/k(?:bps|bit|b\/s)?$/.test(normalized)) return value / 1_000;
  return value;
}

export function linkVisualClass(link: Pick<Link, "kind" | "speed">): LinkVisualClass {
  if (link.kind === "wireless") return "speed-wireless";
  const speed = parseSpeedMbps(link.speed);
  if (speed === undefined) return "speed-unknown";
  if (speed <= 100) return "speed-copper-100";
  if (speed < 1_000) return "speed-copper-cat6";
  if (speed < 10_000) return "speed-fiber-1g";
  if (speed < 40_000) return "speed-fiber-10g";
  return "speed-fiber-40g";
}
