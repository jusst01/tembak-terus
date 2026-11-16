export const WEAPONS = {
  sidearm: { id: 'sidearm', name: 'P9 Sidearm', price: 0, damage: 22, fireRate: 0.28, mag: 12, reserve: 72, spread: 0.02, model: 'blaster-a.glb' },
  smg: { id: 'smg', name: 'Vector SMG', price: 900, damage: 18, fireRate: 0.085, mag: 30, reserve: 120, spread: 0.05, model: 'blaster-b.glb' },
  rifle: { id: 'rifle', name: 'Assault Rifle', price: 2400, damage: 34, fireRate: 0.13, mag: 25, reserve: 100, spread: 0.015, model: 'blaster-c.glb' },
  shotgun: { id: 'shotgun', name: 'Pump Shotgun', price: 1100, damage: 8, pellets: 9, fireRate: 0.9, mag: 6, reserve: 30, spread: 0.08, model: 'blaster-d.glb' },
  needle: { id: 'needle', name: 'Needle Sniper', price: 3400, damage: 95, fireRate: 1.1, mag: 5, reserve: 20, spread: 0.001, model: 'blaster-e.glb' }
};

export const ECONOMY = {
  startMoney: 800,
  killReward: 300,
  roundWinReward: 1400,
  roundLossReward: 900,
  vestPrice: 650,
  vestAbsorb: 0.55,
  grenadePrice: 300,
  maxGrenades: 3
};

export const MATCH = {
  maxRounds: 7,
  roundDuration: 100,
  buyDuration: 12,
  intermissionDuration: 3,
  relayRadius: 5.2,
  relayWinSeconds: 8
};

export const TEAMS = {
  ember: { id: 0, name: 'Ember', color: 0xf97316, spawnZ: 24 },
  slate: { id: 1, name: 'Slate', color: 0x38bdf8, spawnZ: -24 }
};
