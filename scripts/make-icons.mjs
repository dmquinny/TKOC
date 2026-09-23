// Builds the app icons for the game and the control panel from the game's
// emblem (public/game/ui/sidebar-emblem-v3.webp, a round gold-ringed emblem
// with a transparent outside), so both apps share one mark: the emblem on a
// dark tile, plus a small power badge for the control panel.
//
//   npm install --no-save puppeteer-core   (renders through the installed Chrome)
//   node scripts/make-icons.mjs            (from the repository root)
//
// Set CHROME to the browser executable if it is not in the default location.
// Writes:
//   src/app/favicon.ico, icon.png, apple-icon.png      picked up by Next.js
//   public/icons/icon-*.png                            referenced by src/app/manifest.webmanifest
//   control/public/icon-*.png, apple-touch-icon.png,   referenced by control/page.html and
//     favicon-32.png                                   control/public/manifest.webmanifest
import puppeteer from 'puppeteer-core';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const chrome = process.env.CHROME || (process.platform === 'win32'
  ? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
  : '/usr/bin/google-chrome');
const emblem = `data:image/webp;base64,${readFileSync(path.join(root, 'public/game/ui/sidebar-emblem-v3.webp')).toString('base64')}`;

// One tile, laid out in a 512-pixel space and scaled to the requested size.
//   radius  corner radius as a fraction of the size (0 for a square tile)
//   emblem  emblem diameter as a fraction of the size
//   badge   draw the control panel's power badge
//   tile    draw the dark background (false: emblem only, for tiny favicons)
function tile({ size, radius = 0.225, emblem: scale = 0.88, badge = false, tile: withTile = true }) {
  const s = size / 512;
  const px = value => `${Math.round(value * s)}px`;
  const r = Math.round(radius * size);
  const d = Math.round(scale * size);
  return `<div style="position:relative;width:${size}px;height:${size}px;border-radius:${r}px;overflow:hidden;${withTile ? 'background:radial-gradient(circle at 50% 42%, #221c14 0%, #100d0a 55%, #060504 100%);' : ''}">
    ${withTile ? '<div style="position:absolute;inset:0;background:radial-gradient(circle at 50% 50%, rgba(224,165,38,.22) 0%, rgba(224,165,38,0) 62%)"></div>' : ''}
    <img src="${emblem}" style="position:absolute;left:50%;top:50%;width:${d}px;height:${d}px;transform:translate(-50%,-50%);${withTile ? `filter:drop-shadow(0 ${px(6)} ${px(18)} rgba(0,0,0,.7));` : ''}">
    ${badge ? `<div style="position:absolute;right:${px(52)};bottom:${px(52)};width:${px(160)};height:${px(160)};border-radius:50%;background:#15110c;box-shadow:0 0 0 ${Math.max(2, Math.round(11 * s))}px #d9a52a, 0 ${px(4)} ${px(14)} rgba(0,0,0,.8);display:grid;place-items:center">
      <svg width="${px(76)}" height="${px(76)}" viewBox="0 0 24 24" fill="none" stroke="#f3cc63" stroke-width="2.6" stroke-linecap="round"><path d="M12 3v8.5"/><path d="M6.6 6.4a7.6 7.6 0 1 0 10.8 0"/></svg>
    </div>` : ''}
  </div>`;
}

const jobs = [
  ['src/app/icon.png', { size: 512 }],
  ['src/app/apple-icon.png', { size: 180, radius: 0, emblem: 0.9 }],
  ['public/icons/icon-192.png', { size: 192 }],
  ['public/icons/icon-512.png', { size: 512 }],
  ['public/icons/icon-maskable-512.png', { size: 512, radius: 0, emblem: 0.78 }],
  ['control/public/icon-192.png', { size: 192, badge: true, emblem: 0.84 }],
  ['control/public/icon-512.png', { size: 512, badge: true, emblem: 0.84 }],
  ['control/public/icon-maskable-512.png', { size: 512, radius: 0, badge: true, emblem: 0.72 }],
  ['control/public/apple-touch-icon.png', { size: 180, radius: 0, badge: true, emblem: 0.86 }],
  ['control/public/favicon-32.png', { size: 32, badge: true, emblem: 0.9 }],
];
// favicon.ico entries: the emblem alone at tab sizes, the tile at 256.
const faviconSizes = [
  { size: 16, radius: 0, emblem: 1, tile: false },
  { size: 32, radius: 0, emblem: 1, tile: false },
  { size: 48, radius: 0, emblem: 1, tile: false },
  { size: 256, radius: 0, emblem: 0.96 },
];

/** Packs PNG buffers into a .ico container (PNG-encoded entries, as Windows Vista+ and browsers accept). */
function ico(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  const entries = [];
  let offset = 6 + pngs.length * 16;
  for (const png of pngs) {
    const width = png.readUInt32BE(16);
    const height = png.readUInt32BE(20);
    const entry = Buffer.alloc(16);
    entry.writeUInt8(width >= 256 ? 0 : width, 0);
    entry.writeUInt8(height >= 256 ? 0 : height, 1);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    entries.push(entry);
    offset += png.length;
  }
  return Buffer.concat([header, ...entries, ...pngs]);
}

const browser = await puppeteer.launch({ executablePath: chrome, headless: true });
try {
  const page = await browser.newPage();
  const render = async options => {
    await page.setViewport({ width: options.size, height: options.size, deviceScaleFactor: 1 });
    await page.setContent(`<!doctype html><html><body style="margin:0;background:transparent">${tile(options)}</body></html>`);
    await page.evaluate(() => Promise.all([...document.images].map(image => image.decode())));
    return page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: options.size, height: options.size } });
  };
  // Next.js reads favicon.ico with a strict decoder that only accepts RGBA PNG
  // entries, and Chrome's screenshot of an opaque tile comes out as RGB. Passing
  // an entry through a canvas re-encodes it as RGBA (colour type 6).
  const toRgba = async png => {
    const dataUrl = await page.evaluate(async source => {
      const image = new Image();
      image.src = source;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      canvas.getContext('2d').drawImage(image, 0, 0);
      return canvas.toDataURL('image/png');
    }, `data:image/png;base64,${png.toString('base64')}`);
    const rgba = Buffer.from(dataUrl.split(',')[1], 'base64');
    if (rgba[25] !== 6) throw new Error('canvas did not produce an RGBA PNG');
    return rgba;
  };
  for (const [file, options] of jobs) {
    const png = await render(options);
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), png);
    console.log(`${file}  ${options.size}px  ${png.length} bytes`);
  }
  const entries = [];
  for (const options of faviconSizes) entries.push(await toRgba(await render(options)));
  const favicon = ico(entries);
  writeFileSync(path.join(root, 'src/app/favicon.ico'), favicon);
  console.log(`src/app/favicon.ico  ${faviconSizes.map(entry => entry.size).join('/')}px  ${favicon.length} bytes`);
} finally {
  await browser.close();
}
