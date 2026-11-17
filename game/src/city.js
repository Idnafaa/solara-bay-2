// Solara Bay itself: an 8x8 street grid of sun-bleached towers, a palm-lined
// marina at the south edge, traffic lights, and the collision boxes the rest
// of the game steers around.
import * as THREE from 'three';
import { paintFacade, paintRoof, paintGround, paintWater, paintSign } from './textures.js';
import { pick, range, rangeInt, clamp } from './rng.js';

export const BLOCKS = 8;
export const BLOCK = 40;
export const STREET = 12;
export const PITCH = BLOCK + STREET;
export const WORLD = BLOCKS * PITCH + STREET; // 428
export const HALF = WORLD / 2; // 214

// Centre line of the i-th road (i = 0..8), in world units.
export function roadCenter(i) {
  return -HALF + i * PITCH + STREET / 2;
}

const FACADE_BASES = ['#e8c9a0', '#d9b48a', '#e5d3b3', '#c9a184', '#dcc7a8', '#b7c4c9', '#e0b49a'];
const FACADE_ACCENTS = ['#2e7f9e', '#c65a3a', '#3f8f5f', '#8a5f9e', '#b98a2e'];

export function buildCity(scene, rng) {
  const buildings = []; // {minX,maxX,minZ,maxZ,h} collision boxes
  const lights = [];    // traffic lights {mesh, red, green, phase}
  const palms = [];

  // ---- ground: one painted plan of the whole city ----
  const groundTex = new THREE.CanvasTexture(paintGround(WORLD, BLOCK, STREET, rng));
  groundTex.colorSpace = THREE.SRGBColorSpace;
  groundTex.anisotropy = 4;
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD, WORLD),
    new THREE.MeshLambertMaterial({ map: groundTex }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = false;
  scene.add(ground);

  // ---- water + docks at the south edge ----
  const waterTex = new THREE.CanvasTexture(paintWater());
  waterTex.wrapS = waterTex.wrapT = THREE.RepeatWrapping;
  waterTex.repeat.set(8, 1);
  waterTex.colorSpace = THREE.SRGBColorSpace;
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD, 22),
    new THREE.MeshLambertMaterial({ map: waterTex }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, 0.05, HALF - 11);
  scene.add(water);

  const dockMat = new THREE.MeshLambertMaterial({ color: 0x8a6b45 });
  for (let i = 0; i < 4; i++) {
    const dock = new THREE.Mesh(new THREE.BoxGeometry(10, 0.6, 16), dockMat);
    dock.position.set(-150 + i * 100, 0.3, HALF - 26);
    scene.add(dock);
    // a moored boat: hull + cabin
    const hull = new THREE.Mesh(
      new THREE.BoxGeometry(5, 2.2, 12),
      new THREE.MeshLambertMaterial({ color: pick(rng, [0xe8e8e8, 0x3a6ea5, 0xc65a3a, 0x2e7f6e]) }),
    );
    hull.position.set(-150 + i * 100, 0.6, HALF - 14);
    scene.add(hull);
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(3.4, 1.8, 5),
      new THREE.MeshLambertMaterial({ color: 0xf2ede2 }),
    );
    cabin.position.set(-150 + i * 100, 2.4, HALF - 14);
    scene.add(cabin);
  }

  // ---- buildings ----
  const facadeMats = [];
  for (let k = 0; k < 6; k++) {
    const tex = new THREE.CanvasTexture(paintFacade(rng, FACADE_BASES[k % FACADE_BASES.length], FACADE_ACCENTS[k % FACADE_ACCENTS.length]));
    tex.colorSpace = THREE.SRGBColorSpace;
    facadeMats.push(new THREE.MeshLambertMaterial({ map: tex }));
  }
  const roofTex = new THREE.CanvasTexture(paintRoof(rng));
  roofTex.colorSpace = THREE.SRGBColorSpace;
  const roofMat = new THREE.MeshLambertMaterial({ map: roofTex });

  const towerGlass = new THREE.MeshLambertMaterial({ color: 0x9fc6d8, emissive: 0x1a2c38 });
  const spireMat = new THREE.MeshLambertMaterial({ color: 0xd8d2c4 });

  for (let i = 0; i < BLOCKS; i++) {
    for (let j = 0; j < BLOCKS; j++) {
      if (j === BLOCKS - 1) continue; // marina row stays open
      const bx = -HALF + STREET + i * PITCH;
      const bz = -HALF + STREET + j * PITCH;
      const downtown = i >= 3 && i <= 4 && j >= 2 && j <= 4;
      const count = downtown ? 1 : rangeInt(rng, 1, 3);
      for (let n = 0; n < count; n++) {
        const w = downtown ? 26 : range(rng, 12, 20);
        const d = downtown ? 26 : range(rng, 12, 20);
        const h = downtown ? range(rng, 55, 95) : range(rng, 9, 34);
        const x = bx + (n === 0 ? BLOCK / 2 : range(rng, w / 2 + 2, BLOCK - w / 2 - 2));
        const z = bz + (n === 0 ? BLOCK / 2 : range(rng, d / 2 + 2, BLOCK - d / 2 - 2));
        const mats = [facadeMats[rangeInt(rng, 0, 5)], facadeMats[rangeInt(rng, 0, 5)], roofMat, roofMat, facadeMats[rangeInt(rng, 0, 5)], facadeMats[rangeInt(rng, 0, 5)]];
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats);
        mesh.position.set(x, h / 2, z);
        scene.add(mesh);
        buildings.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, h });
        if (downtown && h > 70) {
          // glass crown + spire on the tallest towers
          const crown = new THREE.Mesh(new THREE.BoxGeometry(w * 0.55, 6, d * 0.55), towerGlass);
          crown.position.set(x, h + 3, z);
          scene.add(crown);
          const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 1.2, 14, 6), spireMat);
          spire.position.set(x, h + 12, z);
          scene.add(spire);
        }
      }
    }
  }

  // ---- palms along the sidewalks ----
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5a38 });
  const frondMat = new THREE.MeshLambertMaterial({ color: 0x2f7d4a });
  const trunkGeo = new THREE.CylinderGeometry(0.35, 0.55, 7, 6);
  const frondGeo = new THREE.IcosahedronGeometry(2.6, 0);
  for (let k = 0; k < 34; k++) {
    const along = roadCenter(rangeInt(rng, 0, 8));
    const cross = roadCenter(rangeInt(rng, 0, 7));
    const side = rng() < 0.5 ? -1 : 1;
    const x = clamp(along + side * (STREET / 2 - 1.2), -HALF + 4, HALF - 4);
    const z = clamp(cross + range(rng, -14, 14), -HALF + 4, HALF - 30);
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.set(x, 3.5, z);
    trunk.rotation.z = range(rng, -0.08, 0.08);
    scene.add(trunk);
    const fronds = new THREE.Mesh(frondGeo, frondMat);
    fronds.scale.y = 0.45;
    fronds.position.set(x, 7.4, z);
    scene.add(fronds);
    palms.push({ x, z });
  }

  // ---- traffic lights at every other intersection ----
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x2c2f33 });
  for (let i = 1; i < BLOCKS; i += 2) {
    for (let j = 1; j < BLOCKS; j += 2) {
      const x = roadCenter(i) + STREET / 2 - 1;
      const z = roadCenter(j) - STREET / 2 + 1;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 6.4, 6), poleMat);
      pole.position.set(x, 3.2, z);
      scene.add(pole);
      const housing = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.2, 0.9), poleMat);
      housing.position.set(x, 6.2, z);
      scene.add(housing);
      const red = new THREE.Mesh(
        new THREE.SphereGeometry(0.32, 10, 8),
        new THREE.MeshLambertMaterial({ color: 0x550000, emissive: 0xff2222, emissiveIntensity: 1 }),
      );
      red.position.set(x, 6.8, z + 0.5);
      scene.add(red);
      const green = new THREE.Mesh(
        new THREE.SphereGeometry(0.32, 10, 8),
        new THREE.MeshLambertMaterial({ color: 0x003300, emissive: 0x22ff66, emissiveIntensity: 0.05 }),
      );
      green.position.set(x, 5.7, z + 0.5);
      scene.add(green);
      lights.push({ red, green, phase: (i * 3 + j * 5) % 12 });
    }
  }

  // ---- billboards ----
  const signs = [
    { text: 'SOLARA BAY', bg: '#e8632c', fg: '#ffffff', x: -52, z: -100, ry: Math.PI / 2 },
    { text: 'VENTO MOTORS', bg: '#1d4e6b', fg: '#ffd23e', x: 104, z: 52, ry: 0 },
    { text: 'MARINA DEL SOL', bg: '#2e7f6e', fg: '#ffffff', x: -104, z: 156, ry: Math.PI },
  ];
  for (const s of signs) {
    const tex = new THREE.CanvasTexture(paintSign(s.text, s.bg, s.fg));
    tex.colorSpace = THREE.SRGBColorSpace;
    const board = new THREE.Mesh(
      new THREE.PlaneGeometry(22, 5.5),
      new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide }),
    );
    board.position.set(s.x, 16, s.z);
    board.rotation.y = s.ry;
    scene.add(board);
    const postA = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 14, 6), poleMat);
    postA.position.set(s.x - 8, 7, s.z);
    scene.add(postA);
    const postB = postA.clone();
    postB.position.x = s.x + 8;
    scene.add(postB);
  }

  return { buildings, lights, palms };
}

