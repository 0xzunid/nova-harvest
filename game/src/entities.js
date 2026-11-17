// Every thing that flies: the harvester ship, its bolts, the three enemy
// kinds, starshards and power-ups. Each factory returns an object with
// update(dt, ctx) and draw(g) — the world owns the lists, entities own
// how they move and look. No entity touches the DOM, audio or input.

import { BOLT, ENEMY, FIELD, PALETTE, PLAYER, POWERUP, SHARD } from './config.js';
import { clamp } from './random.js';

// ---------------------------------------------------------------- player

export function createPlayer() {
  return {
    kind: 'player',
    x: 640,
    y: 600,
    vx: 0,
    vy: 0,
    radius: 26,
    tilt: 0, // banking angle, eased toward the horizontal velocity
    fireTimer: 0,
    invuln: 0,
    shield: false,
    trailTimer: 0,
    alive: true,
    fireRateMul: 1, // RAPID CYCLER upgrades multiply this down
    boltCount: 1, // SPLIT BOLTS upgrades raise this to 3
  };
}

/**
 * Move the ship. Keyboard gives a velocity; the mouse gives a target the ship
 * chases smoothly. `spawnTrail` is called with the engine position each tick
 * so the world can add exhaust particles.
 */
export function updatePlayer(player, dt, move, spawnTrail) {
  const speed = PLAYER.keyboardSpeed;
  let targetVx = move.x * speed;
  let targetVy = move.y * speed;
  if (move.mouse) {
    const dx = move.mouse.x - player.x;
    const dy = move.mouse.y - player.y;
    targetVx = clamp(dx * PLAYER.mouseFollow, -speed, speed);
    targetVy = clamp(dy * PLAYER.mouseFollow, -speed, speed);
    // Close enough to the cursor: stop instead of orbiting it.
    if (Math.abs(dx) < 4) targetVx = 0;
    if (Math.abs(dy) < 4) targetVy = 0;
  }
  // Ease toward the target velocity: snappy, but never teleporting.
  player.vx += (targetVx - player.vx) * Math.min(1, dt * 18);
  player.vy += (targetVy - player.vy) * Math.min(1, dt * 18);
  player.x = clamp(player.x + player.vx * dt, 28, FIELD.width - 28);
  player.y = clamp(player.y + player.vy * dt, 70, FIELD.height - 30);
  player.tilt += (clamp(player.vx / speed, -1, 1) * 0.38 - player.tilt) * Math.min(1, dt * 10);
  if (player.invuln > 0) player.invuln -= dt;
  if (player.fireTimer > 0) player.fireTimer -= dt;
  player.trailTimer -= dt;
  if (player.trailTimer <= 0) {
    player.trailTimer = 0.016;
    spawnTrail(player.x, player.y + 20, -player.vy * 0.25);
  }
}

