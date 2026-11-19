// Small sounds, synthesized live with Web Audio (no sound files).
// All sounds come from a major pentatonic scale: they can never sound
// wrong together. Each cursor has its own "voice" (a scale offset),
// and the sound is panned to where the cursor is.
(() => {
  const { M } = window.Balade;

  const PENTA = [0, 2, 4, 7, 9];
  const BASE_MIDI = 72; // C5: bright and light

  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

  class Sound {
    constructor(config) {
      this.cfg = config.sound;
      this.ctx = null;
      this.out = null;
      this.muted = !this.cfg.enabled || this.cfg.volume <= 0;
      this.suppressed = false; // full screen
      this._recent = [];
      this._unlock = () => this._resume();
    }

    // ---------- Lifecycle ----------

    start() {
      if (this.ctx) return;
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        this.ctx = new Ctx({ latencyHint: "interactive" });
      } catch (err) {
        this.ctx = null;
        return;
      }
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -20;
      comp.ratio.value = 4;
      this.out = this.ctx.createGain();
      this.out.gain.value = this.cfg.volume;
      this.out.connect(comp);
      comp.connect(this.ctx.destination);

      // Browsers block audio until the user interacts with the page:
      // retry on the first click or key press.
      if (this.ctx.state !== "running") {
        window.addEventListener("pointerdown", this._unlock, true);
        window.addEventListener("keydown", this._unlock, true);
        this._resume();
      }
    }

    _resume() {
      if (!this.ctx) return;
      this.ctx.resume().then(() => {
        if (this.ctx && this.ctx.state === "running") this._removeUnlock();
      }).catch(() => {});
    }

    _removeUnlock() {
      window.removeEventListener("pointerdown", this._unlock, true);
      window.removeEventListener("keydown", this._unlock, true);
    }

    close() {
      this._removeUnlock();
      if (this.ctx) {
        const ctx = this.ctx;
        this.ctx = null;
        setTimeout(() => ctx.close().catch(() => {}), 300);
      }
    }

    setMuted(muted) {
      this.muted = muted;
    }

    /** Volume from 0 to ~0.45 (menu setting, already converted). */
    setVolume(volume) {
      this.cfg.volume = volume;
      this.muted = volume <= 0;
      if (this.ctx && this.out) this.out.gain.setTargetAtTime(volume, this.ctx.currentTime, 0.05);
    }

    setSuppressed(suppressed) {
      this.suppressed = suppressed;
    }

    // ---------- Gesture sounds ----------

    /** Click: a round "pop" that falls slightly. */
    click(c) {
      const f = this._note(c, 2, 1);
      this._tone({ c, freq: f, to: f * 0.62, dur: 0.075, vol: 0.5, type: "sine" });
      this._tone({ c, freq: f * 2, to: f * 1.2, dur: 0.03, vol: 0.08, type: "triangle" });
    }

    /** Key: a bright "tick"; successive keys play a little melody. */
    key(c, i) {
      const step = [0, 2, 1, 3, 2, 4][i % 6];
      this._tone({ c, freq: this._note(c, step, 2), dur: 0.04, vol: 0.16, type: "sine" });
    }

    /** Backspace: a deeper, softer "thud". */
    backspace(c) {
      this._tone({ c, freq: this._note(c, M.pick([0, 1]), 1), dur: 0.035, vol: 0.12, type: "triangle" });
    }

    /** Erase all at once: a "whoosh" sliding downward. */
    erase(c) {
      const f = this._note(c, 4, 2);
      this._tone({ c, freq: f, to: f * 0.3, dur: 0.11, vol: 0.18, type: "sine" });
    }

    /** Arrival: two rising notes, like a "cuckoo". */
    hello(c) {
      this._tone({ c, freq: this._note(c, 0, 1), dur: 0.11, vol: 0.28, type: "sine" });
      this._tone({ c, freq: this._note(c, 2, 1), dur: 0.14, vol: 0.28, type: "sine", delay: 0.08 });
    }

    /** Departure: same notes, descending. */
    bye(c) {
      this._tone({ c, freq: this._note(c, 2, 1), dur: 0.11, vol: 0.22, type: "sine" });
      this._tone({ c, freq: this._note(c, 0, 1), dur: 0.16, vol: 0.22, type: "sine", delay: 0.09 });
    }

    /** Greeting between two cursors: two quick light notes. */
    greet(c) {
      this._tone({ c, freq: this._note(c, 2, 1), dur: 0.07, vol: 0.16, type: "sine" });
      this._tone({ c, freq: this._note(c, 4, 1), dur: 0.09, vol: 0.16, type: "sine", delay: 0.06 });
    }

    /** Collective cheer: a short rising arpeggio. */
    cheer() {
      [0, 2, 4, 5, 7].forEach((deg, i) => {
        this._tone({ c: null, freq: this._note(null, deg, 1), dur: 0.16, vol: 0.2, type: "triangle", delay: i * 0.07 });
      });
    }

    /** Nudged by the mouse: a small wobbling "boing". */
    boing(c) {
      const f = this._note(c, 0, -1);
      this._tone({ c, freq: f, to: f * 1.9, dur: 0.22, vol: 0.32, type: "sine", wobble: 18 });
    }

    // ---------- Synthesis ----------

    /** Frequency of a scale degree, shifted by the cursor's voice. */
    _note(c, degree, octave) {
      const d = degree + (c ? c.voice : 0);
      const midi = BASE_MIDI + 12 * (octave + Math.floor(d / 5)) + PENTA[d % 5];
      return mtof(midi);
    }

    _allowed() {
      if (!this.ctx || this.muted || this.suppressed || this.ctx.state !== "running") return false;
      const now = this.ctx.currentTime;
      this._recent = this._recent.filter((t) => now - t < 1);
      if (this._recent.length >= this.cfg.maxPerSecond) return false;
      this._recent.push(now);
      return true;
    }

    /**
     * A short note: very brief attack, exponential decay,
     * optional glide (`to`) and optional vibrato (`wobble`, in Hz).
     */
    _tone({ c, freq, to, dur, vol, type, delay = 0, wobble = 0 }) {
      if (!this._allowed()) return;
      const ctx = this.ctx;
      const t = ctx.currentTime + 0.005 + delay;

      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur);

      let lfo = null;
      if (wobble) {
        lfo = ctx.createOscillator();
        lfo.frequency.value = wobble;
        const depth = ctx.createGain();
        depth.gain.value = freq * 0.08;
        lfo.connect(depth);
        depth.connect(osc.frequency);
      }

      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0005, t + dur);

      const pan = ctx.createStereoPanner();
      pan.pan.value = c ? M.clamp((c.screenX / Math.max(1, window.innerWidth)) * 1.4 - 0.7, -0.7, 0.7) : 0;

      osc.connect(g);
      g.connect(pan);
      pan.connect(this.out);
      osc.start(t);
      osc.stop(t + dur + 0.02);
      if (lfo) {
        lfo.start(t);
        lfo.stop(t + dur + 0.02);
      }
      osc.onended = () => pan.disconnect();
    }
  }

  window.Balade.Sound = Sound;
})();
