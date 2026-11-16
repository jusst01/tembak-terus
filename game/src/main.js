import * as THREE from 'three';
import { BUY_ITEMS, ECONOMY, GRENADE, MATCH, TEAM, WEAPONS } from './config.js';
import { SoundFX } from './audio.js';
import { BOUNDS, COLLIDERS, RELAY, SPAWNS, buildWorld, findPath, moveWithCollisions, segmentBlocked } from './world.js';
import { createActor, freshLoadout, giveWeapon, resetActor, setActorDead, syncBotMesh, updateHpBar } from './actors.js';

const $ = id => document.getElementById(id);
const TEST_MODE = new URLSearchParams(location.search).has('autotest');
const sfx = new SoundFX();

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
$('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.05, 220);
camera.rotation.order = 'YXZ';
scene.add(camera);
const world = buildWorld(scene);
const raycaster = new THREE.Raycaster();

const emberNames = ['YOU', 'Mina', 'Rafi', 'Sable'];
const slateNames = ['Voss', 'Kite', 'Hale', 'Morrow'];
const actors = [];
const player = createActor({ name: 'YOU', team: TEAM.EMBER, isPlayer: true, scene });
actors.push(player);
for (let i = 1; i < 4; i++) actors.push(createActor({ name: emberNames[i], team: TEAM.EMBER, scene }));
for (let i = 0; i < 4; i++) actors.push(createActor({ name: slateNames[i], team: TEAM.SLATE, scene }));
const botHitMeshes = actors.flatMap(a => a.hitMeshes);

const game = {
  phase: 'menu', phaseTime: 0, round: 1, roundTime: MATCH.roundSeconds,
  scores: { EMBER: 0, SLATE: 0 }, capture: 0, captureState: 'NEUTRAL',
  started: false, paused: false, over: false, lastCaptureTick: 0,
  winner: null, endReason: '',
};
const keys = new Set();
let mouseDown = false, rightMouseDown = false, semiLatch = false;
let bobPhase = 0, viewKick = 0, scoped = false, damageFlashUntil = 0;
let aiming = false, aimSpreadScale = 1, bloom = 0, noiseEvents = [];
let lastHudSecond = -1;
// Sniper scope state: zoom steps, a short un-scope beat while the bolt
// cycles after a shot, and a breath meter for sway control.
const ZOOM_STEPS = [2, 4, 8];
let zoomIdx = 1, scopeBlockUntil = 0, breath = 1, breathStrainUntil = 0, swayT = 0;
let shakeAmp = 0, hitmarkerTimer = 0;

const tracers = [];
const sparks = [];
const grenades = [];
const explosions = [];
const dmgNumbers = [];
const FRAG_WEAPON = { short: 'FRAG', headMultiplier: 1 };
const grenadeGeo = new THREE.SphereGeometry(0.14, 12, 10);
const grenadeMat = new THREE.MeshStandardMaterial({ color: 0x2c3438, roughness: 0.45, metalness: 0.5 });
const grenadeBandMat = new THREE.MeshStandardMaterial({ color: 0x27343a, emissive: 0xff6b35, emissiveIntensity: 1.4, roughness: 0.4 });
const boomGeo = new THREE.SphereGeometry(1, 20, 14);
const boomMat = new THREE.MeshBasicMaterial({ color: 0xffa53c, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false });
const sparkPool = [];
const sparkGeo = new THREE.BoxGeometry(0.055, 0.055, 0.055);
const sparkMat = new THREE.MeshBasicMaterial({ color: 0xffd166 });
for (let i = 0; i < 90; i++) {
  const m = new THREE.Mesh(sparkGeo, sparkMat);
  m.visible = false; scene.add(m); sparkPool.push(m);
}

const viewGun = new THREE.Group();
camera.add(viewGun);
function rebuildViewGun() {
  viewGun.clear();
  const id = player.loadout.current;
  const dark = new THREE.MeshStandardMaterial({ color: 0x20282c, roughness: 0.42, metalness: 0.42 });
  const accent = new THREE.MeshStandardMaterial({ color: id === 'needle' ? 0x62b6cb : 0xff6b35, roughness: 0.38, emissive: id === 'needle' ? 0x1d5d70 : 0x5c1e08, emissiveIntensity: 0.7 });
  const bodyLen = id === 'shotgun' ? 0.72 : id === 'needle' ? 0.9 : id === 'sidearm' ? 0.42 : 0.66;
  const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.17, bodyLen), dark);
  viewGun.add(receiver);
  const barrelR = id === 'shotgun' ? 0.045 : 0.026;
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(barrelR, barrelR, 0.42, 10), dark);
  barrel.rotation.x = Math.PI / 2; barrel.position.z = -(bodyLen / 2 + 0.18); viewGun.add(barrel);
  const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(barrelR * 1.45, barrelR * 1.45, 0.07, 10), dark);
  muzzle.rotation.x = Math.PI / 2; muzzle.position.z = -(bodyLen / 2 + 0.38); viewGun.add(muzzle);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.116, 0.035, bodyLen * 0.52), accent);
  stripe.position.y = 0.055; viewGun.add(stripe);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.24, 0.12), dark);
  grip.position.set(0, -0.17, 0.16); grip.rotation.x = 0.28; viewGun.add(grip);
  // Per-weapon furniture so each gun reads differently in your hands:
  // magazine + stock on the automatics, a pump on the Breach-6, a long
  // suppressor on the Rook-9, charge coils + a real scope tube on the Needle.
  if (id === 'smg' || id === 'rifle') {
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.26, 0.11), dark);
    mag.position.set(0, -0.2, -0.05); mag.rotation.x = 0.14; viewGun.add(mag);
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.13, 0.24), dark);
    stock.position.set(0, -0.02, bodyLen / 2 + 0.1); viewGun.add(stock);
  }
  if (id === 'smg') {
    const can = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.2, 10), dark);
    can.rotation.x = Math.PI / 2; can.position.z = -(bodyLen / 2 + 0.3); viewGun.add(can);
  }
  if (id === 'shotgun') {
    const pump = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.11, 0.26), accent);
    pump.position.set(0, -0.06, -0.42); viewGun.add(pump);
  }
  if (id === 'needle') {
    const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.3, 12), dark);
    scope.rotation.x = Math.PI / 2; scope.position.set(0, 0.17, -0.08); viewGun.add(scope);
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.012, 12), accent);
    lens.rotation.x = Math.PI / 2; lens.position.set(0, 0.17, -0.24); viewGun.add(lens);
    for (let i = 0; i < 3; i++) {
      const coil = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.015, 6, 14), accent);
      coil.position.z = -0.52 - i * 0.13; viewGun.add(coil);
    }
  } else {
    const sight = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.09, 0.025), accent);
    sight.position.set(0, 0.14, -0.18); viewGun.add(sight);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.008, 6, 14), dark);
    ring.position.set(0, 0.15, -bodyLen / 2 + 0.04); viewGun.add(ring);
  }
  viewGun.position.set(0.29, -0.27, -0.58);
}
rebuildViewGun();

function clampMoney(a) { a.money = Math.max(0, Math.min(ECONOMY.max, Math.round(a.money))); }
// Scratch pool to avoid per-frame allocations in hot paths.
const sV = new THREE.Vector3(), sV2 = new THREE.Vector3(), sV3 = new THREE.Vector3(), sV4 = new THREE.Vector3(), sV5 = new THREE.Vector3();

