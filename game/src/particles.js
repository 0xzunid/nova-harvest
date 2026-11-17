// Particles, floating score popups and screen shake. One pool, allocated
// once; dead particles are reused, nothing is allocated per frame in play.

import { FIELD, FONT, PALETTE } from './config.js';

const MAX_PARTICLES = 420;
const MAX_TEXTS = 24;

export function createParticles() {
  const pool = [];
  for (let i = 0; i < MAX_PARTICLES; i += 1) {
    pool.push({ alive: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 2, color: '#fff', drag: 0.98, gravity: 0 });
  }
  const texts = [];
  for (let i = 0; i < MAX_TEXTS; i += 1) {
    texts.push({ alive: false, x: 0, y: 0, vy: 0, life: 0, maxLife: 1, text: '', color: '#fff', size: 18 });
  }
  let shakeMag = 0;
  let shakeX = 0;
  let shakeY = 0;

  function spawn(x, y, vx, vy, life, size, color, drag = 0.96, gravity = 0) {
    for (let i = 0; i < MAX_PARTICLES; i += 1) {
      const p = pool[i];
      if (p.alive) continue;
      p.alive = true;
      p.x = x;
      p.y = y;
      p.vx = vx;
      p.vy = vy;
      p.life = life;
      p.maxLife = life;
      p.size = size;
      p.color = color;
      p.drag = drag;
      p.gravity = gravity;
      return;
    }
  }

  return {
    burst(x, y, color, count = 18, speed = 260) {
      for (let i = 0; i < count; i += 1) {
        const a = Math.random() * Math.PI * 2;
        const s = speed * (0.3 + Math.random() * 0.7);
        spawn(x, y, Math.cos(a) * s, Math.sin(a) * s, 0.4 + Math.random() * 0.5, 2 + Math.random() * 3.5, color);
      }
    },
    sparkle(x, y, color, count = 8) {
      for (let i = 0; i < count; i += 1) {
        const a = Math.random() * Math.PI * 2;
        const s = 40 + Math.random() * 120;
        spawn(x, y, Math.cos(a) * s, Math.sin(a) * s - 40, 0.35 + Math.random() * 0.35, 1.5 + Math.random() * 2, color, 0.94, -30);
      }
    },
    trail(x, y, vy = 0) {
      spawn(x + (Math.random() - 0.5) * 6, y, (Math.random() - 0.5) * 30, 90 + vy + Math.random() * 40, 0.3 + Math.random() * 0.2, 2 + Math.random() * 2.5, Math.random() < 0.5 ? PALETTE.cyan : '#7df9ff', 0.92);
    },
    addText(x, y, text, color = PALETTE.text, size = 18) {
      // Stack a new popup above any live one near the same spot, so a
      // burst of kills never prints its scores on top of each other.
      let sy = y;
      for (let i = 0; i < MAX_TEXTS; i += 1) {
        const t = texts[i];
        if (t.alive && Math.abs(t.x - x) < 70 && Math.abs(t.y - sy) < 26) sy -= 26;
      }
      for (let i = 0; i < MAX_TEXTS; i += 1) {
        const t = texts[i];
        if (t.alive) continue;
        t.alive = true;
        t.x = x;
        t.y = sy;
        t.vy = -46;
        t.life = 1.1;
        t.maxLife = 1.1;
        t.text = text;
        t.color = color;
        t.size = size;
        return;
      }
    },
    shake(amount) {
      shakeMag = Math.min(22, shakeMag + amount);
    },
    /** True while the screen is still shaking from a hit. */
    get shaking() {
      return shakeMag > 0.2;
    },
    update(dt) {
      for (let i = 0; i < MAX_PARTICLES; i += 1) {
        const p = pool[i];
        if (!p.alive) continue;
        p.life -= dt;
        if (p.life <= 0) {
          p.alive = false;
          continue;
        }
        p.vy += p.gravity * dt;
        p.vx *= p.drag;
        p.vy *= p.drag;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
      for (let i = 0; i < MAX_TEXTS; i += 1) {
        const t = texts[i];
        if (!t.alive) continue;
        t.life -= dt;
        if (t.life <= 0) {
          t.alive = false;
          continue;
        }
        t.y += t.vy * dt;
      }
      if (shakeMag > 0.2) {
        shakeX = (Math.random() - 0.5) * shakeMag;
        shakeY = (Math.random() - 0.5) * shakeMag;
        shakeMag *= Math.pow(0.001, dt); // fast exponential decay
      } else {
        shakeMag = 0;
        shakeX = 0;
        shakeY = 0;
      }
    },
    draw(g) {
      for (let i = 0; i < MAX_PARTICLES; i += 1) {
        const p = pool[i];
        if (!p.alive) continue;
        const alpha = Math.max(0, p.life / p.maxLife);
        g.globalAlpha = alpha;
        g.fillStyle = p.color;
        g.beginPath();
        g.arc(p.x, p.y, p.size * (0.5 + alpha * 0.5), 0, Math.PI * 2);
        g.fill();
      }
      g.globalAlpha = 1;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      for (let i = 0; i < MAX_TEXTS; i += 1) {
        const t = texts[i];
        if (!t.alive) continue;
        const alpha = Math.max(0, Math.min(1, t.life / (t.maxLife * 0.6)));
        g.globalAlpha = alpha;
        g.font = `bold ${t.size}px ${FONT}`;
        g.fillStyle = t.color;
        g.shadowColor = t.color;
        g.shadowBlur = 10;
        g.fillText(t.text, t.x, t.y);
      }
      g.globalAlpha = 1;
      g.shadowBlur = 0;
    },
    /** Current shake offset, applied by the renderer before drawing the world. */
    get shakeX() {
      return shakeX;
    },
    get shakeY() {
      return shakeY;
    },
    clear() {
      for (const p of pool) p.alive = false;
      for (const t of texts) t.alive = false;
      shakeMag = 0;
      shakeX = 0;
      shakeY = 0;
    },
    /** How many particles are live — handy for the shot scenes, never for rules. */
    get liveCount() {
      let n = 0;
      for (const p of pool) if (p.alive) n += 1;
      return n;
    },
  };
}