export function drawPlayer(g, player, time) {
  g.save();
  g.translate(player.x, player.y);
  g.scale(1.2, 1.2); // the hull art is drawn at fixed size; the scale is the 1.25x ship
  // Blink while invulnerable: the ship is there, but untouchable.
  if (player.invuln > 0 && Math.floor(time * 14) % 2 === 0) g.globalAlpha = 0.35;
  g.rotate(player.tilt);

  // Engine glow.
  const flame = 14 + Math.sin(time * 31) * 4 + Math.abs(player.vy) * 0.012;
  g.shadowColor = PALETTE.cyan;
  g.shadowBlur = 18;
  const grad = g.createLinearGradient(0, 12, 0, 12 + flame);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.4, PALETTE.cyan);
  grad.addColorStop(1, 'rgba(53, 240, 255, 0)');
  g.fillStyle = grad;
  g.beginPath();
  g.moveTo(-7, 12);
  g.lineTo(0, 12 + flame);
  g.lineTo(7, 12);
  g.closePath();
  g.fill();

  // Hull: a sleek dart with swept wings.
  g.shadowBlur = 22;
  const hull = g.createLinearGradient(0, -26, 0, 16);
  hull.addColorStop(0, '#eafcff');
  hull.addColorStop(0.45, PALETTE.cyan);
  hull.addColorStop(1, '#0e7fa8');
  g.fillStyle = hull;
  g.beginPath();
  g.moveTo(0, -28);
  g.lineTo(7, -6);
  g.lineTo(26, 10);
  g.lineTo(12, 14);
  g.lineTo(5, 12);
  g.lineTo(0, 18);
  g.lineTo(-5, 12);
  g.lineTo(-12, 14);
  g.lineTo(-26, 10);
  g.lineTo(-7, -6);
  g.closePath();
  g.fill();
  g.shadowBlur = 0;

  // Cockpit.
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.ellipse(0, -10, 4.5, 9, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = PALETTE.magenta;
  g.beginPath();
  g.ellipse(0, -11, 2.2, 5.5, 0, 0, Math.PI * 2);
  g.fill();

  // Aegis shield ring.
  if (player.shield) {
    g.strokeStyle = PALETTE.gold;
    g.lineWidth = 2.5;
    g.shadowColor = PALETTE.gold;
    g.shadowBlur = 16;
    g.beginPath();
    g.arc(0, 0, 34 + Math.sin(time * 5) * 2, 0, Math.PI * 2);
    g.stroke();
  }
  g.restore();
}

// ---------------------------------------------------------------- bolts

export function createBolt(x, y, vx = 0) {
  return { kind: 'bolt', x, y, vx, vy: -BOLT.speed, radius: BOLT.radius, alive: true };
}

export function updateBolt(bolt, dt) {
  bolt.x += bolt.vx * dt;
  bolt.y += bolt.vy * dt;
  if (bolt.y < -30 || bolt.x < -30 || bolt.x > FIELD.width + 30) bolt.alive = false;
}

export function drawBolt(g, bolt) {
  g.save();
  g.translate(bolt.x, bolt.y);
  g.shadowColor = PALETTE.cyan;
  g.shadowBlur = 14;
  const grad = g.createLinearGradient(0, -BOLT.length, 0, 6);
  grad.addColorStop(0, 'rgba(53, 240, 255, 0)');
  grad.addColorStop(0.55, PALETTE.cyan);
  grad.addColorStop(1, '#ffffff');
  g.fillStyle = grad;
  g.beginPath();
  g.roundRect(-3, -BOLT.length, 6, BOLT.length + 6, 3);
  g.fill();
  g.restore();
}

// ---------------------------------------------------------------- enemies

function baseEnemy(kind, x, y, wave, rng) {
  const spec = ENEMY[kind];
  return {
    kind,
    x,
    y,
    vx: 0,
    vy: spec.baseSpeed + spec.speedPerWave * (wave - 1) + rng.range(-12, 12),
    radius: spec.radius,
    hp: spec.hp,
    maxHp: spec.hp,
    points: spec.points,
    phase: rng.range(0, Math.PI * 2),
    wobble: rng.range(24, 52),
    freq: rng.range(1.2, 2.2),
    alive: true,
    flash: 0, // white flash timer after a hit
  };
}

export function createMite(x, y, wave, rng) {
  return baseEnemy('mite', x, y, wave, rng);
}

export function createWeaver(x, y, wave, rng) {
  const e = baseEnemy('weaver', x, y, wave, rng);
  e.wobble = rng.range(90, 150);
  e.freq = rng.range(0.9, 1.4);
  return e;
}

export function createBulwark(x, y, wave, rng) {
  const e = baseEnemy('bulwark', x, y, wave, rng);
  e.wobble = 12;
  return e;
}

export function updateEnemy(e, dt, time) {
  if (e.flash > 0) e.flash -= dt;
  e.y += e.vy * dt;
  // Sine drift: mites wobble gently, weavers sweep wide, bulwarks barely sway.
  e.x += Math.cos(time * e.freq + e.phase) * e.wobble * dt * 2.2;
  e.x = clamp(e.x, e.radius, FIELD.width - e.radius);
  if (e.y > FIELD.height + 60) e.alive = false;
}

