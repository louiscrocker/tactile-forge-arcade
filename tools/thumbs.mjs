// =====================================================
// Tactile Forge Arcade · Screenshot PNGs → site WebP thumbnails
//   node tools/thumbs.mjs <rawDir>
// Every <slug>-title.png / <slug>-game.png in rawDir becomes a 960×600 WebP in
// docs/assets/shots/ (cover-cropped to 16:10). Uses headless Chrome's encoder,
// so no image library is needed.
// =====================================================

import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, close, newPage, evaluate } from './cdp.mjs';

const RAW = resolve(process.argv[2] || 'shots-raw');
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'assets', 'shots');
await mkdir(OUT, { recursive: true });

const files = (await readdir(RAW)).filter((f) => /-(title|game)\.png$/i.test(f));
const browser = await launch();
const p = await newPage(browser);
await p.send('Page.navigate', { url: 'about:blank' });

for (const f of files) {
  const b64 = (await readFile(join(RAW, f))).toString('base64');
  const webp = await evaluate(p, `new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const W = 960, H = 600, c = document.createElement('canvas');
      c.width = W; c.height = H;
      const x = c.getContext('2d');
      const s = Math.max(W / img.width, H / img.height);
      const dw = img.width * s, dh = img.height * s;
      x.imageSmoothingQuality = 'high';
      x.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
      res(c.toDataURL('image/webp', 0.82).split(',')[1]);
    };
    img.onerror = () => rej(new Error('decode failed'));
    img.src = 'data:image/png;base64,${b64}';
  })`);
  const name = f.replace(/\.png$/i, '.webp');
  const buf = Buffer.from(webp, 'base64');
  await writeFile(join(OUT, name), buf);
  console.log(`${name}  ${(buf.length / 1024).toFixed(0)} KiB`);
}
await close(browser);
