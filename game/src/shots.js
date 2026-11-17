// The screenshot scenes behind ?shot=start|play|clear|end&seed=N. Each one
// plays the real rules forward from a fresh world, steered by a simple
// autopilot (chase the nearest shard, sidestep anything diving at the ship,
// fire the whole time), so the frame is what a short game really looks like
// and the same seed always gives the same frame. Painted through the exact
// render path normal play uses.

import { FIELD, SCREEN, STEP } from './config.js';
import { EVENT_OVER, EVENT_WAVE_CLEAR } from './world.js';
import { clamp } from './random.js';

const START_SECONDS = 3;
const PLAY_SECONDS = 4.5; // ~4 s of live play, per the bounty spec — long enough to be mid-action
const CLEAR_LIMIT_SECONDS = 45;
const END_GOOD_SECONDS = 8;
const END_LIMIT_SECONDS = 90;

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
    world.reset();
    world.startGame();
    runSteps(world, pilot, PLAY_SECONDS, false, 0);
    const over = world.state.screen === SCREEN.GAME_OVER;
    return { screen: over ? SCREEN.GAME_OVER : SCREEN.PLAYING, best: world.state.best };
  }
  if (name === 'clear') {
    world.reset();
    world.startGame();
    runSteps(world, pilot, CLEAR_LIMIT_SECONDS, false, EVENT_WAVE_CLEAR);
    if (world.state.screen !== SCREEN.WAVE_CLEAR) {
      // The pilot ran out of time: clear the wave by the book anyway, so the
      // banner frame is always the wave-clear banner.
      world.forceWaveClear();
    }
    return { screen: SCREEN.WAVE_CLEAR, best: world.state.best };
  }
  if (name === 'end') {
    world.reset();
    world.startGame();
    // A good opening builds a plausible score, then the pilot stops dodging
    // and stops firing, so the mites catch the ship like they would a
    // hurried player.
    runSteps(world, pilot, END_GOOD_SECONDS, false, 0);
    pilot.firing = false;
    runSteps(world, pilot, END_LIMIT_SECONDS, true, EVENT_OVER);
    if (world.state.screen !== SCREEN.GAME_OVER) world.forceGameOver();
    return { screen: SCREEN.GAME_OVER, best: world.state.best };
  }
  // start (default): title screen, drifting shards behind it.
  world.reset();
  const idle = { axis: () => ({ x: 0, y: 0 }), hasMouse: false, mouseX: 0, mouseY: 0, firing: false };
  for (let i = 0; i < Math.floor(START_SECONDS / STEP); i += 1) world.step(STEP, idle);
  return { screen: SCREEN.TITLE, best: world.state.best };
}
