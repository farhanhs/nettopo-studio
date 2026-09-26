import { AIL_LIMITS, LayoutContractError } from "./topology-layout-contract.ts";
import type { LayoutWorkerRequest, LayoutWorkerResponse } from "./topology-layout-worker.ts";

export type LayoutWorkerLike = {
  postMessage(value: LayoutWorkerRequest): void;
  terminate(): void;
  onmessage: ((event: MessageEvent<LayoutWorkerResponse>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
};
export type LayoutWorkerFactory = () => LayoutWorkerLike;
const browserWorker: LayoutWorkerFactory = () => new Worker(new URL("./topology-layout-worker.ts", import.meta.url), { type: "module", name: "nettopo-layout" });

export function runLayoutWorker(input: LayoutWorkerRequest, options: { timeoutMs?: number; signal?: AbortSignal; createWorker?: LayoutWorkerFactory } = {}) {
  const timeoutMs = options.timeoutMs ?? AIL_LIMITS.candidateTimeoutMs;
  const worker = (options.createWorker ?? browserWorker)();
  return new Promise<LayoutWorkerResponse>((resolve, reject) => {
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", abort);
      worker.onmessage = null;
      worker.onerror = null;
      worker.terminate();
      callback();
    };
    const abort = () => finish(() => reject(new DOMException("Layout cancelled", "AbortError")));
    const timer = setTimeout(() => finish(() => reject(new LayoutContractError("TIMEOUT"))), timeoutMs);
    worker.onmessage = (event) => {
      if (event.data.requestId !== input.requestId) return;
      finish(() => resolve(event.data));
    };
    worker.onerror = () => finish(() => reject(new LayoutContractError("NO_SAFE_LAYOUT")));
    if (options.signal?.aborted) abort();
    else {
      options.signal?.addEventListener("abort", abort, { once: true });
      try {
        worker.postMessage(structuredClone(input));
      } catch (error) {
        finish(() => reject(error));
      }
    }
  });
}

export async function runQuickLayout(project: LayoutWorkerRequest["project"], topologyId: string, requestedMode: LayoutWorkerRequest["request"]["requestedMode"], signal?: AbortSignal) {
  const requestId = `quick-${crypto.randomUUID()}`;
  const result = await runLayoutWorker({ requestId, topologyId, project, request: {
    requestId, topologyId, track: "quick", requestedMode, objective: "balanced", pinnedDeviceIds: [], preserveGroups: true,
  } }, { signal });
  if (!result.ok || !result.selection.recommended) throw new LayoutContractError("NO_SAFE_LAYOUT");
  return result.selection.recommended;
}
