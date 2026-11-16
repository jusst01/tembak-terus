# TEMBAK TERUS

[![make.fun · threejs-fps-02](https://make.fun/badge/threejs-fps-02.svg)](https://make.fun/bounty/threejs-fps-02?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02)
[![rank](https://make.fun/badge/threejs-fps-02/jusst01/tembak-terus/rank.svg)](https://make.fun/bounty/threejs-fps-02/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02)
[![reward](https://make.fun/badge/threejs-fps-02/jusst01/tembak-terus/reward.svg)](https://make.fun/bounty/threejs-fps-02/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02)

A Counter-Strike-style round-based tactical FPS built with three.js. Hold the Saltglass Yard with the Ember Watch against the Slate Union in 4v4 matches against bots with A* waypoint navigation and a noise/hearing system. Eliminate the opposing team or capture the central relay for eight seconds to win the round. Seven rounds wins the match. Money earned in buy phases funds your loadout — rifles, SMGs, shotguns, scoped Needle railguns, frag grenades, armor, and utility from the buy menu.

## Features

- **Tactical 4v4 Matches**: Ember Watch vs. Slate Union on the Saltglass Yard arena.
- **Round-Based Economy**: Buy weapons, vests, and grenades between rounds; surviving weapons carry over.
- **Advanced Gunplay**: Aim-down-sights (ADS) on every weapon, bloom/recoil spread model, hitmarkers, floating damage numbers, and overhead HP bars.
- **Scoped Railgun & Breath Control**: The Needle railgun features 2×/4×/8× zoom (scroll wheel) and Shift breath-hold stabilization.
- **A* Bot Navigation & Noise Bus**: Bots navigate waypoint graphs, react to gunfire noise events, and coordinate flanks.
- **Objective Play**: Dual win conditions — wipe out the enemy team or capture the relay.
- **Completely Self-Contained**: Vendored three.js 0.187.0, zero external network requests, procedural audio and art, ~2.2 MB total.

## Controls

- **W A S D**: Move
- **Mouse**: Look
- **Click**: Fire
- **Right-click**: Aim down sights / scope (Needle railgun)
- **R**: Reload
- **G**: Throw frag grenade
- **1–5**: Select weapon
- **Wheel**: Switch weapons (or adjust scope zoom while scoped)
- **Shift**: Sprint / hold breath while scoped
- **Alt**: Walk (quiet movement)
- **Ctrl**: Crouch
- **Space**: Jump
- **Tab**: Scoreboard
- **Esc**: Pause / menu

## Run It

```sh
node serve.ts            # Node 22, standard library only
# then open http://localhost:8080 in desktop Chrome
```

The game consists of plain static files under `game/` (ES modules, no build step) and plays fully offline against bots.

## Module Map

- `game/src/config.js` — Weapons, economy, match tuning, and team data.
- `game/src/world.js` — Saltglass arena layout, cover colliders, relay ring, and A* waypoint graph.
- `game/src/actors.js` — Player and bot character rigs, loadouts, health, and hit zones.
- `game/src/audio.js` — Procedural WebAudio sound effects.
- `game/src/main.js` — Core game flow, fixed-step 60 Hz deterministic simulation, gunplay, grenades, and HUD.

## License & Credits

- three.js 0.187.0 (vendored byte-for-byte under `game/`, MIT License).
- Entry for [threejs-fps-02](https://make.fun/c/threejs-fps-02) on make.fun.
