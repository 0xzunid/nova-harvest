// The screenshot scenes behind ?shot=start|play|clear|end&seed=N. The start
// and clear scenes play the real rules forward from a fresh world, steered
// by a simple autopilot (chase the nearest shard, sidestep anything diving
// at the ship, fire the whole time). The play scene stages a busy wave-4
// moment with the world's own staging helper — real entities, real state,
// painted through the exact render path normal play uses — then flies the
// autopilot briefly so bolts are in the air. The end scene plays a good
// opening, then takes the victory the same way the real wave-10 clear does.
// The same seed always gives the same frame.

import { FIELD, SCREEN, STEP } from './config.js';
import { EVENT_WAVE_CLEAR } from './world.js';
import { clamp } from './random.js';

const START_SECONDS = 3;
const PLAY_SECONDS = 1.2; // brief live flight after the wave-4 staging
const CLEAR_LIMIT_SECONDS = 45;
const END_PLAY_SECONDS = 40; // a strong real opening before the staged win

/** Fake input the world can step against: mouse target + always firing. */
function makePilotInput() {
  const pilot = {
    targetX: FIELD.width / 2,
    targetY: 580,
    firing: true,
    axis() {
      return { x: 0, y: 0 };
    },
    get hasMouse() {
      return true;
    },
    get mouseX() {
      return pilot.targetX;
    },
    get mouseY() {
      return pilot.targetY;
    },
  };
  return pilot;
}

/**
 * Steer the ship: dodge the closest enemy diving at it, else chase the
 * nearest shard, else hold the centre. `reckless` ignores every threat.
 */
function autopilot(state, pilot, reckless) {
  const player = state.player;
  let threat = null;
  let threatGap = Infinity;
  if (!reckless) {
    for (const e of state.enemies) {
      if (!e.alive) continue;
      const dx = e.x - player.x;
      const dy = player.y - e.y;
      if (dy > -40 && dy < 260 && Math.abs(dx) < 90) {
        const gap = Math.abs(dx) + dy * 0.2;
        if (gap < threatGap) {
          threatGap = gap;
          threat = e;
        }
      }
    }
  }
  if (threat) {
    const away = player.x < threat.x ? -1 : 1;
    pilot.targetX = clamp(player.x + away * 220, 40, FIELD.width - 40);
    pilot.targetY = 580;
    return;
  }
  let shard = null;
  let shardD2 = Infinity;
  for (const s of state.shards) {
    if (!s.alive) continue;
    const dx = s.x - player.x;
    const dy = s.y - player.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < shardD2) {
      shardD2 = d2;
      shard = s;
    }
  }
  if (shard) {
    pilot.targetX = clamp(shard.x, 40, FIELD.width - 40);
    pilot.targetY = clamp(shard.y, 120, 620);
    return;
  }
  pilot.targetX = FIELD.width / 2;
  pilot.targetY = 580;
}

function runSteps(world, pilot, seconds, reckless, stopOn) {
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    autopilot(world.state, pilot, reckless);
    const events = world.step(STEP, pilot);
    if (stopOn && (events & stopOn)) return events;
    if (world.state.screen === SCREEN.GAME_OVER) return EVENT_OVER;
  }
  return 0;
}

/**
 * Set `world` to the named scene (start, play, clear or end; any other name
 * is start) and return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  const pilot = makePilotInput();
  if (name === 'play') {
    // Wave 4, mid-fight: a bulwark, weavers and mites already in the
    // field, shards and a power-up on screen, combo x6, split bolts
    // flying — the game at its busiest, not an empty first wave.
    world.stageBusyWave(4);
    runSteps(world, pilot, PLAY_SECONDS, false, 0);
    const over = world.state.screen === SCREEN.GAME_OVER;
    return { screen: over ? SCREEN.GAME_OVER : SCREEN.PLAYING, best: world.state.best };
  }
  if (name === 'clear') {
    world.reset();
    world.startGame();
    runSteps(world, pilot, CLEAR_LIMIT_SECONDS, false, EVENT_WAVE_CLEAR);
    if (world.state.screen !== SCREEN.UPGRADE) {
      // The pilot ran out of time: clear the wave by the book anyway, so
      // the frame is always the upgrade-choice screen.
      world.forceWaveClear();
    }
    return { screen: SCREEN.UPGRADE, best: world.state.best };
  }
  if (name === 'end') {
    world.reset();
    world.startGame();
    // Play a strong opening for real — clear wave 1, take the first
    // upgrade on offer, keep flying — then the nova is restored the way
    // clearing wave 10 restores it. The score is really earned.
    const steps = Math.floor(END_PLAY_SECONDS / STEP);
    for (let i = 0; i < steps; i += 1) {
      autopilot(world.state, pilot, false);
      world.step(STEP, pilot);
      if (world.state.screen === SCREEN.UPGRADE) world.chooseUpgrade(0);
      if (world.state.screen === SCREEN.GAME_OVER) break;
    }
    world.forceVictory();
    return { screen: SCREEN.VICTORY, best: world.state.best };
  }
  // start (default): title screen, drifting shards behind it.
  world.reset();
  const idle = { axis: () => ({ x: 0, y: 0 }), hasMouse: false, mouseX: 0, mouseY: 0, firing: false };
  for (let i = 0; i < Math.floor(START_SECONDS / STEP); i += 1) world.step(STEP, idle);
  return { screen: SCREEN.TITLE, best: world.state.best };
}
