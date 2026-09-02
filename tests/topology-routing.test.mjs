import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import test from "node:test";

import { SEAN_SPINE_LEAF_PROJECT } from "../app/lib/demo-topologies.ts";
import {
  assignRouteLanes,
  computeRouteAnchor,
  deviceRoutingRect,
  linkVisualClass,
  parseSpeedMbps,
  routeTopologyLinks,
  routeTopologyLink,
  selectNearestSide,
  segmentIntersectsRect,
  validateOrthogonalRoute,
} from "../app/lib/topology-routing.ts";

function device(id, x, y, type = "server") {
  return { id, name: id, type, x, y };
}

function assertOrthogonal(route) {
  assert.equal(route.kind, "orthogonal");
  for (let index = 0; index < route.points.length - 1; index += 1) {
    const from = route.points[index];
    const to = route.points[index + 1];
    assert.ok(from.x === to.x || from.y === to.y, `segment ${index} is diagonal`);
  }
}

test("clear diagonal wired links use an orthogonal path between nearest boundaries", () => {
  const project = {
    devices: [device("from", 0, 0, "switch"), device("to", 360, 260)],
    links: [{ id: "link", from: "from", to: "to", kind: "wired", speed: "25 Gbps" }],
    groups: [],
  };
  const route = routeTopologyLink(project.links[0], project);

  assert.equal(route?.status, "resolved");
  assertOrthogonal(route);
  assert.equal(route?.source?.side, "right");
  assert.equal(route?.target?.side, "left");
  assert.equal(validateOrthogonalRoute(route, project).valid, true);
});

test("horizontal, vertical, and diagonal wired directions are always orthogonal", () => {
  const cases = [
    ["horizontal", device("from", 0, 0, "switch"), device("to", 360, 0)],
    ["vertical", device("from", 0, 0, "switch"), device("to", 0, 260)],
    ["down-right", device("from", 0, 0, "switch"), device("to", 360, 260)],
    ["up-right", device("from", 0, 260, "switch"), device("to", 360, 0)],
    ["down-left", device("from", 360, 0, "switch"), device("to", 0, 260)],
    ["up-left", device("from", 360, 260, "switch"), device("to", 0, 0)],
  ];
  for (const [name, from, to] of cases) {
    const project = { devices: [from, to], links: [{ id: String(name), from: "from", to: "to", kind: "wired" }], groups: [] };
    const route = routeTopologyLink(project.links[0], project);
    assert.equal(route?.status, "resolved", String(name));
    assertOrthogonal(route);
  }
});

test("nearest-side anchors clamp away from corners", () => {
  const source = device("source", 100, 100, "switch");
  assert.equal(selectNearestSide(source, { x: 500, y: 130 }), "right");
  assert.equal(selectNearestSide(source, { x: 130, y: 500 }), "bottom");
  const anchor = computeRouteAnchor(source, { x: 500, y: -100 }, "right");
  assert.equal(anchor.point.x, 278);
  assert.ok(anchor.point.y >= 112);
  assert.ok(anchor.point.y <= 200);
});

test("blocked links use multiple orthogonal bends without crossing the blocker", () => {
  const blocker = device("blocker", 300, 0);
  const project = {
    devices: [device("from", 0, 0, "switch"), blocker, device("to", 600, 0)],
    links: [{ id: "link", from: "from", to: "to", kind: "wired", speed: "1 Gbps" }],
    groups: [],
  };
  const route = routeTopologyLink(project.links[0], project);

  assert.equal(route?.kind, "orthogonal");
  assert.equal(route?.status, "resolved");
  assert.ok((route?.points.length ?? 0) >= 4);
  for (let index = 0; index < route.points.length - 1; index += 1) {
    assert.equal(segmentIntersectsRect(route.points[index], route.points[index + 1], deviceRoutingRect(blocker)), false);
  }
});

test("overlapping endpoint routing rectangles return unresolved instead of drawing through devices", () => {
  const project = {
    devices: [device("from", 0, 0, "switch"), device("to", 100, 20)],
    links: [{ id: "link", from: "from", to: "to", kind: "wired" }],
    groups: [],
  };
  const route = routeTopologyLink(project.links[0], project);

  assert.equal(route?.kind, "orthogonal");
  assert.equal(route?.status, "unresolved-no-path");
});

test("lanes are not assigned for routes that cross but do not share a corridor", () => {
  const routes = [
    { linkId: "horizontal", kind: "orthogonal", status: "resolved", points: [{ x: 0, y: 50 }, { x: 120, y: 50 }], labelPoint: { x: 60, y: 50 } },
    { linkId: "vertical", kind: "orthogonal", status: "resolved", points: [{ x: 60, y: 0 }, { x: 60, y: 120 }], labelPoint: { x: 60, y: 60 } },
  ];
  const laneMap = assignRouteLanes(routes, { devices: [], links: [], groups: [] });
  assert.equal(laneMap.get("horizontal")?.lane, undefined);
  assert.equal(laneMap.get("vertical")?.lane, undefined);
});

