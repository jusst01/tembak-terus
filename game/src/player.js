import * as THREE from "three";
import { WEAPONS, ECONOMY } from './config.js';

export function createPlayer(deps) {
  const { scene, camera, player, actors, colliders, audio, onHit, onKill } = deps;
  let yaw = 0;
  let pitch = 0;
  const velocity = new THREE.Vector3();
  const position = new THREE.Vector3().copy(player.position);

  const eyeHeight = 1.62;
  const crouchHeight = 1.15;
  let targetHeight = eyeHeight;
  let currentHeight = eyeHeight;

  let active = false;
  let scoped = false;
  let ammo = {};
  let ownedWeapons = ['sidearm'];
  let grenades = 2;
  let activeWeaponId = 'sidearm';
  let isShooting = false;
  let lastShotTime = 0;
  let isReloading = false;
  let reloadTimer = 0;

  // Input state
  const keys = {};
  let moveDir = new THREE.Vector3();

  // Initialize ammo
  Object.keys(WEAPONS).forEach(id => {
    ammo[id] = { mag: WEAPONS[id].mag, reserve: WEAPONS[id].reserve };
  });

  // Setup input listeners
  document.addEventListener('keydown', (e) => keys[e.code] = true);
  document.addEventListener('keyup', (e) => keys[e.code] = false);
  document.addEventListener('mousemove', (e) => {
    if (!active) return;
    yaw -= e.movementX * 0.002;
    pitch -= e.movementY * 0.002;
    pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitch));
  });
  document.addEventListener('mousedown', (e) => {
    if (!active) return;
    if (e.button === 0) isShooting = true;
    if (e.button === 2) scoped = true;
  });
  document.addEventListener('mouseup', (e) => {
    if (e.button === 0) isShooting = false;
    if (e.button === 2) scoped = false;
  });

  function reset(spawnPos, y) {
    position.copy(spawnPos);
    yaw = y;
    pitch = 0;
    velocity.set(0, 0, 0);
    active = false;
  }

  function setActive(a) {
    active = a;
    if (active) { const pl = document.body.requestPointerLock(); if (pl && pl.catch) pl.catch(() => {}); }
    else document.exitPointerLock();
  }

  function update(dt) {
    if (!active) return;

    // Movement
    const speed = keys['ShiftLeft'] ? 6.0 : 3.5;
    targetHeight = keys['ControlLeft'] ? crouchHeight : eyeHeight;
    currentHeight += (targetHeight - currentHeight) * dt * 10;

    // Jump
    if (keys['Space'] && position.y <= 0.05) {
       velocity.y = 5.0;
    }
    velocity.y -= 20.0 * dt; // Gravity
    position.y += velocity.y * dt;
    if (position.y < 0) { position.y = 0; velocity.y = 0; }

    moveDir.set(0, 0, 0);
    if (keys['KeyW']) moveDir.z -= 1;
    if (keys['KeyS']) moveDir.z += 1;
    if (keys['KeyA']) moveDir.x -= 1;
    if (keys['KeyD']) moveDir.x += 1;
    moveDir.normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);

    velocity.x = moveDir.x * speed;
    velocity.z = moveDir.z * speed;
    position.add(velocity.clone().multiplyScalar(dt));

    // Camera
    camera.position.set(position.x, position.y + currentHeight, position.z);
    camera.rotation.set(pitch, yaw, 0);

    // Scope
    camera.fov = scoped ? 30 : 75;
    camera.updateProjectionMatrix();

    // Breathing sway
    const time = performance.now() / 1000;
    const sway = Math.sin(time) * 0.005;
    camera.rotation.z = sway;

    // Shooting
    const weapon = WEAPONS[activeWeaponId];
    if (isShooting && !isReloading) {
      const now = performance.now() / 1000;
      if (now - lastShotTime > weapon.fireRate) {
        if (ammo[activeWeaponId].mag > 0) {
          lastShotTime = now;
          ammo[activeWeaponId].mag--;

          // Recoil
          pitch += 0.01;
          yaw += (Math.random() - 0.5) * 0.01;

          // Raycast
          const raycaster = new THREE.Raycaster();
          const direction = new THREE.Vector3(0, 0, -1).applyEuler(camera.rotation);
          raycaster.set(camera.position, direction);

          const intersects = raycaster.intersectObjects(actors.map(a => a.container), true);
          if (intersects.length > 0) {
            const actor = actors.find(a => intersects[0].object.parent === a.container || intersects[0].object === a.container);
            if (actor) {
              const killed = actor.takeDamage(weapon.damage, false, colliders);
              onHit(actor);
              if (killed) onKill(actor);
            }
          }
          audio.play('shoot');
        } else {
          audio.play('empty');
        }
      }
    }

    // Reloading
    if (keys['KeyR'] && !isReloading && ammo[activeWeaponId].mag < weapon.mag && ammo[activeWeaponId].reserve > 0) {
      isReloading = true;
      reloadTimer = 2.0; // Assume 2s reload
      audio.play('reload');
    }
    if (isReloading) {
      reloadTimer -= dt;
      if (reloadTimer <= 0) {
        isReloading = false;
        const needed = weapon.mag - ammo[activeWeaponId].mag;
        const take = Math.min(needed, ammo[activeWeaponId].reserve);
        ammo[activeWeaponId].mag += take;
        ammo[activeWeaponId].reserve -= take;
      }
    }

    // Grenade
    if (keys['KeyG'] && grenades > 0) {
        grenades--;
        // Spawn grenade physics object
        // ... (simplified as requested in the prompt)
        audio.play('grenade_throw');
        keys['KeyG'] = false; // Prevent multiple throws
    }
  }

  return {
    update,
    reset,
    setActive,
    isScoped: () => scoped,
    buyWeapon: (id) => { ownedWeapons.push(id); },
    buyGrenade: () => { grenades++; },
    grenadeCount: () => grenades
  };
}
