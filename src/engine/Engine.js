// The engine: animation loop, cursor population, scrolling,
// the user's mouse, full screen, and next-behavior selection.
(() => {
  const { M, Cursor, Motion, Stage, Renderer, Sound, Settings, Habits, Predictor, Arrive, Leave, Wander, Gather, Follow, Swarm, Anticipate, Flee, I18n } = window.Balade;

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

      // Shared attention, social life, swarm.
      this.attention = null;      // { kind, pageX, pageY, since, el? }
      this._still = 0;
      this._attCooled = false;
      this._focusEl = null;
      this._pairs = new Map();
      this._lastGreet = -Infinity;
      this._timers = [];
      this.swarmHeld = false;
      this._shift = { down: false, lastUp: -Infinity, armedAt: null };

      // Anticipation and habits.
      this.habits = new Habits(location.hostname);
      this.predictor = new Predictor(this);
      this.predictionHits = 0;
      this._userClicks = []; // { el, time } : your recent clicks

      // Tag game and focus mode.
      this.game = null;  // { start, total, caught, done, doneAt, text }
      this.focus = null; // { phase: "focus" | "break", until (ms, wall clock) }
      this._hudAt = 0;

      this._onPointerMove = (e) => {
        const now = performance.now();
        const dtm = Math.max(1, now - this.mouse._t) / 1000;
        const d = Math.hypot(e.clientX - this.mouse.x, e.clientY - this.mouse.y);
        if (this.mouse._t) this.mouse.speed = M.lerp(this.mouse.speed, Math.min(d / dtm, 5000), 0.5);
        this.mouse._t = now;
        this.mouse.x = e.clientX;
        this.mouse.y = e.clientY;
        this.mouse.movedAt = this.time;
        this.predictor.addSample(e.clientX, e.clientY, now / 1000);
      };
      this._onKeyDown = (e) => {
        if (e.key === "Escape") {
          if (this.game) this.endGame();
          else this.stop();
        }
        const sh = this._shift;
        if (e.key === "Shift") {
          if (!e.repeat) {
            // Second press close together: "arm" the swarm, triggered if the key stays held.
            sh.armedAt = this.time - sh.lastUp < this.config.swarm.doubleTap ? this.time : null;
            sh.down = true;
          }
        } else {
          sh.armedAt = null; // another key: it was typing, not a swarm call
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
      this._onPointerDown = (e) => {
        this._reactToClick(e.clientX, e.clientY);
        this._learnClick(e.target);
      };
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

    // ---------- Lifecycle ----------

    /**
     * @param {object} [snapshot] - optional cross-page state from chrome.storage.session
     *   { cursors: [{ name, colorIndex, rx, ry }] }
     *   Cursors are placed at relative positions (0-1) on the new page instead of
     *   spawning from the edges, so they appear to "survive" the navigation.
     */
    start(snapshot) {
      if (this.running) return;
      this.running = true;
      this.stopping = false;
      this.renderer.setTheme(this.config.theme, this.config.custom);
      this.renderer.setShowNames(this.config.showNames);
      this.renderer.mount();
      this.sound.start();
      this.habits.enabled = this.config.predict.learn;
      this.habits.load();
      this._onScroll = () => this.stage.invalidateCache();
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
      window.addEventListener("scroll", this._onScroll, { passive: true, capture: true });
      window.addEventListener("resize", this._onScroll, { passive: true });
      this._checkFullscreen();
      // Restore cursors from a previous page if a fresh snapshot was passed.
      if (snapshot && snapshot.cursors && snapshot.cursors.length) {
        const W = this.stage.width, H = this.stage.height;
        for (const sc of snapshot.cursors) {
          const c = new Cursor({
            id: this._nextId++,
            x: sc.rx * W,
            y: sc.ry * H,
            viewX: window.scrollX,
            viewY: window.scrollY,
            name: sc.name,
            colorIndex: sc.colorIndex
          });
          c.setBehavior(new Arrive(this));
          this.cursors.push(c);
        }
      }
      this._last = performance.now();
      this._raf = requestAnimationFrame(this._frame);
    }

    /** Graceful stop: everyone leaves, then the overlay fades out. */
    stop() {
      if (!this.running || this.stopping) return;
      this.stopping = true;
      for (const c of this.cursors) this._sendAway(c);
    }

    /** Immediate stop. */
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
      window.removeEventListener("scroll", this._onScroll, { capture: true });
      window.removeEventListener("resize", this._onScroll);
      this.renderer.unmount();
      this.sound.close();
      this.habits.save();
      this.habits.dispose();
      this.cursors = [];
      this._timers = [];
      this._pairs.clear();
      this._userClicks = [];
      this.stage.invalidateCache();
      if (this.predictor) this.predictor.lastGuess = null;
      this._companion = null;
      this._onScroll = null;
      this.onDestroy = null;
      this.running = false;
      this.stopping = false;
      if (this.onDestroy) this.onDestroy();
    }

    /** Applies new settings without restarting the cursors. */
    applySettings(settings) {
      Settings.applyToConfig(settings, this.config);
      const p = this.config.population;
      this._wanted = p.target;
      this.renderer.setTheme(this.config.theme, this.config.custom);
      this.renderer.setShowNames(this.config.showNames);
      this.sound.setVolume(this.config.sound.volume);
      if (!this.config.adaptDark) for (const c of this.cursors) c.onDark = false;
      this.habits.enabled = this.config.predict.learn;
      this._checkFullscreen(true);
    }

    // ---------- Loop ----------

    frame(now) {
      const dt = Math.min((now - this._last) / 1000, this.config.dtMax);
      this._last = now;
      if (dt > 0) this.step(dt);
      if (!this.running) return;
      this.renderer.render(this.cursors, this.config.cursor.squash, this.time);
      this._raf = requestAnimationFrame(this._frame);
    }

    step(dt) {
      this.time += dt;

      // Events cover the Fullscreen API; a periodic check catches browser
      // full screen (F11), which doesn't always fire an event.
      if (this.time >= this._nextFullscreenCheck) {
        this._nextFullscreenCheck = this.time + 0.5;
        this._checkFullscreen();
      }

      if (!this.stopping) {
        this._runTimers();
        this._updateFocus();
        if (this.game) {
          this._updateGame();
        } else {
          this._regulatePopulation(dt);
          this._trackAttention(dt);
          this._checkSwarm();
          this._predictGesture();
        }
      }

      for (const c of [...this.cursors]) {
        const finished = c.advance(dt);
        if (finished) this._onBehaviorDone(c);
      }

      this._followScroll(dt);
      const sx = window.scrollX;
      const sy = window.scrollY;
      for (const c of this.cursors) c.updateScreen(sx, sy);
      if (!this.game) this._avoidMouse(dt);
      if (!this.stopping && !this.game && this.time - (this._lastMeetings || -Infinity) > 0.25) {
        this._lastMeetings = this.time;
        this._meetings();
      }
      this._sampleBackgrounds();
      for (const c of this.cursors) c.updateSignals(dt, this.config.cursor, this.time);

      if (this.stopping && this.cursors.length === 0) this.destroy();
    }

    // ---------- Behaviors ----------

    /**
     * Chooses what a cursor does when its behavior finishes.
     * This is the extension point for future behaviors (task prediction...).
     */
    chooseBehavior(cursor) {
      if (this.game && !cursor.caught) return new Flee(this);
      if (this.swarmHeld) return new Swarm(this);
      return new Wander(this);
    }

    // ---------- Small scheduler (delays in engine time) ----------

    _later(delay, fn) {
      if (this._timers.length > 100) this._timers.shift();
      this._timers.push({ at: this.time + delay, fn });
    }

    _runTimers() {
      if (this._timers.length === 0) return;
      const due = this._timers.filter((t) => t.at <= this.time);
      this._timers = this._timers.filter((t) => t.at > this.time);
      for (const t of due) {
        try { t.fn(); } catch (err) { /* one bad timer must not break the frame */ }
      }
    }

    _alive(c) {
      return !c.leaving && this.cursors.includes(c);
    }

    // ---------- Shared attention ----------

    /**
     * Your attention is set when the mouse stays still, or when you type in a field.
     * It clears when you move away, or after a timeout.
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
        this._attCooled = true; // must move before attention can be set again
      }
      if (this.attention && this.attention !== prev) this._summon(this.attention);
    }

    /** Sends the most curious cursors to see what you're looking at, each at its own pace. */
    _summon(att) {
      const cfg = this.config.attention;
      const free = this.cursors.filter(
        (c) => !c.leaving && !c.ghost && c.behavior && !(c.behavior instanceof Swarm) && !(c.behavior instanceof Gather)
      );
      if (free.length === 0) return;
      const keen = 0.5 + this.config.wander.inspect; // "Curiosity" setting
      const n = Math.max(1, Math.min(free.length, Math.round(this.cursors.length * cfg.share * keen)));
      free.sort((a, b) => b.temperament.curiosity + Math.random() * 0.3 - (a.temperament.curiosity + Math.random() * 0.3));
      for (const c of free.slice(0, n)) {
        this._later(M.rand(...cfg.reaction) * Math.sqrt(c.temperament.patience), () => {
          if (this.attention === att && this._alive(c) && !this.swarmHeld && !c.ghost) c.setBehavior(new Gather(this));
        });
      }
    }

    // ---------- Social life ----------

    /** Two cursors crossing paths greet each other; sometimes one follows the other. */
    _meetings() {
      const cfg = this.config.social;
      if (!cfg.enabled || this.swarmHeld || this.time - this._lastGreet < cfg.greetCooldown) return;
      // Purge stale pair entries so the Map doesn't grow unboundedly.
      if (this._pairs.size > 50) {
        const cutoff = this.time - cfg.pairCooldown;
        for (const [k, t] of this._pairs) if (t < cutoff) this._pairs.delete(k);
      }
      const list = this.cursors.filter((c) => !c.leaving && !c.ghost && c.screenY > 0 && c.screenY < window.innerHeight);
      if (list.length > 30) list.length = 30; // cap the O(n^2) scan on crowded pages
      // Pick a random starting pair offset so we don't always scan from the same corner.
      const start = Math.floor(Math.random() * Math.max(1, list.length));
      for (let ii = 0; ii < list.length; ii++) {
        const i = (start + ii) % list.length;
        for (let jj = i + 1; jj < list.length; jj++) {
          const a = list[i];
          const b = list[jj];
          if (Math.hypot(a.screenX - b.screenX, a.screenY - b.screenY) > cfg.meetDistance) continue;
          const key = a.id < b.id ? `${a.id}-${b.id}` : `${b.id}-${a.id}`;
          if (this.time - (this._pairs.get(key) || -Infinity) < cfg.pairCooldown) continue;
          this._pairs.set(key, this.time);
          this._lastGreet = this.time;

          a.wiggle(this.time);
          this._later(0.08, () => b.wiggle(this.time));
          this.sound.greet(a);
          if (M.chance(cfg.sayOnGreet)) M.pick([a, b]).say(M.pick(this.config.bubbles.greet), this.time);

          // One of them, if wandering, follows the other for a while.
          if (M.chance(cfg.followChance)) {
            const [f, l] = M.chance(0.5) ? [a, b] : [b, a];
            if (f.behavior instanceof Wander && !f.focus) f.setBehavior(new Follow(this, l));
          }
          return; // one greeting at a time
        }
      }
    }


    /** Your clicks draw attention: nearby cursors get a small push toward them. */
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

    /** A form submitted: a collective cheer, each cursor jumping in turn. */
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

    // ---------- Anticipation ----------

    _predictGesture() {
      const cfg = this.config.predict;
      if (!cfg.enabled || !this.config.social.reactive || this.swarmHeld) return;
      const guess = this.predictor.predict(performance.now() / 1000);
      if (guess) this._anticipate(guess.el, "gesture");
    }

    /** Records your click, then optionally guesses the next one from habits. */
    _learnClick(target) {
      if (this.stopping || !target || target.nodeType !== 1) return;
      const key = this.habits.record(target, this.time);
      if (!key) return;
      this._userClicks.push({ el: target, time: this.time });
      if (this._userClicks.length > 20) this._userClicks.shift();

      const cfg = this.config.predict;
      if (!cfg.enabled || !cfg.learn || !this.config.social.reactive) return;
      const next = this.habits.predictNext(key);
      if (!next) return;
      this._later(M.rand(0.4, 1.0), () => {
        const el = this.stage.visibleElements(this.time).find((e) => Habits.keyOf(e) === next.key);
        if (el) this._anticipate(el, "habit");
      });
    }

    /** Sends the nearest free cursor toward the guessed element. */
    _anticipate(el, reason) {
      if (this.cursors.some((c) => c.predicting)) return;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      let best = null;
      let bestD = Infinity;
      for (const c of this.cursors) {
        if (c.leaving || c.ghost) continue;
        const b = c.behavior;
        if (b instanceof Swarm || b instanceof Gather || b instanceof Anticipate) continue;
        const d = Math.hypot(c.screenX - cx, c.screenY - cy);
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
      if (best) best.setBehavior(new Anticipate(this, el, reason));
    }

    /**
     * Did the cursor guess right? "right" if you clicked the element or your
     * mouse is over it, "wrong" if you clicked elsewhere, null otherwise (still waiting).
     */
    judgePrediction(el, since) {
      for (const k of this._userClicks) {
        if (k.time < since) continue;
        return el === k.el || el.contains(k.el) || k.el.contains(el) ? "right" : "wrong";
      }
      const r = el.getBoundingClientRect();
      const m = this.mouse;
      if (this.time - m.movedAt < 2 && m.x >= r.left && m.x <= r.right && m.y >= r.top && m.y <= r.bottom) return "right";
      return null;
    }

    // ---------- On-demand swarm ----------

    _checkSwarm() {
      const sh = this._shift;
      if (this.swarmHeld || sh.armedAt == null || !sh.down || !this.config.social.reactive) return;
      if (this.time - sh.armedAt < this.config.swarm.holdBefore) return;
      if (this.mouse.x < -1000) return; // we need to know where your pointer is
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

      // Focus mode: everyone stays out, except one companion that "works" beside you.
      if (this.focus && this.focus.phase === "focus") {
        for (const c of this.cursors) {
          if (c === this._companion && !c.leaving && c.behavior instanceof Companion) continue;
          this._sendAway(c);
        }
        return;
      }

      this._nextPopulationChange -= dt;
      if (this._nextPopulationChange <= 0) {
        // Occasionally, someone arrives or leaves, then we drift back toward the target.
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
        // The one that leaves is chosen at random, not necessarily the last to arrive.
        this._sendAway(M.pick(present));
      }
    }

    _spawn() {
      const cfg = this.config;
      const taken = new Set(this.cursors.map((c) => c.name));
      const freeNames = cfg.names.filter((n) => !taken.has(n));
      const usedColors = new Set(this.cursors.map((c) => c.colorIndex));
      // A color not yet taken from the theme palette, if possible.
      const slots = this.renderer.theme.palette.length;
      const freeColors = [];
      for (let i = 0; i < slots; i++) if (!usedColors.has(i)) freeColors.push(i);

      const side = M.sign();
      const start = this.stage.offscreenPoint(side, M.rand(0.15, 0.85) * this.stage.height);
      // Arrival mood (site weather): fanfare pops in faster, lazy drifts in slower.
      const mood = this.arrivalMood || "steady";
      const paceMul = mood === "fanfare" ? 1.35 : mood === "lazy" ? 0.65 : 1;
      const c = new Cursor({
        id: this._nextId++,
        x: start.x,
        y: start.y,
        viewX: window.scrollX,
        viewY: window.scrollY,
        name: M.pick(freeNames.length ? freeNames : cfg.names),
        colorIndex: freeColors.length ? M.pick(freeColors) : Math.floor(M.rand(0, slots))
      });
      c.setBehavior(new Arrive(this, paceMul));
      this.cursors.push(c);
      // Return from break: announce it.
      if (this.focus && this.focus.phase === "break" && this.config.social.enabled) {
        this._later(M.rand(0.8, 1.6), () => this._alive(c) && c.say(M.pick(this.config.bubbles.breakTime), this.time, 2.2));
      }
      return c;
    }

    // ---------- Tag game ----------

    /** Catch them all: each cursor flees your mouse; catch one by passing over it. */
    startGame() {
      if (this.game || this.stopping) return;
      this.swarmHeld = false;
      // The whole team in play, right away.
      const present = () => this.cursors.filter((c) => !c.leaving);
      while (present().length < this.config.population.target) this._spawn();
      const players = present();
      for (const c of players) {
        c.caught = false;
        c.setBehavior(new Flee(this));
      }
      this.game = { start: this.time, total: players.length, caught: 0, done: false, doneAt: 0 };
      this.sound.cheer();
      this._hudGame();
    }

    endGame() {
      if (!this.game) return;
      this.game = null;
      this.renderer.setHud("top", null);
      for (const c of this.cursors) c.caught = false;
    }

    _updateGame() {
      const g = this.game;
      if (g.done) {
        if (this.time - g.doneAt > 3.5) this.endGame();
        return;
      }
      const m = this.mouse;
      const r = this.config.game.catchRadius;
      if (this.time - m.movedAt < 1) {
        for (const c of this.cursors) {
          if (c.caught || c.leaving) continue;
          if (Math.hypot(c.screenX - m.x, c.screenY - m.y) < r) this._catch(c);
        }
      }
      if (this.time - this._hudAt > 0.2 && this.game && !this.game.done) this._hudGame();
    }

    _catch(c) {
      const g = this.game;
      c.caught = true;
      c.wiggle(this.time);
      this.sound.boing(c);
      if (this.config.social.enabled) c.say(M.pick(this.config.bubbles.caught), this.time, 1.4);
      g.caught++;
      this._later(0.5, () => this._sendAway(c));
      if (g.caught >= g.total) this._winGame();
      else this._hudGame();
    }

    async _winGame() {
      const g = this.game;
      g.done = true;
      g.doneAt = this.time;
      const t = this.time - g.start;
      this.sound.cheer();
      const best = await Engine.bestTime(t);
      const record = best == null || t <= best;
      if (this.game === g) {
        this.renderer.setHud("top", `${I18n.t("hud_game_done", Engine.fmt(t))} ${record ? I18n.t("hud_game_record") : I18n.t("hud_game_best", Engine.fmt(best))}`);
      }
    }

    _hudGame() {
      const g = this.game;
      this._hudAt = this.time;
      this.renderer.setHud("top", I18n.t("hud_game", g.caught, g.total, Engine.fmt(this.time - g.start)));
    }

    static fmt(seconds) {
      const s = Math.max(0, Math.round(seconds));
      return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
    }

    /** Best time (stored in extension storage, never in the site's storage). */
    static async bestTime(candidate) {
      const key = "balade.best.chat";
      try {
        if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
          const prev = (await chrome.storage.local.get(key))[key];
          if (prev == null || candidate < prev) await chrome.storage.local.set({ [key]: candidate });
          return prev == null ? null : prev;
        }
      } catch (err) { /* no record */ }
      Engine._best = Engine._best == null ? null : Engine._best;
      const prev = Engine._best;
      if (prev == null || candidate < prev) Engine._best = candidate;
      return prev;
    }

    // ---------- Focus mode ----------

    /** Cursors leave for `minutes`, then come back for the break. */
    startFocus(minutes) {
      const f = this.config.focus;
      this.endGame();
      this.focus = { phase: "focus", until: Date.now() + (minutes || f.minutes) * 60000 };
      // Keep one cursor as a working companion; promote a wanderer if possible.
      const cand = this.cursors.find((c) => !c.leaving) || null;
      this._companion = cand;
      if (cand) cand.setBehavior(new Companion(this));
      this._updateFocus(true);
    }

    stopFocus() {
      this.focus = null;
      this._companion = null;
      this.renderer.setHud("corner", null);
    }

    _updateFocus(force) {
      const f = this.focus;
      if (!f) return;
      const now = Date.now();
      if (now >= f.until) {
        if (f.phase === "focus") {
          // Focus time is up: break starts, everyone comes back.
          f.phase = "break";
          f.until = now + this.config.focus.breakMinutes * 60000;
          this._spawnCooldown = 0;
          this.sound.cheer();
        } else {
          this.stopFocus();
          return;
        }
      }
      if (force || this.time - this._hudAt > 0.5) {
        this._hudAt = this.time;
        const left = (f.until - now) / 1000;
        this.renderer.setHud("corner", I18n.t(f.phase === "focus" ? "hud_focus" : "hud_break", Engine.fmt(left)));
      }
    }

    // ---------- Scrolling ----------

    /**
     * Each cursor lives on the page. When you scroll, it stays put in the
     * page (so it slides on screen), then, after a reaction delay,
     * it scrolls itself to catch up, with the same speed profile as a gesture.
     */
    _followScroll(dt) {
      const cfg = this.config.scroll;
      const tx = window.scrollX;
      const ty = window.scrollY;

      // Scroll hint: near the bottom of a long scrollable page, one cursor
      // drifts to the top area and points up — purely visual, no scrolling.
      this._scrollHintAt = this._scrollHintAt || 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (max > window.innerHeight * 2 && ty > max * 0.85 && this.time > this._scrollHintAt) {
        this._scrollHintAt = this.time + M.rand(20, 40);
        const free = this.cursors.find((c) => !c.leaving && c.behavior instanceof Wander);
        if (free) {
          const top = { x: M.rand(0.3, 0.7) * this.stage.width, y: M.rand(0.08, 0.18) * this.stage.height };
          free.setBehavior(new Anticipate(this, { isConnected: true, localName: "scroll-hint", getAttribute: () => null, contains: () => false, getBoundingClientRect: () => ({ left: top.x, top: top.y, width: 8, height: 8, right: top.x + 8, bottom: top.y + 8 }) }, "scroll"));
        }
      }

      for (const c of this.cursors) {
        if (c.leaving) continue;
        const s = c.scroll;
        const dist = Math.hypot(tx - c.viewX, ty - c.viewY);

        if (s.phase === "idle") {
          if (dist < 1) continue;
          s.phase = "waiting";
          if (this.time < s.recentUntil) {
            s.wait = M.rand(...cfg.followUp); // already following you recently
          } else if (M.chance(cfg.distracted)) {
            s.wait = M.rand(...cfg.distractedFor); // busy elsewhere for a moment
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

    // ---------- Dark backgrounds ----------

    /** Periodically samples the background under each cursor (round-robin). */
    _sampleBackgrounds() {
      const cfg = this.config.dark;
      if (!this.config.adaptDark) {
        for (const c of this.cursors) c.onDark = false;
        return;
      }
      // At most 2 cursors per frame: elementFromPoint + getComputedStyle is costly.
      const n = this.cursors.length;
      if (n === 0) return;
      this._bgIndex = (this._bgIndex || 0) % n;
      for (let k = 0; k < Math.min(2, n); k++) {
        const c = this.cursors[(this._bgIndex + k) % n];
        if (this.time < c.nextBgSample) continue;
        c.nextBgSample = this.time + cfg.every * M.rand(0.8, 1.2);
        const lum = this.stage.luminanceAt(c.screenX + 3, c.screenY + 6);
        if (lum == null) continue;
        // Hysteresis: don't flip repeatedly on an intermediate background.
        if (c.onDark && lum > cfg.above) c.onDark = false;
        else if (!c.onDark && lum < cfg.below) c.onDark = true;
      }
      this._bgIndex = (this._bgIndex + 2) % n;
    }

    // ---------- Full screen ----------

    /** In full screen (video, presentation, F11), cursors hide and go silent. */
    _checkFullscreen(force) {
      const fs = this.config.hideFullscreen && this.stage.isFullscreen();
      if (fs === this.fullscreen && !force) return;
      this.fullscreen = fs;
      this.renderer.setHidden(fs);
      this.sound.setSuppressed(fs);
    }

    // ---------- User's mouse ----------

    /** The mouse nudges nearby cursors; a spring pulls them back. */
    _avoidMouse(dt) {
      if (this.time - this.mouse.movedAt > 1.5) return; // mouse still: leave it alone
      const { radius, strength } = this.config.avoid;
      for (const c of this.cursors) {
        const dx = c.screenX - this.mouse.x;
        const dy = c.screenY - this.mouse.y;
        const d = Math.hypot(dx, dy);
        if (d >= radius || d < 0.001) continue;
        // Acceleration (px/s^2) that grows as the square of closeness.
        // At equilibrium with the spring, the offset is about strength / springK.
        const k = 1 - d / radius;
        const a = strength * k * k;
        c.push((dx / d) * a * dt, (dy / d) * a * dt);

        // Nudged hard: a small "boing", at most roughly one per second.
        if (k > 0.45 && this.time - c.lastBumpSound > this.config.sound.bumpCooldown) {
          c.lastBumpSound = this.time;
          this.sound.boing(c);
        }
      }
    }
  }

  window.Balade.Engine = Engine;
})();
