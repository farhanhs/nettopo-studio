import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRuntimePolicy } from '../app/lib/server/runtime-policy.ts';
import { validateBetaRequest, betaSecurityHeaders, LOCAL_BETA_ORIGIN as origin } from '../app/lib/server/local-beta-request.ts';

const env = { NETTOPO_RUNTIME_PROFILE: 'local-beta', NETTOPO_AUTH_MODE: 'disabled', NETTOPO_STORAGE_MODE: 'indexeddb', NEXT_PUBLIC_TOPOLOGY_STORAGE: 'local', NEXT_PUBLIC_LOCAL_BETA: '1', HOST: '127.0.0.1', PORT: '4317' };
const browser = { host: '127.0.0.1:4317', 'sec-fetch-site': 'same-origin', 'sec-fetch-mode': 'cors', 'sec-fetch-dest': 'empty' };
const runtime = { peer: '127.0.0.1', assets: new Map([['/assets/app.js', 'script']]) };
const check = (path, headers = browser, method = 'GET', extra = {}) => validateBetaRequest(new Request(origin + path, { headers, method }), { ...runtime, ...extra });

test('local-beta is explicit, IndexedDB-only and the narrow no-DSN CI exception', () => {
  const p = validateRuntimePolicy({ ...env, CI: 'true' });
  assert.equal(p.capabilities.localBeta, true);
  for (const key of ['demoAuth', 'devIdentityOverride', 'demoSeed', 'pilotAuth', 'pilotFullExport']) assert.equal(p.capabilities[key], false);
  for (const patch of [{ NETTOPO_AUTH_MODE: 'demo' }, { NETTOPO_ENABLE_DEMO_SEED: '1' }, { HOST: 'localhost' }, { PORT: '4318' }, { DATABASE_URL: 'blocked' }, { MIGRATION_DATABASE_URL: 'blocked' }, { OIDC_CLIENT_ID: 'blocked' }, { NETTOPO_PILOT_USERS: 'blocked' }, { NEXT_PUBLIC_TOPOLOGY_STORAGE: 'server' }, { NETTOPO_STORAGE_MODE: 'server' }]) {
    assert.throws(() => validateRuntimePolicy({ ...env, ...patch }), /BTA_(PROFILE|STORAGE_MODE)_INVALID/);
  }
  assert.throws(() => validateRuntimePolicy({ CI: 'true' }), /MIGRATION_DATABASE_URL/);
});

test('pre-worker gate permits only exact browser and control classes', () => {
  assert.equal(check('/api/runtime-capabilities').kind, 'capabilities');
  assert.equal(check('/', { ...browser, 'sec-fetch-mode': 'navigate', 'sec-fetch-dest': 'document' }).kind, 'application');
  assert.equal(check('/assets/app.js', { ...browser, 'sec-fetch-mode': 'no-cors', 'sec-fetch-dest': 'script' }).kind, 'asset');
  assert.equal(check('/?_rsc=abc', { ...browser, rsc: '1' }).kind, 'application');
  assert.equal(check('/__local_beta/status', { host: browser.host }, 'GET', { controlAuthorized: true }).kind, 'status');
  assert.equal(check('/__local_beta/shutdown', { host: browser.host }, 'POST', { controlAuthorized: true }).kind, 'shutdown');
});

test('denied requests execute no worker and do not grant header identities', () => {
  let workerCalls = 0;
  const cases = [
    ['/api/session'], ['/api/topology'], ['/api/credentials'], ['/api/audit-logs'], ['/api/health/schema'], ['/api/dev/session'], ['/api/pilot/session'], ['/_dev/'], ['/admin'],
    ['/api/runtime-capabilities', { host: browser.host }], ['/api/runtime-capabilities?x=1'],
    ['/', { ...browser, origin: 'http://evil.invalid' }], ['/', { ...browser, host: 'evil.invalid' }],
    ['/', { ...browser, 'sec-fetch-site': 'cross-site' }], ['/', { ...browser, 'x-nettopo-dev-user-email': 'fake' }],
    ['/assets/missing.js'], ['/assets/app.js', browser], ['/?unknown=1'], ['/__local_beta/status'], ['/__local_beta/shutdown', { host: browser.host }],
  ];
  for (const [path, headers] of cases) {
    const decision = check(path, headers);
    if (decision.allow) workerCalls++;
    assert.equal(decision.allow, false, path);
    assert.ok([403, 404, 421].includes(decision.status));
  }
  assert.equal(check('/api/runtime-capabilities', browser, 'GET', { peer: '192.0.2.1' }).status, 421);
  assert.equal(workerCalls, 0);
  assert.equal(betaSecurityHeaders()['Cache-Control'], 'no-store');
  assert.match(betaSecurityHeaders()['Content-Security-Policy'], /frame-ancestors 'none'/);
});
