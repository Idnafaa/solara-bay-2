// Pedestrians: Solara Bay locals strolling the sidewalks who panic and run
// when they hear a gunshot or see a crime up close.
import * as THREE from 'three';
import { roadCenter, BLOCKS, HALF, resolveBuildings } from './city.js';
import { pick, range, rangeInt } from './rng.js';
import { dist2D, clamp } from './rng.js';

const SHIRTS = [0xe8e8e8, 0xc23b2e, 0x2e6fc2, 0xe8c832, 0x3a9e6b, 0xe07b2e, 0x8a4fb0, 0x6b4a2f];
const PANTS = [0x2c3440, 0x5a4632, 0x3a3f45, 0x7a6a8a];

export function makePedestrian(scene, rng, x, z) {
  const group = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: pick(rng, SHIRTS) });
  const pants = new THREE.MeshLambertMaterial({ color: pick(rng, PANTS) });
  const skin = new THREE.MeshLambertMaterial({ color: pick(rng, [0xe8b88a, 0xc98d5f, 0x8a5a34, 0xf0c8a0]) });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.85, 0.34), shirt);
  body.position.y = 1.15;
  group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), skin);
  head.position.y = 1.82;
  group.add(head);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.75, 0.24), pants);
  legL.position.set(-0.16, 0.38, 0);
  group.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.16;
  group.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.7, 0.18), shirt);
  armL.position.set(-0.4, 1.15, 0);
  group.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.4;
  group.add(armR);
  group.position.set(x, 0, z);
  scene.add(group);
  return {
    mesh: group, legL, legR, armL, armR,
    x, z, heading: range(rng, 0, Math.PI * 2),
    speed: range(rng, 1.1, 1.9),
    panic: 0,           // seconds of panic left
    panicX: 0, panicZ: 0,
    walkPhase: range(rng, 0, 6),
    axis: rng() < 0.5 ? 'x' : 'z',
    dir: rng() < 0.5 ? 1 : -1,
    lane: (rng() < 0.5 ? -1 : 1) * range(rng, 3.4, 5.2),
  };
}

export function spawnPedestrians(scene, rng, count) {
  const peds = [];
  for (let k = 0; k < count; k++) {
    const road = roadCenter(rangeInt(rng, 0, BLOCKS));
    const along = range(rng, -HALF + 16, HALF - 40);
    const axis = rng() < 0.5 ? 'x' : 'z';
    const lane = (rng() < 0.5 ? -1 : 1) * range(rng, 3.4, 5.2);
    const x = axis === 'x' ? along : road + lane;
    const z = axis === 'x' ? road + lane : along;
    peds.push(makePedestrian(scene, rng, x, z));
  }
  return peds;
}

export function scarePedestrians(peds, x, z, radius) {
  for (const p of peds) {
    if (dist2D(p.x, p.z, x, z) < radius) {
      p.panic = 4 + Math.random() * 3;
      p.panicX = x; p.panicZ = z;
    }
  }
}

export function updatePedestrians(peds, buildings, dt, time) {
  for (const p of peds) {
    p.walkPhase += dt * (p.panic > 0 ? 11 : 5);
    let vx = 0, vz = 0;
    if (p.panic > 0) {
      p.panic -= dt;
      // run directly away from the scare point
      const dx = p.x - p.panicX, dz = p.z - p.panicZ;
      const d = Math.max(0.1, Math.sqrt(dx * dx + dz * dz));
      vx = (dx / d) * 5.2;
      vz = (dz / d) * 5.2;
      p.heading = Math.atan2(vx, vz);
    } else {
      // stroll along the sidewalk, turning at the city edge
      const step = p.speed * p.dir * dt;
      if (p.axis === 'x') { p.x += step; } else { p.z += step; }
      const along = p.axis === 'x' ? p.x : p.z;
      if (along > HALF - 14 || along < -HALF + 14) p.dir *= -1;
      p.heading = p.axis === 'x'
        ? (p.dir > 0 ? Math.PI / 2 : -Math.PI / 2)
        : (p.dir > 0 ? 0 : Math.PI);
      vx = p.axis === 'x' ? p.speed * p.dir : 0;
      vz = p.axis === 'z' ? p.speed * p.dir : 0;
    }
    if (p.panic > 0) {
      p.x += vx * dt;
      p.z += vz * dt;
      p.x = clamp(p.x, -HALF + 6, HALF - 6);
      p.z = clamp(p.z, -HALF + 6, HALF - 34);
    }
    const pos = { x: p.x, z: p.z };
    resolveBuildings(buildings, pos, 0.7);
    p.x = pos.x; p.z = pos.z;
    p.mesh.position.set(p.x, 0, p.z);
    p.mesh.rotation.y = p.heading;
    // walk cycle: legs and arms swing, body bobs
    const swing = Math.sin(p.walkPhase) * (p.panic > 0 ? 0.8 : 0.45);
    p.legL.rotation.x = swing;
    p.legR.rotation.x = -swing;
    p.armL.rotation.x = -swing * 0.7;
    p.armR.rotation.x = swing * 0.7;
    p.mesh.position.y = Math.abs(Math.sin(p.walkPhase)) * 0.05;
  }
}