// True when the point (x,z) with the given radius is inside any building.
export function hitsBuilding(buildings, x, z, radius) {
  for (const b of buildings) {
    if (x + radius > b.minX && x - radius < b.maxX && z + radius > b.minZ && z - radius < b.maxZ) {
      return b;
    }
  }
  return null;
}

// Push a circle out of every building it overlaps. Returns true if pushed.
export function resolveBuildings(buildings, pos, radius) {
  let pushed = false;
  for (const b of buildings) {
    const cx = clamp(pos.x, b.minX, b.maxX);
    const cz = clamp(pos.z, b.minZ, b.maxZ);
    const dx = pos.x - cx, dz = pos.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      if (d2 > 1e-6) {
        const d = Math.sqrt(d2);
        pos.x = cx + (dx / d) * radius;
        pos.z = cz + (dz / d) * radius;
      } else {
        // centre inside the box: shove out along the smallest penetration axis
        const pl = pos.x - b.minX, pr = b.maxX - pos.x;
        const pt = pos.z - b.minZ, pb = b.maxZ - pos.z;
        const m = Math.min(pl, pr, pt, pb);
        if (m === pl) pos.x = b.minX - radius;
        else if (m === pr) pos.x = b.maxX + radius;
        else if (m === pt) pos.z = b.minZ - radius;
        else pos.z = b.maxZ + radius;
      }
      pushed = true;
    }
  }
  return pushed;
}

// Nearest point on the road network to (x,z): snaps to the closest road centre.
export function nearestRoadPoint(x, z) {
  let bestX = x, bestZ = z, best = Infinity;
  for (let i = 0; i <= BLOCKS; i++) {
    const c = roadCenter(i);
    const dx = Math.abs(x - c);
    if (dx < best) { best = dx; bestX = c; bestZ = z; }
    const dz = Math.abs(z - c);
    if (dz < best) { best = dz; bestX = x; bestZ = c; }
  }
  return { x: bestX, z: bestZ };
}