function weaponOf(a) { return WEAPONS[a.loadout.current]; }
function stateOf(a, id = a.loadout.current) { return a.loadout.states[id]; }
function eyeOf(a, out) {
  const y = a.pos.y + (a.ai?.crouching ? 1.34 : a.eyeHeight);
  if (out) return out.set(a.pos.x, y, a.pos.z);
  return new THREE.Vector3(a.pos.x, y, a.pos.z);
}
function chestOf(a, out) {
  const y = a.pos.y + 1.08;
  if (out) return out.set(a.pos.x, y, a.pos.z);
  return new THREE.Vector3(a.pos.x, y, a.pos.z);
}
function forwardOf(a, out) {
  if (out) return out.set(-Math.sin(a.yaw), 0, -Math.cos(a.yaw));
  return new THREE.Vector3(-Math.sin(a.yaw), 0, -Math.cos(a.yaw));
}
function aliveActors(team) { return actors.filter(a => a.alive && (!team || a.team === team)); }
function enemyTeam(team) { return team === TEAM.EMBER ? TEAM.SLATE : TEAM.EMBER; }

function show(id, yes = true) { $(id).classList.toggle('hidden', !yes); }
function centerMessage(title, sub = '', ms = 1900) {
  $('centerTitle').textContent = title;
  $('centerSub').textContent = sub;
  show('centerMsg', true);
  if (ms) setTimeout(() => { if ($('centerTitle').textContent === title) show('centerMsg', false); }, ms);
}
function killfeed(html) {
  const el = document.createElement('div');
  el.className = 'kill'; el.innerHTML = html;
  $('killfeed').prepend(el);
  while ($('killfeed').children.length > 5) $('killfeed').lastChild.remove();
  setTimeout(() => el.remove(), 5200);
}

function topUpMagazines(actor) {
  for (const id of actor.loadout.owned) {
    const w = WEAPONS[id], s = actor.loadout.states[id];
    const need = w.magazine - s.magazine;
    const take = Math.min(need, s.reserve);
    s.magazine += take; s.reserve -= take;
  }
}

function resetRoundLoadout(actor) {
  if (!actor.alive) {
    actor.loadout = freshLoadout();
  }
  topUpMagazines(actor);
  // One free frag per round, up to the carry cap — the "refill per wave".
  actor.loadout.grenades = Math.min(GRENADE.maxCarry, (actor.loadout.grenades || 0) + GRENADE.roundRefill);
  actor.loadout.current = actor.loadout.owned.has('rifle') ? 'rifle'
    : actor.loadout.owned.has('needle') ? 'needle'
      : actor.loadout.owned.has('shotgun') ? 'shotgun'
        : actor.loadout.owned.has('smg') ? 'smg' : 'sidearm';
}

function resetActorsForRound() {
  const counts = { EMBER: 0, SLATE: 0 };
  for (const actor of actors) {
    const idx = counts[actor.team]++;
    resetRoundLoadout(actor);
    const yaw = actor.team === TEAM.EMBER ? -Math.PI / 2 : Math.PI / 2;
    resetActor(actor, SPAWNS[actor.team][idx], yaw);
    clampMoney(actor);
  }
  rebuildViewGun();
}

function resetMatch() {
  game.scores.EMBER = 0; game.scores.SLATE = 0; game.round = 1; game.over = false; game.winner = null;
  for (const a of actors) { a.money = ECONOMY.start; a.kills = 0; a.deaths = 0; a.alive = false; a.loadout = freshLoadout(); }
  enterBuy();
}

function enterBuy() {
  game.phase = 'buy'; game.phaseTime = MATCH.buySeconds; game.capture = 0; game.captureState = 'NEUTRAL';
  clearGrenades();
  resetActorsForRound();
  botBuy();
  $('killfeed').innerHTML = '';
  show('hud', true); show('startScreen', false); show('matchScreen', false); show('pauseScreen', false);
  show('buyScreen', true);
  document.exitPointerLock?.();
  renderBuy();
  updateHud(true);
}

function botBuy() {
  for (const bot of actors) {
    if (bot.isPlayer) continue;
    const roll = Math.random();
    if (bot.loadout.armor <= 20 && bot.money >= 650 && roll < 0.62) { bot.money -= 650; bot.loadout.armor = 100; }
    const choices = [
      ['rifle', 2400, 0.52], ['smg', 900, 0.28], ['shotgun', 1100, 0.14], ['needle', 3400, 0.08],
    ];
    for (const [id, price, chance] of choices) {
      if (!bot.loadout.owned.has(id) && bot.money >= price + 250 && Math.random() < chance) {
        bot.money -= price; giveWeapon(bot, id); break;
      }
    }
    topUpMagazines(bot);
    bot.loadout.current = bot.loadout.owned.has('rifle') ? 'rifle'
      : bot.loadout.owned.has('needle') ? 'needle'
        : bot.loadout.owned.has('shotgun') ? 'shotgun'
          : bot.loadout.owned.has('smg') ? 'smg' : 'sidearm';
    for (const pad of bot.armorMeshes) pad.visible = bot.loadout.armor > 0;
  }
}

function renderBuy() {
  $('buyRound').textContent = game.round;
  $('buyMoney').textContent = `$${player.money}`;
  const grid = $('buyGrid'); grid.innerHTML = '';
  for (const item of BUY_ITEMS) {
    const isWeapon = item.kind === 'weapon';
    const w = isWeapon ? WEAPONS[item.id] : item;
    const owned = isWeapon && player.loadout.owned.has(item.id);
    const armorFull = item.kind === 'armor' && player.loadout.armor >= 100;
    const fragFull = item.kind === 'grenade' && player.loadout.grenades >= GRENADE.maxCarry;
    const btn = document.createElement('button');
    btn.className = 'buyItem';
    btn.disabled = player.money < w.price || armorFull || fragFull || (owned && item.kind === 'weapon');
    btn.innerHTML = `<div class="name"><span>${w.name}</span><span class="price">$${w.price}</span></div><p>${w.description}</p>${owned || armorFull ? '<div class="owned">Owned</div>' : item.kind === 'grenade' ? `<div class="owned">Carrying ${player.loadout.grenades} / ${GRENADE.maxCarry}</div>` : ''}`;
    btn.addEventListener('click', () => buyItem(item));
    grid.appendChild(btn);
  }
  $('deployBtn').textContent = game.round === 1 ? 'DEPLOY — LOCK MOUSE' : `DEPLOY ROUND ${game.round}`;
}

function buyItem(item) {
  const w = item.kind === 'weapon' ? WEAPONS[item.id] : item;
  if (player.money < w.price) return;
  player.money -= w.price;
  if (item.kind === 'weapon') { giveWeapon(player, item.id); player.loadout.current = item.id; rebuildViewGun(); }
  if (item.kind === 'armor') player.loadout.armor = 100;
  if (item.kind === 'grenade') player.loadout.grenades = Math.min(GRENADE.maxCarry, player.loadout.grenades + 1);
  if (item.kind === 'ammo') {
    for (const id of player.loadout.owned) {
      const cfg = WEAPONS[id];
      player.loadout.states[id].reserve = Math.max(player.loadout.states[id].reserve, cfg.reserve * 2);
    }
    topUpMagazines(player);
  }
  sfx.buy(); renderBuy(); updateHud(true);
}

function beginLive() {
  if (game.phase !== 'buy') return;
  game.phase = 'live'; game.phaseTime = 0; game.roundTime = MATCH.roundSeconds;
  show('buyScreen', false); show('pauseScreen', false);
  centerMessage(`ROUND ${game.round}`, 'Eliminate Slate or control the relay for 8 seconds.', 1500);
  if (!TEST_MODE) renderer.domElement.requestPointerLock?.();
  game.started = true; game.paused = false;
}
function randomConeDirection(dir, spread) {
  const v = dir.clone();
  const side = new THREE.Vector3().crossVectors(v, new THREE.Vector3(0, 1, 0)).normalize();
  if (side.lengthSq() < 0.1) side.set(1, 0, 0);
  const up = new THREE.Vector3().crossVectors(side, v).normalize();
  const a = (Math.random() * 2 - 1) * spread;
  const b = (Math.random() * 2 - 1) * spread;
  return v.addScaledVector(side, a).addScaledVector(up, b).normalize();
}

