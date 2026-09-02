import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const pageSource = readFileSync("app/page.tsx", "utf8");
const cssSource = readFileSync("app/globals.css", "utf8");

test("DEV_UIX_005 uses transient React Flow node state while dragging", () => {
  assert.match(pageSource, /const \[flowNodes,\s*setFlowNodes\] = useState<Node\[]>\(derivedNodes\)/);
  assert.match(pageSource, /const updatedNodes = applyNodeChanges\(changes,\s*currentNodes\)/);
  assert.match(pageSource, /latestNodePositionsRef\.current = new Map\(updatedNodes\.map/);
  assert.match(pageSource, /const onNodeDrag: OnNodeDrag = useCallback/);
  assert.match(pageSource, /nodes=\{flowNodes\}/);
  assert.match(pageSource, /nodesDraggable=\{canWriteActiveTopology\}/);
});

test("DEV_UIX_005 persists device coordinates once on node drag stop", () => {
  const onNodesChangeBody = pageSource.match(/const onNodesChange = useCallback\(\(changes: NodeChange\[]\) => \{(?<body>[\s\S]*?)\n  \}, \[canWriteActiveTopology\]\);/)?.groups?.body ?? "";
  const dragStopBody = pageSource.match(/const onNodeDragStop: OnNodeDrag = useCallback\(\([^)]*\) => \{(?<body>[\s\S]*?)\n  \}, \[canWriteActiveTopology, setProject\]\);/)?.groups?.body ?? "";

  assert.ok(onNodesChangeBody, "onNodesChange body should be detected");
  assert.ok(dragStopBody, "onNodeDragStop body should be detected");
  assert.doesNotMatch(onNodesChangeBody, /setProject\(/);
  assert.match(dragStopBody, /setProject\(\(current\) =>/);
  assert.match(dragStopBody, /device\.id !== node\.id/);
  assert.match(dragStopBody, /x: nextPosition\.x,\s*y: nextPosition\.y/s);
});

test("DEV_UIX_005 link overlay keeps node drag surface available", () => {
  assert.match(cssSource, /\.flow-link-overlay\s*\{[^}]*pointer-events:\s*none/s);
  assert.match(cssSource, /\.flow-link \.hit-line\s*\{[^}]*pointer-events:\s*stroke/s);
});
