export type PrintOrientation = "landscape" | "portrait";
export type PrintBounds = { x: number; y: number; width: number; height: number };

const PX_PER_MM = 96 / 25.4;
const PAGE_MARGIN_MM = 8;
const CONTENT_PADDING = 16;

export function fitTopologyToPage(bounds: PrintBounds, orientation: PrintOrientation) {
  if (orientation !== "landscape" && orientation !== "portrait") throw new Error("Invalid print orientation");
  const width = ((orientation === "landscape" ? 297 : 210) - 2 * PAGE_MARGIN_MM) * PX_PER_MM;
  // Leave a sub-pixel rounding allowance so Chromium never adds a blank second page.
  const height = ((orientation === "landscape" ? 210 : 297) - 2 * PAGE_MARGIN_MM) * PX_PER_MM - 1;
  if (![bounds.x, bounds.y, bounds.width, bounds.height].every(Number.isFinite) || bounds.width < 0 || bounds.height < 0) {
    throw new Error("Invalid print bounds");
  }
  const scale = Math.min(1, (width - 2 * CONTENT_PADDING) / Math.max(1, bounds.width), (height - 2 * CONTENT_PADDING) / Math.max(1, bounds.height));
  return { width, height, scale, x: (width - bounds.width * scale) / 2 - bounds.x * scale,
    y: (height - bounds.height * scale) / 2 - bounds.y * scale };
}

export function measureTopologyPrint(source: HTMLElement, orientation: PrintOrientation) {
  const viewport = source.querySelector<HTMLElement>(".react-flow__viewport");
  if (!viewport) throw new Error("Canvas not ready");
  const origin = viewport.getBoundingClientRect();
  const zoom = new DOMMatrixReadOnly(getComputedStyle(viewport).transform).a;
  if (!Number.isFinite(zoom) || zoom <= 0) throw new Error("Canvas not ready");
  const rects = [...viewport.querySelectorAll(".react-flow__node, .flow-link")].map(e => e.getBoundingClientRect());
  const visible = rects.filter(r => r.width > 0 || r.height > 0);
  const left = visible.length ? Math.min(...visible.map(r => r.left)) : origin.left;
  const top = visible.length ? Math.min(...visible.map(r => r.top)) : origin.top;
  const right = visible.length ? Math.max(...visible.map(r => r.right)) : origin.left;
  const bottom = visible.length ? Math.max(...visible.map(r => r.bottom)) : origin.top;
  // Include stroke/selection extents beyond node boxes and SVG geometry.
  const bounds = { x: (left - origin.left) / zoom - 6, y: (top - origin.top) / zoom - 6,
    width: (right - left) / zoom + 12, height: (bottom - top) / zoom + 12 };
  return { viewport, bounds, ...fitTopologyToPage(bounds, orientation) };
}

export function prepareTopologyPrint(source: HTMLElement, orientation: PrintOrientation) {
  const plan = measureTopologyPrint(source, orientation);
  const sheet = document.createElement("div");
  sheet.className = "topology-print-page react-flow";
  sheet.setAttribute("aria-hidden", "true");
  sheet.dataset.orientation = orientation;
  sheet.style.width = `${plan.width}px`;
  sheet.style.height = `${plan.height}px`;
  const clone = plan.viewport.cloneNode(true) as HTMLElement;
  clone.style.transform = `translate(${plan.x}px, ${plan.y}px) scale(${plan.scale})`;
  clone.style.transformOrigin = "0 0";
  clone.style.position = "absolute";
  clone.style.inset = "0 auto auto 0";
  clone.style.width = "100%";
  clone.style.height = "100%";
  for (const e of clone.querySelectorAll("[id]")) e.removeAttribute("id");
  for (const e of clone.querySelectorAll("[tabindex]")) e.removeAttribute("tabindex");
  for (const e of clone.querySelectorAll(".hit-line, .selection-line, .react-flow__handle")) e.remove();
  for (const e of clone.querySelectorAll(".selected")) e.classList.remove("selected");
  sheet.append(clone);
  const pageStyle = document.createElement("style");
  pageStyle.textContent = `@page { size: A4 ${orientation}; margin: ${PAGE_MARGIN_MM}mm; }`;
  document.head.append(pageStyle);
  document.body.append(sheet);
  document.body.dataset.topologyPrint = "true";
  return { scale: plan.scale, dispose() {
    sheet.remove(); pageStyle.remove(); delete document.body.dataset.topologyPrint;
  } };
}
