import { readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { unzipSync, strFromU8 } from 'fflate';
import { verifyArtifact, hash } from '../../release/beta/runtime/lib/integrity.mjs';

const root = resolve(process.argv[2]);
const { manifest, artifactId } = await verifyArtifact(root);
const prohibited = [
  ['dsn', /(?:postgres(?:ql)?|mysql):\/\/[^\s"'`]+/i],
  ['private-key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['company-placeholder', /(?:sean\.sie@|manner@|@dus\.local|DIGITAL UNITED SERVICE|興恆毅)/i],
  ['credential-sentinel', /BTA_SECRET_SENTINEL|QA_SECRET_SENTINEL|development-only-demo-session-secret/],
];
const findings = [];
for (const file of manifest.files) {
  if (/(?:^|\/)(?:\.git|\.env[^/]*|node_modules|test-results|\.local|\.state|tests)(?:\/|$)|\.(?:log|sql|sqlite|db|ts|tsx|map)$/i.test(file.path)) findings.push({ path: file.path, rule: 'forbidden-member' });
  const bytes = await readFile(join(root, file.path));
  const texts = file.path.endsWith('.zip') ? Object.values(unzipSync(bytes)).map(strFromU8) : [bytes.toString('utf8')];
  for (const [rule, pattern] of prohibited) if (texts.some(text => pattern.test(text))) findings.push({ path: file.path, rule });
}
const report = { artifactId, filesScanned: manifest.files.length, sourceManifestSha256: manifest.sourceCandidate.manifestSha256, rules: prohibited.map(([id]) => id), findings, scope: 'Packaged payload and nested sample ZIP; no current environment/credential files read. Browser/state/export sentinels require separate behavioral evidence.' };
await writeFile(join(root, '../secret-scan-report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ code: findings.length ? 'BTA_SCAN_FAILED' : 'BTA_SCAN_OK', findings: findings.length, reportSha256: hash(JSON.stringify(report)) }));
if (findings.length) process.exitCode = 5;
