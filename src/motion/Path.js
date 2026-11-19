// Paths: a sequence of circular arcs joined without kinks.
//
// Principle: first draw the shape in a local frame, like a "turtle"
// starting at (0,0) with a heading and walking one or more arcs of
// constant curvature. This gives an arbitrary endpoint E. A similarity
// (rotation + scale + translation) then maps (0,0) to A and E to B.
// Similarities preserve circles and angles: arcs stay arcs,
// joins stay smooth, and the cursor lands exactly on the target.
(() => {
  const { M } = window.Balade;
  const DEG = Math.PI / 180;

  class Path {
    /** @param {{x:number,y:number}[]} points polyligne dense, du départ à l'arrivée */
    constructor(points) {
      this.points = points;
      // Cumulative lengths: the path is parameterised by arc length.
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
      // Binary search for the segment.
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
     * Builds a path from A to B, in a style drawn from the distance.
     * @param {{x:number,y:number}} A
     * @param {{x:number,y:number}} B
     * @param {object} [opts]
     * @param {number} [opts.calm=1]  < 1 : straighter path (precise gestures, corrections)
     */
    build(A, B, opts = {}) {
      const D = Math.hypot(B.x - A.x, B.y - A.y);
      if (D < 2) return new Path([A, B]);
      const calm = opts.calm != null ? opts.calm : 1;

      for (let attempt = 0; attempt < 6; attempt++) {
        const arcs = this._design(D, calm);
        const local = this._trace(arcs);
        const E = local[local.length - 1];
        // Reject shapes that double back too far (extreme scale factor).
        if (Math.hypot(E.x, E.y) > 0.55) return new Path(this._place(local, A, B));
      }
      return new Path([A, B]);
    }

    /**
     * Designs the arc sequence: [{ len, turn }] where len is a fraction of total
     * length and turn is the arc's total turning angle (radians, signed), plus initial heading.
     */
    _design(D, calm) {
      const c = this.cfg;
      const s = M.sign();
      // Short paths stay nearly straight; long paths can curve more freely.
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
        // Symmetric arc (turn -2*h0), slightly randomised to be asymmetric.
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
        // Nearly straight departure, then tightening into the target: like when
        // you spot the target late and hook into it.
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
      // "wave": three alternating arcs of unequal lengths.
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

    /** Walks the arcs turtle-style, in small steps, in the local frame. */
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
        // Iterative rotation: the heading unit vector (c, s) is advanced by
        // the fixed rotation (ch, sh) each step. Benchmarked ~4x faster than
        // Math.cos/sin per step (bench-trig.mjs: ~90 vs ~380 ns/gesture),
        // bit-exact (drift 1e-16 over 24 steps). A 256-entry sin table was
        // 3x SLOWER than Math.cos (memory > FPU), Taylor5 both slower and
        // wrong (err 0.5 near +-pi) — both rejected, see docs.
        const ch = Math.cos(dh);
        const sh = Math.sin(dh);
        let c = Math.cos(h + dh / 2);
        let s = Math.sin(h + dh / 2);
        for (let i = 0; i < n; i++) {
          x += c * ds;
          y += s * ds;
          const nc = c * ch - s * sh;
          const ns = s * ch + c * sh;
          c = nc;
          s = ns;
          pts.push({ x, y });
        }
        h += arc.turn;
      }
      return pts;
    }

    /** Similarity that maps (0,0) to A and the last local point to B. */
    _place(local, A, B) {
      const E = local[local.length - 1];
      const bx = B.x - A.x;
      const by = B.y - A.y;
      // Complex number z = (B - A) / E: rotation + scale.
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
