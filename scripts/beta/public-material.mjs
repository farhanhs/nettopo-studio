import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { root, sha256 } from './build.mjs';
import { projectExportToJson, projectToCsvBundleZip } from '../../app/lib/topology-transfer.ts';

const build = resolve(process.argv[2]);
if (!build.startsWith(join(root, '.local/bta-20261019') + '/') && !build.startsWith(join(root, '.local/bta-20261019') + '\\')) throw new Error('BTA_ARTIFACT_INVALID');
const dependencies = JSON.parse(await readFile(join(build, 'dependency-inputs.json'), 'utf8'));
const tailwindPath = join(root, 'node_modules/tailwindcss');
const tailwind = JSON.parse(await readFile(join(tailwindPath, 'package.json'), 'utf8'));
dependencies.push({ name: tailwind.name, version: tailwind.version, license: tailwind.license, path: tailwindPath });
const licenseEvidence = [];
let notices = '# Third-Party Notices\n\nGenerated from the actual Beta build module graph plus Tailwind CSS. Runtime React dependencies are included. System fonts and Node.js are not redistributed. The NetTopo MIT license does not replace these licenses. Unmodified third-party source releases remain available from the exact npm package URLs below, including ELK (EPL-2.0).\n';
for (const dep of dependencies.sort((a, b) => `${a.name}@${a.version}`.localeCompare(`${b.name}@${b.version}`))) {
  if (!['MIT', 'ISC', 'BSD-3-Clause', 'Apache-2.0', 'EPL-2.0'].includes(dep.license)) throw new Error('BTA_UNKNOWN_LICENSE');
  const licenseFiles = (await readdir(dep.path)).filter(n => /^(licen[cs]e|copying|notice)(\.|$)/i.test(n)).sort();
  const upstreamRsc = dep.name === '@vitejs/plugin-rsc' && dep.version === '0.5.26';
  if (upstreamRsc) licenseFiles.push('LICENSE.upstream', 'dist/vendor/react-server-dom/LICENSE');
  if (!licenseFiles.some(n => /^licen[cs]e|^copying/i.test(n))) throw new Error('BTA_LICENSE_TEXT_MISSING');
  const tarballName = dep.name.split('/').at(-1);
  notices += `\n## ${dep.name} ${dep.version}\n\nLicense: ${dep.license}\n\nSource: https://registry.npmjs.org/${dep.name}/-/${tarballName}-${dep.version}.tgz\n`;
  for (const name of licenseFiles) {
    const text = await readFile(name === 'LICENSE.upstream' ? join(root, 'docs/beta/licenses/plugin-rsc-0.5.26-LICENSE.txt') : join(dep.path, name), 'utf8');
    if (name === 'LICENSE.upstream') notices += '\nUpstream license: https://raw.githubusercontent.com/vitejs/vite-plugin-react/plugin-rsc%400.5.26/LICENSE (the npm archive omits its root license).\n';
    notices += `\n### ${name}\n\n\`\`\`text\n${text.trimEnd()}\n\`\`\`\n`;
    licenseEvidence.push({ package: dep.name, version: dep.version, file: name, sha256: sha256(text) });
  }
}
await writeFile(join(root, 'THIRD_PARTY_NOTICES.md'), notices);
await writeFile(join(build, 'license-evidence.json'), JSON.stringify(licenseEvidence, null, 2) + '\n');
const project = {
  devices: [
    { id: 'synthetic-router', name: 'Synthetic Router', type: 'router', model: 'TEST-R', x: 80, y: 100, groupId: 'synthetic-site' },
    { id: 'synthetic-switch', name: 'Synthetic Switch', type: 'switch', model: 'TEST-S', x: 400, y: 100, groupId: 'synthetic-site' },
    { id: 'synthetic-camera', name: 'Synthetic Cameras', type: 'camera', quantity: 3, x: 720, y: 100, groupId: 'synthetic-site' },
  ],
  links: [
    { id: 'synthetic-uplink', from: 'synthetic-router', to: 'synthetic-switch', fromPort: 'Gi0/1', toPort: 'Gi0/1', kind: 'wired', speed: '1 Gbps' },
    { id: 'synthetic-camera-link', from: 'synthetic-switch', to: 'synthetic-camera', fromPort: 'Gi0/2', toPort: 'Eth0', kind: 'wired', speed: '100 Mbps' },
  ],
  groups: [{ id: 'synthetic-site', name: 'Synthetic Site', kind: 'site', color: '#468b66' }],
};
const samples = join(root, 'samples/beta'); await mkdir(samples, { recursive: true });
await writeFile(join(samples, 'synthetic-topology.json'), projectExportToJson(project, { safe: true, topologyName: 'Synthetic Beta sample' }));
await writeFile(join(samples, 'synthetic-topology-csv-bundle.zip'), await projectToCsvBundleZip(project, { safe: true }));
console.log(JSON.stringify({ code: 'BTA_PUBLIC_MATERIAL_OK', packages: dependencies.length, licenseFiles: licenseEvidence.length, samples: relative(root, samples).replaceAll('\\', '/') }));
