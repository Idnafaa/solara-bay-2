// Cars: a boxy arcade build, traffic that drives the grid and stops at red
// lights, and police Interceptors that chase, ram and try to box the player in.
import * as THREE from 'three';
import { roadCenter, BLOCKS, HALF, resolveBuildings } from './city.js';
import { pick, range, rangeInt, clamp } from './rng.js';

export const CAR_NAMES = ['Vento S', 'Brisa GT', 'Laguna', 'Toro 4x4', 'Cielo Coupe', 'Marlin Van'];
const CAR_COLORS = [0xc23b2e, 0x2e6fc2, 0xe8c832, 0x3a9e6b, 0x8a4fb0, 0xd8d8d8, 0x22262b, 0xe07b2e];

function buildCarMesh(color, isPolice) {
  const group = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color });
  const dark = new THREE.MeshLambertMaterial({ color: 0x14181c });
  const glass = new THREE.MeshLambertMaterial({ color: 0x9fc6d8, emissive: 0x0e1a24 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, 4.4), paint);
  body.position.y = 0.62;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.55, 2.2), glass);
  cabin.position.set(0, 1.18, -0.2);
  group.add(cabin);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.35, 0.7), dark);
  nose.position.set(0, 0.5, 2.3);
  group.add(nose);
  // headlights + taillights
  const hl = new THREE.MeshLambertMaterial({ color: 0xfff6c8, emissive: 0xffe98a, emissiveIntensity: 0.9 });
  for (const sx of [-0.65, 0.65]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.08), hl);
    lamp.position.set(sx, 0.72, 2.52);
    group.add(lamp);
    const tail = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.16, 0.08),
      new THREE.MeshLambertMaterial({ color: 0xaa0000, emissive: 0xdd2222, emissiveIntensity: 0.7 }),
    );
    tail.position.set(sx, 0.72, -2.24);
    group.add(tail);
  }
  // wheels
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x0c0e10 });
  const wheels = [];
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.38, wz);
    group.add(w);
    wheels.push(w);
  }
  if (isPolice) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.22, 0.5), dark);
    bar.position.set(0, 1.58, -0.2);
    group.add(bar);
    const red = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.18, 0.46),
      new THREE.MeshLambertMaterial({ color: 0x550000, emissive: 0xff2222, emissiveIntensity: 2 }),
    );
    red.position.set(-0.28, 1.7, -0.2);
    group.add(red);
    const blue = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.18, 0.46),
      new THREE.MeshLambertMaterial({ color: 0x000055, emissive: 0x2244ff, emissiveIntensity: 2 }),
    );
    blue.position.set(0.28, 1.7, -0.2);
    group.add(blue);
    group.userData.flashRed = red;
    group.userData.flashBlue = blue;
  }
  group.userData.wheels = wheels;
  return group;
}

export function makeCar(scene, x, z, heading, opts = {}) {
  const color = opts.color ?? pick(opts.rng, CAR_COLORS);
  const mesh = buildCarMesh(color, !!opts.police);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = heading;
  scene.add(mesh);
  const car = {
    mesh,
    name: opts.name ?? pick(opts.rng, CAR_NAMES),
    x, z, heading,
    speed: 0,
    steer: 0,
    police: !!opts.police,
    traffic: !!opts.traffic,
    stolen: false,
    wheelSpin: 0,
    axis: opts.axis ?? 'z',       // traffic: which road it follows
    dir: opts.dir ?? 1,           // traffic: +1 / -1 along its axis
    cruise: opts.cruise ?? range(opts.rng, 9, 13),
    lane: opts.lane ?? (opts.rng() < 0.5 ? -2.2 : 2.2),
    stopped: false,
    flashT: 0,
  };
  return car;
}

export function removeCar(scene, car) {
  scene.remove(car.mesh);
}

// --- traffic ---

export function spawnTraffic(scene, rng, count) {
  const cars = [];
  for (let k = 0; k < count; k++) {
    const axis = rng() < 0.5 ? 'x' : 'z';
    const road = roadCenter(rangeInt(rng, 0, BLOCKS));
    const along = range(rng, -HALF + 20, HALF - 20);
    const dir = rng() < 0.5 ? 1 : -1;
    const x = axis === 'x' ? along : road;
    const z = axis === 'x' ? road : along;
    const heading = axis === 'x' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
    cars.push(makeCar(scene, x, z, heading, { rng, traffic: true, axis, dir, lane: dir > 0 ? 2.2 : -2.2 }));
  }
  return cars;
}

// Is the light at this intersection red for the car's axis? Lights cycle on a
// 12 s period: first half green for x-traffic, second half green for z-traffic.
function lightRedFor(lights, x, z, axis, time) {
  for (const l of lights) {
    // find the light nearest this intersection by matching its pole position
    const lx = l.red.position.x, lz = l.red.position.z;
    if (Math.abs(lx - x) < 9 && Math.abs(lz - z) < 9) {
      const phase = (time + l.phase) % 12;
      const xGreen = phase < 6;
      return axis === 'x' ? !xGreen : xGreen;
    }
  }
  return false;
}