function drawSpikes(g, radius, spikes, color) {
  g.fillStyle = color;
  g.beginPath();
  for (let i = 0; i < spikes; i += 1) {
    const a = (i / spikes) * Math.PI * 2;
    const a2 = ((i + 0.5) / spikes) * Math.PI * 2;
    g.lineTo(Math.cos(a) * radius, Math.sin(a) * radius);
    g.lineTo(Math.cos(a2) * radius * 0.55, Math.sin(a2) * radius * 0.55);
  }
  g.closePath();
  g.fill();
}

export function drawEnemy(g, e, time) {
  g.save();
  g.translate(e.x, e.y);
  const flash = e.flash > 0;
  if (e.kind === 'mite') {
    g.rotate(Math.sin(time * 2 + e.phase) * 0.25);
    g.shadowColor = PALETTE.magenta;
    g.shadowBlur = 16;
    drawSpikes(g, e.radius, 8, flash ? '#ffffff' : '#c2187a');
    g.shadowBlur = 0;
    g.fillStyle = flash ? '#ffffff' : PALETTE.magenta;
    g.beginPath();
    g.arc(0, 0, e.radius * 0.62, 0, Math.PI * 2);
    g.fill();
    // Eyes: two hot dots tracking the player below.
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.arc(-6, 4, 3, 0, Math.PI * 2);
    g.arc(6, 4, 3, 0, Math.PI * 2);
    g.fill();
  } else if (e.kind === 'weaver') {
    // Weaver: a swept-wing dart — nothing like the mite's spiky ball or the
    // bulwark's hexagon. Wide wings, narrow spine, violet with a hot core.
    g.rotate(Math.sin(time * 1.6 + e.phase) * 0.5);
    g.shadowColor = PALETTE.violet;
    g.shadowBlur = 18;
    g.fillStyle = flash ? '#ffffff' : '#7c4dff';
    g.beginPath();
    g.moveTo(0, -e.radius);
    g.lineTo(e.radius * 0.55, -e.radius * 0.1);
    g.lineTo(e.radius * 1.1, e.radius * 0.7);
    g.lineTo(e.radius * 0.38, e.radius * 0.42);
    g.lineTo(0, e.radius * 0.78);
    g.lineTo(-e.radius * 0.38, e.radius * 0.42);
    g.lineTo(-e.radius * 1.1, e.radius * 0.7);
    g.lineTo(-e.radius * 0.55, -e.radius * 0.1);
    g.closePath();
    g.fill();
    g.shadowBlur = 0;
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.arc(0, -2, 4.5, 0, Math.PI * 2);
    g.fill();
  } else {
    // Bulwark: armoured hexagon with a glowing core and a health ring.
    g.rotate(Math.sin(time * 0.7 + e.phase) * 0.08);
    g.shadowColor = PALETTE.red;
    g.shadowBlur = 20;
    g.fillStyle = flash ? '#ffffff' : '#5a1f2e';
    g.beginPath();
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
      const px = Math.cos(a) * e.radius;
      const py = Math.sin(a) * e.radius;
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.closePath();
    g.fill();
    g.shadowBlur = 0;
    g.strokeStyle = PALETTE.red;
    g.lineWidth = 3;
    g.stroke();
    g.fillStyle = flash ? '#ffffff' : PALETTE.red;
    g.beginPath();
    g.arc(0, 0, 11 + Math.sin(time * 6) * 2, 0, Math.PI * 2);
    g.fill();
    // Health pips above the shell.
    for (let i = 0; i < e.maxHp; i += 1) {
      g.fillStyle = i < e.hp ? PALETTE.red : 'rgba(255,255,255,0.18)';
      g.beginPath();
      g.arc(-18 + i * 12, -e.radius - 12, 4, 0, Math.PI * 2);
      g.fill();
    }
  }
  g.restore();
}

// ---------------------------------------------------------------- shards

