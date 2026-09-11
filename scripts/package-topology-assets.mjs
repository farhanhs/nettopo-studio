import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';

// Packaging only: preserve image_gen's alpha; no recoloring, background removal or drawing.
const root = process.cwd();
const sourceDir = path.join(root, 'output/imagegen/topology-v1');
const outDir = path.join(root, 'public/topology-assets/v1');
const sources = JSON.parse(await fs.readFile(path.join(sourceDir, 'sources.json'), 'utf8'));
const annotations = JSON.parse(await fs.readFile(path.join(sourceDir, 'dock-points.json'), 'utf8'));
await fs.mkdir(path.join(sourceDir, 'originals'), { recursive: true });
const assets = [];
const checks = [];
const round = (n) => Math.round(n * 1000) / 1000;
for (const entry of sources.assets) {
  if (!entry.source) throw new Error(`Missing generated asset: ${entry.id}`);
  const folder = entry.kind === 'device' ? 'devices' : 'connections';
  await fs.mkdir(path.join(outDir, folder), { recursive: true });
  const original = path.join(sourceDir, 'originals', `${entry.id}.png`);
  await fs.copyFile(entry.source, original);
  const metadata = await sharp(original).metadata();
  if (!metadata.hasAlpha) throw new Error(`No native transparency: ${entry.id}`);
  const localName = `${folder}/${entry.id}.png`;
  const src = `/topology-assets/v1/${localName}`;
  for (const scale of [1, 2]) {
    const suffix = scale === 1 ? '' : '@2x';
    await sharp(original).resize(160 * scale, 100 * scale, {
      fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 }, kernel: 'lanczos3',
    }).png().toFile(path.join(outDir, folder, `${entry.id}${suffix}.png`));
  }
  const { data, info } = await sharp(path.join(outDir, localName)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let transparent = 0, visible = 0;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] === 0) transparent++;
    if (data[i] >= 128) visible++;
  }
  const corners = [0, 159, 99 * 160, 100 * 160 - 1].map((i) => data[i * 4 + 3]);
  if (info.width !== 160 || info.height !== 100 || transparent < 1600 || visible < 300 || corners.some((a) => a !== 0)) {
    throw new Error(`Invalid dimensions, transparency or silhouette: ${entry.id}`);
  }
  const fitScale = Math.min(160 / metadata.width, 100 / metadata.height);
  const left = (160 - Math.round(metadata.width * fitScale)) / 2;
  const top = (100 - Math.round(metadata.height * fitScale)) / 2;
  const docks = (annotations[entry.id] ?? []).map(([id, x, y, radius]) => {
    const px = round(left + x * fitScale), py = round(top + y * fitScale);
    return { id, side: id, x: px, y: py, u: round(px / 160), v: round(py / 100), radius: round(radius * fitScale), hitRadius: 12, normal: { x: id === 'left' ? -1 : 1, y: 0 } };
  });
  if (entry.kind === 'device' && docks.length !== 2) throw new Error(`Missing dock annotations: ${entry.id}`);
  const bytes = await fs.readFile(path.join(outDir, localName));
  assets.push({ id: entry.id, label: entry.label, kind: entry.kind, src, src2x: src.replace('.png', '@2x.png'), width: 160, height: 100, docks });
  checks.push({ id: entry.id, width: info.width, height: info.height, channels: info.channels, transparentPixels: transparent, opaqueOrMostlyOpaquePixels: visible, cornerAlpha: corners, bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex'), docks });
}
const manifest = { version: 1, generatedOn: sources.generatedOn, generator: sources.generator, coordinateSpace: 'image-local pixels, top-left origin, 160x100', dockMeaning: 'Logical topology attachment markers; not physical Ethernet/optical port specifications.', assets };
await fs.writeFile(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
await fs.writeFile(path.join(sourceDir, 'validation.json'), JSON.stringify({ status: 'passed', assetCount: checks.length, checks }, null, 2) + '\n');
const cards = assets.map((asset) => `<article><div class="picture"><img src="${asset.src.replace('/topology-assets/v1/', '')}" width="160" height="100" alt="${asset.label}">${asset.docks.map((dock) => `<button class="dock" style="left:${dock.x}px;top:${dock.y}px" title="${dock.id}: (${dock.x}, ${dock.y})" aria-label="${asset.label} ${dock.id} 卯點" onclick="document.getElementById('status').textContent=this.title"></button>`).join('')}</div><strong>${asset.label}</strong><small>${asset.id} · 160 × 100 · PNG α</small></article>`).join('\n');
const html = `<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>NetTopo 設備與連線素材</title><style>*{box-sizing:border-box}body{font:15px system-ui,sans-serif;background:#edf3f6;color:#172b3a;margin:0;padding:36px}h1{font-size:26px;margin:0 0 10px}p{color:#506779}header{max-width:1120px;margin:auto}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:16px;max-width:1120px;margin:24px auto}article{background:white;padding:20px 14px;border:1px solid #d8e2e8;border-radius:12px;text-align:center}.picture{width:160px;height:100px;margin:0 auto 14px;position:relative;background-color:#fff;background-image:linear-gradient(45deg,#e6eaed 25%,transparent 25%),linear-gradient(-45deg,#e6eaed 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#e6eaed 75%),linear-gradient(-45deg,transparent 75%,#e6eaed 75%);background-size:16px 16px;background-position:0 0,0 8px,8px -8px,-8px 0px}body.dark .picture{background:#192736}small{display:block;font-size:12px;color:#667d8b;margin-top:7px}.dock{position:absolute;width:24px;height:24px;border-radius:50%;transform:translate(-50%,-50%);padding:0;border:0;background:transparent;cursor:crosshair}.dock:hover,.dock:focus-visible,body.show-docks .dock{outline:1px solid #d24c28;background:#ed8c4938}.dock:focus-visible{outline-width:2px}button.control{padding:9px 15px;border:1px solid #b3c5d0;background:white;border-radius:7px;cursor:pointer;margin-right:8px}#status{min-height:1.5em}footer{max-width:1120px;margin:auto;color:#506779}</style><header><h1>NetTopo 設備與連線素材</h1><p>15 種設備・6 種連線・透明 PNG・原尺寸 160 × 100</p><button class="control" onclick="document.body.classList.toggle('dark')">切換深／淺底</button><button class="control" onclick="document.body.classList.toggle('show-docks')">顯示／隱藏卯點熱區</button><p id="status">將游標移到青色凹槽，點擊可查看座標。此頁是素材與熱區預覽，專案接線功能由 PM 安排整合。</p></header><main>${cards}</main><footer>凹槽代表拓樸邏輯接點；圖像不代表特定型號或實體接頭規格。線材顏色供介面識別。<a href="manifest.json">下載素材與卯點清單</a></footer></html>`;
await fs.writeFile(path.join(outDir, 'index.html'), html);
console.log(JSON.stringify({ status: 'passed', assets: assets.length, devices: assets.filter((a) => a.kind === 'device').length, connections: assets.filter((a) => a.kind === 'connection').length, output: outDir }, null, 2));
