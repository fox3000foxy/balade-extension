// Basic gestures, as generators to compose with `yield*`.
// Convention: each `yield` yields control to the engine and receives back
// the time elapsed since the previous frame (dt, in seconds).
//
// A human pointing movement, based on hand-movement research:
//  1. a fast primary gesture ("ballistic"), with its speed peak before
//     the midpoint, overshooting the target slightly;
//  2. a short, slower correction gesture that finishes the job.
// Duration follows Fitts's law: it depends on distance AND target size.
(() => {
  const { M, PathBuilder } = window.Balade;

  /** Profil à secousse minimale (minimum jerk) : position 10τ³ − 15τ⁴ + 6τ⁵. */
  function minimumJerk(t) {
    return t * t * t * (10 + t * (-15 + 6 * t));
  }

  class Motion {
    constructor(config) {
      this.cfg = config.motion;
      this.paths = new PathBuilder(config);
      this.sound = null; // connected by the engine
    }

    /** Fitts's law: MT = a + b * log2(1 + D / W), divided by speed. */
    duration(dist, width, speed) {
      const f = this.cfg.fitts;
      const id = Math.log2(1 + dist / Math.max(4, width));
      return M.clamp(f.a + f.b * id, f.min, f.max) / speed;
    }

    /**
     * Progress along the path as a function of time (0 -> 1).
     * Minimum jerk is symmetric (speed peak at 50%). Warping time by t^q (q < 1)
     * shifts the peak to 35-45%: a sharp start without jerk, long deceleration to aim.
     */
    progress(t, q) {
      return minimumJerk(Math.pow(t, q));
    }

    /**
     * Déplace le curseur jusqu'à la cible.
     * @param {Balade.Cursor} cursor
     * @param {{x:number,y:number} | (() => {x:number,y:number})} target
     *        point fixe, ou fonction réévaluée à chaque image (cible mobile)
     * @param {object} [opts]
     * @param {number}  [opts.speed=1]     multiplicateur de vitesse
     * @param {number}  [opts.width]       taille de la cible en px (loi de Fitts)
     * @param {boolean} [opts.precise=true] geste de pointage : visée imparfaite + correction
     * @param {number}  [opts.calm=1]      < 1 : trajet plus droit
     * @param {Function}[opts.onStep]      appelée à chaque image
     */
    *moveTo(cursor, target, opts = {}) {
      const get = typeof target === "function" ? target : () => target;
      const p0 = get();
      const dist = Math.hypot(p0.x - cursor.x, p0.y - cursor.y);
      if (dist < 0.5) {
        cursor.x = p0.x;
        cursor.y = p0.y;
        return;
      }

      const c = this.cfg;
      const speed = (opts.speed || 1) * cursor.temperament.pace * (c.speedMul || 1);
      const width = opts.width || c.defaultWidth;
      const precise = opts.precise !== false;

      if (precise && dist > c.correction.minDist && M.chance(c.correction.chance)) {
        // 1. Primary gesture, aiming slightly off-target.
        const ux = (p0.x - cursor.x) / dist;
        const uy = (p0.y - cursor.y) / dist;
        const along = M.clamp(M.rand(...c.correction.along) * dist, -c.correction.maxAlong, c.correction.maxAlong);
        const across = M.clamp(M.rand(-1, 1) * c.correction.across * dist, -c.correction.maxAcross, c.correction.maxAcross);
        const miss = { x: ux * along - uy * across, y: uy * along + ux * across };
        yield* this._segment(cursor, get, miss, { ...opts, speed, width });

        // 2. A fraction of a second to "see" the gap, then the correction.
        yield* this.wait(M.rand(...c.correction.pause));
        yield* this._segment(cursor, get, { x: 0, y: 0 }, {
          ...opts,
          speed: speed * c.correction.speed,
          width,
          calm: 0.25
        });
      } else {
        yield* this._segment(cursor, get, { x: 0, y: 0 }, { ...opts, speed, width });
      }
    }

    /** One continuous gesture, along an arc path, toward target + offset. */
    *_segment(cursor, get, offset, opts) {
      const start = { x: cursor.x, y: cursor.y };
      const t0 = get();
      const end0 = { x: t0.x + offset.x, y: t0.y + offset.y };
      const dist = Math.hypot(end0.x - start.x, end0.y - start.y);
      if (dist < 0.5) {
        cursor.x = end0.x;
        cursor.y = end0.y;
        if (opts.onStep) opts.onStep();
        return;
      }

      const path = this.paths.build(start, end0, { calm: opts.calm });
      const dur = this.duration(dist, opts.width, opts.speed);
      const q = M.rand(...this.cfg.peakWarp);

      let t = 0;
      for (;;) {
        t += yield;
        const k = Math.min(1, t / dur);
        const u = this.progress(k, q);
        const p = path.at(u);
        // Moving target: gradually add its displacement since the start.
        const now = get();
        cursor.x = p.x + (now.x - t0.x) * u;
        cursor.y = p.y + (now.y - t0.y) * u;
        if (opts.onStep) opts.onStep();
        if (k >= 1) break;
      }
      const now = get();
      cursor.x = now.x + offset.x;
      cursor.y = now.y + offset.y;
    }

    /** Waits `seconds` seconds. */
    *wait(seconds) {
      let t = 0;
      while (t < seconds) t += yield;
    }

    /** A click: the cursor presses down, a small sound, then a brief gesture. */
    *click(cursor) {
      cursor.press();
      if (this.sound) this.sound.click(cursor);
      yield* this.wait(0.07);
    }

    *doubleClick(cursor) {
      yield* this.click(cursor);
      yield* this.wait(0.08);
      yield* this.click(cursor);
    }
  }

  Motion.minimumJerk = minimumJerk;
  window.Balade.Motion = Motion;
})();
