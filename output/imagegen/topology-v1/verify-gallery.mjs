import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';

const root = process.cwd();
const galleryPath = path.join(root, 'public/topology-assets/v1/index.html');
const output = path.join(root, 'output/imagegen/topology-v1');
const manifest = JSON.parse(await fs.readFile(path.join(root, 'public/topology-assets/v1/manifest.json'), 'utf8'));
const geometry = [];
for (const asset of manifest.assets) {
  const { data, info } = await sharp(path.join(root, 'public', asset.src)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (const dock of asset.docks) {
    let count = 0, sx = 0, sy = 0;
    const reach = dock.radius + 1.5;
    for (let y = Math.max(0, Math.floor(dock.y - reach)); y <= Math.min(99, Math.ceil(dock.y + reach)); y++) {
      for (let x = Math.max(0, Math.floor(dock.x - reach)); x <= Math.min(159, Math.ceil(dock.x + reach)); x++) {
        const i = (y * info.width + x) * 4;
        if (data[i + 3] < 100 || data[i + 1] < data[i] + 40 || data[i + 2] < data[i] + 35) continue;
        sx += x + 0.5; sy += y + 0.5; count++;
      }
    }
    const distance = count ? Math.hypot(sx / count - dock.x, sy / count - dock.y) : Infinity;
    geometry.push({ asset: asset.id, dock: dock.id, cyanPixels: count, centerDeviationPx: Math.round(distance * 100) / 100 });
    if (count < 3 || distance > 1.5) throw new Error(`Dock does not match visible ring: ${asset.id}/${dock.id}: ${JSON.stringify(geometry.at(-1))}`);
  }
}
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 1300 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(pathToFileURL(galleryPath).href);
  await page.locator('img').last().waitFor();
  const images = await page.locator('img').evaluateAll((imgs) => imgs.map((img) => ({ alt: img.alt, loaded: img.complete && img.naturalWidth === 160 && img.naturalHeight === 100, displayedWidth: img.width, displayedHeight: img.height })));
  if (images.length !== 21 || images.some((img) => !img.loaded)) throw new Error('Incomplete gallery');
  await page.screenshot({ path: path.join(output, 'gallery-light.png'), fullPage: true });
  await page.getByRole('button', { name: '切換深／淺底' }).click();
  await page.screenshot({ path: path.join(output, 'gallery-dark.png'), fullPage: true });
  await page.getByRole('button', { name: '顯示／隱藏卯點熱區' }).click();
  const docks = page.locator('.dock');
  if (await docks.count() !== 30) throw new Error('Missing dock hit zones');
  await docks.first().click();
  if (!(await page.locator('#status').innerText()).startsWith('left:')) throw new Error('Dock click failed');
  await page.screenshot({ path: path.join(output, 'gallery-docks.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  if (overflow || errors.length) throw new Error(`Gallery UI failure: ${JSON.stringify({ overflow, errors })}`);
  await fs.writeFile(path.join(output, 'gallery-validation.json'), JSON.stringify({ status: 'passed', images, dockCount: 30, geometry, mobileOverflow: overflow, pageErrors: errors, scope: 'Asset gallery only; product integration remains PM/DEV/QA work.' }, null, 2));
  console.log(JSON.stringify({ status: 'passed', images: images.length, docks: 30, maxDockDeviationPx: Math.max(...geometry.map((item) => item.centerDeviationPx)), mobileOverflow: overflow }));
} finally {
  await browser.close();
}
