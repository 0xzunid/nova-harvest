// Everything on screen: the parallax space background, the world, the HUD
// and the four screens. The renderer never changes game state — it only
// paints what the world holds, so the screenshot scenes use this same path.

import { COMBO_WINDOW, FIELD, FONT, PALETTE, POWERUP, SCREEN } from './config.js';
import { createRandom } from './random.js';

export { SCREEN };

// Three star layers, far to near: slow, dim and many — fast, bright and few.
function makeStars(seed, count, sizeMin, sizeMax) {
  const rng = createRandom(seed);
  const stars = [];
  for (let i = 0; i < count; i += 1) {
    stars.push({
      x: rng.range(0, FIELD.width),
      y: rng.range(0, FIELD.height),
      r: rng.range(sizeMin, sizeMax),
      twinkle: rng.range(0, Math.PI * 2),
      speed: rng.range(0.4, 1),
    });
  }
  return stars;
}

// Nebula blobs: fixed positions, drawn as soft radial gradients.
const NEBULAE = [
  { x: 220, y: 150, r: 340, color: 'rgba(91, 42, 157, 0.55)' },
  { x: 1080, y: 120, r: 300, color: 'rgba(161, 32, 110, 0.42)' },
  { x: 980, y: 600, r: 360, color: 'rgba(14, 74, 110, 0.5)' },
  { x: 180, y: 620, r: 260, color: 'rgba(91, 42, 157, 0.38)' },
  { x: 640, y: 360, r: 420, color: 'rgba(40, 16, 90, 0.35)' },
];

