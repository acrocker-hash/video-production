// Renders the Fortline hero loop: node src/render.js <W> <H> <out-basename> [--preview]
// Frames are drawn by stage.html (window.render(t)) and piped to ffmpeg.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const [W, H] = [parseInt(process.argv[2] || '1080'), parseInt(process.argv[3] || '1350')];
const base = process.argv[4] || `fortline-hero-${W}x${H}`;
const preview = process.argv.includes('--preview');
const FPS = 30, DURATION = 12.5;
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'out');
fs.mkdirSync(out, { recursive: true });

// Stills (Adobe Stock, free collection, licensed). Landscape for bands, portrait for columns.
const st = f => 'file://' + path.join(root, 'stills', f + '.jpg');
const IMG = {
  b1a: st('251739981'),  // diagonal fins
  b2a: st('277643254'),  // sweeping facade fins
  b1b: st('214611072'),  // curved glass tower
  b2b: st('379050150'),  // round building
  c1:  st('703565067'),  // sculptural curves
  c2:  st('327019134'),  // stairwell looking up (opens to full frame)
  c3:  st('205455313'),  // white curved stair
};

const svg = fs.readFileSync(path.join(root, 'brand', 'fpa-lockup-white-accent.svg'), 'utf8');
const wordmark = svg.slice(svg.indexOf('<g id="wordmark"'), svg.lastIndexOf('</svg>'));
const html = fs.readFileSync(path.join(__dirname, 'stage.html'), 'utf8')
  .replace('__WORDMARK__', wordmark).replace('__W__', W).replace('__H__', H)
  .replace('__IMG__', JSON.stringify(IMG));
const stagePath = path.join(out, `.stage-${W}x${H}.html`);
fs.writeFileSync(stagePath, html);

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await page.goto('file://' + stagePath);
  await page.evaluate(() => window.ready());

  if (preview) {  // contact strip of key moments
    const times = process.argv.slice(5).filter(a => !a.startsWith('--')).map(Number);
    for (const t of (times.length ? times : [0.5, 1.2, 2.0, 3.0, 4.0, 5.4, 6.5, 8.0, 9.0, 10.4, 11.4, 12.4])) {
      await page.evaluate(t => window.render(t), t);
      await page.screenshot({ path: path.join(out, `.prev-${W}x${H}-${t.toFixed(2)}.png`) });
    }
    await browser.close(); return;
  }

  const mp4 = path.join(out, base + '.mp4');
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p', '-profile:v', 'high',
    '-movflags', '+faststart', '-an', mp4], { stdio: ['pipe', 'inherit', 'inherit'] });
  const N = Math.round(DURATION * FPS);
  for (let i = 0; i < N; i++) {
    await page.evaluate(t => window.render(t), i / FPS);
    const buf = await page.screenshot({ type: 'png' });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (i % 60 === 0) process.stdout.write(`frame ${i}/${N}\n`);
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  await browser.close();
  console.log('wrote', mp4);
})();
