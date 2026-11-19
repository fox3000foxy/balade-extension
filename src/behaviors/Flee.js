// Jeu du chat : le curseur fuit votre souris. Mêmes principes de pilotage que l'essaim
// (vitesse désirée, force plafonnée), avec trois envies qui s'additionnent :
//  - s'éloigner de la souris, d'autant plus fort qu'elle est proche ;
//  - rester loin des bords de l'écran (sinon on se fait coincer) ;
//  - ne pas se coller aux autres fuyards.
// Quand il est loin du danger, il erre doucement.
(() => {
  const { Behavior, M } = window.Balade;

  class Flee extends Behavior {
    *run(cursor) {
      const engine = this.engine;
      const cfg = this.config.game;
      const fast = M.chance(0.25);
      const vmax = (fast ? M.rand(650, 850) : M.rand(380, 600)) * Math.sqrt(this.config.motion.speedMul || 1);
      const force = fast ? M.rand(3500, 5000) : M.rand(2000, 3200);
      let vx = 0;
      let vy = 0;
      let wanderA = M.rand(0, Math.PI * 2);

      while (engine.game && !cursor.caught) {
        const dt = yield;
        const W = this.stage.width;
        const H = this.stage.height;
        // Pendant la partie, chacun joue sur votre écran.
        cursor.viewX = window.scrollX;
        cursor.viewY = window.scrollY;

        let wx = 0;
        let wy = 0;

        // 1. Fuir la souris.
        const m = engine.mouse;
        const dx = cursor.x - m.x;
        const dy = cursor.y - m.y;
        const d = Math.hypot(dx, dy) || 1;
        if (d < cfg.danger && m.x > -1000) {
          const k = 1 - d / cfg.danger;
          const urgency = vmax * (0.6 + 1.6 * k * k);
          wx += (dx / d) * urgency;
          wy += (dy / d) * urgency;
        } else {
          // 2. Errer quand on est tranquille.
          wanderA += M.rand(-1, 1) * 2.5 * dt;
          wx += Math.cos(wanderA) * vmax * 0.25;
          wy += Math.sin(wanderA) * vmax * 0.25;
        }

        // 3. Les bords repoussent (et les coins encore plus).
        const margin = cfg.wall;
        const push = (dist) => (dist < margin ? Math.pow(1 - Math.max(0, dist) / margin, 2) * vmax * 1.8 : 0);
        wx += push(cursor.x) - push(W - cursor.x);
        wy += push(cursor.y) - push(H - cursor.y);

        // 4. Ne pas se coller aux autres.
        for (const o of engine.cursors) {
          if (o === cursor || o.caught || o.leaving) continue;
          const ox = cursor.pageX - o.pageX;
          const oy = cursor.pageY - o.pageY;
          const od = Math.hypot(ox, oy);
          if (od > 0 && od < 60) {
            wx += (ox / od) * (1 - od / 60) * 300;
            wy += (oy / od) * (1 - od / 60) * 300;
          }
        }

        // Pilotage : vitesse désirée plafonnée, force plafonnée.
        const wl = Math.hypot(wx, wy);
        const cap = vmax * 1.6;
        if (wl > cap) {
          wx *= cap / wl;
          wy *= cap / wl;
        }
        let gx = 7 * (wx - vx);
        let gy = 7 * (wy - vy);
        const gl = Math.hypot(gx, gy);
        if (gl > force) {
          gx *= force / gl;
          gy *= force / gl;
        }
        vx += gx * dt;
        vy += gy * dt;
        cursor.x = M.clamp(cursor.x + vx * dt, 6, W - 6);
        cursor.y = M.clamp(cursor.y + vy * dt, 6, H - 6);
      }
    }
  }

  window.Balade.Flee = Flee;
})();
