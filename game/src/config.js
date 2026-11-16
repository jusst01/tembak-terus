export const TEAM = {
  EMBER: 'EMBER',
  SLATE: 'SLATE',
};

export const WEAPONS = {
  sidearm: {
    id: 'sidearm', slot: 1, name: 'P9 Sidearm', short: 'P9', price: 0,
    damage: 32, headMultiplier: 2.3, rpm: 360, automatic: false,
    magazine: 12, reserve: 72, reloadTime: 1.25, pellets: 1,
    spread: 0.011, movingSpread: 0.028, recoil: 0.011, range: 58,
    falloffStart: 18, minDamageScale: 0.52, tracer: 0xffd166,
    description: 'Free, honest and accurate when you give it a beat between shots.',
  },
  smg: {
    id: 'smg', slot: 2, name: 'Rook-9 SMG', short: 'ROOK', price: 900,
    damage: 25, headMultiplier: 1.9, rpm: 820, automatic: true,
    magazine: 32, reserve: 128, reloadTime: 1.85, pellets: 1,
    spread: 0.026, movingSpread: 0.052, recoil: 0.0075, range: 48,
    falloffStart: 13, minDamageScale: 0.42, tracer: 0x8bd450,
    description: 'Close-range confidence. Eats corners and budgets at the same speed.',
  },
  shotgun: {
    id: 'shotgun', slot: 3, name: 'Breach-6 Scattergun', short: 'BREACH', price: 1100,
    damage: 13, headMultiplier: 1.45, rpm: 76, automatic: false,
    magazine: 6, reserve: 30, reloadTime: 2.7, pellets: 8,
    spread: 0.082, movingSpread: 0.105, recoil: 0.045, range: 28,
    falloffStart: 7, minDamageScale: 0.25, tracer: 0xff9f43,
    description: 'A doorway argument with eight pellets. Useless across the yard, decisive inside it.',
  },
  rifle: {
    id: 'rifle', slot: 4, name: 'Longbow AR', short: 'LONGBOW', price: 2400,
    damage: 42, headMultiplier: 2.25, rpm: 610, automatic: true,
    magazine: 30, reserve: 90, reloadTime: 2.05, pellets: 1,
    spread: 0.014, movingSpread: 0.042, recoil: 0.014, range: 78,
    falloffStart: 27, minDamageScale: 0.62, tracer: 0xff6b35,
    description: 'The round-winner. Rewards first-shot discipline more than trigger time.',
  },
  needle: {
    id: 'needle', slot: 5, name: 'Needle Railgun', short: 'NEEDLE', price: 3400,
    damage: 108, headMultiplier: 1.6, rpm: 46, automatic: false,
    magazine: 5, reserve: 20, reloadTime: 2.8, pellets: 1,
    spread: 0.0015, movingSpread: 0.09, recoil: 0.075, range: 110,
    falloffStart: 55, minDamageScale: 0.9, tracer: 0x9be7ff,
    description: 'One body shot, one funeral. Right-click for the sniper scope (2×/4×/8×, scroll to zoom, hold Shift to steady your breath); never fire it on the run.',
  },
};

// Throwable frag grenade: not a loadout weapon — carried as a count on the
// loadout, thrown with G, refilled +1 free at every round start up to maxCarry.
export const GRENADE = {
  price: 300,
  maxCarry: 3,
  roundRefill: 1,
  damage: 118,
  radius: 5.8,
  minDamageScale: 0.12,
  fuseSeconds: 1.55,
  throwSpeed: 16.5,
  throwUp: 2.6,
  gravity: 13.5,
  bounce: 0.42,
};

export const BUY_ITEMS = [
  { kind: 'weapon', id: 'smg' },
  { kind: 'weapon', id: 'shotgun' },
  { kind: 'weapon', id: 'rifle' },
  { kind: 'weapon', id: 'needle' },
  { kind: 'armor', id: 'armor', name: 'Ceramic Vest', price: 650, description: 'Cuts incoming bullet damage by 45%. The least glamorous, most sensible purchase here.' },
  { kind: 'grenade', id: 'grenade', name: 'Frag Grenade', price: 300, description: 'One throwable ember-frag (carry up to 3, +1 free every round). Throw with G: bounced arc, 1.5 s fuse, heavy area damage that falls off with range — and it does not care which team you are on.' },
  { kind: 'ammo', id: 'ammo', name: 'Reserve Ammunition', price: 250, description: 'Refills reserve ammunition for every weapon you own. No drama, no empty click at the relay.' },
];

export const ECONOMY = {
  start: 800,
  kill: 300,
  roundWin: 1400,
  roundLoss: 950,
  objective: 600,
  max: 9000,
};

export const MATCH = {
  roundsToWin: 7,
  maxRounds: 13,
  buySeconds: 14,
  roundSeconds: 105,
  endSeconds: 4.5,
  captureSeconds: 8,
};