function obstacleDistance(origin, dir, range) {
  raycaster.set(origin, dir);
  raycaster.far = range;
  const hits = raycaster.intersectObjects(world.hitMeshes, false);
  return hits.length ? hits[0].distance : Infinity;
}

function raySphere(origin, dir, center, radius) {
  const oc = new THREE.Vector3().subVectors(origin, center);
  const b = oc.dot(dir);
  const c = oc.lengthSq() - radius * radius;
  const disc = b * b - c;
  if (disc < 0) return null;
  const t = -b - Math.sqrt(disc);
  return t > 0.05 ? t : null;
}

function actorHit(origin, dir, target, range) {
  const crouch = target.ai?.crouching;
  const spheres = [
    { zone: 'head', mult: 1, r: 0.235, c: new THREE.Vector3(target.pos.x, target.pos.y + (crouch ? 1.43 : 1.68), target.pos.z) },
    { zone: 'body', mult: 1, r: 0.43, c: new THREE.Vector3(target.pos.x, target.pos.y + (crouch ? 0.92 : 1.05), target.pos.z) },
    { zone: 'leg', mult: 0.72, r: 0.37, c: new THREE.Vector3(target.pos.x, target.pos.y + 0.42, target.pos.z) },
  ];
  let best = null;
  for (const s of spheres) {
    const t = raySphere(origin, dir, s.c, s.r);
    if (t && t <= range && (!best || t < best.distance)) best = { distance: t, zone: s.zone, mult: s.mult, point: origin.clone().addScaledVector(dir, t) };
  }
  return best;
}

function addTracer(from, to, color) {
  const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
  const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.88 });
  const line = new THREE.Line(geo, mat);
  scene.add(line);
  tracers.push({ line, until: performance.now() + 58 });
}
function addSparks(point, n = 5) {
  for (let i = 0; i < n; i++) {
    const m = sparkPool.find(x => !x.visible); if (!m) return;
    m.visible = true; m.position.copy(point);
    sparks.push({ m, vx: (Math.random() - 0.5) * 2.4, vy: Math.random() * 2.4 + 0.5, vz: (Math.random() - 0.5) * 2.4, until: performance.now() + 330 });
  }
}

// --- Grenades -------------------------------------------------------------
// A thrown frag is a small physics body: gravity, floor and wall bounces,
// a fixed fuse, then area damage with distance falloff and a line-of-sight
// check so solid cover genuinely protects. It damages every team, thrower
// included — position your throw like it matters.
function throwGrenade() {
  const p = player;
  if (!p.alive || game.phase !== 'live' || p.loadout.grenades <= 0) return false;
  p.loadout.grenades--;
  const dir = new THREE.Vector3(); camera.getWorldDirection(dir);
  const mesh = new THREE.Group();
  const body = new THREE.Mesh(grenadeGeo, grenadeMat); mesh.add(body);
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.145, 0.028, 6, 14), grenadeBandMat);
  band.rotation.x = Math.PI / 2; mesh.add(band);
  mesh.position.copy(camera.position).addScaledVector(dir, 0.55); mesh.position.y -= 0.08;
  scene.add(mesh);
  grenades.push({
    mesh, vel: dir.multiplyScalar(GRENADE.throwSpeed).add(new THREE.Vector3(0, GRENADE.throwUp, 0)),
    fuseAt: performance.now() / 1000 + GRENADE.fuseSeconds, thrower: p,
  });
  sfx.throwIt();
  updateHud(true);
  return true;
}

function clearGrenades() {
  for (const g of grenades) scene.remove(g.mesh);
  grenades.length = 0;
}

function updateGrenades(dt) {
  const now = performance.now() / 1000;
  for (let i = grenades.length - 1; i >= 0; i--) {
    const g = grenades[i];
    if (now >= g.fuseAt) { explodeGrenade(g); grenades.splice(i, 1); continue; }
    const p = g.mesh.position;
    g.vel.y -= GRENADE.gravity * dt;
    p.addScaledVector(g.vel, dt);
    p.x = THREE.MathUtils.clamp(p.x, BOUNDS.minX + 0.2, BOUNDS.maxX - 0.2);
    p.z = THREE.MathUtils.clamp(p.z, BOUNDS.minZ + 0.2, BOUNDS.maxZ - 0.2);
    // Colliders: land on top of low cover, bounce off the sides of tall cover.
    for (const c of COLLIDERS) {
      if (c.kind === 'perimeter') continue;
      const inX = p.x > c.minX - 0.14 && p.x < c.maxX + 0.14;
      const inZ = p.z > c.minZ - 0.14 && p.z < c.maxZ + 0.14;
      if (!inX || !inZ) continue;
      if (p.y <= c.height + 0.16 && p.y > c.height - 0.35 && g.vel.y <= 0) {
        p.y = c.height + 0.14;
        g.vel.y = Math.abs(g.vel.y) > 1.4 ? -g.vel.y * GRENADE.bounce : 0;
        g.vel.x *= 0.7; g.vel.z *= 0.7;
      } else if (p.y < c.height) {
        const dxl = p.x - (c.minX - 0.14), dxr = (c.maxX + 0.14) - p.x;
        const dzl = p.z - (c.minZ - 0.14), dzr = (c.maxZ + 0.14) - p.z;
        const m = Math.min(dxl, dxr, dzl, dzr);
        if (m === dxl) { p.x = c.minX - 0.14; g.vel.x = -Math.abs(g.vel.x) * GRENADE.bounce; }
        else if (m === dxr) { p.x = c.maxX + 0.14; g.vel.x = Math.abs(g.vel.x) * GRENADE.bounce; }
        else if (m === dzl) { p.z = c.minZ - 0.14; g.vel.z = -Math.abs(g.vel.z) * GRENADE.bounce; }
        else { p.z = c.maxZ + 0.14; g.vel.z = Math.abs(g.vel.z) * GRENADE.bounce; }
      }
    }
    if (p.y < 0.14) {
      p.y = 0.14;
      g.vel.y = Math.abs(g.vel.y) > 1.4 ? -g.vel.y * GRENADE.bounce : 0;
      g.vel.x *= 0.72; g.vel.z *= 0.72;
      if (g.vel.y === 0 && g.vel.lengthSq() < 0.04) g.vel.set(0, 0, 0);
    }
    g.mesh.rotation.x += dt * 6; g.mesh.rotation.z += dt * 4;
  }
}

function explodeGrenade(g) {
  const at = g.mesh.position.clone();
  scene.remove(g.mesh);
  const mesh = new THREE.Mesh(boomGeo, boomMat.clone());
  mesh.position.copy(at); mesh.scale.setScalar(0.4);
  scene.add(mesh);
  const light = new THREE.PointLight(0xff8c42, 90, 17, 1.9);
  light.position.copy(at).y += 0.4; scene.add(light);
  explosions.push({ mesh, light, born: performance.now(), until: performance.now() + 300 });
  noiseEvents.push({ x: at.x, z: at.z, r: 46, team: g.thrower.team, at: performance.now() / 1000 });
  addSparks(at, 18);
  const distToPlayer = at.distanceTo(player.pos);
  sfx.boom(distToPlayer);
  if (distToPlayer < 14) shakeAmp = Math.min(0.05, shakeAmp + (1 - distToPlayer / 14) * 0.035);
  if (distToPlayer < 5.5) { $('flashBlind').style.opacity = '0.5'; setTimeout(() => $('flashBlind').style.opacity = '0', 110); }
  for (const a of actors) {
    if (!a.alive) continue;
    const d = Math.hypot(a.pos.x - at.x, a.pos.z - at.z);
    if (d > GRENADE.radius) continue;
    if (segmentBlocked(at, chestOf(a, sV), 0.4)) continue; // solid cover eats the blast
    const fall = THREE.MathUtils.lerp(1, GRENADE.minDamageScale, d / GRENADE.radius);
    damageTarget(g.thrower, a, GRENADE.damage * fall, 'body', FRAG_WEAPON);
  }
}

