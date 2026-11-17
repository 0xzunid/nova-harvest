// The game itself: state machine, wave spawner, scoring, combo, hull,
// power-up timers, collisions and the best score. The renderer only paints
// this state; main.js only feeds it input and a fixed dt.

import {
  BEST_KEY,
  BOLT,
  COMBO_MAX,
  COMBO_WINDOW,
  FIELD,
  FINAL_WAVE,
  LIVES,
  MAX_HULL,
  PALETTE,
  PLAYER,
  POOL,
  POWERUP,
  SCREEN,
  SHARD,
  WAVE,
} from './config.js';
import { createRandom, clamp, dist2, shuffle } from './random.js';
import { createAudio } from './audio.js';
import { createParticles } from './particles.js';
import { applyUpgrade, rollOffer } from './upgrades.js';
import {
  createBolt,
  createBulwark,
  createMite,
  createPlayer,
  createPowerUp,
  createShard,
  createWeaver,
  drawBolt,
  drawEnemy,
  drawPlayer,
  drawPowerUp,
  drawShard,
  powerupStyle,
  updateBolt,
  updateEnemy,
  updatePlayer,
  updatePowerUp,
  updateShard,
} from './entities.js';

export const EVENT_HIT = 1;
export const EVENT_OVER = 2;
export const EVENT_WAVE_CLEAR = 4;
export const EVENT_POWERUP = 8;

export { SCREEN };

