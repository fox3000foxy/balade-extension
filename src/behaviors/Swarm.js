// On-demand swarm (double Shift press, hold the second): all cursors
// swirl around your pointer, then disperse when you release.
//
// Reynolds-style steering, based on our study notes (formulas rewritten, our own values):
//  - desired velocity = tangential component (rotation) + radial spring toward a ring;
//  - the ring breathes and has three slowly rotating lobes;
//  - rotation direction flips smoothly (square wave softened by tanh);
//  - 70/30 alignment with nearby neighbors;
//  - capped steering force, semi-implicit Euler integration.
(() => {
  const { Behavior, M } = window.Balade;

  // Angle (degrees) of the arrow tip relative to its body: used to orient
  // the arrow in the direction of flight.
  const TIP_ANGLE = -111;

  class Swarm extends Behavior {
    *run(cursor) {
      const engine = this.engine;
      const cfg = this.config.swarm;

      // Flight personality, drawn once.
      const fast = M.chance(0.2);
      const speed = fast ? M.rand(1000, 1400) : M.rand(350, 800);
      const force = fast ? M.rand(3000, 5000) : M.rand(800, 2000);
      const spin = fast ? M.rand(2, 3) : M.rand(0.7, 1.6);
      const lane = M.rand(-22, 22);
      let vx = cursor.vx;
      let vy = cursor.vy;

      try {
        while (engine.swarmHeld) {
          const dt = yield;
          const time = engine.time;
          const O = {
            x: engine.mouse.x + window.scrollX - cursor.viewX,
            y: engine.mouse.y + window.scrollY - cursor.viewY
          };
          const dx = cursor.x - O.x;
          const dy = cursor.y - O.y;
          const d = Math.hypot(dx, dy) || 1;
          const nx = dx / d;
          const ny = dy / d;
          const tx = -ny;
          const ty = nx;
          const theta = Math.atan2(dy, dx);

          const R = cfg.radius * (1 + 0.15 * Math.sin(0.6 * time));
          const ring = R * (1 + 0.25 * Math.sin(3 * theta + 0.8 * time)) + lane;
          const swirl = Math.tanh(3 * Math.cos(0.13 * time));
          const tang = 260 * (0.7 + 0.3 * spin) * swirl;
          const rad = M.clamp(4 * (ring - d), -2400, 1300);
          let wx = tang * tx + rad * nx;
          let wy = tang * ty + rad * ny;

          // Alignment with neighbors within 80 px.
          let ax = 0;
          let ay = 0;
          let wsum = 0;
          for (const o of engine.cursors) {
            if (o === cursor || o.behavior == null || !(o.behavior instanceof Swarm)) continue;
            const od = Math.hypot(o.pageX - cursor.pageX, o.pageY - cursor.pageY);
            if (od > 80) continue;
            const w = 1 - od / 80;
            ax += o.vx * w;
            ay += o.vy * w;
            wsum += w;
          }
          if (wsum > 0) {
            wx = 0.7 * wx + 0.3 * (ax / wsum);
            wy = 0.7 * wy + 0.3 * (ay / wsum);
          }

          // Capped speed and force (wider when far from the swarm).
          const far = Math.max(0, d - 160);
          const vmax = speed * (1.2 + Math.min(3, far / 90));
          const wl = Math.hypot(wx, wy);
          if (wl > vmax) {
            wx *= vmax / wl;
            wy *= vmax / wl;
          }
          let gx = 6 * (wx - vx);
          let gy = 6 * (wy - vy);
          const gmax = force * (1.4 + Math.min(5, far / 50));
          const gl = Math.hypot(gx, gy);
          if (gl > gmax) {
            gx *= gmax / gl;
            gy *= gmax / gl;
          }
          vx += gx * dt;
          vy += gy * dt;
          cursor.x += vx * dt;
          cursor.y += vy * dt;

          // The arrow faces where it flies.
          if (Math.hypot(vx, vy) > 40) {
            cursor.heading = (Math.atan2(vy, vx) * 180) / Math.PI - TIP_ANGLE;
          }
        }
      } finally {
        cursor.heading = null;
      }

      // Released: each cursor drifts away a little in the direction it was going.
      const sp = Math.hypot(vx, vy) || 1;
      const dist = M.rand(70, 200);
      const target = this.stage.clampToScreen({
        x: cursor.x + (vx / sp) * dist + M.rand(-30, 30),
        y: cursor.y + (vy / sp) * dist + M.rand(-30, 30)
      }, 20);
      yield* this.motion.moveTo(cursor, target, { speed: 1.3, precise: false });
    }
  }

  window.Balade.Swarm = Swarm;
})();
