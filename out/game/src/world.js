import * as THREE from 'three';
import { loadTextureSet } from './assets.js';

export function buildWorld(scene) {
  const colliders = [];

  // Textures
  const floorTex = loadTextureSet('./assets/env/metal_plate');
  floorTex.map.repeat.set(12, 8);
  floorTex.normalMap.repeat.set(12, 8);
  floorTex.roughnessMap.repeat.set(12, 8);

  const wallTex = loadTextureSet('./assets/env/concrete_panels');
  wallTex.map.repeat.set(8, 2);
  wallTex.normalMap.repeat.set(8, 2);
  wallTex.roughnessMap.repeat.set(8, 2);

  const containerTex = loadTextureSet('./assets/env/container_side');
  containerTex.map.repeat.set(3, 1);
  containerTex.normalMap.repeat.set(3, 1);
  containerTex.roughnessMap.repeat.set(3, 1);

  // Floor
  const floorGeo = new THREE.PlaneGeometry(76, 56);
  const floorMat = new THREE.MeshStandardMaterial({
    map: floorTex.map,
    normalMap: floorTex.normalMap,
    roughnessMap: floorTex.roughnessMap,
    roughness: 0.6
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // Perimeter Walls (6m high)
  const wallMat = new THREE.MeshStandardMaterial({
    map: wallTex.map,
    normalMap: wallTex.normalMap,
    roughnessMap: wallTex.roughnessMap,
    roughness: 0.7
  });

  const wallHeight = 6;
  const createWall = (x, z, w, d) => {
    const geo = new THREE.BoxGeometry(w, wallHeight, d);
    const mesh = new THREE.Mesh(geo, wallMat);
    mesh.position.set(x, wallHeight / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);

    // Collider AABB
    const halfW = w / 2;
    const halfD = d / 2;
    colliders.push({
      min: new THREE.Vector3(x - halfW, 0, z - halfD),
      max: new THREE.Vector3(x + halfW, wallHeight, z + halfD)
    });
  };

  createWall(0, -29, 76, 2); // North
  createWall(0, 29, 76, 2);  // South
  createWall(-39, 0, 2, 60); // West
  createWall(39, 0, 2, 60);  // East

  // Central Relay
  const relayGroup = new THREE.Group();
  relayGroup.position.set(0, 0, 0);

  const discGeo = new THREE.CircleGeometry(5.2, 32);
  const discMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4 });
  const disc = new THREE.Mesh(discGeo, discMat);
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = 0.02;
  relayGroup.add(disc);

  const ringGeo = new THREE.RingGeometry(5.0, 5.2, 32);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.05;
  relayGroup.add(ring);

  // 4 orange pillars
  const pillarGeo = new THREE.CylinderGeometry(0.3, 0.3, 3, 16);
  const pillarMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.3 });
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2;
    const p = new THREE.Mesh(pillarGeo, pillarMat);
    p.position.set(Math.cos(angle) * 4.2, 1.5, Math.sin(angle) * 4.2);
    p.castShadow = true;
    relayGroup.add(p);
  }

  // Floating rotating diamond
  const diamondGeo = new THREE.OctahedronGeometry(0.8, 0);
  const diamondMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x38bdf8, emissiveIntensity: 0.5, roughness: 0.2 });
  const diamond = new THREE.Mesh(diamondGeo, diamondMat);
  diamond.position.y = 3.5;
  relayGroup.add(diamond);

  scene.add(relayGroup);

  // Cover Objects (~14 crates/containers across 3 lanes)
  const containerMat = new THREE.MeshStandardMaterial({
    map: containerTex.map,
    normalMap: containerTex.normalMap,
    roughnessMap: containerTex.roughnessMap,
    roughness: 0.5
  });

  const createContainer = (x, z, w, h, d, ry = 0) => {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, containerMat);
    mesh.position.set(x, h / 2, z);
    mesh.rotation.y = ry;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);

    // Approximate AABB collider (conservative for rotated or axis-aligned)
    const maxDim = Math.max(w, d);
    colliders.push({
      min: new THREE.Vector3(x - maxDim/2, 0, z - maxDim/2),
      max: new THREE.Vector3(x + maxDim/2, h, z + maxDim/2)
    });
  };

  // Left lane cover
  createContainer(-16, -14, 5, 2.5, 3);
  createContainer(-16, -4, 3, 2.5, 5);
  createContainer(-16, 8, 5, 2.5, 3);
  createContainer(-16, 18, 3, 2.5, 4);

  // Middle lane cover (around relay flanks)
  createContainer(-7, -10, 3, 2, 3);
  createContainer(7, -10, 3, 2, 3);
  createContainer(-7, 10, 3, 2, 3);
  createContainer(7, 10, 3, 2, 3);

  // Right lane cover
  createContainer(16, -14, 5, 2.5, 3);
  createContainer(16, -4, 3, 2.5, 5);
  createContainer(16, 8, 5, 2.5, 3);
  createContainer(16, 18, 3, 2.5, 4);

  // Extra central cover
  createContainer(0, -18, 4, 2.5, 2);
  createContainer(0, 18, 4, 2.5, 2);

  return {
    colliders,
    relayPosition: new THREE.Vector3(0, 0, 0),
    diamondMesh: diamond
  };
}

