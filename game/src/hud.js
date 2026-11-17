// The HUD: cash, health, wanted stars, objective, bust meter, speedometer and
// the live top-down minimap drawn on a canvas every frame.
import { roadCenter, BLOCKS, HALF } from './city.js';

const $ = (id) => document.getElementById(id);

export class Hud {
  constructor() {
    this.map = $('minimap').getContext('2d');
    this.toastTimer = null;
  }

  setVisible(v) {
    $('hud').classList.toggle('hidden', !v);
  }

  showScreen(id) {
    for (const s of ['titleScreen', 'pauseScreen', 'missionScreen', 'storyScreen', 'bustedScreen', 'wastedScreen']) {
      $(s).classList.add('hidden');
    }
    if (id) $(id).classList.remove('hidden');
  }

  setCash(cash) {
    $('cash').innerHTML = `$${cash.toLocaleString('en-US')} <small>CASH</small>`;
  }

  setHealth(hp) {
    $('healthBar').style.width = `${Math.max(0, Math.min(100, hp))}%`;
    $('healthBar').style.background = hp > 50
      ? 'linear-gradient(90deg, #37d67a, #9be15d)'
      : hp > 25 ? 'linear-gradient(90deg, #e8a13a, #f0d25d)' : 'linear-gradient(90deg, #d63737, #f06d5d)';
  }

  setWanted(stars) {
    let html = '';
    for (let i = 0; i < 5; i++) {
      html += i < stars ? '★' : '<span class="dim">★</span>';
    }
    $('wanted').innerHTML = html;
  }

  setObjective(kicker, text) {
    $('objKicker').textContent = kicker;
    $('objText').textContent = text;
  }

  showPrompt(text) {
    const el = $('prompt');
    if (!text) { el.classList.add('hidden'); return; }
    el.innerHTML = text;
    el.classList.remove('hidden');
  }

  setBust(v) {
    const el = $('bustWrap');
    if (v <= 0) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    $('bustBar').style.width = `${Math.min(100, v * 100)}%`;
  }

  setSpeedo(visible, mph, carName) {
    const el = $('speedo');
    el.classList.toggle('hidden', !visible);
    if (visible) {
      $('speedVal').textContent = Math.round(mph);
      $('carName').textContent = carName;
    }
  }

  setCrosshair(v) {
    $('crosshair').classList.toggle('hidden', !v);
  }

  toast(text, ms = 2600) {
    const el = $('toast');
    el.textContent = text;
    el.classList.remove('hidden');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => el.classList.add('hidden'), ms);
  }

  // Live top-down map: streets, marina water, the player arrow, the waypoint
  // diamond, police blips and traffic dots.
  drawMinimap(px, pz, heading, waypoint, police, traffic, inCar) {
    const g = this.map;
    const S = 188;
    const scale = S / (HALF * 2);
    const toMap = (x, z) => [(x + HALF) * scale, (z + HALF) * scale];
    g.clearRect(0, 0, S, S);
    g.fillStyle = '#20262b';
    g.fillRect(0, 0, S, S);
    // marina water
    g.fillStyle = '#1e6a94';
    g.fillRect(0, S - 10, S, 10);
    // streets
    g.strokeStyle = '#5a636b';
    g.lineWidth = 5;
    for (let i = 0; i <= BLOCKS; i++) {
      const c = roadCenter(i);
      const [mx] = toMap(c, 0);
      const [, mz] = toMap(0, c);
      g.beginPath(); g.moveTo(mx, 0); g.lineTo(mx, S); g.stroke();
      g.beginPath(); g.moveTo(0, mz); g.lineTo(S, mz); g.stroke();
    }
    // traffic dots
    g.fillStyle = '#9aa5ad';
    for (const car of traffic) {
      const [mx, mz] = toMap(car.x, car.z);
      g.fillRect(mx - 1.5, mz - 1.5, 3, 3);
    }
    // waypoint diamond
    if (waypoint) {
      const [mx, mz] = toMap(waypoint.x, waypoint.z);
      g.fillStyle = '#ffd23e';
      g.beginPath();
      g.moveTo(mx, mz - 7); g.lineTo(mx + 6, mz); g.lineTo(mx, mz + 7); g.lineTo(mx - 6, mz);
      g.closePath(); g.fill();
      g.strokeStyle = '#fff';
      g.lineWidth = 1;
      g.stroke();
    }
    // police blips (pulsing red)
    const pulse = 3 + Math.sin(performance.now() / 180) * 1.2;
    g.fillStyle = '#ff3b3b';
    for (const p of police) {
      const [mx, mz] = toMap(p.x, p.z);
      g.beginPath(); g.arc(mx, mz, pulse, 0, Math.PI * 2); g.fill();
    }
    // player arrow
    const [mx, mz] = toMap(px, pz);
    g.save();
    g.translate(mx, mz);
    g.rotate(Math.atan2(Math.sin(heading), Math.cos(heading)));
    g.fillStyle = inCar ? '#7dff9b' : '#ffffff';
    g.beginPath();
    g.moveTo(0, -7); g.lineTo(5, 6); g.lineTo(0, 3); g.lineTo(-5, 6);
    g.closePath(); g.fill();
    g.strokeStyle = '#111';
    g.lineWidth = 1;
    g.stroke();
    g.restore();
  }
}
