// Solara Bay — main loop and game state. Third-person on foot and in cars,
// stealing, shooting, wanted heat and police, three story jobs, save/load,
// and the ?shot= staging hook the screenshots use.
import * as THREE from 'three';
import { mulberry32, clamp, dist2D } from './rng.js';
import { buildCity, roadCenter, HALF, resolveBuildings } from './city.js';
import { makeCar, spawnTraffic, updateTraffic, driveCar, spawnPolice, updatePolice, removeCar } from './vehicles.js';
import { spawnPedestrians, updatePedestrians, scarePedestrians } from './people.js';
import { Story } from './missions.js';
import { Hud } from './hud.js';
import { Input } from './input.js';
import { SoundBank } from './audio.js';

const $ = (id) => document.getElementById(id);
const SAVE_KEY = 'solara-bay-save-v1';
const params = new URLSearchParams(location.search);
const SHOT = params.get('shot') || '';
const SEED = Number(params.get('seed') || 7);

// ---------- renderer / scene ----------
const canvas = $('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8ec9e8);
scene.fog = new THREE.Fog(0x9fcfe8, 120, 340);

const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 800);
camera.position.set(0, 60, 120);

const sun = new THREE.DirectionalLight(0xfff2d8, 1.6);
sun.position.set(120, 180, 60);
scene.add(sun);
scene.add(new THREE.HemisphereLight(0xbfd9ff, 0x8a7a5a, 0.9));

// ---------- world ----------
const rng = mulberry32(SEED);
const city = buildCity(scene, rng);
const traffic = spawnTraffic(scene, rng, 11);
const parked = [];
const peds = spawnPedestrians(scene, rng, 14);
const police = [];

// ---------- player ----------
function buildPlayerMesh() {
  const g = new THREE.Group();
  const jacket = new THREE.MeshLambertMaterial({ color: 0xc23b2e });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2c3440 });
  const skin = new THREE.MeshLambertMaterial({ color: 0xe8b88a });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.9, 0.36), jacket);
  body.position.y = 1.18;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 12, 10), skin);
  head.position.y = 1.86;
  g.add(head);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.29, 0.12, 12),
    new THREE.MeshLambertMaterial({ color: 0x1d4e6b }));
  cap.position.y = 2.05;
  g.add(cap);
  for (const sx of [-0.17, 0.17]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.8, 0.26), pants);
    leg.position.set(sx, 0.4, 0);
    g.add(leg);
  }
  for (const sx of [-0.44, 0.44]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.72, 0.2), jacket);
    arm.position.set(sx, 1.18, 0);
    g.add(arm);
  }
  return g;
}

const player = {
  mesh: buildPlayerMesh(),
  x: 8, z: 20, y: 0, vy: 0,
  heading: Math.PI,
  speed: 0,
  health: 100,
  cash: 0,
  inCar: null,
  ammo: 12,
  reloadT: 0,
  lastShot: 0,
};
player.mesh.position.set(player.x, 0, player.z);
scene.add(player.mesh);

// ---------- game state ----------
const story = new Story();
const hud = new Hud();
const input = new Input(canvas);
const sound = new SoundBank();

let state = 'title'; // title | playing | paused | mission | story | busted | wasted
let wanted = 0;
let lastCrimeAt = -999;
let heatDropT = 0;
let bustT = 0;
let camYaw = Math.PI;
let camPitch = 0.32;
let time = 0;
let autoDrive = false;
let stats = { carsStolen: 0, shotsFired: 0, missionsDone: 0 };
let muted = false;

// waypoint beacon
const beaconMat = new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false });
const beacon = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 42, 20, 1, true), beaconMat);
beacon.position.y = 21;
scene.add(beacon);
const beaconTop = new THREE.Mesh(
  new THREE.OctahedronGeometry(1.6),
  new THREE.MeshBasicMaterial({ color: 0xffd23e }),
);
beaconTop.position.y = 34;
scene.add(beaconTop);

