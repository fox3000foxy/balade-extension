// Le moteur : la boucle d'animation, la population de curseurs, le défilement,
// la souris de l'utilisateur, le plein écran, et le choix du comportement suivant.
(() => {
  const { M, Cursor, Motion, Stage, Renderer, Sound, Settings, Arrive, Leave, Wander, Gather, Follow, Swarm } = window.Balade;

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
      this._wanted = config.population.target;
      this._nextPopulationChange = M.rand(...config.population.changeEvery);

      this.mouse = { x: -9999, y: -9999, movedAt: -Infinity, speed: 0, _t: 0 };
      this.fullscreen = false;
      this._nextFullscreenCheck = 0;

      // Attention partagée, vie sociale, essaim.
      this.attention = null;      // { kind, pageX, pageY, since, el? }
      this._still = 0;
      this._attCooled = false;
      this._focusEl = null;
      this._pairs = new Map();
      this._lastGreet = -Infinity;
      this._timers = [];
      this.swarmHeld = false;
      this._shift = { down: false, lastUp: -Infinity, armedAt: null };

      this._onPointerMove = (e) => {
        const now = performance.now();
        const dtm = Math.max(1, now - this.mouse._t) / 1000;
        const d = Math.hypot(e.clientX - this.mouse.x, e.clientY - this.mouse.y);
        if (this.mouse._t) this.mouse.speed = M.lerp(this.mouse.speed, Math.min(d / dtm, 5000), 0.5);
        this.mouse._t = now;
        this.mouse.x = e.clientX;
        this.mouse.y = e.clientY;
        this.mouse.movedAt = this.time;
      };
      this._onKeyDown = (e) => {
        if (e.key === "Escape") this.stop();
        const sh = this._shift;
        if (e.key === "Shift") {
          if (!e.repeat) {
            // Second appui rapproché : on « arme » l'essaim, déclenché si la touche reste tenue.
            sh.armedAt = this.time - sh.lastUp < this.config.swarm.doubleTap ? this.time : null;
            sh.down = true;
          }
        } else {
          sh.armedAt = null; // une autre touche : c'était de la saisie, pas un appel
        }
      };
      this._onKeyUp = (e) => {
        if (e.key !== "Shift") return;
        const sh = this._shift;
        sh.down = false;
        sh.lastUp = this.time;
        sh.armedAt = null;
        this.swarmHeld = false;
      };
      this._onBlur = () => {
        this._shift.down = false;
        this._shift.armedAt = null;
        this.swarmHeld = false;
      };
      this._onPointerDown = (e) => this._reactToClick(e.clientX, e.clientY);
      this._onSubmit = () => this._cheer();
      this._onFocusIn = (e) => {
        if (e.target && e.target.nodeType === 1 && this.stage.isTextField(e.target)) this._focusEl = e.target;
      };
      this._onFocusOut = () => {
        this._focusEl = null;
      };
      this._onFullscreenChange = () => this._checkFullscreen();
      this._frame = (ts) => this.frame(ts);
    }

    // ---------- Cycle de vie ----------

    start() {
      if (this.running) return;
      this.running = true;
      this.stopping = false;
      this.renderer.setTheme(this.config.theme);
      this.renderer.setShowNames(this.config.showNames);
      this.renderer.mount();
      this.sound.start();
      window.addEventListener("pointermove", this._onPointerMove, { passive: true });
      window.addEventListener("keydown", this._onKeyDown, true);
      window.addEventListener("keyup", this._onKeyUp, true);
      window.addEventListener("blur", this._onBlur);
      window.addEventListener("pointerdown", this._onPointerDown, { capture: true, passive: true });
      document.addEventListener("submit", this._onSubmit, true);
      document.addEventListener("focusin", this._onFocusIn, true);
      document.addEventListener("focusout", this._onFocusOut, true);
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
      window.removeEventListener("keydown", this._onKeyDown, true);
      window.removeEventListener("keyup", this._onKeyUp, true);
      window.removeEventListener("blur", this._onBlur);
      window.removeEventListener("pointerdown", this._onPointerDown, { capture: true });
      document.removeEventListener("submit", this._onSubmit, true);
      document.removeEventListener("focusin", this._onFocusIn, true);
      document.removeEventListener("focusout", this._onFocusOut, true);
      document.removeEventListener("fullscreenchange", this._onFullscreenChange);
      window.removeEventListener("resize", this._onFullscreenChange);
      this.renderer.unmount();
      this.sound.close();
      this.cursors = [];
      this.running = false;
      this.stopping = false;
      if (this.onDestroy) this.onDestroy();
    }

    /** Applique de nouveaux réglages sans relancer la balade. */
    applySettings(settings) {
      Settings.applyToConfig(settings, this.config);
      const p = this.config.population;
      this._wanted = p.target;
      this.renderer.setTheme(this.config.theme);
      this.renderer.setShowNames(this.config.showNames);
      this.sound.setVolume(this.config.sound.volume);
      this._checkFullscreen(true);
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

      if (!this.stopping) {
        this._regulatePopulation(dt);
        this._runTimers();
        this._trackAttention(dt);
        this._checkSwarm();
      }

      for (const c of [...this.cursors]) {
        const finished = c.advance(dt);
        if (finished) this._onBehaviorDone(c);
      }

      this._followScroll(dt);
      const sx = window.scrollX;
      const sy = window.scrollY;
      for (const c of this.cursors) c.updateScreen(sx, sy);
      this._avoidMouse(dt);
      if (!this.stopping) this._meetings();
      for (const c of this.cursors) c.updateSignals(dt, this.config.cursor, this.time);

      if (this.stopping && this.cursors.length === 0) this.destroy();
    }

    // ---------- Comportements ----------

    /**
     * Choisit ce que fait un curseur quand son comportement se termine.
     * C'est le point d'extension pour les futurs comportements (prédiction de tâche…).
     */
    chooseBehavior(cursor) { // eslint-disable-line no-unused-vars
      if (this.swarmHeld) return new Swarm(this);
      return new Wander(this);
    }

    // ---------- Petit ordonnanceur (délais en temps du moteur) ----------

    _later(delay, fn) {
      this._timers.push({ at: this.time + delay, fn });
    }

    _runTimers() {
      if (this._timers.length === 0) return;
      const due = this._timers.filter((t) => t.at <= this.time);
      this._timers = this._timers.filter((t) => t.at > this.time);
      for (const t of due) t.fn();
    }

    _alive(c) {
      return !c.leaving && this.cursors.includes(c);
    }

    // ---------- Attention partagée ----------

    /**
     * Votre attention se pose quand la souris reste immobile un moment, ou quand vous
     * tapez dans un champ. Elle se défait quand vous vous éloignez, ou au bout d'un moment.
     */
    _trackAttention(dt) {
      const cfg = this.config.attention;
      if (!cfg.enabled) {
        this.attention = null;
        return;
      }
      const m = this.mouse;
      const sx = window.scrollX;
      const sy = window.scrollY;
      const prev = this.attention;

      if (this._focusEl && this._focusEl.isConnected) {
        const r = this._focusEl.getBoundingClientRect();
        const pos = { pageX: r.left + Math.min(r.width / 2, 120) + sx, pageY: r.top + r.height / 2 + sy };
        if (!prev || prev.el !== this._focusEl) {
          this.attention = { kind: "field", el: this._focusEl, since: this.time, ...pos };
        } else {
          Object.assign(prev, pos);
        }
      } else {
        if (prev && prev.kind === "field") this.attention = null;
        const moving = this.time - m.movedAt < 0.12 && m.speed > cfg.stillSpeed;
        if (moving) {
          this._still = 0;
          this._attCooled = false;
          const a = this.attention;
          if (a && Math.hypot(m.x + sx - a.pageX, m.y + sy - a.pageY) > cfg.leaveRadius) this.attention = null;
        } else {
          this._still += dt;
          const present = this.time - m.movedAt < 30 && m.x > -1000;
          if (!this.attention && !this._attCooled && present && this._still > cfg.stillFor) {
            this.attention = { kind: "mouse", pageX: m.x + sx, pageY: m.y + sy, since: this.time };
          }
        }
      }

      if (this.attention && this.time - this.attention.since > cfg.maxAge) {
        this.attention = null;
        this._attCooled = true; // il faudra bouger avant une nouvelle attention
      }
      if (this.attention && this.attention !== prev) this._summon(this.attention);
    }

    /** Envoie les plus curieux voir ce qui vous intéresse, chacun à son rythme. */
    _summon(att) {
      const cfg = this.config.attention;
      const free = this.cursors.filter(
        (c) => !c.leaving && !c.ghost && c.behavior && !(c.behavior instanceof Swarm) && !(c.behavior instanceof Gather)
      );
      if (free.length === 0) return;
      const keen = 0.5 + this.config.wander.inspect; // réglage « Curiosité »
      const n = Math.max(1, Math.min(free.length, Math.round(this.cursors.length * cfg.share * keen)));
      free.sort((a, b) => b.temperament.curiosity + Math.random() * 0.3 - (a.temperament.curiosity + Math.random() * 0.3));
      for (const c of free.slice(0, n)) {
        this._later(M.rand(...cfg.reaction) * Math.sqrt(c.temperament.patience), () => {
          if (this.attention === att && this._alive(c) && !this.swarmHeld && !c.ghost) c.setBehavior(new Gather(this));
        });
      }
    }

    // ---------- Vie sociale ----------

    /** Deux curseurs qui se croisent se saluent ; parfois l'un suit l'autre. */
    _meetings() {
      const cfg = this.config.social;
      if (!cfg.enabled || this.swarmHeld || this.time - this._lastGreet < cfg.greetCooldown) return;
      const list = this.cursors.filter((c) => !c.leaving && !c.ghost && c.screenY > 0 && c.screenY < window.innerHeight);
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          const a = list[i];
          const b = list[j];
          if (Math.hypot(a.screenX - b.screenX, a.screenY - b.screenY) > cfg.meetDistance) continue;
          const key = a.id < b.id ? `${a.id}-${b.id}` : `${b.id}-${a.id}`;
          if (this.time - (this._pairs.get(key) || -Infinity) < cfg.pairCooldown) continue;
          this._pairs.set(key, this.time);
          this._lastGreet = this.time;

          a.wiggle(this.time);
          this._later(0.08, () => b.wiggle(this.time));
          this.sound.greet(a);
          if (M.chance(cfg.sayOnGreet)) M.pick([a, b]).say(M.pick(this.config.bubbles.greet), this.time);

          // L'un des deux, s'il flânait, suit l'autre un moment.
          if (M.chance(cfg.followChance)) {
            const [f, l] = M.chance(0.5) ? [a, b] : [b, a];
            if (f.behavior instanceof Wander && !f.focus) f.setBehavior(new Follow(this, l));
          }
          return; // une rencontre à la fois
        }
      }
    }

    /** Vos clics attirent le regard : les curseurs proches ont un petit élan vers eux. */
    _reactToClick(x, y) {
      const cfg = this.config.social;
      if (!cfg.reactive || this.swarmHeld || this.stopping) return;
      for (const c of this.cursors) {
        if (c.leaving) continue;
        const dx = x - c.screenX;
        const dy = y - c.screenY;
        const d = Math.hypot(dx, dy);
        if (d > cfg.clickRadius || d < 30) continue;
        const k = 1 - d / cfg.clickRadius;
        c.push((dx / d) * cfg.clickLean * k, (dy / d) * cfg.clickLean * k);
        if (cfg.enabled && M.chance(0.18 * k)) c.say(M.pick(this.config.bubbles.click), this.time, 1.1);
      }
    }

    /** Un formulaire envoyé : petit hourra collectif, chacun saute à son tour. */
    _cheer() {
      const cfg = this.config.social;
      if (!cfg.reactive || this.stopping) return;
      this.sound.cheer();
      for (const c of this.cursors) {
        if (c.leaving) continue;
        const d = M.rand(0, 0.35);
        this._later(d, () => {
          c.push(M.rand(-30, 30), -260);
          if (cfg.enabled && M.chance(0.55)) c.say(M.pick(this.config.bubbles.cheer), this.time, 1.8);
        });
        this._later(d + 0.28, () => c.push(0, -170));
      }
    }

    // ---------- Essaim à la demande ----------

    _checkSwarm() {
      const sh = this._shift;
      if (this.swarmHeld || sh.armedAt == null || !sh.down || !this.config.social.reactive) return;
      if (this.time - sh.armedAt < this.config.swarm.holdBefore) return;
      if (this.mouse.x < -1000) return; // il faut savoir où est votre pointeur
      this.swarmHeld = true;
      for (const c of this.cursors) {
        if (!c.leaving) c.setBehavior(new Swarm(this));
      }
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
        // De temps en temps, quelqu'un arrive ou s'en va, puis on revient vers la cible.
        const drift = this._wanted === p.target ? M.sign() : Math.sign(p.target - this._wanted);
        this._wanted = M.clamp(this._wanted + drift, p.min, p.max);
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
      const usedColors = new Set(this.cursors.map((c) => c.colorIndex));
      // Une couleur pas encore prise dans la palette du thème, si possible.
      const slots = this.renderer.theme.palette.length;
      const freeColors = [];
      for (let i = 0; i < slots; i++) if (!usedColors.has(i)) freeColors.push(i);

      const side = M.sign();
      const start = this.stage.offscreenPoint(side, M.rand(0.15, 0.85) * this.stage.height);
      const c = new Cursor({
        id: this._nextId++,
        x: start.x,
        y: start.y,
        viewX: window.scrollX,
        viewY: window.scrollY,
        name: M.pick(freeNames.length ? freeNames : cfg.names),
        colorIndex: freeColors.length ? M.pick(freeColors) : Math.floor(M.rand(0, slots))
      });
      c.setBehavior(new Arrive(this));
      this.cursors.push(c);
    }

    // ---------- Défilement ----------

    /**
     * Chaque curseur vit sur la page. Quand vous faites défiler, il reste en place
     * dans la page (il glisse donc à l'écran), puis, après un temps de réaction,
     * il défile lui-même pour vous rattraper, avec le même profil de vitesse qu'un geste.
     */
    _followScroll(dt) {
      const cfg = this.config.scroll;
      const tx = window.scrollX;
      const ty = window.scrollY;

      for (const c of this.cursors) {
        if (c.leaving) continue;
        const s = c.scroll;
        const dist = Math.hypot(tx - c.viewX, ty - c.viewY);

        if (s.phase === "idle") {
          if (dist < 1) continue;
          s.phase = "waiting";
          if (this.time < s.recentUntil) {
            s.wait = M.rand(...cfg.followUp); // déjà en train de vous suivre
          } else if (M.chance(cfg.distracted)) {
            s.wait = M.rand(...cfg.distractedFor); // occupé ailleurs un moment
          } else {
            s.wait = M.rand(...cfg.reaction) * Math.sqrt(c.temperament.patience);
          }
        }

        if (s.phase === "waiting") {
          s.wait -= dt;
          if (s.wait > 0) continue;
          if (dist < 1) {
            s.phase = "idle";
            continue;
          }
          s.phase = "moving";
          s.from = { x: c.viewX, y: c.viewY };
          s.to = { x: tx, y: ty };
          s.t = 0;
          s.q = M.rand(...this.config.motion.peakWarp);
          s.dur = M.clamp(0.25 + 0.00055 * dist, cfg.duration[0], cfg.duration[1]) /
            ((this.config.motion.speedMul || 1) * c.temperament.pace);
        }

        if (s.phase === "moving") {
          s.t += dt;
          const k = Math.min(1, s.t / s.dur);
          const u = Motion.minimumJerk(Math.pow(k, s.q));
          c.viewX = s.from.x + (s.to.x - s.from.x) * u;
          c.viewY = s.from.y + (s.to.y - s.from.y) * u;
          if (k >= 1) {
            s.phase = "idle";
            s.recentUntil = this.time + 1.2;
          }
        }
      }
    }

    // ---------- Plein écran ----------

    /** En plein écran (vidéo, présentation, F11), les curseurs se cachent et se taisent. */
    _checkFullscreen(force) {
      const fs = this.config.hideFullscreen && this.stage.isFullscreen();
      if (fs === this.fullscreen && !force) return;
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
