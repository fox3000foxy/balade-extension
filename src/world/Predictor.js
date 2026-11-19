// Anticipation du geste : pendant que vous déplacez la souris, on cherche l'élément
// cliquable que vous êtes en train de viser.
//
// Indices utilisés (tous tirés de la façon dont une main pointe une cible) :
//  - la direction : la cible est dans un cône autour de la vitesse, d'autant plus large
//    que la cible est grande et proche ;
//  - la décélération : un pointage rapide freine dans son dernier tiers ; à décélération
//    à peu près constante, la distance restante vaut v² / (2·|a|) ;
//  - vos habitudes : un élément que vous cliquez souvent à ce moment-là est favorisé.
// Le score de chaque cible est le produit de ces indices ; on ne prédit que si une
// cible l'emporte nettement.
(() => {
  const { M } = window.Balade;

  const CLICK_KINDS = new Set(["link", "button", "field"]);

  class Predictor {
    constructor(engine) {
      this.engine = engine;
      this.samples = []; // { t (s, temps du moteur), x, y } en coordonnées d'écran
      this.locked = false; // une seule prédiction par geste
      this.lastAt = -Infinity;
    }

    addSample(x, y, t) {
      this.samples.push({ t, x, y });
      while (this.samples.length > 2 && t - this.samples[0].t > 0.3) this.samples.shift();
    }

    /** Vitesse moyenne entre deux instants passés (px/s) : { vx, vy } ou null. */
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
     * Cherche la cible visée. Renvoie { el, share, distance } ou null.
     * @param {number} now temps du moteur
     */
    predict(now) {
      const cfg = this.engine.config.predict;
      const s = this.samples;
      if (s.length < 4) return null;
      const last = s[s.length - 1];

      // Souris arrêtée : le geste est fini, on pourra prédire le suivant.
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

      // Direction stable (sinon la main hésite encore).
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

        // Angle entre la vitesse et la direction de la cible, et tolérance selon sa taille.
        const cos = M.clamp((dx * ux + dy * uy) / D, -1, 1);
        const theta = Math.acos(cos);
        const tol = 0.3 + Math.atan2(Math.max(r.width, r.height) / 2, D);
        if (theta > tol * 2.5) continue;

        let w = Math.exp(-((theta / tol) ** 2));
        if (remaining != null) {
          const spread = 0.45 * remaining + 40;
          w *= Math.exp(-(((D - remaining) / spread) ** 2));
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
      // Gardé pour expérimenter depuis la console : Balade.engine.predictor.lastGuess
      this.lastGuess = { el: best.el, share, distance: best.D, braking, remaining, speed };
      return this.lastGuess;
    }
  }

  window.Balade.Predictor = Predictor;
})();
