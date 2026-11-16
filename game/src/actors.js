import * as THREE from 'three';
import { WEAPONS } from './config.js';

let nextId = 1;

function weaponState(id) {
  const w = WEAPONS[id];
  if (w.melee) return { id, magazine: 0, reserve: 0 };
  return { id, magazine: w.magazine, reserve: w.reserve };
}

export function freshLoadout(isPlayer = false) {
  const owned = isPlayer ? new Set(['sidearm', 'knife']) : new Set(['sidearm']);
  const states = { sidearm: weaponState('sidearm') };
  if (isPlayer) states.knife = weaponState('knife');
  return {
    owned,
    current: 'sidearm',
    states,
    armor: 0,
    grenades: 0,
  };
}

export function giveWeapon(actor, id) {
  actor.loadout.owned.add(id);
  if (!actor.loadout.states[id]) actor.loadout.states[id] = weaponState(id);
}

function nameSprite(name, color) {
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 56;
  const g = cv.getContext('2d');
  g.fillStyle = 'rgba(8,12,14,.72)'; g.beginPath(); g.roundRect(48, 8, 160, 38, 8); g.fill();
  g.fillStyle = color; g.font = '700 24px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(name.toUpperCase(), 128, 28);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sprite.scale.set(1.55, 0.34, 1);
  sprite.position.y = 2.18;
  return sprite;
}

// Overhead health bar: a tiny canvas sprite redrawn only when health
// changes, so a damaged bot's remaining HP is readable at a glance.
function makeHpBar() {
  const cv = document.createElement('canvas');
  cv.width = 96; cv.height = 14;
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sprite.scale.set(1.02, 0.15, 1);
  sprite.position.y = 1.94;
  sprite.visible = false;
  return { sprite, cv, tex };
}

export function updateHpBar(actor) {
  const bar = actor.hpBar;
  if (!bar) return;
  const frac = Math.max(0, Math.min(1, actor.health / 100));
  bar.sprite.visible = actor.alive && actor.health < 99.5;
  if (!bar.sprite.visible) return;
  const g = bar.cv.getContext('2d');
  g.clearRect(0, 0, 96, 14);
  g.fillStyle = 'rgba(5,8,9,.68)';
  g.fillRect(0, 0, 96, 14);
  g.fillStyle = frac > 0.52 ? '#8bd450' : frac > 0.26 ? '#ffd166' : '#ff4757';
  g.fillRect(2, 2, Math.round(92 * frac), 10);
  g.fillStyle = 'rgba(255,255,255,.28)';
  for (let i = 1; i < 4; i++) g.fillRect(2 + i * 23, 2, 1, 10);
  bar.tex.needsUpdate = true;
}

// Bot gun shapes differ per weapon class so a bot's threat reads from its
// silhouette: stubby SMG, fat scattergun, long AR, railed Needle with scope.
export function buildBotGun(weaponId, dark, accent) {
  const gun = new THREE.Group();
  const len = weaponId === 'needle' ? 1.06 : weaponId === 'rifle' ? 0.88 : weaponId === 'shotgun' ? 0.78 : weaponId === 'smg' ? 0.56 : 0.44;
  const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.16, len), dark);
  receiver.position.z = -len / 2 + 0.14; gun.add(receiver);
  const barrelR = weaponId === 'shotgun' ? 0.05 : 0.028;
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(barrelR, barrelR, 0.4, 8), dark);
  barrel.rotation.x = Math.PI / 2; barrel.position.z = -len - 0.04; gun.add(barrel);
  if (weaponId === 'smg' || weaponId === 'rifle') {
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.24, 0.1), dark);
    mag.position.set(0, -0.18, -0.12); mag.rotation.x = 0.16; gun.add(mag);
  }
  if (weaponId === 'shotgun') {
    const pump = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.1, 0.24), accent);
    pump.position.set(0, -0.05, -0.52); gun.add(pump);
  }
  if (weaponId === 'needle') {
    const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.26, 10), dark);
    scope.rotation.x = Math.PI / 2; scope.position.set(0, 0.15, -0.3); gun.add(scope);
    const coil = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.016, 6, 14), accent);
    coil.position.z = -0.72; gun.add(coil);
  }
  gun.position.set(0.3, 1.3, -0.34);
  return gun;
}

