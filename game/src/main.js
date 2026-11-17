// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. The game moves between six screens: title,
// play, paused, upgrade, victory and game over.
//
// ?shot=start|play|clear|end (with &seed=N) stages that scene instead of
// running the loop, paints it twice and sets window.__shotReady for a
// screenshot. ?seed=N fixes the spawn pattern for normal play too.

import { SCREEN, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld } from './world.js';
import {
  ACTION_CHOICE_1,
  ACTION_CHOICE_2,
  ACTION_CHOICE_3,
  ACTION_CLICK,
  ACTION_CONFIRM,
  ACTION_MUTE,
  ACTION_PAUSE,
  ACTION_RESTART,
  createInput,
} from './input.js';
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
    // The upgrade screen owns its keys: 1/2/3 pick a card, a click on a
    // card picks it. Nothing else on this screen restarts the run.
    if (screen === SCREEN.UPGRADE) {
      if (actions & ACTION_CHOICE_1) { world.chooseUpgrade(0); return; }
      if (actions & ACTION_CHOICE_2) { world.chooseUpgrade(1); return; }
      if (actions & ACTION_CHOICE_3) { world.chooseUpgrade(2); return; }
      if (actions & ACTION_CLICK && input.mouseX !== null && input.mouseY !== null) {
        const rects = renderer.upgradeCardRects();
        const hit = rects.findIndex((r) =>
          input.mouseX >= r.x && input.mouseX <= r.x + r.w &&
          input.mouseY >= r.y && input.mouseY <= r.y + r.h);
        if (hit >= 0) { world.chooseUpgrade(hit); return; }
      }
      return;
    }
    if (actions & ACTION_RESTART && screen !== SCREEN.TITLE) {
      startGame();
      return;
    }
    if (actions & ACTION_CONFIRM && (screen === SCREEN.TITLE || screen === SCREEN.GAME_OVER || screen === SCREEN.VICTORY)) {
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
    // PAUSED freezes the simulation; TITLE / PLAYING / UPGRADE / VICTORY /
    // GAME_OVER all advance (the last three only settle particles).
    let prevScreen = world.state.screen;
    while (accumulator >= STEP) {
      const screen = world.state.screen;
      if (screen === SCREEN.PAUSED) break;
      world.step(STEP, input);
      accumulator -= STEP;
      if (world.state.screen === SCREEN.GAME_OVER && prevScreen !== SCREEN.GAME_OVER) {
        announce(`Game over. Score ${world.state.score}. Best ${world.state.best}.`);
      }
      if (world.state.screen === SCREEN.VICTORY && prevScreen !== SCREEN.VICTORY) {
        announce(`Nova restored! Final score ${world.state.score}. Best ${world.state.best}.`);
      }
      if (world.state.screen === SCREEN.UPGRADE && prevScreen !== SCREEN.UPGRADE) {
        announce(`Wave ${world.state.wave} cleared. Choose an upgrade: press 1, 2 or 3.`);
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
