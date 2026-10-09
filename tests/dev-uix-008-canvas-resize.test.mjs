import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const pageSource = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const cssSource = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("DEV_UIX_008 derives workspace height from the flex shell instead of a topbar subtraction", () => {
  assert.match(cssSource, /\.app-shell \{[^}]*height:\s*100dvh[^}]*display:\s*flex[^}]*flex-direction:\s*column/s);
  assert.match(cssSource, /\.topbar \{[^}]*flex:\s*0 0 auto/s);
  assert.match(cssSource, /\.workspace \{[^}]*height:\s*auto[^}]*min-height:\s*0[^}]*flex:\s*1 1 auto/s);
  assert.doesNotMatch(cssSource, /\.workspace\s*\{[^}]*calc\(100(?:d)?vh\s*-\s*var\(--topbar-height\)\)/s);
});

test("DEV_UIX_008 measures the ready canvas and passes panel resize dimensions to React Flow", () => {
  assert.match(pageSource, /const flowShellRef = useRef<HTMLDivElement>\(null\)/);
  assert.match(pageSource, /const observer = new ResizeObserver\(syncFlowViewportSize\)/);
  assert.match(pageSource, /observer\.observe\(shell\)/);
  assert.match(pageSource, /<div className="flow-shell" ref=\{flowShellRef\}>/);
  assert.match(pageSource, /width=\{flowViewportSize\.width \|\| undefined\}/);
  assert.match(pageSource, /height=\{flowViewportSize\.height \|\| undefined\}/);
  assert.doesNotMatch(pageSource, /<PanelGroup\s+key=\{`\$\{panelLayout\./);
});

test("DEV_UIX_008 performs one measured fit per topology without coupling fit to selection", () => {
  const fitEffect = pageSource.match(/const initialFitKey = activeTopologyId[\s\S]*?\n  \}, \[(?<dependencies>[^\]]+)\]\);/)?.[0] ?? "";
  const dependencies = pageSource.match(/const initialFitKey = activeTopologyId[\s\S]*?\n  \}, \[(?<dependencies>[^\]]+)\]\);/)?.groups?.dependencies ?? "";

  assert.ok(fitEffect, "one-time fit effect should exist");
  assert.match(fitEffect, /fittedTopologyRef\.current === initialFitKey/);
  assert.match(fitEffect, /flowInstance\.viewportInitialized/);
  assert.match(fitEffect, /node\.measured\?\.width && node\.measured\?\.height/);
  assert.match(fitEffect, /flowInstance\.fitView\(\{ padding: 0\.12, minZoom: 0\.25, maxZoom: 1\.2, duration: 0 \}\)/);
  assert.doesNotMatch(dependencies, /selection/);
  assert.doesNotMatch(pageSource, /\n\s+fitView\s*\n/);
});

test("DEV_UIX_008 waits for nodes from the active topology before consuming first fit", () => {
  const fitEffect = pageSource.match(/const initialFitKey = activeTopologyId[\s\S]*?\n  \}, \[(?<dependencies>[^\]]+)\]\);/)?.[0] ?? "";

  assert.match(fitEffect, /const topologyNodeSetKey = useMemo/);
  assert.match(fitEffect, /const flowNodeSetKey = useMemo/);
  assert.match(fitEffect, /canvasProject\.devices\.length === 0/);
  assert.doesNotMatch(fitEffect, /flowNodes\.length === 0\) \{\s*fittedTopologyRef\.current = initialFitKey/);
  assert.match(fitEffect, /flowNodeSetKey !== topologyNodeSetKey/);
  assert.match(fitEffect, /measuredNodeSetKey === topologyNodeSetKey/);
  assert.match(fitEffect, /fittedTopologyRef\.current = initialFitKey/);
});

test("DEV_UIX_008 keeps drag persistence at drag-stop only", () => {
  const onNodesChangeBody = pageSource.match(/const onNodesChange = useCallback\(\(changes: NodeChange\[]\) => \{(?<body>[\s\S]*?)\n  \}, \[canWriteActiveTopology\]\);/)?.groups?.body ?? "";
  const dragStopBody = pageSource.match(/const onNodeDragStop: OnNodeDrag = useCallback\([^)]*\) => \{(?<body>[\s\S]*?)\n  \}, \[canWriteActiveTopology, setProject\]\);/)?.groups?.body ?? "";

  assert.doesNotMatch(onNodesChangeBody, /setProject\(/);
  assert.match(dragStopBody, /setProject\(\(current\) =>/);
});
