/// <reference lib="webworker" />
import { buildLayoutDraft, captureLayoutSnapshot } from "./topology-layout-core.ts";
import { selectLayoutCandidate } from "./topology-layout-quality.ts";
import type { LayoutRequest } from "./topology-layout-contract.ts";
import type { Project } from "./topology-types";

export type LayoutWorkerRequest = { requestId: string; topologyId: string; project: Project; request: Omit<LayoutRequest, "baseRevision" | "graphHash" | "geometryVersion"> };
export type LayoutWorkerResponse = { requestId: string; ok: true; selection: ReturnType<typeof selectLayoutCandidate> } |
  { requestId: string; ok: false; error: "NO_SAFE_LAYOUT" };

self.onmessage = async (event: MessageEvent<LayoutWorkerRequest>) => {
  const input = event.data;
  try {
    const snapshot = await captureLayoutSnapshot(input.project, { topologyId: input.topologyId });
    const request = { ...input.request, baseRevision: snapshot.baseRevision, graphHash: snapshot.graphHash, geometryVersion: snapshot.geometryVersion };
    const draft = await buildLayoutDraft(snapshot, request);
    const selection = selectLayoutCandidate(snapshot, [
      { source: "original", value: [] },
      { source: "quick", value: draft, requestId: input.requestId },
    ]);
    self.postMessage({ requestId: input.requestId, ok: true, selection } satisfies LayoutWorkerResponse);
  } catch {
    self.postMessage({ requestId: input.requestId, ok: false, error: "NO_SAFE_LAYOUT" } satisfies LayoutWorkerResponse);
  }
};
