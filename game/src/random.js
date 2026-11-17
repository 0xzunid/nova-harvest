// Seeded RNG (mulberry32) plus the small helpers the game needs.
// Same seed + same inputs = same game, which is what makes the screenshot
// scenes deterministic.

export function createRandom(seed) {
  let a = seed >>> 0;
  return {
    seed,
    next() {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    range(min, max) {
      return min + this.next() * (max - min);
    },
    int(min, max) {
      // Inclusive on both ends.
      return min + Math.floor(this.next() * (max - min + 1));
    },
    pick(list) {
      return list[Math.floor(this.next() * list.length)];
    },
    chance(p) {
      return this.next() < p;
    },
  };
}

/** Fisher–Yates shuffle driven by the seeded RNG, in place. */
export function shuffle(rng, list) {
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng.next() * (i + 1));
    const tmp = list[i];
    list[i] = list[j];
    list[j] = tmp;
  }
  return list;
}

export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

/** -1, 0 or 1 by sign; 0 stays 0. */
export function sign(value) {
  return value > 0 ? 1 : value < 0 ? -1 : 0;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}
