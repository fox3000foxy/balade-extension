// Les trajets : une suite d'arcs de cercle enchaînés sans cassure.
//
// Principe : on dessine d'abord la forme dans un repère local, comme une « tortue »
// qui part de (0, 0) avec un cap, et qui parcourt un ou plusieurs arcs de courbure
// constante. On obtient un point d'arrivée E quelconque. Une similitude (rotation +
// mise à l'échelle + translation) envoie ensuite (0, 0) sur A et E sur B.
// Une similitude conserve les cercles et les angles : les arcs restent des arcs,
// les raccords restent lisses, et le curseur arrive exactement sur la cible.
(() => {
  const { M } = window.Balade;
  const DEG = Math.PI / 180;

  class Path {
    /** @param {{x:number,y:number}[]} points polyligne dense, du départ à l'arrivée */
    constructor(points) {
      this.points = points;
      // Longueurs cumulées : le trajet est paramétré par la distance parcourue.
      this.cum = [0];
      for (let i = 1; i < points.length; i++) {
        const a = points[i - 1];
        const b = points[i];
        this.cum.push(this.cum[i - 1] + Math.hypot(b.x - a.x, b.y - a.y));
      }
      this.length = this.cum[this.cum.length - 1];
    }

    /** Point à la fraction u ∈ [0, 1] de la longueur totale. */
    at(u) {
      const pts = this.points;
      if (u <= 0 || this.length === 0) return pts[0];
      if (u >= 1) return pts[pts.length - 1];
      const target = u * this.length;
      // Recherche dichotomique du segment.
      let lo = 0;
      let hi = this.cum.length - 1;
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (this.cum[mid] < target) lo = mid;
        else hi = mid;
      }
      const seg = this.cum[hi] - this.cum[lo] || 1;
      const k = (target - this.cum[lo]) / seg;
      return {
        x: M.lerp(pts[lo].x, pts[hi].x, k),
        y: M.lerp(pts[lo].y, pts[hi].y, k)
      };
    }
  }

  class PathBuilder {
    constructor(config) {
      this.cfg = config.paths;
    }

    /**
     * Construit un trajet de A vers B, dans un style tiré selon la distance.
     * @param {{x:number,y:number}} A
     * @param {{x:number,y:number}} B
     * @param {object} [opts]
     * @param {number} [opts.calm=1]  < 1 : trajet plus droit (gestes appliqués, corrections)
     */
    build(A, B, opts = {}) {
      const D = Math.hypot(B.x - A.x, B.y - A.y);
      if (D < 2) return new Path([A, B]);
      const calm = opts.calm != null ? opts.calm : 1;

      for (let attempt = 0; attempt < 6; attempt++) {
        const arcs = this._design(D, calm);
        const local = this._trace(arcs);
        const E = local[local.length - 1];
        // Refuse les formes qui reviennent trop sur elles-mêmes (mise à l'échelle extrême).
        if (Math.hypot(E.x, E.y) > 0.55) return new Path(this._place(local, A, B));
      }
      return new Path([A, B]);
    }

    /**
     * Choisit la suite d'arcs : [{ len, turn }] avec len en fraction de la longueur
     * totale et turn = virage total de l'arc (radians, signé), plus le cap initial.
     */
    _design(D, calm) {
      const c = this.cfg;
      const s = M.sign();
      // Les petits trajets restent presque droits, les grands peuvent s'arrondir franchement.
      const amp = calm * M.clamp(D / c.fullCurveAt, 0.25, 1);
      const r = Math.random();
      const pick = (styles) => {
        let acc = 0;
        for (const [name, p] of styles) {
          acc += p;
          if (r < acc) return name;
        }
        return styles[styles.length - 1][0];
      };
      const style =
        D < c.shortTrip
          ? "arc"
          : pick([["arc", c.styles.arc], ["s", c.styles.s], ["hook", c.styles.hook], ["wave", c.styles.wave]]);

      if (style === "arc") {
        const h0 = s * M.rand(4, 34) * DEG * amp;
        // Arc symétrique (virage -2·h0), rendu un peu asymétrique au hasard.
        return { h0, arcs: [{ len: 1, turn: -2 * h0 * M.rand(0.75, 1.25) }] };
      }
      if (style === "s") {
        const h0 = s * M.rand(12, 32) * DEG * amp;
        const k = M.rand(0.4, 0.6);
        return {
          h0,
          arcs: [
            { len: k, turn: -2 * h0 * M.rand(0.85, 1.15) },
            { len: 1 - k, turn: 2 * h0 * M.rand(0.85, 1.15) }
          ]
        };
      }
      if (style === "hook") {
        // Départ presque droit, puis le virage se resserre à l'approche : comme quand
        // on « rattrape » une cible repérée tard.
        const h0 = s * M.rand(18, 45) * DEG * amp;
        const k = M.rand(0.45, 0.65);
        return {
          h0,
          arcs: [
            { len: k, turn: -h0 * M.rand(0.1, 0.4) },
            { len: 1 - k, turn: -h0 * M.rand(1.3, 2.0) }
          ]
        };
      }
      // "wave" : trois arcs alternés, de longueurs inégales.
      const h0 = s * M.rand(8, 20) * DEG * amp;
      const a = M.rand(0.25, 0.35);
      const b = M.rand(0.3, 0.4);
      return {
        h0,
        arcs: [
          { len: a, turn: -2 * h0 },
          { len: b, turn: 3 * h0 * M.rand(0.8, 1.2) },
          { len: 1 - a - b, turn: -2 * h0 * M.rand(0.8, 1.2) }
        ]
      };
    }

    /** Parcourt les arcs comme une tortue, en petits pas, dans le repère local. */
    _trace({ h0, arcs }) {
      const steps = this.cfg.samples;
      const pts = [{ x: 0, y: 0 }];
      let x = 0;
      let y = 0;
      let h = h0;
      for (const arc of arcs) {
        const n = Math.max(2, Math.round(steps * arc.len));
        const ds = arc.len / n;
        const dh = arc.turn / n;
        for (let i = 0; i < n; i++) {
          // Pas centré : le cap au milieu du pas, pour suivre fidèlement le cercle.
          const hm = h + dh / 2;
          x += Math.cos(hm) * ds;
          y += Math.sin(hm) * ds;
          h += dh;
          pts.push({ x, y });
        }
      }
      return pts;
    }

    /** Similitude qui envoie (0,0) sur A et le dernier point local sur B. */
    _place(local, A, B) {
      const E = local[local.length - 1];
      const bx = B.x - A.x;
      const by = B.y - A.y;
      // Nombre complexe z = (B - A) / E : rotation + échelle.
      const den = E.x * E.x + E.y * E.y;
      const zr = (bx * E.x + by * E.y) / den;
      const zi = (by * E.x - bx * E.y) / den;
      return local.map((p) => ({
        x: A.x + p.x * zr - p.y * zi,
        y: A.y + p.x * zi + p.y * zr
      }));
    }
  }

  window.Balade.Path = Path;
  window.Balade.PathBuilder = PathBuilder;
})();
