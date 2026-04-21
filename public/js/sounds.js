// ============================================================
// sounds.js — Web Audio API procedural sound effects
// (no external assets needed)
// ============================================================

(function () {
  let ctx = null;

  function getCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    return ctx;
  }

  /**
   * Play a short tone burst.
   * @param {number} freq   - base frequency Hz
   * @param {string} type   - oscillator type
   * @param {number} decay  - seconds
   * @param {number} vol    - gain (0–1)
   */
  function tone(freq, type = 'sine', decay = 0.18, vol = 0.18) {
    try {
      const c = getCtx();
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.connect(gain);
      gain.connect(c.destination);
      osc.type = type;
      osc.frequency.setValueAtTime(freq, c.currentTime);
      gain.gain.setValueAtTime(vol, c.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + decay);
      osc.start(c.currentTime);
      osc.stop(c.currentTime + decay);
    } catch (_) { /* silently ignore if audio not available */ }
  }

  const Sounds = {
    /** Click / select bead */
    select() {
      tone(440, 'sine', 0.12, 0.14);
    },

    /** Move to empty node */
    move() {
      tone(330, 'triangle', 0.16, 0.16);
      setTimeout(() => tone(420, 'triangle', 0.12, 0.12), 60);
    },

    /** Capture opponent bead */
    capture() {
      tone(200, 'sawtooth', 0.08, 0.2);
      setTimeout(() => tone(600, 'sine', 0.25, 0.18), 80);
    },

    /** Win fanfare */
    win() {
      const notes = [330, 392, 494, 659];
      notes.forEach((f, i) => setTimeout(() => tone(f, 'sine', 0.35, 0.22), i * 140));
    },

    /** Invalid move */
    invalid() {
      tone(180, 'sawtooth', 0.15, 0.1);
    },

    /** Opponent connected */
    connected() {
      tone(523, 'sine', 0.2, 0.15);
      setTimeout(() => tone(659, 'sine', 0.2, 0.15), 120);
    }
  };

  window.Sounds = Sounds;
})();
