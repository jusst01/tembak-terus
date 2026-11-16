import * as THREE from 'three';
import { WEAPONS, ECONOMY } from './config.js';
import { loadGLTF, makeCharacterInstance } from './assets.js';
import { moveWithCollisions, segmentBlocked, findPath, WAYPOINTS } from './world.js';

let soldierGltf = null;
let punkGltf = null;
let adventurerGltf = null;

export async function preloadCharacters() {
  try {
    [soldierGltf, punkGltf, adventurerGltf] = await Promise.all([
      loadGLTF('./assets/characters/Soldier.glb'),
      loadGLTF('./assets/characters/Punk.glb'),
      loadGLTF('./assets/characters/Adventurer.glb')
    ]);
  } catch (e) {
    console.warn('Character GLB load failed, falling back to capsules', e);
  }
}

export class Actor {
  constructor(scene, isPlayer, teamId, index, spawnPos) {
    this.scene = scene;
    this.isPlayer = isPlayer;
    this.teamId = teamId; // 0: Ember, 1: Slate
    this.index = index;
    this.position = spawnPos.clone();
    this.rotation = teamId === 0 ? 0 : Math.PI;

    this.maxHp = 100;
    this.hp = 100;
    this.armor = 0;
    this.money = ECONOMY.startMoney;

    this.loadout = {
      primary: null,
      secondary: { ...WEAPONS.sidearm, ammo: WEAPONS.sidearm.mag, reserve: WEAPONS.sidearm.reserve },
      currentWeapon: 'secondary',
      grenades: 0
    };
    this.activeWeaponData = this.loadout.secondary;

    this.isAlive = true;
    this.hitFlashTimer = 0;
    this.isHeadshotFlash = false;
    this.hitTimer = 0; // for HitReceive animation

    // Bot AI state
    this.state = 'advance'; // advance, hold, attack, relay
    this.path = [];
    this.pathIndex = 0;
    this.targetActor = null;
    this.lastShotTime = 0;
    this.holdTimer = 0;

    // Visual model container
    this.container = new THREE.Group();
    this.container.position.copy(this.position);
    this.scene.add(this.container);

    this.setupVisuals();
    this.setupHealthBar();
  }