export function createActor({ name, team, isPlayer = false, scene }) {
  const actor = {
    id: nextId++, name, team, isPlayer,
    pos: new THREE.Vector3(), velocityY: 0, yaw: 0, pitch: 0,
    radius: 0.42, eyeHeight: 1.62, health: 100, alive: true,
    money: 800, kills: 0, deaths: 0, loadout: freshLoadout(isPlayer),
    lastShotAt: -9, nextShotAt: 0, reloadUntil: 0, reloading: false,
    burstLeft: 0, nextBurstAt: 0, aimTime: 0, lastDamageAt: -9, lastAttacker: null,
    ai: {
      path: [], pathIndex: 0, repathAt: 0, target: null, lastSeenAt: -9,
      lastKnown: null, strafeDir: 1, strafeUntil: 0, goal: null, thinkAt: Math.random() * 0.3,
      preferredRange: 20, crouchUntil: 0,
    },
    group: null, hitMeshes: [], armorMeshes: [],
    mats: null, hpBar: null, gunWeapon: null,
    flashUntil: 0, flashHead: false, popUntil: 0,
  };

  if (!isPlayer) {
    const group = new THREE.Group();
    const teamColor = team === 'EMBER' ? 0xff6b35 : 0x62b6cb;
    const cloth = new THREE.MeshStandardMaterial({ color: team === 'EMBER' ? 0x53352a : 0x2c4652, roughness: 0.82 });
    const accent = new THREE.MeshStandardMaterial({ color: teamColor, roughness: 0.55, emissive: teamColor, emissiveIntensity: 0.18 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x1d2529, roughness: 0.62, metalness: 0.22 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xd8c5a5, roughness: 0.65 });
    // Remember each material's resting emissive so hit flashes can restore it.
    for (const m of [cloth, accent, dark, skin]) {
      m.userData.baseEmissive = m.emissive.getHex();
      m.userData.baseEmissiveIntensity = m.emissiveIntensity;
    }
    actor.mats = [cloth, accent, dark, skin];

    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.72, 5, 12), cloth);
    torso.position.y = 1.05; torso.castShadow = true;
    torso.userData = { actor, zone: 'body', multiplier: 1 };
    group.add(torso); actor.hitMeshes.push(torso);

    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.42, 0.18), accent);
    chest.position.set(0, 1.18, -0.25); group.add(chest);
    // Glowing chest core: team allegiance reads even in peripheral vision.
    const core = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.05), accent);
    core.position.set(0, 1.2, -0.36); group.add(core);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.23, 18, 14), skin);
    head.position.y = 1.68; head.castShadow = true;
    head.userData = { actor, zone: 'head', multiplier: 1 }; // Weapon config applies the head multiplier.
    group.add(head); actor.hitMeshes.push(head);

    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.1, 0.05), dark);
    visor.position.set(0, 1.7, -0.2); group.add(visor);

    // Silhouette variety per bot: helmet or comms antenna, backpack,
    // shoulder lamp — small shapes that stop every bot reading as a clone.
    if (actor.id % 2 === 0) {
      const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.25, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), dark);
      helmet.position.y = 1.7; helmet.castShadow = true; group.add(helmet);
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.035, 14), dark);
      brim.position.y = 1.71; group.add(brim);
    } else {
      const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.52, 5), dark);
      antenna.position.set(0.17, 1.95, 0.06); group.add(antenna);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 6), accent);
      tip.position.set(0.17, 2.22, 0.06); group.add(tip);
    }
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.52, 0.18), dark);
    pack.position.set(0, 1.12, 0.3); pack.castShadow = true; group.add(pack);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.05, 0.09), accent);
    lamp.position.set(-0.38, 1.52, -0.05); group.add(lamp);

    for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.72, 0.22), dark);
      leg.position.set(0.16 * side, 0.37, 0); leg.castShadow = true;
      leg.userData = { actor, zone: 'leg', multiplier: 0.72 };
      group.add(leg); actor.hitMeshes.push(leg);
      const boot = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.09, 0.32), dark);
      boot.position.set(0.16 * side, 0.045, -0.04); group.add(boot);
      const pad = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.18, 0.3), accent);
      pad.position.set(0.39 * side, 1.38, 0); group.add(pad); actor.armorMeshes.push(pad);
    }

    actor.gunMats = { dark, accent };
    actor.gun = buildBotGun('sidearm', dark, accent);
    actor.gunWeapon = 'sidearm';
    group.add(actor.gun);
    actor.hpBar = makeHpBar();
    group.add(actor.hpBar.sprite);
    group.add(nameSprite(name, team === 'EMBER' ? '#ffb199' : '#bdeffc'));
    actor.group = group;
    scene.add(group);
  }
  return actor;
}

