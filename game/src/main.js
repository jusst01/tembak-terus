import { WebGLRenderer, Scene, PerspectiveCamera, Fog, Vector3, Clock } from '../vendor/three.module.min.js';
import { buildWorld, SPAWNS } from './world.js';
import { preloadCharacters, Actor } from './actors.js';
import { createPlayer } from './player.js';
import { audio } from './audio.js';
import { updateHUD } from './hud.js';

const renderer = new WebGLRenderer({ antialias: true, shadowMap: { enabled: true } });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);
const scene = new Scene();
scene.fog = new Fog(0x1a1a1a, 1, 100);
const camera = new PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const clock = new Clock();

async function init() {
  await preloadCharacters();
  const world = buildWorld(scene);
  const actors = [];

  // Create player (index 0)
  const player = new Actor(scene, true, 0, 0, SPAWNS.ember[0]);
  actors.push(player);

  // Create bots...

  const controller = createPlayer({
    scene, camera, player, actors, colliders: world.colliders, audio,
    onHit: (dmg, isHead, killed) => { /* HUD/Audio */ },
    onKill: (victim, dmg, head) => { /* Rewards */ }
  });

  function loop() {
    const dt = Math.min(clock.getDelta(), 0.05);
    controller.update(dt);

    // Update all actors
    actors.forEach(a => a.update(dt, actors, world.colliders, world.relayPos));

    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  }
  loop();
}

init();
