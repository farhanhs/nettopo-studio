import assert from "node:assert/strict";
import test from "node:test";
import { runNativeLifecycle } from "../scripts/qa-env/native-lifecycle.mjs";

for (const scenario of ["normal", "failure", "timeout"]) {
  test(`ENV-06 ${scenario} native disposable lifecycle`, async () => {
    const report = await runNativeLifecycle(scenario);
    assert.equal(report.port === 5432, false);
    assert.ok(Number.isInteger(report.expectedPid));
    assert.equal(report.cleanup, "complete");
    assert.equal(report.portsClosed, true);
    assert.equal(report.directoryRemoved, true);
    if (scenario === "normal") assert.equal(report.status, "PASS");
    else assert.ok(report.failureCode);
  });
}
