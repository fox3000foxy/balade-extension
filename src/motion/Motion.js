// Les gestes de base, sous forme de générateurs à composer avec `yield*`.
// Convention : chaque `yield` rend la main au moteur et reçoit en retour
// le temps écoulé depuis l'image précédente (dt, en secondes).
//
// Un pointage humain, d'après la littérature sur le mouvement de la main :
//  1. un geste principal rapide (« balistique »), dont le pic de vitesse arrive
//     avant la moitié du trajet, et qui rate un peu la cible ;
//  2. un court geste de correction, plus lent, qui finit le travail.
// La durée suit la loi de Fitts : elle dépend de la distance ET de la taille de la cible.
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
      this.sound = null; // branché par le moteur
    }

    /** Loi de Fitts : MT = a + b · log2(1 + D / W), divisée par la vitesse. */
    duration(dist, width, speed) {
      const f = this.cfg.fitts;
      const id = Math.log2(1 + dist / Math.max(4, width));
      return M.clamp(f.a + f.b * id, f.min, f.max) / speed;
    }

    /**
     * Avancement le long du trajet en fonction du temps (0 → 1).
     * Le minimum jerk est symétrique (pic de vitesse à 50 %). En déformant le temps
     * par t^q (q < 1), on avance le pic vers 35–45 % : démarrage vif mais sans à-coup,
     * longue décélération pour viser.
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
        // 1. Geste principal, qui vise un point légèrement à côté.
        const ux = (p0.x - cursor.x) / dist;
        const uy = (p0.y - cursor.y) / dist;
        const along = M.clamp(M.rand(...c.correction.along) * dist, -c.correction.maxAlong, c.correction.maxAlong);
        const across = M.clamp(M.rand(-1, 1) * c.correction.across * dist, -c.correction.maxAcross, c.correction.maxAcross);
        const miss = { x: ux * along - uy * across, y: uy * along + ux * across };
        yield* this._segment(cursor, get, miss, { ...opts, speed, width });

        // 2. Une fraction de seconde pour « voir » l'écart, puis la correction.
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

    /** Un seul geste continu, le long d'un trajet en arcs, vers cible + décalage. */
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
        // Cible mobile : on ajoute progressivement son déplacement depuis le départ.
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

    /** Attend `seconds` secondes. */
    *wait(seconds) {
      let t = 0;
      while (t < seconds) t += yield;
    }

    /** Un clic : le curseur s'enfonce, un petit son, puis un court temps de geste. */
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
