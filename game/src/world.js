import * as THREE from 'three';

// Saltglass Yard: an original, compact industrial relay yard. The layout is
// deliberately legible from the HUD radar and from screenshots: two spawn
// basins, a bright central relay, and three lanes dressed as loading roads.
export const BOUNDS = { minX: -38, maxX: 38, minZ: -28, maxZ: 28 };
export const RELAY = { x: 0, z: 0, radius: 5.2 };

const C = (minX, minZ, maxX, maxZ, height, kind = 'wall') => ({ minX, minZ, maxX, maxZ, height, kind });

export const COLLIDERS = [
  // Perimeter (the playable ground sits inside these).
  C(-40, -30, 40, -28, 5, 'perimeter'), C(-40, 28, 40, 30, 5, 'perimeter'),
  C(-40, -30, -38, 30, 5, 'perimeter'), C(38, -30, 40, 30, 5, 'perimeter'),
  // Long coloured partition walls, with real gaps at the lanes.
  C(-19, -13, -7, -11, 4), C(-19, 11, -7, 13, 4),
  C(7, -13, 19, -11, 4), C(7, 11, 19, 13, 4),
  C(-1, -21, 1, -9, 4), C(-1, 9, 1, 21, 4),
  C(-30, -1, -22, 1, 3.4), C(22, -1, 30, 1, 3.4),
  C(-13, -22, -11, -15, 3), C(11, 15, 13, 22, 3),
  // Crates and machinery: a mix of full cover and chest-high cover.
  C(-27, -16, -25, -14, 2.2, 'crate'), C(-27, 14, -25, 16, 1.15, 'crate'),
  C(-14, 17, -12, 19, 2.2, 'crate'), C(-14, -20, -12, -18, 1.15, 'crate'),
  C(-8, 5, -6, 7, 1.15, 'crate'), C(-8, -8, -6, -6, 2.2, 'crate'),
  C(6, 6, 8, 8, 1.15, 'crate'), C(6, -9, 8, -7, 2.2, 'crate'),
  C(13, 17, 15, 19, 1.15, 'crate'), C(13, -20, 15, -18, 2.2, 'crate'),
  C(25, 14, 27, 16, 2.2, 'crate'), C(25, -16, 27, -14, 1.15, 'crate'),
  C(0, 23, 5, 25, 1.15, 'machine'), C(-5, -25, 0, -23, 1.15, 'machine'),
];

export const WAYPOINTS = [
  [-32, 19], [-27, 7], [-22, 16], [-16, 5], [-16, -8], [-21, -17],
  [-8, -17], [-8, 0], [-10, 16], [0, 4], [0, 0], [0, -5],
  [8, 0], [8, 16], [8, -17], [16, 5], [16, -8], [21, 17],
  [27, 7], [32, -19], [22, -16], [-3, 22], [3, -22], [27, -7],
  [4, -13], [0, -24], [-24, -23], [-4, -13], [34, 0],
].map(([x, z], id) => ({ id, x, z }));

// Edges were hand-checked against the collider list: no edge spears a tall
// wall (a few graze a corner, where the collision slide carries a bot past).
const EDGES = [
  [0, 1], [0, 2], [1, 3], [1, 4], [2, 3], [2, 8],
  [3, 7], [3, 9], [4, 5], [4, 7], [5, 26], [6, 25],
  [6, 27], [7, 9], [7, 11], [8, 9], [8, 21], [9, 10],
  [10, 11], [10, 12], [11, 22], [12, 15], [13, 9],
  [14, 24], [14, 25], [15, 17], [15, 18], [16, 20],
  [17, 18], [19, 20], [19, 23], [20, 23], [22, 25],
  [24, 11], [24, 12], [26, 25], [27, 11], [27, 7],
  [18, 28], [23, 28], [28, 19],
];
export const GRAPH = new Map(WAYPOINTS.map(w => [w.id, []]));
for (const [a, b] of EDGES) { GRAPH.get(a).push(b); GRAPH.get(b).push(a); }

export const SPAWNS = {
  EMBER: [[-32, 19], [-29, 15.5], [-33.5, 14], [-28, 21.5]],
  SLATE: [[32, -19], [29, -15.5], [33.5, -14], [28, -21.5]],
};

function rectCircleOverlap(x, z, r, c) {
  const nx = Math.max(c.minX, Math.min(x, c.maxX));
  const nz = Math.max(c.minZ, Math.min(z, c.maxZ));
  const dx = x - nx, dz = z - nz;
  return dx * dx + dz * dz < r * r;
}

