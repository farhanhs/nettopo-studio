import https from 'node:https';
import { pathToFileURL } from 'node:url';

export function classifyProbeError(error) {
  const code = String(error?.code ?? '');
  const message = String(error?.message ?? '');
  if (code === 'EACCES' || /ERR_NETWORK_ACCESS_DENIED/i.test(message)) return 4;
  if (code === 'ETIMEDOUT') return 3;
  if (['ECONNREFUSED', 'ECONNRESET', 'ENETUNREACH', 'EHOSTUNREACH'].includes(code)) return 1;
  return 5;
}

const EXIT_INVALID = 2;
const EXIT_TLS_OR_PROTOCOL = 5;
const EXIT_EXPECTED_DENY = 4;

export function runProbe([connectHost, portText, path = '/', serverName = connectHost] = process.argv.slice(2)) {
  const port = Number(portText);
  if (!connectHost || !Number.isInteger(port) || port < 1 || port > 65535) return EXIT_INVALID;
  const request = https.request({ host: connectHost, port, path, method: 'HEAD', servername: serverName, headers: { Host: serverName }, rejectUnauthorized: true, timeout: 5000 }, response => {
    response.resume();
    response.once('end', () => process.exit(response.statusCode >= 200 && response.statusCode < 400 ? 0 : EXIT_TLS_OR_PROTOCOL));
  });
  request.once('timeout', () => { request.destroy(); process.exit(3); });
  request.once('error', error => process.exit(classifyProbeError(error)));
  request.end();
  return null;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) { const result = runProbe(); if (result !== null) process.exit(result); }