function updateExplosions(nowMs) {
  for (let i = explosions.length - 1; i >= 0; i--) {
    const e = explosions[i];
    const t = (nowMs - e.born) / 300;
    if (nowMs > e.until) {
      scene.remove(e.mesh); scene.remove(e.light);
      e.mesh.material.dispose();
      explosions.splice(i, 1); continue;
    }
    e.mesh.scale.setScalar(0.4 + t * GRENADE.radius * 1.05);
    e.mesh.material.opacity = 0.55 * (1 - t);
    e.light.intensity = 90 * (1 - t);
  }
}

function updateDamageNumbers(nowMs) {
  for (let i = dmgNumbers.length - 1; i >= 0; i--) {
    const n = dmgNumbers[i];
    if (nowMs > n.until) { n.el.remove(); dmgNumbers.splice(i, 1); continue; }
    const age = (nowMs - n.born) / 720;
    sV.copy(n.pos); sV.y += age * 0.85;
    sV.project(camera);
    if (sV.z > 1) { n.el.style.display = 'none'; continue; }
    n.el.style.display = '';
    n.el.style.left = `${(sV.x * 0.5 + 0.5) * window.innerWidth + n.drift * age}px`;
    n.el.style.top = `${(-sV.y * 0.5 + 0.5) * window.innerHeight}px`;
    n.el.style.opacity = String(1 - age * age);
  }
}

function showHitmarker(zone, killed) {
  const hm = $('hitmarker');
  hm.classList.remove('show', 'head', 'kill');
  void hm.offsetWidth; // restart the pop animation on back-to-back hits
  if (killed) hm.classList.add('kill');
  else if (zone === 'head') hm.classList.add('head');
  hm.classList.add('show');
  clearTimeout(hitmarkerTimer);
  hitmarkerTimer = setTimeout(() => hm.classList.remove('show', 'head', 'kill'), 230);
}

function spawnDamageNumber(point, dmg, zone, killed) {
  const layer = $('dmgLayer');
  while (layer.children.length >= 14) layer.firstChild.remove();
  const el = document.createElement('div');
  el.className = `dmgNum${zone === 'head' ? ' crit' : ''}${killed ? ' kill' : ''}`;
  el.innerHTML = zone === 'head' ? `<small>HEADSHOT</small>${Math.round(dmg)}` : `${Math.round(dmg)}${killed ? ' ✕' : ''}`;
  layer.appendChild(el);
  dmgNumbers.push({ el, pos: point.clone(), born: performance.now(), until: performance.now() + 720, drift: (Math.random() - 0.5) * 26 });
}

// Returns the damage actually dealt (0 when the hit did not count) so the
// shooter side can render exact damage numbers.
function damageTarget(attacker, target, rawDamage, zone, weapon) {
  if (!target.alive || game.phase !== 'live') return 0;
  let dmg = rawDamage * (zone === 'head' ? weapon.headMultiplier : zone === 'leg' ? 0.72 : 1);
  if (target.loadout.armor > 0) {
    const absorbed = dmg * 0.45;
    dmg -= absorbed;
    target.loadout.armor = Math.max(0, target.loadout.armor - absorbed * 0.7);
    if (target.group) for (const pad of target.armorMeshes) pad.visible = target.loadout.armor > 0;
  }
  target.health -= dmg;
  target.lastDamageAt = performance.now() / 1000;
  target.lastAttacker = attacker;
  if (target.ai) {
    target.ai.lastKnown = attacker.pos.clone();
    target.ai.lastSeenAt = target.lastDamageAt;
  }
  // Visual confirmation on the victim: white flash (orange for headshots)
  // plus a scale pop, and its overhead HP bar shrinks immediately.
  target.flashUntil = target.lastDamageAt + 0.1;
  target.flashHead = zone === 'head';
  target.popUntil = target.lastDamageAt + 0.12;
  updateHpBar(target);
  if (target.isPlayer) {
    damageFlashUntil = performance.now() + 170;
    shakeAmp = Math.min(0.012, shakeAmp + 0.005);
    sfx.hurt();
  } else if (attacker.isPlayer) {
    showHitmarker(zone, target.health <= 0);
    sfx.hit(zone === 'head');
  }
  if (target.health <= 0) killActor(attacker, target, zone, weapon);
  return dmg;
}

function killActor(attacker, target, zone, weapon) {
  // Death reads as an event, not a fade: a spark burst at the chest and a
  // final hot flash before the body tips over.
  addSparks(chestOf(target), 16);
  target.flashUntil = performance.now() / 1000 + 0.22;
  target.flashHead = true;
  setActorDead(target);
  attacker.kills++;
  attacker.money += ECONOMY.kill; clampMoney(attacker);
  killfeed(`<b>${attacker.name}</b> &nbsp;${weapon.short}${zone === 'head' ? ' ⌖' : ''}&nbsp; <b>${target.name}</b>`);
  if (attacker.isPlayer) sfx.kill();
  if (target.isPlayer) centerMessage('YOU ARE DOWN', 'Your team fights on until the round resets.', 2200);
  checkEliminationEnd();
}
function fireActor(actor, baseDir) {
  const now = performance.now() / 1000;
  const w = weaponOf(actor), s = stateOf(actor);
  if (!actor.alive || game.phase !== 'live' || actor.reloading || now < actor.nextShotAt) return false;
  if (s.magazine <= 0) { if (actor.isPlayer) sfx.empty(); startReload(actor); return false; }
  actor.nextShotAt = now + 60 / w.rpm;
  actor.lastShotAt = now;
  s.magazine--;

  if (actor.isPlayer) bloom = Math.min(1, bloom + (w.id === 'shotgun' ? 0.3 : 0.16));

  const speed = Math.hypot(actor.ai?.vx || 0, actor.ai?.vz || 0);
  const bloomSpread = actor.isPlayer ? bloom * 0.02 : 0;
  const spread = ((w.spread + (speed > 0.6 ? w.movingSpread * Math.min(1, speed / 5) : 0) + (actor.ai?.crouching ? -w.spread * 0.3 : 0)) + bloomSpread) * (actor.isPlayer ? aimSpreadScale : 1);

  const origin = actor.isPlayer ? camera.position.clone() : eyeOf(actor, sV).addScaledVector(forwardOf(actor, sV2), 0.42).add(sV3.set(0, -0.22, 0));
  const muzzle = actor.isPlayer ? camera.position.clone().addScaledVector(baseDir, 0.7) : origin.clone();
  let anyHit = false;
  for (let p = 0; p < w.pellets; p++) {
    const dir = randomConeDirection(baseDir, Math.max(0.0005, spread));
    const wallDist = obstacleDistance(origin, dir, w.range);
    let best = null;
    for (const target of actors) {
      if (!target.alive || target.team === actor.team) continue;
      const hit = actorHit(origin, dir, target, w.range);
      if (hit && hit.distance < wallDist && (!best || hit.distance < best.distance)) {
        best = hit;
        best.target = target;
      }
    }
    const endDist = best ? best.distance : Math.min(w.range, wallDist);
    const end = origin.clone().addScaledVector(dir, endDist);
    addTracer(muzzle, end, w.tracer);
    if (best) {
      const fall = best.distance <= w.falloffStart ? 1 : THREE.MathUtils.lerp(1, w.minDamageScale, Math.min(1, (best.distance - w.falloffStart) / Math.max(1, w.range - w.falloffStart)));
      const dealt = damageTarget(actor, best.target, w.damage * fall, best.zone, w);
      anyHit = dealt > 0 || anyHit;
      if (dealt > 0 && actor.isPlayer) spawnDamageNumber(end, dealt, best.zone, !best.target.alive);
      addSparks(end, best.zone === 'head' ? 9 : 5);
    } else if (wallDist < Infinity) addSparks(end, 3);
  }
  const distToPlayer = actor.pos.distanceTo(player.pos);
  sfx.shot(w.id, actor.isPlayer ? 0 : distToPlayer);

  let r = (w.id === 'needle' || w.id === 'rifle') ? 34 : (w.id === 'smg' || w.id === 'sidearm') ? 26 : 40;
  if (actor.isPlayer && (keys.has('AltLeft') || keys.has('AltRight'))) r /= 2;
  noiseEvents.push({ x: actor.pos.x, z: actor.pos.z, r, team: actor.team, at: performance.now() / 1000 });

  if (actor.isPlayer) {
    const recoilScale = aiming ? 0.85 : 1;
    actor.pitch = Math.min(1.45, actor.pitch + w.recoil * 0.62 * recoilScale);
    viewKick = Math.min(0.09, viewKick + w.recoil * 1.9 * recoilScale);
    // The Needle's bolt cycle drops you out of the scope for a beat after
    // every shot — you re-acquire the target instead of camping the glass.
    if (w.id === 'needle') scopeBlockUntil = performance.now() / 1000 + 0.55;
    if (s.magazine === 0) startReload(actor);
  }
  return true;
}

