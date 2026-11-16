import { WEAPONS, ECONOMY } from './config.js';

export function updateHUD(state) {
  // HP & Armor
  document.getElementById('hp-text').innerText = Math.round(state.player.hp);
  document.getElementById('hp-fill').style.width = `${(state.player.hp / 100) * 100}%`;

  const armorPct = Math.min(100, (state.player.armor / 100) * 100);
  document.getElementById('armor-text').innerText = Math.round(state.player.armor);
  document.getElementById('armor-fill').style.width = `${armorPct}%`;

  // Low health warning & vignette
  const vignette = document.getElementById('vignette');
  const lowWarning = document.getElementById('low-health-warning');
  if (state.player.hp < 30 && state.player.hp > 0) {
    vignette.classList.add('danger');
    lowWarning.style.opacity = '1';
  } else {
    vignette.classList.remove('danger');
    lowWarning.style.opacity = '0';
  }

  // Weapon & Ammo
  const weapon = state.player.loadout[state.player.loadout.currentWeapon] || state.player.loadout.secondary;
  document.getElementById('hud-weapon-name').innerText = weapon.name;
  document.getElementById('hud-ammo-cur').innerText = weapon.ammo;
  document.getElementById('hud-ammo-res').innerText = weapon.reserve;

  // Money & Grenades
  document.getElementById('hud-money').innerText = `$${state.player.money}`;
  document.getElementById('hud-grenades').innerText = `Grenades: ${state.player.loadout.grenades}`;

  // Scores & Timer
  document.getElementById('score-ember-hud').innerText = `Ember ${state.scores.ember}`;
  document.getElementById('score-slate-hud').innerText = `Slate ${state.scores.slate}`;

  const mins = Math.floor(state.roundTimer / 60);
  const secs = Math.floor(state.roundTimer % 60);
  document.getElementById('round-timer').innerText = `${mins}:${secs < 10 ? '0' : ''}${secs}`;

  // Relay progress bar
  const relayFillEmber = document.getElementById('relay-fill-ember');
  const relayFillSlate = document.getElementById('relay-fill-slate');
  const relayStatusText = document.getElementById('relay-status-text');

  if (state.relayController === 0) {
    relayFillEmber.style.width = `${(state.relayProgress / 8) * 100}%`;
    relayFillSlate.style.width = '0%';
    relayStatusText.innerText = 'Ember Capturing Relay';
  } else if (state.relayController === 1) {
    relayFillSlate.style.width = `${(state.relayProgress / 8) * 100}%`;
    relayFillEmber.style.width = '0%';
    relayStatusText.innerText = 'Slate Capturing Relay';
  } else {
    relayFillEmber.style.width = '0%';
    relayFillSlate.style.width = '0%';
    relayStatusText.innerText = 'Relay Neutral';
  }
}

export function triggerHitmarker(type) {
  const hm = document.getElementById('hitmarker');
  hm.className = 'hitmarker';
  if (type === 'headshot') hm.classList.add('headshot');
  else if (type === 'kill') hm.classList.add('kill');
  hm.style.opacity = '1';
  setTimeout(() => { hm.style.opacity = '0'; }, 120);
}

export function spawnFloatingDamage(dmg, isHeadshot) {
  const div = document.createElement('div');
  div.className = 'floating-dmg';
  div.innerText = Math.round(dmg);
  div.style.color = isHeadshot ? '#f97316' : '#fff';
  div.style.left = `${window.innerWidth / 2 + (Math.random() - 0.5) * 40}px`;
  div.style.top = `${window.innerHeight / 2 - 20}px`;
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 800);
}

export function renderBuyMenu(player, onBuy) {
  const grid = document.getElementById('buy-grid');
  grid.innerHTML = '';
  document.getElementById('player-money-buy').innerText = `Funds: $${player.money}`;

  const items = [
    { id: 'smg', ...WEAPONS.smg },
    { id: 'rifle', ...WEAPONS.rifle },
    { id: 'shotgun', ...WEAPONS.shotgun },
    { id: 'needle', ...WEAPONS.needle },
    { id: 'vest', name: 'Armor Vest', price: ECONOMY.vestPrice, desc: 'Absorbs 55% damage' },
    { id: 'grenade', name: 'Frag Grenade', price: ECONOMY.grenadePrice, desc: 'Max 3 carried' }
  ];

  items.forEach(item => {
    const el = document.createElement('div');
    el.className = 'buy-item';
    const isOwned = item.id === 'vest' && player.armor >= 100 || (player.loadout.primary && player.loadout.primary.id === item.id);
    if (isOwned) el.classList.add('owned');

    el.innerHTML = `
      <div class="buy-item-info">
        <div class="buy-item-name">${item.name}</div>
        <div class="buy-item-desc">${item.desc || item.damage + ' dmg'}</div>
      </div>
      <div class="buy-item-price">$${item.price}</div>
    `;

    if (!isOwned) {
      el.addEventListener('click', () => onBuy(item.id, item.price));
    }
    grid.appendChild(el);
  });
}

export function updateScoreboard(actors, scores) {
  const body = document.getElementById('sb-body');
  if (!body) return;
  body.innerHTML = '';

  actors.forEach(a => {
    const row = document.createElement('div');
    row.className = 'sb-row';
    const name = a.isPlayer ? 'You (Ember)' : `${a.teamId === 0 ? 'Ember' : 'Slate'} Bot ${a.index}`;
    const teamName = a.teamId === 0 ? 'Ember' : 'Slate';
    const status = a.isAlive ? 'Alive' : 'Dead';
    row.innerHTML = `
      <div>${name}</div>
      <div style="color: ${a.teamId === 0 ? 'var(--accent-orange)' : 'var(--accent)'}">${teamName}</div>
      <div>-</div>
      <div style="color: ${a.isAlive ? 'var(--success)' : 'var(--danger)'}">${status}</div>
    `;
    body.appendChild(row);
  });
}