// hit sparks: a small pool of glowing tetrahedra
const sparks = [];
const sparkGeo = new THREE.TetrahedronGeometry(0.22);
const sparkMat = new THREE.MeshBasicMaterial({ color: 0xffe066 });
for (let i = 0; i < 14; i++) {
  const m = new THREE.Mesh(sparkGeo, sparkMat);
  m.visible = false;
  scene.add(m);
  sparks.push({ mesh: m, life: 0, vx: 0, vy: 0, vz: 0 });
}
function burstSpark(x, y, z) {
  let made = 0;
  for (const s of sparks) {
    if (s.life > 0) continue;
    s.life = 0.45;
    s.mesh.visible = true;
    s.mesh.position.set(x, y, z);
    s.vx = (Math.random() - 0.5) * 9;
    s.vy = Math.random() * 7 + 2;
    s.vz = (Math.random() - 0.5) * 9;
    if (++made >= 4) break;
  }
}
function updateSparks(dt) {
  for (const s of sparks) {
    if (s.life <= 0) continue;
    s.life -= dt;
    s.mesh.position.x += s.vx * dt;
    s.mesh.position.y += s.vy * dt;
    s.mesh.position.z += s.vz * dt;
    s.vy -= 18 * dt;
    s.mesh.visible = s.life > 0;
  }
}

// ---------- wanted / police ----------
function addHeat(n, why) {
  wanted = clamp(wanted + n, 0, 5);
  lastCrimeAt = time;
  hud.setWanted(wanted);
  if (why) hud.toast(why);
}

function syncPolice(dt) {
  const want = Math.min(wanted, 4);
  while (police.length < want) police.push(spawnPolice(scene, rng, player.x, player.z));
  while (police.length > want) removeCar(scene, police.pop());
  let nearest = Infinity;
  for (const p of police) {
    const d = updatePolice(p, player.x, player.z, dt, time, city.buildings);
    nearest = Math.min(nearest, d);
    // ramming the player hurts
    if (d < 3.4 && time - (p.lastRam || 0) > 1.2) {
      p.lastRam = time;
      hurtPlayer(6, 'The SBPD rammed you.');
    }
  }
  return nearest;
}

function hurtPlayer(n, msg) {
  if (state !== 'playing') return;
  player.health = Math.max(0, player.health - n);
  hud.setHealth(player.health);
  if (msg) hud.toast(msg);
  if (player.health <= 0) {
    state = 'wasted';
    hud.showScreen('wastedScreen');
    hud.setVisible(false);
    sound.blip(220);
  }
}

// ---------- save / load ----------
function saveGame(silent) {
  const data = {
    cash: player.cash, health: player.health,
    missionIndex: story.missionIndex, stageIndex: story.stageIndex,
    storyDone: story.done, x: player.x, z: player.z,
  };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    if (!silent) { hud.toast('Game saved.'); sound.cash(); }
  } catch { /* storage unavailable */ }
}

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function applySave(d) {
  player.cash = d.cash ?? 0;
  player.health = d.health ?? 100;
  story.missionIndex = d.missionIndex ?? 0;
  story.stageIndex = d.stageIndex ?? 0;
  story.done = !!d.storyDone;
  player.x = d.x ?? 8;
  player.z = d.z ?? 20;
  player.mesh.position.set(player.x, 0, player.z);
  hud.setCash(player.cash);
  hud.setHealth(player.health);
}

// ---------- flow ----------
function beginPlay(mode) {
  sound.start();
  hud.setVisible(true);
  hud.showScreen(null);
  hud.setCash(player.cash);
  hud.setHealth(player.health);
  hud.setWanted(wanted);
  if (mode === 'roam') story.startFreeRoam();
  state = 'playing';
  canvas.focus();
}

function finishMission(m) {
  // advance the story first (pays out the mission and moves to the next job)
  const finished = story.finishMission();
  const mission = finished ?? m;
  player.cash += mission.pay;
  stats.missionsDone++;
  hud.setCash(player.cash);
  sound.cash();
  saveGame(true);
  if (story.done) {
    state = 'story';
    $('storyStats').textContent = `Jobs done: ${stats.missionsDone} · Cars stolen: ${stats.carsStolen} · Cash earned: $${player.cash.toLocaleString('en-US')}`;
    hud.showScreen('storyScreen');
    hud.setVisible(false);
    return;
  }
  state = 'mission';
  $('missionTitle').textContent = mission.title;
  $('missionText').textContent = `${mission.giver} paid you for "${mission.title}". ${story.mission ? 'Next job: ' + story.mission.title + ' — ' + story.mission.brief : ''}`;
  $('missionPay').textContent = `+$${mission.pay.toLocaleString('en-US')} — total $${player.cash.toLocaleString('en-US')}`;
  hud.showScreen('missionScreen');
}

