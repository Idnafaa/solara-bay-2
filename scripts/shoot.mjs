// Solara Bay — screenshot runner. Serves game/ over http, opens each scene
// from shots.json in headless Chromium (SwiftShader), and saves 1280x800
// JPEGs into screenshots/. Usage: node scripts/shoot.mjs
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { readFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = dirname(dirname(fileURLToPath(import.meta.url)));
const shots = JSON.parse(readFileSync(join(repo, 'shots.json'), 'utf8'));
const outDir = join(repo, 'screenshots');
mkdirSync(outDir, { recursive: true });

const server = spawn('node', ['serve.ts', '--port', '8123'], { cwd: repo, stdio: 'pipe' });
await new Promise((r) => setTimeout(r, 1200));

const browser = await chromium.launch({
  executablePath: '/home/hatch/.cache/ms-playwright/chromium-1187/chrome-linux/chrome',
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--disable-gpu-sandbox', '--enable-unsafe-swiftshader'],
});

const results = [];
for (const shot of shots) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('requestfailed', (r) => errors.push('requestfailed: ' + r.url()));
  await page.goto(`http://127.0.0.1:8123/${shot.query}`, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => window.__solaraReady === true, null, { timeout: 30000 });
  // let SwiftShader paint several frames (the chase needs longer: the
  // Interceptors close in over a few game-seconds)
  const waitMs = shot.name === '1-start.jpg' ? 9000 : shot.name === '3-chase.jpg' ? 14000 : 8000;
  await page.waitForTimeout(waitMs);
  const file = join(outDir, shot.name);
  await page.screenshot({ path: file, type: 'jpeg', quality: 82 });
  const size = statSync(file).size;
  results.push({ name: shot.name, bytes: size, errors });
  console.log(`${shot.name}: ${size} bytes, ${errors.length} errors`);
  for (const e of errors) console.log('  ' + e);
  await page.close();
}

await browser.close();
server.kill();
console.log('done');
for (const r of results) {
  if (r.bytes > 262144) console.log(`OVER SIZE: ${r.name}`);
}
