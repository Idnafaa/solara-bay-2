// Every texture in Solara Bay is painted on a canvas at boot — no image files.
// Facades, the ground plan of the whole city, water, signs and car paint all
// come out of these little painters.
import { pick, rangeInt } from './rng.js';

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

// One building facade: a warm stucco base, rows of windows (a few lit), a
// parapet line and a ground-floor shopfront band.
export function paintFacade(rng, base, accent) {
  const [c, g] = makeCanvas(256, 256);
  g.fillStyle = base;
  g.fillRect(0, 0, 256, 256);
  // faint vertical sun-bleach streaks
  for (let i = 0; i < 26; i++) {
    g.fillStyle = `rgba(255,255,255,${0.02 + rng() * 0.05})`;
    g.fillRect(rng() * 256, 0, 2 + rng() * 8, 256);
  }
  // window grid
  const cols = 4 + rangeInt(rng, 0, 2);
  const rows = 5 + rangeInt(rng, 0, 3);
  const cw = 256 / cols, rh = 256 / rows;
  for (let x = 0; x < cols; x++) {
    for (let y = 0; y < rows; y++) {
      const wx = x * cw + cw * 0.22, wy = y * rh + rh * 0.2;
      const ww = cw * 0.56, wh = rh * 0.55;
      const lit = rng() < 0.22;
      g.fillStyle = lit ? '#ffe9a8' : (rng() < 0.5 ? '#1d2f3d' : '#2c4a5e');
      g.fillRect(wx, wy, ww, wh);
      g.fillStyle = 'rgba(255,255,255,0.25)';
      g.fillRect(wx, wy, ww, 3);
      g.strokeStyle = 'rgba(0,0,0,0.35)';
      g.strokeRect(wx, wy, ww, wh);
    }
  }
  // shopfront band at the bottom
  g.fillStyle = accent;
  g.fillRect(0, 256 - 34, 256, 34);
  g.fillStyle = 'rgba(255,255,255,0.85)';
  g.fillRect(10, 256 - 26, 236, 16);
  g.fillStyle = '#20303c';
  g.font = 'bold 11px sans-serif';
  g.fillText('SOLARA', 16, 256 - 14);
  // parapet
  g.fillStyle = 'rgba(0,0,0,0.25)';
  g.fillRect(0, 0, 256, 8);
  return c;
}

export function paintRoof(rng) {
  const [c, g] = makeCanvas(128, 128);
  g.fillStyle = pick(rng, ['#5a5f66', '#6b5a4e', '#4e5a58', '#7a6a5c']);
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = 'rgba(0,0,0,0.2)';
  g.fillRect(8, 8, 112, 112);
  g.fillStyle = '#c8ccd0';
  g.fillRect(20, 20, 26, 18); // AC unit
  g.fillRect(78, 60, 22, 22);
  g.fillStyle = '#8a9298';
  g.fillRect(48, 84, 30, 12);
  return c;
}

// The whole city ground plan on one canvas: block bases, sidewalks, asphalt
// streets with dashed centrelines and crosswalks. Mapped 1:1 over the world.
export function paintGround(worldSize, block, street, rng) {
  const S = 2048;
  const scale = S / worldSize;
  const [c, g] = makeCanvas(S, S);
  const px = (v) => (v + worldSize / 2) * scale;
  // base: pale sand-concrete
  g.fillStyle = '#b8a98c';
  g.fillRect(0, 0, S, S);
  // block pads
  g.fillStyle = '#c9bfa8';
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      const x0 = px(-worldSize / 2 + street + i * (block + street));
      const z0 = px(-worldSize / 2 + street + j * (block + street));
      g.fillRect(x0, z0, block * scale, block * scale);
    }
  }
  // asphalt streets
  g.fillStyle = '#3a3f45';
  for (let i = 0; i <= 8; i++) {
    const p = px(-worldSize / 2 + i * (block + street));
    g.fillRect(p, 0, street * scale, S);
    g.fillRect(0, p, S, street * scale);
  }
  // sidewalks: lighter strips along every street edge
  g.fillStyle = '#9d9684';
  for (let i = 0; i <= 8; i++) {
    const p = px(-worldSize / 2 + i * (block + street));
    g.fillRect(p, 0, 2.2 * scale, S);
    g.fillRect(p + (street - 2.2) * scale, 0, 2.2 * scale, S);
    g.fillRect(0, p, S, 2.2 * scale);
    g.fillRect(0, p + (street - 2.2) * scale, S, 2.2 * scale);
  }
  // dashed centrelines
  g.fillStyle = '#e8d44d';
  const dash = 3.2 * scale, gap = 3.2 * scale;
  for (let i = 0; i <= 8; i++) {
    const p = px(-worldSize / 2 + i * (block + street) + street / 2);
    for (let d = 0; d < S; d += dash + gap) {
      g.fillRect(p - 0.18 * scale, d, 0.36 * scale, dash);
      g.fillRect(d, p - 0.18 * scale, dash, 0.36 * scale);
    }
  }
  // crosswalks at every intersection
  g.fillStyle = 'rgba(240,240,235,0.85)';
  for (let i = 0; i <= 8; i++) {
    for (let j = 0; j <= 8; j++) {
      const cx = px(-worldSize / 2 + i * (block + street) + street / 2);
      const cz = px(-worldSize / 2 + j * (block + street) + street / 2);
      for (let s = -2; s <= 2; s++) {
        g.fillRect(cx + s * 1.4 * scale - 0.5 * scale, cz - 5 * scale, 1.0 * scale, 2.2 * scale);
        g.fillRect(cx + s * 1.4 * scale - 0.5 * scale, cz + 2.8 * scale, 1.0 * scale, 2.2 * scale);
        g.fillRect(cx - 5 * scale, cz + s * 1.4 * scale - 0.5 * scale, 2.2 * scale, 1.0 * scale);
        g.fillRect(cx + 2.8 * scale, cz + s * 1.4 * scale - 0.5 * scale, 2.2 * scale, 1.0 * scale);
      }
    }
  }
  // a few palm shadows / stains for life
  for (let i = 0; i < 300; i++) {
    g.fillStyle = `rgba(0,0,0,${0.02 + rng() * 0.04})`;
    g.beginPath();
    g.arc(rng() * S, rng() * S, 2 + rng() * 9, 0, Math.PI * 2);
    g.fill();
  }
  return c;
}

export function paintWater() {
  const [c, g] = makeCanvas(256, 256);
  const grad = g.createLinearGradient(0, 0, 256, 256);
  grad.addColorStop(0, '#2a7fa8');
  grad.addColorStop(0.5, '#1e6a94');
  grad.addColorStop(1, '#2f8fb5');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(255,255,255,0.25)';
  for (let i = 0; i < 40; i++) {
    g.beginPath();
    const y = rngLine(i);
    g.moveTo(0, y); g.bezierCurveTo(80, y - 6, 170, y + 6, 256, y);
    g.stroke();
  }
  function rngLine(i) { return (i * 53) % 256; }
  return c;
}

export function paintSign(text, bg, fg) {
  const [c, g] = makeCanvas(256, 64);
  g.fillStyle = bg;
  g.fillRect(0, 0, 256, 64);
  g.strokeStyle = fg;
  g.lineWidth = 4;
  g.strokeRect(3, 3, 250, 58);
  g.fillStyle = fg;
  g.font = 'bold 26px sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 128, 34);
  return c;
}