function respawn(afterBust) {
  // back on the street near the hospital corner, lighter wallet, clean slate
  if (player.inCar) { parked.push(player.inCar); player.inCar = null; }
  player.mesh.visible = true;
  for (const p of police.splice(0)) removeCar(scene, p);
  wanted = 0;
  bustT = 0;
  hud.setWanted(0);
  player.health = 100;
  player.cash = Math.max(0, player.cash - (afterBust ? 150 : 200));
  player.x = 6; player.z = -52;
  player.y = 0; player.vy = 0;
  player.mesh.position.set(player.x, 0, player.z);
  hud.setCash(player.cash);
  hud.setHealth(100);
  hud.setVisible(true);
  hud.showScreen(null);
  state = 'playing';
}

// ---------- buttons ----------
$('startBtn').addEventListener('click', () => beginPlay('story'));
$('roamBtn').addEventListener('click', () => beginPlay('roam'));
$('continueBtn').addEventListener('click', () => {
  const d = loadSave();
  if (d) applySave(d);
  beginPlay('story');
});
$('resumeBtn').addEventListener('click', () => {
  state = 'playing';
  hud.showScreen(null);
  hud.setVisible(true);
});
$('saveBtn').addEventListener('click', () => saveGame(false));
$('quitBtn').addEventListener('click', () => {
  state = 'title';
  hud.setVisible(false);
  hud.showScreen('titleScreen');
});
$('missionNextBtn').addEventListener('click', () => {
  state = 'playing';
  hud.showScreen(null);
  hud.setVisible(true);
});
$('storyFreeBtn').addEventListener('click', () => {
  state = 'playing';
  hud.showScreen(null);
  hud.setVisible(true);
});
$('bustedBtn').addEventListener('click', () => respawn(true));
$('wastedBtn').addEventListener('click', () => respawn(false));

input.onPause = () => {
  if (state === 'playing') {
    state = 'paused';
    hud.showScreen('pauseScreen');
    if (document.pointerLockElement) document.exitPointerLock();
  } else if (state === 'paused') {
    state = 'playing';
    hud.showScreen(null);
  }
};

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- combat ----------
const raycaster = new THREE.Raycaster();
function shoot() {
  if (player.reloadT > 0 || time - player.lastShot < 0.22) return;
  player.lastShot = time;
  stats.shotsFired++;
  if (player.ammo <= 0) {
    player.reloadT = 1.1;
    hud.toast('Reloading…');
    return;
  }
  player.ammo--;
  sound.gunshot();
  raycaster.setFromCamera({ x: 0, y: 0 }, camera);
  raycaster.far = 90;
  const targets = [];
  for (const p of peds) targets.push(p.mesh);
  for (const c of traffic) targets.push(c.mesh);
  for (const c of parked) targets.push(c.mesh);
  for (const c of police) targets.push(c.mesh);
  const hits = raycaster.intersectObjects(targets, true);
  if (hits.length > 0) {
    const hit = hits[0];
    burstSpark(hit.point.x, hit.point.y, hit.point.z);
    // find the pedestrian that was hit
    let obj = hit.object;
    while (obj && !obj.userData.pedRef) obj = obj.parent;
    const ped = peds.find((p) => p.mesh === obj);
    if (ped) {
      scarePedestrians(peds, ped.x, ped.z, 26);
      addHeat(1, 'You shot a local — the SBPD is coming.');
    }
  }
  if (player.ammo === 0) player.reloadT = 1.1;
}