export function createShard(x, y, rng) {
  return {
    kind: 'shard',
    x,
    y,
    vx: 0,
    vy: SHARD.baseSpeed + rng.range(-20, 30),
    radius: SHARD.radius,
    phase: rng.range(0, Math.PI * 2),
    alive: true,
  };
}

export function updateShard(s, dt, time, player, magnet) {
  s.y += s.vy * dt;
  s.x += Math.sin(time * 2.4 + s.phase) * 18 * dt;
  if (magnet && player) {
    const dx = player.x - s.x;
    const dy = player.y - s.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < 260 * 260 && d2 > 1) {
      const d = Math.sqrt(d2);
      const pull = 620 * (1 - d / 260);
      s.x += (dx / d) * pull * dt;
      s.y += (dy / d) * pull * dt;
    }
  }
  if (s.y > FIELD.height + 30) s.alive = false;
}

export function drawShard(g, s, time) {
  g.save();
  g.translate(s.x, s.y);
  g.scale(1.15, 1.15); // shards read bigger beside the scaled-up ship
  const spin = Math.sin(time * 3 + s.phase) * 0.5;
  g.rotate(spin * 0.4);
  g.shadowColor = PALETTE.gold;
  g.shadowBlur = 16;
  const scale = 1 + Math.sin(time * 5 + s.phase) * 0.08;
  g.scale(scale, scale);
  // Four-point star.
  g.fillStyle = PALETTE.gold;
  g.beginPath();
  g.moveTo(0, -15);
  g.quadraticCurveTo(3.5, -3.5, 15, 0);
  g.quadraticCurveTo(3.5, 3.5, 0, 15);
  g.quadraticCurveTo(-3.5, 3.5, -15, 0);
  g.quadraticCurveTo(-3.5, -3.5, 0, -15);
  g.fill();
  g.shadowBlur = 0;
  g.fillStyle = '#fff8e0';
  g.beginPath();
  g.moveTo(0, -7);
  g.quadraticCurveTo(1.8, -1.8, 7, 0);
  g.quadraticCurveTo(1.8, 1.8, 0, 7);
  g.quadraticCurveTo(-1.8, 1.8, -7, 0);
  g.quadraticCurveTo(-1.8, -1.8, 0, -7);
  g.fill();
  g.restore();
}

// ---------------------------------------------------------------- power-ups

export const POWERUP_TYPES = ['aegis', 'magnet', 'overdrive'];

export function createPowerUp(x, y, type, rng) {
  return {
    kind: 'powerup',
    type: type || rng.pick(POWERUP_TYPES),
    x,
    y,
    vy: POWERUP.fallSpeed,
    radius: POWERUP.radius,
    phase: rng.range(0, Math.PI * 2),
    alive: true,
  };
}

export function updatePowerUp(p, dt) {
  p.y += p.vy * dt;
  if (p.y > FIELD.height + 30) p.alive = false;
}

const POWERUP_STYLE = {
  aegis: { color: PALETTE.gold, glyph: 'A', label: 'AEGIS' },
  magnet: { color: PALETTE.magenta, glyph: 'M', label: 'MAGNET' },
  overdrive: { color: PALETTE.cyan, glyph: 'O', label: 'OVERDRIVE' },
};

export function powerupStyle(type) {
  return POWERUP_STYLE[type] || POWERUP_STYLE.aegis;
}

export function drawPowerUp(g, p, time) {
  const style = powerupStyle(p.type);
  g.save();
  g.translate(p.x, p.y + Math.sin(time * 3 + p.phase) * 3);
  g.shadowColor = style.color;
  g.shadowBlur = 20;
  g.fillStyle = 'rgba(8, 12, 34, 0.9)';
  g.beginPath();
  g.arc(0, 0, POWERUP.radius, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = style.color;
  g.lineWidth = 2.5;
  g.stroke();
  g.shadowBlur = 0;
  g.fillStyle = style.color;
  g.font = 'bold 20px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(style.glyph, 0, 1);
  g.restore();
}
