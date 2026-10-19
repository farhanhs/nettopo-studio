import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { timingSafeEqual } from 'node:crypto';
import { Readable } from 'node:stream';
import { packageRoot, readState, ownerMatches } from './lib/commands.mjs';
import { verifySetup } from './lib/integrity.mjs';
import { ORIGIN, CONTROL_HEADER } from './lib/environment.mjs';
import { validateBetaRequest, betaSecurityHeaders } from './lib/request-gate.mjs';
import { validateRuntimePolicy, runtimePolicySummary } from './lib/runtime-policy.mjs';

const startupTimeout = setTimeout(() => process.exit(6), 25000);
process.once('message', async ({ state } = {}) => {
  try {
    const verified = await verifySetup(packageRoot);
    const policy = validateRuntimePolicy(process.env);
    if (state?.pid !== process.pid || state.artifactId !== verified.artifactId || !await ownerMatches(packageRoot, state)) throw new Error('BTA_OWNERSHIP_MISMATCH');
    const assets = new Map();
    const paths = new Map();
    const contentTypes = { '.js': ['script', 'text/javascript'], '.css': ['style', 'text/css'], '.svg': ['image', 'image/svg+xml'], '.png': ['image', 'image/png'], '.ico': ['image', 'image/x-icon'], '.woff2': ['font', 'font/woff2'], '.wasm': ['empty', 'application/wasm'] };
    for (const file of verified.manifest.files) {
      const prefix = file.path.startsWith('runtime/dist/client/') ? 'runtime/dist/client/' : file.path.startsWith('runtime/public/') ? 'runtime/public/' : null;
      const type = contentTypes[extname(file.path)];
      if (prefix && type) { const url = '/' + file.path.slice(prefix.length); assets.set(url, type[0]); paths.set(url, { file: file.path, contentType: type[1] }); }
    }
    const worker = (await import('./dist/server/index.js')).default;
    const server = createServer(async (req, res) => {
      const send = (status, body) => { res.writeHead(status, { ...betaSecurityHeaders(), 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(body)); };
      try {
        const headers = new Headers();
        for (const [key, value] of Object.entries(req.headers)) if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(',') : value);
        const request = new Request(new URL(req.url, ORIGIN), { method: req.method, headers });
        const supplied = Buffer.from(headers.get(CONTROL_HEADER) || '');
        const expected = Buffer.from(state.shutdownToken);
        const controlAuthorized = supplied.length === expected.length && timingSafeEqual(supplied, expected);
        const decision = validateBetaRequest(request, { peer: req.socket.remoteAddress, assets, controlAuthorized });
        if (!decision.allow) { send(decision.status, { error: decision.error }); return; }
        const status = { ready: true, version: '0.1.0-beta.1', artifactId: state.artifactId, instanceId: state.instanceId };
        if (decision.kind === 'status') { send(200, status); return; }
        if (decision.kind === 'shutdown') {
          const disk = await readState(packageRoot, verified.artifactId);
          if (!disk || disk.instanceId !== state.instanceId || disk.shutdownToken !== state.shutdownToken || !await ownerMatches(packageRoot, disk)) { send(404, { error: 'BTA_API_DENIED' }); return; }
          send(200, status);
          server.close(() => process.exit(0));
          setTimeout(() => { server.closeAllConnections(); process.exit(0); }, 800).unref();
          return;
        }
        if (decision.kind === 'capabilities') { send(200, runtimePolicySummary(policy)); return; }
        if (decision.kind === 'asset') {
          const asset = paths.get(new URL(request.url).pathname);
          const bytes = await readFile(join(packageRoot, asset.file));
          res.writeHead(200, { ...betaSecurityHeaders(), 'Content-Type': asset.contentType });
          res.end(req.method === 'HEAD' ? undefined : bytes); return;
        }
        const response = typeof worker === 'function' ? await worker(request)
          : await worker.fetch(request, {}, { waitUntil() {}, passThroughOnException() {} });
        res.writeHead(response.status, { ...betaSecurityHeaders(), 'Content-Type': response.headers.get('content-type') || 'text/html; charset=utf-8' });
        if (req.method === 'HEAD' || !response.body) res.end();
        else Readable.fromWeb(response.body).on('error', () => res.destroy()).pipe(res);
      } catch { if (!res.headersSent) send(500, { error: 'BTA_RUNTIME_FAILED' }); else res.destroy(); }
    });
    server.requestTimeout = 10000;
    server.headersTimeout = 10000;
    server.maxRequestsPerSocket = 100;
    server.once('error', () => { process.send?.({ code: 'BTA_START_FAILED' }); process.exit(6); });
    server.listen(4317, '127.0.0.1', () => { clearTimeout(startupTimeout); process.send?.({ code: 'BTA_READY' }); });
  } catch { process.send?.({ code: 'BTA_START_FAILED' }); process.exit(6); }
});