export function resetActor(actor, spawn, yaw) {
  actor.pos.set(spawn[0], 0, spawn[1]);
  actor.yaw = yaw; actor.pitch = 0; actor.velocityY = 0;
  actor.health = 100; actor.alive = true;
  actor.lastShotAt = -9; actor.nextShotAt = 0; actor.reloadUntil = 0; actor.reloading = false;
  actor.burstLeft = 0; actor.aimTime = 0; actor.lastAttacker = null;
  actor.flashUntil = 0; actor.popUntil = 0;
  updateHpBar(actor);
  actor.ai.path = []; actor.ai.pathIndex = 0; actor.ai.target = null;
  actor.ai.lastSeenAt = -9; actor.ai.lastKnown = null; actor.ai.goal = null;
  if (actor.group) {
    actor.group.visible = true;
    actor.group.rotation.set(0, yaw, 0);
    actor.group.position.copy(actor.pos);
    for (const pad of actor.armorMeshes) pad.visible = actor.loadout.armor > 0;
  }
}

export function syncBotMesh(actor, time = 0) {
  if (!actor.group) return;
  actor.group.position.copy(actor.pos);
  // Hit flash + scale pop: the brief white flash (hot orange for headshots)
  // is what makes a landed shot unmistakable at range. Applied for corpses
  // too, so a kill flashes before the body settles.
  if (actor.mats) {
    const flashing = time > 0 && time < actor.flashUntil;
    for (const m of actor.mats) {
      if (flashing) {
        m.emissive.setHex(actor.flashHead ? 0xff7a1a : 0xffffff);
        m.emissiveIntensity = 1.6;
      } else if (m.emissiveIntensity !== m.userData.baseEmissiveIntensity) {
        m.emissive.setHex(m.userData.baseEmissive);
        m.emissiveIntensity = m.userData.baseEmissiveIntensity;
      }
    }
  }
  if (!actor.alive) {
    actor.group.rotation.set(0, actor.yaw, Math.PI / 2.15);
    actor.group.position.y = 0.22;
    actor.group.scale.set(1, 1, 1);
    return;
  }
  actor.group.rotation.set(0, actor.yaw, 0);
  const moving = actor.ai?.moving ? 1 : 0;
  const bob = moving ? Math.sin(time * 10 + actor.id) * 0.035 : 0;
  actor.group.position.y = bob;
  if (actor.gun) actor.gun.rotation.x = actor.pitch;
  // Rebuild the held gun when the bot's weapon changes (buy phase, respawn)
  // so its silhouette always matches what it can actually shoot you with.
  if (actor.gun && actor.loadout.current !== actor.gunWeapon) {
    const old = actor.gun;
    actor.group.remove(old);
    actor.gun = buildBotGun(actor.loadout.current, actor.gunMats.dark, actor.gunMats.accent);
    actor.gunWeapon = actor.loadout.current;
    actor.gun.rotation.x = actor.pitch;
    actor.group.add(actor.gun);
  }
  const pop = time < actor.popUntil ? 1 + 0.13 * Math.min(1, (actor.popUntil - time) / 0.12) : 1;
  const crouchY = actor.ai?.crouching ? 0.84 : 1;
  actor.group.scale.set(pop, crouchY * (0.5 + 0.5 * (2 - pop)), pop);
}

export function setActorDead(actor) {
  actor.alive = false;
  actor.health = 0;
  actor.deaths++;
  if (actor.hpBar) actor.hpBar.sprite.visible = false;
  syncBotMesh(actor);
}