function startReload(actor) {
  const w = weaponOf(actor), s = stateOf(actor);
  if (actor.reloading || s.magazine >= w.magazine || s.reserve <= 0) return;
  actor.reloading = true;
  actor.reloadUntil = performance.now() / 1000 + w.reloadTime;
  if (actor.isPlayer) sfx.reload();
}
function finishReloads(now) {
  for (const a of actors) {
    if (!a.reloading || now < a.reloadUntil) continue;
    const w = weaponOf(a), s = stateOf(a);
    const take = Math.min(w.magazine - s.magazine, s.reserve);
    s.magazine += take; s.reserve -= take; a.reloading = false;
  }
}

function checkEliminationEnd() {
  if (game.phase !== 'live') return;
  const e = aliveActors(TEAM.EMBER).length, s = aliveActors(TEAM.SLATE).length;
  if (e === 0 && s === 0) endRound(TEAM.SLATE, 'Mutual collapse — defence holds the yard.');
  else if (s === 0) endRound(TEAM.EMBER, 'Slate Union eliminated.');
  else if (e === 0) endRound(TEAM.SLATE, 'Ember Watch eliminated.');
}

function endRound(winner, reason) {
  if (game.phase !== 'live') return;
  game.phase = 'end'; game.phaseTime = MATCH.endSeconds; game.winner = winner; game.endReason = reason;
  game.scores[winner]++;
  for (const a of actors) {
    a.money += a.team === winner ? ECONOMY.roundWin : ECONOMY.roundLoss;
    clampMoney(a);
  }
  if (reason.includes('Relay')) for (const a of aliveActors(TEAM.EMBER)) { a.money += ECONOMY.objective; clampMoney(a); }
  sfx.round(winner === TEAM.EMBER);
  centerMessage(`${winner} TAKES ROUND ${game.round}`, reason, 3300);
  document.exitPointerLock?.();
  updateHud(true);
}

function finishRoundPause() {
  const winner = game.scores.EMBER >= MATCH.roundsToWin ? TEAM.EMBER : game.scores.SLATE >= MATCH.roundsToWin ? TEAM.SLATE : null;
  if (winner || game.round >= MATCH.maxRounds) {
    game.phase = 'matchEnd'; game.over = true;
    const champ = winner || (game.scores.EMBER > game.scores.SLATE ? TEAM.EMBER : TEAM.SLATE);
    $('matchTitle').textContent = `${champ} WINS THE MATCH`;
    $('matchSub').textContent = `Final score ${game.scores.EMBER}–${game.scores.SLATE}. Your line: ${player.kills} eliminations, ${player.deaths} deaths.`;
    show('matchScreen', true);
    sfx.match(champ === TEAM.EMBER);
  } else {
    game.round++;
    enterBuy();
  }
}

function updateCapture(dt) {
  const inside = aliveActors().filter(a => Math.hypot(a.pos.x - RELAY.x, a.pos.z - RELAY.z) <= RELAY.radius);
  const e = inside.filter(a => a.team === TEAM.EMBER).length;
  const s = inside.filter(a => a.team === TEAM.SLATE).length;
  if (e > 0 && s === 0) {
    game.capture += dt; game.captureState = 'EMBER CONTROL';
    if (performance.now() - game.lastCaptureTick > 950) { game.lastCaptureTick = performance.now(); sfx.captureTick(); }
  } else if (e > 0 && s > 0) game.captureState = 'CONTESTED';
  else { game.capture = Math.max(0, game.capture - dt * 0.35); game.captureState = e === 0 && s > 0 ? 'SLATE HELD' : 'NEUTRAL'; }
  world.ringMat.color.set(game.captureState === 'CONTESTED' ? 0xffffff : game.captureState === 'EMBER CONTROL' ? 0x8bd450 : 0xffb35c);
  if (game.capture >= MATCH.captureSeconds) endRound(TEAM.EMBER, 'Relay controlled — the yard changes hands.');
}

function canSee(a, b) {
  const dist = a.pos.distanceTo(b.pos);
  if (dist > 62) return false;
  if (dist < 4.2) return true;
  return !segmentBlocked(eyeOf(a, sV), chestOf(b, sV2), 1.32);
}
function visibleEnemy(bot) {
  let best = null, bd = Infinity;
  for (const e of actors) {
    if (!e.alive || e.team === bot.team) continue;
    const d = bot.pos.distanceTo(e.pos);
    if (d < bd && canSee(bot, e)) { best = e; bd = d; }
  }
  return best;
}
function botGoal(bot) {
  const idx = bot.id % 4;
  if (bot.team === TEAM.EMBER) {
    if (idx === 0) return { x: 18, z: -14 }; // one flanker keeps Slate honest
    return { x: Math.cos(bot.id * 2.1) * 2.8, z: Math.sin(bot.id * 2.1) * 2.8 };
  }
  if (game.capture > 1.2) return { x: Math.cos(bot.id) * 2.4, z: Math.sin(bot.id) * 2.4 };
  return [{ x: -4, z: 0 }, { x: 4, z: 4 }, { x: 8, z: -5 }, { x: 0, z: 8 }][idx];
}
function moveBot(bot, wish, speed, dt) {
  const beforeX = bot.pos.x, beforeZ = bot.pos.z;
  if (wish.lengthSq() > 0.001) {
    wish.normalize();
    moveWithCollisions(bot.pos, wish.x * speed * dt, wish.z * speed * dt, bot.radius);
  }
  // Simple separation: bots should jostle for a firing line, not merge into
  // a single four-person centipede.
  for (const other of actors) {
    if (other === bot || !other.alive) continue;
    const dx = bot.pos.x - other.pos.x, dz = bot.pos.z - other.pos.z;
    const d2 = dx * dx + dz * dz;
    if (d2 > 0.0001 && d2 < 0.72 * 0.72) {
      const d = Math.sqrt(d2), push = (0.72 - d) * 0.45;
      moveWithCollisions(bot.pos, dx / d * push, dz / d * push, bot.radius);
    }
  }
  bot.ai.vx = (bot.pos.x - beforeX) / Math.max(dt, 0.001);
  bot.ai.vz = (bot.pos.z - beforeZ) / Math.max(dt, 0.001);
  bot.ai.moving = Math.hypot(bot.ai.vx, bot.ai.vz) > 0.25;
}