export function moveWithCollisions(pos, dx, dz, radius = 0.42) {
  let nx = THREE.MathUtils.clamp(pos.x + dx, BOUNDS.minX + radius, BOUNDS.maxX - radius);
  for (const c of COLLIDERS) if (rectCircleOverlap(nx, pos.z, radius, c)) { nx = pos.x; break; }
  let nz = THREE.MathUtils.clamp(pos.z + dz, BOUNDS.minZ + radius, BOUNDS.maxZ - radius);
  for (const c of COLLIDERS) if (rectCircleOverlap(nx, nz, radius, c)) { nz = pos.z; break; }
  pos.x = nx; pos.z = nz;
  return pos;
}

// 2D segment vs tall-cover test. Low crates deliberately do not block a
// standing line of sight; they become cover when a target crouches.
export function segmentBlocked(a, b, minHeight = 1.32) {
  for (const c of COLLIDERS) {
    if (c.height < minHeight) continue;
    if (segmentRect(a.x, a.z, b.x, b.z, c)) return true;
  }
  return false;
}

function segmentRect(x1, z1, x2, z2, c) {
  let t0 = 0, t1 = 1;
  const dx = x2 - x1, dz = z2 - z1;
  const p = [-dx, dx, -dz, dz];
  const q = [x1 - c.minX, c.maxX - x1, z1 - c.minZ, c.maxZ - z1];
  for (let i = 0; i < 4; i++) {
    if (Math.abs(p[i]) < 1e-9) { if (q[i] < 0) return false; }
    else {
      const r = q[i] / p[i];
      if (p[i] < 0) { if (r > t1) return false; if (r > t0) t0 = r; }
      else { if (r < t0) return false; if (r < t1) t1 = r; }
    }
  }
  return true;
}

export function nearestWaypoint(pos) {
  let best = WAYPOINTS[0], bd = Infinity;
  for (const w of WAYPOINTS) {
    const d = (w.x - pos.x) ** 2 + (w.z - pos.z) ** 2;
    if (d < bd) { bd = d; best = w; }
  }
  return best;
}

export function findPath(start, goal) {
  const a = new THREE.Vector3(start.x, 0, start.z);
  const b = new THREE.Vector3(goal.x, 0, goal.z);
  if (!segmentBlocked(a, b)) return [{ x: goal.x, z: goal.z }];
  const s = nearestWaypoint(start), g = nearestWaypoint(goal);
  const open = new Set([s.id]);
  const came = new Map(), cost = new Map([[s.id, 0]]);
  const h = id => Math.hypot(WAYPOINTS[id].x - g.x, WAYPOINTS[id].z - g.z);
  while (open.size) {
    let cur = null, bestScore = Infinity;
    for (const id of open) { const sc = cost.get(id) + h(id); if (sc < bestScore) { bestScore = sc; cur = id; } }
    if (cur === g.id) break;
    open.delete(cur);
    for (const n of GRAPH.get(cur)) {
      const nc = cost.get(cur) + Math.hypot(WAYPOINTS[n].x - WAYPOINTS[cur].x, WAYPOINTS[n].z - WAYPOINTS[cur].z);
      if (nc < (cost.get(n) ?? Infinity)) { cost.set(n, nc); came.set(n, cur); open.add(n); }
    }
  }
  if (!came.has(g.id) && g.id !== s.id) return [{ x: goal.x, z: goal.z }];
  const ids = [];
  for (let id = g.id; id !== undefined; id = came.get(id)) { ids.push(id); if (id === s.id) break; }
  ids.reverse();
  const pts = ids.map(id => ({ x: WAYPOINTS[id].x, z: WAYPOINTS[id].z }));
  pts.push({ x: goal.x, z: goal.z });
  return pts;
}

