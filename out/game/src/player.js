import { Vector3, Euler, Quaternion, Raycaster, BoxGeometry, MeshBasicMaterial, Mesh, Group, Color } from '../vendor/three.module.min.js';
import { WEAPONS } from './config.js';
import { moveWithCollisions } from './world.js';

export function createPlayer(deps) {
  const { scene, camera, player, actors, colliders, audio, onKill, onShoot, onHit } = deps;
  let yaw = 0, pitch = 0;
  const feetPos = new Vector3();
  const velocity = new Vector3();
  let isCrouched = false;
  let ammo = {};
  let grenadeCount = 0;
  let isScoped = false;
  let active = false;
  let shotMode = false;
  let activeWeaponId = null;

  const viewmodel = new Group();
  camera.add(viewmodel);

  const keys = {};
  window.addEventListener('keydown', e => keys[e.code] = true);
  window.addEventListener('keyup', e => keys[e.code] = false);

  const controller = {
    update(dt) {
      if (!active || shotMode) return;

      const wishDir = new Vector3(
        (keys['KeyD'] ? 1 : 0) - (keys['KeyA'] ? 1 : 0),
        0,
        (keys['KeyS'] ? 1 : 0) - (keys['KeyW'] ? 1 : 0)
      ).applyEuler(new Euler(0, yaw, 0)).normalize();

      const speed = isCrouched ? 2.2 : (keys['ShiftLeft'] ? 6.2 : 4.3);
      velocity.x += (wishDir.x * speed - velocity.x) * 0.1;
      velocity.z += (wishDir.z * speed - velocity.z) * 0.1;
      velocity.y -= 9.8 * dt;

      const moved = moveWithCollisions(feetPos, velocity.x * dt, velocity.z * dt, 0.3, colliders);
      feetPos.add(moved);
      if (feetPos.y < 0) { feetPos.y = 0; velocity.y = 0; }

      camera.position.set(0, isCrouched ? 1.15 : 1.62, 0);

      player.position.copy(feetPos);
      player.rotation.set(0, yaw, 0);
    },
    reset(spawnPos, startYaw) {
      feetPos.copy(spawnPos);
      yaw = startYaw;
      pitch = 0;
      velocity.set(0, 0, 0);
      isCrouched = false;
      ammo = {};
      grenadeCount = 0;
    },
    setActive(bool) {
      active = bool;
    },
    setShotMode(bool) {
      shotMode = bool;
    },
    isScoped() {
      return isScoped;
    },
    buyWeapon(id) {
      activeWeaponId = id;
    },
    buyGrenade() {
      grenadeCount++;
    },
    grenadeCount() {
      return grenadeCount;
    }
  };

  return controller;
}
