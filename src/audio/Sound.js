// Les petits bruits, synthétisés en direct avec Web Audio (aucun fichier son).
// Tous les sons sont pris dans une gamme pentatonique majeure : ils ne peuvent pas
// sonner faux entre eux. Chaque curseur a sa « voix » (un décalage dans la gamme),
// et le son est placé en stéréo à l'endroit du curseur.
(() => {
  const { M } = window.Balade;

  const PENTA = [0, 2, 4, 7, 9];
  const BASE_MIDI = 72; // do5 : aigu et léger

  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

  class Sound {
    constructor(config) {
      this.cfg = config.sound;
      this.ctx = null;
      this.out = null;
      this.muted = !this.cfg.enabled || this.cfg.volume <= 0;
      this.suppressed = false; // plein écran
      this._recent = [];
      this._unlock = () => this._resume();
    }

    // ---------- Cycle de vie ----------

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

      // Les navigateurs bloquent le son tant que l'utilisateur n'a pas interagi avec
      // la page : on réessaie au premier clic ou à la première touche.
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

    /** Volume de 0 à ~0,45 (réglage du menu, déjà converti). */
    setVolume(volume) {
      this.cfg.volume = volume;
      this.muted = volume <= 0;
      if (this.ctx && this.out) this.out.gain.setTargetAtTime(volume, this.ctx.currentTime, 0.05);
    }

    setSuppressed(suppressed) {
      this.suppressed = suppressed;
    }

    // ---------- Sons des gestes ----------

    /** Clic : un « pop » rond qui descend un peu. */
    click(c) {
      const f = this._note(c, 2, 1);
      this._tone({ c, freq: f, to: f * 0.62, dur: 0.075, vol: 0.5, type: "sine" });
      this._tone({ c, freq: f * 2, to: f * 1.2, dur: 0.03, vol: 0.08, type: "triangle" });
    }

    /** Touche : un « tic » aigu ; les touches successives jouent une petite mélodie. */
    key(c, i) {
      const step = [0, 2, 1, 3, 2, 4][i % 6];
      this._tone({ c, freq: this._note(c, step, 2), dur: 0.04, vol: 0.16, type: "sine" });
    }

    /** Retour arrière : un « tuc » plus grave et plus doux. */
    backspace(c) {
      this._tone({ c, freq: this._note(c, M.pick([0, 1]), 1), dur: 0.035, vol: 0.12, type: "triangle" });
    }

    /** Tout effacer d'un coup : un « fiou » qui glisse vers le grave. */
    erase(c) {
      const f = this._note(c, 4, 2);
      this._tone({ c, freq: f, to: f * 0.3, dur: 0.11, vol: 0.18, type: "sine" });
    }

    /** Arrivée : deux notes qui montent, comme un « coucou ». */
    hello(c) {
      this._tone({ c, freq: this._note(c, 0, 1), dur: 0.11, vol: 0.28, type: "sine" });
      this._tone({ c, freq: this._note(c, 2, 1), dur: 0.14, vol: 0.28, type: "sine", delay: 0.08 });
    }

    /** Départ : les mêmes notes, en descendant. */
    bye(c) {
      this._tone({ c, freq: this._note(c, 2, 1), dur: 0.11, vol: 0.22, type: "sine" });
      this._tone({ c, freq: this._note(c, 0, 1), dur: 0.16, vol: 0.22, type: "sine", delay: 0.09 });
    }

    /** Bousculé par la souris : un petit « boing » qui tremble. */
    boing(c) {
      const f = this._note(c, 0, -1);
      this._tone({ c, freq: f, to: f * 1.9, dur: 0.22, vol: 0.32, type: "sine", wobble: 18 });
    }

    // ---------- Synthèse ----------

    /** Fréquence d'un degré de la gamme, décalée par la voix du curseur. */
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
     * Une note courte : attaque très brève, décroissance exponentielle,
     * glissando optionnel (`to`) et vibrato optionnel (`wobble`, en Hz).
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
