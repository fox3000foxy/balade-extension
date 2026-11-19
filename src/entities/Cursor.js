// A cursor: its position, temperament, micro-signals (pressure, tilt,
// nudge), its "view" of the page, and the behavior it is running.
// It makes no decisions itself: behaviors (src/behaviors) move it.
//
// Three coordinate frames:
//  - cursor view : (x, y), what behaviors write, as if on ITS own screen;
//  - page        : view + (viewX, viewY), its own scroll offset;
//  - user screen : page - user scroll (screenX, screenY).
// When you scroll, the cursor stays anchored to the page; it then
// scrolls itself to catch up (see Engine._followScroll).
(() => {
  const { M } = window.Balade;

  class Cursor {
    /**
     * @param {object} o
     * @param {number} o.id
     * @param {number} o.x  position de départ, dans sa vue
     * @param {number} o.y
     * @param {number} o.viewX  défilement initial de sa vue (celui de l'utilisateur)
     * @param {number} o.viewY
     * @param {number} o.colorIndex  rang de sa couleur dans la palette du thème
     * @param {string} o.name
     */
    constructor({ id, x, y, viewX, viewY, colorIndex, name }) {
      this.id = id;
      this.colorIndex = colorIndex;
      this.name = name;

      this.x = x;
      this.y = y;
      this.viewX = viewX;
      this.viewY = viewY;

      // Position on the user's screen (computed every frame).
      this.screenX = x;
      this.screenY = y;

      // Scroll catch-up state: { phase, wait, from, to, t, dur, q }.
      this.scroll = { phase: "idle", wait: 0, recentUntil: -Infinity };

      // Offset from nudges, pulled back to 0 by a damped spring.
      this.offsetX = 0;
      this.offsetY = 0;
      this.offsetVX = 0;
      this.offsetVY = 0;

      // Speed estimated from successive screen positions (px/s).
      this.vx = 0;
      this.vy = 0;
      this._prevX = null;
      this._prevY = null;

      this.pressure = 0; // 1 on click, falls back to 0
      this.angle = 0;    // tilt in degrees

      this.focus = null;   // element being watched (highlight)
      this.shape = "arrow"; // arrow | hand | ibeam | crosshair | wait
      this.ghost = null;   // ghost text { el, text } - visual only
      this.bubble = null;  // speech bubble { text, until } (engine time)
      this.heading = null; // imposed heading in degrees (swarm flight), else null
      this.wiggleAt = -Infinity; // start of the last wiggle (greeting)
      this.gatherAngle = null;   // spot taken around an attention point
      this.onDark = false;       // background under the cursor is dark
      this.predicting = null;    // guessed element, during anticipation
      this.caught = false;       // caught during the tag game
      this.nextBgSample = 0;

      // This cursor's "voice" pitch offset (scale degrees) for sounds.
      this.voice = Math.floor(M.rand(0, 5));
      this.lastBumpSound = -Infinity;

      // Temperament: each cursor has its own way of moving.
      // R&D axis 1: motor signatures. Each cursor keeps its own time warp
      // (speed-peak position) and first-try precision for life, so a cursor
      // is recognizable by how it moves. Patient cursors aim true;
      // impatient ones overshoot and correct.
      // R&D axis 3: social roles. leader follows its own nose, follower tags
      // along after greetings, loner avoids other cursors. Re-drawn rarely
      // so roles feel stable but not frozen.
      const patience = M.rand(0.6, 1.6);
      const roleDraw = Math.random();
      this.temperament = {
        pace: M.rand(0.8, 1.25),     // speed multiplier
        patience,                     // pause and reaction time multiplier
        curiosity: M.rand(0, 0.3),    // extra urge to inspect the page
        peakWarp: M.rand(0.68, 0.85), // own speed-peak position
        precise: Math.random() < M.clamp(1.4 - patience, 0.15, 0.95),
        role: roleDraw < 0.15 ? "leader" : roleDraw < 0.45 ? "follower" : roleDraw < 0.6 ? "loner" : "plain"
      };

      this.behavior = null;
      this.routine = null;
      this.leaving = false;
    }

    /** Position dans la page (coordonnées du document). */
    get pageX() {
      return this.x + this.viewX;
    }

    get pageY() {
      return this.y + this.viewY;
    }

    press() {
      this.pressure = 1;
    }

    /** Shows a small speech bubble for `duration` seconds. */
    say(text, now, duration = 1.6) {
      this.bubble = { text, until: now + duration };
    }

    /** Small wiggle (for greeting). */
    wiggle(now) {
      this.wiggleAt = now;
    }

    /** Adds an impulse (px/s) to the offset: the cursor is nudged. */
    push(ix, iy) {
      this.offsetVX += ix;
      this.offsetVY += iy;
    }

    setBehavior(behavior) {
      // Cleanly ends the current behavior (its finally blocks run).
      if (this.routine) {
        try {
          this.routine.return();
        } catch (err) { /* already finished */ }
      }
      this.behavior = behavior;
      this.routine = behavior.run(this);
      this._resetPose();
    }

    _resetPose() {
      this.focus = null;
      this.ghost = null;
      this.shape = "arrow";
    }

    /**
     * Advances the behavior by one time step.
     * @returns {boolean} true if the behavior just finished.
     */
    advance(dt) {
      if (!this.routine) return true;
      let res;
      try {
        res = this.routine.next(dt);
      } catch (err) {
        console.warn("[Balade] Error in a behavior:", err);
        res = { done: true };
      }
      if (res.done) {
        this.routine = null;
        this._resetPose();
        return true;
      }
      return false;
    }

    /** Computes the position on the user's screen. */
    updateScreen(scrollX, scrollY) {
      this.screenX = this.x + this.viewX - scrollX + this.offsetX;
      this.screenY = this.y + this.viewY - scrollY + this.offsetY;
    }

    /** Updates micro-signals after the frame move. */
    updateSignals(dt, cfg, now = 0) {
      // Speed estimated in ITS view (scrolling does not tilt the cursor).
      if (this._prevX == null) {
        this._prevX = this.x;
        this._prevY = this.y;
      }
      this.vx = M.damp(this.vx, (this.x - this._prevX) / dt, 25, dt);
      this.vy = M.damp(this.vy, (this.y - this._prevY) / dt, 25, dt);
      this._prevX = this.x;
      this._prevY = this.y;

      // Damped spring: a = -k*x - c*v (semi-implicit Euler).
      const ax = -cfg.springK * this.offsetX - cfg.springDamping * this.offsetVX;
      const ay = -cfg.springK * this.offsetY - cfg.springDamping * this.offsetVY;
      this.offsetVX += ax * dt;
      this.offsetVY += ay * dt;
      this.offsetX += this.offsetVX * dt;
      this.offsetY += this.offsetVY * dt;

      this.pressure = Math.max(0, this.pressure - cfg.pressDecay * dt);

      // Orientation: in flight the arrow looks where it goes; otherwise it tilts
      // slightly in the direction of movement, then straightens.
      let target;
      if (this.heading != null) {
        target = this.angle + M.wrapDeg(this.heading - this.angle);
      } else {
        target = M.clamp((this.vx + this.offsetVX) * cfg.tiltPerPxPerS, -cfg.tiltMax, cfg.tiltMax);
        if (Math.abs(this.angle) > 180) this.angle = M.wrapDeg(this.angle);
      }
      this.angle = M.damp(this.angle, target, this.heading != null ? 9 : cfg.tiltRate, dt);

      // Wiggle: a fast oscillation that damps out over half a second.
      const w = now - this.wiggleAt;
      this.wiggle_ = w >= 0 && w < 0.5 ? Math.sin(w * 30) * 14 * (1 - w / 0.5) : 0;

      if (this.bubble && now > this.bubble.until) this.bubble = null;
    }
  }

  window.Balade.Cursor = Cursor;
})();
