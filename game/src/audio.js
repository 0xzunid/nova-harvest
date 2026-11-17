// WebAudio synthesized sounds only — no audio files, no network.
// Every method is guarded: if there is no AudioContext (old browser, or no
// user gesture yet) the call is a silent no-op and never throws.

const DRONE_FREQ = 55; // low A, the quiet ambient hum under everything

export function createAudio() {
  let ctx = null;
  let master = null;
  let droneNodes = null;
  let muted = false;

  function ensureContext() {
    if (ctx) return ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.35;
      master.connect(ctx.destination);
    } catch {
      ctx = null;
    }
    return ctx;
  }

  /** Call from a user gesture (start / click) so the context is allowed to run. */
  function resume() {
    const c = ensureContext();
    if (c && c.state === 'suspended') {
      c.resume().catch(() => {});
    }
    if (c) startDrone();
    return c;
  }

  function setMuted(value) {
    muted = !!value;
    if (master && ctx) {
      try {
        master.gain.setTargetAtTime(muted ? 0 : 0.35, ctx.currentTime, 0.02);
      } catch {
        // Gain automation failing must never break the game.
      }
    }
    return muted;
  }

  function isMuted() {
    return muted;
  }

  function tone({ freq = 440, freqEnd = null, type = 'sine', dur = 0.12, vol = 0.2, delay = 0 }) {
    const c = ensureContext();
    if (!c || !master || muted) return;
    try {
      const t0 = c.currentTime + delay;
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      if (freqEnd !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + dur);
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(vol, t0 + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.05);
    } catch {
      // A failed blip is never worth crashing the frame.
    }
  }

  function noise({ dur = 0.3, vol = 0.25, lowpass = 1200, delay = 0 }) {
    const c = ensureContext();
    if (!c || !master || muted) return;
    try {
      const t0 = c.currentTime + delay;
      const len = Math.max(1, Math.floor(c.sampleRate * dur));
      const buffer = c.createBuffer(1, len, c.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = c.createBufferSource();
      src.buffer = buffer;
      const filter = c.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = lowpass;
      const gain = c.createGain();
      gain.gain.setValueAtTime(vol, t0);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      src.start(t0);
    } catch {
      // See tone(): never throw.
    }
  }

  function startDrone() {
    const c = ensureContext();
    if (!c || !master || droneNodes) return;
    // A suspended context (no gesture yet) just waits; the drone starts
    // silently in the background once the browser lets it run.
    try {
      const gain = c.createGain();
      gain.gain.value = 0.045;
      const oscA = c.createOscillator();
      oscA.type = 'sine';
      oscA.frequency.value = DRONE_FREQ;
      const oscB = c.createOscillator();
      oscB.type = 'triangle';
      oscB.frequency.value = DRONE_FREQ * 1.5;
      const lfo = c.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.08;
      const lfoGain = c.createGain();
      lfoGain.gain.value = 0.02;
      lfo.connect(lfoGain);
      lfoGain.connect(gain.gain);
      oscA.connect(gain);
      oscB.connect(gain);
      gain.connect(master);
      oscA.start();
      oscB.start();
      lfo.start();
      droneNodes = { gain, oscA, oscB, lfo };
    } catch {
      droneNodes = null;
    }
  }

  return {
    resume,
    setMuted,
    isMuted,
    shoot() {
      tone({ freq: 880, freqEnd: 220, type: 'square', dur: 0.09, vol: 0.08 });
    },
    pickup(combo = 1) {
      // Chime climbs with the combo: the hotter the streak, the brighter the note.
      const step = Math.min(combo, 12);
      const base = 523.25 * Math.pow(2, step / 12);
      tone({ freq: base, type: 'sine', dur: 0.16, vol: 0.16 });
      tone({ freq: base * 1.5, type: 'sine', dur: 0.2, vol: 0.1, delay: 0.05 });
    },
    explosion(big = false) {
      noise({ dur: big ? 0.55 : 0.3, vol: big ? 0.35 : 0.22, lowpass: big ? 900 : 1600 });
      tone({ freq: big ? 160 : 220, freqEnd: 40, type: 'sawtooth', dur: big ? 0.5 : 0.3, vol: 0.18 });
    },
    hit() {
      noise({ dur: 0.2, vol: 0.28, lowpass: 700 });
      tone({ freq: 140, freqEnd: 55, type: 'sawtooth', dur: 0.25, vol: 0.2 });
    },
    powerup() {
      // Rising arpeggio: C5 E5 G5 C6.
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
        tone({ freq, type: 'triangle', dur: 0.16, vol: 0.16, delay: i * 0.07 });
      });
    },
    fanfare() {
      [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((freq, i) => {
        tone({ freq, type: 'triangle', dur: 0.28, vol: 0.16, delay: i * 0.09 });
      });
      noise({ dur: 0.4, vol: 0.06, lowpass: 4000, delay: 0.1 });
    },
    gameOver() {
      [392, 311.13, 233.08, 155.56].forEach((freq, i) => {
        tone({ freq, type: 'sawtooth', dur: 0.5, vol: 0.14, delay: i * 0.22 });
      });
    },
  };
}
