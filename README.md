# TEMBAK TERUS

A round-based tactical FPS for the browser, built with three.js. You hold the
Saltglass relay with the Ember Watch against Slate Union in 4 v 4 rounds:
eliminate the other team, or control the central relay for eight seconds, to
win the round. Seven rounds wins the match. Money earned in one round buys the
next round's edge — rifles, an SMG, a shotgun, the scoped Needle, frag grenades
and vests from the buy menu.

Accuracy matters more than speed: standing still and tapping beats panic
spray, and movement, recoil and range all change the cone. Bots follow
waypoint routes, hold positions, react to sight and sound, and play the same
economy you do. Hitmarkers, damage numbers, kill bursts and overhead health
bars make every hit readable; the Needle sniper scopes at 2×/4×/8× with
breath sway.

## Controls

- **W A S D** move · **Mouse** look · **Click** fire · **R** reload
- **G** throw grenade · **B** buy menu · **1–5** weapons
- **Shift** run · **Ctrl** crouch · **Space** jump
- **Tab** scoreboard · **Esc** pause
- Needle scope: **Right-click** aim · **Scroll** while scoped switches
  2×/4×/8× zoom · hold **Shift** while scoped to hold your breath

## Run it

```sh
node serve.ts            # Node 22, standard library only
# then open http://localhost:8080 in desktop Chrome
```

The game is plain static files under `game/` (ES modules, no build step) and
plays fully offline against bots — it makes no network request. `main.ts` is
the handover program: it copies `game/` and `screenshots/` to the output
directory and writes the dossier with `vendor/makefun-threejs.ts`.

## How it is built

- `game/src/config.js` — weapons, economy, match and team tuning in one place
- `game/src/world.js` — the Saltglass arena: lanes, cover, the relay ring,
  collision and the waypoint graph the bots navigate
- `game/src/actors.js` — players and bots: loadouts, health, hit zones, and
  the animated character rigs that replaced the old procedural bodies
- `game/src/audio.js` — WebAudio synth sounds layered with recorded SFX files
- `game/src/assets.js` — the glTF/texture loading layer for the real assets
- `game/src/main.js` — the match loop: rounds, buy phase, gunplay, grenades,
  the scoped Needle, HUD and screenshot mode (`?shot=start|play|end`)

Enemy bots are real rigged characters (Soldier, Punk, Adventurer) with
locomotion, gun, hit-react and death animation states wired to their
behaviour; they carry blaster models and throw the same frag grenade you do.

## Asset credits

- Characters: **Quaternius — Ultimate Modular Males**, CC0 1.0
  (https://creativecommons.org/publicdomain/zero/1.0/)
- Weapons and sound effects: **Kenney** (Blaster Kit, Sci-Fi Sounds, Impact
  Sounds), CC0
- Environment textures (metal plate, container side, concrete panels):
  **Poly Haven**, CC0
- three.js 0.187.0, MIT License (vendored under `game/`)

Entry for [threejs-fps-02](https://make.fun/c/threejs-fps-02) on make.fun.

![threejs-fps-02](https://make.fun/badge/threejs-fps-02.svg)
![rank](https://make.fun/badge/threejs-fps-02/jusst01/tembak-terus/rank.svg)
![reward](https://make.fun/badge/threejs-fps-02/jusst01/tembak-terus/reward.svg)
