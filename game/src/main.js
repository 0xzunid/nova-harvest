// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. The game moves between five screens: title,
// play, paused, wave-clear and game over.
//
// ?shot=start|play|clear|end (with &seed=N) stages that scene instead of
// running the loop, paints it twice and sets window.__shotReady for a
// screenshot. ?seed=N fixes the spawn pattern for normal play too.

import { SCREEN, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld } from './world.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, ACTION_RESTART, createInput } from './input.js';
import { createRenderer } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);

function draw() {
  renderer.draw(world.state, world.state.screen, world.state.best, (g) => world.drawEntities(g));
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, (g) => world.drawEntities(g));
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let muted = false;
  let accumulator = 0;
  let last = performance.now();

  // Screen readers (and anyone watching the page's text) hear screen changes.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.startGame();
    accumulator = 0;
    announce(`Playing. Wave 1. ${world.state.hull} hull.`);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      muted = world.audio.setMuted(!muted);
      announce(muted ? 'Muted.' : 'Sound on.');
    }
    const screen = world.state.screen;
    if (actions & ACTION_RESTART && screen !== SCREEN.TITLE) {
      startGame();
      return;
    }
    if (actions & ACTION_CONFIRM && (screen === SCREEN.TITLE || screen === SCREEN.GAME_OVER)) {
      startGame();
      return;
    }
    if (actions & ACTION_PAUSE && screen === SCREEN.PLAYING) {
      world.state.screen = SCREEN.PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN.PAUSED) {
      world.state.screen = SCREEN.PLAYING;
      announce('Playing.');
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    // Step the world in fixed slices while it is on a screen that moves.
    // PAUSED freezes the simulation; TITLE / PLAYING / WAVE_CLEAR / GAME_OVER
    // all advance (the last two only settle particles and the banner timer).
    let prevScreen = world.state.screen;
    while (accumulator >= STEP) {
      const screen = world.state.screen;
      if (screen === SCREEN.PAUSED) break;
      world.step(STEP, input);
      accumulator -= STEP;
      if (world.state.screen === SCREEN.GAME_OVER && prevScreen !== SCREEN.GAME_OVER) {
        announce(`Game over. Score ${world.state.score}. Best ${world.state.best}.`);
      }
      prevScreen = world.state.screen;
    }
    if (world.state.screen === SCREEN.PAUSED) accumulator = 0;
    draw();
  }

  // Leaving the tab pauses a running game rather than letting mites fall unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && world.state.screen === SCREEN.PLAYING) {
      world.state.screen = SCREEN.PAUSED;
      announce('Paused.');
    }
  });

  announce('NOVA HARVEST. Press Enter or click to launch.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