// ---------- car enter / exit ----------
function nearestCar(maxD) {
  let best = null, bd = maxD;
  const all = [...traffic, ...parked];
  for (const c of all) {
    const d = dist2D(player.x, player.z, c.x, c.z);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

function enterCar(car) {
  const wasTraffic = traffic.includes(car);
  if (wasTraffic) {
    traffic.splice(traffic.indexOf(car), 1);
    car.traffic = false;
    stats.carsStolen++;
    addHeat(1, `You stole the ${car.name}!`);
    if (story.checkSteal()) hud.toast('Job update: car stolen. Get it to the chop shop.');
  } else {
    parked.splice(parked.indexOf(car), 1);
  }
  player.inCar = car;
  player.mesh.visible = false;
  camYaw = car.heading;
  sound.blip(520);
}

function exitCar() {
  const car = player.inCar;
  if (!car) return;
  player.inCar = null;
  parked.push(car);
  const side = Math.cos(car.heading);
  player.x = car.x + Math.sin(car.heading + Math.PI / 2) * 3;
  player.z = car.z + Math.cos(car.heading + Math.PI / 2) * 3;
  player.mesh.visible = true;
  player.mesh.position.set(player.x, 0, player.z);
  camYaw = car.heading;
}

// ---------- staging hook for screenshots ----------
function stageScene() {
  if (!SHOT) return;
  if (SHOT === 'start') {
    state = 'title';
    return;
  }
  if (SHOT === 'done') {
    story.missionIndex = 3;
    story.stageIndex = 0;
    story.done = true;
    player.cash = 2350;
    stats.missionsDone = 3;
    stats.carsStolen = 4;
    state = 'story';
    $('storyStats').textContent = 'Jobs done: 3 · Cars stolen: 4 · Cash earned: $2,350';
    hud.showScreen('storyScreen');
    return;
  }
  // drive / chase: put Dario in a car on a road, rolling
  const car = makeCar(scene, roadCenter(4) + 2.2, -60, 0, { rng, name: 'Brisa GT', color: 0xc23b2e });
  parked.push(car);
  enterCar(car);
  car.speed = 16;
  if (SHOT === 'chase') {
    wanted = 3;
    lastCrimeAt = time;
    hud.setWanted(3);
    // park the pursuit right on top of the player: one Interceptor ahead in
    // the lane (visible in frame, turning to chase), one behind, one alongside
    const spots = [[-4.4, 34], [9, -26], [26, 6]];
    for (const [ox, oz] of spots) {
      const p = spawnPolice(scene, rng, player.x, player.z);
      p.x = clamp(player.x + ox, -HALF + 8, HALF - 8);
      p.z = clamp(player.z + oz, -HALF + 8, HALF - 34);
      p.mesh.position.set(p.x, 0, p.z);
      police.push(p);
    }
    hud.toast('The SBPD is on your tail!');
  }
  autoDrive = true;
  beginPlay('roam');
}

// ---------- per-frame ----------
const clock = new THREE.Clock();
let firstFrame = true;

function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.05);
  time += dt;

  // traffic lights cycle
  for (const l of city.lights) {
    const phase = (time + l.phase) % 12;
    const xGreen = phase < 6;
    l.red.material.emissiveIntensity = xGreen ? 0.1 : 1.6;
    l.green.material.emissiveIntensity = xGreen ? 1.6 : 0.1;
  }

  updateTraffic(traffic, city.lights, time, dt);
  updatePedestrians(peds, city.buildings, dt, time);
  updateSparks(dt);

  // beacon + minimap waypoint
  const wp = story.waypoint;
  const showBeacon = state === 'playing' && wp && !story.done;
  beacon.visible = !!showBeacon;
  beaconTop.visible = !!showBeacon;
  if (showBeacon) {
    beacon.position.set(wp.x, 21, wp.z);
    beaconTop.position.set(wp.x, 34 + Math.sin(time * 2) * 1.2, wp.z);
    beaconTop.rotation.y += dt;
  }

  if (state === 'title') {
    // slow orbit over the city behind the title screen
    const a = time * 0.05;
    camera.position.set(Math.sin(a) * 130, 62, Math.cos(a) * 130);
    camera.lookAt(0, 10, 0);
  } else if (state === 'story' || state === 'busted' || state === 'wasted' || state === 'mission') {
    const a = time * 0.04 + 2;
    camera.position.set(Math.sin(a) * 90, 42, Math.cos(a) * 90);
    camera.lookAt(player.x, 4, player.z);
  } else if (state === 'playing') {
    playTick(dt);
  }

  if (state === 'playing' || state === 'paused') {
    hud.drawMinimap(player.x, player.z, player.inCar ? player.inCar.heading : camYaw, wp, police, traffic, !!player.inCar);
  }

  renderer.render(scene, camera);

  if (firstFrame) {
    firstFrame = false;
    window.__solaraReady = true;
  }
  input.endFrame();
}

