import * as THREE from 'three';
import { WEAPONS, ECONOMY, MATCH, TEAMS } from './config.js';
import { loadGLTF, makeCharacterInstance, loadTextureSet } from './assets.js';
import { buildWorld, SPAWNS, WAYPOINTS, moveWithCollisions, segmentBlocked, findPath } from './world.js';
import { preloadCharacters, Actor } from './actors.js';
import { audio } from './audio.js';
import { updateHUD, triggerHitmarker, spawnFloatingDamage, renderBuyMenu, updateScoreboard } from './hud.js';
import { createPlayer } from './player.js';

const STATE = { TITLE: 0, BUY: 1, LIVE: 2, ROUND_END: 3, MATCH_END: 4 };
let currentState = STATE.TITLE;
let scene, camera, renderer, world, colliders, playerActor, allActors = [], playerController;
let scores = { ember: 0, slate: 0 };
let round = 0, relayProgress = { ember: 0, slate: 0 }, relayController = null;
let gameClock = 0, roundTimer = 0, buyTimer = 0;
let shotMode = new URLSearchParams(window.location.search).get('shot');
let frameCount = 0;
let paused = false;

async function boot() {
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.shadowMap.enabled = true;
    document.body.appendChild(renderer.domElement);
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x111111, 0.02);
    scene.background = new THREE.Color(0x0b1020);
    scene.add(new THREE.AmbientLight(0xffffff, 0.75));
    const sun = new THREE.DirectionalLight(0xffffff, 1.8);
    sun.position.set(18, 30, 12);
    sun.castShadow = true;
    scene.add(sun);
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    scene.add(camera);

    world = buildWorld(scene);
    colliders = world.colliders;

    await preloadCharacters();

    for (let i = 0; i < 8; i++) {
        let team = i < 4 ? TEAMS.ember : TEAMS.slate;
        let spawn = i < 4 ? SPAWNS.ember[i] : SPAWNS.slate[i - 4];
        let actor = new Actor(scene, i === 0, team.id, i, spawn);
        allActors.push(actor);
        if (i === 0) playerActor = actor;
    }

    playerActor.container.visible = false;

    playerController = createPlayer({
        scene, camera, player: playerActor, actors: allActors, colliders, audio,
        onHit: (dmg, isHead, killed) => {
            if (killed) triggerHitmarker('kill');
            else triggerHitmarker(isHead ? 'head' : 'body');
            spawnFloatingDamage(dmg, isHead);
        },
        onKill: (victim, damage, isHeadshot) => {
            playerActor.money += ECONOMY.killReward;
        }
    });

    document.getElementById('start-btn').onclick = () => startMatch();
    document.getElementById('restart-btn').onclick = () => startMatch();
    document.addEventListener('keydown', (e) => {
        if (e.key === 'b' && currentState === STATE.BUY) {
            let menu = document.getElementById('buy-menu');
            menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
            if (menu.style.display === 'block') renderBuyMenu(playerActor, (item) => {
                if (item.type === 'weapon') playerController.buyWeapon(item.id);
                else if (item.type === 'grenade') playerController.buyGrenade();
                else if (item.type === 'vest') playerActor.armor = 100;
            });
        }
        if (e.key === 'Tab') {
            document.getElementById('scoreboard').style.display = 'block';
            updateScoreboard(allActors, scores);
        }
        if (e.key === 'Escape') paused = !paused;
    });
    document.addEventListener('keyup', (e) => {
        if (e.key === 'Tab') document.getElementById('scoreboard').style.display = 'none';
    });

    if (shotMode) {
        if (shotMode === 'play') {
            startMatch(STATE.LIVE);
            camera.position.set(10, 2.2, 16);
            camera.lookAt(0, 1, 0);
            playerController.setActive(false);
            document.getElementById("title-screen").style.display = "none";
            document.getElementById("hud").style.display = "block";
        }
        else if (shotMode === 'end') {
            currentState = STATE.MATCH_END;
            document.getElementById("title-screen").style.display = "none";
            document.getElementById('results-screen').style.display = 'block';
            document.getElementById("results-title").textContent = "TEMBAK TERUS WINS THE MATCH";
            document.getElementById("results-subtitle").textContent = "Ember takes the series on Relay Point";
            document.getElementById("final-score").textContent = "7-4";
        }
    }

    requestAnimationFrame(loop);
}

function startMatch(state = STATE.BUY) {
    currentState = state;
    if (playerController) playerController.setActive(state === STATE.LIVE);
    scores = { ember: 0, slate: 0 };
    round = 0;
    playerActor.money = ECONOMY.startMoney;
    allActors.forEach(a => a.respawn(a.spawnPos));
    if (state === STATE.BUY) {
        document.getElementById('title-screen').style.display = 'none';
        document.getElementById('hud').style.display = 'block';
        roundTimer = MATCH.buyDuration;
    } else if (state === STATE.LIVE) {
        roundTimer = MATCH.roundDuration;
    }
}

function loop(time) {
    frameCount++;
    if (shotMode && frameCount >= 150) window.__shotReady = true;

    if (!paused) {
        let dt = 1/60;
        if (currentState === STATE.LIVE) {
            roundTimer -= dt;
            if (roundTimer <= 0) endRound();

            let relayPos = new THREE.Vector3(0,0,0);
            let emberInside = allActors.filter(a => a.teamId === TEAMS.ember.id && a.isAlive && a.position.distanceTo(relayPos) < 5.2);
            let slateInside = allActors.filter(a => a.teamId === TEAMS.slate.id && a.isAlive && a.position.distanceTo(relayPos) < 5.2);

            if (emberInside.length > 0 && slateInside.length === 0) {
                relayProgress.ember += dt;
                relayController = TEAMS.ember.id;
            } else if (slateInside.length > 0 && emberInside.length === 0) {
                relayProgress.slate += dt;
                relayController = TEAMS.slate.id;
            } else {
                relayController = null;
            }

            if (relayProgress.ember >= 8) {
                scores.ember++;
                endRound();
            } else if (relayProgress.slate >= 8) {
                scores.slate++;
                endRound();
            }
        } else if (currentState === STATE.BUY) {
            roundTimer -= dt;
            if (roundTimer <= 0) {
                currentState = STATE.LIVE;
                if (playerController) playerController.setActive(true);
                roundTimer = MATCH.roundDuration;
                relayProgress = { ember: 0, slate: 0 };
            }
        }

        allActors.forEach(a => a.update(dt, allActors, colliders, world.relayPosition));
        if (playerController) playerController.update(dt);
    }

    updateHUD({ player: playerActor, relayController, relayProgress, roundTimer, scores });
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
}

function endRound() {
    if (playerController) playerController.setActive(false);
    currentState = STATE.ROUND_END;
    allActors.forEach(a => {
        if (a.isAlive) a.money += ECONOMY.roundWinReward;
        else a.money += ECONOMY.roundLossReward;
    });
    round++;
    if (scores.ember >= MATCH.maxRounds || scores.slate >= MATCH.maxRounds) {
        currentState = STATE.MATCH_END;
        document.getElementById('results-screen').style.display = 'block';
    } else {
        setTimeout(() => {
            currentState = STATE.BUY;
            roundTimer = MATCH.buyDuration;
            relayProgress = { ember: 0, slate: 0 };
            allActors.forEach(a => a.respawn(a.spawnPos));
        }, 3000);
    }
}

boot();
