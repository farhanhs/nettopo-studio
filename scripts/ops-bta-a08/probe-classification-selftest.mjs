import assert from 'node:assert/strict';
import { classifyProbeError } from './tcp-control-probe.mjs';

assert.equal(classifyProbeError({ code: 'EACCES' }), 4);
assert.equal(classifyProbeError({ code: 'ETIMEDOUT' }), 3);
assert.equal(classifyProbeError({ code: 'ECONNREFUSED' }), 1);
assert.equal(classifyProbeError({ code: 'ECONNRESET' }), 1);
assert.equal(classifyProbeError({ code: 'CERT_HAS_EXPIRED' }), 5);
assert.equal(classifyProbeError({ code: 'ERR_INVALID_URL' }), 5);
console.log('OPS_A08_PROBE_CLASSIFICATION=PASS');
