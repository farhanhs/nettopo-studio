import { linkEndpointOffset } from "./topology-layout.ts";
import type { Device, Link, Project } from "./topology-types";

export const TOPOLOGY_NODE_WIDTH = 178;
export const TOPOLOGY_NODE_HEIGHT = 112;

const OBSTACLE_MARGIN = 14;
const GRID_CLEARANCE = 6;
const BEND_PENALTY = 34;
const MAX_GRID_OBSTACLES = 60;

export type Point = { x: number; y: number };
export type Rect = { left: number; right: number; top: number; bottom: number };
export type TopologyRoute = { points: Point[]; labelPoint: Point; kind: "direct" | "orthogonal" };
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

function pointInsideRect(point: Point, rect: Rect) {
  return point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom;
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

function routeIntersectionCount(points: Point[], obstacles: Rect[]) {
  let count = 0;
  for (let index = 0; index < points.length - 1; index += 1) {
    for (const obstacle of obstacles) {
      if (segmentIntersectsRect(points[index], points[index + 1], obstacle)) count += 1;
    }
  }
  return count;
}

function boundaryAnchor(device: Device, toward: Point, offset: number): Point {
  const center = deviceCenter(device);
  const dx = toward.x - center.x;
  const dy = toward.y - center.y;
  const halfWidth = TOPOLOGY_NODE_WIDTH / 2;
  const halfHeight = TOPOLOGY_NODE_HEIGHT / 2;
  const xScale = Math.abs(dx) < 0.0001 ? Number.POSITIVE_INFINITY : halfWidth / Math.abs(dx);
  const yScale = Math.abs(dy) < 0.0001 ? Number.POSITIVE_INFINITY : halfHeight / Math.abs(dy);
  const scale = Math.min(xScale, yScale);

  if (xScale <= yScale) {
    return {
      x: center.x + dx * scale,
      y: clamp(center.y + dy * scale + offset, device.y + 10, device.y + TOPOLOGY_NODE_HEIGHT - 10),
    };
  }
  return {
    x: clamp(center.x + dx * scale + offset, device.x + 10, device.x + TOPOLOGY_NODE_WIDTH - 10),
    y: center.y + dy * scale,
  };
}

function orthogonalPort(device: Device, toward: Point, offset: number) {
  const center = deviceCenter(device);
  const dx = toward.x - center.x;
  const dy = toward.y - center.y;
  const horizontal = Math.abs(dx) >= Math.abs(dy);
  if (horizontal) {
    const direction = dx >= 0 ? 1 : -1;
    const anchor = {
      x: direction > 0 ? device.x + TOPOLOGY_NODE_WIDTH : device.x,
      y: clamp(center.y + offset, device.y + 10, device.y + TOPOLOGY_NODE_HEIGHT - 10),
    };
    return { anchor, exit: { x: anchor.x + direction * (OBSTACLE_MARGIN + GRID_CLEARANCE), y: anchor.y } };
  }
  const direction = dy >= 0 ? 1 : -1;
  const anchor = {
    x: clamp(center.x + offset, device.x + 10, device.x + TOPOLOGY_NODE_WIDTH - 10),
    y: direction > 0 ? device.y + TOPOLOGY_NODE_HEIGHT : device.y,
  };
  return { anchor, exit: { x: anchor.x, y: anchor.y + direction * (OBSTACLE_MARGIN + GRID_CLEARANCE) } };
}

function compactRoute(points: Point[]) {
  return points.filter((point, index) => {
    const previous = points[index - 1];
    const next = points[index + 1];
    if (!previous) return true;
    if (previous.x === point.x && previous.y === point.y) return false;
    if (!next) return true;
    const sameVertical = previous.x === point.x && point.x === next.x;
    const sameHorizontal = previous.y === point.y && point.y === next.y;
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
  const adjacency = new Map(points.map((_, index) => [index, [] as Array<{ to: number; distance: number; direction: 0 | 1 }> ]));

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

function fallbackRoute(start: Point, end: Point, obstacles: Rect[]) {
  const minX = Math.min(...obstacles.map((rect) => rect.left), start.x, end.x) - 48;
  const maxX = Math.max(...obstacles.map((rect) => rect.right), start.x, end.x) + 48;
  const minY = Math.min(...obstacles.map((rect) => rect.top), start.y, end.y) - 48;
  const maxY = Math.max(...obstacles.map((rect) => rect.bottom), start.y, end.y) + 48;
  const candidates: Point[][] = [
    [start, { x: start.x, y: minY }, { x: end.x, y: minY }, end],
    [start, { x: start.x, y: maxY }, { x: end.x, y: maxY }, end],
    [start, { x: minX, y: start.y }, { x: minX, y: end.y }, end],
    [start, { x: maxX, y: start.y }, { x: maxX, y: end.y }, end],
  ];
  return candidates.sort((left, right) =>
    routeIntersectionCount(left, obstacles) - routeIntersectionCount(right, obstacles),
  )[0];
}

export function routeTopologyLink(link: Link, project: Project): TopologyRoute | null {
  const from = project.devices.find((device) => device.id === link.from);
  const to = project.devices.find((device) => device.id === link.to);
  if (!from || !to) return null;
  const fromCenter = deviceCenter(from);
  const toCenter = deviceCenter(to);
  const fromHorizontal = Math.abs(toCenter.x - fromCenter.x) >= Math.abs(toCenter.y - fromCenter.y);
  const toHorizontal = Math.abs(fromCenter.x - toCenter.x) >= Math.abs(fromCenter.y - toCenter.y);
  const fromOffset = linkEndpointOffset(project, from.id, link.id, fromHorizontal ? TOPOLOGY_NODE_HEIGHT : TOPOLOGY_NODE_WIDTH);
  const toOffset = linkEndpointOffset(project, to.id, link.id, toHorizontal ? TOPOLOGY_NODE_HEIGHT : TOPOLOGY_NODE_WIDTH);
  const directStart = boundaryAnchor(from, toCenter, fromOffset);
  const directEnd = boundaryAnchor(to, fromCenter, toOffset);
  const otherObstacles = project.devices
    .filter((device) => device.id !== from.id && device.id !== to.id)
    .map((device) => deviceRoutingRect(device));

  if (segmentIsClear(directStart, directEnd, otherObstacles)) {
    const points = [directStart, directEnd];
    return { points, labelPoint: labelPointForRoute(points), kind: "direct" };
  }

  const fromPort = orthogonalPort(from, toCenter, fromOffset);
  const toPort = orthogonalPort(to, fromCenter, toOffset);
  const allObstacles = project.devices.map((device) => deviceRoutingRect(device));
  const middle = gridRoute(fromPort.exit, toPort.exit, allObstacles)
    ?? fallbackRoute(fromPort.exit, toPort.exit, allObstacles);
  const points = compactRoute([fromPort.anchor, ...middle, toPort.anchor]);
  return { points, labelPoint: labelPointForRoute(points), kind: "orthogonal" };
}

export function routePath(points: Point[]) {
  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
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