function updateBot(bot, dt, now) {
  if (!bot.alive) { syncBotMesh(bot, now); return; }
  const ai = bot.ai;
  if (now >= ai.thinkAt) {
    ai.thinkAt = now + 0.11 + Math.random() * 0.05;
    ai.target = visibleEnemy(bot);
    if (!ai.target) {
       for (const ev of noiseEvents) {
         if (ev.team !== bot.team && now - ev.at < 1.2 && Math.hypot(ev.x - bot.pos.x, ev.z - bot.pos.z) < ev.r) {
           ai.lastKnown = new THREE.Vector3(ev.x, 0, ev.z);
           ai.lastSeenAt = now;
           break;
         }
       }
    }
    if (ai.target) { ai.lastSeenAt = now; ai.lastKnown = ai.target.pos.clone(); }
  }
  const target = ai.target && ai.target.alive && canSee(bot, ai.target) ? ai.target : null;
  if (target) ai.aimTime += dt; else ai.aimTime = Math.max(0, ai.aimTime - dt * 2);
  ai.crouching = !!target && (weaponOf(bot).id === 'needle' || weaponOf(bot).id === 'rifle') && bot.pos.distanceTo(target.pos) > 15;
  if (bot.group) bot.group.scale.y = ai.crouching ? 0.84 : 1;

  const wish = sV.set(0, 0, 0);
  if (target) {
    const to = sV2.subVectors(target.pos, bot.pos); to.y = 0;
    const dist = to.length(); to.normalize();
    bot.yaw = Math.atan2(-to.x, -to.z);
    bot.pitch = THREE.MathUtils.clamp(Math.atan2((target.pos.y + 1.05) - (bot.pos.y + 1.5), dist), -0.45, 0.45);
    ai.preferredRange = weaponOf(bot).id === 'shotgun' ? 8 : weaponOf(bot).id === 'smg' ? 15 : weaponOf(bot).id === 'needle' ? 31 : 22;
    if (now > ai.strafeUntil) { ai.strafeUntil = now + 0.55 + Math.random() * 0.8; ai.strafeDir = Math.random() < 0.5 ? -1 : 1; }
    const side = sV3.set(to.z, 0, -to.x).multiplyScalar(ai.strafeDir * 0.72);
    if (dist > ai.preferredRange + 3) wish.copy(to).multiplyScalar(0.92);
    else if (dist < ai.preferredRange - 4) wish.copy(to).multiplyScalar(-0.62);
    wish.add(side);
    moveBot(bot, wish, ai.crouching ? 1.45 : 2.65, dt);

    const s = stateOf(bot);
    if (s.magazine === 0) startReload(bot);
    else if (!bot.reloading) {
      if (ai.burstLeft <= 0 && now >= ai.nextBurstAt) ai.burstLeft = weaponOf(bot).automatic ? 3 + Math.floor(Math.random() * 3) : 1;
      if (ai.burstLeft > 0) {
        const aimPoint = weaponOf(bot).id === 'needle' || Math.random() < 0.18
          ? sV5.set(target.pos.x, target.pos.y + 1.58, target.pos.z)
          : chestOf(target, sV5);
        let dir = sV4.subVectors(aimPoint, eyeOf(bot, sV3)).normalize();
        // aimPoint uses sV4.
        const err = THREE.MathUtils.lerp(0.085, 0.024, Math.min(1, ai.aimTime / 0.9));
        dir = randomConeDirection(dir, err);
        bot.pitch = Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1));
        if (fireActor(bot, dir)) {
          ai.burstLeft--;
          if (ai.burstLeft <= 0) ai.nextBurstAt = now + (weaponOf(bot).automatic ? 0.34 + Math.random() * 0.42 : 0.72 + Math.random() * 0.5);
        }
      }
    }
  } else {

    let goal = botGoal(bot);
    if (ai.lastKnown && now - ai.lastSeenAt < 3.5) goal = ai.lastKnown;
    if (bot.health < 24 && Math.random() < 0.25) goal = { x: SPAWNS[bot.team][0][0], z: SPAWNS[bot.team][0][1] };
    if (bot.team === TEAM.EMBER && Math.hypot(bot.pos.x - RELAY.x, bot.pos.z - RELAY.z) < RELAY.radius * 0.72) goal = { x: bot.pos.x, z: bot.pos.z };
    const distGoal = Math.hypot(goal.x - bot.pos.x, goal.z - bot.pos.z);
    if (distGoal > 0.75) {
      let steer = { x: goal.x, z: goal.z };
      if (segmentBlocked(bot.pos, goal) || distGoal > 19) {
        if (!ai.path.length || now >= ai.repathAt) { ai.path = findPath(bot.pos, goal); ai.pathIndex = 0; ai.repathAt = now + 0.8; }
        while (ai.pathIndex < ai.path.length && Math.hypot(ai.path[ai.pathIndex].x - bot.pos.x, ai.path[ai.pathIndex].z - bot.pos.z) < 0.85) ai.pathIndex++;
        if (ai.path[ai.pathIndex]) steer = ai.path[ai.pathIndex];
      } else ai.path = [];
      wish.set(steer.x - bot.pos.x, 0, steer.z - bot.pos.z);
      bot.yaw = Math.atan2(-wish.x, -wish.z);
      bot.pitch *= 0.9;
      moveBot(bot, wish, distGoal > 13 ? 5.15 : 4.35, dt);
    } else {
      bot.yaw += Math.sin(now * 0.55 + bot.id * 1.7) * dt * 0.55; // scan while holding
      moveBot(bot, wish, 0, dt);
    }
    const s = stateOf(bot);
    if (s.magazine < weaponOf(bot).magazine * 0.35 && s.reserve > 0) startReload(bot);
  }
  syncBotMesh(bot, now);
}

function updatePlayer(dt) {
  const p = player;
  p.ai.crouching = keys.has('ControlLeft') || keys.has('ControlRight');
  let ix = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
  let iz = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0);
  const len = Math.hypot(ix, iz) || 1; ix /= len; iz /= len;
  const sprint = (keys.has('ShiftLeft') || keys.has('ShiftRight')) && iz > 0 && !p.ai.crouching && !aiming && !(keys.has('AltLeft') || keys.has('AltRight'));
  const speed = (p.ai.crouching ? 2.55 : (keys.has('AltLeft') || keys.has('AltRight')) ? 2.1 : sprint ? 6.25 : 4.65) * (aiming ? 0.55 : 1);
  const f = forwardOf(p), r = new THREE.Vector3(Math.cos(p.yaw), 0, -Math.sin(p.yaw));
  const wish = new THREE.Vector3().addScaledVector(f, iz).addScaledVector(r, ix);
  if (wish.lengthSq() > 0) wish.normalize();
  const before = p.pos.clone();
  moveWithCollisions(p.pos, wish.x * speed * dt, wish.z * speed * dt, p.radius);
  if ((keys.has('Space')) && p.pos.y <= 0.001) p.velocityY = 5.0;
  p.velocityY -= 13.5 * dt;
  p.pos.y += p.velocityY * dt;
  if (p.pos.y < 0) { p.pos.y = 0; p.velocityY = 0; }
  p.ai.vx = (p.pos.x - before.x) / Math.max(dt, 0.001);
  p.ai.vz = (p.pos.z - before.z) / Math.max(dt, 0.001);
  const hSpeed = Math.hypot(p.ai.vx, p.ai.vz);
  if (hSpeed > 0.4 && p.pos.y === 0) bobPhase += dt * hSpeed * 1.65;

  aiming = rightMouseDown && p.alive && game.phase === 'live';
  scoped = aiming && p.loadout.current === 'needle' && performance.now() / 1000 > scopeBlockUntil;
  aimSpreadScale = (aiming && !scoped) ? 0.55 : 1;

  // Player trigger: automatic weapons continue while held; semi weapons need
  // a fresh click, which keeps the skill in the sidearm and scattergun.
  if (mouseDown && p.alive) {
    const w = weaponOf(p);
    if (w.automatic || !semiLatch) {
      const dir = new THREE.Vector3(); camera.getWorldDirection(dir);
      if (fireActor(p, dir)) semiLatch = true;
    }
  } else {
    semiLatch = false;
    bloom = Math.max(0, bloom - dt * 0.85);
  }
}