export function createRenderer(canvas) {
  const g = canvas.getContext('2d');
  const layers = [
    { stars: makeStars(101, 110, 0.6, 1.4), speed: 6, alpha: 0.55 },
    { stars: makeStars(202, 70, 1.0, 2.0), speed: 16, alpha: 0.8 },
    { stars: makeStars(303, 36, 1.4, 2.8), speed: 34, alpha: 1.0 },
  ];

  function drawBackground(state) {
    const grad = g.createLinearGradient(0, 0, 0, FIELD.height);
    grad.addColorStop(0, PALETTE.spaceTop);
    grad.addColorStop(1, PALETTE.spaceBottom);
    g.fillStyle = grad;
    g.fillRect(0, 0, FIELD.width, FIELD.height);

    // Nebulae drift almost imperceptibly with time.
    for (const n of NEBULAE) {
      const drift = Math.sin(state.time * 0.05 + n.x) * 12;
      const neb = g.createRadialGradient(n.x + drift, n.y, 0, n.x + drift, n.y, n.r);
      neb.addColorStop(0, n.color);
      neb.addColorStop(1, 'rgba(0, 0, 0, 0)');
      g.fillStyle = neb;
      g.fillRect(n.x - n.r, n.y - n.r, n.r * 2, n.r * 2);
    }

    // Parallax starfield: each layer scrolls down at its own speed and wraps.
    for (const layer of layers) {
      for (const s of layer.stars) {
        const y = (s.y + state.time * layer.speed * s.speed) % FIELD.height;
        const tw = 0.7 + 0.3 * Math.sin(state.time * 2 + s.twinkle);
        g.globalAlpha = layer.alpha * tw;
        g.fillStyle = '#dfeaff';
        g.beginPath();
        g.arc(s.x, y, s.r, 0, Math.PI * 2);
        g.fill();
      }
    }
    g.globalAlpha = 1;

    // Faint horizon glow at the bottom, where the ship lives.
    const horizon = g.createLinearGradient(0, FIELD.height - 140, 0, FIELD.height);
    horizon.addColorStop(0, 'rgba(53, 240, 255, 0)');
    horizon.addColorStop(1, 'rgba(53, 240, 255, 0.07)');
    g.fillStyle = horizon;
    g.fillRect(0, FIELD.height - 140, FIELD.width, 140);
  }

  function drawHullIcons(x, y, hull) {
    for (let i = 0; i < 3; i += 1) {
      const cx = x + i * 30;
      g.save();
      g.translate(cx, y);
      if (i < hull) {
        g.shadowColor = PALETTE.hull;
        g.shadowBlur = 10;
        g.fillStyle = PALETTE.hull;
      } else {
        g.fillStyle = 'rgba(255, 255, 255, 0.14)';
      }
      // Little ship silhouette = one hull.
      g.beginPath();
      g.moveTo(0, -9);
      g.lineTo(5, 4);
      g.lineTo(11, 8);
      g.lineTo(0, 6);
      g.lineTo(-11, 8);
      g.lineTo(-5, 4);
      g.closePath();
      g.fill();
      g.restore();
    }
  }

  function drawComboBar(state, x, y, width) {
    const frac = state.comboTimer > 0 ? state.comboTimer / COMBO_WINDOW : 0;
    g.save();
    g.fillStyle = 'rgba(255, 255, 255, 0.12)';
    g.beginPath();
    g.roundRect(x, y, width, 8, 4);
    g.fill();
    if (frac > 0) {
      const grad = g.createLinearGradient(x, 0, x + width, 0);
      grad.addColorStop(0, PALETTE.cyan);
      grad.addColorStop(1, PALETTE.magenta);
      g.fillStyle = grad;
      g.shadowColor = PALETTE.magenta;
      g.shadowBlur = 8;
      g.beginPath();
      g.roundRect(x, y, width * frac, 8, 4);
      g.fill();
    }
    g.restore();
  }

  function drawPowerTimers(state, x, y) {
    const active = [];
    if (state.player.shield) active.push({ label: 'AEGIS', color: PALETTE.gold, frac: 1 });
    if (state.magnetTimer > 0) active.push({ label: 'MAGNET', color: PALETTE.magenta, frac: state.magnetTimer / POWERUP.duration });
    if (state.overdriveTimer > 0) active.push({ label: 'OVERDRIVE x2', color: PALETTE.cyan, frac: state.overdriveTimer / POWERUP.duration });
    g.save();
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    active.forEach((p, i) => {
      const py = y + i * 26;
      g.font = `bold 15px ${FONT}`;
      g.fillStyle = p.color;
      g.shadowColor = p.color;
      g.shadowBlur = 8;
      g.fillText(p.label, x, py);
      g.shadowBlur = 0;
      g.fillStyle = 'rgba(255, 255, 255, 0.14)';
      g.beginPath();
      g.roundRect(x + 118, py - 4, 90, 8, 4);
      g.fill();
      g.fillStyle = p.color;
      g.beginPath();
      g.roundRect(x + 118, py - 4, 90 * Math.max(0, p.frac), 8, 4);
      g.fill();
    });
    g.restore();
  }

  function drawHUD(state) {
    g.save();
    // Top-left: score.
    g.textAlign = 'left';
    g.textBaseline = 'alphabetic';
    g.fillStyle = PALETTE.muted;
    g.font = `600 14px ${FONT}`;
    g.fillText('SCORE', 28, 36);
    g.fillStyle = PALETTE.text;
    g.font = `bold 34px ${FONT}`;
    g.shadowColor = PALETTE.cyan;
    g.shadowBlur = 12;
    g.fillText(String(state.score), 28, 70);
    g.shadowBlur = 0;
    g.fillStyle = PALETTE.muted;
    g.font = `600 14px ${FONT}`;
    g.fillText(`BEST  ${state.best}`, 28, 94);

    // Top-centre: wave.
    g.textAlign = 'center';
    g.fillStyle = PALETTE.muted;
    g.font = `600 14px ${FONT}`;
    g.fillText('WAVE', FIELD.width / 2, 36);
    g.fillStyle = PALETTE.violet;
    g.font = `bold 30px ${FONT}`;
    g.shadowColor = PALETTE.violet;
    g.shadowBlur = 10;
    g.fillText(String(state.wave), FIELD.width / 2, 68);
    g.shadowBlur = 0;

    // Top-right: hull.
    g.textAlign = 'right';
    g.fillStyle = PALETTE.muted;
    g.font = `600 14px ${FONT}`;
    g.fillText('HULL', FIELD.width - 28, 36);
    drawHullIcons(FIELD.width - 28 - 60, 62, state.hull);

    // Combo, bottom-left — only while a streak is alive.
    if (state.combo > 0 && state.comboTimer > 0) {
      g.textAlign = 'left';
      g.fillStyle = state.multiplier >= 4 ? PALETTE.gold : PALETTE.magenta;
      g.font = `bold 30px ${FONT}`;
      g.shadowColor = g.fillStyle;
      g.shadowBlur = 12;
      g.fillText(`COMBO x${state.multiplier}`, 28, FIELD.height - 52);
      g.shadowBlur = 0;
      g.fillStyle = PALETTE.muted;
      g.font = `600 13px ${FONT}`;
      g.fillText(`${state.combo} chained`, 28, FIELD.height - 30);
      drawComboBar(state, 28, FIELD.height - 22, 150);
    }

    // Active power-ups, bottom-right.
    drawPowerTimers(state, FIELD.width - 236, FIELD.height - 78);
    g.restore();
  }

  function dim() {
    g.fillStyle = 'rgba(4, 6, 18, 0.62)';
    g.fillRect(0, 0, FIELD.width, FIELD.height);
  }

  function panel(x, y, w, h) {
    g.fillStyle = PALETTE.panel;
    g.strokeStyle = 'rgba(53, 240, 255, 0.35)';
    g.lineWidth = 1.5;
    g.beginPath();
    g.roundRect(x, y, w, h, 18);
    g.fill();
    g.stroke();
  }

  function titleText(text, y, size, color, glow) {
    g.font = `bold ${size}px ${FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = color;
    if (glow) {
      g.shadowColor = glow;
      g.shadowBlur = 26;
    }
    g.fillText(text, FIELD.width / 2, y);
    g.shadowBlur = 0;
  }

  function drawTitle(state, best) {
    dim();
    // Logo glow behind the name.
    const glow = g.createRadialGradient(640, 218, 0, 640, 218, 260);
    glow.addColorStop(0, 'rgba(53, 240, 255, 0.16)');
    glow.addColorStop(1, 'rgba(53, 240, 255, 0)');
    g.fillStyle = glow;
    g.fillRect(380, 0, 520, 440);

    titleText('NOVA', 168, 92, PALETTE.cyan, PALETTE.cyan);
    titleText('HARVEST', 248, 92, PALETTE.magenta, PALETTE.magenta);
    g.font = `italic 600 26px ${FONT}`;
    g.textAlign = 'center';
    g.fillStyle = PALETTE.gold;
    g.shadowColor = PALETTE.gold;
    g.shadowBlur = 12;
    g.fillText('Harvest the dying light.', FIELD.width / 2, 322);
    g.shadowBlur = 0;

    panel(390, 368, 500, 168);
    g.textAlign = 'center';
    g.fillStyle = PALETTE.text;
    g.font = `600 19px ${FONT}`;
    g.fillText('Mouse or WASD / arrows — fly Lumen', FIELD.width / 2, 402);
    g.fillText('Space or click — fire bolts', FIELD.width / 2, 434);
    g.font = `600 16px ${FONT}`;
    g.fillText('Collect starshards · Blast void mites · Chain combos to x8', FIELD.width / 2, 466);
    g.fillStyle = PALETTE.muted;
    g.font = `600 16px ${FONT}`;
    g.fillText('P pause · M mute · R restart', FIELD.width / 2, 506);

    if (best > 0) {
      g.fillStyle = PALETTE.gold;
      g.font = `bold 20px ${FONT}`;
      g.fillText(`BEST  ${best}`, FIELD.width / 2, 576);
    }
    const pulse = 0.65 + 0.35 * Math.sin(state.time * 3.2);
    g.globalAlpha = pulse;
    g.fillStyle = PALETTE.text;
    g.font = `bold 24px ${FONT}`;
    g.fillText('press Enter / click to launch', FIELD.width / 2, 628);
    g.globalAlpha = 1;
  }

  function drawPaused() {
    dim();
    panel(440, 250, 400, 190);
    titleText('PAUSED', 308, 54, PALETTE.cyan, PALETTE.cyan);
    g.textAlign = 'center';
    g.fillStyle = PALETTE.text;
    g.font = `600 20px ${FONT}`;
    g.fillText('The void waits for no one.', FIELD.width / 2, 366);
    g.fillStyle = PALETTE.muted;
    g.font = `600 17px ${FONT}`;
    g.fillText('P or Enter — resume · R — restart', FIELD.width / 2, 400);
  }

  function drawWaveClear(state) {
    // Banner across the middle; the field keeps drifting behind it.
    g.save();
    g.fillStyle = 'rgba(4, 6, 18, 0.45)';
    g.fillRect(0, 252, FIELD.width, 150);
    g.strokeStyle = 'rgba(255, 209, 102, 0.6)';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(0, 252);
    g.lineTo(FIELD.width, 252);
    g.moveTo(0, 402);
    g.lineTo(FIELD.width, 402);
    g.stroke();
    titleText(`WAVE ${state.wave} CLEARED`, 306, 52, PALETTE.gold, PALETTE.gold);
    g.textAlign = 'center';
    g.fillStyle = PALETTE.text;
    g.font = `bold 24px ${FONT}`;
    g.fillText(`Wave bonus  +${state.waveBonus}`, FIELD.width / 2, 362);
    g.restore();
  }

  function drawGameOver(state) {
    dim();
    titleText('SIGNAL LOST', 190, 72, PALETTE.red, PALETTE.red);
    g.textAlign = 'center';
    g.fillStyle = PALETTE.muted;
    g.font = `italic 600 22px ${FONT}`;
    g.fillText('Lumen went dark among the shards.', FIELD.width / 2, 252);

    panel(430, 300, 420, 190);
    g.fillStyle = PALETTE.muted;
    g.font = `600 15px ${FONT}`;
    g.fillText('FINAL SCORE', FIELD.width / 2, 336);
    g.fillStyle = PALETTE.text;
    g.font = `bold 52px ${FONT}`;
    g.shadowColor = PALETTE.cyan;
    g.shadowBlur = 16;
    g.fillText(String(state.score), FIELD.width / 2, 388);
    g.shadowBlur = 0;
    g.fillStyle = state.score >= state.best && state.score > 0 ? PALETTE.gold : PALETTE.muted;
    g.font = `bold 20px ${FONT}`;
    const bestLine = state.score >= state.best && state.score > 0 ? `NEW BEST  ${state.best}` : `BEST  ${state.best}`;
    g.fillText(bestLine, FIELD.width / 2, 436);
    g.fillStyle = PALETTE.muted;
    g.font = `600 17px ${FONT}`;
    g.fillText(`Reached wave ${state.wave}`, FIELD.width / 2, 466);

    const pulse = 0.65 + 0.35 * Math.sin(state.time * 3.2);
    g.globalAlpha = pulse;
    g.fillStyle = PALETTE.text;
    g.font = `bold 24px ${FONT}`;
    g.fillText('press R to fly again', FIELD.width / 2, 560);
    g.globalAlpha = 1;
  }

  function draw(state, screen, best, drawWorld) {
    g.save();
    // Canvas is 1280x720 internally; CSS scales it to the window.
    g.setTransform(1, 0, 0, 1, 0, 0);
    drawBackground(state);
    // Screen shake offsets the world, never the HUD.
    const px = state.particles ? state.particles.shakeX : 0;
    const py = state.particles ? state.particles.shakeY : 0;
    g.translate(px, py);
    if (drawWorld) drawWorld(g);
    if (state.particles) state.particles.draw(g);
    g.restore();

    if (screen === SCREEN.PLAYING || screen === SCREEN.WAVE_CLEAR || screen === SCREEN.PAUSED) {
      drawHUD(state);
    }
    if (screen === SCREEN.TITLE) drawTitle(state, best);
    else if (screen === SCREEN.PAUSED) drawPaused();
    else if (screen === SCREEN.WAVE_CLEAR) drawWaveClear(state);
    else if (screen === SCREEN.GAME_OVER) drawGameOver(state);
  }

  return { draw };
}