export function createWorld(rng) {
  const audio = createAudio();
  const particles = createParticles();
  const player = createPlayer();

  const state = {
    screen: SCREEN.TITLE,
    time: 0,
    score: 0,
    best: 0,
    wave: 1,
    hull: LIVES,
    combo: 0, // chained pickups/kills since the last hit
    comboTimer: 0,
    multiplier: 1,
    waveBonus: 0,
    spawnQueue: [], // kinds waiting to be spawned this wave
    spawnTimer: 0,
    shardTimer: 0,
    magnetTimer: 0,
    overdriveTimer: 0,
    offer: null, // the 3 upgrades on offer after a cleared wave, else null
    upgrades: [], // ids of upgrades already picked this run
    magnetAlways: false, // SHARD MAGNET upgrade: shards always drift to Lumen
    maxHull: MAX_HULL,
    bolts: [],
    enemies: [],
    shards: [],
    powerups: [],
    player,
    particles,
    audio,
    titleDrift: 0, // decorative drift on the title screen
  };

  // Pre-allocate the pools once, at boot: no per-frame allocation in play.
  for (let i = 0; i < POOL.bolts; i += 1) state.bolts.push({ alive: false });
  for (let i = 0; i < POOL.enemies; i += 1) state.enemies.push({ alive: false });
  for (let i = 0; i < POOL.shards; i += 1) state.shards.push({ alive: false });
  for (let i = 0; i < POOL.powerups; i += 1) state.powerups.push({ alive: false });

  function readBest() {
    try {
      return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
    } catch {
      return 0;
    }
  }

  function saveBest(value) {
    try {
      window.localStorage.setItem(BEST_KEY, String(value));
    } catch {
      // Storage can be off (private windows): best then lasts this visit only.
    }
  }

  state.best = readBest();

  function alloc(list, fresh) {
    for (let i = 0; i < list.length; i += 1) {
      if (!list[i].alive) {
        Object.assign(list[i], fresh);
        list[i].alive = true;
        return list[i];
      }
    }
    return null; // pool full: the spawn is skipped, never an error
  }

  function buildWave(n) {
    const queue = [];
    const mites = WAVE.mitesBase + WAVE.mitesPerWave * n;
    for (let i = 0; i < mites; i += 1) queue.push('mite');
    if (n >= 2) {
      const weavers = WAVE.weaversPerWave + (n - 2);
      for (let i = 0; i < weavers; i += 1) queue.push('weaver');
    }
    if (n >= 4) {
      const bulwarks = Math.floor((n - 2) / WAVE.bulwarkEvery);
      for (let i = 0; i < bulwarks; i += 1) queue.push('bulwark');
    }
    shuffle(rng, queue);
    state.spawnQueue = queue;
    state.spawnTimer = 0.6;
  }

  function spawnInterval() {
    return Math.max(
      WAVE.minSpawnInterval,
      WAVE.spawnInterval * Math.pow(WAVE.spawnScale, state.wave - 1),
    );
  }

  function spawnEnemy(kind, y) {
    const x = rng.range(50, FIELD.width - 50);
    const sy = y === undefined ? -40 : y;
    let fresh = null;
    if (kind === 'mite') fresh = createMite(x, sy, state.wave, rng);
    else if (kind === 'weaver') fresh = createWeaver(x, sy, state.wave, rng);
    else fresh = createBulwark(x, sy, state.wave, rng);
    alloc(state.enemies, fresh);
  }

  function spawnShard(x, y) {
    const sx = x === undefined ? rng.range(40, FIELD.width - 40) : x;
    const sy = y === undefined ? -20 : y;
    alloc(state.shards, createShard(sx, sy, rng));
  }

  function addScore(base, x, y) {
    const overdrive = state.overdriveTimer > 0 ? 2 : 1;
    const gained = base * state.multiplier * overdrive;
    state.score += gained;
    if (x !== undefined) {
      particles.addText(x, y, `+${gained}`, state.multiplier > 1 ? PALETTE.gold : PALETTE.text, 16 + Math.min(10, state.multiplier * 2));
    }
    return gained;
  }

  function bumpCombo() {
    state.combo += 1;
    state.comboTimer = COMBO_WINDOW;
    state.multiplier = clamp(1 + Math.floor(state.combo / 3), 1, COMBO_MAX);
  }

  function resetCombo() {
    state.combo = 0;
    state.comboTimer = 0;
    state.multiplier = 1;
  }

  function fireBolt() {
    if (player.fireTimer > 0) return;
    player.fireTimer = (state.overdriveTimer > 0 ? PLAYER.overdriveCooldown : PLAYER.fireCooldown) * (player.fireRateMul ?? 1);
    // SPLIT BOLTS: extra bolts fan out from the nose.
    const n = player.boltCount ?? 1;
    for (let i = 0; i < n; i += 1) {
      const vx = (i - (n - 1) / 2) * 170;
      alloc(state.bolts, createBolt(player.x, player.y - 26, vx));
    }
    audio.shoot();
  }

  function dropLoot(e) {
    // Bulwarks always drop a power-up; everything else sometimes drops one,
    // and mites/weavers often leave a shard behind.
    if (e.kind === 'bulwark') {
      alloc(state.powerups, createPowerUp(e.x, e.y, undefined, rng));
    } else if (rng.chance(POWERUP.dropChance)) {
      alloc(state.powerups, createPowerUp(e.x, e.y, undefined, rng));
    } else if (rng.chance(0.35)) {
      spawnShard(clamp(e.x, 40, FIELD.width - 40), e.y);
    }
  }

  function killEnemy(e, byBolt) {
    e.alive = false;
    bumpCombo();
    addScore(e.points, e.x, e.y);
    const color = e.kind === 'bulwark' ? PALETTE.red : e.kind === 'weaver' ? PALETTE.violet : PALETTE.magenta;
    particles.burst(e.x, e.y, color, e.kind === 'bulwark' ? 42 : 20, e.kind === 'bulwark' ? 340 : 260);
    audio.explosion(e.kind === 'bulwark');
    dropLoot(e);
    return byBolt;
  }

  function takeHit(e) {
    if (player.invuln > 0) return 0;
    if (player.shield) {
      player.shield = false;
      player.invuln = 1.2;
      particles.burst(player.x, player.y, PALETTE.gold, 24, 300);
      particles.addText(player.x, player.y - 44, 'AEGIS HELD', PALETTE.gold, 20);
      audio.hit();
      resetCombo();
      return EVENT_HIT;
    }
    state.hull -= 1;
    player.invuln = PLAYER.invulnerableSeconds;
    particles.shake(14);
    particles.burst(player.x, player.y, PALETTE.red, 34, 320);
    audio.hit();
    resetCombo();
    if (state.hull <= 0) {
      player.alive = false;
      particles.burst(player.x, player.y, PALETTE.cyan, 70, 420);
      particles.burst(player.x, player.y, PALETTE.magenta, 40, 300);
      particles.shake(20);
      audio.explosion(true);
      audio.gameOver();
      state.screen = SCREEN.GAME_OVER;
      if (state.score > state.best) {
        state.best = state.score;
        saveBest(state.best);
      }
      return EVENT_HIT | EVENT_OVER;
    }
    return EVENT_HIT;
  }

  function startWave(n) {
    state.wave = n;
    buildWave(n);
  }

  function reset() {
    state.screen = SCREEN.TITLE;
    state.time = 0;
    state.score = 0;
    state.wave = 1;
    state.hull = LIVES;
    state.combo = 0;
    state.comboTimer = 0;
    state.multiplier = 1;
    state.waveBonus = 0;
    state.spawnQueue = [];
    state.spawnTimer = 0;
    state.shardTimer = 0;
    state.magnetTimer = 0;
    state.overdriveTimer = 0;
    state.offer = null;
    state.upgrades = [];
    state.magnetAlways = false;
    state.maxHull = MAX_HULL;
    for (const list of [state.bolts, state.enemies, state.shards, state.powerups]) {
      for (const item of list) item.alive = false;
    }
    Object.assign(player, createPlayer());
    player.alive = true;
    particles.clear();
  }

  function startGame() {
    reset();
    state.screen = SCREEN.PLAYING;
    startWave(1);
    audio.resume();
  }

  // -- per-frame updates -------------------------------------------------

  function stepTitle(dt) {
    state.time += dt;
    state.titleDrift += dt;
    // A few shards drift down behind the title, purely decorative.
    state.shardTimer -= dt;
    if (state.shardTimer <= 0) {
      state.shardTimer = 1.4;
      spawnShard();
    }
    for (const s of state.shards) {
      if (s.alive) updateShard(s, dt, state.time, null, false);
    }
    particles.update(dt);
  }

  function stepPlaying(dt, input) {
    state.time += dt;

    // Combo decay.
    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) resetCombo();
    }
    if (state.magnetTimer > 0) state.magnetTimer -= dt;
    if (state.overdriveTimer > 0) state.overdriveTimer -= dt;

    // Movement: keys win over the mouse when both are given.
    const keys = input.axis();
    const move = { x: keys.x, y: keys.y, mouse: null };
    if ((keys.x === 0 && keys.y === 0) && input.hasMouse) {
      move.mouse = { x: input.mouseX, y: input.mouseY };
    }
    updatePlayer(player, dt, move, (x, y, vy) => particles.trail(x, y, vy));
    if (input.firing) fireBolt();

    // Spawning.
    if (state.spawnQueue.length > 0) {
      state.spawnTimer -= dt;
      if (state.spawnTimer <= 0) {
        state.spawnTimer = spawnInterval();
        spawnEnemy(state.spawnQueue.shift());
      }
    }
    state.shardTimer -= dt;
    if (state.shardTimer <= 0) {
      state.shardTimer = SHARD.spawnInterval * rng.range(0.7, 1.3);
      spawnShard();
    }

    // Bolts.
    for (const b of state.bolts) if (b.alive) updateBolt(b, dt);

    // Enemies.
    for (const e of state.enemies) {
      if (e.alive) updateEnemy(e, dt, state.time);
    }

    // Shards + power-ups.
    const magnet = state.magnetTimer > 0 || state.magnetAlways;
    for (const s of state.shards) {
      if (s.alive) updateShard(s, dt, state.time, player, magnet);
    }
    for (const p of state.powerups) {
      if (p.alive) updatePowerUp(p, dt);
    }

    // Collisions: bolts vs enemies.
    for (const b of state.bolts) {
      if (!b.alive) continue;
      for (const e of state.enemies) {
        if (!e.alive) continue;
        const rr = e.radius + BOLT.radius;
        if (dist2(b.x, b.y, e.x, e.y) < rr * rr) {
          b.alive = false;
          e.hp -= 1;
          e.flash = 0.09;
          particles.sparkle(b.x, b.y, PALETTE.cyan, 4);
          if (e.hp <= 0) killEnemy(e, true);
          break;
        }
      }
    }

    // Collisions: player vs enemies. One hit per frame at most: the
    // invulnerability window (or the hull reaching zero) ends the check.
    let events = 0;
    if (player.alive && player.invuln <= 0) {
      for (const e of state.enemies) {
        if (!e.alive) continue;
        const rr = e.radius + player.radius - 6;
        if (dist2(player.x, player.y, e.x, e.y) < rr * rr) {
          // Ramming a mite destroys it too — the hit still costs a hull.
          if (e.kind === 'mite') killEnemy(e, false);
          events |= takeHit(e);
          break;
        }
      }
    }

    // Collisions: player vs shards.
    if (player.alive) {
      for (const s of state.shards) {
        if (!s.alive) continue;
        const rr = s.radius + player.radius + 8;
        if (dist2(player.x, player.y, s.x, s.y) < rr * rr) {
          s.alive = false;
          bumpCombo();
          addScore(SHARD.points, s.x, s.y);
          particles.sparkle(s.x, s.y, PALETTE.gold, 10);
          audio.pickup(state.combo);
        }
      }
    }

    // Collisions: player vs power-ups.
    if (player.alive) {
      for (const p of state.powerups) {
        if (!p.alive) continue;
        const rr = p.radius + player.radius + 6;
        if (dist2(player.x, player.y, p.x, p.y) < rr * rr) {
          p.alive = false;
          const style = powerupStyle(p.type);
          if (p.type === 'aegis') player.shield = true;
          else if (p.type === 'magnet') state.magnetTimer = POWERUP.duration;
          else state.overdriveTimer = POWERUP.duration;
          particles.addText(player.x, player.y - 44, style.label, style.color, 22);
          particles.burst(player.x, player.y, style.color, 22, 280);
          audio.powerup();
          events |= EVENT_POWERUP;
        }
      }
    }

    particles.update(dt);

    // Wave clear: queue empty and nothing left alive.
    if (state.screen === SCREEN.PLAYING && state.spawnQueue.length === 0) {
      let anyAlive = false;
      for (const e of state.enemies) if (e.alive) { anyAlive = true; break; }
      if (!anyAlive) {
        state.waveBonus = WAVE.clearBonusPerWave * state.wave;
        state.score += state.waveBonus;
        audio.fanfare();
        if (state.wave >= FINAL_WAVE) {
          // The win: all ten waves cleared, the nova is restored.
          // The field clears with it — a clean frame for the victory screen.
          particles.clear();
          state.screen = SCREEN.VICTORY;
          if (state.score > state.best) {
            state.best = state.score;
            saveBest(state.best);
          }
          return events | EVENT_WAVE_CLEAR;
        }
        // Between waves the pilot picks 1 of 3 upgrades, then the next
        // wave starts. The choice is the run's build, wave by wave.
        state.offer = rollOffer(rng, state);
        state.screen = SCREEN.UPGRADE;
        return events | EVENT_WAVE_CLEAR;
      }
    }
    return events;
  }

  /** Take one of the offered upgrades (index 0-2) and start the next wave. */
  function chooseUpgrade(index) {
    if (state.screen !== SCREEN.UPGRADE || !state.offer) return;
    const picked = state.offer[index];
    if (!picked) return;
    applyUpgrade(state, picked.id);
    state.offer = null;
    state.screen = SCREEN.PLAYING;
    startWave(state.wave + 1);
  }

  function step(dt, input) {
    if (state.screen === SCREEN.TITLE) {
      stepTitle(dt);
      return 0;
    }
    if (state.screen === SCREEN.PLAYING) return stepPlaying(dt, input);
    // PAUSED, UPGRADE, VICTORY and GAME_OVER: particles settle, nothing else moves.
    particles.update(dt);
    return 0;
  }

  // -- drawing passthrough (the renderer calls these so entities stay in one file)
  function drawEntities(g) {
    for (const s of state.shards) if (s.alive) drawShard(g, s, state.time);
    for (const p of state.powerups) if (p.alive) drawPowerUp(g, p, state.time);
    for (const e of state.enemies) if (e.alive) drawEnemy(g, e, state.time);
    for (const b of state.bolts) if (b.alive) drawBolt(g, b);
    if (player.alive && state.screen !== SCREEN.GAME_OVER) drawPlayer(g, player, state.time);
  }

  return {
    state,
    audio,
    particles,
    reset,
    startGame,
    step,
    drawEntities,
    startWave,
    spawnShard,
    chooseUpgrade,
    // Stage a busy mid-wave moment for the play screenshot: deal most of
    // the wave's spawns into the field at staggered depths, scatter shards
    // and a power-up, set a plausible score and combo, then fly the
    // autopilot briefly so bolts are in the air. All of it is real game
    // state painted through the normal render path.
    stageBusyWave(n) {
      reset();
      state.screen = SCREEN.PLAYING;
      state.wave = n;
      state.score = 1200 + n * 450;
      state.combo = 16;
      state.comboTimer = COMBO_WINDOW;
      state.multiplier = 6;
      state.hull = 3;
      // The staged pilot already picked two upgrades on earlier waves.
      applyUpgrade(state, 'rapid');
      applyUpgrade(state, 'split');
      buildWave(n);
      // Guarantee the shot shows every enemy kind: one bulwark and two
      // weavers, placed where they read whole, then fill the field from
      // the shuffled queue.
      const take = (kind) => {
        const i = state.spawnQueue.indexOf(kind);
        if (i >= 0) state.spawnQueue.splice(i, 1);
      };
      take('bulwark');
      spawnEnemy('bulwark', rng.range(200, 400));
      take('weaver');
      spawnEnemy('weaver', rng.range(150, 500));
      take('weaver');
      spawnEnemy('weaver', rng.range(150, 500));
      const pre = Math.floor(state.spawnQueue.length * 0.6);
      for (let i = 0; i < pre; i += 1) {
        const kind = state.spawnQueue.shift();
        spawnEnemy(kind, rng.range(90, 330));
      }
      for (let i = 0; i < 7; i += 1) {
        spawnShard(rng.range(60, FIELD.width - 60), rng.range(110, 420));
      }
      alloc(state.powerups, createPowerUp(rng.range(300, 980), 200, 'magnet', rng));
    },
    // Test/shot helpers: force a wave-clear or game-over state without playing.
    forceWaveClear() {
      for (const e of state.enemies) e.alive = false;
      state.spawnQueue = [];
      state.waveBonus = WAVE.clearBonusPerWave * state.wave;
      state.score += state.waveBonus;
      state.offer = rollOffer(rng, state);
      state.screen = SCREEN.UPGRADE;
    },
    forceVictory() {
      for (const e of state.enemies) e.alive = false;
      state.spawnQueue = [];
      state.wave = FINAL_WAVE;
      particles.clear();
      state.screen = SCREEN.VICTORY;
      if (state.score > state.best) {
        state.best = state.score;
        saveBest(state.best);
      }
    },
    forceGameOver() {
      state.hull = 0;
      player.alive = false;
      state.screen = SCREEN.GAME_OVER;
      if (state.score > state.best) {
        state.best = state.score;
        saveBest(state.best);
      }
    },
    get rng() {
      return rng;
    },
  };
}

export function createWorldWithSeed(seed) {
  return createWorld(createRandom(seed));
}
