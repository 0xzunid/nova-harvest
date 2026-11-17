// NOVA HARVEST — every tuning number and colour in one place.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to
// the window, so no rule below depends on the screen size.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const SCREEN = {
  TITLE: 'title',
  PLAYING: 'playing',
  PAUSED: 'paused',
  UPGRADE: 'upgrade',
  VICTORY: 'victory',
  GAME_OVER: 'game-over',
};

/** Clear this many waves and the nova is restored: the win condition. */
export const FINAL_WAVE = 10;
/** The most hull the ship can carry (upgrades can raise it past the start). */
export const MAX_HULL = 5;

export const PLAYER = {
  radius: 26,
  keyboardSpeed: 540,
  mouseFollow: 14, // lerp rate toward the mouse, per second
  fireCooldown: 0.22,
  overdriveCooldown: 0.09,
  invulnerableSeconds: 2.0,
  startX: 640,
  startY: 600,
};

export const BOLT = { speed: 760, radius: 7, length: 30 };

export const LIVES = 3;
export const COMBO_WINDOW = 3.0; // seconds without a pickup/kill before the combo dies
export const COMBO_MAX = 8;

export const ENEMY = {
  mite: { radius: 24, hp: 1, baseSpeed: 95, speedPerWave: 9, points: 50 },
  weaver: { radius: 29, hp: 2, baseSpeed: 75, speedPerWave: 7, points: 100 },
  bulwark: { radius: 50, hp: 4, baseSpeed: 46, speedPerWave: 4, points: 250 },
};

export const SHARD = { radius: 15, baseSpeed: 120, points: 25, spawnInterval: 0.85 };

export const POWERUP = {
  radius: 21,
  fallSpeed: 90,
  duration: 8.0, // magnet + overdrive, in seconds; aegis lasts until it absorbs a hit
  dropChance: 0.08, // from mites / weavers (bulwarks always drop one)
};

export const WAVE = {
  mitesBase: 8,
  mitesPerWave: 3,
  weaversPerWave: 2, // from wave 2: 2 + (n - 2)
  bulwarkEvery: 2, // from wave 4: one bulwark per two waves
  spawnInterval: 0.7, // seconds between spawns on wave 1
  spawnScale: 0.9, // multiplied per wave
  minSpawnInterval: 0.26,
  clearBonusPerWave: 150,
};

/** How many of each thing can exist at once; pools are allocated once, at boot. */
export const POOL = { bolts: 48, enemies: 48, shards: 40, powerups: 8 };

export const PALETTE = {
  spaceTop: '#070a24',
  spaceBottom: '#12082e',
  nebulaViolet: '#5b2a9d',
  nebulaMagenta: '#a1206e',
  nebulaTeal: '#0e4a6e',
  cyan: '#35f0ff',
  magenta: '#ff4fd8',
  gold: '#ffd166',
  violet: '#a78bfa',
  green: '#5cff9d',
  red: '#ff5a6e',
  hull: '#ff6b81',
  text: '#eef4ff',
  muted: '#9aa7c7',
  panel: 'rgba(10, 14, 38, 0.72)',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'nova-harvest.best';