  setupVisuals() {
    let gltf = null;
    if (this.teamId === 0) {
      gltf = adventurerGltf;
    } else {
      const gltfs = [soldierGltf, punkGltf, adventurerGltf];
      gltf = gltfs[this.index % gltfs.length];
    }

    if (gltf) {
      const inst = makeCharacterInstance(gltf, this.teamId);
      this.modelGroup = inst.group;
      this.modelGroup.scale.set(1.1, 1.1, 1.1);
      this.container.add(this.modelGroup);
      this.mixer = inst.mixer;
      this.actions = inst.actions;
      this.currentActionName = 'Idle_Gun_Pointing';
      if (this.actions[this.currentActionName]) {
        this.actions[this.currentActionName].play();
      }
    } else {
      // Fallback capsule
      const geo = new THREE.CapsuleGeometry(0.4, 1.2, 8, 16);
      const mat = new THREE.MeshStandardMaterial({
        color: this.teamId === 0 ? 0xf97316 : 0x38bdf8,
        roughness: 0.5
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.y = 1.0;
      mesh.castShadow = true;
      this.container.add(mesh);
      this.modelGroup = mesh;
    }
  }

  setupHealthBar() {
    if (this.isPlayer) return; // Player has HUD health bar
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    this.hbCanvas = canvas;
    this.hbCtx = ctx;

    const texture = new THREE.CanvasTexture(canvas);
    this.hbTexture = texture;
    const mat = new THREE.SpriteMaterial({ map: texture, depthTest: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(1.2, 0.3, 1);
    sprite.position.set(0, 2.3, 0);
    this.container.add(sprite);
    this.updateHealthBar();
  }

  updateHealthBar() {
    if (!this.hbCtx) return;
    const ctx = this.hbCtx;
    ctx.clearRect(0, 0, 128, 32);
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, 128, 32);

    const pct = Math.max(0, this.hp / this.maxHp);
    ctx.fillStyle = this.teamId === 0 ? '#f97316' : '#38bdf8';
    ctx.fillRect(4, 4, 120 * pct, 24);
    this.hbTexture.needsUpdate = true;
  }

  switchAnimation(name) {
    if (!this.actions || this.currentActionName === name) return;
    const prev = this.actions[this.currentActionName];
    const next = this.actions[name];
    if (next) {
      if (prev) prev.fadeOut(0.15);
      next.reset().fadeIn(0.15).play();
      this.currentActionName = name;
    }
  }

  takeDamage(amount, isHeadshot, colliders) {
    if (!this.isAlive) return false;

    // Armor absorption
    let effectiveDmg = amount;
    if (isHeadshot) effectiveDmg *= 2.2;
    else effectiveDmg *= 1.0;

    if (this.armor > 0) {
      const absorbed = effectiveDmg * ECONOMY.vestAbsorb;
      this.armor -= absorbed;
      effectiveDmg -= absorbed;
      if (this.armor < 0) this.armor = 0;
    }

    this.hp -= effectiveDmg;
    this.hitFlashTimer = 0.2;
    this.isHeadshotFlash = isHeadshot;
    this.hitTimer = 0.25;

    if (!this.isPlayer) this.updateHealthBar();

    if (this.hp <= 0) {
      this.hp = 0;
      this.die();
      return true; // killed
    }
    return false;
  }

  die() {
    this.isAlive = false;
    if (this.modelGroup) {
      if (this.actions && this.actions['Death']) {
        // Stop all and play death once
        Object.values(this.actions).forEach(a => a.stop());
        const deathAction = this.actions['Death'];
        deathAction.setLoop(THREE.LoopOnce, 1);
        deathAction.clampWhenFinished = true;
        deathAction.play();
      } else {
        // Fallback rotation
        this.container.rotation.x = Math.PI / 2;
        this.container.position.y = 0.3;
      }
    }
    if (this.hbCanvas && this.container) {
      // Remove health bar sprite on death
      this.container.children = this.container.children.filter(c => !(c instanceof THREE.Sprite));
    }
  }

  respawn(pos) {
    this.isAlive = true;
    this.hp = 100;
    this.position.copy(pos);
    this.container.position.copy(pos);
    this.container.rotation.set(0, 0, 0);
    if (this.modelGroup) {
      this.switchAnimation('Idle_Gun_Pointing');
    }
    this.setupHealthBar();
  }

  buyBotLoadout() {
    if (this.isPlayer) return;
    // Simple bot economy script: vest if rich, rifle when affordable, else SMG or shotgun
    if (this.money >= ECONOMY.vestPrice && this.armor === 0) {
      this.money -= ECONOMY.vestPrice;
      this.armor = 100;
    }
    if (this.money >= WEAPONS.rifle.price && !this.loadout.primary) {
      this.money -= WEAPONS.rifle.price;
      this.loadout.primary = { ...WEAPONS.rifle, ammo: WEAPONS.rifle.mag, reserve: WEAPONS.rifle.reserve };
      this.loadout.currentWeapon = 'primary';
      this.activeWeaponData = this.loadout.primary;
    } else if (this.money >= WEAPONS.smg.price && !this.loadout.primary) {
      this.money -= WEAPONS.smg.price;
      this.loadout.primary = { ...WEAPONS.smg, ammo: WEAPONS.smg.mag, reserve: WEAPONS.smg.reserve };
      this.loadout.currentWeapon = 'primary';
      this.activeWeaponData = this.loadout.primary;
    }
    if (this.money >= ECONOMY.grenadePrice && this.loadout.grenades < 2) {
      this.money -= ECONOMY.grenadePrice;
      this.loadout.grenades++;
    }
  }

  update(dt, allActors, colliders, relayPos) {
    if (!this.isAlive) {
      if (this.mixer) this.mixer.update(dt);
      return;
    }

    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer -= dt;
      const col = this.isHeadshotFlash ? 0xf97316 : 0xffffff;
      this.modelGroup.traverse(child => {
        if (child.isMesh && child.material) {
          child.material.emissive.setHex(this.hitFlashTimer > 0 ? col : 0x000000);
        }
      });
    }

    if (this.hitTimer > 0) {
      this.hitTimer -= dt;
      if (this.hitTimer <= 0 && this.modelGroup) {
        this.switchAnimation('HitRecieve');
      }
    }

    if (this.mixer) this.mixer.update(dt);

    if (this.isPlayer) return; // Player update handled in main.js

    // Bot AI update
    this.updateBotAI(dt, allActors, colliders, relayPos);
  }

  updateBotAI(dt, allActors, colliders, relayPos) {
    // Find visible enemies
    let nearestEnemy = null;
    let minDist = 999;
    for (const actor of allActors) {
      if (actor.teamId !== this.teamId && actor.isAlive) {
        const d = this.position.distanceTo(actor.position);
        if (d < minDist && !segmentBlocked(this.position, actor.position, colliders)) {
          minDist = d;
          nearestEnemy = actor;
        }
      }
    }

    if (nearestEnemy && minDist < 22) {
      // Engage / Attack
      this.targetActor = nearestEnemy;
      this.state = 'attack';
    } else if (this.state === 'attack') {
      this.state = 'advance';
    }

    if (this.state === 'attack') {
      // Face enemy, shoot if rate permits
      const targetPos = this.targetActor.position;
      const angle = Math.atan2(targetPos.x - this.position.x, targetPos.z - this.position.z);
      this.container.rotation.y = angle;

      this.switchAnimation('Gun_Shoot');

      // Shoot logic
      const now = performance.now() / 1000;
      if (now - this.lastShotTime >= this.activeWeaponData.fireRate) {
        this.lastShotTime = now;
        if (this.activeWeaponData.ammo > 0) {
          this.activeWeaponData.ammo--;
          // 25% chance of headshot for bots
          const isHead = Math.random() < 0.25;
          const killed = this.targetActor.takeDamage(this.activeWeaponData.damage, isHead, colliders);
          if (killed) {
            this.money += ECONOMY.killReward;
            this.targetActor = null;
            this.state = 'advance';
          }
        } else {
          // reload
          this.activeWeaponData.ammo = this.activeWeaponData.mag;
        }
      }
    } else {
      // Navigation / Pathfinding towards relay or objectives
      if (this.path.length === 0 || this.pathIndex >= this.path.length) {
        // Pick destination: relay or random waypoint
        const dest = relayPos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 6, 0, (Math.random() - 0.5) * 6));
        this.path = findPath(this.position, dest, WAYPOINTS);
        this.pathIndex = 0;
      }

      if (this.path.length > 0 && this.pathIndex < this.path.length) {
        const targetWP = this.path[this.pathIndex];
        const dir = new THREE.Vector3().subVectors(targetWP, this.position);
        dir.y = 0;
        const dist = dir.length();

        if (dist < 1.5) {
          this.pathIndex++;
        } else {
          dir.normalize();
          const speed = 4.0 * dt;
          moveWithCollisions(this.position, dir.x * speed, dir.z * speed, 0.4, colliders);
          this.container.position.copy(this.position);
          this.container.rotation.y = Math.atan2(dir.x, dir.z);
          this.switchAnimation('Run');
        }
      }
    }
  }
}