function playTick(dt) {
  // camera look
  camYaw += input.yawDelta;
  camPitch = clamp(camPitch + input.pitchDelta, -0.15, 0.9);
  if (input.down('ArrowLeft')) camYaw += 1.9 * dt;
  if (input.down('ArrowRight')) camYaw -= 1.9 * dt;

  const speedNow = player.inCar ? Math.abs(player.inCar.speed) : 0;

  // ----- on foot -----
  if (!player.inCar) {
    const run = input.down('ShiftLeft') || input.down('ShiftRight');
    const spd = run ? 9 : 5;
    const fx = Math.sin(camYaw), fz = Math.cos(camYaw);
    const rx = -Math.cos(camYaw), rz = Math.sin(camYaw);
    let mx = fx * input.moveY + rx * input.moveX;
    let mz = fz * input.moveY + rz * input.moveX;
    const len = Math.hypot(mx, mz);
    if (len > 0) {
      mx /= len; mz /= len;
      player.x += mx * spd * dt;
      player.z += mz * spd * dt;
      player.heading = Math.atan2(mx, mz);
      player.speed = spd;
    } else {
      player.speed = 0;
    }
    player.x = clamp(player.x, -HALF + 3, HALF - 3);
    player.z = clamp(player.z, -HALF + 3, HALF - 31);
    const pos = { x: player.x, z: player.z };
    resolveBuildings(city.buildings, pos, 0.7);
    player.x = pos.x; player.z = pos.z;
    // jump + gravity
    if (input.wasPressed('Space') && player.y === 0) player.vy = 7.5;
    player.vy -= 22 * dt;
    player.y = Math.max(0, player.y + player.vy * dt);
    if (player.y === 0) player.vy = 0;
    player.mesh.position.set(player.x, player.y, player.z);
    player.mesh.rotation.y = player.heading;
    // walk bob
    const bob = player.speed > 0 ? Math.abs(Math.sin(time * (run ? 11 : 7))) * 0.07 : 0;
    player.mesh.position.y = player.y + bob;

    // chase camera
    const cx = player.x - Math.sin(camYaw) * 7.5;
    const cz = player.z - Math.cos(camYaw) * 7.5;
    camera.position.set(cx, 3.6 + camPitch * 6, cz);
    camera.lookAt(player.x, 2.1, player.z);

    // shooting
    if (input.clicked) shoot();
    if (player.reloadT > 0) {
      player.reloadT -= dt;
      if (player.reloadT <= 0) { player.ammo = 12; hud.toast('Pistol reloaded.'); }
    }
    hud.setCrosshair(true);

    // context prompt: steal / interact
    const car = nearestCar(4.5);
    const st = story.stage;
    if (st && st.type === 'interact' && dist2D(player.x, player.z, st.x, st.z) < st.radius) {
      hud.showPrompt('Press <b>E</b> — ' + st.text);
    } else if (car) {
      hud.showPrompt(`Press <b>E</b> to steal the ${car.name}`);
    } else {
      hud.showPrompt(null);
    }
    if (input.wasPressed('KeyE')) {
      if (st && st.type === 'interact' && dist2D(player.x, player.z, st.x, st.z) < st.radius) {
        story.checkInteract(player.x, player.z);
        sound.blip(990);
        const done = story.missionComplete();
        if (done) finishMission(done);
        else hud.toast('Done. Next stop is on your map.');
      } else if (car) {
        enterCar(car);
      }
    }
  } else {
    // ----- driving -----
    const car = player.inCar;
    const throttle = autoDrive ? 1 : input.moveY;
    const steer = autoDrive ? Math.sin(time * 0.35) * 0.25 : -input.moveX;
    driveCar(car, throttle, steer, dt, city.buildings);
    player.x = car.x; player.z = car.z;
    player.speed = car.speed;
    hud.setCrosshair(false);
    hud.setSpeedo(true, Math.abs(car.speed) * 2.2, car.name);
    hud.showPrompt('Press <b>E</b> to get out');
    if (input.wasPressed('KeyE')) exitCar();
    // ramming a pedestrian is a crime
    for (const p of peds) {
      if (dist2D(p.x, p.z, car.x, car.z) < 2.4 && Math.abs(car.speed) > 4) {
        scarePedestrians(peds, p.x, p.z, 30);
        addHeat(1, 'You hit a pedestrian!');
        car.speed *= 0.6;
        p.panic = 5; p.panicX = car.x; p.panicZ = car.z;
      }
    }
    // chase camera behind the car
    const back = 10.5;
    const cx = car.x - Math.sin(car.heading) * back;
    const cz = car.z - Math.cos(car.heading) * back;
    camera.position.x += (cx - camera.position.x) * Math.min(1, dt * 5);
    camera.position.y += (4.6 + camPitch * 4 - camera.position.y) * Math.min(1, dt * 5);
    camera.position.z += (cz - camera.position.z) * Math.min(1, dt * 5);
    camera.lookAt(car.x + Math.sin(car.heading) * 8, 1.6, car.z + Math.cos(car.heading) * 8);
  }
  if (!player.inCar) hud.setSpeedo(false, 0, '');

  // ----- missions: goto stages -----
  const done = story.checkGoto(player.x, player.z);
  if (done) {
    sound.blip(990);
    const m = story.missionComplete();
    if (m) finishMission(m);
    else hud.toast('Objective reached.');
  }
  // mission 3 starts hot
  if (story.mission && story.mission.id === 'harborrun' && story.stageIndex === 0 && wanted < 2) {
    addHeat(2, 'The SBPD knows about the Harbor Run.');
  }

  // ----- wanted decay / bust -----
  if (wanted > 0) {
    const nearest = syncPolice(dt);
    sound.setSiren(true);
    const sinceCrime = time - lastCrimeAt;
    if (sinceCrime > 12 && nearest > 45) {
      heatDropT += dt;
      if (heatDropT > 8) {
        heatDropT = 0;
        wanted--;
        hud.setWanted(wanted);
        hud.toast(wanted > 0 ? `Heat dropping — ${wanted} star${wanted === 1 ? '' : 's'} left.` : 'You lost the cops.');
      }
    } else {
      heatDropT = 0;
    }
    // busted: boxed in at a crawl while a cop is right on you
    const slow = player.inCar ? Math.abs(player.inCar.speed) < 1 : player.speed < 1;
    if (slow && nearest < 9) {
      bustT += dt;
      hud.setBust(bustT / 2.5);
      if (bustT > 2.5) {
        state = 'busted';
        hud.showScreen('bustedScreen');
        hud.setVisible(false);
        hud.setBust(0);
        sound.blip(180);
      }
    } else {
      bustT = Math.max(0, bustT - dt * 1.5);
      hud.setBust(0);
    }
  } else {
    if (police.length) for (const p of police.splice(0)) removeCar(scene, p);
    sound.setSiren(false);
    hud.setBust(0);
  }

  // ----- health regen when calm -----
  if (wanted === 0 && player.health < 100 && time % 1 < dt) {
    player.health = Math.min(100, player.health + 1);
    hud.setHealth(player.health);
  }

  // ----- engine audio -----
  sound.setEngine(clamp(speedNow / 27, 0, 1), !!player.inCar);

  // ----- HUD -----
  hud.setObjective(story.objectiveKicker, story.objectiveText);
  hud.setHealth(player.health);

  // ----- keys -----
  if (input.wasPressed('KeyP')) saveGame(false);
  if (input.wasPressed('KeyM')) {
    muted = sound.toggleMute();
    hud.toast(muted ? 'Sound muted (M).' : 'Sound on (M).');
  }
}

// ---------- debug handle for the playtest ----------
window.__solara = {
  get state() { return state; },
  get wanted() { return wanted; },
  get cash() { return player.cash; },
  get health() { return player.health; },
  get inCar() { return !!player.inCar; },
  get missionIndex() { return story.missionIndex; },
  get stageIndex() { return story.stageIndex; },
  get storyDone() { return story.done; },
  get playerX() { return player.x; },
  get playerZ() { return player.z; },
  get policeCount() { return police.length; },
  get trafficCount() { return traffic.length; },
  get ammo() { return player.ammo; },
  // test hook: drop Dario at a map position (on foot)
  warp(x, z) {
    if (player.inCar) { parked.push(player.inCar); player.inCar = null; player.mesh.visible = true; }
    player.x = x; player.z = z;
    player.mesh.position.set(x, 0, z);
  },
};

// ---------- boot ----------
const saved = loadSave();
if (saved) $('continueBtn').classList.remove('hidden');
stageScene();
tick();
