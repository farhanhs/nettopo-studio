import assert from "node:assert/strict";
import test from "node:test";

import { SEAN_SPINE_LEAF_PROJECT } from "../app/lib/demo-topologies.ts";
import {
  deviceRoutingRect,
  linkVisualClass,
  parseSpeedMbps,
  routeTopologyLink,
  segmentIntersectsRect,
} from "../app/lib/topology-routing.ts";

function device(id, x, y, type = "server") {
  return { id, name: id, type, x, y };
}

test("clear diagonal links use a direct path between node boundaries", () => {
  const project = {
    devices: [device("from", 0, 0, "switch"), device("to", 360, 260)],
    links: [{ id: "link", from: "from", to: "to", kind: "wired", speed: "25 Gbps" }],
    groups: [],
  };
  const route = routeTopologyLink(project.links[0], project);

  assert.equal(route?.kind, "direct");
  assert.equal(route?.points.length, 2);
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
  assert.ok((route?.points.length ?? 0) >= 4);
  for (let index = 0; index < route.points.length - 1; index += 1) {
    assert.equal(segmentIntersectsRect(route.points[index], route.points[index + 1], deviceRoutingRect(blocker)), false);
  }
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
