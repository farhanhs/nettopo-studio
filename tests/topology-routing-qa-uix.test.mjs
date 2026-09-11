import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  deviceRoutingRect,
  routeTopologyLinks,
  routeTopologyLink,
  segmentIntersectsRect,
  validateOrthogonalRoute,
} from "../app/lib/topology-routing.ts";

function device(id, x, y, type = "server") {
  return { id, name: id, type, x, y };
}

function assertResolvedOrthogonal(route, project, link) {
  assert.equal(route.kind, "orthogonal", link.id);
  assert.equal(route.status, "resolved", link.id);
  assert.equal(validateOrthogonalRoute(route, project).valid, true, link.id);
  for (let index = 0; index < route.points.length - 1; index += 1) {
    const from = route.points[index];
    const to = route.points[index + 1];
    assert.ok(from.x === to.x || from.y === to.y, `${link.id} segment ${index} is diagonal`);
  }
}

test("QA_UIX_001: diagonal wired route never falls back to a direct segment", () => {
  const project = {
    devices: [device("a", 0, 0, "switch"), device("b", 420, 260, "server")],
    links: [{ id: "diagonal-wired", from: "a", to: "b", kind: "wired" }],
    groups: [],
  };
  const route = routeTopologyLink(project.links[0], project);

  assert.ok(route);
  assertResolvedOrthogonal(route, project, project.links[0]);
  assert.ok(route.points.length >= 3, "clear diagonal wired route must use a bend instead of a two-point diagonal");
});

test("QA_UIX_001: blocker avoidance does not intersect padded non-endpoint device rects", () => {
  const blocker = device("blocker", 300, 0, "switch");
  const project = {
    devices: [device("left", 0, 0, "switch"), blocker, device("right", 620, 0, "switch")],
    links: [{ id: "blocked-corridor", from: "left", to: "right", kind: "wired" }],
    groups: [],
  };
  const route = routeTopologyLink(project.links[0], project);

  assert.ok(route);
  assertResolvedOrthogonal(route, project, project.links[0]);
  for (let index = 0; index < route.points.length - 1; index += 1) {
    assert.equal(
      segmentIntersectsRect(route.points[index], route.points[index + 1], deviceRoutingRect(blocker)),
      false,
      `segment ${index} crosses blocker padded rect`,
    );
  }
});

test("QA_UIX_001: no safe wired path reports unresolved instead of drawing through overlapping devices", () => {
  const project = {
    devices: [device("a", 0, 0, "switch"), device("b", 95, 15, "server")],
    links: [{ id: "overlap", from: "a", to: "b", kind: "wired" }],
    groups: [],
  };
  const route = routeTopologyLink(project.links[0], project);

  assert.ok(route);
  assert.equal(route.kind, "orthogonal");
  assert.equal(route.status, "unresolved-no-path");
  assert.match(route.diagnostics?.reason ?? "", /overlap|No safe/i);
});

test("QA_UIX_001: lane assignment is deterministic and only applies to shared corridors", () => {
  const project = {
    devices: [
      device("core", 0, 0, "switch"),
      device("leaf", 430, 0, "switch"),
      device("north", 210, -260, "server"),
      device("south", 210, 260, "server"),
    ],
    links: [
      { id: "corridor-a", from: "core", to: "leaf", kind: "wired" },
      { id: "corridor-b", from: "core", to: "leaf", kind: "wired" },
      { id: "crossing-only", from: "north", to: "south", kind: "wired" },
    ],
    groups: [],
  };

  const forward = routeTopologyLinks(project, project.links);
  const reversed = routeTopologyLinks(project, [...project.links].reverse());

  assert.deepEqual(
    [...forward].map(([id, route]) => [id, route.lane?.anchorLaneIndex ?? 0, route.lane?.corridorLaneIndex ?? 0]).sort(),
    [...reversed].map(([id, route]) => [id, route.lane?.anchorLaneIndex ?? 0, route.lane?.corridorLaneIndex ?? 0]).sort(),
  );
  assert.ok(forward.get("corridor-a")?.lane || forward.get("corridor-b")?.lane, "shared corridor should receive a lane");
  assert.equal(forward.get("crossing-only")?.lane, undefined, "crossing-only route must not receive a lane");
});

test("QA_UIX_001: wireless remains an explicit direct exception outside wired invariants", () => {
  const project = {
    devices: [device("ap", 0, 0, "access-point"), device("client", 420, 240, "client")],
    links: [{ id: "wireless", from: "ap", to: "client", kind: "wireless" }],
    groups: [],
  };
  const route = routeTopologyLink(project.links[0], project);

  assert.ok(route);
  assert.equal(route.kind, "wireless");
  assert.equal(route.status, "resolved");
  assert.equal(route.points.length, 2);
  assert.notEqual(route.points[0].x, route.points[1].x);
  assert.notEqual(route.points[0].y, route.points[1].y);
});

test("QA_UIX_001: route, anchor, and lane are view-only and absent from durable project schemas", async () => {
  const durableSources = await Promise.all([
    readFile(new URL("../app/lib/topology-types.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/topology-store.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/topology-postgres.ts", import.meta.url), "utf8"),
  ]);
  for (const source of durableSources) {
    assert.doesNotMatch(source, /\bRouteAnchor\b|\bTopologyRoute\b|\brouteTopologyLinks\b|\banchorLaneIndex\b|\bcorridorLaneIndex\b/);
  }
});

test("QA_UIX_001: page overlay renders route kind/status and selected hit-area styles stay visible", async () => {
  const [page, css] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(page, /routeTopologyLinks\(canvasProject,\s*renderedCanvasLinks\)/);
  assert.match(page, /data-route-kind=\{route\.kind\}/);
  assert.match(page, /data-route-status=\{route\.status\}/);
  assert.match(page, /路徑受阻，請調整設備位置/);
  assert.match(page, /selection-line/);
  assert.match(page, /hit-line/);

  assert.match(css, /\.flow-link \.hit-line[\s\S]*stroke-width:\s*22/);
  assert.match(css, /\.flow-link\.selected \.visible-line[\s\S]*stroke-width:\s*5\.4/);
  assert.match(css, /\.flow-link\.unresolved-no-path \.visible-line[\s\S]*stroke-dasharray/);
  assert.match(css, /\.flow-link\.speed-wireless \.visible-line[\s\S]*stroke-dasharray:\s*8 6/);
});