function updateCamera(dt) {
  const p = player;
  const zoom = ZOOM_STEPS[zoomIdx];
  const targetFov = scoped ? 74 / zoom : aiming ? 58 : 74;
  camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 13);
  camera.updateProjectionMatrix();
  viewKick = Math.max(0, viewKick - dt * 0.42);
  const bobY = Math.sin(bobPhase * 2) * 0.026;
  const bobX = Math.cos(bobPhase) * 0.014;
  // Scope feel: a slow breathing sway that genuinely moves the aim point.
  // Crouching steadies it; holding Shift scoped holds your breath (steady
  // for ~2.5 s, then a strained wobble while you recover).
  let swayX = 0, swayY = 0;
  if (scoped) {
    swayT += dt;
    const holdingBreath = keys.has('ShiftLeft') || keys.has('ShiftRight');
    if (holdingBreath && breath > 0) breath = Math.max(0, breath - dt / 2.5);
    else breath = Math.min(1, breath + dt / 3.2);
    if (holdingBreath && breath === 0) breathStrainUntil = performance.now() / 1000 + 0.9;
    const strained = performance.now() / 1000 < breathStrainUntil;
    let amp = p.ai.crouching ? 0.0016 : 0.0034;
    if (holdingBreath && breath > 0) amp = 0.0005;
    if (strained) amp = 0.006;
    swayX = (Math.sin(swayT * 0.9) + Math.sin(swayT * 0.53 + 1.7) * 0.6) * amp;
    swayY = (Math.cos(swayT * 1.13 + 0.4) + Math.sin(swayT * 0.71) * 0.6) * amp * 0.8;
  } else {
    swayT = 0; breath = Math.min(1, breath + dt / 2);
  }
  shakeAmp = Math.max(0, shakeAmp - dt * 0.055);
  const shakeX = (Math.random() - 0.5) * 2 * shakeAmp;
  const shakeY = (Math.random() - 0.5) * 2 * shakeAmp;
  if (p.alive) {
    camera.position.set(p.pos.x + bobX * Math.cos(p.yaw) + shakeX, p.pos.y + (p.ai.crouching ? 1.36 : 1.62) + bobY + shakeY, p.pos.z + bobX * -Math.sin(p.yaw));
    camera.rotation.set(p.pitch + swayY, p.yaw + swayX, 0);
  } else {
    camera.position.set(p.pos.x, 0.62, p.pos.z);
    camera.rotation.set(-0.12, p.yaw, 0.38);
  }
  viewGun.position.z = -0.58 + viewKick;
  viewGun.position.y = -0.27 + Math.sin(bobPhase * 2) * 0.008 - viewKick * 0.35;
  viewGun.visible = p.alive && game.phase !== 'buy' && !scoped;
  const showScope = scoped && p.alive && game.phase === 'live';
  $('scopeOverlay').classList.toggle('hidden', !showScope);
  document.body.classList.toggle('scoped', showScope);
  if (showScope) $('scopeLabel').textContent = `NEEDLE · ${zoom}× · SCROLL ZOOM · ${breath > 0.05 ? 'HOLD SHIFT — STEADY' : 'BREATH SPENT'}`;
}

function formatTime(sec) {
  sec = Math.max(0, Math.ceil(sec));
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}
function updateHud(force = false) {
  const sec = game.phase === 'buy' ? Math.ceil(game.phaseTime) : game.phase === 'live' ? Math.ceil(game.roundTime) : 0;
  if (force || sec !== lastHudSecond) {
    lastHudSecond = sec;
    $('timer').textContent = game.phase === 'buy' ? formatTime(game.phaseTime) : formatTime(game.roundTime);
    $('phaseLabel').textContent = game.phase === 'buy' ? 'BUY PHASE' : game.phase === 'live' ? `ROUND ${game.round}` : game.phase.toUpperCase();
  }
  $('emberScore').textContent = game.scores.EMBER;
  $('slateScore').textContent = game.scores.SLATE;
  $('health').textContent = Math.max(0, Math.ceil(player.health));
  $('healthFill').style.width = `${Math.max(0, player.health)}%`;
  $('healthFill').style.background = player.health > 52 ? 'var(--good)' : player.health > 25 ? '#ffd166' : 'var(--bad)';
  $('armor').textContent = player.loadout.armor > 0 ? `VEST ${Math.ceil(player.loadout.armor)}%` : 'NO VEST';
  $('vestFill').style.width = `${Math.max(0, Math.min(100, player.loadout.armor))}%`;
  $('crosshair').style.transform = `scale(${1 + bloom * 0.9})`;
  document.body.classList.toggle('lowhp', player.alive && player.health <= 30 && (game.phase === 'live' || game.phase === 'end'));
  const chip = $('grenadeChip');
  chip.textContent = `✸ FRAG ×${player.loadout.grenades} · G`;
  chip.classList.toggle('empty', player.loadout.grenades <= 0);
  $('money').textContent = `$${player.money}`;
  const w = weaponOf(player), s = stateOf(player);
  $('weaponName').textContent = player.reloading ? `${w.name} — RELOADING` : w.name;
  $('ammo').innerHTML = `${s.magazine} <span>/ ${s.reserve}</span>`;
  const slots = $('weaponSlots'); slots.innerHTML = '';
  for (const id of Object.values(WEAPONS).sort((a, b) => a.slot - b.slot)) {
    if (!player.loadout.owned.has(id.id)) continue;
    const d = document.createElement('div'); d.className = `slot${player.loadout.current === id.id ? ' active' : ''}`; d.textContent = `${id.slot} ${id.short}`; slots.appendChild(d);
  }
  $('objectiveFill').style.width = `${game.capture / MATCH.captureSeconds * 100}%`;
  $('objectiveState').textContent = game.captureState;
  $('damageFlash').style.opacity = performance.now() < damageFlashUntil ? '1' : '0';
}

function drawRadar() {
  const cv = $('radar'), g = cv.getContext('2d');
  const sx = x => (x - BOUNDS.minX) / (BOUNDS.maxX - BOUNDS.minX) * cv.width;
  const sz = z => (z - BOUNDS.minZ) / (BOUNDS.maxZ - BOUNDS.minZ) * cv.height;
  g.clearRect(0, 0, cv.width, cv.height);
  g.fillStyle = 'rgba(30,42,46,.92)'; g.fillRect(0, 0, cv.width, cv.height);
  g.fillStyle = 'rgba(244,239,230,.2)';
  for (const c of COLLIDERS) if (c.kind !== 'perimeter') g.fillRect(sx(c.minX), sz(c.minZ), sx(c.maxX) - sx(c.minX), sz(c.maxZ) - sz(c.minZ));
  g.strokeStyle = '#ffb35c'; g.lineWidth = 2; g.beginPath(); g.arc(sx(RELAY.x), sz(RELAY.z), RELAY.radius / (BOUNDS.maxX - BOUNDS.minX) * cv.width, 0, Math.PI * 2); g.stroke();
  const now = performance.now() / 1000;
  for (const a of actors) {
    if (!a.alive) continue;
    const enemyRecentlyFired = a.team === TEAM.SLATE && now - a.lastShotAt < 2.2;
    if (a.team !== TEAM.EMBER && !a.isPlayer && !enemyRecentlyFired && Math.hypot(a.pos.x - RELAY.x, a.pos.z - RELAY.z) > RELAY.radius) continue;
    g.fillStyle = a.isPlayer ? '#fff' : a.team === TEAM.EMBER ? '#ff6b35' : '#62b6cb';
    g.beginPath(); g.arc(sx(a.pos.x), sz(a.pos.z), a.isPlayer ? 5 : 4, 0, Math.PI * 2); g.fill();
    if (a.isPlayer) {
      const f = forwardOf(a); g.strokeStyle = '#fff'; g.beginPath(); g.moveTo(sx(a.pos.x), sz(a.pos.z)); g.lineTo(sx(a.pos.x + f.x * 4), sz(a.pos.z + f.z * 4)); g.stroke();
    }
  }
}

