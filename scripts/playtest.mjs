// Solara Bay — headless playtest. Loads the game, collects console errors
// and pageerrors, then plays it: start the story, walk, finish mission 1 end
// to end (warp to each objective, interact), shoot once, save, pause/resume,
// steal a car, drive, exit, steal it back, and check the police chase staging.
// Prints a PASS/FAIL line for every step. Usage: node scripts/playtest.mjs
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = dirname(dirname(fileURLToPath(import.meta.url)));
const server = spawn('node', ['serve.ts', '--port', '8124'], { cwd: repo, stdio: 'pipe' });
await new Promise((r) => setTimeout(r, 1200));

const browser = await chromium.launch({
  executablePath: '/home/hatch/.cache/ms-playwright/chromium-1187/chrome-linux/chrome',
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('requestfailed', (r) => errors.push('requestfailed: ' + r.url()));

const check = (name, ok, extra = '') => console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
const state = () => page.evaluate(() => window.__solara);
// SwiftShader runs ~2 fps, so a keypress may sit unprocessed for a frame or
// two: poll until the wanted state shows up (or 12 s pass).
async function waitState(pred, timeout = 12000) {
  try {
    await page.waitForFunction(pred, null, { timeout });
    return true;
  } catch { return false; }
}

await page.goto('http://127.0.0.1:8124/', { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction(() => window.__solaraReady === true, null, { timeout: 60000 });
await page.waitForTimeout(3000);
check('page loads, first frame rendered', true);

// start the story
await page.click('#startBtn');
await page.waitForTimeout(1500);
let s = await state();
check('start button begins play', s.state === 'playing', `state=${s.state}`);

// walk forward (hold W; at ~2 fps the dt clamp makes this slow, so wait long)
const x0 = s.playerX, z0 = s.playerZ;
await page.keyboard.down('KeyW');
await page.waitForTimeout(9000);
await page.keyboard.up('KeyW');
s = await state();
const moved = Math.hypot(s.playerX - x0, s.playerZ - z0);
check('walking moves the player', moved > 2, `moved ${moved.toFixed(1)} units`);

// mission 1 end to end: docks -> interact -> Lena -> interact -> paid
await page.evaluate(() => window.__solara.warp(150, 178));
check('mission 1 stage advances at the docks',
  await waitState(() => window.__solara.stageIndex >= 1), `stage=${(await state()).stageIndex}`);
await page.keyboard.press('KeyE');
check('mission 1 interact picks up the package',
  await waitState(() => window.__solara.stageIndex >= 2), `stage=${(await state()).stageIndex}`);
await page.evaluate(() => window.__solara.warp(10, 10));
check('mission 1 stage advances back at Lena',
  await waitState(() => window.__solara.stageIndex >= 3), `stage=${(await state()).stageIndex}`);
await page.keyboard.press('KeyE');
check('mission 1 completes and pays $400',
  await waitState(() => window.__solara.state === 'mission' && window.__solara.cash === 400),
  `state=${(await state()).state} cash=${(await state()).cash}`);
await page.click('#missionNextBtn');
await page.waitForTimeout(800);
s = await state();
check('mission screen resumes play, mission 2 active',
  s.state === 'playing' && s.missionIndex === 1, `state=${s.state} mission=${s.missionIndex}`);

// shoot once (pistol)
await page.mouse.click(640, 400);
check('shooting consumes ammo',
  await waitState(() => window.__solara.ammo < 12), `ammo=${(await state()).ammo}`);

// save with P
await page.keyboard.press('KeyP');
await page.waitForTimeout(1500);
const saved = await page.evaluate(() => localStorage.getItem('solara-bay-save-v1'));
check('P saves progress to localStorage', !!saved, saved ? saved.slice(0, 80) : '');

// pause and resume with Esc
await page.keyboard.press('Escape');
check('Esc pauses', await waitState(() => window.__solara.state === 'paused'));
await page.keyboard.press('Escape');
check('Esc resumes', await waitState(() => window.__solara.state === 'playing'));
await page.close();

// steal + drive check on the staged drive page (car is pre-staged there)
const drive = await browser.newPage({ viewport: { width: 1280, height: 800 } });
drive.on('pageerror', (e) => errors.push('drive pageerror: ' + e.message));
drive.on('console', (m) => { if (m.type() === 'error') errors.push('drive console: ' + m.text()); });
await drive.goto('http://127.0.0.1:8124/?shot=drive&seed=7', { waitUntil: 'load', timeout: 60000 });
await drive.waitForFunction(() => window.__solaraReady === true, null, { timeout: 60000 });
await drive.waitForTimeout(4000);
let d = await drive.evaluate(() => window.__solara);
check('drive staging puts player in a car', d.inCar === true, `inCar=${d.inCar}`);
check('drive staging is playing', d.state === 'playing', `state=${d.state}`);
await drive.keyboard.press('KeyE');
check('E exits the car',
  await drive.waitForFunction(() => window.__solara.inCar === false, null, { timeout: 12000 }).then(() => true).catch(() => false));
await drive.keyboard.press('KeyE');
d = await drive.evaluate(() => window.__solara);
check('E steals the parked car back',
  await drive.waitForFunction(() => window.__solara.inCar === true, null, { timeout: 12000 }).then(() => true).catch(() => false),
  `inCar=${(await drive.evaluate(() => window.__solara)).inCar}`);
await drive.close();

// chase staging: wanted + police
const chase = await browser.newPage({ viewport: { width: 1280, height: 800 } });
chase.on('pageerror', (e) => errors.push('chase pageerror: ' + e.message));
chase.on('console', (m) => { if (m.type() === 'error') errors.push('chase console: ' + m.text()); });
await chase.goto('http://127.0.0.1:8124/?shot=chase&seed=7', { waitUntil: 'load', timeout: 60000 });
await chase.waitForFunction(() => window.__solaraReady === true, null, { timeout: 60000 });
await chase.waitForTimeout(4000);
const c = await chase.evaluate(() => window.__solara);
check('chase staging: wanted 3 stars', c.wanted === 3, `wanted=${c.wanted}`);
check('chase staging: police spawned', c.policeCount >= 2, `police=${c.policeCount}`);
await chase.close();

console.log(`\nconsole/page errors total: ${errors.length}`);
for (const e of errors) console.log('  ' + e);
await browser.close();
server.kill();
