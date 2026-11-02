import assert from "node:assert/strict";
import test from "node:test";
import { fitTopologyToPage } from "../app/lib/topology-print.ts";

for (const orientation of ["landscape", "portrait"]) {
  for (const bounds of [
    { x: -450, y: -300, width: 2100, height: 1300 },
    { x: 10, y: -1200, width: 178, height: 3400 },
    { x: 6000, y: 8000, width: 8000, height: 112 },
    { x: 0, y: 0, width: 0, height: 0 },
    { x: 0, y: 0, width: 178, height: 112 },
  ]) {
    test(`print bounds fit ${orientation}: ${JSON.stringify(bounds)}`, () => {
      const before = structuredClone(bounds);
      const p = fitTopologyToPage(bounds, orientation);
      assert.deepEqual(bounds, before);
      assert.ok(p.scale > 0 && p.scale <= 1);
      assert.ok(p.x + bounds.x * p.scale >= 15.99);
      assert.ok(p.y + bounds.y * p.scale >= 15.99);
      assert.ok(p.x + (bounds.x + bounds.width) * p.scale <= p.width - 15.99);
      assert.ok(p.y + (bounds.y + bounds.height) * p.scale <= p.height - 15.99);
      assert.equal(p.width > p.height, orientation === "landscape");
    });
  }
}
test("invalid print geometry/orientation fail closed", () => {
  assert.throws(() => fitTopologyToPage({ x: NaN, y: 0, width: 10, height: 10 }, "landscape"));
  assert.throws(() => fitTopologyToPage({ x: 0, y: 0, width: -10, height: 10 }, "landscape"));
  assert.throws(() => fitTopologyToPage({ x: 0, y: 0, width: 10, height: 10 }, "unknown"));
});