export const SPAWNS = {
  ember: [
    new THREE.Vector3(0, 0, 24),
    new THREE.Vector3(-4, 0, 25),
    new THREE.Vector3(4, 0, 25),
    new THREE.Vector3(-8, 0, 24)
  ],
  slate: [
    new THREE.Vector3(0, 0, -24),
    new THREE.Vector3(-4, 0, -25),
    new THREE.Vector3(4, 0, -25),
    new THREE.Vector3(-8, 0, -24)
  ]
};

// Waypoint Graph (~14 nodes)
export const WAYPOINTS = [
  { id: 0, pos: new THREE.Vector3(0, 0, 22), neighbors: [1, 2, 3] },
  { id: 1, pos: new THREE.Vector3(-14, 0, 20), neighbors: [0, 4] },
  { id: 2, pos: new THREE.Vector3(0, 0, 14), neighbors: [0, 5, 6] },
  { id: 3, pos: new THREE.Vector3(14, 0, 20), neighbors: [0, 7] },
  { id: 4, pos: new THREE.Vector3(-16, 0, 6), neighbors: [1, 8] },
  { id: 5, pos: new THREE.Vector3(-6, 0, 4), neighbors: [2, 9] },
  { id: 6, pos: new THREE.Vector3(6, 0, 4), neighbors: [2, 10] },
  { id: 7, pos: new THREE.Vector3(16, 0, 6), neighbors: [3, 11] },
  { id: 8, pos: new THREE.Vector3(-16, 0, -6), neighbors: [4, 12] },
  { id: 9, pos: new THREE.Vector3(0, 0, 0), neighbors: [5, 6, 12, 13] }, // Relay center
  { id: 10, pos: new THREE.Vector3(16, 0, -6), neighbors: [7, 13] },
  { id: 11, pos: new THREE.Vector3(-14, 0, -20), neighbors: [12, 14] },
  { id: 12, pos: new THREE.Vector3(0, 0, -14), neighbors: [8, 9, 14, 15] },
  { id: 13, pos: new THREE.Vector3(14, 0, -20), neighbors: [10, 15] },
  { id: 14, pos: new THREE.Vector3(0, 0, -22), neighbors: [11, 12, 13] }
];

export function moveWithCollisions(pos, dx, dz, radius, colliders) {
  // Try X movement
  pos.x += dx;
  if (checkCollision(pos, radius, colliders)) {
    pos.x -= dx;
  }
  // Try Z movement
  pos.z += dz;
  if (checkCollision(pos, radius, colliders)) {
    pos.z -= dz;
  }
}

function checkCollision(pos, radius, colliders) {
  for (const c of colliders) {
    if (
      pos.x + radius > c.min.x && pos.x - radius < c.max.x &&
      pos.z + radius > c.min.z && pos.z - radius < c.max.z &&
      pos.y >= c.min.y - 0.5 && pos.y <= c.max.y
    ) {
      return true;
    }
  }
  return false;
}

export function segmentBlocked(a, b, colliders) {
  // Simple raymarch / step check for line-of-sight
  const steps = 10;
  const v = new THREE.Vector3().subVectors(b, a);
  for (let i = 1; i < steps; i++) {
    const p = new THREE.Vector3().copy(a).addScaledVector(v, i / steps);
    for (const c of colliders) {
      if (
        p.x >= c.min.x && p.x <= c.max.x &&
        p.z >= c.min.z && p.z <= c.max.z &&
        p.y >= c.min.y && p.y <= c.max.y
      ) {
        return true; // Blocked
      }
    }
  }
  return false;
}

export function findPath(startPos, goalPos, graph) {
  // Find nearest start node and nearest goal node
  let nearestStart = graph[0];
  let minDistS = startPos.distanceTo(nearestStart.pos);
  for (const n of graph) {
    const d = startPos.distanceTo(n.pos);
    if (d < minDistS) {
      minDistS = d;
      nearestStart = n;
    }
  }

  let nearestGoal = graph[0];
  let minDistG = goalPos.distanceTo(nearestGoal.pos);
  for (const n of graph) {
    const d = goalPos.distanceTo(n.pos);
    if (d < minDistG) {
      minDistG = d;
      nearestGoal = n;
    }
  }

  // BFS shortest path
  const queue = [[nearestStart.id]];
  const visited = new Set([nearestStart.id]);

  while (queue.length > 0) {
    const path = queue.shift();
    const nodeId = path[path.length - 1];

    if (nodeId === nearestGoal.id) {
      return path.map(id => graph[id].pos);
    }

    const node = graph[nodeId];
    for (const neighborId of node.neighbors) {
      if (!visited.has(neighborId)) {
        visited.add(neighborId);
        queue.push([...path, neighborId]);
      }
    }
  }

  return [goalPos];
}