function canvasTexture(draw, w = 256, h = 256) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildWorld(scene) {
  const hitMeshes = [];
  scene.background = new THREE.Color(0x9fc7c9);
  scene.fog = new THREE.Fog(0x9fc7c9, 55, 125);

  const hemi = new THREE.HemisphereLight(0xe8fbff, 0x54483a, 2.2);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff1cf, 3.4);
  sun.position.set(-28, 42, 18);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -45; sun.shadow.camera.right = 45;
  sun.shadow.camera.top = 35; sun.shadow.camera.bottom = -35;
  sun.shadow.camera.far = 110;
  scene.add(sun);

  const floorTex = canvasTexture((g, w, h) => {
    g.fillStyle = '#59615e'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(240,235,210,.16)'; g.lineWidth = 2;
    for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, h); g.stroke(); g.beginPath(); g.moveTo(0, i * 64); g.lineTo(w, i * 64); g.stroke(); }
    g.fillStyle = 'rgba(255,107,53,.12)'; g.fillRect(0, 120, w, 16);
  });
  floorTex.repeat.set(10, 7);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(BOUNDS.maxX - BOUNDS.minX, BOUNDS.maxZ - BOUNDS.minZ),
    new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.94 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  ground.name = 'ground';
  scene.add(ground);
  hitMeshes.push(ground);

  const wallTex = canvasTexture((g, w, h) => {
    g.fillStyle = '#d8cfba'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#26343a'; g.fillRect(0, 0, w, 28);
    g.fillStyle = '#ff6b35'; g.fillRect(0, h - 24, w, 10);
    g.strokeStyle = 'rgba(38,52,58,.25)'; for (let x = 0; x < w; x += 42) { g.beginPath(); g.moveTo(x, 30); g.lineTo(x, h - 30); g.stroke(); }
  });
  // Crates get a stencilled freight texture (panel frame, corner bolts,
  // hazard band) so they read as cargo, not abstract coloured blocks. The
  // per-crate colour tints multiply over the same texture.
  const crateTex = canvasTexture((g, w, h) => {
    g.fillStyle = '#e8e2d4'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(30,38,42,.55)'; g.lineWidth = 10; g.strokeRect(5, 5, w - 10, h - 10);
    g.lineWidth = 3; g.strokeRect(34, 34, w - 68, h - 68);
    g.fillStyle = 'rgba(30,38,42,.5)';
    for (const [x, y] of [[22, 22], [w - 22, 22], [22, h - 22], [w - 22, h - 22]]) { g.beginPath(); g.arc(x, y, 7, 0, Math.PI * 2); g.fill(); }
    g.font = '900 44px system-ui'; g.textAlign = 'center'; g.fillStyle = 'rgba(30,38,42,.62)';
    g.fillText('SALTGLASS', w / 2, h / 2 + 4);
    g.font = '700 22px system-ui'; g.fillText('FRAGILE · RELAY PARTS', w / 2, h / 2 + 38);
    g.fillStyle = 'rgba(20,20,20,.75)';
    for (let x = 0; x < w; x += 32) { g.save(); g.translate(x, h - 26); g.rotate(-0.6); g.fillRect(0, 0, 16, 34); g.restore(); }
  });
  const mats = {
    wall: new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.82 }),
    perimeter: new THREE.MeshStandardMaterial({ color: 0x33434a, roughness: 0.9 }),
    crate: new THREE.MeshStandardMaterial({ map: crateTex, roughness: 0.76 }),
    machine: new THREE.MeshStandardMaterial({ color: 0x718087, metalness: 0.35, roughness: 0.48 }),
  };
  const crateColors = [0xc98d4b, 0x7f9c65, 0xbb6650, 0x668da0];
  let crateIndex = 0;
  for (const c of COLLIDERS) {
    const w = c.maxX - c.minX, d = c.maxZ - c.minZ;
    const mat = c.kind === 'crate'
      ? new THREE.MeshStandardMaterial({ map: crateTex, color: crateColors[crateIndex++ % crateColors.length], roughness: 0.78 })
      : mats[c.kind] || mats.wall;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, c.height, d), mat);
    mesh.position.set((c.minX + c.maxX) / 2, c.height / 2, (c.minZ + c.maxZ) / 2);
    mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.userData.solid = true;
    scene.add(mesh); hitMeshes.push(mesh);
    // Glowing top trim on full walls: the yard's lanes read at a glance.
    if (c.kind === 'wall' && c.height >= 3) {
      const trim = new THREE.Mesh(
        new THREE.BoxGeometry(w + 0.06, 0.09, d + 0.06),
        new THREE.MeshStandardMaterial({ color: 0x27343a, emissive: 0xffb35c, emissiveIntensity: 0.55, roughness: 0.5 }),
      );
      trim.position.set((c.minX + c.maxX) / 2, c.height + 0.045, (c.minZ + c.maxZ) / 2);
      scene.add(trim);
    }
  }

  // Painted ground markings: lane centrelines, a relay warning ring and
  // spawn arrows — flat decals that make routes legible without geometry.
  const decal = (mesh, x, z, ry = 0) => {
    mesh.rotation.x = -Math.PI / 2; mesh.rotation.z = ry;
    mesh.position.set(x, 0.03, z); mesh.renderOrder = 1; scene.add(mesh);
  };
  const laneMat = new THREE.MeshBasicMaterial({ color: 0xf4efe6, transparent: true, opacity: 0.28 });
  const laneH = new THREE.Mesh(new THREE.PlaneGeometry(52, 0.28), laneMat); decal(laneH, 0, 0);
  const laneV = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 40), laneMat); decal(laneV, 0, 0);
  const warnRing = new THREE.Mesh(
    new THREE.RingGeometry(RELAY.radius + 0.9, RELAY.radius + 1.25, 48),
    new THREE.MeshBasicMaterial({ color: 0xffb35c, transparent: true, opacity: 0.5, side: THREE.DoubleSide }),
  );
  decal(warnRing, RELAY.x, RELAY.z);
  for (const [team, color, ry] of [['EMBER', 0xff6b35, Math.PI / 2], ['SLATE', 0x62b6cb, -Math.PI / 2]]) {
    const arrowMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55 });
    for (const [x, z] of SPAWNS[team]) {
      const arrow = new THREE.Mesh(new THREE.CircleGeometry(0.85, 3), arrowMat);
      decal(arrow, x + (team === 'EMBER' ? 2.6 : -2.6), z, ry);
    }
  }
  // Barrels parked on top of low crates: dressing that can never be walked
  // through, because the crate under it is already solid cover.
  const barrelMat = new THREE.MeshStandardMaterial({ color: 0x3d4a50, metalness: 0.45, roughness: 0.5 });
  const bandMat = new THREE.MeshStandardMaterial({ color: 0x27343a, emissive: 0xff6b35, emissiveIntensity: 0.5, roughness: 0.5 });
  for (const c of COLLIDERS) {
    if (c.kind !== 'crate' || c.height > 1.2) continue;
    const bx = (c.minX + c.maxX) / 2, bz = (c.minZ + c.maxZ) / 2;
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.92, 14), barrelMat);
    barrel.position.set(bx, c.height + 0.46, bz); barrel.castShadow = true; scene.add(barrel);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.1, 14), bandMat);
    band.position.set(bx, c.height + 0.62, bz); scene.add(band);
  }
  // Hanging work-lamps over the lanes (emissive only — no extra light cost).
  const lampMat = new THREE.MeshStandardMaterial({ color: 0x22282c, emissive: 0xffe2a8, emissiveIntensity: 1.6, roughness: 0.4 });
  const cableMat = new THREE.MeshBasicMaterial({ color: 0x14181a });
  for (const [x, z] of [[-16, 0], [16, 0], [0, -16], [0, 16]]) {
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 2.6, 5), cableMat);
    cable.position.set(x, 7.4, z); scene.add(cable);
    const lamp = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.4, 12, 1, true), lampMat);
    lamp.position.set(x, 6.05, z); scene.add(lamp);
  }

  // Relay objective: bright enough to read instantly in play and screenshots.
  const relayGroup = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(RELAY.radius, RELAY.radius, 0.14, 48), new THREE.MeshStandardMaterial({ color: 0x2c383d, roughness: 0.55, metalness: 0.3 }));
  base.position.y = 0.07; base.receiveShadow = true; relayGroup.add(base);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xffb35c, transparent: true, opacity: 0.9, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(RELAY.radius, 0.065, 8, 64), ringMat);
  ring.rotation.x = Math.PI / 2; ring.position.y = 0.18; relayGroup.add(ring);
  const pylonMat = new THREE.MeshStandardMaterial({ color: 0x27343a, emissive: 0xff6b35, emissiveIntensity: 0.75, roughness: 0.4 });
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + Math.PI / 4;
    const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.34, 3.5, 0.34), pylonMat);
    pylon.position.set(Math.cos(a) * 3.6, 1.75, Math.sin(a) * 3.6);
    pylon.castShadow = true; relayGroup.add(pylon);
  }
  const beacon = new THREE.Mesh(new THREE.OctahedronGeometry(0.65), new THREE.MeshStandardMaterial({ color: 0xffd166, emissive: 0xff8c42, emissiveIntensity: 1.8, roughness: 0.2 }));
  beacon.position.y = 3.9; relayGroup.add(beacon);
  const light = new THREE.PointLight(0xff8c42, 22, 18, 1.8); light.position.y = 3.2; relayGroup.add(light);
  scene.add(relayGroup);

  // Spawn pads and distant silhouettes give the yard a sense of place without
  // pretending the skybox is playable space.
  for (const [team, color] of [['EMBER', 0xff6b35], ['SLATE', 0x62b6cb]]) {
    for (const [x, z] of SPAWNS[team]) {
      const pad = new THREE.Mesh(new THREE.CircleGeometry(1.05, 28), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.34 }));
      pad.rotation.x = -Math.PI / 2; pad.position.set(x, 0.025, z); scene.add(pad);
    }
  }
  const silhouette = new THREE.MeshStandardMaterial({ color: 0x40555c, roughness: 1 });
  [[-48, -18, 10, 26], [-46, 16, 8, 18], [47, -14, 11, 30], [45, 18, 9, 20], [0, -39, 26, 15], [-18, 38, 18, 12], [24, 38, 14, 22]].forEach(([x, z, w, h]) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 8), silhouette);
    m.position.set(x, h / 2, z); scene.add(m);
  });

  return { hitMeshes, ringMat, pylonMat, beacon, relayGroup };
}
