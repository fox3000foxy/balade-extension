// Gesture anticipation: while you move the mouse, search for the
// clickable element you are aiming at.
//
// Cues used (all drawn from how a hand points at a target):
//  - direction: the target is in a cone around the velocity, wider
//    when the target is large and close;
//  - deceleration: a fast pointing movement brakes in its last third;
//    at roughly constant deceleration, the remaining distance is v^2 / (2*|a|);
//  - your habits: an element you often click at this moment is favoured.
// Each target's score is the product of these cues; a prediction is
// only made when one target wins clearly.
(() => {
  const { M } = window.Balade;

  const CLICK_KINDS = new Set(["link", "button", "field"]);

  class Predictor {
    constructor(engine) {
      this.engine = engine;
      this.samples = []; // { t (s, engine time), x, y } in screen coordinates
      this.locked = false; // one prediction per gesture
      this.lastAt = -Infinity;
    }

    addSample(x, y, t) {
      this.samples.push({ t, x, y });
      while (this.samples.length > 2 && t - this.samples[0].t > 0.3) this.samples.shift();
    }

    /** Mean velocity between two past moments (px/s): { vx, vy } or null. */
    _velocity(fromAgo, toAgo, now) {
      const s = this.samples;
      const pick = (ago) => {
        let best = null;
        for (const p of s) if (now - p.t >= ago && (!best || p.t > best.t)) best = p;
        return best || s[0];
      };
      const a = pick(fromAgo);
      const b = pick(toAgo);
      const dt = b.t - a.t;
      if (!a || !b || dt < 0.02) return null;
      return { vx: (b.x - a.x) / dt, vy: (b.y - a.y) / dt };
    }

    /**
     * Searches for the aimed target. Returns { el, share, distance } or null.
     * @param {number} now engine time
     */
    predict(now) {
      const cfg = this.engine.config.predict;
      const s = this.samples;
      if (s.length < 4) return null;
      const last = s[s.length - 1];

      // Mouse stopped: the gesture is done, we can predict the next one.
      if (now - last.t > 0.12) {
        this.locked = false;
        return null;
      }
      if (this.locked || now - this.lastAt < cfg.cooldown) return null;

      const v = this._velocity(0.06, 0, now);
      const vPrev = this._velocity(0.14, 0.07, now);
      if (!v || !vPrev) return null;
      const speed = Math.hypot(v.vx, v.vy);
      const speedPrev = Math.hypot(vPrev.vx, vPrev.vy);
      if (speed < cfg.minSpeed) return null;

      // Stable direction (otherwise the hand is still hesitating).
      const turn = Math.abs(Math.atan2(v.vx * vPrev.vy - v.vy * vPrev.vx, v.vx * vPrev.vx + v.vy * vPrev.vy));
      if (turn > 0.45) return null;

      const accel = (speed - speedPrev) / 0.065;
      const braking = accel < -cfg.brakeAccel;
      const remaining = braking ? M.clamp((speed * speed) / (2 * -accel), 30, 1600) : null;

      const ux = v.vx / speed;
      const uy = v.vy / speed;
      const habits = this.engine.habits;
      const candidates = [];
      let total = 0;

      for (const el of this.engine.stage.visibleElements(now)) {
        if (!CLICK_KINDS.has(this.engine.stage.kindOf(el))) continue;
        const r = el.getBoundingClientRect();
        if (last.x >= r.left && last.x <= r.right && last.y >= r.top && last.y <= r.bottom) continue;
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const dx = cx - last.x;
        const dy = cy - last.y;
        const D = Math.hypot(dx, dy);
        if (D < 1) continue;

        // Angle between velocity and target direction, tolerance based on target size.
        // (A cosine pre-filter was benchmarked here and rejected: Math.cos costs
        // about as much as Math.acos, and survivors pay for both — slower overall.)
        const cos = M.clamp((dx * ux + dy * uy) / D, -1, 1);
        const theta = Math.acos(cos);
        const tol = 0.3 + Math.atan2(Math.max(r.width, r.height) / 2, D);
        if (theta > tol * 2.5) continue;

        const t = theta / tol;
        let w = Math.exp(-t * t);
        if (remaining != null) {
          const spread = 0.45 * remaining + 40;
          const dd = (D - remaining) / spread;
          w *= Math.exp(-dd * dd);
        } else {
          w *= 1 / (1 + D / 900);
        }
        if (habits && habits.enabled) {
          const key = window.Balade.Habits.keyOf(el);
          if (key) w *= 1 + 3 * habits.prior(key, this.engine.time);
        }
        if (w > 1e-4) {
          candidates.push({ el, w, D });
          total += w;
        }
      }
      if (candidates.length === 0 || total <= 0) return null;
      candidates.sort((a, b) => b.w - a.w);
      const best = candidates[0];
      const share = best.w / total;
      const needed = braking ? cfg.minShare : cfg.minShareBallistic;
      if (share < needed || best.D < cfg.minDistance) return null;

      this.locked = true;
      this.lastAt = now;
      // Kept for console experimentation: Balade.engine.predictor.lastGuess
      this.lastGuess = { el: best.el, share, distance: best.D, braking, remaining, speed };
      return this.lastGuess;
    }
  }

  window.Balade.Predictor = Predictor;
})();
