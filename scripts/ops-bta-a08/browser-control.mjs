import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const [playwrightPath, executablePath, targetHost, targetIp, targetPortText, targetPath, profile, expectedText] = process.argv.slice(2);
const targetPort = Number(targetPortText);
const targetUrl = new URL(`https://${targetHost}:${targetPort}${targetPath}`);
const canonical = value => { const parsed = new URL(value); if ((parsed.protocol === 'https:' && parsed.port === '443') || (parsed.protocol === 'http:' && parsed.port === '80')) parsed.port = ''; return parsed.href; };
const url = canonical(targetUrl.href);
if (!playwrightPath || !executablePath || !targetHost || !Number.isInteger(targetPort) || !profile) process.exit(2);
fs.mkdirSync(profile, { recursive: false });

let context;
let cdp;
try {
  const namespace = await import(pathToFileURL(path.resolve(playwrightPath)).href);
  const playwright = namespace.chromium ? namespace : namespace.default;
  context = await playwright.chromium.launchPersistentContext(profile, {
    executablePath,
    headless: true,
    serviceWorkers: 'block',
    acceptDownloads: false,
    viewport: { width: 800, height: 600 },
    args: ['--disable-background-networking', '--disable-sync', '--no-first-run', '--no-default-browser-check', '--no-proxy-server', '--proxy-bypass-list=*', `--host-resolver-rules=MAP ${targetHost} ${targetIp}`],
  });
  const page = context.pages()[0] ?? await context.newPage();
  cdp = await context.newCDPSession(page);
  await cdp.send('Fetch.enable', { patterns: [{ urlPattern: '*', requestStage: 'Request' }] });
  cdp.on('Fetch.requestPaused', async event => {
    try {
      if (canonical(event.request.url) !== url) await cdp.send('Fetch.failRequest', { requestId: event.requestId, errorReason: 'BlockedByClient' });
      else await cdp.send('Fetch.continueRequest', { requestId: event.requestId });
    } catch {}
  });
  const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 5000 });
  if (!response || response.status() < 200 || response.status() >= 400 || canonical(response.url()) !== url || canonical(page.url()) !== url) process.exitCode = 1;
  else process.exitCode = 0;
} catch (error) {
  const text = String(error?.message ?? error);
  const denied = /ERR_NETWORK_ACCESS_DENIED|ERR_CONNECTION_TIMED_OUT|ERR_CONNECTION_REFUSED|Timeout/i.test(text);
  process.exitCode = denied ? 2 : 1;
} finally {
  if (cdp) { try { await cdp.send('Fetch.disable'); } catch {} }
  if (context) await context.close();
}
