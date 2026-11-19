// Les gestes de base, sous forme de générateurs à composer avec `yield*`.
// Convention : chaque `yield` rend la main au moteur et reçoit en retour
// le temps écoulé depuis l'image précédente (dt, en secondes).
(() => {
  const { M } = window.Balade;

  class Motion {
    constructor(config) {
      this.cfg = config.motion;
    }

    /** Durée d'un trajet : croît comme la racine de la distance (esprit de la loi de Fitts). */
    duration(dist, speed) {
      const c = this.cfg;
      return M.clamp(c.base + c.sqrtK * Math.sqrt(dist), c.minDur, c.maxDur) / speed;
    }

    /** Avancement « easé » ; `steady` = geste appliqué, sans coup de poignet. */
    ease(k, steady) {
      const c = this.cfg;
      if (steady || !c.flick || k < c.flickAt) return M.easeInOutCubic(k);
      return M.easeOutCubic(k);
    }

    /**
     * Déplace le curseur jusqu'à la cible en suivant un arc.
     * @param {Balade.Cursor} cursor
     * @param {{x:number,y:number} | (() => {x:number,y:number})} target
     *        point fixe, ou fonction réévaluée à chaque image (cible mobile)
     * @param {object} [opts]
     * @param {number} [opts.speed=1]   multiplicateur de vitesse
     * @param {number} [opts.bend]      courbure imposée en px (0 = ligne droite)
     * @param {boolean} [opts.steady]   geste appliqué (easing continu)
     * @param {Function} [opts.onStep]  appelée à chaque image
     */
    *moveTo(cursor, target, opts = {}) {
      const get = typeof target === "function" ? target : () => target;
      const x0 = cursor.x;
      const y0 = cursor.y;
      const p0 = get();
      const dist = Math.hypot(p0.x - x0, p0.y - y0);

      if (dist < 0.5) {
        cursor.x = p0.x;
        cursor.y = p0.y;
        return;
      }

      const c = this.cfg;
      const speed = (opts.speed || 1) * cursor.temperament.pace;
      const dur = this.duration(dist, speed);
      const bend =
        opts.bend != null
          ? opts.bend
          : M.sign() * M.rand(c.bendMin, c.bendMax) * Math.min(dist, c.bendCap);

      let t = 0;
      while (t < dur) {
        t += yield;
        const e = this.ease(Math.min(1, t / dur), opts.steady);
        const p = get();
        const dx = p.x - x0;
        const dy = p.y - y0;
        const len = Math.hypot(dx, dy) || 1;
        // Décalage perpendiculaire en demi-sinus : nul aux extrémités, maximal au milieu.
        const off = Math.sin(Math.PI * e) * bend;
        cursor.x = x0 + dx * e - (dy / len) * off;
        cursor.y = y0 + dy * e + (dx / len) * off;
        if (opts.onStep) opts.onStep();
      }

      const end = get();
      cursor.x = end.x;
      cursor.y = end.y;
      if (opts.onStep) opts.onStep();
    }

    /** Attend `seconds` secondes. */
    *wait(seconds) {
      let t = 0;
      while (t < seconds) t += yield;
    }

    /** Un clic : le curseur s'enfonce, puis un court temps de geste. */
    *click(cursor) {
      cursor.press();
      yield* this.wait(0.07);
    }

    *doubleClick(cursor) {
      yield* this.click(cursor);
      yield* this.wait(0.08);
      yield* this.click(cursor);
    }
  }

  window.Balade.Motion = Motion;
})();
