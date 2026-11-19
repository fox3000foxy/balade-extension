// L'attention partagée : quand vous vous arrêtez quelque part (souris immobile,
// champ en cours de saisie), les curieux viennent se placer autour, à distance polie,
// regardent un moment, puis repartent quand votre attention se déplace.
(() => {
  const { Behavior, M } = window.Balade;

  class Gather extends Behavior {
    *run(cursor) {
      const engine = this.engine;
      const att = engine.attention;
      if (!att) return;
      const cfg = this.config.attention;

      // Une place libre autour du point : l'angle le plus éloigné de ceux déjà pris.
      const taken = engine.cursors
        .filter((c) => c !== cursor && c.gatherAngle != null)
        .map((c) => c.gatherAngle);
      let best = M.rand(0, Math.PI * 2);
      let bestGap = -1;
      for (let i = 0; i < 10; i++) {
        const a = M.rand(0, Math.PI * 2);
        const gap = taken.length
          ? Math.min(...taken.map((t) => Math.abs(M.wrapDeg(((a - t) * 180) / Math.PI))))
          : 180;
        if (gap > bestGap) {
          bestGap = gap;
          best = a;
        }
      }
      cursor.gatherAngle = best;
      const radius = M.rand(...cfg.ring);

      const spot = () => {
        const a = engine.attention || att;
        return this.stage.clampToScreen({
          x: a.pageX + Math.cos(best) * radius - cursor.viewX,
          y: a.pageY + Math.sin(best) * radius * 0.8 - cursor.viewY
        });
      };

      try {
        yield* this.motion.moveTo(cursor, spot, { speed: 0.85, precise: false, width: 60 });
        if (M.chance(cfg.bubbleChance)) cursor.say(M.pick(this.config.bubbles.curious), engine.time);

        // On reste tant que votre attention ne bouge pas (avec un plafond).
        let stay = M.rand(...cfg.stay);
        while (stay > 0 && engine.attention === att) {
          const pause = M.rand(0.6, 1.8);
          let t = pause;
          while (t > 0 && engine.attention === att) {
            const dt = yield;
            t -= dt;
            stay -= dt;
            const p = spot();
            cursor.x = M.damp(cursor.x, p.x, 3, dt);
            cursor.y = M.damp(cursor.y, p.y, 3, dt);
          }
          if (engine.attention !== att) break;
          // Petit mouvement pour « mieux voir ».
          const p = spot();
          yield* this.motion.moveTo(
            cursor,
            { x: p.x + M.rand(-14, 14), y: p.y + M.rand(-10, 10) },
            { speed: 0.6, precise: false, calm: 0.4 }
          );
        }
        // Un temps de réaction avant de se disperser.
        yield* this.motion.wait(M.rand(0.15, 0.6) * cursor.temperament.patience);
      } finally {
        cursor.gatherAngle = null;
      }
    }
  }

  window.Balade.Gather = Gather;
})();
