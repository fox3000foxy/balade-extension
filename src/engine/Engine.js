// Le moteur : la boucle d'animation, la population de curseurs, la souris de l'utilisateur,
// et le choix du comportement suivant de chaque curseur.
(() => {
  const { M, Cursor, Motion, Stage, Renderer, Sound, Arrive, Leave, Wander } = window.Balade;

  class Engine {
    constructor(config) {
      this.config = config;
      this.motion = new Motion(config);
      this.stage = new Stage(config, Renderer.hostTag);
      this.renderer = new Renderer();
      this.sound = new Sound(config);
      this.motion.sound = this.sound;

      this.cursors = [];
      this.time = 0;
      this.running = false;
      this.stopping = false;

      this._nextId = 0;
      this._raf = 0;
      this._last = 0;
      this._spawnCooldown = 0;
      this._wanted = M.clamp(config.population.min + 1, config.population.min, config.population.max);
      this._nextPopulationChange = M.rand(...config.population.changeEvery);

      this.mouse = { x: -9999, y: -9999, movedAt: -Infinity };
      this.fullscreen = false;
      this._nextFullscreenCheck = 0;

      this._onPointerMove = (e) => {
        this.mouse.x = e.clientX;
        this.mouse.y = e.clientY;
        this.mouse.movedAt = this.time;
      };
      this._onKeyDown = (e) => {
        if (e.key === "Escape") this.stop();
      };
      this._onFullscreenChange = () => this._checkFullscreen();
      this._frame = (ts) => this.frame(ts);
    }

    // ---------- Cycle de vie ----------

    start() {
      if (this.running) return;
      this.running = true;
      this.stopping = false;
      this.renderer.mount();
      this.sound.start();
      window.addEventListener("pointermove", this._onPointerMove, { passive: true });
      window.addEventListener("keydown", this._onKeyDown);
      document.addEventListener("fullscreenchange", this._onFullscreenChange);
      window.addEventListener("resize", this._onFullscreenChange);
      this._checkFullscreen();
      this._last = performance.now();
      this._raf = requestAnimationFrame(this._frame);
    }

    /** Arrêt en douceur : tout le monde sort, puis l'overlay disparaît. */
    stop() {
      if (!this.running || this.stopping) return;
      this.stopping = true;
      for (const c of this.cursors) this._sendAway(c);
    }

    /** Arrêt immédiat. */
    destroy() {
      cancelAnimationFrame(this._raf);
      window.removeEventListener("pointermove", this._onPointerMove);
      window.removeEventListener("keydown", this._onKeyDown);
      document.removeEventListener("fullscreenchange", this._onFullscreenChange);
      window.removeEventListener("resize", this._onFullscreenChange);
      this.renderer.unmount();
      this.sound.close();
      this.cursors = [];
      this.running = false;
      this.stopping = false;
      if (this.onDestroy) this.onDestroy();
    }

    // ---------- Boucle ----------

    frame(now) {
      const dt = Math.min((now - this._last) / 1000, this.config.dtMax);
      this._last = now;
      if (dt > 0) this.step(dt);
      if (!this.running) return;
      this.renderer.render(this.cursors, this.config.cursor.squash);
      this._raf = requestAnimationFrame(this._frame);
    }

    step(dt) {
      this.time += dt;

      // Les événements couvrent l'API Fullscreen ; un contrôle régulier rattrape
      // le plein écran du navigateur, qui ne déclenche pas toujours d'événement.
      if (this.time >= this._nextFullscreenCheck) {
        this._nextFullscreenCheck = this.time + 0.5;
        this._checkFullscreen();
      }
      if (!this.stopping) this._regulatePopulation(dt);

      for (const c of [...this.cursors]) {
        const finished = c.advance(dt);
        if (finished) this._onBehaviorDone(c);
      }

      this._avoidMouse(dt);
      for (const c of this.cursors) c.updateSignals(dt, this.config.cursor);

      if (this.stopping && this.cursors.length === 0) this.destroy();
    }

    // ---------- Comportements ----------

    /**
     * Choisit ce que fait un curseur quand son comportement se termine.
     * C'est le point d'extension pour les futurs comportements (prédiction de tâche…).
     */
    chooseBehavior(cursor) { // eslint-disable-line no-unused-vars
      return new Wander(this);
    }

    _onBehaviorDone(c) {
      if (c.leaving) {
        this.cursors.splice(this.cursors.indexOf(c), 1);
        return;
      }
      c.setBehavior(this.chooseBehavior(c));
    }

    _sendAway(c) {
      if (c.leaving) return;
      c.leaving = true;
      c.setBehavior(new Leave(this));
    }

    // ---------- Population ----------

    _regulatePopulation(dt) {
      const p = this.config.population;

      this._nextPopulationChange -= dt;
      if (this._nextPopulationChange <= 0) {
        this._wanted = M.clamp(this._wanted + M.sign(), p.min, p.max);
        this._nextPopulationChange = M.rand(...p.changeEvery);
      }

      const present = this.cursors.filter((c) => !c.leaving);
      this._spawnCooldown -= dt;

      if (present.length < this._wanted && this._spawnCooldown <= 0) {
        this._spawn();
        this._spawnCooldown = p.spawnGap * M.rand(0.6, 1.6);
      } else if (present.length > this._wanted) {
        // Celui qui part est pris au hasard, pas forcément le dernier arrivé.
        this._sendAway(M.pick(present));
      }
    }

    _spawn() {
      const cfg = this.config;
      const taken = new Set(this.cursors.map((c) => c.name));
      const freeNames = cfg.names.filter((n) => !taken.has(n));
      const usedColors = new Set(this.cursors.map((c) => c.color));
      const freeColors = cfg.palette.filter((col) => !usedColors.has(col));

      const side = M.sign();
      const start = this.stage.offscreenPoint(side, M.rand(0.15, 0.85) * this.stage.height);
      const c = new Cursor({
        id: this._nextId++,
        x: start.x,
        y: start.y,
        name: M.pick(freeNames.length ? freeNames : cfg.names),
        color: M.pick(freeColors.length ? freeColors : cfg.palette)
      });
      c.setBehavior(new Arrive(this));
      this.cursors.push(c);
    }

    // ---------- Plein écran ----------

    /** En plein écran (vidéo, présentation, F11), les curseurs se cachent et se taisent. */
    _checkFullscreen() {
      const fs = this.stage.isFullscreen();
      if (fs === this.fullscreen) return;
      this.fullscreen = fs;
      this.renderer.setHidden(fs);
      this.sound.setSuppressed(fs);
    }

    // ---------- Souris de l'utilisateur ----------

    /** La souris bouscule les curseurs proches ; un ressort les ramène ensuite. */
    _avoidMouse(dt) {
      if (this.time - this.mouse.movedAt > 1.5) return; // souris immobile : on la laisse tranquille
      const { radius, strength } = this.config.avoid;
      for (const c of this.cursors) {
        const dx = c.screenX - this.mouse.x;
        const dy = c.screenY - this.mouse.y;
        const d = Math.hypot(dx, dy);
        if (d >= radius || d < 0.001) continue;
        // Accélération (px/s²) qui croît comme le carré de la proximité.
        // À l'équilibre avec le ressort, l'écart vaut environ strength / springK.
        const k = 1 - d / radius;
        const a = strength * k * k;
        c.push((dx / d) * a * dt, (dy / d) * a * dt);

        // Bousculé franchement : un petit « boing », pas plus d'un par seconde environ.
        if (k > 0.45 && this.time - c.lastBumpSound > this.config.sound.bumpCooldown) {
          c.lastBumpSound = this.time;
          this.sound.boing(c);
        }
      }
    }
  }

  window.Balade.Engine = Engine;
})();
