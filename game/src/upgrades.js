// Between-wave upgrades: after every cleared wave (1-9) the pilot picks
// 1 of 3. Each upgrade changes how the ship flies or fights, so the choice
// matters — and the offer is drawn fresh each wave, so no two runs upgrade
// the same way. The world owns when the offer appears; this file owns what
// an upgrade is and what it does.

import { MAX_HULL, PALETTE } from './config.js';

/** The whole upgrade pool: id, name, what it does, and its card colour. */
export const UPGRADE_POOL = [
  {
    id: 'rapid',
    name: 'RAPID CYCLER',
    desc: 'Fire 25% faster',
    color: PALETTE.cyan,
  },
  {
    id: 'hull',
    name: 'REINFORCED HULL',
    desc: '+1 hull, up to 5',
    color: PALETTE.hull,
  },
  {
    id: 'split',
    name: 'SPLIT BOLTS',
    desc: 'Fire an extra bolt',
    color: PALETTE.magenta,
  },
  {
    id: 'magnet',
    name: 'SHARD MAGNET',
    desc: 'Shards drift to Lumen',
    color: PALETTE.gold,
  },
];

const BY_ID = new Map(UPGRADE_POOL.map((u) => [u.id, u]));

/** Is this upgrade still worth offering, given what is already owned? */
function stillOfferable(id, state) {
  if (id === 'hull') return state.hull < MAX_HULL;
  if (id === 'split') return (state.player.boltCount ?? 1) < 3;
  if (id === 'magnet') return !state.magnetAlways;
  if (id === 'rapid') return (state.player.fireRateMul ?? 1) > 0.45;
  return true;
}

/**
 * Draw 3 distinct upgrades for the wave-clear offer, skipping ones that
 * would do nothing. `rng` is the world's seeded RNG, so the offer is
 * deterministic for a fixed seed.
 */
export function rollOffer(rng, state) {
  const candidates = UPGRADE_POOL.filter((u) => stillOfferable(u.id, state));
  const offer = [];
  while (offer.length < 3 && candidates.length > 0) {
    const i = Math.floor(rng.range(0, candidates.length));
    offer.push(candidates.splice(i, 1)[0]);
  }
  return offer;
}

/** Apply one picked upgrade to the world state and the ship. */
export function applyUpgrade(state, id) {
  const def = BY_ID.get(id);
  if (!def) return;
  state.upgrades.push(id);
  const player = state.player;
  if (id === 'rapid') {
    player.fireRateMul = (player.fireRateMul ?? 1) * 0.75;
  } else if (id === 'hull') {
    state.hull = Math.min(MAX_HULL, state.hull + 1);
    state.maxHull = MAX_HULL;
  } else if (id === 'split') {
    player.boltCount = Math.min(3, (player.boltCount ?? 1) + 1);
  } else if (id === 'magnet') {
    state.magnetAlways = true;
  }
}