function showScoreboard() {
  const rows = [...actors].sort((a, b) => b.kills - a.kills || a.deaths - b.deaths)
    .map(a => `<div class="scoreRow"><span><b>${a.name}</b> · ${a.team}</span><span>${a.kills} K</span><span>${a.deaths} D</span></div>`).join('');
  $('scoreboard').innerHTML = `<h3>Ember ${game.scores.EMBER} — ${game.scores.SLATE} Slate</h3>${rows}`;
  show('scoreboard', true);
}

function switchWeapon(id) {
  if (!player.loadout.owned.has(id) || player.loadout.current === id) return;
  player.loadout.current = id; player.reloading = false; semiLatch = true;
  scoped = false;
  rebuildViewGun(); updateHud(true);
}

document.addEventListener('keydown', e => {
  if (e.code === 'AltLeft' || e.code === 'AltRight') e.preventDefault();
  if (e.code === 'Tab') { e.preventDefault(); if (game.started) showScoreboard(); return; }
  keys.add(e.code);
  if (!player.alive) return;
  if (e.code === 'KeyR') startReload(player);
  if (e.code === 'KeyG') throwGrenade();
  const slot = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5'].indexOf(e.code) + 1;
  if (slot) {
    const id = Object.values(WEAPONS).find(w => w.slot === slot)?.id;
    if (id) switchWeapon(id);
  }
});
document.addEventListener('keyup', e => { keys.delete(e.code); if (e.code === 'Tab') show('scoreboard', false); });
document.addEventListener('mousemove', e => {
  if (document.pointerLockElement !== renderer.domElement || game.phase !== 'live' || game.paused) return;
  const sens = 0.00205 * (camera.fov / 74);
  player.yaw -= e.movementX * sens;
  player.pitch = THREE.MathUtils.clamp(player.pitch - e.movementY * sens, -1.45, 1.45);
});
document.addEventListener('mousedown', e => {
  if (e.target !== renderer.domElement) return;
  if (e.button === 0) mouseDown = true;
  if (e.button === 2) rightMouseDown = true;
});
document.addEventListener('mouseup', e => { if (e.button === 0) mouseDown = false; if (e.button === 2) rightMouseDown = false; });
document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('wheel', e => {
  if (game.phase !== 'live') return;
  // In the scope, the wheel is the zoom turret, not the weapon wheel.
  if (scoped) {
    zoomIdx = THREE.MathUtils.clamp(zoomIdx + (e.deltaY > 0 ? -1 : 1), 0, ZOOM_STEPS.length - 1);
    sfx.scopeClick();
    return;
  }
  const owned = Object.values(WEAPONS).filter(w => player.loadout.owned.has(w.id)).sort((a, b) => a.slot - b.slot);
  let i = owned.findIndex(w => w.id === player.loadout.current);
  i = (i + (e.deltaY > 0 ? 1 : -1) + owned.length) % owned.length;
  switchWeapon(owned[i].id);
}, { passive: true });
document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === renderer.domElement;
  if (locked) { game.paused = false; show('pauseScreen', false); }
  else if (game.phase === 'live' && game.started && !TEST_MODE && !game.over) { game.paused = true; show('pauseScreen', true); }
});
renderer.domElement.addEventListener('click', () => {
  if (game.phase === 'live' && document.pointerLockElement !== renderer.domElement && !TEST_MODE) renderer.domElement.requestPointerLock?.();
});
$('startBtn').addEventListener('click', () => { sfx.unlock(); resetMatch(); });
$('deployBtn').addEventListener('click', () => { sfx.unlock(); beginLive(); });
$('resumeBtn').addEventListener('click', () => { sfx.unlock(); if (game.phase === 'buy') beginLive(); else { game.paused = false; show('pauseScreen', false); renderer.domElement.requestPointerLock?.(); } });
$('restartBtn').addEventListener('click', () => { show('pauseScreen', false); resetMatch(); });
$('againBtn').addEventListener('click', () => resetMatch());
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

let previous = performance.now();
let accumulator = 0;
let radarAt = 0;

function stepSim(dt) {
  const now = performance.now() / 1000;
  finishReloads(now);
  if (game.phase === 'buy') {
    game.phaseTime -= dt;
    if (game.phaseTime <= 0) { beginLive(); if (!TEST_MODE && document.pointerLockElement !== renderer.domElement) { game.paused = true; show('pauseScreen', true); } }
  } else if (game.phase === 'live') {
    game.roundTime -= dt;
    if (player.alive) updatePlayer(dt);
    for (const a of actors) if (!a.isPlayer) updateBot(a, dt, now);
    updateGrenades(dt);
    updateCapture(dt);
    if (game.roundTime <= 0 && game.phase === 'live') endRound(TEAM.SLATE, 'Time expired — Slate held the yard.');
  } else if (game.phase === 'end') {
    game.phaseTime -= dt;
    updateGrenades(dt);
    for (const a of actors) if (!a.isPlayer) syncBotMesh(a, now);
    if (game.phaseTime <= 0) finishRoundPause();
  }
}

function animate() {
  requestAnimationFrame(animate);
  const nowMs = performance.now();
  const now = nowMs / 1000;
  let frameTime = Math.min(0.12, (nowMs - previous) / 1000); previous = nowMs;
  noiseEvents = noiseEvents.filter(ev => now - ev.at < 1.5);

  if (!game.paused) {
    accumulator += frameTime;
    let steps = 0;
    while (accumulator >= 1/60 && steps < 4) {
      stepSim(1/60);
      accumulator -= 1/60;
      steps++;
    }
    updateExplosions(nowMs);
    updateDamageNumbers(nowMs);
    for (let i = tracers.length - 1; i >= 0; i--) if (nowMs > tracers[i].until) { scene.remove(tracers[i].line); tracers[i].line.geometry.dispose(); tracers[i].line.material.dispose(); tracers.splice(i, 1); }
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i]; if (nowMs > s.until) { s.m.visible = false; sparks.splice(i, 1); continue; }
      s.vy -= 7 * frameTime; s.m.position.x += s.vx * frameTime; s.m.position.y += s.vy * frameTime; s.m.position.z += s.vz * frameTime;
    }
    world.beacon.rotation.y += frameTime * 1.6;
    world.beacon.position.y = 3.9 + Math.sin(now * 2.2) * 0.12;
    world.pylonMat.emissiveIntensity = 0.65 + Math.sin(now * 2.4) * 0.22;
  }
  updateCamera(game.paused ? 0.016 : frameTime);
  if (game.started || game.phase !== 'menu') updateHud();
  if (nowMs - radarAt > 110 && !$('hud').classList.contains('hidden')) { drawRadar(); radarAt = nowMs; }
  renderer.render(scene, camera);
}
animate();

window.__TEMBAK_TEST__ = {
  game, actors, player,
  start() { resetMatch(); beginLive(); return this.snapshot(); },
  snapshot() {
    return {
      phase: game.phase, round: game.round, scores: { ...game.scores }, capture: game.capture,
      actors: actors.map(a => ({ name: a.name, team: a.team, alive: a.alive, health: Math.round(a.health), x: +a.pos.x.toFixed(2), z: +a.pos.z.toFixed(2), weapon: a.loadout.current, money: a.money, grenades: a.loadout.grenades })),
    };
  },
  fire() { const d = new THREE.Vector3(); camera.getWorldDirection(d); return fireActor(player, d); },
  grenade() { return throwGrenade(); },
  scope(on) { rightMouseDown = !!on; if (on) player.loadout.current = 'needle'; return scoped; },
  look(yaw, pitch) { player.yaw = yaw; player.pitch = pitch; },
};