test("lane assignment is input-order independent", () => {
  const project = {
    devices: [
      device("core", 0, 0, "switch"),
      device("leaf", 420, 0, "switch"),
    ],
    links: [
      { id: "a", from: "core", to: "leaf", kind: "wired" },
      { id: "b", from: "core", to: "leaf", kind: "wired" },
      { id: "c", from: "core", to: "leaf", kind: "wired" },
    ],
    groups: [],
  };
  const forward = routeTopologyLinks(project, project.links);
  const reversed = routeTopologyLinks(project, [...project.links].reverse());

  assert.deepEqual(
    [...forward].map(([id, route]) => [id, route.lane?.corridorLaneIndex ?? 0]).sort(),
    [...reversed].map(([id, route]) => [id, route.lane?.corridorLaneIndex ?? 0]).sort(),
  );
});

test("same-anchor links receive stable symmetric lanes", () => {
  const project = {
    devices: [
      device("core", 0, 0, "switch"),
      device("leaf", 420, 0, "switch"),
    ],
    links: [
      { id: "a", from: "core", to: "leaf", kind: "wired" },
      { id: "b", from: "core", to: "leaf", kind: "wired" },
      { id: "c", from: "core", to: "leaf", kind: "wired" },
    ],
    groups: [],
  };
  const lanes = [...routeTopologyLinks(project, project.links).values()]
    .map((route) => route.lane?.anchorLaneIndex ?? 0)
    .sort((a, b) => a - b);
  assert.deepEqual(lanes, [-1, 0, 1]);
});

test("spine-leaf routes avoid every non-endpoint device after row layout", () => {
  const endpointPositions = [
    [-120, 430], [120, 430], [360, 430], [600, 430], [840, 430], [1080, 430],
    [0, 600], [240, 600], [480, 600], [720, 600], [960, 600],
  ];
  let endpointIndex = 0;
  const project = {
    ...SEAN_SPINE_LEAF_PROJECT,
    devices: SEAN_SPINE_LEAF_PROJECT.devices.map((item) => {
      if (item.id === "router-01") return { ...item, x: 480, y: 90 };
      if (item.id === "spine-01") return { ...item, x: 360, y: 260 };
      if (item.id === "spine-02") return { ...item, x: 600, y: 260 };
      const [x, y] = endpointPositions[endpointIndex++];
      return { ...item, x, y };
    }),
  };

  for (const link of project.links) {
    const route = routeTopologyLink(link, project);
    assert.ok(route, link.id);
    if (route.kind === "orthogonal") assertOrthogonal(route);
    if (route.status !== "resolved") continue;
    const obstacles = project.devices.filter((item) => item.id !== link.from && item.id !== link.to);
    for (let index = 0; index < route.points.length - 1; index += 1) {
      for (const obstacle of obstacles) {
        assert.equal(
          segmentIntersectsRect(route.points[index], route.points[index + 1], deviceRoutingRect(obstacle, 2)),
          false,
          `${link.id} crosses ${obstacle.id}`,
        );
      }
    }
  }
});

test("wireless links keep the explicit direct dashed-route exception", () => {
  const project = {
    devices: [device("ap", 0, 0, "access-point"), device("client", 360, 260, "client")],
    links: [{ id: "wifi", from: "ap", to: "client", kind: "wireless", speed: "1 Gbps" }],
    groups: [],
  };
  const route = routeTopologyLink(project.links[0], project);

  assert.equal(route?.kind, "wireless");
  assert.equal(route?.status, "resolved");
  assert.equal(route?.points.length, 2);
});

test("60-device and 120-wired-link route calculation stays within the pilot budget", () => {
  const devices = Array.from({ length: 60 }, (_, index) =>
    device(`d-${index}`, (index % 10) * 240, Math.floor(index / 10) * 180, index % 5 === 0 ? "switch" : "server"),
  );
  const links = Array.from({ length: 120 }, (_, index) => ({
    id: `l-${index}`,
    from: `d-${index % 60}`,
    to: `d-${(index * 7 + 13) % 60}`,
    kind: "wired",
    speed: "1 Gbps",
  })).filter((link) => link.from !== link.to);
  const start = performance.now();
  const routes = routeTopologyLinks({ devices, links, groups: [] }, links);
  const elapsed = performance.now() - start;

  assert.equal(routes.size, links.length);
  assert.ok(elapsed < 120, `routing took ${elapsed.toFixed(2)}ms`);
});

test("speed parser and visual classes cover copper, fiber, and wireless links", () => {
  assert.equal(parseSpeedMbps("100 Mbps"), 100);
  assert.equal(parseSpeedMbps("2.5 Gbps"), 2500);
  assert.equal(parseSpeedMbps("100 GbE"), 100000);
  assert.equal(parseSpeedMbps("100G"), 100000);
  assert.equal(linkVisualClass({ kind: "wired", speed: "100 Mbps" }), "speed-copper-100");
  assert.equal(linkVisualClass({ kind: "wired", speed: "500 Mbps" }), "speed-copper-cat6");
  assert.equal(linkVisualClass({ kind: "wired", speed: "1 Gbps" }), "speed-fiber-1g");
  assert.equal(linkVisualClass({ kind: "wired", speed: "25 Gbps" }), "speed-fiber-10g");
  assert.equal(linkVisualClass({ kind: "wired", speed: "100 Gbps" }), "speed-fiber-40g");
  assert.equal(linkVisualClass({ kind: "wireless", speed: "1 Gbps" }), "speed-wireless");
});