export function updateTraffic(cars, lights, time, dt) {
  for (const car of cars) {
    // approaching an intersection? stop if the light is red for us.
    let wantStop = false;
    // check the next intersection centre along our road
    for (let i = 0; i <= BLOCKS; i++) {
      const c = roadCenter(i);
      const along = car.axis === 'x' ? car.x : car.z;
      const cross = car.axis === 'x' ? car.z : car.x;
      if (Math.abs(cross - c) < 7) {
        const dist = (c - along) * car.dir;
        if (dist > 0 && dist < 11 && lightRedFor(lights, car.axis === 'x' ? c : cross, car.axis === 'x' ? cross : c, car.axis, time)) {
          wantStop = true;
        }
      }
    }
    const target = wantStop ? 0 : car.cruise;
    car.speed += clamp(target - car.speed, -14 * dt, 8 * dt);
    const step = car.speed * dt * car.dir;
    if (car.axis === 'x') car.x += step;
    else car.z += step;
    // wrap around the city edge
    if (car.x > HALF - 4) car.x = -HALF + 4;
    if (car.x < -HALF + 4) car.x = HALF - 4;
    if (car.z > HALF - 4) car.z = -HALF + 4;
    if (car.z < -HALF + 4) car.z = HALF - 4;
    // keep on the lane (snap the cross-axis)
    const road = nearestRoad(car.axis === 'x' ? car.z : car.x);
    if (car.axis === 'x') car.z = road + car.lane;
    else car.x = road + car.lane;
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.heading;
    car.wheelSpin += car.speed * dt * 2.4;
    for (const w of car.mesh.userData.wheels) w.rotation.x = car.wheelSpin;
  }
}

function nearestRoad(v) {
  let best = roadCenter(0), bd = Infinity;
  for (let i = 0; i <= BLOCKS; i++) {
    const c = roadCenter(i);
    const d = Math.abs(v - c);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

// --- player driving (arcade) ---

export function driveCar(car, throttle, steerInput, dt, buildings) {
  const maxSpeed = car.police ? 24 : 27;
  const maxReverse = 9;
  if (throttle > 0) car.speed += 16 * dt;
  else if (throttle < 0) car.speed -= car.speed > 0.5 ? 26 * dt : 10 * dt;
  else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 8 * dt);
  car.speed = clamp(car.speed, -maxReverse, maxSpeed);
  car.steer = clamp(car.steer + (steerInput - car.steer) * Math.min(1, dt * 7), -1, 1);
  const turnRate = car.steer * 1.9 * clamp(Math.abs(car.speed) / 8, 0, 1) * Math.sign(car.speed || 1);
  car.heading += turnRate * dt;
  const nx = car.x + Math.sin(car.heading) * car.speed * dt;
  const nz = car.z + Math.cos(car.heading) * car.speed * dt;
  const oldX = car.x, oldZ = car.z;
  car.x = clamp(nx, -HALF + 4, HALF - 4);
  car.z = clamp(nz, -HALF + 4, HALF - 30); // water blocks the south edge
  const pos = { x: car.x, z: car.z };
  if (resolveBuildings(buildings, pos, 2.0)) {
    car.x = pos.x; car.z = pos.z;
    car.speed *= 0.45; // scrape the wall, lose speed
  } else if (car.x !== oldX || car.z !== oldZ) {
    car.x = pos.x; car.z = pos.z;
  }
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.heading;
  car.wheelSpin += car.speed * dt * 2.4;
  for (const w of car.mesh.userData.wheels) w.rotation.x = car.wheelSpin;
  return Math.abs(car.speed);
}

// --- police ---

export function spawnPolice(scene, rng, x, z) {
  const edge = pick(rng, ['n', 's', 'e', 'w']);
  let px = x, pz = z;
  if (edge === 'n') { px = x + range(rng, -40, 40); pz = z - 70; }
  if (edge === 's') { px = x + range(rng, -40, 40); pz = z + 70; }
  if (edge === 'e') { px = x + 70; pz = z + range(rng, -40, 40); }
  if (edge === 'w') { px = x - 70; pz = z + range(rng, -40, 40); }
  px = clamp(px, -HALF + 8, HALF - 8);
  pz = clamp(pz, -HALF + 8, HALF - 34);
  return makeCar(scene, px, pz, 0, { rng, police: true, color: 0xf2f2f2, name: 'SBPD Interceptor' });
}

export function updatePolice(car, targetX, targetZ, dt, time, buildings) {
  // steer toward the player, with a little weave so they do not all pile up
  const dx = targetX - car.x, dz = targetZ - car.z;
  const want = Math.atan2(dx, dz);
  let diff = want - car.heading;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  car.heading += clamp(diff, -2.2 * dt, 2.2 * dt);
  const dist = Math.sqrt(dx * dx + dz * dz);
  const targetSpeed = dist > 26 ? 23 : dist > 8 ? 15 : 6;
  car.speed += clamp(targetSpeed - car.speed, -20 * dt, 10 * dt);
  car.x += Math.sin(car.heading) * car.speed * dt;
  car.z += Math.cos(car.heading) * car.speed * dt;
  car.x = clamp(car.x, -HALF + 6, HALF - 6);
  car.z = clamp(car.z, -HALF + 6, HALF - 32);
  const pos = { x: car.x, z: car.z };
  if (resolveBuildings(buildings, pos, 2.0)) {
    car.x = pos.x; car.z = pos.z;
    car.speed *= 0.5;
  }
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.heading;
  car.wheelSpin += car.speed * dt * 2.4;
  for (const w of car.mesh.userData.wheels) w.rotation.x = car.wheelSpin;
  // flashing light bar
  car.flashT += dt;
  const on = Math.floor(car.flashT * 4) % 2 === 0;
  car.mesh.userData.flashRed.material.emissiveIntensity = on ? 2.2 : 0.15;
  car.mesh.userData.flashBlue.material.emissiveIntensity = on ? 0.15 : 2.2;
  return dist;
}
